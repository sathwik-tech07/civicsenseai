package api

import (
	"net/http"

	"civicsense/whatsapp-gateway/internal/config"
	"civicsense/whatsapp-gateway/internal/security"
)

// NewRouter registers HTTP handlers and applies defense-in-depth security middleware.
func NewRouter(cfg *config.Config, handler *APIHandler) http.Handler {
	mux := http.NewServeMux()

	// 1. Public probes (unauthenticated)
	mux.HandleFunc("GET /healthz", handler.Healthz)
	mux.HandleFunc("GET /livez", handler.Healthz)

	// 2. Authenticated administrative & internal dispatch routes
	mux.HandleFunc("GET /api/v1/status", handler.Status)
	mux.HandleFunc("GET /api/v1/qr", handler.GetQR)
	mux.HandleFunc("POST /api/v1/send", handler.SendMessage)
	mux.HandleFunc("POST /api/v1/disconnect", handler.Disconnect)
	mux.HandleFunc("POST /api/v1/reconnect", handler.Reconnect)
	mux.HandleFunc("POST /api/v1/logout", handler.Logout)
	mux.HandleFunc("GET /api/v1/queue/status", handler.QueueStatus)
	mux.HandleFunc("GET /api/v1/queue/failed", handler.QueueFailed)

	// Wrap entire mux with AuthMiddleware (which selectively allows /healthz)
	authMiddleware := security.AuthMiddleware(cfg.GatewaySecret)
	return authMiddleware(mux)
}
