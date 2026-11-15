package api

import (
	"encoding/json"
	"net/http"

	"civicsense/whatsapp-gateway/internal/events"
	"civicsense/whatsapp-gateway/internal/health"
	"civicsense/whatsapp-gateway/internal/messaging"
	"civicsense/whatsapp-gateway/internal/pairing"
	"civicsense/whatsapp-gateway/internal/queue"
	"civicsense/whatsapp-gateway/internal/whatsapp"
)

type APIHandler struct {
	cm         *whatsapp.ClientManager
	sender     *messaging.MessageSender
	queueStore *queue.QueueStore
}

func NewAPIHandler(cm *whatsapp.ClientManager, sender *messaging.MessageSender) *APIHandler {
	return &APIHandler{
		cm:     cm,
		sender: sender,
	}
}

// SetQueueStore binds the durable SQLite queue store.
func (h *APIHandler) SetQueueStore(qs *queue.QueueStore) {
	h.queueStore = qs
}

// Healthz responds to k8s/system health checks.
func (h *APIHandler) Healthz(w http.ResponseWriter, r *http.Request) {
	resp := health.GetHealth(h.cm)
	w.Header().Set("Content-Type", "application/json")
	if resp.Status == "ok" || resp.Status == "unpaired" {
		w.WriteHeader(http.StatusOK)
	} else {
		w.WriteHeader(http.StatusServiceUnavailable)
	}
	_ = json.NewEncoder(w).Encode(resp)
}

// Status returns operational WhatsApp connection telemetry.
func (h *APIHandler) Status(w http.ResponseWriter, r *http.Request) {
	resp := health.GetHealth(h.cm)
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	_ = json.NewEncoder(w).Encode(resp)
}

// GetQR returns the current pairing QR code for the admin UI.
func (h *APIHandler) GetQR(w http.ResponseWriter, r *http.Request) {
	qr := pairing.GetQRState()
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	_ = json.NewEncoder(w).Encode(qr)
}

// SendMessage handles outbound dispatch from FastAPI.
func (h *APIHandler) SendMessage(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, `{"error":"Method not allowed"}`, http.StatusMethodNotAllowed)
		return
	}

	var req events.OutboundSendRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusBadRequest)
		_ = json.NewEncoder(w).Encode(map[string]string{"error": "invalid json payload: " + err.Error()})
		return
	}

	resp, err := h.sender.SendMessage(r.Context(), &req)
	if err != nil {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusInternalServerError)
		_ = json.NewEncoder(w).Encode(map[string]string{"error": err.Error()})
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	_ = json.NewEncoder(w).Encode(resp)
}

// Disconnect breaks current websocket connection.
func (h *APIHandler) Disconnect(w http.ResponseWriter, r *http.Request) {
	h.cm.Disconnect()
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	_ = json.NewEncoder(w).Encode(map[string]string{"status": "disconnected"})
}

// Reconnect triggers reconnect loop.
func (h *APIHandler) Reconnect(w http.ResponseWriter, r *http.Request) {
	go func() {
		_ = h.cm.Start()
	}()
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	_ = json.NewEncoder(w).Encode(map[string]string{"status": "reconnecting"})
}

// Logout unlinks device from WhatsApp.
func (h *APIHandler) Logout(w http.ResponseWriter, r *http.Request) {
	err := h.cm.Logout(r.Context())
	w.Header().Set("Content-Type", "application/json")
	if err != nil {
		w.WriteHeader(http.StatusInternalServerError)
		_ = json.NewEncoder(w).Encode(map[string]string{"error": err.Error()})
		return
	}
	w.WriteHeader(http.StatusOK)
	_ = json.NewEncoder(w).Encode(map[string]string{"status": "logged_out"})
}

// QueueStatus returns statistics on event queue depth.
func (h *APIHandler) QueueStatus(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	if h.queueStore == nil {
		w.WriteHeader(http.StatusOK)
		_ = json.NewEncoder(w).Encode(map[string]interface{}{
			"status": "queue_not_configured",
		})
		return
	}
	stats, err := h.queueStore.GetStats()
	if err != nil {
		w.WriteHeader(http.StatusInternalServerError)
		_ = json.NewEncoder(w).Encode(map[string]string{"error": err.Error()})
		return
	}
	w.WriteHeader(http.StatusOK)
	_ = json.NewEncoder(w).Encode(stats)
}

// QueueFailed returns permanent failures for administrative inspection.
func (h *APIHandler) QueueFailed(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	if h.queueStore == nil {
		w.WriteHeader(http.StatusOK)
		_ = json.NewEncoder(w).Encode([]interface{}{})
		return
	}
	failures, err := h.queueStore.GetFailedEvents(50)
	if err != nil {
		w.WriteHeader(http.StatusInternalServerError)
		_ = json.NewEncoder(w).Encode(map[string]string{"error": err.Error()})
		return
	}
	w.WriteHeader(http.StatusOK)
	_ = json.NewEncoder(w).Encode(failures)
}
