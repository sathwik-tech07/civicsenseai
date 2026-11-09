import type { Incident, IncidentStatus, IncidentSeverity, IncidentType, WorkflowStageItem, AuditLogItem, NotificationItem } from '../types';

export const TOKEN_STORAGE_KEY = 'civicsense_jwt';

const getApiBaseUrl = (): string => {
  // 1. Explicit environment variable
  const envUrl = import.meta.env.VITE_API_URL || import.meta.env.VITE_API_BASE_URL;
  if (envUrl && typeof envUrl === 'string' && envUrl.trim()) {
    const cleanUrl = envUrl.trim().replace(/\/$/, '');
    return cleanUrl.endsWith('/api/v1') ? cleanUrl : `${cleanUrl}/api/v1`;
  }

  // 2. Running locally in browser (localhost / 127.0.0.1) -> connect to local FastAPI
  if (typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')) {
    return 'http://127.0.0.1:8000/api/v1';
  }

  // 3. Deployed cloud fallback
  return 'https://civicsense-ai.onrender.com/api/v1';
};

export const API_BASE_URL = getApiBaseUrl();

/**
 * Token Storage Helpers
 */
export function getStoredToken(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return localStorage.getItem(TOKEN_STORAGE_KEY);
  } catch (e) {
    console.warn('Failed to read token from localStorage', e);
    return null;
  }
}

export function setStoredToken(token: string | null): void {
  if (typeof window === 'undefined') return;
  try {
    if (token) {
      localStorage.setItem(TOKEN_STORAGE_KEY, token);
    } else {
      localStorage.removeItem(TOKEN_STORAGE_KEY);
    }
  } catch (e) {
    console.warn('Failed to update stored token in localStorage', e);
  }
}

/**
 * Centralized Unauthorized (401) Event Dispatcher
 */
type UnauthorizedCallback = () => void;
const unauthorizedListeners: Set<UnauthorizedCallback> = new Set();

export function onUnauthorized(callback: UnauthorizedCallback): () => void {
  unauthorizedListeners.add(callback);
  return () => unauthorizedListeners.delete(callback);
}

export function notifyUnauthorized(): void {
  setStoredToken(null);
  unauthorizedListeners.forEach((cb) => {
    try {
      cb();
    } catch (err) {
      console.error('Error in onUnauthorized listener:', err);
    }
  });
}

/**
 * Centralized API Fetch Wrapper
 * Injects Authorization: Bearer <access_token> on protected requests,
 * sets default Content-Type headers, and intercepts 401 Unauthorized responses.
 */
export interface ApiFetchOptions extends RequestInit {
  isProtected?: boolean;
}

export async function apiFetch(
  endpoint: string,
  options: ApiFetchOptions = {}
): Promise<Response> {
  const { isProtected = true, headers: customHeaders, ...restOptions } = options;

  let url: string;
  if (endpoint.startsWith('http://') || endpoint.startsWith('https://')) {
    url = endpoint;
  } else {
    const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
    url = `${API_BASE_URL}${cleanEndpoint}`;
  }

  const headers = new Headers(customHeaders || {});

  // Inject Bearer token on protected endpoints if not already provided
  if (isProtected && !headers.has('Authorization')) {
    const token = getStoredToken();
    if (token) {
      headers.set('Authorization', `Bearer ${token}`);
    }
  }

  // Set default JSON Content-Type if body is not FormData and not explicitly set
  if (restOptions.body && !(restOptions.body instanceof FormData) && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const response = await fetch(url, {
    ...restOptions,
    headers,
  });

  // If 401 occurs on a protected endpoint, notify listeners to clear state and trigger logout
  if (response.status === 401 && isProtected) {
    notifyUnauthorized();
  }

  return response;
}

/**
 * 1. GET /api/v1/incidents
 */
export async function apiFetchIncidents(): Promise<Incident[]> {
  const res = await apiFetch('/incidents/', { method: 'GET' });
  if (!res.ok) {
    throw new Error(`Failed to fetch incidents: ${res.statusText}`);
  }
  const backendData = await res.json();
  if (!Array.isArray(backendData)) {
    throw new Error('Invalid response format: Expected an array of incidents.');
  }
  return backendData.map((item: any) => adaptBackendIncident(item));
}

/**
 * 2. POST /api/v1/incidents
 */
export async function apiCreateIncident(inc: Incident): Promise<Incident> {
  const payload = {
    title: inc.title,
    type: inc.type,
    severity: inc.severity,
    status: inc.status,
    ward_id: inc.wardId,
    ward_name: inc.wardName,
    lat: inc.lat,
    lng: inc.lng,
    address: inc.address,
    priority_score: inc.priorityScore,
    estimated_repair_cost: inc.estimatedRepairCost,
    saved_early_intervention: inc.savedEarlyIntervention,
    photo_url: inc.photoUrl,
    assigned_crew: inc.assignedCrew || 'Unassigned',
  };

  const res = await apiFetch('/incidents/', {
    method: 'POST',
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || `Failed to create incident: ${res.statusText}`);
  }
  const data = await res.json();
  return adaptBackendIncident(data);
}

/**
 * 3. GET /api/v1/incidents/{id}
 */
export async function apiFetchIncidentById(id: string): Promise<Incident> {
  const res = await apiFetch(`/incidents/${id}`, { method: 'GET' });
  if (!res.ok) {
    throw new Error(`Failed to fetch incident ${id}: ${res.statusText}`);
  }
  const data = await res.json();
  return adaptBackendIncident(data);
}

/**
 * 4. PUT /api/v1/incidents/{id}
 */
export async function apiUpdateIncident(id: string, updates: Partial<Incident>): Promise<Incident> {
  const payload: any = {};
  if (updates.status) payload.status = updates.status;
  if (updates.title) payload.title = updates.title;
  if (updates.severity) payload.severity = updates.severity;
  if (updates.assignedCrew) payload.assigned_crew = updates.assignedCrew;
  if (updates.priorityScore) payload.priority_score = updates.priorityScore;

  const res = await apiFetch(`/incidents/${id}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || `Failed to update incident ${id}: ${res.statusText}`);
  }

  const data = await res.json();
  return adaptBackendIncident(data);
}

/**
 * 5. POST /api/v1/incidents/analyze-vision
 * Real AI Vision Pipeline connecting to backend image understanding
 */
export async function apiAnalyzeIncidentVision(filename: string, imageUrl: string): Promise<{
  category: string;
  confidence: number;
  severity: 'low' | 'medium' | 'high' | 'critical';
  priority?: string;
  description?: string;
  title: string;
  explanation: string;
  priorityScore: number;
  estimatedRepairCost: number;
  savedEarlyIntervention: number;
  bounding_box: number[] | null;
  recommended_department: string;
  estimated_repair_time: string;
  requires_manual_review?: boolean;
}> {
  try {
    // Fetch the local blob URL to get the actual file data
    const resBlob = await fetch(imageUrl);
    const blob = await resBlob.blob();

    const formData = new FormData();
    formData.append('file', blob, filename);

    const res = await apiFetch('/incidents/analyze-vision', {
      method: 'POST',
      body: formData,
    });

    if (res.ok) {
      const data = await res.json();
      return {
        category: data.category || 'Pothole',
        confidence: data.confidence ?? 85.0,
        severity: data.severity || 'medium',
        priority: data.priority || 'Medium',
        description: data.description || data.explanation || 'Infrastructure defect detected.',
        title: data.title || `${data.category} Identified`,
        explanation: data.explanation || 'Analyzed by Municipal AI Vision.',
        priorityScore: data.priorityScore ?? 75,
        estimatedRepairCost: data.estimated_repair_cost ?? data.estimatedRepairCost ?? 25000,
        savedEarlyIntervention: data.savedEarlyIntervention ?? 85000,
        bounding_box: data.bounding_box || null,
        recommended_department: data.recommended_department || 'Roads & Infrastructure',
        estimated_repair_time: data.estimated_repair_time || '4 Hours',
        requires_manual_review: data.requires_manual_review || (data.confidence < 80.0),
      };
    }
    throw new Error('Failed to analyze image vision');
  } catch (err) {
    console.error('Failed to call FastAPI /analyze-vision:', err);
    throw err;
  }
}

/**
 * 6. DELETE /api/v1/incidents/{id}
 */
export async function apiDeleteIncident(id: string): Promise<boolean> {
  const res = await apiFetch(`/incidents/${id}`, { method: 'DELETE' });
  if (!res.ok) {
    throw new Error(`Failed to delete incident ${id}`);
  }
  return true;
}

/**
 * 7. GET /api/v1/dashboard/kpis
 */
export async function apiFetchDashboardKPIs() {
  try {
    const res = await apiFetch('/dashboard/kpis');
    if (res.ok) return await res.json();
  } catch (err) {
    console.warn('Failed to fetch KPIs from FastAPI:', err);
  }
  return {
    city_health_index: 88,
    active_incidents: 12,
    critical_alerts: 3,
    avg_resolution_hours: 18.4,
    ai_savings_ytd_inr: 1428000.0,
    sla_compliance_rate: 94.2,
  };
}

export interface AIAction {
  label: string;
  actionType: 'NAVIGATE_TO_TAB' | 'DISPATCH_CREW' | 'RESOLVE_INCIDENT' | 'FLY_TO_COORDS';
  payload?: any;
}

export interface AIResponse {
  text: string;
  dataSummary?: Record<string, string>;
  actions: AIAction[];
}

export interface AIStatusInfo {
  configured_provider: string;
  ollama: {
    connected: boolean;
    base_url: string;
    models: string[];
    active_text_model: string | null;
    active_vision_model: string | null;
    has_vision: boolean;
  };
  gemini: {
    available: boolean;
    model: string;
  };
  active_chat_engine: string;
  active_vision_engine: string;
}

/**
 * 8. GET /api/v1/ai/status
 */
export async function apiGetAIStatus(): Promise<AIStatusInfo | null> {
  try {
    const res = await apiFetch('/ai/status');
    if (res.ok) {
      return await res.json();
    }
  } catch (err) {
    console.warn('Could not fetch AI status:', err);
  }
  return null;
}

/**
 * 9. POST /api/v1/ai/chat
 */
export async function apiSendAIChat(
  query: string,
  system: 'command_os' | 'incident_copilot' = 'command_os',
  incidentId?: string
): Promise<AIResponse> {
  try {
    const res = await apiFetch('/ai/chat', {
      method: 'POST',
      body: JSON.stringify({ query, system, incident_id: incidentId }),
    });
    if (res.ok) {
      const data = await res.json();
      if (data && data.text) return data as AIResponse;
    }
  } catch (err) {
    console.warn('Failed to send AI chat to FastAPI, using smart fallback logic:', err);
  }

  // Smart Fallback for Action Engine Demonstration
  return generateFallbackAIResponse(query);
}

function generateFallbackAIResponse(query: string): AIResponse {
  const q = query.toLowerCase();

  if (q.includes('ward') || q.includes('attention') || q.includes('risk')) {
    return {
      text: 'AI Command OS analysis: Ward 4 (Metro Health Corridor) requires immediate commissioner attention due to 98% water main structural failure probability during approaching monsoon peak.',
      actions: [
        { label: 'Fly camera to Ward 4', actionType: 'FLY_TO_COORDS', payload: [77.5946, 12.9716] },
        { label: 'Inspect Ward 4 3D Twin', actionType: 'NAVIGATE_TO_TAB', payload: '3d-twin' },
      ],
      dataSummary: {
        'Target Ward': 'Ward 4 Metro Health Corridor',
        'Vulnerability Index': '98% Critical Risk',
        'Primary Threat': 'Stormwater Drain & Water Main Leakage',
      },
    };
  }

  if (q.includes('dispatch') || q.includes('crew') || q.includes('send')) {
    return {
      text: 'Dispatch command recognized. Recommending Rapid Response Crew Alpha-1 deployment for the highest priority open critical incident.',
      actions: [
        { label: 'Dispatch Alpha-1 to Critical Incident', actionType: 'DISPATCH_CREW', payload: 'auto' },
        { label: 'View Incident Feed', actionType: 'NAVIGATE_TO_TAB', payload: 'dashboard' },
      ],
    };
  }

  if (q.includes('briefing') || q.includes('today') || q.includes('summary')) {
    return {
      text: "Executive City Intelligence Briefing for today: City Health Index stands at 88/100 (+4.2% YTD). AI Early Intervention has saved ₹1.42M in emergency repairs this quarter.",
      actions: [
        { label: 'View Department Performance', actionType: 'NAVIGATE_TO_TAB', payload: 'war-room' },
        { label: 'Open Executive Dashboard', actionType: 'NAVIGATE_TO_TAB', payload: 'dashboard' },
      ],
      dataSummary: {
        'City Health Score': '88 / 100',
        'Total Early Savings': '₹1.42M YTD',
        'SLA Compliance Rate': '94.2%',
      },
    };
  }

  return {
    text: `AI Command OS processed city query "${query}". All 5 active AI models report stable baseline operations across the metro area.`,
    actions: [
      { label: 'Which ward needs immediate attention?', actionType: 'NAVIGATE_TO_TAB', payload: 'gis' },
      { label: "Generate today's city briefing", actionType: 'NAVIGATE_TO_TAB', payload: 'reports' },
    ],
  };
}

/**
 * 10. GET /api/v1/wards
 */
export async function apiFetchWards(): Promise<any[]> {
  const res = await apiFetch('/wards');
  if (!res.ok) throw new Error('Failed to fetch wards from FastAPI');
  return await res.json();
}

/**
 * 11. GET /api/v1/departments
 */
export async function apiFetchDepartments(): Promise<any[]> {
  const res = await apiFetch('/departments');
  if (!res.ok) throw new Error('Failed to fetch departments from FastAPI');
  return await res.json();
}

/**
 * 12. GET /api/v1/predictive-risks
 */
export async function apiFetchPredictiveRisks(): Promise<any[]> {
  const res = await apiFetch('/predictive-risks');
  if (!res.ok) throw new Error('Failed to fetch predictive risks from FastAPI');
  return await res.json();
}

/**
 * 13. GET /api/v1/citizens
 */
export async function apiFetchCitizens(): Promise<any[]> {
  const res = await apiFetch('/citizens');
  if (!res.ok) throw new Error('Failed to fetch citizens from FastAPI');
  return await res.json();
}

/**
 * Adapt backend snake_case JSON to frontend camelCase Incident model
 */
function adaptBackendIncident(data: any): Incident {
  return {
    id: data.id || `INC-2026-${Math.floor(Math.random() * 9000) + 1000}`,
    title: data.title || 'Civic Incident',
    type: (data.type || 'pothole') as IncidentType,
    severity: (data.severity || 'high') as IncidentSeverity,
    status: (data.status || 'reported') as IncidentStatus,
    wardId: data.ward_id || 'w-1',
    wardName: data.ward_name || 'Ward 1 - Metro Health Corridor',
    lat: data.lat || 12.9716,
    lng: data.lng || 77.5946,
    address: data.address || 'Metro Health Corridor',
    reportedDate: data.created_at
      ? new Date(data.created_at.endsWith('Z') ? data.created_at : data.created_at + 'Z').toLocaleString()
      : 'Just Now',
    reportedBy: data.reported_by || 'Citizen Reporter',
    priorityScore: data.priority_score || 85,
    estimatedRepairCost: data.estimated_repair_cost || 85000,
    savedEarlyIntervention: data.saved_early_intervention || 250000,
    photoUrl: data.photo_url || 'https://images.unsplash.com/photo-1541888946425-d0fbb186a5b3?q=80&w=800',
    assignedCrew: data.assigned_crew || 'Unassigned',
    xai: {
      cvConfidence: 96.8,
      cvModel: 'YOLOv11x + RT-DETR Ensemble',
      hospitalProximityMeters: 340,
      hospitalName: 'Victoria Municipal Hospital',
      roadClassification: 'Primary Arterial Corridor',
      duplicateComplaintsCount: 4,
      estimatedDailyTraffic: 14500,
      historicalFailureRate: 78.5,
      weatherRiskFactor: 'Precipitation Runoff Surge',
    },
  };
}

export interface DynamicInfraAsset {
  id: string;
  name: string;
  category: 'hospital' | 'school' | 'metro' | 'fire' | 'police' | 'water' | 'electric' | 'govt';
  lat: number;
  lng: number;
  distanceMeters: number;
  etaMins: number;
  criticality: 'CRITICAL' | 'HIGH' | 'MEDIUM';
  icon: string;
}

export interface GISIntelligencePayload {
  location: {
    lat: number;
    lng: number;
    wardName: string;
  };
  infrastructure: DynamicInfraAsset[];
  weather: {
    temperature: number;
    rainfall: number;
    humidity: number;
    windSpeed: number;
    visibility: number;
    floodRisk: string;
    weatherImpact: string;
    isRaining: boolean;
  };
  traffic: {
    trafficDensity: string;
    roadCongestionPct: number;
    emergencyDelayMins: number;
    suggestedRouteName: string;
    emergencyRouteCoordinates: [number, number][];
    trafficCorridors: {
      id: string;
      name: string;
      congestionLevel: string;
      densityVehiclesPerKm: number;
      averageSpeedKmh: number;
      positions: [number, number][];
    }[];
  };
  xaiRisk: {
    totalRiskScore: number;
    riskLevel: string;
    baseScore: number;
    breakdown: {
      factor: string;
      points: number;
      description: string;
      icon: string;
    }[];
    summary: string;
  };
}

/**
 * 14. GET /api/v1/gis/intelligence
 * Fetches dynamic GIS Intelligence bundle for incident coordinates
 */
export async function apiFetchGISIntelligence(
  lat: number,
  lng: number,
  type?: string,
  severity?: string,
  wardName?: string
): Promise<GISIntelligencePayload> {
  const params = new URLSearchParams({
    lat: lat.toString(),
    lng: lng.toString(),
  });
  if (type) params.append('incident_type', type);
  if (severity) params.append('severity', severity);
  if (wardName) params.append('ward_name', wardName);

  const res = await apiFetch(`/gis/intelligence?${params.toString()}`);
  if (!res.ok) throw new Error('Failed to fetch GIS Intelligence from backend');
  return await res.json();
}

/**
 * 15. POST /api/v1/workflow/transition
 */
export async function apiTransitionWorkflowStage(
  incidentId: string,
  targetStage: string,
  actor: string,
  notes?: string,
  resolvedPhotoUrl?: string,
  assignedCrew?: string
): Promise<any> {
  const res = await apiFetch('/workflow/transition', {
    method: 'POST',
    body: JSON.stringify({
      incident_id: incidentId,
      target_stage: targetStage,
      actor,
      notes,
      resolved_photo_url: resolvedPhotoUrl,
      assigned_crew: assignedCrew,
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Failed stage transition' }));
    throw new Error(err.detail || 'Failed workflow stage transition');
  }
  return await res.json();
}

/**
 * 16. GET /api/v1/workflow/timeline/{incident_id}
 */
export async function apiFetchWorkflowTimeline(incidentId: string): Promise<WorkflowStageItem[]> {
  const res = await apiFetch(`/workflow/timeline/${incidentId}`);
  if (!res.ok) throw new Error('Failed to fetch incident timeline');
  return await res.json();
}

/**
 * 17. GET /api/v1/workflow/audit-logs/{incident_id}
 */
export async function apiFetchAuditLogs(incidentId: string): Promise<AuditLogItem[]> {
  const res = await apiFetch(`/workflow/audit-logs/${incidentId}`);
  if (!res.ok) throw new Error('Failed to fetch incident audit logs');
  return await res.json();
}

/**
 * 18. GET /api/v1/workflow/notifications
 */
export async function apiFetchNotifications(): Promise<NotificationItem[]> {
  const res = await apiFetch('/workflow/notifications');
  if (!res.ok) throw new Error('Failed to fetch notifications');
  return await res.json();
}

/**
 * 19. PUT /api/v1/workflow/notifications/{id}/read
 */
export async function apiMarkNotificationRead(id: string): Promise<boolean> {
  const res = await apiFetch(`/workflow/notifications/${id}/read`, { method: 'PUT' });
  return res.ok;
}

/**
 * 20. PUT /api/v1/workflow/notifications/read-all
 */
export async function apiMarkAllNotificationsRead(): Promise<boolean> {
  const res = await apiFetch('/workflow/notifications/read-all', { method: 'PUT' });
  return res.ok;
}

/**
 * 21. POST /api/v1/workflow/notifications/create
 */
export async function apiCreateNotification(
  incidentId: string,
  type: string,
  title: string,
  message: string
): Promise<any> {
  const res = await apiFetch('/workflow/notifications/create', {
    method: 'POST',
    body: JSON.stringify({ incident_id: incidentId, type, title, message }),
  });
  if (res.ok) return await res.json();
  return null;
}

/**
 * 22. POST /api/v1/auth/login
 */
export async function apiLogin(email: string, password: string): Promise<any> {
  const res = await apiFetch('/auth/login', {
    method: 'POST',
    isProtected: false,
    body: JSON.stringify({ email: email.trim(), password }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Invalid credentials' }));
    throw new Error(err.detail || 'Incorrect email or password');
  }
  const data = await res.json();
  if (data?.access_token) {
    setStoredToken(data.access_token);
  }
  return data;
}

/**
 * 23. POST /api/v1/auth/signup
 */
export async function apiSignup(fullName: string, email: string, password: string, role: string): Promise<any> {
  const res = await apiFetch('/auth/signup', {
    method: 'POST',
    isProtected: false,
    body: JSON.stringify({ full_name: fullName.trim(), email: email.trim(), password, role }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Registration failed' }));
    throw new Error(err.detail || 'Failed to register account');
  }
  return await res.json();
}

/**
 * 24. GET /api/v1/auth/me
 */
export async function apiGetMe(token?: string): Promise<any> {
  const customHeaders: Record<string, string> = {};
  if (token) {
    customHeaders['Authorization'] = `Bearer ${token}`;
  }
  const res = await apiFetch('/auth/me', {
    headers: token ? customHeaders : undefined,
    isProtected: true,
  });
  if (!res.ok) {
    throw new Error('Failed to fetch user profile');
  }
  return await res.json();
}
