package security

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"math"
	"net/http"
	"strconv"
	"strings"
	"time"
)

// GenerateSignature generates an HMAC-SHA256 hex signature for payload bytes.
func GenerateSignature(secret string, timestamp int64, body []byte) string {
	mac := hmac.New(sha256.New, []byte(secret))
	mac.Write([]byte(fmt.Sprintf("%d.", timestamp)))
	mac.Write(body)
	return hex.EncodeToString(mac.Sum(nil))
}

// VerifySignature validates that signature matches HMAC-SHA256(timestamp.body, secret)
// and ensures timestamp is within maxSkewSeconds.
func VerifySignature(secret string, signature string, timestampStr string, body []byte, maxSkewSeconds float64) bool {
	if secret == "" || signature == "" || timestampStr == "" {
		return false
	}

	ts, err := strconv.ParseInt(timestampStr, 10, 64)
	if err != nil {
		return false
	}

	now := time.Now().Unix()
	if math.Abs(float64(now-ts)) > maxSkewSeconds {
		return false
	}

	expectedSig := GenerateSignature(secret, ts, body)

	// Strip "sha256=" prefix if present
	cleanSig := strings.TrimPrefix(signature, "sha256=")
	expectedClean := strings.TrimPrefix(expectedSig, "sha256=")

	return hmac.Equal([]byte(cleanSig), []byte(expectedClean))
}

// AuthMiddleware creates an HTTP middleware that verifies incoming requests against the gateway secret
// via Bearer token OR X-Gateway-Signature HMAC.
func AuthMiddleware(secret string) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			// 1. Health and public status checks are bypassed if explicitly permitted
			if r.URL.Path == "/healthz" || r.URL.Path == "/livez" {
				next.ServeHTTP(w, r)
				return
			}

			// 2. Check Bearer Authorization header
			authHeader := r.Header.Get("Authorization")
			if authHeader != "" {
				parts := strings.SplitN(authHeader, " ", 2)
				if len(parts) == 2 && strings.EqualFold(parts[0], "Bearer") {
					if hmac.Equal([]byte(parts[1]), []byte(secret)) {
						next.ServeHTTP(w, r)
						return
					}
				}
			}

			// 3. Check X-Gateway-Signature header
			sig := r.Header.Get("X-Gateway-Signature")
			ts := r.Header.Get("X-Gateway-Timestamp")
			if sig != "" && ts != "" {
				// For GET requests without body, body is empty
				if VerifySignature(secret, sig, ts, nil, 300) {
					next.ServeHTTP(w, r)
					return
				}
			}

			// Unauthorized
			http.Error(w, `{"error":"Unauthorized: invalid service authentication"}`, http.StatusUnauthorized)
		})
	}
}
