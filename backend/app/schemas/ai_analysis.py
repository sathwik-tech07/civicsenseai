from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime

class AIAnalysisBase(BaseModel):
    category: str
    confidence: float
    severity: str
    explanation: str
    bounding_box: Optional[List[float]] = None
    recommended_department: str
    estimated_repair_time: str
    estimated_repair_cost: float
    title: str
    priorityScore: int
    savedEarlyIntervention: float

class AIAnalysisCreate(AIAnalysisBase):
    incident_id: str

class AIAnalysisResponse(AIAnalysisBase):
    id: str
    incident_id: str
    created_at: datetime

    class Config:
        from_attributes = True

class AIChatRequest(BaseModel):
    query: str
    incident_id: Optional[str] = None
    system: str = "command_os"  # command_os | incident_copilot

class AIAction(BaseModel):
    label: str
    actionType: str
    payload: Optional[str] = None

class AIChatResponse(BaseModel):
    text: str
    actions: List[AIAction] = []
    dataSummary: Optional[dict] = None
