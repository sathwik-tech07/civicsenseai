package events

import (
	"encoding/json"
	"time"
)

// EventType enumerates incoming gateway events forwarded to FastAPI.
type EventType string

const (
	EventTypeMessage       EventType = "message"
	EventTypeReceipt       EventType = "receipt"
	EventTypeConnected     EventType = "connected"
	EventTypeDisconnected  EventType = "disconnected"
	EventTypeLoggedOut     EventType = "logged_out"
)

// InboundEvent represents the authenticated event payload forwarded to FastAPI backend.
type InboundEvent struct {
	EventID   string          `json:"event_id"`
	Timestamp time.Time       `json:"timestamp"`
	EventType EventType       `json:"event_type"`
	Message   *InboundMessage `json:"message,omitempty"`
	Receipt   *InboundReceipt `json:"receipt,omitempty"`
	Device    *DeviceInfo     `json:"device,omitempty"`
}

type DeviceInfo struct {
	JID         string    `json:"jid"`
	Platform    string    `json:"platform"`
	ConnectedAt time.Time `json:"connected_at"`
}

type InboundMessage struct {
	ID         string           `json:"id"`
	From       string           `json:"from"`       // Standard international digits (e.g. 919876543210)
	SenderName string           `json:"sender_name"` // Push name
	Timestamp  int64            `json:"timestamp"`
	Type       string           `json:"type"`       // "text", "image", "location", "document", "video"
	Text       *TextMessage     `json:"text,omitempty"`
	Image      *MediaMessage    `json:"image,omitempty"`
	Document   *MediaMessage    `json:"document,omitempty"`
	Location   *LocationMessage `json:"location,omitempty"`
}

type TextMessage struct {
	Body string `json:"body"`
}

type MediaMessage struct {
	MimeType   string `json:"mimetype"`
	Caption    string `json:"caption,omitempty"`
	FileName   string `json:"filename,omitempty"`
	SizeBytes  int64  `json:"size_bytes"`
	DataBase64 string `json:"data_base64,omitempty"` // For inline forwarding
}

type LocationMessage struct {
	Latitude  float64 `json:"latitude"`
	Longitude float64 `json:"longitude"`
	Name      string  `json:"name,omitempty"`
	Address   string  `json:"address,omitempty"`
}

type InboundReceipt struct {
	MessageID string    `json:"message_id"`
	SourceJID string    `json:"source_jid"`
	Type      string    `json:"type"` // "delivered", "read", "played"
	Timestamp time.Time `json:"timestamp"`
}

// OutboundSendRequest represents dispatch payload from FastAPI to Go Gateway.
type OutboundSendRequest struct {
	Recipient     string        `json:"recipient"` // Phone or JID
	Type          string        `json:"type"`      // "text", "image", "location"
	MessageType   string        `json:"message_type,omitempty"`
	Text          *TextMessage  `json:"text,omitempty"`
	TextBody      string        `json:"text_body,omitempty"`
	Caption       string        `json:"caption,omitempty"`
	MediaBase64   string        `json:"media_base64,omitempty"`
	MediaMimeType string        `json:"media_mime_type,omitempty"`
	MediaURL      string        `json:"media_url,omitempty"`
	Image         *MediaMessage `json:"image,omitempty"`
}

// UnmarshalJSON custom unmarshaler supporting both nested structures and flat JSON fields.
func (r *OutboundSendRequest) UnmarshalJSON(data []byte) error {
	var raw struct {
		Recipient     string          `json:"recipient"`
		Type          string          `json:"type"`
		MessageType   string          `json:"message_type"`
		Text          json.RawMessage `json:"text"`
		TextBody      string          `json:"text_body"`
		Caption       string          `json:"caption"`
		MediaBase64   string          `json:"media_base64"`
		MediaMimeType string          `json:"media_mime_type"`
		MediaURL      string          `json:"media_url"`
		Image         *MediaMessage   `json:"image"`
	}
	if err := json.Unmarshal(data, &raw); err != nil {
		return err
	}

	r.Recipient = raw.Recipient
	r.Type = raw.Type
	if r.Type == "" {
		r.Type = raw.MessageType
	}
	if r.Type == "" {
		r.Type = "text"
	}

	r.MessageType = raw.MessageType
	r.Caption = raw.Caption
	r.MediaBase64 = raw.MediaBase64
	r.MediaMimeType = raw.MediaMimeType
	r.MediaURL = raw.MediaURL
	r.Image = raw.Image

	// 1. Unmarshal Text (either string or TextMessage object)
	if len(raw.Text) > 0 {
		var textStr string
		if err := json.Unmarshal(raw.Text, &textStr); err == nil {
			r.Text = &TextMessage{Body: textStr}
			r.TextBody = textStr
		} else {
			var textObj TextMessage
			if err := json.Unmarshal(raw.Text, &textObj); err == nil {
				r.Text = &textObj
				r.TextBody = textObj.Body
			}
		}
	} else if raw.TextBody != "" {
		r.Text = &TextMessage{Body: raw.TextBody}
		r.TextBody = raw.TextBody
	}

	// 2. Unmarshal Image if flat base64 is provided
	if r.Image == nil && r.MediaBase64 != "" {
		r.Image = &MediaMessage{
			DataBase64: r.MediaBase64,
			MimeType:   r.MediaMimeType,
			Caption:    r.Caption,
		}
	}

	return nil
}

// OutboundSendResponse is returned by Go Gateway after successful delivery.
type OutboundSendResponse struct {
	Status    string `json:"status"` // "sent"
	MessageID string `json:"message_id"`
	Timestamp int64  `json:"timestamp"`
}
