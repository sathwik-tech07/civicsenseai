package pairing

import (
	"encoding/base64"
	"sync"
	"time"

	qrcode "github.com/skip2/go-qrcode"
)

type PairStatus string

const (
	StatusIdle       PairStatus = "idle"
	StatusConnecting PairStatus = "connecting"
	StatusQRReady    PairStatus = "qr_ready"
	StatusPaired     PairStatus = "paired"
	StatusTimedOut   PairStatus = "timeout"
	StatusFailed     PairStatus = "failed"
)

// QRState tracks the latest pairing QR code and state.
type QRState struct {
	Status      PairStatus `json:"status"`
	QRCode      string     `json:"qr_code,omitempty"`
	QRCodePNG   string     `json:"qr_png_base64,omitempty"` // Base64 encoded PNG
	GeneratedAt time.Time  `json:"generated_at"`
	ExpiresAt   time.Time  `json:"expires_at"`
}

var (
	qrMu          sync.RWMutex
	globalQRState = QRState{
		Status: StatusIdle,
	}
)

// GetQRState returns a copy of current pairing state.
func GetQRState() QRState {
	qrMu.RLock()
	defer qrMu.RUnlock()
	return globalQRState
}

// SetQRCode updates the active QR code string and renders base64 PNG.
func SetQRCode(code string, duration time.Duration) error {
	qrMu.Lock()
	defer qrMu.Unlock()

	globalQRState.QRCode = code
	globalQRState.Status = StatusQRReady
	globalQRState.GeneratedAt = time.Now().UTC()
	globalQRState.ExpiresAt = globalQRState.GeneratedAt.Add(duration)

	// Render PNG bytes (256x256)
	pngBytes, err := qrcode.Encode(code, qrcode.Medium, 256)
	if err != nil {
		return err
	}
	globalQRState.QRCodePNG = base64.StdEncoding.EncodeToString(pngBytes)
	return nil
}

// SetPaired marks device as paired.
func SetPaired() {
	qrMu.Lock()
	defer qrMu.Unlock()
	globalQRState.Status = StatusPaired
	globalQRState.QRCode = ""
	globalQRState.QRCodePNG = ""
}

// SetStatus updates status (e.g. idle, timeout).
func SetStatus(status PairStatus) {
	qrMu.Lock()
	defer qrMu.Unlock()
	globalQRState.Status = status
	if status != StatusQRReady {
		globalQRState.QRCode = ""
		globalQRState.QRCodePNG = ""
	}
}
