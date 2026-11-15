package config

import (
	"os"
	"strings"
	"testing"
)

// TestInspectDatabaseConfig_WhitespaceAndQuoteDetection tests whitespace and quotes detection and removal.
func TestInspectDatabaseConfig_WhitespaceAndQuoteDetection(t *testing.T) {
	testCases := []struct {
		name                 string
		rawURL               string
		expectWhitespace     bool
		expectQuotes         bool
		expectedCleanHost    string
		expectedCleanUser    string
		expectedCleanPort    string
	}{
		{
			name:              "Clean URL",
			rawURL:            "postgresql://whatsmeow_gateway.oayzaszhhpfjlpmaezmc:MyPass123@aws-0-ap-northeast-1.pooler.supabase.com:5432/postgres?sslmode=require",
			expectWhitespace:  false,
			expectQuotes:      false,
			expectedCleanHost: "aws-0-ap-northeast-1.pooler.supabase.com",
			expectedCleanUser: "whatsmeow_gateway.oayzaszhhpfjlpmaezmc",
			expectedCleanPort: "5432",
		},
		{
			name:              "URL with leading and trailing whitespace and newlines",
			rawURL:            "  \n\tpostgresql://whatsmeow_gateway.oayzaszhhpfjlpmaezmc:MyPass123@aws-0-ap-northeast-1.pooler.supabase.com:5432/postgres?sslmode=require \r\n",
			expectWhitespace:  true,
			expectQuotes:      false,
			expectedCleanHost: "aws-0-ap-northeast-1.pooler.supabase.com",
			expectedCleanUser: "whatsmeow_gateway.oayzaszhhpfjlpmaezmc",
			expectedCleanPort: "5432",
		},
		{
			name:              "URL enclosed in double quotes",
			rawURL:            "\"postgresql://whatsmeow_gateway.oayzaszhhpfjlpmaezmc:MyPass123@aws-0-ap-northeast-1.pooler.supabase.com:5432/postgres?sslmode=require\"",
			expectWhitespace:  false,
			expectQuotes:      true,
			expectedCleanHost: "aws-0-ap-northeast-1.pooler.supabase.com",
			expectedCleanUser: "whatsmeow_gateway.oayzaszhhpfjlpmaezmc",
			expectedCleanPort: "5432",
		},
		{
			name:              "URL enclosed in single quotes with whitespace",
			rawURL:            " 'postgresql://whatsmeow_gateway.oayzaszhhpfjlpmaezmc:MyPass123@aws-0-ap-northeast-1.pooler.supabase.com:5432/postgres?sslmode=require' ",
			expectWhitespace:  true,
			expectQuotes:      true,
			expectedCleanHost: "aws-0-ap-northeast-1.pooler.supabase.com",
			expectedCleanUser: "whatsmeow_gateway.oayzaszhhpfjlpmaezmc",
			expectedCleanPort: "5432",
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			diag, cleanURL := InspectDatabaseConfig(tc.rawURL, "WHATSAPP_GATEWAY_DATABASE_URL")

			if diag.HasLeadingTrailingWhitespace != tc.expectWhitespace {
				t.Errorf("expected whitespace=%t, got %t", tc.expectWhitespace, diag.HasLeadingTrailingWhitespace)
			}
			if diag.HasSurroundingQuotes != tc.expectQuotes {
				t.Errorf("expected quotes=%t, got %t", tc.expectQuotes, diag.HasSurroundingQuotes)
			}
			if diag.Hostname != tc.expectedCleanHost {
				t.Errorf("expected host=%s, got %s", tc.expectedCleanHost, diag.Hostname)
			}
			if diag.Username != tc.expectedCleanUser {
				t.Errorf("expected user=%s, got %s", tc.expectedCleanUser, diag.Username)
			}
			if diag.Port != tc.expectedCleanPort {
				t.Errorf("expected port=%s, got %s", tc.expectedCleanPort, diag.Port)
			}
			if !diag.HasPassword {
				t.Errorf("expected has_password=true")
			}
			if strings.HasPrefix(cleanURL, "\"") || strings.HasPrefix(cleanURL, "'") || strings.HasSuffix(cleanURL, " ") {
				t.Errorf("cleanURL was not properly trimmed: %s", cleanURL)
			}
		})
	}
}

// TestInspectDatabaseConfig_CredentialRedaction verifies password is never present in diagnostics.
func TestInspectDatabaseConfig_CredentialRedaction(t *testing.T) {
	secretPass := "SuperSecretPassword123!"
	rawURL := "postgresql://whatsmeow_gateway.oayzaszhhpfjlpmaezmc:" + secretPass + "@aws-0-ap-northeast-1.pooler.supabase.com:5432/postgres?sslmode=require"

	diag, _ := InspectDatabaseConfig(rawURL, "WHATSAPP_GATEWAY_DATABASE_URL")

	// Ensure password boolean is true, but password itself is never in any field
	if !diag.HasPassword {
		t.Fatal("expected has_password to be true")
	}

	diagStr := diag.Hostname + diag.Username + diag.DatabaseName + diag.Port + diag.Scheme + diag.Source + diag.SSLMode
	if strings.Contains(diagStr, secretPass) {
		t.Fatalf("CRITICAL SECURITY VIOLATION: Secret password leaked in diagnostic struct fields!")
	}

	// Test MaskDatabaseURL
	masked := MaskDatabaseURL(rawURL)
	if strings.Contains(masked, secretPass) {
		t.Fatalf("CRITICAL SECURITY VIOLATION: Secret password leaked in MaskDatabaseURL!")
	}
	if !strings.Contains(masked, "*****") {
		t.Fatalf("expected password to be replaced with ***** in MaskDatabaseURL")
	}
}

// TestEnvironmentVariableSelection_Precedence verifies selection priority.
func TestEnvironmentVariableSelection_Precedence(t *testing.T) {
	gatewayURL := "postgresql://whatsmeow_gateway.oayzaszhhpfjlpmaezmc:GatewayPass@aws-0-ap-northeast-1.pooler.supabase.com:5432/postgres?sslmode=require"
	backendURL := "postgresql://postgres.oayzaszhhpfjlpmaezmc:BackendPass@aws-0-ap-northeast-1.pooler.supabase.com:5432/postgres?sslmode=require"

	os.Setenv("WHATSAPP_GATEWAY_DATABASE_URL", gatewayURL)
	os.Setenv("DATABASE_URL", backendURL)
	defer func() {
		os.Unsetenv("WHATSAPP_GATEWAY_DATABASE_URL")
		os.Unsetenv("DATABASE_URL")
	}()

	cfg := Load()
	if !strings.Contains(cfg.DatabaseURL, "whatsmeow_gateway") {
		t.Errorf("expected WHATSAPP_GATEWAY_DATABASE_URL to be selected over DATABASE_URL, got %s", cfg.DatabaseURL)
	}
}
