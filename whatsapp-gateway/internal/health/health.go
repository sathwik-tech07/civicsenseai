package health

import (
	"math"
	"runtime"
	"time"

	"civicsense/whatsapp-gateway/internal/pairing"
	"civicsense/whatsapp-gateway/internal/whatsapp"
)

var startTime = time.Now()

type HealthResponse struct {
	Status        string             `json:"status"` // "ok" or "degraded"
	Service       string             `json:"service"`
	Version       string             `json:"version"`
	UptimeSeconds float64            `json:"uptime_seconds"`
	Connected     bool               `json:"connected"`
	LoggedIn      bool               `json:"logged_in"`
	DeviceJID     string             `json:"device_jid,omitempty"`
	PairStatus    pairing.PairStatus `json:"pair_status"`
	MemoryMB      float64            `json:"memory_mb"`
	Goroutines    int                `json:"goroutines"`
}

func GetHealth(cm *whatsapp.ClientManager) HealthResponse {
	var m runtime.MemStats
	runtime.ReadMemStats(&m)

	connected := false
	loggedIn := false
	deviceJID := ""
	if cm != nil {
		connected = cm.IsConnected()
		loggedIn = cm.IsLoggedIn()
		deviceJID = cm.GetJID()
	}
	pairState := pairing.GetQRState()

	status := "ok"
	if cm == nil {
		status = "unpaired"
	} else if !connected && loggedIn {
		status = "reconnecting"
	} else if !loggedIn {
		status = "unpaired"
	}

	return HealthResponse{
		Status:        status,
		Service:       "whatsapp-gateway",
		Version:       "1.0.0",
		UptimeSeconds: math.Round(time.Since(startTime).Seconds()),
		Connected:     connected,
		LoggedIn:      loggedIn,
		DeviceJID:     deviceJID,
		PairStatus:    pairState.Status,
		MemoryMB:      math.Round(float64(m.Alloc)/1024/1024*10) / 10,
		Goroutines:    runtime.NumGoroutine(),
	}
}
