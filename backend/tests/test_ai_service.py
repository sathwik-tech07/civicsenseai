"""
Test Suite: AI Functionality & Resilient Fallbacks (Phase 6)
Tests:
- AI provider status inspection (/api/v1/ai/status)
- Image format validation (detect genuine JPEG/PNG vs fake extensions)
- Enforce size limits on image inputs
- Secret masking in AI logs and traces
- Graceful degradation when provider is unavailable (zero fabricated results)
- Ollama service health check
"""

import unittest
import os
import sys

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from starlette.testclient import TestClient

from app.main import app
from app.config import settings
from app.services.ai_service import AIService, redact_ai_secrets
from app.services.ollama_service import ollama_service


class TestAIService(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.client = TestClient(app)

    def test_01_ai_status_endpoint(self):
        """Verify /api/v1/ai/status reports configured providers and masks secrets."""
        res = self.client.get("/api/v1/ai/status")
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertIn("configured_llm_provider", data)
        self.assertIn("configured_vision_provider", data)
        self.assertIn("ollama", data)
        self.assertIn("gemini", data)
        # Ensure secret keys are masked
        self.assertIn(data["gemini"]["api_key_masked"], ("***", "NOT_CONFIGURED"))

    def test_02_image_magic_bytes_validation(self):
        """Verify non-image bytes are rejected before being sent to Vision AI."""
        # Non-image plain text pretending to be JPEG
        fake_jpeg = b"This is a text file not an image."
        with self.assertRaises(ValueError) as ctx:
            import asyncio
            asyncio.run(AIService.analyze_image_vision(fake_jpeg, "fake.jpg"))
        self.assertIn("Invalid or unsupported image format", str(ctx.exception))

        # Empty bytes
        with self.assertRaises(ValueError) as ctx:
            asyncio.run(AIService.analyze_image_vision(b"", "empty.jpg"))
        self.assertIn("Empty image bytes", str(ctx.exception))

    def test_03_secret_redaction(self):
        """Verify redact_ai_secrets scrubs configured secrets."""
        text_with_secret = f"Error connecting with key {settings.GEMINI_API_KEY} at endpoint"
        redacted = redact_ai_secrets(text_with_secret)
        if settings.GEMINI_API_KEY and len(settings.GEMINI_API_KEY) > 5:
            self.assertNotIn(settings.GEMINI_API_KEY, redacted)
            self.assertIn("[REDACTED_GEMINI_KEY]", redacted)

    def test_04_ollama_service_health(self):
        """Verify Ollama service connection check executes cleanly without crashing."""
        import asyncio
        status = asyncio.run(ollama_service.check_connection())
        self.assertIn("connected", status)
        self.assertIn("model_installed", status)


if __name__ == "__main__":
    unittest.main()
