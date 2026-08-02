# Project: CivicSense AI Enterprise GIS Digital Twin

## Architecture
- React 19 + TypeScript + MapLibre GL JS (`maplibre-gl`) base
- Base maps: Streets Dark (Carto Dark Matter / OpenStreetMap vector), Satellite (Esri / USGS World Imagery free tile), Terrain, Hybrid
- Extruded 3D Buildings: MapLibre `fill-extrusion` layer with height, min_height, color property mapping by building category (Hospital, School, Government, Commercial, Residential, Industrial)
- GIS Layers: Toggleable map sources & layers (Infrastructure, Roads, Buildings, Water Network, Power Grid, Hospitals, Schools, IoT Sensors, Traffic, Flood Zones, Emergency Routes)
- Controls: MapLibre NavigationControl, ScaleControl, GeolocateControl, pitch/bearing state manager, distance measurement tool using Turf.js or manual vector calculations
- Search & Info Panel: Autocomplete index over local POIs, Wards, Hospitals, IoT Sensors, Incidents, Risks + Geocoding; Glassmorphism slide-over side panel

## Code Layout
- Target main file: `src/components/CityDigitalTwin3D.tsx`
- Helper components / modules (to be created under `src/components/digital-twin/` or alongside `CityDigitalTwin3D.tsx`):
  - `src/components/digital-twin/types.ts`
  - `src/components/digital-twin/mapStyles.ts`
  - `src/components/digital-twin/mockGisData.ts` (Bengaluru OSM boundaries, buildings, sensors, layers)
  - `src/components/digital-twin/LayerControl.tsx`
  - `src/components/digital-twin/MeasurementTool.tsx`
  - `src/components/digital-twin/SearchPanel.tsx`
  - `src/components/digital-twin/InfoPanel.tsx`
  - `src/components/digital-twin/MapControls.tsx`

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| 1 | R1 GIS Map Foundation | MapLibre map initialization, 4 map styles, road network labels, theme styling | None | PLANNED |
| 2 | R2 3D Extruded Buildings | 3D fill-extrusion layers, height/color/category attributes, ambient & directional lighting | M1 | PLANNED |
| 3 | R3 Layer Management & Live Sensors | 10+ GIS layers toggleable UI, live pulsing IoT sensors, Incident & Predictive Risk overlay | M1, M2 | PLANNED |
| 4 | R4 Interactive Controls & Measurement | Orbit, pitch, bearing, reset, geolocation, compass, scale bar, distance/polygon measurement tool | M1 | PLANNED |
| 5 | R5 Global Search & Info Panel | Search bar, autocomplete, camera fly-to animation, glassmorphism information drawer | M1, M3 | PLANNED |

## Interface Contracts
### Props interface for `CityDigitalTwin3D.tsx` (MUST BE PRESERVED)
```typescript
export interface Incident {
  id: string;
  type: string;
  title: string;
  location: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  status: string;
  timestamp: string;
  coordinates?: [number, number]; // [lng, lat]
  [key: string]: any;
}

export interface PredictiveRiskZone {
  id: string;
  name: string;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  score: number;
  category: string;
  coordinates?: [number, number]; // [lng, lat]
  [key: string]: any;
}

export interface Props {
  incidents: Incident[];
  predictiveRisks: PredictiveRiskZone[];
  onSelectIncident: (inc: Incident) => void;
}
```
