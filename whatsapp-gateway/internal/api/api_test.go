package api

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"civicsense/whatsapp-gateway/internal/config"
	"civicsense/whatsapp-gateway/internal/health"
)

func TestHealthzHandler(t *testing.T) {
	handler := NewAPIHandler(nil, nil)
	cfg := &config.Config{
		GatewaySecret: "test-secret",
	}
	router := NewRouter(cfg, handler)

	req := httptest.NewRequest("GET", "/healthz", nil)
	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200 OK on /healthz, got %d", rec.Code)
	}

	var resp health.HealthResponse
	if err := json.NewDecoder(rec.Body).Decode(&resp); err != nil {
		t.Fatalf("failed to decode health response: %v", err)
	}

	if resp.Status != "unpaired" {
		t.Errorf("expected status 'unpaired', got %s", resp.Status)
	}
}

func TestGetQRHandler(t *testing.T) {
	handler := NewAPIHandler(nil, nil)
	cfg := &config.Config{
		GatewaySecret: "test-secret",
	}
	router := NewRouter(cfg, handler)

	req := httptest.NewRequest("GET", "/api/v1/qr", nil)
	req.Header.Set("Authorization", "Bearer test-secret")
	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200 OK on /api/v1/qr, got %d", rec.Code)
	}
}
