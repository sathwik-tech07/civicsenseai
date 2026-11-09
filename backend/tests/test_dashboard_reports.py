"""
CivicSense AI - Dashboard KPIs & Report Generation Test Suite
Tests:
- GET /api/v1/dashboard/kpis (Admin / Commissioner only)
- GET /api/v1/dashboard/ward-performance (Staff only)
- GET /api/v1/reports/ (Staff only)
- POST /api/v1/reports/generate (Admin / Commissioner only)
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
from app.models.report import Report
from app.database import SessionLocal


class TestDashboardAndReports(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.client = TestClient(app)
        cls.db = SessionLocal()

    @classmethod
    def tearDownClass(cls):
        # Clean up any synthetic test reports
        cls.db.query(Report).filter(Report.id.like("REP-2026-%")).delete(synchronize_session=False)
        cls.db.commit()
        cls.db.close()

    def test_dashboard_kpis_rbac(self):
        """Verify dashboard KPIs are accessible by Commissioner & Admin, but rejected for Citizens."""
        # Unauthenticated rejected
        res = self.client.get("/api/v1/dashboard/kpis")
        self.assertEqual(res.status_code, 401)

        # Citizen rejected (HTTP 403)
        mock_citizen = User(id="usr-cit-1", role="citizen", status="active", is_active=True)
        app.dependency_overrides[get_current_user] = lambda: mock_citizen
        try:
            res = self.client.get("/api/v1/dashboard/kpis", headers={"Authorization": "Bearer mock"})
            self.assertEqual(res.status_code, 403)
        finally:
            app.dependency_overrides.pop(get_current_user, None)

        # Commissioner allowed
        mock_com = User(id="usr-com-1", role="commissioner", status="active", is_active=True)
        app.dependency_overrides[get_current_user] = lambda: mock_com
        try:
            res = self.client.get("/api/v1/dashboard/kpis", headers={"Authorization": "Bearer mock"})
            self.assertEqual(res.status_code, 200)
            data = res.json()
            self.assertIn("city_health_index", data)
            self.assertIn("active_incidents", data)
            self.assertIn("sla_compliance_rate", data)
        finally:
            app.dependency_overrides.pop(get_current_user, None)

    def test_report_generation_lifecycle(self):
        """Verify generating a municipal executive dossier report."""
        mock_admin = User(id="usr-adm-1", full_name="Admin Chief", role="admin", status="active", is_active=True)
        app.dependency_overrides[get_current_user] = lambda: mock_admin
        try:
            # 1. Generate new report
            create_payload = {
                "title": "Q3 Infrastructure Integrity Executive Dossier",
                "report_type": "executive_dossier",
                "content_json": {
                    "ward": "Ward 1",
                    "potholes_repaired": 45,
                    "budget_utilized": 1250000
                }
            }
            res = self.client.post(
                "/api/v1/reports/generate",
                json=create_payload,
                headers={"Authorization": "Bearer mock"}
            )
            self.assertEqual(res.status_code, 201)
            report_data = res.json()
            self.assertTrue(report_data["id"].startswith("REP-2026-"))
            self.assertEqual(report_data["title"], "Q3 Infrastructure Integrity Executive Dossier")

            # 2. Query reports list
            res_list = self.client.get("/api/v1/reports/", headers={"Authorization": "Bearer mock"})
            self.assertEqual(res_list.status_code, 200)
            reports = res_list.json()
            self.assertTrue(any(r["id"] == report_data["id"] for r in reports))
        finally:
            app.dependency_overrides.pop(get_current_user, None)


if __name__ == "__main__":
    unittest.main()
