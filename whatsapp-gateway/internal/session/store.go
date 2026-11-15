package session

import (
	"database/sql"
	"fmt"
	"os"
	"path/filepath"

	_ "github.com/lib/pq"
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

		container, err = sqlstore.New("postgres", cfg.DatabaseURL, waLogger)
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

		container, err = sqlstore.New("sqlite", dsn, waLogger)
		if err != nil {
			return nil, fmt.Errorf("failed to open sqlite session store: %w", err)
		}
	}

	if container == nil {
		return nil, fmt.Errorf("whatsmeow session container is nil after initialization")
	}

	// Retrieve first device or create a new one
	deviceStore, err := container.GetFirstDevice()
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

// verifyPostgresSchemaExists ensures that the target schema exists in PostgreSQL before sqlstore uses it.
func verifyPostgresSchemaExists(dbURL, schema string) error {
	db, err := sql.Open("postgres", dbURL)
	if err != nil {
		return fmt.Errorf("failed to connect to postgres: %w", err)
	}
	defer db.Close()

	var exists bool
	query := "SELECT EXISTS(SELECT 1 FROM information_schema.schemata WHERE schema_name = $1)"
	if err := db.QueryRow(query, schema).Scan(&exists); err != nil {
		return fmt.Errorf("failed to check schema existence: %w", err)
	}
	if !exists {
		return fmt.Errorf("schema '%s' does not exist in target database. Please apply backend/scripts/whatsmeow_schema_migration_proposal.sql first", schema)
	}
	return nil
}

// Close gracefully releases the database handles.
func (sm *StoreManager) Close() error {
	if sm.Container != nil {
		return sm.Container.Close()
	}
	return nil
}
