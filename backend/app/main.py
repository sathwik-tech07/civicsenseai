import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.database import engine
from app.middleware.security_headers import SecurityHeadersMiddleware
from app.routers import auth, incidents, ai, dashboard, reports, core_data, gis, workflow, whatsapp
import app.models.workflow

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

# Ensure uploads directory exists on host for local storage provider
UPLOAD_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "uploads")
os.makedirs(UPLOAD_DIR, exist_ok=True)
# Note: Unauthenticated StaticFiles mount on /uploads has been removed for Step 30 security.
# Citizen evidence photos are private and accessible strictly via GET /api/v1/incidents/{incident_id}/evidence.

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
