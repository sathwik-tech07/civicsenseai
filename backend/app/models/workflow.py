import datetime
from sqlalchemy import Column, String, Integer, DateTime, ForeignKey, Text, Boolean
from sqlalchemy.orm import relationship
from app.database import Base

class WorkflowHistory(Base):
    __tablename__ = "workflow_history"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    incident_id = Column(String, ForeignKey("incidents.id"), nullable=False, index=True)
    stage = Column(String, nullable=False)  # One of 11 lifecycle stages
    assigned_user = Column(String, nullable=False)
    department = Column(String, nullable=False)
    notes = Column(Text, nullable=True)
    duration_seconds = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    incident_id = Column(String, ForeignKey("incidents.id"), nullable=False, index=True)
    who = Column(String, nullable=False)
    what = Column(String, nullable=False)
    when = Column(DateTime, default=datetime.datetime.utcnow)
    result = Column(String, nullable=False)

class Notification(Base):
    __tablename__ = "notifications"

    id = Column(String, primary_key=True, index=True)
    incident_id = Column(String, ForeignKey("incidents.id"), nullable=False, index=True)
    type = Column(String, nullable=False)  # AI_ANALYSIS_COMPLETE | CREW_ASSIGNED | REPAIR_STARTED | REPAIR_COMPLETED | INCIDENT_CLOSED
    title = Column(String, nullable=False)
    message = Column(Text, nullable=False)
    timestamp = Column(DateTime, default=datetime.datetime.utcnow)
    read = Column(Boolean, default=False)
