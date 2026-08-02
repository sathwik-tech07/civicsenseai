import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Brain, Play, RotateCcw, AlertTriangle, ShieldCheck, X, Activity, Zap } from 'lucide-react';
import type { Incident } from '../types';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  incident: Incident;
  onDeployCrew?: () => void;
}

type TimeFrame = '+2h' | '+6h' | '+12h' | '+24h';

interface SimulationMetrics {
  riskScore: number;
  budgetLoss: number;
  waterLossLiters: number;
  trafficDelayMins: number;
  citizenImpactCount: number;
  hospitalDelayMins: number;
  infraDamageLabel: string;
  heatmapRadiusMeters: number;
}

const TIMEFRAME_DATA: Record<TimeFrame, { withoutResponse: SimulationMetrics; immediateResponse: SimulationMetrics }> = {
  '+2h': {
    withoutResponse: {
      riskScore: 78,
      budgetLoss: 145000,
      waterLossLiters: 4200,
      trafficDelayMins: 4.2,
      citizenImpactCount: 1200,
      hospitalDelayMins: 2.1,
      infraDamageLabel: 'Minor Asphalt Surface Fissure',
      heatmapRadiusMeters: 120,
    },
    immediateResponse: {
      riskScore: 42,
      budgetLoss: 85000,
      waterLossLiters: 450,
      trafficDelayMins: 0.8,
      citizenImpactCount: 150,
      hospitalDelayMins: 0.3,
      infraDamageLabel: 'Contained & Stabilized Base',
      heatmapRadiusMeters: 30,
    },
  },
  '+6h': {
    withoutResponse: {
      riskScore: 88,
      budgetLoss: 480000,
      waterLossLiters: 18500,
      trafficDelayMins: 9.8,
      citizenImpactCount: 4800,
      hospitalDelayMins: 5.6,
      infraDamageLabel: 'Sub-base Aggregate Erosion',
      heatmapRadiusMeters: 280,
    },
    immediateResponse: {
      riskScore: 35,
      budgetLoss: 85000,
      waterLossLiters: 450,
      trafficDelayMins: 0.5,
      citizenImpactCount: 120,
      hospitalDelayMins: 0.1,
      infraDamageLabel: 'Cold-Patch Layer Applied',
      heatmapRadiusMeters: 20,
    },
  },
  '+12h': {
    withoutResponse: {
      riskScore: 94,
      budgetLoss: 1450000,
      waterLossLiters: 48000,
      trafficDelayMins: 18.4,
      citizenImpactCount: 14200,
      hospitalDelayMins: 12.8,
      infraDamageLabel: 'Main Water Trunk Burst & Pit Failure',
      heatmapRadiusMeters: 550,
    },
    immediateResponse: {
      riskScore: 24,
      budgetLoss: 85000,
      waterLossLiters: 450,
      trafficDelayMins: 0.0,
      citizenImpactCount: 50,
      hospitalDelayMins: 0.0,
      infraDamageLabel: 'Fully Cured & Compaction Tested',
      heatmapRadiusMeters: 10,
    },
  },
  '+24h': {
    withoutResponse: {
      riskScore: 99,
      budgetLoss: 4500000,
      waterLossLiters: 125000,
      trafficDelayMins: 36.0,
      citizenImpactCount: 38000,
      hospitalDelayMins: 24.5,
      infraDamageLabel: 'Catastrophic Road Foundation Collapse',
      heatmapRadiusMeters: 950,
    },
    immediateResponse: {
      riskScore: 12,
      budgetLoss: 85000,
      waterLossLiters: 450,
      trafficDelayMins: 0.0,
      citizenImpactCount: 0,
      hospitalDelayMins: 0.0,
      infraDamageLabel: 'Complete Restoration Audit Passed',
      heatmapRadiusMeters: 0,
    },
  },
};

export const AISimulationTimelineModal: React.FC<Props> = ({
  isOpen,
  onClose,
  incident,
  onDeployCrew,
}) => {
  const [activeFrame, setActiveFrame] = useState<TimeFrame>('+6h');
  const [activeMode, setActiveMode] = useState<'without' | 'immediate'>('without');
  const [isPlaying, setIsPlaying] = useState<boolean>(false);

  // Auto-play timeline simulation progression (+2h -> +6h -> +12h -> +24h)
  useEffect(() => {
    if (!isOpen || !isPlaying) return;
    const frames: TimeFrame[] = ['+2h', '+6h', '+12h', '+24h'];
    let idx = frames.indexOf(activeFrame);

    const timer = setInterval(() => {
      idx = (idx + 1) % frames.length;
      setActiveFrame(frames[idx]);
    }, 2200);

    return () => clearInterval(timer);
  }, [isOpen, isPlaying, activeFrame]);

  if (!isOpen) return null;

  const currentData = activeMode === 'without'
    ? TIMEFRAME_DATA[activeFrame].withoutResponse
    : TIMEFRAME_DATA[activeFrame].immediateResponse;

  const without24h = TIMEFRAME_DATA['+24h'].withoutResponse;
  const immediate24h = TIMEFRAME_DATA['+24h'].immediateResponse;

  const budgetSaved = without24h.budgetLoss - immediate24h.budgetLoss;
  const timeSavedHours = 20.5;
  const citizenImpactRedPct = 98.4;

  return (
    <AnimatePresence>
      <div style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        background: 'rgba(7, 11, 20, 0.94)',
        backdropFilter: 'blur(24px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
      }}>
        <motion.div
          initial={{ scale: 0.92, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.92, opacity: 0 }}
          style={{
            width: '94%',
            maxWidth: 960,
            background: 'rgba(17, 24, 39, 0.96)',
            backdropFilter: 'blur(28px)',
            border: '1px solid rgba(0, 212, 255, 0.4)',
            borderRadius: 24,
            padding: 28,
            boxShadow: '0 25px 60px rgba(0, 0, 0, 0.7)',
            display: 'flex',
            flexDirection: 'column',
            gap: 20,
            position: 'relative',
          }}
        >
          {/* Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 44, height: 44, borderRadius: 14, background: 'rgba(139,92,246,0.2)', border: '1px solid #8B5CF6', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Brain size={24} color="#8B5CF6" />
              </div>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 10, fontWeight: 800, color: '#00D4FF', background: 'rgba(0,212,255,0.15)', padding: '2px 8px', borderRadius: 6, fontFamily: 'var(--font-mono)' }}>
                    AI DIGITAL TWIN TIME MACHINE
                  </span>
                  <span style={{ fontSize: 11, color: '#94A3B8', fontFamily: 'var(--font-mono)' }}>
                    {incident.id}
                  </span>
                </div>
                <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: 20, fontWeight: 800, color: '#F8FAFC', margin: '4px 0 0 0' }}>
                  Predictive Disaster Timeline Simulation: {incident.title}
                </h3>
              </div>
            </div>

            <button onClick={onClose} style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: '#94A3B8', borderRadius: 10, padding: 6, cursor: 'pointer' }}>
              <X size={20} />
            </button>
          </div>

          {/* Mode Switcher: WITHOUT RESPONSE vs IMMEDIATE RESPONSE */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, background: 'rgba(7,11,20,0.6)', padding: 6, borderRadius: 16, border: '1px solid rgba(255,255,255,0.06)' }}>
            <button
              onClick={() => setActiveMode('without')}
              style={{
                padding: '12px',
                borderRadius: 12,
                background: activeMode === 'without' ? 'rgba(239,68,68,0.2)' : 'transparent',
                border: activeMode === 'without' ? '1px solid #EF4444' : '1px solid transparent',
                color: activeMode === 'without' ? '#EF4444' : '#94A3B8',
                fontWeight: 800,
                fontSize: 13,
                fontFamily: 'var(--font-heading)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
              }}
            >
              <AlertTriangle size={18} />
              WITHOUT RESPONSE (PREDICTIVE DETERIORATION)
            </button>

            <button
              onClick={() => setActiveMode('immediate')}
              style={{
                padding: '12px',
                borderRadius: 12,
                background: activeMode === 'immediate' ? 'rgba(16,185,129,0.2)' : 'transparent',
                border: activeMode === 'immediate' ? '1px solid #10B981' : '1px solid transparent',
                color: activeMode === 'immediate' ? '#10B981' : '#94A3B8',
                fontWeight: 800,
                fontSize: 13,
                fontFamily: 'var(--font-heading)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
              }}
            >
              <ShieldCheck size={18} />
              IMMEDIATE REPAIR RESPONSE (MITIGATED)
            </button>
          </div>

          {/* Time Interval Tabs + Play Button */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'rgba(255,255,255,0.03)', padding: 10, borderRadius: 16 }}>
            <div style={{ display: 'flex', gap: 10 }}>
              {(['+2h', '+6h', '+12h', '+24h'] as TimeFrame[]).map((tf) => (
                <button
                  key={tf}
                  onClick={() => setActiveFrame(tf)}
                  style={{
                    padding: '8px 18px',
                    borderRadius: 10,
                    background: activeFrame === tf ? '#00D4FF' : 'rgba(255,255,255,0.05)',
                    color: activeFrame === tf ? '#000' : '#F8FAFC',
                    border: 'none',
                    fontWeight: 800,
                    fontSize: 13,
                    fontFamily: 'var(--font-mono)',
                    cursor: 'pointer',
                    boxShadow: activeFrame === tf ? '0 0 16px rgba(0,212,255,0.4)' : 'none',
                  }}
                >
                  {tf} Interval
                </button>
              ))}
            </div>

            <button
              onClick={() => setIsPlaying(!isPlaying)}
              style={{
                padding: '8px 16px',
                borderRadius: 10,
                background: isPlaying ? 'rgba(245,158,11,0.2)' : 'rgba(0,212,255,0.15)',
                border: isPlaying ? '1px solid #F59E0B' : '1px solid #00D4FF',
                color: isPlaying ? '#F59E0B' : '#00D4FF',
                fontWeight: 700,
                fontSize: 12,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              {isPlaying ? <RotateCcw size={14} /> : <Play size={14} />}
              {isPlaying ? 'Pause Simulation' : 'Auto-Play Timeline'}
            </button>
          </div>

          {/* SIMULATION METRICS GRID (7 DYNAMIC METRICS) */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
            <div style={{ padding: 14, background: 'rgba(255,255,255,0.03)', borderRadius: 14, border: '1px solid rgba(255,255,255,0.06)' }}>
              <div style={{ fontSize: 10, color: '#64748B' }}>RISK SCORE</div>
              <div style={{ fontSize: 22, fontWeight: 900, color: currentData.riskScore > 80 ? '#EF4444' : '#10B981', fontFamily: 'var(--font-mono)', marginTop: 2 }}>
                {currentData.riskScore} / 100
              </div>
              <div style={{ fontSize: 10, color: '#94A3B8', marginTop: 4 }}>Predicted AI Threat Level</div>
            </div>

            <div style={{ padding: 14, background: 'rgba(255,255,255,0.03)', borderRadius: 14, border: '1px solid rgba(255,255,255,0.06)' }}>
              <div style={{ fontSize: 10, color: '#64748B' }}>FINANCIAL LOSS</div>
              <div style={{ fontSize: 20, fontWeight: 900, color: '#F8FAFC', fontFamily: 'var(--font-mono)', marginTop: 2 }}>
                ₹{currentData.budgetLoss.toLocaleString()}
              </div>
              <div style={{ fontSize: 10, color: '#94A3B8', marginTop: 4 }}>Cumulative Structural Cost</div>
            </div>

            <div style={{ padding: 14, background: 'rgba(255,255,255,0.03)', borderRadius: 14, border: '1px solid rgba(255,255,255,0.06)' }}>
              <div style={{ fontSize: 10, color: '#64748B' }}>WATER / UTILITY LOSS</div>
              <div style={{ fontSize: 20, fontWeight: 900, color: '#00D4FF', fontFamily: 'var(--font-mono)', marginTop: 2 }}>
                {currentData.waterLossLiters.toLocaleString()} L
              </div>
              <div style={{ fontSize: 10, color: '#94A3B8', marginTop: 4 }}>Wasted Kaveri Water Trunk</div>
            </div>

            <div style={{ padding: 14, background: 'rgba(255,255,255,0.03)', borderRadius: 14, border: '1px solid rgba(255,255,255,0.06)' }}>
              <div style={{ fontSize: 10, color: '#64748B' }}>TRAFFIC DELAY</div>
              <div style={{ fontSize: 20, fontWeight: 900, color: '#F59E0B', fontFamily: 'var(--font-mono)', marginTop: 2 }}>
                +{currentData.trafficDelayMins} Mins
              </div>
              <div style={{ fontSize: 10, color: '#94A3B8', marginTop: 4 }}>Corridor Bypass Delay</div>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
            <div style={{ padding: 12, background: 'rgba(255,255,255,0.03)', borderRadius: 14, border: '1px solid rgba(255,255,255,0.06)' }}>
              <div style={{ fontSize: 10, color: '#64748B' }}>CITIZEN IMPACT</div>
              <div style={{ fontSize: 16, fontWeight: 800, color: '#F8FAFC', fontFamily: 'var(--font-mono)', marginTop: 2 }}>
                {currentData.citizenImpactCount.toLocaleString()} Citizens
              </div>
            </div>

            <div style={{ padding: 12, background: 'rgba(255,255,255,0.03)', borderRadius: 14, border: '1px solid rgba(255,255,255,0.06)' }}>
              <div style={{ fontSize: 10, color: '#64748B' }}>HOSPITAL EMERGENCY DELAY</div>
              <div style={{ fontSize: 16, fontWeight: 800, color: '#EF4444', fontFamily: 'var(--font-mono)', marginTop: 2 }}>
                +{currentData.hospitalDelayMins} Mins
              </div>
            </div>

            <div style={{ padding: 12, background: 'rgba(255,255,255,0.03)', borderRadius: 14, border: '1px solid rgba(255,255,255,0.06)' }}>
              <div style={{ fontSize: 10, color: '#64748B' }}>INFRASTRUCTURE DAMAGE STATE</div>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#00D4FF', marginTop: 2 }}>
                {currentData.infraDamageLabel}
              </div>
            </div>
          </div>

          {/* GIS PREDICTIVE HEATMAP DENSITY VISUALIZER */}
          <div style={{ background: 'rgba(7,11,20,0.8)', padding: 16, borderRadius: 16, border: '1px solid rgba(0,212,255,0.2)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#00D4FF', display: 'flex', alignItems: 'center', gap: 6 }}>
                <Activity size={16} />
                GIS Digital Twin Impact Radius Expansion ({activeFrame})
              </div>
              <span style={{ fontSize: 11, color: '#F59E0B', fontFamily: 'var(--font-mono)' }}>
                Spread Radius: {currentData.heatmapRadiusMeters} meters
              </span>
            </div>

            <div style={{ height: 10, background: 'rgba(255,255,255,0.08)', borderRadius: 5, overflow: 'hidden' }}>
              <motion.div
                animate={{ width: `${Math.min(100, (currentData.heatmapRadiusMeters / 950) * 100)}%` }}
                transition={{ duration: 0.6 }}
                style={{ height: '100%', background: activeMode === 'without' ? 'linear-gradient(90deg, #F59E0B, #EF4444)' : 'linear-gradient(90deg, #10B981, #00D4FF)' }}
              />
            </div>
          </div>

          {/* SAVINGS & REDUCTION COMPARISON SUMMARY */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, background: 'linear-gradient(135deg, rgba(16,185,129,0.1), rgba(0,212,255,0.1))', padding: 14, borderRadius: 16, border: '1px solid rgba(16,185,129,0.3)' }}>
            <div>
              <div style={{ fontSize: 10, color: '#10B981', fontWeight: 700 }}>PREDICTED BUDGET SAVED</div>
              <div style={{ fontSize: 16, fontWeight: 800, color: '#F8FAFC', fontFamily: 'var(--font-mono)' }}>₹{budgetSaved.toLocaleString()}</div>
            </div>
            <div>
              <div style={{ fontSize: 10, color: '#00D4FF', fontWeight: 700 }}>RECOVERY TIME SAVED</div>
              <div style={{ fontSize: 16, fontWeight: 800, color: '#F8FAFC', fontFamily: 'var(--font-mono)' }}>{timeSavedHours} Hours</div>
            </div>
            <div>
              <div style={{ fontSize: 10, color: '#8B5CF6', fontWeight: 700 }}>CITIZEN IMPACT REDUCTION</div>
              <div style={{ fontSize: 16, fontWeight: 800, color: '#F8FAFC', fontFamily: 'var(--font-mono)' }}>-{citizenImpactRedPct}%</div>
            </div>
          </div>

          {/* ACTION BUTTON */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
            <button onClick={onClose} style={{ padding: '10px 20px', borderRadius: 12, background: 'rgba(255,255,255,0.06)', color: '#94A3B8', border: '1px solid rgba(255,255,255,0.1)', cursor: 'pointer', fontWeight: 600 }}>
              Close HUD
            </button>
            {onDeployCrew && (
              <button
                onClick={() => {
                  onDeployCrew();
                  onClose();
                }}
                style={{
                  padding: '10px 24px',
                  borderRadius: 12,
                  background: 'linear-gradient(135deg, #10B981, #059669)',
                  color: '#fff',
                  border: 'none',
                  fontWeight: 800,
                  fontSize: 13,
                  fontFamily: 'var(--font-heading)',
                  cursor: 'pointer',
                  boxShadow: '0 4px 20px rgba(16,185,129,0.4)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                }}
              >
                <Zap size={16} />
                DEPLOY CREW & COLLAPSE RISK NOW
              </button>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
