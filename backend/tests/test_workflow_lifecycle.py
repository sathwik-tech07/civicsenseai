"""
Test Suite: Civic Complaint Lifecycle Workflow Engine (Phase 5)
Tests:
- Full 11-stage complaint progression:
  reported -> ai_analysis -> verified -> priority_assigned -> commissioner_review ->
  crew_assigned -> en_route -> repair_started -> quality_inspection -> resolved -> citizen_notified
- RBAC restrictions on stage transitions (citizens blocked, engineers scoped to assigned)
- Engineer assignment & crew deployment restricted to Commissioner / Admin
- Automated immutable AuditLog and Notification generation at each transition
- Complete 11-stage live timeline compilation (/workflow/timeline/{id})
"""

import unittest
import uuid
import datetime
import os
import sys

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from starlette.testclient import TestClient

from app.main import app
from app.database import SessionLocal
from app.models.user import User
from app.models.incident import Incident
from app.models.ai_analysis import AIAnalysis
from app.models.workflow import WorkflowHistory, AuditLog, Notification
from app.utils.security import get_password_hash, create_access_token


class TestWorkflowLifecycle(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.client = TestClient(app)
        cls.db = SessionLocal()

        # Dedicated test users
        cls.citizen = User(
            id=f"usr-wf-cit-{uuid.uuid4().hex[:6]}",
            email=f"cit_wf_{uuid.uuid4().hex[:6]}@test.com",
            full_name="Workflow Citizen",
            hashed_password=get_password_hash("pass123"),
            role="citizen",
            department="Public",
            status="active",
            is_active=True
        )
        cls.engineer = User(
            id=f"usr-wf-eng-{uuid.uuid4().hex[:6]}",
            email=f"eng_wf_{uuid.uuid4().hex[:6]}@test.com",
            full_name="Eng. Rajesh V",
            hashed_password=get_password_hash("pass123"),
            role="engineer",
            department="Roads & Works",
            status="active",
            is_active=True
        )
        cls.commissioner = User(
            id=f"usr-wf-com-{uuid.uuid4().hex[:6]}",
            email=f"com_wf_{uuid.uuid4().hex[:6]}@test.com",
            full_name="Dr. Anita Roy",
            hashed_password=get_password_hash("pass123"),
            role="commissioner",
            department="Office of the City Commissioner",
            status="active",
            is_active=True
        )
        cls.db.add_all([cls.citizen, cls.engineer, cls.commissioner])
        cls.db.commit()

        cls.cit_token = create_access_token({"sub": cls.citizen.id})
        cls.eng_token = create_access_token({"sub": cls.engineer.id})
        cls.com_token = create_access_token({"sub": cls.commissioner.id})

    @classmethod
    def tearDownClass(cls):
        cls.db.delete(cls.citizen)
        cls.db.delete(cls.engineer)
        cls.db.delete(cls.commissioner)
        cls.db.commit()
        cls.db.close()

    def test_01_full_complaint_lifecycle_and_audit(self):
        """Execute full end-to-end 11-stage workflow with audit tracking."""
        # Step 1: Citizen creates complaint
        create_res = self.client.post(
            "/api/v1/incidents/",
            json={
                "title": "Severe Pavement Collapse on Outer Ring Road",
                "type": "road_collapse",
                "severity": "critical",
                "ward_id": "w-1",
                "ward_name": "Ward 1 - Metro Health Corridor",
                "lat": 12.9716,
                "lng": 77.5946,
                "address": "Outer Ring Road near Central Junction",
                "photo_url": "/uploads/collapse_test.jpg",
                "description": "Large sinkhole opening up across two traffic lanes."
            },
            headers={"Authorization": f"Bearer {self.cit_token}"}
        )
        self.assertEqual(create_res.status_code, 201)
        inc_data = create_res.json()
        inc_id = inc_data["id"]

        try:
            # Verify initial state
            self.assertEqual(inc_data["status"], "reported")
            self.assertEqual(inc_data["user_id"], self.citizen.id)

            # Step 2: Citizen attempts stage transition -> 403 Forbidden
            res_cit_block = self.client.post(
                "/api/v1/workflow/transition",
                json={"incident_id": inc_id, "target_stage": "commissioner_review"},
                headers={"Authorization": f"Bearer {self.cit_token}"}
            )
            self.assertEqual(res_cit_block.status_code, 403)

            # Step 3: Unassigned Engineer attempts stage transition -> 403 Forbidden
            res_eng_block = self.client.post(
                "/api/v1/workflow/transition",
                json={"incident_id": inc_id, "target_stage": "commissioner_review"},
                headers={"Authorization": f"Bearer {self.eng_token}"}
            )
            self.assertEqual(res_eng_block.status_code, 403)

            # Step 4: Commissioner reviews and assigns Engineer
            res_assign = self.client.post(
                "/api/v1/workflow/transition",
                json={
                    "incident_id": inc_id,
                    "target_stage": "commissioner_review",
                    "assigned_engineer_id": self.engineer.id,
                    "assigned_crew": "Crew Alpha-1 Rapid Response",
                    "notes": "Reviewed priority and dispatched to Engineer Rajesh."
                },
                headers={"Authorization": f"Bearer {self.com_token}"}
            )
            self.assertEqual(res_assign.status_code, 200)

            # Verify Incident was updated with assigned engineer & crew
            updated_inc = self.db.query(Incident).filter(Incident.id == inc_id).first()
            self.assertEqual(updated_inc.assigned_engineer_id, self.engineer.id)
            self.assertEqual(updated_inc.assigned_crew, "Crew Alpha-1 Rapid Response")

            # Step 5: Now Assigned Engineer CAN transition stage to 'repair_started'
            res_repair = self.client.post(
                "/api/v1/workflow/transition",
                json={
                    "incident_id": inc_id,
                    "target_stage": "repair_started",
                    "notes": "Field crew arrived on site; cold-mix patch underway."
                },
                headers={"Authorization": f"Bearer {self.eng_token}"}
            )
            self.assertEqual(res_repair.status_code, 200)

            # Step 6: Engineer advances to 'resolved' with resolution evidence
            res_resolve = self.client.post(
                "/api/v1/workflow/transition",
                json={
                    "incident_id": inc_id,
                    "target_stage": "resolved",
                    "resolved_photo_url": "/uploads/resolved_patch.jpg",
                    "notes": "Asphalt compaction verified; road cleared for traffic."
                },
                headers={"Authorization": f"Bearer {self.eng_token}"}
            )
            self.assertEqual(res_resolve.status_code, 200)

            # Step 7: Verify Timeline & Immutable Audit Logs
            res_timeline = self.client.get(
                f"/api/v1/workflow/timeline/{inc_id}",
                headers={"Authorization": f"Bearer {self.cit_token}"}
            )
            self.assertEqual(res_timeline.status_code, 200)
            timeline = res_timeline.json()
            self.assertEqual(len(timeline), 11)

            # Verify AuditLog entries
            audit_entries = self.db.query(AuditLog).filter(AuditLog.incident_id == inc_id).all()
            self.assertGreaterEqual(len(audit_entries), 3)

            # Verify Notifications generated
            notifications = self.db.query(Notification).filter(Notification.incident_id == inc_id).all()
            self.assertGreaterEqual(len(notifications), 3)

        finally:
            # Clean up test records
            self.db.query(WorkflowHistory).filter(WorkflowHistory.incident_id == inc_id).delete()
            self.db.query(AuditLog).filter(AuditLog.incident_id == inc_id).delete()
            self.db.query(Notification).filter(Notification.incident_id == inc_id).delete()
            self.db.query(AIAnalysis).filter(AIAnalysis.incident_id == inc_id).delete()
            self.db.query(Incident).filter(Incident.id == inc_id).delete()
            self.db.commit()


if __name__ == "__main__":
    unittest.main()
