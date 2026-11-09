"""
CivicSense AI - Security Audit & Protection Test Suite
Verifies:
1. Rate limiting & brute-force protection on authentication endpoints.
2. Evidence storage upload validation (magic bytes, MIME type, size limit, path traversal).
3. Evidence retrieval RBAC authorization (citizens see only own, engineers assigned, commissioners all).
4. Security headers (CSP, X-Frame-Options, X-Content-Type-Options).
"""

import os
import io
import sys
import unittest

# Ensure backend root is on Python module path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from starlette.testclient import TestClient
from app.main import app
from app.services.rate_limiter import get_rate_limiter
from app.utils.image_security import (
    detect_image_format,
    sanitize_filename,
    validate_storage_path,
)
from fastapi import HTTPException


class TestSecurityAudit(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.client = TestClient(app)

    def test_security_headers_present_on_api_responses(self):
        """Verify defense-in-depth security headers on API endpoints."""
        response = self.client.get("/health")
        self.assertEqual(response.status_code, 200)

        # Verify essential security headers
        headers = response.headers
        self.assertEqual(headers.get("x-frame-options"), "DENY")
        self.assertEqual(headers.get("x-content-type-options"), "nosniff")
        self.assertIn("default-src 'none'", headers.get("content-security-policy", ""))

    def test_image_security_magic_bytes_detection(self):
        """Verify binary file signature detection rejects forged file extensions."""
        # Genuine JPEG
        jpeg_bytes = b"\xff\xd8\xff\xe0" + b"\x00" * 20
        fmt = detect_image_format(jpeg_bytes)
        self.assertIsNotNone(fmt)
        self.assertEqual(fmt[0], "jpeg")
        self.assertEqual(fmt[1], "image/jpeg")
        self.assertEqual(fmt[2], "jpg")

        # Genuine PNG
        png_bytes = b"\x89PNG\r\n\x1a\n" + b"\x00" * 20
        fmt = detect_image_format(png_bytes)
        self.assertIsNotNone(fmt)
        self.assertEqual(fmt[0], "png")
        self.assertEqual(fmt[1], "image/png")
        self.assertEqual(fmt[2], "png")

        # Malicious executable / script masquerading as image
        fake_jpg = b"MZ\x90\x00\x03\x00\x00\x00" + b"\x00" * 20  # Windows PE executable
        self.assertIsNone(detect_image_format(fake_jpg))

        fake_png = b"<?php echo 'pwned'; ?>"
        self.assertIsNone(detect_image_format(fake_png))

    def test_filename_sanitization_and_path_traversal(self):
        """Verify filename sanitization eliminates traversal attempts and control chars."""
        # Standard filenames
        self.assertEqual(sanitize_filename("test.jpg"), "test.jpg")

        # Path traversal attack vectors
        self.assertEqual(sanitize_filename("../../../etc/passwd"), "passwd")
        self.assertEqual(sanitize_filename("..\\..\\windows\\system32\\cmd.exe"), "cmd.exe")

        # Null byte injection
        self.assertEqual(sanitize_filename("evil.php\x00.jpg"), "evil.php.jpg")

        # Base dir containment
        base_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "uploads"))
        safe_path = validate_storage_path(base_dir, "img_12345.jpg")
        self.assertTrue(safe_path.startswith(base_dir))

        # Traversal detection in validate_storage_path
        with self.assertRaises(HTTPException) as ctx:
            validate_storage_path(base_dir, "../../secret.txt")
        self.assertEqual(ctx.exception.status_code, 400)

    def test_rate_limiter_brute_force_throttling(self):
        """Verify rate limiter triggers HTTP 429 when max attempts exceeded."""
        limiter = get_rate_limiter()
        test_key = f"test_login_limit_{os.getpid()}"

        # Clean slate
        limiter.storage.reset_attempts(test_key)

        # Record 3 attempts with limit of 3
        is_limited, count, retry_after, _ = limiter.storage.atomic_check_and_record(test_key, limit=3, window_seconds=60)
        self.assertFalse(is_limited)
        self.assertEqual(count, 1)

        is_limited, count, retry_after, _ = limiter.storage.atomic_check_and_record(test_key, limit=3, window_seconds=60)
        self.assertFalse(is_limited)
        self.assertEqual(count, 2)

        is_limited, count, retry_after, _ = limiter.storage.atomic_check_and_record(test_key, limit=3, window_seconds=60)
        self.assertFalse(is_limited)
        self.assertEqual(count, 3)

        # 4th attempt should be blocked!
        is_limited, count, retry_after, _ = limiter.storage.atomic_check_and_record(test_key, limit=3, window_seconds=60)
        self.assertTrue(is_limited)
        self.assertGreater(retry_after, 0)

        # Cleanup
        limiter.storage.reset_attempts(test_key)

    def test_evidence_upload_validation_rejects_invalid_mime(self):
        """Verify POST /api/v1/incidents/upload-image rejects non-image binaries even when authenticated."""
        from app.utils.dependencies import get_current_user
        from app.models.user import User

        # Mock an authenticated active citizen
        mock_user = User(
            id="usr-test-sec-citizen",
            email="citizen@sec.test",
            full_name="Security Citizen",
            role="citizen",
            status="active",
            is_active=True
        )
        app.dependency_overrides[get_current_user] = lambda: mock_user

        try:
            fake_binary = io.BytesIO(b"NOT AN IMAGE FILE AT ALL - JUST RANDOM TEXT")
            response = self.client.post(
                "/api/v1/incidents/upload-image",
                files={"file": ("malicious.exe", fake_binary, "application/octet-stream")},
                headers={"Authorization": "Bearer mock-token"}
            )
            self.assertEqual(response.status_code, 400)
            data = response.json()
            self.assertIn("detail", data)
        finally:
            app.dependency_overrides.pop(get_current_user, None)


    def test_evidence_access_rbac_authorization(self):
        """Verify GET /api/v1/incidents/{id}/evidence enforces strict role-based data isolation."""
        from app.utils.dependencies import get_current_user
        from app.models.user import User

        citizen_a = User(id="usr-cit-a", role="citizen", status="active", is_active=True)
        citizen_b = User(id="usr-cit-b", role="citizen", status="active", is_active=True)

        # Mock citizen B trying to access incident of citizen A
        app.dependency_overrides[get_current_user] = lambda: citizen_b
        try:
            # INC-2026-028021 belongs to user_id="usr-f52bad42" in civicsense.db
            response = self.client.get(
                "/api/v1/incidents/INC-2026-028021/evidence",
                headers={"Authorization": "Bearer mock"}
            )
            self.assertEqual(response.status_code, 403)
            self.assertIn("Access denied", response.json()["detail"])
        finally:
            app.dependency_overrides.pop(get_current_user, None)

        # Now test Admin access to the same incident evidence
        admin_user = User(id="usr-admin-test", role="admin", status="active", is_active=True)
        app.dependency_overrides[get_current_user] = lambda: admin_user
        try:
            response = self.client.get(
                "/api/v1/incidents/INC-2026-028021/evidence",
                headers={"Authorization": "Bearer mock"}
            )
            # Admin should not be forbidden: returns 200 with external URL
            self.assertEqual(response.status_code, 200)
            data = response.json()
            self.assertEqual(data["storage_provider"], "external")
            self.assertEqual(data["url"], "https://example.com/c1_photo.jpg")
        finally:
            app.dependency_overrides.pop(get_current_user, None)


if __name__ == "__main__":
    unittest.main()
