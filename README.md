# 🏙️ CivicSense AI
### AI-Powered Smart City Operations Platform

> **Transforming Citizen Complaints into Intelligent City Actions**

![License](https://img.shields.io/badge/License-MIT-green)
![React](https://img.shields.io/badge/Frontend-React%20%2B%20Vite-blue)
![FastAPI](https://img.shields.io/badge/Backend-FastAPI-success)
![AI](https://img.shields.io/badge/AI-Google%20Gemini-orange)
![GIS](https://img.shields.io/badge/GIS-Leaflet%20%2B%20OpenStreetMap-red)

---

# 📌 Overview

CivicSense AI is an AI-powered Smart City Operations Platform designed to help municipalities intelligently manage civic complaints from reporting to resolution.

Instead of acting as a traditional complaint portal, CivicSense AI combines Artificial Intelligence, GIS, Predictive Analytics, and Workflow Automation to support smarter urban governance.

---

# 🚨 Problem Statement

Urban local bodies receive thousands of complaints every day including:

- 🕳️ Potholes
- 💧 Water Leakages
- 🗑 Garbage Overflow
- 💡 Broken Streetlights
- 🌊 Drainage Blockages
- 🌳 Fallen Trees
- 🚦 Traffic Signal Failures

Current complaint systems are:

- Manual
- Reactive
- Slow
- Difficult to monitor
- Lack predictive capabilities

Resulting in:

- Increased infrastructure damage
- Higher repair costs
- Delayed emergency response
- Reduced citizen satisfaction

---

# 💡 Solution

CivicSense AI transforms a simple complaint into an AI-driven municipal workflow.

The platform:

- Detects civic issues using AI Vision
- Predicts future damage
- Assigns priority automatically
- Displays incidents on GIS maps
- Recommends responsible departments
- Supports emergency workflows
- Generates official PDF reports

---

# 🚀 Features

## 🤖 AI Vision

- Automatic issue detection
- Severity prediction
- Confidence scoring
- Priority calculation
- Department recommendation
- Repair cost estimation
- Repair time estimation

---

## 🗺 GIS Intelligence

- Interactive Map
- Incident Markers
- Nearby Hospitals
- Police Stations
- Fire Stations
- Traffic Layer
- Weather Layer
- Emergency Routing

---

## 📊 Smart Dashboard

- Total Incidents
- Critical Incidents
- Active Complaints
- Resolution Rate
- City Health Score
- Department Performance
- Analytics

---

## 🚨 Emergency Command Center

- Live Incident Timeline
- Crew Assignment
- Vehicle Tracking
- ETA
- Status Updates

---

## 📄 AI Report Generator

Professional Government-style PDF containing

- Incident Details
- AI Analysis
- GIS Information
- Timeline
- Crew Details
- QR Code

---

## 👥 Role Based System

- Citizen
- Engineer
- Commissioner
- Administrator

---

# 🧠 AI Capabilities

The AI Engine performs

- Image Classification
- Severity Detection
- Confidence Calculation
- Priority Assignment
- Predictive Damage Assessment
- Explainable AI
- Executive Summary Generation

---

# 🔄 Workflow

```text
Citizen
    │
    ▼
Upload Incident
    │
    ▼
AI Vision Analysis
    │
    ▼
Issue Detection
    │
    ▼
Priority Calculation
    │
    ▼
GIS Mapping
    │
    ▼
Commissioner Dashboard
    │
    ▼
Department Assignment
    │
    ▼
Emergency Dispatch
    │
    ▼
Repair
    │
    ▼
PDF Report
```

---

# 🏗 System Architecture

```text
                   Citizen
                      │
                      ▼
         React + Vite Frontend
                      │
                      ▼
              FastAPI Backend
                      │
     ┌────────────┬─────────────┬─────────────┐
     ▼            ▼             ▼
 SQLite      Google Gemini      GIS APIs
 Database        AI             Leaflet
     │            │              │
     └────────────┼──────────────┘
                  ▼
          AI Decision Engine
                  │
                  ▼
       Commissioner Dashboard
```

---

# 💻 Technology Stack

## Frontend

- React
- Vite
- TypeScript
- Tailwind CSS
- Framer Motion
- React Query
- React Router
- Leaflet
- Lucide Icons

---

## Backend

- FastAPI
- SQLAlchemy
- Pydantic
- Uvicorn

---

## AI

- Google Gemini AI
- Vision Analysis
- AI Copilot

---

## Database

- SQLite
- PostgreSQL Ready

---

## Deployment

Frontend

- Vercel

Backend

- Render

---

# 📂 Project Structure

```text
civicsenseai
│
├── frontend
│   ├── public
│   ├── src
│   │   ├── components
│   │   ├── pages
│   │   ├── context
│   │   ├── services
│   │   ├── hooks
│   │   ├── utils
│   │   ├── assets
│   │   ├── App.tsx
│   │   └── main.tsx
│   │
│   ├── package.json
│   ├── vite.config.ts
│   └── tsconfig.json
│
├── backend
│   ├── app
│   │   ├── routers
│   │   ├── models
│   │   ├── schemas
│   │   ├── services
│   │   ├── database.py
│   │   ├── config.py
│   │   └── main.py
│   │
│   ├── requirements.txt
│   └── civicsense.db
│
└── README.md
```

---

# ⚙️ Installation

## Clone

```bash
git clone https://github.com/sathwik-tech07/civicsenseai.git
```

---

## Frontend

```bash
cd frontend
npm install
npm run dev
```

---

## Backend

```bash
cd backend

python -m venv venv

source venv/bin/activate

pip install -r requirements.txt

uvicorn app.main:app --reload
```

---

# 🌐 Deployment

Frontend

Vercel

Backend

Render

---

# 📈 Future Scope

- Drone-based infrastructure inspection
- IoT Sensor Integration
- Predictive Infrastructure Analytics
- AI Voice Complaint Assistant
- Mobile Application
- Smart City Digital Twin
- Multi-language Support

---

# 🌍 Impact

- Faster complaint resolution
- Better citizen satisfaction
- Reduced maintenance costs
- AI-assisted governance
- Data-driven decision making

---

# 👨‍💻 Contributors

**Sathwik**

AI Engineer | MERN Stack Developer | Smart City Solutions

---

# 📜 License

This project is licensed under the MIT License.

---

# ⭐ If you found this project useful

Please consider giving it a ⭐ on GitHub.
