package events

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"

	"civicsense/whatsapp-gateway/internal/logging"
	"civicsense/whatsapp-gateway/internal/security"
)

// Dispatcher forwards inbound WhatsApp events to the FastAPI backend.
type Dispatcher struct {
	fastAPIURL string
	secret     string
	client     *http.Client
}

func NewDispatcher(fastAPIURL, secret string) *Dispatcher {
	return &Dispatcher{
		fastAPIURL: fastAPIURL,
		secret:     secret,
		client: &http.Client{
			Timeout: 30 * time.Second,
		},
	}
}

// DispatchEvent sends the event payload to FastAPI with HMAC authentication.
func (d *Dispatcher) DispatchEvent(ctx context.Context, evt *InboundEvent) error {
	body, err := json.Marshal(evt)
	if err != nil {
		return fmt.Errorf("failed to marshal event: %w", err)
	}

	endpoint := fmt.Sprintf("%s/internal/whatsapp/events", d.fastAPIURL)
	ts := time.Now().Unix()
	sig := security.GenerateSignature(d.secret, ts, body)

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, endpoint, bytes.NewReader(body))
	if err != nil {
		return fmt.Errorf("failed to create request: %w", err)
	}

	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-Gateway-Timestamp", fmt.Sprintf("%d", ts))
	req.Header.Set("X-Gateway-Signature", fmt.Sprintf("sha256=%s", sig))
	req.Header.Set("Authorization", fmt.Sprintf("Bearer %s", d.secret))

	logging.Infof("Dispatching inbound event %s (type=%s) to FastAPI: %s", evt.EventID, evt.EventType, endpoint)

	// Post with retry
	var resp *http.Response
	for attempt := 0; attempt < 3; attempt++ {
		resp, err = d.client.Do(req)
		if err == nil && resp.StatusCode >= 200 && resp.StatusCode < 300 {
			defer resp.Body.Close()
			logging.Infof("Event %s acknowledged by FastAPI (HTTP %d)", evt.EventID, resp.StatusCode)
			return nil
		}
		if err == nil && resp != nil && resp.StatusCode >= 400 && resp.StatusCode < 500 {
			// Non-retriable client error
			defer resp.Body.Close()
			respBytes, _ := io.ReadAll(resp.Body)
			return fmt.Errorf("FastAPI rejected event %s with HTTP %d: %s", evt.EventID, resp.StatusCode, string(respBytes))
		}

		if resp != nil {
			resp.Body.Close()
		}

		backoff := time.Duration(1<<attempt) * 500 * time.Millisecond
		logging.Warnf("Transient failure delivering event %s (attempt %d/3). Retrying in %v...", evt.EventID, attempt+1, backoff)
		time.Sleep(backoff)
	}

	if err != nil {
		return fmt.Errorf("failed to deliver event %s to FastAPI after retries: %w", evt.EventID, err)
	}
	return fmt.Errorf("fastAPI returned server error for event %s", evt.EventID)
}
