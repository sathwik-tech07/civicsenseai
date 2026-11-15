package health

import (
	"testing"
)

func TestGetHealthNilClient(t *testing.T) {
	resp := GetHealth(nil)
	if resp.Status != "unpaired" {
		t.Errorf("expected unpaired when cm is nil, got %s", resp.Status)
	}
	if resp.Connected {
		t.Errorf("expected disconnected when cm is nil")
	}
	if resp.Service != "whatsapp-gateway" {
		t.Errorf("expected service 'whatsapp-gateway', got %s", resp.Service)
	}
}
