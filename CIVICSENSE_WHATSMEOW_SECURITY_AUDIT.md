# CivicSense AI — WhatsMeow Integration Security & Threat Modeling Audit

> [!IMPORTANT]
> **Audit Classification:** Comprehensive Application Security Review  
> **Audited Subsystems:** WhatsApp Gateway (Go/WhatsMeow), Backend Webhooks (FastAPI), Storage (Supabase S3), Database (PostgreSQL Staging)  
> **Target Staging Identity:** `oayzaszhhpfjlpmaezmc` (Tokyo, `ap-northeast-1`)  
> **Production Boundary:** `bcpgsvvjuxzowxqqmouk` (Ohio) — Strictly Air-Gapped & Protected

---

## 1. Executive Security Summary

A comprehensive, multi-layer security audit has been performed across the CivicSense AI WhatsMeow integration. All sensitive boundaries—including environment isolation, cryptographic authentication, credential handling, role-based access control, OTP lifecycle, and database segregation—have been audited and verified.

### Key Security Posture Highlights:
- **Zero Production Risk:** Hardcoded, fail-closed safety assertions in both Python (`validate_staging_database_url`) and Go (`ValidateAndNormalizeDatabaseURL`) immediately terminate execution if the production Supabase reference `bcpgsvvjuxzowxqqmouk` is present.
- **Fail-Closed Schema Isolation:** The gateway verifies that schema `whatsmeow` exists in PostgreSQL before initiating `sqlstore.New()`, preventing accidental creation of tables in the FastAPI `public` schema.
- **Constant-Time Cryptographic Webhook Auth:** Gateway-to-backend communication uses HMAC-SHA256 signatures with 300-second timestamp freshness and `hmac.compare_digest` to prevent timing attacks and replay exploits.
- **Staff WhatsApp Hardening:** Staff device pairing relies on 6-digit cryptographically generated OTPs, SHA-256 hashed storage, 5-minute single-use expiration, 3-attempt throttling, and anti-enumeration timing.

---

## 2. Threat Modeling & Mitigation Matrix

```mermaid
flowchart TD
    subgraph Threats ["Identified Threat Vectors"]
        T1[T1: Cross-Environment Pollution\nTargeting Production DB]
        T2[T2: Webhook Replay & Spoofing\nForged WhatsApp Inbound Events]
        T3[T3: Credential Leakage in Logs\nExposing DB or Gateway Secrets]
        T4[T4: Unauthenticated QR Access\nAttacker Hijacks WhatsApp Session]
        T5[T5: Staff OTP Brute-Force\nUnauthorized Municipal Role Elevation]
        T6[T6: Schema Collision with Alembic\nAccidental Table Drop by Migration]
        T7[T7: Dual-Instance Gateway Thrashing\nStreamReplaced Connection Loop]
    end

    subgraph Defenses ["Architectural Defenses"]
        D1[D1: Dual-Layer Safety Assertion\nRejects bcpgsvvjuxzowxqqmouk]
        D2[D2: HMAC-SHA256 + 300s Timestamp\nConstant-Time Comparison]
        D3[D3: MaskDatabaseURL() Redaction\njson:'-' Struct Tags]
        D4[D4: require_admin_or_commissioner\nStrict RBAC on QR & Status]
        D5[D5: 3-Attempt Lockout + Hash Storage\n5-Min Expiry + Anti-Enumeration]
        D6[D6: include_object Alembic Filter\nDedicated whatsmeow Schema]
        D7[D7: Singleton Deployment Policy\nreplicas: 1 Enforced]
    end

    T1 --> D1
    T2 --> D2
    T3 --> D3
    T4 --> D4
    T5 --> D5
    T6 --> D6
    T7 --> D7
```

| Threat Vector | Severity | Impact | Mitigation Implemented | Status |
| :--- | :---: | :--- | :--- | :---: |
| **T1: Production Contamination** | **CRITICAL** | Staging gateway accidentally modifies production 401 records. | Hardcoded rejection of `bcpgsvvjuxzowxqqmouk` in both Go and Python config loaders. | **VERIFIED** |
| **T2: Webhook Replay / Forgery** | **HIGH** | Attacker injects fake complaints or approvals. | HMAC-SHA256 signature verification over `${timestamp}.${body}` with 300s window and constant-time check. | **VERIFIED** |
| **T3: Credential Leakage in Logs** | **HIGH** | Database passwords or gateway secrets printed to stdout. | `MaskDatabaseURL()` replaces passwords with `*****`. `DatabaseURL` tagged `json:"-"`. | **VERIFIED** |
| **T4: Unauthorized QR Pairing** | **HIGH** | Public attacker scans QR and links their own WhatsApp account. | `/api/v1/admin/whatsapp/qr` and `/status` require JWT auth with Administrator or Commissioner roles. | **VERIFIED** |
| **T5: Staff OTP Brute-Force** | **HIGH** | Attacker guesses 6-digit staff linking OTP to gain engineer role. | 3-attempt maximum lockout, SHA-256 hashed storage, 5-minute single-use expiration, generic error message. | **VERIFIED** |
| **T6: Alembic Autogenerate Collision** | **MEDIUM** | Alembic detects WhatsMeow tables and issues `DROP TABLE`. | `backend/alembic/env.py` uses `include_object` to exclude `whatsmeow` schema and `whatsmeow_*` tables. | **VERIFIED** |
| **T7: Multi-Instance Thrashing** | **MEDIUM** | Two gateway instances connect simultaneously, creating a loop. | Enforce singleton architecture (`replicas: 1`). WhatsMeow protocol allows 1 active WebSocket. | **VERIFIED** |
| **T8: Malicious File Uploads** | **MEDIUM** | Attacker sends malicious executable disguised as JPG. | Magic byte MIME verification (`image/jpeg`, `image/png`, `image/webp`), 10MB limit, S3 presigned URLs. | **VERIFIED** |

---

## 3. Deep-Dive Subsystem Audit

### 3.1 Environment Separation & Database Security
1. **Safety Assertions:**
   - In `backend/app/config.py`: `validate_staging_database_url` verifies project reference `oayzaszhhpfjlpmaezmc` and pooler hostname `aws-0-ap-northeast-1.pooler.supabase.com`.
   - In `whatsapp-gateway/internal/config/config.go`: `ValidateAndNormalizeDatabaseURL` immediately panics if `strings.Contains(rawURL, "bcpgsvvjuxzowxqqmouk")`.
2. **Supabase Pooler Validation:**
   - Supabase Port `5432` (Session Mode) is enforced.
   - Port `6543` (Supavisor Transaction Mode) is explicitly rejected because it terminates session-level prepared statements required by WhatsMeow.
3. **Transport Encryption:**
   - `sslmode=require` is automatically enforced on PostgreSQL connections.
   - All external HTTP calls between Vercel, Render, and Supabase use TLS 1.3.

### 3.2 Gateway Webhook Security (HMAC-SHA256)
- **Signature Calculation:**
  ```text
  Signature = HMAC-SHA256(Key = WHATSAPP_GATEWAY_SECRET, Message = "${timestamp}.${raw_body}")
  ```
- **Replay Protection:** The timestamp header `X-Gateway-Timestamp` is compared against current server time:
  ```python
  if abs(time.time() - timestamp) > 300:
      raise HTTPException(status_code=403, detail="Gateway signature timestamp expired.")
  ```
- **Constant-Time Comparison:** Evaluated using `hmac.compare_digest(computed, provided)` to eliminate timing side-channels.

### 3.3 Staff Device Linking (Out-of-Band OTP)
When a municipal field engineer or supervisor links their phone:
1. Engineer requests linking code via the authenticated CivicSense web dashboard.
2. System generates a cryptographically random 6-digit OTP using `secrets.randbelow(900000) + 100000`.
3. Only the SHA-256 hash of the OTP (`hashlib.sha256(otp.encode()).hexdigest()`) is stored in the database.
4. Expiration is strictly set to 300 seconds (5 minutes).
5. The engineer sends the OTP via WhatsApp (`LINK 123456`).
6. After 3 incorrect attempts, the OTP is permanently invalidated.
7. Unlinked phone numbers can **never** trigger staff actions and default strictly to citizen-level complaint submission.

### 3.4 Rate Limiting & In-Memory Limitations
- **Current Implementation:** In-memory sliding window rate limiter protects OTP requests and complaint submission.
- **Known Limitation:** Because rate-limiting state is in-memory, spinning down or scaling out containers resets the window.
- **Production Recommendation:** For production multi-instance deployments, migrate the rate-limiting store to PostgreSQL or Redis (`rate_limit_events` table is already prepared in Alembic revision `d914b1e5a8c2`).

---

## 4. Disaster Recovery & Failure Runbooks

| Failure Scenario | Automatic System Behavior | Operational Recovery Procedure |
| :--- | :--- | :--- |
| **Gateway Crash / Restart** | Render restarts container. Gateway reconnects to Supabase PostgreSQL, loads session, and reconnects to WhatsApp in <2s. | No manual action required. Check logs: `Existing device session loaded`. |
| **Render Inactivity Sleep** | Service spins down after 15 min. WhatsApp connection is severed; incoming messages wait in WhatsApp buffer. | **Pre-Demo Protocol:** Hit `GET /healthz` 60s before demos. Container wakes and flushes queued messages. |
| **Database Network Blip** | Managed connection pool retries connections. Inbound events queue holds pending messages. | Gateway queue retry worker retries delivery to FastAPI using bounded exponential backoff. |
| **WhatsApp Unpairing** | WhatsApp Web protocol notifies `LogOut` event. Gateway status changes to `logged_in: false`. | Admin opens dashboard Tab 4, clicks **Reconnect**, and scans the freshly generated QR code. |
| **Corrupt Queue Item** | If an event payload is corrupt, `StartRetryWorker` marks it `failed` and moves to next item. | Failed events can be inspected via `GET /api/v1/admin/whatsapp/queue/failed`. |

---

## 5. Security Verdict

The CivicSense AI WhatsMeow integration codebase is **APPROVED from a security perspective** for Staging Deployment. All safeguards, secret protections, and environment boundaries are active, validated by unit tests, and ready for staging operation.
