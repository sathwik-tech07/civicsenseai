import type { FeatureCollection } from 'geojson';
import type { IoTSensorNode, LandmarkPreset } from './types';
import type { Incident, PredictiveRiskZone, Ward } from '../../types';

// Center of Bengaluru Metropolitan Region
export const BENGALURU_CENTER: [number, number] = [77.5946, 12.9716];

// Landmark Presets for Camera Fly-To
export const LANDMARK_PRESETS: LandmarkPreset[] = [
  {
    id: 'vidhana_soudha',
    name: 'Vidhana Soudha (Govt HQ)',
    coordinates: [77.5906, 12.9796],
    zoom: 16.5,
    pitch: 55,
    bearing: -20,
    description: 'Karnataka State Capitol & Executive Administrative Complex',
  },
  {
    id: 'ub_city',
    name: 'UB City & CBD Tower',
    coordinates: [77.5958, 12.9719],
    zoom: 16.8,
    pitch: 60,
    bearing: 45,
    description: 'Central Business District & Commercial Skyscraper Hub',
  },
  {
    id: 'mg_road',
    name: 'MG Road Transit Hub',
    coordinates: [77.6067, 12.9754],
    zoom: 16.5,
    pitch: 50,
    bearing: 10,
    description: 'Primary Arterial Metro Interchange & Commercial Corridor',
  },
  {
    id: 'iisc_campus',
    name: 'IISc Research Campus',
    coordinates: [77.5683, 13.0182],
    zoom: 16.0,
    pitch: 45,
    bearing: 0,
    description: 'Indian Institute of Science Academic & Research Hub',
  },
  {
    id: 'ecity_tech',
    name: 'Electronic City Phase 1',
    coordinates: [77.6602, 12.8452],
    zoom: 15.5,
    pitch: 55,
    bearing: 30,
    description: 'Global IT Industrial Corridor & Tech Park Complex',
  },
  {
    id: 'whitefield_itpl',
    name: 'ITPL Whitefield',
    coordinates: [77.7348, 12.9863],
    zoom: 15.8,
    pitch: 58,
    bearing: -15,
    description: 'International Tech Park Bengaluru & High-Density Commercial Zone',
  },
];

// 1. 3D Buildings GeoJSON (Landmarks + Extruded City Structures)
export const BUILDINGS_3D_GEOJSON: FeatureCollection = {
  type: 'FeatureCollection',
  features: [
    {
      type: 'Feature',
      properties: {
        id: 'bld_vidhana_soudha',
        name: 'Vidhana Soudha (State Legislature)',
        category: 'government',
        height: 45,
        min_height: 0,
        levels: 4,
        glow: '#8B5CF6',
      },
      geometry: {
        type: 'Polygon',
        coordinates: [
          [
            [77.5900, 12.9791],
            [77.5912, 12.9791],
            [77.5912, 12.9801],
            [77.5900, 12.9801],
            [77.5900, 12.9791],
          ],
        ],
      },
    },
    {
      type: 'Feature',
      properties: {
        id: 'bld_ub_city',
        name: 'UB City & Concorde Tower',
        category: 'commercial',
        height: 128,
        min_height: 0,
        levels: 37,
        glow: '#3B82F6',
      },
      geometry: {
        type: 'Polygon',
        coordinates: [
          [
            [77.5952, 12.9714],
            [77.5964, 12.9714],
            [77.5964, 12.9724],
            [77.5952, 12.9724],
            [77.5952, 12.9714],
          ],
        ],
      },
    },
    {
      type: 'Feature',
      properties: {
        id: 'bld_mg_road_utility',
        name: 'Public Utility Building (MG Road)',
        category: 'commercial',
        height: 85,
        min_height: 0,
        levels: 25,
        glow: '#3B82F6',
      },
      geometry: {
        type: 'Polygon',
        coordinates: [
          [
            [77.6062, 12.9750],
            [77.6072, 12.9750],
            [77.6072, 12.9758],
            [77.6062, 12.9758],
            [77.6062, 12.9750],
          ],
        ],
      },
    },
    {
      type: 'Feature',
      properties: {
        id: 'bld_manipal_hospital',
        name: 'Manipal Hospital (Old Airport Rd)',
        category: 'hospital',
        height: 42,
        min_height: 0,
        levels: 10,
        glow: '#06B6D4',
      },
      geometry: {
        type: 'Polygon',
        coordinates: [
          [
            [77.6477, 12.9577],
            [77.6489, 12.9577],
            [77.6489, 12.9587],
            [77.6477, 12.9587],
            [77.6477, 12.9577],
          ],
        ],
      },
    },
    {
      type: 'Feature',
      properties: {
        id: 'bld_bowring_hospital',
        name: 'Bowring & Lady Curzon Hospital',
        category: 'hospital',
        height: 30,
        min_height: 0,
        levels: 7,
        glow: '#06B6D4',
      },
      geometry: {
        type: 'Polygon',
        coordinates: [
          [
            [77.6004, 12.9830],
            [77.6016, 12.9830],
            [77.6016, 12.9840],
            [77.6004, 12.9840],
            [77.6004, 12.9830],
          ],
        ],
      },
    },
    {
      type: 'Feature',
      properties: {
        id: 'bld_iisc_tower',
        name: 'Indian Institute of Science Main Tower',
        category: 'school',
        height: 48,
        min_height: 0,
        levels: 12,
        glow: '#FBBF24',
      },
      geometry: {
        type: 'Polygon',
        coordinates: [
          [
            [77.5677, 13.0177],
            [77.5689, 13.0177],
            [77.5689, 13.0187],
            [77.5677, 13.0187],
            [77.5677, 13.0177],
          ],
        ],
      },
    },
    {
      type: 'Feature',
      properties: {
        id: 'bld_nps_indiranagar',
        name: 'National Public School Indiranagar',
        category: 'school',
        height: 26,
        min_height: 0,
        levels: 6,
        glow: '#FBBF24',
      },
      geometry: {
        type: 'Polygon',
        coordinates: [
          [
            [77.6402, 12.9779],
            [77.6414, 12.9779],
            [77.6414, 12.9789],
            [77.6402, 12.9789],
            [77.6402, 12.9779],
          ],
        ],
      },
    },
    {
      type: 'Feature',
      properties: {
        id: 'bld_manyata_tech_park',
        name: 'Manyata Tech Park Tower A',
        category: 'commercial',
        height: 75,
        min_height: 0,
        levels: 18,
        glow: '#3B82F6',
      },
      geometry: {
        type: 'Polygon',
        coordinates: [
          [
            [77.6191, 13.0470],
            [77.6203, 13.0470],
            [77.6203, 13.0480],
            [77.6191, 13.0480],
            [77.6191, 13.0470],
          ],
        ],
      },
    },
    {
      type: 'Feature',
      properties: {
        id: 'bld_ecity_infosys',
        name: 'Infosys Corporate Tower (E-City)',
        category: 'commercial',
        height: 60,
        min_height: 0,
        levels: 14,
        glow: '#3B82F6',
      },
      geometry: {
        type: 'Polygon',
        coordinates: [
          [
            [77.6596, 12.8447],
            [77.6608, 12.8447],
            [77.6608, 12.8457],
            [77.6596, 12.8457],
            [77.6596, 12.8447],
          ],
        ],
      },
    },
    {
      type: 'Feature',
      properties: {
        id: 'bld_itpl_whitefield',
        name: 'ITPL Discoverer Building',
        category: 'commercial',
        height: 70,
        min_height: 0,
        levels: 16,
        glow: '#3B82F6',
      },
      geometry: {
        type: 'Polygon',
        coordinates: [
          [
            [77.7342, 12.9858],
            [77.7354, 12.9858],
            [77.7354, 12.9868],
            [77.7342, 12.9868],
            [77.7342, 12.9858],
          ],
        ],
      },
    },
    {
      type: 'Feature',
      properties: {
        id: 'bld_peenya_industrial',
        name: 'Peenya Manufacturing Hub',
        category: 'industrial',
        height: 22,
        min_height: 0,
        levels: 4,
        glow: '#D97706',
      },
      geometry: {
        type: 'Polygon',
        coordinates: [
          [
            [77.5191, 13.0280],
            [77.5203, 13.0280],
            [77.5203, 13.0290],
            [77.5191, 13.0290],
            [77.5191, 13.0280],
          ],
        ],
      },
    },
    {
      type: 'Feature',
      properties: {
        id: 'bld_shantiniketan_residence',
        name: 'Prestige Shantiniketan Tower',
        category: 'residential',
        height: 92,
        min_height: 0,
        levels: 26,
        glow: '#475569',
      },
      geometry: {
        type: 'Polygon',
        coordinates: [
          [
            [77.7275, 12.9885],
            [77.7287, 12.9885],
            [77.7287, 12.9895],
            [77.7275, 12.9895],
            [77.7275, 12.9885],
          ],
        ],
      },
    },
    {
      type: 'Feature',
      properties: {
        id: 'bld_sobha_city',
        name: 'Sobha City Skyscraper',
        category: 'residential',
        height: 85,
        min_height: 0,
        levels: 24,
        glow: '#475569',
      },
      geometry: {
        type: 'Polygon',
        coordinates: [
          [
            [77.6274, 13.0645],
            [77.6286, 13.0645],
            [77.6286, 13.0655],
            [77.6274, 13.0655],
            [77.6274, 13.0645],
          ],
        ],
      },
    },
    // Grid of standard residential & commercial structures around CBD
    ...generateGridBuildings(),
  ],
};

function generateGridBuildings() {
  const gridFeatures = [];
  const categories: Array<'residential' | 'commercial' | 'industrial'> = ['residential', 'commercial', 'industrial'];
  let count = 0;

  for (let latStep = -3; latStep <= 3; latStep++) {
    for (let lngStep = -3; lngStep <= 3; lngStep++) {
      if (latStep === 0 && lngStep === 0) continue;
      count++;
      const centerLng = 77.5946 + lngStep * 0.008;
      const centerLat = 12.9716 + latStep * 0.008;
      const category = categories[(latStep + lngStep + 10) % 3];
      const height = category === 'commercial' ? 35 + Math.abs(latStep * 12) : 18 + Math.abs(lngStep * 6);

      gridFeatures.push({
        type: 'Feature' as const,
        properties: {
          id: `bld_grid_${count}`,
          name: `${category.charAt(0).toUpperCase() + category.slice(1)} Block ${count}`,
          category,
          height,
          min_height: 0,
          levels: Math.round(height / 3.2),
          glow: category === 'commercial' ? '#3B82F6' : '#475569',
        },
        geometry: {
          type: 'Polygon' as const,
          coordinates: [
            [
              [centerLng - 0.0012, centerLat - 0.001],
              [centerLng + 0.0012, centerLat - 0.001],
              [centerLng + 0.0012, centerLat + 0.001],
              [centerLng - 0.0012, centerLat + 0.001],
              [centerLng - 0.0012, centerLat - 0.001],
            ],
          ],
        },
      });
    }
  }
  return gridFeatures;
}

// 2. Arterial Roads GeoJSON
export const ROADS_GEOJSON: FeatureCollection = {
  type: 'FeatureCollection',
  features: [
    {
      type: 'Feature',
      properties: { name: 'MG Road Corridor', type: 'arterial' },
      geometry: {
        type: 'LineString',
        coordinates: [
          [77.5850, 12.9750],
          [77.5950, 12.9752],
          [77.6070, 12.9756],
          [77.6200, 12.9760],
          [77.6350, 12.9765],
        ],
      },
    },
    {
      type: 'Feature',
      properties: { name: 'Outer Ring Road (ORR)', type: 'highway' },
      geometry: {
        type: 'LineString',
        coordinates: [
          [77.6191, 13.0470],
          [77.6400, 13.0200],
          [77.6800, 12.9700],
          [77.6912, 12.9279],
          [77.6750, 12.8900],
          [77.6600, 12.8500],
        ],
      },
    },
    {
      type: 'Feature',
      properties: { name: 'Hosur Road Express Corridor', type: 'highway' },
      geometry: {
        type: 'LineString',
        coordinates: [
          [77.6000, 12.9400],
          [77.6200, 12.9100],
          [77.6450, 12.8800],
          [77.6600, 12.8450],
        ],
      },
    },
  ],
};

// 3. Water Network GeoJSON
export const WATER_NETWORK_GEOJSON: FeatureCollection = {
  type: 'FeatureCollection',
  features: [
    {
      type: 'Feature',
      properties: { name: 'Kaveri Supply Trunk Line 1', status: 'optimal', diameterMm: 1200 },
      geometry: {
        type: 'LineString',
        coordinates: [
          [77.5400, 12.9300],
          [77.5700, 12.9500],
          [77.5946, 12.9716],
          [77.6200, 12.9800],
          [77.6500, 12.9900],
        ],
      },
    },
    {
      type: 'Feature',
      properties: { name: 'Arkavathi Feeder Line', status: 'warning', diameterMm: 800 },
      geometry: {
        type: 'LineString',
        coordinates: [
          [77.5600, 13.0300],
          [77.5800, 13.0000],
          [77.5946, 12.9716],
          [77.6100, 12.9400],
        ],
      },
    },
    {
      type: 'Feature',
      properties: { name: 'Vrishabhavathi Storm Overflow Channel', status: 'critical', diameterMm: 1500 },
      geometry: {
        type: 'LineString',
        coordinates: [
          [77.5200, 12.9900],
          [77.5450, 12.9650],
          [77.5750, 12.9350],
          [77.6000, 12.9000],
        ],
      },
    },
  ],
};

// 4. Power Grid GeoJSON
export const POWER_GRID_GEOJSON: FeatureCollection = {
  type: 'FeatureCollection',
  features: [
    {
      type: 'Feature',
      properties: { name: 'BESCOM High-Voltage Transmission 220kV', voltageKv: 220, capacityMw: 450 },
      geometry: {
        type: 'LineString',
        coordinates: [
          [77.5300, 12.9600],
          [77.5600, 12.9700],
          [77.5900, 12.9800],
          [77.6300, 12.9900],
          [77.6700, 13.0000],
        ],
      },
    },
    {
      type: 'Feature',
      properties: { name: 'Peenya Substation - CBD Interconnect', voltageKv: 110, capacityMw: 280 },
      geometry: {
        type: 'LineString',
        coordinates: [
          [77.5200, 13.0280],
          [77.5500, 13.0000],
          [77.5946, 12.9716],
          [77.6400, 12.9300],
        ],
      },
    },
  ],
};

// 5. Flood Risk Zones GeoJSON
export const FLOOD_ZONES_GEOJSON: FeatureCollection = {
  type: 'FeatureCollection',
  features: [
    {
      type: 'Feature',
      properties: { name: 'Bellandur Lake Overflow Drainage Risk Basin', riskLevel: 'high', floodDepthMeters: 0.8 },
      geometry: {
        type: 'Polygon',
        coordinates: [
          [
            [77.6600, 12.9300],
            [77.6800, 12.9300],
            [77.6850, 12.9450],
            [77.6650, 12.9450],
            [77.6600, 12.9300],
          ],
        ],
      },
    },
    {
      type: 'Feature',
      properties: { name: 'Silk Board Junction Monsoon Inundation Zone', riskLevel: 'critical', floodDepthMeters: 1.2 },
      geometry: {
        type: 'Polygon',
        coordinates: [
          [
            [77.6180, 12.9120],
            [77.6300, 12.9120],
            [77.6300, 12.9220],
            [77.6180, 12.9220],
            [77.6180, 12.9120],
          ],
        ],
      },
    },
    {
      type: 'Feature',
      properties: { name: 'Hebbal Flyover Low Basin Drainage Deficit', riskLevel: 'medium', floodDepthMeters: 0.5 },
      geometry: {
        type: 'Polygon',
        coordinates: [
          [
            [77.5850, 13.0300],
            [77.6000, 13.0300],
            [77.6000, 13.0420],
            [77.5850, 13.0420],
            [77.5850, 13.0300],
          ],
        ],
      },
    },
  ],
};

// 6. Emergency Routes GeoJSON
export const EMERGENCY_ROUTES_GEOJSON: FeatureCollection = {
  type: 'FeatureCollection',
  features: [
    {
      type: 'Feature',
      properties: { name: 'Priority Green Corridor 1: CBD to Manipal Hospital', responseEtaMins: 8 },
      geometry: {
        type: 'LineString',
        coordinates: [
          [77.5906, 12.9796],
          [77.6067, 12.9754],
          [77.6400, 12.9650],
          [77.6480, 12.9580],
        ],
      },
    },
    {
      type: 'Feature',
      properties: { name: 'Priority Green Corridor 2: IISc to Victoria Hospital', responseEtaMins: 11 },
      geometry: {
        type: 'LineString',
        coordinates: [
          [77.5683, 13.0182],
          [77.5750, 12.9900],
          [77.5740, 12.9630],
        ],
      },
    },
  ],
};

// 7. Traffic Flow GeoJSON
export const TRAFFIC_FLOW_GEOJSON: FeatureCollection = {
  type: 'FeatureCollection',
  features: [
    {
      type: 'Feature',
      properties: { name: 'Silk Board to Bellandur ORR', congestionLevel: 'heavy', avgSpeedKmph: 12 },
      geometry: {
        type: 'LineString',
        coordinates: [
          [77.6200, 12.9150],
          [77.6500, 12.9250],
          [77.6750, 12.9350],
        ],
      },
    },
    {
      type: 'Feature',
      properties: { name: 'MG Road to Indiranagar 100ft Rd', congestionLevel: 'moderate', avgSpeedKmph: 28 },
      geometry: {
        type: 'LineString',
        coordinates: [
          [77.6070, 12.9756],
          [77.6250, 12.9760],
          [77.6400, 12.9780],
        ],
      },
    },
    {
      type: 'Feature',
      properties: { name: 'Airport Expressway (Hebbal to Yelahanka)', congestionLevel: 'free', avgSpeedKmph: 68 },
      geometry: {
        type: 'LineString',
        coordinates: [
          [77.5900, 13.0350],
          [77.6000, 13.0700],
          [77.6100, 13.1000],
        ],
      },
    },
  ],
};

// 8. Hospitals List & GeoJSON
export const HOSPITALS_LIST = [
  { id: 'hosp_1', name: 'Manipal Hospital (Old Airport Rd)', lat: 12.9582, lng: 77.6483, beds: 650, traumaCenter: true },
  { id: 'hosp_2', name: 'Bowring & Lady Curzon Hospital', lat: 12.9835, lng: 77.6010, beds: 480, traumaCenter: true },
  { id: 'hosp_3', name: 'Victoria Hospital (BMCRI Fort)', lat: 12.9630, lng: 77.5740, beds: 800, traumaCenter: true },
  { id: 'hosp_4', name: 'NIMHANS Neuro Hub', lat: 12.9430, lng: 77.5960, beds: 500, traumaCenter: true },
  { id: 'hosp_5', name: 'Apollo Speciality Bannerghatta', lat: 12.8960, lng: 77.5980, beds: 400, traumaCenter: true },
  { id: 'hosp_6', name: 'Fortis Hospital Cunningham Rd', lat: 12.9880, lng: 77.5920, beds: 320, traumaCenter: false },
];

export const HOSPITALS_GEOJSON: FeatureCollection = {
  type: 'FeatureCollection',
  features: HOSPITALS_LIST.map((h) => ({
    type: 'Feature',
    properties: h,
    geometry: {
      type: 'Point',
      coordinates: [h.lng, h.lat],
    },
  })),
};

// 9. Schools List & GeoJSON
export const SCHOOLS_LIST = [
  { id: 'sch_1', name: 'Indian Institute of Science (IISc)', lat: 13.0182, lng: 77.5683, type: 'University' },
  { id: 'sch_2', name: 'National Public School Indiranagar', lat: 12.9784, lng: 77.6408, type: 'School' },
  { id: 'sch_3', name: "St. Joseph's Boys High School", lat: 12.9710, lng: 77.6000, type: 'School' },
  { id: 'sch_4', name: 'RV College of Engineering (RVCE)', lat: 12.9230, lng: 77.5000, type: 'University' },
  { id: 'sch_5', name: 'BMS College of Engineering', lat: 12.9410, lng: 77.5650, type: 'University' },
];

export const SCHOOLS_GEOJSON: FeatureCollection = {
  type: 'FeatureCollection',
  features: SCHOOLS_LIST.map((s) => ({
    type: 'Feature',
    properties: s,
    geometry: {
      type: 'Point',
      coordinates: [s.lng, s.lat],
    },
  })),
};

// 10. IoT Sensor Nodes with Telemetry Data
export const IOT_SENSORS_DATA: IoTSensorNode[] = [
  {
    id: 'iot_aqi_01',
    name: 'CBD Air Quality Hub #1',
    type: 'aqi',
    lat: 12.9740,
    lng: 77.5980,
    wardId: 'WARD_001',
    wardName: 'Sampangi Rama Nagar',
    status: 'warning',
    telemetry: {
      aqi: { value: 168, pm25: 78.4, pm10: 124.0, status: 'unhealthy' },
      lastUpdated: '2 mins ago',
    },
  },
  {
    id: 'iot_water_01',
    name: 'Vrishabhavathi Pressure Telemetry',
    type: 'water',
    lat: 12.9650,
    lng: 77.5450,
    wardId: 'WARD_003',
    wardName: 'Vijayanagar',
    status: 'critical',
    telemetry: {
      waterFlow: { rateLitersPerMin: 420, pressureBar: 1.4, leakDetected: true },
      lastUpdated: '1 min ago',
    },
  },
  {
    id: 'iot_power_01',
    name: 'Peenya Industrial Power Node',
    type: 'power',
    lat: 13.0285,
    lng: 77.5195,
    wardId: 'WARD_005',
    wardName: 'Peenya Industrial Area',
    status: 'active',
    telemetry: {
      powerLoad: { currentMw: 320, capacityMw: 400, loadPercentage: 80.0 },
      lastUpdated: 'Just now',
    },
  },
  {
    id: 'iot_traffic_01',
    name: 'Silk Board Junction Radar',
    type: 'traffic',
    lat: 12.9170,
    lng: 77.6230,
    wardId: 'WARD_007',
    wardName: 'BTM Layout',
    status: 'warning',
    telemetry: {
      trafficFlow: { avgSpeedKmph: 11.5, vehicleCountPerMin: 185 },
      lastUpdated: '3 mins ago',
    },
  },
  {
    id: 'iot_noise_01',
    name: 'MG Road Metro Acoustic Monitor',
    type: 'noise',
    lat: 12.9754,
    lng: 77.6067,
    wardId: 'WARD_002',
    wardName: 'Shanthala Nagar',
    status: 'active',
    telemetry: {
      noiseLevel: { currentDb: 74.5, thresholdDb: 85.0 },
      lastUpdated: '4 mins ago',
    },
  },
  {
    id: 'iot_aqi_02',
    name: 'Whitefield ITPL AQI Sensor',
    type: 'aqi',
    lat: 12.9863,
    lng: 77.7348,
    wardId: 'WARD_009',
    wardName: 'Whitefield',
    status: 'active',
    telemetry: {
      aqi: { value: 65, pm25: 22.0, pm10: 45.0, status: 'good' },
      lastUpdated: '5 mins ago',
    },
  },
];

export const IOT_SENSORS_GEOJSON: FeatureCollection = {
  type: 'FeatureCollection',
  features: IOT_SENSORS_DATA.map((sns) => ({
    type: 'Feature',
    properties: sns,
    geometry: {
      type: 'Point',
      coordinates: [sns.lng, sns.lat],
    },
  })),
};

// 11. Wards Mock Data
export const MOCK_WARDS: Ward[] = [
  {
    id: 'WARD_001',
    name: 'Sampangi Rama Nagar',
    code: 'WRD-111',
    zone: 'East',
    population: 62400,
    councillor: 'Smt. R. Lakshmi',
    roadQuality: 78,
    drainageCondition: 64,
    streetlightAvailability: 92,
    garbageCleanliness: 80,
    resolutionTimeHours: 14.5,
    citizenSatScore: 84,
    overallScore: 78.5,
    openComplaints: 12,
    closedComplaints: 148,
    budgetUtilized: 4500000,
    budgetTotal: 6000000,
    lat: 12.9740,
    lng: 77.5980,
  },
  {
    id: 'WARD_002',
    name: 'Shanthala Nagar (CBD)',
    code: 'WRD-112',
    zone: 'East',
    population: 48200,
    councillor: 'Shri K. Venkatesh',
    roadQuality: 88,
    drainageCondition: 82,
    streetlightAvailability: 96,
    garbageCleanliness: 89,
    resolutionTimeHours: 8.2,
    citizenSatScore: 91,
    overallScore: 88.0,
    openComplaints: 5,
    closedComplaints: 210,
    budgetUtilized: 7200000,
    budgetTotal: 8000000,
    lat: 12.9754,
    lng: 77.6067,
  },
  {
    id: 'WARD_003',
    name: 'Vijayanagar',
    code: 'WRD-124',
    zone: 'West',
    population: 89000,
    councillor: 'Shri M. Nagaraj',
    roadQuality: 62,
    drainageCondition: 45,
    streetlightAvailability: 81,
    garbageCleanliness: 70,
    resolutionTimeHours: 24.0,
    citizenSatScore: 68,
    overallScore: 64.2,
    openComplaints: 34,
    closedComplaints: 180,
    budgetUtilized: 3800000,
    budgetTotal: 5500000,
    lat: 12.9650,
    lng: 77.5450,
  },
  {
    id: 'WARD_007',
    name: 'BTM Layout',
    code: 'WRD-176',
    zone: 'South',
    population: 94500,
    councillor: 'Shri R. Ananth',
    roadQuality: 58,
    drainageCondition: 42,
    streetlightAvailability: 85,
    garbageCleanliness: 64,
    resolutionTimeHours: 28.5,
    citizenSatScore: 62,
    overallScore: 61.5,
    openComplaints: 42,
    closedComplaints: 195,
    budgetUtilized: 5100000,
    budgetTotal: 7000000,
    lat: 12.9170,
    lng: 77.6230,
  },
  {
    id: 'WARD_009',
    name: 'Whitefield',
    code: 'WRD-201',
    zone: 'Mahadevapura',
    population: 112000,
    councillor: 'Smt. P. Sunitha',
    roadQuality: 74,
    drainageCondition: 68,
    streetlightAvailability: 90,
    garbageCleanliness: 76,
    resolutionTimeHours: 16.0,
    citizenSatScore: 78,
    overallScore: 75.0,
    openComplaints: 28,
    closedComplaints: 310,
    budgetUtilized: 9400000,
    budgetTotal: 12000000,
    lat: 12.9863,
    lng: 77.7348,
  },
];

// Helper to convert incidents & predictive risks to GeoJSON
export function incidentsToGeoJSON(incidents: Incident[]): FeatureCollection {
  return {
    type: 'FeatureCollection',
    features: (incidents || []).map((inc) => ({
      type: 'Feature',
      properties: inc,
      geometry: {
        type: 'Point',
        coordinates: [inc.lng, inc.lat],
      },
    })),
  };
}

export function predictiveRisksToGeoJSON(risks: PredictiveRiskZone[]): FeatureCollection {
  return {
    type: 'FeatureCollection',
    features: (risks || []).map((rk) => ({
      type: 'Feature',
      properties: rk,
      geometry: {
        type: 'Point',
        coordinates: [rk.lng, rk.lat],
      },
    })),
  };
}
