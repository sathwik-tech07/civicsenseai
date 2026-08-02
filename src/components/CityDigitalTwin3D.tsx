import { useState, useRef, useEffect, useCallback } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';

import type { Incident, PredictiveRiskZone } from '../types';
import type {
  GISLayerConfig,
  MapStyleId,
  MeasurementMode,
  LandmarkPreset,
  SearchItem,
  SelectedEntityInfo,
} from './digital-twin/types';
import { MAP_STYLES } from './digital-twin/mapStyles';
import {
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
  incidentsToGeoJSON,
  predictiveRisksToGeoJSON,
} from './digital-twin/mockGisData';
import { LayerControl } from './digital-twin/LayerControl';
import { MapControls } from './digital-twin/MapControls';
import {
  MeasurementTool,
  calculateTotalPathDistance,
  calculateGeodesicArea,
} from './digital-twin/MeasurementTool';
import { SearchPanel } from './digital-twin/SearchPanel';
import { InfoPanel } from './digital-twin/InfoPanel';
import { WeatherControlPanel, WeatherCanvasOverlay } from './digital-twin/WeatherControlPanel';
import type { WeatherMode } from './digital-twin/types';
import type { Ward } from '../types';

interface Props {
  incidents: Incident[];
  predictiveRisks: PredictiveRiskZone[];
  wards: Ward[];
  onSelectIncident: (inc: Incident) => void;
  onOpenCCTV?: (incidentId: string) => void;
  onDispatchCrew?: (inc: Incident) => void;
}

// Initial 10+ GIS Layer Configurations
const INITIAL_LAYERS: GISLayerConfig[] = [
  {
    id: 'layer-buildings-3d',
    name: '3D Extruded Buildings',
    category: 'urban',
    iconName: 'Building2',
    visible: true,
    opacity: 0.88,
    sourceId: 'src-buildings-3d',
    layerIds: ['bengaluru-3d-buildings'],
    description: '3D volumetric structures with height & category colors',
  },
  {
    id: 'layer-roads',
    name: 'Arterial Roads & Expressways',
    category: 'transport',
    iconName: 'Route',
    visible: true,
    opacity: 0.85,
    sourceId: 'src-roads',
    layerIds: ['roads-line'],
    description: 'Primary transportation corridors across Bengaluru',
  },
  {
    id: 'layer-water-network',
    name: 'Water Supply & Drains',
    category: 'utilities',
    iconName: 'Droplet',
    visible: true,
    opacity: 0.9,
    sourceId: 'src-water-network',
    layerIds: ['water-network-line'],
    description: 'Kaveri trunk lines & storm overflow channels',
  },
  {
    id: 'layer-power-grid',
    name: 'BESCOM Power Grid',
    category: 'utilities',
    iconName: 'Zap',
    visible: true,
    opacity: 0.9,
    sourceId: 'src-power-grid',
    layerIds: ['power-grid-line'],
    description: '220kV high-voltage lines & substation interconnects',
  },
  {
    id: 'layer-hospitals',
    name: 'Hospitals & Emergency Care',
    category: 'facilities',
    iconName: 'HeartPulse',
    visible: true,
    opacity: 1.0,
    sourceId: 'src-hospitals',
    layerIds: ['hospitals-circle'],
    description: 'Major medical hubs & trauma centers',
  },
  {
    id: 'layer-schools',
    name: 'Schools & Universities',
    category: 'facilities',
    iconName: 'GraduationCap',
    visible: true,
    opacity: 1.0,
    sourceId: 'src-schools',
    layerIds: ['schools-circle'],
    description: 'Academic institutions & IISc research campus',
  },
  {
    id: 'layer-iot-sensors',
    name: 'Live IoT Telemetry Nodes',
    category: 'iot',
    iconName: 'Radio',
    visible: true,
    opacity: 1.0,
    sourceId: 'src-iot-sensors',
    layerIds: ['iot-sensors-circle'],
    description: 'Real-time AQI, water pressure, and noise monitors',
  },
  {
    id: 'layer-traffic',
    name: 'Live Traffic Congestion',
    category: 'transport',
    iconName: 'Activity',
    visible: true,
    opacity: 0.85,
    sourceId: 'src-traffic',
    layerIds: ['traffic-line'],
    description: 'Congestion corridors (Heavy, Moderate, Free-flow)',
  },
  {
    id: 'layer-flood-zones',
    name: 'Monsoon Flood Risk Basins',
    category: 'risk',
    iconName: 'Flame',
    visible: true,
    opacity: 0.7,
    sourceId: 'src-flood-zones',
    layerIds: ['flood-zones-fill', 'flood-zones-outline'],
    description: 'Bellandur & Silk Board flood risk areas',
  },
  {
    id: 'layer-emergency-routes',
    name: 'Emergency Response Corridors',
    category: 'transport',
    iconName: 'Route',
    visible: false,
    opacity: 0.95,
    sourceId: 'src-emergency-routes',
    layerIds: ['emergency-routes-line'],
    description: 'Priority green corridors for ambulance dispatch',
  },
  {
    id: 'layer-incidents',
    name: 'Civic Complaints & Incidents',
    category: 'risk',
    iconName: 'AlertTriangle',
    visible: true,
    opacity: 1.0,
    sourceId: 'src-incidents',
    layerIds: ['incidents-circle'],
    description: 'Reported potholes, leaks, and drainage issues',
  },
];

export function CityDigitalTwin3D({ incidents, predictiveRisks, wards, onSelectIncident, onOpenCCTV, onDispatchCrew }: Props) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const iotMarkersRef = useRef<maplibregl.Marker[]>([]);

  // State Management
  const [mapStyle, setMapStyle] = useState<MapStyleId>('streets');
  const [layers, setLayers] = useState<GISLayerConfig[]>(INITIAL_LAYERS);
  const [isLayerControlOpen, setIsLayerControlOpen] = useState(false);
  const [selectedEntity, setSelectedEntity] = useState<SelectedEntityInfo | null>(null);
  // Weather & Atmosphere Engine State
  const [currentWeather, setCurrentWeather] = useState<WeatherMode>('rain');

  // Camera State HUD
  const [coordsInfo, setCoordsInfo] = useState({
    lat: 12.9716,
    lng: 77.5946,
    zoom: 14,
    pitch: 45,
    bearing: -15,
  });

  // Geodesic Measurement State
  const [measureMode, setMeasureMode] = useState<MeasurementMode>('none');
  const [measurePoints, setMeasurePoints] = useState<[number, number][]>([]);

  // Calculate measurement metrics dynamically
  const measuredDistance = calculateTotalPathDistance(measurePoints);
  const measuredArea = calculateGeodesicArea(measurePoints);

  // ── Helper: Attach GIS Sources & Layers onto Map ──
  const setupGisLayers = useCallback(
    (map: maplibregl.Map) => {
      // 1. 3D Extruded Buildings
      if (!map.getSource('src-buildings-3d')) {
        map.addSource('src-buildings-3d', { type: 'geojson', data: BUILDINGS_3D_GEOJSON });
      }
      if (!map.getLayer('bengaluru-3d-buildings')) {
        map.addLayer({
          id: 'bengaluru-3d-buildings',
          type: 'fill-extrusion',
          source: 'src-buildings-3d',
          minzoom: 11,
          paint: {
            'fill-extrusion-color': [
              'case',
              ['==', ['get', 'category'], 'hospital'], '#06B6D4',
              ['==', ['get', 'category'], 'school'], '#FBBF24',
              ['==', ['get', 'category'], 'government'], '#8B5CF6',
              ['==', ['get', 'category'], 'commercial'], '#3B82F6',
              ['==', ['get', 'category'], 'residential'], '#475569',
              ['==', ['get', 'category'], 'industrial'], '#D97706',
              [
                'interpolate',
                ['linear'],
                ['coalesce', ['get', 'height'], 20],
                0, '#1E293B',
                30, '#334155',
                60, '#1E40AF',
                120, '#3B82F6',
              ],
            ],
            'fill-extrusion-height': ['coalesce', ['get', 'height'], 20],
            'fill-extrusion-base': ['coalesce', ['get', 'min_height'], 0],
            'fill-extrusion-opacity': 0.88,
            'fill-extrusion-vertical-gradient': true,
          },
        });
      }

      // 2. Roads Line Layer
      if (!map.getSource('src-roads')) {
        map.addSource('src-roads', { type: 'geojson', data: ROADS_GEOJSON });
      }
      if (!map.getLayer('roads-line')) {
        map.addLayer({
          id: 'roads-line',
          type: 'line',
          source: 'src-roads',
          paint: {
            'line-color': '#38BDF8',
            'line-width': ['interpolate', ['linear'], ['zoom'], 11, 2, 16, 6],
            'line-opacity': 0.85,
          },
        });
      }

      // 3. Water Network Line Layer
      if (!map.getSource('src-water-network')) {
        map.addSource('src-water-network', { type: 'geojson', data: WATER_NETWORK_GEOJSON });
      }
      if (!map.getLayer('water-network-line')) {
        map.addLayer({
          id: 'water-network-line',
          type: 'line',
          source: 'src-water-network',
          paint: {
            'line-color': '#00D4FF',
            'line-width': 3.5,
            'line-opacity': 0.9,
          },
        });
      }

      // 4. Power Grid Line Layer
      if (!map.getSource('src-power-grid')) {
        map.addSource('src-power-grid', { type: 'geojson', data: POWER_GRID_GEOJSON });
      }
      if (!map.getLayer('power-grid-line')) {
        map.addLayer({
          id: 'power-grid-line',
          type: 'line',
          source: 'src-power-grid',
          paint: {
            'line-color': '#F59E0B',
            'line-width': 2.5,
            'line-dasharray': [3, 2],
            'line-opacity': 0.9,
          },
        });
      }

      // 5. Flood Zones Fill & Outline
      if (!map.getSource('src-flood-zones')) {
        map.addSource('src-flood-zones', { type: 'geojson', data: FLOOD_ZONES_GEOJSON });
      }
      if (!map.getLayer('flood-zones-fill')) {
        map.addLayer({
          id: 'flood-zones-fill',
          type: 'fill',
          source: 'src-flood-zones',
          paint: {
            'fill-color': '#EF4444',
            'fill-opacity': 0.25,
          },
        });
      }
      if (!map.getLayer('flood-zones-outline')) {
        map.addLayer({
          id: 'flood-zones-outline',
          type: 'line',
          source: 'src-flood-zones',
          paint: {
            'line-color': '#EF4444',
            'line-width': 2,
            'line-dasharray': [2, 1],
          },
        });
      }

      // 6. Traffic Flow Line Layer
      if (!map.getSource('src-traffic')) {
        map.addSource('src-traffic', { type: 'geojson', data: TRAFFIC_FLOW_GEOJSON });
      }
      if (!map.getLayer('traffic-line')) {
        map.addLayer({
          id: 'traffic-line',
          type: 'line',
          source: 'src-traffic',
          paint: {
            'line-color': [
              'match',
              ['get', 'congestionLevel'],
              'heavy', '#EF4444',
              'moderate', '#F59E0B',
              'free', '#10B981',
              '#38BDF8',
            ],
            'line-width': 4.5,
            'line-opacity': 0.85,
          },
        });
      }

      // 7. Emergency Routes Line Layer
      if (!map.getSource('src-emergency-routes')) {
        map.addSource('src-emergency-routes', { type: 'geojson', data: EMERGENCY_ROUTES_GEOJSON });
      }
      if (!map.getLayer('emergency-routes-line')) {
        map.addLayer({
          id: 'emergency-routes-line',
          type: 'line',
          source: 'src-emergency-routes',
          layout: { visibility: 'none' },
          paint: {
            'line-color': '#10B981',
            'line-width': 5,
            'line-opacity': 0.95,
          },
        });
      }

      // 8. Hospitals Circle Layer
      if (!map.getSource('src-hospitals')) {
        map.addSource('src-hospitals', { type: 'geojson', data: HOSPITALS_GEOJSON });
      }
      if (!map.getLayer('hospitals-circle')) {
        map.addLayer({
          id: 'hospitals-circle',
          type: 'circle',
          source: 'src-hospitals',
          paint: {
            'circle-radius': 7.5,
            'circle-color': '#06B6D4',
            'circle-stroke-width': 2,
            'circle-stroke-color': '#FFFFFF',
          },
        });
      }

      // 9. Schools Circle Layer
      if (!map.getSource('src-schools')) {
        map.addSource('src-schools', { type: 'geojson', data: SCHOOLS_GEOJSON });
      }
      if (!map.getLayer('schools-circle')) {
        map.addLayer({
          id: 'schools-circle',
          type: 'circle',
          source: 'src-schools',
          paint: {
            'circle-radius': 6.5,
            'circle-color': '#FBBF24',
            'circle-stroke-width': 2,
            'circle-stroke-color': '#FFFFFF',
          },
        });
      }

      // 10. IoT Sensors Circle Layer
      if (!map.getSource('src-iot-sensors')) {
        map.addSource('src-iot-sensors', { type: 'geojson', data: IOT_SENSORS_GEOJSON });
      }
      if (!map.getLayer('iot-sensors-circle')) {
        map.addLayer({
          id: 'iot-sensors-circle',
          type: 'circle',
          source: 'src-iot-sensors',
          paint: {
            'circle-radius': 8,
            'circle-color': [
              'match',
              ['get', 'status'],
              'active', '#10B981',
              'warning', '#F59E0B',
              'critical', '#EF4444',
              '#64748B',
            ],
            'circle-stroke-width': 2,
            'circle-stroke-color': '#00D4FF',
          },
        });
      }

      // 11. Incidents Layer
      const incidentsData = incidentsToGeoJSON(incidents);
      if (!map.getSource('src-incidents')) {
        map.addSource('src-incidents', { type: 'geojson', data: incidentsData });
      } else {
        (map.getSource('src-incidents') as maplibregl.GeoJSONSource).setData(incidentsData);
      }
      if (!map.getLayer('incidents-circle')) {
        map.addLayer({
          id: 'incidents-circle',
          type: 'circle',
          source: 'src-incidents',
          paint: {
            'circle-radius': 9,
            'circle-color': [
              'match',
              ['get', 'severity'],
              'critical', '#EF4444',
              'high', '#F59E0B',
              'medium', '#8B5CF6',
              '#10B981',
            ],
            'circle-stroke-width': 2.5,
            'circle-stroke-color': '#FFFFFF',
          },
        });
      }

      // 12. Predictive Risks Layer
      const risksData = predictiveRisksToGeoJSON(predictiveRisks);
      if (!map.getSource('src-predictive-risks')) {
        map.addSource('src-predictive-risks', { type: 'geojson', data: risksData });
      } else {
        (map.getSource('src-predictive-risks') as maplibregl.GeoJSONSource).setData(risksData);
      }
      if (!map.getLayer('predictive-risks-circle')) {
        map.addLayer({
          id: 'predictive-risks-circle',
          type: 'circle',
          source: 'src-predictive-risks',
          paint: {
            'circle-radius': 11,
            'circle-color': '#F59E0B',
            'circle-opacity': 0.75,
            'circle-stroke-width': 2,
            'circle-stroke-color': '#EF4444',
          },
        });
      }

      // 13. Measurement Tool Source & Layers
      if (!map.getSource('src-measurement')) {
        map.addSource('src-measurement', {
          type: 'geojson',
          data: { type: 'FeatureCollection', features: [] },
        });
      }
      if (!map.getLayer('measure-fill')) {
        map.addLayer({
          id: 'measure-fill',
          type: 'fill',
          source: 'src-measurement',
          filter: ['==', '$type', 'Polygon'],
          paint: {
            'fill-color': '#F59E0B',
            'fill-opacity': 0.25,
          },
        });
      }
      if (!map.getLayer('measure-line')) {
        map.addLayer({
          id: 'measure-line',
          type: 'line',
          source: 'src-measurement',
          filter: ['in', '$type', 'LineString', 'Polygon'],
          paint: {
            'line-color': '#F59E0B',
            'line-width': 3,
            'line-dasharray': [2, 2],
          },
        });
      }
      if (!map.getLayer('measure-points')) {
        map.addLayer({
          id: 'measure-points',
          type: 'circle',
          source: 'src-measurement',
          filter: ['==', '$type', 'Point'],
          paint: {
            'circle-radius': 6,
            'circle-color': '#FFFFFF',
            'circle-stroke-width': 2,
            'circle-stroke-color': '#F59E0B',
          },
        });
      }
    },
    [incidents, predictiveRisks]
  );

  // ── Helper: Attach Pulsing HTML Markers for IoT Sensors ──
  const setupIoTPulsingMarkers = useCallback((map: maplibregl.Map) => {
    // Clear old markers
    iotMarkersRef.current.forEach((m) => m.remove());
    iotMarkersRef.current = [];

    IOT_SENSORS_DATA.forEach((sensor) => {
      const el = document.createElement('div');
      el.className = 'iot-marker-container';

      const dotColor =
        sensor.status === 'active'
          ? '#10B981'
          : sensor.status === 'warning'
          ? '#F59E0B'
          : '#EF4444';

      el.style.color = dotColor;

      el.innerHTML = `
        <div class="iot-marker-ripple"></div>
        <div class="iot-marker-dot" style="background-color: ${dotColor}"></div>
      `;

      el.addEventListener('click', (e) => {
        e.stopPropagation();
        setSelectedEntity({ type: 'sensor', data: sensor });
        map.flyTo({ center: [sensor.lng, sensor.lat], zoom: 16, pitch: 50, duration: 1500 });
      });

      const marker = new maplibregl.Marker({ element: el })
        .setLngLat([sensor.lng, sensor.lat])
        .addTo(map);

      iotMarkersRef.current.push(marker);
    });
  }, []);

  // ── Initialize MapLibre GL JS Map Instance ──
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    const map = new maplibregl.Map({
      container: mapContainerRef.current,
      style: MAP_STYLES[mapStyle],
      center: BENGALURU_CENTER,
      zoom: 14,
      pitch: 45,
      bearing: -15,
    });

    mapRef.current = map;

    // Attach Camera HUD Listener
    map.on('move', () => {
      const center = map.getCenter();
      setCoordsInfo({
        lat: center.lat,
        lng: center.lng,
        zoom: map.getZoom(),
        pitch: map.getPitch(),
        bearing: map.getBearing(),
      });
    });

    // On Map Load: Register Sources, Layers, and Pulsing Markers
    map.on('load', () => {
      setupGisLayers(map);
      setupIoTPulsingMarkers(map);
    });

    // Click Handlers for Interactive GIS Layers
    map.on('click', 'incidents-circle', (e) => {
      if (e.features && e.features[0] && e.features[0].properties) {
        const inc = e.features[0].properties as Incident;
        setSelectedEntity({ type: 'incident', data: inc });
        onSelectIncident(inc);
      }
    });

    map.on('click', 'hospitals-circle', (e) => {
      if (e.features && e.features[0] && e.features[0].properties) {
        const hosp = e.features[0].properties;
        setSelectedEntity({ type: 'hospital', data: hosp });
      }
    });

    map.on('click', 'predictive-risks-circle', (e) => {
      if (e.features && e.features[0] && e.features[0].properties) {
        const rk = e.features[0].properties as PredictiveRiskZone;
        setSelectedEntity({ type: 'risk', data: rk });
      }
    });

    // Interactive 3D Building Footprint Click Handler
    map.on('click', 'bengaluru-3d-buildings', (e) => {
      if (e.features && e.features[0] && e.features[0].properties) {
        const props = e.features[0].properties;
        const coords = e.lngLat;

        setSelectedEntity({
          type: 'building',
          data: {
            id: props.id || 'bld_selected',
            name: props.name || 'Metro Structure',
            category: props.category || 'commercial',
            height: props.height || 48,
            levels: props.levels || 14,
            healthScore: props.healthScore || 88,
            riskScore: props.riskScore || 14,
            waterUsage: '5,200 L/day',
            energyUsage: '340 kWh',
            sensorsCount: 4,
            nearbyIncidentsCount: 1,
            aiRecommendation: 'Inspect basement Kaveri water valve B17 within 14 days.',
            nextMaintenanceDate: 'Aug 18, 2026',
            assignedDept: 'Water Supply & Sewerage Board',
          },
        });

        // Smooth camera fly-to animation with tilt & orbit
        map.flyTo({
          center: [coords.lng, coords.lat],
          zoom: 16.8,
          pitch: 55,
          bearing: -20,
          duration: 1800,
        });
      }
    });

    // Hover Tooltip Popup for Buildings
    const popup = new maplibregl.Popup({
      closeButton: false,
      closeOnClick: false,
      offset: 15,
    });

    map.on('mouseenter', 'bengaluru-3d-buildings', (e) => {
      map.getCanvas().style.cursor = 'pointer';
      if (e.features && e.features[0] && e.features[0].properties) {
        const name = e.features[0].properties.name || 'Building Asset';
        const category = e.features[0].properties.category || 'Structure';
        const height = e.features[0].properties.height || 40;

        popup
          .setLngLat(e.lngLat)
          .setHTML(
            `<div style="background:#070B14; color:#F8FAFC; padding:6px 10px; border-radius:8px; font-family:'Inter',sans-serif; border:1px solid #00D4FF; font-size:11px;">
              <strong style="color:#00D4FF; display:block; font-size:12px;">🏢 ${name}</strong>
              <span style="color:#94A3B8;">${category.toUpperCase()} · ${height}m Height</span>
            </div>`
          )
          .addTo(map);
      }
    });

    map.on('mouseleave', 'bengaluru-3d-buildings', () => {
      map.getCanvas().style.cursor = '';
      popup.remove();
    });

    // Cursor pointer hover effects
    const pointerLayers = ['incidents-circle', 'hospitals-circle', 'predictive-risks-circle', 'iot-sensors-circle'];
    pointerLayers.forEach((layerId) => {
      map.on('mouseenter', layerId, () => {
        map.getCanvas().style.cursor = 'pointer';
      });
      map.on('mouseleave', layerId, () => {
        map.getCanvas().style.cursor = '';
      });
    });

    return () => {
      iotMarkersRef.current.forEach((m) => m.remove());
      map.remove();
      mapRef.current = null;
    };
  }, []); // Run once on mount

  // ── Sync Style Changes ──
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    map.setStyle(MAP_STYLES[mapStyle]);
    map.once('style.load', () => {
      setupGisLayers(map);
      setupIoTPulsingMarkers(map);
    });
  }, [mapStyle, setupGisLayers, setupIoTPulsingMarkers]);

  // ── Sync Incidents & Predictive Risks Prop Updates ──
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (map.getSource('src-incidents')) {
      (map.getSource('src-incidents') as maplibregl.GeoJSONSource).setData(incidentsToGeoJSON(incidents));
    }
    if (map.getSource('src-predictive-risks')) {
      (map.getSource('src-predictive-risks') as maplibregl.GeoJSONSource).setData(
        predictiveRisksToGeoJSON(predictiveRisks)
      );
    }
  }, [incidents, predictiveRisks]);

  // ── Layer Visibility & Opacity Controller Handler ──
  const handleToggleLayer = (layerId: string) => {
    const map = mapRef.current;
    setLayers((prev) =>
      prev.map((l) => {
        if (l.id === layerId) {
          const nextVisible = !l.visible;
          if (map) {
            l.layerIds.forEach((mId) => {
              if (map.getLayer(mId)) {
                map.setLayoutProperty(mId, 'visibility', nextVisible ? 'visible' : 'none');
              }
            });
          }
          return { ...l, visible: nextVisible };
        }
        return l;
      })
    );
  };

  const handleChangeOpacity = (layerId: string, opacity: number) => {
    const map = mapRef.current;
    setLayers((prev) =>
      prev.map((l) => {
        if (l.id === layerId) {
          if (map) {
            l.layerIds.forEach((mId) => {
              if (map.getLayer(mId)) {
                const type = map.getLayer(mId)?.type;
                if (type === 'fill-extrusion') {
                  map.setPaintProperty(mId, 'fill-extrusion-opacity', opacity);
                } else if (type === 'fill') {
                  map.setPaintProperty(mId, 'fill-opacity', opacity);
                } else if (type === 'line') {
                  map.setPaintProperty(mId, 'line-opacity', opacity);
                } else if (type === 'circle') {
                  map.setPaintProperty(mId, 'circle-opacity', opacity);
                }
              }
            });
          }
          return { ...l, opacity };
        }
        return l;
      })
    );
  };

  // ── Measurement Click & Drawing Handler ──
  useEffect(() => {
    const map = mapRef.current;
    if (!map || measureMode === 'none') return;

    const handleMapClick = (e: maplibregl.MapMouseEvent) => {
      const newPoint: [number, number] = [e.lngLat.lng, e.lngLat.lat];
      setMeasurePoints((prev) => {
        const next = [...prev, newPoint];
        updateMeasurementGeoJSON(map, next, measureMode);
        return next;
      });
    };

    map.on('click', handleMapClick);
    return () => {
      map.off('click', handleMapClick);
    };
  }, [measureMode]);

  const updateMeasurementGeoJSON = (
    map: maplibregl.Map,
    points: [number, number][],
    mode: MeasurementMode
  ) => {
    const src = map.getSource('src-measurement') as maplibregl.GeoJSONSource;
    if (!src) return;

    const features: any[] = points.map((pt) => ({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: pt },
    }));

    if (points.length >= 2) {
      features.push({
        type: 'Feature',
        geometry: { type: 'LineString', coordinates: points },
      });
    }

    if (mode === 'area' && points.length >= 3) {
      features.push({
        type: 'Feature',
        geometry: { type: 'Polygon', coordinates: [[...points, points[0]]] },
      });
    }

    src.setData({ type: 'FeatureCollection', features });
  };

  const handleClearMeasurement = () => {
    setMeasurePoints([]);
    const map = mapRef.current;
    if (map && map.getSource('src-measurement')) {
      (map.getSource('src-measurement') as maplibregl.GeoJSONSource).setData({
        type: 'FeatureCollection',
        features: [],
      });
    }
  };

  // ── Search Selection Handler ──
  const handleSelectSearchItem = (item: SearchItem) => {
    const map = mapRef.current;
    if (map) {
      map.flyTo({
        center: item.coordinates,
        zoom: 16.5,
        pitch: 55,
        bearing: -20,
        duration: 2000,
      });
    }
    setSelectedEntity({
      type: (item.category === 'poi' ? 'landmark' : item.category) as any,
      data: item.metadata,
    });
    if (item.category === 'incident') {
      onSelectIncident(item.metadata as Incident);
    }
  };

  // ── Landmark Fly-To Handler ──
  const handleFlyToLandmark = (landmark: LandmarkPreset) => {
    const map = mapRef.current;
    if (map) {
      map.flyTo({
        center: landmark.coordinates,
        zoom: landmark.zoom,
        pitch: landmark.pitch,
        bearing: landmark.bearing,
        duration: 2200,
      });
    }
  };

  // ── Geolocation Handler ──
  const handleLocateMe = () => {
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const { latitude, longitude } = pos.coords;
          mapRef.current?.flyTo({ center: [longitude, latitude], zoom: 16, pitch: 50 });
        },
        () => {
          // Fallback to Bengaluru CBD
          mapRef.current?.flyTo({ center: BENGALURU_CENTER, zoom: 15, pitch: 45 });
        }
      );
    }
  };

  return (
    <div style={{
      display: 'flex',
      width: '100%',
      height: 'calc(100vh - 64px)',
      minHeight: 600,
      background: '#070B14',
      overflow: 'hidden',
      fontFamily: "'Inter', sans-serif",
      position: 'relative',
    }}>

      {/* ── LEFT SIDEBAR (320px) ── */}
      <div style={{
        width: 320,
        minWidth: 320,
        height: '100%',
        background: 'rgba(17, 24, 39, 0.95)',
        backdropFilter: 'blur(20px)',
        borderRight: '1px solid rgba(255, 255, 255, 0.08)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        zIndex: 20,
      }}>
        {/* Sidebar Header */}
        <div style={{
          padding: '16px 16px 12px',
          borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
        }}>
          <div style={{
            fontSize: 11,
            fontWeight: 700,
            color: '#00D4FF',
            fontFamily: "'IBM Plex Mono', monospace",
            letterSpacing: 1,
            marginBottom: 4,
          }}>
            ENTERPRISE GIS DIGITAL TWIN
          </div>
          <div style={{
            fontSize: 13,
            fontWeight: 800,
            color: '#F8FAFC',
            fontFamily: "'Space Grotesk', sans-serif",
          }}>
            Bengaluru Metro · 12.97°N, 77.59°E
          </div>
        </div>

        {/* Search */}
        <div style={{ padding: '12px 16px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          <SearchPanel
            wards={wards}
            incidents={incidents}
            predictiveRisks={predictiveRisks}
            onSelectSearchItem={handleSelectSearchItem}
          />
        </div>

        {/* Dynamic Weather & Atmosphere Engine Control Panel */}
        <div style={{ padding: '12px 16px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          <WeatherControlPanel
            currentWeather={currentWeather}
            onChangeWeather={(w) => setCurrentWeather(w)}
          />
        </div>

        {/* Layer Control (scrollable) */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '0 0 12px' }}>
          <LayerControl
            layers={layers}
            onToggleLayer={handleToggleLayer}
            onChangeOpacity={handleChangeOpacity}
            isOpen={isLayerControlOpen}
            onToggleOpen={() => setIsLayerControlOpen(!isLayerControlOpen)}
          />
        </div>

        {/* Measurement Tool */}
        <div style={{
          padding: '12px 16px',
          borderTop: '1px solid rgba(255, 255, 255, 0.08)',
        }}>
          <MeasurementTool
            mode={measureMode}
            onSetMode={(m) => {
              setMeasureMode(m);
              if (m === 'none') handleClearMeasurement();
            }}
            pointsCount={measurePoints.length}
            distanceMeters={measuredDistance}
            areaSqMeters={measuredArea}
            onClear={handleClearMeasurement}
          />
        </div>

        {/* Coordinate HUD */}
        <div style={{
          padding: '10px 16px',
          borderTop: '1px solid rgba(255, 255, 255, 0.08)',
          background: 'rgba(7, 11, 20, 0.6)',
          display: 'flex',
          flexWrap: 'wrap',
          gap: 12,
          fontSize: 10,
          fontFamily: "'IBM Plex Mono', monospace",
          color: '#64748B',
        }}>
          <span>LAT <strong style={{ color: '#F8FAFC' }}>{coordsInfo.lat.toFixed(4)}</strong></span>
          <span>LNG <strong style={{ color: '#F8FAFC' }}>{coordsInfo.lng.toFixed(4)}</strong></span>
          <span>Z <strong style={{ color: '#00D4FF' }}>{coordsInfo.zoom.toFixed(1)}</strong></span>
          <span>P <strong style={{ color: '#94A3B8' }}>{coordsInfo.pitch.toFixed(0)}°</strong></span>
          <span>B <strong style={{ color: '#94A3B8' }}>{coordsInfo.bearing.toFixed(0)}°</strong></span>
        </div>
      </div>

      {/* ── CENTER MAP AREA (flexible) ── */}
      <div style={{
        flex: 1,
        position: 'relative',
        overflow: 'hidden',
      }}>
        {/* Animated Canvas Particle Overlay for Rain, Lightning & Fog */}
        <WeatherCanvasOverlay currentWeather={currentWeather} />

        {/* MapLibre GL Container */}
        <div
          ref={mapContainerRef}
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
          }}
        />

        {/* Map Controls (top-right of map) */}
        <MapControls
          currentStyle={mapStyle}
          onChangeStyle={setMapStyle}
          onZoomIn={() => mapRef.current?.zoomIn()}
          onZoomOut={() => mapRef.current?.zoomOut()}
          onRotate={() => {
            const map = mapRef.current;
            if (map) map.easeTo({ bearing: map.getBearing() + 45, duration: 800 });
          }}
          onTogglePitch={() => {
            const map = mapRef.current;
            if (map) {
              const nextPitch = map.getPitch() > 10 ? 0 : 60;
              map.easeTo({ pitch: nextPitch, duration: 800 });
            }
          }}
          is3DPitch={coordsInfo.pitch > 10}
          onResetView={() =>
            mapRef.current?.flyTo({
              center: BENGALURU_CENTER,
              zoom: 14,
              pitch: 45,
              bearing: -15,
              duration: 1500,
            })
          }
          onLocateMe={handleLocateMe}
          onFlyToLandmark={handleFlyToLandmark}
          coordsInfo={coordsInfo}
        />
      </div>

      {/* ── RIGHT SIDEBAR – AI INSIGHTS (360px) ── */}
      <div style={{
        width: 360,
        minWidth: 360,
        height: '100%',
        background: 'rgba(17, 24, 39, 0.95)',
        backdropFilter: 'blur(20px)',
        borderLeft: '1px solid rgba(255, 255, 255, 0.08)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        zIndex: 20,
      }}>
        {/* Right Panel Header */}
        <div style={{
          padding: '16px 16px 12px',
          borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}>
          <div>
            <div style={{
              fontSize: 11,
              fontWeight: 700,
              color: '#8B5CF6',
              fontFamily: "'IBM Plex Mono', monospace",
              letterSpacing: 1,
            }}>
              AI INSIGHTS
            </div>
            <div style={{
              fontSize: 13,
              fontWeight: 700,
              color: '#F8FAFC',
              fontFamily: "'Space Grotesk', sans-serif",
              marginTop: 2,
            }}>
              Entity Inspector
            </div>
          </div>
          <div style={{
            width: 8,
            height: 8,
            borderRadius: '50%',
            background: '#10B981',
            boxShadow: '0 0 8px rgba(16, 185, 129, 0.6)',
          }} />
        </div>

        {/* Info Panel Content (scrollable) */}
        <div style={{ flex: 1, overflowY: 'auto' }}>
          <InfoPanel
            info={selectedEntity}
            onClose={() => setSelectedEntity(null)}
            onDispatchCrew={(inc) => {
              onSelectIncident(inc);
              if (onDispatchCrew) onDispatchCrew(inc);
            }}
            onOpenCCTV={onOpenCCTV}
            onSimulateImpact={(data) => {
              console.log('Simulating digital twin impact for:', data);
            }}
            onGenerateReport={(data) => {
              console.log('Generating AI Executive Report for:', data);
            }}
            onNavigateToEntity={(data) => {
              const coords = data.coordinates || [data.lng || 77.5946, data.lat || 12.9716];
              mapRef.current?.flyTo({ center: coords, zoom: 16.8, pitch: 55, duration: 1800 });
            }}
          />
        </div>

        {/* Right Panel Footer – Quick Stats */}
        <div style={{
          padding: '12px 16px',
          borderTop: '1px solid rgba(255, 255, 255, 0.08)',
          background: 'rgba(7, 11, 20, 0.6)',
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: 8,
        }}>
          <div style={{
            background: 'rgba(255,255,255,0.03)',
            borderRadius: 10,
            padding: '8px 10px',
          }}>
            <div style={{ fontSize: 9, color: '#64748B', fontFamily: "'IBM Plex Mono', monospace" }}>INCIDENTS</div>
            <div style={{ fontSize: 18, fontWeight: 800, color: '#EF4444', fontFamily: "'IBM Plex Mono', monospace" }}>
              {incidents.filter(i => i.severity === 'critical').length}
              <span style={{ fontSize: 10, color: '#94A3B8', fontWeight: 500 }}> critical</span>
            </div>
          </div>
          <div style={{
            background: 'rgba(255,255,255,0.03)',
            borderRadius: 10,
            padding: '8px 10px',
          }}>
            <div style={{ fontSize: 9, color: '#64748B', fontFamily: "'IBM Plex Mono', monospace" }}>LAYERS</div>
            <div style={{ fontSize: 18, fontWeight: 800, color: '#00D4FF', fontFamily: "'IBM Plex Mono', monospace" }}>
              {layers.filter(l => l.visible).length}
              <span style={{ fontSize: 10, color: '#94A3B8', fontWeight: 500 }}> active</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

