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

    def test_05_gemini_client_v1beta_initialization(self):
        """Verify get_gemini_client configures api_version='v1beta' in http_options."""
        from unittest.mock import patch
        from app.services.ai_service import get_gemini_client
        with patch("app.services.ai_service.genai.Client") as mock_client_cls:
            mock_client_cls.return_value = "mock_client"
            client, key = get_gemini_client("test_secret_key_12345")
            self.assertEqual(client, "mock_client")
            self.assertEqual(key, "test_secret_key_12345")
            mock_client_cls.assert_called_once()
            _, kwargs = mock_client_cls.call_args
            self.assertEqual(kwargs.get("api_key"), "test_secret_key_12345")
            self.assertEqual(kwargs.get("http_options"), {"api_version": "v1beta"})

    def test_06_gemini_json_response_generation(self):
        """Verify generate_chat_response handles structured JSON output under Gemini."""
        import asyncio
        from unittest.mock import MagicMock, patch
        mock_response = MagicMock()
        mock_response.text = '{"reply": "Central command reports 14 active pothole alerts.", "suggested_actions": ["Review Ward 3", "Dispatch Crew"], "data_summary": {"potholes": 14}}'
        
        mock_client = MagicMock()
        mock_client.models.generate_content.return_value = mock_response

        with patch.object(settings, "LLM_PROVIDER", "gemini"), \
             patch.object(AIService, "_get_gemini_client", return_value=(mock_client, "fake_key")):
            result = asyncio.run(AIService.generate_chat_response("Status check", system_type="command_os"))
            self.assertEqual(result["provider"], "gemini")
            self.assertEqual(result["model"], settings.GEMINI_MODEL)
            self.assertEqual(result["text"], "Central command reports 14 active pothole alerts.")
            self.assertEqual(len(result["actions"]), 2)
            self.assertEqual(result["dataSummary"], {"potholes": 14})
            
            # Verify generate_content called with JSON response mime type
            _, call_kwargs = mock_client.models.generate_content.call_args
            self.assertEqual(call_kwargs.get("model"), settings.GEMINI_MODEL)
            config = call_kwargs.get("config")
            self.assertEqual(config.response_mime_type, "application/json")

    def test_07_gemini_multimodal_vision_request_config(self):
        """Verify analyze_image_vision configures multimodal contents with Part.from_bytes and JSON schema."""
        import asyncio
        from unittest.mock import MagicMock, patch
        # Valid 1x1 PNG
        png_bytes = b'\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01\x08\x06\x00\x00\x00\x1f\x15c4\x00\x00\x00\nIDATx\x9cc\x00\x01\x00\x00\x05\x00\x01\r\n-\xb4\x00\x00\x00\x00IEND\xaeB`\x82'
        
        mock_response = MagicMock()
        mock_response.text = '{"category": "Pothole", "severity": "High", "confidence": 0.94, "description": "Severe pothole in pavement", "recommended_department": "Roads & Infrastructure", "estimated_repair_time": "24 hours", "estimated_repair_cost": 4500.0, "urgency": "Immediate", "safety_hazards": ["Vehicle damage"], "recommended_action": "Asphalt patch", "infrastructure_component": "Road surface"}'
        
        mock_client = MagicMock()
        mock_client.models.generate_content.return_value = mock_response

        with patch.object(settings, "VISION_PROVIDER", "gemini"), \
             patch.object(AIService, "_get_gemini_client", return_value=(mock_client, "fake_key")):
            result = asyncio.run(AIService.analyze_image_vision(png_bytes, "road_defect.png"))
            self.assertEqual(result["category"], "Pothole")
            self.assertEqual(result["severity"], "High")
            self.assertGreaterEqual(result["confidence"], 0.9)
            
            # Verify multimodal call configuration
            _, call_kwargs = mock_client.models.generate_content.call_args
            contents = call_kwargs.get("contents")
            self.assertEqual(len(contents), 2)
            self.assertIn("Municipal Infrastructure Inspection", contents[0])
            config = call_kwargs.get("config")
            self.assertEqual(config.response_mime_type, "application/json")

    def test_08_gemini_api_error_handling_and_redaction(self):
        """Verify API exceptions mask sensitive keys and raise RuntimeError without fabricating results."""
        import asyncio
        from unittest.mock import MagicMock, patch
        secret_key = "AIzaSySecretApiKey999888"
        mock_client = MagicMock()
        mock_client.models.generate_content.side_effect = Exception(f"Quota exceeded for key {secret_key}")

        with patch.object(settings, "LLM_PROVIDER", "gemini"), \
             patch.object(settings, "GEMINI_API_KEY", secret_key), \
             patch.object(AIService, "_get_gemini_client", return_value=(mock_client, secret_key)):
            with self.assertRaises(RuntimeError) as ctx:
                asyncio.run(AIService.generate_chat_response("Hello"))
            err_msg = str(ctx.exception)
            self.assertIn("Gemini LLM generation failed", err_msg)
            self.assertNotIn(secret_key, err_msg)
            self.assertIn("[REDACTED_GEMINI_KEY]", err_msg)


if __name__ == "__main__":
    unittest.main()
