package events

import (
	"encoding/json"
	"testing"
	"time"
)

func TestInboundEventSerialization(t *testing.T) {
	evt := &InboundEvent{
		EventID:   "evt_101",
		Timestamp: time.Now().UTC(),
		EventType: EventTypeMessage,
		Message: &InboundMessage{
			ID:         "msg_202",
			From:       "919876543210",
			SenderName: "Citizen",
			Timestamp:  time.Now().Unix(),
			Type:       "text",
			Text:       &TextMessage{Body: "Pothole on 100ft road"},
		},
	}

	data, err := json.Marshal(evt)
	if err != nil {
		t.Fatalf("failed to marshal InboundEvent: %v", err)
	}

	var parsed InboundEvent
	if err := json.Unmarshal(data, &parsed); err != nil {
		t.Fatalf("failed to unmarshal InboundEvent: %v", err)
	}

	if parsed.EventID != "evt_101" {
		t.Errorf("expected EventID evt_101, got %s", parsed.EventID)
	}
	if parsed.Message == nil || parsed.Message.Text.Body != "Pothole on 100ft road" {
		t.Errorf("expected text body 'Pothole on 100ft road', got %v", parsed.Message)
	}
}

func TestOutboundSendRequestSerialization(t *testing.T) {
	req := &OutboundSendRequest{
		Recipient: "919876543210",
		Type:      "text",
		Text:      &TextMessage{Body: "CivicSense AI: Complaint INC-2026-0001 acknowledged."},
	}

	data, err := json.Marshal(req)
	if err != nil {
		t.Fatalf("failed to marshal OutboundSendRequest: %v", err)
	}

	var parsed OutboundSendRequest
	if err := json.Unmarshal(data, &parsed); err != nil {
		t.Fatalf("failed to unmarshal OutboundSendRequest: %v", err)
	}

	if parsed.Recipient != "919876543210" {
		t.Errorf("expected recipient 919876543210, got %s", parsed.Recipient)
	}
	if parsed.Text == nil || parsed.Text.Body != "CivicSense AI: Complaint INC-2026-0001 acknowledged." {
		t.Errorf("expected text body, got %v", parsed.Text)
	}
}

func TestOutboundSendRequestFlatJSON(t *testing.T) {
	rawJSON := []byte(`{
		"recipient": "919876543210",
		"message_type": "text",
		"text": "Flat text message from FastAPI",
		"caption": "test caption",
		"media_base64": "aGVsbG8="
	}`)

	var parsed OutboundSendRequest
	if err := json.Unmarshal(rawJSON, &parsed); err != nil {
		t.Fatalf("failed to unmarshal flat JSON: %v", err)
	}

	if parsed.Recipient != "919876543210" {
		t.Errorf("expected recipient 919876543210, got %s", parsed.Recipient)
	}
	if parsed.Type != "text" {
		t.Errorf("expected type 'text', got %s", parsed.Type)
	}
	if parsed.Text == nil || parsed.Text.Body != "Flat text message from FastAPI" {
		t.Errorf("expected parsed text body 'Flat text message from FastAPI', got %v", parsed.Text)
	}
	if parsed.Image == nil || parsed.Image.DataBase64 != "aGVsbG8=" {
		t.Errorf("expected image with data_base64, got %v", parsed.Image)
	}
}
