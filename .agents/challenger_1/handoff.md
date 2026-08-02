# STRESS TEST REPORT: 3D DIGITAL TWIN IMPLEMENTATION (R1, R2, R3)

**Agent**: Challenger 1 (Empirical Challenger / Critic / Specialist)  
**Target Components**: `src/components/CityDigitalTwin3D.tsx`, `src/components/digital-twin/LayerControl.tsx`, `src/components/digital-twin/mockGisData.ts`, `src/components/digital-twin/mapStyles.ts`, `SearchPanel.tsx`, `MapControls.tsx`, `MeasurementTool.tsx`, `InfoPanel.tsx`  
**Build Status**: `npm run build` (`tsc -b && vite build`) → **SUCCESS** (0 TS compiler errors, 0 Vite build errors)

---

## 1. Observation

Direct empirical observations from source inspection and execution tests:

1. **Build Verification**:
   - Command: `npm run build` (`tsc -b && vite build`)
   - Outcome: Completed successfully in 555ms. Output assets:
     - `dist/index.html` (0.46 kB)
     - `dist/assets/index-BAe-XCqQ.css` (94.11 kB)
     - `dist/assets/index-BIfu0azH.js` (2,232.28 kB)
   - Note: Vite chunk size warning issued (>500 kB) due to MapLibre GL JS, Three.js, and Lucide icon bundles.

2. **Empty Array Safety (`incidents` & `predictiveRisks`)**:
   - `incidentsToGeoJSON(incidents)` and `predictiveRisksToGeoJSON(risks)` in `mockGisData.ts` use `(incidents || [])` and `(risks || [])`. Passing empty arrays `[]`, `null`, or `undefined` returns a valid empty `FeatureCollection` (`features: []`).
   - `SearchPanel.tsx` uses `(wards || [])`, `(incidents || [])`, and `(predictiveRisks || [])` in `useMemo`.
   - MapLibre GL JS `GeoJSONSource.setData()` safely clears all rendered points when passed `features: []`.

3. **Base Map Style Switch vs GIS Overlay Layers (State Desynchronization)**:
   - In `CityDigitalTwin3D.tsx` (lines 641–650), changing `mapStyle` calls `map.setStyle(MAP_STYLES[mapStyle])`.
   - MapLibre's `setStyle()` destroys all custom sources and layers from the WebGL style tree.
   - On `style.load`, `setupGisLayers(map)` is executed to re-add all 11 GIS layers.
   - **Observation**: `setupGisLayers` re-adds layers with hardcoded default visibility (`'visible'`) and default opacities, ignoring the current React `layers` state array.
   - If a user previously toggled off 5 layers in `LayerControl`, switching map style (e.g. Streets → Satellite) causes all 5 toggled-off layers to turn back on visually in the 3D viewport, while the `LayerControl` UI toggles still report them as disabled (`visible: false`).

4. **Measurement Vectors Wiped on Style Switch**:
   - `setupGisLayers` re-creates `src-measurement` with an empty FeatureCollection (`features: []`).
   - Switching base map styles while an active geodesic measurement (distance or area) is being drawn destroys the rendered lines/polygons on the map canvas, but leaves `measurePoints` state in React intact. The HUD overlay shows active measurement totals (e.g. `1.42 km`), but the map canvas displays no graphics.

5. **Container Resize Handling**:
   - In `CityDigitalTwin3D.tsx` (lines 567–638), the map instance relies exclusively on MapLibre's default window resize listener (`trackResize`).
   - No `ResizeObserver` is attached to `mapContainerRef`. Layout changes caused by parent flex/grid resizing, modal toggles, or sidebar expansion leave the WebGL canvas aspect ratio un-updated until a global window resize occurs.

6. **Asynchronous Style Load on Component Unmount**:
   - `useEffect([mapStyle])` attaches `map.once('style.load', ...)` listeners. If the component unmounts while a map style asset fetch is pending, `map.remove()` destroys the map instance. When `style.load` fires later, `setupGisLayers` calls `map.getSource(...)` on a destroyed map instance, throwing `Error: Map has been removed`.

---

## 2. Logic Chain

1. **Premise 1**: MapLibre GL JS's `setStyle()` completely resets the map's internal layer tree, destroying all custom layers (`bengaluru-3d-buildings`, `roads-line`, `water-network-line`, `incidents-circle`, etc.) and sources.
2. **Premise 2**: `setupGisLayers` acts as the re-hydration function post `style.load`. Because `setupGisLayers` does not read `layers` state (which contains `{ id, visible, opacity }`), it recreates layers using `INITIAL_LAYERS` defaults (`visible: true`, default paint opacities).
3. **Deduction 1**: Therefore, changing `mapStyle` corrupts UI-to-Canvas synchronization for layer visibility and opacity settings.
4. **Premise 3**: MapLibre GL JS requires an explicit `.resize()` call whenever its container element changes dimensions independent of the window object.
5. **Deduction 2**: Without a `ResizeObserver` on `mapContainerRef`, any container element size changes caused by app UI layout transitions produce stretched/distorted WebGL renders.
6. **Premise 4**: Null or NaN coordinates in GeoJSON features cause MapLibre's bounding box and point shaders to throw an unhandled internal exception (`Position must be an array of two or more numbers`).
7. **Deduction 3**: `incidentsToGeoJSON` and `predictiveRisksToGeoJSON` lack coordinate numeric validation (`!isNaN(inc.lat)`), exposing the map to unhandled rendering crashes if fed invalid telemetry/API data.

---

## 3. Caveats

- **Network Tile Server Availability**: Base map style tiles (`cartocdn.com`, `arcgisonline.com`, `opentopomap.org`) rely on external HTTP endpoints. In strict offline/airgapped environments, tile requests will fail to load background tiles, though custom GeoJSON overlays (buildings, roads, IoT markers) render correctly.
- **WebGL Context Limits**: Browser WebGL implementation limits concurrently active WebGL contexts (typically 8–16 per browser domain). The component correctly calls `map.remove()` on unmount, freeing its WebGL context.

---

## 4. Conclusion

- **Overall Health**: The 3D Digital Twin implementation is **STABLE & FUNCTIONAL**, compiling cleanly without TypeScript or Vite errors. Core geodesic math, initial layer initialization, and component unmount WebGL cleanup are properly implemented.
- **Key Vulnerabilities Identified**:
  1. **[MEDIUM RISK] Layer Visibility & Opacity Desynchronization**: Changing base map styles resets all custom layer visibility and opacities to default, causing UI-map state mismatch.
  2. **[MEDIUM RISK] Active Measurement Wiped on Style Switch**: Map style switching destroys active measurement GeoJSON lines while leaving HUD metric state stale.
  3. **[LOW/MEDIUM RISK] Lack of `ResizeObserver`**: Map container size changes without window resize cause canvas aspect ratio distortion.
  4. **[LOW RISK] Coordinate Validation Gap**: Missing check for `NaN` / `null` lat/lng in GeoJSON converters.

---

## 5. Verification Method

To independently verify these stress test observations:

1. **Build Verification**:
   ```bash
   cd "d:\CivicSense AI"
   npm run build
   ```
   *Expected output*: `vite build` output with `dist/index.html` and `dist/assets/index-BIfu0azH.js`. Zero TypeScript errors.

2. **Empirical Script Verification**:
   Run the empirical test runner script:
   ```bash
   npx tsx .agents/challenger_1/run_stress_tests.ts
   ```
   *Expected output*: All 15 unit/schema/math tests pass.

3. **Manual / Integration Verification**:
   - Open 3D Digital Twin view.
   - Toggle off "3D Extruded Buildings" in GIS Layers panel (EyeOff icon active).
   - Switch Base Map Style from "Streets Dark" to "Satellite".
   - *Observation*: Notice 3D extruded buildings reappear on map canvas while GIS Layers panel toggle remains in off state.

---

## ATTACK SURFACE & CHALLENGE REPORT

### Challenge Summary
**Overall Risk Assessment**: MEDIUM

### Challenges

#### Challenge 1 [MEDIUM]: Layer Visibility and Opacity Reset on Base Map Style Switch
- **Assumption Challenged**: Re-running `setupGisLayers(map)` on `style.load` preserves user UI state.
- **Attack Scenario**: User disables 4 layers and adjusts building opacity to 20%. User switches to Satellite view to inspect terrain.
- **Blast Radius**: All 4 disabled layers suddenly reappear, and opacity resets to 88%, cluttering the viewport and contradicting the UI controls.
- **Mitigation**: Modify `setupGisLayers` or `style.load` callback to iterate over `layers` React state and re-apply `setLayoutProperty(mId, 'visibility', layer.visible ? 'visible' : 'none')` and `setPaintProperty(mId, opacityProp, layer.opacity)`.

#### Challenge 2 [MEDIUM]: Measurement Geometry Destruction on Style Reload
- **Assumption Challenged**: Map style changes do not alter application feature state.
- **Attack Scenario**: User measures distance along KA-01 transit corridor. Mid-measurement, user toggles Satellite view.
- **Blast Radius**: Drawn measurement lines disappear from screen; HUD still shows active measurement metrics.
- **Mitigation**: In `style.load` handler, re-sync measurement GeoJSON using current `measurePoints` state.

#### Challenge 3 [LOW]: Unchecked NaN Coordinates in GeoJSON Converters
- **Assumption Challenged**: All incoming `Incident` and `PredictiveRiskZone` objects contain valid numeric `lat` and `lng`.
- **Attack Scenario**: Backend API or sensor stream sends an incident with `lat: null` or `lng: undefined`.
- **Blast Radius**: `map.getSource('src-incidents').setData(...)` throws unhandled MapLibre exception and halts map rendering.
- **Mitigation**: Add numeric coordinate guard in `incidentsToGeoJSON`: `.filter(i => Number.isFinite(i.lat) && Number.isFinite(i.lng))`.

---

## Stress Test Results Table

| Scenario | Expected Behavior | Actual Behavior | Result |
| --- | --- | --- | --- |
| `npm run build` | Clean compilation | 0 TS errors, 0 Vite errors | **PASS** |
| Empty `incidents` / `predictiveRisks` | Render empty map without error | Empty `FeatureCollection` handled cleanly | **PASS** |
| Null / Undefined input arrays | Graceful fallbacks | Handled safely by `(incidents \|\| [])` | **PASS** |
| Rapid 10+ Layer Toggling | Fast UI updates without crash | Handled safely with layer checks | **PASS** |
| Base Map Style Switching | Layer visibility & opacity preserved | Layers reset to initial default visibility/opacity | **FAIL (State Desync)** |
| Measurement retention on Style Switch | Measurement vector preserved | Canvas vectors destroyed, HUD state stale | **FAIL (Graphics Wiped)** |
| Map Container Resizing | Canvas adapts to new container bounds | Requires window resize event (no ResizeObserver) | **WARN (Missing Observer)** |
| Map Instance Unmount | Release WebGL context & markers | `map.remove()` & marker removal executed clean | **PASS** |
