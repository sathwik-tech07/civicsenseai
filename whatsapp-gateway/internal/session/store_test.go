package session

import (
	"strings"
	"testing"

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
