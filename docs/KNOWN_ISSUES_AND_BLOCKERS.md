# CivicSense AI — Known Issues, Technical Constraints & Action Items
**Platform:** CivicSense AI OS v5.0  
**Audit Date:** 2026-11-11  

---

## 1. Production Environmental Prerequisites & Action Items

| Item | Component | Current Condition | Recommended Action | Severity / Impact |
| :--- | :--- | :--- | :--- | :--- |
| **ACT-01** | **Render LLM Provider Configuration** | In development, the platform defaults to `LLM_PROVIDER=ollama`. Render cannot run a local Ollama daemon. | Ensure `LLM_PROVIDER=gemini` is set in the Render environment variables dashboard, with a valid `GEMINI_API_KEY`. | **High**: In production mode, `config.py` raises validation error if `LLM_PROVIDER=ollama`. |
| **ACT-02** | **Ephemeral Disk on Render for Media Uploads** | If `STORAGE_PROVIDER=local`, complaint images are stored in `/backend/uploads`. Render's ephemeral filesystem wipes these on pod restart. | Switch Render environment to `STORAGE_PROVIDER=supabase` or configure AWS S3 bucket credentials for permanent photo storage. | **Medium**: Local storage functions cleanly, but uploaded photos do not survive server restarts. |
| **ACT-03** | **Meta WhatsApp Webhook Configuration** | In local development, mock transport handles WhatsApp. For live production messaging, Meta requires live HTTPS endpoints. | Verify in Meta App Dashboard that the Webhook URL is set to `https://civicsense-ai-l9qp.onrender.com/api/v1/whatsapp/webhook` and the verify token matches `WHATSAPP_WEBHOOK_VERIFY_TOKEN`. | **Medium**: Mock transport handles tests; live WhatsApp delivery requires Meta webhook activation. |

---

## 2. Technical Observations & Codebase Maintenance Notes

### 1. Python 3.14 Datetime Deprecation Warnings
- **Observation:** Running tests on Python 3.14 emits `DeprecationWarning: datetime.datetime.utcnow() is deprecated and scheduled for removal in a future version. Use timezone-aware objects to represent datetimes in UTC: datetime.datetime.now(datetime.UTC)`.
- **Status:** All existing database models and SQLAlchemy default values run cleanly across SQLite and PostgreSQL.
- **Recommendation:** In an upcoming refactoring sprint, migrate `datetime.utcnow()` to `datetime.now(datetime.timezone.utc)`.

### 2. Frontend Large Bundle Chunking
- **Observation:** Vite build warns: `(!) Some chunks are larger than 500 kB after minification (dist/assets/index-ZQNytAtz.js: 3,113.66 kB)`.
- **Cause:** Three.js, React Three Fiber, MapLibre GL, and Leaflet are bundled into a single primary chunk.
- **Status:** App compiles cleanly in 1.06s and renders at 60 FPS.
- **Recommendation:** Implement dynamic imports (`React.lazy`) for `CityDigitalTwin3D.tsx` and `DigitalTwinGISMap.tsx` in a future optimization phase to reduce initial landing page bundle size.

---

## 3. Explicit Approval Boundaries (Protected Gates)

Per your strict constraints, the following actions have been safeguarded and **NOT** executed without your explicit instruction:

1. **Production Database Writes & Migrations:**
   - Supabase PostgreSQL remains completely unmodified.
   - All 401 existing records are intact and preserved.
   - Zero schema migrations (`alembic upgrade / downgrade`) have been run.
2. **Hosting Infrastructure Changes:**
   - No Render or Vercel dashboard environment variables have been altered.
3. **External Communications:**
   - No live WhatsApp messages or SMS notifications have been transmitted to external numbers.
4. **Git Operations & Deployment:**
   - No commits have been made to git.
   - No branches have been pushed to `origin`.
   - No builds have been triggered on Render or Vercel.
