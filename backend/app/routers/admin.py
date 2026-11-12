"""
CivicSense AI - Administrator Control Center Router
Endpoints:
- GET /api/v1/admin/users: Directory of all municipal users with pagination & role filtering
- POST /api/v1/admin/users: Administrative staff account provisioning (engineer, commissioner, admin)
- PATCH /api/v1/admin/users/{user_id}/status: Account activation / deactivation toggle
- PATCH /api/v1/admin/users/{user_id}/role: Role and department assignment
- GET /api/v1/admin/audit-logs: Comprehensive platform audit trail from AuditLog table
- GET /api/v1/admin/system-status: Real-time operational telemetry (DB, AI, WhatsApp, Rate limits)
"""

import uuid
import datetime
import time
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, EmailStr, Field
from sqlalchemy.orm import Session
from sqlalchemy import text, func

from app.database import get_db
from app.config import settings
from app.models.user import User
from app.models.workflow import AuditLog
from app.models.rate_limit import RateLimitEvent
from app.schemas.user import StaffUserCreate, UserResponse, UserData
from app.utils.security import get_password_hash
from app.utils.dependencies import require_roles, require_admin_or_commissioner
from app.services.ai_service import ai_service

router = APIRouter(prefix="/admin", tags=["Administrator Control Center"])

# Restrict router access to Administrator role
require_admin = require_roles("admin")


class UserStatusUpdate(BaseModel):
    is_active: bool

class UserRoleUpdate(BaseModel):
    role: str = Field(..., description="Role to assign: citizen, engineer, commissioner, admin")
    department: Optional[str] = None


@router.get("/users")
def list_users(
    role: Optional[str] = Query(None, description="Filter by role: citizen, engineer, commissioner, admin"),
    search: Optional[str] = Query(None, description="Search by name or email"),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin_or_commissioner)
):
    """
    Retrieves directory of platform accounts. Restricted to Administrator and Commissioner roles.
    """
    query = db.query(User)
    if role and role.strip().lower() != "all":
        query = query.filter(User.role == role.strip().lower())
    if search and search.strip():
        term = f"%{search.strip()}%"
        query = query.filter((User.full_name.ilike(term)) | (User.email.ilike(term)))

    total = query.count()
    users = query.order_by(User.created_at.desc()).offset(skip).limit(limit).all()

    return {
        "total": total,
        "skip": skip,
        "limit": limit,
        "users": [
            {
                "id": u.id,
                "email": u.email,
                "full_name": u.full_name,
                "role": u.role,
                "department": u.department,
                "status": u.status or ("active" if u.is_active else "inactive"),
                "is_active": u.is_active,
                "created_at": u.created_at,
                "updated_at": u.updated_at
            }
            for u in users
        ]
    }


@router.post("/users", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
def create_staff_user(
    staff_in: StaffUserCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin)
):
    """
    Administratively creates a verified staff account with specified role.
    Records creation in the immutable system audit trail.
    """
    existing = db.query(User).filter(User.email.ilike(staff_in.email.strip())).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="An account with this email address is already registered."
        )

    new_user = User(
        id=f"usr-{uuid.uuid4().hex[:8]}",
        email=staff_in.email.strip(),
        full_name=staff_in.full_name.strip(),
        hashed_password=get_password_hash(staff_in.password),
        role=staff_in.role.strip().lower(),
        department=staff_in.department.strip(),
        status="active",
        is_active=True,
        created_at=datetime.datetime.utcnow(),
        updated_at=datetime.datetime.utcnow()
    )
    db.add(new_user)

    audit = AuditLog(
        incident_id="SYSTEM-ADMIN",
        who=f"{current_user.full_name} (Administrator)",
        what=f"Created staff account: {new_user.email} with role '{new_user.role}' in '{new_user.department}'",
        when=datetime.datetime.utcnow(),
        result=f"Success ({new_user.id})"
    )
    db.add(audit)

    db.commit()
    db.refresh(new_user)
    return new_user


@router.patch("/users/{user_id}/status")
def update_user_status(
    user_id: str,
    status_in: UserStatusUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin)
):
    """
    Activates or deactivates an account.
    Self-deactivation by the currently authenticated administrator is rejected.
    """
    if current_user.id == user_id and not status_in.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Administrators cannot deactivate their own active account."
        )

    target_user = db.query(User).filter(User.id == user_id).first()
    if not target_user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"User {user_id} not found."
        )

    old_status = target_user.is_active
    target_user.is_active = status_in.is_active
    target_user.status = "active" if status_in.is_active else "inactive"
    target_user.updated_at = datetime.datetime.utcnow()

    action_label = "Activated" if status_in.is_active else "Deactivated"
    audit = AuditLog(
        incident_id="SYSTEM-ADMIN",
        who=f"{current_user.full_name} (Administrator)",
        what=f"{action_label} account for user {target_user.email} (ID: {user_id}). Prior state: {old_status}",
        when=datetime.datetime.utcnow(),
        result=f"Status: {target_user.status}"
    )
    db.add(audit)

    db.commit()
    db.refresh(target_user)
    return {
        "id": target_user.id,
        "email": target_user.email,
        "is_active": target_user.is_active,
        "status": target_user.status,
        "message": f"Account {action_label.lower()} successfully."
    }


@router.patch("/users/{user_id}/role")
def update_user_role(
    user_id: str,
    role_in: UserRoleUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin)
):
    """
    Reassigns a user's role and departmental scope.
    """
    target_role = role_in.role.strip().lower()
    if target_role not in ("citizen", "engineer", "commissioner", "admin"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid role. Must be 'citizen', 'engineer', 'commissioner', or 'admin'."
        )

    target_user = db.query(User).filter(User.id == user_id).first()
    if not target_user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"User {user_id} not found."
        )

    old_role = target_user.role
    target_user.role = target_role
    if role_in.department:
        target_user.department = role_in.department.strip()
    target_user.updated_at = datetime.datetime.utcnow()

    audit = AuditLog(
        incident_id="SYSTEM-ADMIN",
        who=f"{current_user.full_name} (Administrator)",
        what=f"Reassigned role for {target_user.email}: '{old_role}' -> '{target_role}'",
        when=datetime.datetime.utcnow(),
        result=f"Role: {target_role}"
    )
    db.add(audit)

    db.commit()
    db.refresh(target_user)
    return {
        "id": target_user.id,
        "email": target_user.email,
        "role": target_user.role,
        "department": target_user.department,
        "message": f"User role updated to '{target_role}' successfully."
    }


@router.get("/audit-logs")
def get_platform_audit_logs(
    limit: int = Query(50, ge=1, le=500),
    incident_id: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin_or_commissioner)
):
    """
    Retrieves recent immutable system audit log entries.
    Accessible to Administrator and Commissioner roles.
    """
    query = db.query(AuditLog)
    if incident_id and incident_id.strip():
        query = query.filter(AuditLog.incident_id == incident_id.strip())

    logs = query.order_by(AuditLog.when.desc()).limit(limit).all()
    return [
        {
            "id": log.id,
            "incident_id": log.incident_id,
            "who": log.who,
            "what": log.what,
            "when": log.when,
            "result": log.result
        }
        for log in logs
    ]


@router.get("/system-status")
async def get_system_telemetry(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin_or_commissioner)
):
    """
    Gathers live operational health metrics for smart city infrastructure:
    - Database connectivity and dialect
    - Configured AI provider & models
    - WhatsApp Cloud API configuration status
    - Rate limiter event counters (last 24 hours)
    - Storage provider configuration
    """
    # 1. Database Connectivity & Dialect
    db_status = "connected"
    db_latency_ms = 0.0
    db_dialect = db.bind.dialect.name if db.bind else "unknown"
    try:
        t0 = time.time()
        db.execute(text("SELECT 1;"))
        db_latency_ms = round((time.time() - t0) * 1000, 2)
    except Exception as e:
        db_status = f"error: {type(e).__name__}"

    # 2. AI Intelligence Engine
    ai_info = await ai_service.get_status()

    # 3. WhatsApp Integration Health
    wa_configured = bool(
        settings.WHATSAPP_PHONE_NUMBER_ID and
        settings.WHATSAPP_ACCESS_TOKEN and
        settings.WHATSAPP_VERIFY_TOKEN
    )
    meta_secret_configured = bool(settings.META_APP_SECRET)

    # 4. Rate Limiter Statistics
    rate_limit_events_24h = 0
    try:
        cutoff = time.time() - 86400.0
        rate_limit_events_24h = db.query(RateLimitEvent).filter(RateLimitEvent.timestamp >= cutoff).count()
    except Exception:
        rate_limit_events_24h = 0

    # 5. User Account Statistics
    total_users = db.query(User).count()
    active_users = db.query(User).filter(User.is_active == True).count()
    engineer_count = db.query(User).filter(User.role == "engineer").count()
    commissioner_count = db.query(User).filter(User.role == "commissioner").count()
    admin_count = db.query(User).filter(User.role == "admin").count()
    citizen_count = db.query(User).filter(User.role == "citizen").count()

    return {
        "status": "online",
        "environment": settings.ENVIRONMENT,
        "timestamp": datetime.datetime.utcnow().isoformat(),
        "database": {
            "status": db_status,
            "dialect": db_dialect,
            "latency_ms": db_latency_ms,
            "is_postgresql": db_dialect == "postgresql"
        },
        "ai_engine": ai_info,
        "whatsapp": {
            "configured": wa_configured,
            "phone_number_id_configured": bool(settings.WHATSAPP_PHONE_NUMBER_ID),
            "webhook_verify_token_configured": bool(settings.WHATSAPP_VERIFY_TOKEN),
            "signature_verification_enabled": meta_secret_configured,
            "transport_mode": "Mocked (Local In-Memory)" if settings.ENVIRONMENT in ("development", "test") else "Live Meta Cloud API"
        },
        "storage": {
            "provider": settings.STORAGE_PROVIDER,
            "max_upload_size_mb": settings.MAX_UPLOAD_SIZE_BYTES // (1024 * 1024)
        },
        "security": {
            "rate_limit_events_last_24h": rate_limit_events_24h,
            "cors_origins_count": len(settings.CORS_ORIGINS),
            "access_token_expiry_minutes": settings.ACCESS_TOKEN_EXPIRE_MINUTES
        },
        "user_telemetry": {
            "total_users": total_users,
            "active_users": active_users,
            "citizens": citizen_count,
            "engineers": engineer_count,
            "commissioners": commissioner_count,
            "administrators": admin_count
        }
    }
