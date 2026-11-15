"""
CivicSense AI — Staging Backend Server Runner
============================================

Authoritative runner for launching the FastAPI backend strictly configured for the
isolated Supabase staging database and WhatsMeow gateway.

Safety Guarantees:
  1. Loads ONLY backend/.env.staging.
  2. Fail-closed: Strictly rejects production Supabase reference 'bcpgsvvjuxzowxqqmouk'.
  3. Verifies staging Supabase reference 'oayzaszhhpfjlpmaezmc' and Tokyo pooler host.
  4. Runs full production/staging security validation before server startup.
  5. Never prints secrets or raw credentials.
"""

import os
import sys
import argparse
import uvicorn

backend_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

STAGING_PROJECT_REF = "oayzaszhhpfjlpmaezmc"
PRODUCTION_PROJECT_REF = "bcpgsvvjuxzowxqqmouk"
EXPECTED_POOLER_HOST = "aws-0-ap-northeast-1.pooler.supabase.com"


def load_staging_environment() -> dict:
    staging_file = os.path.join(backend_dir, ".env.staging")
    if not os.path.isfile(staging_file):
        raise FileNotFoundError(f"Staging environment file not found at: {staging_file}")

    staging_env = {}
    with open(staging_file, "r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                k, v = line.split("=", 1)
                staging_env[k.strip()] = v.strip().strip('"').strip("'")

    # Guard against ambient production contamination
    for k, v in staging_env.items():
        if PRODUCTION_PROJECT_REF in v:
            raise ValueError(f"SECURITY VIOLATION: Production project reference detected in staging variable '{k}'!")
        os.environ[k] = v

    db_url = staging_env.get("DATABASE_URL", "")
    if STAGING_PROJECT_REF not in db_url:
        raise ValueError(f"DATABASE_URL must target staging project reference '{STAGING_PROJECT_REF}'")
    if EXPECTED_POOLER_HOST not in db_url:
        raise ValueError(f"DATABASE_URL must target Tokyo pooler '{EXPECTED_POOLER_HOST}'")

    return staging_env


def main():
    parser = argparse.ArgumentParser(description="CivicSense AI Staging Backend Runner")
    parser.add_argument("--host", default="0.0.0.0", help="Host interface (default: 0.0.0.0)")
    parser.add_argument("--port", type=int, default=8000, help="Port (default: 8000)")
    parser.add_argument("--reload", action="store_true", help="Enable auto-reload for development")
    parser.add_argument("--check-only", action="store_true", help="Validate staging configuration and exit without starting server")
    args = parser.parse_args()

    print("================================================================================")
    print(" CIVICSENSE AI — STAGING BACKEND STARTUP")
    print(f" Target Project: {STAGING_PROJECT_REF} (Tokyo ap-northeast-1)")
    print("================================================================================")

    env = load_staging_environment()
    print(f"[+] Loaded {len(env)} staging environment variables from backend/.env.staging")
    print(f"[+] Staging Isolation Barrier: PASS (Target: {STAGING_PROJECT_REF})")

    # Import settings and validate security rules
    from app.config import Settings, validate_production_security
    settings = Settings()
    validate_production_security(settings)
    print(f"[+] Security Validation: PASS (Mode: {settings.ENVIRONMENT}, Provider: {settings.WHATSAPP_PROVIDER})")
    print(f"[+] Storage Provider: {settings.STORAGE_PROVIDER} (Bucket: {settings.S3_BUCKET_NAME})")

    if args.check_only:
        print("[+] Check-only mode: Staging backend configuration is valid and ready for launch.")
        return

    print(f"[+] Launching Uvicorn on {args.host}:{args.port}...")
    uvicorn.run("app.main:app", host=args.host, port=args.port, reload=args.reload)


if __name__ == "__main__":
    main()
