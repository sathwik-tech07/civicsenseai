"""
CivicSense AI - Secure Offline Initial Administrator Bootstrap Utility
=====================================================================

Provides a secure, out-of-band administrative mechanism to initialize the first
privileged user (admin or commissioner) in a freshly migrated staging database.

Security Guarantees:
  1. Offline CLI execution only - no public HTTP endpoints.
  2. Zero hardcoded credentials or passwords.
  3. Demo-account seeding is completely bypassed.
  4. Role boundary strictly enforced (only 'admin' or 'commissioner').
  5. Password complexity enforced: min 12 characters, max 72 UTF-8 bytes (Bcrypt boundary),
     must include uppercase, lowercase, number, and special symbol.
  6. PostgreSQL transaction-level advisory lock (BOOTSTRAP_ADVISORY_LOCK_KEY) serializes
     concurrent bootstrap attempts across multiple worker processes.
  7. Permanent self-locking: Refuses execution if any user with role 'admin' or
     'commissioner' already exists in the database.
  8. Refuses to overwrite or hijack any existing user account (collision protection).
  9. Strict environment refusal: Refuses execution if ANY authoritative source
     (supplied argument, os.environ["ENVIRONMENT"], os.environ["ENV"], or settings.ENVIRONMENT)
     identifies production or prod. A caller cannot override production by passing environment="staging".
     Fails closed when environment resolution is ambiguous or conflicting.
  10. Displays resolved environment and safely masked database destination BEFORE
      verifying explicit staging confirmation (--confirm or CONFIRM_BOOTSTRAP=yes).
  11. Complete credential redaction: Database passwords, plain passwords, and hashes
      are never logged or printed to stdout/stderr.
  12. Reads BOOTSTRAP_ADMIN_PASSWORD using os.environ.pop() immediately upon ingestion.
      Interactive getpass() remains the preferred credential-entry method.
      Note: Python cannot guarantee complete zeroization of immutable strings in memory,
      but popping the environment variable immediately prevents child processes and
      subsequent environment inspections from reading it.
  13. All database modifications are executed within an atomic transaction.

Audit Capability Note:
  The existing AuditLog model (app.models.workflow.AuditLog) defines a non-nullable
  foreign key constraint referencing incidents.id. In PostgreSQL, inserting an audit
  record with a synthetic incident ID (e.g. 'SYSTEM-BOOTSTRAP') would violate foreign
  key integrity because no incident records exist in a fresh database.
  Therefore, this utility relies on secure, structured operational stdout/stderr
  logs rather than writing invalid audit table rows.
"""

import os
import sys
import re
import uuid
import getpass
import logging
import argparse
import datetime
from urllib.parse import urlparse, urlunparse
from typing import Optional, Dict, Any, Tuple

# Ensure backend root is on sys.path
backend_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

import sqlalchemy as sa
from sqlalchemy.orm import Session

from app.config import settings
from app.database import SessionLocal, normalize_database_url
from app.models.user import User
from app.utils.security import get_password_hash, MAX_BCRYPT_PASSWORD_BYTES

logger = logging.getLogger("civicsense.bootstrap")

# Stable 64-bit integer advisory lock key for PostgreSQL
BOOTSTRAP_ADVISORY_LOCK_KEY = 428491024

ALLOWED_ROLES = {"admin", "commissioner"}
MIN_PASSWORD_LENGTH = 12

EMAIL_REGEX = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


class BootstrapError(Exception):
    """Base exception for admin bootstrap failures."""
    pass


class BootstrapSecurityError(BootstrapError):
    """Raised when security boundaries or lock assertions fail."""
    pass


class BootstrapValidationError(BootstrapError):
    """Raised when credential validation rules fail."""
    pass


def mask_database_url(raw_url: str) -> str:
    """Safely masks credentials in database connection URLs for logging and display."""
    if not raw_url:
        return "EMPTY_DATABASE_URL"
    try:
        parsed = urlparse(raw_url)
        if parsed.password:
            user_part = parsed.username or ""
            netloc = f"{user_part}:*****@{parsed.hostname}"
            if parsed.port:
                netloc += f":{parsed.port}"
            return urlunparse(parsed._replace(netloc=netloc))
        return raw_url
    except Exception:
        return "DATABASE_URL_REDACTED"


def validate_environment(supplied_env: Optional[str] = None) -> str:
    """
    Validates authoritative environment sources and refuses execution in production.
    Inspects:
      1. Supplied environment parameter (if provided)
      2. Ambient os.environ["ENVIRONMENT"]
      3. Ambient os.environ["ENV"]
      4. settings.ENVIRONMENT

    Rules:
      - Rejects if ANY authoritative source identifies 'production' or 'prod'.
      - A caller cannot override production by supplying environment='staging'.
      - Fails closed if environment resolution is missing or empty.
      - Fails closed if explicit non-empty environment sources conflict (e.g. 'staging' vs 'development').
      - Returns the canonical non-production environment name (e.g. 'staging').
    """
    all_sources: Dict[str, str] = {}
    if supplied_env is not None and supplied_env.strip():
        all_sources["supplied_parameter"] = supplied_env.strip()
    if os.getenv("ENVIRONMENT") and os.getenv("ENVIRONMENT").strip():
        all_sources["os_environ_ENVIRONMENT"] = os.getenv("ENVIRONMENT").strip()
    if os.getenv("ENV") and os.getenv("ENV").strip():
        all_sources["os_environ_ENV"] = os.getenv("ENV").strip()
    settings_env = getattr(settings, "ENVIRONMENT", None)
    if settings_env and settings_env.strip():
        all_sources["settings_ENVIRONMENT"] = settings_env.strip()

    # Rule 1: Check if ANY source identifies production or prod (FAIL CLOSED IMMEDIATELY)
    for src_name, val in all_sources.items():
        if val.lower() in ("production", "prod"):
            raise BootstrapSecurityError(
                f"CRITICAL SECURITY REFUSAL: Production environment detected via {src_name} ('{val}'). "
                "Bootstrap utility is strictly forbidden in production."
            )

    # Rule 2: Fail closed if no environment source is present
    if not all_sources:
        raise BootstrapSecurityError(
            "CRITICAL SECURITY REFUSAL: Environment resolution failed (no environment specified). "
            "Cannot proceed without explicit staging/development environment."
        )

    # Rule 3: Fail closed on conflicting explicit environment specifications
    # Explicit sources: supplied parameter, os.environ["ENVIRONMENT"], os.environ["ENV"]
    explicit_sources: Dict[str, str] = {}
    if "supplied_parameter" in all_sources:
        explicit_sources["supplied_parameter"] = all_sources["supplied_parameter"]
    if "os_environ_ENVIRONMENT" in all_sources:
        explicit_sources["os_environ_ENVIRONMENT"] = all_sources["os_environ_ENVIRONMENT"]
    if "os_environ_ENV" in all_sources:
        explicit_sources["os_environ_ENV"] = all_sources["os_environ_ENV"]

    if explicit_sources:
        normalized_explicit = {
            "development" if v.lower() in ("dev", "development") else ("testing" if v.lower() in ("test", "testing") else v.lower())
            for v in explicit_sources.values()
        }
        if len(normalized_explicit) > 1:
            details = ", ".join(f"{k}='{v}'" for k, v in explicit_sources.items())
            raise BootstrapSecurityError(
                f"CRITICAL SECURITY REFUSAL: Conflicting environment specifications detected: {details}. "
                "Resolution is ambiguous; failing closed."
            )
        resolved = list(normalized_explicit)[0]
    else:
        # Fallback to settings.ENVIRONMENT if no explicit sources were supplied
        fallback = all_sources["settings_ENVIRONMENT"].lower()
        resolved = "development" if fallback in ("dev", "development") else ("testing" if fallback in ("test", "testing") else fallback)

    return resolved


def resolve_and_display_target(environment: Optional[str] = None) -> Tuple[str, str]:
    """
    Resolves the effective environment and configured database target URL,
    prints safely redacted target information to stdout, and validates that
    the target was identified safely.
    """
    effective_env = validate_environment(environment)
    raw_db_url = getattr(settings, "DATABASE_URL", "") or os.getenv("DATABASE_URL", "")
    if not raw_db_url or not raw_db_url.strip():
        raise BootstrapSecurityError(
            "CRITICAL SECURITY REFUSAL: Target database URL could not be safely identified. "
            "DATABASE_URL is missing or empty."
        )

    normalized_url = normalize_database_url(raw_db_url.strip())
    masked_url = mask_database_url(normalized_url)

    if "DATABASE_URL_REDACTED" in masked_url and "@" in raw_db_url and not masked_url.startswith("postgresql"):
        raise BootstrapSecurityError(
            "CRITICAL SECURITY REFUSAL: Unable to safely redact database connection URL credentials."
        )

    print("=" * 70)
    print("CivicSense AI - Target Database Identification")
    print("=" * 70)
    print(f"  Target Environment: {effective_env}")
    print(f"  Target Database:    {masked_url}")
    print("=" * 70)

    return effective_env, masked_url


def validate_email_format(email: str):
    """Validates email format."""
    clean = (email or "").strip()
    if not clean or not EMAIL_REGEX.match(clean):
        raise BootstrapValidationError(f"Invalid email format: '{clean}'. Must be a valid email address.")


def validate_role(role: str) -> str:
    """Ensures assigned role is strictly 'admin' or 'commissioner'."""
    clean = (role or "").strip().lower()
    if clean not in ALLOWED_ROLES:
        raise BootstrapValidationError(
            f"Invalid role: '{role}'. Bootstrap utility permits only privileged roles: {sorted(list(ALLOWED_ROLES))}."
        )
    return clean


def validate_password_complexity(password: str):
    """
    Enforces password complexity:
      - Minimum 12 characters
      - Maximum 72 UTF-8 bytes (Bcrypt boundary)
      - At least 1 uppercase letter
      - At least 1 lowercase letter
      - At least 1 digit
      - At least 1 special symbol
    """
    if not password:
        raise BootstrapValidationError("Password cannot be empty.")

    if len(password) < MIN_PASSWORD_LENGTH:
        raise BootstrapValidationError(
            f"Password too short ({len(password)} chars). Minimum required length is {MIN_PASSWORD_LENGTH} characters."
        )

    pw_bytes = password.encode("utf-8")
    if len(pw_bytes) > MAX_BCRYPT_PASSWORD_BYTES:
        raise BootstrapValidationError(
            f"Password exceeds cryptographic limit ({len(pw_bytes)} bytes > {MAX_BCRYPT_PASSWORD_BYTES} UTF-8 bytes)."
        )

    if not re.search(r"[A-Z]", password):
        raise BootstrapValidationError("Password must contain at least one uppercase letter (A-Z).")
    if not re.search(r"[a-z]", password):
        raise BootstrapValidationError("Password must contain at least one lowercase letter (a-z).")
    if not re.search(r"\d", password):
        raise BootstrapValidationError("Password must contain at least one numeric digit (0-9).")
    if not re.search(r"[\W_]", password):
        raise BootstrapValidationError("Password must contain at least one special symbol or punctuation character.")


def acquire_bootstrap_lock(db: Session):
    """
    Acquires a PostgreSQL transaction-level advisory lock to serialize
    bootstrap execution across multiple workers.
    In SQLite or non-PostgreSQL dialects, this is a safe no-op.
    """
    bind = db.get_bind()
    if bind.dialect.name == "postgresql":
        logger.info("Acquiring PostgreSQL transaction advisory lock (key=%d)...", BOOTSTRAP_ADVISORY_LOCK_KEY)
        db.execute(
            sa.text("SELECT pg_advisory_xact_lock(:lock_key)"),
            {"lock_key": BOOTSTRAP_ADVISORY_LOCK_KEY}
        )


def check_existing_privileged_accounts(db: Session):
    """
    Checks if any admin or commissioner user already exists in the database.
    If found, immediately raises BootstrapSecurityError to lock out repeated bootstrap.
    """
    existing = db.query(User).filter(
        User.role.in_(list(ALLOWED_ROLES))
    ).first()

    if existing:
        raise BootstrapSecurityError(
            f"SECURITY REFUSAL: A privileged account already exists in this database "
            f"(User ID: '{existing.id}', Role: '{existing.role}'). "
            "Bootstrap utility is permanently disabled once a privileged account exists."
        )


def check_email_collision(db: Session, email: str):
    """
    Checks if an account with this email already exists.
    Refuses execution to prevent overwriting or hijacking existing users.
    """
    clean_email = email.strip().lower()
    existing = db.query(User).filter(
        User.email.ilike(clean_email)
    ).first()

    if existing:
        raise BootstrapSecurityError(
            f"SECURITY REFUSAL: A user with email '{clean_email}' already exists (ID: '{existing.id}'). "
            "Bootstrap utility cannot overwrite or reset existing user accounts."
        )


def bootstrap_admin(
    email: Optional[str] = None,
    password: Optional[str] = None,
    full_name: Optional[str] = None,
    role: Optional[str] = None,
    department: Optional[str] = None,
    db: Optional[Session] = None,
    confirm: bool = False,
    environment: Optional[str] = None,
    interactive: bool = False,
) -> Dict[str, Any]:
    """
    Core administrator bootstrap logic.
    Executes transactionally, acquiring PostgreSQL advisory lock if applicable.
    Returns a sanitized dictionary containing metadata of the provisioned user.
    """
    # 1. Target identification & environment validation (displays target BEFORE confirmation)
    effective_env, masked_url = resolve_and_display_target(environment)

    # 2. Confirmation validation (must be provided after target is displayed)
    if not confirm:
        env_confirm = os.getenv("CONFIRM_BOOTSTRAP", "").lower() in ("yes", "true", "1") or \
                      os.getenv("CONFIRM_STAGING", "").lower() in ("yes", "true", "1")
        if not env_confirm:
            raise BootstrapSecurityError(
                f"SECURITY REFUSAL: Explicit staging confirmation required for environment '{effective_env}' "
                f"targeting {masked_url}. Pass --confirm flag or set CONFIRM_BOOTSTRAP=yes to proceed."
            )

    # 3. Credential ingestion
    final_email = (email or os.getenv("BOOTSTRAP_ADMIN_EMAIL") or "").strip()

    # Read and immediately scrub BOOTSTRAP_ADMIN_PASSWORD from os.environ
    # Note: Python cannot guarantee complete zeroization of immutable strings in memory,
    # but popping the environment variable immediately prevents child processes,
    # tracebacks, and subsequent environment inspections from reading it.
    env_password = os.environ.pop("BOOTSTRAP_ADMIN_PASSWORD", None) or ""
    final_password = password or env_password

    final_name = (full_name or os.getenv("BOOTSTRAP_ADMIN_FULL_NAME") or "").strip()
    final_role = (role or os.getenv("BOOTSTRAP_ADMIN_ROLE") or "admin").strip().lower()
    final_dept = (department or os.getenv("BOOTSTRAP_ADMIN_DEPARTMENT") or "").strip()

    # If interactive and values missing, prompt securely via stdin/getpass (preferred method)
    if interactive and sys.stdin.isatty():
        if not final_email:
            final_email = input("Enter administrator email: ").strip()
        if not final_role:
            role_input = input("Enter role (admin / commissioner) [admin]: ").strip().lower()
            final_role = role_input if role_input else "admin"
        if not final_name:
            name_input = input("Enter full name: ").strip()
            final_name = name_input if name_input else ("System Administrator" if final_role == "admin" else "Municipal Commissioner")
        if not final_password:
            p1 = getpass.getpass("Enter secure password (min 12 chars, upper/lower/digit/symbol): ")
            p2 = getpass.getpass("Confirm secure password: ")
            if p1 != p2:
                raise BootstrapValidationError("Password confirmation does not match.")
            final_password = p1

    if not final_name:
        final_name = "System Administrator" if final_role == "admin" else "Municipal Commissioner"
    if not final_dept:
        final_dept = "IT Operations & Infrastructure" if final_role == "admin" else "Executive Command & Municipal Administration"

    # 4. Strict input validation
    validate_email_format(final_email)
    valid_role = validate_role(final_role)
    validate_password_complexity(final_password)

    # 5. Database session resolution
    close_db = False
    if db is None:
        db = SessionLocal()
        close_db = True

    try:
        # 6. Atomic transaction execution
        logger.info("Connecting to target database: %s", masked_url)

        # Acquire lock and check existing accounts inside transaction
        acquire_bootstrap_lock(db)
        check_existing_privileged_accounts(db)
        check_email_collision(db, final_email)

        # Hash password using production bcrypt implementation
        hashed = get_password_hash(final_password)

        new_user = User(
            id=f"usr-{uuid.uuid4().hex[:8]}",
            email=final_email.lower(),
            full_name=final_name,
            hashed_password=hashed,
            role=valid_role,
            department=final_dept,
            status="active",
            is_active=True,
            created_at=datetime.datetime.utcnow(),
            updated_at=datetime.datetime.utcnow(),
        )

        db.add(new_user)
        db.commit()
        db.refresh(new_user)

        user_info = {
            "id": new_user.id,
            "email": new_user.email,
            "full_name": new_user.full_name,
            "role": new_user.role,
            "department": new_user.department,
            "status": new_user.status,
            "is_active": new_user.is_active,
            "created_at": new_user.created_at.isoformat() if new_user.created_at else None,
        }

        logger.info(
            "Initial administrator user successfully provisioned: ID=%s, email=%s, role=%s",
            user_info["id"],
            user_info["email"],
            user_info["role"],
        )
        return user_info

    except Exception as e:
        db.rollback()
        raise e
    finally:
        if close_db:
            db.close()


def main(argv=None) -> int:
    """CLI entrypoint."""
    parser = argparse.ArgumentParser(
        description="CivicSense AI - Secure Offline Initial Administrator Bootstrap Utility"
    )
    parser.add_argument("--confirm", action="store_true", help="Explicit confirmation for staging bootstrap.")
    parser.add_argument("--email", type=str, help="Administrator email address.")
    parser.add_argument("--role", type=str, choices=["admin", "commissioner"], default="admin", help="Privileged role.")
    parser.add_argument("--name", type=str, help="Full name.")
    parser.add_argument("--department", type=str, help="Department name.")

    args = parser.parse_args(argv)

    logging.basicConfig(
        level=logging.INFO,
        format="[%(levelname)s] %(asctime)s - %(name)s: %(message)s",
    )

    try:
        result = bootstrap_admin(
            email=args.email,
            role=args.role,
            full_name=args.name,
            department=args.department,
            confirm=args.confirm,
            interactive=True,
        )
        print("\n[SUCCESS] Administrator account provisioned successfully:")
        print(f"  User ID:    {result['id']}")
        print(f"  Email:      {result['email']}")
        print(f"  Full Name:  {result['full_name']}")
        print(f"  Role:       {result['role']}")
        print(f"  Department: {result['department']}")
        print(f"  Status:     {result['status']}")
        print("=" * 70)
        return 0
    except BootstrapSecurityError as se:
        print(f"\n[SECURITY REFUSAL] {se}", file=sys.stderr)
        return 1
    except BootstrapValidationError as ve:
        print(f"\n[VALIDATION ERROR] {ve}", file=sys.stderr)
        return 2
    except Exception as e:
        print(f"\n[EXECUTION ERROR] An unexpected error occurred: {type(e).__name__}: {e}", file=sys.stderr)
        return 3


if __name__ == "__main__":
    sys.exit(main())
