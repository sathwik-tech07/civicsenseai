# CivicSense AI — WhatsApp Gateway (Whatsmeow)

High-performance, zero-fee WhatsApp Web multi-device gateway service for CivicSense AI, replacing the Meta WhatsApp Cloud API with an open-source, self-hosted Go microservice powered by [whatsmeow](https://github.com/tulir/whatsmeow).

---

## Key Features

1. **Whatsmeow Multi-Device Integration**:
   - Native WhatsApp Web multi-device websocket protocol.
   - Zero Meta Cloud API fees, zero per-conversation pricing, no Meta business verification delays.
2. **Persistent Device Sessions**:
   - Pure Go SQLite storage (`modernc.org/sqlite`) without CGO dependencies.
   - Automatic re-connection upon network disruptions or service restarts.
3. **Internal Security & HMAC-SHA256**:
   - Inbound event deliveries to FastAPI (`POST /internal/whatsapp/events`) signed with HMAC-SHA256 and timestamp replay protection.
   - Outbound message dispatches authenticated with Bearer tokens matching `WHATSAPP_GATEWAY_SECRET`.
4. **Complete CivicSense AI Lifecycle**:
   - Citizen text complaint initiation and triage.
   - Multimodal photo reports with Gemini Vision and S3 storage.
   - GPS coordinate pin sharing and address resolution.
   - Field engineer command queue (`tasks`, `accept`, `start work`, `update`, `resolve`).
   - Executive summaries for municipal commissioners (`summary`).
   - Citizen feedback rating (`rate <ID> <1-5>`) and tracking (`track <ID>`).
5. **Admin Pairing & Management**:
   - In-app QR code pairing widget in the Commissioner / Admin frontend.
   - Telemetry reporting (uptime, RAM footprint, active goroutines, connection status).

---

## Architecture Overview

```
 [Citizen / WhatsApp App]
           │
           │ (WhatsApp Web Multi-Device WebSocket)
           ▼
 [WhatsApp Gateway (Go :8085)]
   ├── SQLite Session Store (whatsapp_gateway_sessions.db)
   ├── Inbound Deduplication & QR State
   │
   │ (HMAC-SHA256 Signed HTTP POST)
   ▼
 [FastAPI Backend (:8000)]
   ├── /internal/whatsapp/events
   ├── AgentRuntime & Gemini 2.5 Flash
   ├── 11-Stage Incident Lifecycle
   └── PostgreSQL / Supabase Storage
```

---

## Configuration Variables

| Variable | Default | Description |
|---|---|---|
| `PORT` | `8085` | Port on which the Go Gateway listens |
| `SESSION_DB_PATH` | `whatsapp_gateway_sessions.db` | Path to persistent SQLite session file |
| `FASTAPI_BACKEND_URL` | `http://localhost:8000` | URL of the CivicSense AI FastAPI backend |
| `WHATSAPP_GATEWAY_SECRET` | *(Required in Production)* | Cryptographically secure shared secret for HMAC-SHA256 and Bearer authentication |
| `LOG_LEVEL` | `INFO` | Log verbosity (`DEBUG`, `INFO`, `WARN`, `ERROR`) |
| `MAX_MEDIA_BYTES` | `10485760` (10 MB) | Maximum incoming/outgoing media size |

---

## API Endpoints

### Public Probes
- `GET /healthz` — Service health probe (returns HTTP 200 / 503)

### Authenticated Endpoints (Bearer or HMAC)
- `GET /api/v1/status` — Live telemetry (status, JID, uptime, memory)
- `GET /api/v1/qr` — Current QR pairing code and Base64 PNG
- `POST /api/v1/send` — Outbound message dispatch (`text`, `image`)
- `POST /api/v1/reconnect` — Trigger reconnection loop
- `POST /api/v1/disconnect` — Break active websocket
- `POST /api/v1/logout` — Unlink paired WhatsApp device

---

## Local Development & Running

### Build Native Binary (Windows/Linux/macOS)
```bash
cd whatsapp-gateway
go build -o whatsapp-gateway ./cmd/server
```

### Run Service
```bash
./whatsapp-gateway
```

### Run Tests
```bash
go test ./...
```
