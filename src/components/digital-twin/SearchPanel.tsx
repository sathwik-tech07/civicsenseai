import React, { useState, useMemo, useRef } from 'react';
import { Search, MapPin, X, Building, AlertTriangle, Activity, ShieldAlert, HeartPulse } from 'lucide-react';
import type { SearchItem, SearchCategory } from './types';
import type { Incident, PredictiveRiskZone, Ward } from '../../types';
import { HOSPITALS_LIST, IOT_SENSORS_DATA, LANDMARK_PRESETS } from './mockGisData';

interface SearchPanelProps {
  wards: Ward[];
  incidents: Incident[];
  predictiveRisks: PredictiveRiskZone[];
  onSelectSearchItem: (item: SearchItem) => void;
}

const CATEGORY_STYLES: Record<SearchCategory, { label: string; bg: string; text: string; border: string; icon: React.ReactNode }> = {
  ward: {
    label: 'Ward Zone',
    bg: 'rgba(139, 92, 246, 0.1)',
    text: '#8B5CF6',
    border: '1px solid rgba(139, 92, 246, 0.3)',
    icon: <Building size={12} color="#8B5CF6" />,
  },
  hospital: {
    label: 'Hospital',
    bg: 'rgba(0, 212, 255, 0.1)',
    text: '#00D4FF',
    border: '1px solid rgba(0, 212, 255, 0.3)',
    icon: <HeartPulse size={12} color="#00D4FF" />,
  },
  sensor: {
    label: 'IoT Sensor',
    bg: 'rgba(16, 185, 129, 0.1)',
    text: '#10B981',
    border: '1px solid rgba(16, 185, 129, 0.3)',
    icon: <Activity size={12} color="#10B981" />,
  },
  incident: {
    label: 'Incident',
    bg: 'rgba(239, 68, 68, 0.1)',
    text: '#EF4444',
    border: '1px solid rgba(239, 68, 68, 0.3)',
    icon: <AlertTriangle size={12} color="#EF4444" />,
  },
  risk: {
    label: 'Predictive Risk',
    bg: 'rgba(245, 158, 11, 0.1)',
    text: '#F59E0B',
    border: '1px solid rgba(245, 158, 11, 0.3)',
    icon: <ShieldAlert size={12} color="#F59E0B" />,
  },
  poi: {
    label: 'Landmark POI',
    bg: 'rgba(59, 130, 246, 0.1)',
    text: '#3B82F6',
    border: '1px solid rgba(59, 130, 246, 0.3)',
    icon: <MapPin size={12} color="#3B82F6" />,
  },
};

export const SearchPanel: React.FC<SearchPanelProps> = ({
  wards,
  incidents,
  predictiveRisks,
  onSelectSearchItem,
}) => {
  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  // Build Unified Search Index across Wards, POIs, Hospitals, Sensors, Incidents, Risks
  const searchIndex = useMemo<SearchItem[]>(() => {
    const items: SearchItem[] = [];

    // Wards
    (wards || []).forEach((w) =>
      items.push({
        id: `ward_${w.id}`,
        title: w.name,
        subtitle: `${w.zone} Zone • Code: ${w.code} • Pop: ${w.population.toLocaleString()}`,
        category: 'ward',
        coordinates: [w.lng, w.lat],
        metadata: w,
      })
    );

    // Incidents
    (incidents || []).forEach((inc) =>
      items.push({
        id: `inc_${inc.id}`,
        title: inc.title,
        subtitle: `${inc.severity.toUpperCase()} Priority • ${inc.address || inc.wardName}`,
        category: 'incident',
        coordinates: [inc.lng, inc.lat],
        metadata: inc,
      })
    );

    // Predictive Risks
    (predictiveRisks || []).forEach((rk) =>
      items.push({
        id: `risk_${rk.id}`,
        title: rk.zoneName,
        subtitle: `Failure Prob: ${rk.failureProbabilityScore}% • ${rk.riskType.replace('_', ' ').toUpperCase()}`,
        category: 'risk',
        coordinates: [rk.lng, rk.lat],
        metadata: rk,
      })
    );

    // IoT Sensors
    IOT_SENSORS_DATA.forEach((sns) =>
      items.push({
        id: `iot_${sns.id}`,
        title: sns.name,
        subtitle: `Telemetry Hub (${sns.type.toUpperCase()}) • Status: ${sns.status.toUpperCase()}`,
        category: 'sensor',
        coordinates: [sns.lng, sns.lat],
        metadata: sns,
      })
    );

    // Hospitals
    HOSPITALS_LIST.forEach((hosp) =>
      items.push({
        id: `hosp_${hosp.id}`,
        title: hosp.name,
        subtitle: `Emergency Medical Hub • ${hosp.beds} Beds`,
        category: 'hospital',
        coordinates: [hosp.lng, hosp.lat],
        metadata: hosp,
      })
    );

    // Landmark POIs
    LANDMARK_PRESETS.forEach((lm) =>
      items.push({
        id: `poi_${lm.id}`,
        title: lm.name,
        subtitle: lm.description,
        category: 'poi',
        coordinates: lm.coordinates,
        metadata: lm,
      })
    );

    return items;
  }, [wards, incidents, predictiveRisks]);

  // Filtered Search Results
  const results = useMemo(() => {
    if (!query.trim()) return [];
    const q = query.toLowerCase().trim();
    return searchIndex
      .filter(
        (item) =>
          item.title.toLowerCase().includes(q) ||
          item.subtitle.toLowerCase().includes(q) ||
          item.category.toLowerCase().includes(q)
      )
      .slice(0, 10);
  }, [query, searchIndex]);

  // Handle Keyboard Navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen || results.length === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev + 1) % results.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev - 1 + results.length) % results.length);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (results[selectedIndex]) {
        handleSelect(results[selectedIndex]);
      }
    } else if (e.key === 'Escape') {
      setIsOpen(false);
      inputRef.current?.blur();
    }
  };

  const handleSelect = (item: SearchItem) => {
    onSelectSearchItem(item);
    setQuery(item.title);
    setIsOpen(false);
  };

  return (
    <div style={{ position: 'relative', zIndex: 40, width: '384px', maxWidth: '100%', fontFamily: "'Inter', sans-serif" }}>
      {/* Search Input Bar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          padding: '8px 12px',
          borderRadius: '16px',
          border: isOpen ? '1px solid rgba(0,212,255,0.6)' : '1px solid rgba(255,255,255,0.08)',
          boxShadow: isOpen ? '0 10px 15px -3px rgba(0,212,255,0.4), 0 0 0 2px rgba(0,212,255,0.2)' : '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
          backdropFilter: 'blur(24px)',
          backgroundColor: isOpen ? 'rgba(17,24,39,0.95)' : 'rgba(17,24,39,0.85)',
          transition: 'all 200ms'
        }}
      >
        <Search size={16} color="#00D4FF" style={{ flexShrink: 0 }} />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setIsOpen(true);
            setSelectedIndex(0);
          }}
          onFocus={() => setIsOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder="Search Wards, Hospitals, IoT, Incidents..."
          style={{
            width: '100%',
            backgroundColor: 'transparent',
            color: '#F8FAFC',
            fontSize: '12px',
            fontWeight: 500,
            border: 'none',
            outline: 'none',
          }}
        />
        {query && (
          <button
            onClick={() => {
              setQuery('');
              setIsOpen(false);
            }}
            style={{
              color: '#94A3B8',
              padding: '2px',
              borderRadius: '9999px',
              background: 'transparent',
              border: 'none',
              cursor: 'pointer'
            }}
          >
            <X size={14} />
          </button>
        )}
      </div>

      {/* Autocomplete Results Dropdown */}
      {isOpen && results.length > 0 && (
        <div style={{
          position: 'absolute',
          top: '44px',
          left: 0,
          width: '100%',
          backgroundColor: 'rgba(17,24,39,0.95)',
          backdropFilter: 'blur(24px)',
          border: '1px solid rgba(0,212,255,0.4)',
          borderRadius: '16px',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
          overflow: 'hidden',
          zIndex: 50,
          color: '#F8FAFC',
          maxHeight: '320px',
          overflowY: 'auto'
        }}>
          {results.map((item, idx) => {
            const catStyle = CATEGORY_STYLES[item.category];
            const isSelected = idx === selectedIndex;

            return (
              <div
                key={item.id}
                onClick={() => handleSelect(item)}
                onMouseEnter={() => setSelectedIndex(idx)}
                style={{
                  padding: '10px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  cursor: 'pointer',
                  transition: 'all 200ms',
                  backgroundColor: isSelected ? 'rgba(0,212,255,0.15)' : 'transparent',
                  borderLeft: isSelected ? '4px solid #00D4FF' : '4px solid transparent',
                  borderBottom: '1px solid rgba(255,255,255,0.08)'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', minWidth: 0, paddingRight: '8px' }}>
                  <div style={{ marginTop: '2px', flexShrink: 0 }}>{catStyle.icon}</div>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: '12px', color: '#F8FAFC', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      <span>{item.title}</span>
                    </div>
                    <div style={{ fontSize: '10px', color: '#94A3B8', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginTop: '2px' }}>
                      {item.subtitle}
                    </div>
                  </div>
                </div>

                <span
                  style={{
                    fontSize: '9px',
                    fontWeight: 600,
                    padding: '2px 8px',
                    borderRadius: '9999px',
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                    flexShrink: 0,
                    backgroundColor: catStyle.bg,
                    color: catStyle.text,
                    border: catStyle.border,
                  }}
                >
                  {catStyle.label}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
