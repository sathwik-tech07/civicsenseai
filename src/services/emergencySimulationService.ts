export type EmergencyStageId = 'citizen_report' | 'ai_detection' | 'commissioner_approval' | 'crew_assigned' | 'vehicle_en_route' | 'repair_started' | 'repair_completed';

export interface EmergencyStage {
  id: EmergencyStageId;
  label: string;
  progress: number;
}

export interface EmergencyVehicleSimulation {
  id: string;
  name: string;
  icon: string;
  color: string;
  route: string;
  initialEtaSeconds: number;
  initialDistanceMeters: number;
  initialPositionPercent: number;
}

export const EMERGENCY_SIMULATION_STAGES: EmergencyStage[] = [
  { id: 'citizen_report', label: 'Citizen Report', progress: 14 },
  { id: 'ai_detection', label: 'AI Detection', progress: 28 },
  { id: 'commissioner_approval', label: 'Commissioner Approval', progress: 42 },
  { id: 'crew_assigned', label: 'Crew Assigned', progress: 56 },
  { id: 'vehicle_en_route', label: 'Vehicle En Route', progress: 70 },
  { id: 'repair_started', label: 'Repair Started', progress: 85 },
  { id: 'repair_completed', label: 'Repair Resolved', progress: 100 },
];

export const EMERGENCY_SIMULATION_VEHICLES: EmergencyVehicleSimulation[] = [
  {
    id: 'unit-1',
    name: 'Heavy Utility Repair Truck #08',
    icon: '🛠️',
    color: '#00D4FF',
    route: 'Victoria Road → Hospital Bypass → Sector 2',
    initialEtaSeconds: 252,
    initialDistanceMeters: 1400,
    initialPositionPercent: 14,
  },
  {
    id: 'unit-2',
    name: 'Fire Engine Unit 04',
    icon: '🚒',
    color: '#EF4444',
    route: 'Station 1 → Central Boulevard → Ward 4',
    initialEtaSeconds: 225,
    initialDistanceMeters: 1100,
    initialPositionPercent: 22,
  },
  {
    id: 'unit-3',
    name: 'Police Traffic Squad 12',
    icon: '🚓',
    color: '#3B82F6',
    route: 'Intersection 4 → Sector 2 Roadblock',
    initialEtaSeconds: 110,
    initialDistanceMeters: 600,
    initialPositionPercent: 34,
  },
  {
    id: 'unit-4',
    name: 'Emergency Medical Ambulance 09',
    icon: '🚑',
    color: '#10B981',
    route: 'Metro Hospital → Northern Detour → Ward 4',
    initialEtaSeconds: 270,
    initialDistanceMeters: 1800,
    initialPositionPercent: 11,
  },
  {
    id: 'unit-5',
    name: 'Autonomous Inspection Drone Sentinel Alpha',
    icon: '🚁',
    color: '#8B5CF6',
    route: 'Direct Overhead Vector 120m Altitude',
    initialEtaSeconds: 40,
    initialDistanceMeters: 200,
    initialPositionPercent: 76,
  },
];

export function formatCountdown(seconds: number): string {
  const safeSeconds = Math.max(0, Math.floor(seconds));
  return `${String(Math.floor(safeSeconds / 60)).padStart(2, '0')}m ${String(safeSeconds % 60).padStart(2, '0')}s`;
}

export function formatDistance(meters: number): string {
  return `${(Math.max(0, meters) / 1000).toFixed(1)} km`;
}

export function getVehicleStatusByStage(stageIndex: number, positionPercent: number): string {
  if (positionPercent >= 100) return 'Completed';
  if (stageIndex >= 5) {
    return positionPercent >= 90 ? 'Repair Started' : 'Arriving';
  }
  if (stageIndex >= 4) {
    return positionPercent >= 60 ? 'En Route' : 'Dispatching';
  }
  return 'Dispatching';
}
