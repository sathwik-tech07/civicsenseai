# CivicSense AI — WhatsMeow Staging Live Testing Verification Checklist

> [!NOTE]
> **Status:** PREPARED / AWAITING CLOUD DEPLOYMENT & PHYSICAL QR SCAN  
> **Target Staging Environment:** Supabase Tokyo (`oayzaszhhpfjlpmaezmc`) + Render Singapore Free + Vercel Preview  
> **Mandatory Rule:** Do NOT mark any step as `PASSED` until it has been physically executed with an actual mobile phone linked to the deployed staging gateway.

---

## 1. Pre-Requisites for Live Testing
- [ ] Staging Supabase PostgreSQL schema `whatsmeow` created (Approval Gate 1).
- [ ] Render staging backend (`civicsense-backend-staging`) deployed and healthy at `/health`.
- [ ] Render staging gateway (`civicsense-wa-gateway-staging`) deployed and healthy at `/healthz`.
- [ ] Vercel preview frontend deployed and connected to staging backend.
- [ ] Physical smartphone with active WhatsApp account available for testing.

---

## 2. Comprehensive 26-Step End-to-End Verification Checklist

| Step # | Test Phase | Verification Action | Expected Result | Live Status |
| :---: | :--- | :--- | :--- | :---: |
| **01** | **Gateway Startup** | Send `GET /healthz` to gateway service. | HTTP 200 `{"status": "ok", "service": "whatsapp-gateway"}`. | `NOT DEPLOYED` |
| **02** | **PostgreSQL Connection** | Check gateway startup logs in Render. | Logs confirm `Initializing whatsmeow PostgreSQL session container with schema 'whatsmeow'`. | `NOT DEPLOYED` |
| **03** | **Admin QR Generation** | Log in as Commissioner on Vercel preview; open Admin Panel $\rightarrow$ WhatsApp Gateway tab. | Crisp QR code image displayed with countdown timer and pairing instructions. | `NOT DEPLOYED` |
| **04** | **Physical QR Scan** | On test phone, open WhatsApp $\rightarrow$ Linked Devices $\rightarrow$ Link a Device; scan the screen QR. | WhatsApp on phone displays "Device Linked"; dashboard updates to "Connected". | `NOT DEPLOYED` |
| **05** | **Session Telemetry** | Check Admin Tab 4 telemetry metrics. | Status: `Logged In`, Connected: `true`, Device JID displayed, Uptime > 0s. | `NOT DEPLOYED` |
| **06** | **Session Survival** | In Render Dashboard, trigger **Manual Restart** of `civicsense-wa-gateway-staging`. | Gateway restarts, loads session from PostgreSQL (`whatsmeow_device`), reconnects **without presenting QR code**. | `NOT DEPLOYED` |
| **07** | **Inbound Citizen Text** | From test phone, send WhatsApp message: `"There is a large pothole overflowing with water on 5th Main Road"`. | Message receives double checkmark `✓✓`; inbound event recorded in `inbound_events_queue`. | `NOT DEPLOYED` |
| **08** | **HMAC Verification** | Check FastAPI backend logs for event webhook `/internal/whatsapp/events`. | HTTP 200 OK; HMAC-SHA256 signature verified; event dispatched to background task. | `NOT DEPLOYED` |
| **09** | **AgentRuntime AI Intake** | FastAPI processes text with Gemini LLM. | AI categorizes complaint (Category: Road & Infrastructure, Severity: High, Dept: Public Works). | `NOT DEPLOYED` |
| **10** | **Outbound Confirmation** | Check test phone for incoming response from CivicSense AI. | Phone receives formatted reply: `"Thank you! Complaint registered under Ticket #CIV-..."`. | `NOT DEPLOYED` |
| **11** | **Citizen Photo Evidence** | Send a photograph of the civic grievance via WhatsApp with caption `"Waterlogging damage"`. | Gateway downloads media, FastAPI validates JPEG/PNG magic bytes, uploads to Supabase S3 bucket. | `NOT DEPLOYED` |
| **12** | **Vision AI Analysis** | Verify background processing of uploaded photo. | Gemini Vision model verifies pothole/water damage, generates description, attaches to incident evidence. | `NOT DEPLOYED` |
| **13** | **GPS Location Pin** | From WhatsApp, tap **Attach** $\rightarrow$ **Location** $\rightarrow$ **Send your current location**. | Gateway extracts lat/long coordinates; FastAPI maps coordinates to ward/zone. | `NOT DEPLOYED` |
| **14** | **Address Resolution** | Verify incident record in database. | Incident record contains accurate latitude, longitude, and reverse-geocoded address. | `NOT DEPLOYED` |
| **15** | **Incident Status Query** | Send WhatsApp message: `"STATUS CIV-XXXX"`. | CivicSense AI queries database and replies with current status (e.g. `Investigating`, `Assigned`). | `NOT DEPLOYED` |
| **16** | **My Complaints History** | Send WhatsApp message: `"MY COMPLAINTS"`. | CivicSense AI lists all active grievances submitted by the sender's phone number. | `NOT DEPLOYED` |
| **17** | **Citizen Escalation** | Send WhatsApp message: `"ESCALATE CIV-XXXX Overdue by 48 hours"`. | Grievance priority escalated to `CRITICAL`; notification logged for commissioner review. | `NOT DEPLOYED` |
| **18** | **Citizen Rating** | For resolved complaint, send: `"RATE CIV-XXXX 5 Great work fixed fast!"`. | Satisfaction score (5/5) and feedback recorded in database. | `NOT DEPLOYED` |
| **19** | **Staff Linking Request** | Municipal engineer requests linking code from CivicSense web portal. | Cryptographic 6-digit OTP generated; SHA-256 hash stored with 300s expiration. | `NOT DEPLOYED` |
| **20** | **Staff OTP Verification** | From test phone, send WhatsApp message: `"LINK 123456"` (with valid OTP). | CivicSense replies `"Staff device verified! Role: Field Engineer"`. Device upgraded to staff access. | `NOT DEPLOYED` |
| **21** | **Staff Task Listing** | Send WhatsApp message: `"TASKS"`. | CivicSense returns list of assigned municipal work orders for the engineer's department. | `NOT DEPLOYED` |
| **22** | **Staff Work Commencement** | Send WhatsApp message: `"START CIV-XXXX"`. | Incident status updates to `In Progress`; timestamp recorded in workflow logs. | `NOT DEPLOYED` |
| **23** | **Staff Resolution Photo** | Send photo of repaired site with caption `"RESOLVE CIV-XXXX Re-asphalt completed"`. | Incident marked `Resolved`; citizen notified of completion via WhatsApp. | `NOT DEPLOYED` |
| **24** | **Deduplication Check** | Send rapid duplicate messages or re-deliver same WhatsApp message ID. | Gateway detects message ID in `processed_messages` cache; discards duplicate without double-processing. | `NOT DEPLOYED` |
| **25** | **Queue Retry Recovery** | Simulate FastAPI backend temporary downtime (503); send WhatsApp message. | Gateway enqueues event in `inbound_events_queue` as `pending`; retries with exponential backoff; succeeds when backend recovers. | `NOT DEPLOYED` |
| **26** | **Zero Secret Leak Audit** | Inspect all container logs (Render, gateway, backend). | **Zero plain-text passwords, tokens, API keys, or database secrets appear in logs.** | `NOT DEPLOYED` |

---

## 3. Post-Testing Sign-off Matrix

| Verification Milestone | Sign-Off Criteria | Sign-Off Date | Verified By |
| :--- | :--- | :---: | :---: |
| **1. Session Persistence** | Session survives 3 consecutive gateway container restarts. | Pending | |
| **2. Inbound/Outbound Messaging** | Real WhatsApp messages successfully exchange with AI brain. | Pending | |
| **3. Media & Evidence** | Photos and GPS coordinates stored in private Supabase S3 bucket. | Pending | |
| **4. Staff Authentication** | Engineer OTP verification successfully links staff roles. | Pending | |
| **5. Production Protection** | All 401 production records verified intact in Ohio database. | **VERIFIED** | Local Safety Gate |
