package messaging

import (
	"testing"
	"time"
)

func TestDeduplicator(t *testing.T) {
	d := NewDeduplicator(10, 100*time.Millisecond)

	id := "MSG_ABC_123"

	// First occurrence
	if d.IsDuplicate(id) {
		t.Fatalf("expected first occurrence to return false (not duplicate)")
	}

	// Immediate second occurrence
	if !d.IsDuplicate(id) {
		t.Fatalf("expected immediate second occurrence to return true (duplicate)")
	}

	// After TTL expiration
	time.Sleep(120 * time.Millisecond)
	if d.IsDuplicate(id) {
		t.Fatalf("expected post-TTL occurrence to return false (expired)")
	}
}
