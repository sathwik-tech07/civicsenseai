from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime

class IncidentBase(BaseModel):
    title: str
    type: str  # pothole | garbage | drainage | water_leak | streetlight | road_collapse
    severity: str  # critical | high | medium | low
    status: Optional[str] = "reported"
    ward_id: str
    ward_name: str
    lat: float
    lng: float
    address: str
    priority_score: Optional[int] = 50
    estimated_repair_cost: Optional[float] = 0.0
    saved_early_intervention: Optional[float] = 0.0
    photo_url: str
    assigned_crew: Optional[str] = None

    # Complete AI Intelligence Fields
    confidence: Optional[float] = 92.5
    description: Optional[str] = None
    recommended_department: Optional[str] = None
    estimated_repair_time: Optional[str] = None
    public_safety_risk: Optional[str] = None
    environmental_impact: Optional[str] = None
    future_damage_prediction: Optional[str] = None
    ai_recommendation: Optional[str] = None
    executive_summary: Optional[str] = None
    explanation: Optional[str] = None

class IncidentCreate(IncidentBase):
    pass

class IncidentUpdate(BaseModel):
    title: Optional[str] = None
    status: Optional[str] = None
    severity: Optional[str] = None
    assigned_crew: Optional[str] = None
    priority_score: Optional[int] = None

class IncidentResponse(IncidentBase):
    id: str
    created_at: datetime

    class Config:
        from_attributes = True
