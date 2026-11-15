package logging

import (
	"testing"
)

func TestSetLevel(t *testing.T) {
	SetLevel("DEBUG")
	if GetLevel() != LevelDebug {
		t.Errorf("expected LevelDebug, got %v", GetLevel())
	}

	SetLevel("WARN")
	if GetLevel() != LevelWarn {
		t.Errorf("expected LevelWarn, got %v", GetLevel())
	}

	SetLevel("ERROR")
	if GetLevel() != LevelError {
		t.Errorf("expected LevelError, got %v", GetLevel())
	}

	SetLevel("INFO")
	if GetLevel() != LevelInfo {
		t.Errorf("expected LevelInfo, got %v", GetLevel())
	}
}
