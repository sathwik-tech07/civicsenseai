import React from 'react';
import { motion } from 'framer-motion';
import {
  X,
  ShieldAlert,
  BrainCircuit,
  Building,
  Radio,
  MapPin,
  Send,
  Zap,
  Download,
  FileText,
  CloudRain,
  Navigation,
  Sparkles,
  Video,
} from 'lucide-react';
import type { SelectedEntityInfo } from './types';
import type { Incident } from '../../types';

interface InfoPanelProps {
  info: SelectedEntityInfo | null;
  onClose: () => void;
  onDispatchCrew?: (incident: Incident) => void;
  onSimulateImpact?: (data: any) => void;
  onGenerateReport?: (data: any) => void;
  onNavigateToEntity?: (data: any) => void;
  onOpenCCTV?: (incidentId: string) => void;
}

// ── Mini SVG Sparkline Trend Chart Component ──
const MiniSparkline: React.FC<{ data: number[]; color: string; label: string; unit: string; currentVal: string }> = ({
  data,
  color,
  label,
  unit,
  currentVal,
}) => {
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const width = 110;
  const height = 28;

  const points = data
    .map((val, i) => {
      const x = (i / (data.length - 1)) * width;
      const y = height - ((val - min) / range) * (height - 6) - 3;
      return `${x},${y}`;
    })
    .join(' ');

  return (
    <div style={{
      background: 'rgba(7, 11, 20, 0.6)',
      border: '1px solid rgba(255,255,255,0.06)',
      borderRadius: 10,
      padding: '8px 10px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 8,
    }}>
      <div>
        <div style={{ fontSize: 9, color: '#64748B', textTransform: 'uppercase', fontFamily: "'IBM Plex Mono', monospace" }}>
          {label}
        </div>
        <div style={{ fontSize: 13, fontWeight: 800, color, fontFamily: "'IBM Plex Mono', monospace" }}>
          {currentVal} <span style={{ fontSize: 9, color: '#94A3B8', fontWeight: 500 }}>{unit}</span>
        </div>
      </div>
      <svg width={width} height={height} style={{ overflow: 'visible' }}>
        <polyline
          fill="none"
          stroke={color}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          points={points}
        />
      </svg>
    </div>
  );
};

// ── Circular SVG Progress Ring Component ──
const ProgressRing: React.FC<{ value: number; size?: number; strokeWidth?: number; color: string; label: string }> = ({
  value,
  size = 54,
  strokeWidth = 5,
  color,
  label,
}) => {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (value / 100) * circumference;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
      <div style={{ position: 'relative', width: size, height: size }}>
        <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke="rgba(255,255,255,0.08)"
            strokeWidth={strokeWidth}
            fill="transparent"
          />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke={color}
            strokeWidth={strokeWidth}
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            fill="transparent"
            style={{ transition: 'stroke-dashoffset 0.8s ease' }}
          />
        </svg>
        <div style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 12,
          fontWeight: 800,
          color: '#F8FAFC',
          fontFamily: "'IBM Plex Mono', monospace",
        }}>
          {value}%
        </div>
      </div>
      <span style={{ fontSize: 9, color: '#94A3B8', fontWeight: 600, textTransform: 'uppercase', fontFamily: "'IBM Plex Mono', monospace" }}>
        {label}
      </span>
    </div>
  );
};

export const InfoPanel: React.FC<InfoPanelProps> = ({
  info,
  onClose,
  onDispatchCrew,
  onSimulateImpact,
  onGenerateReport,
  onNavigateToEntity,
  onOpenCCTV,
}) => {
  // ── ONBOARDING PANEL WHEN NO ENTITY IS SELECTED ──
  if (!info) {
    return (
      <motion.div
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        style={{
          padding: 20,
          display: 'flex',
          flexDirection: 'column',
          height: '100%',
          gap: 16,
          fontFamily: "'Inter', sans-serif",
          color: '#F8FAFC',
          background: 'rgba(17, 24, 39, 0.4)',
        }}
      >
        {/* Onboarding Header Banner */}
        <div style={{
          background: 'linear-gradient(135deg, rgba(0, 212, 255, 0.15), rgba(139, 92, 246, 0.15))',
          border: '1px solid rgba(0, 212, 255, 0.3)',
          borderRadius: 16,
          padding: 16,
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#00D4FF' }}>
            <Sparkles size={20} />
            <span style={{ fontSize: 13, fontWeight: 800, fontFamily: "'Space Grotesk', sans-serif" }}>
              SMART CITY OPERATING SYSTEM
            </span>
          </div>
          <div style={{ fontSize: 16, fontWeight: 800, color: '#F8FAFC', fontFamily: "'Space Grotesk', sans-serif" }}>
            AI Executive Command Portal
          </div>
          <div style={{ fontSize: 11, color: '#94A3B8', lineHeight: 1.5 }}>
            Welcome to the CivicSense Digital Twin. Click any 3D building, incident marker, IoT node, or infrastructure pipeline on the map to open detailed intelligence.
          </div>
        </div>

        {/* Executive City Readiness KPI Cards */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <div style={{ background: 'rgba(7, 11, 20, 0.6)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, padding: 12 }}>
            <div style={{ fontSize: 10, color: '#64748B', fontFamily: "'IBM Plex Mono', monospace" }}>CITY HEALTH INDEX</div>
            <div style={{ fontSize: 22, fontWeight: 800, color: '#10B981', fontFamily: "'IBM Plex Mono', monospace" }}>88/100</div>
            <div style={{ fontSize: 9, color: '#10B981', marginTop: 2 }}>▲ +4.2% from last week</div>
          </div>
          <div style={{ background: 'rgba(7, 11, 20, 0.6)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, padding: 12 }}>
            <div style={{ fontSize: 10, color: '#64748B', fontFamily: "'IBM Plex Mono', monospace" }}>AI MODEL ACCURACY</div>
            <div style={{ fontSize: 22, fontWeight: 800, color: '#00D4FF', fontFamily: "'IBM Plex Mono', monospace" }}>98.4%</div>
            <div style={{ fontSize: 9, color: '#00D4FF', marginTop: 2 }}>CV & Hydrology Ensemble</div>
          </div>
        </div>

        {/* Interactive Feature Shortcuts Guide */}
        <div style={{ fontSize: 12, fontWeight: 700, color: '#F8FAFC', fontFamily: "'Space Grotesk', sans-serif" }}>
          Digital Twin Command Guide
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {[
            { icon: Building, title: 'Inspect 3D Buildings', desc: 'Click any building to analyze floors, health score, water/energy telemetry, and maintenance schedule.', color: '#00D4FF' },
            { icon: CloudRain, title: 'Dynamic Weather Simulation', desc: 'Switch between Sunny, Rain, Heavy Downpour & Storm to observe live flood risk recalculation.', color: '#8B5CF6' },
            { icon: Radio, title: 'Live IoT Telemetry Nodes', desc: 'Click green/amber/red telemetry dots to inspect real-time pressure, flow, and noise sensors.', color: '#10B981' },
            { icon: ShieldAlert, title: 'Emergency Dispatch', desc: 'Click incident markers to fly the inspection drone and dispatch emergency response crews.', color: '#EF4444' },
          ].map((guide, idx) => (
            <div key={idx} style={{
              background: 'rgba(7, 11, 20, 0.4)',
              border: '1px solid rgba(255,255,255,0.06)',
              borderRadius: 12,
              padding: 12,
              display: 'flex',
              gap: 12,
              alignItems: 'flex-start',
            }}>
              <div style={{ padding: 8, borderRadius: 10, background: `${guide.color}15`, border: `1px solid ${guide.color}30`, color: guide.color }}>
                <guide.icon size={18} />
              </div>
              <div>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#F8FAFC' }}>{guide.title}</div>
                <div style={{ fontSize: 10, color: '#94A3B8', marginTop: 2, lineHeight: 1.4 }}>{guide.desc}</div>
              </div>
            </div>
          ))}
        </div>
      </motion.div>
    );
  }

  // ── AI EXECUTIVE DECISION CENTER WHEN AN ENTITY IS SELECTED ──
  const { type, data } = info;

  // Export GeoJSON function
  const handleExportGeoJSON = () => {
    const feature = {
      type: 'Feature',
      properties: data,
      geometry: {
        type: 'Point',
        coordinates: [data.lng || data.coordinates?.[0] || 77.5946, data.lat || data.coordinates?.[1] || 12.9716],
      },
    };
    const blob = new Blob([JSON.stringify(feature, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `civicsense_${type}_${data.id || 'entity'}.geojson`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const healthScore = data.healthScore || Math.floor(Math.random() * 20 + 75);
  const riskScore = data.riskScore || Math.floor(Math.random() * 30 + 12);
  const aiConfidence = data.xai?.cvConfidence || 96.4;

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 14,
        padding: 16,
        fontFamily: "'Inter', sans-serif",
        color: '#F8FAFC',
      }}
    >
      {/* 1. Executive Entity Header */}
      <div style={{
        background: 'rgba(7, 11, 20, 0.7)',
        border: '1px solid rgba(0, 212, 255, 0.3)',
        borderRadius: 14,
        padding: 14,
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{
              fontSize: 10,
              fontWeight: 800,
              fontFamily: "'IBM Plex Mono', monospace",
              textTransform: 'uppercase',
              padding: '2px 8px',
              borderRadius: 6,
              background: 'rgba(0, 212, 255, 0.15)',
              border: '1px solid #00D4FF',
              color: '#00D4FF',
            }}>
              {type.toUpperCase()}
            </span>
            <span style={{
              fontSize: 10,
              fontWeight: 700,
              padding: '2px 8px',
              borderRadius: 999,
              background: data.status === 'critical' ? 'rgba(239,68,68,0.2)' : 'rgba(16,185,129,0.2)',
              color: data.status === 'critical' ? '#EF4444' : '#10B981',
              border: data.status === 'critical' ? '1px solid #EF4444' : '1px solid #10B981',
            }}>
              {data.status || 'Active Asset'}
            </span>
          </div>

          <button
            onClick={onClose}
            style={{
              padding: 4,
              borderRadius: 6,
              color: '#94A3B8',
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
            }}
          >
            <X size={16} />
          </button>
        </div>

        <div>
          <h2 style={{
            fontSize: 16,
            fontWeight: 800,
            color: '#F8FAFC',
            fontFamily: "'Space Grotesk', sans-serif",
            margin: 0,
          }}>
            {data.title || data.name || data.zoneName || 'Civic Infrastructure Asset'}
          </h2>
          <div style={{ fontSize: 11, color: '#94A3B8', marginTop: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
            <MapPin size={12} color="#00D4FF" />
            <span>{data.address || data.wardName || 'Bengaluru Central District'}</span>
          </div>
        </div>

        {/* Progress Rings & Health Scores Grid */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: 8,
          paddingTop: 8,
          borderTop: '1px solid rgba(255,255,255,0.06)',
        }}>
          <ProgressRing value={healthScore} color="#10B981" label="Health Score" />
          <ProgressRing value={riskScore} color="#F59E0B" label="Vulnerability" />
          <ProgressRing value={Math.round(aiConfidence)} color="#00D4FF" label="AI Confidence" />
        </div>
      </div>

      {/* 2. Sparkline Trend Charts Grid */}
      <div style={{ fontSize: 11, fontWeight: 700, color: '#F8FAFC', fontFamily: "'Space Grotesk', sans-serif" }}>
        Live Sensor Trends & Telemetry
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        <MiniSparkline data={[45, 52, 68, 74, 82, 91]} color="#EF4444" label="Traffic Load" unit="v/min" currentVal="91" />
        <MiniSparkline data={[12, 15, 28, 45, 62, 78]} color="#00D4FF" label="Rainfall" unit="mm/h" currentVal="78" />
        <MiniSparkline data={[55, 58, 62, 60, 68, 72]} color="#F59E0B" label="Noise Index" unit="dB" currentVal="72" />
        <MiniSparkline data={[10, 14, 22, 35, 48, 64]} color="#8B5CF6" label="Risk Index" unit="score" currentVal="64" />
      </div>

      {/* 3. Technical Telemetry & Impact Analysis */}
      <div style={{
        background: 'rgba(7, 11, 20, 0.6)',
        border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: 12,
        padding: 12,
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: 10,
        fontSize: 11,
      }}>
        <div>
          <span style={{ color: '#64748B', fontSize: 10, display: 'block' }}>Weather Impact</span>
          <strong style={{ color: '#38BDF8', fontFamily: "'IBM Plex Mono', monospace" }}>
            {data.weatherImpact || '+35% Drainage Surge'}
          </strong>
        </div>
        <div>
          <span style={{ color: '#64748B', fontSize: 10, display: 'block' }}>Traffic Congestion</span>
          <strong style={{ color: '#F59E0B', fontFamily: "'IBM Plex Mono', monospace" }}>
            {data.trafficImpact || 'Heavy Corridor Load'}
          </strong>
        </div>
        <div>
          <span style={{ color: '#64748B', fontSize: 10, display: 'block' }}>Estimated Repair Cost</span>
          <strong style={{ color: '#10B981', fontFamily: "'IBM Plex Mono', monospace" }}>
            ₹{(data.estimatedRepairCost || 85000).toLocaleString()}
          </strong>
        </div>
        <div>
          <span style={{ color: '#64748B', fontSize: 10, display: 'block' }}>Resolution ETA</span>
          <strong style={{ color: '#8B5CF6', fontFamily: "'IBM Plex Mono', monospace" }}>
            {data.eta || '2.4 Hours'}
          </strong>
        </div>
        <div>
          <span style={{ color: '#64748B', fontSize: 10, display: 'block' }}>Assigned Department</span>
          <strong style={{ color: '#F8FAFC' }}>
            {data.assignedDept || 'Water & Sewerage Board'}
          </strong>
        </div>
        <div>
          <span style={{ color: '#64748B', fontSize: 10, display: 'block' }}>Chief Engineer / Officer</span>
          <strong style={{ color: '#F8FAFC' }}>
            {data.assignedOfficer || 'Er. Ramesh Kumar'}
          </strong>
        </div>
      </div>

      {/* 4. Explainable AI (XAI) Priority Reasoning Card */}
      <div style={{
        background: 'rgba(0, 212, 255, 0.08)',
        border: '1px solid rgba(0, 212, 255, 0.3)',
        borderRadius: 12,
        padding: 12,
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#00D4FF', fontWeight: 800, fontSize: 11 }}>
          <BrainCircuit size={16} />
          <span>EXPLAINABLE AI (XAI) DECISION REASONING</span>
        </div>
        <p style={{ color: '#F8FAFC', fontSize: 11, margin: 0, lineHeight: 1.4 }}>
          {data.aiRecommendation || 'Hydrological neural model detects high sub-surface pressure build-up. Immediate pressure valve relief recommended before storm peak.'}
        </p>

        {/* Feature Weight Bars */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 10, color: '#94A3B8', paddingTop: 6, borderTop: '1px solid rgba(255,255,255,0.06)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>CV Vision Model Confidence</span>
            <span style={{ color: '#00D4FF', fontFamily: "'IBM Plex Mono', monospace" }}>96.4%</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>Hospital Proximity Weight</span>
            <span style={{ color: '#10B981', fontFamily: "'IBM Plex Mono', monospace" }}>High (340m)</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>Historical Recurrence Index</span>
            <span style={{ color: '#F59E0B', fontFamily: "'IBM Plex Mono', monospace" }}>4 Failures / 2 yrs</span>
          </div>
        </div>
      </div>

      {/* 5. Executive Quick Action Buttons Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        <button
          onClick={() => onGenerateReport?.(data)}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
            padding: '10px 12px',
            background: 'rgba(139, 92, 246, 0.2)',
            border: '1px solid #8B5CF6',
            color: '#F8FAFC',
            borderRadius: 10,
            fontSize: 11,
            fontWeight: 700,
            cursor: 'pointer',
          }}
        >
          <FileText size={14} color="#8B5CF6" />
          <span>Generate Report</span>
        </button>

        <button
          onClick={() => onDispatchCrew?.(data)}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
            padding: '10px 12px',
            background: 'rgba(239, 68, 68, 0.2)',
            border: '1px solid #EF4444',
            color: '#F8FAFC',
            borderRadius: 10,
            fontSize: 11,
            fontWeight: 700,
            cursor: 'pointer',
          }}
        >
          <Send size={14} color="#EF4444" />
          <span>Dispatch Crew</span>
        </button>

        <button
          onClick={() => onOpenCCTV?.(data.id || 'INC-2026')}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
            padding: '10px 12px',
            background: 'rgba(139, 92, 246, 0.2)',
            border: '1px solid #8B5CF6',
            color: '#F8FAFC',
            borderRadius: 10,
            fontSize: 11,
            fontWeight: 700,
            cursor: 'pointer',
          }}
        >
          <Video size={14} color="#8B5CF6" />
          <span>Live CCTV</span>
        </button>

        <button
          onClick={() => onSimulateImpact?.(data)}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
            padding: '10px 12px',
            background: 'rgba(0, 212, 255, 0.2)',
            border: '1px solid #00D4FF',
            color: '#F8FAFC',
            borderRadius: 10,
            fontSize: 11,
            fontWeight: 700,
            cursor: 'pointer',
          }}
        >
          <Zap size={14} color="#00D4FF" />
          <span>Run Simulation</span>
        </button>

        <button
          onClick={() => onNavigateToEntity?.(data)}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
            padding: '10px 12px',
            background: 'rgba(16, 185, 129, 0.2)',
            border: '1px solid #10B981',
            color: '#F8FAFC',
            borderRadius: 10,
            fontSize: 11,
            fontWeight: 700,
            cursor: 'pointer',
          }}
        >
          <Navigation size={14} color="#10B981" />
          <span>Navigate</span>
        </button>
      </div>

      <button
        onClick={handleExportGeoJSON}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 6,
          padding: '8px 12px',
          background: 'rgba(255,255,255,0.03)',
          border: '1px solid rgba(255,255,255,0.1)',
          color: '#94A3B8',
          borderRadius: 8,
          fontSize: 10,
          fontWeight: 600,
          cursor: 'pointer',
        }}
      >
        <Download size={14} />
        <span>Export Entity GeoJSON Dataset</span>
      </button>
    </motion.div>
  );
};
