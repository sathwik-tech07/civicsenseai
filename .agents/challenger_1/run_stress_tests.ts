import {
  incidentsToGeoJSON,
  predictiveRisksToGeoJSON,
  BENGALURU_CENTER,
  BUILDINGS_3D_GEOJSON,
  ROADS_GEOJSON,
  WATER_NETWORK_GEOJSON,
  POWER_GRID_GEOJSON,
  FLOOD_ZONES_GEOJSON,
  EMERGENCY_ROUTES_GEOJSON,
  TRAFFIC_FLOW_GEOJSON,
  HOSPITALS_GEOJSON,
  SCHOOLS_GEOJSON,
  IOT_SENSORS_DATA,
  IOT_SENSORS_GEOJSON,
  MOCK_WARDS,
} from '../../src/components/digital-twin/mockGisData';
import { MAP_STYLES, MAP_STYLE_OPTIONS } from '../../src/components/digital-twin/mapStyles';
import {
  calculateGeodesicDistance,
  calculateTotalPathDistance,
  calculateGeodesicArea,
  formatDistance,
  formatArea,
} from '../../src/components/digital-twin/MeasurementTool';
import type { Incident, PredictiveRiskZone } from '../../src/types';

console.log('=== CIVICSENSE 3D DIGITAL TWIN EMPIRICAL STRESS TEST SUITE ===\n');

let passedTests = 0;
let failedTests = 0;
const issuesFound: string[] = [];

function assert(condition: boolean, testName: string, failureDetail?: string) {
  if (condition) {
    console.log(`[PASS] ${testName}`);
    passedTests++;
  } else {
    console.error(`[FAIL] ${testName} - ${failureDetail}`);
    failedTests++;
    issuesFound.push(`${testName}: ${failureDetail}`);
  }
}

// ── TEST 1: EMPTY & MALFORMED ARRAYS FOR INCIDENTS & RISKS ──
console.log('--- TEST GROUP 1: Edge Cases for Incidents & Predictive Risks ---');

try {
  const emptyIncGeoJSON = incidentsToGeoJSON([]);
  assert(
    emptyIncGeoJSON.type === 'FeatureCollection' && emptyIncGeoJSON.features.length === 0,
    'Empty incidents array returns valid empty FeatureCollection'
  );
} catch (e: any) {
  assert(false, 'Empty incidents array returns valid empty FeatureCollection', e.message);
}

try {
  const nullIncGeoJSON = incidentsToGeoJSON(null as any);
  assert(
    nullIncGeoJSON.type === 'FeatureCollection' && nullIncGeoJSON.features.length === 0,
    'Null incidents input handled safely via fallback'
  );
} catch (e: any) {
  assert(false, 'Null incidents input handled safely via fallback', e.message);
}

try {
  const undefinedRiskGeoJSON = predictiveRisksToGeoJSON(undefined as any);
  assert(
    undefinedRiskGeoJSON.type === 'FeatureCollection' && undefinedRiskGeoJSON.features.length === 0,
    'Undefined predictive risks input handled safely via fallback'
  );
} catch (e: any) {
  assert(false, 'Undefined predictive risks input handled safely via fallback', e.message);
}

// Check handling of malformed coordinates
const malformedIncidents: Incident[] = [
  {
    id: 'inc_malformed_1',
    title: 'Broken Pothole Null Coord',
    description: 'Test',
    category: 'pothole',
    severity: 'high',
    status: 'reported',
    lat: NaN,
    lng: 77.5946,
    address: 'CBD',
    reportedDate: '2026-08-01',
    reportedBy: 'Test',
    wardId: 'WARD_001',
    wardName: 'Test Ward',
    priorityScore: 80,
  },
];

try {
  const malformedGeoJSON = incidentsToGeoJSON(malformedIncidents);
  const feat = malformedGeoJSON.features[0];
  const hasNaNCoord = Number.isNaN(feat.geometry.coordinates[1]);
  if (hasNaNCoord) {
    console.warn('  [WARNING] GeoJSON output contains NaN coordinates! MapLibre will throw error on rendering NaN coords.');
    issuesFound.push('GeoJSON coordinate generation does not sanitize NaN/null coordinates, leading to MapLibre rendering crashes.');
  }
  assert(true, 'Incidents GeoJSON generator processes malformed array without thrown JS exception');
} catch (e: any) {
  assert(false, 'Incidents GeoJSON generator processes malformed array without thrown JS exception', e.message);
}


// ── TEST GROUP 2: GEODESIC MEASUREMENT UTILITY MATHEMATICS ──
console.log('\n--- TEST GROUP 2: Geodesic Measurement Mathematics & Edge Geometries ---');

// Distance between Bengaluru Vidhana Soudha and UB City (~1.0 km)
const Soudha: [number, number] = [77.5906, 12.9796];
const UBCity: [number, number] = [77.5958, 12.9719];
const distMeters = calculateGeodesicDistance(Soudha, UBCity);
assert(
  distMeters > 900 && distMeters < 1100,
  `Geodesic distance Soundha-UB City accuracy (${Math.round(distMeters)}m expected ~1000m)`
);

// Empty points distance
assert(calculateTotalPathDistance([]) === 0, 'Total path distance for 0 points is 0');
assert(calculateTotalPathDistance([Soudha]) === 0, 'Total path distance for 1 point is 0');

// Polygon Area
const polyCoords: [number, number][] = [
  [77.5900, 12.9700],
  [77.6000, 12.9700],
  [77.6000, 12.9800],
  [77.5900, 12.9800],
];
const areaSqM = calculateGeodesicArea(polyCoords);
assert(
  areaSqM > 1000000 && areaSqM < 2000000,
  `Geodesic area accuracy for 0.01x0.01 degree square (${formatArea(areaSqM)} expected ~1.2 km²)`
);

assert(calculateGeodesicArea([]) === 0, 'Area for 0 vertices is 0');
assert(calculateGeodesicArea([polyCoords[0], polyCoords[1]]) === 0, 'Area for 2 vertices is 0');


// ── TEST GROUP 3: GIS DATASETS & SOURCE GEOJSON SCHEMAS ──
console.log('\n--- TEST GROUP 3: GIS Layer Datasets & Schema Integrity ---');

const datasets = [
  { name: 'BUILDINGS_3D_GEOJSON', data: BUILDINGS_3D_GEOJSON },
  { name: 'ROADS_GEOJSON', data: ROADS_GEOJSON },
  { name: 'WATER_NETWORK_GEOJSON', data: WATER_NETWORK_GEOJSON },
  { name: 'POWER_GRID_GEOJSON', data: POWER_GRID_GEOJSON },
  { name: 'FLOOD_ZONES_GEOJSON', data: FLOOD_ZONES_GEOJSON },
  { name: 'EMERGENCY_ROUTES_GEOJSON', data: EMERGENCY_ROUTES_GEOJSON },
  { name: 'TRAFFIC_FLOW_GEOJSON', data: TRAFFIC_FLOW_GEOJSON },
  { name: 'HOSPITALS_GEOJSON', data: HOSPITALS_GEOJSON },
  { name: 'SCHOOLS_GEOJSON', data: SCHOOLS_GEOJSON },
  { name: 'IOT_SENSORS_GEOJSON', data: IOT_SENSORS_GEOJSON },
];

datasets.forEach((ds) => {
  assert(
    ds.data.type === 'FeatureCollection' && Array.isArray(ds.data.features) && ds.data.features.length > 0,
    `Dataset ${ds.name} has valid FeatureCollection with features (${ds.data.features.length} features)`
  );
});


// ── TEST GROUP 4: BASE MAP STYLES INTEGRITY ──
console.log('\n--- TEST GROUP 4: Base Map Style Configurations ---');

const styleIds = ['streets', 'satellite', 'terrain', 'hybrid'] as const;
styleIds.forEach((id) => {
  const styleSpec = MAP_STYLES[id];
  assert(
    styleSpec && styleSpec.version === 8 && Boolean(styleSpec.sources) && Array.isArray(styleSpec.layers),
    `Map style '${id}' conforms to MapLibre Style Specification v8`
  );
});

console.log('\n=== TEST RESULTS SUMMARY ===');
console.log(`Passed: ${passedTests}`);
console.log(`Failed: ${failedTests}`);
if (issuesFound.length > 0) {
  console.log('\nIssues & Failure Modes Recorded:');
  issuesFound.forEach((iss, idx) => console.log(` ${idx + 1}. ${iss}`));
}
