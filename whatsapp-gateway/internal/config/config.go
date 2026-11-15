package config

import (
	"fmt"
	"net/url"
	"os"
	"regexp"
	"strconv"
	"strings"
)

const (
	// ProductionSupabaseRef is the production Supabase project reference that must NEVER be accessed.
	ProductionSupabaseRef = "bcpgsvvjuxzowxqqmouk"
	// StagingSupabaseRef is the staging Supabase project reference.
	StagingSupabaseRef = "oayzaszhhpfjlpmaezmc"
	// DefaultPostgresSchema is the dedicated isolated schema for WhatsMeow tables.
	DefaultPostgresSchema = "whatsmeow"
)

// Config holds runtime configuration for the WhatsApp Gateway service.
type Config struct {
	Port           int    `json:"port"`
	DBDialect      string `json:"db_dialect"`       // "sqlite" or "postgres"
	DBPath         string `json:"db_path"`          // SQLite file path (for sqlite dialect)
	DatabaseURL    string `json:"-"`                // PostgreSQL DSN (masked in JSON)
	DBSchema       string `json:"db_schema"`        // PostgreSQL schema ("whatsmeow")
	FastAPIURL     string `json:"fastapi_url"`
	GatewaySecret  string `json:"-"`
	LogLevel       string `json:"log_level"`
	MaxMediaBytes  int64  `json:"max_media_bytes"`
	AutoReconnect  bool   `json:"auto_reconnect"`
	EnableQRServer bool   `json:"enable_qr_server"`
}

// Load reads configuration from environment variables with safe defaults.
func Load() *Config {
	port := 8085
	if pStr := os.Getenv("PORT"); pStr != "" {
		if p, err := strconv.Atoi(pStr); err == nil && p > 0 {
			port = p
		}
	} else if pStr := os.Getenv("GATEWAY_PORT"); pStr != "" {
		if p, err := strconv.Atoi(pStr); err == nil && p > 0 {
			port = p
		}
	}

	envMode := strings.ToLower(os.Getenv("ENVIRONMENT"))
	if envMode == "" {
		envMode = strings.ToLower(os.Getenv("ENV"))
	}
	isStaging := envMode == "staging"
	isProduction := envMode == "production" || envMode == "prod"
	isRemoteCloud := isStaging || isProduction

	secret := os.Getenv("WHATSAPP_GATEWAY_SECRET")
	if isRemoteCloud {
		if secret == "" || secret == "civicsense-wa-gateway-internal-secret-2026" || secret == "secret" || secret == "changeme" {
			panic("CRITICAL SECURITY ERROR: A cryptographically secure WHATSAPP_GATEWAY_SECRET is required in production/staging environment.")
		}
	} else if secret == "" {
		// Default dev secret only permitted in non-production environments
		secret = "civicsense-wa-gateway-internal-secret-2026"
	}

	fastAPIURL := os.Getenv("FASTAPI_BACKEND_URL")
	if fastAPIURL == "" {
		fastAPIURL = "http://localhost:8000"
	}

	logLevel := os.Getenv("LOG_LEVEL")
	if logLevel == "" {
		logLevel = "INFO"
	}

	maxMediaBytes := int64(10 * 1024 * 1024) // 10MB default
	if mStr := os.Getenv("MAX_MEDIA_BYTES"); mStr != "" {
		if m, err := strconv.ParseInt(mStr, 10, 64); err == nil && m > 0 {
			maxMediaBytes = m
		}
	}

	// Database Dialect & URL Configuration
	// Prioritizes dedicated WHATSAPP_GATEWAY_DATABASE_URL to keep gateway credentials separate from backend DATABASE_URL
	dbDialect := strings.ToLower(os.Getenv("DB_DIALECT"))
	gatewayDBURL := os.Getenv("WHATSAPP_GATEWAY_DATABASE_URL")
	backendDBURL := os.Getenv("DATABASE_URL")

	var rawDBURL string
	if gatewayDBURL != "" {
		rawDBURL = gatewayDBURL
	} else if backendDBURL != "" {
		// Strict Security Enforcement: Never silently fall back to backend's privileged DATABASE_URL
		// in staging or production environments when using PostgreSQL mode.
		isPostgresMode := dbDialect == "postgres" || dbDialect == "postgresql" || strings.HasPrefix(backendDBURL, "postgres://") || strings.HasPrefix(backendDBURL, "postgresql://")
		if isRemoteCloud && isPostgresMode {
			allowPrivilegedFallback := strings.ToLower(os.Getenv("ALLOW_PRIVILEGED_DATABASE_FALLBACK")) == "true"
			if !allowPrivilegedFallback {
				targetEnv := "staging"
				if isProduction {
					targetEnv = "production"
				}
				panic(fmt.Sprintf("CRITICAL SECURITY ERROR: Dedicated WHATSAPP_GATEWAY_DATABASE_URL is required in %s environment for PostgreSQL mode. Silent fallback to backend's privileged DATABASE_URL is strictly forbidden.", targetEnv))
			}
		}
		rawDBURL = backendDBURL
	}
	dbPath := os.Getenv("SESSION_DB_PATH")
	if dbPath == "" {
		dbPath = "whatsapp_gateway_sessions.db"
	}

	schema := os.Getenv("DB_SCHEMA")
	if schema == "" {
		schema = DefaultPostgresSchema
	}

	var validatedDBURL string
	if rawDBURL != "" {
		normalizedURL, detectedDialect, err := ValidateAndNormalizeDatabaseURL(rawDBURL, isRemoteCloud, schema)
		if err != nil {
			panic(fmt.Sprintf("CRITICAL DATABASE CONFIGURATION ERROR: %v", err))
		}
		validatedDBURL = normalizedURL
		dbDialect = detectedDialect
	} else if dbDialect == "postgres" || dbDialect == "postgresql" {
		panic("CRITICAL DATABASE CONFIGURATION ERROR: DB_DIALECT is set to postgres but WHATSAPP_GATEWAY_DATABASE_URL is empty.")
	} else {
		// Safe local fallback to SQLite
		dbDialect = "sqlite"
	}

	return &Config{
		Port:           port,
		DBDialect:      dbDialect,
		DBPath:         dbPath,
		DatabaseURL:    validatedDBURL,
		DBSchema:       schema,
		FastAPIURL:     fastAPIURL,
		GatewaySecret:  secret,
		LogLevel:       logLevel,
		MaxMediaBytes:  maxMediaBytes,
		AutoReconnect:  true,
		EnableQRServer: true,
	}
}

// ValidateAndNormalizeDatabaseURL checks database URL safety, dialect, port, and schema parameters.
func ValidateAndNormalizeDatabaseURL(rawURL string, isProduction bool, schema string) (string, string, error) {
	if rawURL == "" {
		return "", "", fmt.Errorf("database URL cannot be empty")
	}

	// 1. Strict safety check: Never permit connection to production Supabase project
	if strings.Contains(rawURL, ProductionSupabaseRef) {
		return "", "", fmt.Errorf("FATAL SAFETY VIOLATION: Production database reference '%s' is strictly forbidden in staging gateway", ProductionSupabaseRef)
	}

	// 2. Parse URL
	parsed, err := url.Parse(rawURL)
	if err != nil {
		return "", "", fmt.Errorf("failed to parse DATABASE_URL: %w", err)
	}

	scheme := strings.ToLower(parsed.Scheme)
	if scheme != "postgres" && scheme != "postgresql" && scheme != "sqlite" {
		return "", "", fmt.Errorf("unsupported database scheme: %s (must be postgres or sqlite)", scheme)
	}

	if scheme == "sqlite" {
		return rawURL, "sqlite", nil
	}

	// 3. Supabase pooler port validation
	port := parsed.Port()
	if port == "6543" {
		return "", "", fmt.Errorf("Supavisor transaction pooler port 6543 is NOT supported by WhatsMeow sqlstore. Connect via session pooler port 5432")
	}

	// 4. Query parameter normalization
	query := parsed.Query()

	// Enforce SSL for remote connections
	sslmode := query.Get("sslmode")
	if sslmode == "" || sslmode == "disable" {
		query.Set("sslmode", "require")
	}

	// Enforce dedicated schema search_path
	if schema == "" {
		schema = DefaultPostgresSchema
	}
	searchPath := query.Get("search_path")
	if searchPath == "" {
		query.Set("search_path", fmt.Sprintf("%s,public", schema))
	} else if !strings.Contains(searchPath, schema) {
		query.Set("search_path", fmt.Sprintf("%s,%s", schema, searchPath))
	}

	parsed.RawQuery = query.Encode()
	return parsed.String(), "postgres", nil
}

// MaskDatabaseURL returns a safe, redacted version of a database connection URL.
func MaskDatabaseURL(rawURL string) string {
	if rawURL == "" {
		return ""
	}
	parsed, err := url.Parse(rawURL)
	if err != nil {
		// Fall back to regex masking if parsing fails
		re := regexp.MustCompile(`://([^:]+):([^@]+)@`)
		return re.ReplaceAllString(rawURL, "://${1}:*****@")
	}
	if parsed.User != nil {
		username := parsed.User.Username()
		parsed.User = url.UserPassword(username, "*****")
	}
	return parsed.String()
}
