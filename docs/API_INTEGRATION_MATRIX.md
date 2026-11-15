# CivicSense AI — API Integration Matrix
**Platform:** CivicSense AI OS v5.0  
**Backend Framework:** FastAPI (Python 3.14 / 3.11)  
**Frontend Client:** Axios + TanStack React Query (`src/services/apiClient.ts`)  
**Audit Date:** 2026-11-11  

---

## 1. Authentication Router (`/api/v1/auth`)

| Method | Endpoint | Allowed Roles | Request Schema | Response | Client Function | Status |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `POST` | `/api/v1/auth/signup` | Public | `{ email, password, full_name, phone_number? }` | `201 Created` (User Object) | `apiSignup` | Verified |
| `POST` | `/api/v1/auth/login` | Public | OAuth2 Form (`username`, `password`) | `200 OK` (`access_token`, `token_type`, `user`) | `apiLogin` | Verified |
| `GET` | `/api/v1/auth/me` | Authenticated | Header `Authorization: Bearer <token>` | `200 OK` (Current User profile) | `apiGetMe` | Verified |
| `POST` | `/api/v1/auth/forgot-password` | Public | `{ email }` | `200 OK` (`detail`, `reset_token` in dev) | `apiForgotPassword` | Verified |
| `POST` | `/api/v1/auth/reset-password` | Public | `{ token, new_password }` | `200 OK` (`detail`) | `apiResetPassword` | Verified |

---

## 2. Incidents Router (`/api/v1/incidents`)

| Method | Endpoint | Allowed Roles | Request Schema | Response | Client Function | Status |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `GET` | `/api/v1/incidents` | Authenticated | Query (`skip`, `limit`, `status`, `category`, `ward`) | `200 OK` (`Incident[]`) | `apiFetchIncidents` | Verified |
| `POST` | `/api/v1/incidents` | Authenticated | `{ title, description, category, latitude, longitude, image_url? }` | `201 Created` (`Incident`) | `apiCreateIncident` | Verified |
| `GET` | `/api/v1/incidents/{id}` | Authenticated | Path parameter `id` | `200 OK` (`Incident`) | `apiFetchIncidentById` | Verified |
| `POST` | `/api/v1/incidents/{id}/escalate` | Citizen (Owner) / Staff | `{ reason }` | `200 OK` (Updated Incident) | `apiEscalateIncident` | Verified |
| `POST` | `/api/v1/incidents/{id}/feedback` | Citizen (Owner) | `{ rating: 1-5, comment? }` | `200 OK` (`detail`, `rating`) | `apiSubmitFeedback` | Verified |
| `POST` | `/api/v1/incidents/{id}/additional-evidence` | Citizen (Owner) | `{ notes?, photo_url? }` | `200 OK` (`detail`) | `apiAttachAdditionalEvidence` | Verified |
| `POST` | `/api/v1/incidents/upload-image` | Authenticated | `multipart/form-data` (`file`) | `200 OK` (`image_url`, `filename`) | `apiUploadIncidentImage` | Verified |

---

## 3. Workflow & Field Operations Router (`/api/v1/workflow`)

| Method | Endpoint | Allowed Roles | Request Schema | Response | Client Function | Status |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `POST` | `/api/v1/workflow/transition/{id}` | Engineer (Assigned) / Staff | `{ new_stage, comment?, before_photo_url?, after_photo_url? }` | `200 OK` (`Incident`) | `apiTransitionStage` | Verified |
| `POST` | `/api/v1/workflow/assign/{id}` | Commissioner, Admin | `{ assigned_engineer_id, assigned_crew?, department? }` | `200 OK` (`Incident`) | `apiAssignEngineer` | Verified |
| `GET` | `/api/v1/workflow/timeline/{id}` | Authenticated | Path parameter `id` | `200 OK` (`TimelineEvent[]`) | `apiFetchWorkflowTimeline` | Verified |
| `GET` | `/api/v1/workflow/engineers` | Commissioner, Admin | None | `200 OK` (`User[]`) | `apiFetchAvailableEngineers` | Verified |

---

## 4. Administrator Control Center Router (`/api/v1/admin`)

| Method | Endpoint | Allowed Roles | Request Schema | Response | Client Function | Status |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `GET` | `/api/v1/admin/users` | Commissioner, Admin | Query (`role`, `search`, `skip`, `limit`) | `200 OK` (`{ users, total }`) | `apiFetchAdminUsers` | Verified |
| `POST` | `/api/v1/admin/users` | Admin | `{ email, full_name, password, role, department? }` | `201 Created` (`UserData`) | `apiCreateStaffUser` | Verified |
| `PATCH` | `/api/v1/admin/users/{id}/status` | Admin | `{ is_active: boolean }` | `200 OK` (`UserData`) | `apiUpdateUserStatus` | Verified |
| `PATCH` | `/api/v1/admin/users/{id}/role` | Admin | `{ role, department? }` | `200 OK` (`UserData`) | `apiUpdateUserRole` | Verified |
| `GET` | `/api/v1/admin/audit-logs` | Commissioner, Admin | Query (`limit`, `incident_id?`) | `200 OK` (`AuditLogEntry[]`) | `apiFetchPlatformAuditLogs` | Verified |
| `GET` | `/api/v1/admin/system-status` | Commissioner, Admin | None | `200 OK` (System Telemetry JSON) | `apiFetchSystemTelemetry` | Verified |

---

## 5. AI Engine Router (`/api/v1/ai`)

| Method | Endpoint | Allowed Roles | Request Schema | Response | Client Function | Status |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `GET` | `/api/v1/ai/status` | Authenticated | None | `200 OK` (Active AI Providers & models) | `apiFetchAIStatus` | Verified |
| `POST` | `/api/v1/ai/analyze-complaint` | Authenticated | `{ text, image_bytes? }` | `200 OK` (Classification, Priority, Severity) | `apiAnalyzeComplaint` | Verified |
| `POST` | `/api/v1/ai/chat` | Authenticated | `{ message, history }` | `200 OK` (`{ response }`) | `apiAIChat` | Verified |

---

## 6. Dashboard, GIS, and WhatsApp Routers

| Method | Endpoint | Allowed Roles | Request Schema | Response | Client Function | Status |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `GET` | `/api/v1/dashboard/kpis` | Commissioner, Admin | None | `200 OK` (Municipal KPIs) | `apiFetchDashboardKPIs` | Verified |
| `GET` | `/api/v1/gis/wards` | Authenticated | None | `200 OK` (GeoJSON Ward polygons) | `apiFetchWards` | Verified |
| `GET` | `/api/v1/gis/layers` | Authenticated | None | `200 OK` (GIS Infrastructure Layers) | `apiFetchGISLayers` | Verified |
| `GET` | `/api/v1/whatsapp/webhook` | Meta Cloud API | Query (`hub.mode`, `hub.challenge`, `hub.verify_token`) | `200 OK` (`hub.challenge`) | Meta Webhook Handshake | Verified |
| `POST` | `/api/v1/whatsapp/webhook` | Meta Cloud API | Meta Payload + `X-Hub-Signature-256` header | `200 OK` (`{ status: "processed" }`) | Inbound WhatsApp Hook | Verified |
