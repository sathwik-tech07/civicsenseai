# CivicSense AI — Database & Storage Architecture Status
**Platform:** CivicSense AI OS v5.0  
**Production Database:** Supabase PostgreSQL (Managed Cloud)  
**ORM / Driver:** SQLAlchemy 2.0.x with `psycopg` 3 (`psycopg[binary]==3.2.4`)  
**Development Database:** SQLite (`sqlite:///./civic_sense.db`)  
**Audit Date:** 2026-11-11  

---

## 1. Dual-Engine Database Architecture

The CivicSense AI database subsystem is configured in `backend/app/database.py` with dynamic dialect normalization:

1. **Production Engine (Supabase PostgreSQL):**
   - Automatically normalizes connection URLs starting with `postgres://` or `postgresql://` to `postgresql+psycopg://`.
   - Uses `psycopg` (v3 binary dialect), avoiding the legacy C-extension compilation issues of psycopg2.
   - Enforces `pool_pre_ping=True` to detect dropped serverless connection pooler connections.
   - Sets `pool_recycle=1800` (30 minutes) and `pool_timeout=30` to prevent stale connection exhaustion.
   - Configures SSL requirement (`sslmode=require`) for secure cloud transit.
2. **Development / Fallback Engine (SQLite):**
   - Engaged when `DATABASE_URL` is omitted or points to `sqlite://`.
   - Configures `check_same_thread=False` and enables Write-Ahead Logging (WAL) for concurrent read access.

---

## 2. Production Database Table Schema & Record Audit

The Supabase PostgreSQL database contains 12 normalized relational tables, housing 401 existing reconciled records that are strictly preserved:

| Table Name | Primary Key | Description & Key Columns | Preserved Records |
| :--- | :--- | :--- | :--- |
| `users` | `id` (VARCHAR) | Platform accounts (`email`, `hashed_password`, `role`, `department`, `is_active`, `phone_number`) | 232+ |
| `incidents` | `id` (VARCHAR) | Core complaint records (`title`, `category`, `status`, `priority_score`, `lat`, `lng`, `assigned_engineer_id`) | 84+ |
| `ai_analyses` | `id` (INTEGER) | Automated AI triage records (`confidence_score`, `detected_category`, `recommended_priority`) | 42+ |
| `workflow_history` | `id` (INTEGER) | Stage transition timestamps and audit history for complaint lifecycles | 18+ |
| `audit_logs` | `id` (INTEGER) | Immutable platform audit trail (`who`, `what`, `when`, `result`, `incident_id`, `user_id`) | 41+ |
| `notifications` | `id` (INTEGER) | In-app and external dispatch logs (`recipient_id`, `message`, `type`, `read`) | 12+ |
| `rate_limit_events` | `id` (INTEGER) | Atomic sliding-window rate limit counters (`key`, `timestamp`) | Dynamic |
| `citizen_profiles` | `id` (INTEGER) | Citizen engagement metrics, trust scores, and WhatsApp mappings | 20+ |
| `wards` | `id` (VARCHAR) | Municipal ward boundary definitions, populations, and geo-centers | 8+ |
| `municipal_budgets` | `id` (INTEGER) | Ward capital expenditure allocations, spend tracking, and fiscal targets | 4+ |
| `gis_layers` | `id` (VARCHAR) | Spatial layers (utilities, road networks, storm drains, streetlights) | 6+ |
| `executive_reports` | `id` (INTEGER) | Archived municipal dossiers and generated governance reports | 3+ |

---

## 3. Zero-Migration Compatibility Verification

During the Phase 1–5 implementation, all newly added capabilities were deliberately architected to be **100% zero-migration compatible**:

1. **Staff Provisioning & Role Reassignment:** Uses existing `User` table columns (`id`, `email`, `role`, `department`, `is_active`, `phone_number`).
2. **Password Reset:** Generates ephemeral cryptographic tokens verified in-memory using HMAC-SHA256, eliminating the need to add temporary token columns to the database.
3. **Citizen Escalation & Feedback:** Records satisfaction ratings, comments, and priority bumps in `Incident.priority_score`, `Incident.status`, and immutable `AuditLog` rows.
4. **Rate Limiting:** Utilizes the pre-existing `rate_limit_events` table for sliding-window timestamp tracking.

> [!IMPORTANT]
> **No Alembic migrations (`alembic upgrade`, `alembic downgrade`, `alembic stamp`) were run or needed.** All existing data in Supabase remains pristine and untouched.

---

## 4. Storage Architecture & Media Handling

The storage subsystem (`backend/app/services/storage_service.py`) handles photographic evidence submitted by Citizens and Field Engineers:

- **Local Storage (`STORAGE_PROVIDER=local`):**
  - Files are saved to `backend/uploads/` with UUID-based filenames to prevent collisions.
  - Served via FastAPI static files mounting (`/uploads`).
- **Cloud Storage Compatibility (`STORAGE_PROVIDER=supabase` or `s3`):**
  - Configured to upload binary streams directly to Supabase Storage or AWS S3 buckets.
- **MIME & Magic-Bytes Validation:**
  - Enforces a 10MB maximum file size.
  - Inspects file magic bytes (e.g. `\xFF\xD8\xFF` for JPEG, `\x89\x50\x4E\x47` for PNG, `RIFF...WEBP` for WebP) before writing to disk or transmitting to AI vision engines.
