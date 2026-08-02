# civicsenseai

# CivicSense AI · Smart City Operations Platform

CivicSense AI is a Next-Generation Multimodal Smart City Command & Operations Platform.

## 🚀 Key Features

- 🏛️ **Role-Based Command Dashboards**: Tailored views for Municipal Commissioners, Field Engineers, Citizens, and System Administrators.
- 🤖 **Gemini AI Infrastructure Vision**: Automated municipal issue classification, severity scoring, cost estimation, and SLA prediction.
- 🗺️ **3D Digital Twin & GIS Spatial Telemetry**: Interactive map visualizing live municipal telemetry, ward health indices, and active work orders.
- 📊 **Explainable AI (XAI) Diagnostics**: Detailed breakdowns for incident priority scores and early intervention savings.
- ⚡ **Offline Hackathon Entry Screen**: Instant offline role selection and demonstration mode.

## 🛠️ Tech Stack

- **Frontend**: React 19, TypeScript, Vite, Framer Motion, Lucide React, Recharts
- **Backend**: Python FastAPI, SQLAlchemy, SQLite DB, Uvicorn
- **Design Tokens**: Custom Cyberpunk/Dark Enterprise Glassmorphism Design System

## 💻 Local Setup

1. **Frontend**:
   ```bash
   npm install
   npm run dev
   ```

2. **Backend**:
   ```bash
   cd backend
   .\venv\Scripts\python -m uvicorn app.main:app --reload --port 8000
   ```
