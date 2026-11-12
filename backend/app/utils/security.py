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

def create_password_reset_token(email: str, password_hash: str = "") -> str:
    """
    Generates a cryptographically signed password reset token.
    Enforces strict 15-minute expiration (900 seconds) and binds to the current password hash
    fingerprint to guarantee single-use (rejects token reuse once password is changed).
    """
    expires = datetime.timedelta(minutes=15)
    claims = {
        "sub": email.strip().lower(),
        "type": "password_reset",
        "fp": password_hash[:16] if password_hash else ""
    }
    return create_access_token(claims, expires_delta=expires)

def verify_password_reset_token(token: str, email: str, current_password_hash: str = "") -> bool:
    """
    Verifies a password reset token. Rejects expired, tampered, wrong-subject, or reused tokens.
    """
    payload = decode_access_token(token)
    if not payload:
        return False
    if payload.get("type") != "password_reset":
        return False
    if payload.get("sub", "").strip().lower() != email.strip().lower():
        return False
    expected_fp = current_password_hash[:16] if current_password_hash else ""
    token_fp = payload.get("fp", "")
    if token_fp and expected_fp and token_fp != expected_fp:
        return False
    return True
