package logging

import (
	"fmt"
	"io"
	"log"
	"os"
	"strings"
	"sync"
	"time"
)

type Level int

const (
	LevelDebug Level = iota
	LevelInfo
	LevelWarn
	LevelError
)

type Logger struct {
	mu     sync.Mutex
	level  Level
	out    io.Writer
	prefix string
}

var defaultLogger = &Logger{
	level:  LevelInfo,
	out:    os.Stdout,
	prefix: "[WA-Gateway]",
}

func SetLevel(levelStr string) {
	defaultLogger.mu.Lock()
	defer defaultLogger.mu.Unlock()
	switch strings.ToUpper(levelStr) {
	case "DEBUG":
		defaultLogger.level = LevelDebug
	case "INFO":
		defaultLogger.level = LevelInfo
	case "WARN", "WARNING":
		defaultLogger.level = LevelWarn
	case "ERROR":
		defaultLogger.level = LevelError
	default:
		defaultLogger.level = LevelInfo
	}
}

func GetLevel() Level {
	defaultLogger.mu.Lock()
	defer defaultLogger.mu.Unlock()
	return defaultLogger.level
}

func (l *Logger) logf(level Level, levelStr, format string, v ...interface{}) {
	if level < l.level {
		return
	}
	l.mu.Lock()
	defer l.mu.Unlock()

	ts := time.Now().UTC().Format(time.RFC3339)
	msg := fmt.Sprintf(format, v...)
	fmt.Fprintf(l.out, "%s %s [%s] %s\n", ts, l.prefix, levelStr, msg)
}

func Debugf(format string, v ...interface{}) {
	defaultLogger.logf(LevelDebug, "DEBUG", format, v...)
}

func Infof(format string, v ...interface{}) {
	defaultLogger.logf(LevelInfo, "INFO", format, v...)
}

func Warnf(format string, v ...interface{}) {
	defaultLogger.logf(LevelWarn, "WARN", format, v...)
}

func Errorf(format string, v ...interface{}) {
	defaultLogger.logf(LevelError, "ERROR", format, v...)
}

func Fatalf(format string, v ...interface{}) {
	defaultLogger.logf(LevelError, "FATAL", format, v...)
	log.Fatalf(format, v...)
}
