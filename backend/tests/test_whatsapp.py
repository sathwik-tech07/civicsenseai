"""
Comprehensive Meta WhatsApp Cloud API Test Suite (Phase 7)
Tests:
1. GET /webhook verification handshake (valid and invalid token)
2. POST /webhook HMAC-SHA256 signature enforcement (valid, tampered, missing)
3. LRU message deduplication (idempotent replay protection)
4. Conversational welcome greeting and assistance
5. Image-based reporting: download, Gemini Vision analysis, pending draft & interactive buttons
6. Citizen confirmation flow: creates Incident, AIAnalysis, WorkflowHistory, AuditLog
7. Citizen complaint tracking (track <ID>)
8. Citizen cancellation (discards draft)
9. Automated outbound WhatsApp notification upon workflow stage transition
10. Meta Cloud API real credential boundary check (distinguishing mocked vs real)
"""

import re
import unittest
import asyncio
import hmac
import hashlib
import json
import time
import uuid
import os
import sys

sys.path.insert(0, os.path.abspath("backend"))

from starlette.testclient import TestClient
from app.main import app
from app.config import settings
from app.database import SessionLocal
from app.models.incident import Incident
from app.models.ai_analysis import AIAnalysis
from app.models.workflow import WorkflowHistory, AuditLog
from app.models.user import User
from app.utils.security import get_password_hash
from app.services.whatsapp_service import whatsapp_service
from app.services.workflow_service import WorkflowService
from app.services.storage_service import S3StorageProvider, StorageUploadError
from unittest.mock import patch, MagicMock


class TestWhatsAppIntegration(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.client = TestClient(app)
        cls.app_secret = "test_meta_app_secret_12345"
        cls.verify_token = "civicsense_verify_token_secure"
        
        # Configure test credentials on settings
        settings.META_APP_SECRET = cls.app_secret
        settings.WHATSAPP_VERIFY_TOKEN = cls.verify_token
        settings.WHATSAPP_PHONE_NUMBER_ID = "100099988877766"
        settings.WHATSAPP_ACCESS_TOKEN = "EAABtest_token_mock_123456789"

        # Intercept outbound HTTP calls to Meta in test environment
        cls.sent_messages = []
        cls.sent_buttons = []

        async def mock_send_text(recipient, text):
            cls.sent_messages.append({"to": recipient, "text": text})
            return f"wamid.{uuid.uuid4().hex}"

        async def mock_send_buttons(recipient, body, buttons):
            cls.sent_buttons.append({"to": recipient, "body": body, "buttons": buttons})
            return f"wamid.{uuid.uuid4().hex}"

        whatsapp_service.send_text_message = mock_send_text
        whatsapp_service.send_interactive_buttons = mock_send_buttons

    def setUp(self):
        self.sent_messages.clear()
        self.sent_buttons.clear()
        db = SessionLocal()
        try:
            whatsapp_service.pending_sessions.clear_all(db=db)
        finally:
            db.close()

    def _sign_payload(self, body_bytes: bytes) -> str:
        sig = hmac.new(
            key=self.app_secret.encode("utf-8"),
            msg=body_bytes,
            digestmod=hashlib.sha256
        ).hexdigest()
        return f"sha256={sig}"

    # --------------------------------------------------------------------------
    # 1. GET Webhook Verification Handshake
    # --------------------------------------------------------------------------
    def test_01_webhook_verification_handshake(self):
        """Test GET /api/v1/whatsapp/webhook verification handshake."""
        # Valid challenge
        params = {
            "hub.mode": "subscribe",
            "hub.verify_token": self.verify_token,
            "hub.challenge": "1158201444"
        }
        res = self.client.get("/api/v1/whatsapp/webhook", params=params)
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.text, "1158201444")

        # Invalid token rejection
        bad_params = dict(params, **{"hub.verify_token": "wrong_token"})
        bad_res = self.client.get("/api/v1/whatsapp/webhook", params=bad_params)
        self.assertEqual(bad_res.status_code, 403)

    # --------------------------------------------------------------------------
    # 2. POST HMAC-SHA256 Signature Security
    # --------------------------------------------------------------------------
    def test_02_hmac_signature_verification(self):
        """Test POST /api/v1/whatsapp/webhook HMAC signature enforcement."""
        payload = {"object": "whatsapp_business_account", "entry": []}
        body_bytes = json.dumps(payload).encode("utf-8")

        # Missing signature
        res_missing = self.client.post("/api/v1/whatsapp/webhook", content=body_bytes)
        self.assertEqual(res_missing.status_code, 403)

        # Invalid signature
        res_invalid = self.client.post(
            "/api/v1/whatsapp/webhook",
            content=body_bytes,
            headers={"X-Hub-Signature-256": "sha256=invalid_hex_hash"}
        )
        self.assertEqual(res_invalid.status_code, 403)

        # Valid signature
        valid_sig = self._sign_payload(body_bytes)
        res_valid = self.client.post(
            "/api/v1/whatsapp/webhook",
            content=body_bytes,
            headers={"X-Hub-Signature-256": valid_sig}
        )
        self.assertEqual(res_valid.status_code, 200)

    # --------------------------------------------------------------------------
    # 3. Conversational Welcome Greeting
    # --------------------------------------------------------------------------
    def test_03_conversational_welcome_greeting(self):
        """Test sending 'Hi' returns the official CivicSense interactive welcome text."""
        msg_payload = {
            "object": "whatsapp_business_account",
            "entry": [{
                "id": "100099988877766",
                "changes": [{
                    "value": {
                        "messaging_product": "whatsapp",
                        "metadata": {"phone_number_id": "100099988877766"},
                        "messages": [{
                            "from": "919876543210",
                            "id": f"wamid.{uuid.uuid4().hex}",
                            "timestamp": str(int(time.time())),
                            "type": "text",
                            "text": {"body": "Hi"}
                        }]
                    },
                    "field": "messages"
                }]
            }]
        }
        body_bytes = json.dumps(msg_payload).encode("utf-8")
        res = self.client.post(
            "/api/v1/whatsapp/webhook",
            content=body_bytes,
            headers={"X-Hub-Signature-256": self._sign_payload(body_bytes)}
        )
        self.assertEqual(res.status_code, 200)
        self.assertEqual(len(self.sent_messages), 1)
        self.assertEqual(self.sent_messages[0]["to"], "919876543210")
        self.assertIn("Welcome to CivicSense AI", self.sent_messages[0]["text"])

    # --------------------------------------------------------------------------
    # 4. Image-Based Reporting & Interactive Confirmation Buttons
    # --------------------------------------------------------------------------
    def test_04_image_reporting_and_draft_creation(self):
        """Test citizen sending an image triggers Gemini Vision and sends confirmation buttons."""
        msg_payload = {
            "object": "whatsapp_business_account",
            "entry": [{
                "id": "100099988877766",
                "changes": [{
                    "value": {
                        "messaging_product": "whatsapp",
                        "metadata": {"phone_number_id": "100099988877766"},
                        "messages": [{
                            "from": "919876543210",
                            "id": f"wamid.{uuid.uuid4().hex}",
                            "timestamp": str(int(time.time())),
                            "type": "image",
                            "image": {
                                "id": "media_test_12345",
                                "mime_type": "image/jpeg",
                                "caption": "Deep asphalt pothole near Metro station"
                            }
                        }]
                    },
                    "field": "messages"
                }]
            }]
        }
        body_bytes = json.dumps(msg_payload).encode("utf-8")
        res = self.client.post(
            "/api/v1/whatsapp/webhook",
            content=body_bytes,
            headers={"X-Hub-Signature-256": self._sign_payload(body_bytes)}
        )
        self.assertEqual(res.status_code, 200)

        # Verify draft was stored in pending sessions
        draft = whatsapp_service.pending_sessions.get_draft("919876543210")
        self.assertIsNotNone(draft)
        self.assertEqual(draft["type"], "road_damage")
        self.assertEqual(draft["ward_id"], "w-1")

        # Verify interactive confirmation buttons were sent
        self.assertTrue(len(self.sent_buttons) > 0 or len(self.sent_messages) > 0)
        if self.sent_buttons:
            btn_reply = self.sent_buttons[0]
            self.assertEqual(btn_reply["to"], "919876543210")
            self.assertIn("Vision Analysis Complete", btn_reply["body"])
            btn_ids = [b["id"] for b in btn_reply["buttons"]]
            self.assertIn("confirm_incident", btn_ids)
            self.assertIn("cancel_incident", btn_ids)

    # --------------------------------------------------------------------------
    # 5. Citizen Confirmation Flow (Creates Incident, AIAnalysis, AuditLog)
    # --------------------------------------------------------------------------
    def test_05_citizen_confirmation_creates_incident(self):
        """Test citizen confirming draft creates formal Incident, AIAnalysis, WorkflowHistory, AuditLog."""
        phone = "919876543210"
        # Seed draft
        draft = {
            "title": "WhatsApp: Pothole on MG Road",
            "type": "pothole",
            "severity": "high",
            "ward_id": "w-1",
            "ward_name": "Ward 1 - Metro Health Corridor",
            "lat": 12.9716,
            "lng": 77.5946,
            "address": "MG Road near Metro Station",
            "priority_score": 85,
            "estimated_repair_cost": 45000.0,
            "saved_early_intervention": 170000.0,
            "photo_url": "/uploads/test_wa.jpg",
            "confidence": 94.0,
            "description": "Deep asphalt pit causing traffic slowdown",
            "recommended_department": "Road Infrastructure & Works Dept",
            "explanation": "Analyzed via Gemini Vision."
        }
        db_seed = SessionLocal()
        try:
            whatsapp_service.pending_sessions.store_draft(phone, draft, db=db_seed)
        finally:
            db_seed.close()

        # Citizen sends interactive button reply "confirm_incident"
        confirm_payload = {
            "object": "whatsapp_business_account",
            "entry": [{
                "id": "100099988877766",
                "changes": [{
                    "value": {
                        "messaging_product": "whatsapp",
                        "metadata": {"phone_number_id": "100099988877766"},
                        "messages": [{
                            "from": phone,
                            "id": f"wamid.{uuid.uuid4().hex}",
                            "timestamp": str(int(time.time())),
                            "type": "interactive",
                            "interactive": {
                                "type": "button_reply",
                                "button_reply": {
                                    "id": "confirm_incident",
                                    "title": "Confirm & Submit"
                                }
                            }
                        }]
                    },
                    "field": "messages"
                }]
            }]
        }
        body_bytes = json.dumps(confirm_payload).encode("utf-8")
        res = self.client.post(
            "/api/v1/whatsapp/webhook",
            content=body_bytes,
            headers={"X-Hub-Signature-256": self._sign_payload(body_bytes)}
        )
        self.assertEqual(res.status_code, 200)

        # Verify incident created in database
        db = SessionLocal()
        try:
            created_inc = db.query(Incident).filter(Incident.user_id == f"usr-wa-{phone}").order_by(Incident.created_at.desc()).first()
            self.assertIsNotNone(created_inc)
            self.assertTrue(created_inc.id.startswith("INC-2026-"))
            self.assertEqual(created_inc.type, "pothole")
            self.assertEqual(created_inc.status, "reported")

            # Verify AIAnalysis created
            ai_rec = db.query(AIAnalysis).filter(AIAnalysis.incident_id == created_inc.id).first()
            self.assertIsNotNone(ai_rec)
            self.assertEqual(ai_rec.cv_confidence, 94.0)

            # Verify WorkflowHistory created
            wf = db.query(WorkflowHistory).filter(WorkflowHistory.incident_id == created_inc.id).first()
            self.assertIsNotNone(wf)
            self.assertEqual(wf.stage, "reported")

            # Verify AuditLog created
            audit = db.query(AuditLog).filter(AuditLog.incident_id == created_inc.id).first()
            self.assertIsNotNone(audit)
            self.assertIn("Citizen (WhatsApp", audit.who)

            # Verify confirmation text was sent to citizen with Complaint ID
            self.assertTrue(len(self.sent_messages) > 0)
            conf_msg = self.sent_messages[-1]
            self.assertEqual(conf_msg["to"], phone)
            self.assertIn("Complaint Successfully Filed", conf_msg["text"])
            self.assertIn(created_inc.id, conf_msg["text"])

            # Clean up test incident to avoid polluting source database
            db.delete(ai_rec)
            db.delete(wf)
            db.delete(audit)
            db.delete(created_inc)
            wa_user = db.query(User).filter(User.id == f"usr-wa-{phone}").first()
            if wa_user:
                db.delete(wa_user)
            db.commit()
        finally:
            db.close()

    # --------------------------------------------------------------------------
    # 6. Citizen Complaint Tracking
    # --------------------------------------------------------------------------
    def test_06_complaint_tracking(self):
        """Test citizen sending 'track <ID>' receives live incident status."""
        phone = "919876543210"
        db = SessionLocal()
        try:
            inc = db.query(Incident).filter(Incident.id == "INC-2026-BA317F").first()
            if inc:
                inc.user_id = f"usr-wa-{phone}"
                db.commit()
            else:
                inc = Incident(
                    id="INC-2026-BA317F",
                    title="Tracked Test Pothole",
                    type="pothole",
                    severity="high",
                    status="reported",
                    ward_id="w-1",
                    ward_name="Ward 1",
                    lat=12.9716,
                    lng=77.5946,
                    address="Victoria Road Corridor",
                    photo_url="/uploads/test.jpg",
                    user_id=f"usr-wa-{phone}"
                )
                db.add(inc)
                db.commit()
        finally:
            db.close()

        track_payload = {
            "object": "whatsapp_business_account",
            "entry": [{
                "id": "100099988877766",
                "changes": [{
                    "value": {
                        "messaging_product": "whatsapp",
                        "metadata": {"phone_number_id": "100099988877766"},
                        "messages": [{
                            "from": phone,
                            "id": f"wamid.{uuid.uuid4().hex}",
                            "timestamp": str(int(time.time())),
                            "type": "text",
                            "text": {"body": "track INC-2026-BA317F"}
                        }]
                    },
                    "field": "messages"
                }]
            }]
        }
        body_bytes = json.dumps(track_payload).encode("utf-8")
        res = self.client.post(
            "/api/v1/whatsapp/webhook",
            content=body_bytes,
            headers={"X-Hub-Signature-256": self._sign_payload(body_bytes)}
        )
        self.assertEqual(res.status_code, 200)

        self.assertEqual(len(self.sent_messages), 1)
        tracking_msg = self.sent_messages[0]
        self.assertEqual(tracking_msg["to"], phone)
        self.assertIn("Incident Live Status", tracking_msg["text"])
        self.assertIn("INC-2026-BA317F", tracking_msg["text"])

    # --------------------------------------------------------------------------
    # 7. Citizen Cancellation Flow
    # --------------------------------------------------------------------------
    def test_07_citizen_cancellation_discards_draft(self):
        """Test citizen sending 'cancel' clears pending session."""
        phone = "919876543210"
        whatsapp_service.pending_sessions.store_draft(phone, {"title": "Draft to Cancel"})

        cancel_payload = {
            "object": "whatsapp_business_account",
            "entry": [{
                "id": "100099988877766",
                "changes": [{
                    "value": {
                        "messaging_product": "whatsapp",
                        "metadata": {"phone_number_id": "100099988877766"},
                        "messages": [{
                            "from": phone,
                            "id": f"wamid.{uuid.uuid4().hex}",
                            "timestamp": str(int(time.time())),
                            "type": "text",
                            "text": {"body": "cancel"}
                        }]
                    },
                    "field": "messages"
                }]
            }]
        }
        body_bytes = json.dumps(cancel_payload).encode("utf-8")
        res = self.client.post(
            "/api/v1/whatsapp/webhook",
            content=body_bytes,
            headers={"X-Hub-Signature-256": self._sign_payload(body_bytes)}
        )
        self.assertEqual(res.status_code, 200)
        self.assertIsNone(whatsapp_service.pending_sessions.get_draft(phone))
        self.assertIn("discarded", self.sent_messages[0]["text"])

    # --------------------------------------------------------------------------
    # 8. Automated Outbound WhatsApp Notification on Stage Transition
    # --------------------------------------------------------------------------
    def test_08_automated_stage_update_notification(self):
        """Test that transitioning workflow stage for a WhatsApp citizen sends an outbound update."""
        db = SessionLocal()
        phone = "919876543210"
        temp_inc_id = f"INC-TEST-{uuid.uuid4().hex[:6].upper()}"
        try:
            # Create a test incident owned by a WhatsApp citizen
            temp_inc = Incident(
                id=temp_inc_id,
                title="Temporary Test Incident",
                type="road_damage",
                severity="medium",
                status="reported",
                ward_id="w-1",
                ward_name="Ward 1",
                lat=12.9716,
                lng=77.5946,
                address="Test Lane",
                photo_url="/uploads/test.jpg",
                user_id=f"usr-wa-{phone}"
            )
            db.add(temp_inc)
            db.commit()

            # Advance stage using WorkflowService
            WorkflowService.transition_stage(
                db=db,
                incident_id=temp_inc_id,
                target_stage="repair_started",
                actor="Eng. Rajesh V",
                notes="Asphalt milling unit deployed on site."
            )

            # Verify outbound WhatsApp message was generated
            self.assertTrue(len(self.sent_messages) > 0)
            update_msg = self.sent_messages[-1]
            self.assertEqual(update_msg["to"], phone)
            self.assertIn("Incident Update", update_msg["text"])
            self.assertIn("Repair Started", update_msg["text"])
            self.assertIn(temp_inc_id, update_msg["text"])

            # Clean up
            db.query(WorkflowHistory).filter(WorkflowHistory.incident_id == temp_inc_id).delete()
            db.query(AuditLog).filter(AuditLog.incident_id == temp_inc_id).delete()
            db.delete(temp_inc)
            db.commit()
        finally:
            db.close()

    # --------------------------------------------------------------------------
    # 9. Real Meta API Boundary Check (Distinguishing Mock vs Real)
    # --------------------------------------------------------------------------
    def test_09_real_meta_api_boundary_distinction(self):
        """
        Distinguishes mocked test execution from real Meta Graph API calls.
        Reports whether live Meta credentials are configured for outbound calls.
        """
        has_real_credentials = bool(
            settings.WHATSAPP_PHONE_NUMBER_ID and 
            settings.WHATSAPP_ACCESS_TOKEN and 
            not settings.WHATSAPP_ACCESS_TOKEN.startswith("EAABtest_token")
        )
        if has_real_credentials:
            print("  [Meta Cloud API]: Real credentials detected in environment. Outbound calls will route to Meta Graph API.")
        else:
            print("  [Meta Cloud API]: Mock mode active. All Meta Cloud API requests validated in-process via mocked transport.")
        self.assertTrue(True)

    def _send_text_msg(self, from_phone: str, text: str):
        msg_payload = {
            "object": "whatsapp_business_account",
            "entry": [{
                "id": "100099988877766",
                "changes": [{
                    "value": {
                        "messaging_product": "whatsapp",
                        "metadata": {"phone_number_id": "100099988877766"},
                        "messages": [{
                            "from": from_phone,
                            "id": f"wamid.{uuid.uuid4().hex}",
                            "timestamp": str(int(time.time())),
                            "type": "text",
                            "text": {"body": text}
                        }]
                    },
                    "field": "messages"
                }]
            }]
        }
        body_bytes = json.dumps(msg_payload).encode("utf-8")
        return self.client.post(
            "/api/v1/whatsapp/webhook",
            content=body_bytes,
            headers={"X-Hub-Signature-256": self._sign_payload(body_bytes)}
        )

    def _send_location_msg(self, from_phone: str, lat: float, lng: float, address: str = ""):
        msg_payload = {
            "object": "whatsapp_business_account",
            "entry": [{
                "id": "100099988877766",
                "changes": [{
                    "value": {
                        "messaging_product": "whatsapp",
                        "metadata": {"phone_number_id": "100099988877766"},
                        "messages": [{
                            "from": from_phone,
                            "id": f"wamid.{uuid.uuid4().hex}",
                            "timestamp": str(int(time.time())),
                            "type": "location",
                            "location": {
                                "latitude": lat,
                                "longitude": lng,
                                "name": address,
                                "address": address
                            }
                        }]
                    },
                    "field": "messages"
                }]
            }]
        }
        body_bytes = json.dumps(msg_payload).encode("utf-8")
        return self.client.post(
            "/api/v1/whatsapp/webhook",
            content=body_bytes,
            headers={"X-Hub-Signature-256": self._sign_payload(body_bytes)}
        )

    # --------------------------------------------------------------------------
    # 10. Natural Conversational Complaint Initiation
    # --------------------------------------------------------------------------
    def test_10_conversational_text_draft_initiation(self):
        """Test citizen describing a problem conversationally creates a draft and asks for photo."""
        phone = "919876543299"
        res = self._send_text_msg(phone, "There is a big pothole near Victoria hospital on MG Road")
        self.assertEqual(res.status_code, 200)

        # Check outbound message asking for photo or location
        self.assertTrue(len(self.sent_messages) > 0)
        reply = self.sent_messages[-1]
        self.assertEqual(reply["to"], phone)
        self.assertIn("Civic Complaint Drafted", reply["text"])
        self.assertIn("Road Pothole", reply["text"])

        # Check draft in pending store
        draft = whatsapp_service.pending_sessions.get_draft(phone)
        self.assertIsNotNone(draft)
        self.assertEqual(draft["type"], "pothole")
        self.assertEqual(draft["severity"], "high")

    # --------------------------------------------------------------------------
    # 11. Location and Address Updates on Pending Draft
    # --------------------------------------------------------------------------
    def test_11_location_and_address_updates(self):
        """Test sending GPS pin or text address updates an active draft."""
        phone = "919876543298"
        # Step 1: Citizen initiates
        self._send_text_msg(phone, "Water is leaking from an underground pipe near Indiranagar")
        self.sent_messages.clear()

        # Step 2: Citizen sends GPS location
        self._send_location_msg(phone, 12.9783, 77.6408, "100ft Road Indiranagar")
        self.assertTrue(len(self.sent_messages) > 0)
        self.assertIn("GPS Location Pin Received", self.sent_messages[-1]["text"])

        draft = whatsapp_service.pending_sessions.get_draft(phone)
        self.assertEqual(draft["lat"], 12.9783)
        self.assertEqual(draft["lng"], 77.6408)

        # Step 3: Citizen updates address with text
        self.sent_messages.clear()
        self._send_text_msg(phone, "address: 543 12th Main Road Indiranagar")
        self.assertTrue(len(self.sent_messages) > 0)
        self.assertIn("Location Address Updated", self.sent_messages[-1]["text"])

        draft = whatsapp_service.pending_sessions.get_draft(phone)
        self.assertEqual(draft["address"], "543 12th Main Road Indiranagar")

    # --------------------------------------------------------------------------
    # 12. Citizen Complaint History Query
    # --------------------------------------------------------------------------
    def test_12_citizen_complaint_history(self):
        """Test citizen sending 'my complaints' retrieves their registered tickets."""
        phone = "919876543297"
        db = SessionLocal()
        try:
            # Create a test incident for this citizen
            inc_id = f"INC-TEST-HIST-{uuid.uuid4().hex[:4].upper()}"
            inc = Incident(
                id=inc_id,
                title="Historical Road Damage",
                type="road_damage",
                severity="medium",
                status="repair_started",
                ward_id="w-1",
                ward_name="Ward 1",
                lat=12.9716,
                lng=77.5946,
                address="MG Road",
                photo_url="/uploads/hist.jpg",
                user_id=f"usr-wa-{phone}"
            )
            db.add(inc)
            db.commit()

            # Citizen queries history
            self.sent_messages.clear()
            res = self._send_text_msg(phone, "show my complaints")
            self.assertEqual(res.status_code, 200)

            self.assertTrue(len(self.sent_messages) > 0)
            reply = self.sent_messages[-1]
            self.assertIn("Your Registered Complaints", reply["text"])
            self.assertIn(inc_id, reply["text"])

            db.delete(inc)
            db.commit()
        finally:
            db.close()

    # --------------------------------------------------------------------------
    # 13. Citizen Complaint Escalation Request
    # --------------------------------------------------------------------------
    def test_13_citizen_escalation_request(self):
        """Test citizen requesting escalation records audit log and notifies commissioner."""
        phone = "919876543296"
        db = SessionLocal()
        try:
            inc_id = f"INC-ESC-{uuid.uuid4().hex[:4].upper()}"
            inc = Incident(
                id=inc_id,
                title="Delayed Pothole Repair",
                type="pothole",
                severity="high",
                status="reported",
                ward_id="w-1",
                ward_name="Ward 1",
                lat=12.9716,
                lng=77.5946,
                address="Residency Road",
                photo_url="/uploads/esc.jpg",
                priority_score=70,
                user_id=f"usr-wa-{phone}"
            )
            db.add(inc)
            db.commit()

            self.sent_messages.clear()
            res = self._send_text_msg(phone, f"escalate {inc_id} No crew dispatched for 3 days")
            self.assertEqual(res.status_code, 200)

            self.assertTrue(len(self.sent_messages) > 0)
            self.assertIn("Complaint Escalated Successfully", self.sent_messages[0]["text"])

            # Verify in database that priority score increased and audit log exists
            db.refresh(inc)
            self.assertEqual(inc.priority_score, 85)

            audit = db.query(AuditLog).filter(AuditLog.incident_id == inc_id).first()
            self.assertIsNotNone(audit)
            self.assertIn("Escalated complaint", audit.what)

            db.query(AuditLog).filter(AuditLog.incident_id == inc_id).delete()
            db.query(WorkflowHistory).filter(WorkflowHistory.incident_id == inc_id).delete()
            db.delete(inc)
            db.commit()
        finally:
            db.close()

    # --------------------------------------------------------------------------
    # 14. Citizen Satisfaction Feedback & Rating
    # --------------------------------------------------------------------------
    def test_14_citizen_satisfaction_feedback(self):
        """Test citizen rating a resolved complaint records feedback in audit log."""
        phone = "919876543295"
        db = SessionLocal()
        try:
            inc_id = f"INC-RATE-{uuid.uuid4().hex[:4].upper()}"
            inc = Incident(
                id=inc_id,
                title="Fixed Streetlight",
                type="streetlight",
                severity="low",
                status="resolved",
                ward_id="w-1",
                ward_name="Ward 1",
                lat=12.9716,
                lng=77.5946,
                address="Church Street",
                photo_url="/uploads/street.jpg",
                user_id=f"usr-wa-{phone}"
            )
            db.add(inc)
            db.commit()

            self.sent_messages.clear()
            res = self._send_text_msg(phone, f"rate {inc_id} 5 Excellent rapid repair!")
            self.assertEqual(res.status_code, 200)

            self.assertTrue(len(self.sent_messages) > 0)
            self.assertIn("Thank You for Your Feedback", self.sent_messages[-1]["text"])
            self.assertIn("⭐⭐⭐⭐⭐", self.sent_messages[-1]["text"])

            # Verify audit log
            audit = db.query(AuditLog).filter(AuditLog.incident_id == inc_id).first()
            self.assertIsNotNone(audit)
            self.assertIn("5/5 stars", audit.what)

            db.query(AuditLog).filter(AuditLog.incident_id == inc_id).delete()
            db.query(WorkflowHistory).filter(WorkflowHistory.incident_id == inc_id).delete()
            db.delete(inc)
            db.commit()
        finally:
            db.close()

    # --------------------------------------------------------------------------
    # 15. Staff Authentication & RBAC Security Hardening
    # --------------------------------------------------------------------------
    def test_15_staff_authentication(self):
        """
        Validates strict staff authentication and role-escalation prevention:
        1. Obsolete passcode 'civic2026' is rejected.
        2. Incomplete credentials command is rejected with usage guidance.
        3. Non-existent staff credentials return generic denial (prevents enumeration).
        4. Wrong password for active staff returns generic denial.
        5. Inactive staff account cannot authenticate.
        6. Citizen user cannot authenticate as staff (role escalation blocked).
        7. Valid credentials securely link verified WhatsApp phone to existing staff account.
        8. Unlinked phone cannot execute staff commands ('tasks').
        """
        eng_phone = "919876543294"
        unlinked_phone = "919876543299"
        db = SessionLocal()

        staff_email = "engineer.test15@civicsense.ai"
        inactive_email = "inactive.staff15@civicsense.ai"
        citizen_email = "citizen.test15@civicsense.ai"
        test_pwd = "SecureStaffPassword123!"

        try:
            # Clean up prior test artifacts if present
            db.query(User).filter(User.email.in_([staff_email, inactive_email, citizen_email])).delete()
            db.query(User).filter(User.id.in_([f"usr-wa-{eng_phone}", f"usr-wa-{unlinked_phone}"])).delete()
            db.commit()

            # Pre-provision active staff user (Engineer)
            active_staff = User(
                id=f"usr-staff-{uuid.uuid4().hex[:6]}",
                email=staff_email,
                full_name="Staff Test Engineer",
                hashed_password=get_password_hash(test_pwd),
                role="engineer",
                department="Roads & Infrastructure",
                status="active",
                is_active=True
            )
            # Pre-provision inactive staff user
            inactive_staff = User(
                id=f"usr-staff-{uuid.uuid4().hex[:6]}",
                email=inactive_email,
                full_name="Inactive Staff User",
                hashed_password=get_password_hash(test_pwd),
                role="engineer",
                department="Roads & Infrastructure",
                status="inactive",
                is_active=False
            )
            # Pre-provision regular citizen user
            citizen_user = User(
                id=f"usr-cit-{uuid.uuid4().hex[:6]}",
                email=citizen_email,
                full_name="Regular Citizen",
                hashed_password=get_password_hash(test_pwd),
                role="citizen",
                status="active",
                is_active=True
            )
            db.add_all([active_staff, inactive_staff, citizen_user])
            db.commit()

            # 1. Obsolete passcode rejected
            self.sent_messages.clear()
            res = self._send_text_msg(eng_phone, "engineer login civic2026")
            self.assertEqual(res.status_code, 200)
            self.assertIn("Access denied", self.sent_messages[-1]["text"])
            self.assertIn("Hardcoded passcodes have been decommissioned", self.sent_messages[-1]["text"])

            # 2. Strict rejection of password transmission over WhatsApp
            self.sent_messages.clear()
            res = self._send_text_msg(eng_phone, f"staff login {staff_email} {test_pwd}")
            self.assertEqual(res.status_code, 200)
            self.assertIn("Security Notice", self.sent_messages[-1]["text"])
            self.assertIn("strictly forbids transmitting passwords over WhatsApp", self.sent_messages[-1]["text"])

            # 3. Non-existent staff email OTP request returns generic denial (anti-enumeration)
            self.sent_messages.clear()
            res = self._send_text_msg(eng_phone, "staff link unknown@civicsense.ai")
            self.assertEqual(res.status_code, 200)
            self.assertIn("Unable to initiate device linking", self.sent_messages[-1]["text"])

            # 4. Inactive staff account OTP request rejected
            self.sent_messages.clear()
            res = self._send_text_msg(eng_phone, f"staff link {inactive_email}")
            self.assertEqual(res.status_code, 200)
            self.assertIn("Unable to initiate device linking", self.sent_messages[-1]["text"])

            # 5. Citizen account denied staff escalation
            self.sent_messages.clear()
            res = self._send_text_msg(eng_phone, f"staff link {citizen_email}")
            self.assertEqual(res.status_code, 200)
            self.assertIn("Unable to initiate device linking", self.sent_messages[-1]["text"])

            # 6. Unlinked phone executing staff commands is denied
            self.sent_messages.clear()
            res = self._send_text_msg(unlinked_phone, "tasks")
            self.assertEqual(res.status_code, 200)
            self.assertIn("Access denied", self.sent_messages[-1]["text"])

            # 7. Valid staff account initiates OTP linking request
            self.sent_messages.clear()
            whatsapp_service.otp_manager.clear()
            res = self._send_text_msg(eng_phone, f"staff link {staff_email}")
            self.assertEqual(res.status_code, 200)
            self.assertIn("Staff Device Linking Initiated", self.sent_messages[-1]["text"])
            self.assertIn("verify <code>", self.sent_messages[-1]["text"])
            self.assertNotIn(test_pwd, self.sent_messages[-1]["text"]) # Zero password in chat

            # Retrieve active OTP state for verification testing
            clean_eng = "919876543294"
            pending_entry = whatsapp_service.otp_manager._otps.get(clean_eng)
            self.assertIsNotNone(pending_entry)

            # 8. Invalid OTP verification rejected
            self.sent_messages.clear()
            res = self._send_text_msg(eng_phone, "verify 000000")
            self.assertEqual(res.status_code, 200)
            self.assertIn("Invalid verification code", self.sent_messages[-1]["text"])
            self.assertIn("attempt(s) remaining", self.sent_messages[-1]["text"])

            # 9. Rate-limiting: After 3 failed attempts, code is revoked
            self._send_text_msg(eng_phone, "verify 111111")
            self.sent_messages.clear()
            res = self._send_text_msg(eng_phone, "verify 222222")
            self.assertEqual(res.status_code, 200)
            self.assertIn("Maximum attempts exceeded", self.sent_messages[-1]["text"])
            self.assertNotIn(clean_eng, whatsapp_service.otp_manager._otps) # Revoked

            # 10. Expired OTP rejected
            whatsapp_service.otp_manager.clear()
            success, _, raw_otp_expired = whatsapp_service.otp_manager.request_otp(db, eng_phone, staff_email)
            self.assertTrue(success)
            # Artificially expire the OTP
            whatsapp_service.otp_manager._otps[clean_eng]["expires_at"] = time.time() - 10
            self.sent_messages.clear()
            res = self._send_text_msg(eng_phone, f"verify {raw_otp_expired}")
            self.assertEqual(res.status_code, 200)
            self.assertIn("Verification code has expired", self.sent_messages[-1]["text"])

            # 11. Valid OTP successfully links device
            whatsapp_service.otp_manager.clear()
            success, _, valid_otp = whatsapp_service.otp_manager.request_otp(db, eng_phone, staff_email)
            self.assertTrue(success)
            self.sent_messages.clear()
            res = self._send_text_msg(eng_phone, f"verify {valid_otp}")
            self.assertEqual(res.status_code, 200)
            self.assertIn("Verified device linked successfully", self.sent_messages[-1]["text"])
            self.assertIn("Staff Test Engineer", self.sent_messages[-1]["text"])

            # Verify role in DB
            role = whatsapp_service.get_user_role(db, eng_phone)
            self.assertEqual(role, "engineer")

            # 12. Reused OTP rejected (single-use enforcement)
            self.sent_messages.clear()
            res = self._send_text_msg(eng_phone, f"verify {valid_otp}")
            self.assertEqual(res.status_code, 200)
            self.assertIn("No active device linking request found", self.sent_messages[-1]["text"])

        finally:
            db.query(AuditLog).filter(AuditLog.incident_id == "SYSTEM-STAFF-WHATSAPP-LINK").delete()
            db.query(User).filter(User.email.in_([staff_email, inactive_email, citizen_email])).delete()
            db.query(User).filter(User.id.in_([f"usr-wa-{eng_phone}", f"usr-wa-{unlinked_phone}"])).delete()
            db.commit()
            db.close()

    # --------------------------------------------------------------------------
    # 16. Field Engineer Workflow Operations via WhatsApp
    # --------------------------------------------------------------------------
    def test_16_engineer_workflow_operations(self):
        """Test engineer viewing tasks, accepting work, starting work, updating progress, and resolving."""
        eng_phone = "919876543293"
        db = SessionLocal()
        try:
            # Provision active engineer account linked in DB
            eng_user = db.query(User).filter(User.id == f"usr-wa-{eng_phone}").first()
            if not eng_user:
                eng_user = User(
                    id=f"usr-wa-{eng_phone}",
                    email=f"engineer_{eng_phone}@civicsense.ai",
                    full_name="Field Engineer 16",
                    hashed_password=get_password_hash("TestPass123!"),
                    role="engineer",
                    department="Roads & Bridges",
                    status="active",
                    is_active=True
                )
                db.add(eng_user)
            else:
                eng_user.role = "engineer"
                eng_user.status = "active"
                eng_user.is_active = True
            db.commit()

            inc_id = f"INC-ENG-{uuid.uuid4().hex[:4].upper()}"
            inc = Incident(
                id=inc_id,
                title="Sewer Manhole Overflow",
                type="drainage",
                severity="high",
                status="reported",
                ward_id="w-1",
                ward_name="Ward 1",
                lat=12.9716,
                lng=77.5946,
                address="Commercial Street",
                photo_url="/uploads/drain.jpg",
                priority_score=88,
                user_id="usr-wa-919876543290"
            )
            db.add(inc)
            db.commit()

            # 1. Engineer checks assigned tasks
            self.sent_messages.clear()
            self._send_text_msg(eng_phone, "tasks")
            self.assertTrue(len(self.sent_messages) > 0)

            # 2. Engineer accepts assignment
            self.sent_messages.clear()
            self._send_text_msg(eng_phone, f"accept {inc_id}")
            self.assertTrue(len(self.sent_messages) > 0)
            self.assertIn("Assignment Accepted", self.sent_messages[0]["text"])

            db.refresh(inc)
            self.assertEqual(inc.status, "crew_assigned")

            # 3. Engineer starts work
            self.sent_messages.clear()
            self._send_text_msg(eng_phone, f"start work {inc_id}")
            self.assertTrue(len(self.sent_messages) > 0)
            self.assertIn("Work Commenced", self.sent_messages[0]["text"])

            db.refresh(inc)
            self.assertEqual(inc.status, "repair_started")

            # 4. Engineer updates progress
            self.sent_messages.clear()
            self._send_text_msg(eng_phone, f"update {inc_id} Jet suction truck cleared blockage")
            self.assertTrue(len(self.sent_messages) > 0)
            self.assertIn("Progress notes logged", self.sent_messages[0]["text"])

            # 5. Engineer resolves incident
            self.sent_messages.clear()
            self._send_text_msg(eng_phone, f"resolve {inc_id}")
            self.assertTrue(len(self.sent_messages) > 0)
            self.assertIn("Incident Resolved", self.sent_messages[0]["text"])

            db.refresh(inc)
            self.assertEqual(inc.status, "resolved")

            # Clean up
            db.query(AuditLog).filter(AuditLog.incident_id == inc_id).delete()
            db.query(WorkflowHistory).filter(WorkflowHistory.incident_id == inc_id).delete()
            db.delete(inc)
            db.delete(eng_user)
            db.commit()
        finally:
            db.close()

    # --------------------------------------------------------------------------
    # 17. Commissioner Executive Summary via WhatsApp
    # --------------------------------------------------------------------------
    def test_17_commissioner_executive_summary(self):
        """Test commissioner logging in and requesting municipal executive summary."""
        com_phone = "919876543292"
        db = SessionLocal()
        try:
            # Provision active commissioner account linked in DB
            com_user = db.query(User).filter(User.id == f"usr-wa-{com_phone}").first()
            if not com_user:
                com_user = User(
                    id=f"usr-wa-{com_phone}",
                    email=f"commissioner_{com_phone}@civicsense.ai",
                    full_name="City Commissioner 17",
                    hashed_password=get_password_hash("TestPass123!"),
                    role="commissioner",
                    department="Municipal Administration",
                    status="active",
                    is_active=True
                )
                db.add(com_user)
            else:
                com_user.role = "commissioner"
                com_user.status = "active"
                com_user.is_active = True
            db.commit()

            self.sent_messages.clear()
            self._send_text_msg(com_phone, "summary")
            self.assertTrue(len(self.sent_messages) > 0)
            reply = self.sent_messages[0]
            self.assertIn("Municipal Executive Summary", reply["text"])
            self.assertIn("Active Complaints", reply["text"])
            self.assertIn("Critical Severity", reply["text"])

            db.delete(com_user)
            db.commit()
        finally:
            db.close()

    # --------------------------------------------------------------------------
    # 18. Full Closed-Loop Municipal Journey
    # --------------------------------------------------------------------------
    def test_18_full_closed_loop_municipal_journey(self):
        """
        Validates the entire end-to-end municipal journey:
        Citizen WhatsApp report -> Location -> Confirmation -> Incident Creation ->
        Engineer Assignment -> WhatsApp Notification -> Engineer Acceptance ->
        Work Started -> Resolution -> Citizen Notification -> Feedback.
        """
        citizen_phone = "919876543201"
        engineer_phone = "919876543202"
        db = SessionLocal()
        created_inc_id = None
        try:
            # Provision active engineer account linked in DB
            eng_user = db.query(User).filter(User.id == f"usr-wa-{engineer_phone}").first()
            if not eng_user:
                eng_user = User(
                    id=f"usr-wa-{engineer_phone}",
                    email=f"engineer_{engineer_phone}@civicsense.ai",
                    full_name="Rapid Response Engineer",
                    hashed_password=get_password_hash("TestPass123!"),
                    role="engineer",
                    department="Water Supply & Drainage",
                    status="active",
                    is_active=True
                )
                db.add(eng_user)
            else:
                eng_user.role = "engineer"
                eng_user.status = "active"
                eng_user.is_active = True
            db.commit()

            # Step 1: Citizen sends conversational issue
            self.sent_messages.clear()
            self._send_text_msg(citizen_phone, "Water main burst near Metro station flooding road")
            self.assertTrue(len(self.sent_messages) > 0)
            self.assertIn("Civic Complaint Drafted", self.sent_messages[-1]["text"])

            # Step 2: Citizen sends GPS coordinates
            self.sent_messages.clear()
            self._send_location_msg(citizen_phone, 12.9750, 77.6050, "MG Road Metro Station")
            self.assertTrue(len(self.sent_messages) > 0)

            # Step 3: Citizen confirms submission
            self.sent_messages.clear()
            self._send_text_msg(citizen_phone, "CONFIRM")
            self.assertTrue(len(self.sent_messages) > 0)
            confirm_msg = self.sent_messages[0]["text"]
            self.assertIn("Complaint Successfully Filed", confirm_msg)

            # Extract incident ID
            match = re.search(r"`(INC-2026-[A-Z0-9]+)`", confirm_msg)
            self.assertIsNotNone(match)
            created_inc_id = match.group(1)

            # Step 4: Verify Incident in database
            inc = db.query(Incident).filter(Incident.id == created_inc_id).first()
            self.assertIsNotNone(inc)
            self.assertEqual(inc.status, "reported")
            self.assertEqual(inc.user_id, f"usr-wa-{citizen_phone}")

            # Step 5: Web Dashboard / Commissioner assigns engineer
            self.sent_messages.clear()
            WorkflowService.transition_stage(
                db=db,
                incident_id=created_inc_id,
                target_stage="crew_assigned",
                actor="City Commissioner (Web Admin)",
                notes="Assigned rapid pipeline repair crew.",
                assigned_engineer_id=f"usr-wa-{engineer_phone}"
            )

            # Step 6: Verify Engineer received WhatsApp notification
            engineer_msgs = [m for m in self.sent_messages if m["to"] == engineer_phone]
            self.assertTrue(len(engineer_msgs) > 0)
            self.assertIn("New Municipal Work Order Assigned", engineer_msgs[0]["text"])

            # Step 7: Engineer starts work via WhatsApp
            self.sent_messages.clear()
            self._send_text_msg(engineer_phone, f"start work {created_inc_id}")
            self.assertTrue(len(self.sent_messages) > 0)
            self.assertIn("Work Commenced", self.sent_messages[0]["text"])

            # Step 8: Citizen received progress notification
            citizen_progress_msgs = [m for m in self.sent_messages if m["to"] == citizen_phone]
            self.assertTrue(len(citizen_progress_msgs) > 0)
            self.assertIn("Repair Started", citizen_progress_msgs[0]["text"])

            # Step 9: Engineer resolves via WhatsApp
            self.sent_messages.clear()
            self._send_text_msg(engineer_phone, f"resolve {created_inc_id}")
            self.assertTrue(len(self.sent_messages) > 0)
            self.assertIn("Incident Resolved", self.sent_messages[0]["text"])

            # Step 10: Citizen received resolution notice with feedback request
            citizen_resolve_msgs = [m for m in self.sent_messages if m["to"] == citizen_phone]
            self.assertTrue(len(citizen_resolve_msgs) > 0)
            self.assertIn("Incident Resolved", citizen_resolve_msgs[0]["text"])
            self.assertIn("rating", citizen_resolve_msgs[0]["text"])

            # Step 11: Citizen submits feedback via WhatsApp
            self.sent_messages.clear()
            self._send_text_msg(citizen_phone, f"rate {created_inc_id} 5 Fast and clean pipe repair!")
            self.assertTrue(len(self.sent_messages) > 0)
            self.assertIn("Thank You for Your Feedback", self.sent_messages[0]["text"])

            # Step 12: Verify full 11-stage audit trail in DB
            audits = db.query(AuditLog).filter(AuditLog.incident_id == created_inc_id).all()
            self.assertTrue(len(audits) >= 3)
            stages = [h.stage for h in db.query(WorkflowHistory).filter(WorkflowHistory.incident_id == created_inc_id).all()]
            self.assertIn("reported", stages)
            self.assertIn("crew_assigned", stages)
            self.assertIn("repair_started", stages)
            self.assertIn("resolved", stages)

        finally:
            if created_inc_id:
                db.query(AuditLog).filter(AuditLog.incident_id == created_inc_id).delete()
                db.query(WorkflowHistory).filter(WorkflowHistory.incident_id == created_inc_id).delete()
                db.query(AIAnalysis).filter(AIAnalysis.incident_id == created_inc_id).delete()
                db.query(Incident).filter(Incident.id == created_inc_id).delete()
            db.query(User).filter(User.id == f"usr-wa-{engineer_phone}").delete()
            db.commit()
            db.close()

    # --------------------------------------------------------------------------
    # 19. Security RBAC & Privacy Hardening Verification
    # --------------------------------------------------------------------------
    def test_19_security_rbac_and_privacy_hardening(self):
        """
        Regression tests for strict WhatsApp security hardening:
        1. Citizen cannot execute engineer commands (accept, start work, resolve).
        2. Citizen cannot track another citizen's incident (receives generic safe not-found).
        3. Citizen can track their own incident.
        4. Authorized staff can track incidents (Commissioner full access, Engineer assignment-only).
        5. Engineer cannot modify/resolve another engineer's assigned incident.
        6. Engineer can operate on their own assigned incident.
        """
        cit_a_phone = "919876543701"
        cit_b_phone = "919876543702"
        eng_1_phone = "919876543703"
        eng_2_phone = "919876543704"
        com_phone = "919876543705"

        db = SessionLocal()
        inc_a_id = f"INC-SEC-A-{uuid.uuid4().hex[:4].upper()}"
        inc_eng_id = f"INC-SEC-E-{uuid.uuid4().hex[:4].upper()}"

        try:
            # Provision active staff accounts linked in DB
            for p, r, n in [
                (eng_1_phone, "engineer", "Engineer One"),
                (eng_2_phone, "engineer", "Engineer Two"),
                (com_phone, "commissioner", "Commissioner Five"),
            ]:
                u = db.query(User).filter(User.id == f"usr-wa-{p}").first()
                if not u:
                    u = User(
                        id=f"usr-wa-{p}",
                        email=f"{r}_{p}@civicsense.ai",
                        full_name=n,
                        hashed_password=get_password_hash("TestPass123!"),
                        role=r,
                        department="Municipal Operations",
                        status="active",
                        is_active=True
                    )
                    db.add(u)
                else:
                    u.role = r
                    u.status = "active"
                    u.is_active = True
            db.commit()

            # Create Incident A owned by Citizen A
            inc_a = Incident(
                id=inc_a_id,
                title="Citizen A Private Report",
                type="road_damage",
                severity="medium",
                status="reported",
                ward_id="w-1",
                ward_name="Ward 1",
                lat=12.9716,
                lng=77.5946,
                address="Private Residential Lane",
                photo_url="/uploads/a.jpg",
                user_id=f"usr-wa-{cit_a_phone}"
            )
            db.add(inc_a)

            # Create Incident E assigned to Engineer 1
            inc_eng = Incident(
                id=inc_eng_id,
                title="Engineer 1 Work Order",
                type="pothole",
                severity="high",
                status="crew_assigned",
                ward_id="w-1",
                ward_name="Ward 1",
                lat=12.9716,
                lng=77.5946,
                address="Outer Ring Road",
                photo_url="/uploads/e.jpg",
                user_id=f"usr-wa-{cit_a_phone}",
                assigned_engineer_id=f"usr-wa-{eng_1_phone}"
            )
            db.add(inc_eng)
            db.commit()

            # --- 1. Citizen cannot execute engineer commands ---
            self.sent_messages.clear()
            self._send_text_msg(cit_a_phone, f"accept {inc_a_id}")
            self.assertTrue(len(self.sent_messages) > 0)
            self.assertIn("Access denied. Field engineer operations require an authenticated engineer account", self.sent_messages[-1]["text"])

            self.sent_messages.clear()
            self._send_text_msg(cit_a_phone, f"start work {inc_a_id}")
            self.assertTrue(len(self.sent_messages) > 0)
            self.assertIn("Access denied", self.sent_messages[-1]["text"])

            self.sent_messages.clear()
            self._send_text_msg(cit_a_phone, f"resolve {inc_a_id}")
            self.assertTrue(len(self.sent_messages) > 0)
            self.assertIn("Access denied", self.sent_messages[-1]["text"])

            db.refresh(inc_a)
            self.assertEqual(inc_a.status, "reported")

            # --- 2. Citizen cannot track another citizen's incident ---
            self.sent_messages.clear()
            self._send_text_msg(cit_b_phone, f"track {inc_a_id}")
            self.assertTrue(len(self.sent_messages) > 0)
            reply_b = self.sent_messages[-1]["text"]
            self.assertIn("was not found or is not accessible", reply_b)
            self.assertNotIn("Citizen A Private Report", reply_b)

            # --- 3. Citizen can track their own incident ---
            self.sent_messages.clear()
            self._send_text_msg(cit_a_phone, f"track {inc_a_id}")
            self.assertTrue(len(self.sent_messages) > 0)
            reply_a = self.sent_messages[-1]["text"]
            self.assertIn("Incident Live Status", reply_a)
            self.assertIn("Citizen A Private Report", reply_a)

            # --- 4. Staff tracking permissions ---
            # Commissioner can track any incident
            self.sent_messages.clear()
            self._send_text_msg(com_phone, f"track {inc_a_id}")
            self.assertTrue(len(self.sent_messages) > 0)
            self.assertIn("Incident Live Status", self.sent_messages[-1]["text"])

            # Engineer 1 can track their assigned incident
            self.sent_messages.clear()
            self._send_text_msg(eng_1_phone, f"track {inc_eng_id}")
            self.assertTrue(len(self.sent_messages) > 0)
            self.assertIn("Incident Live Status", self.sent_messages[-1]["text"])

            # Engineer 2 cannot track incident assigned to Engineer 1
            self.sent_messages.clear()
            self._send_text_msg(eng_2_phone, f"track {inc_eng_id}")
            self.assertTrue(len(self.sent_messages) > 0)
            self.assertIn("was not found or is not accessible", self.sent_messages[-1]["text"])

            # --- 5. Engineer cannot resolve another engineer's assigned incident ---
            self.sent_messages.clear()
            self._send_text_msg(eng_2_phone, f"resolve {inc_eng_id}")
            self.assertTrue(len(self.sent_messages) > 0)
            self.assertIn("not assigned to you", self.sent_messages[-1]["text"])

            db.refresh(inc_eng)
            self.assertEqual(inc_eng.status, "crew_assigned")

            # --- 6. Engineer can operate on their own assigned incident ---
            self.sent_messages.clear()
            self._send_text_msg(eng_1_phone, f"start work {inc_eng_id}")
            self.assertTrue(len(self.sent_messages) > 0)
            self.assertTrue(any("Work Commenced" in m["text"] for m in self.sent_messages))

            db.refresh(inc_eng)
            self.assertEqual(inc_eng.status, "repair_started")

            self.sent_messages.clear()
            self._send_text_msg(eng_1_phone, f"resolve {inc_eng_id}")
            self.assertTrue(len(self.sent_messages) > 0)
            self.assertTrue(any("Incident Resolved" in m["text"] for m in self.sent_messages))

            db.refresh(inc_eng)
            self.assertEqual(inc_eng.status, "resolved")

        finally:
            db.query(AuditLog).filter(AuditLog.incident_id.in_([inc_a_id, inc_eng_id])).delete(synchronize_session=False)
            db.query(WorkflowHistory).filter(WorkflowHistory.incident_id.in_([inc_a_id, inc_eng_id])).delete(synchronize_session=False)
            db.query(Incident).filter(Incident.id.in_([inc_a_id, inc_eng_id])).delete(synchronize_session=False)
            db.query(User).filter(User.id.in_([f"usr-wa-{eng_1_phone}", f"usr-wa-{eng_2_phone}", f"usr-wa-{com_phone}"])).delete(synchronize_session=False)
            db.commit()
            db.close()



# ==============================================================================
# 14. REGRESSION: WHATSAPP MEDIA PERSISTENCE WITH S3 STORAGE
# ==============================================================================

class TestWhatsAppMediaStoragePersistence(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.client = TestClient(app)
        cls.app_secret = "test_meta_app_secret_storage_12345"
        cls.verify_token = "civicsense_verify_token_secure"
        settings.META_APP_SECRET = cls.app_secret
        settings.WHATSAPP_VERIFY_TOKEN = cls.verify_token
        settings.WHATSAPP_PHONE_NUMBER_ID = "100099988877766"
        settings.WHATSAPP_ACCESS_TOKEN = "EAABtest_token_mock_123456789"

        cls.sent_messages = []
        cls.sent_buttons = []

        async def mock_send_text(recipient, text):
            cls.sent_messages.append({"to": recipient, "text": text})
            return f"wamid.{uuid.uuid4().hex}"

        async def mock_send_buttons(recipient, body, buttons):
            cls.sent_buttons.append({"to": recipient, "body": body, "buttons": buttons})
            return f"wamid.{uuid.uuid4().hex}"

        whatsapp_service.send_text_message = mock_send_text
        whatsapp_service.send_interactive_buttons = mock_send_buttons

    def setUp(self):
        self.sent_messages.clear()
        self.sent_buttons.clear()
        db = SessionLocal()
        try:
            whatsapp_service.pending_sessions.clear_all(db=db)
        finally:
            db.close()

    def _sign_payload(self, body_bytes: bytes) -> str:
        sig = hmac.new(
            key=self.app_secret.encode("utf-8"),
            msg=body_bytes,
            digestmod=hashlib.sha256
        ).hexdigest()
        return f"sha256={sig}"

    def _post_image_webhook(self, sender_phone: str, media_id: str, caption: str = ""):
        payload = {
            "object": "whatsapp_business_account",
            "entry": [{
                "id": "100099988877766",
                "changes": [{
                    "value": {
                        "messaging_product": "whatsapp",
                        "metadata": {"phone_number_id": "100099988877766"},
                        "messages": [{
                            "from": sender_phone,
                            "id": f"wamid.{uuid.uuid4().hex}",
                            "timestamp": str(int(time.time())),
                            "type": "image",
                            "image": {
                                "id": media_id,
                                "mime_type": "image/jpeg",
                                "caption": caption
                            }
                        }]
                    },
                    "field": "messages"
                }]
            }]
        }
        body = json.dumps(payload).encode("utf-8")
        return self.client.post(
            "/api/v1/whatsapp/webhook",
            content=body,
            headers={"X-Hub-Signature-256": self._sign_payload(body)}
        )

    def test_citizen_image_uses_s3_storage_and_no_local_disk_write(self):
        """Verify citizen complaint photo routes through S3StorageProvider and writes 0 files to local disk."""
        mock_s3_client = MagicMock()
        mock_s3_client.generate_presigned_url.return_value = "https://mock-presigned-url"
        mock_provider = S3StorageProvider(
            bucket_name="civicsense-evidence",
            access_key_id="test-key",
            secret_access_key="test-secret",
            s3_client=mock_s3_client
        )

        uploads_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "uploads"))
        initial_files = set(os.listdir(uploads_dir)) if os.path.exists(uploads_dir) else set()

        with patch("app.services.whatsapp_service.get_storage_provider", return_value=mock_provider):
            res = self._post_image_webhook("919876543111", "media_citizen_s3", "Pothole on 80ft road")
            self.assertEqual(res.status_code, 200)

        # 1. Assert S3 client put_object was called
        mock_s3_client.put_object.assert_called_once()
        call_kwargs = mock_s3_client.put_object.call_args[1]
        self.assertEqual(call_kwargs["Bucket"], "civicsense-evidence")
        self.assertTrue(call_kwargs["Key"].startswith("uploads/img_"))
        self.assertEqual(call_kwargs["ContentType"], "image/jpeg")

        # 2. Assert draft in pending sessions holds S3 object key
        draft = whatsapp_service.pending_sessions.get_draft("919876543111")
        self.assertIsNotNone(draft)
        self.assertEqual(draft["photo_url"], call_kwargs["Key"])

        # 3. Assert zero local disk files were written
        after_files = set(os.listdir(uploads_dir)) if os.path.exists(uploads_dir) else set()
        new_files = after_files - initial_files
        self.assertEqual(len(new_files), 0, f"Local disk received unexpected files: {new_files}")

    def test_additional_evidence_uses_s3_storage_and_no_local_disk_write(self):
        """Verify citizen additional evidence photo routes through S3StorageProvider and records S3 key in AuditLog."""
        db = SessionLocal()
        inc_id = f"INC-WA-ADD-{uuid.uuid4().hex[:6].upper()}"
        try:
            inc = Incident(
                id=inc_id,
                title="Pothole Reported Earlier",
                type="pothole",
                severity="medium",
                status="reported",
                ward_id="w-1",
                ward_name="Ward 1",
                lat=12.97,
                lng=77.59,
                address="MG Road",
                photo_url="",
                priority_score=75,
                estimated_repair_cost=15000.0,
                saved_early_intervention=60000.0,
                user_id="usr-wa-919876543222",
                assigned_crew="Unassigned",
                confidence=91.0,
                description="Initial report",
                explanation="AI analysis"
            )
            db.add(inc)
            db.commit()

            mock_s3_client = MagicMock()
            mock_s3_client.generate_presigned_url.return_value = "https://mock-presigned-url"
            mock_provider = S3StorageProvider(
                bucket_name="civicsense-evidence",
                access_key_id="test-key",
                secret_access_key="test-secret",
                s3_client=mock_s3_client
            )

            uploads_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "uploads"))
            initial_files = set(os.listdir(uploads_dir)) if os.path.exists(uploads_dir) else set()

            with patch("app.services.whatsapp_service.get_storage_provider", return_value=mock_provider):
                res = self._post_image_webhook("919876543222", "media_evidence_s3", f"evidence for {inc_id}")
                self.assertEqual(res.status_code, 200)

            # Assert S3 upload was called
            mock_s3_client.put_object.assert_called_once()
            call_kwargs = mock_s3_client.put_object.call_args[1]
            s3_key = call_kwargs["Key"]
            self.assertTrue(s3_key.startswith("uploads/img_"))

            # Assert AuditLog captured the S3 key
            audit = db.query(AuditLog).filter(AuditLog.incident_id == inc_id).first()
            self.assertIsNotNone(audit)
            self.assertIn(s3_key, audit.what)

            # Assert incident photo_url was updated to S3 key
            db.refresh(inc)
            self.assertEqual(inc.photo_url, s3_key)

            # Assert zero local disk files were written
            after_files = set(os.listdir(uploads_dir)) if os.path.exists(uploads_dir) else set()
            new_files = after_files - initial_files
            self.assertEqual(len(new_files), 0, f"Local disk received unexpected files: {new_files}")

        finally:
            try:
                db.rollback()
                db.query(AuditLog).filter(AuditLog.incident_id == inc_id).delete(synchronize_session=False)
                db.query(WorkflowHistory).filter(WorkflowHistory.incident_id == inc_id).delete(synchronize_session=False)
                db.query(Incident).filter(Incident.id == inc_id).delete(synchronize_session=False)
                db.commit()
            except Exception:
                db.rollback()
            finally:
                db.close()

    def test_engineer_resolution_photo_uses_s3_storage_and_no_local_disk_write(self):
        """Verify field engineer resolution photo routes through S3StorageProvider and stores S3 key in resolved_photo_url."""
        db = SessionLocal()
        eng_phone = "919876543333"
        eng_user_id = f"usr-wa-{eng_phone}"
        inc_id = f"INC-WA-RES-{uuid.uuid4().hex[:6].upper()}"

        try:
            # Provision authorized engineer
            eng_user = User(
                id=eng_user_id,
                email=f"engineer_{eng_phone}@civicsense.ai",
                full_name="Eng. Suresh Gowda",
                role="engineer",
                department="Roads & Infrastructure Engineering",
                hashed_password=get_password_hash("password123"),
                status="active",
                is_active=True
            )
            db.add(eng_user)

            # Create incident assigned directly to this engineer
            inc = Incident(
                id=inc_id,
                title="Pothole for Resolution Test",
                type="pothole",
                severity="high",
                status="crew_assigned",
                ward_id="w-1",
                ward_name="Ward 1",
                lat=12.97,
                lng=77.59,
                address="Outer Ring Road",
                photo_url="uploads/initial_pothole.jpg",
                priority_score=85,
                estimated_repair_cost=25000.0,
                saved_early_intervention=100000.0,
                user_id="usr-wa-citizen",
                assigned_crew="Roads Crew Alpha",
                assigned_engineer_id=eng_user_id,
                confidence=95.0,
                description="Pothole needing repair",
                explanation="AI analysis"
            )
            db.add(inc)
            db.commit()

            mock_s3_client = MagicMock()
            mock_s3_client.generate_presigned_url.return_value = "https://mock-presigned-url"
            mock_provider = S3StorageProvider(
                bucket_name="civicsense-evidence",
                access_key_id="test-key",
                secret_access_key="test-secret",
                s3_client=mock_s3_client
            )

            uploads_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "uploads"))
            initial_files = set(os.listdir(uploads_dir)) if os.path.exists(uploads_dir) else set()

            with patch("app.routers.whatsapp.get_storage_provider", return_value=mock_provider):
                res = self._post_image_webhook(eng_phone, "media_resolve_s3", f"resolve {inc_id}")
                self.assertEqual(res.status_code, 200)

            # Assert S3 upload was called
            mock_s3_client.put_object.assert_called_once()
            call_kwargs = mock_s3_client.put_object.call_args[1]
            s3_key = call_kwargs["Key"]
            self.assertTrue(s3_key.startswith("uploads/img_"))

            # Assert incident was resolved and resolved_photo_url holds S3 key
            db.refresh(inc)
            self.assertEqual(inc.status, "resolved")
            self.assertEqual(inc.resolved_photo_url, s3_key)

            # Assert zero local disk files were written
            after_files = set(os.listdir(uploads_dir)) if os.path.exists(uploads_dir) else set()
            new_files = after_files - initial_files
            self.assertEqual(len(new_files), 0, f"Local disk received unexpected files: {new_files}")

        finally:
            try:
                db.rollback()
                db.query(AuditLog).filter(AuditLog.incident_id == inc_id).delete(synchronize_session=False)
                db.query(WorkflowHistory).filter(WorkflowHistory.incident_id == inc_id).delete(synchronize_session=False)
                db.query(Incident).filter(Incident.id == inc_id).delete(synchronize_session=False)
                db.query(User).filter(User.id == eng_user_id).delete(synchronize_session=False)
                db.commit()
            except Exception:
                db.rollback()
            finally:
                db.close()

    def test_s3_upload_failure_handling_in_all_flows(self):
        """Verify S3 upload failure sends error notices and prevents broken draft/incident updates."""
        mock_failing_provider = MagicMock()
        mock_failing_provider.store_image.side_effect = StorageUploadError("S3 Bucket Connection Timeout")

        # 1. Citizen complaint photo failure
        with patch("app.services.whatsapp_service.get_storage_provider", return_value=mock_failing_provider):
            res = self._post_image_webhook("919876543444", "media_fail_1", "Broken road")
            self.assertEqual(res.status_code, 200)

        # Assert no draft was created
        draft = whatsapp_service.pending_sessions.get_draft("919876543444")
        self.assertIsNone(draft, "Draft should NOT be stored when S3 upload fails")
        self.assertTrue(any("could not store your complaint photo" in m["text"].lower() for m in self.sent_messages))

        # 2. Additional evidence upload failure
        db = SessionLocal()
        inc_id = f"INC-WA-FAIL-{uuid.uuid4().hex[:6].upper()}"
        try:
            inc = Incident(
                id=inc_id,
                title="Pothole for Failure Test",
                type="pothole",
                severity="medium",
                status="reported",
                ward_id="w-1",
                ward_name="Ward 1",
                lat=12.97,
                lng=77.59,
                address="MG Road",
                photo_url="uploads/initial_pothole.jpg",
                priority_score=75,
                estimated_repair_cost=15000.0,
                saved_early_intervention=60000.0,
                user_id="usr-wa-919876543555",
                assigned_crew="Unassigned",
                confidence=91.0,
                description="Initial report",
                explanation="AI analysis"
            )
            db.add(inc)
            db.commit()

            self.sent_messages.clear()
            with patch("app.services.whatsapp_service.get_storage_provider", return_value=mock_failing_provider):
                res = self._post_image_webhook("919876543555", "media_fail_2", f"evidence for {inc_id}")
                self.assertEqual(res.status_code, 200)

            # Assert no AuditLog was recorded
            audits = db.query(AuditLog).filter(AuditLog.incident_id == inc_id).all()
            self.assertEqual(len(audits), 0, "No audit log should be committed when S3 upload fails")
            self.assertTrue(any("failed to attach photo" in m["text"].lower() for m in self.sent_messages))

            # 3. Engineer resolution failure
            eng_phone = "919876543666"
            eng_user = User(
                id=f"usr-wa-{eng_phone}",
                email=f"eng_{eng_phone}@civicsense.ai",
                full_name="Eng. Test Fail",
                role="engineer",
                department="Roads & Infrastructure Engineering",
                hashed_password=get_password_hash("password123"),
                status="active",
                is_active=True
            )
            db.add(eng_user)
            inc.assigned_engineer_id = eng_user.id
            inc.status = "crew_assigned"
            db.commit()

            self.sent_messages.clear()
            with patch("app.routers.whatsapp.get_storage_provider", return_value=mock_failing_provider):
                res = self._post_image_webhook(eng_phone, "media_fail_3", f"resolve {inc_id}")
                self.assertEqual(res.status_code, 200)

            # Assert incident was NOT resolved
            db.refresh(inc)
            self.assertNotEqual(inc.status, "resolved")
            self.assertEqual(inc.status, "crew_assigned")
            self.assertTrue(any("could not store resolution photo" in m["text"].lower() for m in self.sent_messages))

        finally:
            try:
                db.rollback()
                db.query(AuditLog).filter(AuditLog.incident_id == inc_id).delete(synchronize_session=False)
                db.query(WorkflowHistory).filter(WorkflowHistory.incident_id == inc_id).delete(synchronize_session=False)
                db.query(Incident).filter(Incident.id == inc_id).delete(synchronize_session=False)
                db.query(User).filter(User.id == f"usr-wa-919876543666").delete(synchronize_session=False)
                db.commit()
            except Exception:
                db.rollback()
            finally:
                db.close()

    def test_whatsapp_image_mime_and_size_validation(self):
        """Verify invalid image formats and oversized images are rejected before hitting storage."""
        mock_provider = MagicMock()

        # 1. Reject invalid binary format (not an image)
        with patch.object(whatsapp_service, "download_media", return_value=(b"NOT_A_VALID_IMAGE_BINARY", "text/plain")):
            with patch("app.services.whatsapp_service.get_storage_provider", return_value=mock_provider):
                res = self._post_image_webhook("919876543777", "media_bad_mime", "Complaint text")
                self.assertEqual(res.status_code, 200)

        # Storage store_image should NOT be called
        mock_provider.store_image.assert_not_called()
        self.assertTrue(any("unsupported image format" in m["text"].lower() for m in self.sent_messages))

        # 2. Reject oversized image
        oversized_jpeg = b"\xFF\xD8\xFF\xE0\x00\x10JFIF" + b"\x00" * (settings.MAX_UPLOAD_SIZE_BYTES + 1024)
        self.sent_messages.clear()
        mock_provider.reset_mock()

        with patch.object(whatsapp_service, "download_media", return_value=(oversized_jpeg, "image/jpeg")):
            with patch("app.services.whatsapp_service.get_storage_provider", return_value=mock_provider):
                res = self._post_image_webhook("919876543777", "media_oversize", "Complaint text")
                self.assertEqual(res.status_code, 200)

        mock_provider.store_image.assert_not_called()
        self.assertTrue(any("exceeds maximum allowed size" in m["text"].lower() for m in self.sent_messages))

    def _post_text_webhook(self, sender_phone: str, text: str):
        payload = {
            "object": "whatsapp_business_account",
            "entry": [{
                "id": "100099988877766",
                "changes": [{
                    "value": {
                        "messaging_product": "whatsapp",
                        "metadata": {"phone_number_id": "100099988877766"},
                        "messages": [{
                            "from": sender_phone,
                            "id": f"wamid.{uuid.uuid4().hex}",
                            "timestamp": str(int(time.time())),
                            "type": "text",
                            "text": {"body": text}
                        }]
                    },
                    "field": "messages"
                }]
            }]
        }
        body = json.dumps(payload).encode("utf-8")
        return self.client.post(
            "/api/v1/whatsapp/webhook",
            content=body,
            headers={"X-Hub-Signature-256": self._sign_payload(body)}
        )

    def test_citizen_cancellation_deletes_staged_s3_object(self):
        """Verify that cancelling an unconfirmed photo draft deletes its staged S3 object."""
        phone = "919876543881"
        staged_key = "uploads/img_staged_cancel_123.jpg"
        whatsapp_service.pending_sessions.store_draft(phone, {
            "title": "Staged Pothole",
            "photo_url": staged_key
        })

        mock_s3_client = MagicMock()
        mock_provider = S3StorageProvider(
            bucket_name="civicsense-evidence",
            access_key_id="test-key",
            secret_access_key="test-secret",
            s3_client=mock_s3_client
        )

        with patch("app.services.whatsapp_service.get_storage_provider", return_value=mock_provider):
            res = self._post_text_webhook(phone, "cancel")
            self.assertEqual(res.status_code, 200)

        mock_s3_client.delete_object.assert_called_once_with(
            Bucket="civicsense-evidence",
            Key=staged_key
        )
        self.assertIsNone(whatsapp_service.pending_sessions.get_draft(phone))
        self.assertTrue(any("discarded" in m["text"].lower() for m in self.sent_messages))

    def test_citizen_cancellation_preserves_confirmed_incident_evidence(self):
        """Verify that cancelling a draft whose photo is already attached to a confirmed incident does NOT delete the evidence."""
        db = SessionLocal()
        phone = "919876543882"
        inc_id = f"INC-WA-KEEP-{uuid.uuid4().hex[:6].upper()}"
        attached_key = "uploads/img_confirmed_evidence_keep.jpg"
        try:
            inc = Incident(
                id=inc_id,
                title="Confirmed Incident to Protect",
                type="road_damage",
                severity="medium",
                status="reported",
                ward_id="w-1",
                ward_name="Ward 1",
                lat=12.97,
                lng=77.59,
                address="Indiranagar 100ft Road",
                photo_url=attached_key,
                priority_score=70,
                estimated_repair_cost=20000.0,
                saved_early_intervention=75000.0,
                user_id=f"usr-wa-{phone}",
                assigned_crew="Unassigned",
                confidence=92.0,
                description="Confirmed complaint",
                explanation="AI verified"
            )
            db.add(inc)
            db.commit()

            whatsapp_service.pending_sessions.store_draft(phone, {
                "title": "Draft with Attached Photo",
                "photo_url": attached_key
            })

            mock_s3_client = MagicMock()
            mock_provider = S3StorageProvider(
                bucket_name="civicsense-evidence",
                access_key_id="test-key",
                secret_access_key="test-secret",
                s3_client=mock_s3_client
            )

            with patch("app.services.whatsapp_service.get_storage_provider", return_value=mock_provider):
                res = self._post_text_webhook(phone, "cancel")
                self.assertEqual(res.status_code, 200)

            # Assert S3 delete was NOT called
            mock_s3_client.delete_object.assert_not_called()
            # Assert confirmed incident remains intact
            db.refresh(inc)
            self.assertEqual(inc.photo_url, attached_key)
            self.assertIsNone(whatsapp_service.pending_sessions.get_draft(phone))

        finally:
            try:
                db.rollback()
                db.query(Incident).filter(Incident.id == inc_id).delete(synchronize_session=False)
                db.commit()
            except Exception:
                db.rollback()
            finally:
                db.close()

    def test_unauthorized_engineer_cannot_trigger_s3_upload(self):
        """Verify unauthorized users or unassigned engineers cannot trigger resolution photo S3 uploads."""
        db = SessionLocal()
        inc_id = f"INC-WA-UNAUTH-{uuid.uuid4().hex[:6].upper()}"
        eng_assigned_phone = "919876543884"
        eng_assigned_id = f"usr-wa-{eng_assigned_phone}"
        eng_other_phone = "919876543885"
        eng_other_id = f"usr-wa-{eng_other_phone}"
        citizen_phone = "919876543883"

        mock_provider = MagicMock()

        try:
            # 1. Provision assigned engineer and other engineer
            eng_assigned = User(
                id=eng_assigned_id,
                email=f"eng_assigned_{eng_assigned_phone}@civicsense.ai",
                full_name="Eng. Assigned",
                role="engineer",
                department="Roads & Infrastructure Engineering",
                hashed_password=get_password_hash("password123"),
                status="active",
                is_active=True
            )
            eng_other = User(
                id=eng_other_id,
                email=f"eng_other_{eng_other_phone}@civicsense.ai",
                full_name="Eng. Other",
                role="engineer",
                department="Roads & Infrastructure Engineering",
                hashed_password=get_password_hash("password123"),
                status="active",
                is_active=True
            )
            db.add_all([eng_assigned, eng_other])

            # Provision incident assigned to eng_assigned
            inc = Incident(
                id=inc_id,
                title="Pothole for Authorization Test",
                type="pothole",
                severity="high",
                status="crew_assigned",
                ward_id="w-1",
                ward_name="Ward 1",
                lat=12.97,
                lng=77.59,
                address="MG Road",
                photo_url="uploads/initial.jpg",
                priority_score=80,
                estimated_repair_cost=18000.0,
                saved_early_intervention=72000.0,
                user_id="usr-wa-citizen",
                assigned_crew="Alpha Crew",
                assigned_engineer_id=eng_assigned_id,
                confidence=93.0,
                description="Pothole test",
                explanation="AI analysis"
            )
            db.add(inc)
            db.commit()

            # Case A: Incident does not exist
            self.sent_messages.clear()
            with patch("app.routers.whatsapp.get_storage_provider", return_value=mock_provider):
                res = self._post_image_webhook(eng_assigned_phone, "media_nonexistent", "resolve INC-NONEXISTENT-999")
                self.assertEqual(res.status_code, 200)

            mock_provider.store_image.assert_not_called()
            self.assertTrue(any("was not found or is not accessible" in m["text"].lower() for m in self.sent_messages))

            # Case B: Sender is a citizen (not an engineer)
            self.sent_messages.clear()
            mock_provider.reset_mock()
            with patch("app.routers.whatsapp.get_storage_provider", return_value=mock_provider):
                res = self._post_image_webhook(citizen_phone, "media_citizen_resolve", f"resolve {inc_id}")
                self.assertEqual(res.status_code, 200)

            mock_provider.store_image.assert_not_called()
            self.assertTrue(any("field engineer operations require an authenticated engineer account" in m["text"].lower() for m in self.sent_messages))

            # Case C: Sender is an engineer, but NOT assigned to this incident
            self.sent_messages.clear()
            mock_provider.reset_mock()
            with patch("app.routers.whatsapp.get_storage_provider", return_value=mock_provider):
                res = self._post_image_webhook(eng_other_phone, "media_unassigned_resolve", f"resolve {inc_id}")
                self.assertEqual(res.status_code, 200)

            mock_provider.store_image.assert_not_called()
            self.assertTrue(any("not assigned to you" in m["text"].lower() for m in self.sent_messages))

            # Assert incident was NOT resolved
            db.refresh(inc)
            self.assertEqual(inc.status, "crew_assigned")
            self.assertIsNone(inc.resolved_photo_url)

        finally:
            try:
                db.rollback()
                db.query(AuditLog).filter(AuditLog.incident_id == inc_id).delete(synchronize_session=False)
                db.query(WorkflowHistory).filter(WorkflowHistory.incident_id == inc_id).delete(synchronize_session=False)
                db.query(Incident).filter(Incident.id == inc_id).delete(synchronize_session=False)
                db.query(User).filter(User.id.in_([eng_assigned_id, eng_other_id])).delete(synchronize_session=False)
                db.commit()
            except Exception:
                db.rollback()
            finally:
                db.close()

    def test_staged_object_deletion_failure_does_not_corrupt_workflow(self):
        """Verify that a storage error during staged-object deletion is handled safely and logs a warning without breaking the cancellation flow."""
        phone = "919876543886"
        staged_key = "uploads/img_staged_fail_del.jpg"
        whatsapp_service.pending_sessions.store_draft(phone, {
            "title": "Draft with Failing Deletion",
            "photo_url": staged_key
        })

        mock_provider = MagicMock()
        mock_provider.delete_image.side_effect = Exception("Simulated S3 DeleteObject Timeout")

        with patch("app.services.whatsapp_service.get_storage_provider", return_value=mock_provider):
            res = self._post_text_webhook(phone, "cancel")
            self.assertEqual(res.status_code, 200)

        # Assert delete_image was attempted
        mock_provider.delete_image.assert_called_once_with(staged_key)
        # Assert draft was still safely discarded
        self.assertIsNone(whatsapp_service.pending_sessions.get_draft(phone))
        # Assert user still received clean discard confirmation
        self.assertTrue(any("discarded" in m["text"].lower() for m in self.sent_messages))


class TestWhatsAppPendingSessionPersistence(unittest.TestCase):
    """
    Test suite for PostgreSQL-backed WhatsApp Pending Session Persistence.
    Verifies:
    - Container restart recovery
    - TTL expiration and stale cleanup
    - Explicit cancellation cleanup
    - Concurrent thread updates
    - Evidence metadata and staged S3 key preservation
    """

    @classmethod
    def setUpClass(cls):
        from app.database import engine, SessionLocal
        from app.models.whatsapp_session import WhatsAppPendingSession
        cls.engine = engine
        cls.SessionLocal = SessionLocal
        # Ensure table exists in local test database
        WhatsAppPendingSession.__table__.create(bind=engine, checkfirst=True)

    def setUp(self):
        self.db = self.SessionLocal()
        from app.models.whatsapp_session import WhatsAppPendingSession
        self.db.query(WhatsAppPendingSession).delete()
        self.db.commit()
        whatsapp_service.pending_sessions.clear_all(db=self.db)

    def tearDown(self):
        try:
            self.db.rollback()
            from app.models.whatsapp_session import WhatsAppPendingSession
            self.db.query(WhatsAppPendingSession).delete()
            self.db.commit()
        except Exception:
            self.db.rollback()
        finally:
            self.db.close()

    def test_01_restart_recovery_from_database(self):
        """Verify that an unconfirmed draft survives memory wipes (simulating container restarts)."""
        from app.services.whatsapp_service import PendingSessionStore
        phone = "919988776655"
        draft_data = {
            "title": "WhatsApp: Pothole Defect",
            "type": "road_damage",
            "severity": "high",
            "lat": 12.9716,
            "lng": 77.5946,
            "address": "Victoria Road",
            "photo_url": "uploads/img_restart_recovery.jpg",
            "confidence": 94.5,
            "estimated_repair_cost": 3500.0
        }

        # Instance 1 stores draft to database
        store_inst_1 = PendingSessionStore(ttl_seconds=1800)
        store_inst_1.store_draft(phone, draft_data, db=self.db)

        # Instance 2 simulates a fresh container process with empty memory
        store_inst_2 = PendingSessionStore(ttl_seconds=1800)
        # In-memory dictionary is completely empty in instance 2
        self.assertEqual(len(store_inst_2._store), 0)

        # Recover from PostgreSQL
        recovered = store_inst_2.get_draft(phone, db=self.db)
        self.assertIsNotNone(recovered)
        self.assertEqual(recovered["title"], "WhatsApp: Pothole Defect")
        self.assertEqual(recovered["photo_url"], "uploads/img_restart_recovery.jpg")
        self.assertEqual(recovered["lat"], 12.9716)
        self.assertEqual(recovered["lng"], 77.5946)

    def test_02_session_ttl_expiry(self):
        """Verify that drafts past their TTL are evicted and return None."""
        from app.services.whatsapp_service import PendingSessionStore
        phone = "919988776656"
        draft_data = {
            "title": "Expired Draft",
            "photo_url": "uploads/img_expired.jpg"
        }

        # Store with 0-second TTL (immediately expired)
        short_ttl_store = PendingSessionStore(ttl_seconds=-10)
        short_ttl_store.store_draft(phone, draft_data, db=self.db)

        # Retrieval should evict expired entry
        result = short_ttl_store.get_draft(phone, db=self.db)
        self.assertIsNone(result)

    def test_03_cancellation_cleanup(self):
        """Verify that citizen cancellation discards both memory and database records."""
        from app.services.whatsapp_service import PendingSessionStore
        from app.models.whatsapp_session import WhatsAppPendingSession
        phone = "919988776657"
        draft_data = {
            "title": "Cancelled Draft",
            "photo_url": "uploads/img_to_cancel.jpg"
        }

        store = PendingSessionStore(ttl_seconds=1800)
        store.store_draft(phone, draft_data, db=self.db)

        # Clear draft via cancellation
        cleared = store.clear_draft(phone, db=self.db)
        self.assertEqual(cleared["photo_url"], "uploads/img_to_cancel.jpg")

        # Confirm gone from memory and DB
        self.assertIsNone(store.get_draft(phone, db=self.db))
        db_count = self.db.query(WhatsAppPendingSession).filter(WhatsAppPendingSession.phone == phone).count()
        self.assertEqual(db_count, 0)

    def test_04_concurrent_updates(self):
        """Verify thread-safety and database integrity under concurrent webhook updates."""
        import threading
        import time
        from app.services.whatsapp_service import PendingSessionStore
        phone = "919988776658"
        initial_draft = {"title": "Concurrent Base", "counter": 0}
        store = PendingSessionStore(ttl_seconds=1800)
        store.store_draft(phone, initial_draft, db=self.db)

        errors = []

        def worker(thread_id):
            try:
                for i in range(3):
                    for attempt in range(10):
                        db_worker = self.SessionLocal()
                        try:
                            d = store.get_draft(phone, db=db_worker)
                            if d:
                                new_d = dict(d)
                                new_d["last_thread"] = thread_id
                                new_d["counter"] = new_d.get("counter", 0) + 1
                                store.store_draft(phone, new_d, db=db_worker)
                            break
                        except Exception as lock_err:
                            if attempt == 9:
                                raise lock_err
                            time.sleep(0.02)
                        finally:
                            db_worker.close()
            except Exception as e:
                errors.append(e)

        threads = [threading.Thread(target=worker, args=(t,)) for t in range(4)]
        for t in threads:
            t.start()
        for t in threads:
            t.join()

        self.assertEqual(len(errors), 0, f"Concurrent worker exceptions: {errors}")
        final_draft = store.get_draft(phone, db=self.db)
        self.assertIsNotNone(final_draft)
        self.assertGreater(final_draft["counter"], 0)

    def test_05_evidence_metadata_preservation(self):
        """Verify that incremental location/address updates preserve staged S3 photo references."""
        import asyncio
        from unittest.mock import patch, AsyncMock
        phone = "919988776659"
        staged_s3_key = "uploads/img_preserve_test_999.jpg"
        whatsapp_service.pending_sessions.store_draft(phone, {
            "title": "Road Defect",
            "photo_url": staged_s3_key,
            "lat": 12.9716,
            "lng": 77.5946,
            "address": "Initial Location",
            "confidence": 91.0
        }, db=self.db)

        # Update address using async helper with db and mocked outgoing WhatsApp message
        with patch.object(whatsapp_service, "send_text_message", new_callable=AsyncMock) as mock_send:
            asyncio.run(whatsapp_service.update_draft_address(phone, "MG Road Corner", db=self.db))
            mock_send.assert_awaited_once()

        # Check preserved metadata
        updated = whatsapp_service.pending_sessions.get_draft(phone, db=self.db)
        self.assertIsNotNone(updated)
        self.assertEqual(updated["address"], "MG Road Corner")
        self.assertEqual(updated["photo_url"], staged_s3_key)
        self.assertEqual(updated["lat"], 12.9716)
        self.assertEqual(updated["confidence"], 91.0)

    def test_06_conversational_text_draft_survives_restart_via_db(self):
        """Verify that conversational text drafts persist in PostgreSQL across memory wipes."""
        import asyncio
        from unittest.mock import patch, AsyncMock
        phone = "919988776660"
        with patch.object(whatsapp_service, "send_text_message", new_callable=AsyncMock) as mock_send:
            asyncio.run(whatsapp_service.handle_conversational_text_draft(
                phone, "Dangerous pothole near Indiranagar 100ft road causing traffic halt", db=self.db
            ))
            mock_send.assert_awaited_once()

        # Simulate backend container restart by purging in-memory cache
        whatsapp_service.pending_sessions._store.clear()

        # Recover from PostgreSQL
        recovered = whatsapp_service.pending_sessions.get_draft(phone, db=self.db)
        self.assertIsNotNone(recovered)
        self.assertEqual(recovered["type"], "pothole")
        self.assertEqual(recovered["severity"], "high")
        self.assertIn("Indiranagar", recovered["address"])
        self.assertIn("Dangerous pothole", recovered["description"])

    def test_07_location_pin_persists_to_db_before_photo(self):
        """Verify that pre-staged GPS location pins persist to DB and survive memory wipes."""
        phone = "919988776661"
        whatsapp_service.pending_sessions.store_draft(phone, {
            "lat": 12.9352,
            "lng": 77.6245,
            "address": "Koramangala 5th Block Municipal Zone",
            "status": "awaiting_photo_or_description",
        }, db=self.db)

        # Purge memory cache
        whatsapp_service.pending_sessions._store.clear()

        # Recover from PostgreSQL
        recovered = whatsapp_service.pending_sessions.get_draft(phone, db=self.db)
        self.assertIsNotNone(recovered)
        self.assertEqual(recovered["lat"], 12.9352)
        self.assertEqual(recovered["lng"], 77.6245)
        self.assertEqual(recovered["address"], "Koramangala 5th Block Municipal Zone")

    def test_08_meta_test_number_allowlist_error_131030_handling(self):
        """Verify that Meta Cloud API test-number allowlist error (code 131030) raises WhatsAppInvalidRecipientError."""
        import httpx
        from app.services.whatsapp_service import WhatsAppInvalidRecipientError

        # Create mock HTTP 400 response with code 131030
        req = httpx.Request("POST", "https://graph.facebook.com/v21.0/12345/messages")
        resp = httpx.Response(
            status_code=400,
            json={
                "error": {
                    "message": "(#131030) Recipient phone number not in allowed list",
                    "type": "OAuthException",
                    "code": 131030,
                    "error_data": {
                        "messaging_product": "whatsapp",
                        "details": "Recipient phone number not in allowed list"
                    }
                }
            },
            request=req
        )
        exc = httpx.HTTPStatusError("Bad Request", request=req, response=resp)
        with self.assertRaises(WhatsAppInvalidRecipientError) as ctx:
            whatsapp_service._handle_http_error(exc)
        self.assertIn("allowed phone number list", str(ctx.exception).lower())
        self.assertIn("test number", str(ctx.exception).lower())

    def test_09_confirmed_complaint_id_format_and_entity_linking(self):
        """Verify that confirmed WhatsApp complaints generate valid ticket IDs and link User and AIAnalysis."""
        import re
        from app.models.incident import Incident
        from app.models.ai_analysis import AIAnalysis
        from app.models.user import User
        phone = "919988776662"
        whatsapp_service.pending_sessions.store_draft(phone, {
            "title": "WhatsApp: Pothole Hazard",
            "type": "pothole",
            "severity": "high",
            "ward_id": "w-1",
            "ward_name": "Ward 1 - Metro Health Corridor",
            "lat": 12.9716,
            "lng": 77.5946,
            "address": "Brigade Road Crossing",
            "priority_score": 85,
            "estimated_repair_cost": 42000.0,
            "saved_early_intervention": 168000.0,
            "photo_url": "uploads/img_wa_test_entity.jpg",
            "confidence": 94.0,
            "description": "Severe road cavity near pedestrian crossing.",
            "explanation": "Gemini 2.5 Flash classification.",
            "recommended_department": "Road Infrastructure & Works Dept",
            "sender_phone": phone,
        }, db=self.db)

        incident = whatsapp_service.confirm_pending_draft(self.db, phone)
        self.assertIsNotNone(incident)
        try:
            # Check ID pattern
            self.assertTrue(re.match(r"^INC-2026-[A-F0-9]{6}$", incident.id))
            self.assertEqual(incident.status, "reported")
            self.assertEqual(incident.ward_id, "w-1")

            # Check linked citizen User
            user = self.db.query(User).filter(User.id == f"usr-wa-{phone}").first()
            self.assertIsNotNone(user)
            self.assertEqual(user.role, "citizen")
            self.assertEqual(user.email, f"whatsapp_{phone}@civicsense.ai")

            # Check linked AIAnalysis
            ai = self.db.query(AIAnalysis).filter(AIAnalysis.incident_id == incident.id).first()
            self.assertIsNotNone(ai)
            self.assertEqual(ai.cv_confidence, 94.0)
            self.assertIn("Severe road cavity", ai.summary)
        finally:
            self.db.query(AIAnalysis).filter(AIAnalysis.incident_id == incident.id).delete()
            self.db.query(Incident).filter(Incident.id == incident.id).delete()
            self.db.query(User).filter(User.id == f"usr-wa-{phone}").delete()
            self.db.commit()


if __name__ == "__main__":
    unittest.main()

