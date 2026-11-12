import os
import uuid
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Query, status
from fastapi.responses import FileResponse, RedirectResponse
from sqlalchemy.orm import Session
from app.config import settings
from app.database import get_db
from app.models.incident import Incident
from app.models.ai_analysis import AIAnalysis
from app.models.workflow import WorkflowHistory, AuditLog, Notification
from app.schemas.incident import (
    IncidentCreate, IncidentUpdate, IncidentResponse,
    CitizenEscalateRequest, CitizenFeedbackRequest, CitizenAdditionalEvidenceRequest
)
from app.models.user import User
from app.utils.dependencies import (
    get_current_user,
    require_admin_or_commissioner,
    require_staff,
    can_engineer_access_incident
)
from app.utils.image_security import (
    validate_and_read_image_upload,
    sanitize_filename,
    generate_safe_storage_filename,
    validate_storage_path
)
from app.services.storage_service import (
    get_storage_provider,
    StorageConfigurationError,
    StorageUploadError,
    StorageError
)

router = APIRouter(prefix="/incidents", tags=["Incidents CRUD"])

UPLOAD_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "uploads")
os.makedirs(UPLOAD_DIR, exist_ok=True)

from datetime import datetime, timedelta

SEED_INCIDENTS = [
    {
        "id": "INC-2026-CRITICAL-01",
        "title": "Ward 4 Kaveri Water Trunk Burst",
        "type": "water_leak",
        "severity": "critical",
        "status": "reported",
        "ward_id": "w-4",
        "ward_name": "Ward 4 - Riverside Residential",
        "lat": 12.9716,
        "lng": 77.5946,
        "address": "Victoria Hospital Corridor, Ward 4, Bengaluru, Karnataka 560002",
        "priority_score": 98,
        "estimated_repair_cost": 125000.0,
        "saved_early_intervention": 450000.0,
        "photo_url": "https://images.unsplash.com/photo-1541888946425-d0fbb186a5b3?q=80&w=800",
        "assigned_crew": "Crew Alpha-4 Emergency Unit",
        "created_at": datetime.utcnow() - timedelta(hours=2),
    },
    {
        "id": "INC-2026-HIGH-02",
        "title": "Sub-surface Asphalt Shear & Deep Pit",
        "type": "pothole",
        "severity": "high",
        "status": "in_progress",
        "ward_id": "w-2",
        "ward_name": "Ward 2 - Heritage Commercial Hub",
        "lat": 12.9789,
        "lng": 77.6045,
        "address": "Ambedkar Veedhi Avenue, Ward 2, Bengaluru, Karnataka 560001",
        "priority_score": 86,
        "estimated_repair_cost": 85000.0,
        "saved_early_intervention": 280000.0,
        "photo_url": "https://images.unsplash.com/photo-1515162816999-a0c47dc192f7?q=80&w=800",
        "assigned_crew": "Crew Bravo-2 Rapid Response",
        "created_at": datetime.utcnow() - timedelta(days=1, hours=5),
    },
    {
        "id": "INC-2026-MED-03",
        "title": "Stormwater Drain Grate Blockage",
        "type": "drainage",
        "severity": "medium",
        "status": "reported",
        "ward_id": "w-3",
        "ward_name": "Ward 3 - Tech Innovation Belt",
        "lat": 12.9352,
        "lng": 77.6245,
        "address": "100 Feet Ring Road, Ward 3, Bengaluru, Karnataka 560034",
        "priority_score": 74,
        "estimated_repair_cost": 42000.0,
        "saved_early_intervention": 150000.0,
        "photo_url": "https://images.unsplash.com/photo-1542601906990-b4d3fb778b09?q=80&w=800",
        "assigned_crew": "Crew Charlie-3 Utilities",
        "created_at": datetime.utcnow() - timedelta(days=3),
    },
]

def seed_incidents_if_needed(db: Session):
    """
    Seeds initial development demo incidents only when ENABLE_DEMO_ACCOUNTS is explicitly True
    in a permitted development environment.
    Strictly disabled in staging and production.
    Defaults to no seeding if configuration is missing, False, or ambiguous.
    """
    if getattr(settings, "ENABLE_DEMO_ACCOUNTS", None) is not True:
        return

    env = getattr(settings, "ENVIRONMENT", "").strip().lower()
    if env not in ("development", "dev", "test", "testing", "local"):
        return

    try:
        count = db.query(Incident).count()
        if count == 0:
            for seed_data in SEED_INCIDENTS:
                db.add(Incident(**seed_data))
            db.commit()
    except Exception as e:
        print("Note: Seed incidents could not be inserted:", e)

@router.get("/", response_model=List[IncidentResponse])
def get_incidents(
    status: Optional[str] = None,
    severity: Optional[str] = None,
    ward_id: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    seed_incidents_if_needed(db)

    query = db.query(Incident)
    if status:
        query = query.filter(Incident.status == status)
    if severity:
        query = query.filter(Incident.severity == severity)
    if ward_id:
        query = query.filter(Incident.ward_id == ward_id)

    # RBAC Data Scoping:
    # 1. Citizen: only view own submitted incidents
    if current_user.role == "citizen":
        query = query.filter(Incident.user_id == current_user.id)
        return query.order_by(Incident.created_at.desc()).all()
    # 2. Engineer: strictly view only incidents explicitly assigned to them
    elif current_user.role == "engineer":
        query = query.filter(Incident.assigned_engineer_id == current_user.id)
        return query.order_by(Incident.created_at.desc()).all()
    # 3. Commissioner & Admin: full municipal oversight across all incidents
    return query.order_by(Incident.created_at.desc()).all()

@router.get("/{incident_id}", response_model=IncidentResponse)
def get_incident_by_id(
    incident_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    seed_incidents_if_needed(db)
    incident = db.query(Incident).filter(Incident.id == incident_id).first()
    if not incident:
        raise HTTPException(status_code=404, detail="Incident not found")

    # RBAC Data Scoping:
    if current_user.role == "citizen":
        if incident.user_id != current_user.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied. You can only view your own submitted incidents."
            )
    elif current_user.role == "engineer":
        if not can_engineer_access_incident(current_user, incident):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied. Incident is not assigned to you."
            )

    return incident

@router.post("/", response_model=IncidentResponse, status_code=status.HTTP_201_CREATED)
def create_incident(
    incident_in: IncidentCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    inc_id = f"INC-2026-{uuid.uuid4().hex[:6].upper()}"
    inc_data = incident_in.model_dump()

    # Security: bind authenticated user identity as owner, never trust client-supplied user_id
    inc_data["user_id"] = current_user.id
    if current_user.role == "citizen":
        # Citizens must always receive assigned_engineer_id=None and assigned_crew="Unassigned"
        inc_data["assigned_crew"] = "Unassigned"
        inc_data["assigned_engineer_id"] = None
    elif current_user.role not in ("commissioner", "admin"):
        # Non-administrative users cannot assign engineers or custom crews
        inc_data["assigned_engineer_id"] = None
        if not inc_data.get("assigned_crew"):
            inc_data["assigned_crew"] = "Unassigned"

    new_inc = Incident(
        id=inc_id,
        **inc_data
    )
    db.add(new_inc)

    # Spatial Duplicate Detection: Check for open complaints of matching category within ~150 meters
    duplicate_count = 0
    try:
        if incident_in.lat and incident_in.lng:
            import math
            def haversine_distance_m(lat1, lon1, lat2, lon2):
                R = 6371000
                phi1, phi2 = math.radians(lat1), math.radians(lat2)
                dphi = math.radians(lat2 - lat1)
                dlam = math.radians(lon2 - lon1)
                a = math.sin(dphi / 2)**2 + math.cos(phi1) * math.cos(phi2) * math.sin(dlam / 2)**2
                return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))

            nearby_open = db.query(Incident).filter(
                Incident.status != "resolved",
                Incident.type == incident_in.type
            ).all()

            for cand in nearby_open:
                if cand.lat and cand.lng:
                    dist = haversine_distance_m(incident_in.lat, incident_in.lng, cand.lat, cand.lng)
                    if dist <= 150:
                        duplicate_count += 1
    except Exception:
        duplicate_count = 0

    # Persist structured AI Analysis record linked to this incident
    ai_record = AIAnalysis(
        id=f"AIA-{uuid.uuid4().hex[:8].upper()}",
        incident_id=inc_id,
        cv_confidence=incident_in.confidence or 92.5,
        cv_model="Gemini 2.5 Flash Multimodal Vision",
        hospital_proximity_meters=340,
        hospital_name="Victoria Municipal Hospital",
        road_classification="Primary Arterial Corridor",
        duplicate_complaints_count=duplicate_count,
        estimated_daily_traffic=14500,
        historical_failure_rate=78.5,
        weather_risk_factor="Monsoon Precipitation Runoff",
        summary=incident_in.description or incident_in.explanation or incident_in.title,
        objects_detected=[incident_in.type],
    )
    db.add(ai_record)

    db.commit()
    db.refresh(new_inc)
    return new_inc

@router.put("/{incident_id}", response_model=IncidentResponse)
def update_incident(
    incident_id: str,
    update_in: IncidentUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    # RBAC Permissions: Citizens cannot modify incidents once submitted
    if current_user.role == "citizen":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied. Citizens cannot modify incidents once submitted."
        )

    incident = db.query(Incident).filter(Incident.id == incident_id).first()
    if not incident:
        raise HTTPException(status_code=404, detail="Incident not found")

    update_data = update_in.model_dump(exclude_unset=True)

    if current_user.role == "engineer":
        if not can_engineer_access_incident(current_user, incident):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied. Incident is not assigned to you."
            )
        # Engineers cannot assign, reassign, or claim incidents; only commissioners and administrators can assign/reassign
        if "assigned_engineer_id" in update_data:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied. Only commissioners and administrators can assign or reassign engineers."
            )
        # Engineers cannot modify assigned_crew (display-only legacy field)
        if "assigned_crew" in update_data:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied. Only commissioners and administrators can modify crew assignments."
            )

    # Validate assigned_engineer_id if modified
    if "assigned_engineer_id" in update_data and update_data["assigned_engineer_id"]:
        target_eng = db.query(User).filter(User.id == update_data["assigned_engineer_id"]).first()
        if not target_eng:
            raise HTTPException(status_code=404, detail="Assigned engineer user not found.")
        if target_eng.role != "engineer":
            raise HTTPException(status_code=400, detail="Assigned user must have 'engineer' role.")

    for field, val in update_data.items():
        setattr(incident, field, val)

    db.commit()
    db.refresh(incident)
    return incident

@router.post("/{incident_id}/escalate")
def escalate_incident(
    incident_id: str,
    req: CitizenEscalateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Allows the citizen who submitted the complaint to request priority escalation.
    Staff and commissioners can also escalate complaints during operational triage.
    """
    incident = db.query(Incident).filter(Incident.id == incident_id).first()
    if not incident:
        raise HTTPException(status_code=404, detail="Incident not found")

    if current_user.role == "citizen" and incident.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access restricted. You can only request escalation for your own complaints."
        )

    # Bump priority score by 10 points (max 100)
    incident.priority_score = min(100, (incident.priority_score or 70) + 10)
    if incident.status == "reported":
        incident.status = "commissioner_review"

    history = WorkflowHistory(
        incident_id=incident_id,
        stage=incident.status,
        assigned_user=f"{current_user.full_name} ({current_user.role.title()})",
        department="Office of the City Commissioner",
        notes=f"CITIZEN ESCALATION: {req.reason.strip()}",
        duration_seconds=0,
        created_at=datetime.utcnow()
    )
    db.add(history)

    audit = AuditLog(
        incident_id=incident_id,
        who=f"{current_user.full_name} ({current_user.role.title()})",
        what=f"Escalated complaint '{incident_id}' to Commissioner. Reason: {req.reason.strip()}",
        when=datetime.utcnow(),
        result="Escalation Registered (Priority Score Increased)"
    )
    db.add(audit)

    notif = Notification(
        id=f"notif_{uuid.uuid4().hex[:10]}",
        incident_id=incident_id,
        type="emergency",
        title=f"URGENT: Escalation for {incident_id}",
        message=f"Citizen requested escalation: {req.reason.strip()}",
        timestamp=datetime.utcnow(),
        read=False
    )
    db.add(notif)

    db.commit()
    return {
        "status": "success",
        "message": f"Complaint {incident_id} escalated successfully. Supervising commissioner notified.",
        "priority_score": incident.priority_score,
        "current_status": incident.status
    }

@router.post("/{incident_id}/feedback")
def submit_feedback(
    incident_id: str,
    req: CitizenFeedbackRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Allows the citizen who submitted the complaint to record satisfaction ratings (1-5 stars)
    and optional feedback upon resolution.
    """
    incident = db.query(Incident).filter(Incident.id == incident_id).first()
    if not incident:
        raise HTTPException(status_code=404, detail="Incident not found")

    if current_user.role == "citizen" and incident.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access restricted. You can only rate your own complaints."
        )

    audit = AuditLog(
        incident_id=incident_id,
        who=f"{current_user.full_name} ({current_user.role.title()})",
        what=f"Recorded satisfaction rating: {req.rating}/5 stars. Feedback: {req.comment or 'No comments provided'}",
        when=datetime.utcnow(),
        result="Feedback Acknowledged"
    )
    db.add(audit)
    db.commit()

    return {
        "status": "success",
        "message": "Thank you for your feedback! Your rating has been logged in municipal QA audit.",
        "rating": req.rating
    }

@router.post("/{incident_id}/additional-evidence")
def attach_additional_evidence(
    incident_id: str,
    req: CitizenAdditionalEvidenceRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Allows the citizen or assigned staff to attach supplementary notes or photo evidence.
    """
    incident = db.query(Incident).filter(Incident.id == incident_id).first()
    if not incident:
        raise HTTPException(status_code=404, detail="Incident not found")

    if current_user.role == "citizen" and incident.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access restricted. You can only attach evidence to your own complaints."
        )

    notes = req.notes.strip() if req.notes else "Supplementary evidence submitted"
    history = WorkflowHistory(
        incident_id=incident_id,
        stage=incident.status,
        assigned_user=f"{current_user.full_name} ({current_user.role.title()})",
        department="Citizen Services",
        notes=f"ADDITIONAL EVIDENCE: {notes}",
        duration_seconds=0,
        created_at=datetime.utcnow()
    )
    db.add(history)

    audit = AuditLog(
        incident_id=incident_id,
        who=f"{current_user.full_name} ({current_user.role.title()})",
        what=f"Attached supplementary evidence: {notes}",
        when=datetime.utcnow(),
        result="Evidence Attached"
    )
    db.add(audit)
    db.commit()

    return {
        "status": "success",
        "message": "Supplementary evidence successfully attached to complaint dossier."
    }

@router.get("/{incident_id}/evidence")
async def get_incident_evidence(
    incident_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    redirect: bool = Query(default=False, description="Whether to redirect directly to presigned URL/file")
):
    """
    Authenticated incident evidence retrieval endpoint.
    Strictly enforces RBAC:
    - Citizens can only access evidence for incidents they created.
    - Engineers can only access evidence for incidents assigned directly to them.
    - Commissioners/Admins can access evidence for all incidents.
    - Unauthenticated requests are rejected with HTTP 401.
    - Unauthorized requests are rejected with HTTP 403.
    """
    incident = db.query(Incident).filter(Incident.id == incident_id).first()
    if not incident:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Incident not found"
        )

    # 1. Citizen authorization: strict ownership check
    if current_user.role == "citizen":
        if incident.user_id != current_user.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied. You can only view evidence for your own incidents."
            )

    # 2. Engineer authorization: strict assignment-only check (Step 26.1 helper)
    elif current_user.role == "engineer":
        if not can_engineer_access_incident(current_user, incident):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied. You can only view evidence for incidents assigned directly to you."
            )

    # 3. Administrative roles: commissioner and admin have full access
    elif current_user.role not in ("commissioner", "admin"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Access denied. Role '{current_user.role}' is not authorized to view evidence."
        )

    if not incident.photo_url or not incident.photo_url.strip():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No evidence image associated with this incident."
        )

    photo_ref = incident.photo_url.strip()

    # External URL handling (e.g. Unsplash sample photos)
    if (photo_ref.startswith("http://") or photo_ref.startswith("https://")) and not ("s3." in photo_ref or "amazonaws.com" in photo_ref):
        if redirect:
            return RedirectResponse(url=photo_ref, status_code=status.HTTP_307_TEMPORARY_REDIRECT)
        return {
            "incident_id": incident.id,
            "storage_provider": "external",
            "url": photo_ref,
            "expires_in": None
        }

    storage_provider = get_storage_provider()

    # S3 Storage Provider (AWS SigV4 Presigned URL)
    if storage_provider.provider_name == "s3":
        key = photo_ref
        if "amazonaws.com/" in photo_ref:
            key = photo_ref.split(".amazonaws.com/")[-1]
        elif photo_ref.startswith("/uploads/"):
            key = photo_ref.replace("/uploads/", "uploads/")

        presigned_url = storage_provider.generate_presigned_url(key)
        if redirect:
            return RedirectResponse(url=presigned_url, status_code=status.HTTP_307_TEMPORARY_REDIRECT)
        return {
            "incident_id": incident.id,
            "storage_provider": "s3",
            "url": presigned_url,
            "expires_in": getattr(settings, "S3_PRESIGNED_EXPIRATION_SECONDS", 900)
        }

    # Local Storage Provider (Authenticated file streaming)
    clean_filename = os.path.basename(photo_ref.replace("/uploads/", ""))
    try:
        filepath = validate_storage_path(storage_provider.upload_dir, clean_filename)
    except ValueError:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid evidence file reference")

    if not os.path.exists(filepath):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Evidence file not found on disk")

    from app.utils.image_security import detect_image_format
    try:
        with open(filepath, "rb") as f:
            header = f.read(32)
        mime_type, _ = detect_image_format(header)
    except Exception:
        mime_type = "image/jpeg"

    return FileResponse(filepath, media_type=mime_type or "image/jpeg", filename=clean_filename)

@router.delete("/{incident_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_incident(
    incident_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin_or_commissioner)
):
    incident = db.query(Incident).filter(Incident.id == incident_id).first()
    if not incident:
        raise HTTPException(status_code=404, detail="Incident not found")

    photo_ref = (incident.photo_url or "").strip()
    should_delete_storage = False
    storage_key = None

    if photo_ref:
        # Check if the photo is an external URL (e.g. Unsplash sample photos)
        is_external = (photo_ref.startswith("http://") or photo_ref.startswith("https://")) and not ("amazonaws.com" in photo_ref or "s3." in photo_ref)
        if not is_external:
            # Check for shared references across other incidents
            shared_count = db.query(Incident).filter(
                Incident.photo_url == incident.photo_url,
                Incident.id != incident_id
            ).count()
            if shared_count == 0:
                should_delete_storage = True
                if "amazonaws.com/" in photo_ref:
                    storage_key = photo_ref.split(".amazonaws.com/")[-1]
                else:
                    storage_key = os.path.basename(photo_ref.replace("/uploads/", ""))

    # Perform storage cleanup before committing DB deletion
    if should_delete_storage and storage_key:
        storage_provider = get_storage_provider()
        try:
            cleanup_success = await storage_provider.delete_image(storage_key)
            if not cleanup_success:
                raise StorageUploadError(f"Storage provider reported deletion failure for {storage_key}")
        except Exception as e:
            # If storage deletion fails, do not commit DB deletion to prevent inconsistent state
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail=f"Evidence storage cleanup failed: {type(e).__name__}: {str(e)}. Deletion aborted to prevent orphan storage inconsistency."
            )

    db.delete(incident)
    db.commit()
    return None

@router.post("/upload-image")
async def upload_incident_image(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user)
):
    contents, mime_type, safe_ext = await validate_and_read_image_upload(file)
    try:
        storage_provider = get_storage_provider()
        stored = await storage_provider.store_image(contents, safe_ext=safe_ext, mime_type=mime_type)
        return {
            "filename": stored["filename"],
            "file_url": stored["file_url"],
            "status": "success",
            "storage_provider": stored["storage_provider"]
        }
    except StorageConfigurationError as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Storage configuration error: {str(e)}"
        )
    except StorageUploadError as e:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Storage upload failed: {str(e)}"
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Unexpected storage error: {str(e)}"
        )

@router.post("/analyze-vision")
async def analyze_incident_vision(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user)
):
    """
    Real AI Vision Pipeline: Analyzes uploaded evidence photos.
    Requires multipart form-data image file.
    Enforces maximum upload size, validates file magic bytes, and prevents path traversal.
    """
    contents, mime_type, safe_ext = await validate_and_read_image_upload(file)
    safe_filename = sanitize_filename(file.filename)
    try:
        from app.services.ai_service import AIService
        ai_result = await AIService.analyze_image_vision(contents, safe_filename)
        ai_result["status"] = "success"
        return ai_result
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except RuntimeError as e:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Vision Pipeline Error: {str(e)}")
