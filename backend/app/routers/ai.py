from fastapi import APIRouter, File, UploadFile, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.database import get_db
from app.schemas.ai_analysis import AIChatRequest, AIChatResponse
from app.services.ai_service import ai_service
from app.models.user import User
from app.utils.dependencies import get_current_user
from app.utils.image_security import validate_and_read_image_upload, sanitize_filename

router = APIRouter(prefix="/ai", tags=["AI Intelligence Engine"])

@router.get("/status")
async def ai_status():
    """
    Public connection status of local Ollama and configured AI engines.
    """
    return await ai_service.get_status()

@router.post("/analyze-image")
async def analyze_image(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user)
):
    """
    Triggers Gemini Vision Multimodal Pipeline.
    Enforces maximum upload size, validates file magic bytes, and prevents path traversal.
    """
    contents, mime_type, safe_ext = await validate_and_read_image_upload(file)
    safe_filename = sanitize_filename(file.filename)
    try:
        res = await ai_service.analyze_image_vision(contents, safe_filename)
        return res
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except RuntimeError as e:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Unexpected Vision Error: {str(e)}")

@router.post("/chat", response_model=AIChatResponse)
async def ai_chat(
    payload: AIChatRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Dual AI Interface (AI Command OS vs Incident Operations Copilot) using local Ollama.
    """
    try:
        res = await ai_service.generate_chat_response(
            query=payload.query,
            system_type=payload.system,
            incident_id=payload.incident_id,
            db=db,
            current_user=current_user
        )
        return res
    except (ConnectionError, TimeoutError) as e:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except RuntimeError as e:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Unexpected Chat Error: {str(e)}")
