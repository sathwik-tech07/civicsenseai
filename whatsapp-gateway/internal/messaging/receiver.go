package messaging

import (
	"context"
	"encoding/base64"
	"fmt"
	"sync"
	"time"

	"go.mau.fi/whatsmeow/types"
	"go.mau.fi/whatsmeow/types/events"

	appEvents "civicsense/whatsapp-gateway/internal/events"
	"civicsense/whatsapp-gateway/internal/logging"
	"civicsense/whatsapp-gateway/internal/queue"
	"civicsense/whatsapp-gateway/internal/whatsapp"
)

// Deduplicator tracks processed message IDs to prevent duplicate webhook dispatches.
type Deduplicator struct {
	mu      sync.Mutex
	cache   map[string]time.Time
	maxSize int
	ttl     time.Duration
}

func NewDeduplicator(maxSize int, ttl time.Duration) *Deduplicator {
	return &Deduplicator{
		cache:   make(map[string]time.Time),
		maxSize: maxSize,
		ttl:     ttl,
	}
}

func (d *Deduplicator) IsDuplicate(id string) bool {
	if id == "" {
		return false
	}
	d.mu.Lock()
	defer d.mu.Unlock()

	now := time.Now()
	// Clean expired
	if len(d.cache) > d.maxSize {
		for k, t := range d.cache {
			if now.Sub(t) > d.ttl {
				delete(d.cache, k)
			}
		}
	}

	if ts, exists := d.cache[id]; exists {
		if now.Sub(ts) < d.ttl {
			return true
		}
	}
	d.cache[id] = now
	return false
}

// MessageReceiver processes raw whatsmeow events and forwards them to FastAPI.
type MessageReceiver struct {
	cm         *whatsapp.ClientManager
	dispatcher *appEvents.Dispatcher
	dedup      *Deduplicator
	queueStore *queue.QueueStore
}

func NewMessageReceiver(cm *whatsapp.ClientManager, dispatcher *appEvents.Dispatcher) *MessageReceiver {
	return &MessageReceiver{
		cm:         cm,
		dispatcher: dispatcher,
		dedup:      NewDeduplicator(10000, 24*time.Hour),
	}
}

// SetQueueStore attaches a durable SQLite queue store for event persistence and restart-safe deduplication.
func (mr *MessageReceiver) SetQueueStore(qs *queue.QueueStore) {
	mr.queueStore = qs
}

func (mr *MessageReceiver) isDuplicate(msgID string) bool {
	if mr.queueStore != nil {
		return mr.queueStore.IsDuplicate(msgID)
	}
	return mr.dedup.IsDuplicate(msgID)
}

// HandleIncomingMessage parses whatsmeow Message event into InboundEvent.
func (mr *MessageReceiver) HandleIncomingMessage(evt *events.Message) {
	// Ignore messages sent by ourselves
	if evt.Info.IsFromMe {
		return
	}

	msgID := evt.Info.ID
	if mr.isDuplicate(msgID) {
		logging.Infof("Ignoring duplicate incoming message ID: %s", msgID)
		return
	}

	// Robust sender phone extraction:
	// Prioritize phone number from SenderAlt (used when Sender is LID), then Sender, then Chat
	var senderPhone string
	if !evt.Info.SenderAlt.IsEmpty() && evt.Info.SenderAlt.Server == types.DefaultUserServer && evt.Info.SenderAlt.User != "" {
		senderPhone = evt.Info.SenderAlt.User
	} else if evt.Info.Sender.Server == types.DefaultUserServer && evt.Info.Sender.User != "" {
		senderPhone = evt.Info.Sender.User
	} else if evt.Info.Chat.Server == types.DefaultUserServer && evt.Info.Chat.User != "" {
		senderPhone = evt.Info.Chat.User
	} else if evt.Info.Sender.User != "" {
		senderPhone = evt.Info.Sender.User
	} else if evt.Info.Chat.User != "" {
		senderPhone = evt.Info.Chat.User
	}
	senderName := evt.Info.PushName
	ts := evt.Info.Timestamp.Unix()

	inboundMsg := &appEvents.InboundMessage{
		ID:         msgID,
		From:       senderPhone,
		SenderName: senderName,
		Timestamp:  ts,
		Type:       "text",
	}

	msgContent := evt.Message
	if msgContent == nil {
		return
	}

	// Unwrap nested message wrappers (ephemeral, view-once, edited, document caption)
	for {
		if eph := msgContent.GetEphemeralMessage(); eph != nil && eph.GetMessage() != nil {
			msgContent = eph.GetMessage()
		} else if vo := msgContent.GetViewOnceMessage(); vo != nil && vo.GetMessage() != nil {
			msgContent = vo.GetMessage()
		} else if vo2 := msgContent.GetViewOnceMessageV2(); vo2 != nil && vo2.GetMessage() != nil {
			msgContent = vo2.GetMessage()
		} else if doc := msgContent.GetDocumentWithCaptionMessage(); doc != nil && doc.GetMessage() != nil {
			msgContent = doc.GetMessage()
		} else if edited := msgContent.GetEditedMessage(); edited != nil && edited.GetMessage() != nil {
			msgContent = edited.GetMessage()
		} else {
			break
		}
	}

	// 1. Text message (direct conversation, extended text, or button/interactive response)
	if text := msgContent.GetConversation(); text != "" {
		inboundMsg.Type = "text"
		inboundMsg.Text = &appEvents.TextMessage{Body: text}
	} else if extText := msgContent.GetExtendedTextMessage(); extText != nil && extText.GetText() != "" {
		inboundMsg.Type = "text"
		inboundMsg.Text = &appEvents.TextMessage{Body: extText.GetText()}
	} else if btnResp := msgContent.GetButtonsResponseMessage(); btnResp != nil && btnResp.GetSelectedButtonID() != "" {
		inboundMsg.Type = "text"
		inboundMsg.Text = &appEvents.TextMessage{Body: btnResp.GetSelectedButtonID()}
	} else if listResp := msgContent.GetListResponseMessage(); listResp != nil && listResp.GetSingleSelectReply() != nil && listResp.GetSingleSelectReply().GetSelectedRowID() != "" {
		inboundMsg.Type = "text"
		inboundMsg.Text = &appEvents.TextMessage{Body: listResp.GetSingleSelectReply().GetSelectedRowID()}
	} else if templResp := msgContent.GetTemplateButtonReplyMessage(); templResp != nil && templResp.GetSelectedID() != "" {
		inboundMsg.Type = "text"
		inboundMsg.Text = &appEvents.TextMessage{Body: templResp.GetSelectedID()}
	}

	// 2. Image message
	if imgMsg := msgContent.GetImageMessage(); imgMsg != nil {
		inboundMsg.Type = "image"
		mediaMsg := &appEvents.MediaMessage{
			MimeType:  imgMsg.GetMimetype(),
			Caption:   imgMsg.GetCaption(),
			SizeBytes: int64(imgMsg.GetFileLength()),
		}

		// Download binary media via whatsmeow
		client := mr.cm.RawClient()
		if client != nil {
			dlCtx, dlCancel := context.WithTimeout(context.Background(), 30*time.Second)
			imgBytes, err := client.Download(dlCtx, imgMsg)
			dlCancel()
			if err != nil {
				logging.Errorf("Failed to download image media for msg %s: %v", msgID, err)
			} else {
				mediaMsg.DataBase64 = base64.StdEncoding.EncodeToString(imgBytes)
				mediaMsg.SizeBytes = int64(len(imgBytes))
			}
		}
		inboundMsg.Image = mediaMsg
	}

	// 3. Location message
	if locMsg := msgContent.GetLocationMessage(); locMsg != nil {
		inboundMsg.Type = "location"
		inboundMsg.Location = &appEvents.LocationMessage{
			Latitude:  locMsg.GetDegreesLatitude(),
			Longitude: locMsg.GetDegreesLongitude(),
			Name:      locMsg.GetName(),
			Address:   locMsg.GetAddress(),
		}
	}

	event := &appEvents.InboundEvent{
		EventID:   fmt.Sprintf("evt_%s", msgID),
		Timestamp: time.Now().UTC(),
		EventType: appEvents.EventTypeMessage,
		Message:   inboundMsg,
		Device: &appEvents.DeviceInfo{
			JID:         mr.cm.GetJID(),
			Platform:    "whatsmeow",
			ConnectedAt: time.Now().UTC(),
		},
	}

	hasText := inboundMsg.Text != nil && inboundMsg.Text.Body != ""
	textPreview := ""
	if hasText {
		textPreview = inboundMsg.Text.Body
		if len(textPreview) > 30 {
			textPreview = textPreview[:30] + "..."
		}
	}
	logging.Infof("Received WhatsApp message from %s (%s): type=%s, id=%s, has_text=%v, preview='%s'", senderPhone, senderName, inboundMsg.Type, msgID, hasText, textPreview)

	// Durably persist event in SQLite before dispatch
	if mr.queueStore != nil {
		if err := mr.queueStore.EnqueueEvent(event); err != nil {
			logging.Errorf("Failed to durably enqueue event %s in sqlite: %v", event.EventID, err)
		}
	}

	// Forward to FastAPI with durable acknowledgement
	go func() {
		ctx, cancel := context.WithTimeout(context.Background(), 45*time.Second)
		defer cancel()
		if err := mr.dispatcher.DispatchEvent(ctx, event); err != nil {
			logging.Errorf("Failed to dispatch event %s to FastAPI: %v", event.EventID, err)
			if mr.queueStore != nil {
				_ = mr.queueStore.RecordRetry(event.EventID, 1, err.Error())
			}
		} else {
			// Acknowledged as durably accepted by FastAPI!
			if mr.queueStore != nil {
				_ = mr.queueStore.MarkAcknowledged(event.EventID)
				_ = mr.queueStore.MarkProcessed(msgID, senderPhone)
			}
			if mr.dedup != nil {
				mr.dedup.IsDuplicate(msgID)
			}
		}
	}()
}

// HandleReceipt processes message delivery and read receipts.
func (mr *MessageReceiver) HandleReceipt(evt *events.Receipt) {
	receiptType := "delivered"
	switch evt.Type {
	case events.ReceiptTypeRead, events.ReceiptTypeReadSelf:
		receiptType = "read"
	case events.ReceiptTypePlayed:
		receiptType = "played"
	}

	for _, msgID := range evt.MessageIDs {
		event := &appEvents.InboundEvent{
			EventID:   fmt.Sprintf("rcpt_%s_%s", msgID, receiptType),
			Timestamp: time.Now().UTC(),
			EventType: appEvents.EventTypeReceipt,
			Receipt: &appEvents.InboundReceipt{
				MessageID: msgID,
				SourceJID: evt.Chat.String(),
				Type:      receiptType,
				Timestamp: evt.Timestamp,
			},
		}

		go func(e *appEvents.InboundEvent) {
			ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
			defer cancel()
			_ = mr.dispatcher.DispatchEvent(ctx, e)
		}(event)
	}
}
