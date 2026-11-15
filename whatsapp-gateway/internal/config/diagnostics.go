package config

import (
	"net/url"
	"strings"

	"civicsense/whatsapp-gateway/internal/logging"
)

// DBDiagnostics contains sanitized, safe telemetry for diagnosing database connectivity.
// It strictly excludes passwords, raw credentials, and sensitive connection strings.
type DBDiagnostics struct {
	Source                       string `json:"source"`
	ParsedSuccessfully           bool   `json:"parsed_successfully"`
	Scheme                       string `json:"scheme"`
	Hostname                     string `json:"hostname"`
	Port                         string `json:"port"`
	DatabaseName                 string `json:"database_name"`
	Username                     string `json:"username"`
	HasPassword                  bool   `json:"has_password"`
	HasLeadingTrailingWhitespace bool   `json:"has_leading_trailing_whitespace"`
	HasSurroundingQuotes         bool   `json:"has_surrounding_quotes"`
	SSLMode                      string `json:"sslmode"`
	SearchPath                   string `json:"search_path"`
}

// InspectDatabaseConfig analyzes raw environment variables and returns safe diagnostic metadata.
// It never leaks secrets, passwords, or the full connection URL.
func InspectDatabaseConfig(rawURL, sourceVar string) (DBDiagnostics, string) {
	diag := DBDiagnostics{
		Source: sourceVar,
	}

	if rawURL == "" {
		return diag, ""
	}

	// Detect whitespace and quoting anomalies
	trimmed := strings.TrimSpace(rawURL)
	if trimmed != rawURL {
		diag.HasLeadingTrailingWhitespace = true
	}

	cleanURL := trimmed
	if (strings.HasPrefix(cleanURL, "\"") && strings.HasSuffix(cleanURL, "\"")) ||
		(strings.HasPrefix(cleanURL, "'") && strings.HasSuffix(cleanURL, "'")) {
		diag.HasSurroundingQuotes = true
		cleanURL = strings.Trim(cleanURL, "\"'")
	}

	parsed, err := url.Parse(cleanURL)
	if err != nil {
		diag.ParsedSuccessfully = false
		return diag, cleanURL
	}

	diag.ParsedSuccessfully = true
	diag.Scheme = parsed.Scheme
	diag.Hostname = parsed.Hostname()
	diag.Port = parsed.Port()
	if diag.Port == "" && (parsed.Scheme == "postgres" || parsed.Scheme == "postgresql") {
		diag.Port = "5432"
	}
	diag.DatabaseName = strings.TrimPrefix(parsed.Path, "/")

	if parsed.User != nil {
		diag.Username = parsed.User.Username()
		_, diag.HasPassword = parsed.User.Password()
	}

	query := parsed.Query()
	diag.SSLMode = query.Get("sslmode")
	diag.SearchPath = query.Get("search_path")

	return diag, cleanURL
}

// LogSafeDiagnostics outputs structured diagnostic telemetry to the logger.
// It guarantees zero secrets or passwords appear in log output.
func LogSafeDiagnostics(diag DBDiagnostics) {
	logging.Infof("=== PostgreSQL Gateway Connection Diagnostics ===")
	logging.Infof("  Config Source: %s", diag.Source)
	logging.Infof("  URL Parsed Successfully: %t", diag.ParsedSuccessfully)
	logging.Infof("  Parsed Scheme: %s", diag.Scheme)
	logging.Infof("  Parsed Host: %s", diag.Hostname)
	logging.Infof("  Parsed Port: %s", diag.Port)
	logging.Infof("  Database Name: %s", diag.DatabaseName)
	logging.Infof("  Parsed Username: %s", diag.Username)
	logging.Infof("  Password Present: %t", diag.HasPassword)
	logging.Infof("  Unexpected Whitespace: %t", diag.HasLeadingTrailingWhitespace)
	logging.Infof("  Surrounding Quotes Detected: %t", diag.HasSurroundingQuotes)
	logging.Infof("  SSL Mode: %s", diag.SSLMode)
	logging.Infof("  Search Path: %s", diag.SearchPath)

	if diag.HasLeadingTrailingWhitespace || diag.HasSurroundingQuotes {
		logging.Warnf("  WARNING: Whitespace or quotes detected in %s. Automatically sanitized for connection.", diag.Source)
	}

	if strings.Contains(diag.Hostname, "pooler.supabase.com") {
		if !strings.Contains(diag.Username, ".") {
			logging.Warnf("  WARNING: Connecting to Supabase pooler, but username '%s' lacks tenant reference suffix (expected: <user>.<project_ref>).", diag.Username)
		}
	}
	logging.Infof("==================================================")
}
