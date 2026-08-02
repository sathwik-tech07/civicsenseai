import datetime
from sqlalchemy import Column, String, Float, Integer, DateTime, ForeignKey, Text
from sqlalchemy.orm import relationship
from app.database import Base
from app.models.ai_analysis import AIAnalysis
from app.models.user import User

class Incident(Base):
    __tablename__ = "incidents"

    id = Column(String, primary_key=True, index=True)
    title = Column(String, nullable=False)
    type = Column(String, nullable=False)  # pothole | garbage | drainage | water_leak | streetlight | road_collapse
    severity = Column(String, nullable=False)  # critical | high | medium | low
    status = Column(String, default="reported")  # reported | in_progress | resolved
    ward_id = Column(String, nullable=False)
    ward_name = Column(String, nullable=False)
    lat = Column(Float, nullable=False)
    lng = Column(Float, nullable=False)
    address = Column(Text, nullable=False)
    priority_score = Column(Integer, default=50)
    estimated_repair_cost = Column(Float, default=0.0)
    saved_early_intervention = Column(Float, default=0.0)
    photo_url = Column(Text, nullable=False)
    resolved_photo_url = Column(Text, nullable=True)
    assigned_crew = Column(String, nullable=True)
    user_id = Column(String, ForeignKey("users.id"), nullable=True)
    
    # Complete Incident Intelligence Fields
    confidence = Column(Float, default=92.5)
    description = Column(Text, nullable=True)
    recommended_department = Column(String, nullable=True)
    estimated_repair_time = Column(String, nullable=True)
    public_safety_risk = Column(Text, nullable=True)
    environmental_impact = Column(Text, nullable=True)
    future_damage_prediction = Column(Text, nullable=True)
    ai_recommendation = Column(Text, nullable=True)
    executive_summary = Column(Text, nullable=True)
    explanation = Column(Text, nullable=True)

    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    # Relationships
    ai_analysis = relationship("AIAnalysis", back_populates="incident", uselist=False, cascade="all, delete-orphan")
