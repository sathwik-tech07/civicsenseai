import os
from pydantic import BaseModel, model_validator

INSECURE_DEFAULT_SECRET = "civicsense-ai-super-secret-key-change-in-production-2026"

DEFAULT_DEV_CORS_ORIGINS = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:5174",
    "http://127.0.0.1:5174",
    "http://localhost:5175",
    "http://127.0.0.1:5175",
    "http://localhost:3000",
    "http://127.0.0.1:3000",
]

DEFAULT_TRUSTED_PROXIES = [
    "127.0.0.1",
    "::1",
    "testclient",
    "10.0.0.0/8",  # Render internal container network
]


def parse_trusted_proxies(raw: str | None) -> list[str]:
    """
    Parses comma-separated list of trusted proxy IPs or CIDR blocks.
    Defaults to loopback, testclient, and Render's internal container overlay network (10.0.0.0/8).
    Broad home/office RFC 1918 subnets (172.16.0.0/12, 192.168.0.0/16) are NOT trusted by default.
    """
    if raw is not None and raw.strip():
        return [token.strip() for token in raw.split(",") if token.strip()]
    return list(DEFAULT_TRUSTED_PROXIES)


def parse_cors_origins(raw: str | None, is_production: bool = False) -> list[str]:
    """
    Parses comma-separated CORS origins from environment or configuration.
    - Strips leading/trailing whitespace.
    - Strips trailing slashes from origin URLs.
    - Preserves single '*' without slash for development/testing.
    - In production, empty or missing configuration returns empty list (validated by validate_production_security).
    - In non-production, missing or empty configuration falls back to DEFAULT_DEV_CORS_ORIGINS.
    """
    if raw is not None and raw.strip():
        tokens = [token.strip() for token in raw.split(",") if token.strip()]
        normalized: list[str] = []
        for token in tokens:
            cleaned = token.rstrip("/") if token != "/" else token
            if cleaned and cleaned not in normalized:
                normalized.append(cleaned)
        return normalized

    if is_production:
        return []
    return list(DEFAULT_DEV_CORS_ORIGINS)


class Settings(BaseModel):
    PROJECT_NAME: str = "CivicSense AI Smart City Backend"
    API_V1_STR: str = "/api/v1"

    # Environment & Deployment Mode
    ENVIRONMENT: str = os.getenv("ENVIRONMENT", os.getenv("ENV", "development")).lower()

    # Demo Accounts Configuration (Disabled by default in production)
    ENABLE_DEMO_ACCOUNTS: bool | None = None

    @model_validator(mode="after")
    def resolve_demo_accounts(self) -> "Settings":
        if self.ENABLE_DEMO_ACCOUNTS is None:
            raw_env = os.getenv("ENABLE_DEMO_ACCOUNTS")
            if raw_env is not None:
                self.ENABLE_DEMO_ACCOUNTS = raw_env.lower() in ("true", "1", "yes")
            else:
                self.ENABLE_DEMO_ACCOUNTS = False if self.ENVIRONMENT in ("production", "prod") else True
        return self

    # Security & JWT Configuration
    SECRET_KEY: str = os.getenv("SECRET_KEY", INSECURE_DEFAULT_SECRET)
    JWT_ALGORITHM: str = os.getenv("JWT_ALGORITHM", os.getenv("ALGORITHM", "HS256"))
    ALGORITHM: str = os.getenv("ALGORITHM", os.getenv("JWT_ALGORITHM", "HS256"))
    ACCESS_TOKEN_EXPIRE_MINUTES: int = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", str(60 * 24 * 7)))  # 7 days

    # HTTP Security Headers Configuration
    HSTS_MAX_AGE_SECONDS: int = int(os.getenv("HSTS_MAX_AGE_SECONDS", "31536000"))
    HSTS_INCLUDE_SUBDOMAINS: bool = os.getenv("HSTS_INCLUDE_SUBDOMAINS", "false").lower() in ("true", "1", "yes")

    # Database URL
    DATABASE_URL: str = os.getenv(
        "DATABASE_URL",
        "" if os.getenv("ENVIRONMENT", os.getenv("ENV", "development")).lower() in ("production", "prod") else "sqlite:///./civicsense.db"
    )

    # File Upload Security Limits
    MAX_UPLOAD_SIZE_BYTES: int = int(os.getenv("MAX_UPLOAD_SIZE_BYTES", str(10 * 1024 * 1024)))  # Default 10 MB

    # Persistent Storage Configuration
    STORAGE_PROVIDER: str = os.getenv(
        "STORAGE_PROVIDER",
        "s3" if os.getenv("ENVIRONMENT", os.getenv("ENV", "development")).lower() in ("production", "prod") else "local"
    ).lower()
    S3_BUCKET_NAME: str = os.getenv("S3_BUCKET_NAME", "")
    S3_REGION_NAME: str = os.getenv("S3_REGION_NAME", os.getenv("AWS_REGION", "us-east-1"))
    S3_ENDPOINT_URL: str = os.getenv("S3_ENDPOINT_URL", "")
    S3_ACCESS_KEY_ID: str = os.getenv("S3_ACCESS_KEY_ID", os.getenv("AWS_ACCESS_KEY_ID", ""))
    S3_SECRET_ACCESS_KEY: str = os.getenv("S3_SECRET_ACCESS_KEY", os.getenv("AWS_SECRET_ACCESS_KEY", ""))
    S3_PUBLIC_URL_PREFIX: str = os.getenv("S3_PUBLIC_URL_PREFIX", "")
    S3_PRESIGNED_EXPIRATION_SECONDS: int = int(os.getenv("S3_PRESIGNED_EXPIRATION_SECONDS", "900"))  # Default 15 minutes

    # AI Engine Provider Configuration
    # Supports LLM_PROVIDER as configured in dev environment, with AI_PROVIDER as alias
    LLM_PROVIDER: str = os.getenv("LLM_PROVIDER") or os.getenv("AI_PROVIDER", "ollama")
    AI_PROVIDER: str = os.getenv("AI_PROVIDER") or os.getenv("LLM_PROVIDER", "ollama")
    VISION_PROVIDER: str = os.getenv("VISION_PROVIDER", "gemini")

    # Ollama Configuration
    OLLAMA_BASE_URL: str = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434")
    OLLAMA_MODEL: str = os.getenv("OLLAMA_MODEL", "llama3.2:1b")
    OLLAMA_TIMEOUT_SECONDS: int = int(os.getenv("OLLAMA_TIMEOUT_SECONDS", "30"))
    OLLAMA_VISION_MODEL: str = os.getenv("OLLAMA_VISION_MODEL", "moondream")

    # Gemini Configuration
    GEMINI_API_KEY: str = os.getenv("GEMINI_API_KEY", "")
    GEMINI_MODEL: str = os.getenv("GEMINI_MODEL", "gemini-2.5-flash")

    # Meta WhatsApp Cloud API Configuration
    WHATSAPP_PROVIDER: str = os.getenv("WHATSAPP_PROVIDER", "meta")
    WHATSAPP_PHONE_NUMBER_ID: str = os.getenv("WHATSAPP_PHONE_NUMBER_ID", "")
    WHATSAPP_ACCESS_TOKEN: str = os.getenv("WHATSAPP_ACCESS_TOKEN", "")
    WHATSAPP_BUSINESS_ACCOUNT_ID: str = os.getenv("WHATSAPP_BUSINESS_ACCOUNT_ID", "")
    WHATSAPP_VERIFY_TOKEN: str = os.getenv("WHATSAPP_VERIFY_TOKEN", "")
    META_APP_SECRET: str = os.getenv("META_APP_SECRET", "")
    WHATSAPP_API_VERSION: str = os.getenv("WHATSAPP_API_VERSION", "v21.0")

    # CORS origins
    # In development, defaults to standard local frontend ports.
    # In production, must be explicitly configured via CORS_ORIGINS environment variable.
    CORS_ORIGINS: list[str] = parse_cors_origins(
        os.getenv("CORS_ORIGINS"),
        is_production=os.getenv("ENVIRONMENT", os.getenv("ENV", "development")).lower() in ("production", "prod")
    )

    # Rate Limiting & Brute-Force Protection
    RATE_LIMIT_LOGIN_MAX_ATTEMPTS: int = int(os.getenv("RATE_LIMIT_LOGIN_MAX_ATTEMPTS", "10"))
    RATE_LIMIT_LOGIN_WINDOW_SECONDS: int = int(os.getenv("RATE_LIMIT_LOGIN_WINDOW_SECONDS", "60"))
    RATE_LIMIT_SIGNUP_MAX_ATTEMPTS: int = int(os.getenv("RATE_LIMIT_SIGNUP_MAX_ATTEMPTS", "5"))
    RATE_LIMIT_SIGNUP_WINDOW_SECONDS: int = int(os.getenv("RATE_LIMIT_SIGNUP_WINDOW_SECONDS", "60"))
    RATE_LIMIT_BACKEND: str = os.getenv(
        "RATE_LIMIT_BACKEND",
        "database" if os.getenv("ENVIRONMENT", os.getenv("ENV", "development")).lower() in ("production", "prod") else "database"
    ).lower()
    REDIS_URL: str = os.getenv("REDIS_URL", "")

    # Trusted Proxy & Client IP Extraction Configuration
    TRUST_PROXY_HEADERS: bool = os.getenv(
        "TRUST_PROXY_HEADERS",
        "true" if os.getenv("ENVIRONMENT", os.getenv("ENV", "development")).lower() in ("production", "prod") else "true"
    ).lower() in ("true", "1", "yes")
    TRUSTED_PROXIES: list[str] = parse_trusted_proxies(os.getenv("TRUSTED_PROXIES"))

def validate_production_security(settings_obj: Settings):
    """
    Enforces security in production environments.
    Never silently permit a known default or empty secret key when deployed.
    Never silently permit a missing, empty, or SQLite DATABASE_URL in production.
    Never silently permit missing, empty, or wildcard CORS origins in production.
    """
    if settings_obj.ENVIRONMENT in ("production", "prod"):
        insecure_keys = {INSECURE_DEFAULT_SECRET, "secret", "changeme", "jwtsecret", ""}
        if not settings_obj.SECRET_KEY or settings_obj.SECRET_KEY in insecure_keys:
            raise RuntimeError(
                "CRITICAL SECURITY CONFIGURATION ERROR: A default or insecure SECRET_KEY "
                "cannot be used in production. Please set a cryptographically secure SECRET_KEY in the environment."
            )

        db_url = (settings_obj.DATABASE_URL or "").strip()
        if not db_url:
            raise RuntimeError(
                "CRITICAL DATABASE CONFIGURATION ERROR: DATABASE_URL is required in production mode "
                "(ENVIRONMENT=production). Production cannot start with an empty or missing DATABASE_URL."
            )
        if db_url.startswith("sqlite"):
            raise RuntimeError(
                "CRITICAL DATABASE CONFIGURATION ERROR: Production environment cannot use SQLite. "
                "A managed PostgreSQL database must be configured via DATABASE_URL."
            )

        # CORS Origins Security Validation
        cors_origins = [
            o.strip().rstrip("/") if o != "/" else o.strip()
            for o in (settings_obj.CORS_ORIGINS or [])
            if o and o.strip()
        ]
        if not cors_origins:
            raise RuntimeError(
                "CRITICAL CORS CONFIGURATION ERROR: CORS_ORIGINS is required in production mode "
                "(ENVIRONMENT=production). Specify explicit allowed origins (e.g. CORS_ORIGINS=https://app.example.com)."
            )
        if "*" in cors_origins:
            raise RuntimeError(
                "CRITICAL CORS CONFIGURATION ERROR: Wildcard origin '*' is strictly forbidden in production mode. "
                "Specify explicit trusted origins in CORS_ORIGINS."
            )

        # Persistent Storage Provider Security in Production
        if settings_obj.STORAGE_PROVIDER == "local":
            raise RuntimeError(
                "CRITICAL STORAGE CONFIGURATION ERROR: Local filesystem storage cannot be used in production mode "
                "(ENVIRONMENT=production) due to ephemeral instance filesystems. "
                "Persistent S3-compatible object storage must be configured (STORAGE_PROVIDER=s3)."
            )
        if settings_obj.STORAGE_PROVIDER == "s3":
            missing_s3 = []
            if not settings_obj.S3_BUCKET_NAME:
                missing_s3.append("S3_BUCKET_NAME")
            if not settings_obj.S3_ACCESS_KEY_ID:
                missing_s3.append("S3_ACCESS_KEY_ID")
            if not settings_obj.S3_SECRET_ACCESS_KEY:
                missing_s3.append("S3_SECRET_ACCESS_KEY")
            if missing_s3:
                raise RuntimeError(
                    f"CRITICAL STORAGE CONFIGURATION ERROR: S3 object storage is required in production mode. "
                    f"Missing required environment variables: {', '.join(missing_s3)}."
                )

        # AI Provider Security in Production
        if settings_obj.LLM_PROVIDER == "ollama":
            ollama_url = (settings_obj.OLLAMA_BASE_URL or "").lower()
            local_hosts = ("localhost", "127.0.0.1", "0.0.0.0", "::1")
            if any(h in ollama_url for h in local_hosts):
                raise RuntimeError(
                    f"CRITICAL AI CONFIGURATION ERROR: Production environment cannot use localhost for Ollama "
                    f"({settings_obj.OLLAMA_BASE_URL}). A remote managed Ollama host or cloud provider is required."
                )
        elif settings_obj.LLM_PROVIDER == "gemini":
            gemini_key = (settings_obj.GEMINI_API_KEY or "").strip()
            insecure_api_keys = {"", "your_gemini_api_key_here", "dummy", "test", "changeme"}
            if not gemini_key or gemini_key in insecure_api_keys:
                raise RuntimeError(
                    "CRITICAL AI CONFIGURATION ERROR: GEMINI_API_KEY is required in production mode "
                    "when LLM_PROVIDER=gemini."
                )
        else:
            raise RuntimeError(
                f"CRITICAL AI CONFIGURATION ERROR: Unsupported LLM_PROVIDER '{settings_obj.LLM_PROVIDER}'. "
                "Must be 'ollama' or 'gemini'."
            )

        if settings_obj.VISION_PROVIDER == "gemini":
            gemini_key = (settings_obj.GEMINI_API_KEY or "").strip()
            insecure_api_keys = {"", "your_gemini_api_key_here", "dummy", "test", "changeme"}
            if not gemini_key or gemini_key in insecure_api_keys:
                raise RuntimeError(
                    "CRITICAL AI CONFIGURATION ERROR: GEMINI_API_KEY is required in production mode "
                    "for multimodal vision analysis (VISION_PROVIDER=gemini)."
                )

        # Meta WhatsApp Cloud API Security Validation in Production
        # If any WhatsApp credentials are set, require full, secure production credentials
        whatsapp_configured = any([
            (settings_obj.WHATSAPP_PHONE_NUMBER_ID or "").strip(),
            (settings_obj.WHATSAPP_ACCESS_TOKEN or "").strip(),
            (settings_obj.META_APP_SECRET or "").strip(),
            (settings_obj.WHATSAPP_VERIFY_TOKEN or "").strip(),
        ])
        if whatsapp_configured:
            missing_wa = []
            insecure_placeholders = {
                "", "your_meta_app_secret_here", "your_whatsapp_access_token_here",
                "your_verify_token_here", "changeme", "test", "secret"
            }
            if not (settings_obj.WHATSAPP_PHONE_NUMBER_ID or "").strip():
                missing_wa.append("WHATSAPP_PHONE_NUMBER_ID")
            if not (settings_obj.WHATSAPP_ACCESS_TOKEN or "").strip() or settings_obj.WHATSAPP_ACCESS_TOKEN.strip() in insecure_placeholders:
                missing_wa.append("WHATSAPP_ACCESS_TOKEN")
            if not (settings_obj.WHATSAPP_VERIFY_TOKEN or "").strip() or settings_obj.WHATSAPP_VERIFY_TOKEN.strip() in insecure_placeholders:
                missing_wa.append("WHATSAPP_VERIFY_TOKEN")
            if not (settings_obj.META_APP_SECRET or "").strip() or settings_obj.META_APP_SECRET.strip() in insecure_placeholders:
                missing_wa.append("META_APP_SECRET")
            if missing_wa:
                raise RuntimeError(
                    f"CRITICAL WHATSAPP CONFIGURATION ERROR: WhatsApp is partially configured in production mode. "
                    f"Missing or insecure required environment variables: {', '.join(missing_wa)}."
                )

        # Demo Accounts Production Security Validation
        if settings_obj.ENABLE_DEMO_ACCOUNTS:
            raise RuntimeError(
                "CRITICAL SECURITY CONFIGURATION ERROR: ENABLE_DEMO_ACCOUNTS must be false in production mode "
                "(ENVIRONMENT=production). Default demo accounts with pre-shared passwords cannot be enabled in production."
            )

        # Rate Limiting Production Security Validation
        if settings_obj.RATE_LIMIT_BACKEND == "memory":
            raise RuntimeError(
                "CRITICAL RATE LIMIT CONFIGURATION ERROR: 'memory' rate-limit backend cannot be used in production mode "
                "(ENVIRONMENT=production) due to ephemeral process-local storage and multi-instance concurrency. "
                "A shared persistent backend ('database' or 'redis') must be configured via RATE_LIMIT_BACKEND."
            )
        if settings_obj.RATE_LIMIT_BACKEND == "redis":
            redis_url = (settings_obj.REDIS_URL or "").strip()
            if not redis_url:
                raise RuntimeError(
                    "CRITICAL RATE LIMIT CONFIGURATION ERROR: REDIS_URL is required in production mode "
                    "when RATE_LIMIT_BACKEND=redis."
                )
            insecure_redis = {"localhost", "127.0.0.1", "0.0.0.0", "::1"}
            if any(h in redis_url.lower() for h in insecure_redis):
                raise RuntimeError(
                    f"CRITICAL RATE LIMIT CONFIGURATION ERROR: Production environment cannot use localhost for Redis "
                    f"({settings_obj.REDIS_URL}). A managed remote Redis cluster is required."
                )
            try:
                import redis
            except ImportError:
                raise RuntimeError(
                    "CRITICAL RATE LIMIT CONFIGURATION ERROR: The 'redis' package is required when "
                    "RATE_LIMIT_BACKEND=redis, but it is not installed in the environment."
                )
            try:
                client = redis.from_url(redis_url, socket_connect_timeout=3, socket_timeout=3)
                client.ping()
            except Exception as e:
                raise RuntimeError(
                    f"CRITICAL RATE LIMIT CONFIGURATION ERROR: Unable to connect to Redis at {settings_obj.REDIS_URL}: {e}"
                )
        elif settings_obj.RATE_LIMIT_BACKEND != "database":
            raise RuntimeError(
                f"CRITICAL RATE LIMIT CONFIGURATION ERROR: Unsupported RATE_LIMIT_BACKEND '{settings_obj.RATE_LIMIT_BACKEND}'. "
                "Must be 'database' or 'redis'."
            )

        if settings_obj.RATE_LIMIT_LOGIN_MAX_ATTEMPTS <= 0:
            raise RuntimeError("CRITICAL RATE LIMIT CONFIGURATION ERROR: RATE_LIMIT_LOGIN_MAX_ATTEMPTS must be positive.")
        if settings_obj.RATE_LIMIT_SIGNUP_MAX_ATTEMPTS <= 0:
            raise RuntimeError("CRITICAL RATE LIMIT CONFIGURATION ERROR: RATE_LIMIT_SIGNUP_MAX_ATTEMPTS must be positive.")
        if settings_obj.RATE_LIMIT_LOGIN_WINDOW_SECONDS <= 0 or settings_obj.RATE_LIMIT_SIGNUP_WINDOW_SECONDS <= 0:
            raise RuntimeError("CRITICAL RATE LIMIT CONFIGURATION ERROR: Rate limit window seconds must be positive.")

settings = Settings()
validate_production_security(settings)
