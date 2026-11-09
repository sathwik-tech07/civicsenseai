"""
CivicSense AI - Meta WhatsApp Cloud API Schemas
Pydantic v2 models for parsing, validating, and structuring incoming Meta Webhooks
and outgoing WhatsApp Cloud API messages.
"""

from typing import Optional, List, Dict, Any, Literal
from pydantic import BaseModel, Field, ConfigDict, field_validator


# ==============================================================================
# SUB-COMPONENTS: CONTACTS & METADATA
# ==============================================================================

class WhatsAppProfile(BaseModel):
    """Profile information of the WhatsApp user."""
    name: Optional[str] = None
    model_config = ConfigDict(extra="allow")


class WhatsAppContact(BaseModel):
    """Contact entry provided by Meta webhook."""
    profile: Optional[WhatsAppProfile] = None
    wa_id: Optional[str] = None
    model_config = ConfigDict(extra="allow")


class WhatsAppMetadata(BaseModel):
    """WhatsApp Business account metadata associated with the event."""
    display_phone_number: Optional[str] = None
    phone_number_id: str
    model_config = ConfigDict(extra="allow")


# ==============================================================================
# MESSAGE CONTENT TYPES
# ==============================================================================

class WhatsAppText(BaseModel):
    """Text message payload."""
    body: str
    model_config = ConfigDict(extra="allow")


class WhatsAppImage(BaseModel):
    """Image message payload containing media ID and MIME type."""
    id: str = Field(..., description="Meta media ID used to download binary image")
    mime_type: str = Field(..., description="MIME type, e.g. image/jpeg, image/png")
    sha256: Optional[str] = None
    caption: Optional[str] = None
    model_config = ConfigDict(extra="allow")


class WhatsAppLocation(BaseModel):
    """Location message payload containing GPS coordinates."""
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


class WhatsAppButtonReply(BaseModel):
    """Reply from an interactive quick-reply button."""
    id: str = Field(..., description="Unique developer-defined ID for button clicked")
    title: str = Field(..., description="Visible button label text")
    model_config = ConfigDict(extra="allow")


class WhatsAppListReply(BaseModel):
    """Reply from an interactive list menu item."""
    id: str = Field(..., description="Unique developer-defined ID for list item")
    title: str = Field(..., description="Visible list item title")
    description: Optional[str] = None
    model_config = ConfigDict(extra="allow")


class WhatsAppInteractive(BaseModel):
    """Interactive response payload (button reply or list selection)."""
    type: Optional[str] = None  # button_reply | list_reply
    button_reply: Optional[WhatsAppButtonReply] = None
    list_reply: Optional[WhatsAppListReply] = None
    model_config = ConfigDict(extra="allow")


class WhatsAppQuickReplyButton(BaseModel):
    """Quick reply button click from legacy template messages."""
    text: Optional[str] = None
    payload: Optional[str] = None
    model_config = ConfigDict(extra="allow")


class WhatsAppMessageContext(BaseModel):
    """Context when a message is sent in reply to a previous message."""
    from_: Optional[str] = Field(None, alias="from")
    id: Optional[str] = None
    model_config = ConfigDict(extra="allow", populate_by_name=True)


# ==============================================================================
# INCOMING MESSAGE MODEL
# ==============================================================================

class WhatsAppMessage(BaseModel):
    """
    Individual WhatsApp message received from a citizen.
    Supports text, image, location, interactive buttons/lists, and handles
    unknown types safely via extra='allow'.
    """
    from_: str = Field(..., alias="from", description="Citizen WhatsApp phone number")
    id: str = Field(..., description="Unique WhatsApp message ID (wamid...)")
    timestamp: str = Field(..., description="Unix timestamp as string")
    type: str = Field(..., description="Message type: text, image, location, interactive, etc.")

    # Optional contextual reply info
    context: Optional[WhatsAppMessageContext] = None

    # Mutually exclusive content payloads (only populated matching `type`)
    text: Optional[WhatsAppText] = None
    image: Optional[WhatsAppImage] = None
    location: Optional[WhatsAppLocation] = None
    interactive: Optional[WhatsAppInteractive] = None
    button: Optional[WhatsAppQuickReplyButton] = None

    model_config = ConfigDict(extra="allow", populate_by_name=True)


# ==============================================================================
# STATUS NOTIFICATION MODELS (DELIVERY / READ RECEIPTS)
# ==============================================================================

class WhatsAppConversationOrigin(BaseModel):
    type: Optional[str] = None
    model_config = ConfigDict(extra="allow")


class WhatsAppConversation(BaseModel):
    id: Optional[str] = None
    origin: Optional[WhatsAppConversationOrigin] = None
    expiration_timestamp: Optional[str] = None
    model_config = ConfigDict(extra="allow")


class WhatsAppPricing(BaseModel):
    billable: Optional[bool] = None
    pricing_model: Optional[str] = None
    category: Optional[str] = None
    model_config = ConfigDict(extra="allow")


class WhatsAppStatusError(BaseModel):
    code: int
    title: Optional[str] = None
    message: Optional[str] = None
    error_data: Optional[Dict[str, Any]] = None
    model_config = ConfigDict(extra="allow")


class WhatsAppStatus(BaseModel):
    """Status notification for outbound messages (sent, delivered, read, failed)."""
    id: str = Field(..., description="Message ID this status applies to")
    recipient_id: str = Field(..., description="Recipient WhatsApp phone number")
    status: Literal["sent", "delivered", "read", "failed"] = Field(
        ..., description="Message delivery status"
    )
    timestamp: str = Field(..., description="Unix timestamp as string")
    conversation: Optional[WhatsAppConversation] = None
    pricing: Optional[WhatsAppPricing] = None
    errors: Optional[List[WhatsAppStatusError]] = None

    model_config = ConfigDict(extra="allow")


# ==============================================================================
# WEBHOOK EVENT STRUCTURE (CHANGE & ENTRY)
# ==============================================================================

class WhatsAppValue(BaseModel):
    """The value object inside changes array."""
    messaging_product: Optional[str] = "whatsapp"
    metadata: Optional[WhatsAppMetadata] = None
    contacts: Optional[List[WhatsAppContact]] = None
    messages: Optional[List[WhatsAppMessage]] = None
    statuses: Optional[List[WhatsAppStatus]] = None
    errors: Optional[List[WhatsAppStatusError]] = None
    model_config = ConfigDict(extra="allow")


class WhatsAppChange(BaseModel):
    """Change item containing field and value."""
    field: str = Field(..., description="Field name, typically 'messages'")
    value: WhatsAppValue
    model_config = ConfigDict(extra="allow")


class WhatsAppEntry(BaseModel):
    """Entry containing WhatsApp Business Account ID and array of changes."""
    id: str = Field(..., description="WhatsApp Business Account ID (WABA ID)")
    changes: List[WhatsAppChange]
    model_config = ConfigDict(extra="allow")


# ==============================================================================
# ROOT WEBHOOK PAYLOAD
# ==============================================================================

class MetaWebhookPayload(BaseModel):
    """
    Root payload delivered by Meta Webhooks to POST /api/v1/whatsapp/webhook.
    Provides ergonomic helper methods to extract messages, statuses, and metadata.
    """
    object: str = Field(..., description="Should be 'whatsapp_business_account'")
    entry: List[WhatsAppEntry]
    model_config = ConfigDict(extra="allow")

    # Helper methods for cleaner router consumption
    def has_messages(self) -> bool:
        """Returns True if the payload contains at least one incoming message."""
        for e in self.entry:
            for c in e.changes:
                if c.value.messages and len(c.value.messages) > 0:
                    return True
        return False

    def has_statuses(self) -> bool:
        """Returns True if the payload contains delivery/read status updates."""
        for e in self.entry:
            for c in e.changes:
                if c.value.statuses and len(c.value.statuses) > 0:
                    return True
        return False

    def get_first_message(self) -> Optional[WhatsAppMessage]:
        """Safely extracts the first incoming message, or None."""
        for e in self.entry:
            for c in e.changes:
                if c.value.messages and len(c.value.messages) > 0:
                    return c.value.messages[0]
        return None

    def get_first_status(self) -> Optional[WhatsAppStatus]:
        """Safely extracts the first message status, or None."""
        for e in self.entry:
            for c in e.changes:
                if c.value.statuses and len(c.value.statuses) > 0:
                    return c.value.statuses[0]
        return None

    def get_phone_number_id(self) -> Optional[str]:
        """Safely extracts the business phone number ID receiving the message."""
        for e in self.entry:
            for c in e.changes:
                if c.value.metadata and c.value.metadata.phone_number_id:
                    return c.value.metadata.phone_number_id
        return None

    def get_sender_wa_id(self) -> Optional[str]:
        """Safely extracts the sender citizen's WhatsApp ID/phone number."""
        msg = self.get_first_message()
        if msg:
            return msg.from_
        for e in self.entry:
            for c in e.changes:
                if c.value.contacts and len(c.value.contacts) > 0:
                    return c.value.contacts[0].wa_id
        return None

    def get_sender_name(self) -> Optional[str]:
        """Safely extracts the sender citizen's display name, if provided."""
        for e in self.entry:
            for c in e.changes:
                if c.value.contacts and len(c.value.contacts) > 0:
                    if c.value.contacts[0].profile:
                        return c.value.contacts[0].profile.name
        return None


# ==============================================================================
# OUTGOING WHATSAPP API REQUEST SCHEMAS (GRAPH API OUTBOUND)
# ==============================================================================

class WhatsAppOutgoingTextRequest(BaseModel):
    """Payload to send a simple text message via Meta Graph API."""
    messaging_product: str = "whatsapp"
    recipient_type: str = "individual"
    to: str
    type: str = "text"
    text: WhatsAppText
    model_config = ConfigDict(extra="allow")


class WhatsAppInteractiveButton(BaseModel):
    type: str = "reply"
    reply: WhatsAppButtonReply


class WhatsAppInteractiveAction(BaseModel):
    buttons: List[WhatsAppInteractiveButton]


class WhatsAppInteractiveMessage(BaseModel):
    type: str = "button"
    body: WhatsAppText
    action: WhatsAppInteractiveAction


class WhatsAppOutgoingInteractiveRequest(BaseModel):
    """Payload to send interactive button choices (e.g. Confirm / Cancel / Status)."""
    messaging_product: str = "whatsapp"
    recipient_type: str = "individual"
    to: str
    type: str = "interactive"
    interactive: WhatsAppInteractiveMessage
    model_config = ConfigDict(extra="allow")
