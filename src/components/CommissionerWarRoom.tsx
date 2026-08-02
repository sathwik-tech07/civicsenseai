import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { ShieldAlert, Brain, Radio, AlertTriangle, TrendingUp, Zap, Clock, ShieldCheck } from 'lucide-react';
import type { Incident, Ward, DepartmentPerformance } from '../types';
import { DigitalTwinGISMap } from './DigitalTwinGISMap';

interface Props {
  incidents: Incident[];
  wards: Ward[];
  departments: DepartmentPerformance[];
  onSelectIncident: (inc: Incident) => void;
  onOpenEmergencySimulation: () => void;
}

interface EmergencyLog {
  id: string;
  timestamp: string;
  title: string;
  detail: string;
  type: 'critical' | 'ai' | 'dispatch' | 'resolved' | 'warning';
  icon: string;
}

const INITIAL_LOGS: EmergencyLog[] = [
  {
    id: 'log-1',
    timestamp: '20:53:12',
    title: 'Critical Water Main Burst Detected',
    detail: 'Ward 4 Victoria Corridor · Risk 98/100 · High Flood Hazard',
    type: 'critical',
    icon: '💧',
  },
  {
    id: 'log-2',
    timestamp: '20:51:40',
    title: 'AI Vision Sentinel Converged',
    detail: 'YOLOv11x + RT-DETR confirmed sub-surface asphalt shear (98.4%)',
    type: 'ai',
    icon: '🤖',
  },
  {
    id: 'log-3',
    timestamp: '20:48:15',
    title: 'Emergency Fleet Dispatched',
    detail: 'Crew Alpha-4 & Heavy Repair Truck #08 En Route (ETA 3.8m)',
    type: 'dispatch',
    icon: '🚒',
  },
  {
    id: 'log-4',
    timestamp: '20:42:00',
    title: 'Hospital Bypass Rerouted',
    detail: 'Victoria Municipal Hospital Access Corridor protected',
    type: 'warning',
    icon: '🏥',
  },
  {
    id: 'log-5',
    timestamp: '20:35:10',
    title: 'Work Order Resolved',
    detail: 'INC-2026-MED-03 Stormwater Drain Grate repaired in 3.5h',
    type: 'resolved',
    icon: '✅',
  },
];

export const CommissionerWarRoom: React.FC<Props> = ({
  incidents,
  wards,
  departments: _departments,
  onSelectIncident,
  onOpenEmergencySimulation,
}) => {
  const [logs, setLogs] = useState<EmergencyLog[]>(INITIAL_LOGS);
  const [currentTime, setCurrentTime] = useState<string>('');

  // Live Clock & Log Stream Append Simulation
  useEffect(() => {
    const clockTimer = setInterval(() => {
      const now = new Date();
      setCurrentTime(now.toLocaleTimeString());
    }, 1000);

    const logTimer = setInterval(() => {
      const newLog: EmergencyLog = {
        id: `log-${Date.now()}`,
        timestamp: new Date().toLocaleTimeString().split(' ')[0],
        title: 'IoT Sensor Stream Telemetry Sync',
        detail: 'Flow Rate Sensor #104 pinged Ward 3 drainage grid · Normal Status',
        type: 'ai',
        icon: '📡',
      };
      setLogs((prev) => [newLog, ...prev.slice(0, 7)]);
    }, 12000);

    return () => {
      clearInterval(clockTimer);
      clearInterval(logTimer);
    };
  }, []);

  const cityHealthScore = Math.round(wards.reduce((acc, w) => acc + w.overallScore, 0) / (wards.length || 1));
  const openIncidentsCount = incidents.filter((i) => i.status !== 'resolved').length;
  const criticalCount = incidents.filter((i) => i.severity === 'critical' && i.status !== 'resolved').length;

  return (
    <div style={{ padding: '24px 32px', fontFamily: 'var(--font-body)', color: '#F8FAFC', minHeight: '100vh', background: '#070B14' }}>
      
      {/* ═══════════════════════════════════════════
          COMMISSIONER WAR ROOM HEADER
      ═══════════════════════════════════════════ */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, borderBottom: '1px solid rgba(0,212,255,0.2)', paddingBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{
            width: 48,
            height: 48,
            borderRadius: 14,
            background: 'linear-gradient(135deg, #EF4444, #8B5CF6)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 0 20px rgba(239,68,68,0.5)',
          }}>
            <ShieldAlert size={26} color="#fff" />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 11, fontWeight: 900, color: '#EF4444', background: 'rgba(239,68,68,0.2)', border: '1px solid #EF4444', padding: '2px 8px', borderRadius: 6, fontFamily: 'var(--font-mono)' }}>
                🔴 LEVEL L1 EMERGENCY ACTIVE
              </span>
              <span style={{ fontSize: 11, color: '#00D4FF', fontFamily: 'var(--font-mono)', fontWeight: 700 }}>
                BENGALURU CENTRAL COMMAND WAR ROOM
              </span>
            </div>
            <h1 style={{ fontFamily: 'var(--font-heading)', fontSize: 24, fontWeight: 900, color: '#F8FAFC', margin: '4px 0 0 0' }}>
              Municipal Commissioner Executive Control Center
            </h1>
          </div>
        </div>

        {/* Stream Badges & Actions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 14, fontWeight: 800, color: '#00D4FF', padding: '8px 14px', background: 'rgba(0,212,255,0.1)', borderRadius: 10, border: '1px solid rgba(0,212,255,0.3)' }}>
            {currentTime || '20:53:27 PM'}
          </div>

          <button
            onClick={onOpenEmergencySimulation}
            style={{
              padding: '10px 18px',
              borderRadius: 12,
              background: 'linear-gradient(135deg, #EF4444, #DC2626)',
              color: '#fff',
              border: 'none',
              fontWeight: 800,
              fontSize: 13,
              fontFamily: 'var(--font-heading)',
              cursor: 'pointer',
              boxShadow: '0 4px 20px rgba(239, 68, 68, 0.4)',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
            }}
          >
            <Radio size={16} />
            LAUNCH RAPID EMERGENCY SIMULATOR
          </button>
        </div>
      </div>

      {/* ═══════════════════════════════════════════
          EXECUTIVE KPI STRIP (5 METRICS)
      ═══════════════════════════════════════════ */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 16, marginBottom: 24 }}>
        
        {/* City Health Ring */}
        <div style={{ background: 'rgba(17, 24, 39, 0.85)', backdropFilter: 'blur(20px)', border: '1px solid rgba(0,212,255,0.2)', borderRadius: 18, padding: 16, display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ position: 'relative', width: 54, height: 54 }}>
            <svg width={54} height={54} viewBox="0 0 54 54" style={{ transform: 'rotate(-90deg)' }}>
              <circle cx={27} cy={27} r={22} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth={4} />
              <motion.circle
                cx={27} cy={27} r={22} fill="none"
                stroke="#00D4FF" strokeWidth={4} strokeLinecap="round"
                strokeDasharray={2 * Math.PI * 22}
                initial={{ strokeDashoffset: 2 * Math.PI * 22 }}
                animate={{ strokeDashoffset: 2 * Math.PI * 22 * (1 - cityHealthScore / 100) }}
                transition={{ duration: 1 }}
              />
            </svg>
            <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 800, color: '#00D4FF' }}>
              {cityHealthScore}
            </div>
          </div>
          <div>
            <div style={{ fontSize: 10, color: '#94A3B8', fontWeight: 700 }}>CITY HEALTH INDEX</div>
            <div style={{ fontSize: 16, fontWeight: 800, color: '#F8FAFC' }}>{cityHealthScore} / 100</div>
            <div style={{ fontSize: 10, color: '#10B981', fontWeight: 600, marginTop: 2 }}>+2.4% vs Last Week</div>
          </div>
        </div>

        {/* Active Incidents */}
        <div style={{ background: 'rgba(17, 24, 39, 0.85)', backdropFilter: 'blur(20px)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 18, padding: 16, display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ width: 44, height: 44, borderRadius: 12, background: 'rgba(239,68,68,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <AlertTriangle size={22} color="#EF4444" />
          </div>
          <div>
            <div style={{ fontSize: 10, color: '#94A3B8', fontWeight: 700 }}>ACTIVE INCIDENTS</div>
            <div style={{ fontSize: 18, fontWeight: 900, color: '#EF4444', fontFamily: 'var(--font-mono)' }}>
              {openIncidentsCount} Open
            </div>
            <div style={{ fontSize: 10, color: '#EF4444', fontWeight: 700, marginTop: 2 }}>
              {criticalCount} Critical Emergency
            </div>
          </div>
        </div>

        {/* AI Predictions Forecast */}
        <div style={{ background: 'rgba(17, 24, 39, 0.85)', backdropFilter: 'blur(20px)', border: '1px solid rgba(139,92,246,0.2)', borderRadius: 18, padding: 16, display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ width: 44, height: 44, borderRadius: 12, background: 'rgba(139,92,246,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Brain size={22} color="#8B5CF6" />
          </div>
          <div>
            <div style={{ fontSize: 10, color: '#94A3B8', fontWeight: 700 }}>AI PREDICTIVE FORECAST</div>
            <div style={{ fontSize: 18, fontWeight: 900, color: '#8B5CF6', fontFamily: 'var(--font-mono)' }}>
              3 Impending
            </div>
            <div style={{ fontSize: 10, color: '#94A3B8', marginTop: 2 }}>Drainage Overflows (48h)</div>
          </div>
        </div>

        {/* Department SLA */}
        <div style={{ background: 'rgba(17, 24, 39, 0.85)', backdropFilter: 'blur(20px)', border: '1px solid rgba(16,185,129,0.2)', borderRadius: 18, padding: 16, display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ width: 44, height: 44, borderRadius: 12, background: 'rgba(16,185,129,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <ShieldCheck size={22} color="#10B981" />
          </div>
          <div>
            <div style={{ fontSize: 10, color: '#94A3B8', fontWeight: 700 }}>SLA COMPLIANCE</div>
            <div style={{ fontSize: 18, fontWeight: 900, color: '#10B981', fontFamily: 'var(--font-mono)' }}>
              94.2%
            </div>
            <div style={{ fontSize: 10, color: '#10B981', fontWeight: 600, marginTop: 2 }}>Avg 18.4h Resolution</div>
          </div>
        </div>

        {/* YTD Savings */}
        <div style={{ background: 'rgba(17, 24, 39, 0.85)', backdropFilter: 'blur(20px)', border: '1px solid rgba(0,212,255,0.2)', borderRadius: 18, padding: 16, display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ width: 44, height: 44, borderRadius: 12, background: 'rgba(0,212,255,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <TrendingUp size={22} color="#00D4FF" />
          </div>
          <div>
            <div style={{ fontSize: 10, color: '#94A3B8', fontWeight: 700 }}>AI SAVINGS YTD</div>
            <div style={{ fontSize: 18, fontWeight: 900, color: '#00D4FF', fontFamily: 'var(--font-mono)' }}>
              ₹14.28L
            </div>
            <div style={{ fontSize: 10, color: '#00D4FF', fontWeight: 600, marginTop: 2 }}>Early Intervention</div>
          </div>
        </div>
      </div>

      {/* ═══════════════════════════════════════════
          MAIN WAR ROOM 3-COLUMN CONTROL GRID
      ═══════════════════════════════════════════ */}
      <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr 340px', gap: 20, minHeight: 640 }}>
        
        {/* ── LEFT COLUMN: AI CITY BRAIN PANEL ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          
          {/* AI City Brain Overview Card */}
          <div style={{
            background: 'rgba(17, 24, 39, 0.85)',
            backdropFilter: 'blur(24px)',
            border: '1px solid rgba(139,92,246,0.3)',
            borderRadius: 20,
            padding: 20,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#8B5CF6', fontSize: 14, fontWeight: 800, marginBottom: 14 }}>
              <Brain size={18} />
              AI City Brain Diagnostic System
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, fontSize: 12 }}>
              <div style={{ padding: 10, background: 'rgba(255,255,255,0.03)', borderRadius: 12 }}>
                <div style={{ color: '#64748B', fontSize: 10 }}>Overall City Status</div>
                <div style={{ color: '#10B981', fontWeight: 800, fontSize: 13, marginTop: 2 }}>
                  STABLE · 5 AI ENSEMBLES ACTIVE
                </div>
              </div>

              <div style={{ padding: 10, background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 12 }}>
                <div style={{ color: '#EF4444', fontSize: 10, fontWeight: 700 }}>HIGHEST RISK AREA</div>
                <div style={{ color: '#F8FAFC', fontWeight: 700, marginTop: 2 }}>
                  Ward 4 Kaveri Water Trunk Corridor
                </div>
                <div style={{ color: '#EF4444', fontSize: 11, fontWeight: 800, fontFamily: 'var(--font-mono)', marginTop: 2 }}>
                  Risk Score: 98 / 100
                </div>
              </div>

              <div style={{ padding: 10, background: 'rgba(0,212,255,0.05)', borderRadius: 12 }}>
                <div style={{ color: '#00D4FF', fontSize: 10, fontWeight: 700 }}>BUDGET FORECAST</div>
                <div style={{ color: '#F8FAFC', fontWeight: 700, marginTop: 2 }}>
                  ₹4,500,000 Prevented Failures
                </div>
              </div>

              <div style={{ padding: 10, background: 'rgba(245,158,11,0.08)', borderRadius: 12 }}>
                <div style={{ color: '#F59E0B', fontSize: 10, fontWeight: 700 }}>PREDICTED INCIDENTS (48h)</div>
                <div style={{ color: '#F8FAFC', fontWeight: 600, marginTop: 2 }}>
                  3 Drainage Overflows in Ward 3 & 5
                </div>
              </div>
            </div>
          </div>

          {/* AI Recommendation Card */}
          <div style={{
            background: 'linear-gradient(135deg, rgba(0,212,255,0.08), rgba(139,92,246,0.08))',
            border: '1px solid rgba(0,212,255,0.3)',
            borderRadius: 20,
            padding: 20,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#00D4FF', fontSize: 14, fontWeight: 800, marginBottom: 10 }}>
              <Zap size={18} />
              AI Strategic Recommendation
            </div>
            <p style={{ fontSize: 12, color: '#F8FAFC', lineHeight: 1.5, margin: 0 }}>
              Reallocate 3 rapid utility repair crews from Ward 3 to Ward 4 Kaveri Corridor. Early stabilization will prevent a predicted ₹4.5M major failure loss during impending monsoon runoff.
            </p>
          </div>
        </div>

        {/* ── CENTER COLUMN: GIANT LIVE GIS DIGITAL TWIN VIEWPORT ── */}
        <div style={{ position: 'relative', borderRadius: 20, overflow: 'hidden', border: '1px solid rgba(0,212,255,0.3)', boxShadow: '0 20px 50px rgba(0,0,0,0.6)' }}>
          <DigitalTwinGISMap
            incidents={incidents}
            predictiveRisks={[]}
            wards={wards}
            onSelectIncident={onSelectIncident}
          />
        </div>

        {/* ── RIGHT COLUMN: LIVE CHRONOLOGICAL EMERGENCY FEED ── */}
        <div style={{
          background: 'rgba(17, 24, 39, 0.85)',
          backdropFilter: 'blur(24px)',
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: 20,
          padding: 20,
          display: 'flex',
          flexDirection: 'column',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#EF4444', fontSize: 14, fontWeight: 800 }}>
              <Clock size={18} />
              Live Emergency Log Stream
            </div>
            <span style={{ fontSize: 10, color: '#10B981', fontFamily: 'var(--font-mono)', fontWeight: 700 }}>
              LIVE SYNC
            </span>
          </div>

          {/* Chronological Log Stream List */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, overflowY: 'auto', flex: 1, maxHeight: 520, paddingRight: 4 }}>
            {logs.map((log) => (
              <motion.div
                key={log.id}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.3 }}
                style={{
                  padding: 12,
                  borderRadius: 12,
                  background: log.type === 'critical' ? 'rgba(239,68,68,0.08)' : 'rgba(255,255,255,0.03)',
                  border: log.type === 'critical' ? '1px solid rgba(239,68,68,0.3)' : '1px solid rgba(255,255,255,0.06)',
                  borderLeft: log.type === 'critical' ? '3px solid #EF4444' : log.type === 'dispatch' ? '3px solid #00D4FF' : '3px solid #10B981',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: '#F8FAFC', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span>{log.icon}</span>
                    <span>{log.title}</span>
                  </span>
                  <span style={{ fontSize: 10, color: '#64748B', fontFamily: 'var(--font-mono)' }}>{log.timestamp}</span>
                </div>
                <div style={{ fontSize: 11, color: '#94A3B8' }}>{log.detail}</div>
              </motion.div>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
};
