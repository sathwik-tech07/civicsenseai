import os
import uuid
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Query, status
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.incident import Incident
from app.schemas.incident import IncidentCreate, IncidentUpdate, IncidentResponse

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

@router.get("/", response_model=List[IncidentResponse])
def get_incidents(
    status: Optional[str] = None,
    severity: Optional[str] = None,
    ward_id: Optional[str] = None,
    db: Session = Depends(get_db)
):
    # Auto-seed database if empty
    count = db.query(Incident).count()
    if count == 0:
        for seed_data in SEED_INCIDENTS:
            db.add(Incident(**seed_data))
        db.commit()

    query = db.query(Incident)
    if status:
        query = query.filter(Incident.status == status)
    if severity:
        query = query.filter(Incident.severity == severity)
    if ward_id:
        query = query.filter(Incident.ward_id == ward_id)
    return query.order_by(Incident.created_at.desc()).all()

@router.get("/{incident_id}", response_model=IncidentResponse)
def get_incident_by_id(incident_id: str, db: Session = Depends(get_db)):
    incident = db.query(Incident).filter(Incident.id == incident_id).first()
    if not incident:
        raise HTTPException(status_code=404, detail="Incident not found")
    return incident

@router.post("/", response_model=IncidentResponse, status_code=status.HTTP_201_CREATED)
def create_incident(incident_in: IncidentCreate, db: Session = Depends(get_db)):
    inc_id = f"INC-2026-{uuid.uuid4().hex[:6].upper()}"
    new_inc = Incident(
        id=inc_id,
        **incident_in.model_dump()
    )
    db.add(new_inc)
    db.commit()
    db.refresh(new_inc)
    return new_inc

@router.put("/{incident_id}", response_model=IncidentResponse)
def update_incident(incident_id: str, update_in: IncidentUpdate, db: Session = Depends(get_db)):
    incident = db.query(Incident).filter(Incident.id == incident_id).first()
    if not incident:
        raise HTTPException(status_code=404, detail="Incident not found")

    update_data = update_in.model_dump(exclude_unset=True)
    for field, val in update_data.items():
        setattr(incident, field, val)

    db.commit()
    db.refresh(incident)
    return incident

@router.delete("/{incident_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_incident(incident_id: str, db: Session = Depends(get_db)):
    incident = db.query(Incident).filter(Incident.id == incident_id).first()
    if not incident:
        raise HTTPException(status_code=404, detail="Incident not found")
    db.delete(incident)
    db.commit()
    return None

@router.post("/upload-image")
async def upload_incident_image(file: UploadFile = File(...)):
    ext = file.filename.split(".")[-1] if "." in file.filename else "jpg"
    filename = f"img_{uuid.uuid4().hex[:12]}.{ext}"
    filepath = os.path.join(UPLOAD_DIR, filename)

    with open(filepath, "wb") as f:
        contents = await file.read()
        f.write(contents)

    return {"filename": filename, "file_url": f"/uploads/{filename}", "status": "success"}

@router.post("/analyze-vision")
async def analyze_incident_vision(
    file: UploadFile = File(...)
):
    """
    Real AI Vision Pipeline: Analyzes uploaded evidence photos.
    Requires multipart form-data image file.
    """
    image_bytes = await file.read()

    from app.services.ai_service import AIService
    ai_result = await AIService.analyze_image_vision(image_bytes, file.filename)
    
    ai_result["status"] = "success"
    return ai_result
