# CivicSense AI OS v5.0 — Persistent Storage Provider Decision
**Document Version:** 1.0  
**Audit Date:** 2026-11-12  
**Evaluation Scope:** Production Evidence Persistence, S3 Compatibility, Hosting Constraints & Cost Optimization  
**Mode:** STRICT READ-ONLY INSPECTION  

---

## 1. Executive Summary

In production environments (`ENVIRONMENT=production`), the CivicSense AI backend explicitly forbids local filesystem storage (`STORAGE_PROVIDER=local`) because Render web services operate on ephemeral container instances that wipe all uploaded files upon restart.

This audit evaluates the codebase's persistent storage architecture across three S3-compatible providers: **Supabase Storage**, **Cloudflare R2**, and **AWS S3**.

### Final Recommendation:
> **Adopt Supabase Storage via its S3-Compatible Gateway.**  
> It is 100% compatible with the current codebase, requires **zero code changes**, incurs **\$0 additional cost** (leveraging the 1 GB included storage in the project's existing Supabase account), and consolidates relational data and evidence persistence under a single vendor dashboard.

---

## 2. Codebase Implementation & S3 Compatibility Audit

### Code Architecture (`backend/app/services/storage_service.py`)
1. **Storage Provider Abstraction:**
   - Defines `BaseStorageProvider` interface with abstract methods: `store_image()`, `get_image_url()`, `generate_presigned_url()`, and `delete_image()`.
   - `get_storage_provider()` factory (Lines 292–310) strictly allows two provider types: `"local"` and `"s3"`.
2. **S3 Implementation (`S3StorageProvider`, Lines 141–290):**
   - Built on Python's standard `boto3` library (`boto3.session.Session`).
   - Supports custom S3 endpoints via `endpoint_url` passed directly into `session.client("s3", **client_kwargs)` (Line 202).
   - Generates AWS SigV4 presigned GET URLs (`generate_presigned_url`) for authenticated, time-limited evidence access (Lines 250–274).
   - Operates entirely on random server-generated object keys (`uploads/img_<random_hex>.ext`), preventing filename collisions and path traversal attacks.
3. **Production Guard in `backend/app/config.py` (Lines 217–235):**
   - When `ENVIRONMENT=production`, setting `STORAGE_PROVIDER=local` throws `RuntimeError` on startup.
   - Requires `STORAGE_PROVIDER=s3` and enforces that `S3_BUCKET_NAME`, `S3_ACCESS_KEY_ID`, and `S3_SECRET_ACCESS_KEY` are present and non-empty.

---

## 3. Seven Core Assessment Questions

### Question 1: Which S3-compatible storage providers are actually supported by the current code?
The code does not hardcode vendor-specific AWS URLs. Because `S3StorageProvider` accepts `S3_ENDPOINT_URL` and passes it to `boto3.client('s3', endpoint_url=...)`, any provider implementing the standard S3 API with SigV4 authentication is supported:
- **Supabase Storage** (via S3 endpoint `https://<project-ref>.supabase.co/storage/v1/s3`)
- **Cloudflare R2** (via S3 endpoint `https://<account-id>.r2.cloudflarestorage.com`)
- **AWS S3** (native AWS S3 endpoints)
- **MinIO / Ceph / Wasabi / Backblaze B2** (via custom endpoint)

---

### Question 2: Can Supabase Storage work with the existing implementation?
**YES, 100%.**  
Supabase provides an S3-compatible API gateway on top of its storage infrastructure. Because the backend already uses `boto3` with configurable `endpoint_url`, `put_object`, `delete_object`, and presigned URL generation work out of the box with Supabase Storage.

---

### Question 3: Does Supabase Storage require S3 credentials, an endpoint, bucket configuration, or code changes?
- **S3 Credentials:** **YES.** It requires dedicated S3 Access Keys (Access Key ID and Secret Access Key) generated in the Supabase Dashboard under *Project Settings -> Storage -> S3 Access Keys*. (It does *not* accept the Supabase `anon` or `service_role` JWTs, as `boto3` requires AWS SigV4 credentials).
- **Endpoint:** **YES.** Requires `S3_ENDPOINT_URL=https://<project_ref>.supabase.co/storage/v1/s3`.
- **Bucket Configuration:** **YES.** A bucket (e.g., `civicsense-evidence`) must be created in the Supabase Storage dashboard.
- **Code Changes:** **NO.** Zero code modifications are required.

---

### Question 4: Which exact environment variable names are required?
The following environment variables in `backend/app/config.py` must be configured in Render:

| Environment Variable | Description | Example Value for Supabase Storage |
| :--- | :--- | :--- |
| `STORAGE_PROVIDER` | Mandatory provider selector | `s3` |
| `S3_BUCKET_NAME` | Storage bucket name | `civicsense-evidence` |
| `S3_ENDPOINT_URL` | S3 Gateway Endpoint | `https://<project-ref>.supabase.co/storage/v1/s3` |
| `S3_ACCESS_KEY_ID` | Supabase S3 Access Key ID | `<generated_supabase_s3_key>` |
| `S3_SECRET_ACCESS_KEY` | Supabase S3 Secret Key | `<generated_supabase_s3_secret>` |
| `S3_REGION_NAME` | Region of Supabase project | `ap-south-1` *(matches Mumbai AWS cluster)* |
| `S3_PRESIGNED_EXPIRATION_SECONDS` | Presigned URL TTL | `900` *(15 minutes, default)* |

---

### Question 5: Can existing uploaded evidence be migrated safely later?
**YES, completely safely.**
1. **Existing Local Evidence:** The 24 local files in `backend/uploads/` can be migrated to the remote S3 bucket under the `uploads/` prefix using the standard AWS CLI:
   ```bash
   aws s3 cp backend/uploads/ s3://civicsense-evidence/uploads/ --recursive --endpoint-url https://<project-ref>.supabase.co/storage/v1/s3
   ```
2. **Database Backward Compatibility:**
   - In `backend/app/routers/incidents.py` (Lines 526–533), `get_incident_photo` automatically handles legacy relative paths:
     ```python
     elif photo_ref.startswith("/uploads/"):
         key = photo_ref.replace("/uploads/", "uploads/")
     ```
   - External URLs (such as sample Unsplash links) are detected on Lines 513–521 and redirected via HTTP 307 without touching S3.
3. **Zero Schema Migration:** Storing S3 object keys or presigned URLs requires no alteration to the `incidents.photo_url` column or database schema.

---

### Question 6: Do uploaded files remain accessible after Render restarts?
- **With `STORAGE_PROVIDER=local`:** **NO.** Render web services run on ephemeral containers. Whenever the service restarts (due to redeployment, crashes, or inactivity sleep on starter tiers), the container filesystem is re-imaged, destroying `backend/uploads/`.
- **With `STORAGE_PROVIDER=s3` (Supabase / R2 / AWS):** **YES.** All image bytes are transferred immediately to the durable cloud object store over HTTPS. Render container restarts or scaling events have zero impact on evidence durability.

---

### Question 7: Can storage be tested locally without changing production?
**YES.**
1. **Development Isolation:** Local development and unit tests default to `STORAGE_PROVIDER=local`, isolating all tests to local disk without touching production.
2. **Staging / Separate Bucket:** A separate test bucket (e.g. `civicsense-dev-test`) can be created in Supabase to test S3 operations locally before applying credentials to the Render dashboard.
3. **Mock Client Injection:** `S3StorageProvider` supports mock client injection (`s3_client=mock_client`), enabling offline CI testing without network calls.

---

## 4. Provider Comparison: Supabase vs Cloudflare R2 vs AWS S3

| Feature / Metric | Supabase Storage (S3 API) | Cloudflare R2 | AWS S3 (Standard) |
| :--- | :--- | :--- | :--- |
| **Code Compatibility** | **100% Native** (`boto3` + endpoint) | **100% Native** (`boto3` + endpoint) | **100% Native** (`boto3`) |
| **Code Changes Needed** | **0 lines** | **0 lines** | **0 lines** |
| **Free Tier Storage** | **1 GB free** (included in DB plan) | **10 GB free** / month | 5 GB free (1st year only) |
| **Egress / Bandwidth Fees** | Free up to 2 GB/month | **\$0.00 / GB (Free egress forever)** | \$0.09 / GB (Paid egress) |
| **Operations Fees** | Free tier included | 10M read / 1M write free/mo | \$0.005/1K PUT, \$0.0004/1K GET |
| **Infrastructure Footprint** | **Consolidated** (Same project as DB) | Separate 3rd-party account | Separate 3rd-party account |
| **Setup Complexity** | **Very Low** (Enable S3 keys in UI) | Moderate (Create R2 token & card) | High (IAM policies, user keys) |
| **Production Risk** | **Lowest** (No new vendor billing) | Low | Medium (Surprise egress bills) |

---

## 5. Strategic Recommendation & Justification

### Selected Option: **Supabase Storage (via S3 Protocol)**

#### Primary Reasons:
1. **Vendor Consolidation:** CivicSense AI is already committed to Supabase for its PostgreSQL database (12 tables, 401 records, located in `aws-0-ap-south-1`). Adding Supabase Storage eliminates the need to create, manage, and secure an additional cloud account.
2. **Zero Marginal Cost:** The 1 GB included storage in the existing free Supabase tier is sufficient to store approximately **2,500 to 5,000 compressed civic defect photos** (typical photo size: 200–400 KB).
3. **Turnkey Configuration:** Setup requires only creating a bucket and generating S3 credentials in the existing Supabase dashboard.
4. **Seamless Future Portability:** Because the implementation adheres strictly to the generic S3 API via `boto3`, if the city expands beyond 1 GB in the future, the platform can be pointed to **Cloudflare R2** simply by changing the `S3_ENDPOINT_URL` and credentials in Render without modifying a single line of backend code.

---

## 6. Implementation Runbook (No Code Changes Required)

When ready to enable persistent storage in Render:

1. **In Supabase Dashboard (`https://supabase.com/dashboard/project/<project-ref>`):**
   - Navigate to **Storage** -> Click **New Bucket** -> Name it `civicsense-evidence` -> Set to **Private**.
   - Navigate to **Project Settings** -> **Storage** -> **S3 Access Keys**.
   - Click **Generate new access key** -> Copy **Access Key ID**, **Secret Access Key**, and the **S3 Endpoint URL** (`https://<project-ref>.supabase.co/storage/v1/s3`).

2. **In Render Dashboard (`civicsense-backend`):**
   Add or update these Environment Variables:
   ```env
   STORAGE_PROVIDER=s3
   S3_BUCKET_NAME=civicsense-evidence
   S3_ENDPOINT_URL=https://<project-ref>.supabase.co/storage/v1/s3
   S3_ACCESS_KEY_ID=<your-access-key-id>
   S3_SECRET_ACCESS_KEY=<your-secret-access-key>
   S3_REGION_NAME=ap-south-1
   ```

3. **Verify Health:**
   - Restart the Render service. The backend will validate `validate_production_security(settings)` without raising the ephemeral storage error.
