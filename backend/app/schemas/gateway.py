"""
CivicSense AI - WhatsApp Gateway Pydantic Schemas
Defines request and response schemas for internal communication between
the Go WhatsApp Gateway (whatsmeow) and the FastAPI backend.
"""

from typing import Optional, Dict, Any, Literal
from pydantic import BaseModel, Field, ConfigDict, field_validator


class GatewayTextMessage(BaseModel):
    """Text payload from Go WhatsApp Gateway."""
    body: str = ""
    model_config = ConfigDict(extra="allow")


class GatewayMediaMessage(BaseModel):
    """Media payload from Go WhatsApp Gateway (images, voice, documents)."""
    mimetype: Optional[str] = Field(None, description="MIME type of media")
    mime_type: Optional[str] = Field(None, description="Alias for mimetype")
    filename: Optional[str] = None
    file_name: Optional[str] = None
    size_bytes: int = 0
    data_base64: Optional[str] = Field(None, description="Raw base64 data")
    media_url: Optional[str] = Field(None, description="Pre-signed or public URL if hosted")
    caption: Optional[str] = None

    model_config = ConfigDict(extra="allow")

    @property
    def resolved_mime_type(self) -> str:
        return self.mimetype or self.mime_type or "image/jpeg"


class GatewayLocationMessage(BaseModel):
    """GPS location payload from Go WhatsApp Gateway."""
    latitude: float
    longitude: float
    name: Optional[str] = None
    address: Optional[str] = None
    model_config = ConfigDict(extra="allow")

    @field_validator("latitude")
    @classmethod
    def validate_lat(cls, v: float) -> float:
        if not (-90.0 <= v <= 90.0):
            raise ValueError(f"Latitude must be between -90 and 90, got {v}")
        return v

    @field_validator("longitude")
    @classmethod
    def validate_lng(cls, v: float) -> float:
        if not (-180.0 <= v <= 180.0):
            raise ValueError(f"Longitude must be between -180 and 180, got {v}")
        return v


class GatewayInboundMessage(BaseModel):
    """Standardized inbound message received from Go WhatsApp Gateway."""
    id: str = Field(..., description="WhatsApp message ID")
    from_: str = Field(..., alias="from", description="Sender phone number in digits format")
    sender_name: Optional[str] = Field(None, description="WhatsApp PushName")
    timestamp: int = Field(0, description="Unix epoch timestamp")
    type: str = Field("text", description="Message type: text, image, location, etc.")
    text: Optional[GatewayTextMessage] = None
    image: Optional[GatewayMediaMessage] = None
    media: Optional[GatewayMediaMessage] = None
    document: Optional[GatewayMediaMessage] = None
    location: Optional[GatewayLocationMessage] = None

    model_config = ConfigDict(populate_by_name=True, extra="allow")

    @property
    def resolved_media(self) -> Optional[GatewayMediaMessage]:
        return self.image or self.media or self.document


class GatewayInboundEvent(BaseModel):
    """Inbound webhook event delivered by Go WhatsApp Gateway."""
    event_id: Optional[str] = None
    event_type: str = Field("message", description="Event type: message, receipt, connected, etc.")
    timestamp: Optional[Any] = None
    message: Optional[GatewayInboundMessage] = None
    status: Optional[str] = None

    model_config = ConfigDict(populate_by_name=True, extra="allow")


class GatewayOutboundRequest(BaseModel):
    """Outbound message request sent to Go WhatsApp Gateway."""
    recipient: str = Field(..., description="Target phone number or JID")
    message_type: Literal["text", "image"] = "text"
    text: Optional[str] = None
    caption: Optional[str] = None
    media_base64: Optional[str] = None
    media_mime_type: Optional[str] = None
    media_url: Optional[str] = None

    model_config = ConfigDict(extra="allow")


class GatewayOutboundResponse(BaseModel):
    """Response returned by Go WhatsApp Gateway after dispatch."""
    success: bool
    message_id: str = ""
    timestamp: int = 0
    error: Optional[str] = None

    model_config = ConfigDict(extra="allow")


class GatewayStatusResponse(BaseModel):
    """Telemetry report from Go WhatsApp Gateway."""
    status: str
    connected: bool
    logged_in: bool
    jid: Optional[str] = None
    uptime_seconds: float = 0.0
    goroutines: int = 0
    memory_alloc_mb: float = 0.0

    model_config = ConfigDict(extra="allow")


class GatewayQRResponse(BaseModel):
    """QR pairing response from Go WhatsApp Gateway."""
    status: str
    qr_code: Optional[str] = None
    qr_png_base64: Optional[str] = None
    generated_at: Optional[str] = None
    expires_at: Optional[str] = None

    model_config = ConfigDict(extra="allow")


class AdminTestSendMessageRequest(BaseModel):
    """Payload for administrative test WhatsApp dispatch."""
    recipient: str = Field(..., description="Target phone number or JID")
    message: str = Field("Hello from CivicSense AI Smart City Platform!", description="Message text")
    model_config = ConfigDict(extra="allow")
