export type IncidentSeverity = 'low' | 'medium' | 'high' | 'critical';
export type IncidentStatus = 
  | 'reported'
  | 'ai_analysis'
  | 'verified'
  | 'priority_assigned'
  | 'commissioner_review'
  | 'crew_assigned'
  | 'en_route'
  | 'repair_started'
  | 'quality_inspection'
  | 'resolved'
  | 'citizen_notified'
  | 'in_progress'
  | string;
export type IncidentType =
  | 'pothole'
  | 'road_crack'
  | 'water_leakage'
  | 'garbage_overflow'
  | 'broken_streetlight'
  | 'drainage_blockage'
  | 'illegal_dumping'
  | 'fallen_tree'
  | 'traffic_signal_failure'
  | string;

export interface IncidentLocation {
  lat: number;
  lng: number;
  street: string;
  area: string;
  ward: string;
  wardId: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  formattedAddress: string;
  accuracyMeters?: number;
  method: 'gps' | 'search' | 'map_picker';
}

export interface XAIFactors {
  cvConfidence: number; // e.g., 98.4%
  cvModel: string; // e.g., 'YOLOv11x + SAM Defect Segmenter'
  hospitalProximityMeters: number; // e.g., 120
  hospitalName: string;
  roadClassification: string; // e.g., 'Primary Arterial Corridor'
  duplicateComplaintsCount: number; // e.g., 14
  estimatedDailyTraffic: number; // e.g., 14500
  historicalFailureRate: number; // e.g., 78%
  weatherRiskFactor: string; // e.g., 'Monsoon Rain Vulnerability'
}

export interface Incident {
  id: string;
  title: string;
  type: IncidentType;
  severity: IncidentSeverity;
  status: IncidentStatus;
  wardId: string;
  wardName: string;
  lat: number;
  lng: number;
  address: string;
  reportedDate: string;
  reportedBy: string;
  priorityScore: number; // 0 - 100
  xai: XAIFactors;
  estimatedRepairCost: number; // $ or ₹
  savedEarlyIntervention: number;
  assignedCrew?: string;
  assignedVehicle?: string;
  assignedEquipment?: string;
  assignedMaterials?: string;
  priorityRoute?: string;
  estimatedCompletionTimeHours?: number;
  photoUrl: string;
  resolvedPhotoUrl?: string;
  voiceNoteText?: string;
  isOfflineSynced?: boolean;

  // Complete AI Incident Intelligence Fields
  category?: string;
  confidence?: number;
  priority?: string;
  description?: string;
  recommendedDepartment?: string;
  estimatedRepairTime?: string;
  publicSafetyRisk?: string;
  environmentalImpact?: string;
  futureDamagePrediction?: string;
  aiRecommendation?: string;
  executiveSummary?: string;
  explanation?: string;
  requiresManualReview?: boolean;
}

export interface Ward {
  id: string;
  name: string;
  code: string;
  zone: string;
  population: number;
  councillor: string;
  roadQuality: number; // 0 - 100
  drainageCondition: number; // 0 - 100
  streetlightAvailability: number; // 0 - 100
  garbageCleanliness: number; // 0 - 100
  resolutionTimeHours: number;
  citizenSatScore: number; // 0 - 100
  overallScore: number; // 0 - 100
  openComplaints: number;
  closedComplaints: number;
  budgetUtilized: number;
  budgetTotal: number;
  lat: number;
  lng: number;
}

export interface PredictiveRiskZone {
  id: string;
  zoneName: string;
  wardId: string;
  wardName: string;
  riskType: 'road_failure' | 'drainage_overflow' | 'garbage_overflow' | 'water_leakage';
  failureProbabilityScore: number; // 0 - 100
  roadAgeYears: number;
  heavyVehicleVolumePerDay: number;
  rainfallForecastMm: number;
  pastRepairsCount: number;
  recommendedAction: string;
  estimatedInterventionCost: number;
  potentialDamageCostIfIgnored: number;
  lat: number;
  lng: number;
}

export interface DepartmentPerformance {
  id: string;
  name: string;
  code: string;
  headOfficer: string;
  allocatedBudget: number;
  spentBudget: number;
  activeCrews: number;
  totalCrews: number;
  avgResolutionDays: number;
  satisfactionRating: number;
  openIncidents: number;
  resolvedThisMonth: number;
}

export interface CitizenContributor {
  id: string;
  name: string;
  avatar: string;
  points: number;
  rank: number;
  reportsSubmitted: number;
  verifiedFixes: number;
  badges: Array<{
    id: string;
    title: string;
    icon: string;
    description: string;
    earnedDate: string;
  }>;
}

export interface SmartResourceRecommendation {
  incidentId: string;
  crewName: string;
  vehicleName: string;
  equipmentNeeded: string[];
  materialsRequired: string;
  priorityDispatchRoute: string;
  estimatedLaborHours: number;
  estimatedTotalCost: number;
  earlyInterventionSavings: number;
}

export interface WorkflowStageItem {
  stage: string;
  label: string;
  status: 'completed' | 'current' | 'pending';
  timestamp: string | null;
  assignedUser: string;
  department: string;
  notes: string;
  durationSeconds: number;
}

export interface AuditLogItem {
  id: number;
  incidentId: string;
  who: string;
  what: string;
  when: string;
  result: string;
}

export interface NotificationItem {
  id: string;
  incidentId: string;
  type: string;
  title: string;
  message: string;
  timestamp: string;
  read: boolean;
}
