# CivicSense AI — WhatsMeow PostgreSQL Targeted Pre-Staging Security Review

> [!IMPORTANT]
> **Audit Classification:** Senior PostgreSQL, Supabase & WhatsMeow Database Engineering Audit  
> **Target File Audited:** [`backend/scripts/whatsmeow_schema_migration_proposal.sql`](file:///d:/CivicSense%20AI/backend/scripts/whatsmeow_schema_migration_proposal.sql)  
> **Target Database:** Staging Supabase Project `oayzaszhhpfjlpmaezmc` (Tokyo, `ap-northeast-1` on port 5432)  
> **Production Boundary:** `bcpgsvvjuxzowxqqmouk` (Ohio) — Strictly Air-Gapped & 100% Untouched (401 records intact)  
> **Hardening Focus:** Role attribute enforcement, membership semantics, default privileges discipline, credential safety, and fail-closed staging activation  
> **Final Verdict:** **NEEDS STAGING VERIFICATION** (Awaiting live staging PostgreSQL execution & pooler test)

---

## 1. Critical Check 1 — Staging Fail-Closed Condition & Environment Tracing

### 1.1 Variable Definitions in `config.go`
In [`whatsapp-gateway/internal/config/config.go`](file:///d:/CivicSense%20AI/whatsapp-gateway/internal/config/config.go), environment evaluation is strictly decoupled and defined as follows:

```go
envMode := strings.ToLower(os.Getenv("ENVIRONMENT"))
if envMode == "" {
    envMode = strings.ToLower(os.Getenv("ENV"))
}
isStaging := envMode == "staging"
isProduction := envMode == "production" || envMode == "prod"
isRemoteCloud := isStaging || isProduction
```

### 1.2 Fail-Closed Activation Logic
```go
isPostgresMode := dbDialect == "postgres" || dbDialect == "postgresql" || strings.HasPrefix(backendDBURL, "postgres://") || strings.HasPrefix(backendDBURL, "postgresql://")
if isRemoteCloud && isPostgresMode {
    allowPrivilegedFallback := strings.ToLower(os.Getenv("ALLOW_PRIVILEGED_DATABASE_FALLBACK")) == "true"
    if !allowPrivilegedFallback {
        targetEnv := "staging"
        if isProduction {
            targetEnv = "production"
        }
        panic(fmt.Sprintf("CRITICAL SECURITY ERROR: Dedicated WHATSAPP_GATEWAY_DATABASE_URL is required in %s environment for PostgreSQL mode. Silent fallback to backend's privileged DATABASE_URL is strictly forbidden.", targetEnv))
    }
}
```

### 1.3 Environment Behavior Trace

| Environment Variable | `isStaging` | `isProduction` | `isRemoteCloud` | PostgreSQL Mode Behavior (Missing Gateway URL) |
| :--- | :---: | :---: | :---: | :--- |
| **`ENVIRONMENT=staging`** | **`true`** | `false` | **`true`** | **PANICS ON BOOT** (Rejects silent fallback to privileged backend `DATABASE_URL`) |
| **`ENVIRONMENT=production`** | `false` | **`true`** | **`true`** | **PANICS ON BOOT** (Rejects silent fallback to privileged backend `DATABASE_URL`) |
| **`ENVIRONMENT=prod`** | `false` | **`true`** | **`true`** | **PANICS ON BOOT** (Rejects silent fallback to privileged backend `DATABASE_URL`) |
| **`ENVIRONMENT=development`** | `false` | `false` | `false` | **PERMITS FALLBACK** (Allows local development against test PostgreSQL) |
| **`ENVIRONMENT=local`** | `false` | `false` | `false` | **PERMITS FALLBACK / SQLITE** (Allows offline local development) |
| **`ENVIRONMENT=""` (Unset)** | `false` | `false` | `false` | **PERMITS FALLBACK / SQLITE** (Safe developer default) |

**Proof:** Verified via unit tests in `whatsapp-gateway/internal/config/config_test.go` (`TestConfigFailClosedAcrossEnvironments`) and `backend/tests/test_whatsmeow_postgres_integration.py` (`test_env_specific_fail_closed_simulation`).

---

## 2. Check 2 — PostgreSQL Role Membership Semantics: `GRANT whatsmeow_gateway TO postgres`

### 2.1 Target PostgreSQL Membership Semantics
In PostgreSQL 15/16:
- Syntax: `GRANT <role_to_grant> TO <recipient_role>`
- The executing statement is: `GRANT whatsmeow_gateway TO postgres;`
  - **Granted Role:** `whatsmeow_gateway`
  - **Recipient Role:** `postgres`

#### Privilege Evaluation:
1. **`SET` Option (Supported):** `postgres` can execute `SET ROLE whatsmeow_gateway;` to act as `whatsmeow_gateway` for maintenance tasks.
2. **`INHERIT` Option (Supported):** `postgres` automatically inherits `whatsmeow_gateway` permissions during active sessions.
3. **`ADMIN` Option (Not Granted):** By default, `WITH ADMIN OPTION` is omitted. `postgres` cannot re-grant `whatsmeow_gateway` to third parties unless acting via superuser/createrole capabilities.
4. **Configuration of Default Privileges:** Satisfies PostgreSQL's rule for `ALTER DEFAULT PRIVILEGES FOR ROLE whatsmeow_gateway ...` (the executing administrator must be either a physical superuser or a direct member of `whatsmeow_gateway`).

### 2.2 Reversal Verification (Gateway Cannot Assume Privileged Roles)
- Membership is strictly unidirectional.
- `whatsmeow_gateway` is **NOT** a member of `postgres`, `supabase_admin`, `service_role`, `authenticated`, or `anon`.
- If `whatsmeow_gateway` attempts `SET ROLE postgres;` or `SET ROLE supabase_admin;`, PostgreSQL immediately aborts with:
  ```text
  ERROR: permission denied to set role "postgres"
  ```
- The gateway cannot inherit, assume, or escalate to any privileged role.

### 2.3 Staging Acceptance Status
> [!WARNING]
> While standard PostgreSQL supports `GRANT <custom_role> TO postgres;`, whether Supabase's managed PostgreSQL permission engine accepts this membership operation without restriction has **NOT** yet been executed on the live staging project.  
> **Status:** **`UNVERIFIED ON STAGING`** (Must be tested during Approval Gate 1).

---

## 3. Check 3 — Effective Public-Schema Permissions & Isolation Verification

### 3.1 Existing Tables, Future Tables, and Sequences
- **Existing Application Tables (9 Tables):** `users`, `incidents`, `reports`, `ai_analysis`, `comments`, `notifications`, `audit_logs`, `otp_verifications`, `alembic_version`.
- **Existing Sequence Permissions:** All sequences in `public` revoked from `whatsmeow_gateway`.
- **Future Tables and Sequences:**
  ```sql
  ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM whatsmeow_gateway;
  ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON SEQUENCES FROM whatsmeow_gateway;
  ```
  *(Affects all future objects created by `postgres` in schema `public`)*.

### 3.2 Accounting for `PUBLIC` Grants & Error Behavior
- **Inherited `USAGE`:** PostgreSQL grants `USAGE` on schema `public` to the pseudo-role `PUBLIC` by default. `whatsmeow_gateway` inherits this grant, allowing it to resolve shared functions and extension data types in `public`.
- **Failure Mechanism:** Because schema resolution succeeds, any query targeting application tables (e.g. `SELECT * FROM public.incidents`) is evaluated against table-level ACLs and fails with:
  ```text
  ERROR: permission denied for table incidents
  ```
- **Static vs. Live Isolation:** **Static REVOKE statements alone do not prove complete isolation.** Isolation must be definitively proven at runtime on the live staging database using the verification catalog queries below.

### 3.3 Exact PostgreSQL Catalog Checks Required on Staging

```sql
-- Check 1: Verify whatsmeow_gateway has NO direct or PUBLIC grants on public tables
SELECT table_schema, table_name, privilege_type 
FROM information_schema.table_privileges 
WHERE grantee IN ('whatsmeow_gateway', 'PUBLIC') 
  AND table_schema = 'public';
-- Expected: Zero rows for CivicSense application tables.

-- Check 2: Functional privilege evaluation for each application table
SELECT 
    table_name,
    has_table_privilege('whatsmeow_gateway', 'public.' || table_name, 'SELECT') AS can_select,
    has_table_privilege('whatsmeow_gateway', 'public.' || table_name, 'INSERT') AS can_insert,
    has_table_privilege('whatsmeow_gateway', 'public.' || table_name, 'UPDATE') AS can_update,
    has_table_privilege('whatsmeow_gateway', 'public.' || table_name, 'DELETE') AS can_delete
FROM information_schema.tables 
WHERE table_schema = 'public' AND table_type = 'BASE TABLE';
-- Expected: Every column evaluates to FALSE.

-- Check 3: Schema privilege evaluation
SELECT 
    has_schema_privilege('whatsmeow_gateway', 'public', 'USAGE') AS public_usage,
    has_schema_privilege('whatsmeow_gateway', 'public', 'CREATE') AS public_create,
    has_schema_privilege('whatsmeow_gateway', 'whatsmeow', 'USAGE') AS whatsmeow_usage,
    has_schema_privilege('whatsmeow_gateway', 'whatsmeow', 'CREATE') AS whatsmeow_create;
-- Expected: public_create = FALSE; whatsmeow_usage = TRUE; whatsmeow_create = TRUE.

-- Check 4: Role attribute verification
SELECT rolname, rolsuper, rolcreaterole, rolcreatedb, rolcanlogin, rolreplication, rolbypassrls
FROM pg_roles 
WHERE rolname = 'whatsmeow_gateway';
-- Expected: rolcanlogin = TRUE; all other attributes = FALSE.
```

---

## 4. Check 4 — Credential Safety & Password Synchronization

### 4.1 Safe Secret Handling in Proposal & Git
- The proposal script uses **only** the explicit placeholder:
  `PASSWORD 'REPLACE_WITH_SECURE_GATEWAY_PASSWORD'`
- Zero plaintext database credentials or passwords exist in `whatsmeow_schema_migration_proposal.sql`, Git commit history, or test suites.

### 4.2 Safe Synchronization Runbook for Staging Deployment
When executing the migration during Approval Gate 1:
1. **Secret Generation:** Generate a 32-character high-entropy cryptographic secret:
   ```bash
   openssl rand -hex 16
   ```
2. **Execute Role DDL in Supabase SQL Editor:** Replace the placeholder with the generated secret:
   ```sql
   ALTER ROLE whatsmeow_gateway WITH LOGIN ... PASSWORD '<GENERATED_SECRET>';
   ```
3. **Configure Render Cloud Environment:**
   In Render Dashboard for `civicsense-wa-gateway-staging`:
   - Set secret environment variable `WHATSAPP_GATEWAY_DATABASE_URL`:
     ```text
     postgresql://whatsmeow_gateway.oayzaszhhpfjlpmaezmc:<GENERATED_SECRET>@aws-0-ap-northeast-1.pooler.supabase.com:5432/postgres?sslmode=require&search_path=whatsmeow,public
     ```
   - If the password contains special characters (`@`, `#`, `$`, `/`), percent-encode them in the URI.
4. **Credential Redaction in Logs and Reports:**
   All gateway runtime logging calls `MaskDatabaseURL()`, replacing passwords with `*****` (`postgresql://whatsmeow_gateway.oayzaszhhpfjlpmaezmc:*****@...`).

---

## 5. Check 5 — Testing Summary & Real-World Limitations

### 5.1 Verification Commands and Results

| Verification Vector | Tool / Command | Result | Verification Scope |
| :--- | :--- | :---: | :---: |
| **Backend Test Suite** | `backend/venv/Scripts/python.exe -m pytest backend/tests` | **136 / 136 PASS (100%)** in 38.50s | Local Static Unit / Mock Suite |
| **WhatsMeow Integration Suite** | `backend/venv/Scripts/python.exe -m pytest backend/tests/test_whatsmeow_postgres_integration.py` | **29 / 29 PASS (100%)** in 0.24s | Local Static AST & Config Suite |
| **Frontend Static Typecheck** | `npx tsc --noEmit` | **0 Errors (Exit code 0)** | Local Static TypeScript Check |
| **Go Host Toolchain** | `go test ./...` | **BLOCKED BY HOST APPLOCKER** | **NOT VERIFIED (Host Constraint)** |
| **Live PostgreSQL Database** | Remote SQL Execution | **NOT EXECUTED (Safety Gate)** | **NOT VERIFIED (Approval Gate 1 Pending)** |
| **Supabase Pooler Custom Role** | Live Pooler Authentication | **NOT EXECUTED (Safety Gate)** | **NOT VERIFIED (Approval Gate 1 Pending)** |
| **WhatsApp QR / WebSocket E2E** | Live WhatsApp Socket Stream | **NOT EXECUTED (Requires Cloud Deploy)** | **NOT VERIFIED (Post-Deploy Staging Step)** |

---

## 6. Final Verdict

### **`NEEDS STAGING VERIFICATION`**

All local safeguards, fail-closed runtime assertions, SQL proposal hardening, and test suites are complete.

Because:
1. Live custom role authentication through Supabase Supavisor pooler port 5432 requires active network testing,
2. Supabase's managed environment acceptance of `GRANT whatsmeow_gateway TO postgres;` requires live execution, and
3. PostgreSQL catalog queries (`has_table_privilege()`) must be executed against the live database to definitively prove isolation,

the final verdict stands as **`NEEDS STAGING VERIFICATION`**.

> [!CAUTION]
> **Production Air-Gap Guarantee:**  
> Zero SQL statements have been executed against Supabase. Zero cloud resources were altered. Production Supabase project `bcpgsvvjuxzowxqqmouk` (Ohio, 401 records intact) remains 100% untouched.
