package whatsapp

import (
	"context"
	"fmt"
	"sync"
	"time"

	"go.mau.fi/whatsmeow"
	waE2E "go.mau.fi/whatsmeow/proto/waE2E"
	"go.mau.fi/whatsmeow/store"
	"go.mau.fi/whatsmeow/store/sqlstore"
	"go.mau.fi/whatsmeow/types"
	"go.mau.fi/whatsmeow/types/events"
	waLog "go.mau.fi/whatsmeow/util/log"
	"google.golang.org/protobuf/proto"

	"civicsense/whatsapp-gateway/internal/config"
	"civicsense/whatsapp-gateway/internal/logging"
	"civicsense/whatsapp-gateway/internal/pairing"
)

// Modern baseline WhatsApp Web version (active production revision as of Nov 2026).
// Ensures the gateway never falls back to an ancient built-in version that causes HTTP 405 Client Outdated.
var FallbackWAVersion = store.WAVersionContainer{2, 3000, 1054777660}

// ClientManager coordinates the whatsmeow client and connection state.
type ClientManager struct {
	mu           sync.RWMutex
	client       *whatsmeow.Client
	deviceStore  *store.Device
	container    *sqlstore.Container
	cfg          *config.Config
	connected    bool
	loggedIn     bool
	reconnecting bool
	cancel       context.CancelFunc
	ctx          context.Context

	versionMu         sync.Mutex
	refreshingVersion bool

	onMessage func(msg *events.Message)
	onReceipt func(receipt *events.Receipt)
}

func NewClientManager(container *sqlstore.Container, deviceStore *store.Device, cfg *config.Config) *ClientManager {
	ctx, cancel := context.WithCancel(context.Background())
	return &ClientManager{
		container:   container,
		deviceStore: deviceStore,
		cfg:         cfg,
		ctx:         ctx,
		cancel:      cancel,
	}
}

// SetMessageHandlers registers callbacks for message and receipt events.
func (cm *ClientManager) SetMessageHandlers(onMsg func(*events.Message), onReceipt func(*events.Receipt)) {
	cm.mu.Lock()
	defer cm.mu.Unlock()
	cm.onMessage = onMsg
	cm.onReceipt = onReceipt
}

// syncWAVersion fetches and synchronizes the WhatsApp Web version safely under versionMu.
func (cm *ClientManager) syncWAVersion(ctx context.Context) error {
	cm.versionMu.Lock()
	defer cm.versionMu.Unlock()

	initialVer := store.GetWAVersion()
	latestVer, err := whatsmeow.GetLatestVersion(ctx, nil)
	if err != nil {
		return fmt.Errorf("failed to fetch latest WhatsApp Web version: %w", err)
	}

	if latestVer == nil || latestVer.IsZero() {
		return fmt.Errorf("fetched WhatsApp Web version is empty or zero")
	}

	if *latestVer != initialVer {
		logging.Infof("Updating WhatsApp Web version from %s to %s", initialVer.String(), latestVer.String())
		store.SetWAVersion(*latestVer)
		if store.DeviceProps.Version != nil {
			store.DeviceProps.Version.Primary = proto.Uint32((*latestVer)[0])
			store.DeviceProps.Version.Secondary = proto.Uint32((*latestVer)[1])
			store.DeviceProps.Version.Tertiary = proto.Uint32((*latestVer)[2])
		}
	} else {
		logging.Infof("WhatsApp Web version is already synchronized: %s", initialVer.String())
	}
	return nil
}

// Initialize creates the whatsmeow client and registers core event handlers.
func (cm *ClientManager) Initialize() error {
	cm.mu.Lock()
	defer cm.mu.Unlock()

	// Pre-seed with verified modern WhatsApp Web version so the client never uses
	// an ancient hardcoded library version that triggers HTTP 405 Client Outdated
	store.SetWAVersion(FallbackWAVersion)
	if store.DeviceProps.Version != nil {
		store.DeviceProps.Version.Primary = proto.Uint32(FallbackWAVersion[0])
		store.DeviceProps.Version.Secondary = proto.Uint32(FallbackWAVersion[1])
		store.DeviceProps.Version.Tertiary = proto.Uint32(FallbackWAVersion[2])
	}

	// Dynamically fetch and sync latest WhatsApp Web version to stay up-to-date
	verCtx, verCancel := context.WithTimeout(context.Background(), 7*time.Second)
	defer verCancel()

	if err := cm.syncWAVersion(verCtx); err != nil {
		logging.Warnf("Failed to dynamically fetch latest WhatsApp Web version: %v. Safely using verified modern baseline: %s", err, store.GetWAVersion().String())
	}

	waLogger := waLog.Stdout("WhatsmeowClient", "INFO", true)
	cm.client = whatsmeow.NewClient(cm.deviceStore, waLogger)

	// Register event listener
	cm.client.AddEventHandler(cm.handleEvent)

	if cm.deviceStore != nil && cm.deviceStore.ID != nil {
		logging.Infof("Whatsmeow client initialized. Device ID: %s", cm.deviceStore.ID.String())
	} else {
		logging.Infof("Whatsmeow client initialized. Device is unpaired (ready for QR pairing).")
	}
	return nil
}

// Start connects the client or starts QR pairing if not logged in.
func (cm *ClientManager) Start() error {
	cm.mu.RLock()
	client := cm.client
	cm.mu.RUnlock()

	if client == nil {
		return fmt.Errorf("client not initialized")
	}

	if client.Store.ID == nil {
		// Clean up any stale socket connection before requesting QR channel
		if client.IsConnected() {
			client.Disconnect()
		}

		// Device not paired yet -> Start QR pairing channel
		logging.Infof("No paired session found. Starting QR code pairing channel...")
		qrChan, err := client.GetQRChannel(cm.ctx)
		if err != nil {
			return fmt.Errorf("failed to get QR channel: %w", err)
		}

		err = client.Connect()
		if err != nil {
			return fmt.Errorf("failed to connect for QR pairing: %w", err)
		}

		go cm.listenQR(qrChan)
	} else {
		// Existing paired session -> Connect directly
		logging.Infof("Existing device credentials detected. Connecting to WhatsApp network...")
		err := client.Connect()
		if err != nil {
			logging.Errorf("Initial connection failed: %v. Reconnect loop will retry...", err)
		}
	}

	return nil
}

func (cm *ClientManager) listenQR(qrChan <-chan whatsmeow.QRChannelItem) {
	for {
		select {
		case <-cm.ctx.Done():
			return
		case item, ok := <-qrChan:
			if !ok {
				logging.Infof("QR pairing channel closed.")
				return
			}
			switch item.Event {
			case "code":
				logging.Infof("New pairing QR code received (expires in %v)", item.Timeout)
				if err := pairing.SetQRCode(item.Code, item.Timeout); err != nil {
					logging.Errorf("Failed to encode QR PNG: %v", err)
				}
			case "success":
				logging.Infof("WhatsApp device successfully paired!")
				pairing.SetPaired()
				cm.mu.Lock()
				cm.loggedIn = true
				cm.mu.Unlock()
			case "timeout":
				logging.Warnf("QR pairing timed out.")
				pairing.SetStatus(pairing.StatusTimedOut)
			case "err-client-outdated":
				logging.Warnf("QR pairing received err-client-outdated. Refreshing WhatsApp version and retrying...")
				pairing.SetStatus(pairing.StatusFailed)
				go func() {
					refreshCtx, refreshCancel := context.WithTimeout(context.Background(), 10*time.Second)
					defer refreshCancel()
					if err := cm.syncWAVersion(refreshCtx); err != nil {
						logging.Warnf("Dynamic version sync after 405 error failed: %v", err)
					}
					time.Sleep(2 * time.Second)
					if err := cm.Start(); err != nil {
						logging.Errorf("Failed to restart QR channel after version refresh: %v", err)
					}
				}()
				return
			default:
				logging.Infof("QR event: %s", item.Event)
			}
		}
	}
}

func (cm *ClientManager) handleEvent(evt interface{}) {
	switch v := evt.(type) {
	case *events.Connected:
		cm.mu.Lock()
		cm.connected = true
		cm.loggedIn = true
		cm.mu.Unlock()
		pairing.SetPaired()
		logging.Infof("Connected to WhatsApp Web network as %s", cm.client.Store.ID.String())

	case *events.Disconnected:
		cm.mu.Lock()
		cm.connected = false
		cm.mu.Unlock()
		logging.Warnf("Disconnected from WhatsApp network.")
		if cm.cfg.AutoReconnect {
			go cm.reconnectWithBackoff()
		}

	case *events.LoggedOut:
		cm.mu.Lock()
		cm.connected = false
		cm.loggedIn = false
		cm.mu.Unlock()
		pairing.SetStatus(pairing.StatusIdle)
		logging.Warnf("Device session logged out by user or server. Resetting to fresh device and restarting QR pairing...")
		go func() {
			if err := cm.ResetToFreshDevice(); err != nil {
				logging.Errorf("Failed to reset device after logout event: %v", err)
			}
			time.Sleep(1 * time.Second)
			if err := cm.Start(); err != nil {
				logging.Warnf("Failed to auto-restart QR channel after logout: %v", err)
			}
		}()

	case *events.StreamReplaced:
		cm.mu.Lock()
		cm.connected = false
		cm.mu.Unlock()
		logging.Warnf("WhatsApp Web stream replaced by another session.")

	case *events.ClientOutdated:
		logging.Warnf("WhatsApp Web client outdated (405) event received. Attempting dynamic version refresh...")
		go func() {
			cm.mu.Lock()
			if cm.refreshingVersion {
				cm.mu.Unlock()
				logging.Infof("Dynamic version refresh already in progress, skipping duplicate event")
				return
			}
			cm.refreshingVersion = true
			cm.mu.Unlock()

			defer func() {
				cm.mu.Lock()
				cm.refreshingVersion = false
				cm.mu.Unlock()
			}()

			refreshCtx, refreshCancel := context.WithTimeout(context.Background(), 7*time.Second)
			defer refreshCancel()
			if err := cm.syncWAVersion(refreshCtx); err != nil {
				logging.Warnf("Failed to dynamically refresh WhatsApp Web version: %v. Continuing with current version: %s", err, store.GetWAVersion().String())
			} else {
				logging.Infof("Successfully refreshed WhatsApp Web version to %s after 405 event", store.GetWAVersion().String())
			}
		}()

	case *events.Message:
		cm.mu.RLock()
		handler := cm.onMessage
		cm.mu.RUnlock()
		if handler != nil {
			handler(v)
		}

	case *events.Receipt:
		cm.mu.RLock()
		handler := cm.onReceipt
		cm.mu.RUnlock()
		if handler != nil {
			handler(v)
		}
	}
}

func (cm *ClientManager) reconnectWithBackoff() {
	cm.mu.Lock()
	if cm.reconnecting {
		cm.mu.Unlock()
		return
	}
	cm.reconnecting = true
	cm.mu.Unlock()

	defer func() {
		cm.mu.Lock()
		cm.reconnecting = false
		cm.mu.Unlock()
	}()

	attempts := 0
	for {
		select {
		case <-cm.ctx.Done():
			return
		default:
		}

		if cm.client.IsConnected() {
			cm.mu.Lock()
			cm.connected = true
			cm.mu.Unlock()
			return
		}

		attempts++
		wait := time.Duration(attempts*2) * time.Second
		if wait > 30*time.Second {
			wait = 30 * time.Second
		}
		logging.Infof("Reconnection attempt %d in %v...", attempts, wait)
		time.Sleep(wait)

		err := cm.client.Connect()
		if err == nil {
			logging.Infof("Reconnected successfully on attempt %d", attempts)
			return
		}
		logging.Warnf("Reconnection attempt %d failed: %v", attempts, err)
	}
}

// IsConnected returns whether client currently has an active websocket.
func (cm *ClientManager) IsConnected() bool {
	cm.mu.RLock()
	defer cm.mu.RUnlock()
	if cm.client == nil {
		return false
	}
	return cm.client.IsConnected()
}

// IsLoggedIn returns whether client has verified authentication credentials.
func (cm *ClientManager) IsLoggedIn() bool {
	cm.mu.RLock()
	defer cm.mu.RUnlock()
	if cm.client == nil {
		return false
	}
	return cm.client.IsLoggedIn()
}

// GetJID returns the currently authenticated JID or empty string.
func (cm *ClientManager) GetJID() string {
	cm.mu.RLock()
	defer cm.mu.RUnlock()
	if cm.client != nil && cm.client.Store != nil && cm.client.Store.ID != nil {
		return cm.client.Store.ID.String()
	}
	return ""
}

// Disconnect gracefully disconnects from the WhatsApp network.
func (cm *ClientManager) Disconnect() {
	cm.mu.Lock()
	defer cm.mu.Unlock()
	if cm.client != nil && cm.client.IsConnected() {
		cm.client.Disconnect()
		cm.connected = false
	}
}

// ResetToFreshDevice clears session credentials, acquires a clean device from the container,
// and re-creates the whatsmeow client ready for a brand new QR pairing cycle.
func (cm *ClientManager) ResetToFreshDevice() error {
	cm.mu.Lock()
	defer cm.mu.Unlock()

	if cm.client != nil {
		cm.client.Disconnect()
	}

	cm.connected = false
	cm.loggedIn = false
	pairing.SetStatus(pairing.StatusIdle)

	if cm.container != nil {
		newDev := cm.container.NewDevice()
		if newDev != nil {
			cm.deviceStore = newDev
			waLogger := waLog.Stdout("WhatsmeowClient", "INFO", true)
			cm.client = whatsmeow.NewClient(cm.deviceStore, waLogger)
			cm.client.AddEventHandler(cm.handleEvent)
			logging.Infof("Created fresh unpaired device for new pairing session.")
			return nil
		}
	} else if cm.deviceStore != nil {
		cm.deviceStore.ID = nil
	}
	return nil
}

// Logout revokes device pairing, clears session credentials, and prepares a new QR pairing cycle.
func (cm *ClientManager) Logout(ctx context.Context) error {
	cm.mu.RLock()
	client := cm.client
	cm.mu.RUnlock()

	if client != nil {
		_ = client.Logout(ctx)
	}

	if err := cm.ResetToFreshDevice(); err != nil {
		logging.Errorf("Error resetting to fresh device after logout: %v", err)
	}

	// Automatically kick off fresh QR pairing channel so a new QR is immediately ready
	go func() {
		time.Sleep(1 * time.Second)
		if err := cm.Start(); err != nil {
			logging.Warnf("Auto-start QR channel after logout: %v", err)
		}
	}()

	return nil
}

// RawClient returns underlying whatsmeow client for media and specialized calls.
func (cm *ClientManager) RawClient() *whatsmeow.Client {
	cm.mu.RLock()
	defer cm.mu.RUnlock()
	return cm.client
}

// SendTextMessage dispatches a text message to a recipient JID.
func (cm *ClientManager) SendTextMessage(ctx context.Context, recipientJID types.JID, text string) (string, error) {
	if !cm.IsConnected() {
		return "", fmt.Errorf("cannot send: client is not connected to WhatsApp")
	}

	msg := &waE2E.Message{
		Conversation: proto.String(text),
	}

	resp, err := cm.client.SendMessage(ctx, recipientJID, msg)
	if err != nil {
		return "", fmt.Errorf("failed to send message: %w", err)
	}
	return resp.ID, nil
}
