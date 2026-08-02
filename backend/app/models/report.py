import datetime
from sqlalchemy import Column, String, DateTime, Text, JSON
from app.database import Base

class Report(Base):
    __tablename__ = "reports"

    id = Column(String, primary_key=True, index=True)
    title = Column(String, nullable=False)
    report_type = Column(String, nullable=False)  # executive_summary | ward_report | predictive_analysis
    generated_by = Column(String, default="AI Command OS")
    file_url = Column(Text, nullable=True)
    content_json = Column(JSON, default=dict)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
