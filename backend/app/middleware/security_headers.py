"""
CivicSense AI - HTTP Security Headers Middleware
Enforces defense-in-depth response headers across all API endpoints and interactive documentation.
Hardens responses against clickjacking, MIME sniffing, data injection, and unencrypted transport.
"""

from typing import Callable
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response

from app.config import settings
from app.services.rate_limiter import is_trusted_proxy

# Content-Security-Policy for interactive Swagger UI (/docs) and ReDoc (/redoc)
# Permits CDN assets and inline styles/scripts strictly necessary for documentation functionality.
DOCS_CSP = (
    "default-src 'self'; "
    "script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net; "
    "style-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net https://fonts.googleapis.com; "
    "font-src 'self' https://fonts.gstatic.com; "
    "img-src 'self' data: https://fastapi.tiangolo.com; "
    "frame-ancestors 'none'"
)

# Content-Security-Policy for REST API endpoints and /openapi.json
# Strict defense-in-depth policy preventing script execution if JSON responses are rendered in a browser.
API_CSP = "default-src 'none'; frame-ancestors 'none'"

DOCS_PATHS = {"/docs", "/redoc"}


def is_genuine_https(request: Request) -> bool:
    """
    Evaluates whether the incoming request arrived over genuine HTTPS.

    Security & Trust Boundary Rules:
    1. If the direct ASGI request scheme is 'https', trust native TLS termination.
    2. If scheme is not 'https', inspect X-Forwarded-Proto ONLY if:
       - settings.TRUST_PROXY_HEADERS is explicitly True.
       - The immediate connecting peer (request.client.host) is verified against settings.TRUSTED_PROXIES.
       - The X-Forwarded-Proto header is unambiguous (strictly 'https', no comma-separated chains or malformed values).
    3. Under all other conditions (untrusted peer, proxy trust disabled, malformed header),
       fails closed and returns False to prevent unencrypted HSTS emission.
    """
    # 1. Native ASGI TLS scheme
    if request.url.scheme == "https":
        return True

    # 2. Forwarded protocol evaluation under strict trusted proxy boundary
    if not getattr(settings, "TRUST_PROXY_HEADERS", False):
        return False

    client_host = request.client.host if request.client else None
    if not client_host or not is_trusted_proxy(client_host, settings.TRUSTED_PROXIES):
        return False

    forwarded_proto = request.headers.get("x-forwarded-proto")
    if not forwarded_proto:
        return False

    clean_proto = forwarded_proto.strip().lower()
    # Reject comma-separated chains, whitespace-padded lists, or any value other than exact 'https'
    if "," in clean_proto or clean_proto != "https":
        return False

    return True


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    """
    ASGI middleware attaching defense-in-depth HTTP security headers to all responses.
    Preserves CORS headers, authentication, rate-limiting (Retry-After), and WhatsApp webhooks.
    """

    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        response: Response = await call_next(request)

        # 1. Clickjacking Protection
        response.headers["X-Frame-Options"] = "DENY"

        # 2. MIME Sniffing Protection
        response.headers["X-Content-Type-Options"] = "nosniff"

        # 3. Referrer Policy
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"

        # 4. Restrictive Hardware Permissions Policy for API Responses
        response.headers["Permissions-Policy"] = "camera=(), microphone=(), geolocation=(), payment=(), usb=()"

        # 5. Strict-Transport-Security (HSTS)
        # Emitted ONLY in production mode and ONLY when the request is genuinely HTTPS.
        # NEVER emitted over local HTTP development.
        is_prod = settings.ENVIRONMENT in ("production", "prod")
        if is_prod and is_genuine_https(request):
            max_age = getattr(settings, "HSTS_MAX_AGE_SECONDS", 31536000)
            hsts_value = f"max-age={max_age}"
            if getattr(settings, "HSTS_INCLUDE_SUBDOMAINS", False):
                hsts_value += "; includeSubDomains"
            response.headers["Strict-Transport-Security"] = hsts_value

        # 6. Content-Security-Policy (CSP)
        # Interactive documentation requires Swagger/ReDoc CDN assets;
        # API endpoints and /openapi.json enforce strict default-src 'none'.
        path = request.url.path
        if path in DOCS_PATHS:
            response.headers["Content-Security-Policy"] = DOCS_CSP
        else:
            response.headers["Content-Security-Policy"] = API_CSP

        return response
