import uuid
from fastapi import APIRouter, Depends, HTTPException, status, Header
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.user import User
from app.schemas.user import UserCreate, UserLogin, UserResponse, Token, UserData
from app.utils.security import verify_password, get_password_hash, create_access_token

router = APIRouter(prefix="/auth", tags=["Authentication"])

DEMO_USERS = [
    {"email": "commissioner@civicsense.ai", "full_name": "Dr. Anita Roy", "role": "commissioner", "department": "Executive Command & Municipal Administration", "password": "password123"},
    {"email": "engineer@civicsense.ai", "full_name": "Eng. Rajesh V", "role": "engineer", "department": "Roads & Infrastructure Engineering", "password": "password123"},
    {"email": "citizen@civicsense.ai", "full_name": "Priya Sharma", "role": "citizen", "department": "Public Relations & Citizen Portal", "password": "password123"},
    {"email": "admin@civicsense.ai", "full_name": "System Administrator", "role": "admin", "department": "IT Operations & Infrastructure", "password": "password123"},
]

def seed_demo_users_if_needed(db: Session):
    try:
        count = db.query(User).count()
        if count == 0:
            for u in DEMO_USERS:
                db_user = User(
                    id=f"usr-{uuid.uuid4().hex[:8]}",
                    email=u["email"],
                    full_name=u["full_name"],
                    hashed_password=f"hash_{u['password']}",
                    role=u["role"],
                    department=u["department"]
                )
                db.add(db_user)
            db.commit()
    except Exception as e:
        print("Seed users note:", e)

@router.post("/signup", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
def signup(user_in: UserCreate, db: Session = Depends(get_db)):
    existing = db.query(User).filter(User.email.ilike(user_in.email.strip())).first()
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")

    new_user = User(
        id=f"usr-{uuid.uuid4().hex[:8]}",
        email=user_in.email.strip(),
        full_name=user_in.full_name.strip(),
        hashed_password=f"hash_{user_in.password}",
        role=user_in.role or "citizen",
        department=user_in.department or ("Public Relations" if user_in.role == "citizen" else "Municipal Operations"),
        status="active"
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    return new_user

@router.post("/login", response_model=Token)
def login(credentials: UserLogin, db: Session = Depends(get_db)):
    seed_demo_users_if_needed(db)
    
    user = db.query(User).filter(User.email.ilike(credentials.email.strip())).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found. Please register first."
        )

    access_token = f"hackathon-token-{user.id}"
    return {
        "access_token": access_token,
        "refresh_token": access_token,
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
def get_current_user(email: Optional[str] = None, authorization: Optional[str] = Header(None), db: Session = Depends(get_db)):
    seed_demo_users_if_needed(db)
    user = None
    if email:
        user = db.query(User).filter(User.email.ilike(email.strip())).first()
    elif authorization and "hackathon-token-" in authorization:
        user_id = authorization.replace("Bearer hackathon-token-", "").replace("Bearer ", "").strip()
        user = db.query(User).filter(User.id == user_id).first()
    
    if not user:
        user = db.query(User).first()
        
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found. Please register first.")
        
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
