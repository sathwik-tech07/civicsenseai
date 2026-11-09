import uuid
import datetime
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status, Header, Request
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.user import User
from app.schemas.user import UserCreate, UserLogin, UserResponse, Token, UserData, EngineerProvisionRequest
from app.utils.security import verify_password, get_password_hash, create_access_token, decode_access_token
from app.config import settings
from app.services.rate_limiter import RateLimiter, get_rate_limiter, rate_limit_signup_dependency
from app.utils.dependencies import (
    get_current_user,
    require_roles,
    require_admin_or_commissioner,
    require_staff
)

router = APIRouter(prefix="/auth", tags=["Authentication"])

DEMO_USERS = [
    {"email": "commissioner@civicsense.ai", "full_name": "Dr. Anita Roy", "role": "commissioner", "department": "Executive Command & Municipal Administration", "password": "password123"},
    {"email": "engineer@civicsense.ai", "full_name": "Eng. Rajesh V", "role": "engineer", "department": "Roads & Infrastructure Engineering", "password": "password123"},
    {"email": "citizen@civicsense.ai", "full_name": "Priya Sharma", "role": "citizen", "department": "Public Relations & Citizen Portal", "password": "password123"},
    {"email": "admin@civicsense.ai", "full_name": "System Administrator", "role": "admin", "department": "IT Operations & Infrastructure", "password": "password123"},
]

def seed_demo_users_if_needed(db: Session):
    """
    Seeds initial development demo accounts only when ENABLE_DEMO_ACCOUNTS is explicitly True
    in a permitted development environment.
    Strictly disabled in staging and production. Does not automatically overwrite or reset passwords.
    """
    if getattr(settings, "ENABLE_DEMO_ACCOUNTS", None) is not True:
        return
    env = getattr(settings, "ENVIRONMENT", "").strip().lower()
    if env not in ("development", "dev", "test", "testing", "local"):
        return

    try:
        count = db.query(User).count()
        if count == 0:
            for u in DEMO_USERS:
                db_user = User(
                    id=f"usr-{uuid.uuid4().hex[:8]}",
                    email=u["email"],
                    full_name=u["full_name"],
                    hashed_password=get_password_hash(u["password"]),
                    role=u["role"],
                    department=u["department"]
                )
                db.add(db_user)
            db.commit()
    except Exception as e:
        print("Seed users note:", e)

@router.post("/signup", response_model=UserResponse, status_code=status.HTTP_201_CREATED, dependencies=[Depends(rate_limit_signup_dependency)])
def signup(
    user_in: UserCreate,
    db: Session = Depends(get_db)
):
    # Security enforcement: Public registration is strictly restricted to citizen accounts.
    # Reject explicitly supplied roles other than 'citizen' with HTTP 400.
    if user_in.role is not None and user_in.role.strip().lower() != "citizen":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Public registration is strictly restricted to citizen accounts. "
                   "Staff and engineer accounts must be provisioned by an administrator."
        )

    existing = db.query(User).filter(User.email.ilike(user_in.email.strip())).first()
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")

    new_user = User(
        id=f"usr-{uuid.uuid4().hex[:8]}",
        email=user_in.email.strip(),
        full_name=user_in.full_name.strip(),
        hashed_password=get_password_hash(user_in.password),
        role="citizen",
        department=user_in.department or "Public Relations & Citizen Portal",
        status="active"
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    return new_user

@router.post("/provision-engineer", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
def provision_engineer(
    engineer_in: EngineerProvisionRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin_or_commissioner)
):
    """
    Authorized administrative provisioning of field engineer accounts.
    Restricted to Administrator and Commissioner roles only.
    Validates email uniqueness and department, and records the action in audit logs.
    """
    existing = db.query(User).filter(User.email.ilike(engineer_in.email.strip())).first()
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")

    new_eng = User(
        id=f"usr-{uuid.uuid4().hex[:8]}",
        email=engineer_in.email.strip(),
        full_name=engineer_in.full_name.strip(),
        hashed_password=get_password_hash(engineer_in.password),
        role="engineer",
        department=engineer_in.department.strip(),
        status="active",
        is_active=True
    )
    db.add(new_eng)

    # Record provisioning in audit log
    from app.models.workflow import AuditLog
    audit = AuditLog(
        incident_id="SYSTEM-USER-PROVISIONING",
        who=f"{current_user.full_name} ({current_user.role.title()})",
        what=f"Provisioned field engineer account: {new_eng.email} (ID: {new_eng.id})",
        when=datetime.datetime.utcnow(),
        result=f"Success ({new_eng.department})"
    )
    db.add(audit)

    db.commit()
    db.refresh(new_eng)
    return new_eng

@router.post("/login", response_model=Token)
def login(
    credentials: UserLogin,
    request: Request,
    db: Session = Depends(get_db),
    rate_limiter: RateLimiter = Depends(get_rate_limiter)
):
    # Atomically reserve a login attempt slot; blocks immediately with 429 if limit is reached
    attempt_id = rate_limiter.acquire_login_attempt(request)

    user = db.query(User).filter(User.email.ilike(credentials.email.strip())).first()
    if not user or not verify_password(credentials.password, user.hashed_password):
        # Failed credentials: this attempt remains in storage as a recorded failure!
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # SEC-02: Check user.status and user.is_active before issuing tokens
    # Reject inactive accounts with identical 401 error to prevent user enumeration
    if user.status == "inactive" or (user.is_active is False):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # Authentication succeeded: release ONLY this successful attempt so it is not counted as a failure.
    # Previous failed attempts on this IP remain and will expire naturally through the sliding window.
    rate_limiter.release_successful_login(request, attempt_id)

    # Issue cryptographically signed JWT access and refresh tokens
    access_token = create_access_token(data={"sub": str(user.id)})
    refresh_token = create_access_token(
        data={"sub": str(user.id), "type": "refresh"},
        expires_delta=datetime.timedelta(days=30)
    )
    return {
        "access_token": access_token,
        "refresh_token": refresh_token,
        "token_type": "bearer",
        "user": UserData(
            id=user.id,
            email=user.email,
            full_name=user.full_name,
            role=user.role,
            department=user.department,
            status=user.status or "active",
            created_at=user.created_at,
            updated_at=user.updated_at
        )
    }

@router.get("/me", response_model=UserData)
def get_current_user_profile(user: User = Depends(get_current_user)):
    return UserData(
        id=user.id,
        email=user.email,
        full_name=user.full_name,
        role=user.role,
        department=user.department,
        status=user.status or "active",
        created_at=user.created_at,
        updated_at=user.updated_at
    )
