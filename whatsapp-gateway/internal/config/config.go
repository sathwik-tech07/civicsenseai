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
	if isRemoteCloud {
		if fastAPIURL == "" || fastAPIURL == "http://backend:8000" || fastAPIURL == "http://localhost:8000" || fastAPIURL == "http://127.0.0.1:8000" {
			targetEnv := "staging"
			if isProduction {
				targetEnv = "production"
			}
			panic(fmt.Sprintf("CRITICAL CONFIGURATION ERROR: FASTAPI_BACKEND_URL must be configured to the valid remote backend URL (e.g. https://civicsense-backend-staging.onrender.com) in %s environment. Local host %q is forbidden.", targetEnv, fastAPIURL))
		}
	} else if fastAPIURL == "" {
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
	var sourceVar string

	if gatewayDBURL != "" {
		sourceVar = "WHATSAPP_GATEWAY_DATABASE_URL"
		rawDBURL = gatewayDBURL
	} else if backendDBURL != "" {
		sourceVar = "DATABASE_URL"
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
	} else {
		sourceVar = "NONE"
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
		diag, cleanURL := InspectDatabaseConfig(rawDBURL, sourceVar)
		LogSafeDiagnostics(diag)

		normalizedURL, detectedDialect, err := ValidateAndNormalizeDatabaseURL(cleanURL, isRemoteCloud, schema)
		if err != nil {
			panic(fmt.Sprintf("CRITICAL DATABASE CONFIGURATION ERROR: %v", err))
		}
		validatedDBURL = normalizedURL
		dbDialect = detectedDialect
	} else if isRemoteCloud {
		targetEnv := "staging"
		if isProduction {
			targetEnv = "production"
		}
		panic(fmt.Sprintf("CRITICAL DATABASE CONFIGURATION ERROR: %s environment requires PostgreSQL persistence. Dedicated WHATSAPP_GATEWAY_DATABASE_URL must be configured. Silent fallback to SQLite is strictly forbidden.", strings.Title(targetEnv)))
	} else if dbDialect == "postgres" || dbDialect == "postgresql" {
		panic("CRITICAL DATABASE CONFIGURATION ERROR: DB_DIALECT is set to postgres but WHATSAPP_GATEWAY_DATABASE_URL is empty.")
	} else {
		// Safe local fallback to SQLite only permitted in non-cloud/development environments
		dbDialect = "sqlite"
	}

	if isRemoteCloud && (dbDialect == "sqlite" || strings.HasPrefix(rawDBURL, "sqlite:")) {
		targetEnv := "staging"
		if isProduction {
			targetEnv = "production"
		}
		panic(fmt.Sprintf("CRITICAL DATABASE CONFIGURATION ERROR: SQLite is strictly forbidden in %s environment due to ephemeral cloud container disks. PostgreSQL persistence with WHATSAPP_GATEWAY_DATABASE_URL is required.", targetEnv))
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
		return "", "", fmt.Errorf("failed to parse DATABASE_URL: invalid URL syntax")
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

// SafeRedactedDatabaseURL is returned as a fail-closed fallback when credentials may be
// present in a malformed connection string but cannot be safely extracted and redacted.
const SafeRedactedDatabaseURL = "[REDACTED_DATABASE_URL]"

var dsnKeyRegex = regexp.MustCompile(`(?i)(?:^|[\s;])(password|pwd)(\s*=\s*)`)
var queryPasswordRegex = regexp.MustCompile(`(?i)(\b(?:password|pwd)\s*=\s*)([^&#\s]+)`)
var credKeywordRegex = regexp.MustCompile(`(?i)\b(password|pwd|secret)\b`)

// maskDSNPassword masks passwords in key-value DSN connection strings (e.g. host=... password=...).
// It supports bare values, single-quoted values with libpq-standard backslash escapes (\', \\)
// and SQL standard double single-quotes (''), double-quoted values with backslash escapes (\", \\),
// special characters, spaces, and ensures unterminated quotes fail closed.
func maskDSNPassword(cleanURL string) (string, bool) {
	matches := dsnKeyRegex.FindAllStringSubmatchIndex(cleanURL, -1)
	if len(matches) == 0 {
		return cleanURL, false
	}

	var buf strings.Builder
	lastEnd := 0

	for _, m := range matches {
		if m[0] < lastEnd {
			continue
		}

		buf.WriteString(cleanURL[lastEnd:m[0]])
		buf.WriteString(cleanURL[m[0]:m[1]])
		buf.WriteString("*****")

		valStart := m[1]
		if valStart >= len(cleanURL) {
			lastEnd = valStart
			continue
		}

		firstChar := cleanURL[valStart]
		if firstChar == '\'' {
			i := valStart + 1
			closed := false
			for i < len(cleanURL) {
				if cleanURL[i] == '\\' {
					if i+1 >= len(cleanURL) {
						return SafeRedactedDatabaseURL, true
					}
					i += 2
				} else if cleanURL[i] == '\'' {
					if i+1 < len(cleanURL) && cleanURL[i+1] == '\'' {
						i += 2
					} else {
						i++
						closed = true
						break
					}
				} else {
					i++
				}
			}
			if !closed {
				return SafeRedactedDatabaseURL, true
			}
			lastEnd = i
		} else if firstChar == '"' {
			i := valStart + 1
			closed := false
			for i < len(cleanURL) {
				if cleanURL[i] == '\\' {
					if i+1 >= len(cleanURL) {
						return SafeRedactedDatabaseURL, true
					}
					i += 2
				} else if cleanURL[i] == '"' {
					if i+1 < len(cleanURL) && cleanURL[i+1] == '"' {
						i += 2
					} else {
						i++
						closed = true
						break
					}
				} else {
					i++
				}
			}
			if !closed {
				return SafeRedactedDatabaseURL, true
			}
			lastEnd = i
		} else {
			i := valStart
			for i < len(cleanURL) && cleanURL[i] != ' ' && cleanURL[i] != '\t' && cleanURL[i] != '\r' && cleanURL[i] != '\n' && cleanURL[i] != ';' {
				i++
			}
			lastEnd = i
		}
	}

	buf.WriteString(cleanURL[lastEnd:])
	return buf.String(), true
}

// hasURIScheme returns true if s begins with a valid RFC 3986 URI scheme followed by "://".
func hasURIScheme(s string) bool {
	idx := strings.Index(s, "://")
	if idx <= 0 {
		return false
	}
	scheme := s[:idx]
	for i, r := range scheme {
		if i == 0 {
			if (r < 'a' || r > 'z') && (r < 'A' || r > 'Z') {
				return false
			}
		} else {
			if (r < 'a' || r > 'z') && (r < 'A' || r > 'Z') && (r < '0' || r > '9') && r != '+' && r != '-' && r != '.' {
				return false
			}
		}
	}
	return true
}

// MaskDatabaseURL returns a safe, redacted version of a database connection URL.
// It guarantees the password is replaced with literal "*****" for human-readable logging
// without leaking sensitive credentials or exposing percent-encoded asterisks.
// It safely handles valid and malformed URLs, URLs with multiple @ signs, encoded passwords,
// slashes in passwords, unusual usernames, URLs without passwords, key-value DSNs, and URLs without schemes,
// while preserving paths, queries, and fragments.
//
// Fail-closed guarantee: If credentials may be present in a malformed string but cannot be
// safely and reliably redacted, it returns SafeRedactedDatabaseURL instead of leaking the raw input.
func MaskDatabaseURL(rawURL string) string {
	if rawURL == "" {
		return ""
	}

	cleanURL := strings.TrimSpace(rawURL)
	cleanURL = strings.Trim(cleanURL, "\"'")
	if cleanURL == "" {
		return ""
	}

	// 1. Key-value DSN format (e.g. host=... password=... or pwd=...)
	if !hasURIScheme(cleanURL) {
		if maskedDSN, ok := maskDSNPassword(cleanURL); ok {
			return maskedDSN
		}
	}

	// 2. Extract scheme if any (e.g. "postgresql://")
	scheme := ""
	rest := cleanURL
	if idx := strings.Index(cleanURL, "://"); idx != -1 {
		scheme = cleanURL[:idx+3]
		rest = cleanURL[idx+3:]
	}

	// Separate query and fragment if present to avoid matching '@' in query parameters or fragments
	queryAndFrag := ""
	qIdx := -1
	for _, sep := range []string{"?", "#"} {
		if pos := strings.Index(rest, sep); pos != -1 && (qIdx == -1 || pos < qIdx) {
			qIdx = pos
		}
	}
	if qIdx != -1 {
		queryAndFrag = rest[qIdx:]
		rest = rest[:qIdx]
		if queryPasswordRegex.MatchString(queryAndFrag) {
			queryAndFrag = queryPasswordRegex.ReplaceAllString(queryAndFrag, "${1}*****")
		}
	}

	// Look for the last '@' in rest (separating userinfo/credentials from host)
	if lastAt := strings.LastIndex(rest, "@"); lastAt != -1 {
		credPart := rest[:lastAt]
		hostPart := rest[lastAt+1:]

		// In credPart, is there a ':' separating username and password?
		if colonIdx := strings.Index(credPart, ":"); colonIdx != -1 {
			username := credPart[:colonIdx]

			// Validate username does not contain query/frag/control chars
			if strings.ContainsAny(username, "?# @") {
				return SafeRedactedDatabaseURL
			}

			// Validate host does not contain '@'
			if strings.Contains(hostPart, "@") {
				return SafeRedactedDatabaseURL
			}

			// Guard against host:port/path where path contains '@' (e.g. postgresql://host:5432/path@something)
			isHostPortPath := false
			slashIdx := strings.Index(credPart, "/")
			if slashIdx != -1 && slashIdx > colonIdx {
				candidatePort := credPart[colonIdx+1 : slashIdx]
				if isAllDigits(candidatePort) {
					isHostPortPath = true
				}
			}

			if isHostPortPath {
				// Valid URL with host:port and '@' inside database path, no credentials present
				return scheme + rest + queryAndFrag
			}

			// Valid credential extraction: mask password between colon and last '@' with literal '*****'
			return scheme + username + ":*****@" + hostPart + queryAndFrag
		} else {
			// '@' present without colon: username-only (no password to mask)
			if !strings.Contains(credPart, "/") {
				return scheme + credPart + "@" + hostPart + queryAndFrag
			}
		}
	}

	// 3. Valid URL without credentials and without '@' in authority
	if hasURIScheme(cleanURL) {
		afterScheme := cleanURL[strings.Index(cleanURL, "://")+3:]
		authority := afterScheme
		if pathIdx := strings.Index(afterScheme, "/"); pathIdx != -1 {
			authority = afterScheme[:pathIdx]
		}
		if qSep := strings.IndexAny(authority, "?#"); qSep != -1 {
			authority = authority[:qSep]
		}
		if !strings.Contains(authority, "@") && !strings.Contains(authority, " ") {
			if isValidHostPort(authority) {
				return scheme + rest + queryAndFrag
			} else {
				return SafeRedactedDatabaseURL
			}
		}
	}

	// 4. Fail-closed security guarantee:
	// If credentials might be present (contains '@' or password keywords)
	// but could not be safely extracted and redacted, NEVER leak the original input!
	if strings.Contains(cleanURL, "@") || credKeywordRegex.MatchString(cleanURL) {
		return SafeRedactedDatabaseURL
	}

	return cleanURL
}

func isValidHostPort(authority string) bool {
	if authority == "" {
		return false
	}
	if strings.HasPrefix(authority, "[") && strings.Contains(authority, "]") {
		closeBracket := strings.LastIndex(authority, "]")
		rest := authority[closeBracket+1:]
		if strings.HasPrefix(rest, ":") {
			return isAllDigits(rest[1:])
		}
		return rest == ""
	}
	if lastColon := strings.LastIndex(authority, ":"); lastColon != -1 {
		return isAllDigits(authority[lastColon+1:])
	}
	return true
}

func isAllDigits(s string) bool {
	if s == "" {
		return false
	}
	for _, r := range s {
		if r < '0' || r > '9' {
			return false
		}
	}
	return true
}
