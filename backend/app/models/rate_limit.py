import datetime
from sqlalchemy import Column, Integer, String, Float, Index
from app.database import Base


class RateLimitEvent(Base):
    """
    Persistent storage model for atomic, multi-instance sliding-window rate limiting.
    Supports both SQLite (local development) and PostgreSQL (Render production).
    """
    __tablename__ = "rate_limit_events"

    id = Column(Integer, primary_key=True, autoincrement=True)
    key = Column(String(255), nullable=False, index=True)
    timestamp = Column(Float, nullable=False, index=True)

    __table_args__ = (
        Index("ix_rate_limit_key_ts", "key", "timestamp"),
    )
