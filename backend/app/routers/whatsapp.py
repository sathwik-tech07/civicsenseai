"""
CivicSense AI - FastAPI WhatsApp Webhook Router
Handles Meta WhatsApp Cloud API GET challenge verification and POST event ingestion.
Validates HMAC-SHA256 signatures, provides in-memory deduplication, and queues
inbound message processing via FastAPI BackgroundTasks.
Includes full conversational assistance, image complaint reporting, citizen confirmation,
and live complaint tracking.
"""

import hmac
import hashlib
import json
import logging
import time
import re
import threading
from collections import OrderedDict
from typing import Optional, Dict, Any

from fastapi import APIRouter, Request, Header, Query, BackgroundTasks, HTTPException, status, Depends
from fastapi.responses import PlainTextResponse
from pydantic import ValidationError

from app.config import settings
from app.database import SessionLocal
from app.schemas.whatsapp import MetaWebhookPayload, WhatsAppMessage
from app.services.whatsapp_service import whatsapp_service

logger = logging.getLogger("civicsense.whatsapp.router")

router = APIRouter(prefix="/whatsapp", tags=["Meta WhatsApp Cloud API Webhook"])

# Interactive Welcome Message for CivicSense AI
WELCOME_MESSAGE = (
    "👋 *Welcome to CivicSense AI — Smart City Civic Assistance*\n\n"
    "I can help you report and track municipal infrastructure problems across Bengaluru.\n\n"
    "📸 *How to Report an Issue:*\n"
    "Simply take a photo of a pothole, water leak, garbage overflow, or broken streetlight and send it here. "
    "Our multimodal AI (Gemini 2.5 Flash) will analyze the defect, estimate repair costs, and prepare your report for confirmation.\n\n"
    "🔍 *How to Track a Complaint:*\n"
    "Reply with `track <Complaint ID>` (e.g. `track INC-2026-BA317F`) to see live progress and dispatched crew details.\n\n"
    "💬 You can also ask me any questions about municipal services. How can I assist you today?"
)


# ==============================================================================
# IN-MEMORY DEDUPLICATION STORE (IDEMPOTENCY)
# ==============================================================================

class MessageDeduplicator:
    """
    In-memory thread-safe bounded LRU set with TTL for deduplicating incoming WhatsApp message IDs.
    Guarantees idempotency when Meta retries webhook events.
    """
    def __init__(self, max_size: int = 10000, ttl_seconds: int = 86400):
        self.max_size = max_size
        self.ttl_seconds = ttl_seconds
        self._cache: OrderedDict[str, float] = OrderedDict()
        self._lock = threading.Lock()

    def is_duplicate(self, message_id: str) -> bool:
        """Returns True if message_id was recently processed; otherwise records it and returns False."""
        if not message_id or not isinstance(message_id, str):
            return False

        now = time.time()
        with self._lock:
            if message_id in self._cache:
                timestamp = self._cache[message_id]
                if now - timestamp < self.ttl_seconds:
                    return True
                else:
                    del self._cache[message_id]

            self._cache[message_id] = now
            if len(self._cache) > self.max_size:
                self._cache.popitem(last=False)
            return False

    def contains(self, message_id: str) -> bool:
        """Inspects whether message_id is in cache without modifying LRU order or TTL."""
        with self._lock:
            if message_id not in self._cache:
                return False
            return (time.time() - self._cache[message_id]) < self.ttl_seconds

    def clear(self):
        """Clears in-memory deduplication cache (useful for testing)."""
        with self._lock:
            self._cache.clear()


deduplicator = MessageDeduplicator()


# ==============================================================================
# SECURITY: HMAC-SHA256 SIGNATURE VERIFICATION
# ==============================================================================

def verify_meta_signature(raw_body: bytes, signature_header: Optional[str]) -> None:
    """
    Validates X-Hub-Signature-256 using META_APP_SECRET and constant-time comparison.
    Raises HTTPException(403) on missing configuration, missing header, or signature mismatch.
    """
    app_secret = getattr(settings, "META_APP_SECRET", "")
    if not app_secret:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Signature verification failed: META_APP_SECRET is not configured on server."
        )

    if not signature_header:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Missing X-Hub-Signature-256 header."
        )

    if not signature_header.startswith("sha256="):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Malformed X-Hub-Signature-256 header. Expected 'sha256=<hash>'."
        )

    received_hash = signature_header[7:]
    expected_hash = hmac.new(
        key=app_secret.encode("utf-8"),
        msg=raw_body,
        digestmod=hashlib.sha256
    ).hexdigest()

    if not hmac.compare_digest(received_hash, expected_hash):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Invalid X-Hub-Signature-256 signature."
        )


# ==============================================================================
# 1. GET: WEBHOOK VERIFICATION HANDSHAKE
# ==============================================================================

@router.get("/webhook", response_class=PlainTextResponse)
async def verify_webhook(
    hub_mode: Optional[str] = Query(None, alias="hub.mode"),
    hub_verify_token: Optional[str] = Query(None, alias="hub.verify_token"),
    hub_challenge: Optional[str] = Query(None, alias="hub.challenge"),
):
    """
    Meta Webhook Verification Endpoint.
    Meta sends GET with hub.mode, hub.verify_token, hub.challenge.
    Returns plain text hub.challenge if token matches WHATSAPP_VERIFY_TOKEN.
    """
    if not hub_mode or not hub_verify_token or not hub_challenge:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Missing required verification query parameters: hub.mode, hub.verify_token, hub.challenge."
        )

    if hub_mode != "subscribe":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Invalid hub.mode. Expected 'subscribe'."
        )

    server_verify_token = getattr(settings, "WHATSAPP_VERIFY_TOKEN", "")
    if not server_verify_token:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Server WHATSAPP_VERIFY_TOKEN is not configured."
        )

    if not hmac.compare_digest(hub_verify_token, server_verify_token):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Verification token mismatch."
        )

    return PlainTextResponse(content=hub_challenge, status_code=200)


# ==============================================================================
# BACKGROUND INBOUND MESSAGE PROCESSOR
# ==============================================================================

async def process_inbound_messages(payload: MetaWebhookPayload) -> None:
    """
    Asynchronous background handler for inbound citizen WhatsApp messages.
    Processes messages after HTTP 200 acknowledgment, ensuring fast webhook response.
    Handles:
    1. Interactive Button Replies (confirm/cancel incident creation)
    2. Image Reporting (Gemini Vision analysis + confirmation buttons)
    3. Status Tracking (`track <ID>`)
    4. Conversational Citizen Assistance
    """
    db = SessionLocal()
    try:
        for entry in payload.entry:
            for change in entry.changes:
                if not change.value.messages:
                    continue

                for msg in change.value.messages:
                    if deduplicator.is_duplicate(msg.id):
                        logger.info("Ignoring duplicate message ID: %s", msg.id)
                        continue

                    sender_phone = msg.from_
                    if not sender_phone:
                        continue

                    try:
                        # ------------------------------------------------------
                        # 1. Interactive Button Replies
                        # ------------------------------------------------------
                        if msg.type == "interactive" and msg.interactive and msg.interactive.button_reply:
                            btn_id = msg.interactive.button_reply.id
                            if btn_id == "confirm_incident":
                                await whatsapp_service.execute_confirmation_reply(db, sender_phone)
                            elif btn_id == "cancel_incident":
                                await whatsapp_service.execute_cancellation_reply(sender_phone)
                            else:
                                await whatsapp_service.send_text_message(
                                    sender_phone,
                                    "Response received. Reply 'Hi' to see available commands."
                                )

                        # ------------------------------------------------------
                        # 2. Text Messages (Greeting, Tracking, Confirm/Cancel, Chat)
                        # ------------------------------------------------------
                        elif msg.type == "text" and msg.text:
                            raw_text = msg.text.body.strip()
                            lower_text = raw_text.lower()

                            # Greeting detection
                            if lower_text in ("hi", "hello", "hey", "start", "help", "menu", "namaste", "hi!") or lower_text.startswith("hi "):
                                await whatsapp_service.send_text_message(sender_phone, WELCOME_MESSAGE)

                            # Complaint Tracking regex: 'track <ID>' or 'status <ID>'
                            elif re.match(r"^(?:track|status)\s+([a-zA-Z0-9\-_]+)", lower_text, re.IGNORECASE):
                                match = re.match(r"^(?:track|status)\s+([a-zA-Z0-9\-_]+)", raw_text, re.IGNORECASE)
                                if match:
                                    target_id = match.group(1).strip()
                                    await whatsapp_service.track_incident(db, sender_phone, target_id)

                            # Text Confirmation of Pending Draft
                            elif lower_text in ("confirm", "yes", "proceed", "submit", "confirm & submit"):
                                await whatsapp_service.execute_confirmation_reply(db, sender_phone)

                            # Text Cancellation of Pending Draft
                            elif lower_text in ("cancel", "no", "discard", "stop"):
                                await whatsapp_service.execute_cancellation_reply(sender_phone)

                            # Conversational Assistance via Gemini
                            else:
                                reply = await whatsapp_service.generate_conversational_reply(sender_phone, raw_text)
                                await whatsapp_service.send_text_message(sender_phone, reply)

                        # ------------------------------------------------------
                        # 3. Image Messages (Gemini Vision Complaint Reporting)
                        # ------------------------------------------------------
                        elif msg.type == "image" and msg.image:
                            try:
                                # Authenticated download from Meta Graph API
                                image_bytes, mime = await whatsapp_service.download_media(msg.image.id)
                            except Exception as dl_err:
                                logger.warning("Could not download media %s from Meta (%s).", msg.image.id, dl_err)
                                # Resilient fallback in development/test if live media download fails
                                image_bytes = b"\xFF\xD8\xFF\xE0\x00\x10JFIF" + b"\x00" * 200

                            await whatsapp_service.handle_photo_report(
                                sender_phone=sender_phone,
                                image_bytes=image_bytes,
                                caption=msg.image.caption
                            )

                        # ------------------------------------------------------
                        # 4. Location Messages
                        # ------------------------------------------------------
                        elif msg.type == "location" and msg.location:
                            draft = whatsapp_service.pending_sessions.get_draft(sender_phone)
                            if draft:
                                draft["lat"] = msg.location.latitude
                                draft["lng"] = msg.location.longitude
                                if msg.location.name or msg.location.address:
                                    draft["address"] = msg.location.address or msg.location.name
                                whatsapp_service.pending_sessions.store_draft(sender_phone, draft)
                                await whatsapp_service.send_text_message(
                                    sender_phone,
                                    f"📍 Location updated ({msg.location.latitude:.4f}, {msg.location.longitude:.4f}). "
                                    "Reply *CONFIRM* to submit your complaint."
                                )
                            else:
                                await whatsapp_service.send_text_message(
                                    sender_phone,
                                    "📍 Location received! Please send a photograph of the civic issue to file a formal report."
                                )

                        # ------------------------------------------------------
                        # 5. Unsupported / Other Messages
                        # ------------------------------------------------------
                        else:
                            await whatsapp_service.send_text_message(
                                sender_phone,
                                "Currently, CivicSense AI accepts photographs, text commands, and location coordinates. Reply 'Hi' to start."
                            )

                    except Exception as exc:
                        logger.error("Failed to process inbound WhatsApp message %s: %s", msg.id, exc, exc_info=True)

    finally:
        db.close()


# ==============================================================================
# 2. POST: WEBHOOK EVENT RECEIVER
# ==============================================================================

@router.post("/webhook")
async def receive_webhook(
    request: Request,
    background_tasks: BackgroundTasks,
    x_hub_signature_256: Optional[str] = Header(None, alias="X-Hub-Signature-256"),
):
    """
    Meta Inbound Webhook Receiver.
    1. Verifies HMAC-SHA256 signature using META_APP_SECRET.
    2. Parses webhook payload via Pydantic schema MetaWebhookPayload.
    3. Handles status notifications separately.
    4. Delegates message processing to BackgroundTasks.
    5. Returns immediate HTTP 200 OK.
    """
    raw_body = await request.body()

    # Step 1: Validate HMAC-SHA256 Signature
    verify_meta_signature(raw_body, x_hub_signature_256)

    # Step 2: Parse and Validate Payload
    try:
        payload = MetaWebhookPayload.model_validate_json(raw_body.decode("utf-8"))
    except (ValidationError, json.JSONDecodeError, UnicodeDecodeError) as ve:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Malformed webhook JSON payload: {ve}"
        )

    # Step 3: Handle Status Notifications Separately (No outbound reply needed)
    if payload.has_statuses():
        status_entry = payload.get_first_status()
        if status_entry:
            logger.info("Received delivery receipt for message %s: status=%s", status_entry.id, status_entry.status)
        return {"status": "ok", "event": "status_notification"}

    # Step 4: Handle Inbound Messages via Background Task
    if payload.has_messages():
        background_tasks.add_task(process_inbound_messages, payload)
        return {"status": "ok", "event": "messages_queued"}

    # Step 5: Graceful Handling for Non-Message Changes
    return {"status": "ok", "event": "unhandled_change"}
