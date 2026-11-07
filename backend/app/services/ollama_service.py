import os
import json
import base64
import httpx
from typing import Dict, Any, List, Optional
from app.config import settings

class OllamaService:
    """
    Local AI Service communicating with local Ollama daemon (http://localhost:11434).
    Provides 100% private, zero-cloud, low-latency AI inference for CivicSense.
    """

    def __init__(self):
        self.base_url = settings.OLLAMA_BASE_URL.rstrip('/')
        self.default_model = settings.OLLAMA_MODEL
        self.vision_model_preference = settings.OLLAMA_VISION_MODEL
        self.timeout = 45.0

    async def check_connection(self) -> Dict[str, Any]:
        """
        Pings Ollama server and returns health, connection status, and list of installed models.
        """
        try:
            async with httpx.AsyncClient(timeout=4.0) as client:
                res = await client.get(f"{self.base_url}/api/tags")
                if res.status_code == 200:
                    data = res.json()
                    models = [m.get("name", "") for m in data.get("models", [])]
                    
                    # Detect vision models
                    vision_keywords = ["vision", "llava", "moondream", "minicpm", "bakllava"]
                    vision_models = [m for m in models if any(k in m.lower() for k in vision_keywords)]
                    
                    # Determine active text model
                    active_model = self.default_model if self.default_model in models else (models[0] if models else self.default_model)
                    active_vision = vision_models[0] if vision_models else None

                    return {
                        "connected": True,
                        "base_url": self.base_url,
                        "models": models,
                        "active_text_model": active_model,
                        "active_vision_model": active_vision,
                        "has_vision": bool(active_vision),
                    }
        except Exception as e:
            return {
                "connected": False,
                "base_url": self.base_url,
                "error": str(e),
                "models": [],
                "active_text_model": None,
                "active_vision_model": None,
                "has_vision": False,
            }
        return {
            "connected": False,
            "base_url": self.base_url,
            "models": [],
            "active_text_model": None,
            "active_vision_model": None,
            "has_vision": False,
        }

    async def generate_chat_response(
        self,
        query: str,
        system_type: str = "command_os",
        incident_id: Optional[str] = None,
        context_data: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """
        Generates chat / copilot responses using local Ollama model.
        Returns frontend-ready text, suggested actions, and data summary.
        """
        conn = await self.check_connection()
        if not conn.get("connected"):
            raise ConnectionError(f"Ollama server is not reachable at {self.base_url}")

        model_name = conn.get("active_text_model") or self.default_model

        context_prompt = ""
        if context_data:
            # Compact context data for small context window efficiency
            wards_brief = [
                {"id": w.get("id"), "name": w.get("name"), "score": w.get("overallScore"), "openComplaints": w.get("openComplaints")}
                for w in context_data.get("wards", [])[:5]
            ]
            incidents_brief = [
                {"id": inc.get("id"), "title": inc.get("title"), "severity": inc.get("severity"), "ward": inc.get("wardName")}
                for inc in context_data.get("incidents", [])[:5]
            ]
            context_prompt = f"""
LIVE CITY STATE:
Wards: {json.dumps(wards_brief)}
Active Incidents: {json.dumps(incidents_brief)}
"""

        system_instruction = f"""You are AI Command OS, the central local smart city intelligence system for CivicSense.
You are assisting the City Commissioner and Operations Director.
{context_prompt}
Target System Mode: {system_type}
Target Incident Reference: {incident_id or 'General'}

User Query: {query}

INSTRUCTIONS:
1. Answer the query concisely in 2 to 3 sentences based on the city operational data.
2. Provide 2-3 specific suggested actions or follow-up questions.
3. Provide a data_summary object with 2-4 key operational metrics.

Respond STRICTLY in valid JSON matching this schema:
{{
  "reply": "Your concise operational response (max 3 sentences)",
  "suggested_actions": ["Suggested follow-up 1", "Suggested follow-up 2"],
  "data_summary": {{"Metric Name": "Value"}}
}}
"""

        async with httpx.AsyncClient(timeout=self.timeout) as client:
            res = await client.post(
                f"{self.base_url}/api/generate",
                json={
                    "model": model_name,
                    "prompt": system_instruction,
                    "format": "json",
                    "stream": False,
                    "options": {
                        "temperature": 0.3,
                        "num_predict": 300,
                    }
                }
            )

            if res.status_code != 200:
                raise RuntimeError(f"Ollama returned HTTP {res.status_code}: {res.text}")

            res_json = res.json()
            raw_text = res_json.get("response", "").strip()
            result = json.loads(raw_text)

            # Map suggested actions to UI clickable actions
            actions = []
            for action in result.get("suggested_actions", []):
                act_str = str(action)
                payload = "dashboard"
                action_type = "NAVIGATE_TO_TAB"
                
                if any(k in act_str.lower() for k in ["3d", "twin", "spatial", "camera"]):
                    payload = "3d-twin"
                elif any(k in act_str.lower() for k in ["gis", "map", "ward"]):
                    payload = "gis"
                elif any(k in act_str.lower() for k in ["report", "briefing", "pdf"]):
                    payload = "reports"
                elif any(k in act_str.lower() for k in ["crew", "dispatch", "deploy"]):
                    action_type = "DISPATCH_CREW"
                    payload = "auto"

                actions.append({
                    "label": act_str,
                    "actionType": action_type,
                    "payload": payload
                })

            return {
                "text": result.get("reply", "Analysis complete."),
                "actions": actions,
                "dataSummary": result.get("data_summary", {}),
                "model": model_name,
                "provider": "ollama",
            }

    async def analyze_image_vision(self, image_bytes: bytes, filename: str) -> Optional[Dict[str, Any]]:
        """
        Analyzes an evidence image using an Ollama vision model (e.g., moondream, llava, llama3.2-vision).
        Returns structured incident intelligence, or None if no vision model is available.
        """
        conn = await self.check_connection()
        if not conn.get("connected") or not conn.get("active_vision_model"):
            return None

        vision_model = conn.get("active_vision_model")
        b64_image = base64.b64encode(image_bytes).decode('utf-8')

        prompt = """Analyze this municipal infrastructure defect image.
Classify the civic issue and return strictly valid JSON:
{
  "category": "Road Damage, Pothole, Road Crack, Water Main Leak, Sewer Overflow, Garbage Overflow, Broken Streetlight, Drainage Blockage, Fallen Tree, Traffic Signal Failure, or Illegal Dumping",
  "confidence": 92.5,
  "severity": "low, medium, high, or critical",
  "priority": "Low, Medium, High, or Critical",
  "description": "Concise 1-sentence technical description",
  "recommended_department": "Name of municipal department",
  "estimated_repair_time": "e.g. 3.5 Hours",
  "estimated_repair_cost": 25000,
  "public_safety_risk": "Hazard assessment",
  "environmental_impact": "Impact assessment",
  "future_damage_prediction": "48h prediction",
  "ai_recommendation": "Crew dispatch recommendation",
  "executive_summary": "Summary for commissioner",
  "explanation": "Engineering rationale"
}
"""

        try:
            async with httpx.AsyncClient(timeout=60.0) as client:
                res = await client.post(
                    f"{self.base_url}/api/generate",
                    json={
                        "model": vision_model,
                        "prompt": prompt,
                        "images": [b64_image],
                        "format": "json",
                        "stream": False,
                    }
                )

                if res.status_code == 200:
                    raw_text = res.json().get("response", "").strip()
                    parsed = json.loads(raw_text)
                    parsed["ai_engine"] = f"Ollama Local ({vision_model})"
                    return parsed
        except Exception as e:
            print(f"Ollama Vision execution error: {e}")
            return None

        return None

ollama_service = OllamaService()
