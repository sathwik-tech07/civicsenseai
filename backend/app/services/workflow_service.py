import datetime
import uuid
from typing import List, Dict, Any, Optional
from sqlalchemy.orm import Session

from app.models.incident import Incident
from app.models.workflow import WorkflowHistory, AuditLog, Notification

LIFECYCLE_STAGES = [
    "reported",
    "ai_analysis",
    "verified",
    "priority_assigned",
    "commissioner_review",
    "crew_assigned",
    "en_route",
    "repair_started",
    "quality_inspection",
    "resolved",
    "citizen_notified",
]

STAGE_DEPARTMENTS = {
    "reported": "Citizen Services Bureau",
    "ai_analysis": "AI Vision & Multimodal Engine",
    "verified": "Municipal Inspection Team",
    "priority_assigned": "XAI Risk Analytics Core",
    "commissioner_review": "Office of the City Commissioner",
    "crew_assigned": "Rapid Response Logistics Dept",
    "en_route": "Field Crew Operations Unit",
    "repair_started": "Civil Infrastructure Engineering",
    "quality_inspection": "Quality Assurance Bureau",
    "resolved": "Public Works & Resolution Taskforce",
    "citizen_notified": "Citizen Experience Portal",
}

class WorkflowService:
    """
    Enterprise 11-Stage Workflow Engine.
    Handles stage transitions, audit log recording, notification generation, and timeline compilation.
    """

    @staticmethod
    def transition_stage(
        db: Session,
        incident_id: str,
        target_stage: str,
        actor: str,
        notes: Optional[str] = None,
        resolved_photo_url: Optional[str] = None,
        assigned_crew: Optional[str] = None
    ) -> Dict[str, Any]:
        incident = db.query(Incident).filter(Incident.id == incident_id).first()
        if not incident:
            raise ValueError(f"Incident {incident_id} not found")

        if target_stage not in LIFECYCLE_STAGES:
            raise ValueError(f"Invalid target stage '{target_stage}'. Must be one of {LIFECYCLE_STAGES}")

        department = STAGE_DEPARTMENTS.get(target_stage, "Municipal Works")

        # Record Workflow History
        last_history = db.query(WorkflowHistory).filter(WorkflowHistory.incident_id == incident_id).order_by(WorkflowHistory.created_at.desc()).first()
        duration = 0
        if last_history and last_history.created_at:
            duration = int((datetime.datetime.utcnow() - last_history.created_at).total_seconds())

        new_history = WorkflowHistory(
            incident_id=incident_id,
            stage=target_stage,
            assigned_user=actor,
            department=department,
            notes=notes or f"Transitioned to {target_stage.replace('_', ' ').title()}",
            duration_seconds=duration,
            created_at=datetime.datetime.utcnow()
        )
        db.add(new_history)

        # Record Audit Log
        audit = AuditLog(
            incident_id=incident_id,
            who=actor,
            what=f"Advanced stage to '{target_stage}'",
            when=datetime.datetime.utcnow(),
            result=f"Success ({department})"
        )
        db.add(audit)

        # Generate Notification
        notif_title, notif_type = WorkflowService._get_notification_meta(target_stage)
        if notif_title:
            notif = Notification(
                id=f"notif_{uuid.uuid4().hex[:10]}",
                incident_id=incident_id,
                type=notif_type,
                title=notif_title,
                message=f"Incident {incident_id} is now in stage '{target_stage.replace('_', ' ').title()}'. Notes: {notes or 'No additional notes'}",
                timestamp=datetime.datetime.utcnow(),
                read=False
            )
            db.add(notif)

        # Update Incident Object
        incident.status = target_stage
        if resolved_photo_url:
            incident.resolved_photo_url = resolved_photo_url
        if assigned_crew:
            incident.assigned_crew = assigned_crew

        db.commit()
        db.refresh(incident)

        return {
            "status": "success",
            "current_stage": target_stage,
            "incident_id": incident_id,
            "actor": actor,
            "department": department
        }

    @staticmethod
    def get_timeline(db: Session, incident_id: str) -> List[Dict[str, Any]]:
        history = db.query(WorkflowHistory).filter(WorkflowHistory.incident_id == incident_id).order_by(WorkflowHistory.created_at.asc()).all()
        incident = db.query(Incident).filter(Incident.id == incident_id).first()

        history_by_stage = {h.stage: h for h in history}
        
        # Build complete 11-stage timeline response
        timeline = []
        is_completed_chain = True

        for idx, stage in enumerate(LIFECYCLE_STAGES):
            h = history_by_stage.get(stage)
            if h:
                timeline.append({
                    "stage": stage,
                    "label": stage.replace("_", " ").title(),
                    "status": "completed" if incident and LIFECYCLE_STAGES.index(incident.status) > idx else "current" if incident and incident.status == stage else "pending",
                    "timestamp": h.created_at.isoformat() + "Z",
                    "assignedUser": h.assigned_user,
                    "department": h.department,
                    "notes": h.notes,
                    "durationSeconds": h.duration_seconds
                })
            else:
                current_idx = LIFECYCLE_STAGES.index(incident.status) if incident else 0
                status = "completed" if current_idx > idx else "current" if current_idx == idx else "pending"
                timeline.append({
                    "stage": stage,
                    "label": stage.replace("_", " ").title(),
                    "status": status,
                    "timestamp": incident.created_at.isoformat() + "Z" if status != "pending" and incident else None,
                    "assignedUser": STAGE_DEPARTMENTS[stage],
                    "department": STAGE_DEPARTMENTS[stage],
                    "notes": f"Pending stage {stage.replace('_', ' ').title()}",
                    "durationSeconds": 0
                })

        return timeline

    @staticmethod
    def get_audit_logs(db: Session, incident_id: str) -> List[Dict[str, Any]]:
        logs = db.query(AuditLog).filter(AuditLog.incident_id == incident_id).order_by(AuditLog.when.desc()).all()
        return [
            {
                "id": log.id,
                "incidentId": log.incident_id,
                "who": log.who,
                "what": log.what,
                "when": log.when.isoformat() + "Z",
                "result": log.result
            }
            for log in logs
        ]

    @staticmethod
    def create_notification(db: Session, incident_id: str, notif_type: str, title: str, message: str) -> Dict[str, Any]:
        notif = Notification(
            id=f"notif_{uuid.uuid4().hex[:10]}",
            incident_id=incident_id,
            type=notif_type,
            title=title,
            message=message,
            timestamp=datetime.datetime.utcnow(),
            read=False
        )
        db.add(notif)
        db.commit()
        db.refresh(notif)
        return {
            "id": notif.id,
            "incidentId": notif.incident_id,
            "type": notif.type,
            "title": notif.title,
            "message": notif.message,
            "timestamp": notif.timestamp.isoformat() + "Z",
            "read": notif.read
        }

    @staticmethod
    def mark_read(db: Session, notif_id: str) -> bool:
        notif = db.query(Notification).filter(Notification.id == notif_id).first()
        if notif:
            notif.read = True
            db.commit()
            return True
        return False

    @staticmethod
    def mark_all_read(db: Session) -> bool:
        db.query(Notification).update({Notification.read: True})
        db.commit()
        return True

    @staticmethod
    def get_notifications(db: Session) -> List[Dict[str, Any]]:
        count = db.query(Notification).count()
        if count == 0:
            # Seed initial notifications for demo
            seed_notifs = [
                ("INC-2026-CRITICAL-01", "INCIDENT_CREATED", "New Critical Water Main Defect Reported", "Ward 4 Kaveri Water Trunk Burst submitted by Citizen Priya Sharma"),
                ("INC-2026-CRITICAL-01", "AI_ANALYSIS_COMPLETE", "AI Vision Multimodal Analysis Complete", "Structural cavity detected with 98% priority score near Victoria Hospital"),
                ("INC-2026-HIGH-02", "CREW_ASSIGNED", "Rapid Crew Alpha-4 Assigned", "Crew Bravo-2 Rapid Response dispatched with Cold Patch Asphalt equipment"),
                ("INC-2026-HIGH-02", "REPAIR_STARTED", "Field Repair Work Underway", "Sub-surface asphalt shear work started in Ward 2 Heritage Commercial Hub"),
                ("INC-2026-MED-03", "PDF_GENERATED", "Official PDF Audit Report Generated", "AI Investigation Report generated for Stormwater Drain Grate Blockage"),
            ]
            for inc_id, ntype, title, msg in seed_notifs:
                db.add(Notification(
                    id=f"notif_{uuid.uuid4().hex[:10]}",
                    incident_id=inc_id,
                    type=ntype,
                    title=title,
                    message=msg,
                    timestamp=datetime.datetime.utcnow() - datetime.timedelta(minutes=30),
                    read=False
                ))
            db.commit()

        notifs = db.query(Notification).order_by(Notification.timestamp.desc()).limit(50).all()
        return [
            {
                "id": n.id,
                "incidentId": n.incident_id,
                "type": n.type,
                "title": n.title,
                "message": n.message,
                "timestamp": n.timestamp.isoformat() + "Z",
                "read": n.read
            }
            for n in notifs
        ]

    @staticmethod
    def _get_notification_meta(stage: str):
        if stage == "ai_analysis":
            return "AI Vision Analysis Complete", "AI_ANALYSIS_COMPLETE"
        elif stage == "crew_assigned":
            return "Rapid Response Crew Dispatched", "CREW_ASSIGNED"
        elif stage == "repair_started":
            return "Field Repair Works Started", "REPAIR_STARTED"
        elif stage == "resolved":
            return "Incident Repair Completed & Verified", "REPAIR_COMPLETED"
        elif stage == "citizen_notified":
            return "Incident Closed & Citizen Notified", "INCIDENT_CLOSED"
        return None, None
