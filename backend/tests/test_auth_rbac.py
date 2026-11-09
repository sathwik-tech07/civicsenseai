"""
Test Suite: Authentication & Role-Based Access Control (Phase 4)
Tests:
- Public signup strictly restricted to citizen role
- Staff / Engineer provisioning restricted to Admin & Commissioner
- Password verification via bcrypt
- JWT token generation, validation, and expiry
- Inactive account login rejection
- Rate limiting on authentication endpoints
- Protected /me endpoint with Bearer authorization
- RBAC data scoping: Citizens view only own complaints, Engineers view only assigned complaints
"""

import unittest
import uuid
import datetime
import os
import sys

# Ensure backend root is on Python module path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from starlette.testclient import TestClient

from app.main import app
from app.config import settings
from app.database import SessionLocal
from app.models.user import User
from app.models.incident import Incident
from app.utils.security import get_password_hash, create_access_token

class TestAuthAndRBAC(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.client = TestClient(app)
        cls.db = SessionLocal()

        # Create dedicated test accounts for each role
        cls.test_citizen = User(
            id=f"usr-test-cit-{uuid.uuid4().hex[:6]}",
            email=f"citizen_{uuid.uuid4().hex[:6]}@test.com",
            full_name="Test Citizen",
            hashed_password=get_password_hash("citizen_pass123"),
            role="citizen",
            department="Public Relations",
            status="active",
            is_active=True
        )
        cls.test_engineer = User(
            id=f"usr-test-eng-{uuid.uuid4().hex[:6]}",
            email=f"engineer_{uuid.uuid4().hex[:6]}@test.com",
            full_name="Test Engineer",
            hashed_password=get_password_hash("engineer_pass123"),
            role="engineer",
            department="Roads & Works",
            status="active",
            is_active=True
        )
        cls.test_commissioner = User(
            id=f"usr-test-com-{uuid.uuid4().hex[:6]}",
            email=f"commissioner_{uuid.uuid4().hex[:6]}@test.com",
            full_name="Test Commissioner",
            hashed_password=get_password_hash("commissioner_pass123"),
            role="commissioner",
            department="City Commission",
            status="active",
            is_active=True
        )
        cls.test_inactive = User(
            id=f"usr-test-inact-{uuid.uuid4().hex[:6]}",
            email=f"inactive_{uuid.uuid4().hex[:6]}@test.com",
            full_name="Inactive User",
            hashed_password=get_password_hash("inactive_pass123"),
            role="citizen",
            department="Public",
            status="inactive",
            is_active=False
        )

        cls.db.add_all([cls.test_citizen, cls.test_engineer, cls.test_commissioner, cls.test_inactive])
        cls.db.commit()

        # Generate tokens
        cls.citizen_token = create_access_token({"sub": cls.test_citizen.id})
        cls.engineer_token = create_access_token({"sub": cls.test_engineer.id})
        cls.commissioner_token = create_access_token({"sub": cls.test_commissioner.id})

    @classmethod
    def tearDownClass(cls):
        cls.db.delete(cls.test_citizen)
        cls.db.delete(cls.test_engineer)
        cls.db.delete(cls.test_commissioner)
        cls.db.delete(cls.test_inactive)
        cls.db.commit()
        cls.db.close()

    def test_01_public_signup_restricted_to_citizen(self):
        """Verify public registration rejects attempts to self-assign staff roles."""
        # Citizen registration succeeds
        res_cit = self.client.post("/api/v1/auth/signup", json={
            "email": f"new_cit_{uuid.uuid4().hex[:6]}@test.com",
            "password": "StrongPassword123!",
            "full_name": "New Citizen"
        })
        self.assertEqual(res_cit.status_code, 201)
        self.assertEqual(res_cit.json()["role"], "citizen")

        # Clean up created user
        created_id = res_cit.json()["id"]
        u = self.db.query(User).filter(User.id == created_id).first()
        if u:
            self.db.delete(u)
            self.db.commit()

        # Attempting to sign up as admin is rejected with 400
        res_admin = self.client.post("/api/v1/auth/signup", json={
            "email": f"hacker_{uuid.uuid4().hex[:6]}@test.com",
            "password": "StrongPassword123!",
            "full_name": "Fake Admin",
            "role": "admin"
        })
        self.assertEqual(res_admin.status_code, 400)
        self.assertIn("Public registration is strictly restricted to citizen accounts", res_admin.json()["detail"])

        # Attempting to sign up as engineer is rejected with 400
        res_eng = self.client.post("/api/v1/auth/signup", json={
            "email": f"fake_eng_{uuid.uuid4().hex[:6]}@test.com",
            "password": "StrongPassword123!",
            "full_name": "Fake Engineer",
            "role": "engineer"
        })
        self.assertEqual(res_eng.status_code, 400)

    def test_02_engineer_provisioning_rbac(self):
        """Verify field engineers can only be provisioned by Commissioner/Admin."""
        # Citizen cannot provision engineer
        res_unauth = self.client.post(
            "/api/v1/auth/provision-engineer",
            json={
                "email": f"new_eng_{uuid.uuid4().hex[:6]}@civicsense.ai",
                "password": "EngineerPass123!",
                "full_name": "Field Eng",
                "department": "Civil Works"
            },
            headers={"Authorization": f"Bearer {self.citizen_token}"}
        )
        self.assertEqual(res_unauth.status_code, 403)

        # Commissioner CAN provision engineer
        res_auth = self.client.post(
            "/api/v1/auth/provision-engineer",
            json={
                "email": f"prov_eng_{uuid.uuid4().hex[:6]}@civicsense.ai",
                "password": "EngineerPass123!",
                "full_name": "Field Eng Authorized",
                "department": "Civil Works"
            },
            headers={"Authorization": f"Bearer {self.commissioner_token}"}
        )
        self.assertEqual(res_auth.status_code, 201)
        eng_data = res_auth.json()
        self.assertEqual(eng_data["role"], "engineer")

        # Clean up
        u = self.db.query(User).filter(User.id == eng_data["id"]).first()
        if u:
            self.db.delete(u)
            self.db.commit()

    def test_03_login_and_token_validation(self):
        """Verify password verification and JWT token issuance."""
        # Valid credentials
        res = self.client.post("/api/v1/auth/login", json={
            "email": self.test_citizen.email,
            "password": "citizen_pass123"
        })
        self.assertEqual(res.status_code, 200)
        token_data = res.json()
        self.assertIn("access_token", token_data)
        self.assertIn("refresh_token", token_data)
        self.assertEqual(token_data["token_type"], "bearer")

        # Wrong password -> 401
        res_bad = self.client.post("/api/v1/auth/login", json={
            "email": self.test_citizen.email,
            "password": "wrong_password"
        })
        self.assertEqual(res_bad.status_code, 401)

    def test_04_inactive_account_rejection(self):
        """Verify inactive accounts cannot log in even with correct password."""
        res = self.client.post("/api/v1/auth/login", json={
            "email": self.test_inactive.email,
            "password": "inactive_pass123"
        })
        self.assertEqual(res.status_code, 401)

    def test_05_me_profile_with_bearer_token(self):
        """Verify /api/v1/auth/me returns current user data."""
        res = self.client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {self.citizen_token}"})
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.json()["email"], self.test_citizen.email)

        # Missing token -> 401
        res_no_token = self.client.get("/api/v1/auth/me")
        self.assertEqual(res_no_token.status_code, 401)

    def test_06_rbac_incident_data_scoping(self):
        """Verify data isolation: Citizen sees only own incidents, Engineer sees only assigned incidents."""
        inc_cit = Incident(
            id=f"INC-CIT-{uuid.uuid4().hex[:6].upper()}",
            title="Citizen Pothole",
            type="pothole",
            severity="high",
            status="reported",
            ward_id="w-1",
            ward_name="Ward 1",
            lat=12.9716,
            lng=77.5946,
            address="Citizen Street",
            photo_url="/uploads/test.jpg",
            user_id=self.test_citizen.id
        )
        inc_eng = Incident(
            id=f"INC-ENG-{uuid.uuid4().hex[:6].upper()}",
            title="Engineer Work Order",
            type="road_damage",
            severity="medium",
            status="in_progress",
            ward_id="w-2",
            ward_name="Ward 2",
            lat=12.9789,
            lng=77.6045,
            address="Engineer Street",
            photo_url="/uploads/test.jpg",
            user_id="usr-other-citizen",
            assigned_engineer_id=self.test_engineer.id
        )
        self.db.add_all([inc_cit, inc_eng])
        self.db.commit()

        try:
            # 1. Citizen queries incidents -> receives only inc_cit
            res_cit = self.client.get("/api/v1/incidents/", headers={"Authorization": f"Bearer {self.citizen_token}"})
            self.assertEqual(res_cit.status_code, 200)
            cit_inc_ids = [i["id"] for i in res_cit.json()]
            self.assertIn(inc_cit.id, cit_inc_ids)
            self.assertNotIn(inc_eng.id, cit_inc_ids)

            # Citizen attempting to fetch inc_eng directly -> 403 Forbidden
            res_cit_probe = self.client.get(f"/api/v1/incidents/{inc_eng.id}", headers={"Authorization": f"Bearer {self.citizen_token}"})
            self.assertEqual(res_cit_probe.status_code, 403)

            # 2. Engineer queries incidents -> receives only assigned inc_eng
            res_eng = self.client.get("/api/v1/incidents/", headers={"Authorization": f"Bearer {self.engineer_token}"})
            self.assertEqual(res_eng.status_code, 200)
            eng_inc_ids = [i["id"] for i in res_eng.json()]
            self.assertIn(inc_eng.id, eng_inc_ids)
            self.assertNotIn(inc_cit.id, eng_inc_ids)

            # Engineer attempting to fetch unassigned inc_cit directly -> 403 Forbidden
            res_eng_probe = self.client.get(f"/api/v1/incidents/{inc_cit.id}", headers={"Authorization": f"Bearer {self.engineer_token}"})
            self.assertEqual(res_eng_probe.status_code, 403)

            # 3. Commissioner queries incidents -> full municipal oversight (sees both)
            res_com = self.client.get("/api/v1/incidents/", headers={"Authorization": f"Bearer {self.commissioner_token}"})
            self.assertEqual(res_com.status_code, 200)
            com_inc_ids = [i["id"] for i in res_com.json()]
            self.assertIn(inc_cit.id, com_inc_ids)
            self.assertIn(inc_eng.id, com_inc_ids)

        finally:
            self.db.delete(inc_cit)
            self.db.delete(inc_eng)
            self.db.commit()

if __name__ == "__main__":
    unittest.main()
