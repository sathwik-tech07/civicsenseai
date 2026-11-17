"""
CivicSense AI - WhatsApp Gateway Integration Tests
Validates HMAC-SHA256 request authentication, replay protection,
event ingestion, deduplication, administrative proxying, and outbound dispatch.
"""

import hashlib
import hmac
import json
import time
import unittest
from unittest.mock import patch, MagicMock, AsyncMock

import httpx
from starlette.testclient import TestClient
from app.main import app
from app.config import settings
from app.database import SessionLocal
from app.models.user import User
from app.utils.security import get_password_hash, create_access_token
from app.routers.whatsapp import deduplicator
from app.services.whatsapp_service import whatsapp_service


class TestInternalWhatsAppGateway(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.db = SessionLocal()
        cls.admin_user = User(
            id="usr-wa-test-admin-99",
            email="admin.wa.test@civicsense.ai",
            full_name="WA Test Admin",
            hashed_password=get_password_hash("AdminPass123!"),
            role="admin",
            department="IT Operations",
            status="active",
            is_active=True,
        )
        cls.cit_user = User(
            id="usr-wa-test-cit-99",
            email="citizen.wa.test@civicsense.ai",
            full_name="WA Test Citizen",
            hashed_password=get_password_hash("CitizenPass123!"),
            role="citizen",
            department="Public",
            status="active",
            is_active=True,
        )
        # Ensure fresh state
        cls.db.query(User).filter(User.id.in_([cls.admin_user.id, cls.cit_user.id])).delete(synchronize_session=False)
        cls.db.add_all([cls.admin_user, cls.cit_user])
        cls.db.commit()

        cls.admin_token = create_access_token(data={"sub": cls.admin_user.id, "email": cls.admin_user.email, "role": "admin"})
        cls.cit_token = create_access_token(data={"sub": cls.cit_user.id, "email": cls.cit_user.email, "role": "citizen"})
        cls.admin_headers = {"Authorization": f"Bearer {cls.admin_token}"}
        cls.cit_headers = {"Authorization": f"Bearer {cls.cit_token}"}

    @classmethod
    def tearDownClass(cls):
        try:
            cls.db.query(User).filter(User.id.in_([cls.admin_user.id, cls.cit_user.id])).delete(synchronize_session=False)
            cls.db.commit()
        finally:
            cls.db.close()

    def setUp(self):
        self.client = TestClient(app)
        self.secret = getattr(settings, "WHATSAPP_GATEWAY_SECRET", "civicsense-wa-gateway-internal-secret-2026")
        deduplicator.clear()

    def _generate_hmac_headers(self, body_bytes: bytes, skew_seconds: float = 0.0) -> dict:
        ts = int(time.time() + skew_seconds)
        expected_msg = f"{ts}.".encode("utf-8") + body_bytes
        sig = hmac.new(self.secret.encode("utf-8"), expected_msg, hashlib.sha256).hexdigest()
        return {
            "Content-Type": "application/json",
            "X-Gateway-Timestamp": str(ts),
            "X-Gateway-Signature": f"sha256={sig}",
        }

    # ==========================================================================
    # 1. SECURITY & HMAC VERIFICATION TESTS
    # ==========================================================================

    def test_missing_auth_rejected(self):
        """Requests without Authorization or HMAC signature headers must return 401."""
        resp = self.client.post("/internal/whatsapp/events", json={"event_type": "status"})
        self.assertEqual(resp.status_code, 401)
        self.assertIn("Unauthorized", resp.json()["detail"])

    def test_bearer_token_accepted(self):
        """Requests with a valid Bearer token matching WHATSAPP_GATEWAY_SECRET must be accepted."""
        payload = {
            "event_id": "evt_bearer_1",
            "event_type": "status",
            "status": "connected",
        }
        resp = self.client.post(
            "/internal/whatsapp/events",
            json=payload,
            headers={"Authorization": f"Bearer {self.secret}"},
        )
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.json()["status"], "ok")

    def test_invalid_bearer_token_rejected(self):
        """Requests with an incorrect Bearer token must return 401."""
        payload = {"event_id": "evt_bad_bearer", "event_type": "status"}
        resp = self.client.post(
            "/internal/whatsapp/events",
            json=payload,
            headers={"Authorization": "Bearer totally-wrong-token"},
        )
        self.assertEqual(resp.status_code, 401)

    @patch.object(whatsapp_service, "_send_via_gateway", new_callable=AsyncMock)
    def test_valid_hmac_signature_accepted(self, mock_send):
        """Requests with a valid HMAC-SHA256 signature and fresh timestamp must be accepted."""
        mock_send.return_value = "wam_mock_reply"
        payload = {
            "event_id": "evt_hmac_valid",
            "event_type": "message",
            "timestamp": int(time.time()),
            "message": {
                "id": "MSG_HMAC_1001",
                "from": "919876543210",
                "sender_name": "Test Citizen",
                "timestamp": int(time.time()),
                "type": "text",
                "text": {"body": "Hi"},
            },
        }
        body_bytes = json.dumps(payload).encode("utf-8")
        headers = self._generate_hmac_headers(body_bytes)

        resp = self.client.post("/internal/whatsapp/events", content=body_bytes, headers=headers)
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.json()["status"], "ok")

    def test_tampered_body_hmac_rejected(self):
        """Tampering with the payload body after signature generation must return 401."""
        payload = {"event_id": "evt_tamper", "event_type": "status"}
        body_bytes = json.dumps(payload).encode("utf-8")
        headers = self._generate_hmac_headers(body_bytes)

        # Alter body after signature was computed
        tampered_bytes = json.dumps({"event_id": "evt_tampered!", "event_type": "status"}).encode("utf-8")
        resp = self.client.post("/internal/whatsapp/events", content=tampered_bytes, headers=headers)
        self.assertEqual(resp.status_code, 401)

    def test_expired_timestamp_hmac_rejected(self):
        """Signatures with timestamps skewed > 300 seconds must be rejected for replay protection."""
        payload = {"event_id": "evt_replay", "event_type": "status"}
        body_bytes = json.dumps(payload).encode("utf-8")
        headers = self._generate_hmac_headers(body_bytes, skew_seconds=-400)  # 400 seconds in past

        resp = self.client.post("/internal/whatsapp/events", content=body_bytes, headers=headers)
        self.assertEqual(resp.status_code, 401)
        self.assertIn("clock skew", resp.json()["detail"])

    # ==========================================================================
    # 2. EVENT INGESTION & DEDUPLICATION TESTS
    # ==========================================================================

    @patch.object(whatsapp_service, "_send_via_gateway", new_callable=AsyncMock)
    def test_inbound_message_deduplication(self, mock_send):
        """Sending the same message ID twice should deduplicate and prevent duplicate processing."""
        mock_send.return_value = "wam_mock_reply"
        payload = {
            "event_id": "evt_dedup_1",
            "event_type": "message",
            "timestamp": int(time.time()),
            "message": {
                "id": "MSG_DUPLICATE_999",
                "from": "919876543210",
                "timestamp": int(time.time()),
                "type": "text",
                "text": {"body": "Duplicate test"},
            },
        }
        body_bytes = json.dumps(payload).encode("utf-8")
        headers = self._generate_hmac_headers(body_bytes)

        # First request records the message ID
        resp1 = self.client.post("/internal/whatsapp/events", content=body_bytes, headers=headers)
        self.assertEqual(resp1.status_code, 200)
        self.assertTrue(deduplicator.contains("MSG_DUPLICATE_999"))

        # Second request with same message ID is acknowledged but skipped in background
        resp2 = self.client.post("/internal/whatsapp/events", content=body_bytes, headers=headers)
        self.assertEqual(resp2.status_code, 200)

    # ==========================================================================
    # 3. ADMINISTRATIVE PROXY ENDPOINTS (WITH RBAC)
    # ==========================================================================

    def test_admin_whatsapp_endpoints_require_rbac(self):
        """Unauthenticated requests get 401; non-admin/commissioner get 403."""
        # Unauthenticated
        resp_unauth = self.client.get("/api/v1/admin/whatsapp/status")
        self.assertEqual(resp_unauth.status_code, 401)

        # Citizen role
        resp_cit = self.client.get("/api/v1/admin/whatsapp/status", headers=self.cit_headers)
        self.assertEqual(resp_cit.status_code, 403)

    @patch("httpx.AsyncClient")
    def test_admin_whatsapp_status_online(self, mock_client_cls):
        """Admin status returns active gateway telemetry when Go service responds."""
        mock_inst = AsyncMock()
        mock_resp = MagicMock()
        mock_resp.status_code = 200
        mock_resp.json.return_value = {
            "status": "connected",
            "connected": True,
            "logged_in": True,
            "jid": "919876543210:1@s.whatsapp.net",
            "uptime_seconds": 3600,
            "goroutines": 12,
            "memory_alloc_mb": 14.5,
        }
        mock_inst.get.return_value = mock_resp
        mock_inst.__aenter__.return_value = mock_inst
        mock_inst.__aexit__.return_value = None
        mock_client_cls.return_value = mock_inst

        resp = self.client.get("/api/v1/admin/whatsapp/status", headers=self.admin_headers)
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertEqual(data["status"], "connected")
        self.assertTrue(data["connected"])
        self.assertEqual(data["jid"], "919876543210:1@s.whatsapp.net")

    @patch("httpx.AsyncClient")
    def test_admin_whatsapp_status_graceful_offline(self, mock_client_cls):
        """Admin status returns graceful offline state when Go service is down."""
        mock_inst = AsyncMock()
        mock_inst.get.side_effect = httpx.RequestError("Connection refused")
        mock_inst.__aenter__.return_value = mock_inst
        mock_inst.__aexit__.return_value = None
        mock_client_cls.return_value = mock_inst

        resp = self.client.get("/api/v1/admin/whatsapp/status", headers=self.admin_headers)
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertEqual(data["status"], "offline")
        self.assertFalse(data["connected"])

    @patch("httpx.AsyncClient")
    def test_admin_whatsapp_qr_endpoint(self, mock_client_cls):
        """Admin QR endpoint returns current pairing QR code for frontend."""
        mock_inst = AsyncMock()
        mock_resp = MagicMock()
        mock_resp.status_code = 200
        mock_resp.json.return_value = {
            "status": "qr_ready",
            "qr_code": "2@mockqrstring...",
            "qr_png_base64": "iVBORw0KGgoAAAANSUhEUgAA...",
            "generated_at": "2026-11-13T12:00:00Z",
            "expires_at": "2026-11-13T12:00:60Z",
        }
        mock_inst.get.return_value = mock_resp
        mock_inst.__aenter__.return_value = mock_inst
        mock_inst.__aexit__.return_value = None
        mock_client_cls.return_value = mock_inst

        resp = self.client.get("/api/v1/admin/whatsapp/qr", headers=self.admin_headers)
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertEqual(data["status"], "qr_ready")
        self.assertIsNotNone(data["qr_png_base64"])

    # ==========================================================================
    # 4. OUTBOUND DISPATCH VIA GO GATEWAY
    # ==========================================================================

    @patch("httpx.AsyncClient")
    def test_send_text_via_gateway(self, mock_client_cls):
        """Outbound text message dispatches POST /api/v1/send with Bearer auth to Gateway."""
        mock_inst = AsyncMock()
        mock_resp = MagicMock()
        mock_resp.status_code = 200
        mock_resp.raise_for_status.return_value = None
        mock_resp.json.return_value = {
            "status": "sent",
            "message_id": "wam_test_12345",
            "timestamp": 1731500000,
        }
        mock_inst.post.return_value = mock_resp
        mock_inst.__aenter__.return_value = mock_inst
        mock_inst.__aexit__.return_value = None
        mock_client_cls.return_value = mock_inst

        with patch.object(settings, "WHATSAPP_PROVIDER", "whatsmeow"):
            import asyncio
            msg_id = asyncio.run(whatsapp_service.send_text_message("919876543210", "CivicSense Update"))
            self.assertEqual(msg_id, "wam_test_12345")

            # Verify endpoint and authorization header
            mock_inst.post.assert_called_once()
            called_args, called_kwargs = mock_inst.post.call_args
            self.assertIn("/api/v1/send", called_args[0])
            self.assertEqual(called_kwargs["headers"]["Authorization"], f"Bearer {self.secret}")
            self.assertEqual(called_kwargs["json"]["recipient"], "919876543210")
            self.assertEqual(called_kwargs["json"]["text"], "CivicSense Update")

    # ==========================================================================
    # 5. SECURE STAFF AUTHENTICATION (OTP & PASSWORD TRANSMISSION REJECTION)
    # ==========================================================================

    @patch.object(whatsapp_service, "_send_via_gateway", new_callable=AsyncMock)
    def test_staff_password_transmission_rejected_via_gateway(self, mock_send):
        """Transmitting passwords in WhatsApp commands is strictly rejected with a security notice."""
        mock_send.return_value = "wam_mock_reply"
        payload = {
            "event_id": "evt_pwd_reject",
            "event_type": "message",
            "timestamp": int(time.time()),
            "message": {
                "id": "MSG_PWD_001",
                "from": "919876543999",
                "timestamp": int(time.time()),
                "type": "text",
                "text": {"body": "staff login engineer@civicsense.ai SuperSecretPassword123!"},
            },
        }
        body_bytes = json.dumps(payload).encode("utf-8")
        headers = self._generate_hmac_headers(body_bytes)

        resp = self.client.post("/internal/whatsapp/events", content=body_bytes, headers=headers)
        self.assertEqual(resp.status_code, 200)

        # Verify outgoing warning was dispatched
        mock_send.assert_called_once()
        called_args, called_kwargs = mock_send.call_args
        warning_text = called_kwargs.get("text") or (called_args[1] if len(called_args) > 1 else str(called_args))
        self.assertIn("Security Notice", warning_text)
        self.assertIn("strictly forbids transmitting passwords over WhatsApp", warning_text)
        self.assertNotIn("SuperSecretPassword123!", warning_text)

    @patch.object(whatsapp_service, "_send_via_gateway", new_callable=AsyncMock)
    def test_staff_otp_lifecycle_via_gateway(self, mock_send):
        """Staff device linking functions cleanly via OTP generation and verification without passwords."""
        from app.database import SessionLocal
        from app.models.user import User
        from app.utils.security import get_password_hash

        mock_send.return_value = "wam_mock_reply"
        db = SessionLocal()
        staff_phone = "919876543888"
        staff_email = "engineer.gw.test@civicsense.ai"

        try:
            # Clean up and pre-provision active staff engineer
            db.query(User).filter(User.email == staff_email).delete()
            db.query(User).filter(User.id == f"usr-wa-{staff_phone}").delete()
            db.commit()

            staff = User(
                id="usr-staff-gw-01",
                email=staff_email,
                full_name="Gateway Test Engineer",
                hashed_password=get_password_hash("PasswordNotSent123!"),
                role="engineer",
                department="Electrical & Signals",
                status="active",
                is_active=True,
            )
            db.add(staff)
            db.commit()

            whatsapp_service.otp_manager.clear()

            # 1. Initiate OTP link request
            payload_req = {
                "event_id": "evt_otp_req",
                "event_type": "message",
                "timestamp": int(time.time()),
                "message": {
                    "id": "MSG_OTP_REQ_01",
                    "from": staff_phone,
                    "timestamp": int(time.time()),
                    "type": "text",
                    "text": {"body": f"staff link {staff_email}"},
                },
            }
            body_req = json.dumps(payload_req).encode("utf-8")
            headers_req = self._generate_hmac_headers(body_req)

            resp = self.client.post("/internal/whatsapp/events", content=body_req, headers=headers_req)
            self.assertEqual(resp.status_code, 200)

            # Retrieve active OTP
            pending = whatsapp_service.otp_manager._otps.get(staff_phone)
            self.assertIsNotNone(pending)

            # Generate the matching raw code by testing verification
            success, _, raw_otp = whatsapp_service.otp_manager.request_otp(db, staff_phone, staff_email)

            # 2. Verify with invalid code first
            mock_send.reset_mock()
            payload_bad = {
                "event_id": "evt_otp_bad",
                "event_type": "message",
                "timestamp": int(time.time()),
                "message": {
                    "id": "MSG_OTP_BAD_01",
                    "from": staff_phone,
                    "timestamp": int(time.time()),
                    "type": "text",
                    "text": {"body": "verify 000000"},
                },
            }
            body_bad = json.dumps(payload_bad).encode("utf-8")
            headers_bad = self._generate_hmac_headers(body_bad)
            resp = self.client.post("/internal/whatsapp/events", content=body_bad, headers=headers_bad)
            self.assertEqual(resp.status_code, 200)
            mock_send.assert_called_once()
            bad_text = mock_send.call_args[1].get("text", "") if mock_send.call_args[1] else mock_send.call_args[0][1]
            self.assertIn("Invalid verification code", bad_text)

            # 3. Verify with valid code
            mock_send.reset_mock()
            payload_good = {
                "event_id": "evt_otp_good",
                "event_type": "message",
                "timestamp": int(time.time()),
                "message": {
                    "id": "MSG_OTP_GOOD_01",
                    "from": staff_phone,
                    "timestamp": int(time.time()),
                    "type": "text",
                    "text": {"body": f"verify {raw_otp}"},
                },
            }
            body_good = json.dumps(payload_good).encode("utf-8")
            headers_good = self._generate_hmac_headers(body_good)
            resp = self.client.post("/internal/whatsapp/events", content=body_good, headers=headers_good)
            self.assertEqual(resp.status_code, 200)
            mock_send.assert_called_once()
            good_text = mock_send.call_args[1].get("text", "") if mock_send.call_args[1] else mock_send.call_args[0][1]
            self.assertIn("Verified device linked successfully", good_text)

            # Verify engineer role assigned to wa user in DB
            wa_user = db.query(User).filter(User.id == f"usr-wa-{staff_phone}").first()
            self.assertIsNotNone(wa_user)
            self.assertEqual(wa_user.role, "engineer")

            # 4. Single-use: Reusing the same code must fail
            mock_send.reset_mock()
            payload_reuse = {
                "event_id": "evt_otp_reuse",
                "event_type": "message",
                "timestamp": int(time.time()),
                "message": {
                    "id": "MSG_OTP_REUSE_01",
                    "from": staff_phone,
                    "timestamp": int(time.time()),
                    "type": "text",
                    "text": {"body": f"verify {raw_otp}"},
                },
            }
            body_reuse = json.dumps(payload_reuse).encode("utf-8")
            headers_reuse = self._generate_hmac_headers(body_reuse)
            resp = self.client.post("/internal/whatsapp/events", content=body_reuse, headers=headers_reuse)
            self.assertEqual(resp.status_code, 200)
            mock_send.assert_called_once()
            reuse_text = mock_send.call_args[1].get("text", "") if mock_send.call_args[1] else mock_send.call_args[0][1]
            self.assertIn("No active device linking request found", reuse_text)

        finally:
            from app.models.workflow import AuditLog
            db.query(AuditLog).filter(AuditLog.incident_id == "SYSTEM-STAFF-WHATSAPP-LINK").delete()
            db.query(User).filter(User.email == staff_email).delete()
            db.query(User).filter(User.id == f"usr-wa-{staff_phone}").delete()
            db.commit()
            db.close()

    # ==========================================================================
    # 6. WHATSAPP WHITELIST / PRIVACY FILTER TESTS
    # ==========================================================================

    @patch.object(whatsapp_service, "_send_via_gateway", new_callable=AsyncMock)
    def test_whitelist_suppresses_unlisted_sender(self, mock_send):
        """When whitelist is enabled, messages from unlisted numbers are suppressed to protect personal accounts."""
        manager = whatsapp_service.whitelist_manager
        orig_enabled = manager.is_enabled
        try:
            manager.set_enabled(True)
            unlisted_phone = "919999888777"
            # Ensure not in whitelist
            manager.remove_number(unlisted_phone)

            payload = {
                "event_id": f"evt_unlisted_{int(time.time())}",
                "event_type": "message",
                "timestamp": int(time.time()),
                "message": {
                    "id": f"MSG_UNLISTED_{int(time.time())}",
                    "from": unlisted_phone,
                    "timestamp": int(time.time()),
                    "type": "text",
                    "text": {"body": "hello how are you"},
                },
            }
            body = json.dumps(payload).encode("utf-8")
            headers = self._generate_hmac_headers(body)
            resp = self.client.post("/internal/whatsapp/events", content=body, headers=headers)
            self.assertEqual(resp.status_code, 200)
            self.assertEqual(resp.json()["status"], "ok")
            mock_send.assert_not_called()
        finally:
            manager.set_enabled(orig_enabled)

    @patch.object(whatsapp_service, "_send_via_gateway", new_callable=AsyncMock)
    def test_whitelist_allows_listed_sender(self, mock_send):
        """When whitelist is enabled, whitelisted numbers receive automated replies normally."""
        manager = whatsapp_service.whitelist_manager
        orig_enabled = manager.is_enabled
        test_phone = "919876543210"
        try:
            manager.set_enabled(True)
            manager.add_number(test_phone, label="Whitelisted QA Tester")
            mock_send.return_value = "wam_mock_reply"

            payload = {
                "event_id": f"evt_listed_{int(time.time())}",
                "event_type": "message",
                "timestamp": int(time.time()),
                "message": {
                    "id": f"MSG_LISTED_{int(time.time())}",
                    "from": test_phone,
                    "timestamp": int(time.time()),
                    "type": "text",
                    "text": {"body": "hi there"},
                },
            }
            body = json.dumps(payload).encode("utf-8")
            headers = self._generate_hmac_headers(body)
            resp = self.client.post("/internal/whatsapp/events", content=body, headers=headers)
            self.assertEqual(resp.status_code, 200)
            mock_send.assert_called()
        finally:
            manager.remove_number(test_phone)
            manager.set_enabled(orig_enabled)

    @patch.object(whatsapp_service, "_send_via_gateway", new_callable=AsyncMock)
    def test_whitelist_bypass_keyword(self, mock_send):
        """Messages starting with #civic or !civic bypass the whitelist filter."""
        manager = whatsapp_service.whitelist_manager
        orig_enabled = manager.is_enabled
        unlisted_phone = "919999111222"
        try:
            manager.set_enabled(True)
            manager.remove_number(unlisted_phone)
            mock_send.return_value = "wam_mock_reply"

            payload = {
                "event_id": f"evt_bypass_{int(time.time())}",
                "event_type": "message",
                "timestamp": int(time.time()),
                "message": {
                    "id": f"MSG_BYPASS_{int(time.time())}",
                    "from": unlisted_phone,
                    "timestamp": int(time.time()),
                    "type": "text",
                    "text": {"body": "#civic hello I have an issue"},
                },
            }
            body = json.dumps(payload).encode("utf-8")
            headers = self._generate_hmac_headers(body)
            resp = self.client.post("/internal/whatsapp/events", content=body, headers=headers)
            self.assertEqual(resp.status_code, 200)
            mock_send.assert_called()
        finally:
            manager.set_enabled(orig_enabled)

    def test_whitelist_admin_crud_endpoints(self):
        """Admin endpoints allow listing, adding, removing, and toggling whitelist."""
        manager = whatsapp_service.whitelist_manager
        orig_enabled = manager.is_enabled
        try:
            # 1. Non-admin forbidden
            resp_cit = self.client.get("/api/v1/admin/whatsapp/whitelist", headers=self.cit_headers)
            self.assertEqual(resp_cit.status_code, 403)

            # 2. Admin list
            resp = self.client.get("/api/v1/admin/whatsapp/whitelist", headers=self.admin_headers)
            self.assertEqual(resp.status_code, 200)
            data = resp.json()
            self.assertIn("enabled", data)
            self.assertIn("allowed_numbers", data)

            # 3. Admin add number
            add_payload = {"phone": "919555444333", "label": "Community Lead"}
            resp_add = self.client.post("/api/v1/admin/whatsapp/whitelist", json=add_payload, headers=self.admin_headers)
            self.assertEqual(resp_add.status_code, 200)
            self.assertEqual(resp_add.json()["phone"], "919555444333")

            # 4. Admin remove number
            resp_del = self.client.delete("/api/v1/admin/whatsapp/whitelist/919555444333", headers=self.admin_headers)
            self.assertEqual(resp_del.status_code, 200)
            self.assertTrue(resp_del.json()["success"])

            # 5. Toggle whitelist
            resp_toggle = self.client.post("/api/v1/admin/whatsapp/whitelist/toggle", json={"enabled": True}, headers=self.admin_headers)
            self.assertEqual(resp_toggle.status_code, 200)
            self.assertTrue(resp_toggle.json()["enabled"])
        finally:
            manager.set_enabled(orig_enabled)


if __name__ == "__main__":
    unittest.main()
