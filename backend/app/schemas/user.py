from pydantic import BaseModel, EmailStr, field_validator
from typing import Optional
from datetime import datetime

MAX_BCRYPT_PASSWORD_BYTES = 72

def validate_password_bytes(v: str) -> str:
    if not v:
        raise ValueError("Password cannot be empty.")
    if len(v.encode("utf-8")) > MAX_BCRYPT_PASSWORD_BYTES:
        raise ValueError(
            f"Password cannot exceed {MAX_BCRYPT_PASSWORD_BYTES} UTF-8 bytes due to cryptographic limits."
        )
    return v

class UserBase(BaseModel):
    email: EmailStr
    full_name: str
    role: Optional[str] = "citizen"
    department: Optional[str] = None

class UserCreate(UserBase):
    password: str

    @field_validator("password")
    @classmethod
    def check_password_length(cls, v: str) -> str:
        return validate_password_bytes(v)

class UserLogin(BaseModel):
    email: EmailStr
    password: str

    @field_validator("password")
    @classmethod
    def check_password_length(cls, v: str) -> str:
        return validate_password_bytes(v)

class EngineerProvisionRequest(BaseModel):
    email: EmailStr
    full_name: str
    password: str
    department: str

    @field_validator("password")
    @classmethod
    def check_password_length(cls, v: str) -> str:
        return validate_password_bytes(v)

    @field_validator("department")
    @classmethod
    def check_department(cls, v: str) -> str:
        if not v or not v.strip():
            raise ValueError("Department must be specified for field engineers.")
        return v.strip()

class UserResponse(UserBase):
    id: str
    is_active: bool
    status: Optional[str] = "active"
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True

class UserData(BaseModel):
    id: str
    email: str
    full_name: str
    role: str
    department: Optional[str] = None
    status: Optional[str] = "active"
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

class Token(BaseModel):
    access_token: str
    refresh_token: Optional[str] = None
    token_type: str = "bearer"
    user: UserData
