"""
Test Suite: Administrator Portal & RBAC Security (Phase 5)
Tests:
- Admin & Commissioner directory access (/api/v1/admin/users)
- RBAC enforcement (Citizens and Engineers blocked with 403 Forbidden)
- Staff user provisioning (/api/v1/admin/users) with duplicate email prevention (409 Conflict)
- User active status toggle (/api/v1/admin/users/{id}/status) and self-deactivation protection (400 Bad Request)
- Role and department reassignment (/api/v1/admin/users/{id}/role)
- Audit log extraction (/api/v1/admin/audit-logs)
- Live system telemetry diagnostics (/api/v1/admin/system-status)
"""

import unittest
import uuid
import os
import sys

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from starlette.testclient import TestClient

from app.main import app
from app.database import SessionLocal
from app.models.user import User
from app.models.workflow import AuditLog
from app.utils.security import get_password_hash, create_access_token


class TestAdminPortal(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.client = TestClient(app)
        cls.db = SessionLocal()

        # Dedicated test users
        cls.admin_user = User(
            id=f"usr-adm-{uuid.uuid4().hex[:6]}",
            email=f"admin_test_{uuid.uuid4().hex[:6]}@test.com",
            full_name="Platform Administrator",
            hashed_password=get_password_hash("AdminPass123!"),
            role="admin",
            department="IT & Platform Administration",
            status="active",
            is_active=True
        )
        cls.commissioner_user = User(
            id=f"usr-com-{uuid.uuid4().hex[:6]}",
            email=f"comm_test_{uuid.uuid4().hex[:6]}@test.com",
            full_name="Commissioner Sharma",
            hashed_password=get_password_hash("CommPass123!"),
            role="commissioner",
            department="Municipal Headquarters",
            status="active",
            is_active=True
        )
        cls.engineer_user = User(
            id=f"usr-eng-{uuid.uuid4().hex[:6]}",
            email=f"eng_test_{uuid.uuid4().hex[:6]}@test.com",
            full_name="Field Eng Anita",
            hashed_password=get_password_hash("EngPass123!"),
            role="engineer",
            department="Roads & Infrastructure",
            status="active",
            is_active=True
        )
        cls.citizen_user = User(
            id=f"usr-cit-{uuid.uuid4().hex[:6]}",
            email=f"cit_test_{uuid.uuid4().hex[:6]}@test.com",
            full_name="Citizen Ramesh",
            hashed_password=get_password_hash("CitPass123!"),
            role="citizen",
            department="Public",
            status="active",
            is_active=True
        )

        cls.db.add_all([cls.admin_user, cls.commissioner_user, cls.engineer_user, cls.citizen_user])
        cls.db.commit()

        # Generate tokens
        cls.admin_token = create_access_token(data={"sub": cls.admin_user.id, "email": cls.admin_user.email, "role": "admin"})
        cls.comm_token = create_access_token(data={"sub": cls.commissioner_user.id, "email": cls.commissioner_user.email, "role": "commissioner"})
        cls.eng_token = create_access_token(data={"sub": cls.engineer_user.id, "email": cls.engineer_user.email, "role": "engineer"})
        cls.cit_token = create_access_token(data={"sub": cls.citizen_user.id, "email": cls.citizen_user.email, "role": "citizen"})

    @classmethod
    def tearDownClass(cls):
        try:
            # Clean up test users created during test runs
            cls.db.query(AuditLog).filter(AuditLog.user_id.in_([cls.admin_user.id, cls.commissioner_user.id])).delete(synchronize_session=False)
            cls.db.query(User).filter(User.id.in_([
                cls.admin_user.id, cls.commissioner_user.id, cls.engineer_user.id, cls.citizen_user.id
            ])).delete(synchronize_session=False)
            cls.db.commit()
        except Exception:
            cls.db.rollback()
        finally:
            cls.db.close()

    def test_01_admin_users_list_rbac(self):
        # Admin access: should succeed (200)
        res_admin = self.client.get(
            "/api/v1/admin/users",
            headers={"Authorization": f"Bearer {self.admin_token}"}
        )
        self.assertEqual(res_admin.status_code, 200)
        data = res_admin.json()
        self.assertIn("users", data)
        self.assertIn("total", data)
        self.assertGreaterEqual(data["total"], 4)

        # Commissioner access: should succeed (200)
        res_comm = self.client.get(
            "/api/v1/admin/users?role=engineer",
            headers={"Authorization": f"Bearer {self.comm_token}"}
        )
        self.assertEqual(res_comm.status_code, 200)
        for u in res_comm.json()["users"]:
            self.assertEqual(u["role"], "engineer")

        # Engineer access: blocked (403)
        res_eng = self.client.get(
            "/api/v1/admin/users",
            headers={"Authorization": f"Bearer {self.eng_token}"}
        )
        self.assertEqual(res_eng.status_code, 403)

        # Citizen access: blocked (403)
        res_cit = self.client.get(
            "/api/v1/admin/users",
            headers={"Authorization": f"Bearer {self.cit_token}"}
        )
        self.assertEqual(res_cit.status_code, 403)

        # Unauthenticated access: blocked (401)
        res_anon = self.client.get("/api/v1/admin/users")
        self.assertEqual(res_anon.status_code, 401)

    def test_02_create_staff_user(self):
        new_email = f"new_staff_{uuid.uuid4().hex[:6]}@civicsense.gov"
        payload = {
            "email": new_email,
            "full_name": "Junior Inspector Vikram",
            "password": "SecurePassword123!",
            "role": "engineer",
            "department": "Water Supply & Sewerage"
        }

        # Admin provisions staff
        res = self.client.post(
            "/api/v1/admin/users",
            json=payload,
            headers={"Authorization": f"Bearer {self.admin_token}"}
        )
        self.assertEqual(res.status_code, 201)
        created = res.json()
        self.assertEqual(created["email"], new_email)
        self.assertEqual(created["role"], "engineer")
        self.assertEqual(created["department"], "Water Supply & Sewerage")
        self.assertTrue(created["is_active"])

        # Clean up created user in DB after test
        self.created_staff_id = created["id"]

        # Duplicate email check: should return 409 Conflict
        res_dup = self.client.post(
            "/api/v1/admin/users",
            json=payload,
            headers={"Authorization": f"Bearer {self.admin_token}"}
        )
        self.assertEqual(res_dup.status_code, 409)

        # Non-admin attempting to create staff: 403 Forbidden
        res_unauth = self.client.post(
            "/api/v1/admin/users",
            json={
                "email": f"hacker_{uuid.uuid4().hex[:6]}@test.com",
                "full_name": "Hacker",
                "password": "Pass",
                "role": "admin"
            },
            headers={"Authorization": f"Bearer {self.citizen_token if hasattr(self, 'citizen_token') else self.cit_token}"}
        )
        self.assertEqual(res_unauth.status_code, 403)

    def test_03_toggle_user_status(self):
        # Admin deactivates test engineer
        res_deactivate = self.client.patch(
            f"/api/v1/admin/users/{self.engineer_user.id}/status",
            json={"is_active": False},
            headers={"Authorization": f"Bearer {self.admin_token}"}
        )
        self.assertEqual(res_deactivate.status_code, 200)
        data = res_deactivate.json()
        self.assertFalse(data["is_active"])
        self.assertEqual(data["status"], "inactive")

        # Admin reactivates test engineer
        res_reactivate = self.client.patch(
            f"/api/v1/admin/users/{self.engineer_user.id}/status",
            json={"is_active": True},
            headers={"Authorization": f"Bearer {self.admin_token}"}
        )
        self.assertEqual(res_reactivate.status_code, 200)
        self.assertTrue(res_reactivate.json()["is_active"])

        # Self-deactivation prevention: Admin cannot deactivate themselves
        res_self = self.client.patch(
            f"/api/v1/admin/users/{self.admin_user.id}/status",
            json={"is_active": False},
            headers={"Authorization": f"Bearer {self.admin_token}"}
        )
        self.assertEqual(res_self.status_code, 400)
        self.assertIn("cannot deactivate their own", res_self.json()["detail"].lower())

    def test_04_update_user_role(self):
        # Admin promotes engineer to commissioner
        res = self.client.patch(
            f"/api/v1/admin/users/{self.engineer_user.id}/role",
            json={"role": "commissioner", "department": "Zonal Governance"},
            headers={"Authorization": f"Bearer {self.admin_token}"}
        )
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertEqual(data["role"], "commissioner")
        self.assertEqual(data["department"], "Zonal Governance")

        # Revert back to engineer
        self.client.patch(
            f"/api/v1/admin/users/{self.engineer_user.id}/role",
            json={"role": "engineer", "department": "Roads & Infrastructure"},
            headers={"Authorization": f"Bearer {self.admin_token}"}
        )

        # Invalid role test
        res_bad_role = self.client.patch(
            f"/api/v1/admin/users/{self.engineer_user.id}/role",
            json={"role": "supergod", "department": "Nowhere"},
            headers={"Authorization": f"Bearer {self.admin_token}"}
        )
        self.assertEqual(res_bad_role.status_code, 400)

        # Citizen attempting to update role: 403 Forbidden
        res_cit = self.client.patch(
            f"/api/v1/admin/users/{self.engineer_user.id}/role",
            json={"role": "admin"},
            headers={"Authorization": f"Bearer {self.cit_token}"}
        )
        self.assertEqual(res_cit.status_code, 403)

    def test_05_platform_audit_logs(self):
        # Admin fetches audit logs: 200 OK
        res_admin = self.client.get(
            "/api/v1/admin/audit-logs?limit=50",
            headers={"Authorization": f"Bearer {self.admin_token}"}
        )
        self.assertEqual(res_admin.status_code, 200)
        data = res_admin.json()
        self.assertIsInstance(data, list)
        self.assertGreaterEqual(len(data), 1)
        self.assertIn("who", data[0])
        self.assertIn("what", data[0])

        # Commissioner fetches audit logs: 200 OK
        res_comm = self.client.get(
            "/api/v1/admin/audit-logs",
            headers={"Authorization": f"Bearer {self.comm_token}"}
        )
        self.assertEqual(res_comm.status_code, 200)
        self.assertIsInstance(res_comm.json(), list)

        # Citizen blocked: 403 Forbidden
        res_cit = self.client.get(
            "/api/v1/admin/audit-logs",
            headers={"Authorization": f"Bearer {self.cit_token}"}
        )
        self.assertEqual(res_cit.status_code, 403)

    def test_06_system_telemetry(self):
        # Admin fetches telemetry: 200 OK
        res = self.client.get(
            "/api/v1/admin/system-status",
            headers={"Authorization": f"Bearer {self.admin_token}"}
        )
        self.assertEqual(res.status_code, 200)
        telemetry = res.json()
        self.assertIn("database", telemetry)
        self.assertIn("ai_engine", telemetry)
        self.assertIn("whatsapp", telemetry)
        self.assertIn("security", telemetry)
        self.assertIn("user_telemetry", telemetry)

        # Verify internal structure
        self.assertIn("status", telemetry["database"])
        self.assertIn("dialect", telemetry["database"])
        self.assertIn("active_chat_engine", telemetry["ai_engine"])
        self.assertIn("environment", telemetry)
        self.assertIn("rate_limit_events_last_24h", telemetry["security"])

        # Citizen blocked: 403 Forbidden
        res_cit = self.client.get(
            "/api/v1/admin/system-status",
            headers={"Authorization": f"Bearer {self.cit_token}"}
        )
        self.assertEqual(res_cit.status_code, 403)

        # Citizen blocked: 403 Forbidden
        res_cit = self.client.get(
            "/api/v1/admin/system-status",
            headers={"Authorization": f"Bearer {self.cit_token}"}
        )
        self.assertEqual(res_cit.status_code, 403)


if __name__ == "__main__":
    unittest.main()
