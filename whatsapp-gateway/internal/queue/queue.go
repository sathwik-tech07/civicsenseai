package queue

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"math"
	"os"
	"path/filepath"
	"sync"
	"time"

	_ "github.com/lib/pq"
	_ "modernc.org/sqlite"

	"civicsense/whatsapp-gateway/internal/config"
	"civicsense/whatsapp-gateway/internal/events"
	"civicsense/whatsapp-gateway/internal/logging"
)

// QueuedEvent represents an inbound event persisted in the durable queue.
type QueuedEvent struct {
	EventID     string
	EventType   string
	Payload     []byte
	Status      string
	Attempts    int
	NextRetryAt int64
	LastError   string
	CreatedAt   int64
	UpdatedAt   int64
}

// QueueStore manages persistence for durable event processing and deduplication.
type QueueStore struct {
	db      *sql.DB
	dialect string
	schema  string
	dbPath  string
	ttl     time.Duration

	cacheMu sync.RWMutex
	cache   map[string]time.Time
}

// NewQueueStoreFromPath is a convenience constructor for SQLite storage (e.g. tests and standalone local tools).
func NewQueueStoreFromPath(dbPath string, ttl time.Duration) (*QueueStore, error) {
	return NewQueueStore(&config.Config{
		DBDialect: "sqlite",
		DBPath:    dbPath,
	}, ttl)
}

// NewQueueStore creates or connects to the queue store (PostgreSQL or SQLite).
func NewQueueStore(cfg *config.Config, ttl time.Duration) (*QueueStore, error) {
	if cfg == nil {
		cfg = &config.Config{
			DBDialect: "sqlite",
			DBPath:    "whatsapp_gateway_sessions.db",
		}
	}
	if ttl <= 0 {
		ttl = 24 * time.Hour
	}

	var db *sql.DB
	var err error

	if cfg.DBDialect == "postgres" {
		logging.Infof("Initializing durable PostgreSQL event queue with schema '%s'", cfg.DBSchema)
		db, err = sql.Open("postgres", cfg.DatabaseURL)
		if err != nil {
			return nil, fmt.Errorf("failed to open postgres database for queue: %w", err)
		}
		// Managed connection pool for PostgreSQL
		db.SetMaxOpenConns(10)
		db.SetMaxIdleConns(5)
		db.SetConnMaxLifetime(10 * time.Minute)
	} else {
		// SQLite Mode
		dir := filepath.Dir(cfg.DBPath)
		if dir != "" && dir != "." {
			if err := os.MkdirAll(dir, 0700); err != nil {
				return nil, fmt.Errorf("failed to create directory for queue store: %w", err)
			}
		}

		dsn := fmt.Sprintf("file:%s?_pragma=foreign_keys(1)&_pragma=busy_timeout(10000)&_pragma=journal_mode(WAL)", cfg.DBPath)
		logging.Infof("Initializing durable SQLite event queue at: %s", cfg.DBPath)
		db, err = sql.Open("sqlite", dsn)
		if err != nil {
			return nil, fmt.Errorf("failed to open sqlite database for queue: %w", err)
		}
		db.SetMaxOpenConns(1) // Single writer in WAL mode avoids lock contention
	}

	qs := &QueueStore{
		db:      db,
		dialect: cfg.DBDialect,
		schema:  cfg.DBSchema,
		dbPath:  cfg.DBPath,
		ttl:     ttl,
		cache:   make(map[string]time.Time),
	}

	if err := qs.initSchema(); err != nil {
		db.Close()
		return nil, fmt.Errorf("failed to initialize queue schema: %w", err)
	}

	// Warm in-memory cache with non-expired processed messages
	if err := qs.loadProcessedCache(); err != nil {
		logging.Warnf("Could not warm message deduplication cache from store: %v", err)
	}

	return qs, nil
}

// tableName returns the schema-qualified table name for PostgreSQL, or bare name for SQLite.
func (qs *QueueStore) tableName(tbl string) string {
	if qs.dialect == "postgres" && qs.schema != "" {
		return fmt.Sprintf("%s.%s", qs.schema, tbl)
	}
	return tbl
}

func (qs *QueueStore) initSchema() error {
	if qs.dialect == "postgres" {
		// Fail-closed safety check: ensure the dedicated schema exists
		var exists bool
		query := "SELECT EXISTS(SELECT 1 FROM information_schema.schemata WHERE schema_name = $1)"
		if err := qs.db.QueryRow(query, qs.schema).Scan(&exists); err != nil {
			return fmt.Errorf("failed to check schema existence: %w", err)
		}
		if !exists {
			return fmt.Errorf("schema '%s' does not exist in target database. Please apply backend/scripts/whatsmeow_schema_migration_proposal.sql first", qs.schema)
		}

		// PostgreSQL DDL with explicit schema qualification
		schemaDDL := fmt.Sprintf(`
		CREATE TABLE IF NOT EXISTS %s (
			message_id VARCHAR(128) PRIMARY KEY,
			sender VARCHAR(64) NOT NULL,
			received_at BIGINT NOT NULL,
			expires_at BIGINT NOT NULL
		);
		CREATE INDEX IF NOT EXISTS idx_processed_messages_expires ON %s(expires_at);

		CREATE TABLE IF NOT EXISTS %s (
			event_id VARCHAR(128) PRIMARY KEY,
			event_type VARCHAR(64) NOT NULL,
			payload TEXT NOT NULL,
			status VARCHAR(32) NOT NULL DEFAULT 'pending',
			attempts INTEGER NOT NULL DEFAULT 0,
			next_retry_at BIGINT NOT NULL,
			last_error TEXT,
			created_at BIGINT NOT NULL,
			updated_at BIGINT NOT NULL
		);
		CREATE INDEX IF NOT EXISTS idx_inbound_queue_retry ON %s(status, next_retry_at);
		`, qs.tableName("processed_messages"), qs.tableName("processed_messages"),
			qs.tableName("inbound_events_queue"), qs.tableName("inbound_events_queue"))

		_, err := qs.db.Exec(schemaDDL)
		return err
	}

	// SQLite DDL
	schema := `
	CREATE TABLE IF NOT EXISTS processed_messages (
		message_id TEXT PRIMARY KEY,
		sender TEXT,
		received_at INTEGER NOT NULL,
		expires_at INTEGER NOT NULL
	);
	CREATE INDEX IF NOT EXISTS idx_processed_messages_expires ON processed_messages(expires_at);

	CREATE TABLE IF NOT EXISTS inbound_events_queue (
		event_id TEXT PRIMARY KEY,
		event_type TEXT NOT NULL,
		payload TEXT NOT NULL,
		status TEXT NOT NULL,
		attempts INTEGER NOT NULL DEFAULT 0,
		next_retry_at INTEGER NOT NULL,
		last_error TEXT,
		created_at INTEGER NOT NULL,
		updated_at INTEGER NOT NULL
	);
	CREATE INDEX IF NOT EXISTS idx_inbound_queue_retry ON inbound_events_queue(status, next_retry_at);
	`
	_, err := qs.db.Exec(schema)
	return err
}

func (qs *QueueStore) loadProcessedCache() error {
	now := time.Now().Unix()
	var query string
	if qs.dialect == "postgres" {
		query = fmt.Sprintf("SELECT message_id, expires_at FROM %s WHERE expires_at > $1", qs.tableName("processed_messages"))
	} else {
		query = fmt.Sprintf("SELECT message_id, expires_at FROM %s WHERE expires_at > ?", qs.tableName("processed_messages"))
	}

	rows, err := qs.db.Query(query, now)
	if err != nil {
		return err
	}
	defer rows.Close()

	qs.cacheMu.Lock()
	defer qs.cacheMu.Unlock()

	count := 0
	for rows.Next() {
		var id string
		var exp int64
		if err := rows.Scan(&id, &exp); err == nil {
			qs.cache[id] = time.Unix(exp, 0)
			count++
		}
	}
	logging.Infof("Warmed message deduplication cache with %d active message IDs from %s", count, qs.dialect)
	return nil
}

// IsDuplicate checks both the memory cache and durable store.
func (qs *QueueStore) IsDuplicate(messageID string) bool {
	if messageID == "" {
		return false
	}

	now := time.Now()

	// 1. Check in-memory cache
	qs.cacheMu.RLock()
	exp, exists := qs.cache[messageID]
	qs.cacheMu.RUnlock()

	if exists && now.Before(exp) {
		return true
	}

	// 2. Fall back to durable store
	var query string
	if qs.dialect == "postgres" {
		query = fmt.Sprintf("SELECT COUNT(1) FROM %s WHERE message_id = $1 AND expires_at > $2", qs.tableName("processed_messages"))
	} else {
		query = fmt.Sprintf("SELECT COUNT(1) FROM %s WHERE message_id = ? AND expires_at > ?", qs.tableName("processed_messages"))
	}

	var count int
	err := qs.db.QueryRow(query, messageID, now.Unix()).Scan(&count)
	if err == nil && count > 0 {
		qs.cacheMu.Lock()
		qs.cache[messageID] = now.Add(qs.ttl)
		qs.cacheMu.Unlock()
		return true
	}

	return false
}

// MarkProcessed records a message ID as processed in both the database and memory.
func (qs *QueueStore) MarkProcessed(messageID, sender string) error {
	if messageID == "" {
		return nil
	}

	now := time.Now()
	expiresAt := now.Add(qs.ttl)

	var err error
	if qs.dialect == "postgres" {
		query := fmt.Sprintf(`
			INSERT INTO %s (message_id, sender, received_at, expires_at)
			VALUES ($1, $2, $3, $4)
			ON CONFLICT (message_id) DO UPDATE SET 
				sender = EXCLUDED.sender, 
				received_at = EXCLUDED.received_at, 
				expires_at = EXCLUDED.expires_at`, qs.tableName("processed_messages"))
		_, err = qs.db.Exec(query, messageID, sender, now.Unix(), expiresAt.Unix())
	} else {
		query := fmt.Sprintf(`
			INSERT OR REPLACE INTO %s (message_id, sender, received_at, expires_at)
			VALUES (?, ?, ?, ?)`, qs.tableName("processed_messages"))
		_, err = qs.db.Exec(query, messageID, sender, now.Unix(), expiresAt.Unix())
	}

	if err != nil {
		return fmt.Errorf("failed to persist processed message in %s: %w", qs.dialect, err)
	}

	qs.cacheMu.Lock()
	qs.cache[messageID] = expiresAt
	qs.cacheMu.Unlock()

	return nil
}

// EnqueueEvent durably persists an inbound event into the queue with status 'pending'.
func (qs *QueueStore) EnqueueEvent(evt *events.InboundEvent) error {
	payload, err := json.Marshal(evt)
	if err != nil {
		return fmt.Errorf("failed to marshal inbound event for queue: %w", err)
	}

	now := time.Now().Unix()

	if qs.dialect == "postgres" {
		query := fmt.Sprintf(`
			INSERT INTO %s (event_id, event_type, payload, status, attempts, next_retry_at, created_at, updated_at)
			VALUES ($1, $2, $3, 'pending', 0, $4, $5, $6)
			ON CONFLICT (event_id) DO UPDATE SET 
				payload = EXCLUDED.payload, 
				status = 'pending', 
				attempts = 0, 
				next_retry_at = EXCLUDED.next_retry_at, 
				updated_at = EXCLUDED.updated_at`, qs.tableName("inbound_events_queue"))
		_, err = qs.db.Exec(query, evt.EventID, string(evt.EventType), string(payload), now, now, now)
	} else {
		query := fmt.Sprintf(`
			INSERT OR REPLACE INTO %s 
			(event_id, event_type, payload, status, attempts, next_retry_at, created_at, updated_at)
			VALUES (?, ?, ?, 'pending', 0, ?, ?, ?)`, qs.tableName("inbound_events_queue"))
		_, err = qs.db.Exec(query, evt.EventID, string(evt.EventType), string(payload), now, now, now)
	}

	if err != nil {
		return fmt.Errorf("failed to enqueue event into %s: %w", qs.dialect, err)
	}
	return nil
}

// MarkAcknowledged updates the queued event status to 'acknowledged'.
func (qs *QueueStore) MarkAcknowledged(eventID string) error {
	now := time.Now().Unix()
	var query string
	if qs.dialect == "postgres" {
		query = fmt.Sprintf("UPDATE %s SET status = 'acknowledged', updated_at = $1 WHERE event_id = $2", qs.tableName("inbound_events_queue"))
	} else {
		query = fmt.Sprintf("UPDATE %s SET status = 'acknowledged', updated_at = ? WHERE event_id = ?", qs.tableName("inbound_events_queue"))
	}
	_, err := qs.db.Exec(query, now, eventID)
	return err
}

// MarkFailed updates the queued event status to 'failed' (non-retriable).
func (qs *QueueStore) MarkFailed(eventID string, reason string) error {
	now := time.Now().Unix()
	var query string
	if qs.dialect == "postgres" {
		query = fmt.Sprintf("UPDATE %s SET status = 'failed', last_error = $1, updated_at = $2 WHERE event_id = $3", qs.tableName("inbound_events_queue"))
	} else {
		query = fmt.Sprintf("UPDATE %s SET status = 'failed', last_error = ?, updated_at = ? WHERE event_id = ?", qs.tableName("inbound_events_queue"))
	}
	_, err := qs.db.Exec(query, reason, now, eventID)
	return err
}

// RecordRetry calculates bounded exponential backoff and updates the retry schedule.
func (qs *QueueStore) RecordRetry(eventID string, attempts int, lastErr string) error {
	now := time.Now()
	backoff := CalculateBackoff(attempts)
	nextRetryAt := now.Add(backoff).Unix()

	status := "pending"
	if attempts >= 5 {
		status = "failed" // Bounded: after 5 attempts without success, mark failed
		logging.Errorf("Event %s failed after maximum retry attempts (5): %s", eventID, lastErr)
	}

	var query string
	if qs.dialect == "postgres" {
		query = fmt.Sprintf(`
			UPDATE %s 
			SET attempts = $1, next_retry_at = $2, status = $3, last_error = $4, updated_at = $5 
			WHERE event_id = $6`, qs.tableName("inbound_events_queue"))
		_, err := qs.db.Exec(query, attempts, nextRetryAt, status, lastErr, now.Unix(), eventID)
		return err
	}

	query = fmt.Sprintf(`
		UPDATE %s 
		SET attempts = ?, next_retry_at = ?, status = ?, last_error = ?, updated_at = ? 
		WHERE event_id = ?`, qs.tableName("inbound_events_queue"))
	_, err := qs.db.Exec(query, attempts, nextRetryAt, status, lastErr, now.Unix(), eventID)
	return err
}

// GetPendingEvents retrieves events ready for processing or retry.
func (qs *QueueStore) GetPendingEvents(limit int) ([]*QueuedEvent, error) {
	now := time.Now().Unix()
	var query string
	if qs.dialect == "postgres" {
		query = fmt.Sprintf(`
			SELECT event_id, event_type, payload, status, attempts, next_retry_at, COALESCE(last_error, ''), created_at, updated_at
			FROM %s
			WHERE status = 'pending' AND next_retry_at <= $1
			ORDER BY created_at ASC
			LIMIT $2`, qs.tableName("inbound_events_queue"))
	} else {
		query = fmt.Sprintf(`
			SELECT event_id, event_type, payload, status, attempts, next_retry_at, COALESCE(last_error, ''), created_at, updated_at
			FROM %s
			WHERE status = 'pending' AND next_retry_at <= ?
			ORDER BY created_at ASC
			LIMIT ?`, qs.tableName("inbound_events_queue"))
	}

	rows, err := qs.db.Query(query, now, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var eventsList []*QueuedEvent
	for rows.Next() {
		var qe QueuedEvent
		var payloadStr string
		err := rows.Scan(
			&qe.EventID,
			&qe.EventType,
			&payloadStr,
			&qe.Status,
			&qe.Attempts,
			&qe.NextRetryAt,
			&qe.LastError,
			&qe.CreatedAt,
			&qe.UpdatedAt,
		)
		if err == nil {
			qe.Payload = []byte(payloadStr)
			eventsList = append(eventsList, &qe)
		}
	}
	return eventsList, nil
}

// QueueStats provides metrics on event queue depth.
type QueueStats struct {
	PendingCount int `json:"pending_count"`
	FailedCount  int `json:"failed_count"`
	AckedCount   int `json:"acknowledged_count"`
}

// GetStats returns current counts of pending, failed, and acknowledged queue items.
func (qs *QueueStore) GetStats() (QueueStats, error) {
	var stats QueueStats
	query := fmt.Sprintf(`
		SELECT 
			COALESCE(SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END), 0),
			COALESCE(SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END), 0),
			COALESCE(SUM(CASE WHEN status = 'acknowledged' THEN 1 ELSE 0 END), 0)
		FROM %s
	`, qs.tableName("inbound_events_queue"))

	row := qs.db.QueryRow(query)
	err := row.Scan(&stats.PendingCount, &stats.FailedCount, &stats.AckedCount)
	return stats, err
}

// GetFailedEvents retrieves permanent failures for administrative review.
func (qs *QueueStore) GetFailedEvents(limit int) ([]*QueuedEvent, error) {
	var query string
	if qs.dialect == "postgres" {
		query = fmt.Sprintf(`
			SELECT event_id, event_type, payload, status, attempts, next_retry_at, COALESCE(last_error, ''), created_at, updated_at
			FROM %s
			WHERE status = 'failed'
			ORDER BY updated_at DESC
			LIMIT $1`, qs.tableName("inbound_events_queue"))
	} else {
		query = fmt.Sprintf(`
			SELECT event_id, event_type, payload, status, attempts, next_retry_at, COALESCE(last_error, ''), created_at, updated_at
			FROM %s
			WHERE status = 'failed'
			ORDER BY updated_at DESC
			LIMIT ?`, qs.tableName("inbound_events_queue"))
	}

	rows, err := qs.db.Query(query, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var eventsList []*QueuedEvent
	for rows.Next() {
		var qe QueuedEvent
		var payloadStr string
		err := rows.Scan(
			&qe.EventID,
			&qe.EventType,
			&payloadStr,
			&qe.Status,
			&qe.Attempts,
			&qe.NextRetryAt,
			&qe.LastError,
			&qe.CreatedAt,
			&qe.UpdatedAt,
		)
		if err == nil {
			qe.Payload = []byte(payloadStr)
			eventsList = append(eventsList, &qe)
		}
	}
	return eventsList, nil
}

// CalculateBackoff returns bounded exponential backoff: 500ms * 2^(attempts-1), capped at 10s.
func CalculateBackoff(attempts int) time.Duration {
	if attempts <= 0 {
		return 500 * time.Millisecond
	}
	base := 500 * time.Millisecond
	factor := math.Pow(2, float64(attempts-1))
	backoff := time.Duration(float64(base) * factor)
	maxBackoff := 10 * time.Second
	if backoff > maxBackoff {
		return maxBackoff
	}
	return backoff
}

// StartRetryWorker runs a background loop to process pending unacknowledged events.
func (qs *QueueStore) StartRetryWorker(ctx context.Context, dispatcher *events.Dispatcher, interval time.Duration) {
	ticker := time.NewTicker(interval)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			pending, err := qs.GetPendingEvents(10)
			if err != nil || len(pending) == 0 {
				continue
			}

			for _, qe := range pending {
				var evt events.InboundEvent
				if err := json.Unmarshal(qe.Payload, &evt); err != nil {
					_ = qs.MarkFailed(qe.EventID, fmt.Sprintf("corrupt payload: %v", err))
					continue
				}

				dispatchCtx, cancel := context.WithTimeout(ctx, 30*time.Second)
				err := dispatcher.DispatchEvent(dispatchCtx, &evt)
				cancel()

				if err == nil {
					_ = qs.MarkAcknowledged(qe.EventID)
					if evt.Message != nil {
						_ = qs.MarkProcessed(evt.Message.ID, evt.Message.From)
					}
					logging.Infof("Successfully delivered previously pending event %s on retry (attempt %d)", qe.EventID, qe.Attempts+1)
				} else {
					_ = qs.RecordRetry(qe.EventID, qe.Attempts+1, err.Error())
				}
			}
		}
	}
}

// Close gracefully closes the database connection.
func (qs *QueueStore) Close() error {
	if qs.db != nil {
		return qs.db.Close()
	}
	return nil
}
