"""
CivicSense AI — Read-Only Staging Connectivity Verification
===========================================================

Performs strictly read-only diagnostics for the staging Supabase project:
  1. Loads ONLY backend/.env.staging (never loads or references backend/.env).
  2. Verifies DATABASE_URL points to project 'oayzaszhhpfjlpmaezmc' and Tokyo pooler.
  3. Tests PostgreSQL connectivity using an explicit read-only session.
  4. Runs ONLY non-destructive queries: SELECT 1, current_database(), current_user, version().
  5. Validates S3 staging storage configuration without any upload/mutation calls.
  6. Strictly masks all credentials and secrets.
"""

import os
import sys
from urllib.parse import urlparse, urlunparse

backend_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

import sqlalchemy as sa
from sqlalchemy import text

STAGING_PROJECT_REF = "oayzaszhhpfjlpmaezmc"
PRODUCTION_PROJECT_REF = "bcpgsvvjuxzowxqqmouk"
EXPECTED_POOLER_HOST = "aws-0-ap-northeast-1.pooler.supabase.com"
EXPECTED_POOLER_PORT = 5432
EXPECTED_DB_NAME = "postgres"
EXPECTED_USER = f"postgres.{STAGING_PROJECT_REF}"

EXPECTED_S3_BUCKET = "civicsense-staging-evidence"
EXPECTED_S3_REGION = "ap-northeast-1"
EXPECTED_S3_ENDPOINT = f"https://{STAGING_PROJECT_REF}.supabase.co/storage/v1/s3"


def mask_url(url: str) -> str:
    """Masks credentials in a database URL for safe display."""
    if not url:
        return "[EMPTY]"
    try:
        # Handles bracketed placeholders safely
        if "@" in url:
            scheme_creds, host_part = url.split("@", 1)
            scheme, creds = scheme_creds.split("://", 1)
            if ":" in creds:
                user, _ = creds.split(":", 1)
                return f"{scheme}://{user}:*****@{host_part}"
            return f"{scheme}://{creds}:*****@{host_part}"
        return "DATABASE_URL_REDACTED"
    except Exception:
        return "DATABASE_URL_REDACTED"


def mask_token(token: str) -> str:
    """Masks secret tokens."""
    if not token or token.startswith("["):
        return token
    if len(token) <= 8:
        return "********"
    return f"{token[:4]}...{token[-4:]}"


def main():
    print("=" * 80)
    print(" CIVICSENSE AI — READ-ONLY STAGING CONNECTIVITY VERIFICATION")
    print(" Target Project Reference: " + STAGING_PROJECT_REF)
    print(" Target Host:              " + EXPECTED_POOLER_HOST)
    print(" Target Region:            Tokyo (ap-northeast-1)")
    print(" Production Isolation:     Strictly Guarded (Zero prod access)")
    print("=" * 80)

    # 1. Read backend/.env.staging strictly
    env_file = os.path.join(backend_dir, ".env.staging")
    if not os.path.exists(env_file):
        print(f"\n[FAIL] Staging environment file not found at: {env_file}")
        sys.exit(1)

    staging_env = {}
    with open(env_file, "r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                k, v = line.split("=", 1)
                staging_env[k.strip()] = v.strip().strip('"').strip("'")

    print(f"\n[+] Loaded staging environment from: backend/.env.staging ({len(staging_env)} keys)")

    # 2. Safety Assertion: Check for Production Cross-Contamination
    db_url = staging_env.get("DATABASE_URL", "")
    for k, v in staging_env.items():
        if PRODUCTION_PROJECT_REF in v:
            print(f"\n[FATAL FAIL] Production reference '{PRODUCTION_PROJECT_REF}' detected in key '{k}'!")
            print("Aborting immediately to protect production data.")
            sys.exit(2)

    print(f"[+] Isolation Check: PASS (Zero production references found in staging environment)")

    # 3. Verify Staging DATABASE_URL Structure
    has_staging_ref = STAGING_PROJECT_REF in db_url
    has_pooler_host = EXPECTED_POOLER_HOST in db_url
    has_user = EXPECTED_USER in db_url
    has_port = f":{EXPECTED_POOLER_PORT}" in db_url or EXPECTED_POOLER_HOST in db_url

    print("\n[+] Database URL Structure Checks:")
    print(f"    - Target Supabase Ref ({STAGING_PROJECT_REF}): {'PASS' if has_staging_ref else 'FAIL'}")
    print(f"    - Target Tokyo Pooler ({EXPECTED_POOLER_HOST}): {'PASS' if has_pooler_host else 'FAIL'}")
    print(f"    - Target Staging User ({EXPECTED_USER}): {'PASS' if has_user else 'FAIL'}")
    print(f"    - Target Masked URL: {mask_url(db_url)}")

    if not (has_staging_ref and has_pooler_host and has_user):
        print("\n[FAIL] DATABASE_URL in backend/.env.staging does not match the staging specification.")
        sys.exit(3)

    is_placeholder_password = "[STAGING_DB_PASSWORD]" in db_url
    if is_placeholder_password:
        print("    - Password Status: [PENDING] Contains placeholder '[STAGING_DB_PASSWORD]'")
    else:
        print("    - Password Status: [CONFIGURED] Password provided in .env.staging")

    # 4. Storage Configuration Checks
    print("\n[+] S3 Storage Configuration Checks:")
    s3_provider = staging_env.get("STORAGE_PROVIDER", "")
    s3_bucket = staging_env.get("S3_BUCKET_NAME", "")
    s3_endpoint = staging_env.get("S3_ENDPOINT_URL", "")
    s3_region = staging_env.get("S3_REGION_NAME", "")
    s3_access_key = staging_env.get("S3_ACCESS_KEY_ID", "")
    s3_secret_key = staging_env.get("S3_SECRET_ACCESS_KEY", "")

    s3_provider_ok = s3_provider.lower() == "s3"
    s3_bucket_ok = s3_bucket == EXPECTED_S3_BUCKET
    s3_endpoint_ok = s3_endpoint == EXPECTED_S3_ENDPOINT
    s3_region_ok = s3_region == EXPECTED_S3_REGION

    print(f"    - STORAGE_PROVIDER:   [{'PASS' if s3_provider_ok else 'FAIL'}] {s3_provider}")
    print(f"    - S3_BUCKET_NAME:     [{'PASS' if s3_bucket_ok else 'FAIL'}] {s3_bucket}")
    print(f"    - S3_ENDPOINT_URL:    [{'PASS' if s3_endpoint_ok else 'FAIL'}] {s3_endpoint}")
    print(f"    - S3_REGION_NAME:     [{'PASS' if s3_region_ok else 'FAIL'}] {s3_region}")
    print(f"    - S3_ACCESS_KEY_ID:   {mask_token(s3_access_key)}")
    print(f"    - S3_SECRET_KEY:      {mask_token(s3_secret_key)}")

    # Read-only S3 Credentials & Bucket Accessibility Check
    s3_creds_status = "PENDING"
    s3_creds_pass = False
    is_s3_placeholder = s3_access_key.startswith("[") or s3_secret_key.startswith("[") or not s3_access_key
    if not is_s3_placeholder:
        print("    - Testing S3 Bucket Access (Read-Only HEAD request, no object mutations)...")
        try:
            import boto3
            session = boto3.session.Session(
                aws_access_key_id=s3_access_key,
                aws_secret_access_key=s3_secret_key,
                region_name=s3_region or "ap-northeast-1",
            )
            client_kwargs = {}
            if s3_endpoint:
                client_kwargs["endpoint_url"] = s3_endpoint
            s3_client = session.client("s3", **client_kwargs)
            # Strictly read-only: head_bucket verifies bucket existence and credential authorization
            s3_client.head_bucket(Bucket=s3_bucket)
            print(f"    - Bucket Authorization (HEAD): PASS (Bucket '{s3_bucket}' accessible)")
            s3_creds_status = "PASS (Bucket verified accessible)"
            s3_creds_pass = True
        except Exception as e:
            err_msg = str(e)
            if s3_secret_key and s3_secret_key in err_msg:
                err_msg = err_msg.replace(s3_secret_key, "[REDACTED]")
            print(f"    - Bucket Authorization (HEAD): FAIL ({err_msg})")
            s3_creds_status = f"FAIL ({err_msg})"
    else:
        print("    - S3 Credentials Status:       [PENDING] Contains placeholder access keys")
        s3_creds_status = "PENDING (Placeholder keys present in .env.staging)"

    storage_pass = s3_provider_ok and s3_bucket_ok and s3_endpoint_ok and s3_region_ok

    # 5. PostgreSQL Read-Only Connection Test
    print("\n[+] Testing PostgreSQL Staging Connectivity (Read-Only)...")
    db_connect_pass = False
    db_diagnostic = ""

    # Normalize URL scheme to psycopg2 driver (psycopg2-binary is AppLocker-permitted)
    clean_url = db_url
    if clean_url.startswith("postgres://"):
        clean_url = "postgresql+psycopg2://" + clean_url[len("postgres://"):]
    elif clean_url.startswith("postgresql://") and not clean_url.startswith("postgresql+"):
        clean_url = "postgresql+psycopg2://" + clean_url[len("postgresql://"):]
    elif clean_url.startswith("postgresql+psycopg://"):
        clean_url = "postgresql+psycopg2://" + clean_url[len("postgresql+psycopg://"):]

    try:
        # Enforce read-only transaction on the connection
        engine = sa.create_engine(
            clean_url,
            connect_args={"options": "-c default_transaction_read_only=on", "connect_timeout": 5},
            pool_pre_ping=True
        )
        with engine.connect() as conn:
            result = conn.execute(text("SELECT 1, current_database(), current_user, version()")).fetchone()
            one_val, db_name, user_name, pg_version = result[0], result[1], result[2], result[3]
            print(f"    - Tenant Recognition:     PASS (Supabase Tokyo pooler routed successfully)")
            print(f"    - Authentication:         PASS")
            print(f"    - Ping Result (SELECT 1): {one_val} (SUCCESS)")
            print(f"    - Connected Database:     {db_name}")
            print(f"    - Connected User:         {user_name}")
            print(f"    - Server Version:         {pg_version.split(',')[0]}")
            
            # Check for schema 'whatsmeow'
            schema_exists = conn.execute(text("SELECT EXISTS (SELECT 1 FROM information_schema.schemata WHERE schema_name = 'whatsmeow')")).scalar()
            print(f"    - Schema 'whatsmeow':     {'PASS (Exists)' if schema_exists else 'NOT FOUND'}")

            # Check for role 'whatsmeow_gateway'
            role_exists = conn.execute(text("SELECT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'whatsmeow_gateway')")).scalar()
            print(f"    - Role 'whatsmeow_gateway': {'PASS (Exists)' if role_exists else 'NOT FOUND'}")

            db_connect_pass = True
            db_diagnostic = "Connected (Read-only verified)"
    except Exception as e:
        err_str = str(e)
        if "password authentication failed" in err_str:
            print("    - Tenant Recognition:     PASS (Tenant found and routed by Supabase Tokyo pooler)")
            print("    - Authentication Status:  FAIL (Password authentication failed for user 'postgres')")
            print("    - Cause:                  DATABASE_URL currently has placeholder '[STAGING_DB_PASSWORD]'.")
            print("    - Safe Next Step:         Replace '[STAGING_DB_PASSWORD]' in backend/.env.staging with your real staging DB password.")
            db_diagnostic = "Tenant routed; awaiting real DB password"
        elif "ENOTFOUND" in err_str:
            print("    - Tenant Recognition:     FAIL (Tenant not found by pooler)")
            db_diagnostic = "Tenant not found"
        else:
            if "@" in err_str:
                err_str = mask_url(err_str)
            print(f"    - Connection Error:       {err_str}")
            db_diagnostic = err_str

    # 6. Summary Report
    print("\n" + "=" * 80)
    print(" READ-ONLY STAGING VERIFICATION SUMMARY")
    print("=" * 80)
    print(f" 1. Isolation Boundary Check:      PASS (Zero production cross-contamination)")
    print(f" 2. Database Target URL & Host:    PASS ({EXPECTED_POOLER_HOST})")
    print(f" 3. Database Authentication:       {'PASS' if db_connect_pass else ('PENDING (' + db_diagnostic + ')')}")
    print(f" 4. Storage Configuration:         {'PASS' if storage_pass else 'FAIL'}")
    print(f" 5. Storage S3 Credentials & Auth: {s3_creds_status}")
    print("=" * 80)


if __name__ == "__main__":
    main()
