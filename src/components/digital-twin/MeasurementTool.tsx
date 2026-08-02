import React from 'react';
import { Ruler, Maximize2, Trash2, HelpCircle } from 'lucide-react';
import type { MeasurementMode } from './types';

interface MeasurementToolProps {
  mode: MeasurementMode;
  onSetMode: (mode: MeasurementMode) => void;
  pointsCount: number;
  distanceMeters: number;
  areaSqMeters: number;
  onClear: () => void;
}

// ── Geodesic Mathematical Utility Functions ──

export function calculateGeodesicDistance(coord1: [number, number], coord2: [number, number]): number {
  const R = 6371000;
  const [lng1, lat1] = coord1;
  const [lng2, lat2] = coord2;

  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export function calculateTotalPathDistance(points: [number, number][]): number {
  if (points.length < 2) return 0;
  let total = 0;
  for (let i = 0; i < points.length - 1; i++) {
    total += calculateGeodesicDistance(points[i], points[i + 1]);
  }
  return total;
}

export function calculateGeodesicArea(coords: [number, number][]): number {
  if (coords.length < 3) return 0;
  const R = 6371000;
  let totalAngle = 0;

  for (let i = 0; i < coords.length; i++) {
    const p1 = coords[i];
    const p2 = coords[(i + 1) % coords.length];
    const p3 = coords[(i + 2) % coords.length];

    const bearing1 = calculateBearing(p2, p1);
    const bearing2 = calculateBearing(p2, p3);
    let angle = bearing2 - bearing1;
    if (angle < 0) angle += 360;

    totalAngle += angle;
  }

  const n = coords.length;
  const sphericalExcess = ((totalAngle - (n - 2) * 180) * Math.PI) / 180;
  const areaM2 = Math.abs(sphericalExcess * R * R);
  return areaM2;
}

function calculateBearing(start: [number, number], end: [number, number]): number {
  const startLat = (start[1] * Math.PI) / 180;
  const startLng = (start[0] * Math.PI) / 180;
  const endLat = (end[1] * Math.PI) / 180;
  const endLng = (end[0] * Math.PI) / 180;

  const dLng = endLng - startLng;
  const y = Math.sin(dLng) * Math.cos(endLat);
  const x = Math.cos(startLat) * Math.sin(endLat) - Math.sin(startLat) * Math.cos(endLat) * Math.cos(dLng);
  const brng = (Math.atan2(y, x) * 180) / Math.PI;
  return (brng + 360) % 360;
}

export function formatDistance(meters: number): string {
  if (meters >= 1000) {
    return `${(meters / 1000).toFixed(2)} km`;
  }
  return `${Math.round(meters)} m`;
}

export function formatArea(sqMeters: number): string {
  if (sqMeters >= 1000000) {
    return `${(sqMeters / 1000000).toFixed(2)} km²`;
  }
  if (sqMeters >= 10000) {
    return `${(sqMeters / 10000).toFixed(2)} ha`;
  }
  return `${Math.round(sqMeters)} m²`;
}

// ── UI Component ──

export const MeasurementTool: React.FC<MeasurementToolProps> = ({
  mode,
  onSetMode,
  pointsCount,
  distanceMeters,
  areaSqMeters,
  onClear,
}) => {
  return (
    <div style={{ position: 'relative', zIndex: 30, fontFamily: "'Inter', sans-serif" }}>
      {/* Measurement Toolbar Bar */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '4px',
        backgroundColor: 'rgba(17,24,39,0.85)',
        backdropFilter: 'blur(20px)',
        border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: '16px',
        padding: '4px',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
        fontSize: '12px',
        color: '#F8FAFC'
      }}>
        {/* Mode: Distance */}
        <button
          onClick={() => onSetMode(mode === 'distance' ? 'none' : 'distance')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            padding: '6px 12px',
            borderRadius: '12px',
            transition: 'all 200ms',
            fontWeight: 500,
            backgroundColor: mode === 'distance' ? 'rgba(245, 158, 11, 0.2)' : 'transparent',
            color: mode === 'distance' ? '#F59E0B' : '#F8FAFC',
            border: mode === 'distance' ? '1px solid rgba(245, 158, 11, 0.4)' : '1px solid transparent',
            boxShadow: mode === 'distance' ? '0 1px 2px 0 rgba(0, 0, 0, 0.05)' : 'none',
            cursor: 'pointer'
          }}
          title="Measure Geodesic Distance (Haversine Formula)"
        >
          <Ruler size={16} color="#F59E0B" />
          <span>Distance</span>
        </button>

        {/* Mode: Area */}
        <button
          onClick={() => onSetMode(mode === 'area' ? 'none' : 'area')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            padding: '6px 12px',
            borderRadius: '12px',
            transition: 'all 200ms',
            fontWeight: 500,
            backgroundColor: mode === 'area' ? 'rgba(245, 158, 11, 0.2)' : 'transparent',
            color: mode === 'area' ? '#F59E0B' : '#F8FAFC',
            border: mode === 'area' ? '1px solid rgba(245, 158, 11, 0.4)' : '1px solid transparent',
            boxShadow: mode === 'area' ? '0 1px 2px 0 rgba(0, 0, 0, 0.05)' : 'none',
            cursor: 'pointer'
          }}
          title="Measure Polygon Area (Girard Spherical Excess)"
        >
          <Maximize2 size={16} color="#F59E0B" />
          <span>Area</span>
        </button>

        {/* Clear Button */}
        {mode !== 'none' && (
          <button
            onClick={onClear}
            style={{
              padding: '6px',
              color: '#94A3B8',
              backgroundColor: 'transparent',
              borderRadius: '12px',
              transition: 'colors 200ms',
              border: 'none',
              cursor: 'pointer'
            }}
            title="Clear Measurement Points"
          >
            <Trash2 size={16} />
          </button>
        )}
      </div>

      {/* Active Measurement Results HUD Overlay Card */}
      {mode !== 'none' && (
        <div style={{
          position: 'absolute',
          top: '44px',
          left: 0,
          width: '256px',
          backgroundColor: 'rgba(17,24,39,0.95)',
          backdropFilter: 'blur(24px)',
          border: '1px solid rgba(245, 158, 11, 0.4)',
          borderRadius: '16px',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
          padding: '12px',
          zIndex: 40,
          color: '#F8FAFC'
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderBottom: '1px solid rgba(255,255,255,0.08)',
            paddingBottom: '6px',
            marginBottom: '8px'
          }}>
            <span style={{
              fontSize: '11px',
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              color: '#F59E0B',
              display: 'flex',
              alignItems: 'center',
              gap: '4px'
            }}>
              <Ruler size={14} />
              {mode === 'distance' ? 'Geodesic Distance' : 'Spherical Area'}
            </span>
            <span style={{
              fontSize: '10px',
              fontFamily: "'IBM Plex Mono', monospace",
              padding: '2px 6px',
              borderRadius: '4px',
              backgroundColor: 'rgba(245, 158, 11, 0.1)',
              color: '#F59E0B',
              border: '1px solid rgba(245, 158, 11, 0.3)'
            }}>
              {pointsCount} vertices
            </span>
          </div>

          {/* Measured Output Display */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {mode === 'distance' && (
              <div>
                <div style={{ fontSize: '10px', color: '#94A3B8' }}>Total Path Length</div>
                <div style={{ fontSize: '20px', fontFamily: "'IBM Plex Mono', monospace", fontWeight: 700, color: '#F59E0B' }}>{formatDistance(distanceMeters)}</div>
              </div>
            )}

            {mode === 'area' && (
              <div>
                <div style={{ fontSize: '10px', color: '#94A3B8' }}>Enclosed Geodesic Surface Area</div>
                <div style={{ fontSize: '20px', fontFamily: "'IBM Plex Mono', monospace", fontWeight: 700, color: '#F59E0B' }}>{formatArea(areaSqMeters)}</div>
                <div style={{ fontSize: '10px', color: '#94A3B8', marginTop: '4px' }}>Perimeter: {formatDistance(distanceMeters)}</div>
              </div>
            )}

            {/* Helper Instructions */}
            <div style={{
              paddingTop: '8px',
              borderTop: '1px solid rgba(255,255,255,0.08)',
              fontSize: '10px',
              color: '#94A3B8',
              display: 'flex',
              alignItems: 'center',
              gap: '4px'
            }}>
              <HelpCircle size={12} color="#94A3B8" style={{ flexShrink: 0 }} />
              <span>
                {pointsCount === 0
                  ? 'Click anywhere on the map to add first vertex'
                  : 'Click on map to add points. Double-click or click finish.'}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
