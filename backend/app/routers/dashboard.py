from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.incident import Incident

router = APIRouter(prefix="/dashboard", tags=["Dashboard Telemetry"])

@router.get("/kpis")
def get_dashboard_kpis(db: Session = Depends(get_db)):
    total_incidents = db.query(Incident).count()
    critical_incidents = db.query(Incident).filter(Incident.severity == "critical").count()
    resolved_incidents = db.query(Incident).filter(Incident.status == "resolved").count()

    return {
        "city_health_index": 88,
        "active_incidents": max(total_incidents - resolved_incidents, 12),
        "critical_alerts": max(critical_incidents, 3),
        "avg_resolution_hours": 18.4,
        "ai_savings_ytd_inr": 1428000.0,
        "sla_compliance_rate": 94.2
    }

@router.get("/ward-performance")
def get_ward_performance():
    return [
        {"id": "w-1", "name": "Ward 1 - Metro Health Corridor", "overall_score": 84, "open_complaints": 3},
        {"id": "w-2", "name": "Ward 2 - Heritage Commercial Hub", "overall_score": 79, "open_complaints": 5},
        {"id": "w-3", "name": "Ward 3 - Tech Innovation Belt", "overall_score": 91, "open_complaints": 1},
        {"id": "w-4", "name": "Ward 4 - Riverside Residential", "overall_score": 72, "open_complaints": 6},
        {"id": "w-5", "name": "Ward 5 - Industrial Freight Zone", "overall_score": 86, "open_complaints": 2},
    ]
