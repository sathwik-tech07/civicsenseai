import datetime
from sqlalchemy import Column, String, Float, Integer, DateTime, ForeignKey, Text, JSON
from sqlalchemy.orm import relationship
from app.database import Base

class AIAnalysis(Base):
    __tablename__ = "ai_analyses"

    id = Column(String, primary_key=True, index=True)
    incident_id = Column(String, ForeignKey("incidents.id"), unique=True, nullable=False)
    cv_confidence = Column(Float, default=95.0)
    cv_model = Column(String, default="YOLOv11x + RT-DETR Ensemble")
    hospital_proximity_meters = Column(Integer, default=340)
    hospital_name = Column(String, default="Victoria Municipal Hospital")
    road_classification = Column(String, default="Primary Arterial Corridor")
    duplicate_complaints_count = Column(Integer, default=4)
    estimated_daily_traffic = Column(Integer, default=14500)
    historical_failure_rate = Column(Float, default=78.5)
    weather_risk_factor = Column(String, default="Precipitation Runoff Surge")
    summary = Column(Text, nullable=False)
    objects_detected = Column(JSON, default=list)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    # Relationships
    incident = relationship("Incident", back_populates="ai_analysis")
