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

// TestMaskDatabaseURL_Scenarios tests comprehensive credential masking across diverse URL formats.
func TestMaskDatabaseURL_Scenarios(t *testing.T) {
	testCases := []struct {
		name           string
		inputURL       string
		secretToVerify string
		expectedMask   string
	}{
		{
			name:           "Normal PostgreSQL URL with credentials and query parameters",
			inputURL:       "postgresql://whatsmeow_gateway.oayzaszhhpfjlpmaezmc:StandardPass123@aws-0-ap-northeast-1.pooler.supabase.com:5432/postgres?sslmode=require",
			secretToVerify: "StandardPass123",
			expectedMask:   "postgresql://whatsmeow_gateway.oayzaszhhpfjlpmaezmc:*****@aws-0-ap-northeast-1.pooler.supabase.com:5432/postgres?sslmode=require",
		},
		{
			name:           "Password containing reserved and special characters",
			inputURL:       "postgresql://user:P@ss%21%23%24*()123@aws-0-ap-northeast-1.pooler.supabase.com:5432/postgres?sslmode=require",
			secretToVerify: "P@ss%21%23%24*()123",
			expectedMask:   "postgresql://user:*****@aws-0-ap-northeast-1.pooler.supabase.com:5432/postgres?sslmode=require",
		},
		{
			name:           "Password containing multiple @ characters",
			inputURL:       "postgresql://user:p@ss@word@aws-0-ap-northeast-1.pooler.supabase.com:5432/postgres?sslmode=require",
			secretToVerify: "p@ss@word",
			expectedMask:   "postgresql://user:*****@aws-0-ap-northeast-1.pooler.supabase.com:5432/postgres?sslmode=require",
		},
		{
			name:           "URL with no password",
			inputURL:       "postgresql://appuser@localhost:5432/mydb?sslmode=disable",
			secretToVerify: "",
			expectedMask:   "postgresql://appuser@localhost:5432/mydb?sslmode=disable",
		},
		{
			name:           "URL with empty password",
			inputURL:       "postgresql://appuser:@localhost:5432/mydb?sslmode=disable",
			secretToVerify: "",
			expectedMask:   "postgresql://appuser:*****@localhost:5432/mydb?sslmode=disable",
		},
		{
			name:           "URL without scheme",
			inputURL:       "whatsmeow_user:SecretKey123@aws-0-ap-northeast-1.pooler.supabase.com:5432/postgres",
			secretToVerify: "SecretKey123",
			expectedMask:   "whatsmeow_user:*****@aws-0-ap-northeast-1.pooler.supabase.com:5432/postgres",
		},
		{
			name:           "URL without scheme and multiple @ characters",
			inputURL:       "user:p@ss@word@host:5432/db",
			secretToVerify: "p@ss@word",
			expectedMask:   "user:*****@host:5432/db",
		},
		{
			name:           "URL preserving paths, query parameters, and fragments",
			inputURL:       "postgresql://dbuser:mypassword@db.host.internal:5432/app/database?sslmode=require&connect_timeout=15#migration",
			secretToVerify: "mypassword",
			expectedMask:   "postgresql://dbuser:*****@db.host.internal:5432/app/database?sslmode=require&connect_timeout=15#migration",
		},
		{
			name:           "URL with unusual username containing dots and hyphens",
			inputURL:       "postgresql://svc-account.worker_node-1:ComplexPass456@host:5432/db",
			secretToVerify: "ComplexPass456",
			expectedMask:   "postgresql://svc-account.worker_node-1:*****@host:5432/db",
		},
		{
			name:           "URL with no userinfo at all",
			inputURL:       "postgresql://localhost:5432/mydb?sslmode=disable",
			secretToVerify: "",
			expectedMask:   "postgresql://localhost:5432/mydb?sslmode=disable",
		},
		{
			name:           "URL with host and path containing @ symbol but no credentials",
			inputURL:       "postgresql://host:5432/path@something",
			secretToVerify: "",
			expectedMask:   "postgresql://host:5432/path@something",
		},
		{
			name:           "Malformed URL fallback with spaces",
			inputURL:       "postgresql://user:secret pass with spaces@host:5432/db",
			secretToVerify: "secret pass with spaces",
			expectedMask:   "postgresql://user:*****@host:5432/db",
		},
		{
			name:           "Regression: Password containing spaces and slash characters",
			inputURL:       "postgresql://user:secret pass/word@host:5432/db",
			secretToVerify: "secret pass/word",
			expectedMask:   "postgresql://user:*****@host:5432/db",
		},
		{
			name:           "Password containing unencoded slash character",
			inputURL:       "postgresql://user:secret/word@host:5432/db",
			secretToVerify: "secret/word",
			expectedMask:   "postgresql://user:*****@host:5432/db",
		},
		{
			name:           "Password containing multiple @ and slash characters",
			inputURL:       "postgresql://user:p@ss/word@host:5432/db",
			secretToVerify: "p@ss/word",
			expectedMask:   "postgresql://user:*****@host:5432/db",
		},
		{
			name:           "Password containing multiple @ and multiple slashes",
			inputURL:       "postgresql://user:p@ss@w/o/r/d@host:5432/db",
			secretToVerify: "p@ss@w/o/r/d",
			expectedMask:   "postgresql://user:*****@host:5432/db",
		},
		{
			name:           "Encoded username and password with encoded slashes and @ signs",
			inputURL:       "postgresql://user%20name:p%40ss%2Fword@host:5432/db",
			secretToVerify: "p%40ss%2Fword",
			expectedMask:   "postgresql://user%20name:*****@host:5432/db",
		},
		{
			name:           "Password with multiple @ and query parameter also containing @",
			inputURL:       "postgresql://user:p@ss@word@host:5432/db?email=foo@bar.com#frag",
			secretToVerify: "p@ss@word",
			expectedMask:   "postgresql://user:*****@host:5432/db?email=foo@bar.com#frag",
		},
		{
			name:           "Key-value DSN format password masking",
			inputURL:       "host=localhost port=5432 user=myuser password=SuperSecretDSNPass dbname=mydb",
			secretToVerify: "SuperSecretDSNPass",
			expectedMask:   "host=localhost port=5432 user=myuser password=***** dbname=mydb",
		},
		{
			name:           "Key-value DSN with single-quoted password containing spaces",
			inputURL:       "host=localhost user=myuser password='Secret with spaces' dbname=mydb",
			secretToVerify: "Secret with spaces",
			expectedMask:   "host=localhost user=myuser password=***** dbname=mydb",
		},
		{
			name:           "Key-value DSN with double-quoted password containing spaces",
			inputURL:       `host=localhost user=myuser password="Secret with spaces" dbname=mydb`,
			secretToVerify: "Secret with spaces",
			expectedMask:   `host=localhost user=myuser password=***** dbname=mydb`,
		},
		{
			name:           "Key-value DSN with pwd key",
			inputURL:       "host=localhost user=myuser pwd=SecretKey dbname=mydb",
			secretToVerify: "SecretKey",
			expectedMask:   "host=localhost user=myuser pwd=***** dbname=mydb",
		},
		{
			name:           "IPv6 host with port and credentials",
			inputURL:       "postgresql://user:IPv6Pass123@[::1]:5432/db",
			secretToVerify: "IPv6Pass123",
			expectedMask:   "postgresql://user:*****@[::1]:5432/db",
		},
		{
			name:           "IPv6 host without port and with credentials",
			inputURL:       "postgresql://user:IPv6Pass456@[2001:db8::1]/db?sslmode=require",
			secretToVerify: "IPv6Pass456",
			expectedMask:   "postgresql://user:*****@[2001:db8::1]/db?sslmode=require",
		},
		{
			name:           "IPv6 host without credentials",
			inputURL:       "postgresql://[::1]:5432/db?sslmode=disable",
			secretToVerify: "",
			expectedMask:   "postgresql://[::1]:5432/db?sslmode=disable",
		},
		{
			name:           "Query-string password parameter redacted",
			inputURL:       "postgresql://host:5432/db?password=SecretQueryPass&sslmode=require",
			secretToVerify: "SecretQueryPass",
			expectedMask:   "postgresql://host:5432/db?password=*****&sslmode=require",
		},
		{
			name:           "Authority password and query-string password both redacted",
			inputURL:       "postgresql://user:AuthPass@host:5432/db?password=QueryPass#frag",
			secretToVerify: "AuthPass",
			expectedMask:   "postgresql://user:*****@host:5432/db?password=*****#frag",
		},
		{
			name:           "Fragment containing @ symbol preserved",
			inputURL:       "postgresql://user:password123@host:5432/db#frag@section",
			secretToVerify: "password123",
			expectedMask:   "postgresql://user:*****@host:5432/db#frag@section",
		},
		{
			name:           "Fragment containing password parameter redacted",
			inputURL:       "postgresql://user:password123@host:5432/db#password=SecretFrag",
			secretToVerify: "SecretFrag",
			expectedMask:   "postgresql://user:*****@host:5432/db#password=*****",
		},
		{
			name:           "Fail-closed: Malformed authority with non-numeric port",
			inputURL:       "postgresql://host:invalid_port/db",
			secretToVerify: "",
			expectedMask:   SafeRedactedDatabaseURL,
		},
		{
			name:           "Fail-closed: Corrupted URL with @ falls back to safe diagnostic placeholder",
			inputURL:       "://???:::@@@something_completely_broken_with_password",
			secretToVerify: "password",
			expectedMask:   SafeRedactedDatabaseURL,
		},
		{
			name:           "Password with multiple @ signs, encoded slash, and unencoded slash",
			inputURL:       "postgresql://user:p@ss@word%2Fslash/unencoded@host:5432/db",
			secretToVerify: "p@ss@word%2Fslash/unencoded",
			expectedMask:   "postgresql://user:*****@host:5432/db",
		},
		{
			name:           "Password containing percent-encoded slash",
			inputURL:       "postgresql://user:secret%2Fword@host:5432/db",
			secretToVerify: "secret%2Fword",
			expectedMask:   "postgresql://user:*****@host:5432/db",
		},
		{
			name:           "Password containing percent-encoded @",
			inputURL:       "postgresql://user:secret%40pass@host:5432/db",
			secretToVerify: "secret%40pass",
			expectedMask:   "postgresql://user:*****@host:5432/db",
		},
		{
			name:           "URL with empty username but valid password",
			inputURL:       "postgresql://:secretpass@host:5432/db",
			secretToVerify: "secretpass",
			expectedMask:   "postgresql://:*****@host:5432/db",
		},
		{
			name:           "URL with empty username and empty password",
			inputURL:       "postgresql://:@host:5432/db",
			secretToVerify: "",
			expectedMask:   "postgresql://:*****@host:5432/db",
		},
		{
			name:           "Fail-closed: Malformed URL without @ with credentials and db path",
			inputURL:       "postgresql://user:secret/db",
			secretToVerify: "secret",
			expectedMask:   SafeRedactedDatabaseURL,
		},
		{
			name:           "Fail-closed: Malformed URL without @ with credentials only",
			inputURL:       "postgresql://user:secret",
			secretToVerify: "secret",
			expectedMask:   SafeRedactedDatabaseURL,
		},
		{
			name:           "Empty string returns empty",
			inputURL:       "",
			secretToVerify: "",
			expectedMask:   "",
		},
		{
			name:           "DSN single-quoted password containing escaped single quote",
			inputURL:       `host=localhost user=myuser password='my\'secret' dbname=mydb`,
			secretToVerify: `my\'secret`,
			expectedMask:   `host=localhost user=myuser password=***** dbname=mydb`,
		},
		{
			name:           "DSN single-quoted password containing escaped backslash",
			inputURL:       `host=localhost user=myuser password='my\\secret' dbname=mydb`,
			secretToVerify: `my\\secret`,
			expectedMask:   `host=localhost user=myuser password=***** dbname=mydb`,
		},
		{
			name:           "DSN single-quoted password containing escaped backslash and escaped quote",
			inputURL:       `host=localhost user=myuser password='my\\\'secret' dbname=mydb`,
			secretToVerify: `my\\\'secret`,
			expectedMask:   `host=localhost user=myuser password=***** dbname=mydb`,
		},
		{
			name:           "DSN single-quoted password ending with escaped backslash",
			inputURL:       `host=localhost user=myuser password='secret\\' dbname=mydb`,
			secretToVerify: `secret\\`,
			expectedMask:   `host=localhost user=myuser password=***** dbname=mydb`,
		},
		{
			name:           "DSN single-quoted password containing SQL-standard double single quote",
			inputURL:       `host=localhost user=myuser password='it''s secret' dbname=mydb`,
			secretToVerify: `it''s secret`,
			expectedMask:   `host=localhost user=myuser password=***** dbname=mydb`,
		},
		{
			name:           "DSN double-quoted password containing escaped double quote",
			inputURL:       `host=localhost user=myuser password="my\"secret" dbname=mydb`,
			secretToVerify: `my\"secret`,
			expectedMask:   `host=localhost user=myuser password=***** dbname=mydb`,
		},
		{
			name:           "DSN double-quoted password containing escaped backslash",
			inputURL:       `host=localhost user=myuser password="my\\secret" dbname=mydb`,
			secretToVerify: `my\\secret`,
			expectedMask:   `host=localhost user=myuser password=***** dbname=mydb`,
		},
		{
			name:           "DSN double-quoted password containing escaped backslash and escaped quote",
			inputURL:       `host=localhost user=myuser password="my\\\"secret" dbname=mydb`,
			secretToVerify: `my\\\"secret`,
			expectedMask:   `host=localhost user=myuser password=***** dbname=mydb`,
		},
		{
			name:           "DSN single-quoted password containing spaces, backslashes, and special characters",
			inputURL:       `host=localhost user=myuser password='s\\p a c e\'s & # ; = @' dbname=mydb`,
			secretToVerify: `s\\p a c e\'s & # ; = @`,
			expectedMask:   `host=localhost user=myuser password=***** dbname=mydb`,
		},
		{
			name:           "DSN unquoted password containing backslashes and special characters",
			inputURL:       `host=localhost user=myuser password=sec\ret!@#$%^&*()_+: dbname=mydb`,
			secretToVerify: `sec\ret!@#$%^&*()_+:`,
			expectedMask:   `host=localhost user=myuser password=***** dbname=mydb`,
		},
		{
			name:           "DSN pwd keyword with escaped single quote",
			inputURL:       `host=localhost user=myuser pwd='pass\'word' dbname=mydb`,
			secretToVerify: `pass\'word`,
			expectedMask:   `host=localhost user=myuser pwd=***** dbname=mydb`,
		},
		{
			name:           "DSN spaces around equals with escaped single quote",
			inputURL:       `host=localhost user=myuser password = 'sec\'ret' dbname=mydb`,
			secretToVerify: `sec\'ret`,
			expectedMask:   `host=localhost user=myuser password = ***** dbname=mydb`,
		},
		{
			name:           "DSN semicolon-separated parameters with escaped quote",
			inputURL:       `host=localhost;user=myuser;password='sec\'ret;123';dbname=mydb`,
			secretToVerify: `sec\'ret;123`,
			expectedMask:   `host=localhost;user=myuser;password=*****;dbname=mydb`,
		},
		{
			name:           "DSN multiple passwords with escaped quotes masked",
			inputURL:       `host=localhost password='p1\'s' user=myuser pwd='p2\"s' dbname=mydb`,
			secretToVerify: `p1\'s`,
			expectedMask:   `host=localhost password=***** user=myuser pwd=***** dbname=mydb`,
		},
		{
			name:           "Fail-closed: DSN unterminated escaped quote at end",
			inputURL:       `host=localhost user=myuser password='secret\' dbname=mydb`,
			secretToVerify: `secret`,
			expectedMask:   SafeRedactedDatabaseURL,
		},
		{
			name:           "Fail-closed: DSN unterminated single quote",
			inputURL:       `host=localhost user=myuser password='unclosed secret dbname=mydb`,
			secretToVerify: `unclosed secret`,
			expectedMask:   SafeRedactedDatabaseURL,
		},
		{
			name:           "Fail-closed: DSN unterminated double quote",
			inputURL:       `host=localhost user=myuser password="unclosed secret dbname=mydb`,
			secretToVerify: `unclosed secret`,
			expectedMask:   SafeRedactedDatabaseURL,
		},
		{
			name:           "DSN empty single-quoted password",
			inputURL:       `host=localhost user=myuser password='' dbname=mydb`,
			secretToVerify: ``,
			expectedMask:   `host=localhost user=myuser password=***** dbname=mydb`,
		},
		{
			name:           "DSN empty double-quoted password",
			inputURL:       `host=localhost user=myuser password="" dbname=mydb`,
			secretToVerify: ``,
			expectedMask:   `host=localhost user=myuser password=***** dbname=mydb`,
		},
		{
			name:           "DSN in URL scheme with application_name URI parameter",
			inputURL:       `host=localhost user=myuser application_name='https://example.com' password='my\'secret' dbname=mydb`,
			secretToVerify: `my\'secret`,
			expectedMask:   `host=localhost user=myuser application_name='https://example.com' password=***** dbname=mydb`,
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			masked := MaskDatabaseURL(tc.inputURL)

			if tc.secretToVerify != "" && strings.Contains(masked, tc.secretToVerify) {
				t.Fatalf("SECURITY VIOLATION: Secret password leaked in MaskDatabaseURL! Masked: %s", masked)
			}

			// Also verify that unescaped variants don't leak
			unescaped := strings.ReplaceAll(tc.secretToVerify, `\'`, "'")
			unescaped = strings.ReplaceAll(unescaped, `\"`, `"`)
			unescaped = strings.ReplaceAll(unescaped, `\\`, `\`)
			unescaped = strings.ReplaceAll(unescaped, `''`, `'`)
			if len(unescaped) > 3 && unescaped != SafeRedactedDatabaseURL && strings.Contains(masked, unescaped) {
				t.Fatalf("SECURITY VIOLATION: Unescaped secret password leaked in MaskDatabaseURL! Masked: %s", masked)
			}

			if tc.expectedMask != "" && masked != tc.expectedMask {
				t.Errorf("expected masked URL %q, got %q", tc.expectedMask, masked)
			}

			if tc.secretToVerify != "" && !strings.Contains(masked, "*****") && masked != SafeRedactedDatabaseURL {
				t.Errorf("expected masked URL to contain literal '*****' or safe diagnostic placeholder, got %q", masked)
			}
		})
	}
}

// TestValidateAndNormalizeDatabaseURL_ErrorDoesNotLeakPassword ensures parsing errors
// never include the raw URL or secret password in the returned error message.
func TestValidateAndNormalizeDatabaseURL_ErrorDoesNotLeakPassword(t *testing.T) {
	testCases := []struct {
		name         string
		malformedURL string
		secretPass   string
	}{
		{
			name:         "URL with spaces in authority",
			malformedURL: "postgresql://user:UnredactedUltraSecretPassword123 with spaces@host:5432/db",
			secretPass:   "UnredactedUltraSecretPassword123",
		},
		{
			name:         "DSN connection string with escaped quotes passed to URL validator",
			malformedURL: "host=localhost user=myuser password='SecretPass\\'123' dbname=mydb",
			secretPass:   "SecretPass\\'123",
		},
		{
			name:         "Malformed authority with invalid characters",
			malformedURL: "postgresql://user:SecretPass^456@host:invalid[port]/db",
			secretPass:   "SecretPass^456",
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			_, _, err := ValidateAndNormalizeDatabaseURL(tc.malformedURL, false, "whatsmeow")
			if err == nil {
				t.Fatal("expected error on malformed URL, got nil")
			}

			errMsg := err.Error()
			if strings.Contains(errMsg, tc.secretPass) {
				t.Fatalf("CRITICAL SECURITY ERROR: Password leaked in ValidateAndNormalizeDatabaseURL error message: %s", errMsg)
			}
			unescaped := strings.ReplaceAll(tc.secretPass, `\'`, "'")
			if len(unescaped) > 3 && strings.Contains(errMsg, unescaped) {
				t.Fatalf("CRITICAL SECURITY ERROR: Unescaped password leaked in ValidateAndNormalizeDatabaseURL error message: %s", errMsg)
			}
		})
	}
}
