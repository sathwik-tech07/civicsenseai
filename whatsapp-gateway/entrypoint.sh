#!/bin/sh
set -e

# ==============================================================================
# CivicSense AI — WhatsApp Gateway Container Entrypoint
# Dynamically adjusts ownership of Render persistent disk mount before dropping
# root privileges to run as unprivileged 'appuser' (UID 10001).
# ==============================================================================

# Ensure /data exists and is owned by appuser
if [ -d "/data" ]; then
    chown -R appuser:appgroup /data 2>/dev/null || true
    chmod -R 700 /data 2>/dev/null || true
fi

# Drop root privileges and execute the main application binary
exec su-exec appuser "$@"
