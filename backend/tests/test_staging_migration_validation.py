"""
Unit tests for Staging Database Migration Isolation & Reference Validation Logic.
Verifies fail-closed validation boundaries without connecting to any database.
"""

import unittest
from scripts.run_staging_migration import (
    validate_environment_isolation,
    validate_storage_configuration,
    mask_database_url,
    StagingIsolationError,
    STAGING_PROJECT_REF,
    PRODUCTION_PROJECT_REF,
    EXPECTED_S3_BUCKET,
    EXPECTED_S3_REGION,
    EXPECTED_S3_ENDPOINT,
)


class TestStagingMigrationValidation(unittest.TestCase):
    def test_constants_integrity(self):
        """Verifies verified staging and production constants."""
        self.assertEqual(STAGING_PROJECT_REF, "oayzaszhhpfjlpmaezmc")
        self.assertEqual(len(STAGING_PROJECT_REF), 20)
        self.assertEqual(PRODUCTION_PROJECT_REF, "bcpgsvvjuxzowxqqmouk")
        self.assertEqual(len(PRODUCTION_PROJECT_REF), 20)
        self.assertIn("oayzaszhhpfjlpmaezmc", EXPECTED_S3_ENDPOINT)

    def test_valid_staging_url_accepted(self):
        """Verifies that a valid staging connection string passes validation."""
        valid_urls = [
            "postgresql://postgres.oayzaszhhpfjlpmaezmc:secret123@aws-0-ap-northeast-1.pooler.supabase.com:5432/postgres?sslmode=require",
            "postgresql+psycopg://postgres.oayzaszhhpfjlpmaezmc:secret123@aws-0-ap-northeast-1.pooler.supabase.com:5432/postgres?sslmode=require",
            "postgres://postgres.oayzaszhhpfjlpmaezmc:secret123@aws-0-ap-northeast-1.pooler.supabase.com:5432/postgres?sslmode=require",
        ]
        for url in valid_urls:
            try:
                validate_environment_isolation(url)
            except Exception as e:
                self.fail(f"Valid staging URL failed validation unexpectedly: {e}")

    def test_production_url_strictly_rejected(self):
        """Verifies that any connection string referencing production is strictly rejected."""
        prod_urls = [
            f"postgresql://postgres.{PRODUCTION_PROJECT_REF}:secret@aws-0-us-east-2.pooler.supabase.com:5432/postgres",
            f"postgresql://postgres.oayzaszhhpfjlpmaezmc:{PRODUCTION_PROJECT_REF}@aws-0-ap-northeast-1.pooler.supabase.com:5432/postgres",
        ]
        for url in prod_urls:
            with self.assertRaises(StagingIsolationError) as ctx:
                validate_environment_isolation(url)
            self.assertIn("FATAL ISOLATION VIOLATION", str(ctx.exception))
            self.assertIn(PRODUCTION_PROJECT_REF, str(ctx.exception))

    def test_old_incorrect_19_char_ref_rejected(self):
        """Verifies that the old 19-character reference is rejected."""
        old_url = "postgresql://postgres.oayzaszhhpfjlmaezmc:secret@aws-0-ap-northeast-1.pooler.supabase.com:5432/postgres"
        with self.assertRaises(StagingIsolationError) as ctx:
            validate_environment_isolation(old_url)
        self.assertIn("FATAL CONFIGURATION ERROR", str(ctx.exception))
        self.assertIn(STAGING_PROJECT_REF, str(ctx.exception))

    def test_generic_url_rejected(self):
        """Verifies that a generic or localhost URL without staging ref is rejected."""
        generic_url = "postgresql://user:pass@localhost:5432/civicsense"
        with self.assertRaises(StagingIsolationError) as ctx:
            validate_environment_isolation(generic_url)
        self.assertIn("FATAL CONFIGURATION ERROR", str(ctx.exception))

    def test_non_postgresql_scheme_rejected(self):
        """Verifies that SQLite schemes are rejected."""
        sqlite_url = f"sqlite:///./civicsense_{STAGING_PROJECT_REF}.db"
        with self.assertRaises(StagingIsolationError) as ctx:
            validate_environment_isolation(sqlite_url)
        self.assertIn("FATAL URL SCHEME ERROR", str(ctx.exception))

    def test_empty_url_rejected(self):
        """Verifies that empty URLs are rejected."""
        with self.assertRaises(StagingIsolationError) as ctx:
            validate_environment_isolation("")
        self.assertIn("missing or empty", str(ctx.exception))

    def test_storage_validation_logic(self):
        """Verifies staging S3 configuration validator."""
        # Valid staging configuration
        results = validate_storage_configuration(
            bucket_name=EXPECTED_S3_BUCKET,
            endpoint_url=EXPECTED_S3_ENDPOINT,
            region_name=EXPECTED_S3_REGION,
        )
        for _, passed, detail in results:
            self.assertTrue(passed, f"Storage check failed: {detail}")

        # Invalid: Points to production S3
        prod_results = validate_storage_configuration(
            bucket_name=EXPECTED_S3_BUCKET,
            endpoint_url=f"https://{PRODUCTION_PROJECT_REF}.supabase.co/storage/v1/s3",
            region_name=EXPECTED_S3_REGION,
        )
        endpoint_check = [r for r in prod_results if r[0] == "S3_ENDPOINT_URL"][0]
        self.assertFalse(endpoint_check[1])
        self.assertIn("FATAL", endpoint_check[2])

        # Invalid: Points to old 19-char ref
        old_results = validate_storage_configuration(
            bucket_name=EXPECTED_S3_BUCKET,
            endpoint_url="https://oayzaszhhpfjlmaezmc.supabase.co/storage/v1/s3",
            region_name=EXPECTED_S3_REGION,
        )
        old_endpoint_check = [r for r in old_results if r[0] == "S3_ENDPOINT_URL"][0]
        self.assertFalse(old_endpoint_check[1])

    def test_mask_database_url(self):
        """Verifies that passwords are completely redacted from connection strings."""
        raw_url = f"postgresql://postgres.{STAGING_PROJECT_REF}:SuperSecretPassword99!@aws-0-ap-northeast-1.pooler.supabase.com:5432/postgres?sslmode=require"
        masked = mask_database_url(raw_url)
        self.assertNotIn("SuperSecretPassword99!", masked)
        self.assertIn("*****", masked)
        self.assertIn(f"postgres.{STAGING_PROJECT_REF}", masked)
        self.assertIn("aws-0-ap-northeast-1.pooler.supabase.com:5432", masked)


if __name__ == "__main__":
    unittest.main()
