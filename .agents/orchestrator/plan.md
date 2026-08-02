# Rebuild CivicSense AI "3D Twin" — Project Plan

## Executive Summary
Rebuild `src/components/CityDigitalTwin3D.tsx` into a production-quality Enterprise GIS Digital Twin using MapLibre GL JS and OpenStreetMap data for the Bengaluru Metropolitan Region (12.9716° N, 77.5946° E).

## Work Breakdown & Milestones

### Phase 1: Exploration & Technical Architecture
- Dispatch 3 `teamwork_preview_explorer` subagents to investigate codebase, dependencies (`package.json`), design tokens (`src/index.css`), `CityDigitalTwin3D.tsx`, and map tile/styling options (e.g. MapTiler / OpenStreetMap vector tile dark style / Carto Dark Matter / Protomaps / MapLibre GL JS setup).

### Phase 2: E2E Test Suite Creation (Opaque-box) & Scope Finalization
- E2E Testing Track Orchestrator / Subagents set up testing requirements & criteria in `TEST_INFRA.md`.

### Phase 3: Milestone Implementation
1. **Milestone 1 (R1 - GIS Foundation)**: MapLibre GL JS setup, 4 map styles (Streets Dark, Satellite, Terrain, Hybrid), road network layers, labels, dark enterprise theme integration.
2. **Milestone 2 (R2 - 3D Extruded Buildings)**: 3D fill-extrusion layers with height-based and category-based styling (Hospitals, Schools, Government, Commercial, Residential, Industrial), lighting/shadow effects, OSM / synthetic 3D building polygons.
3. **Milestone 3 (R3 - GIS Layer Management & Live Sensors)**: Toggleable layer control panel (Infrastructure, Roads, Buildings, Water, Power, Hospitals, Schools, IoT Sensors, Traffic, Flood Zones, Emergency Routes), animated/pulsing IoT sensor markers, live sensor telemetry popups, incident & predictive risk integration.
4. **Milestone 4 (R4 - Interactive Map Controls, Drawing & Measurement)**: Camera navigation (orbit, pitch, bearing, reset, fly-to, locate-me), compass, coordinate display, scale bar, distance measurement & polygon area measurement tools.
5. **Milestone 5 (R5 - Global Search & Info Panel)**: Search bar with instant autocomplete for addresses, wards, points of interest (hospitals, sensors, roads, buildings), camera fly-to animation, glassmorphism slide-over Info Panel with metadata, actions, and status.

### Phase 4: Review, Challenger Stress Testing & Forensic Audit
- Dispatch `teamwork_preview_reviewer` for code review & build validation (`npm run build`).
- Dispatch `teamwork_preview_challenger` for functional & edge case testing.
- Dispatch `teamwork_preview_auditor` for integrity verification.
- Pass 100% verification gate before final handoff.
