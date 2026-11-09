import os
import logging
from fastapi import FastAPI, Depends, status, Request
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from sqlalchemy import text
from starlette.exceptions import HTTPException as StarletteHTTPException

from app.config import settings
from app.database import engine, get_db
from app.middleware.security_headers import SecurityHeadersMiddleware
from app.routers import auth, incidents, ai, dashboard, reports, core_data, gis, workflow, whatsapp
import app.models.workflow

logger = logging.getLogger("civicsense.api")

app = FastAPI(
    title=settings.PROJECT_NAME,
    version="5.0.0",
    docs_url="/docs",
    redoc_url="/redoc"
)

# Enable CORS for Production & Local Frontends
has_wildcard = "*" in settings.CORS_ORIGINS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=not has_wildcard,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
    allow_headers=["*"],
    expose_headers=["*"],
)

# Register Defense-in-Depth HTTP Security Headers Middleware
app.add_middleware(SecurityHeadersMiddleware)

# Centralized Exception Handlers
@app.exception_handler(StarletteHTTPException)
async def http_exception_handler(request: Request, exc: StarletteHTTPException):
    return JSONResponse(
        status_code=exc.status_code,
        content={"detail": exc.detail, "status_code": exc.status_code}
    )

@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content={"detail": exc.errors(), "error": "Validation Error"}
    )

@app.exception_handler(Exception)
async def general_exception_handler(request: Request, exc: Exception):
    logger.error("Unhandled server exception on %s %s: %s", request.method, request.url.path, exc, exc_info=True)
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={"detail": "Internal server error occurred.", "status": "error"}
    )

# Ensure uploads directory exists on host for local storage provider
UPLOAD_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "uploads")
os.makedirs(UPLOAD_DIR, exist_ok=True)

# Include Router Modules
app.include_router(auth.router, prefix=settings.API_V1_STR)
app.include_router(incidents.router, prefix=settings.API_V1_STR)
app.include_router(ai.router, prefix=settings.API_V1_STR)
app.include_router(dashboard.router, prefix=settings.API_V1_STR)
app.include_router(reports.router, prefix=settings.API_V1_STR)
app.include_router(core_data.router, prefix=settings.API_V1_STR)
app.include_router(gis.router, prefix=settings.API_V1_STR)
app.include_router(workflow.router, prefix=settings.API_V1_STR)
app.include_router(whatsapp.router, prefix=settings.API_V1_STR)

@app.get("/")
def root():
    return {
        "status": "online",
        "service": settings.PROJECT_NAME,
        "version": "5.0.0",
        "docs": "/docs",
        "api_v1": settings.API_V1_STR
    }

@app.get("/health")
@app.get(f"{settings.API_V1_STR}/health")
def health_check(db: Session = Depends(get_db)):
    """
    Standardized health check endpoint for Render, Docker, and monitoring agents.
    Validates live database connectivity via SELECT 1.
    """
    try:
        db.execute(text("SELECT 1;"))
        db_status = "connected"
    except Exception as e:
        logger.error("Database health check ping failed: %s", e)
        return JSONResponse(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            content={
                "status": "unhealthy",
                "database": "disconnected",
                "service": settings.PROJECT_NAME,
                "version": "5.0.0",
                "environment": settings.ENVIRONMENT
            }
        )

    return {
        "status": "healthy",
        "database": db_status,
        "service": settings.PROJECT_NAME,
        "version": "5.0.0",
        "environment": settings.ENVIRONMENT
    }
