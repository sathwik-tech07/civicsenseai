import datetime
from sqlalchemy import Column, String, Float, DateTime, JSON, Index
from app.database import Base


class WhatsAppPendingSession(Base):
    """
    Persistent storage model for unconfirmed WhatsApp complaint sessions.
    Stores draft metadata (classification, coordinates, staged S3 object key)
    with a 30-minute expiration window to persist across container recycles.
    """
    __tablename__ = "whatsapp_pending_sessions"

    phone = Column(String(32), primary_key=True, index=True)
    draft_data = Column(JSON, nullable=False)
    expires_at = Column(Float, nullable=False, index=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)

    __table_args__ = (
        Index("ix_whatsapp_sessions_phone_expires", "phone", "expires_at"),
    )
