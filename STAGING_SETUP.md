# CivicSense AI — Staging Infrastructure Setup Guide

This guide provides the exact operational procedure for provisioning, configuring, and verifying the isolated staging environment on **Render** (backend & database) and **Vercel** (frontend).

---

## 1. Mandatory Deployment Gates

Before initiating any build or provisioning cloud resources, all five deployment gates must be satisfied:

> [!CAUTION]
> **GATE 1: Database Isolation Boundary**
> Never use or point `DATABASE_URL` to a production database. Staging must strictly use an independent, isolated PostgreSQL database instance (`civicsense-db-staging`).

> [!IMPORTANT]
> **GATE 2: Zero Secret Exposure**
> Never commit `.env` files, API keys, passwords, or cloud credentials into Git. All sensitive credentials must be supplied exclusively through PaaS environment dashboards.

> [!IMPORTANT]
> **GATE 3: Migration Precedence**
> Never run the admin bootstrap script before Alembic migrations succeed. The database schema must be fully initialized to head revision (`d914b1e5a8c2`) prior to administrative user creation.

> [!WARNING]
> **GATE 4: Staging CSP Hostname Alignment**
> In [`vercel.json`](file:///d:/CivicSense%20AI/vercel.json), the CSP placeholder `CONFIRMED_STAGING_BACKEND_HOSTNAME_HERE` must be updated with the actual staging backend domain **only after** Render provisions the Web Service and assigns a confirmed hostname. Deployed frontend builds will block API calls if the hostname does not match.

> [!NOTE]
> **GATE 5: Narrow Proxy Trust**
> Keep `TRUST_PROXY_HEADERS=false` until the connecting reverse proxy peer IP or CIDR is confirmed through actual staging deployment logs. Do not blindly whitelist broad unverified subnets (such as `10.0.0.0/8`).

---

## 2. Render Blueprint Setup (Backend & Database)

The repository root includes an automated Infrastructure-as-Code blueprint in [`render.yaml`](file:///d:/CivicSense%20AI/render.yaml).

### Step-by-Step Blueprint Launch
1. Sign in to the [Render Dashboard](https://dashboard.render.com).
2. Click **New +** > **Blueprint**.
3. Select and connect the `CivicSense AI` repository.
4. Render will detect [`render.yaml`](file:///d:/CivicSense%20AI/render.yaml) and declare two staging resources:
   * **Web Service:** `civicsense-backend-staging`
     - Runtime: `Python`
     - Root Directory: `backend`
     - Build Command: `pip install -r requirements.txt`
     - Pre-Deploy Command: `alembic upgrade head`
     - Start Command: `uvicorn app.main:app --host 0.0.0.0 --port $PORT`
   * **Managed PostgreSQL Database:** `civicsense-db-staging`
     - Database Name: `civicsense_staging`
     - Database User: `civicsense_user`
     - Version: PostgreSQL 16
5. Apply the blueprint. Render will provision the isolated staging database and automatically wire the database connection string into the Web Service environment as `DATABASE_URL`.

---

## 3. Required Render Environment Variables

Configure the following variables in the `civicsense-backend-staging` Environment settings:

| Variable | Required | Staging Value / Format | Purpose / Fail-Closed Behavior |
| :--- | :---: | :--- | :--- |
| `ENVIRONMENT` | **Yes** | `staging` | Enforces fail-closed staging validations (blocks SQLite, mock seeds, and local storage). |
| `DATABASE_URL` | Auto | *Render Database Connection String* | Auto-wired from `civicsense-db-staging`; normalized by backend to `postgresql://`. |
| `SECRET_KEY` | Auto | *Auto-generated 64-char string* | Session/JWT signing secret; weak/default keys are rejected at startup. |
| `JWT_ALGORITHM` | No | `HS256` | JWT signing algorithm. |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | No | `10080` (7 days) | Session lifetime. |
| `STORAGE_PROVIDER` | **Yes** | `s3` | Ephemeral `local` storage is strictly rejected in staging mode. |
| `S3_BUCKET_NAME` | **Yes** | *Your staging bucket name* | Dedicated staging object storage bucket. |
| `S3_ACCESS_KEY_ID` | **Yes** | *Your staging IAM access key* | IAM credentials for S3/R2 storage access. |
| `S3_SECRET_ACCESS_KEY` | **Yes** | *Your staging IAM secret key* | Masked and redacted from all application logs and exceptions. |
| `S3_REGION_NAME` | No | `us-east-1` | S3 region (adjust to your cloud region). |
| `S3_ENDPOINT_URL` | Conditional | *Empty for AWS; URL for Cloudflare R2* | Optional custom S3-compatible API endpoint. |
| `S3_PRESIGNED_EXPIRATION_SECONDS` | No | `900` (15 minutes) | Expiration for AWS SigV4 private presigned image URLs. |
| `CORS_ORIGINS` | **Yes** | `https://<your-staging-subdomain>.vercel.app` | Explicit allowed origin. Wildcards (`*`) are strictly forbidden. |
| `ENABLE_DEMO_ACCOUNTS` | **Yes** | `false` | Must be `false`. Prevents creation of demo users with pre-shared passwords. |
| `RATE_LIMIT_BACKEND` | **Yes** | `database` | Shared persistent database rate limiting. In-memory storage is rejected. |
| `TRUST_PROXY_HEADERS` | **Yes** | `false` | Kept disabled until the proxy source IP is confirmed from staging logs. |
| `LLM_PROVIDER` | **Yes** | `gemini` | Cloud AI engine provider. |
| `VISION_PROVIDER` | **Yes** | `gemini` | Multimodal damage and severity vision assessment. |
| `GEMINI_API_KEY` | **Yes** | *Your Gemini API key* | Required when `LLM_PROVIDER=gemini` or `VISION_PROVIDER=gemini`. |
| `GEMINI_MODEL` | No | `gemini-2.5-flash` | Multimodal model name. |

---

## 4. S3 / Cloudflare R2 Private Bucket Requirements

To store incident evidence photos securely without using ephemeral instance disks:

1. **Bucket Privacy:**
   - Create a dedicated staging bucket (e.g. `civicsense-staging-evidence`).
   - Enable **Block all public access** (no public bucket policy, no public ACLs).
2. **Access Control:**
   - Provision a dedicated IAM service user or Cloudflare API token with least-privilege permissions:
     - `s3:PutObject`
     - `s3:GetObject`
     - `s3:DeleteObject`
3. **Private Access Delivery:**
   - The application serves photos exclusively via AWS SigV4 presigned URLs expiring in 15 minutes (`S3_PRESIGNED_EXPIRATION_SECONDS=900`).
4. **Bucket CORS Configuration:**
   - If frontend direct downloads or previews are required, configure CORS on the bucket:
     ```json
     [
       {
         "AllowedHeaders": ["*"],
         "AllowedMethods": ["GET", "HEAD"],
         "AllowedOrigins": ["https://<your-staging-subdomain>.vercel.app"],
         "MaxAgeSeconds": 3600
       }
     ]
     ```

---

## 5. Google Gemini API Configuration

1. Obtain a Gemini API key from the [Google AI Studio](https://aistudio.google.com/).
2. In the Render backend environment settings, configure:
   - `LLM_PROVIDER=gemini`
   - `VISION_PROVIDER=gemini`
   - `GEMINI_MODEL=gemini-2.5-flash`
   - `GEMINI_API_KEY=<your-api-key>`
3. The backend validates the presence of `GEMINI_API_KEY` during startup and rejects placeholder strings.

---

## 6. Vercel Project Setup (Frontend)

1. Sign in to [Vercel](https://vercel.com) and click **Add New Project**.
2. Import the `CivicSense AI` repository.
3. Configure project settings:
   * **Framework Preset:** Vite
   * **Root Directory:** `./` (repository root)
   * **Build Command:** `npm run build`
   * **Output Directory:** `dist`
4. Configure Environment Variables:
   * `VITE_API_URL`: Set to `https://<render-backend-staging-subdomain>.onrender.com/api/v1`.
5. **Update CSP in [`vercel.json`](file:///d:/CivicSense%20AI/vercel.json):**
   * Replace `CONFIRMED_STAGING_BACKEND_HOSTNAME_HERE` with the actual assigned Render hostname (e.g. `civicsense-backend-staging.onrender.com`).

---

## 7. Initial Admin Bootstrap (Out-of-Band Execution)

Once Render finishes deploying the backend and the Alembic migration step completes with exit code 0, create the initial staging administrator.

### Execution Command
Open the **Shell** tab of the `civicsense-backend-staging` service in the Render Dashboard, or connect via Render SSH, and execute:

```bash
python scripts/bootstrap_admin.py --confirm --email admin@civicsense.staging --name "Staging Administrator" --role admin
```

### Security & Behavioral Features
* **Interactive Password Prompt:** Prompts securely via `getpass()`. Passwords are never passed via CLI flags or logged.
* **Complexity Validation:** Requires minimum 12 characters, maximum 72 bytes (Bcrypt limit), and mixed character classes (uppercase, lowercase, digits, symbols).
* **Advisory Lock Serialization:** Dispatches PostgreSQL advisory lock `428491024` to ensure mutual exclusion across multi-instance environments.
* **Permanent Self-Lock:** Automatically aborts if any `admin` or `commissioner` already exists in the database.
* **Fail-Closed Protection:** Rejects execution if ambient environment indicates production.

---

## 8. Post-Deployment Verification Steps

Perform these non-destructive checks to confirm the staging environment is operational:

1. **Verify Backend Health & Security Headers:**
   ```bash
   curl -I https://<render-backend-staging-subdomain>.onrender.com/
   ```
   *Expected response:* HTTP 200 OK with headers `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Strict-Transport-Security`.
2. **Verify OpenAPI Schema:**
   ```bash
   curl -s https://<render-backend-staging-subdomain>.onrender.com/openapi.json | grep -o '"title":"CivicSense AI Smart City Backend"'
   ```
   *Expected response:* Matches schema title without authentication.
3. **Verify Frontend Staging Delivery:**
   * Open `https://<your-staging-subdomain>.vercel.app` in a browser.
   * Open Browser DevTools > Console. Verify zero CSP violation errors and zero missing `VITE_API_URL` configuration errors.
4. **Verify Authentication & Authorization:**
   * Navigate to the login screen and log in with the bootstrapped admin credentials.
   * Verify JWT tokens are stored in `localStorage` under `civicsense_jwt`.
   * Test an invalid login to verify that HTTP 401 returns without credential enumeration.
5. **Verify Rate Limiting:**
   * Send 11 rapid failed login attempts from a test script or browser. Verify the 11th request returns HTTP 429 with a valid `Retry-After` header.
