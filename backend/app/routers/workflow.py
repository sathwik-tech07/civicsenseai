from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from typing import Optional, List
from pydantic import BaseModel

from app.database import get_db
from app.models.incident import Incident
from app.models.user import User
from app.services.workflow_service import WorkflowService
from app.utils.dependencies import (
    get_current_user,
    require_staff,
    require_admin_or_commissioner,
    can_engineer_access_incident
)

router = APIRouter(prefix="/workflow", tags=["Workflow & Lifecycle Engine"])

class TransitionRequest(BaseModel):
    incident_id: str
    target_stage: str
    actor: Optional[str] = None
    notes: Optional[str] = None
    resolved_photo_url: Optional[str] = None
    assigned_crew: Optional[str] = None
    assigned_engineer_id: Optional[str] = None

@router.post("/transition")
def transition_workflow_stage(
    req: TransitionRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Advances an incident through the 11-Stage Workflow Engine.
    Records Workflow History, Audit Log, and Notification automatically.
    """
    # RBAC: Citizens cannot transition workflow stages
    if current_user.role == "citizen":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied. Citizens cannot transition workflow stages."
        )

    incident = db.query(Incident).filter(Incident.id == req.incident_id).first()
    if not incident:
        raise HTTPException(status_code=404, detail=f"Incident {req.incident_id} not found")
    # RBAC: Engineers can only transition assigned incidents
    elif current_user.role == "engineer":
        if not can_engineer_access_incident(current_user, incident):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied. Engineers can only advance incidents explicitly assigned to them."
            )
        # Engineers cannot assign, reassign, or claim incidents
        if req.assigned_engineer_id is not None:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied. Only commissioners and administrators can assign or reassign engineers."
            )
        if req.assigned_crew is not None:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied. Only commissioners and administrators can modify crew assignments."
            )

    # Security: Bind verified identity from current_user
    verified_actor = f"{current_user.full_name} ({current_user.role.title()})"

    try:
        res = WorkflowService.transition_stage(
            db=db,
            incident_id=req.incident_id,
            target_stage=req.target_stage,
            actor=verified_actor,
            notes=req.notes,
            resolved_photo_url=req.resolved_photo_url,
            assigned_crew=req.assigned_crew,
            assigned_engineer_id=req.assigned_engineer_id
        )
        return res
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.get("/timeline/{incident_id}")
def get_incident_timeline(
    incident_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Gets full 11-Stage live timeline history for an incident.
    """
    incident = db.query(Incident).filter(Incident.id == incident_id).first()
    if not incident:
        raise HTTPException(status_code=404, detail=f"Incident {incident_id} not found")

    if current_user.role == "citizen" and incident.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied. You cannot view timelines of other citizens' incidents."
        )
    elif current_user.role == "engineer" and not can_engineer_access_incident(current_user, incident):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied. Incident is not assigned to you."
        )

    return WorkflowService.get_timeline(db, incident_id)

@router.get("/audit-logs/{incident_id}")
def get_incident_audit_logs(
    incident_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_staff)
):
    """
    Gets audit trail for an incident (Who, What, When, Result).
    Internal operational view restricted to staff (engineers, commissioners, admins).
    """
    return WorkflowService.get_audit_logs(db, incident_id)

class NotificationCreate(BaseModel):
    incident_id: str
    type: str
    title: str
    message: str

@router.get("/notifications")
def get_live_notifications(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Gets unread/recent system notifications.
    """
    return WorkflowService.get_notifications(db)

@router.post("/notifications/create")
def create_notification(
    req: NotificationCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_staff)
):
    """
    Creates a new system notification.
    """
    return WorkflowService.create_notification(db, req.incident_id, req.type, req.title, req.message)

@router.put("/notifications/{notif_id}/read")
def mark_notification_read(
    notif_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Marks a specific notification as read.
    """
    success = WorkflowService.mark_read(db, notif_id)
    return {"status": "success", "read": success}

@router.put("/notifications/read-all")
def mark_all_notifications_read(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Marks all notifications as read.
    """
    WorkflowService.mark_all_read(db)
    return {"status": "success"}
