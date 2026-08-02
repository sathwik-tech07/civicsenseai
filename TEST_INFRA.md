# E2E Test Infra: CivicSense AI Enterprise GIS Digital Twin

## Test Philosophy
- Opaque-box, requirement-driven E2E testing for the 3D Digital Twin tab (`CityDigitalTwin3D.tsx`).
- Methodology: Category-Partition + Boundary Value Analysis + Pairwise Combinatorial Testing + Real-World Workload Testing.

## Feature Inventory
| # | Feature | Requirement | Tier 1 (Coverage) | Tier 2 (Boundary) | Tier 3 (Pairwise) | Tier 4 (Real-World) |
|---|---------|-------------|:-----------------:|:-----------------:|:-----------------:|:------------------:|
| 1 | Real GIS Map Foundation | R1 | 5 test cases | 5 test cases | ✓ | ✓ |
| 2 | 3D Extruded Buildings | R2 | 5 test cases | 5 test cases | ✓ | ✓ |
| 3 | GIS Layer Management & Live Sensors | R3 | 5 test cases | 5 test cases | ✓ | ✓ |
| 4 | Interactive Map Controls & Measurement Tool | R4 | 5 test cases | 5 test cases | ✓ | ✓ |
| 5 | Global Search & Glassmorphism Info Panel | R5 | 5 test cases | 5 test cases | ✓ | ✓ |

## Test Architecture & Suite
- **Tier 1 - Feature Coverage**:
  - Test map initialization centered at Bengaluru (12.9716° N, 77.5946° E).
  - Test base map switching (Streets Dark, Satellite, Terrain, Hybrid).
  - Test 3D building fill-extrusion layer creation with variable heights.
  - Test 10+ GIS layers toggle panel state changes.
  - Test search input autocomplete and camera fly-to trigger.
- **Tier 2 - Boundary & Corner Cases**:
  - Test map view with empty incidents/predictiveRisks props array.
  - Test layer toggle when all layers are disabled.
  - Test measurement tool with single point, multi-point polygon, and cancellation.
  - Test search query with zero matches / edge-case characters.
  - Test geolocation rejection / browser denied location fallback.
- **Tier 3 - Cross-Feature Combinations**:
  - Test search selection while measurement tool is active.
  - Test layer toggling while camera is in 3D pitch/bearing orbit animation.
  - Test IoT sensor popup click during active incident filter overlay.
- **Tier 4 - Real-World Application Scenarios**:
  - Emergency Incident Response Scenario: Search hospital POI -> fly-to -> activate Emergency Routes layer -> measure distance to critical incident.
  - Monsoon Flood Risk Assessment Scenario: Enable Flood Zones + Water Network layers -> zoom into low-lying ward -> inspect IoT water sensor telemetry.

## Verification Command
```bash
npm run build
```
Expected output: zero TypeScript / Vite compilation errors.
