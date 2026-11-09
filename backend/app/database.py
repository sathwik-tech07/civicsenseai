from typing import Optional
from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from app.config import settings

DEFAULT_DATABASE_URL = "sqlite:///./civicsense.db"

def normalize_database_url(url: Optional[str] = None) -> str:
    """
    Normalizes database connection URLs for SQLAlchemy 2.x compatibility.

    Render, Heroku, and other PaaS providers frequently export DATABASE_URL with the
    legacy 'postgres://' scheme. SQLAlchemy 1.4+ and 2.x require 'postgresql://'.

    Preserves:
      - Already-normalized 'postgresql://'
      - Driver-specific schemes ('postgresql+psycopg://', 'postgresql+psycopg2://', etc.)
      - SQLite schemes ('sqlite:///...')
      - Falls back safely to SQLite default when URL is missing, empty, or whitespace.
    """
    if not url or not url.strip():
        return DEFAULT_DATABASE_URL

    clean_url = url.strip()
    # Normalize legacy 'postgres://' prefix to SQLAlchemy-supported 'postgresql://'
    if clean_url.lower().startswith("postgres://"):
        return "postgresql://" + clean_url[len("postgres://"):]

    return clean_url

DATABASE_URL = normalize_database_url(settings.DATABASE_URL)

# Create database engine
connect_args = {"check_same_thread": False} if DATABASE_URL.startswith("sqlite") else {}

engine = create_engine(
    DATABASE_URL,
    connect_args=connect_args,
    pool_pre_ping=True
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

# Dependency for FastAPI route handlers
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
