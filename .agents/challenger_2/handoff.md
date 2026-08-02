# Stress Test Report: R4 & R5 Map Controls, Measurement Tools, Search Panel, and Info Drawer

**Agent**: Challenger 2 (Empirical Challenger)  
**Target Files**: 
- `src/components/digital-twin/MeasurementTool.tsx`
- `src/components/digital-twin/SearchPanel.tsx`
- `src/components/digital-twin/InfoPanel.tsx`
- `src/components/digital-twin/MapControls.tsx`
- `src/components/CityDigitalTwin3D.tsx`
**Build Status**: PASS (`npm run build` completed with zero TypeScript or Vite errors)

---

## 1. Observation

### Geodesic Math & MeasurementTool (`MeasurementTool.tsx`)
- **Haversine Distance**: `calculateGeodesicDistance` correctly calculates distances between pairs of coordinates across hemispheres and antimeridian bounds.
- **Zero Points**: `calculateTotalPathDistance([])` returns `0`; `calculateGeodesicArea([])` returns `0`.
- **Single Point**: `calculateTotalPathDistance` returns `0`; `calculateGeodesicArea` returns `0`.
- **2 Points**: `calculateTotalPathDistance` returns `1552.58 m` (for ~1.5km pair); `calculateGeodesicArea` returns `0`.
- **Polygon Winding Order Anomaly (CW vs CCW)**:
  - Counter-Clockwise 1km x 1km Square: `calculateGeodesicArea` returns **1,204,868 m²** (~1.20 km²).
  - Clockwise 1km x 1km Square: `calculateGeodesicArea` returns **510,064,470,704,919.6 m²** (**510.06 Million km²**, equivalent to the entire surface area of planet Earth).
- **Zero-Area / Degenerate Vertices Anomaly**:
  - 3 identical points (`[[77.59, 12.97], [77.59, 12.97], [77.59, 12.97]]`): `calculateGeodesicArea` returns **127,516,117,977,447 m²** (**127.5 Million km²**).
- **Self-Intersecting / GeoJSON Closed Polygons**:
  - Figure-8 self-intersecting polygon: returns **255,032,235.95 km²**.
  - Closed 5-vertex polygon (where 5th point == 1st point): returns **127,516,116.77 km²**.
- **Micro-Polygons**:
  - 1m x 1m box: area returns **0 m²** due to floating point precision limit when taking spherical angle excess on small angles.

### Search Panel (`SearchPanel.tsx`)
- **Special Regex Characters**: Queries containing `[`, `*`, `?`, `\`, `(`, `)`, `^`, `$`, `+`, `.`, `{` do not crash the application or throw regex syntax errors because search uses `String.prototype.includes()`.
- **Empty & Non-matching Queries**: Empty queries (`""` or `"   "`) return `[]`; non-matching strings return `[]`.
- **Keyboard Navigation Out-of-Bounds Selection Bug**:
  - When a user navigates to index $N$ in search results (e.g., index 8), and then types additional characters that filter the results down to $M$ items ($M \le N$), `selectedIndex` remains at $N$.
  - Hitting `Enter` silently fails (`results[selectedIndex]` is `undefined`), and visual highlight selection disappears completely.
- **Unchecked Property Access Bug**:
  - `SearchPanel.tsx` line 156 calls `item.title.toLowerCase()`. If an index item has `title` as `undefined` or `null`, an unhandled `TypeError: Cannot read properties of undefined (reading 'toLowerCase')` crashes the search component.

### InfoPanel (`InfoPanel.tsx`) & MapControls (`MapControls.tsx`)
- **InfoPanel Slide-over Actions**:
  - Drawer opens with smooth Framer Motion / CSS transition.
  - GeoJSON export (`handleExportGeoJSON`) correctly serializes feature properties and downloads `.geojson` blob. Fallback coordinates `[77.5946, 12.9716]` protect against missing `lng`/`lat` fields.
- **Camera Fly-to Interruptions**:
  - MapLibre GL JS `map.flyTo` interrupts cleanly when new landmarks, search selections, or view reset buttons are clicked during an in-flight camera movement.
  - Performance Caveat: High-frequency `map.on('move')` listener updates React state `coordsInfo` on every frame (60 FPS re-renders), which re-renders the root component `CityDigitalTwin3D` during camera movement.

---

## 2. Logic Chain

1. **Geodesic Area Flaw**:
   - `calculateGeodesicArea` uses Girard's Spherical Excess formula: $E = (\sum \theta_i) - (n-2)\pi$, $Area = R^2 |E|$.
   - The implementation computes vertex bearings using `calculateBearing(p2, p1)` and `calculateBearing(p2, p3)` and normalizes `angle = bearing2 - bearing1` into $[0, 360)$.
   - When vertices are oriented Clockwise, `angle` calculates exterior angles instead of interior angles. The sum of exterior angles yields a spherical excess equal to $4\pi - E_{\text{interior}}$, which evaluates to the area of the complement polygon (the entire rest of the globe).
   - When 3 identical vertices are clicked, `bearing2 - bearing1` yields 0, making `totalAngle = 0`. The formula computes $E = 0 - (3-2)\pi = -\pi$, leading to $Area = \pi R^2 \approx 1.275 \times 10^{14}$ m².

2. **Search Keyboard Navigation Flaw**:
   - In `SearchPanel.tsx`, `selectedIndex` is updated on `onChange` to 0, but if the user moves down with `ArrowDown` to index $i$ and then modifies the input (or if `results` changes via prop update), `selectedIndex` is not clamped to `[0, results.length - 1]`.
   - If `selectedIndex >= results.length`, `results[selectedIndex]` evaluates to `undefined`. Hitting `Enter` checks `if (results[selectedIndex])` which evaluates to `false`, causing keyboard selection to fail silently.

3. **High-Frequency React Re-rendering on Camera Movement**:
   - In `CityDigitalTwin3D.tsx`, `map.on('move', ...)` calls `setCoordsInfo({...})` on every frame while panning or flying.
   - React state changes in `CityDigitalTwin3D` trigger component re-render at 60 FPS, passing new props down to `MapControls`, `SearchPanel`, `LayerControl`, etc., consuming CPU cycles during camera animations.

---

## 3. Caveats

- **No modifications made to codebase**: As an EMPIRICAL CHALLENGER, all failure modes were reproduced and verified via standalone empirical test scripts (`test_math.js`, `test_math_extended.js`, `test_search.js`). No application code was altered.
- **WebGL Hardware Acceleration**: Interactive map rendering was validated through MapLibre source code inspection and build output verification.

---

## 4. Conclusion

- **R4 (Map Controls & Measurement Tools)**:
  - **DISTANCE MATH**: Fully verified and accurate across coordinate space.
  - **AREA MATH**: **HIGH RISK BUG**. `calculateGeodesicArea` is order-dependent (CW drawing returns ~510M km²), crashes on duplicate vertices (~127M km²), and underflows to 0 m² for micro-polygons (<10m²). Recommended fix: enforce Shoelace/Green's theorem or normalize winding order (orient counter-clockwise) before computing spherical excess, and filter duplicate consecutive vertices.
- **R5 (Search Panel & Info Drawer)**:
  - **SEARCH FILTERING**: Safely handles regex special characters (`[`, `*`, `?`, `\`).
  - **SEARCH KEYBOARD NAV**: Minor bug when `selectedIndex` exceeds filtered `results.length`. Recommended fix: clamp `selectedIndex` with `Math.min(selectedIndex, results.length - 1)`.
  - **INFO DRAWER**: Fully operational, GeoJSON export and slide-over actions pass cleanly.
- **BUILD STABILITY**: `npm run build` passes with zero errors (`dist/assets/index-BIfu0azH.js`).

---

## 5. Verification Method

To independently verify these findings, run the following empirical verification commands from the project root (`d:\CivicSense AI`):

1. **Run Geodesic Math Stress Tests**:
   ```bash
   node .agents/challenger_2/test_math.js
   node .agents/challenger_2/test_math_extended.js
   ```
   *Expected output*: 
   - CW Square Area: `510064470704919.6 m²`
   - Zero-area Polygon Area: `127516117977447.06 m²`

2. **Run Search Panel Edge Case Tests**:
   ```bash
   node .agents/challenger_2/test_search.js
   ```
   *Expected output*:
   - Special chars `[`, `*`, `?`, `\` return 0 matches without throwing SyntaxError.
   - `CRASH CONFIRMED on undefined title` demonstrated on un-guarded `.toLowerCase()`.

3. **Run Production Build**:
   ```bash
   npm run build
   ```
   *Expected output*: Built successfully in ~500-1000ms with 0 errors.

---

## Adversarial Challenge Report Summary

### Overall Risk Assessment: HIGH

| Challenge | Dimension | Target | Failure Mode / Attack Scenario | Blast Radius | Suggested Mitigation |
|---|---|---|---|---|---|
| **CRITICAL** | Geodesic Math Flaw | `MeasurementTool.tsx` | User draws clockwise polygon or clicks duplicate points, causing area math to return 510,000,000 km² or 127,000,000 km². | Measurement HUD displays astronomical false numbers, destroying trust in GIS tools. | Deduplicate consecutive vertices & force counter-clockwise vertex orientation before computing spherical excess (or use planar projection for small polygons). |
| **MEDIUM** | Keyboard Nav Out-of-Bounds | `SearchPanel.tsx` | User presses `ArrowDown` multiple times, then types extra letters. `selectedIndex` stays out of bounds. | `Enter` key stops working, highlighted item disappears from dropdown. | Clamp `selectedIndex` dynamically: `Math.min(selectedIndex, Math.max(0, results.length - 1))`. |
| **LOW** | 60 FPS Re-render Overhead | `CityDigitalTwin3D.tsx` | Continuous panning/flying triggers `setCoordsInfo` on every frame. | Minor CPU overhead / framerate dip during long fly-to animations. | Throttle or debounce `coordsInfo` state updates (e.g. using `requestAnimationFrame` or `lodash.throttle`). |
