from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from typing import Optional, List
from pydantic import BaseModel

from app.database import get_db
from app.services.workflow_service import WorkflowService

router = APIRouter(prefix="/workflow", tags=["Workflow & Lifecycle Engine"])

class TransitionRequest(BaseModel):
    incident_id: str
    target_stage: str
    actor: str
    notes: Optional[str] = None
    resolved_photo_url: Optional[str] = None
    assigned_crew: Optional[str] = None

@router.post("/transition")
def transition_workflow_stage(req: TransitionRequest, db: Session = Depends(get_db)):
    """
    Advances an incident through the 11-Stage Workflow Engine.
    Records Workflow History, Audit Log, and Notification automatically.
    """
    try:
        res = WorkflowService.transition_stage(
            db=db,
            incident_id=req.incident_id,
            target_stage=req.target_stage,
            actor=req.actor,
            notes=req.notes,
            resolved_photo_url=req.resolved_photo_url,
            assigned_crew=req.assigned_crew
        )
        return res
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.get("/timeline/{incident_id}")
def get_incident_timeline(incident_id: str, db: Session = Depends(get_db)):
    """
    Gets full 11-Stage live timeline history for an incident.
    """
    return WorkflowService.get_timeline(db, incident_id)

@router.get("/audit-logs/{incident_id}")
def get_incident_audit_logs(incident_id: str, db: Session = Depends(get_db)):
    """
    Gets audit trail for an incident (Who, What, When, Result).
    """
    return WorkflowService.get_audit_logs(db, incident_id)

class NotificationCreate(BaseModel):
    incident_id: str
    type: str
    title: str
    message: str

@router.get("/notifications")
def get_live_notifications(db: Session = Depends(get_db)):
    """
    Gets unread/recent system notifications.
    """
    return WorkflowService.get_notifications(db)

@router.post("/notifications/create")
def create_notification(req: NotificationCreate, db: Session = Depends(get_db)):
    """
    Creates a new system notification.
    """
    return WorkflowService.create_notification(db, req.incident_id, req.type, req.title, req.message)

@router.put("/notifications/{notif_id}/read")
def mark_notification_read(notif_id: str, db: Session = Depends(get_db)):
    """
    Marks a specific notification as read.
    """
    success = WorkflowService.mark_read(db, notif_id)
    return {"status": "success", "read": success}

@router.put("/notifications/read-all")
def mark_all_notifications_read(db: Session = Depends(get_db)):
    """
    Marks all notifications as read.
    """
    WorkflowService.mark_all_read(db)
    return {"status": "success"}
