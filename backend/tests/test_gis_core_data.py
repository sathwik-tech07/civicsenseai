"""
CivicSense AI - GIS Intelligence & Core Data Test Suite
Tests:
- GET /api/v1/wards (Public municipal directory)
- GET /api/v1/departments (Public municipal departments)
- GET /api/v1/predictive-risks (Staff-only access, rejects unauthenticated & citizen)
- GET /api/v1/citizens (Admin/Commissioner only access, rejects engineers & citizens)
- GET /api/v1/gis/intelligence (Smart city intelligence: nearby infra, weather, traffic, XAI risk)
- GET /api/v1/gis/infrastructure
- GET /api/v1/gis/weather
- GET /api/v1/gis/traffic
"""

import os
import sys
import unittest
from starlette.testclient import TestClient

# Ensure backend root is on Python module path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.main import app
from app.utils.dependencies import get_current_user
from app.models.user import User


class TestGISAndCoreData(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.client = TestClient(app)

    def test_public_wards_and_departments(self):
        """Verify public wards and departments endpoints return valid municipal data."""
        # Wards
        res = self.client.get("/api/v1/wards")
        self.assertEqual(res.status_code, 200)
        wards = res.json()
        self.assertIsInstance(wards, list)
        self.assertGreaterEqual(len(wards), 5)
        self.assertIn("name", wards[0])
        self.assertIn("lat", wards[0])

        # Departments
        res = self.client.get("/api/v1/departments")
        self.assertEqual(res.status_code, 200)
        depts = res.json()
        self.assertIsInstance(depts, list)
        self.assertGreaterEqual(len(depts), 4)

    def test_predictive_risks_rbac(self):
        """Verify predictive risks is restricted to staff roles (commissioner, engineer, admin)."""
        # Unauthenticated request rejected
        res = self.client.get("/api/v1/predictive-risks")
        self.assertEqual(res.status_code, 401)

        # Citizen role rejected (HTTP 403)
        mock_citizen = User(id="usr-cit-1", role="citizen", status="active", is_active=True)
        app.dependency_overrides[get_current_user] = lambda: mock_citizen
        try:
            res = self.client.get("/api/v1/predictive-risks", headers={"Authorization": "Bearer mock"})
            self.assertEqual(res.status_code, 403)
        finally:
            app.dependency_overrides.pop(get_current_user, None)

        # Engineer role allowed (HTTP 200)
        mock_engineer = User(id="usr-eng-1", role="engineer", status="active", is_active=True)
        app.dependency_overrides[get_current_user] = lambda: mock_engineer
        try:
            res = self.client.get("/api/v1/predictive-risks", headers={"Authorization": "Bearer mock"})
            self.assertEqual(res.status_code, 200)
            risks = res.json()
            self.assertIsInstance(risks, list)
            self.assertGreaterEqual(len(risks), 1)
        finally:
            app.dependency_overrides.pop(get_current_user, None)

    def test_citizens_directory_rbac(self):
        """Verify citizens gamification directory is restricted to Admin & Commissioner."""
        # Engineer rejected
        mock_engineer = User(id="usr-eng-1", role="engineer", status="active", is_active=True)
        app.dependency_overrides[get_current_user] = lambda: mock_engineer
        try:
            res = self.client.get("/api/v1/citizens", headers={"Authorization": "Bearer mock"})
            self.assertEqual(res.status_code, 403)
        finally:
            app.dependency_overrides.pop(get_current_user, None)

        # Commissioner allowed
        mock_commissioner = User(id="usr-com-1", role="commissioner", status="active", is_active=True)
        app.dependency_overrides[get_current_user] = lambda: mock_commissioner
        try:
            res = self.client.get("/api/v1/citizens", headers={"Authorization": "Bearer mock"})
            self.assertEqual(res.status_code, 200)
            citizens = res.json()
            self.assertIsInstance(citizens, list)
            self.assertGreaterEqual(len(citizens), 1)
        finally:
            app.dependency_overrides.pop(get_current_user, None)

    def test_gis_intelligence_payload(self):
        """Verify GET /api/v1/gis/intelligence returns weather, traffic, nearby infra, and risk score."""
        mock_user = User(id="usr-test-1", role="citizen", status="active", is_active=True)
        app.dependency_overrides[get_current_user] = lambda: mock_user
        try:
            res = self.client.get(
                "/api/v1/gis/intelligence?lat=12.9716&lng=77.5946&incident_type=pothole&severity=critical",
                headers={"Authorization": "Bearer mock"}
            )
            self.assertEqual(res.status_code, 200)
            data = res.json()
            self.assertIn("infrastructure", data)
            self.assertIn("weather", data)
            self.assertIn("traffic", data)
            self.assertIn("xaiRisk", data)

            # Weather sub-endpoint
            res_weather = self.client.get(
                "/api/v1/gis/weather?lat=12.9716&lng=77.5946",
                headers={"Authorization": "Bearer mock"}
            )
            self.assertEqual(res_weather.status_code, 200)
            self.assertIn("temperature", res_weather.json())

            # Traffic sub-endpoint
            res_traffic = self.client.get(
                "/api/v1/gis/traffic?lat=12.9716&lng=77.5946",
                headers={"Authorization": "Bearer mock"}
            )
            self.assertEqual(res_traffic.status_code, 200)
            self.assertIn("roadCongestionPct", res_traffic.json())
        finally:
            app.dependency_overrides.pop(get_current_user, None)


if __name__ == "__main__":
    unittest.main()
