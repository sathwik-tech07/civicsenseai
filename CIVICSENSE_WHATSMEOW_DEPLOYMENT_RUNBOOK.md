# CivicSense AI — WhatsMeow Staging Deployment Runbook

This runbook outlines the operational deployment and maintenance procedures for the CivicSense AI WhatsMeow WhatsApp integration on the **₹0/month Staging Infrastructure** (Supabase Free in Tokyo + Render Free in Singapore + Vercel Preview).

---

## 1. Architecture Overview (Zero-Cost Staging Tier)

```mermaid
flowchart TD
    User([Citizen / Staff Phone]) <-->|WhatsApp Multi-Device Protocol| WACloud[WhatsApp Cloud Core\nc.whatsapp.net:443]
    WACloud <-->|Encrypted WebSocket| WAGateway[WhatsMeow Gateway\nRender Free - Singapore]
    
    subgraph Supabase_Staging ["Supabase Staging Database (Tokyo: oayzaszhhpfjlpmaezmc)"]
        WAGateway -->|Port 5432 Session Pooler\nSSL Encrypted| SchemaWM["Schema 'whatsmeow'\n- whatsmeow_device\n- whatsmeow_sessions\n- processed_messages\n- inbound_events_queue"]
        Backend -->|Port 5432 Session Pooler\nSSL Encrypted| SchemaPublic["Schema 'public' (Alembic)\n- users\n- incidents\n- reports\n- ai_analysis"]
    end
    
    WAGateway <-->|HMAC-SHA256 Signed HTTP| Backend[CivicSense FastAPI Backend\nRender Free - Singapore]
    Backend <-->|SigV4 Presigned URLs| S3Evidence[Supabase S3 Storage\ncivicsense-staging-evidence]
    AdminPortal[Admin / Commissioner Portal\nVercel Preview] -->|JWT Auth| Backend
```

---

## 2. Infrastructure Inventory & Identity

| Component | Target Identity | Region | Plan / Cost |
| :--- | :--- | :--- | :---: |
| **Staging Supabase Project** | `oayzaszhhpfjlpmaezmc` | Tokyo (`ap-northeast-1`) | Free Tier (₹0) |
| **PostgreSQL Pooler** | `aws-0-ap-northeast-1.pooler.supabase.com:5432` | Tokyo | Session Mode |
| **Private S3 Evidence** | `civicsense-staging-evidence` | Tokyo | Free Tier (₹0) |
| **Render Staging Backend** | `civicsense-backend-staging` | Singapore | Free Tier (₹0) |
| **Render Staging Gateway** | `civicsense-wa-gateway-staging` | Singapore | Free Tier (₹0) |
| **Frontend Preview** | `civicsense-staging.vercel.app` | Global Edge | Free Tier (₹0) |
| **Production Supabase** | `bcpgsvvjuxzowxqqmouk` (Ohio) | **STRICTLY PROHIBITED** | **401 Records Preserved** |

---

## 3. Pre-Deployment Safety Checklist

- [x] Production database `bcpgsvvjuxzowxqqmouk` is isolated and protected by software safety gates in Python and Go.
- [x] Alembic migration chain validated up to head revision `e518c729f1b4`.
- [x] Alembic `env.py` configured with `include_object` filter to strictly ignore schema `whatsmeow`.
- [x] 116/116 backend automated tests passing locally with zero regressions.
- [x] Frontend TypeScript and production Vite build validated with 0 errors.
- [x] Supabase pooler port 5432 enforced; port 6543 explicitly rejected.

---

## 4. Phase A — Staging Database Schema Creation (Approval Gate 1)

> [!IMPORTANT]
> **Database Modification Approval Required:**  
> The staging Supabase database must be initialized with the dedicated `whatsmeow` schema before the gateway can persist sessions.

### Step 1: Open Supabase Dashboard
1. Log in to the Supabase Console: `https://supabase.com/dashboard/project/oayzaszhhpfjlpmaezmc`
2. Navigate to the **SQL Editor**.

### Step 2: Execute Schema Migration Proposal
Execute the contents of [`backend/scripts/whatsmeow_schema_migration_proposal.sql`](file:///d:/CivicSense%20AI/backend/scripts/whatsmeow_schema_migration_proposal.sql):
```sql
-- 1. Create Dedicated Isolated Schema
CREATE SCHEMA IF NOT EXISTS whatsmeow;

-- Ensure staging database user has full schema privileges
GRANT USAGE, CREATE ON SCHEMA whatsmeow TO "postgres.oayzaszhhpfjlpmaezmc";
ALTER DEFAULT PRIVILEGES IN SCHEMA whatsmeow GRANT ALL ON TABLES TO "postgres.oayzaszhhpfjlpmaezmc";
ALTER DEFAULT PRIVILEGES IN SCHEMA whatsmeow GRANT ALL ON SEQUENCES TO "postgres.oayzaszhhpfjlpmaezmc";

-- 2. Create Gateway Deduplication Table
CREATE TABLE IF NOT EXISTS whatsmeow.processed_messages (
    message_id VARCHAR(128) PRIMARY KEY,
    sender VARCHAR(64) NOT NULL,
    received_at BIGINT NOT NULL,
    expires_at BIGINT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_processed_messages_expires 
    ON whatsmeow.processed_messages(expires_at);

-- 3. Create Gateway Inbound Queue Table
CREATE TABLE IF NOT EXISTS whatsmeow.inbound_events_queue (
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
CREATE INDEX IF NOT EXISTS idx_inbound_queue_retry 
    ON whatsmeow.inbound_events_queue(status, next_retry_at);
```

---

## 5. Phase B — Render Staging Deployment (Approval Gate 2)

Deploy the two services defined in [`render.staging.yaml`](file:///d:/CivicSense%20AI/render.staging.yaml) via the Render Dashboard:

### 1. `civicsense-backend-staging` (Web Service)
- **Runtime:** Python 3.12+
- **Build Command:** `pip install -r requirements.txt`
- **Start Command:** `uvicorn app.main:app --host 0.0.0.0 --port $PORT`
- **Plan:** Free
- **Region:** Singapore
- **Health Check Path:** `/health`
- **Environment Variables:**
  - `ENVIRONMENT`: `staging`
  - `DATABASE_URL`: Staging Tokyo connection string (`aws-0-ap-northeast-1.pooler.supabase.com:5432`)
  - `SECRET_KEY`: Staging JWT secret (generated)
  - `WHATSAPP_PROVIDER`: `whatsmeow`
  - `WHATSAPP_GATEWAY_URL`: `https://civicsense-wa-gateway-staging.onrender.com`
  - `WHATSAPP_GATEWAY_SECRET`: Staging shared secret
  - `S3_BUCKET_NAME`: `civicsense-staging-evidence`
  - `S3_ENDPOINT_URL`: `https://oayzaszhhpfjlpmaezmc.supabase.co/storage/v1/s3`

### 2. `civicsense-wa-gateway-staging` (Web Service)
- **Runtime:** Docker (`whatsapp-gateway/Dockerfile`)
- **Plan:** Free
- **Region:** Singapore
- **Health Check Path:** `/healthz`
- **Environment Variables:**
  - `PORT`: `8085`
  - `ENVIRONMENT`: `staging`
  - `DB_DIALECT`: `postgres`
  - `DB_SCHEMA`: `whatsmeow`
  - `DATABASE_URL`: `postgresql://postgres.oayzaszhhpfjlpmaezmc:[PASSWORD]@aws-0-ap-northeast-1.pooler.supabase.com:5432/postgres?sslmode=require&search_path=whatsmeow,public`
  - `FASTAPI_BACKEND_URL`: `https://civicsense-backend-staging.onrender.com`
  - `WHATSAPP_GATEWAY_SECRET`: Matching shared secret
  - `LOG_LEVEL`: `INFO`

---

## 6. Phase C — WhatsApp Physical Pairing Procedure

1. Open the CivicSense staging web application in a browser: `https://civicsense-staging.vercel.app`
2. Log in using an authenticated Administrator or Commissioner account.
3. Navigate to **Administration Panel** $\rightarrow$ **WhatsApp Gateway** tab.
4. If unlinked, the active pairing QR code will be displayed.
5. On the physical demonstration Android or iOS phone:
   - Open WhatsApp.
   - Go to **Settings** $\rightarrow$ **Linked Devices** $\rightarrow$ **Link a Device**.
   - Point the camera at the QR code displayed in the CivicSense dashboard.
6. Upon successful scanning, the dashboard updates immediately to:
   - **Status:** `Connected & Logged In`
   - **Device JID:** Displays the registered telephone number.

---

## 7. Phase D — Session Survival & Recovery Validation

To verify that the Supabase PostgreSQL session persistence is operating properly:
1. In the Render Dashboard, trigger a **Manual Restart** of the `civicsense-wa-gateway-staging` service (or let it go to sleep).
2. Check the gateway logs during container startup:
   ```text
   Initializing whatsmeow PostgreSQL session container with schema 'whatsmeow'
   Existing device session loaded: JID=<phone_number>@s.whatsapp.net
   Connected to WhatsApp successfully!
   ```
3. Refresh the CivicSense Admin dashboard: the status must remain **Connected** without requiring a re-scan.

---

## 8. Phase E — Operational Protocol for Demonstrations (Render Free Sleep)

### The Inactivity Sleep Constraint
- Render Free services automatically spin down after **15 minutes of zero inbound HTTP traffic**.
- The outbound WebSocket from Render to WhatsApp is terminated during sleep.
- Incoming WhatsApp messages will sit in WhatsApp's cloud servers (showing a single grey checkmark `✓`).

### Recommended Pre-Presentation Warm-up (Takes 60 seconds):
1. **One minute before your live presentation**, trigger an HTTP request to wake both services:
   - Click the staging URL: `https://civicsense-wa-gateway-staging.onrender.com/healthz`
   - Or open the CivicSense Admin dashboard.
2. Render spins up the container (cold start takes 30–45s).
3. The gateway reconnects to PostgreSQL, loads the device session, and establishes the WhatsApp WebSocket.
4. Any messages received while sleeping are automatically pulled and delivered to FastAPI.
5. CivicSense AI is now 100% active and will respond to WhatsApp messages with <2s latency.

---

## 9. Rollback & Disaster Recovery

- **To Unlink WhatsApp:** Click **Disconnect** in the Admin Portal, or unlink from the WhatsApp app on the phone under Linked Devices.
- **To Fallback to Meta Cloud API:** Set `WHATSAPP_PROVIDER=meta` in the backend environment variables and restart `civicsense-backend-staging`.
- **Database Rollback:** If the `whatsmeow` schema needs to be dropped for any reason:
  ```sql
  DROP SCHEMA IF EXISTS whatsmeow CASCADE;
  ```
  *(Note: This deletes WhatsApp pairing credentials and queues; it does NOT affect application tables in `public` schema).*
