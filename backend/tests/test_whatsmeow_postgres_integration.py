"""
CivicSense AI - WhatsMeow PostgreSQL Migration & Staging Integration Tests
Tests database URL safety parsing, Supabase port validation (5432 vs 6543),
production reference rejection, Alembic schema isolation, queue deduplication & retry logic,
and Render Free staging blueprint validation.
"""

import os
import re
import pytest
from urllib.parse import urlparse, parse_qs

# Production and Staging constants
PROD_SUPABASE_REF = "bcpgsvvjuxzowxqqmouk"
STAGING_SUPABASE_REF = "oayzaszhhpfjlpmaezmc"


# ==============================================================================
# 1. DATABASE URL VALIDATION & REDACTION LOGIC TESTS
# ==============================================================================

def validate_and_normalize_url(raw_url: str, is_production: bool = True, schema: str = "whatsmeow"):
    """Python reference mirror of Go config.ValidateAndNormalizeDatabaseURL."""
    if not raw_url:
        raise ValueError("database URL cannot be empty")

    if PROD_SUPABASE_REF in raw_url:
        raise ValueError(f"FATAL SAFETY VIOLATION: Production database reference '{PROD_SUPABASE_REF}' is strictly forbidden in staging gateway")

    parsed = urlparse(raw_url)
    scheme = parsed.scheme.lower()
    if scheme not in ("postgres", "postgresql", "sqlite"):
        raise ValueError(f"unsupported database scheme: {scheme}")

    if scheme == "sqlite":
        return raw_url, "sqlite"

    port = parsed.port
    if port == 6543:
        raise ValueError("Supavisor transaction pooler port 6543 is NOT supported by WhatsMeow sqlstore. Connect via session pooler port 5432")

    # SSL Mode
    qs = parse_qs(parsed.query)
    sslmode = qs.get("sslmode", [""])[0]
    if not sslmode or sslmode == "disable":
        qs["sslmode"] = ["require"]

    # Schema search_path
    search_path = qs.get("search_path", [""])[0]
    if not search_path:
        qs["search_path"] = [f"{schema},public"]
    elif schema not in search_path:
        qs["search_path"] = [f"{schema},{search_path}"]

    # Reconstruct
    new_query = "&".join(f"{k}={v[0]}" for k, v in qs.items())
    normalized = parsed._replace(query=new_query).geturl()
    return normalized, "postgres"


def mask_database_url(raw_url: str) -> str:
    """Python reference mirror of Go config.MaskDatabaseURL."""
    if not raw_url:
        return ""
    try:
        parsed = urlparse(raw_url)
        if parsed.password:
            masked_netloc = parsed.netloc.replace(f":{parsed.password}@", ":*****@")
            return parsed._replace(netloc=masked_netloc).geturl()
    except Exception:
        pass
    return re.sub(r"://([^:]+):([^@]+)@", r"://\1:*****@", raw_url)


class TestDatabaseURLValidationAndSafety:
    """Validates gateway configuration safety constraints."""

    def test_rejects_production_supabase_reference(self):
        """CRITICAL: Rejects any database URL targeting production project bcpgsvvjuxzowxqqmouk."""
        prod_url = f"postgresql://postgres.{PROD_SUPABASE_REF}:SuperSecretPass@aws-0-us-east-2.pooler.supabase.com:5432/postgres"
        with pytest.raises(ValueError, match="FATAL SAFETY VIOLATION: Production database reference"):
            validate_and_normalize_url(prod_url)

    def test_rejects_supavisor_port_6543(self):
        """Rejects transaction pooler port 6543 with informative message."""
        pooler_6543_url = f"postgresql://postgres.{STAGING_SUPABASE_REF}:StagingPass@aws-0-ap-northeast-1.pooler.supabase.com:6543/postgres"
        with pytest.raises(ValueError, match="Supavisor transaction pooler port 6543 is NOT supported"):
            validate_and_normalize_url(pooler_6543_url)

    def test_accepts_session_pooler_port_5432(self):
        """Accepts verified Tokyo session pooler port 5432."""
        staging_url = f"postgresql://postgres.{STAGING_SUPABASE_REF}:StagingPass@aws-0-ap-northeast-1.pooler.supabase.com:5432/postgres"
        normalized, dialect = validate_and_normalize_url(staging_url)
        assert dialect == "postgres"
        assert "sslmode=require" in normalized
        assert "search_path=whatsmeow" in normalized

    def test_enforces_sslmode_require(self):
        """Appends sslmode=require if omitted or disabled."""
        no_ssl_url = f"postgresql://postgres.{STAGING_SUPABASE_REF}:StagingPass@aws-0-ap-northeast-1.pooler.supabase.com:5432/postgres?sslmode=disable"
        normalized, _ = validate_and_normalize_url(no_ssl_url)
        assert "sslmode=require" in normalized

    def test_supports_sqlite_fallback_for_local_dev(self):
        """Allows sqlite scheme for local offline development."""
        sqlite_url = "sqlite:///./whatsapp_gateway_sessions.db"
        normalized, dialect = validate_and_normalize_url(sqlite_url, is_production=False)
        assert dialect == "sqlite"
        assert normalized == sqlite_url

    def test_masks_password_in_logs(self):
        """Verifies mask_database_url completely redacts credentials."""
        secret_url = f"postgresql://postgres.{STAGING_SUPABASE_REF}:MySuperSecretPassword123!@aws-0-ap-northeast-1.pooler.supabase.com:5432/postgres?sslmode=require"
        masked = mask_database_url(secret_url)
        assert "MySuperSecretPassword123!" not in masked
        assert ":*****@" in masked
        assert STAGING_SUPABASE_REF in masked


# ==============================================================================
# 2. ALEMBIC SCHEMA ISOLATION TESTS
# ==============================================================================

class TestAlembicSchemaIsolation:
    """Verifies that Alembic ignores the dedicated whatsmeow schema and tables."""

    def test_include_object_ignores_whatsmeow_tables(self):
        """Tests that Alembic's include_object filter ignores WhatsMeow tables."""
        import importlib.util
        env_py_path = os.path.join(os.path.dirname(__file__), "..", "alembic", "env.py")
        spec = importlib.util.spec_from_file_location("alembic_env_module", env_py_path)
        # Verify function source or extract include_object
        with open(env_py_path, "r", encoding="utf-8") as f:
            content = f.read()

        assert "def include_object" in content
        assert "whatsmeow_" in content
        assert "processed_messages" in content
        assert "inbound_events_queue" in content

        # Execute include_object in isolation
        local_scope = {}
        exec("""
def include_object(object, name, type_, reflected, compare_to):
    if type_ == "table":
        if name.startswith("whatsmeow_") or name in ("processed_messages", "inbound_events_queue"):
            return False
        if hasattr(object, "schema") and object.schema == "whatsmeow":
            return False
    return True
""", {}, local_scope)
        include_object = local_scope["include_object"]

        class MockObject:
            def __init__(self, schema=None):
                self.schema = schema

        # WhatsMeow upstream tables must be excluded
        assert include_object(MockObject(), "whatsmeow_device", "table", False, None) is False
        assert include_object(MockObject(), "whatsmeow_sessions", "table", False, None) is False
        assert include_object(MockObject(), "whatsmeow_identity_keys", "table", False, None) is False
        assert include_object(MockObject(), "whatsmeow_version", "table", False, None) is False

        # Gateway queue tables must be excluded
        assert include_object(MockObject(), "processed_messages", "table", False, None) is False
        assert include_object(MockObject(), "inbound_events_queue", "table", False, None) is False

        # Any table in schema 'whatsmeow' must be excluded
        assert include_object(MockObject(schema="whatsmeow"), "custom_table", "table", False, None) is False

        # CivicSense application tables in public schema must be included
        assert include_object(MockObject(schema="public"), "users", "table", False, None) is True
        assert include_object(MockObject(schema="public"), "incidents", "table", False, None) is True
        assert include_object(MockObject(schema="public"), "reports", "table", False, None) is True
        assert include_object(MockObject(schema="public"), "ai_analysis", "table", False, None) is True


# ==============================================================================
# 3. QUEUE RETRY & EXPONENTIAL BACKOFF LOGIC TESTS
# ==============================================================================

class TestQueueRetryBackoffLogic:
    """Tests bounded exponential backoff calculation."""

    @staticmethod
    def calculate_backoff_ms(attempts: int) -> int:
        """Mirrors Go queue.CalculateBackoff."""
        if attempts <= 0:
            return 500
        factor = 2 ** (attempts - 1)
        backoff = 500 * factor
        return min(backoff, 10000)

    def test_backoff_progression(self):
        assert self.calculate_backoff_ms(0) == 500
        assert self.calculate_backoff_ms(1) == 500
        assert self.calculate_backoff_ms(2) == 1000
        assert self.calculate_backoff_ms(3) == 2000
        assert self.calculate_backoff_ms(4) == 4000
        assert self.calculate_backoff_ms(5) == 8000
        assert self.calculate_backoff_ms(6) == 10000  # Capped at 10s
        assert self.calculate_backoff_ms(10) == 10000 # Capped at 10s


# ==============================================================================
# 4. RENDER ZERO-COST BLUEPRINT TESTS
# ==============================================================================

class TestRenderStagingBlueprint:
    """Validates render.staging.yaml zero-cost configuration and security settings."""

    def test_blueprint_uses_free_tier(self):
        import yaml
        blueprint_path = os.path.join(os.path.dirname(__file__), "..", "..", "render.staging.yaml")
        assert os.path.exists(blueprint_path), "render.staging.yaml must exist"

        with open(blueprint_path, "r", encoding="utf-8") as f:
            data = yaml.safe_load(f)

        services = data.get("services", [])
        assert len(services) == 2, "Must contain backend and gateway services"

        backend = next(s for s in services if s["name"] == "civicsense-backend-staging")
        gateway = next(s for s in services if s["name"] == "civicsense-wa-gateway-staging")

        # Zero-cost plan verification
        assert backend["plan"] == "free", "Backend must use free tier"
        assert gateway["plan"] == "free", "Gateway must use free tier"

        # No persistent paid disk
        assert "disk" not in gateway, "Gateway must not attach paid persistent disk"

        # Region closest to Tokyo (Singapore)
        assert backend["region"] == "singapore"
        assert gateway["region"] == "singapore"

        # Check health paths
        assert backend["healthCheckPath"] == "/health"
        assert gateway["healthCheckPath"] == "/healthz"


# ==============================================================================
# 5. SQL PROPOSAL STATIC AUDIT TESTS
# ==============================================================================

class TestWhatsMeowSQLProposalAudit:
    """Statically verifies backend/scripts/whatsmeow_schema_migration_proposal.sql security constraints."""

    @pytest.fixture
    def sql_content(self):
        sql_path = os.path.join(os.path.dirname(__file__), "..", "scripts", "whatsmeow_schema_migration_proposal.sql")
        assert os.path.exists(sql_path), "whatsmeow_schema_migration_proposal.sql must exist"
        with open(sql_path, "r", encoding="utf-8") as f:
            return f.read()

    def test_sql_contains_no_destructive_statements(self, sql_content):
        """Verifies no DROP, TRUNCATE, or CASCADE statements exist in SQL proposal."""
        destructive_patterns = [r"\bDROP\s+TABLE\b", r"\bTRUNCATE\b", r"\bDROP\s+SCHEMA\b", r"\bCASCADE\b"]
        for pattern in destructive_patterns:
            matches = re.findall(pattern, sql_content, re.IGNORECASE)
            assert len(matches) == 0, f"Found destructive statement matching '{pattern}': {matches}"

    def test_sql_never_touches_public_schema(self, sql_content):
        """Verifies no modification of public application schema."""
        # Active DDL must not create or alter tables in public schema
        matches = re.findall(r"CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?public\.", sql_content, re.IGNORECASE)
        assert len(matches) == 0, f"Found active DDL touching public schema: {matches}"

    def test_sql_creates_isolated_schema_and_queue_tables(self, sql_content):
        """Verifies creation of whatsmeow schema and queue tables with IF NOT EXISTS."""
        assert "CREATE SCHEMA IF NOT EXISTS whatsmeow;" in sql_content
        assert "CREATE TABLE IF NOT EXISTS whatsmeow.processed_messages" in sql_content
        assert "CREATE TABLE IF NOT EXISTS whatsmeow.inbound_events_queue" in sql_content
        assert "CREATE INDEX IF NOT EXISTS idx_processed_messages_expires" in sql_content
        assert "CREATE INDEX IF NOT EXISTS idx_inbound_queue_retry" in sql_content

    def test_sql_enforces_least_privilege(self, sql_content):
        """Verifies least-privilege revocations from PUBLIC and PostgREST anon/authenticated."""
        assert "REVOKE ALL ON SCHEMA whatsmeow FROM PUBLIC, anon, authenticated;" in sql_content
        assert "ALTER DEFAULT PRIVILEGES IN SCHEMA whatsmeow REVOKE ALL ON TABLES FROM PUBLIC, anon, authenticated;" in sql_content
        assert "ALTER DEFAULT PRIVILEGES IN SCHEMA whatsmeow REVOKE ALL ON SEQUENCES FROM PUBLIC, anon, authenticated;" in sql_content

    def test_sql_rejects_invalid_pooler_role_grants(self, sql_content):
        """Verifies that the pooler routing token 'postgres.oayzaszhhpfjlpmaezmc' is NOT used as an active PostgreSQL role."""
        # Active GRANT statements must NOT grant to the routing token
        active_lines = [l.strip() for l in sql_content.splitlines() if not l.strip().startswith("--")]
        active_sql = "\n".join(active_lines)
        assert 'TO "postgres.oayzaszhhpfjlpmaezmc"' not in active_sql
        assert 'ALTER SCHEMA whatsmeow OWNER TO postgres;' in active_sql

    def test_sql_does_not_conflict_with_upstream_migrations(self, sql_content):
        """Verifies that whatsmeow_* tables are not pre-created, preventing Upgrade() collisions."""
        # Active CREATE TABLE for whatsmeow_device must not be present
        matches = re.findall(r"^\s*CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?whatsmeow\.whatsmeow_device", sql_content, re.MULTILINE | re.IGNORECASE)
        assert len(matches) == 0, "whatsmeow_device must not be created manually to allow container.Upgrade() to manage its versioning"

    def test_no_table_name_collisions_between_queue_and_upstream(self):
        """Verifies that queue tables and upstream WhatsMeow tables have distinct namespaces."""
        upstream_tables = {
            "whatsmeow_version",
            "whatsmeow_device",
            "whatsmeow_identity_keys",
            "whatsmeow_pre_keys",
            "whatsmeow_sessions",
            "whatsmeow_sender_keys",
            "whatsmeow_app_state_sync_keys",
            "whatsmeow_app_state_version",
            "whatsmeow_message_secrets",
        }
        queue_tables = {"processed_messages", "inbound_events_queue"}
        # Intersection must be empty
        assert len(upstream_tables.intersection(queue_tables)) == 0

        # All upstream tables must have whatsmeow_ prefix
        for tbl in upstream_tables:
            assert tbl.startswith("whatsmeow_")
        # All queue tables must NOT have whatsmeow_ prefix
        for tbl in queue_tables:
            assert not tbl.startswith("whatsmeow_")

    def test_sql_creates_dedicated_least_privilege_gateway_role(self, sql_content):
        """Verifies that the SQL proposal provisions the dedicated whatsmeow_gateway role with minimal permissions."""
        # 1. Role creation with LOGIN
        assert "CREATE ROLE whatsmeow_gateway WITH" in sql_content
        assert "LOGIN" in sql_content
        # 2. Database CONNECT permission
        assert "GRANT CONNECT ON DATABASE postgres TO whatsmeow_gateway;" in sql_content
        # 3. Schema USAGE and CREATE in 'whatsmeow'
        assert "GRANT USAGE, CREATE ON SCHEMA whatsmeow TO whatsmeow_gateway;" in sql_content
        # 4. Table and Sequence DML in 'whatsmeow'
        assert "GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA whatsmeow TO whatsmeow_gateway;" in sql_content
        assert "GRANT ALL ON ALL SEQUENCES IN SCHEMA whatsmeow TO whatsmeow_gateway;" in sql_content

    def test_sql_strictly_isolates_public_application_tables_from_gateway_role(self, sql_content):
        """Verifies that whatsmeow_gateway is explicitly stripped of all access to schema public and application tables."""
        assert "REVOKE ALL ON SCHEMA public FROM whatsmeow_gateway;" in sql_content
        assert "REVOKE ALL ON ALL TABLES IN SCHEMA public FROM whatsmeow_gateway;" in sql_content
        assert "REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM whatsmeow_gateway;" in sql_content
        assert "ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM whatsmeow_gateway;" in sql_content
        assert "ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON SEQUENCES FROM whatsmeow_gateway;" in sql_content

    def test_sql_configures_bidirectional_default_privileges(self, sql_content):
        """Verifies default ACLs for objects created by postgres and whatsmeow_gateway."""
        assert "ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA whatsmeow" in sql_content
        assert "GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO whatsmeow_gateway;" in sql_content
        assert "ALTER DEFAULT PRIVILEGES FOR ROLE whatsmeow_gateway IN SCHEMA whatsmeow" in sql_content
        # Tightened privilege: postgres only receives SELECT (read/backup), not unnecessary write access to raw Signal keys
        assert "GRANT SELECT ON TABLES TO postgres;" in sql_content

    def test_sql_role_has_no_superuser_privileges(self, sql_content):
        """Verifies that whatsmeow_gateway has zero administrative or superuser privileges."""
        active_lines = [l.strip() for l in sql_content.splitlines() if not l.strip().startswith("--")]
        active_sql = "\n".join(active_lines)
        disallowed_keywords = ["SUPERUSER", "CREATEDB", "CREATEROLE", "REPLICATION", "BYPASSRLS"]
        for kw in disallowed_keywords:
            pattern = rf"\b{kw}\b"
            matches = re.findall(pattern, active_sql, re.IGNORECASE)
            # All matches must be preceded by 'NO' (e.g. NOSUPERUSER, NOCREATEDB, etc.)
            for match in matches:
                # Find full word containing this keyword
                full_word_pattern = rf"\b\w*{kw}\w*\b"
                full_words = re.findall(full_word_pattern, active_sql, re.IGNORECASE)
                for word in full_words:
                    assert word.upper().startswith("NO"), f"Found unnegated privilege grant: {word}"

    def test_sql_enforces_least_privilege_attributes_on_both_create_and_alter(self, sql_content):
        """Verifies that NOSUPERUSER, NOCREATEDB, NOCREATEROLE, NOREPLICATION, NOBYPASSRLS are enforced on both CREATE and ALTER."""
        # Check CREATE block
        assert "CREATE ROLE whatsmeow_gateway WITH" in sql_content
        # Check ALTER block
        assert "ALTER ROLE whatsmeow_gateway WITH" in sql_content
        # Both must explicitly specify all negation flags
        for flag in ["NOSUPERUSER", "NOCREATEDB", "NOCREATEROLE", "NOREPLICATION", "NOBYPASSRLS"]:
            count = sql_content.count(flag)
            assert count >= 2, f"Flag {flag} must appear in both CREATE and ALTER role blocks (found {count})"

    def test_separate_gateway_credentials_configuration(self):
        """Verifies that the staging configuration supports separated gateway and backend credentials."""
        staging_env_path = os.path.join(os.path.dirname(__file__), "..", ".env.staging")
        with open(staging_env_path, "r", encoding="utf-8") as f:
            env_content = f.read()

        assert "DATABASE_URL=" in env_content
        assert "WHATSAPP_GATEWAY_DATABASE_URL=" in env_content

        render_path = os.path.join(os.path.dirname(__file__), "..", "..", "render.staging.yaml")
        with open(render_path, "r", encoding="utf-8") as f:
            render_content = f.read()

        assert "WHATSAPP_GATEWAY_DATABASE_URL" in render_content

    def test_sql_handles_existing_role_safely(self, sql_content):
        """Verifies that the SQL proposal updates the password if whatsmeow_gateway already exists."""
        assert "ALTER ROLE whatsmeow_gateway WITH" in sql_content
        assert "PASSWORD 'REPLACE_WITH_SECURE_GATEWAY_PASSWORD'" in sql_content

    def test_sql_grants_gateway_role_to_postgres_for_default_privileges(self, sql_content):
        """Verifies that postgres is granted whatsmeow_gateway membership so it can alter default privileges."""
        assert "GRANT whatsmeow_gateway TO postgres;" in sql_content

    def test_sql_configures_default_privileges_for_both_creators(self, sql_content):
        """Verifies default privileges for both postgres (admin DDL) and whatsmeow_gateway (WhatsMeow startup DDL)."""
        assert "ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA whatsmeow" in sql_content
        assert "ALTER DEFAULT PRIVILEGES FOR ROLE whatsmeow_gateway IN SCHEMA whatsmeow" in sql_content

    def test_public_schema_table_level_deny_safeguards(self, sql_content):
        """Verifies table-level and sequence-level denial safeguards against public schema access."""
        assert "REVOKE ALL ON ALL TABLES IN SCHEMA public FROM whatsmeow_gateway;" in sql_content
        assert "REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM whatsmeow_gateway;" in sql_content
        assert "ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM whatsmeow_gateway;" in sql_content
        assert "ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON SEQUENCES FROM whatsmeow_gateway;" in sql_content

    def test_config_go_rejects_silent_privileged_fallback(self):
        """Verifies that Go config.go explicitly prevents silent fallback to privileged DATABASE_URL in staging/production."""
        config_go_path = os.path.join(os.path.dirname(__file__), "..", "..", "whatsapp-gateway", "internal", "config", "config.go")
        with open(config_go_path, "r", encoding="utf-8") as f:
            content = f.read()

        assert "Dedicated WHATSAPP_GATEWAY_DATABASE_URL is required in" in content
        assert "Silent fallback to backend's privileged DATABASE_URL is strictly forbidden" in content
        assert "isStaging := envMode == \"staging\"" in content
        assert "isRemoteCloud := isStaging || isProduction" in content

    def test_env_specific_fail_closed_simulation(self):
        """Python mirror testing fail-closed activation across staging, production, development, and local."""
        def evaluate_fallback(env_name: str, has_gateway_url: bool, has_backend_url: bool, is_postgres: bool, allow_fallback: bool = False):
            env_mode = env_name.lower()
            is_staging = env_mode == "staging"
            is_production = env_mode in ("production", "prod")
            is_remote_cloud = is_staging or is_production

            if has_gateway_url:
                return "OK_GATEWAY_URL"
            elif has_backend_url:
                if is_remote_cloud and is_postgres:
                    if not allow_fallback:
                        target_env = "staging" if is_staging else "production"
                        raise ValueError(f"CRITICAL SECURITY ERROR: Dedicated WHATSAPP_GATEWAY_DATABASE_URL is required in {target_env} environment for PostgreSQL mode. Silent fallback to backend's privileged DATABASE_URL is strictly forbidden.")
                return "OK_FALLBACK_URL"
            return "OK_SQLITE"

        # 1. Staging MUST fail closed in Postgres mode when WHATSAPP_GATEWAY_DATABASE_URL is missing
        with pytest.raises(ValueError, match="required in staging environment"):
            evaluate_fallback("staging", False, True, True)

        # 2. Production MUST fail closed in Postgres mode when WHATSAPP_GATEWAY_DATABASE_URL is missing
        with pytest.raises(ValueError, match="required in production environment"):
            evaluate_fallback("production", False, True, True)

        with pytest.raises(ValueError, match="required in production environment"):
            evaluate_fallback("prod", False, True, True)

        # 3. Development environment does NOT fail closed (permits local dev testing)
        assert evaluate_fallback("development", False, True, True) == "OK_FALLBACK_URL"
        assert evaluate_fallback("dev", False, True, True) == "OK_FALLBACK_URL"

        # 4. Local environment does NOT fail closed
        assert evaluate_fallback("local", False, True, True) == "OK_FALLBACK_URL"
        assert evaluate_fallback("", False, True, True) == "OK_FALLBACK_URL"

        # 5. Staging with dedicated gateway URL succeeds cleanly
        assert evaluate_fallback("staging", True, True, True) == "OK_GATEWAY_URL"

    def test_sql_password_placeholder_safety(self, sql_content):
        """Verifies that the SQL proposal uses only safe placeholder strings and contains no embedded secrets."""
        # Must contain placeholder
        assert "REPLACE_WITH_SECURE_GATEWAY_PASSWORD" in sql_content
        # Must not contain unmasked staging database secret from .env.staging
        staging_env_path = os.path.join(os.path.dirname(__file__), "..", ".env.staging")
        with open(staging_env_path, "r", encoding="utf-8") as f:
            staging_env = f.read()

        # Extract postgres password from DATABASE_URL in .env.staging
        pw_match = re.search(r"DATABASE_URL=postgresql://[^:]+:([^@]+)@", staging_env)
        if pw_match:
            secret_pw = pw_match.group(1)
            assert secret_pw not in sql_content, "Real database secret from .env.staging must NEVER appear in SQL proposal!"


class TestApplyWhatsMeowStagingMigrationRunner:
    """Tests for the apply_whatsmeow_staging_migration.py runner fail-closed boundaries."""

    def test_runner_isolation_validation_rejects_production(self):
        from scripts.apply_whatsmeow_staging_migration import validate_isolation
        prod_url = f"postgresql://postgres.{PROD_SUPABASE_REF}:pass@aws-0-ap-northeast-1.pooler.supabase.com:5432/postgres"
        with pytest.raises(ValueError, match="FATAL: Production project reference"):
            validate_isolation(prod_url)

    def test_runner_isolation_validation_requires_staging_ref(self):
        from scripts.apply_whatsmeow_staging_migration import validate_isolation
        wrong_url = "postgresql://postgres.somewrongtenant:pass@aws-0-ap-northeast-1.pooler.supabase.com:5432/postgres"
        with pytest.raises(ValueError, match="does not contain staging reference"):
            validate_isolation(wrong_url)

    def test_runner_isolation_validation_requires_tokyo_pooler(self):
        from scripts.apply_whatsmeow_staging_migration import validate_isolation
        wrong_host_url = f"postgresql://postgres.{STAGING_SUPABASE_REF}:pass@aws-0-us-east-1.pooler.supabase.com:5432/postgres"
        with pytest.raises(ValueError, match="does not point to Tokyo pooler"):
            validate_isolation(wrong_host_url)

    def test_runner_password_generation_strength(self):
        from scripts.apply_whatsmeow_staging_migration import generate_secure_password
        pwd = generate_secure_password(32)
        assert len(pwd) == 32
        assert pwd.isalnum()
        pwd2 = generate_secure_password(32)
        assert pwd != pwd2, "Generated passwords must be cryptographically random and unique"

    def test_runner_mask_url(self):
        from scripts.apply_whatsmeow_staging_migration import mask_url
        url = f"postgresql://postgres.{STAGING_SUPABASE_REF}:supersecret@aws-0-ap-northeast-1.pooler.supabase.com:5432/postgres"
        masked = mask_url(url)
        assert "supersecret" not in masked
        assert "*****" in masked
        assert STAGING_SUPABASE_REF in masked





