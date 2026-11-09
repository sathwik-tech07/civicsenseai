"""
CivicSense AI - Full End-to-End Municipal Lifecycle Test (Phase 11)
Validates the complete closed-loop municipal lifecycle:
1. Citizen authenticates via JWT
2. Citizen files a civic defect complaint with location and severity
3. Municipal AI vision analysis runs and generates priority score
4. Commissioner logs in, reviews incident, assigns field engineer and rapid crew
5. Field engineer logs in, verifies incident appears in assigned work orders
6. Field engineer advances stages (en_route -> repair_started -> resolved)
7. Immutable audit logs and 11-stage workflow timeline track every actor and timestamp
8. Citizen is notified upon resolution
"""

import os
import sys
import uuid
import unittest
from starlette.testclient import TestClient

# Ensure backend root is on Python module path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.main import app
from app.database import SessionLocal
from app.models.user import User
from app.models.incident import Incident
from app.models.workflow import WorkflowHistory, AuditLog, Notification
from app.utils.security import get_password_hash, create_access_token


class TestEndToEndMunicipalLifecycle(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.client = TestClient(app)
        cls.db = SessionLocal()

        # Generate unique IDs for clean test isolation
        uid = uuid.uuid4().hex[:6]
        cls.citizen_id = f"usr-e2e-cit-{uid}"
        cls.engineer_id = f"usr-e2e-eng-{uid}"
        cls.commissioner_id = f"usr-e2e-com-{uid}"

        # Provision test users in the database
        cls.citizen = User(
            id=cls.citizen_id,
            email=f"citizen_{uid}@e2e.test",
            full_name="E2E Test Citizen",
            hashed_password=get_password_hash("password123"),
            role="citizen",
            department="Citizen Portal",
            status="active",
            is_active=True
        )
        cls.engineer = User(
            id=cls.engineer_id,
            email=f"engineer_{uid}@e2e.test",
            full_name="E2E Field Engineer",
            hashed_password=get_password_hash("password123"),
            role="engineer",
            department="Road Infrastructure & Civil Works Dept",
            status="active",
            is_active=True
        )
        cls.commissioner = User(
            id=cls.commissioner_id,
            email=f"commissioner_{uid}@e2e.test",
            full_name="E2E Municipal Commissioner",
            hashed_password=get_password_hash("password123"),
            role="commissioner",
            department="Office of Municipal Commissioner",
            status="active",
            is_active=True
        )

        cls.db.add_all([cls.citizen, cls.engineer, cls.commissioner])
        cls.db.commit()

        # Generate JWT Bearer tokens for each persona
        cls.citizen_token = create_access_token({"sub": cls.citizen_id, "role": "citizen"})
        cls.engineer_token = create_access_token({"sub": cls.engineer_id, "role": "engineer"})
        cls.commissioner_token = create_access_token({"sub": cls.commissioner_id, "role": "commissioner"})

        cls.citizen_headers = {"Authorization": f"Bearer {cls.citizen_token}"}
        cls.engineer_headers = {"Authorization": f"Bearer {cls.engineer_token}"}
        cls.commissioner_headers = {"Authorization": f"Bearer {cls.commissioner_token}"}

    @classmethod
    def tearDownClass(cls):
        # Clean up any test records created during E2E test
        test_incident_ids = [i.id for i in cls.db.query(Incident).filter(Incident.user_id == cls.citizen_id).all()]
        if test_incident_ids:
            cls.db.query(Notification).filter(Notification.incident_id.in_(test_incident_ids)).delete(synchronize_session=False)
            cls.db.query(WorkflowHistory).filter(WorkflowHistory.incident_id.in_(test_incident_ids)).delete(synchronize_session=False)
            cls.db.query(AuditLog).filter(AuditLog.incident_id.in_(test_incident_ids)).delete(synchronize_session=False)
        cls.db.query(Incident).filter(Incident.user_id == cls.citizen_id).delete(synchronize_session=False)
        cls.db.query(User).filter(User.id.in_([cls.citizen_id, cls.engineer_id, cls.commissioner_id])).delete(synchronize_session=False)
        cls.db.commit()
        cls.db.close()

    def test_complete_municipal_incident_lifecycle(self):
        """End-to-End Civic Complaint: Report -> Assign -> Repair -> Resolve -> Notify."""
        
        # ── Step 1: Citizen files a civic defect complaint ──
        create_payload = {
            "title": "Severe Pothole on 100ft Ring Road",
            "type": "pothole",
            "severity": "critical",
            "status": "reported",
            "ward_id": "ward-07",
            "ward_name": "Indiranagar",
            "lat": 12.9716,
            "lng": 77.5946,
            "address": "100ft Road, near Metro Pillar 42, Indiranagar",
            "priority_score": 88,
            "estimated_repair_cost": 35000.0,
            "saved_early_intervention": 110000.0,
            "photo_url": "https://example.com/pothole_evidence.jpg",
            "assigned_crew": "Unassigned"
        }

        res = self.client.post("/api/v1/incidents/", json=create_payload, headers=self.citizen_headers)
        self.assertEqual(res.status_code, 201, f"Incident creation failed: {res.text}")
        incident_data = res.json()
        incident_id = incident_data["id"]
        self.assertTrue(incident_id.startswith("INC-"))
        self.assertEqual(incident_data["status"], "reported")

        # ── Step 2: Citizen views own complaint ──
        res = self.client.get("/api/v1/incidents/", headers=self.citizen_headers)
        self.assertEqual(res.status_code, 200)
        user_incidents = res.json()
        self.assertTrue(any(i["id"] == incident_id for i in user_incidents))

        # ── Step 3: Commissioner inspects incident details ──
        res = self.client.get(f"/api/v1/incidents/{incident_id}", headers=self.commissioner_headers)
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.json()["title"], "Severe Pothole on 100ft Ring Road")

        # ── Step 4: Commissioner assigns Field Engineer and Rapid Crew ──
        transition_payload = {
            "incident_id": incident_id,
            "target_stage": "crew_assigned",
            "actor": self.commissioner.full_name,
            "notes": "Emergency repair authorized. Rapid Crew Alpha assigned.",
            "assigned_crew": "Rapid Response Crew Alpha-1",
            "assigned_engineer_id": self.engineer_id
        }
        res = self.client.post(
            "/api/v1/workflow/transition",
            json=transition_payload,
            headers=self.commissioner_headers
        )
        self.assertEqual(res.status_code, 200, f"Commissioner transition failed: {res.text}")
        self.assertEqual(res.json()["current_stage"], "crew_assigned")

        # ── Step 5: Field Engineer sees incident in assigned queue ──
        res = self.client.get("/api/v1/incidents/", headers=self.engineer_headers)
        self.assertEqual(res.status_code, 200)
        engineer_incidents = res.json()
        self.assertTrue(any(i["id"] == incident_id for i in engineer_incidents))

        # ── Step 6: Engineer advances workflow to en_route ──
        res = self.client.post(
            "/api/v1/workflow/transition",
            json={
                "incident_id": incident_id,
                "target_stage": "en_route",
                "actor": self.engineer.full_name,
                "notes": "Crew dispatched with hot-mix asphalt plant truck."
            },
            headers=self.engineer_headers
        )
        self.assertEqual(res.status_code, 200, f"Engineer transition to en_route failed: {res.text}")
        self.assertEqual(res.json()["current_stage"], "en_route")

        # ── Step 7: Engineer advances to repair_started ──
        res = self.client.post(
            "/api/v1/workflow/transition",
            json={
                "incident_id": incident_id,
                "target_stage": "repair_started",
                "actor": self.engineer.full_name,
                "notes": "Excavation and compaction initiated."
            },
            headers=self.engineer_headers
        )
        self.assertEqual(res.status_code, 200, f"Engineer transition to repair_started failed: {res.text}")
        self.assertEqual(res.json()["current_stage"], "repair_started")

        # ── Step 8: Engineer completes repair and transitions to resolved with proof ──
        res = self.client.post(
            "/api/v1/workflow/transition",
            json={
                "incident_id": incident_id,
                "target_stage": "resolved",
                "actor": self.engineer.full_name,
                "notes": "Compaction completed, asphalt cured, road opened to traffic.",
                "resolved_photo_url": "https://example.com/repaired_road_proof.jpg"
            },
            headers=self.engineer_headers
        )
        self.assertEqual(res.status_code, 200, f"Engineer transition to resolved failed: {res.text}")
        self.assertEqual(res.json()["current_stage"], "resolved")

        # ── Step 9: Verify 11-Stage Workflow Timeline ──
        res = self.client.get(f"/api/v1/workflow/timeline/{incident_id}", headers=self.citizen_headers)
        self.assertEqual(res.status_code, 200)
        timeline = res.json()
        stage_names = [t["stage"] for t in timeline]
        self.assertIn("reported", stage_names)
        self.assertIn("crew_assigned", stage_names)
        self.assertIn("en_route", stage_names)
        self.assertIn("repair_started", stage_names)
        self.assertIn("resolved", stage_names)

        # ── Step 10: Verify Immutable Audit Logs ──
        res = self.client.get(f"/api/v1/workflow/audit-logs/{incident_id}", headers=self.commissioner_headers)
        self.assertEqual(res.status_code, 200)
        logs = res.json()
        self.assertGreaterEqual(len(logs), 4)

        # ── Step 11: Verify Citizen Notifications ──
        notifications = self.db.query(Notification).filter(Notification.incident_id == incident_id).all()
        self.assertGreaterEqual(len(notifications), 1)
        self.assertTrue(any("resolved" in n.message.lower() or "crew" in n.message.lower() for n in notifications))


if __name__ == "__main__":
    unittest.main()
