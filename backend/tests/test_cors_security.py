"""
CivicSense AI -- CORS Security & Vercel Preview Origin Integration Tests
========================================================================

Verifies:
  1. Staging Vercel Preview Regex matching (including the exact user preview origin).
  2. Automatic activation in staging mode.
  3. Strict production isolation (preview regex strictly forbidden and blocked in production).
  4. Rejection of unrelated Vercel applications, attacker domains, spoofed prefixes, and insecure HTTP.
  5. Fail-closed rejection of wildcard and overly permissive regex patterns in validation.
  6. Preservation of allow_credentials=True across all allowed origins.
  7. Verification of actual FastAPI middleware behavior and actual Settings model.
"""

import pytest
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from starlette.testclient import TestClient

from app.config import (
    DEFAULT_DEV_CORS_ORIGINS,
    DEFAULT_STAGING_CORS_ORIGIN_REGEX,
    validate_production_security,
    Settings,
)
from app.main import app as actual_app


def create_staging_app(cors_origins=None, origin_regex=None):
    """Helper to instantiate a FastAPI app mirroring app.main with specific CORS configuration."""
    test_app = FastAPI()
    origins = cors_origins if cors_origins is not None else ["https://civicsense-staging.vercel.app"]
    test_app.add_middleware(
        CORSMiddleware,
        allow_origins=origins,
        allow_origin_regex=origin_regex,
        allow_credentials=True,
        allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
        allow_headers=["*"],
        expose_headers=["*"],
    )

    @test_app.get("/api/v1/health")
    def health_check():
        return {"status": "ok"}

    return test_app


class TestCORSConfigurationSecurity:
    """Verifies Settings model and validate_production_security rules for CORS."""

    def test_settings_automatic_staging_preview_regex(self, monkeypatch):
        """CORS_ORIGIN_REGEX is automatically populated with the scoped pattern in staging mode."""
        monkeypatch.setenv("ENVIRONMENT", "staging")
        monkeypatch.delenv("CORS_ORIGIN_REGEX", raising=False)
        s = Settings(
            ENVIRONMENT="staging",
            SECRET_KEY="secure-staging-secret-key-1234567890",
            DATABASE_URL="postgresql://postgres.oayzaszhhpfjlpmaezmc:pass@aws-0-ap-northeast-1.pooler.supabase.com:5432/postgres",
            CORS_ORIGINS=["https://civicsense-staging.vercel.app"],
            STORAGE_PROVIDER="s3",
            S3_BUCKET_NAME="civicsense-staging-evidence",
            S3_ACCESS_KEY_ID="valid-key",
            S3_SECRET_ACCESS_KEY="valid-secret",
            STAGING_DATABASE_ONLY=False,
            LLM_PROVIDER="gemini",
            GEMINI_API_KEY="AIzaSyAValidSecureGeminiApiKey123",
            WHATSAPP_GATEWAY_SECRET="secure-wa-gateway-secret-abcdef123456",
        )
        assert s.CORS_ORIGIN_REGEX == DEFAULT_STAGING_CORS_ORIGIN_REGEX
        validate_production_security(s)

    def test_settings_production_forbids_preview_regex(self, monkeypatch):
        """In production mode, CORS_ORIGIN_REGEX is strictly None and raises on attempt to enable it."""
        monkeypatch.setenv("ENVIRONMENT", "production")
        monkeypatch.delenv("CORS_ORIGIN_REGEX", raising=False)
        s = Settings(
            ENVIRONMENT="production",
            SECRET_KEY="secure-production-secret-key-1234567890",
            DATABASE_URL="postgresql://user:pass@host:5432/db",
            CORS_ORIGINS=["https://civicsenseai-theta.vercel.app"],
            STORAGE_PROVIDER="s3",
            S3_BUCKET_NAME="civicsense-prod-evidence",
            S3_ACCESS_KEY_ID="valid-key",
            S3_SECRET_ACCESS_KEY="valid-secret",
            STAGING_DATABASE_ONLY=False,
            LLM_PROVIDER="gemini",
            GEMINI_API_KEY="AIzaSyAValidSecureGeminiApiKey123",
            WHATSAPP_GATEWAY_SECRET="secure-wa-gateway-secret-abcdef123456",
        )
        assert s.CORS_ORIGIN_REGEX is None
        validate_production_security(s)

        # If someone explicitly injects a regex in production Settings, validation must fail closed
        s.CORS_ORIGIN_REGEX = DEFAULT_STAGING_CORS_ORIGIN_REGEX
        with pytest.raises(RuntimeError, match="CORS_ORIGIN_REGEX is strictly forbidden in production mode"):
            validate_production_security(s)

    def test_production_environment_variable_regex_fails_closed(self, monkeypatch):
        """If CORS_ORIGIN_REGEX is set in production environment, startup fails closed rather than silently setting to None."""
        monkeypatch.setenv("ENVIRONMENT", "production")
        monkeypatch.setenv("CORS_ORIGIN_REGEX", "^https://civicsenseai-.*\\.vercel\\.app$")
        s = Settings(
            ENVIRONMENT="production",
            SECRET_KEY="secure-production-secret-key-1234567890",
            DATABASE_URL="postgresql://user:pass@host:5432/db",
            CORS_ORIGINS=["https://civicsenseai-theta.vercel.app"],
            STORAGE_PROVIDER="s3",
            S3_BUCKET_NAME="civicsense-prod-evidence",
            S3_ACCESS_KEY_ID="valid-key",
            S3_SECRET_ACCESS_KEY="valid-secret",
            STAGING_DATABASE_ONLY=False,
            LLM_PROVIDER="gemini",
            GEMINI_API_KEY="AIzaSyAValidSecureGeminiApiKey123",
            WHATSAPP_GATEWAY_SECRET="secure-wa-gateway-secret-abcdef123456",
        )
        # Must NOT be silently set to None
        assert s.CORS_ORIGIN_REGEX == "^https://civicsenseai-.*\\.vercel\\.app$"
        # Validation must fail closed immediately
        with pytest.raises(RuntimeError, match="CORS_ORIGIN_REGEX is strictly forbidden in production mode"):
            validate_production_security(s)

    def test_wildcard_cors_origins_rejected_before_startup(self, monkeypatch):
        """Wildcard origin '*' in CORS_ORIGINS is rejected before startup by validate_production_security."""
        monkeypatch.setenv("ENVIRONMENT", "staging")
        s = Settings(
            ENVIRONMENT="staging",
            SECRET_KEY="secure-staging-secret-key-1234567890",
            DATABASE_URL="postgresql://postgres.oayzaszhhpfjlpmaezmc:pass@aws-0-ap-northeast-1.pooler.supabase.com:5432/postgres",
            CORS_ORIGINS=["*"],
            STORAGE_PROVIDER="s3",
            S3_BUCKET_NAME="civicsense-staging-evidence",
            S3_ACCESS_KEY_ID="valid-key",
            S3_SECRET_ACCESS_KEY="valid-secret",
            STAGING_DATABASE_ONLY=False,
            LLM_PROVIDER="gemini",
            GEMINI_API_KEY="AIzaSyAValidSecureGeminiApiKey123",
            WHATSAPP_GATEWAY_SECRET="secure-wa-gateway-secret-abcdef123456",
        )
        with pytest.raises(RuntimeError, match="Wildcard origin '\\*' is strictly forbidden"):
            validate_production_security(s)

    def test_overly_permissive_and_wildcard_regex_rejected(self, monkeypatch):
        """Overly permissive patterns and wildcards are strictly rejected in staging mode."""
        monkeypatch.setenv("ENVIRONMENT", "staging")
        bad_regexes = [
            "*",
            ".*",
            "^.*$",
            "^https?://.*",
            ".*vercel.app.*",
            r"^https?://.*\.vercel\.app$",
        ]
        for bad_regex in bad_regexes:
            s = Settings(
                ENVIRONMENT="staging",
                SECRET_KEY="secure-staging-secret-key-1234567890",
                DATABASE_URL="postgresql://postgres.oayzaszhhpfjlpmaezmc:pass@aws-0-ap-northeast-1.pooler.supabase.com:5432/postgres",
                CORS_ORIGINS=["https://civicsense-staging.vercel.app"],
                STORAGE_PROVIDER="s3",
                S3_BUCKET_NAME="civicsense-staging-evidence",
                S3_ACCESS_KEY_ID="valid-key",
                S3_SECRET_ACCESS_KEY="valid-secret",
                STAGING_DATABASE_ONLY=False,
                LLM_PROVIDER="gemini",
                GEMINI_API_KEY="AIzaSyAValidSecureGeminiApiKey123",
                WHATSAPP_GATEWAY_SECRET="secure-wa-gateway-secret-abcdef123456",
                CORS_ORIGIN_REGEX=bad_regex,
            )
            with pytest.raises(RuntimeError, match="Overly permissive or wildcard origin regex"):
                validate_production_security(s)


class TestCORSStagingMiddlewareExecution:
    """Verifies end-to-end HTTP request processing through FastAPI CORSMiddleware."""

    @pytest.fixture(autouse=True)
    def setup_client(self):
        self.app = create_staging_app(
            cors_origins=["https://civicsense-staging.vercel.app"],
            origin_regex=DEFAULT_STAGING_CORS_ORIGIN_REGEX,
        )
        self.client = TestClient(self.app)

    def test_exact_user_preview_origin_allowed_with_credentials(self):
        """Verifies the exact Vercel Preview URL provided by the user succeeds with credentials."""
        exact_origin = "https://civicsenseai-riblq67kl-sathwiks-projects-d1eaef45.vercel.app"

        # 1. Preflight OPTIONS request
        preflight = self.client.options(
            "/api/v1/health",
            headers={
                "Origin": exact_origin,
                "Access-Control-Request-Method": "GET",
                "Access-Control-Request-Headers": "Authorization,Content-Type",
            },
        )
        assert preflight.status_code == 200
        assert preflight.headers.get("access-control-allow-origin") == exact_origin
        assert preflight.headers.get("access-control-allow-credentials") == "true"
        assert "GET" in preflight.headers.get("access-control-allow-methods", "")

        # 2. Simple GET request
        res = self.client.get("/api/v1/health", headers={"Origin": exact_origin})
        assert res.status_code == 200
        assert res.headers.get("access-control-allow-origin") == exact_origin
        assert res.headers.get("access-control-allow-credentials") == "true"

    def test_additional_legitimate_preview_deployments_allowed(self):
        """Verifies git branch and project root preview deployments for this team are allowed."""
        valid_origins = [
            "https://civicsenseai-git-ci-verify-gateway-upgrade-sathwiks-projects-d1eaef45.vercel.app",
            "https://civicsenseai-git-fix-cors-sathwiks-projects-d1eaef45.vercel.app",
            "https://civicsenseai-sathwiks-projects-d1eaef45.vercel.app",
        ]
        for origin in valid_origins:
            res = self.client.get("/api/v1/health", headers={"Origin": origin})
            assert res.status_code == 200
            assert res.headers.get("access-control-allow-origin") == origin
            assert res.headers.get("access-control-allow-credentials") == "true"

    def test_unrelated_vercel_projects_and_domains_rejected(self):
        """Verifies that other Vercel projects, other teams, and spoofed origins are blocked."""
        blocked_origins = [
            "https://otherproject-riblq67kl-sathwiks-projects-d1eaef45.vercel.app",
            "https://civicsenseai-riblq67kl-otherteam.vercel.app",
            "https://civicsenseai.attacker.vercel.app",
            "https://evil-civicsenseai-riblq67kl-sathwiks-projects-d1eaef45.vercel.app",
            "https://civicsenseai-riblq67kl-sathwiks-projects-d1eaef45.vercel.app.attacker.com",
            "https://attacker.com",
            "https://vercel.app",
        ]
        for origin in blocked_origins:
            # Preflight must NOT return allow-origin
            preflight = self.client.options(
                "/api/v1/health",
                headers={
                    "Origin": origin,
                    "Access-Control-Request-Method": "GET",
                },
            )
            assert "access-control-allow-origin" not in preflight.headers

            # Simple request must NOT return allow-origin
            res = self.client.get("/api/v1/health", headers={"Origin": origin})
            assert "access-control-allow-origin" not in res.headers

    def test_insecure_http_protocol_rejected(self):
        """Verifies that insecure HTTP protocol is blocked even with matching hostname."""
        http_origin = "http://civicsenseai-riblq67kl-sathwiks-projects-d1eaef45.vercel.app"
        res = self.client.get("/api/v1/health", headers={"Origin": http_origin})
        assert "access-control-allow-origin" not in res.headers

    def test_production_isolation_blocks_preview_origins(self):
        """Verifies production setup (CORS_ORIGIN_REGEX=None) blocks preview origins completely."""
        prod_origins = ["https://civicsenseai-theta.vercel.app"]
        prod_app = create_staging_app(cors_origins=prod_origins, origin_regex=None)
        client = TestClient(prod_app)

        preview_origin = "https://civicsenseai-riblq67kl-sathwiks-projects-d1eaef45.vercel.app"
        res = client.get("/api/v1/health", headers={"Origin": preview_origin})
        assert "access-control-allow-origin" not in res.headers

        # Production origin remains fully functional
        prod_res = client.get("/api/v1/health", headers={"Origin": prod_origins[0]})
        assert prod_res.headers.get("access-control-allow-origin") == prod_origins[0]
        assert prod_res.headers.get("access-control-allow-credentials") == "true"

    def test_configured_explicit_staging_origin_allowed(self):
        """Verifies the explicit staging domain in CORS_ORIGINS is allowed alongside regex."""
        res = self.client.get("/api/v1/health", headers={"Origin": "https://civicsense-staging.vercel.app"})
        assert res.status_code == 200
        assert res.headers.get("access-control-allow-origin") == "https://civicsense-staging.vercel.app"
        assert res.headers.get("access-control-allow-credentials") == "true"

    def test_actual_application_instance_cors(self):
        """Verifies the live actual_app from app.main has CORSMiddleware with credentials and proper settings."""
        cors_middlewares = [m for m in actual_app.user_middleware if m.cls == CORSMiddleware]
        assert len(cors_middlewares) == 1, "CORSMiddleware must be registered on actual_app"
        cors_kw = cors_middlewares[0].kwargs
        assert cors_kw["allow_credentials"] is True, "allow_credentials must remain True on actual_app"
        assert cors_kw["allow_origins"] is not None

        client = TestClient(actual_app)
        dev_origin = DEFAULT_DEV_CORS_ORIGINS[0]
        # Preflight OPTIONS request
        preflight = client.options(
            "/api/v1/incidents",
            headers={
                "Origin": dev_origin,
                "Access-Control-Request-Method": "GET",
            },
        )
        assert preflight.status_code == 200
        assert preflight.headers.get("access-control-allow-origin") == dev_origin
        assert preflight.headers.get("access-control-allow-credentials") == "true"
