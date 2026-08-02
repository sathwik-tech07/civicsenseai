# CivicSense AI — FastAPI Production Backend

Production-ready FastAPI backend for the **CivicSense AI** Smart City Operations Platform.

## Architecture

```
backend/
├── app/
│   ├── main.py            # FastAPI Entry Point & CORS Setup
│   ├── config.py          # Environment Settings & JWT Config
│   ├── database.py        # SQLAlchemy Session Engine
│   ├── models/            # Database Models (User, Incident, AIAnalysis, Report)
│   ├── schemas/           # Pydantic v2 Input/Output Schemas
│   ├── routers/           # REST API Route Handlers (Auth, Incidents, AI, Dashboard, Reports)
│   ├── services/          # AI Vision (Gemini + YOLOv11x), XAI & Chat Services
│   └── utils/             # Security & JWT Utilities
├── uploads/               # Uploaded Incident Image Media Storage
└── requirements.txt
```

## Quick Start

1. **Install Dependencies**:
   ```bash
   pip install -r requirements.txt
   ```

2. **Run Server**:
   ```bash
   uvicorn app.main:app --reload --port 8000
   ```

3. **Interactive API Documentation**:
   - Swagger UI: `http://localhost:8000/docs`
   - ReDoc UI: `http://localhost:8000/redoc`

## API Highlights

- **JWT Authentication**: `/api/v1/auth/signup`, `/api/v1/auth/login`
- **Incidents CRUD & Media**: `/api/v1/incidents/`, `/api/v1/incidents/upload-image`
- **AI Vision & Dual Chat**: `/api/v1/ai/analyze-image`, `/api/v1/ai/chat`
- **Dashboard Telemetry**: `/api/v1/dashboard/kpis`, `/api/v1/dashboard/ward-performance`
- **Report Generation**: `/api/v1/reports/generate`
