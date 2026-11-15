package pairing

import (
	"strings"
	"testing"
	"time"
)

func TestSetAndGetQRCode(t *testing.T) {
	code := "2@1234567890,ABCDEFGHIJKLMNOPQRSTUVWXYZ=="
	err := SetQRCode(code, 60*time.Second)
	if err != nil {
		t.Fatalf("failed to set QR code: %v", err)
	}

	state := GetQRState()
	if state.Status != StatusQRReady {
		t.Fatalf("expected status %s, got %s", StatusQRReady, state.Status)
	}
	if state.QRCode != code {
		t.Fatalf("expected code %s, got %s", code, state.QRCode)
	}
	if !strings.HasPrefix(state.QRCodePNG, "iVBORw0KGgo") { // PNG magic base64 prefix
		t.Fatalf("expected valid base64 PNG, got %q", state.QRCodePNG[:20])
	}

	// Status transition to paired
	SetPaired()
	statePaired := GetQRState()
	if statePaired.Status != StatusPaired {
		t.Fatalf("expected status %s, got %s", StatusPaired, statePaired.Status)
	}
	if statePaired.QRCode != "" || statePaired.QRCodePNG != "" {
		t.Fatalf("expected QR code to be cleared upon pairing")
	}
}
