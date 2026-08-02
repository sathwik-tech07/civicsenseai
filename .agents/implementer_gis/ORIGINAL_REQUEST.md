## 2026-08-01T01:42:40Z

You are Implementer 1. Your task is to implement the Enterprise GIS Digital Twin using MapLibre GL JS for CivicSense AI.

Working directory for your metadata: d:\CivicSense AI\.agents\implementer_gis
Project Root: d:\CivicSense AI

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A Forensic Auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

Please perform the following:
1. Update `package.json` to include `"maplibre-gl": "^5.18.0"` (and `"@types/maplibre-gl": "^5.0.0"` in devDependencies if needed). Run `npm install` or ensure node_modules are intact.
2. Read Explorer reports in `d:\CivicSense AI\.agents\explorer_deps\handoff.md`, `d:\CivicSense AI\.agents\explorer_gis\handoff.md`, and `d:\CivicSense AI\.agents\explorer_features\handoff.md`. Read `d:\CivicSense AI\.agents\explorer_gis\bengaluru_landmarks.json` for rich Bengaluru 3D building data.
3. Build helper modules under `src/components/digital-twin/`:
   - `types.ts`: Define types for GIS layers, IoT sensors, search items, measurement tools, base styles, and props.
   - `mapStyles.ts`: MapLibre GL JS dark base map styles (Streets Dark using Carto Dark Matter/OpenFreeMap, Satellite using Esri World Imagery, Terrain using Esri Hillshade/OpenTopo, Hybrid using Esri Satellite+Roads+Places). Default to Streets Dark.
   - `mockGisData.ts`: GeoJSON dataset generator for Bengaluru Metropolitan Region (center: 12.9716° N, 77.5946° E) including 3D extruded buildings (with height, min_height, category attributes), water network, power grid, flood zones, emergency routes, traffic flow, hospitals, schools, IoT sensors with telemetry, incidents, and predictive risk zones.
   - `LayerControl.tsx`: Glassmorphism panel for toggling 10+ GIS layers (Infrastructure, Roads, Buildings, Water Network, Power Grid, Hospitals, Schools, IoT Sensors, Traffic, Flood Zones, Emergency Routes) with visibility toggles and opacity sliders.
   - `MapControls.tsx`: HUD controls for camera navigation (Orbit, Pitch 2D/3D toggle, Landmark Fly-To buttons, Reset View, Geolocation locate-me button, Compass, Scale bar, Live coordinates display).
   - `MeasurementTool.tsx`: Geodesic distance (Haversine formula) and polygon area (Girard spherical excess formula) measurement tool UI and map click handlers.
   - `SearchPanel.tsx`: Global search bar with instant autocomplete across Wards, POIs, Hospitals, Sensors, Incidents, and Risks.
   - `InfoPanel.tsx`: Glassmorphism slide-over Info Panel with XAI insights, status badges, metrics, and action buttons.
4. Rebuild `src/components/CityDigitalTwin3D.tsx`:
   - MUST preserve exact Props interface:
     ```typescript
     interface Props {
       incidents: Incident[];
       predictiveRisks: PredictiveRiskZone[];
       onSelectIncident: (inc: Incident) => void;
     }
     ```
   - Initialize MapLibre GL JS map on mount, centered at `[77.5946, 12.9716]` (Bengaluru), zoom `14`, pitch `45`, bearing `-15`.
   - Add 3D building `fill-extrusion` layer with height interpolation, building type category colors (Hospital `#06B6D4`, School `#FBBF24`, Government `#8B5CF6`, Commercial `#3B82F6`, Residential `#475569`, Industrial `#D97706`), and vertical gradients.
   - Add 10+ GIS layers toggleable via `LayerControl.tsx`.
   - Add live pulsing IoT sensor markers with telemetry popups.
   - Integrate `MapControls`, `MeasurementTool`, `SearchPanel`, and `InfoPanel`.
   - Ensure styling uses CivicSense AI dark enterprise theme tokens from `src/index.css`.
5. Execute `npm run build` (`tsc -b && vite build`) to verify that the project compiles cleanly with ZERO errors.
6. Write a comprehensive handoff report at `d:\CivicSense AI\.agents\implementer_gis\handoff.md` including exact build outputs, test results, and file diffs.
7. Send a summary message back to parent.
