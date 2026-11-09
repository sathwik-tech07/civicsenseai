import uuid
import datetime
from typing import List
from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.report import Report
from app.models.user import User
from app.schemas.report import ReportCreate, ReportResponse
from app.utils.dependencies import require_staff, require_admin_or_commissioner

router = APIRouter(prefix="/reports", tags=["Report Generation"])

@router.get("/", response_model=List[ReportResponse])
def get_reports(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_staff)
):
    return db.query(Report).order_by(Report.created_at.desc()).all()

@router.post("/generate", response_model=ReportResponse, status_code=status.HTTP_201_CREATED)
def generate_report(
    report_in: ReportCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin_or_commissioner)
):
    rep_id = f"REP-2026-{uuid.uuid4().hex[:6].upper()}"
    new_report = Report(
        id=rep_id,
        title=report_in.title,
        report_type=report_in.report_type,
        generated_by=current_user.full_name or "AI Command OS",
        file_url=f"/static/reports/{rep_id}.pdf",
        content_json=report_in.content_json or {
            "city_health_score": 88,
            "generated_timestamp": datetime.datetime.utcnow().isoformat(),
            "summary": "AI Executive Audit Dossier compiled successfully."
        }
    )
    db.add(new_report)
    db.commit()
    db.refresh(new_report)
    return new_report
