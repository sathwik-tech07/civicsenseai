package security

import (
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"
)

func TestGenerateAndVerifySignature(t *testing.T) {
	secret := "test-secret-key-12345"
	body := []byte(`{"event_id":"evt_1","status":"ok"}`)
	now := time.Now().Unix()

	sig := GenerateSignature(secret, now, body)
	if sig == "" {
		t.Fatalf("expected non-empty signature")
	}

	// 1. Valid signature
	valid := VerifySignature(secret, sig, fmt.Sprintf("%d", now), body, 300)
	if !valid {
		t.Fatalf("expected signature to be valid")
	}

	// 2. Prefixed signature
	validPrefixed := VerifySignature(secret, "sha256="+sig, fmt.Sprintf("%d", now), body, 300)
	if !validPrefixed {
		t.Fatalf("expected sha256= prefixed signature to be valid")
	}

	// 3. Tampered body
	tamperedBody := []byte(`{"event_id":"evt_1","status":"tampered"}`)
	invalid := VerifySignature(secret, sig, fmt.Sprintf("%d", now), tamperedBody, 300)
	if invalid {
		t.Fatalf("expected signature on tampered body to be invalid")
	}

	// 4. Skewed timestamp
	skewedTs := now - 400
	invalidSkew := VerifySignature(secret, sig, fmt.Sprintf("%d", skewedTs), body, 300)
	if invalidSkew {
		t.Fatalf("expected skewed timestamp to be rejected")
	}
}

func TestAuthMiddleware(t *testing.T) {
	secret := "secret-xyz"
	middleware := AuthMiddleware(secret)

	handler := middleware(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte("ok"))
	}))

	// 1. Healthz probe bypassed
	reqHealth := httptest.NewRequest("GET", "/healthz", nil)
	recHealth := httptest.NewRecorder()
	handler.ServeHTTP(recHealth, reqHealth)
	if recHealth.Code != http.StatusOK {
		t.Fatalf("expected 200 on /healthz, got %d", recHealth.Code)
	}

	// 2. Missing auth rejected
	reqNoAuth := httptest.NewRequest("POST", "/api/v1/send", nil)
	recNoAuth := httptest.NewRecorder()
	handler.ServeHTTP(recNoAuth, reqNoAuth)
	if recNoAuth.Code != http.StatusUnauthorized {
		t.Fatalf("expected 401 on missing auth, got %d", recNoAuth.Code)
	}

	// 3. Valid Bearer accepted
	reqBearer := httptest.NewRequest("POST", "/api/v1/send", nil)
	reqBearer.Header.Set("Authorization", "Bearer "+secret)
	recBearer := httptest.NewRecorder()
	handler.ServeHTTP(recBearer, reqBearer)
	if recBearer.Code != http.StatusOK {
		t.Fatalf("expected 200 on valid bearer, got %d", recBearer.Code)
	}
}
