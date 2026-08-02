import os
from pydantic import BaseModel

class Settings(BaseModel):
    PROJECT_NAME: str = "CivicSense AI Smart City Backend"
    API_V1_STR: str = "/api/v1"
    SECRET_KEY: str = "civicsense-ai-super-secret-key-change-in-production-2026"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 7  # 7 days

    # PostgreSQL Database URL
    DATABASE_URL: str = os.getenv(
        "DATABASE_URL",
        "sqlite:///./civicsense.db"  # Fallback to SQLite for easy local dev
    )

    # CORS origins
    CORS_ORIGINS: list[str] = [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:5174",
        "http://127.0.0.1:5174",
        "http://localhost:5175",
        "http://127.0.0.1:5175",
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ]

settings = Settings()
