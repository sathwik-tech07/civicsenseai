package main

import (
	"context"
	"fmt"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"civicsense/whatsapp-gateway/internal/api"
	"civicsense/whatsapp-gateway/internal/config"
	"civicsense/whatsapp-gateway/internal/events"
	"civicsense/whatsapp-gateway/internal/logging"
	"civicsense/whatsapp-gateway/internal/messaging"
	"civicsense/whatsapp-gateway/internal/queue"
	"civicsense/whatsapp-gateway/internal/session"
	"civicsense/whatsapp-gateway/internal/whatsapp"
)

const Banner = `
======================================================================
  CivicSense AI — WhatsApp Gateway Service (Whatsmeow)
======================================================================
`

func main() {
	fmt.Print(Banner)

	// 1. Load configuration
	cfg := config.Load()
	logging.SetLevel(cfg.LogLevel)
	logging.Infof("Starting WhatsApp Gateway on port %d...", cfg.Port)
	logging.Infof("Backend FastAPI URL: %s", cfg.FastAPIURL)
	logging.Infof("Database Dialect: %s (Schema: %s)", cfg.DBDialect, cfg.DBSchema)

	// 2. Initialize persistent session store (PostgreSQL or SQLite)
	storeMgr, err := session.NewStoreManager(cfg)
	if err != nil {
		logging.Errorf("Failed to initialize session store: %v", err)
		os.Exit(1)
	}
	defer func() {
		if err := storeMgr.Close(); err != nil {
			logging.Errorf("Error closing session store: %v", err)
		}
	}()

	// 3. Initialize WhatsApp ClientManager
	cm := whatsapp.NewClientManager(storeMgr.Container, storeMgr.DeviceStore, cfg)
	if err := cm.Initialize(); err != nil {
		logging.Errorf("Failed to initialize WhatsApp client: %v", err)
		os.Exit(1)
	}

	// 4. Initialize durable event queue and deduplication store (PostgreSQL or SQLite)
	queueStore, err := queue.NewQueueStore(cfg, 24*time.Hour)
	if err != nil {
		logging.Errorf("Failed to initialize durable queue store: %v", err)
		os.Exit(1)
	}
	defer func() {
		if err := queueStore.Close(); err != nil {
			logging.Errorf("Error closing queue store: %v", err)
		}
	}()

	// 5. Initialize Event Dispatcher to FastAPI
	dispatcher := events.NewDispatcher(cfg.FastAPIURL, cfg.GatewaySecret)

	// 6. Initialize Message Receiver (inbound pipeline + restart-safe deduplication)
	receiver := messaging.NewMessageReceiver(cm, dispatcher)
	receiver.SetQueueStore(queueStore)
	cm.SetMessageHandlers(receiver.HandleIncomingMessage, receiver.HandleReceipt)

	// 7. Start background queue retry worker with bounded exponential backoff
	workerCtx, workerCancel := context.WithCancel(context.Background())
	defer workerCancel()
	go queueStore.StartRetryWorker(workerCtx, dispatcher, 2*time.Second)

	// 8. Initialize Message Sender (outbound pipeline)
	sender := messaging.NewMessageSender(cm)

	// 9. Setup HTTP API handlers and router
	handler := api.NewAPIHandler(cm, sender)
	handler.SetQueueStore(queueStore)
	router := api.NewRouter(cfg, handler)

	httpServer := &http.Server{
		Addr:         fmt.Sprintf(":%d", cfg.Port),
		Handler:      router,
		ReadTimeout:  15 * time.Second,
		WriteTimeout: 60 * time.Second,
		IdleTimeout:  120 * time.Second,
	}

	// 8. Start HTTP Server in background goroutine
	serverErrChan := make(chan error, 1)
	go func() {
		logging.Infof("HTTP server listening on http://0.0.0.0:%d", cfg.Port)
		if err := httpServer.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			serverErrChan <- err
		}
	}()

	// 9. Start WhatsApp client connection / QR pairing loop
	go func() {
		if err := cm.Start(); err != nil {
			logging.Errorf("Error during WhatsApp client startup: %v", err)
		}
	}()

	// 10. Handle OS termination signals for clean, graceful shutdown
	stopChan := make(chan os.Signal, 1)
	signal.Notify(stopChan, os.Interrupt, syscall.SIGTERM, syscall.SIGINT)

	select {
	case sig := <-stopChan:
		logging.Infof("Received termination signal (%s). Initiating graceful shutdown...", sig.String())
	case err := <-serverErrChan:
		logging.Errorf("HTTP server encounter fatal error: %v", err)
	}

	// Graceful shutdown with 10 second timeout
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	// Shutdown HTTP listener
	if err := httpServer.Shutdown(ctx); err != nil {
		logging.Errorf("HTTP server shutdown error: %v", err)
	} else {
		logging.Infof("HTTP server stopped successfully.")
	}

	// Disconnect WhatsApp client websocket cleanly
	cm.Disconnect()
	logging.Infof("WhatsApp client disconnected cleanly.")

	logging.Infof("WhatsApp Gateway stopped.")
}
