# CivicSense AI — Production Deployment Checklist
**Platform:** CivicSense AI OS v5.0  
**Target Environments:** Vercel (Frontend) & Render (Backend)  
**Database:** Supabase PostgreSQL  
**Audit Date:** 2026-11-11  

---

## 1. Production Infrastructure Targets

| Component | Provider / Platform | Production URL / Endpoint |
| :--- | :--- | :--- |
| **Frontend Web App** | Vercel | `https://civicsenseai-theta.vercel.app` |
| **Backend API Service** | Render | `https://civicsense-ai-l9qp.onrender.com` |
| **Database Engine** | Supabase (Managed PostgreSQL) | `postgresql+psycopg://postgres.XXXXX:...@aws-0-ap-south-1.pooler.supabase.com:6543/postgres?sslmode=require` |
| **AI Vision & Triage** | Google Gemini API | `gemini-2.5-flash` |
| **Messaging Channel** | Meta WhatsApp Cloud API | Meta Graph API v21.0 |

---

## 2. Environment Configuration Preflight (`config.py`)

When setting `ENVIRONMENT=production` on Render, the backend executes strict preflight validation. Ensure the following environment variables are configured in the Render Dashboard:

| Variable Name | Required Value / Format | Validation Rule in `config.py` | Status |
| :--- | :--- | :--- | :--- |
| `ENVIRONMENT` | `production` | Enables production security mode & disables dev token leaks | Ready |
| `DATABASE_URL` | `postgresql+psycopg://...` | Must point to Supabase PostgreSQL with `sslmode=require` | Configured on Render |
| `SECRET_KEY` | 64+ char random hex string | Must NOT be default or short; minimum 32 bytes entropy | Configured on Render |
| `LLM_PROVIDER` | `gemini` | `ollama` is rejected in production (no localhost daemon on Render) | **Action Required on Render** |
| `GEMINI_API_KEY` | `AIzaSy...` | Required when `LLM_PROVIDER=gemini` | Configured on Render |
| `STORAGE_PROVIDER` | `supabase` or `local` | `local` uploads persist only until pod restarts; use `supabase` for durable photos | Recommended: `supabase` |
| `CORS_ORIGINS` | Comma-separated list | Must include `https://civicsenseai-theta.vercel.app` | Configured on Render |
| `META_PHONE_NUMBER_ID` | Meta App Phone ID | Activates live WhatsApp message dispatch | Configured on Render |
| `WHATSAPP_API_TOKEN` | System User Permanent Token | Required for live WhatsApp outbound messaging | Configured on Render |
| `WHATSAPP_WEBHOOK_VERIFY_TOKEN` | Secure token string | Matches Meta Webhook verification handshake token | Configured on Render |
| `META_APP_SECRET` | Meta App Secret | Required for incoming webhook HMAC-SHA256 signature verification | Configured on Render |

---

## 3. Pre-Deployment Verification Gate (Completed Locally)

- [x] **Zero Migration Policy:** No database migrations needed; all tables and columns exist in Supabase.
- [x] **Dependency Check:** `psycopg[binary]==3.2.4` pinned in `backend/requirements.txt`.
- [x] **Backend Test Suite:** All 55 tests passing (`backend\tests\test_*.py`).
- [x] **Frontend Typecheck & Build:** `tsc -b && vite build` clean with 0 errors.
- [x] **Linter Check:** `oxlint` 0 errors.
- [x] **Staff Provisioning Security:** WhatsApp backdoor `"civic2026"` removed; public registration forces `citizen` role.
- [x] **Frontend Role Switcher:** Mock role-switching controls eliminated; UI strictly role-derived.
- [x] **Credentials Safety:** Zero secrets logged in chat; production password prefilling disabled.

---

## 4. Controlled Deployment Sequence (Requires User Approval)

The following sequence outlines the exact steps to release these updates to production:

```mermaid
flowchart TD
    A["Stage 1: User Explicit Approval"] --> B["Stage 2: Git Commit & Push to main"]
    B --> C["Stage 3: Render Auto-Build & Deploy Backend"]
    B --> D["Stage 4: Vercel Auto-Build & Deploy Frontend"]
    C --> E["Stage 5: Live Smoke Test - Health Probes"]
    D --> E
    E --> F["Stage 6: Four-Role End-to-End Verification"]
```

### Step 1: Git Commit & Push (Gated)
- Stage verified files:
  - `backend/app/routers/admin.py`
  - `backend/app/routers/incidents.py`
  - `backend/app/routers/auth.py`
  - `backend/app/schemas/incident.py`
  - `backend/app/schemas/user.py`
  - `backend/app/utils/security.py`
  - `backend/app/main.py`
  - `backend/tests/test_admin_portal.py`
  - `backend/tests/test_workflow_lifecycle.py`
  - `backend/tests/test_auth_rbac.py`
  - `src/components/UserManagementPanel.tsx`
  - `src/components/FieldEngineerPortal.tsx`
  - `src/components/ComplaintHistory.tsx`
  - `src/components/MobileReporter.tsx`
  - `src/components/LoginPage.tsx`
  - `src/services/apiClient.ts`
  - `docs/*`
- Commit message: `feat(platform): complete full-stack civic governance platform production hardening`
- Push to `origin main`.

### Step 2: Render Backend Health Verification
1. Access `https://civicsense-ai-l9qp.onrender.com/health`.
2. Confirm HTTP 200 with `status: "healthy"` and database connected via `psycopg`.
3. Check `https://civicsense-ai-l9qp.onrender.com/api/v1/ai/status` to confirm Gemini status.

### Step 3: Vercel Frontend Smoke Test
1. Open `https://civicsenseai-theta.vercel.app`.
2. Verify four-role login tabs: Citizen, Field Engineer, Commissioner, Administrator.
3. Verify password fields are empty by default in production.
4. Verify 3D Digital Twin, GIS Map, Predictive Maintenance, and Budget Planner render without errors.
5. Log in as Administrator to verify live System Telemetry and User Management panel.
