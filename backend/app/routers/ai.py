from fastapi import APIRouter, File, UploadFile, Depends
from app.schemas.ai_analysis import AIChatRequest, AIChatResponse
from app.services.ai_service import ai_service

router = APIRouter(prefix="/ai", tags=["AI Intelligence Engine"])

@router.get("/status")
async def ai_status():
    """
    Returns real-time connection status of local Ollama and configured AI engines.
    """
    return await ai_service.get_status()

@router.post("/analyze-image")
async def analyze_image(file: UploadFile = File(...)):
    """
    Triggers Gemini Vision + YOLOv11x Object Detection & XAI Pipeline.
    """
    contents = await file.read()
    res = await ai_service.analyze_image_vision(contents, file.filename)
    return res

@router.post("/chat", response_model=AIChatResponse)
async def ai_chat(payload: AIChatRequest):
    """
    Dual AI Interface (AI Command OS vs Incident Operations Copilot).
    """
    res = await ai_service.generate_chat_response(
        query=payload.query,
        system_type=payload.system,
        incident_id=payload.incident_id
    )
    return res
