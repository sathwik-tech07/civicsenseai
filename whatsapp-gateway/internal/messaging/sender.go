package messaging

import (
	"context"
	"encoding/base64"
	"fmt"
	"net/http"
	"regexp"
	"strings"

	"go.mau.fi/whatsmeow"
	waProto "go.mau.fi/whatsmeow/binary/proto"
	"go.mau.fi/whatsmeow/types"
	"google.golang.org/protobuf/proto"

	"civicsense/whatsapp-gateway/internal/events"
	"civicsense/whatsapp-gateway/internal/logging"
	"civicsense/whatsapp-gateway/internal/whatsapp"
)

var digitsOnlyRegex = regexp.MustCompile(`[^\d]`)

// MessageSender provides high-level message sending functions over whatsmeow.
type MessageSender struct {
	cm *whatsapp.ClientManager
}

func NewMessageSender(cm *whatsapp.ClientManager) *MessageSender {
	return &MessageSender{cm: cm}
}

// CleanRecipient normalizes any phone or JID string into a valid whatsmeow user JID.
func CleanRecipient(recipient string) (types.JID, error) {
	if recipient == "" {
		return types.EmptyJID, fmt.Errorf("recipient cannot be empty")
	}

	// If already a full JID
	if strings.Contains(recipient, "@") {
		parsed, err := types.ParseJID(recipient)
		if err == nil {
			return parsed, nil
		}
	}

	// Extract digits
	digits := digitsOnlyRegex.ReplaceAllString(recipient, "")
	if len(digits) < 7 || len(digits) > 15 {
		return types.EmptyJID, fmt.Errorf("invalid recipient phone '%s': expected 7-15 digits", recipient)
	}

	return types.NewJID(digits, types.DefaultUserServer), nil
}

// SendMessage dispatches an OutboundSendRequest (text, image, location).
func (ms *MessageSender) SendMessage(ctx context.Context, req *events.OutboundSendRequest) (*events.OutboundSendResponse, error) {
	jid, err := CleanRecipient(req.Recipient)
	if err != nil {
		return nil, fmt.Errorf("invalid recipient: %w", err)
	}

	client := ms.cm.RawClient()
	if client == nil || !ms.cm.IsConnected() {
		return nil, fmt.Errorf("whatsapp client is disconnected")
	}

	switch strings.ToLower(req.Type) {
	case "text":
		if req.Text == nil || strings.TrimSpace(req.Text.Body) == "" {
			return nil, fmt.Errorf("text message body cannot be empty")
		}
		msg := &waProto.Message{
			Conversation: proto.String(strings.TrimSpace(req.Text.Body)),
		}
		resp, err := client.SendMessage(ctx, jid, msg)
		if err != nil {
			return nil, fmt.Errorf("failed to send text message: %w", err)
		}
		logging.Infof("Outbound text message sent to %s (msg_id=%s)", jid.String(), resp.ID)
		return &events.OutboundSendResponse{
			Status:    "sent",
			MessageID: resp.ID,
			Timestamp: resp.Timestamp.Unix(),
		}, nil

	case "image":
		if req.Image == nil || req.Image.DataBase64 == "" {
			return nil, fmt.Errorf("image payload requires data_base64")
		}

		imgBytes, err := base64.StdEncoding.DecodeString(req.Image.DataBase64)
		if err != nil {
			return nil, fmt.Errorf("failed to decode image data_base64: %w", err)
		}

		// Detect mimetype if not specified
		mime := req.Image.MimeType
		if mime == "" {
			mime = http.DetectContentType(imgBytes)
		}

		uploadResp, err := client.Upload(ctx, imgBytes, whatsmeow.MediaImage)
		if err != nil {
			return nil, fmt.Errorf("failed to upload image to WhatsApp media CDN: %w", err)
		}

		imgMsg := &waProto.ImageMessage{
			Caption:       proto.String(req.Image.Caption),
			Mimetype:      proto.String(mime),
			URL:           &uploadResp.URL,
			DirectPath:    &uploadResp.DirectPath,
			MediaKey:      uploadResp.MediaKey,
			FileEncSHA256: uploadResp.FileEncSHA256,
			FileSHA256:    uploadResp.FileSHA256,
			FileLength:    proto.Uint64(uint64(len(imgBytes))),
		}

		msg := &waProto.Message{
			ImageMessage: imgMsg,
		}

		resp, err := client.SendMessage(ctx, jid, msg)
		if err != nil {
			return nil, fmt.Errorf("failed to dispatch image message: %w", err)
		}
		logging.Infof("Outbound image message sent to %s (msg_id=%s)", jid.String(), resp.ID)
		return &events.OutboundSendResponse{
			Status:    "sent",
			MessageID: resp.ID,
			Timestamp: resp.Timestamp.Unix(),
		}, nil

	default:
		return nil, fmt.Errorf("unsupported message type: %s", req.Type)
	}
}
