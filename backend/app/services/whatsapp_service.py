"""
CivicSense AI - Meta WhatsApp Cloud API Service Client
Handles outbound WhatsApp messaging (text, interactive buttons), authenticated
media downloading via Meta Graph API, and connects directly to Gemini 2.5 Flash
Multimodal Vision without modifying core AI logic.
"""

import re
import logging
import asyncio
from typing import Dict, Any, List, Optional, Tuple
import httpx

from app.config import settings
from app.services.ai_service import AIService

logger = logging.getLogger("civicsense.whatsapp")


# ==============================================================================
# CUSTOM WHATSAPP EXCEPTIONS
# ==============================================================================

class WhatsAppServiceError(Exception):
    """Base exception for all WhatsApp service operations."""
    pass


class WhatsAppConfigurationError(WhatsAppServiceError):
    """Raised when required Meta WhatsApp credentials are missing."""
    pass


class WhatsAppAuthenticationError(WhatsAppServiceError):
    """Raised when Meta API rejects access token (HTTP 401/403)."""
    pass


class WhatsAppInvalidRecipientError(WhatsAppServiceError):
    """Raised when recipient phone number is missing, malformed, or invalid."""
    pass


class WhatsAppAPIError(WhatsAppServiceError):
    """Raised when Meta API returns an error response."""
    def __init__(self, message: str, status_code: Optional[int] = None, error_data: Optional[Dict[str, Any]] = None):
        super().__init__(message)
        self.status_code = status_code
        self.error_data = error_data or {}


class WhatsAppNetworkError(WhatsAppServiceError):
    """Raised when network connection to Meta Graph API fails."""
    pass


class WhatsAppTimeoutError(WhatsAppServiceError):
    """Raised when Meta Graph API request times out."""
    pass


class WhatsAppInvalidMediaError(WhatsAppServiceError):
    """Raised when media ID is invalid or media metadata is missing/expired."""
    pass


class WhatsAppUnsupportedMimeTypeError(WhatsAppServiceError):
    """Raised when media MIME type is not an allowed format."""
    pass


class WhatsAppOversizedMediaError(WhatsAppServiceError):
    """Raised when media file size exceeds configured threshold."""
    pass


# ==============================================================================
# SERVICE CLIENT IMPLEMENTATION
# ==============================================================================

class WhatsAppService:
    """
    Async client for Meta WhatsApp Cloud API.
    Provides methods for sending messages, downloading incoming media,
    and delegating image analysis to Gemini 2.5 Flash Vision.
    """

    ALLOWED_IMAGE_MIMES = {
        "image/jpeg",
        "image/png",
        "image/webp",
        "image/jpg",
    }

    def __init__(
        self,
        phone_number_id: Optional[str] = None,
        access_token: Optional[str] = None,
        api_version: Optional[str] = None,
        timeout: float = 15.0,
        max_media_bytes: int = 16 * 1024 * 1024,  # 16 MB limit
        max_retries: int = 2,
        backoff_seconds: float = 0.2,
    ):
        self.phone_number_id = phone_number_id or settings.WHATSAPP_PHONE_NUMBER_ID
        self.access_token = access_token or settings.WHATSAPP_ACCESS_TOKEN
        self.api_version = api_version or settings.WHATSAPP_API_VERSION or "v21.0"
        self.base_url = f"https://graph.facebook.com/{self.api_version}"
        self.timeout = timeout
        self.max_media_bytes = max_media_bytes
        self.max_retries = max_retries
        self.backoff_seconds = backoff_seconds

    def _redact_secrets(self, text: Any) -> str:
        """Redacts sensitive credentials from error messages, URLs, and exception text."""
        if text is None:
            return ""
        scrubbed = str(text)
        if self.access_token:
            scrubbed = scrubbed.replace(self.access_token, "[REDACTED_ACCESS_TOKEN]")
        # Also scrub any Bearer tokens
        scrubbed = re.sub(r"Bearer\s+([a-zA-Z0-9_\-\.]{10,})", "Bearer [REDACTED_ACCESS_TOKEN]", scrubbed)
        return scrubbed

    def _validate_credentials(self) -> None:
        """Validates that necessary credentials are present before calling Meta."""
        if not self.phone_number_id:
            raise WhatsAppConfigurationError(
                "WHATSAPP_PHONE_NUMBER_ID is not configured in settings."
            )
        if not self.access_token:
            raise WhatsAppConfigurationError(
                "WHATSAPP_ACCESS_TOKEN is not configured in settings."
            )

    def _get_auth_headers(self) -> Dict[str, str]:
        """Builds authenticated headers without exposing token in logs."""
        return {
            "Authorization": f"Bearer {self.access_token}",
            "Content-Type": "application/json",
        }

    @staticmethod
    def _clean_recipient(recipient: str) -> str:
        """
        Cleans and validates citizen phone number (E.164 without leading plus).
        Example: '+91 98765-43210' -> '919876543210'
        """
        if not recipient or not isinstance(recipient, str):
            raise WhatsAppInvalidRecipientError("Recipient phone number must be a non-empty string.")

        cleaned = re.sub(r"[^\d]", "", recipient)
        if len(cleaned) < 7 or len(cleaned) > 15:
            raise WhatsAppInvalidRecipientError(
                f"Invalid phone number '{recipient}'. Expected 7-15 digits E.164 format."
            )
        return cleaned

    def _handle_http_error(self, exc: httpx.HTTPStatusError) -> None:
        """Maps HTTP status errors from Meta into typed WhatsApp exceptions with redacted secrets."""
        status_code = exc.response.status_code
        try:
            error_json = exc.response.json()
            err_details = error_json.get("error", {})
            raw_err_msg = err_details.get("message", exc.response.text)
        except Exception:
            raw_err_msg = exc.response.text

        err_msg = self._redact_secrets(raw_err_msg)

        if status_code in (401, 403):
            raise WhatsAppAuthenticationError(
                f"Meta API authentication failed (HTTP {status_code}): {err_msg}"
            )
        elif status_code == 400:
            if "phone number" in err_msg.lower() or "recipient" in err_msg.lower():
                raise WhatsAppInvalidRecipientError(
                    f"Meta rejected recipient phone number: {err_msg}"
                )
            raise WhatsAppAPIError(
                f"Meta API Bad Request (HTTP 400): {err_msg}",
                status_code=400,
                error_data=error_json if "error_json" in locals() else {}
            )
        else:
            raise WhatsAppAPIError(
                f"Meta API error (HTTP {status_code}): {err_msg}",
                status_code=status_code,
                error_data=error_json if "error_json" in locals() else {}
            )

    async def _post_with_retry(
        self,
        endpoint: str,
        payload: Dict[str, Any],
    ) -> Dict[str, Any]:
        """
        Sends an HTTP POST to Meta Graph API with retry on transient network errors
        and 5xx server errors. Fails fast without retry on 4xx client errors (400, 401, 403, etc.).
        Redacts credentials from all logged and raised error messages.
        """
        for attempt in range(self.max_retries + 1):
            try:
                async with httpx.AsyncClient(timeout=self.timeout) as client:
                    response = await client.post(
                        endpoint,
                        json=payload,
                        headers=self._get_auth_headers(),
                    )
                    response.raise_for_status()
                    return response.json()
            except httpx.HTTPStatusError as he:
                # 4xx client errors (400, 401, 403, etc.) are deterministic - do NOT retry
                if 400 <= he.response.status_code < 500:
                    self._handle_http_error(he)
                # 5xx server errors are transient - retry if attempts remain
                if attempt < self.max_retries:
                    wait_time = self.backoff_seconds * (2 ** attempt)
                    logger.warning(
                        "Meta Graph API transient %s on attempt %s/%s. Retrying in %.2fs...",
                        he.response.status_code,
                        attempt + 1,
                        self.max_retries + 1,
                        wait_time,
                    )
                    await asyncio.sleep(wait_time)
                    continue
                self._handle_http_error(he)
            except (httpx.TimeoutException, httpx.NetworkError) as ne:
                if attempt < self.max_retries:
                    wait_time = self.backoff_seconds * (2 ** attempt)
                    logger.warning(
                        "Meta Graph API transient connection error (%s) on attempt %s/%s. Retrying in %.2fs...",
                        type(ne).__name__,
                        attempt + 1,
                        self.max_retries + 1,
                        wait_time,
                    )
                    await asyncio.sleep(wait_time)
                    continue
                if isinstance(ne, httpx.TimeoutException):
                    raise WhatsAppTimeoutError(
                        self._redact_secrets(f"Timeout connecting to Meta Graph API ({self.timeout}s): {ne}")
                    )
                raise WhatsAppNetworkError(
                    self._redact_secrets(f"Network failure connecting to Meta Graph API: {ne}")
                )

    # ==========================================================================
    # 1. SEND TEXT MESSAGE
    # ==========================================================================

    async def send_text_message(self, recipient: str, text: str) -> str:
        """
        Sends a standard text message to a citizen via Meta WhatsApp Cloud API.
        Returns the Meta message ID (wamid...).
        """
        self._validate_credentials()
        to_phone = self._clean_recipient(recipient)

        if not text or not isinstance(text, str) or not text.strip():
            raise ValueError("Message text must be a non-empty string.")

        endpoint = f"{self.base_url}/{self.phone_number_id}/messages"
        payload = {
            "messaging_product": "whatsapp",
            "recipient_type": "individual",
            "to": to_phone,
            "type": "text",
            "text": {"body": text.strip()},
        }

        data = await self._post_with_retry(endpoint, payload)
        messages = data.get("messages", [])
        if not messages or "id" not in messages[0]:
            raise WhatsAppAPIError("Meta response did not contain a valid message ID.", error_data=data)

        return messages[0]["id"]

    # ==========================================================================
    # 2. SEND INTERACTIVE MESSAGE (BUTTON REPLIES)
    # ==========================================================================

    async def send_interactive_buttons(
        self,
        recipient: str,
        body_text: str,
        buttons: List[Dict[str, str]],
    ) -> str:
        """
        Sends an interactive quick-reply button message to a citizen.
        Meta limits:
        - Exactly 1 to 3 buttons
        - Button title <= 20 characters
        - Button ID <= 256 characters
        - Body text <= 1024 characters
        """
        self._validate_credentials()
        to_phone = self._clean_recipient(recipient)

        if not body_text or not isinstance(body_text, str) or not body_text.strip():
            raise ValueError("Interactive body_text must be a non-empty string.")

        if len(body_text) > 1024:
            raise ValueError(f"Interactive body text exceeds Meta limit of 1024 chars (got {len(body_text)}).")

        if not isinstance(buttons, list) or len(buttons) < 1 or len(buttons) > 3:
            raise ValueError(
                f"Meta requires between 1 and 3 interactive buttons (received {len(buttons) if isinstance(buttons, list) else 'invalid'})."
            )

        formatted_buttons = []
        for idx, btn in enumerate(buttons):
            btn_id = str(btn.get("id", "")).strip()
            btn_title = str(btn.get("title", "")).strip()

            if not btn_id:
                raise ValueError(f"Button at index {idx} is missing a non-empty 'id'.")
            if not btn_title:
                raise ValueError(f"Button at index {idx} is missing a non-empty 'title'.")
            if len(btn_title) > 20:
                raise ValueError(
                    f"Button title '{btn_title}' exceeds Meta's maximum limit of 20 characters."
                )
            if len(btn_id) > 256:
                raise ValueError(
                    f"Button id '{btn_id}' exceeds Meta's maximum limit of 256 characters."
                )

            formatted_buttons.append({
                "type": "reply",
                "reply": {
                    "id": btn_id,
                    "title": btn_title,
                }
            })

        endpoint = f"{self.base_url}/{self.phone_number_id}/messages"
        payload = {
            "messaging_product": "whatsapp",
            "recipient_type": "individual",
            "to": to_phone,
            "type": "interactive",
            "interactive": {
                "type": "button",
                "body": {"text": body_text.strip()},
                "action": {"buttons": formatted_buttons},
            },
        }

        data = await self._post_with_retry(endpoint, payload)
        messages = data.get("messages", [])
        if not messages or "id" not in messages[0]:
            raise WhatsAppAPIError("Meta response did not contain a valid message ID.", error_data=data)

        return messages[0]["id"]

    # ==========================================================================
    # 3. DOWNLOAD WHATSAPP MEDIA
    # ==========================================================================

    async def download_media(
        self,
        media_id: str,
        max_bytes: Optional[int] = None,
    ) -> Tuple[bytes, str]:
        """
        Downloads a media file from Meta WhatsApp Cloud API in two authenticated steps:
        1. Queries Meta Graph API to obtain temporary media download URL and MIME type.
        2. Downloads the binary content with Bearer authorization, verifying MIME & size.

        Returns: (binary_bytes, mime_type)
        """
        self._validate_credentials()

        if not media_id or not isinstance(media_id, str) or not media_id.strip():
            raise WhatsAppInvalidMediaError("Media ID must be a non-empty string.")

        media_id = media_id.strip()
        effective_max_bytes = max_bytes or self.max_media_bytes

        # Step 1: Retrieve Media Metadata
        meta_endpoint = f"{self.base_url}/{media_id}"
        try:
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                meta_res = await client.get(
                    meta_endpoint,
                    headers={"Authorization": f"Bearer {self.access_token}"},
                )
                if meta_res.status_code in (404, 410):
                    raise WhatsAppInvalidMediaError(f"Media '{media_id}' not found or expired on Meta servers.")
                meta_res.raise_for_status()
                meta_data = meta_res.json()

        except httpx.TimeoutException as te:
            raise WhatsAppTimeoutError(
                self._redact_secrets(f"Timeout fetching media metadata for '{media_id}': {te}")
            )
        except httpx.NetworkError as ne:
            raise WhatsAppNetworkError(
                self._redact_secrets(f"Network failure fetching media metadata: {ne}")
            )
        except httpx.HTTPStatusError as he:
            self._handle_http_error(he)

        download_url = meta_data.get("url")
        mime_type = meta_data.get("mime_type", "").lower()
        file_size = meta_data.get("file_size")

        if not download_url:
            raise WhatsAppInvalidMediaError(f"Meta response missing 'url' for media '{media_id}'.")

        # Validate MIME type
        if mime_type not in self.ALLOWED_IMAGE_MIMES:
            raise WhatsAppUnsupportedMimeTypeError(
                f"Unsupported media MIME type '{mime_type}'. Expected one of: {list(self.ALLOWED_IMAGE_MIMES)}"
            )

        # Validate file size if reported by metadata
        if file_size and int(file_size) > effective_max_bytes:
            raise WhatsAppOversizedMediaError(
                f"Media file size ({file_size} bytes) exceeds maximum limit ({effective_max_bytes} bytes)."
            )

        # Step 2: Download Binary Stream using Bearer Token
        try:
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                dl_res = await client.get(
                    download_url,
                    headers={"Authorization": f"Bearer {self.access_token}"},
                )
                dl_res.raise_for_status()
                content = dl_res.content

        except httpx.TimeoutException as te:
            raise WhatsAppTimeoutError(
                self._redact_secrets(f"Timeout downloading media binary stream: {te}")
            )
        except httpx.NetworkError as ne:
            raise WhatsAppNetworkError(
                self._redact_secrets(f"Network failure downloading media binary: {ne}")
            )
        except httpx.HTTPStatusError as he:
            if he.response.status_code in (404, 410):
                raise WhatsAppInvalidMediaError(f"Temporary media URL expired for media '{media_id}'.")
            self._handle_http_error(he)

        if len(content) > effective_max_bytes:
            raise WhatsAppOversizedMediaError(
                f"Downloaded binary size ({len(content)} bytes) exceeds maximum limit ({effective_max_bytes} bytes)."
            )

        return content, mime_type

    # ==========================================================================
    # 4. GEMINI VISION INTEGRATION BOUNDARY
    # ==========================================================================

    async def analyze_whatsapp_image(
        self,
        image_bytes: bytes,
        filename: str = "whatsapp_report.jpg",
    ) -> Dict[str, Any]:
        """
        Passes downloaded WhatsApp image bytes directly to the existing
        AIService.analyze_image_vision multimodal pipeline.
        Preserves all Gemini 2.5 Flash validation without modification.
        """
        if not image_bytes or not isinstance(image_bytes, bytes):
            raise ValueError("image_bytes must be non-empty bytes.")

        # Delegate strictly to existing Gemini multimodal vision engine
        return await AIService.analyze_image_vision(image_bytes=image_bytes, filename=filename)


# Default module instance using global environment settings
whatsapp_service = WhatsAppService()
