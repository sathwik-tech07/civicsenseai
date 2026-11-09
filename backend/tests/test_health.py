"""
Test Suite: Health Check & System Status (Phase 3)
Tests:
- GET /health returns 200 with database: connected
- GET /api/v1/health returns 200 with database: connected
- Health check detects database disconnection and returns 503
"""

import unittest
import os
import sys

# Ensure backend root is on Python module path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from starlette.testclient import TestClient
from unittest.mock import patch
from sqlalchemy.exc import OperationalError

from app.main import app

class TestHealthEndpoints(unittest.TestCase):
    def setUp(self):
        self.client = TestClient(app)

    def test_health_root_returns_healthy(self):
        res = self.client.get("/health")
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertEqual(data["status"], "healthy")
        self.assertEqual(data["database"], "connected")
        self.assertIn("version", data)

    def test_health_api_v1_returns_healthy(self):
        res = self.client.get("/api/v1/health")
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertEqual(data["status"], "healthy")
        self.assertEqual(data["database"], "connected")

    def test_health_database_failure_returns_503(self):
        with patch("app.main.engine.connect", side_effect=OperationalError("Connection failed", None, None)):
            with patch("sqlalchemy.orm.Session.execute", side_effect=OperationalError("Connection failed", None, None)):
                res = self.client.get("/health")
                self.assertEqual(res.status_code, 503)
                data = res.json()
                self.assertEqual(data["status"], "unhealthy")
                self.assertEqual(data["database"], "disconnected")

if __name__ == "__main__":
    unittest.main()
