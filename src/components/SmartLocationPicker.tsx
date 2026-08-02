import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Navigation, Search, MapPin, Loader2, AlertCircle } from 'lucide-react';
import type { IncidentLocation } from '../types';
import {
  getCurrentLocationGPS,
  searchAddressSuggestions,
  MOCK_LOCATION_PRESETS,
  DEFAULT_LOCATION,
} from '../services/locationService';

interface Props {
  selectedLocation: IncidentLocation;
  onChangeLocation: (location: IncidentLocation) => void;
  onEnableMapPickMode?: () => void;
}

export const SmartLocationPicker: React.FC<Props> = ({
  selectedLocation,
  onChangeLocation,
  onEnableMapPickMode,
}) => {
  const [activeTab, setActiveTab] = useState<'gps' | 'search' | 'map'>('search');
  const [searchQuery, setSearchQuery] = useState(selectedLocation.formattedAddress || '');
  const [suggestions, setSuggestions] = useState<IncidentLocation[]>(MOCK_LOCATION_PRESETS);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [isGpsLoading, setIsGpsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Method 1: Browser GPS Location
  const handleAcquireGPS = async () => {
    setIsGpsLoading(true);
    setErrorMsg(null);
    setActiveTab('gps');

    try {
      const loc = await getCurrentLocationGPS();
      onChangeLocation(loc);
      setSearchQuery(loc.formattedAddress);
      setIsGpsLoading(false);
    } catch (err: any) {
      console.warn('GPS Error:', err);
      setIsGpsLoading(false);
      setErrorMsg('GPS acquisition failed or permission denied. Falling back to Address Search.');
      setActiveTab('search');
      onChangeLocation(DEFAULT_LOCATION);
    }
  };

  // Method 2: Search Address Autocomplete
  const handleSearchChange = (q: string) => {
    setSearchQuery(q);
    setShowSuggestions(true);
    const results = searchAddressSuggestions(q);
    setSuggestions(results);
  };

  const handleSelectSuggestion = (loc: IncidentLocation) => {
    onChangeLocation(loc);
    setSearchQuery(loc.formattedAddress);
    setShowSuggestions(false);
  };

  return (
    <div style={{
      background: 'rgba(17, 24, 39, 0.85)',
      backdropFilter: 'blur(20px)',
      border: '1px solid rgba(0, 212, 255, 0.3)',
      borderRadius: 16,
      padding: 16,
      display: 'flex',
      flexDirection: 'column',
      gap: 12,
      fontFamily: "'Inter', sans-serif",
      color: '#F8FAFC',
    }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <MapPin size={18} color="#00D4FF" />
          <span style={{ fontSize: 13, fontWeight: 800, fontFamily: "'Space Grotesk', sans-serif" }}>
            UNIFIED SMART LOCATION ARCHITECTURE
          </span>
        </div>
        <span style={{
          fontSize: 10,
          fontWeight: 800,
          fontFamily: "'IBM Plex Mono', monospace",
          padding: '2px 8px',
          borderRadius: 6,
          background: 'rgba(0, 212, 255, 0.15)',
          color: '#00D4FF',
          border: '1px solid #00D4FF',
          textTransform: 'uppercase',
        }}>
          {selectedLocation.method} MODE
        </span>
      </div>

      {/* 3 Location Input Method Selector Tabs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6 }}>
        <button
          onClick={handleAcquireGPS}
          disabled={isGpsLoading}
          style={{
            padding: '8px 10px',
            borderRadius: 10,
            border: activeTab === 'gps' ? '1px solid #00D4FF' : '1px solid rgba(255,255,255,0.08)',
            background: activeTab === 'gps' ? 'rgba(0, 212, 255, 0.2)' : 'rgba(255,255,255,0.03)',
            color: activeTab === 'gps' ? '#F8FAFC' : '#94A3B8',
            fontSize: 11,
            fontWeight: 700,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
          }}
        >
          {isGpsLoading ? <Loader2 size={14} className="animate-spin" /> : <Navigation size={14} color="#00D4FF" />}
          <span>1. Use GPS</span>
        </button>

        <button
          onClick={() => { setActiveTab('search'); setShowSuggestions(true); }}
          style={{
            padding: '8px 10px',
            borderRadius: 10,
            border: activeTab === 'search' ? '1px solid #8B5CF6' : '1px solid rgba(255,255,255,0.08)',
            background: activeTab === 'search' ? 'rgba(139, 92, 246, 0.2)' : 'rgba(255,255,255,0.03)',
            color: activeTab === 'search' ? '#F8FAFC' : '#94A3B8',
            fontSize: 11,
            fontWeight: 700,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
          }}
        >
          <Search size={14} color="#8B5CF6" />
          <span>2. Search</span>
        </button>

        <button
          onClick={() => {
            setActiveTab('map');
            if (onEnableMapPickMode) onEnableMapPickMode();
          }}
          style={{
            padding: '8px 10px',
            borderRadius: 10,
            border: activeTab === 'map' ? '1px solid #10B981' : '1px solid rgba(255,255,255,0.08)',
            background: activeTab === 'map' ? 'rgba(16, 185, 129, 0.2)' : 'rgba(255,255,255,0.03)',
            color: activeTab === 'map' ? '#F8FAFC' : '#94A3B8',
            fontSize: 11,
            fontWeight: 700,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
          }}
        >
          <MapPin size={14} color="#10B981" />
          <span>3. Pick Map</span>
        </button>
      </div>

      {/* Error Fallback Banner */}
      {errorMsg && (
        <div style={{
          background: 'rgba(245, 158, 11, 0.15)',
          border: '1px solid #F59E0B',
          borderRadius: 8,
          padding: '6px 10px',
          color: '#F59E0B',
          fontSize: 10,
          display: 'flex',
          alignItems: 'center',
          gap: 6,
        }}>
          <AlertCircle size={14} />
          {errorMsg}
        </div>
      )}

      {/* Search Input & Autocomplete Dropdown */}
      <div style={{ position: 'relative' }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          background: 'rgba(7, 11, 20, 0.8)',
          border: '1px solid rgba(0, 212, 255, 0.3)',
          borderRadius: 10,
          padding: '8px 12px',
        }}>
          <Search size={16} color="#00D4FF" />
          <input
            type="text"
            placeholder="Search address, landmark, ward, or street..."
            value={searchQuery}
            onChange={(e) => handleSearchChange(e.target.value)}
            onFocus={() => setShowSuggestions(true)}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#F8FAFC',
              fontSize: 12,
              width: '100%',
              outline: 'none',
            }}
          />
        </div>

        {/* Autocomplete Suggestions Menu */}
        <AnimatePresence>
          {showSuggestions && suggestions.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: -5 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -5 }}
              style={{
                position: 'absolute',
                top: '100%',
                left: 0,
                right: 0,
                marginTop: 4,
                background: 'rgba(17, 24, 39, 0.96)',
                backdropFilter: 'blur(24px)',
                border: '1px solid rgba(0, 212, 255, 0.4)',
                borderRadius: 12,
                boxShadow: '0 15px 35px rgba(0,0,0,0.5)',
                zIndex: 60,
                maxHeight: 200,
                overflowY: 'auto',
                padding: 4,
              }}
            >
              {suggestions.map((loc, idx) => (
                <div
                  key={idx}
                  onClick={() => handleSelectSuggestion(loc)}
                  style={{
                    padding: '8px 12px',
                    borderRadius: 8,
                    fontSize: 11,
                    color: '#F8FAFC',
                    cursor: 'pointer',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 2,
                    borderBottom: idx === suggestions.length - 1 ? 'none' : '1px solid rgba(255,255,255,0.04)',
                    transition: 'background 0.2s ease',
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(0, 212, 255, 0.15)'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                >
                  <div style={{ fontWeight: 700, color: '#00D4FF' }}>{loc.street}</div>
                  <div style={{ color: '#94A3B8', fontSize: 10 }}>{loc.ward} · {loc.city}, {loc.postalCode}</div>
                </div>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Generated IncidentLocation Telemetry Inspector */}
      <div style={{
        background: 'rgba(7, 11, 20, 0.6)',
        border: '1px solid rgba(255,255,255,0.06)',
        borderRadius: 12,
        padding: 12,
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: 8,
        fontSize: 10,
      }}>
        <div>
          <span style={{ color: '#64748B', display: 'block' }}>LATITUDE / LONGITUDE</span>
          <strong style={{ color: '#00D4FF', fontFamily: "'IBM Plex Mono', monospace" }}>
            {selectedLocation.lat.toFixed(4)}°N, {selectedLocation.lng.toFixed(4)}°E
          </strong>
        </div>
        <div>
          <span style={{ color: '#64748B', display: 'block' }}>ASSIGNED WARD</span>
          <strong style={{ color: '#8B5CF6' }}>{selectedLocation.ward}</strong>
        </div>
        <div>
          <span style={{ color: '#64748B', display: 'block' }}>STREET & AREA</span>
          <strong style={{ color: '#F8FAFC' }}>{selectedLocation.street}</strong>
        </div>
        <div>
          <span style={{ color: '#64748B', display: 'block' }}>CITY, STATE, POSTAL CODE</span>
          <strong style={{ color: '#10B981' }}>{selectedLocation.city}, {selectedLocation.state} {selectedLocation.postalCode}</strong>
        </div>
      </div>
    </div>
  );
};
