import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.config import settings
from app.database import engine, Base
from app.routers import auth, incidents, ai, dashboard, reports, core_data, gis, workflow
import app.models.workflow

def migrate_sqlite_db():
    import sqlite3
    db_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), "civicsense.db")
    if os.path.exists(db_path):
        try:
            conn = sqlite3.connect(db_path)
            cursor = conn.cursor()
            cursor.execute("PRAGMA table_info(incidents);")
            columns = [row[1] for row in cursor.fetchall()]

            new_cols = [
                ("confidence", "FLOAT DEFAULT 92.5"),
                ("description", "TEXT"),
                ("recommended_department", "VARCHAR"),
                ("estimated_repair_time", "VARCHAR"),
                ("public_safety_risk", "TEXT"),
                ("environmental_impact", "TEXT"),
                ("future_damage_prediction", "TEXT"),
                ("ai_recommendation", "TEXT"),
                ("executive_summary", "TEXT"),
                ("explanation", "TEXT"),
            ]
            for col_name, col_type in new_cols:
                if col_name not in columns:
                    cursor.execute(f"ALTER TABLE incidents ADD COLUMN {col_name} {col_type};")
            cursor.execute("PRAGMA table_info(users);")
            user_columns = [row[1] for row in cursor.fetchall()]
            if "department" not in user_columns:
                cursor.execute("ALTER TABLE users ADD COLUMN department VARCHAR;")
            if "status" not in user_columns:
                cursor.execute("ALTER TABLE users ADD COLUMN status VARCHAR DEFAULT 'active';")
            if "updated_at" not in user_columns:
                cursor.execute("ALTER TABLE users ADD COLUMN updated_at DATETIME;")

            conn.commit()
            conn.close()
        except Exception as e:
            print("Migration info:", e)

migrate_sqlite_db()

# Initialize SQLAlchemy Database Tables
Base.metadata.create_all(bind=engine)

app = FastAPI(
    title=settings.PROJECT_NAME,
    version="5.0.0",
    docs_url="/docs",
    redoc_url="/redoc"
)

# Enable CORS for Production & Local Frontends
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
    allow_headers=["*"],
    expose_headers=["*"],
)

# Mount static directory for uploaded images
UPLOAD_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "uploads")
os.makedirs(UPLOAD_DIR, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=UPLOAD_DIR), name="uploads")

# Include Router Modules
app.include_router(auth.router, prefix=settings.API_V1_STR)
app.include_router(incidents.router, prefix=settings.API_V1_STR)
app.include_router(ai.router, prefix=settings.API_V1_STR)
app.include_router(dashboard.router, prefix=settings.API_V1_STR)
app.include_router(reports.router, prefix=settings.API_V1_STR)
app.include_router(core_data.router, prefix=settings.API_V1_STR)
app.include_router(gis.router, prefix=settings.API_V1_STR)
app.include_router(workflow.router, prefix=settings.API_V1_STR)

@app.get("/")
def root():
    return {
        "status": "online",
        "service": settings.PROJECT_NAME,
        "version": "5.0.0",
        "docs": "/docs",
        "api_v1": settings.API_V1_STR
    }
