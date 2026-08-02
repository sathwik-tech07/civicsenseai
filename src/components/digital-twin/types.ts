export type LayerCategory = 'urban' | 'transport' | 'utilities' | 'facilities' | 'iot' | 'risk';

export interface GISLayerConfig {
  id: string;
  name: string;
  category: LayerCategory;
  iconName: string;
  visible: boolean;
  opacity: number;
  sourceId: string;
  layerIds: string[];
  description: string;
}

export interface IoTSensorTelemetry {
  aqi?: {
    value: number;
    pm25: number;
    pm10: number;
    status: 'good' | 'moderate' | 'unhealthy' | 'hazardous';
  };
  waterFlow?: {
    rateLitersPerMin: number;
    pressureBar: number;
    leakDetected: boolean;
  };
  powerLoad?: {
    currentMw: number;
    capacityMw: number;
    loadPercentage: number;
  };
  noiseLevel?: {
    currentDb: number;
    thresholdDb: number;
  };
  trafficFlow?: {
    avgSpeedKmph: number;
    vehicleCountPerMin: number;
  };
  lastUpdated: string;
}

export type SensorType = 'aqi' | 'water' | 'power' | 'noise' | 'traffic';

export interface IoTSensorNode {
  id: string;
  name: string;
  type: SensorType;
  lat: number;
  lng: number;
  wardId: string;
  wardName: string;
  status: 'active' | 'warning' | 'critical' | 'offline';
  telemetry: IoTSensorTelemetry;
}

export type SearchCategory = 'ward' | 'poi' | 'hospital' | 'sensor' | 'incident' | 'risk';

export interface SearchItem {
  id: string;
  title: string;
  subtitle: string;
  category: SearchCategory;
  coordinates: [number, number]; // [lng, lat]
  metadata: Record<string, any>;
}

export type MeasurementMode = 'none' | 'distance' | 'area' | 'polygon';

export interface GeodesicMeasurement {
  points: [number, number][];
  distanceMeters: number;
  areaSqMeters: number;
}

export type MapStyleId = 'streets' | 'satellite' | 'terrain' | 'hybrid';

export type WeatherMode = 'sunny' | 'cloudy' | 'rain' | 'heavy_rain' | 'storm' | 'fog' | 'night';

export interface WeatherConfig {
  id: WeatherMode;
  name: string;
  icon: string;
  description: string;
  riskMultiplier: number;
  precipitationIntensity: number; // 0 to 1
  fogDensity: number; // 0 to 1
  isNight: boolean;
  lightning: boolean;
  alertNotice?: string;
}

export interface MapStyleOption {
  id: MapStyleId;
  name: string;
  description: string;
  previewColor: string;
}

export interface LandmarkPreset {
  id: string;
  name: string;
  coordinates: [number, number]; // [lng, lat]
  zoom: number;
  pitch: number;
  bearing: number;
  description: string;
}

export interface SelectedEntityInfo {
  type: 'incident' | 'risk' | 'sensor' | 'ward' | 'hospital' | 'landmark' | 'building' | 'road';
  data: any;
}
