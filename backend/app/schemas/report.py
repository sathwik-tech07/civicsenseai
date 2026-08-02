from pydantic import BaseModel
from typing import Optional, Dict, Any
from datetime import datetime

class ReportBase(BaseModel):
    title: str
    report_type: str  # executive_summary | ward_report | predictive_analysis
    generated_by: Optional[str] = "AI Command OS"
    content_json: Optional[Dict[str, Any]] = {}

class ReportCreate(ReportBase):
    pass

class ReportResponse(ReportBase):
    id: str
    file_url: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True
