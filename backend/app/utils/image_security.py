import os
import re
import uuid
from typing import Optional, Tuple
from fastapi import UploadFile, HTTPException, status
from app.config import settings

# Supported image formats with binary magic byte signatures
SUPPORTED_SIGNATURES = {
    "jpeg": {
        "mime": "image/jpeg",
        "ext": "jpg",
        "check": lambda data: len(data) >= 3 and data[:3] == b"\xff\xd8\xff"
    },
    "png": {
        "mime": "image/png",
        "ext": "png",
        "check": lambda data: len(data) >= 8 and data[:8] == b"\x89PNG\r\n\x1a\n"
    },
    "webp": {
        "mime": "image/webp",
        "ext": "webp",
        "check": lambda data: len(data) >= 12 and data[:4] == b"RIFF" and data[8:12] == b"WEBP"
    },
    "gif": {
        "mime": "image/gif",
        "ext": "gif",
        "check": lambda data: len(data) >= 6 and (data[:6] == b"GIF87a" or data[:6] == b"GIF89a")
    },
}


def detect_image_format(data: bytes) -> Optional[Tuple[str, str, str]]:
    """
    Validates file content using binary magic bytes / file signatures.
    Returns (format_name, mime_type, safe_extension) or None if unsupported or invalid.
    """
    if not data or len(data) < 12:
        return None

    for fmt_name, spec in SUPPORTED_SIGNATURES.items():
        if spec["check"](data):
            return (fmt_name, spec["mime"], spec["ext"])

    return None


def sanitize_filename(filename: Optional[str]) -> str:
    """
    Sanitizes client-provided filename to prevent path traversal and control character injection.
    Used ONLY for logging or downstream AI contextual defect hints, NEVER for filesystem storage paths.
    """
    if not filename or not isinstance(filename, str):
        return "evidence_image.jpg"

    # Normalize Windows and POSIX separators and extract basename
    basename = filename.replace("\\", "/").split("/")[-1].strip()

    # Strip null bytes and non-printable control characters
    cleaned = re.sub(r"[\x00-\x1f\x7f-\x9f]", "", basename)

    # Strip leading/trailing dots and whitespace
    cleaned = cleaned.strip(". ")

    if not cleaned:
        return "evidence_image.jpg"

    return cleaned


def generate_safe_storage_filename(safe_ext: str) -> str:
    """
    Generates a secure, random server-side storage filename.
    Never relies on client-supplied filenames or extensions.
    """
    token = uuid.uuid4().hex[:16]
    return f"img_{token}.{safe_ext}"


def validate_storage_path(base_dir: str, filename: str) -> str:
    """
    Validates that the target path resolves safely within base_dir, preventing path traversal.
    """
    abs_base = os.path.abspath(base_dir)
    target_path = os.path.abspath(os.path.join(abs_base, filename))

    try:
        common = os.path.commonpath([abs_base, target_path])
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid storage path detected."
        )

    if common != abs_base:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Path traversal attempt detected."
        )

    return target_path


async def validate_and_read_image_upload(
    file: UploadFile,
    max_bytes: Optional[int] = None
) -> Tuple[bytes, str, str]:
    """
    Streams and validates uploaded image file:
    1. Checks for empty file (HTTP 400).
    2. Enforces maximum file size limit (HTTP 413).
    3. Validates actual content using magic bytes (HTTP 400).
    4. Returns (contents, mime_type, safe_extension).
    """
    limit = max_bytes if max_bytes is not None else settings.MAX_UPLOAD_SIZE_BYTES
    limit_mb = max(1, limit // (1024 * 1024))

    # Preliminary check if client provided SpooledTemporaryFile size
    if file.size is not None and file.size > limit:
        raise HTTPException(
            status_code=getattr(status, "HTTP_413_CONTENT_TOO_LARGE", 413),
            detail=f"File exceeds maximum upload size of {limit_mb} MB."
        )

    chunks = []
    total_bytes = 0
    chunk_size = 64 * 1024  # 64 KB read buffer

    while True:
        chunk = await file.read(chunk_size)
        if not chunk:
            break
        total_bytes += len(chunk)
        if total_bytes > limit:
            raise HTTPException(
                status_code=getattr(status, "HTTP_413_CONTENT_TOO_LARGE", 413),
                detail=f"File exceeds maximum upload size of {limit_mb} MB."
            )
        chunks.append(chunk)

    if total_bytes == 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Uploaded file is empty (0 bytes)."
        )

    contents = b"".join(chunks)

    # Magic byte inspection
    format_info = detect_image_format(contents)
    if not format_info:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or unsupported image format. Only genuine JPEG, PNG, WEBP, and GIF images are permitted."
        )

    _, mime_type, safe_ext = format_info
    return (contents, mime_type, safe_ext)
