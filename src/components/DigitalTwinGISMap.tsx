import React, { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  MapContainer, TileLayer, CircleMarker, Tooltip, Polyline, Circle, Polygon, useMap
} from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import {
  Search, Layers, Navigation, X, MapPin, Radio, Wifi, Compass, Activity,
  Loader2
} from 'lucide-react';
import type { Incident, PredictiveRiskZone, Ward } from '../types';
import { apiFetchGISIntelligence, type GISIntelligencePayload } from '../services/apiClient';

interface Props {
  incidents: Incident[];
  predictiveRisks: PredictiveRiskZone[];
  wards: Ward[];
  onSelectIncident: (inc: Incident) => void;
}

// Map Auto-Fly & Invalidating Container Resizer
function MapController({ center, zoom, onLoaded }: { center: [number, number]; zoom: number; onLoaded?: () => void }) {
  const map = useMap();

  useEffect(() => {
    map.flyTo(center, zoom, { duration: 1.5, easeLinearity: 0.25 });
  }, [center, zoom, map]);

  useEffect(() => {
    const timer = setTimeout(() => {
      map.invalidateSize();
      if (onLoaded) onLoaded();
    }, 250);

    const handleResize = () => {
      map.invalidateSize();
    };

    window.addEventListener('resize', handleResize);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('resize', handleResize);
    };
  }, [map, onLoaded]);

  return null;
}

const SEVERITY_COLORS: Record<string, string> = {
  critical: '#EF4444',
  high: '#F59E0B',
  medium: '#8B5CF6',
  low: '#10B981',
};

const DEPARTMENTS_MAP: Record<string, string> = {
  pothole: 'Road Infrastructure & Civil Works Dept',
  garbage: 'Solid Waste Management Division',
  drainage: 'Stormwater & Drainage Bureau',
  water_leak: 'Water Supply & Sewerage Board',
  water_main_leak: 'Water Supply & Sewerage Board',
  sewer_overflow: 'Sewerage & Sanitation Board',
  broken_streetlight: 'Electrical & Lighting Department',
  road_crack: 'Road Surface Maintenance Bureau',
  illegal_dumping: 'Environmental Sanitation Taskforce',
  fallen_tree: 'Urban Forestry & Disaster Corps',
  traffic_signal_failure: 'Traffic Management & Signals Division',
};

const OFFICER_UNIT = {
  name: 'Insp. Suresh Nair (Crew Alpha-3)',
  lat: 12.9550,
  lng: 77.5850,
  vehicle: 'Rapid Utility Truck #08',
};

/**
 * Dynamic Spatial Discovery Engine: Generates real nearby infrastructure telemetry relative to incident coordinates
 */
export interface DynamicInfraAsset {
  id: string;
  name: string;
  category: 'hospital' | 'school' | 'metro' | 'fire' | 'police' | 'water' | 'electric' | 'govt';
  lat: number;
  lng: number;
  distanceMeters: number;
  etaMins: number;
  criticality: 'CRITICAL' | 'HIGH' | 'MEDIUM';
  icon: string;
}



export const DigitalTwinGISMap: React.FC<Props> = ({
  incidents,
  predictiveRisks: _predictiveRisks,
  wards,
  onSelectIncident,
}) => {
  // ── Map Viewport State ──
  const [mapCenter, setMapCenter] = useState<[number, number]>([12.9716, 77.5946]);
  const [mapZoom, setMapZoom] = useState<number>(13);
  const [isMapLoading, setIsMapLoading] = useState(true);
  const [tileError, setTileError] = useState(false);

  // ── Selected Incident for Floating Glass Card ──
  const [selectedMapIncident, setSelectedMapIncident] = useState<Incident | null>(null);

  // ── Live Backend GIS Intelligence ──
  const [gisIntel, setGisIntel] = useState<GISIntelligencePayload | null>(null);

  // ── Fetch GIS Intelligence whenever selected incident or center changes ──
  useEffect(() => {
    const lat = selectedMapIncident ? selectedMapIncident.lat : mapCenter[0];
    const lng = selectedMapIncident ? selectedMapIncident.lng : mapCenter[1];
    
    apiFetchGISIntelligence(
      lat,
      lng,
      selectedMapIncident?.type,
      selectedMapIncident?.severity,
      selectedMapIncident?.wardName
    )
      .then(data => setGisIntel(data))
      .catch(err => console.error("Error fetching GIS intelligence:", err));
  }, [selectedMapIncident, mapCenter]);

  // ── Search State ──
  const [searchTerm, setSearchTerm] = useState('');
  const [searchSuggestions, setSearchSuggestions] = useState<Incident[]>([]);

  // ── Layer Toggles (11 Layers) ──
  const [layers, setLayers] = useState({
    roads: true,
    drainage: false,
    garbage: false,
    streetlights: false,
    waterPipelines: false,
    hospitals: true,
    schools: false,
    wardBoundaries: true,
    govtBuildings: false,
    traffic: false,
    heatmap: false,
  });

  // ── Heatmap Sub-Type ──
  const [heatmapType, setHeatmapType] = useState<'road' | 'garbage' | 'flood' | 'water'>('road');

  // ── Layer Panel Toggle ──
  const [showLayerPanel, setShowLayerPanel] = useState(false);

  // ── Officer Navigation Route Mode ──
  const [navigationTarget, setNavigationTarget] = useState<Incident | null>(null);

  // ── Smart City Future Layer Badges State ──
  const [activeFutureLayer, setActiveFutureLayer] = useState<'iot' | 'drone' | 'satellite' | 'weather' | null>(null);

  // ── Search Auto-Complete & Auto-Zoom ──
  useEffect(() => {
    if (!searchTerm.trim()) {
      setSearchSuggestions([]);
      return;
    }
    const q = searchTerm.toLowerCase();
    const matches = incidents.filter(
      inc =>
        inc.id.toLowerCase().includes(q) ||
        inc.address.toLowerCase().includes(q) ||
        inc.wardName.toLowerCase().includes(q) ||
        inc.title.toLowerCase().includes(q)
    );
    setSearchSuggestions(matches.slice(0, 5));
  }, [searchTerm, incidents]);

  const handleSelectSearchResult = (inc: Incident) => {
    setSearchTerm('');
    setSearchSuggestions([]);
    setSelectedMapIncident(inc);
    setMapCenter([inc.lat, inc.lng]);
    setMapZoom(16);
  };

  // ── Toggle Layer Helper ──
  const toggleLayer = (key: keyof typeof layers) => {
    setLayers(prev => ({ ...prev, [key]: !prev[key] }));
  };

  // ── Live Incident Trigger Simulation ──
  const handleSimulateNewIncident = () => {
    const newInc: Incident = {
      id: `INC-2026-${Math.floor(Math.random() * 9000) + 1000}`,
      title: 'CRITICAL: Severe Flood Risk & Drainage Burst',
      type: 'drainage',
      severity: 'critical',
      status: 'reported',
      wardId: 'w-1',
      wardName: 'Ward 1 - Metro Health Corridor',
      lat: 12.9735,
      lng: 77.5965,
      address: 'Victoria Hospital Corridor, Sector 2',
      reportedDate: new Date().toLocaleString(),
      reportedBy: 'AI Automated Sentinel',
      priorityScore: 98,
      estimatedRepairCost: 14500,
      savedEarlyIntervention: 62000,
      photoUrl: 'https://images.unsplash.com/photo-1515162816999-a0c47dc192f7?auto=format&fit=crop&w=800&q=80',
      xai: {
        cvConfidence: 99.2,
        cvModel: 'YOLOv11x + SAM Flood Segmenter',
        hospitalProximityMeters: 90,
        hospitalName: 'City General Government Hospital',
        roadClassification: 'Primary Arterial Corridor',
        duplicateComplaintsCount: 18,
        estimatedDailyTraffic: 18200,
        historicalFailureRate: 84,
        weatherRiskFactor: 'Critical Monsoon Precipitation Risk',
      },
    };

    setMapCenter([newInc.lat, newInc.lng]);
    setMapZoom(16);
    setSelectedMapIncident(newInc);

    if ('speechSynthesis' in window) {
      try {
        const utterance = new SpeechSynthesisUtterance('New Critical Incident Detected on Victoria Hospital Corridor.');
        utterance.rate = 1.0;
        utterance.pitch = 1.0;
        window.speechSynthesis.speak(utterance);
      } catch (_) {}
    }
  };

  // ── Navigation Polyline route coordinates ──
  const routePoints = useMemo<[number, number][] | null>(() => {
    if (!navigationTarget) return null;
    return [
      [OFFICER_UNIT.lat, OFFICER_UNIT.lng],
      [(OFFICER_UNIT.lat + navigationTarget.lat) / 2 + 0.002, (OFFICER_UNIT.lng + navigationTarget.lng) / 2 - 0.002],
      [navigationTarget.lat, navigationTarget.lng],
    ];
  }, [navigationTarget]);

  // ── Auto-Focus Camera & Open Card when a NEW incident is added to shared state ──
  useEffect(() => {
    if (incidents.length > 0) {
      const latestInc = incidents[0]; // newest incident is prepended at index 0
      // Check if this incident was recently added (e.g. within 30 seconds of current date)
      if (latestInc && selectedMapIncident?.id !== latestInc.id) {
        setSelectedMapIncident(latestInc);
        setMapCenter([latestInc.lat, latestInc.lng]);
        setMapZoom(16);
      }
    }
  }, [incidents]);

  return (
    <div style={{
      width: '100%',
      height: 'calc(100vh - 160px)',
      minHeight: '740px',
      position: 'relative',
      overflow: 'hidden',
      background: '#070B14',
      borderRadius: 24,
      border: '1px solid rgba(0, 212, 255, 0.2)',
      boxShadow: '0 12px 40px rgba(0, 0, 0, 0.5)',
    }}>
      
      {/* ── LOADING OVERLAY ── */}
      <AnimatePresence>
        {isMapLoading && (
          <motion.div
            initial={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.4 }}
            style={{
              position: 'absolute',
              inset: 0,
              zIndex: 2000,
              background: 'rgba(7, 11, 20, 0.95)',
              backdropFilter: 'blur(20px)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 16,
            }}
          >
            <div style={{
              width: 56,
              height: 56,
              borderRadius: '50%',
              background: 'rgba(0, 212, 255, 0.1)',
              border: '1px solid rgba(0, 212, 255, 0.3)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}>
              <Loader2 size={28} color="#00D4FF" className="animate-spin" />
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontFamily: 'var(--font-heading)', fontSize: 16, fontWeight: 700, color: '#F8FAFC' }}>
                Initializing GIS Command Center Map…
              </div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: '#00D4FF', marginTop: 4 }}>
                Loading CartoDB Dark Vector Canvas & Layer Engine
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── LEAFLET BASE MAP CONTAINER ── */}
      <MapContainer
        center={mapCenter}
        zoom={mapZoom}
        style={{ width: '100%', height: '100%', background: '#070B14' }}
        zoomControl={false}
      >
        <MapController center={mapCenter} zoom={mapZoom} onLoaded={() => setIsMapLoading(false)} />

        {/* Primary Tile Layer: CartoDB Dark Matter / Fallback: OpenStreetMap */}
        <TileLayer
          url={tileError ? "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" : "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"}
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/">CARTO</a>'
          eventHandlers={{
            tileerror: () => {
              console.warn('CartoDB tile loading warning. Falling back to OpenStreetMap standard tiles.');
              setTileError(true);
            },
          }}
        />

        {/* ── LAYER 1: Ward Boundaries Polygons ── */}
        {layers.wardBoundaries && wards.map(ward => (
          <Polygon
            key={ward.id}
            positions={[
              [ward.lat + 0.012, ward.lng - 0.012],
              [ward.lat + 0.012, ward.lng + 0.012],
              [ward.lat - 0.012, ward.lng + 0.012],
              [ward.lat - 0.012, ward.lng - 0.012],
            ]}
            pathOptions={{
              color: ward.overallScore < 70 ? '#EF4444' : '#00D4FF',
              weight: 1.5,
              dashArray: '4, 6',
              fillColor: ward.overallScore < 70 ? '#EF4444' : '#00D4FF',
              fillOpacity: 0.04,
            }}
          >
            <Tooltip permanent direction="center" opacity={0.7}>
              <div style={{ color: '#00D4FF', fontSize: 10, fontFamily: 'var(--font-mono)', fontWeight: 700 }}>
                {ward.code} · Health {ward.overallScore}/100
              </div>
            </Tooltip>
          </Polygon>
        ))}

        {/* ── LAYER 2: Dynamic Spatial Infrastructure Discovery Engine ── */}
        {(layers.hospitals || layers.schools || layers.govtBuildings) &&
          (gisIntel?.infrastructure || []).map((asset) => (
            <React.Fragment key={asset.id}>
              {asset.category === 'hospital' && (
                <Circle
                  center={[asset.lat, asset.lng]}
                  radius={600}
                  pathOptions={{ color: '#EF4444', fillColor: '#EF4444', fillOpacity: 0.06, weight: 1, dashArray: '3, 5' }}
                />
              )}
              <CircleMarker
                center={[asset.lat, asset.lng]}
                radius={8}
                pathOptions={{
                  color: asset.criticality === 'CRITICAL' ? '#EF4444' : asset.criticality === 'HIGH' ? '#F59E0B' : '#00D4FF',
                  fillColor: asset.criticality === 'CRITICAL' ? '#EF4444' : asset.criticality === 'HIGH' ? '#F59E0B' : '#00D4FF',
                  fillOpacity: 0.9,
                  weight: 2,
                }}
                eventHandlers={{
                  click: () => {
                    setMapCenter([asset.lat, asset.lng]);
                    setMapZoom(16);
                  },
                }}
              >
                <Tooltip direction="top" opacity={0.95}>
                  <div style={{ background: '#111827', padding: '6px 10px', borderRadius: 8, border: '1px solid rgba(0,212,255,0.3)', color: '#F8FAFC' }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: '#00D4FF' }}>
                      {asset.icon} {asset.name}
                    </div>
                    <div style={{ fontSize: 10, color: '#94A3B8', marginTop: 2 }}>
                      Distance: <strong style={{ color: '#F8FAFC' }}>{asset.distanceMeters}m</strong> · ETA: <strong style={{ color: '#10B981' }}>{asset.etaMins} mins</strong>
                    </div>
                    <div style={{ fontSize: 9, color: asset.criticality === 'CRITICAL' ? '#EF4444' : '#F59E0B', fontWeight: 800, marginTop: 2 }}>
                      CRITICALITY: {asset.criticality}
                    </div>
                  </div>
                </Tooltip>
              </CircleMarker>
            </React.Fragment>
          ))}

        {/* ── LAYER 3: Heatmap Density Overlays ── */}
        {layers.heatmap && incidents.map(inc => {
          const baseRadius = inc.severity === 'critical' ? 700 : 400;
          const color = heatmapType === 'flood' ? '#3B82F6' : heatmapType === 'garbage' ? '#F59E0B' : '#EF4444';
          return (
            <React.Fragment key={`heat-${inc.id}`}>
              <Circle center={[inc.lat, inc.lng]} radius={baseRadius * 0.25} pathOptions={{ color, fillColor: color, fillOpacity: 0.6, weight: 0 }} />
              <Circle center={[inc.lat, inc.lng]} radius={baseRadius * 0.6} pathOptions={{ color, fillColor: color, fillOpacity: 0.3, weight: 0 }} />
              <Circle center={[inc.lat, inc.lng]} radius={baseRadius} pathOptions={{ color, fillColor: color, fillOpacity: 0.1, weight: 0 }} />
            </React.Fragment>
          );
        })}

        {/* ── LAYER 3.5: Real-Time Traffic & Emergency Route Overlay ── */}
        {(layers.traffic || selectedMapIncident) && (gisIntel?.traffic?.trafficCorridors || []).map(route => (
          <Polyline
            key={route.id}
            positions={route.positions}
            pathOptions={{
              color: route.congestionLevel === 'SEVERE' ? '#EF4444' : route.congestionLevel === 'HIGH' ? '#F97316' : '#EAB308',
              weight: route.congestionLevel === 'SEVERE' ? 5 : 4,
              opacity: 0.85,
            }}
          >
            <Tooltip sticky>
              <div style={{ color: '#00D4FF', fontWeight: 700, fontSize: 11 }}>
                Traffic Corridor: <span style={{ color: route.congestionLevel === 'SEVERE' ? '#EF4444' : '#F97316' }}>{route.congestionLevel}</span> ({route.averageSpeedKmh} km/h)
              </div>
            </Tooltip>
          </Polyline>
        ))}

        {/* Dynamic Emergency Vehicle Priority Route */}
        {gisIntel?.traffic?.emergencyRouteCoordinates && (
          <Polyline
            positions={gisIntel.traffic.emergencyRouteCoordinates}
            pathOptions={{ color: '#10B981', weight: 4, opacity: 0.9, dashArray: '8, 8' }}
          >
            <Tooltip sticky>
              <div style={{ color: '#10B981', fontWeight: 700, fontSize: 11 }}>
                🚑 {gisIntel.traffic.suggestedRouteName}
              </div>
            </Tooltip>
          </Polyline>
        )}

        {/* ── LAYER 4: Navigation Route (Officer to Incident) ── */}
        {routePoints && (
          <Polyline
            positions={routePoints}
            pathOptions={{ color: '#00D4FF', weight: 4, opacity: 0.85, dashArray: '6, 8' }}
          />
        )}

        {/* ── LAYER 5: Officer Unit Location Marker ── */}
        {navigationTarget && (
          <CircleMarker
            center={[OFFICER_UNIT.lat, OFFICER_UNIT.lng]}
            radius={10}
            pathOptions={{ color: '#00D4FF', fillColor: '#00D4FF', fillOpacity: 1, weight: 3 }}
          >
            <Tooltip permanent direction="top">
              <div style={{ fontSize: 11, fontWeight: 700, color: '#00D4FF' }}>
                🚚 {OFFICER_UNIT.name}
              </div>
            </Tooltip>
          </CircleMarker>
        )}

        {/* ── LAYER 6: Incident Markers (Pulsing glowing circles) ── */}
        {incidents.map(inc => {
          const color = SEVERITY_COLORS[inc.severity] || '#00D4FF';
          const isSelected = selectedMapIncident?.id === inc.id;

          return (
            <React.Fragment key={inc.id}>
              {/* Outer pulsing ring */}
              <Circle
                center={[inc.lat, inc.lng]}
                radius={isSelected ? 180 : 80}
                pathOptions={{
                  color,
                  fillColor: color,
                  fillOpacity: isSelected ? 0.25 : 0.12,
                  weight: isSelected ? 2 : 1,
                }}
              />
              {/* Inner core marker */}
              <CircleMarker
                center={[inc.lat, inc.lng]}
                radius={isSelected ? 11 : 8}
                pathOptions={{
                  color: '#fff',
                  fillColor: color,
                  fillOpacity: 1,
                  weight: isSelected ? 3 : 2,
                }}
                eventHandlers={{
                  click: () => {
                    setSelectedMapIncident(inc);
                    setMapCenter([inc.lat, inc.lng]);
                  },
                }}
              >
                {/* 6 Required Marker Tooltip Fields */}
                <Tooltip direction="top" offset={[0, -10]}>
                  <div style={{ background: 'rgba(7,11,20,0.92)', color: '#F8FAFC', padding: '8px 12px', borderRadius: 10, fontSize: 11, fontWeight: 600, border: `1px solid ${color}44` }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, marginBottom: 4 }}>
                      <span style={{ color: '#00D4FF', fontFamily: 'var(--font-mono)', fontWeight: 700 }}>{inc.id}</span>
                      <span style={{ color, textTransform: 'uppercase', fontWeight: 700 }}>{inc.severity}</span>
                    </div>
                    <div style={{ color: '#F8FAFC', fontWeight: 700, fontSize: 12, marginBottom: 4 }}>
                      {inc.title} ({inc.type.replace('_', ' ')})
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, fontSize: 10, color: '#94A3B8', borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: 4 }}>
                      <div>Priority: <strong style={{ color: '#00D4FF' }}>{inc.priorityScore}/100</strong></div>
                      <div>Status: <strong style={{ color: inc.status === 'resolved' ? '#10B981' : '#F59E0B' }}>{inc.status}</strong></div>
                      <div>AI Conf: <strong style={{ color: '#10B981' }}>{inc.xai.cvConfidence}%</strong></div>
                      <div>Type: <strong style={{ color: '#F8FAFC' }}>{inc.type}</strong></div>
                    </div>
                  </div>
                </Tooltip>
              </CircleMarker>
            </React.Fragment>
          );
        })}
      </MapContainer>

      {/* ── FLOATING TOP CONTROLS BAR (Search & Mode Switch) ── */}
      <div style={{
        position: 'absolute',
        top: 20,
        left: 20,
        right: 20,
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: 12,
        pointerEvents: 'none',
      }}>
        {/* Search Bar Container */}
        <div style={{ pointerEvents: 'auto', flex: '1 1 320px', maxWidth: 460, position: 'relative' }}>
          <div style={{
            background: 'rgba(17, 24, 39, 0.85)',
            backdropFilter: 'blur(20px)',
            border: '1px solid rgba(0, 212, 255, 0.3)',
            borderRadius: 16,
            padding: '10px 16px',
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)',
          }}>
            <Search size={18} color="#00D4FF" />
            <input
              type="text"
              placeholder="Search location, Complaint ID, or Ward..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{
                background: 'none',
                border: 'none',
                color: '#F8FAFC',
                fontFamily: 'var(--font-body)',
                fontSize: 13,
                outline: 'none',
                width: '100%',
              }}
            />
            {searchTerm && (
              <button onClick={() => setSearchTerm('')} style={{ background: 'none', border: 'none', color: '#94A3B8', cursor: 'pointer' }}>
                <X size={16} />
              </button>
            )}
          </div>

          {/* Search Auto-Complete Dropdown */}
          <AnimatePresence>
            {searchSuggestions.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 6 }}
                style={{
                  position: 'absolute',
                  top: '100%',
                  left: 0,
                  right: 0,
                  marginTop: 8,
                  background: 'rgba(17, 24, 39, 0.95)',
                  backdropFilter: 'blur(24px)',
                  border: '1px solid rgba(0, 212, 255, 0.3)',
                  borderRadius: 16,
                  overflow: 'hidden',
                  zIndex: 1005,
                }}
              >
                {searchSuggestions.map((inc) => (
                  <div
                    key={inc.id}
                    onClick={() => handleSelectSearchResult(inc)}
                    style={{
                      padding: '12px 16px',
                      borderBottom: '1px solid rgba(255,255,255,0.06)',
                      cursor: 'pointer',
                      fontSize: 12,
                      transition: 'background 0.2s',
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(0,212,255,0.1)'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', color: '#00D4FF', fontWeight: 700, fontFamily: 'var(--font-mono)' }}>
                      <span>{inc.id}</span>
                      <span>Score {inc.priorityScore}</span>
                    </div>
                    <div style={{ color: '#F8FAFC', fontWeight: 600, marginTop: 2 }}>{inc.title}</div>
                    <div style={{ color: '#64748B', marginTop: 2 }}>{inc.address}</div>
                  </div>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Top-Right Mode Buttons & Layer Toggle */}
        <div style={{ pointerEvents: 'auto', display: 'flex', alignItems: 'center', gap: 10 }}>
          {/* Live Trigger Simulator */}
          <button
            onClick={handleSimulateNewIncident}
            style={{
              padding: '10px 16px',
              background: 'linear-gradient(135deg, #EF4444, #DC2626)',
              color: '#fff',
              border: 'none',
              borderRadius: 14,
              fontWeight: 700,
              fontSize: 12,
              fontFamily: 'var(--font-body)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              boxShadow: '0 4px 16px rgba(239, 68, 68, 0.4)',
            }}
          >
            <Radio size={15} />
            Simulate New Incident
          </button>

          {/* Layer Panel Button */}
          <button
            onClick={() => setShowLayerPanel(!showLayerPanel)}
            style={{
              padding: '10px 16px',
              background: showLayerPanel ? '#00D4FF' : 'rgba(17, 24, 39, 0.85)',
              color: showLayerPanel ? '#000' : '#F8FAFC',
              border: '1px solid rgba(0, 212, 255, 0.3)',
              borderRadius: 14,
              fontWeight: 700,
              fontSize: 12,
              fontFamily: 'var(--font-body)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              backdropFilter: 'blur(20px)',
            }}
          >
            <Layers size={15} />
            GIS Layers ({Object.values(layers).filter(Boolean).length})
          </button>
        </div>
      </div>

      {/* ── FLOATING GLASS INCIDENT CARD (Left Bottom) ── */}
      <AnimatePresence>
        {selectedMapIncident && (
          <motion.div
            initial={{ opacity: 0, y: 30, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 30, scale: 0.95 }}
            transition={{ duration: 0.3 }}
            style={{
              position: 'absolute',
              bottom: 24,
              left: 20,
              width: 380,
              maxHeight: '80vh',
              overflowY: 'auto',
              zIndex: 1000,
              background: 'rgba(17, 24, 39, 0.92)',
              backdropFilter: 'blur(28px)',
              border: '1px solid rgba(0, 212, 255, 0.3)',
              borderLeft: `4px solid ${SEVERITY_COLORS[selectedMapIncident.severity]}`,
              borderRadius: 24,
              padding: 20,
              boxShadow: '0 20px 50px rgba(0, 0, 0, 0.6)',
            }}
          >
            {/* Header & Close */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
              <div>
                <span style={{
                  padding: '3px 8px',
                  borderRadius: 6,
                  background: `${SEVERITY_COLORS[selectedMapIncident.severity]}20`,
                  color: SEVERITY_COLORS[selectedMapIncident.severity],
                  fontSize: 10,
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  fontFamily: 'var(--font-mono)',
                  marginRight: 8,
                }}>
                  {selectedMapIncident.severity}
                </span>
                <span style={{ color: '#00D4FF', fontSize: 11, fontFamily: 'var(--font-mono)', fontWeight: 700 }}>
                  {selectedMapIncident.id}
                </span>
              </div>
              <button
                onClick={() => setSelectedMapIncident(null)}
                style={{ background: 'none', border: 'none', color: '#94A3B8', cursor: 'pointer', padding: 2 }}
              >
                <X size={18} />
              </button>
            </div>

            {/* Thumbnail */}
            <div style={{ height: 130, borderRadius: 14, overflow: 'hidden', marginBottom: 14, position: 'relative' }}>
              <img src={selectedMapIncident.photoUrl} alt={selectedMapIncident.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              <div style={{ position: 'absolute', bottom: 8, right: 8, background: 'rgba(7,11,20,0.85)', padding: '2px 8px', borderRadius: 6, color: '#10B981', fontSize: 10, fontFamily: 'var(--font-mono)', fontWeight: 700 }}>
                CV Confidence {selectedMapIncident.xai.cvConfidence}%
              </div>
            </div>

            {/* Title & Address */}
            <h4 style={{ fontFamily: 'var(--font-heading)', fontSize: 16, fontWeight: 700, color: '#F8FAFC', margin: '0 0 6px 0' }}>
              {selectedMapIncident.title}
            </h4>
            <div style={{ fontSize: 12, color: '#94A3B8', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 4 }}>
              <MapPin size={13} color="#00D4FF" />
              {selectedMapIncident.address}
            </div>

            {/* Metadata Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, fontSize: 11, padding: 12, background: 'rgba(255,255,255,0.03)', borderRadius: 12, marginBottom: 12 }}>
              <div>
                <div style={{ color: '#64748B' }}>Priority & Risk Score</div>
                <div style={{ color: '#00D4FF', fontWeight: 700, fontFamily: 'var(--font-mono)', fontSize: 13 }}>{selectedMapIncident.priorityScore}/100</div>
              </div>
              <div>
                <div style={{ color: '#64748B' }}>Est. Repair Cost</div>
                <div style={{ color: '#F8FAFC', fontWeight: 700, fontFamily: 'var(--font-mono)', fontSize: 13 }}>₹{selectedMapIncident.estimatedRepairCost.toLocaleString()}</div>
              </div>
              <div>
                <div style={{ color: '#64748B' }}>Department</div>
                <div style={{ color: '#F8FAFC', fontWeight: 600 }}>{DEPARTMENTS_MAP[selectedMapIncident.type] || 'Municipal Works'}</div>
              </div>
              <div>
                <div style={{ color: '#64748B' }}>Status</div>
                <div style={{ color: selectedMapIncident.status === 'resolved' ? '#10B981' : '#F59E0B', fontWeight: 700, textTransform: 'capitalize' }}>{selectedMapIncident.status.replace('_', ' ')}</div>
              </div>
            </div>

            {/* Dynamic Weather & Traffic GIS Intelligence */}
            {gisIntel && (
              <>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, fontSize: 10, marginBottom: 12 }}>
                  <div style={{ background: 'rgba(0,212,255,0.05)', padding: 8, borderRadius: 8, border: '1px solid rgba(0,212,255,0.15)' }}>
                    <div style={{ color: '#00D4FF', fontWeight: 700 }}>🌦️ WEATHER INTELLIGENCE</div>
                    <div style={{ color: '#F8FAFC', marginTop: 2 }}>
                      Rain: <strong>{gisIntel.weather.rainfall} mm/hr</strong> · <strong>{gisIntel.weather.temperature}°C</strong>
                    </div>
                    <div style={{ color: gisIntel.weather.isRaining ? '#EF4444' : '#10B981', fontWeight: 700, marginTop: 2 }}>
                      Flood Risk: {gisIntel.weather.floodRisk}
                    </div>
                  </div>

                  <div style={{ background: 'rgba(139,92,246,0.05)', padding: 8, borderRadius: 8, border: '1px solid rgba(139,92,246,0.15)' }}>
                    <div style={{ color: '#8B5CF6', fontWeight: 700 }}>🚦 TRAFFIC INTELLIGENCE</div>
                    <div style={{ color: '#F8FAFC', marginTop: 2 }}>{gisIntel.traffic.trafficDensity}</div>
                    <div style={{ color: '#F59E0B', fontWeight: 700, marginTop: 2 }}>
                      Delay: +{gisIntel.traffic.emergencyDelayMins}m ({gisIntel.traffic.roadCongestionPct}% Congested)
                    </div>
                  </div>
                </div>

                {/* Explainable AI (XAI) Risk Engine Breakdown */}
                <div style={{ background: 'rgba(239, 68, 68, 0.08)', border: '1px solid rgba(239, 68, 68, 0.25)', padding: 10, borderRadius: 12, marginBottom: 12 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                    <span style={{ fontSize: 10, fontWeight: 800, color: '#EF4444', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      🧠 EXPLAINABLE AI (XAI) RISK SCORE
                    </span>
                    <span style={{ fontSize: 13, fontFamily: 'var(--font-mono)', fontWeight: 800, color: '#EF4444' }}>
                      {gisIntel.xaiRisk.totalRiskScore} / 100
                    </span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 10 }}>
                    {gisIntel.xaiRisk.breakdown.map((item, i) => (
                      <div key={i} style={{ display: 'flex', justifyContent: 'space-between', color: '#94A3B8' }}>
                        <span>{item.icon} {item.factor}</span>
                        <strong style={{ color: '#F8FAFC', fontFamily: 'var(--font-mono)' }}>+{item.points}</strong>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Dynamic Nearby Infrastructure Proximity */}
                <div style={{ background: 'rgba(255,255,255,0.03)', padding: 10, borderRadius: 12, marginBottom: 14 }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: '#94A3B8', marginBottom: 6, textTransform: 'uppercase' }}>
                    Discovered Nearby Infrastructure
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, fontSize: 10 }}>
                    {gisIntel.infrastructure.slice(0, 4).map((asset) => (
                      <div
                        key={asset.id}
                        onClick={() => {
                          setMapCenter([asset.lat, asset.lng]);
                          setMapZoom(16);
                        }}
                        style={{
                          background: 'rgba(255,255,255,0.04)',
                          padding: 6,
                          borderRadius: 6,
                          cursor: 'pointer',
                          border: '1px solid rgba(255,255,255,0.06)',
                        }}
                      >
                        <div style={{ color: '#F8FAFC', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {asset.icon} {asset.name}
                        </div>
                        <div style={{ color: '#00D4FF', fontSize: 9, marginTop: 2 }}>
                          {asset.distanceMeters}m · ETA {asset.etaMins}m
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}

            {/* Action Buttons */}
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={() => onSelectIncident(selectedMapIncident)}
                style={{
                  flex: 1,
                  padding: '9px 12px',
                  background: 'linear-gradient(135deg, #00D4FF, #0EA5E9)',
                  color: '#000',
                  border: 'none',
                  borderRadius: 10,
                  fontWeight: 700,
                  fontSize: 12,
                  cursor: 'pointer',
                }}
              >
                View Details
              </button>

              <button
                onClick={() => setNavigationTarget(selectedMapIncident)}
                style={{
                  flex: 1,
                  padding: '9px 12px',
                  background: 'rgba(139, 92, 246, 0.15)',
                  border: '1px solid rgba(139, 92, 246, 0.3)',
                  color: '#8B5CF6',
                  borderRadius: 10,
                  fontWeight: 700,
                  fontSize: 12,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 4,
                }}
              >
                <Navigation size={13} />
                Navigate
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── RIGHT LAYER CONTROL DRAWER ── */}
      <AnimatePresence>
        {showLayerPanel && (
          <motion.div
            initial={{ opacity: 0, x: 40 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 40 }}
            style={{
              position: 'absolute',
              top: 76,
              right: 20,
              width: 300,
              maxHeight: '75vh',
              overflowY: 'auto',
              zIndex: 1000,
              background: 'rgba(17, 24, 39, 0.94)',
              backdropFilter: 'blur(28px)',
              border: '1px solid rgba(0, 212, 255, 0.3)',
              borderRadius: 20,
              padding: 18,
              boxShadow: '0 20px 50px rgba(0, 0, 0, 0.5)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <span style={{ fontFamily: 'var(--font-heading)', fontSize: 14, fontWeight: 700, color: '#F8FAFC' }}>
                Smart City Layers
              </span>
              <button onClick={() => setShowLayerPanel(false)} style={{ background: 'none', border: 'none', color: '#94A3B8', cursor: 'pointer' }}>
                <X size={16} />
              </button>
            </div>

            {/* 11 Layers List */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 12 }}>
              {[
                { key: 'roads', label: 'Arterial Road Network', icon: '🛣️' },
                { key: 'drainage', label: 'Drainage & Stormwater', icon: '🌊' },
                { key: 'garbage', label: 'Solid Waste Hotspots', icon: '🗑️' },
                { key: 'streetlights', label: 'Streetlight Grid', icon: '💡' },
                { key: 'waterPipelines', label: 'Water Supply Pipelines', icon: '🚰' },
                { key: 'hospitals', label: 'Hospital Proximity Radii', icon: '🏥' },
                { key: 'schools', label: 'Schools & Safety Zones', icon: '🏫' },
                { key: 'wardBoundaries', label: 'Ward GIS Boundaries', icon: '🗺️' },
                { key: 'govtBuildings', label: 'Govt & Municipal HQ', icon: '🏛️' },
                { key: 'traffic', label: 'Traffic Congestion Corridors', icon: '🚦' },
                { key: 'heatmap', label: 'Animated Incident Heatmap', icon: '🔥' },
              ].map((l) => {
                const isActive = layers[l.key as keyof typeof layers];
                return (
                  <div
                    key={l.key}
                    onClick={() => toggleLayer(l.key as any)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '8px 12px',
                      borderRadius: 10,
                      background: isActive ? 'rgba(0, 212, 255, 0.1)' : 'rgba(255,255,255,0.03)',
                      border: isActive ? '1px solid rgba(0, 212, 255, 0.3)' : '1px solid transparent',
                      color: isActive ? '#00D4FF' : '#94A3B8',
                      cursor: 'pointer',
                      fontWeight: isActive ? 700 : 500,
                    }}
                  >
                    <span>{l.icon} {l.label}</span>
                    <span style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: isActive ? '#10B981' : '#475569' }}>
                      {isActive ? 'ON' : 'OFF'}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Heatmap Sub-selector if Heatmap ON */}
            {layers.heatmap && (
              <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid rgba(255,255,255,0.08)' }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#F8FAFC', marginBottom: 8 }}>Heatmap Sub-Type</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                  {[
                    { id: 'road', label: 'Road Damage' },
                    { id: 'garbage', label: 'Garbage' },
                    { id: 'flood', label: 'Flood Risk' },
                    { id: 'water', label: 'Water Leak' },
                  ].map((h) => (
                    <button
                      key={h.id}
                      onClick={() => setHeatmapType(h.id as any)}
                      style={{
                        padding: 6,
                        borderRadius: 6,
                        background: heatmapType === h.id ? '#00D4FF' : 'rgba(255,255,255,0.04)',
                        color: heatmapType === h.id ? '#000' : '#94A3B8',
                        border: 'none',
                        fontSize: 11,
                        fontWeight: 600,
                        cursor: 'pointer',
                      }}
                    >
                      {h.label}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── FUTURE-READY SMART CITY BADGES (Bottom Right Floating) ── */}
      <div style={{
        position: 'absolute',
        bottom: 24,
        right: 20,
        zIndex: 1000,
        display: 'flex',
        gap: 8,
        flexWrap: 'wrap',
      }}>
        {[
          { id: 'iot', label: 'IoT Sensors', icon: <Wifi size={13} /> },
          { id: 'drone', label: 'Drone Feeds', icon: <Radio size={13} /> },
          { id: 'satellite', label: 'Satellite SAR', icon: <Compass size={13} /> },
          { id: 'weather', label: 'Radar Weather', icon: <Activity size={13} /> },
        ].map((badge) => (
          <button
            key={badge.id}
            onClick={() => setActiveFutureLayer(activeFutureLayer === badge.id ? null : badge.id as any)}
            style={{
              padding: '8px 12px',
              borderRadius: 999,
              background: activeFutureLayer === badge.id ? 'rgba(0, 212, 255, 0.2)' : 'rgba(17, 24, 39, 0.85)',
              border: activeFutureLayer === badge.id ? '1px solid #00D4FF' : '1px solid rgba(255,255,255,0.1)',
              color: activeFutureLayer === badge.id ? '#00D4FF' : '#94A3B8',
              fontSize: 11,
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              backdropFilter: 'blur(16px)',
            }}
          >
            {badge.icon}
            {badge.label}
          </button>
        ))}
      </div>

    </div>
  );
};
