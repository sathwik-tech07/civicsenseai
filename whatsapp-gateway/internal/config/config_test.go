package config

import (
	"fmt"
	"os"
	"testing"
)

func TestConfigLoadDefaults(t *testing.T) {
	cfg := Load()
	if cfg.Port <= 0 {
		t.Fatalf("expected positive port, got %d", cfg.Port)
	}
	if cfg.DBPath == "" {
		t.Fatalf("expected non-empty DBPath")
	}
	if cfg.FastAPIURL == "" {
		t.Fatalf("expected non-empty FastAPIURL")
	}
	if cfg.GatewaySecret == "" {
		t.Fatalf("expected non-empty GatewaySecret")
	}
}

func TestConfigEnvOverrides(t *testing.T) {
	os.Setenv("PORT", "9999")
	os.Setenv("FASTAPI_BACKEND_URL", "http://backend-test:8000")
	os.Setenv("WHATSAPP_GATEWAY_SECRET", "custom-secret-key-prod")
	defer func() {
		os.Unsetenv("PORT")
		os.Unsetenv("FASTAPI_BACKEND_URL")
		os.Unsetenv("WHATSAPP_GATEWAY_SECRET")
	}()

	cfg := Load()
	if cfg.Port != 9999 {
		t.Errorf("expected port 9999, got %d", cfg.Port)
	}
	if cfg.FastAPIURL != "http://backend-test:8000" {
		t.Errorf("expected http://backend-test:8000, got %s", cfg.FastAPIURL)
	}
	if cfg.GatewaySecret != "custom-secret-key-prod" {
		t.Errorf("expected custom-secret-key-prod, got %s", cfg.GatewaySecret)
	}
}

func TestValidateDatabaseURLSafety(t *testing.T) {
	// 1. Must reject production Supabase reference
	prodURL := "postgresql://postgres.bcpgsvvjuxzowxqqmouk:Secret123@aws-0-us-east-2.pooler.supabase.com:5432/postgres"
	if _, _, err := ValidateAndNormalizeDatabaseURL(prodURL, true, "whatsmeow"); err == nil {
		t.Errorf("expected error rejecting production database reference, got nil")
	}

	// 2. Must reject transaction pooler port 6543
	pooler6543 := "postgresql://postgres.oayzaszhhpfjlpmaezmc:Secret123@aws-0-ap-northeast-1.pooler.supabase.com:6543/postgres"
	if _, _, err := ValidateAndNormalizeDatabaseURL(pooler6543, true, "whatsmeow"); err == nil {
		t.Errorf("expected error rejecting transaction pooler port 6543, got nil")
	}

	// 3. Must accept session pooler port 5432 and enforce search_path and sslmode
	stagingURL := "postgresql://postgres.oayzaszhhpfjlpmaezmc:Secret123@aws-0-ap-northeast-1.pooler.supabase.com:5432/postgres"
	normalized, dialect, err := ValidateAndNormalizeDatabaseURL(stagingURL, true, "whatsmeow")
	if err != nil {
		t.Fatalf("unexpected error on staging URL: %v", err)
	}
	if dialect != "postgres" {
		t.Errorf("expected dialect postgres, got %s", dialect)
	}
	if normalized == "" {
		t.Errorf("expected non-empty normalized URL")
	}

	// 4. Test MaskDatabaseURL
	masked := MaskDatabaseURL(stagingURL)
	if masked == stagingURL {
		t.Errorf("expected password to be masked, got original URL")
	}
}

func TestConfigGatewayDatabaseURLPrecedence(t *testing.T) {
	// Set both DATABASE_URL (backend/postgres) and WHATSAPP_GATEWAY_DATABASE_URL (custom role)
	backendURL := "postgresql://postgres.oayzaszhhpfjlpmaezmc:BackendSecret@aws-0-ap-northeast-1.pooler.supabase.com:5432/postgres"
	gatewayURL := "postgresql://whatsmeow_gateway.oayzaszhhpfjlpmaezmc:GatewaySecret@aws-0-ap-northeast-1.pooler.supabase.com:5432/postgres"

	os.Setenv("DATABASE_URL", backendURL)
	os.Setenv("WHATSAPP_GATEWAY_DATABASE_URL", gatewayURL)
	defer func() {
		os.Unsetenv("DATABASE_URL")
		os.Unsetenv("WHATSAPP_GATEWAY_DATABASE_URL")
	}()

	cfg := Load()
	if cfg.DBDialect != "postgres" {
		t.Fatalf("expected postgres dialect, got %s", cfg.DBDialect)
	}
	if !containsSubstring(cfg.DatabaseURL, "whatsmeow_gateway") {
		t.Errorf("expected WHATSAPP_GATEWAY_DATABASE_URL to take precedence over DATABASE_URL, got %s", MaskDatabaseURL(cfg.DatabaseURL))
	}
}

func TestConfigRejectsSilentPrivilegedFallbackInProduction(t *testing.T) {
	os.Setenv("ENVIRONMENT", "staging")
	os.Setenv("FASTAPI_BACKEND_URL", "https://civicsense-backend-staging.onrender.com")
	os.Setenv("WHATSAPP_GATEWAY_SECRET", "cryptographically-secure-test-secret-12345")
	os.Setenv("DATABASE_URL", "postgresql://postgres.oayzaszhhpfjlpmaezmc:BackendSecret@aws-0-ap-northeast-1.pooler.supabase.com:5432/postgres")
	os.Unsetenv("WHATSAPP_GATEWAY_DATABASE_URL")
	os.Unsetenv("ALLOW_PRIVILEGED_DATABASE_FALLBACK")

	defer func() {
		os.Unsetenv("ENVIRONMENT")
		os.Unsetenv("FASTAPI_BACKEND_URL")
		os.Unsetenv("WHATSAPP_GATEWAY_SECRET")
		os.Unsetenv("DATABASE_URL")
	}()

	defer func() {
		r := recover()
		if r == nil {
			t.Errorf("expected panic rejecting silent fallback to privileged DATABASE_URL in staging, but Load() did not panic")
		}
	}()

	Load()
}

func TestConfigFailClosedAcrossEnvironments(t *testing.T) {
	testCases := []struct {
		env           string
		expectPanic   bool
		expectedPanic string
	}{
		{"staging", true, "staging environment"},
		{"production", true, "production environment"},
		{"prod", true, "production environment"},
		{"development", false, ""},
		{"local", false, ""},
		{"", false, ""},
	}

	for _, tc := range testCases {
		func() {
			if tc.env != "" {
				os.Setenv("ENVIRONMENT", tc.env)
			} else {
				os.Unsetenv("ENVIRONMENT")
			}
			os.Setenv("FASTAPI_BACKEND_URL", "https://civicsense-backend-staging.onrender.com")
			os.Setenv("WHATSAPP_GATEWAY_SECRET", "cryptographically-secure-test-secret-12345")
			os.Setenv("DATABASE_URL", "postgresql://postgres.oayzaszhhpfjlpmaezmc:BackendSecret@aws-0-ap-northeast-1.pooler.supabase.com:5432/postgres")
			os.Unsetenv("WHATSAPP_GATEWAY_DATABASE_URL")
			os.Unsetenv("ALLOW_PRIVILEGED_DATABASE_FALLBACK")

			defer func() {
				os.Unsetenv("ENVIRONMENT")
				os.Unsetenv("FASTAPI_BACKEND_URL")
				os.Unsetenv("WHATSAPP_GATEWAY_SECRET")
				os.Unsetenv("DATABASE_URL")
			}()

			didPanic := false
			var panicVal interface{}
			func() {
				defer func() {
					if r := recover(); r != nil {
						didPanic = true
						panicVal = r
					}
				}()
				Load()
			}()

			if tc.expectPanic && !didPanic {
				t.Errorf("ENVIRONMENT=%q: expected panic rejecting silent fallback, but Load() did not panic", tc.env)
			}
			if !tc.expectPanic && didPanic {
				t.Errorf("ENVIRONMENT=%q: did not expect panic, but got: %v", tc.env, panicVal)
			}
			if tc.expectPanic && didPanic && tc.expectedPanic != "" {
				msg := fmt.Sprintf("%v", panicVal)
				if !containsSubstring(msg, tc.expectedPanic) {
					t.Errorf("ENVIRONMENT=%q: expected panic message containing %q, got %q", tc.env, tc.expectedPanic, msg)
				}
			}
		}()
	}
}

func TestConfigRejectsInvalidFastAPIURLInCloud(t *testing.T) {
	invalidURLs := []string{"", "http://backend:8000", "http://localhost:8000", "http://127.0.0.1:8000"}

	for _, invalidURL := range invalidURLs {
		func() {
			os.Setenv("ENVIRONMENT", "staging")
			if invalidURL != "" {
				os.Setenv("FASTAPI_BACKEND_URL", invalidURL)
			} else {
				os.Unsetenv("FASTAPI_BACKEND_URL")
			}
			os.Setenv("WHATSAPP_GATEWAY_SECRET", "cryptographically-secure-test-secret-12345")
			os.Setenv("WHATSAPP_GATEWAY_DATABASE_URL", "postgresql://whatsmeow_gateway.oayzaszhhpfjlpmaezmc:GatewaySecret@aws-0-ap-northeast-1.pooler.supabase.com:5432/postgres")

			defer func() {
				os.Unsetenv("ENVIRONMENT")
				os.Unsetenv("FASTAPI_BACKEND_URL")
				os.Unsetenv("WHATSAPP_GATEWAY_SECRET")
				os.Unsetenv("WHATSAPP_GATEWAY_DATABASE_URL")
			}()

			didPanic := false
			func() {
				defer func() {
					if r := recover(); r != nil {
						didPanic = true
					}
				}()
				Load()
			}()

			if !didPanic {
				t.Errorf("FASTAPI_BACKEND_URL=%q: expected panic in staging environment, got none", invalidURL)
			}
		}()
	}
}

func TestConfigRejectsSQLiteInCloud(t *testing.T) {
	os.Setenv("ENVIRONMENT", "staging")
	os.Setenv("FASTAPI_BACKEND_URL", "https://civicsense-backend-staging.onrender.com")
	os.Setenv("WHATSAPP_GATEWAY_SECRET", "cryptographically-secure-test-secret-12345")
	os.Setenv("DB_DIALECT", "sqlite")
	os.Setenv("WHATSAPP_GATEWAY_DATABASE_URL", "sqlite:/data/test.db")

	defer func() {
		os.Unsetenv("ENVIRONMENT")
		os.Unsetenv("FASTAPI_BACKEND_URL")
		os.Unsetenv("WHATSAPP_GATEWAY_SECRET")
		os.Unsetenv("DB_DIALECT")
		os.Unsetenv("WHATSAPP_GATEWAY_DATABASE_URL")
	}()

	didPanic := false
	func() {
		defer func() {
			if r := recover(); r != nil {
				didPanic = true
			}
		}()
		Load()
	}()

	if !didPanic {
		t.Errorf("expected panic rejecting SQLite in staging environment, got none")
	}
}

func containsSubstring(s, substr string) bool {
	for i := 0; i+len(substr) <= len(s); i++ {
		if s[i:i+len(substr)] == substr {
			return true
		}
	}
	return false
}
