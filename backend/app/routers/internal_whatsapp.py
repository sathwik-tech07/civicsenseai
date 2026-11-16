"""
CivicSense AI - Internal WhatsApp Gateway Router
Receives inbound events from the Go WhatsApp Gateway (whatsmeow),
validates HMAC-SHA256 signatures, provides in-memory deduplication,
and processes events through the CivicSense AI AgentRuntime, RAG, and incident workflows.
Also provides administrative endpoints for device pairing and status inspection.
"""

import base64
import hashlib
import hmac
import logging
import math
import re
import time
from typing import Optional, Dict, Any

import httpx
from fastapi import APIRouter, Request, Header, BackgroundTasks, HTTPException, status, Depends
from sqlalchemy.orm import Session

from app.config import settings
from app.database import SessionLocal, get_db
from app.models.incident import Incident
from app.models.user import User
from app.utils.dependencies import require_admin_or_commissioner
from app.schemas.gateway import (
    GatewayInboundEvent,
    GatewayStatusResponse,
    GatewayQRResponse,
    GatewayOutboundRequest,
    GatewayOutboundResponse,
)
from app.services.whatsapp_service import (
    whatsapp_service,
    WhatsAppAPIError,
    WhatsAppNetworkError,
)
from app.services.storage_service import get_storage_provider
from app.utils.image_security import detect_image_format
from app.routers.whatsapp import deduplicator, WELCOME_MESSAGE

logger = logging.getLogger("civicsense.whatsapp.gateway_router")

router = APIRouter(tags=["Internal WhatsApp Gateway"])


# ==============================================================================
# SECURITY: HMAC-SHA256 & BEARER AUTHENTICATION
# ==============================================================================

def verify_gateway_auth(
    raw_body: bytes,
    signature_header: Optional[str] = Header(None, alias="X-Gateway-Signature"),
    timestamp_header: Optional[str] = Header(None, alias="X-Gateway-Timestamp"),
    auth_header: Optional[str] = Header(None, alias="Authorization"),
) -> None:
    """
    Validates either:
    1. Bearer Token in Authorization header matching WHATSAPP_GATEWAY_SECRET.
    2. HMAC-SHA256 signature in X-Gateway-Signature header with timestamp freshness.
    """
    gateway_secret = getattr(settings, "WHATSAPP_GATEWAY_SECRET", "")
    if not gateway_secret:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Gateway authentication failed: WHATSAPP_GATEWAY_SECRET is not configured on server.",
        )

    # 1. Bearer Token Check
    if auth_header and auth_header.lower().startswith("bearer "):
        token = auth_header[7:].strip()
        if hmac.compare_digest(token, gateway_secret):
            return

    # 2. HMAC-SHA256 Signature Check
    if signature_header and timestamp_header:
        try:
            ts = float(timestamp_header)
        except (ValueError, TypeError):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Malformed X-Gateway-Timestamp header.",
            )

        # Replay protection: max 300 seconds skew
        if math.fabs(time.time() - ts) > 300:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="X-Gateway-Timestamp exceeds maximum clock skew (300 seconds).",
            )

        clean_sig = signature_header[7:] if signature_header.startswith("sha256=") else signature_header

        # Expected message is f"{timestamp_header}." + raw_body
        expected_msg = f"{timestamp_header}.".encode("utf-8") + raw_body
        expected_sig = hmac.new(
            key=gateway_secret.encode("utf-8"),
            msg=expected_msg,
            digestmod=hashlib.sha256,
        ).hexdigest()

        if hmac.compare_digest(clean_sig, expected_sig):
            return

    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Unauthorized: invalid or missing gateway credentials.",
    )


# ==============================================================================
# INBOUND MESSAGE PROCESSING WORKER
# ==============================================================================

async def process_gateway_inbound_event(event: GatewayInboundEvent) -> None:
    """
    Asynchronously processes an inbound message event from the Go WhatsApp Gateway.
    Executes the full CivicSense AI civic pipeline:
    - Interactive commands (confirm, cancel)
    - Staff authentication & administrative operations
    - Field engineer task lifecycle (accept, start, update, resolve)
    - Citizen tracking, history, feedback, escalation
    - Multimodal photo reporting with Gemini Vision
    - GPS location pin binding
    - Conversational AI triage via AgentRuntime
    """
    msg = event.message
    if not msg:
        return

    msg_id = msg.id
    if deduplicator.is_duplicate(msg_id):
        logger.info("Ignoring duplicate gateway message ID: %s", msg_id)
        return

    sender_phone = msg.from_
    if not sender_phone:
        return

    db = SessionLocal()
    try:
        # 1. Text Messages (Commands, Citizen Chat, Confirmations)
        if msg.type == "text" and msg.text:
            raw_text = msg.text.body.strip()
            lower_text = raw_text.lower()
            user_role = whatsapp_service.get_user_role(db, sender_phone)

            # A. Staff Device Authentication & Secure OTP Linking
            auth_match = re.match(
                r"^(?:staff\s+(?:login|link|verify)|(?:engineer|commissioner|admin)\s+(?:login|link|verify)|link)\s+(\S+)(?:\s+(.+))?$",
                raw_text,
                re.IGNORECASE,
            )
            verify_match = re.match(
                r"^(?:verify|code|staff\s+verify)\s+(\d{6})$",
                raw_text,
                re.IGNORECASE,
            )
            if auth_match:
                first_arg = auth_match.group(1)
                second_arg = auth_match.group(2)
                success, msg_text = whatsapp_service.authenticate_staff(db, sender_phone, first_arg, second_arg)
                await whatsapp_service.send_text_message(sender_phone, msg_text)
            elif verify_match:
                code_arg = verify_match.group(1)
                success, msg_text = whatsapp_service.otp_manager.verify_otp(db, sender_phone, code_arg)
                await whatsapp_service.send_text_message(sender_phone, msg_text)

            # B. Commissioner / Executive Commands
            elif lower_text in ("summary", "status summary", "executive summary"):
                if user_role in ("commissioner", "admin"):
                    await whatsapp_service.get_executive_summary(db, sender_phone)
                else:
                    await whatsapp_service.send_text_message(
                        sender_phone,
                        "⚠️ Access denied. Executive summary is restricted to municipal commissioners. "
                        "Please contact your system administrator to register your official staff device.",
                    )

            # C. Field Engineer Commands
            elif lower_text in ("tasks", "my tasks", "assigned", "my assignments"):
                if user_role in ("engineer", "admin"):
                    await whatsapp_service.get_engineer_tasks(db, sender_phone)
                else:
                    await whatsapp_service.send_text_message(
                        sender_phone,
                        "⚠️ Access denied. Work order queue is restricted to field engineers. "
                        "Please contact your system administrator to register your official staff device.",
                    )

            elif re.match(r"^accept\s+([a-zA-Z0-9\-_]+)", lower_text):
                match = re.match(r"^accept\s+([a-zA-Z0-9\-_]+)", raw_text, re.IGNORECASE)
                if match:
                    if user_role not in ("engineer", "admin"):
                        await whatsapp_service.send_text_message(
                            sender_phone,
                            "⚠️ Access denied. Field engineer operations require an authenticated engineer account linked to this device.",
                        )
                    else:
                        await whatsapp_service.engineer_accept_assignment(db, sender_phone, match.group(1))

            elif re.match(r"^reject\s+([a-zA-Z0-9\-_]+)", lower_text):
                match = re.match(r"^reject\s+([a-zA-Z0-9\-_]+)(?:\s+(.*))?", raw_text, re.IGNORECASE)
                if match:
                    if user_role not in ("engineer", "admin"):
                        await whatsapp_service.send_text_message(
                            sender_phone,
                            "⚠️ Access denied. Field engineer operations require an authenticated engineer account linked to this device.",
                        )
                    else:
                        await whatsapp_service.engineer_reject_assignment(
                            db, sender_phone, match.group(1), match.group(2) or "Reassignment required"
                        )

            elif re.match(r"^start(?:\s+work)?\s+([a-zA-Z0-9\-_]+)", lower_text):
                match = re.match(r"^start(?:\s+work)?\s+([a-zA-Z0-9\-_]+)", raw_text, re.IGNORECASE)
                if match:
                    if user_role not in ("engineer", "admin"):
                        await whatsapp_service.send_text_message(
                            sender_phone,
                            "⚠️ Access denied. Field engineer operations require an authenticated engineer account linked to this device.",
                        )
                    else:
                        await whatsapp_service.engineer_start_work(db, sender_phone, match.group(1))

            elif re.match(r"^update\s+([a-zA-Z0-9\-_]+)\s+(.+)", lower_text):
                match = re.match(r"^update\s+([a-zA-Z0-9\-_]+)\s+(.+)", raw_text, re.IGNORECASE)
                if match:
                    if user_role not in ("engineer", "admin"):
                        await whatsapp_service.send_text_message(
                            sender_phone,
                            "⚠️ Access denied. Field engineer operations require an authenticated engineer account linked to this device.",
                        )
                    else:
                        await whatsapp_service.engineer_update_progress(db, sender_phone, match.group(1), match.group(2))

            elif re.match(r"^resolve\s+([a-zA-Z0-9\-_]+)", lower_text):
                match = re.match(r"^resolve\s+([a-zA-Z0-9\-_]+)", raw_text, re.IGNORECASE)
                if match:
                    if user_role not in ("engineer", "admin"):
                        await whatsapp_service.send_text_message(
                            sender_phone,
                            "⚠️ Access denied. Field engineer operations require an authenticated engineer account linked to this device.",
                        )
                    else:
                        await whatsapp_service.engineer_resolve_incident(db, sender_phone, match.group(1))

            # D. Citizen Tracking
            elif re.search(r"\b(?:track|status)\s+([a-zA-Z0-9\-_]+)", lower_text) or re.search(r"status of\s+([a-zA-Z0-9\-_]+)", lower_text):
                match = re.search(r"\b(?:track|status)\s+([a-zA-Z0-9\-_]+)", raw_text, re.IGNORECASE) or re.search(r"status of\s+([a-zA-Z0-9\-_]+)", raw_text, re.IGNORECASE)
                if match:
                    await whatsapp_service.track_incident(db, sender_phone, match.group(1).strip())

            # E. Citizen History
            elif lower_text in ("show my complaints", "my complaints", "my tickets", "check my complaints", "list my complaints", "my reports"):
                await whatsapp_service.get_citizen_complaint_history(db, sender_phone)

            # F. Citizen Escalation
            elif re.match(r"^escalate\s+([a-zA-Z0-9\-_]+)", lower_text):
                match = re.match(r"^escalate\s+([a-zA-Z0-9\-_]+)(?:\s+(.*))?", raw_text, re.IGNORECASE)
                if match:
                    await whatsapp_service.escalate_incident(db, sender_phone, match.group(1), match.group(2) or "Delay in resolution")

            # G. Citizen Feedback / Rating
            elif re.match(r"^rate\s+([a-zA-Z0-9\-_]+)\s+([1-5])", lower_text):
                match = re.match(r"^rate\s+([a-zA-Z0-9\-_]+)\s+([1-5])(?:\s+(.*))?", raw_text, re.IGNORECASE)
                if match:
                    await whatsapp_service.record_citizen_feedback(db, sender_phone, match.group(1), int(match.group(2)), match.group(3))

            elif re.match(r"^feedback\s+([a-zA-Z0-9\-_]+)\s+(.+)", lower_text):
                match = re.match(r"^feedback\s+([a-zA-Z0-9\-_]+)\s+(.+)", raw_text, re.IGNORECASE)
                if match:
                    await whatsapp_service.record_citizen_feedback(db, sender_phone, match.group(1), 5, match.group(2))

            # H. Confirmation of Pending Draft
            elif lower_text in ("confirm", "yes", "proceed", "submit", "confirm & submit", "confirm incident"):
                await whatsapp_service.execute_confirmation_reply(db, sender_phone)

            # I. Cancellation of Pending Draft
            elif lower_text in ("cancel", "no", "discard", "stop", "cancel incident"):
                await whatsapp_service.execute_cancellation_reply(sender_phone, db=db)

            # J. Address Update for Pending Draft
            elif whatsapp_service.pending_sessions.get_draft(sender_phone, db=db) and (
                lower_text.startswith("address:") or lower_text.startswith("location:") or
                lower_text.startswith("near ") or lower_text.startswith("at ") or lower_text.startswith("in ")
            ):
                await whatsapp_service.update_draft_address(sender_phone, raw_text, db=db)

            # K. Greetings & Help
            elif lower_text in (
                "hi", "hello", "hey", "start", "help", "menu", "namaste", "hi!",
                "hlo", "helo", "halo", "hii", "hiii", "hy", "namaskar"
            ) or lower_text.startswith("hi ") or lower_text.startswith("hello ") or lower_text.startswith("hlo "):
                await whatsapp_service.send_text_message(sender_phone, WELCOME_MESSAGE)

            # L. Conversational Complaint Initiation (Civic problem keywords)
            elif any(k in lower_text for k in (
                "pothole", "crater", "garbage", "trash", "waste", "water leak", "pipe burst", "leak",
                "streetlight", "light pole", "drain", "drainage", "sewer", "sinkhole", "road damage",
                "broken road", "water pipe", "flooding", "manhole"
            )):
                await whatsapp_service.handle_conversational_text_draft(sender_phone, raw_text, db=db)

            # M. General Conversational Civic Assistance via Gemini 2.5 Flash
            else:
                reply = await whatsapp_service.generate_conversational_reply(sender_phone, raw_text)
                await whatsapp_service.send_text_message(sender_phone, reply)

        # 2. Image Messages (Complaint Reporting, Resolution Evidence, or Supplemental Photo)
        elif msg.type == "image":
            media = msg.resolved_media
            image_bytes = None
            caption = ""

            if media:
                caption = (media.caption or "").strip()
                if media.data_base64:
                    try:
                        image_bytes = base64.b64decode(media.data_base64)
                    except Exception as e:
                        logger.warning("Failed to decode base64 image from gateway: %s", e)

            if not image_bytes:
                image_bytes = b"\xFF\xD8\xFF\xE0\x00\x10JFIF" + b"\x00" * 200

            cap_lower = caption.lower()

            # If engineer caption contains "resolve <ID>"
            if re.search(r"resolve\s+([a-zA-Z0-9\-_]+)", cap_lower):
                match = re.search(r"resolve\s+([a-zA-Z0-9\-_]+)", caption, re.IGNORECASE)
                if match:
                    target_inc_id = match.group(1).strip().upper()
                    inc = db.query(Incident).filter(Incident.id.ilike(target_inc_id)).first()
                    if not inc:
                        await whatsapp_service.send_text_message(
                            sender_phone, f"❌ Incident '{target_inc_id}' was not found or is not accessible."
                        )
                    else:
                        authorized, user, err_msg = whatsapp_service._verify_engineer_access(
                            db, sender_phone, inc, action="resolve"
                        )
                        if not authorized:
                            await whatsapp_service.send_text_message(sender_phone, err_msg)
                        else:
                            format_info = detect_image_format(image_bytes)
                            if not format_info:
                                await whatsapp_service.send_text_message(
                                    sender_phone,
                                    "❌ Unsupported image format. Please send a genuine JPEG, PNG, or WEBP photo to resolve the incident.",
                                )
                            else:
                                _, mime_type, safe_ext = format_info
                                storage_provider = get_storage_provider()
                                stored = await storage_provider.store_image(
                                    contents=image_bytes,
                                    safe_ext=safe_ext,
                                    mime_type=mime_type,
                                    prefix="uploads",
                                )
                                stored_key = stored["filename"]
                                resolution_photo_url = (
                                    stored_key if stored_key.startswith("uploads/") else f"/uploads/{stored_key}"
                                )
                                await whatsapp_service.engineer_resolve_incident(
                                    db,
                                    sender_phone,
                                    target_inc_id,
                                    photo_url=resolution_photo_url,
                                    notes="Resolution photo uploaded via WhatsApp.",
                                )
                else:
                    await whatsapp_service.handle_photo_report(
                        sender_phone=sender_phone, image_bytes=image_bytes, caption=caption, db=db
                    )

            # If caption contains "evidence <ID>"
            elif re.search(r"evidence\s+(?:for\s+)?([a-zA-Z0-9\-_]+)", cap_lower):
                match = re.search(r"evidence\s+(?:for\s+)?([a-zA-Z0-9\-_]+)", caption, re.IGNORECASE)
                if match:
                    await whatsapp_service.submit_additional_evidence(
                        db, sender_phone, match.group(1), image_bytes, caption
                    )
                else:
                    await whatsapp_service.handle_photo_report(
                        sender_phone=sender_phone, image_bytes=image_bytes, caption=caption, db=db
                    )

            # Default: New Complaint Photo Report
            else:
                await whatsapp_service.handle_photo_report(
                    sender_phone=sender_phone,
                    image_bytes=image_bytes,
                    caption=caption,
                    db=db,
                )

        # 3. Location Messages
        elif msg.type == "location" and msg.location:
            draft = whatsapp_service.pending_sessions.get_draft(sender_phone, db=db)
            if draft:
                loc_addr = msg.location.address or msg.location.name
                await whatsapp_service.update_draft_location(
                    sender_phone,
                    lat=msg.location.latitude,
                    lng=msg.location.longitude,
                    address=loc_addr,
                    db=db,
                )
            else:
                loc_addr = msg.location.address or msg.location.name or "Pinned Location (Reported via WhatsApp)"
                whatsapp_service.pending_sessions.store_draft(
                    sender_phone,
                    {
                        "lat": msg.location.latitude,
                        "lng": msg.location.longitude,
                        "address": loc_addr,
                        "status": "awaiting_photo_or_description",
                    },
                    db=db,
                )
                await whatsapp_service.send_text_message(
                    sender_phone,
                    f"📍 Location received ({loc_addr})! Please send a photograph or description of the civic problem to file your report.",
                )

        else:
            await whatsapp_service.send_text_message(
                sender_phone,
                "Currently, CivicSense AI accepts photographs, text commands, and location coordinates. Reply 'Hi' to start.",
            )

    except Exception as exc:
        logger.error("Failed to process inbound gateway message %s: %s", msg_id, exc, exc_info=True)
    finally:
        db.close()


# ==============================================================================
# 1. POST: INTERNAL GATEWAY EVENT WEBHOOK
# ==============================================================================

@router.post("/internal/whatsapp/events", status_code=status.HTTP_200_OK)
async def receive_gateway_event(
    request: Request,
    background_tasks: BackgroundTasks,
    signature_header: Optional[str] = Header(None, alias="X-Gateway-Signature"),
    timestamp_header: Optional[str] = Header(None, alias="X-Gateway-Timestamp"),
    auth_header: Optional[str] = Header(None, alias="Authorization"),
):
    """
    Internal Webhook Receiver for Go WhatsApp Gateway.
    Verifies HMAC-SHA256 signature and schedules asynchronous event processing.
    """
    raw_body = await request.body()
    verify_gateway_auth(
        raw_body=raw_body,
        signature_header=signature_header,
        timestamp_header=timestamp_header,
        auth_header=auth_header,
    )

    try:
        event = GatewayInboundEvent.model_validate_json(raw_body)
    except Exception as e:
        logger.warning("Rejected invalid gateway event JSON: %s", e)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid event payload: {e}",
        )

    if event.event_type == "message" and event.message:
        background_tasks.add_task(process_gateway_inbound_event, event)
    else:
        logger.info("Received gateway event: %s", event.event_type)

    return {"status": "ok", "event_id": event.event_id}


# ==============================================================================
# 2. ADMINISTRATIVE & PAIRING ENDPOINTS
# ==============================================================================

@router.get("/api/v1/admin/whatsapp/status", response_model=GatewayStatusResponse)
async def get_gateway_status(current_user: User = Depends(require_admin_or_commissioner)):
    """
    Inspects active WhatsApp connection telemetry by querying the Go Gateway.
    Restricted to authenticated Administrator and Commissioner roles.
    """
    gateway_url = getattr(settings, "WHATSAPP_GATEWAY_URL", "http://localhost:8085").rstrip("/")
    secret = getattr(settings, "WHATSAPP_GATEWAY_SECRET", "civicsense-wa-gateway-internal-secret-2026")

    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            resp = await client.get(
                f"{gateway_url}/api/v1/status",
                headers={"Authorization": f"Bearer {secret}"},
            )
            if resp.status_code == 200:
                data = resp.json()
                if "uptime_seconds" in data and isinstance(data["uptime_seconds"], (float, int)):
                    data["uptime_seconds"] = round(float(data["uptime_seconds"]), 1)
                return data
            raise HTTPException(status_code=resp.status_code, detail=resp.text)
    except httpx.RequestError as re:
        logger.warning("Could not reach WhatsApp Gateway at %s: %s", gateway_url, re)
        return GatewayStatusResponse(
            status="offline",
            connected=False,
            logged_in=False,
            uptime_seconds=0,
            goroutines=0,
            memory_alloc_mb=0.0,
        )


@router.get("/api/v1/admin/whatsapp/qr", response_model=GatewayQRResponse)
async def get_gateway_qr(current_user: User = Depends(require_admin_or_commissioner)):
    """
    Retrieves the current pairing QR code for commissioner/admin dashboard display.
    Restricted to authenticated Administrator and Commissioner roles.
    """
    gateway_url = getattr(settings, "WHATSAPP_GATEWAY_URL", "http://localhost:8085").rstrip("/")
    secret = getattr(settings, "WHATSAPP_GATEWAY_SECRET", "civicsense-wa-gateway-internal-secret-2026")

    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            resp = await client.get(
                f"{gateway_url}/api/v1/qr",
                headers={"Authorization": f"Bearer {secret}"},
            )
            if resp.status_code == 200:
                return resp.json()
            raise HTTPException(status_code=resp.status_code, detail=resp.text)
    except httpx.RequestError as re:
        logger.warning("Could not reach WhatsApp Gateway QR endpoint at %s: %s", gateway_url, re)
        return GatewayQRResponse(
            status="offline",
            qr_code=None,
            qr_png_base64=None,
        )


@router.post("/api/v1/admin/whatsapp/reconnect")
async def trigger_gateway_reconnect(current_user: User = Depends(require_admin_or_commissioner)):
    """
    Triggers the Go Gateway to reconnect to WhatsApp network.
    Restricted to authenticated Administrator and Commissioner roles.
    """
    gateway_url = getattr(settings, "WHATSAPP_GATEWAY_URL", "http://localhost:8085").rstrip("/")
    secret = getattr(settings, "WHATSAPP_GATEWAY_SECRET", "civicsense-wa-gateway-internal-secret-2026")

    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            resp = await client.post(
                f"{gateway_url}/api/v1/reconnect",
                headers={"Authorization": f"Bearer {secret}"},
            )
            return resp.json()
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(e))


@router.post("/api/v1/admin/whatsapp/disconnect")
async def trigger_gateway_disconnect(current_user: User = Depends(require_admin_or_commissioner)):
    """
    Breaks active WhatsApp WebSocket session.
    Restricted to authenticated Administrator and Commissioner roles.
    """
    gateway_url = getattr(settings, "WHATSAPP_GATEWAY_URL", "http://localhost:8085").rstrip("/")
    secret = getattr(settings, "WHATSAPP_GATEWAY_SECRET", "civicsense-wa-gateway-internal-secret-2026")

    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            resp = await client.post(
                f"{gateway_url}/api/v1/disconnect",
                headers={"Authorization": f"Bearer {secret}"},
            )
            return resp.json()
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(e))


@router.get("/api/v1/admin/whatsapp/queue")
async def get_gateway_queue_status(current_user: User = Depends(require_admin_or_commissioner)):
    """
    Retrieves queue telemetry and permanent failures for administrator oversight.
    Restricted to authenticated Administrator and Commissioner roles.
    """
    gateway_url = getattr(settings, "WHATSAPP_GATEWAY_URL", "http://localhost:8085").rstrip("/")
    secret = getattr(settings, "WHATSAPP_GATEWAY_SECRET", "civicsense-wa-gateway-internal-secret-2026")

    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            headers = {"Authorization": f"Bearer {secret}"}
            status_resp = await client.get(f"{gateway_url}/api/v1/queue/status", headers=headers)
            failed_resp = await client.get(f"{gateway_url}/api/v1/queue/failed", headers=headers)

            stats = status_resp.json() if status_resp.status_code == 200 else {}
            failures = failed_resp.json() if failed_resp.status_code == 200 else []

            return {
                "status": "online",
                "stats": stats,
                "recent_failures": failures,
            }
    except Exception as e:
        logger.warning("Could not reach WhatsApp Gateway queue endpoint at %s: %s", gateway_url, e)
        return {
            "status": "offline",
            "stats": {"pending_count": 0, "failed_count": 0, "acknowledged_count": 0},
            "recent_failures": [],
        }
