package session

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"strings"

	"github.com/lib/pq"
	"go.mau.fi/whatsmeow/store"
	"go.mau.fi/whatsmeow/store/sqlstore"
	waLog "go.mau.fi/whatsmeow/util/log"
	_ "modernc.org/sqlite"

	"civicsense/whatsapp-gateway/internal/config"
	"civicsense/whatsapp-gateway/internal/logging"
)

// StoreManager wraps the whatsmeow persistent device container.
type StoreManager struct {
	Container   *sqlstore.Container
	DeviceStore *store.Device
	Dialect     string
	DBInfo      string
}

// NewStoreManager initializes storage for whatsmeow credentials (PostgreSQL or SQLite).
func NewStoreManager(cfg *config.Config) (*StoreManager, error) {
	if cfg == nil {
		return nil, fmt.Errorf("session store configuration cannot be nil")
	}

	waLogger := waLog.Stdout("SessionStore", "INFO", true)

	var container *sqlstore.Container
	var err error
	var dbInfo string

	if cfg.DBDialect == "postgres" {
		if cfg.DatabaseURL == "" {
			return nil, fmt.Errorf("postgresql database url cannot be empty when dialect is postgres")
		}
		maskedDSN := config.MaskDatabaseURL(cfg.DatabaseURL)
		dbInfo = maskedDSN
		logging.Infof("Initializing whatsmeow PostgreSQL session container with schema '%s' at: %s", cfg.DBSchema, maskedDSN)

		// Fail-closed safety check: ensure the dedicated schema exists before calling sqlstore
		// This guarantees whatsmeow never accidentally falls back to creating tables in public schema
		if err := verifyPostgresSchemaExists(cfg.DatabaseURL, cfg.DBSchema); err != nil {
			return nil, fmt.Errorf("pre-flight schema safety check failed: %w", err)
		}

		container, err = sqlstore.New(context.Background(), "postgres", cfg.DatabaseURL, waLogger)
		if err != nil {
			return nil, fmt.Errorf("failed to open postgres session store: %w", err)
		}
	} else {
		// SQLite Mode
		if cfg.DBPath == "" {
			return nil, fmt.Errorf("sqlite database path cannot be empty when dialect is sqlite")
		}
		dbInfo = cfg.DBPath
		dir := filepath.Dir(cfg.DBPath)
		if dir != "" && dir != "." {
			if err := os.MkdirAll(dir, 0700); err != nil {
				return nil, fmt.Errorf("failed to create session db dir: %w", err)
			}
		}

		dsn := fmt.Sprintf("file:%s?_pragma=foreign_keys(1)&_pragma=busy_timeout(10000)&_pragma=journal_mode(WAL)", cfg.DBPath)
		logging.Infof("Initializing whatsmeow SQLite session container at: %s", cfg.DBPath)

		container, err = sqlstore.New(context.Background(), "sqlite", dsn, waLogger)
		if err != nil {
			return nil, fmt.Errorf("failed to open sqlite session store: %w", err)
		}
	}

	if container == nil {
		return nil, fmt.Errorf("whatsmeow session container is nil after initialization")
	}

	// Retrieve first device or create a new one
	deviceStore, err := container.GetFirstDevice(context.Background())
	if err != nil {
		return nil, fmt.Errorf("failed to get device from store: %w", err)
	}
	if deviceStore == nil {
		logging.Infof("No existing device session found. Creating fresh device for pairing...")
		deviceStore = container.NewDevice()
		if deviceStore == nil {
			return nil, fmt.Errorf("failed to create fresh device session: container returned nil")
		}
	} else if deviceStore.ID == nil {
		logging.Infof("Existing device session loaded (unregistered/unpaired). Ready for QR pairing...")
	} else {
		logging.Infof("Existing device session loaded: JID=%s", deviceStore.ID.String())
	}

	return &StoreManager{
		Container:   container,
		DeviceStore: deviceStore,
		Dialect:     cfg.DBDialect,
		DBInfo:      dbInfo,
	}, nil
}

// FailureCategory represents the diagnostic classification of a database error.
type FailureCategory string

const (
	FailureURLParsing         FailureCategory = "URL_PARSING_ERROR"
	FailureDNSNetwork         FailureCategory = "DNS_NETWORK_ERROR"
	FailureAuthentication     FailureCategory = "POSTGRESQL_AUTHENTICATION_FAILURE"
	FailureDatabasePermission FailureCategory = "DATABASE_PERMISSION_FAILURE"
	FailureSchemaMissing      FailureCategory = "SCHEMA_MISSING"
	FailureSchemaPermission   FailureCategory = "SCHEMA_PERMISSION_FAILURE"
	FailureUnknown            FailureCategory = "UNKNOWN_ERROR"
)

// ClassifyPostgresError categorizes database connection errors into actionable diagnostic categories.
func ClassifyPostgresError(err error) FailureCategory {
	if err == nil {
		return ""
	}

	errStr := strings.ToLower(err.Error())

	// 1. PostgreSQL Wire Protocol Errors (lib/pq pq.Error)
	var pqErr *pq.Error
	if errors.As(err, &pqErr) {
		switch pqErr.Code {
		case "28P01", "28000": // invalid_password, invalid_authorization_specification
			return FailureAuthentication
		case "42501": // insufficient_privilege
			if strings.Contains(errStr, "schema") {
				return FailureSchemaPermission
			}
			return FailureDatabasePermission
		case "3D000": // invalid_catalog_name (database does not exist)
			return FailureDatabasePermission
		case "3F000": // invalid_schema_name
			return FailureSchemaMissing
		}
	}

	// 2. String-based fallback classifications
	if strings.Contains(errStr, "password authentication failed") ||
		strings.Contains(errStr, "sasl authentication failed") ||
		strings.Contains(errStr, "authentication failed") {
		return FailureAuthentication
	}

	if strings.Contains(errStr, "permission denied") || strings.Contains(errStr, "insufficient privilege") {
		if strings.Contains(errStr, "schema") {
			return FailureSchemaPermission
		}
		return FailureDatabasePermission
	}

	if strings.Contains(errStr, "no such host") ||
		strings.Contains(errStr, "dial tcp") ||
		strings.Contains(errStr, "connection refused") ||
		strings.Contains(errStr, "i/o timeout") ||
		strings.Contains(errStr, "network is unreachable") ||
		strings.Contains(errStr, "connection reset") {
		return FailureDNSNetwork
	}

	if strings.Contains(errStr, "parse") || strings.Contains(errStr, "invalid connection option") {
		return FailureURLParsing
	}

	return FailureUnknown
}

// verifyPostgresSchemaExists connects using lib/pq and runs step-by-step diagnostic verification.
// If authentication fails, it stops immediately and does not claim schema checks passed.
func verifyPostgresSchemaExists(dbURL, schema string) error {
	db, err := sql.Open("postgres", dbURL)
	if err != nil {
		category := ClassifyPostgresError(err)
		return fmt.Errorf("[%s] failed to open postgres handle: %w", category, err)
	}
	defer db.Close()

	// Step 1: Initial ping / authentication verification
	// We query current_user and current_database() to confirm authentication succeeded.
	var currentUser, currentDB string
	err = db.QueryRow("SELECT current_user, current_database()").Scan(&currentUser, &currentDB)
	if err != nil {
		category := ClassifyPostgresError(err)
		logging.Errorf("[DIAGNOSTIC FAILURE: %s] PostgreSQL authentication/connection failed: %v", category, err)
		if category == FailureAuthentication {
			logging.Errorf("CRITICAL AUTHENTICATION FAILURE: Password authentication failed for user. Stop: aborting schema verification.")
		}
		return fmt.Errorf("[%s] PostgreSQL initial connection failed: %w", category, err)
	}

	logging.Infof("[DIAGNOSTIC SUCCESS] PostgreSQL authenticated successfully. Authenticated user: '%s', Database: '%s'", currentUser, currentDB)

	// Step 2: Verify schema existence
	var schemaExists bool
	err = db.QueryRow("SELECT EXISTS(SELECT 1 FROM information_schema.schemata WHERE schema_name = $1)", schema).Scan(&schemaExists)
	if err != nil {
		category := ClassifyPostgresError(err)
		logging.Errorf("[DIAGNOSTIC FAILURE: %s] Failed to query schema existence: %v", category, err)
		return fmt.Errorf("[%s] failed to check schema existence: %w", category, err)
	}
	if !schemaExists {
		category := FailureSchemaMissing
		logging.Errorf("[DIAGNOSTIC FAILURE: %s] Schema '%s' does not exist in target database '%s'.", category, schema, currentDB)
		return fmt.Errorf("[%s] schema '%s' does not exist in target database. Please apply backend/scripts/whatsmeow_schema_migration_proposal.sql first", category, schema)
	}

	// Step 3: Verify schema USAGE and CREATE permissions for authenticated role
	var hasUsage, hasCreate bool
	err = db.QueryRow("SELECT has_schema_privilege(current_user, $1, 'USAGE'), has_schema_privilege(current_user, $1, 'CREATE')", schema).Scan(&hasUsage, &hasCreate)
	if err != nil {
		category := ClassifyPostgresError(err)
		logging.Errorf("[DIAGNOSTIC FAILURE: %s] Failed to query schema privileges: %v", category, err)
		return fmt.Errorf("[%s] failed to verify schema privileges: %w", category, err)
	}

	logging.Infof("[DIAGNOSTIC CHECK] Schema '%s' privilege verification for user '%s': USAGE=%t, CREATE=%t", schema, currentUser, hasUsage, hasCreate)

	if !hasUsage || !hasCreate {
		category := FailureSchemaPermission
		logging.Errorf("[DIAGNOSTIC FAILURE: %s] User '%s' lacks required privileges on schema '%s' (USAGE: %t, CREATE: %t).", category, currentUser, schema, hasUsage, hasCreate)
		return fmt.Errorf("[%s] user '%s' lacks required USAGE/CREATE privileges on schema '%s'", category, currentUser, schema)
	}

	logging.Infof("[DIAGNOSTIC SUCCESS] Pre-flight verification completed: Authenticated as '%s', schema '%s' exists with full USAGE and CREATE privileges.", currentUser, schema)
	return nil
}

// Close gracefully releases the database handles.
func (sm *StoreManager) Close() error {
	if sm.Container != nil {
		return sm.Container.Close()
	}
	return nil
}
