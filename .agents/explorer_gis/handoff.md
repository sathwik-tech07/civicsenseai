# GIS Tile Sources & 3D Building Extrusion Strategy Report

**Target Region**: Bengaluru Metropolitan Region (Center: 12.9716° N, 77.5946° E)  
**Agent**: Explorer 2 (`explorer_gis`)  
**Date**: August 1, 2026  

---

## 1. Observation

- **Current Repository Context**:
  - `package.json` includes `leaflet` (`^1.9.4`), `react-leaflet` (`^5.0.0`), `three` (`^0.185.1`), `@react-three/fiber` (`^9.6.1`), and `@react-three/drei` (`^10.7.7`).
  - `package.json` currently lacks `maplibre-gl` (and optional `@types/maplibre-gl`), which is required for hardware-accelerated MapLibre GL JS vector maps and 3D `fill-extrusion` rendering.
  - `src/components/CityDigitalTwin3D.tsx:48` currently uses a single static raster tile (`https://a.basemaps.cartocdn.com/dark_all/13/4890/3145.png`) overlaid on a custom Three.js `planeGeometry` mesh with mock 3D geometry objects.

- **Tile Source Verification (Zero API Key / Free Public Endpoints)**:
  - **OpenFreeMap Dark Style (Vector Tile)**: `https://tiles.openfreemap.org/styles/dark` (Open-source vector style with `building` layer and `render_height` feature attributes).
  - **Carto Dark Matter GL Style (Vector)**: `https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json`
  - **Carto Raster Dark Tiles (XYZ Tile Endpoint)**: `https://a.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}@2x.png`
  - **Esri World Imagery (Satellite Raster)**: `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}`
  - **Esri World Hillshade (Terrain Elevation Raster)**: `https://server.arcgisonline.com/ArcGIS/rest/services/Elevation/World_Hillshade/MapServer/tile/{z}/{y}/{x}`
  - **OpenTopoMap (Topographical Contour Raster)**: `https://a.tile.opentopomap.org/{z}/{x}/{y}.png`
  - **Esri World Transportation & Places (Hybrid Vector Overlays)**:
    - Road Transportation: `https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Transportation/MapServer/tile/{z}/{y}/{x}`
    - Places & Boundaries: `https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}`

---

## 2. Logic Chain

1. **Why MapLibre GL JS over Pure Three.js Ground Mesh**:
   - WebGL-native vector map rendering via MapLibre GL JS offers 60 FPS client performance, smooth 3D pitching (0° to 85°), continuous zoom levels (0 to 22), dynamic light/shadow rendering, and native `fill-extrusion` layers.
   - Vector tiles dynamically adjust labels, road width, and building level LOD (level-of-detail) seamlessly as the user navigates across Bengaluru's tech corridors (MG Road, Whitefield, Indiranagar, Electronic City, Peenya).

2. **Dual Building Data Strategy (OSM Vector Tiles + Bengaluru GeoJSON Generator)**:
   - **Vector Tile Buildings**: Provides broad coverage for hundreds of thousands of standard residential/commercial structures across the Greater Bengaluru (BBMP) area using `building` source-layers.
   - **Custom Bengaluru GeoJSON Data Generator**: Ensures key civic landmarks (Vidhana Soudha, UB City, Manipal Hospital, IISc Main Tower, ITPL Whitefield) always render with exact coordinates, realistic heights (e.g. UB City at 128m, Vidhana Soudha at 45m), level counts, and category tags regardless of tile loading latency.

3. **Category Color Mapping Rationale**:
   - **Hospitals** (`#06B6D4` Cyan / `#EF4444` Red accent): High visibility emergency indicator for critical care infrastructure.
   - **Schools & Universities** (`#FBBF24` Amber Yellow / `#F97316` Orange): Bright warm contrast denoting education zones.
   - **Government & Civic Heritage** (`#8B5CF6` Royal Violet): Regal purple highlighting administrative centers like Vidhana Soudha.
   - **Commercial & IT Parks** (`#3B82F6` Electric Blue): Modern tech corridor aesthetics (UB City, ITPL Whitefield, Electronic City).
   - **Residential Districts** (`#475569` Dark Slate): Subtle low-contrast backdrop preventing visual clutter.
   - **Industrial Parks** (`#D97706` Industrial Amber): Distinct metallic tone for manufacturing hubs (Peenya Industrial Estate).

---

## 3. Caveats

1. **Raster Satellite Base Tiles**: Esri World Imagery raster tiles do not contain embedded height or category vector metadata. When Satellite or Hybrid style is active, the 3D building extrusion layer must be driven by an auxiliary vector source or the custom GeoJSON layer placed above the satellite raster layer.
2. **WebGL Performance on Low-End Devices**: Rendering > 50,000 extruded 3D polygons concurrently can strain integrated GPUs. Recommendation: set `minzoom: 12.5` on the `fill-extrusion` layer so extrusions activate only when zoomed into district levels.
3. **MapLibre GL JS Library Dependency**: `maplibre-gl` must be added to `package.json` (`npm install maplibre-gl @types/maplibre-gl`).

---

## 4. Conclusion & Technical Specifications

### A. Base Map Style Specifications

#### 1. Streets Dark (`streets-dark`)
```json
{
  "version": 8,
  "name": "CivicSense Dark Streets",
  "sources": {
    "carto-dark": {
      "type": "raster",
      "tiles": [
        "https://a.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}@2x.png",
        "https://b.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}@2x.png",
        "https://c.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}@2x.png",
        "https://d.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}@2x.png"
      ],
      "tileSize": 256,
      "attribution": "&copy; OpenStreetMap contributors &copy; CARTO"
    }
  },
  "layers": [
    {
      "id": "background",
      "type": "background",
      "paint": { "background-color": "#0B1120" }
    },
    {
      "id": "dark-base-tiles",
      "type": "raster",
      "source": "carto-dark",
      "paint": { "raster-opacity": 1.0 }
    }
  ]
}
```

#### 2. Satellite (`satellite`)
```json
{
  "version": 8,
  "name": "Esri Satellite Imagery",
  "sources": {
    "esri-satellite": {
      "type": "raster",
      "tiles": [
        "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
      ],
      "tileSize": 256,
      "attribution": "Esri, i-cubed, USDA, USGS, GIS Community"
    }
  },
  "layers": [
    {
      "id": "background",
      "type": "background",
      "paint": { "background-color": "#020617" }
    },
    {
      "id": "satellite-base-tiles",
      "type": "raster",
      "source": "esri-satellite"
    }
  ]
}
```

#### 3. Terrain (`terrain`)
```json
{
  "version": 8,
  "name": "Topographical Hillshade Terrain",
  "sources": {
    "esri-hillshade": {
      "type": "raster",
      "tiles": [
        "https://server.arcgisonline.com/ArcGIS/rest/services/Elevation/World_Hillshade/MapServer/tile/{z}/{y}/{x}"
      ],
      "tileSize": 256
    },
    "opentopo": {
      "type": "raster",
      "tiles": [
        "https://a.tile.opentopomap.org/{z}/{x}/{y}.png",
        "https://b.tile.opentopomap.org/{z}/{x}/{y}.png"
      ],
      "tileSize": 256,
      "maxzoom": 17
    }
  },
  "layers": [
    {
      "id": "background",
      "type": "background",
      "paint": { "background-color": "#0F172A" }
    },
    {
      "id": "hillshade-layer",
      "type": "raster",
      "source": "esri-hillshade",
      "paint": { "raster-opacity": 0.65 }
    },
    {
      "id": "topo-contour-layer",
      "type": "raster",
      "source": "opentopo",
      "paint": { "raster-opacity": 0.4, "raster-saturation": -0.4 }
    }
  ]
}
```

#### 4. Hybrid (`hybrid`)
```json
{
  "version": 8,
  "name": "Satellite & Transport Hybrid",
  "sources": {
    "esri-satellite": {
      "type": "raster",
      "tiles": [
        "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
      ],
      "tileSize": 256
    },
    "esri-roads": {
      "type": "raster",
      "tiles": [
        "https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Transportation/MapServer/tile/{z}/{y}/{x}"
      ],
      "tileSize": 256
    },
    "esri-places": {
      "type": "raster",
      "tiles": [
        "https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}"
      ],
      "tileSize": 256
    }
  },
  "layers": [
    {
      "id": "background",
      "type": "background",
      "paint": { "background-color": "#020617" }
    },
    {
      "id": "satellite-base",
      "type": "raster",
      "source": "esri-satellite"
    },
    {
      "id": "roads-overlay",
      "type": "raster",
      "source": "esri-roads",
      "paint": { "raster-opacity": 0.85 }
    },
    {
      "id": "places-overlay",
      "type": "raster",
      "source": "esri-places",
      "paint": { "raster-opacity": 0.95 }
    }
  ]
}
```

---

### B. 3D Fill-Extrusion Layer Specification

```typescript
export const BENGALURU_3D_BUILDING_LAYER: maplibregl.LayerSpecification = {
  id: 'bengaluru-3d-buildings',
  type: 'fill-extrusion',
  source: 'bengaluru-geojson-landmarks', // Or vector tile source
  minzoom: 12.5,
  paint: {
    'fill-extrusion-color': [
      'case',
      // Active state selection glow
      ['boolean', ['feature-state', 'selected'], false], '#00F0FF',
      ['boolean', ['feature-state', 'hover'], false], '#38BDF8',

      // Category color mapping
      ['==', ['get', 'category'], 'hospital'], '#06B6D4',
      ['==', ['get', 'category'], 'school'], '#FBBF24',
      ['==', ['get', 'category'], 'government'], '#8B5CF6',
      ['==', ['get', 'category'], 'commercial'], '#3B82F6',
      ['==', ['get', 'category'], 'residential'], '#475569',
      ['==', ['get', 'category'], 'industrial'], '#D97706',

      // Dynamic height fallback gradient
      [
        'interpolate',
        ['linear'],
        ['get', 'height'],
        0, '#1E293B',
        20, '#334155',
        50, '#1E40AF',
        100, '#2563EB',
        150, '#3B82F6'
      ]
    ],
    'fill-extrusion-height': [
      'interpolate',
      ['linear'],
      ['zoom'],
      12, 0,
      14.5, ['coalesce', ['get', 'height'], ['*', ['get', 'render_height'], 1], 15]
    ],
    'fill-extrusion-min-height': [
      'interpolate',
      ['linear'],
      ['zoom'],
      12, 0,
      14.5, ['coalesce', ['get', 'min_height'], ['get', 'render_min_height'], 0]
    ],
    'fill-extrusion-opacity': 0.88,
    'fill-extrusion-vertical-gradient': true
  }
};
```

---

### C. Building Category Color Palette Summary

| Category | Hex Accent | RGB | Use Cases / Landmarks |
|---|---|---|---|
| **Hospital** | `#06B6D4` / `#EF4444` | `rgb(6, 182, 212)` | Manipal Hospital, Bowring Hospital, Jayadeva Institute |
| **School** | `#FBBF24` / `#F97316` | `rgb(251, 191, 36)` | IISc Campus, NPS Indiranagar, St. Joseph's, RVCE |
| **Government** | `#8B5CF6` / `#A855F7` | `rgb(139, 92, 246)` | Vidhana Soudha, High Court, Vikas Soudha, BBMP HQ |
| **Commercial** | `#3B82F6` / `#2563EB` | `rgb(59, 130, 246)` | UB City, Utility Building, Manyata Tech Park, ITPL |
| **Residential** | `#475569` / `#334155` | `rgb(71, 85, 105)` | Prestige Shantiniketan, Sobha City, Brigade Gateway |
| **Industrial** | `#D97706` / `#F59E0B` | `rgb(217, 119, 6)` | Peenya Industrial Estate, Electronic City Phase 1 |

---

### D. Bengaluru 3D Landmark Dataset File

A complete GeoJSON dataset containing 13+ primary landmark zones in Bengaluru has been compiled and saved to:
`d:\CivicSense AI\.agents\explorer_gis\bengaluru_landmarks.json`

---

## 5. Verification Method

1. **Endpoint Reachability & Validity**:
   - Test endpoints in browser or curl:
     - `https://tiles.openfreemap.org/styles/dark` (Returns MapLibre Style Specification JSON)
     - `https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json` (Returns CARTO GL JSON)
     - `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/13/3820/5468` (Returns 256x256 satellite PNG tile over Bengaluru)

2. **GeoJSON Schema Validation**:
   - Inspect `d:\CivicSense AI\.agents\explorer_gis\bengaluru_landmarks.json`. Ensure all coordinates lie within the Bengaluru boundary (Lat ~12.84 to 13.06, Lng ~77.51 to 77.73) and feature properties contain `height`, `min_height`, and `category`.

3. **Integration Verification**:
   - Once the Implementer agent installs `maplibre-gl` and loads `bengaluru_landmarks.json` into `CityDigitalTwin3D.tsx`, execute `npm run build` to confirm zero TypeScript compilation errors.
