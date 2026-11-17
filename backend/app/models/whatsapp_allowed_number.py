import datetime
from sqlalchemy import Column, String, DateTime, Boolean
from app.database import Base


class WhatsAppAllowedNumber(Base):
    """
    Whitelisted phone number permitted to interact with CivicSense AI on WhatsApp.
    Protects personal WhatsApp accounts by ignoring non-whitelisted numbers.
    """
    __tablename__ = "whatsapp_allowed_numbers"

    phone = Column(String(32), primary_key=True, index=True)
    label = Column(String(128), nullable=True)
    enabled = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
