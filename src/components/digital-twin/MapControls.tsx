import React, { useState } from 'react';
import {
  Compass,
  RotateCw,
  Box,
  MapPin,
  LocateFixed,
  Plus,
  Minus,
  Map as MapIcon,
  Navigation,
  Sparkles,
} from 'lucide-react';
import type { MapStyleId, LandmarkPreset } from './types';
import { MAP_STYLE_OPTIONS } from './mapStyles';
import { LANDMARK_PRESETS } from './mockGisData';

interface MapControlsProps {
  currentStyle: MapStyleId;
  onChangeStyle: (style: MapStyleId) => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onRotate: () => void;
  onTogglePitch: () => void;
  is3DPitch: boolean;
  onResetView: () => void;
  onLocateMe: () => void;
  onFlyToLandmark: (landmark: LandmarkPreset) => void;
  coordsInfo: {
    lat: number;
    lng: number;
    zoom: number;
    pitch: number;
    bearing: number;
  };
}

export const MapControls: React.FC<MapControlsProps> = ({
  currentStyle,
  onChangeStyle,
  onZoomIn,
  onZoomOut,
  onRotate,
  onTogglePitch,
  is3DPitch,
  onResetView,
  onLocateMe,
  onFlyToLandmark,
  coordsInfo,
}) => {
  const [showStyleMenu, setShowStyleMenu] = useState(false);
  const [showLandmarksMenu, setShowLandmarksMenu] = useState(false);

  const baseButtonStyle = {
    padding: '8px',
    color: '#F8FAFC',
    borderRadius: '12px',
    transition: 'all 200ms',
    background: 'transparent',
    border: 'none',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center'
  };

  return (
    <div style={{
      position: 'absolute',
      right: '16px',
      top: '80px',
      display: 'flex',
      flexDirection: 'column',
      gap: '8px',
      zIndex: 30,
      pointerEvents: 'auto',
      fontFamily: "'Inter', sans-serif"
    }}>
      {/* Primary Zoom & Camera Navigation Control Stack */}
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: 'rgba(17,24,39,0.85)',
        backdropFilter: 'blur(20px)',
        border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: '16px',
        padding: '4px',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
        gap: '4px'
      }}>
        {/* Zoom In */}
        <button
          onClick={onZoomIn}
          style={{ ...baseButtonStyle, color: '#F8FAFC' }}
          title="Zoom In (+)"
        >
          <Plus size={16} />
        </button>

        {/* Zoom Out */}
        <button
          onClick={onZoomOut}
          style={{ ...baseButtonStyle, color: '#F8FAFC' }}
          title="Zoom Out (-)"
        >
          <Minus size={16} />
        </button>

        <div style={{ height: '1px', backgroundColor: 'rgba(255,255,255,0.08)', margin: '2px 0' }} />

        {/* Rotate Camera (+45deg) */}
        <button
          onClick={onRotate}
          style={{ ...baseButtonStyle, color: '#F8FAFC' }}
          title="Rotate Camera 45°"
        >
          <RotateCw size={16} />
        </button>

        {/* 2D / 3D Pitch Toggle */}
        <button
          onClick={onTogglePitch}
          style={{
            ...baseButtonStyle,
            backgroundColor: is3DPitch ? 'rgba(0,212,255,0.2)' : 'transparent',
            color: is3DPitch ? '#00D4FF' : '#F8FAFC',
            border: is3DPitch ? '1px solid rgba(0,212,255,0.4)' : 'none',
          }}
          title={is3DPitch ? 'Switch to 2D Planimetric View (Pitch 0°)' : 'Switch to 3D Perspective View (Pitch 60°)'}
        >
          <Box size={16} />
        </button>

        {/* Compass Reset Bearing */}
        <button
          onClick={onResetView}
          style={{ ...baseButtonStyle, color: '#F8FAFC' }}
          title="Reset Camera View to Bengaluru City Center"
        >
          <Compass
            size={16}
            color="#00D4FF"
            style={{ transform: `rotate(${-coordsInfo.bearing}deg)`, transition: 'transform 300ms' }}
          />
        </button>

        {/* Locate Me Geolocation */}
        <button
          onClick={onLocateMe}
          style={{ ...baseButtonStyle, color: '#F8FAFC' }}
          title="Locate Me (Geolocation)"
        >
          <LocateFixed size={16} />
        </button>
      </div>

      {/* Map Style Selector Menu Trigger */}
      <div style={{ position: 'relative' }}>
        <button
          onClick={() => {
            setShowStyleMenu(!showStyleMenu);
            setShowLandmarksMenu(false);
          }}
          style={{
            padding: '10px',
            borderRadius: '16px',
            border: showStyleMenu ? '1px solid rgba(0,212,255,0.5)' : '1px solid rgba(255,255,255,0.08)',
            backdropFilter: 'blur(20px)',
            transition: 'all 200ms',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: showStyleMenu ? 'rgba(17,24,39,0.9)' : 'rgba(17,24,39,0.85)',
            color: showStyleMenu ? '#00D4FF' : '#F8FAFC',
            cursor: 'pointer'
          }}
          title="Base Map Styles"
        >
          <MapIcon size={16} />
        </button>

        {/* Base Map Style Menu Dropdown */}
        {showStyleMenu && (
          <div style={{
            position: 'absolute',
            right: '48px',
            top: 0,
            width: '256px',
            backgroundColor: 'rgba(17,24,39,0.95)',
            backdropFilter: 'blur(24px)',
            border: '1px solid rgba(0,212,255,0.4)',
            borderRadius: '16px',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
            padding: '8px',
            zIndex: 50,
            color: '#F8FAFC'
          }}>
            <div style={{
              fontSize: '11px',
              fontWeight: 600,
              color: '#94A3B8',
              padding: '4px 8px',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              borderBottom: '1px solid rgba(255,255,255,0.08)',
              fontFamily: "'Space Grotesk', sans-serif"
            }}>
              Base Map Style
            </div>
            <div style={{ marginTop: '4px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
              {MAP_STYLE_OPTIONS.map((style) => (
                <button
                  key={style.id}
                  onClick={() => {
                    onChangeStyle(style.id);
                    setShowStyleMenu(false);
                  }}
                  style={{
                    width: '100%',
                    textAlign: 'left',
                    padding: '8px',
                    borderRadius: '12px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    fontSize: '12px',
                    transition: 'all 200ms',
                    backgroundColor: currentStyle === style.id ? 'rgba(0,212,255,0.2)' : 'transparent',
                    border: currentStyle === style.id ? '1px solid rgba(0,212,255,0.4)' : '1px solid transparent',
                    color: currentStyle === style.id ? '#00D4FF' : '#F8FAFC',
                    fontWeight: currentStyle === style.id ? 600 : 400,
                    cursor: 'pointer'
                  }}
                >
                  <div>
                    <div>{style.name}</div>
                    <div style={{ fontSize: '10px', color: '#94A3B8', fontWeight: 400 }}>{style.description}</div>
                  </div>
                  <span
                    style={{
                      width: '12px',
                      height: '12px',
                      borderRadius: '50%',
                      border: '1px solid rgba(255,255,255,0.08)',
                      flexShrink: 0,
                      marginLeft: '8px',
                      backgroundColor: style.previewColor
                    }}
                  />
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Landmarks Fly-To Preset Trigger */}
      <div style={{ position: 'relative' }}>
        <button
          onClick={() => {
            setShowLandmarksMenu(!showLandmarksMenu);
            setShowStyleMenu(false);
          }}
          style={{
            padding: '10px',
            borderRadius: '16px',
            border: showLandmarksMenu ? '1px solid rgba(0,212,255,0.5)' : '1px solid rgba(255,255,255,0.08)',
            backdropFilter: 'blur(20px)',
            transition: 'all 200ms',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: showLandmarksMenu ? 'rgba(17,24,39,0.9)' : 'rgba(17,24,39,0.85)',
            color: showLandmarksMenu ? '#00D4FF' : '#F8FAFC',
            cursor: 'pointer'
          }}
          title="Landmark Fly-To Presets"
        >
          <Sparkles size={16} color="#00D4FF" />
        </button>

        {/* Landmarks Menu Dropdown */}
        {showLandmarksMenu && (
          <div style={{
            position: 'absolute',
            right: '48px',
            top: 0,
            width: '288px',
            backgroundColor: 'rgba(17,24,39,0.95)',
            backdropFilter: 'blur(24px)',
            border: '1px solid rgba(0,212,255,0.4)',
            borderRadius: '16px',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
            padding: '8px',
            zIndex: 50,
            color: '#F8FAFC'
          }}>
            <div style={{
              fontSize: '11px',
              fontWeight: 600,
              color: '#94A3B8',
              padding: '4px 8px',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              borderBottom: '1px solid rgba(255,255,255,0.08)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              fontFamily: "'Space Grotesk', sans-serif"
            }}>
              <span>Bengaluru 3D Landmarks</span>
              <Navigation size={12} color="#00D4FF" />
            </div>
            <div style={{
              marginTop: '4px',
              display: 'flex',
              flexDirection: 'column',
              gap: '4px',
              maxHeight: '288px',
              overflowY: 'auto'
            }}>
              {LANDMARK_PRESETS.map((landmark) => (
                <button
                  key={landmark.id}
                  onClick={() => {
                    onFlyToLandmark(landmark);
                    setShowLandmarksMenu(false);
                  }}
                  style={{
                    width: '100%',
                    textAlign: 'left',
                    padding: '8px',
                    borderRadius: '12px',
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '10px',
                    fontSize: '12px',
                    transition: 'all 200ms',
                    backgroundColor: 'transparent',
                    color: '#F8FAFC',
                    border: 'none',
                    cursor: 'pointer'
                  }}
                >
                  <MapPin size={14} color="#00D4FF" style={{ marginTop: '2px', flexShrink: 0 }} />
                  <div>
                    <div style={{ fontWeight: 500 }}>{landmark.name}</div>
                    <div style={{ fontSize: '10px', color: '#94A3B8' }}>{landmark.description}</div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Bottom Live Coordinates HUD Card */}
      <div style={{
        position: 'fixed',
        bottom: '12px',
        right: '16px',
        backgroundColor: 'rgba(17,24,39,0.9)',
        backdropFilter: 'blur(20px)',
        border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: '12px',
        padding: '6px 12px',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
        fontSize: '11px',
        fontFamily: "'IBM Plex Mono', monospace",
        color: '#F8FAFC',
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        zIndex: 30
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#00D4FF' }}>
          <MapPin size={12} />
          <span>
            {coordsInfo.lat.toFixed(4)}°N, {coordsInfo.lng.toFixed(4)}°E
          </span>
        </div>
        <div style={{ height: '12px', width: '1px', backgroundColor: 'rgba(255,255,255,0.08)' }} />
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#94A3B8' }}>
          <span>Zoom: <strong style={{ color: '#F8FAFC' }}>{coordsInfo.zoom.toFixed(1)}</strong></span>
          <span>Pitch: <strong style={{ color: '#F8FAFC' }}>{Math.round(coordsInfo.pitch)}°</strong></span>
          <span>Bearing: <strong style={{ color: '#F8FAFC' }}>{Math.round(coordsInfo.bearing)}°</strong></span>
        </div>
      </div>
    </div>
  );
};
