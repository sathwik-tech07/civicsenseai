# Handoff Report — Feature & GIS Layer Design Analysis for CivicSense AI 3D Twin

## 1. Observation

### 1.1 Existing Codebase & Environment Inspection
- **Project Structure**: Located at `d:\CivicSense AI`, built on React 19 (`^19.2.8`), Vite (`^8.2.0`), TypeScript (`~6.0.2`), and Tailwind/CSS custom tokens (`src/index.css`).
- **Existing `CityDigitalTwin3D.tsx`**: Currently at `src/components/CityDigitalTwin3D.tsx` (lines 1–487), relying on `@react-three/fiber` and `@react-three/drei` with hardcoded Three.js boxes and plane grids. It must be migrated to MapLibre GL JS (`maplibre-gl`) per `orchestrator/PROJECT.md`.
- **Domain Interfaces**: Located in `src/types/index.ts` (lines 1–129), defining `Incident`, `Ward`, `PredictiveRiskZone`, `XAIFactors`, `DepartmentPerformance`.
- **Mock Data**: Located in `src/data/mockData.ts` (lines 1–466), providing Bengaluru wards (`INITIAL_WARDS`), incidents, and predictive risk zones centered around `[12.9716, 77.5946]`.
- **Design System Tokens**: Defined in `src/index.css` (lines 8–70), specifying dark surface `#070B14`, surface card `rgba(17, 24, 39, 0.65)`, neon cyan accent `#00D4FF`, warning amber `#F59E0B`, critical crimson `#EF4444`, success emerald `#10B981`, and font families (Space Grotesk, Inter, IBM Plex Mono).

---

## 2. Logic Chain & Technical Specifications

---

### Topic 1: 10+ GIS Layers Configuration & Dynamic MapLibre Source/Layer Management

#### 1. Layer Inventory & Categorization Matrix
The 3D Digital Twin map requires 12 specialized vector and GeoJSON GIS layers categorized by urban domain:

| Layer ID | Name | Category | MapLibre Layer Type | Default Color / Style | Default Visible |
|---|---|---|---|---|---|
| `buildings-3d` | 3D Buildings | Urban Footprints | `fill-extrusion` | Category-based (`#334155`, `#0EA5E9`, `#0F172A`) | `true` |
| `roads` | Arterial Roads & Highways | Transport | `line` | `#38BDF8` (width 2-6px) | `true` |
| `infrastructure` | Bridges, Transit & Metro | Transport | `line` | `#A855F7` (dashed `[2, 2]`) | `true` |
| `water_network` | Water Supply & Storm Drains | Utilities | `line` | `#00D4FF` (glowing cyan line) | `true` |
| `power_grid` | Power Lines & Substations | Utilities | `line` | `#F59E0B` (neon amber line) | `true` |
| `hospitals` | Hospitals & Emergency Hubs | Facilities | `circle` & `symbol` | `#EF4444` red cross / glowing dot | `true` |
| `schools` | Schools & Universities | Facilities | `circle` & `symbol` | `#3B82F6` blue pin | `true` |
| `iot_sensors` | Live IoT Telemetry Nodes | IoT & Sensors | `circle` & HTML Marker | Dynamic status (`#10B981` / `#F59E0B` / `#EF4444`) | `true` |
| `traffic` | Traffic Congestion Corridors | Live Traffic | `line` | Congestion gradient (`#10B981` -> `#EF4444`) | `true` |
| `flood_zones` | Monsoon Flood Risk Basins | Risk & Hazards | `fill` & `line` | `rgba(239, 68, 68, 0.25)` fill with crimson line | `true` |
| `emergency_routes` | Priority Emergency Corridors | Response | `line` | `#10B981` bright neon green with pulse | `false` |
| `incidents` | Reported Civic Complaints | Incidents | `circle` & `symbol` | Severity-based (`#EF4444`, `#F59E0B`, `#8B5CF6`) | `true` |

#### 2. GIS Layer Configuration Interface (`src/components/digital-twin/types.ts`)
```typescript
export interface GISLayerConfig {
  id: string;
  name: string;
  category: 'urban' | 'transport' | 'utilities' | 'facilities' | 'iot' | 'risk';
  iconName: string; // Lucide icon identifier
  visible: boolean;
  opacity: number;
  sourceId: string;
  layerIds: string[]; // Associated MapLibre GL layer IDs (e.g. fill + outline)
  description: string;
}
```

#### 3. Source & Layer Specification in MapLibre GL JS
MapLibre layers require dedicated GeoJSON sources initialized during map `load`:

```typescript
export function registerGISMapSourcesAndLayers(map: maplibregl.Map, gisData: GISGeoJSONData) {
  // 1. Water Network Line Layer
  map.addSource('water-source', { type: 'geojson', data: gisData.waterNetwork });
  map.addLayer({
    id: 'layer-water-network',
    type: 'line',
    source: 'water-source',
    layout: { 'line-join': 'round', 'line-cap': 'round', visibility: 'visible' },
    paint: {
      'line-color': '#00D4FF',
      'line-width': ['interpolate', ['linear'], ['zoom'], 11, 1.5, 16, 4],
      'line-opacity': 0.85
    }
  });

  // 2. Power Grid Line Layer
  map.addSource('power-source', { type: 'geojson', data: gisData.powerGrid });
  map.addLayer({
    id: 'layer-power-grid',
    type: 'line',
    source: 'power-source',
    layout: { 'line-join': 'round', 'line-cap': 'round', visibility: 'visible' },
    paint: {
      'line-color': '#F59E0B',
      'line-width': 2,
      'line-dasharray': [3, 2],
      'line-opacity': 0.9
    }
  });

  // 3. Flood Zones Polygon Fill & Outline
  map.addSource('flood-source', { type: 'geojson', data: gisData.floodZones });
  map.addLayer({
    id: 'layer-flood-zones-fill',
    type: 'fill',
    source: 'flood-source',
    layout: { visibility: 'visible' },
    paint: {
      'fill-color': '#EF4444',
      'fill-opacity': 0.25
    }
  });
  map.addLayer({
    id: 'layer-flood-zones-outline',
    type: 'line',
    source: 'flood-source',
    layout: { visibility: 'visible' },
    paint: {
      'line-color': '#EF4444',
      'line-width': 2,
      'line-dasharray': [2, 1]
    }
  });

  // 4. Traffic Flow Rate Line Layer
  map.addSource('traffic-source', { type: 'geojson', data: gisData.trafficFlow });
  map.addLayer({
    id: 'layer-traffic',
    type: 'line',
    source: 'traffic-source',
    layout: { visibility: 'visible' },
    paint: {
      'line-color': [
        'match',
        ['get', 'congestionLevel'],
        'heavy', '#EF4444',
        'moderate', '#F59E0B',
        'free', '#10B981',
        '#64748B'
      ],
      'line-width': 4,
      'line-opacity': 0.8
    }
  });

  // 5. Hospitals Circle Layer
  map.addSource('hospitals-source', { type: 'geojson', data: gisData.hospitals });
  map.addLayer({
    id: 'layer-hospitals',
    type: 'circle',
    source: 'hospitals-source',
    layout: { visibility: 'visible' },
    paint: {
      'circle-radius': 7,
      'circle-color': '#EF4444',
      'circle-stroke-width': 2,
      'circle-stroke-color': '#FFFFFF'
    }
  });

  // 6. Schools Circle Layer
  map.addSource('schools-source', { type: 'geojson', data: gisData.schools });
  map.addLayer({
    id: 'layer-schools',
    type: 'circle',
    source: 'schools-source',
    layout: { visibility: 'visible' },
    paint: {
      'circle-radius': 6,
      'circle-color': '#3B82F6',
      'circle-stroke-width': 2,
      'circle-stroke-color': '#FFFFFF'
    }
  });

  // 7. Emergency Routes Neon Line Layer
  map.addSource('emergency-source', { type: 'geojson', data: gisData.emergencyRoutes });
  map.addLayer({
    id: 'layer-emergency-routes',
    type: 'line',
    source: 'emergency-source',
    layout: { visibility: 'none' },
    paint: {
      'line-color': '#10B981',
      'line-width': 5,
      'line-blur': 1,
      'line-opacity': 0.95
    }
  });
}
```

#### 4. Dynamic Layer Controller State Hook Pattern
```typescript
export function useGISLayerManager(map: maplibregl.Map | null) {
  const [layers, setLayers] = useState<GISLayerConfig[]>(INITIAL_LAYERS_CONFIG);

  const toggleLayer = useCallback((layerId: string) => {
    if (!map) return;
    setLayers((prev) =>
      prev.map((layer) => {
        if (layer.id === layerId) {
          const nextVisibility = !layer.visible;
          layer.layerIds.forEach((mLayerId) => {
            if (map.getLayer(mLayerId)) {
              map.setLayoutProperty(mLayerId, 'visibility', nextVisibility ? 'visible' : 'none');
            }
          });
          return { ...layer, visible: nextVisibility };
        }
        return layer;
      })
    );
  }, [map]);

  const setLayerOpacity = useCallback((layerId: string, opacity: number) => {
    if (!map) return;
    setLayers((prev) =>
      prev.map((layer) => {
        if (layer.id === layerId) {
          layer.layerIds.forEach((mLayerId) => {
            if (map.getLayer(mLayerId)) {
              const type = map.getLayer(mLayerId).type;
              const prop = type === 'fill' ? 'fill-opacity' : type === 'line' ? 'line-opacity' : 'circle-opacity';
              map.setPaintProperty(mLayerId, prop, opacity);
            }
          });
          return { ...layer, opacity };
        }
        return layer;
      })
    );
  }, [map]);

  return { layers, toggleLayer, setLayerOpacity };
}
```

---

### Topic 2: Live IoT Sensor Implementation & Telemetry Popups

#### 1. Telemetry Data Model (`IoTSensor` Interface)
```typescript
export interface IoTSensorTelemetry {
  aqi?: { value: number; pm25: number; pm10: number; status: 'good' | 'moderate' | 'unhealthy' | 'hazardous' };
  waterFlow?: { rateLitersPerMin: number; pressureBar: number; leakDetected: boolean };
  powerLoad?: { currentMw: number; capacityMw: number; loadPercentage: number };
  noiseLevel?: { currentDb: number; thresholdDb: number };
  trafficFlow?: { avgSpeedKmph: number; vehicleCountPerMin: number };
  lastUpdated: string;
}

export interface IoTSensorNode {
  id: string;
  name: string;
  type: 'aqi' | 'water' | 'power' | 'noise' | 'traffic';
  lat: number;
  lng: number;
  wardId: string;
  wardName: string;
  status: 'active' | 'warning' | 'critical' | 'offline';
  telemetry: IoTSensorTelemetry;
}
```

#### 2. Dual Marker Strategy (WebGL Circles + HTML Pulsing Overlay)
- **WebGL Layer (`circle`)**: Used for background sensor nodes (rendering thousands of nodes at 60fps without DOM overhead).
- **HTML Markers (`maplibregl.Marker`)**: Used for key active telemetry hubs with CSS pulsing animation rings.

#### 3. Keyframe CSS Pulsing Animation (`src/index.css`)
```css
/* Animated IoT Ripple Ring */
.iot-marker-container {
  position: relative;
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
}

.iot-marker-dot {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  border: 2px solid rgba(255, 255, 255, 0.9);
  z-index: 2;
  box-shadow: 0 0 10px currentColor;
}

.iot-marker-ripple {
  position: absolute;
  top: 0;
  left: 0;
  width: 24px;
  height: 24px;
  border-radius: 50%;
  border: 2px solid currentColor;
  opacity: 0.75;
  animation: iot-pulse-ring 2s cubic-bezier(0.215, 0.61, 0.355, 1) infinite;
  z-index: 1;
}

@keyframes iot-pulse-ring {
  0% {
    transform: scale(0.5);
    opacity: 0.9;
  }
  80%, 100% {
    transform: scale(2.2);
    opacity: 0;
  }
}
```

#### 4. Interactive Glassmorphism Telemetry Popup Generator
When an IoT sensor node is clicked, construct a styled `maplibregl.Popup`:

```typescript
export function renderIoTSensorPopup(sensor: IoTSensorNode): string {
  const statusColor =
    sensor.status === 'active' ? '#10B981' : sensor.status === 'warning' ? '#F59E0B' : '#EF4444';

  let telemetryHtml = '';
  if (sensor.type === 'aqi' && sensor.telemetry.aqi) {
    const aqi = sensor.telemetry.aqi;
    telemetryHtml = `
      <div class="mt-2 grid grid-cols-2 gap-2 text-xs">
        <div class="bg-slate-800/80 p-2 rounded border border-slate-700">
          <div class="text-slate-400">AQI Index</div>
          <div class="text-lg font-mono font-bold text-cyan-400">${aqi.value}</div>
          <div class="text-[10px] text-slate-400">${aqi.status.toUpperCase()}</div>
        </div>
        <div class="bg-slate-800/80 p-2 rounded border border-slate-700">
          <div class="text-slate-400">PM2.5 / PM10</div>
          <div class="text-sm font-mono text-slate-200">${aqi.pm25} / ${aqi.pm10} µg/m³</div>
        </div>
      </div>
    `;
  } else if (sensor.type === 'water' && sensor.telemetry.waterFlow) {
    const wf = sensor.telemetry.waterFlow;
    telemetryHtml = `
      <div class="mt-2 grid grid-cols-2 gap-2 text-xs">
        <div class="bg-slate-800/80 p-2 rounded border border-slate-700">
          <div class="text-slate-400">Flow Rate</div>
          <div class="text-lg font-mono font-bold text-blue-400">${wf.rateLitersPerMin} L/min</div>
        </div>
        <div class="bg-slate-800/80 p-2 rounded border border-slate-700">
          <div class="text-slate-400">Pipeline Pressure</div>
          <div class="text-sm font-mono text-slate-200">${wf.pressureBar} bar</div>
          <div class="text-[10px] ${wf.leakDetected ? 'text-red-400 font-bold' : 'text-emerald-400'}">
            ${wf.leakDetected ? 'LEAK DETECTED' : 'PRESSURE STABLE'}
          </div>
        </div>
      </div>
    `;
  } else if (sensor.type === 'power' && sensor.telemetry.powerLoad) {
    const pl = sensor.telemetry.powerLoad;
    telemetryHtml = `
      <div class="mt-2 grid grid-cols-2 gap-2 text-xs">
        <div class="bg-slate-800/80 p-2 rounded border border-slate-700">
          <div class="text-slate-400">Grid Load</div>
          <div class="text-lg font-mono font-bold text-amber-400">${pl.loadPercentage}%</div>
        </div>
        <div class="bg-slate-800/80 p-2 rounded border border-slate-700">
          <div class="text-slate-400">Current Output</div>
          <div class="text-sm font-mono text-slate-200">${pl.currentMw} / ${pl.capacityMw} MW</div>
        </div>
      </div>
    `;
  }

  return `
    <div class="p-3 bg-slate-900/95 border border-cyan-500/40 rounded-xl backdrop-blur-md text-slate-100 min-w-[240px] shadow-2xl">
      <div class="flex items-center justify-between border-b border-slate-800 pb-2">
        <div class="flex items-center gap-2">
          <span class="w-2.5 h-2.5 rounded-full" style="background-color: ${statusColor}; box-shadow: 0 0 8px ${statusColor}"></span>
          <span class="font-semibold text-sm tracking-wide">${sensor.name}</span>
        </div>
        <span class="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-800 border border-slate-700 text-slate-300">
          ${sensor.wardName}
        </span>
      </div>
      ${telemetryHtml}
      <div class="mt-3 flex items-center justify-between text-[11px] text-slate-400 border-t border-slate-800/80 pt-2">
        <span>Updated ${sensor.telemetry.lastUpdated}</span>
        <button onclick="window.dispatchSensorFocus('${sensor.id}')" class="text-cyan-400 hover:underline font-medium">
          View Detail →
        </button>
      </div>
    </div>
  `;
}
```

---

### Topic 3: Map Controls & Interactive Geodesic Measurement Tools

#### 1. Camera Navigation Controls Architecture
The Map Controls HUD (`MapControls.tsx`) executes high-precision MapLibre view state alterations:

- **Orbit / Rotate View**: `map.easeTo({ bearing: map.getBearing() + 45, duration: 800 })`
- **Pitch Toggle (2D / 3D)**: Toggle between `pitch: 0` (Planimetric 2D view) and `pitch: 60` (Perspective 3D view).
- **Fly-to Bengaluru Landmarks**:
  - Vidhana Soudha: `[77.5906, 12.9796]`, zoom `16.5`, pitch `55`
  - MG Road Metro Hub: `[77.6070, 12.9756]`, zoom `16.5`, pitch `50`
  - Outer Ring Road Tech Park: `[77.6912, 12.9279]`, zoom `15.5`, pitch `60`
  - Electronic City Phase 1: `[77.6648, 12.8452]`, zoom `15.0`, pitch `55`
- **Reset Camera**: `map.flyTo({ center: [77.5946, 12.9716], zoom: 14, pitch: 45, bearing: -15, duration: 1500 })`
- **Locate-Me Geolocation**:
  Uses HTML5 Geolocation API to fly to user's location with safety fallback to Bengaluru city center if denied.
- **HUD Live Coordinates Display**:
  Subscribes to `map.on('mousemove', (e) => setCoords({ lat: e.lngLat.lat, lng: e.lngLat.lng, zoom: map.getZoom(), pitch: map.getPitch() }))`.

#### 2. Interactive Distance & Polygon Area Measurement Tool Design

##### State Machine
- `mode`: `'none' | 'distance' | 'area'`
- `points`: `[number, number][]` (Array of clicked `[lng, lat]` coordinates)
- `cursorPoint`: `[number, number] | null` (Active mouse position during drawing)

##### GeoJSON Source Setup (`measure-source`)
```typescript
export function initializeMeasurementLayers(map: maplibregl.Map) {
  map.addSource('measure-source', {
    type: 'geojson',
    data: { type: 'FeatureCollection', features: [] }
  });

  // Polygon Fill Layer
  map.addLayer({
    id: 'measure-fill',
    type: 'fill',
    source: 'measure-source',
    filter: ['==', '$type', 'Polygon'],
    paint: {
      'fill-color': '#F59E0B',
      'fill-opacity': 0.2
    }
  });

  // Measurement Line String Layer
  map.addLayer({
    id: 'measure-lines',
    type: 'line',
    source: 'measure-source',
    filter: ['in', '$type', 'LineString', 'Polygon'],
    paint: {
      'line-color': '#F59E0B',
      'line-width': 3,
      'line-dasharray': [2, 2]
    }
  });

  // Measurement Vertex Point Layer
  map.addLayer({
    id: 'measure-points',
    type: 'circle',
    source: 'measure-source',
    filter: ['==', '$type', 'Point'],
    paint: {
      'circle-radius': 6,
      'circle-color': '#FFFFFF',
      'circle-stroke-width': 2,
      'circle-stroke-color': '#F59E0B'
    }
  });
}
```

##### Geodesic Mathematical Formulations (Zero-Dependency Implementation)

1. **Haversine Geodesic Distance Algorithm (Meters & Kilometers)**:
```typescript
export function calculateGeodesicDistance(coord1: [number, number], coord2: [number, number]): number {
  const R = 6371000; // Earth radius in meters
  const [lng1, lat1] = coord1;
  const [lng2, lat2] = coord2;

  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c; // Distance in meters
}

export function formatDistance(meters: number): string {
  if (meters >= 1000) {
    return `${(meters / 1000).toFixed(2)} km`;
  }
  return `${Math.round(meters)} m`;
}
```

2. **Spherical Polygon Area Algorithm (Girard's Theorem / Geodesic Area)**:
```typescript
export function calculateGeodesicArea(coords: [number, number][]): number {
  if (coords.length < 3) return 0;
  const R = 6371000; // Earth radius in meters
  let totalAngle = 0;

  for (let i = 0; i < coords.length; i++) {
    const p1 = coords[i];
    const p2 = coords[(i + 1) % coords.length];
    const p3 = coords[(i + 2) % coords.length];

    const bearing1 = calculateBearing(p2, p1);
    const bearing2 = calculateBearing(p2, p3);
    let angle = bearing2 - bearing1;
    if (angle < 0) angle += 360;

    totalAngle += angle;
  }

  // Excess angle spherical area formula
  const n = coords.length;
  const sphericalExcess = ((totalAngle - (n - 2) * 180) * Math.PI) / 180;
  const areaM2 = Math.abs(sphericalExcess * R * R);
  return areaM2;
}

function calculateBearing(start: [number, number], end: [number, number]): number {
  const startLat = (start[1] * Math.PI) / 180;
  const startLng = (start[0] * Math.PI) / 180;
  const endLat = (end[1] * Math.PI) / 180;
  const endLng = (end[0] * Math.PI) / 180;

  const dLng = endLng - startLng;
  const y = Math.sin(dLng) * Math.cos(endLat);
  const x = Math.cos(startLat) * Math.sin(endLat) - Math.sin(startLat) * Math.cos(endLat) * Math.cos(dLng);
  const brng = (Math.atan2(y, x) * 180) / Math.PI;
  return (brng + 360) % 360;
}

export function formatArea(sqMeters: number): string {
  if (sqMeters >= 1000000) {
    return `${(sqMeters / 1000000).toFixed(2)} km²`;
  }
  if (sqMeters >= 10000) {
    return `${(sqMeters / 10000).toFixed(2)} ha`;
  }
  return `${Math.round(sqMeters)} m²`;
}
```

---

### Topic 4: Global Search & Glassmorphism Info Panel Design

#### 1. Search Indexing & Aggregation Engine (`src/components/digital-twin/SearchPanel.tsx`)
The global search engine indexes all civic entities into a single unified search index:

```typescript
export interface SearchItem {
  id: string;
  title: string;
  subtitle: string;
  category: 'ward' | 'poi' | 'hospital' | 'sensor' | 'incident' | 'risk';
  coordinates: [number, number]; // [lng, lat]
  metadata: Record<string, any>;
}

export function buildSearchIndex(
  wards: Ward[],
  incidents: Incident[],
  predictiveRisks: PredictiveRiskZone[],
  sensors: IoTSensorNode[],
  hospitals: Array<{ id: string; name: string; lat: number; lng: number }>
): SearchItem[] {
  const items: SearchItem[] = [];

  // Wards
  wards.forEach((w) =>
    items.push({
      id: w.id,
      title: w.name,
      subtitle: `${w.zone} Zone • Pop: ${w.population.toLocaleString()}`,
      category: 'ward',
      coordinates: [w.lng, w.lat],
      metadata: w
    })
  );

  // Incidents
  incidents.forEach((inc) =>
    items.push({
      id: inc.id,
      title: inc.title,
      subtitle: `${inc.severity.toUpperCase()} • ${inc.address || inc.wardName}`,
      category: 'incident',
      coordinates: [inc.lng, inc.lat],
      metadata: inc
    })
  );

  // Predictive Risks
  predictiveRisks.forEach((rk) =>
    items.push({
      id: rk.id,
      title: rk.zoneName,
      subtitle: `Risk Score: ${rk.failureProbabilityScore}% • ${rk.riskType}`,
      category: 'risk',
      coordinates: [rk.lng, rk.lat],
      metadata: rk
    })
  );

  // IoT Sensors
  sensors.forEach((sns) =>
    items.push({
      id: sns.id,
      title: sns.name,
      subtitle: `IoT Sensor (${sns.type.toUpperCase()}) • ${sns.wardName}`,
      category: 'sensor',
      coordinates: [sns.lng, sns.lat],
      metadata: sns
    })
  );

  // Hospitals
  hospitals.forEach((hosp) =>
    items.push({
      id: hosp.id,
      title: hosp.name,
      subtitle: 'Emergency Medical Care Hub',
      category: 'hospital',
      coordinates: [hosp.lng, hosp.lat],
      metadata: hosp
    })
  );

  return items;
}
```

#### 2. Search Autocomplete & Camera Fly-To Event Handling
- When user types in search bar: Client filters `searchIndex` using case-insensitive substring matching across `title`, `subtitle`, and `category`.
- Keyboard navigation: Arrow Up / Down keys navigate list, `Enter` selects active result, `Escape` clears search.
- Selection behavior:
  1. Triggers `map.flyTo({ center: selectedItem.coordinates, zoom: 16.5, pitch: 55, bearing: -15, duration: 2000 })`.
  2. Opens slide-over Glassmorphism Info Panel displaying `selectedItem`.
  3. Highlights location on map with transient pulse pin.

#### 3. Glassmorphism Slide-Over Info Panel UI Design (`src/components/digital-twin/InfoPanel.tsx`)
- Layout: Fixed position slide-over panel on right sidebar (`right-4 top-20 width 380px`, z-index 40).
- Visual Aesthetics:
  - Background: `rgba(17, 24, 39, 0.85)` with `backdrop-filter: blur(16px)`
  - Border: `1px solid rgba(0, 212, 255, 0.3)`
  - Header: Category Badge with icon, Title, Ward, Close (X) button.
- Panel Sections:
  1. **Header & Category Badge**: Severity / Status badge (`CRITICAL`, `WARNING`, `OPTIMAL`).
  2. **Key Metric Cards (2x2 Grid)**: Values formatted with Space Grotesk / Mono font (e.g. Priority Score, Repair Cost, Affected Citizens, Response ETA).
  3. **Explainable AI (XAI) Insight Card**: Explains root cause (e.g., CV Confidence 98.4%, SAM Defect Segmenter, Heavy Vehicle Volume, Monsoon Vulnerability).
  4. **Action Toolbar**:
     - `[Dispatch Crew]` (Triggers emergency response flow)
     - `[Simulate Impact]` (Runs digital twin simulation)
     - `[Export GeoJSON]` (Downloads feature payload)

---

## 3. Caveats
- **WebGL vs HTML Markers Performance Threshold**: HTML pulsing markers look superior for up to ~100-200 nodes; for larger numbers (> 1,000 sensors), WebGL `circle` layers with step-based dynamic colors are used to maintain 60 FPS.
- **Geodesic Measurement Accuracy**: The Haversine distance and Girard spherical area calculations assume a spherical Earth ($R = 6371\text{km}$), which introduces $< 0.3\%$ error compared to WGS-84 ellipsoid formulas (Vincenty formula). This is well within standard GIS map measurement tolerance for urban areas.

---

## 4. Conclusion
The feature architecture designed for CivicSense AI's 3D Digital Twin provides:
1. **Dynamic GIS Layer Control**: Full control over 12 vector/GeoJSON layers with runtime opacity, visibility, and filtering.
2. **Live IoT Sensor Telemetry**: Animated HTML markers with real-time popup cards and dynamic telemetry streams.
3. **Map Navigation & Precision Tools**: Comprehensive camera HUD and zero-dependency geodesic distance & polygon area measurement tools.
4. **Unified Search & Info Drawer**: Fast client-side search across wards, POIs, sensors, and incidents with smooth camera fly-to and glassmorphism panel.

All component interface specs, algorithms, CSS animation keyframes, and MapLibre configs are ready for immediate implementation.

---

## 5. Verification Method

### 1. Build Verification
Run the build command from project root:
```bash
npm run build
```
Verify zero TypeScript or bundler errors.

### 2. File & Component Inspection
Inspect target code locations upon implementation:
- `src/components/digital-twin/types.ts`
- `src/components/digital-twin/LayerControl.tsx`
- `src/components/digital-twin/MeasurementTool.tsx`
- `src/components/digital-twin/SearchPanel.tsx`
- `src/components/digital-twin/InfoPanel.tsx`
- `src/components/digital-twin/MapControls.tsx`
- `src/components/CityDigitalTwin3D.tsx`

### 3. Invalidation Conditions
- Any missing GIS layer in the toggleable list.
- Failure of measurement tools to produce correct distance/area units.
- Non-responsive or broken flyTo animations on search selection.
- CSS overflow or layout breakage in the slide-over Info Panel.
