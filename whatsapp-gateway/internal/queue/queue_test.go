package queue

import (
	"os"
	"path/filepath"
	"testing"
	"time"

	"civicsense/whatsapp-gateway/internal/events"
)

func createTempDB(t *testing.T) string {
	dir := t.TempDir()
	return filepath.Join(dir, "test_queue.db")
}

func TestQueueInitialization(t *testing.T) {
	dbPath := createTempDB(t)
	qs, err := NewQueueStoreFromPath(dbPath, 1*time.Hour)
	if err != nil {
		t.Fatalf("Failed to initialize QueueStore: %v", err)
	}
	defer qs.Close()

	if _, err := os.Stat(dbPath); os.IsNotExist(err) {
		t.Errorf("Database file was not created at %s", dbPath)
	}
}

func TestDeduplicationPersistenceAcrossRestart(t *testing.T) {
	dbPath := createTempDB(t)

	// Session 1: Process a message and close
	msgID := "MSG_PERSIST_TEST_001"
	sender := "919876543210"

	qs1, err := NewQueueStoreFromPath(dbPath, 1*time.Hour)
	if err != nil {
		t.Fatalf("Session 1: failed to open queue store: %v", err)
	}

	if qs1.IsDuplicate(msgID) {
		t.Errorf("Expected message %s to not be duplicate initially", msgID)
	}

	if err := qs1.MarkProcessed(msgID, sender); err != nil {
		t.Fatalf("Failed to mark message processed: %v", err)
	}

	if !qs1.IsDuplicate(msgID) {
		t.Errorf("Expected message %s to be duplicate immediately after marking", msgID)
	}

	// Simulate gateway process restart / container restart by closing DB
	if err := qs1.Close(); err != nil {
		t.Fatalf("Failed to close session 1 DB: %v", err)
	}

	// Session 2: Fresh instance pointing to the same SQLite file
	qs2, err := NewQueueStoreFromPath(dbPath, 1*time.Hour)
	if err != nil {
		t.Fatalf("Session 2: failed to reopen queue store: %v", err)
	}
	defer qs2.Close()

	// Verify deduplication survived the process restart!
	if !qs2.IsDuplicate(msgID) {
		t.Errorf("Deduplication FAILURE: Message %s was NOT recognized as duplicate after restart!", msgID)
	}

	// Verify unknown message is not duplicate
	if qs2.IsDuplicate("UNKNOWN_MSG_999") {
		t.Errorf("Unexpected duplicate for unknown message ID")
	}
}

func TestDurableEventQueueLifecycle(t *testing.T) {
	dbPath := createTempDB(t)
	qs, err := NewQueueStoreFromPath(dbPath, 1*time.Hour)
	if err != nil {
		t.Fatalf("Failed to create queue store: %v", err)
	}
	defer qs.Close()

	evt := &events.InboundEvent{
		EventID:   "evt_test_1001",
		Timestamp: time.Now().UTC(),
		EventType: events.EventTypeMessage,
		Message: &events.InboundMessage{
			ID:   "msg_inner_1001",
			From: "919876543210",
			Type: "text",
			Text: &events.TextMessage{Body: "Pothole on 100ft road"},
		},
	}

	// 1. Enqueue event
	if err := qs.EnqueueEvent(evt); err != nil {
		t.Fatalf("Failed to enqueue event: %v", err)
	}

	// 2. Retrieve pending events
	pending, err := qs.GetPendingEvents(10)
	if err != nil {
		t.Fatalf("Failed to get pending events: %v", err)
	}
	if len(pending) != 1 {
		t.Fatalf("Expected 1 pending event, got %d", len(pending))
	}
	if pending[0].EventID != "evt_test_1001" {
		t.Errorf("Expected event ID 'evt_test_1001', got %s", pending[0].EventID)
	}

	// 3. Mark acknowledged
	if err := qs.MarkAcknowledged("evt_test_1001"); err != nil {
		t.Fatalf("Failed to mark acknowledged: %v", err)
	}

	// 4. Verify no longer pending
	pendingAfterAck, err := qs.GetPendingEvents(10)
	if err != nil {
		t.Fatalf("Failed to get pending events after ack: %v", err)
	}
	if len(pendingAfterAck) != 0 {
		t.Errorf("Expected 0 pending events after ack, got %d", len(pendingAfterAck))
	}
}

func TestBoundedExponentialBackoff(t *testing.T) {
	testCases := []struct {
		attempt  int
		expected time.Duration
	}{
		{attempt: 0, expected: 500 * time.Millisecond},
		{attempt: 1, expected: 500 * time.Millisecond},
		{attempt: 2, expected: 1000 * time.Millisecond},
		{attempt: 3, expected: 2000 * time.Millisecond},
		{attempt: 4, expected: 4000 * time.Millisecond},
		{attempt: 5, expected: 8000 * time.Millisecond},
		{attempt: 6, expected: 10000 * time.Millisecond}, // Capped at 10s
		{attempt: 10, expected: 10000 * time.Millisecond}, // Capped at 10s
	}

	for _, tc := range testCases {
		actual := CalculateBackoff(tc.attempt)
		if actual != tc.expected {
			t.Errorf("Attempt %d: expected backoff %v, got %v", tc.attempt, tc.expected, actual)
		}
	}
}

func TestRecordRetryAndMaxAttempts(t *testing.T) {
	dbPath := createTempDB(t)
	qs, err := NewQueueStoreFromPath(dbPath, 1*time.Hour)
	if err != nil {
		t.Fatalf("Failed to create queue store: %v", err)
	}
	defer qs.Close()

	evt := &events.InboundEvent{
		EventID:   "evt_retry_fail_test",
		Timestamp: time.Now().UTC(),
		EventType: events.EventTypeMessage,
	}
	_ = qs.EnqueueEvent(evt)

	// Attempts 1 to 4 should keep status 'pending'
	for a := 1; a <= 4; a++ {
		err := qs.RecordRetry(evt.EventID, a, "Simulated transient 500 error")
		if err != nil {
			t.Fatalf("Attempt %d record retry error: %v", a, err)
		}
	}

	// Attempt 5 should mark status as 'failed' (bounded retry limit reached)
	err = qs.RecordRetry(evt.EventID, 5, "FastAPI connection refused")
	if err != nil {
		t.Fatalf("Attempt 5 record retry error: %v", err)
	}

	var status string
	err = qs.db.QueryRow("SELECT status FROM inbound_events_queue WHERE event_id = ?", evt.EventID).Scan(&status)
	if err != nil {
		t.Fatalf("Query status error: %v", err)
	}
	if status != "failed" {
		t.Errorf("Expected event to be marked 'failed' after 5 attempts, got '%s'", status)
	}
}
