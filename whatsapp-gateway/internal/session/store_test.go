package session

import (
	"errors"
	"strings"
	"testing"

	"github.com/lib/pq"

	"civicsense/whatsapp-gateway/internal/config"
)

// TestNewStoreManagerNilConfig asserts that NewStoreManager returns an error when passed a nil config,
// preventing any nil pointer dereference panic.
func TestNewStoreManagerNilConfig(t *testing.T) {
	sm, err := NewStoreManager(nil)
	if err == nil {
		t.Fatal("expected error when config is nil, got nil")
	}
	if sm != nil {
		t.Fatalf("expected nil StoreManager on error, got %v", sm)
	}
	if !strings.Contains(err.Error(), "configuration cannot be nil") {
		t.Errorf("expected 'configuration cannot be nil' error, got %v", err)
	}
}

// TestNewStoreManagerMissingPostgresURL asserts that NewStoreManager fails safely
// when postgres dialect is specified with an empty DatabaseURL.
func TestNewStoreManagerMissingPostgresURL(t *testing.T) {
	cfg := &config.Config{
		DBDialect:   "postgres",
		DatabaseURL: "",
		DBSchema:    "whatsmeow",
	}

	sm, err := NewStoreManager(cfg)
	if err == nil {
		t.Fatal("expected error when postgres DatabaseURL is empty, got nil")
	}
	if sm != nil {
		t.Fatalf("expected nil StoreManager on error, got %v", sm)
	}
	if !strings.Contains(err.Error(), "postgresql database url cannot be empty") {
		t.Errorf("expected 'postgresql database url cannot be empty' error, got %v", err)
	}
}

// TestNewStoreManagerMissingSQLitePath asserts that NewStoreManager fails safely
// when sqlite dialect is specified with an empty DBPath.
func TestNewStoreManagerMissingSQLitePath(t *testing.T) {
	cfg := &config.Config{
		DBDialect: "sqlite",
		DBPath:    "",
	}

	sm, err := NewStoreManager(cfg)
	if err == nil {
		t.Fatal("expected error when sqlite DBPath is empty, got nil")
	}
	if sm != nil {
		t.Fatalf("expected nil StoreManager on error, got %v", sm)
	}
	if !strings.Contains(err.Error(), "sqlite database path cannot be empty") {
		t.Errorf("expected 'sqlite database path cannot be empty' error, got %v", err)
	}
}

// TestVerifyPostgresSchemaExistsRejectsInvalidURL asserts that verifyPostgresSchemaExists fails gracefully
// on an invalid database URL without panicking.
func TestVerifyPostgresSchemaExistsRejectsInvalidURL(t *testing.T) {
	err := verifyPostgresSchemaExists("invalid-postgres-url", "whatsmeow")
	if err == nil {
		t.Fatal("expected connection error on invalid postgres URL, got nil")
	}
}

// TestClassifyPostgresError verifies that database connection failures are properly categorized.
func TestClassifyPostgresError(t *testing.T) {
	testCases := []struct {
		name             string
		err              error
		expectedCategory FailureCategory
	}{
		{
			name:             "Authentication failure via pq.Error 28P01",
			err:              &pq.Error{Code: "28P01", Message: "password authentication failed for user whatsmeow_gateway"},
			expectedCategory: FailureAuthentication,
		},
		{
			name:             "Authentication failure via error string",
			err:              errors.New("pq: password authentication failed for user \"whatsmeow_gateway\""),
			expectedCategory: FailureAuthentication,
		},
		{
			name:             "DNS network error",
			err:              errors.New("dial tcp: lookup aws-0-ap-northeast-1.pooler.supabase.com: no such host"),
			expectedCategory: FailureDNSNetwork,
		},
		{
			name:             "Network timeout",
			err:              errors.New("dial tcp 54.64.190.72:5432: i/o timeout"),
			expectedCategory: FailureDNSNetwork,
		},
		{
			name:             "Database permission failure (invalid catalog)",
			err:              &pq.Error{Code: "3D000", Message: "database \"postgres\" does not exist"},
			expectedCategory: FailureDatabasePermission,
		},
		{
			name:             "Schema permission failure",
			err:              &pq.Error{Code: "42501", Message: "permission denied for schema whatsmeow"},
			expectedCategory: FailureSchemaPermission,
		},
		{
			name:             "Schema missing",
			err:              &pq.Error{Code: "3F000", Message: "schema \"whatsmeow\" does not exist"},
			expectedCategory: FailureSchemaMissing,
		},
		{
			name:             "URL parsing error",
			err:              errors.New("invalid connection option \"search_path\""),
			expectedCategory: FailureURLParsing,
		},
		{
			name:             "Nil error returns empty",
			err:              nil,
			expectedCategory: "",
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			category := ClassifyPostgresError(tc.err)
			if category != tc.expectedCategory {
				t.Errorf("expected category %s, got %s for error: %v", tc.expectedCategory, category, tc.err)
			}
		})
	}
}
