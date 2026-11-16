# ==============================================================================
# CivicSense AI — WhatsApp Gateway (Whatsmeow) Multi-Stage Dockerfile
# ==============================================================================

# Stage 1: Builder (Go alpine with automatic toolchain switching enabled)
FROM golang:alpine AS builder
ENV GOTOOLCHAIN=auto

WORKDIR /app

# Install ca-certificates and git
RUN apk add --no-cache ca-certificates git

# Cache Go modules
COPY go.mod go.sum ./
RUN go mod download

# Copy source tree
COPY . .

# Build static executable (CGO disabled, stripped symbols)
RUN CGO_ENABLED=0 GOOS=linux go build -ldflags="-s -w" -o /whatsapp-gateway ./cmd/server

# Stage 2: Minimal Runtime
FROM alpine:3.20

# Install ca-certificates for outbound WhatsApp WebSocket TLS and su-exec for privilege drop
RUN apk add --no-cache ca-certificates tzdata su-exec

WORKDIR /app

# Create unprivileged user
RUN addgroup -S appgroup && adduser -S appuser -G appgroup

# Create directory for persistent SQLite session storage
RUN mkdir -p /data && chown -R appuser:appgroup /data

# Copy compiled binary from builder
COPY --from=builder /whatsapp-gateway /app/whatsapp-gateway

# Copy and configure entrypoint script to adjust Render volume permissions at runtime
COPY entrypoint.sh /app/entrypoint.sh
RUN chmod +x /app/entrypoint.sh

# Default runtime configuration
ENV PORT=8085
ENV SESSION_DB_PATH=/data/whatsapp_gateway_sessions.db
ENV FASTAPI_BACKEND_URL=http://backend:8000
ENV LOG_LEVEL=INFO

EXPOSE 8085

# Kubernetes / Container health probe
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:8085/healthz || exit 1

ENTRYPOINT ["/app/entrypoint.sh"]
CMD ["/app/whatsapp-gateway"]
