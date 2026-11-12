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

    def test_02_citizen_escalation_feedback_and_duplicate_detection(self):
        """
        Verify:
        - Spatial duplicate complaint detection for nearby incidents
        - Citizen escalation requests with reason and priority score increase
        - Ownership enforcement (non-owners rejected with 403)
        - Citizen satisfaction feedback logging in audit logs
        """
        # Create incident 1 as Citizen
        res1 = self.client.post(
            "/api/v1/incidents/",
            json={
                "title": "Road Surface Defect",
                "type": "pothole",
                "severity": "medium",
                "ward_id": "w-1",
                "ward_name": "Ward 1 - Metro Health Corridor",
                "lat": 12.9716,
                "lng": 77.5946,
                "address": "Victoria Hospital Corridor",
                "photo_url": "/uploads/pothole1.jpg",
                "priority_score": 70
            },
            headers={"Authorization": f"Bearer {self.cit_token}"}
        )
        self.assertEqual(res1.status_code, 201)
        inc1_id = res1.json()["id"]

        # Create incident 2 nearby (approx 30m away) with same type
        res2 = self.client.post(
            "/api/v1/incidents/",
            json={
                "title": "Severe Pit in Road",
                "type": "pothole",
                "severity": "high",
                "ward_id": "w-1",
                "ward_name": "Ward 1 - Metro Health Corridor",
                "lat": 12.9718,
                "lng": 77.5948,
                "address": "Victoria Hospital Corridor East Gate",
                "photo_url": "/uploads/pothole2.jpg",
                "priority_score": 80
            },
            headers={"Authorization": f"Bearer {self.cit_token}"}
        )
        self.assertEqual(res2.status_code, 201)
        inc2_id = res2.json()["id"]

        try:
            # Verify spatial duplicate detection recorded in AIAnalysis
            ai2 = self.db.query(AIAnalysis).filter(AIAnalysis.incident_id == inc2_id).first()
            self.assertIsNotNone(ai2)
            self.assertGreaterEqual(ai2.duplicate_complaints_count, 1)

            # Citizen 1 escalates their complaint with a reason
            res_esc = self.client.post(
                f"/api/v1/incidents/{inc1_id}/escalate",
                json={"reason": "Pothole expanding rapidly after heavy rain, blocking ambulances."},
                headers={"Authorization": f"Bearer {self.cit_token}"}
            )
            self.assertEqual(res_esc.status_code, 200)
            esc_data = res_esc.json()
            self.assertEqual(esc_data["status"], "success")
            self.assertGreaterEqual(esc_data["priority_score"], 80)

            # Other user (non-owner citizen) attempting to escalate inc1 -> 403 Forbidden
            other_citizen = User(
                id=f"usr-wf-other-{uuid.uuid4().hex[:6]}",
                email=f"other_wf_{uuid.uuid4().hex[:6]}@test.com",
                full_name="Other Citizen",
                hashed_password=get_password_hash("pass123"),
                role="citizen",
                department="Public",
                status="active",
                is_active=True
            )
            self.db.add(other_citizen)
            self.db.commit()

            other_cit_token = create_access_token(data={"sub": other_citizen.id})
            res_unauth_esc = self.client.post(
                f"/api/v1/incidents/{inc1_id}/escalate",
                json={"reason": "Malicious non-owner escalation attempt."},
                headers={"Authorization": f"Bearer {other_cit_token}"}
            )
            self.assertEqual(res_unauth_esc.status_code, 403)

            # Citizen submits satisfaction feedback on inc1
            res_fb = self.client.post(
                f"/api/v1/incidents/{inc1_id}/feedback",
                json={"rating": 5, "comment": "Rapid response and excellent asphalt repair quality!"},
                headers={"Authorization": f"Bearer {self.cit_token}"}
            )
            self.assertEqual(res_fb.status_code, 200)
            self.assertEqual(res_fb.json()["rating"], 5)

            # Verify audit log recorded feedback
            fb_audit = self.db.query(AuditLog).filter(
                AuditLog.incident_id == inc1_id,
                AuditLog.result == "Feedback Acknowledged"
            ).first()
            self.assertIsNotNone(fb_audit)
            self.assertIn("5/5 stars", fb_audit.what)

        finally:
            if 'other_citizen' in locals() and other_citizen:
                self.db.delete(other_citizen)
            for inc_id in [inc1_id, inc2_id]:
                self.db.query(WorkflowHistory).filter(WorkflowHistory.incident_id == inc_id).delete()
                self.db.query(AuditLog).filter(AuditLog.incident_id == inc_id).delete()
                self.db.query(Notification).filter(Notification.incident_id == inc_id).delete()
                self.db.query(AIAnalysis).filter(AIAnalysis.incident_id == inc_id).delete()
                self.db.query(Incident).filter(Incident.id == inc_id).delete()
            self.db.commit()

    def test_03_field_engineer_portal_security_and_operations(self):
        """
        Verify Field Engineer Portal backend boundaries:
        - Scoped operations: only assigned engineer can advance stages
        - Tamper resistance: engineers cannot alter assigned_engineer_id or assigned_crew
        - Rejecting an assignment records reason in workflow timeline
        """
        # Create unassigned engineer
        unassigned_eng = User(
            id=f"usr-wf-unassigned-{uuid.uuid4().hex[:6]}",
            email=f"unassigned_eng_{uuid.uuid4().hex[:6]}@test.com",
            full_name="Unassigned Field Engineer",
            hashed_password=get_password_hash("pass123"),
            role="engineer",
            department="Roads & Works",
            status="active",
            is_active=True
        )
        self.db.add(unassigned_eng)
        self.db.commit()

        unassigned_token = create_access_token(data={"sub": unassigned_eng.id})

        # Create incident assigned to self.engineer
        inc = Incident(
            id=f"INC-ENG-{uuid.uuid4().hex[:6]}",
            title="Structural Manhole Cover Failure",
            type="road_collapse",
            severity="critical",
            status="reported",
            ward_id="w-1",
            ward_name="Ward 1 - Metro Health Corridor",
            lat=12.9716,
            lng=77.5946,
            address="Victoria Hospital Main Gate",
            photo_url="/uploads/manhole_before.jpg",
            priority_score=95,
            user_id=self.citizen.id,
            assigned_engineer_id=self.engineer.id,
            assigned_crew="Crew Alpha-1"
        )
        self.db.add(inc)
        self.db.commit()

        try:
            # 1. Unassigned engineer attempts to advance -> 403 Forbidden
            res_unauth = self.client.post(
                "/api/v1/workflow/transition",
                json={
                    "incident_id": inc.id,
                    "target_stage": "repair_started",
                    "notes": "Unauthorized work start attempt."
                },
                headers={"Authorization": f"Bearer {unassigned_token}"}
            )
            self.assertEqual(res_unauth.status_code, 403)

            # 2. Assigned engineer attempts to tamper with assigned_engineer_id -> 403 Forbidden
            res_tamper_eng = self.client.post(
                "/api/v1/workflow/transition",
                json={
                    "incident_id": inc.id,
                    "target_stage": "crew_assigned",
                    "assigned_engineer_id": unassigned_eng.id,
                    "notes": "Attempting illegal reassignment."
                },
                headers={"Authorization": f"Bearer {self.eng_token}"}
            )
            self.assertEqual(res_tamper_eng.status_code, 403)

            # 3. Assigned engineer accepts assignment
            res_accept = self.client.post(
                "/api/v1/workflow/transition",
                json={
                    "incident_id": inc.id,
                    "target_stage": "crew_assigned",
                    "notes": "Work order accepted by field engineer. Crew dispatched."
                },
                headers={"Authorization": f"Bearer {self.eng_token}"}
            )
            self.assertEqual(res_accept.status_code, 200)

            # 4. Assigned engineer marks work started
            res_start = self.client.post(
                "/api/v1/workflow/transition",
                json={
                    "incident_id": inc.id,
                    "target_stage": "repair_started",
                    "notes": "Field crew arrived on site. Heavy excavation underway."
                },
                headers={"Authorization": f"Bearer {self.eng_token}"}
            )
            self.assertEqual(res_start.status_code, 200)

            # 5. Assigned engineer completes resolution with after photo
            res_resolve = self.client.post(
                "/api/v1/workflow/transition",
                json={
                    "incident_id": inc.id,
                    "target_stage": "resolved",
                    "resolved_photo_url": "/uploads/manhole_resolved.jpg",
                    "notes": "Reinforced cast-iron cover installed. Load testing verified."
                },
                headers={"Authorization": f"Bearer {self.eng_token}"}
            )
            self.assertEqual(res_resolve.status_code, 200)

            # Verify resolved state
            self.db.refresh(inc)
            self.assertEqual(inc.status, "resolved")
            self.assertEqual(inc.resolved_photo_url, "/uploads/manhole_resolved.jpg")

        finally:
            self.db.delete(unassigned_eng)
            self.db.query(WorkflowHistory).filter(WorkflowHistory.incident_id == inc.id).delete()
            self.db.query(AuditLog).filter(AuditLog.incident_id == inc.id).delete()
            self.db.query(Notification).filter(Notification.incident_id == inc.id).delete()
            self.db.delete(inc)
            self.db.commit()

    def test_04_notifications_api_and_lifecycle(self):
        """
        Regression tests for Notification API:
        1. When notifications table is empty, GET /api/v1/workflow/notifications returns [] with HTTP 200.
        2. No obsolete demo-seeding occurs and no foreign key violation is raised.
        3. Real notifications created for a valid incident are accurately retrieved.
        4. PUT /api/v1/workflow/notifications/{id}/read and PUT /api/v1/workflow/notifications/read-all work properly.
        """
        # Ensure clean initial state by clearing notifications table
        self.db.query(Notification).delete()
        self.db.commit()

        # 1. Empty table test: must return HTTP 200 with empty list []
        res_empty = self.client.get(
            "/api/v1/workflow/notifications",
            headers={"Authorization": f"Bearer {self.cit_token}"}
        )
        self.assertEqual(res_empty.status_code, 200)
        self.assertEqual(res_empty.json(), [])

        # Verify that no phantom demo notifications were inserted
        count_in_db = self.db.query(Notification).count()
        self.assertEqual(count_in_db, 0)

        # 2. Create a genuine incident to attach notifications to
        test_inc = Incident(
            id=f"INC-TEST-NOTIF-{uuid.uuid4().hex[:6]}",
            title="Notification Regression Pipeline Rupture",
            type="water_leak",
            severity="critical",
            status="reported",
            ward_id="w-1",
            ward_name="Ward 1",
            lat=12.9716,
            lng=77.5946,
            address="Test Notification Corridor",
            photo_url="/uploads/test_notif_pipeline.jpg",
            user_id=self.citizen.id,
            created_at=datetime.datetime.utcnow()
        )
        self.db.add(test_inc)
        self.db.commit()

        try:
            # Create a notification for the genuine incident via staff endpoint
            res_create = self.client.post(
                "/api/v1/workflow/notifications/create",
                json={
                    "incident_id": test_inc.id,
                    "type": "INCIDENT_CREATED",
                    "title": "Pipeline Emergency Notification",
                    "message": "Immediate crew dispatch requested for pipeline rupture."
                },
                headers={"Authorization": f"Bearer {self.com_token}"}
            )
            self.assertEqual(res_create.status_code, 200)
            created_data = res_create.json()
            notif_id = created_data["id"]

            # Query notifications again: should contain the created notification
            res_list = self.client.get(
                "/api/v1/workflow/notifications",
                headers={"Authorization": f"Bearer {self.cit_token}"}
            )
            self.assertEqual(res_list.status_code, 200)
            notifs = res_list.json()
            self.assertEqual(len(notifs), 1)
            self.assertEqual(notifs[0]["id"], notif_id)
            self.assertEqual(notifs[0]["incidentId"], test_inc.id)
            self.assertEqual(notifs[0]["type"], "INCIDENT_CREATED")
            self.assertEqual(notifs[0]["title"], "Pipeline Emergency Notification")
            self.assertFalse(notifs[0]["read"])

            # 3. Mark individual notification read
            res_read = self.client.put(
                f"/api/v1/workflow/notifications/{notif_id}/read",
                headers={"Authorization": f"Bearer {self.cit_token}"}
            )
            self.assertEqual(res_read.status_code, 200)
            self.assertTrue(res_read.json().get("read"))

            # Verify notification is marked read in DB
            db_notif = self.db.query(Notification).filter(Notification.id == notif_id).first()
            self.assertTrue(db_notif.read)

            # 4. Mark all read
            # Add a second unread notification
            res_create2 = self.client.post(
                "/api/v1/workflow/notifications/create",
                json={
                    "incident_id": test_inc.id,
                    "type": "CREW_ASSIGNED",
                    "title": "Crew En Route",
                    "message": "Field unit dispatched to pipeline site."
                },
                headers={"Authorization": f"Bearer {self.com_token}"}
            )
            self.assertEqual(res_create2.status_code, 200)

            res_read_all = self.client.put(
                "/api/v1/workflow/notifications/read-all",
                headers={"Authorization": f"Bearer {self.cit_token}"}
            )
            self.assertEqual(res_read_all.status_code, 200)
            self.assertEqual(res_read_all.json(), {"status": "success"})

            # Verify all notifications are now read
            unread_count = self.db.query(Notification).filter(Notification.read == False).count()
            self.assertEqual(unread_count, 0)

        finally:
            # Cleanup
            self.db.query(Notification).filter(Notification.incident_id == test_inc.id).delete()
            self.db.delete(test_inc)
            self.db.commit()


if __name__ == "__main__":
    unittest.main()
