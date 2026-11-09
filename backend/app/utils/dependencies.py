"""
CivicSense AI - Reusable Security & RBAC Dependencies
Provides token extraction, role verification, and resource authorization helpers.
"""

from typing import List, Optional, Callable
from fastapi import Depends, HTTPException, status, Header
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.user import User
from app.models.incident import Incident
from app.utils.security import decode_access_token

def get_current_user(
    authorization: Optional[str] = Header(None),
    db: Session = Depends(get_db)
) -> User:
    if not authorization:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing authorization header",
            headers={"WWW-Authenticate": "Bearer"},
        )

    parts = authorization.split()
    if len(parts) != 2 or parts[0].lower() != "bearer":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authorization scheme. Bearer token required.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    token = parts[1].strip()
    payload = decode_access_token(token)
    if not payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
            headers={"WWW-Authenticate": "Bearer"},
        )

    user_id = payload.get("sub")
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token subject missing",
            headers={"WWW-Authenticate": "Bearer"},
        )

    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if user.status == "inactive" or (user.is_active is False):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User account is inactive",
            headers={"WWW-Authenticate": "Bearer"},
        )

    return user

def require_roles(*allowed_roles: str) -> Callable:
    """
    Reusable FastAPI dependency factory that restricts route access to specific roles.
    Raises HTTP 403 Forbidden if current_user.role is not in allowed_roles.
    """
    def role_checker(current_user: User = Depends(get_current_user)) -> User:
        if current_user.role not in allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Access denied. Requires one of {list(allowed_roles)} role(s), but user role is '{current_user.role}'."
            )
        return current_user
    return role_checker

# Reusable role-based dependencies
require_admin_or_commissioner = require_roles("commissioner", "admin")
require_staff = require_roles("commissioner", "admin", "engineer")

def can_engineer_access_incident(user: User, incident: Incident) -> bool:
    """
    Determines if an engineer is authorized to access or update an incident.
    Enforces strict assignment-only authorization:
    1. Administrators and Commissioners have full municipal oversight across all incidents.
    2. An engineer can access an incident IF AND ONLY IF incident.assigned_engineer_id == user.id.
    All fallback paths (assigned_crew text matching, department matching, unassigned ticket access)
    are strictly eliminated.
    """
    if not incident:
        return False
    if user.role in ("commissioner", "admin"):
        return True
    if user.role != "engineer":
        return False

    # Strict assignment-only condition:
    return bool(incident.assigned_engineer_id and incident.assigned_engineer_id == user.id)
