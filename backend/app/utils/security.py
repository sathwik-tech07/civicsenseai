import datetime
from typing import Optional
import bcrypt
from jose import jwt, JWTError
from app.config import settings

MAX_BCRYPT_PASSWORD_BYTES = 72

def verify_password(plain_password: str, hashed_password: str) -> bool:
    try:
        if not plain_password or not hashed_password:
            return False
        pw_bytes = plain_password.encode("utf-8")
        if len(pw_bytes) > MAX_BCRYPT_PASSWORD_BYTES:
            return False
        hash_bytes = hashed_password.encode("utf-8")
        return bcrypt.checkpw(pw_bytes, hash_bytes)
    except Exception:
        return False

def get_password_hash(password: str) -> str:
    pw_bytes = password.encode("utf-8")
    if len(pw_bytes) > MAX_BCRYPT_PASSWORD_BYTES:
        raise ValueError(
            f"Password cannot exceed {MAX_BCRYPT_PASSWORD_BYTES} UTF-8 bytes due to cryptographic limits."
        )
    salt = bcrypt.gensalt()
    return bcrypt.hashpw(pw_bytes, salt).decode("utf-8")

def create_access_token(data: dict, expires_delta: Optional[datetime.timedelta] = None) -> str:
    to_encode = data.copy()
    if "exp" not in to_encode:
        if expires_delta:
            expire = datetime.datetime.now(datetime.timezone.utc) + expires_delta
        else:
            expire = datetime.datetime.now(datetime.timezone.utc) + datetime.timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
        to_encode.update({"exp": expire})
    algorithm = getattr(settings, "JWT_ALGORITHM", None) or getattr(settings, "ALGORITHM", "HS256")
    encoded_jwt = jwt.encode(to_encode, settings.SECRET_KEY, algorithm=algorithm)
    return encoded_jwt

def decode_access_token(token: str) -> Optional[dict]:
    if not token or not isinstance(token, str):
        return None
    try:
        algorithm = getattr(settings, "JWT_ALGORITHM", None) or getattr(settings, "ALGORITHM", "HS256")
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[algorithm])
        return payload
    except JWTError:
        return None
    except Exception:
        return None
