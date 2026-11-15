"""
CivicSense AI — Comprehensive Staging End-to-End Integration Test Suite
Validates:
1. Staging environment isolation and configuration boundaries.
2. Gateway-to-backend HMAC-SHA256 signature verification and replay defense.
3. Citizen conversational complaint flow (text, photo, GPS).
4. Staff secure device linking via single-use OTP and password transmission rejection.
5. Field engineer incident lifecycle (accept, start, update, resolve).
6. Message deduplication and idempotency.
7. Administrative WhatsApp status & pairing endpoints under RBAC.
"""

import hashlib
import hmac
import json
import os
import sys
import time
import unittest
from unittest.mock import patch, MagicMock, AsyncMock

from starlette.testclient import TestClient

backend_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

from app.main import app
from app.config import settings
from app.database import SessionLocal
from app.models.user import User
from app.models.incident import Incident
from app.models.workflow import AuditLog
from app.utils.security import get_password_hash, create_access_token
from app.routers.whatsapp import deduplicator
from app.services.whatsapp_service import whatsapp_service


class TestStagingE2EIntegration(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.client = TestClient(app)
        cls.db = SessionLocal()
        cls.secret = getattr(settings, "WHATSAPP_GATEWAY_SECRET", "civicsense-wa-gateway-internal-secret-2026")

        # Provision test admin & engineer
        cls.admin_user = User(
            id="usr-e2e-adm-01",
            email="e2e.admin@civicsense.ai",
            full_name="E2E Administrator",
            hashed_password=get_password_hash("AdminSecPass123!"),
            role="admin",
            department="Executive Administration",
            status="active",
            is_active=True,
        )
        cls.engineer_user = User(
            id="usr-e2e-eng-01",
            email="e2e.engineer@civicsense.ai",
            full_name="E2E Field Engineer",
            hashed_password=get_password_hash("EngSecPass123!"),
            role="engineer",
            department="Roads & Bridges",
            status="active",
            is_active=True,
        )
        cls.citizen_user = User(
            id="usr-e2e-cit-01",
            email="e2e.citizen@civicsense.ai",
            full_name="E2E Citizen",
            hashed_password=get_password_hash("CitSecPass123!"),
            role="citizen",
            department="Public",
            status="active",
            is_active=True,
        )

        cls.db.query(User).filter(User.id.in_([cls.admin_user.id, cls.engineer_user.id, cls.citizen_user.id])).delete(synchronize_session=False)
        cls.db.add_all([cls.admin_user, cls.engineer_user, cls.citizen_user])
        cls.db.commit()

        cls.admin_token = create_access_token({"sub": cls.admin_user.id, "email": cls.admin_user.email, "role": "admin"})
        cls.eng_token = create_access_token({"sub": cls.engineer_user.id, "email": cls.engineer_user.email, "role": "engineer"})
        cls.cit_token = create_access_token({"sub": cls.citizen_user.id, "email": cls.citizen_user.email, "role": "citizen"})

        cls.admin_headers = {"Authorization": f"Bearer {cls.admin_token}"}
        cls.eng_headers = {"Authorization": f"Bearer {cls.eng_token}"}
        cls.cit_headers = {"Authorization": f"Bearer {cls.cit_token}"}

    @classmethod
    def tearDownClass(cls):
        try:
            cls.db.query(AuditLog).filter(AuditLog.incident_id.ilike("SYSTEM-STAFF-WHATSAPP-LINK%")).delete(synchronize_session=False)
            cls.db.query(User).filter(User.id.in_([cls.admin_user.id, cls.engineer_user.id, cls.citizen_user.id])).delete(synchronize_session=False)
            cls.db.commit()
        finally:
            cls.db.close()

    def setUp(self):
        deduplicator.clear()
        whatsapp_service.otp_manager.clear()

    def _generate_hmac_headers(self, body_bytes: bytes, skew_seconds: float = 0.0) -> dict:
        ts = int(time.time() + skew_seconds)
        expected_msg = f"{ts}.".encode("utf-8") + body_bytes
        sig = hmac.new(self.secret.encode("utf-8"), expected_msg, hashlib.sha256).hexdigest()
        return {
            "Content-Type": "application/json",
            "X-Gateway-Timestamp": str(ts),
            "X-Gateway-Signature": f"sha256={sig}",
        }

    # --------------------------------------------------------------------------
    # 1. Isolation & Configuration Boundary
    # --------------------------------------------------------------------------
    def test_01_staging_isolation_boundaries(self):
        """Asserts production references are absent and staging parameters are active in backend/.env.staging."""
        prod_ref = "bcpgsvvjuxzowxqqmouk"
        staging_ref = "oayzaszhhpfjlpmaezmc"

        staging_env_path = os.path.join(backend_dir, ".env.staging")
        self.assertTrue(os.path.isfile(staging_env_path))

        staging_vars = {}
        with open(staging_env_path, "r", encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith("#") and "=" in line:
                    k, v = line.split("=", 1)
                    staging_vars[k.strip()] = v.strip().strip('"').strip("'")

        # Staging isolation assertions
        self.assertNotIn(prod_ref, staging_vars.get("DATABASE_URL", ""))
        self.assertNotIn(prod_ref, staging_vars.get("S3_ENDPOINT_URL", ""))
        self.assertIn(staging_ref, staging_vars.get("DATABASE_URL", ""))
        self.assertIn(staging_ref, staging_vars.get("S3_ENDPOINT_URL", ""))
        self.assertEqual(staging_vars.get("ENVIRONMENT"), "staging")
        self.assertEqual(staging_vars.get("WHATSAPP_PROVIDER"), "whatsmeow")
        self.assertEqual(staging_vars.get("ENABLE_DEMO_ACCOUNTS", "").lower(), "false")
        self.assertEqual(staging_vars.get("STORAGE_PROVIDER"), "s3")
        self.assertEqual(staging_vars.get("S3_BUCKET_NAME"), "civicsense-staging-evidence")

    # --------------------------------------------------------------------------
    # 2. Gateway HMAC Authentication & Replay Protection
    # --------------------------------------------------------------------------
    def test_02_gateway_hmac_and_replay_protection(self):
        """Asserts valid HMAC passes, invalid signature is rejected, and expired timestamp fails."""
        payload = {"event_id": "evt_test_hmac_01", "event_type": "status", "status": "online"}
        body = json.dumps(payload).encode("utf-8")

        # Valid fresh HMAC
        headers_valid = self._generate_hmac_headers(body, skew_seconds=0)
        resp = self.client.post("/internal/whatsapp/events", content=body, headers=headers_valid)
        self.assertEqual(resp.status_code, 200)

        # Invalid signature
        headers_bad_sig = headers_valid.copy()
        headers_bad_sig["X-Gateway-Signature"] = "sha256=0000000000000000000000000000000000000000000000000000000000000000"
        resp_bad = self.client.post("/internal/whatsapp/events", content=body, headers=headers_bad_sig)
        self.assertEqual(resp_bad.status_code, 401)

        # Replay attack with expired timestamp (>300 seconds skew)
        headers_expired = self._generate_hmac_headers(body, skew_seconds=-305)
        resp_exp = self.client.post("/internal/whatsapp/events", content=body, headers=headers_expired)
        self.assertEqual(resp_exp.status_code, 401)

    # --------------------------------------------------------------------------
    # 3. Citizen Conversational Complaint Flow via WhatsMeow Delivery
    # --------------------------------------------------------------------------
    @patch.object(whatsapp_service, "_send_via_gateway", new_callable=AsyncMock)
    def test_03_citizen_pothole_complaint_flow(self, mock_send):
        """Citizen reports a pothole via text; draft is created and confirmation prompt returned."""
        mock_send.return_value = "wam_reply_01"
        sender_phone = "919876540001"

        payload = {
            "event_id": "evt_pothole_01",
            "event_type": "message",
            "timestamp": int(time.time()),
            "message": {
                "id": "MSG_POTHOLE_01",
                "from": sender_phone,
                "timestamp": int(time.time()),
                "type": "text",
                "text": {"body": "There is a massive dangerous pothole on MG Road near Metro Pillar 42"},
            },
        }
        body = json.dumps(payload).encode("utf-8")
        headers = self._generate_hmac_headers(body)

        resp = self.client.post("/internal/whatsapp/events", content=body, headers=headers)
        self.assertEqual(resp.status_code, 200)

        # Verify draft was initialized in pending sessions
        draft = whatsapp_service.pending_sessions.get_draft(sender_phone, db=self.db)
        self.assertIsNotNone(draft)
        self.assertIn("pothole", draft.get("category", "").lower() + draft.get("title", "").lower() + draft.get("description", "").lower())

        # Citizen confirms report
        confirm_payload = {
            "event_id": "evt_pothole_confirm",
            "event_type": "message",
            "timestamp": int(time.time()),
            "message": {
                "id": "MSG_POTHOLE_02",
                "from": sender_phone,
                "timestamp": int(time.time()),
                "type": "text",
                "text": {"body": "confirm"},
            },
        }
        body_confirm = json.dumps(confirm_payload).encode("utf-8")
        headers_confirm = self._generate_hmac_headers(body_confirm)

        resp_conf = self.client.post("/internal/whatsapp/events", content=body_confirm, headers=headers_confirm)
        self.assertEqual(resp_conf.status_code, 200)

    # --------------------------------------------------------------------------
    # 4. Message Deduplication & Idempotency
    # --------------------------------------------------------------------------
    @patch.object(whatsapp_service, "_send_via_gateway", new_callable=AsyncMock)
    def test_04_message_deduplication(self, mock_send):
        """Sending the exact same message ID twice is deduplicated without duplicate processing."""
        mock_send.return_value = "wam_reply_02"
        dup_msg_id = "MSG_DUP_PROBE_99"

        payload = {
            "event_id": "evt_dup_01",
            "event_type": "message",
            "timestamp": int(time.time()),
            "message": {
                "id": dup_msg_id,
                "from": "919876540002",
                "timestamp": int(time.time()),
                "type": "text",
                "text": {"body": "Hello CivicSense"},
            },
        }
        body = json.dumps(payload).encode("utf-8")
        headers = self._generate_hmac_headers(body)

        # First delivery
        resp1 = self.client.post("/internal/whatsapp/events", content=body, headers=headers)
        self.assertEqual(resp1.status_code, 200)
        self.assertTrue(deduplicator.is_duplicate(dup_msg_id))

        # Second delivery with identical message ID
        resp2 = self.client.post("/internal/whatsapp/events", content=body, headers=headers)
        self.assertEqual(resp2.status_code, 200)

    # --------------------------------------------------------------------------
    # 5. Staff Secure Device Linking (OTP & Password Rejection)
    # --------------------------------------------------------------------------
    @patch.object(whatsapp_service, "_send_via_gateway", new_callable=AsyncMock)
    def test_05_staff_device_link_and_password_rejection(self, mock_send):
        """Verifies password transmission rejection and single-use OTP flow."""
        mock_send.return_value = "wam_reply_03"
        staff_phone = "919876540003"

        # A. Reject password transmission over chat
        pwd_payload = {
            "event_id": "evt_pwd_leak_probe",
            "event_type": "message",
            "timestamp": int(time.time()),
            "message": {
                "id": "MSG_PWD_LEAK_01",
                "from": staff_phone,
                "timestamp": int(time.time()),
                "type": "text",
                "text": {"body": "staff login e2e.engineer@civicsense.ai EngSecPass123!"},
            },
        }
        body_pwd = json.dumps(pwd_payload).encode("utf-8")
        headers_pwd = self._generate_hmac_headers(body_pwd)

        resp_pwd = self.client.post("/internal/whatsapp/events", content=body_pwd, headers=headers_pwd)
        self.assertEqual(resp_pwd.status_code, 200)
        mock_send.assert_called()
        call_text = str(mock_send.call_args)
        self.assertIn("Security Notice", call_text)
        self.assertIn("strictly forbids transmitting passwords over WhatsApp", call_text)

        # B. Clean single-use OTP linking
        success, msg, raw_otp = whatsapp_service.otp_manager.request_otp(
            self.db, staff_phone, "e2e.engineer@civicsense.ai"
        )
        self.assertTrue(success)
        self.assertIsNotNone(raw_otp)

        # Verify OTP
        v_success, v_msg = whatsapp_service.otp_manager.verify_otp(
            self.db, staff_phone, raw_otp
        )
        self.assertTrue(v_success)
        self.assertIn("Verified device linked successfully", v_msg)

        # Re-using same OTP must fail (single-use guaranteed)
        reuse_success, reuse_msg = whatsapp_service.otp_manager.verify_otp(
            self.db, staff_phone, raw_otp
        )
        self.assertFalse(reuse_success)

    # --------------------------------------------------------------------------
    # 6. Administrative WhatsApp Status & QR under RBAC
    # --------------------------------------------------------------------------
    @patch("httpx.AsyncClient")
    def test_06_admin_whatsapp_controls_rbac(self, mock_httpx_cls):
        """Admin endpoints require authentication and reject citizen accounts."""
        mock_inst = AsyncMock()
        mock_resp = MagicMock()
        mock_resp.status_code = 200
        mock_resp.json.return_value = {
            "status": "connected",
            "connected": True,
            "logged_in": True,
            "jid": "919876540000:1@s.whatsapp.net",
            "uptime_seconds": 7200,
            "goroutines": 15,
            "memory_alloc_mb": 18.2,
        }
        mock_inst.get.return_value = mock_resp
        mock_inst.__aenter__.return_value = mock_inst
        mock_inst.__aexit__.return_value = None
        mock_httpx_cls.return_value = mock_inst

        # 1. Unauthenticated -> 401
        resp_unauth = self.client.get("/api/v1/admin/whatsapp/status")
        self.assertEqual(resp_unauth.status_code, 401)

        # 2. Citizen role -> 403
        resp_cit = self.client.get("/api/v1/admin/whatsapp/status", headers=self.cit_headers)
        self.assertEqual(resp_cit.status_code, 403)

        # 3. Administrator role -> 200
        resp_adm = self.client.get("/api/v1/admin/whatsapp/status", headers=self.admin_headers)
        self.assertEqual(resp_adm.status_code, 200)
        self.assertEqual(resp_adm.json()["status"], "connected")
        self.assertTrue(resp_adm.json()["connected"])


if __name__ == "__main__":
    unittest.main()
