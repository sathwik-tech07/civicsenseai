import type { StyleSpecification } from 'maplibre-gl';
import type { MapStyleId, MapStyleOption } from './types';

export const MAP_STYLE_OPTIONS: MapStyleOption[] = [
  {
    id: 'streets',
    name: 'Streets Dark',
    description: 'Carto Dark Matter high-contrast vector theme',
    previewColor: '#0F172A',
  },
  {
    id: 'satellite',
    name: 'Satellite',
    description: 'Esri High-Resolution World Imagery',
    previewColor: '#020617',
  },
  {
    id: 'terrain',
    name: 'Terrain',
    description: 'Topographical Elevation & Hillshade Contours',
    previewColor: '#1E293B',
  },
  {
    id: 'hybrid',
    name: 'Hybrid',
    description: 'Satellite Imagery with Transportation & POI Overlays',
    previewColor: '#090D16',
  },
];

export const MAP_STYLES: Record<MapStyleId, StyleSpecification> = {
  streets: {
    version: 8,
    name: 'CivicSense Dark Streets',
    sources: {
      'carto-dark': {
        type: 'raster',
        tiles: [
          'https://a.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}@2x.png',
          'https://b.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}@2x.png',
          'https://c.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}@2x.png',
          'https://d.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}@2x.png',
        ],
        tileSize: 256,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
      },
    },
    layers: [
      {
        id: 'background',
        type: 'background',
        paint: {
          'background-color': '#070B14',
        },
      },
      {
        id: 'dark-base-tiles',
        type: 'raster',
        source: 'carto-dark',
        paint: {
          'raster-opacity': 1.0,
        },
      },
    ],
  },

  satellite: {
    version: 8,
    name: 'Esri Satellite Imagery',
    sources: {
      'esri-satellite': {
        type: 'raster',
        tiles: [
          'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
        ],
        tileSize: 256,
        attribution: 'Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community',
      },
    },
    layers: [
      {
        id: 'background',
        type: 'background',
        paint: {
          'background-color': '#020617',
        },
      },
      {
        id: 'satellite-base-tiles',
        type: 'raster',
        source: 'esri-satellite',
        paint: {
          'raster-opacity': 1.0,
        },
      },
    ],
  },

  terrain: {
    version: 8,
    name: 'Topographical Hillshade Terrain',
    sources: {
      'esri-hillshade': {
        type: 'raster',
        tiles: [
          'https://server.arcgisonline.com/ArcGIS/rest/services/Elevation/World_Hillshade/MapServer/tile/{z}/{y}/{x}',
        ],
        tileSize: 256,
        attribution: 'Esri, USGS, NGA, NASA, CGIAR, NCEAS, NLS, OS, NMA, Geodatastyrelsen, GSI, and the GIS User Community',
      },
      opentopo: {
        type: 'raster',
        tiles: [
          'https://a.tile.opentopomap.org/{z}/{x}/{y}.png',
          'https://b.tile.opentopomap.org/{z}/{x}/{y}.png',
        ],
        tileSize: 256,
        maxzoom: 17,
        attribution: 'Map data: &copy; OpenStreetMap contributors, SRTM | Map style: &copy; OpenTopoMap (CC-BY-SA)',
      },
    },
    layers: [
      {
        id: 'background',
        type: 'background',
        paint: {
          'background-color': '#0F172A',
        },
      },
      {
        id: 'hillshade-layer',
        type: 'raster',
        source: 'esri-hillshade',
        paint: {
          'raster-opacity': 0.65,
        },
      },
      {
        id: 'topo-contour-layer',
        type: 'raster',
        source: 'opentopo',
        paint: {
          'raster-opacity': 0.35,
          'raster-saturation': -0.5,
        },
      },
    ],
  },

  hybrid: {
    version: 8,
    name: 'Satellite & Transport Hybrid',
    sources: {
      'esri-satellite': {
        type: 'raster',
        tiles: [
          'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
        ],
        tileSize: 256,
        attribution: 'Esri Satellite',
      },
      'esri-roads': {
        type: 'raster',
        tiles: [
          'https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Transportation/MapServer/tile/{z}/{y}/{x}',
        ],
        tileSize: 256,
      },
      'esri-places': {
        type: 'raster',
        tiles: [
          'https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}',
        ],
        tileSize: 256,
      },
    },
    layers: [
      {
        id: 'background',
        type: 'background',
        paint: {
          'background-color': '#020617',
        },
      },
      {
        id: 'satellite-base',
        type: 'raster',
        source: 'esri-satellite',
      },
      {
        id: 'roads-overlay',
        type: 'raster',
        source: 'esri-roads',
        paint: {
          'raster-opacity': 0.85,
        },
      },
      {
        id: 'places-overlay',
        type: 'raster',
        source: 'esri-places',
        paint: {
          'raster-opacity': 0.95,
        },
      },
    ],
  },
};
