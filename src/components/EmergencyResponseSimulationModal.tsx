import React, { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ShieldAlert, Navigation, X, Radio, ArrowLeft, ChevronRight, LogOut
} from 'lucide-react';
import confetti from 'canvas-confetti';
import {
  EMERGENCY_SIMULATION_STAGES,
  EMERGENCY_SIMULATION_VEHICLES,
  formatCountdown,
  formatDistance,
  getVehicleStatusByStage,
} from '../services/emergencySimulationService';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onDispatchComplete?: () => void;
  onOpenLogoutModal?: () => void;
}

const STAGES = EMERGENCY_SIMULATION_STAGES;
const EMERGENCY_UNITS = EMERGENCY_SIMULATION_VEHICLES;

type VehicleStatus = 'Dispatching' | 'En Route' | 'Arriving' | 'Repair Started' | 'Completed';

interface VehicleSimulationState {
  id: string;
  etaSeconds: number;
  distanceMeters: number;
  positionPercent: number;
  status: VehicleStatus;
  arrived: boolean;
}

const createInitialVehicleStates = (): VehicleSimulationState[] =>
  EMERGENCY_UNITS.map((unit) => ({
    id: unit.id,
    etaSeconds: unit.initialEtaSeconds,
    distanceMeters: unit.initialDistanceMeters,
    positionPercent: unit.initialPositionPercent,
    status: 'Dispatching' as const,
    arrived: false,
  }));

export const EmergencyResponseSimulationModal: React.FC<Props> = ({ isOpen, onClose, onDispatchComplete, onOpenLogoutModal }) => {
  const [currentStageIdx, setCurrentStageIdx] = useState(0);
  const [isSimulating, setIsSimulating] = useState(true);
  const [isResolved, setIsResolved] = useState(false);
  const [vehicleStates, setVehicleStates] = useState<VehicleSimulationState[]>(createInitialVehicleStates);

  useEffect(() => {
    if (!isOpen) return;

    setCurrentStageIdx(0);
    setIsSimulating(true);
    setIsResolved(false);
    setVehicleStates(createInitialVehicleStates());
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen || !isSimulating) return;

    const timer = window.setInterval(() => {
      setVehicleStates((prev) =>
        prev.map((vehicle, index) => {
          const nextEta = Math.max(0, vehicle.etaSeconds - 1);
          const nextDistance = Math.max(0, vehicle.distanceMeters - Math.max(18, 120 - index * 15));
          const nextPosition = Math.min(100, vehicle.positionPercent + (index === 4 ? 4 : 2));
          const nextStatus: VehicleStatus = nextPosition >= 100
            ? 'Completed'
            : (getVehicleStatusByStage(currentStageIdx, nextPosition) as VehicleStatus);

          return {
            ...vehicle,
            etaSeconds: nextEta,
            distanceMeters: nextDistance,
            positionPercent: nextPosition,
            status: nextStatus,
            arrived: nextPosition >= 100,
          };
        })
      );
    }, 1000);

    return () => window.clearInterval(timer);
  }, [isOpen, isSimulating, currentStageIdx]);

  useEffect(() => {
    if (!isOpen || !isSimulating) return;

    const stageTimer = window.setInterval(() => {
      setCurrentStageIdx((prev) => {
        if (prev >= STAGES.length - 1) {
          setIsSimulating(false);
          setIsResolved(true);
          confetti({ particleCount: 120, spread: 70, origin: { y: 0.6 } });
          if (onDispatchComplete) onDispatchComplete();
          return STAGES.length - 1;
        }

        return prev + 1;
      });
    }, 2800);

    return () => window.clearInterval(stageTimer);
  }, [isOpen, isSimulating, onDispatchComplete]);

  useEffect(() => {
    if (!isOpen || !isSimulating) return;

    const arrivalCheck = window.setInterval(() => {
      setVehicleStates((prev) => {
        const allArrived = prev.every((vehicle) => vehicle.positionPercent >= 100);

        if (allArrived) {
          setCurrentStageIdx(STAGES.length - 1);
          setIsSimulating(false);
          setIsResolved(true);
          confetti({ particleCount: 140, spread: 70, origin: { y: 0.6 } });
          if (onDispatchComplete) onDispatchComplete();
          return prev.map((vehicle) => ({ ...vehicle, status: 'Completed' as VehicleStatus }));
        }

        return prev;
      });
    }, 500);

    return () => window.clearInterval(arrivalCheck);
  }, [isOpen, isSimulating, onDispatchComplete]);

  const currentStage = STAGES[currentStageIdx] ?? STAGES[STAGES.length - 1];
  const missionCompletion = useMemo(() => {
    const baseProgress = currentStage.progress;
    const vehicleMomentum = vehicleStates.reduce((sum, vehicle) => sum + vehicle.positionPercent, 0) / vehicleStates.length;
    return Math.min(100, Math.round((baseProgress * 0.55) + (vehicleMomentum * 0.45)));
  }, [currentStage.progress, vehicleStates]);

  const vehicleStatusLabel = currentStageIdx < 3
    ? 'Dispatching'
    : currentStageIdx === 3 || currentStageIdx === 4
      ? 'En Route'
      : currentStageIdx === 5
        ? 'Repair Started'
        : 'Repair Complete';

  const missionStatusLabel = isResolved ? 'Mission Complete' : 'Active Dispatch';

  if (!isOpen) return null;

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
            width: '92%',
            maxWidth: 920,
            maxHeight: '92vh',
            overflowY: 'auto',
            background: 'rgba(17, 24, 39, 0.96)',
            backdropFilter: 'blur(28px)',
            border: isResolved ? '2px solid #10B981' : '1px solid rgba(0, 212, 255, 0.4)',
            borderRadius: 24,
            padding: 24,
            boxShadow: isResolved ? '0 0 40px rgba(16, 185, 129, 0.4)' : '0 25px 60px rgba(0, 0, 0, 0.7)',
            display: 'flex',
            flexDirection: 'column',
            gap: 16,
            position: 'relative',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <button
                onClick={onClose}
                style={{
                  background: 'rgba(255,255,255,0.06)',
                  border: '1px solid rgba(255,255,255,0.12)',
                  borderRadius: 10,
                  color: '#00D4FF',
                  padding: '6px 14px',
                  fontWeight: 700,
                  fontSize: 12,
                  fontFamily: 'var(--font-heading)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                <ArrowLeft size={14} />
                Back to Dashboard
              </button>

              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, fontFamily: 'var(--font-mono)', color: '#64748B' }}>
                <span>Dashboard</span>
                <ChevronRight size={12} />
                <span>Emergency Command</span>
                <ChevronRight size={12} />
                <span style={{ color: '#00D4FF', fontWeight: 700 }}>INC-2026-8492</span>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <button
                onClick={() => onOpenLogoutModal && onOpenLogoutModal()}
                title="Sign Out of CivicSense AI"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '6px 14px',
                  borderRadius: 10,
                  background: 'rgba(239, 68, 68, 0.18)',
                  border: '1px solid rgba(239, 68, 68, 0.4)',
                  color: '#EF4444',
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: 'pointer',
                  fontFamily: 'var(--font-heading)',
                }}
              >
                <LogOut size={14} color="#EF4444" />
                Logout
              </button>

              <button
                onClick={onClose}
                style={{
                  background: 'rgba(255,255,255,0.06)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  color: '#94A3B8',
                  borderRadius: 10,
                  padding: 6,
                  cursor: 'pointer',
                }}
              >
                <X size={18} />
              </button>
            </div>
          </div>

          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            style={{
              background: isResolved
                ? 'linear-gradient(135deg, rgba(16, 185, 129, 0.25), rgba(0, 212, 255, 0.25))'
                : 'linear-gradient(135deg, rgba(239, 68, 68, 0.2), rgba(0, 212, 255, 0.2))',
              border: `1px solid ${isResolved ? '#10B981' : '#00D4FF'}`,
              borderRadius: 14,
              padding: '10px 18px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              color: isResolved ? '#10B981' : '#00D4FF',
              fontSize: 13,
              fontWeight: 800,
              fontFamily: 'var(--font-heading)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 18 }}>{isResolved ? '🎉' : '🚨'}</span>
              <span>
                {isResolved
                  ? 'Incident Successfully Resolved — Ward 4 Corridor Fully Operational!'
                  : `Emergency Response Command Protocol Active — ${missionStatusLabel.toUpperCase()} EN ROUTE`}
              </span>
            </div>
            <span style={{ fontSize: 10, color: '#fff', background: isResolved ? '#10B981' : '#00D4FF', padding: '2px 8px', borderRadius: 6, fontFamily: 'var(--font-mono)' }}>
              {isResolved ? 'RESOLVED & VERIFIED' : 'ACTIVE DISPATCH'}
            </span>
          </motion.div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <motion.div
                animate={{ scale: [1, 1.15, 1] }}
                transition={{ duration: 1.2, repeat: Infinity }}
                style={{
                  width: 46,
                  height: 46,
                  borderRadius: 14,
                  background: 'rgba(239, 68, 68, 0.2)',
                  border: '1px solid rgba(239, 68, 68, 0.5)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: '0 0 20px rgba(239, 68, 68, 0.4)',
                }}
              >
                <ShieldAlert size={26} color="#EF4444" />
              </motion.div>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{
                    padding: '2px 8px',
                    borderRadius: 6,
                    background: '#EF444420',
                    color: '#EF4444',
                    fontSize: 10,
                    fontWeight: 800,
                    fontFamily: 'var(--font-mono)',
                  }}>
                    COMMAND CENTER ACTIVE DISPATCH
                  </span>
                  <span style={{ color: '#00D4FF', fontSize: 11, fontFamily: 'var(--font-mono)', fontWeight: 700 }}>
                    INC-2026-8492
                  </span>
                </div>
                <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: 20, fontWeight: 800, color: '#F8FAFC', margin: '4px 0 0 0' }}>
                  Smart City Rapid Emergency Response Simulation
                </h3>
              </div>
            </div>
          </div>

          <div style={{
            background: 'rgba(7, 11, 20, 0.7)',
            border: '1px solid rgba(0, 212, 255, 0.2)',
            borderRadius: 18,
            padding: 20,
            marginBottom: 24,
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: '#F8FAFC' }}>
                Operational Phase Status: <span style={{ color: '#00D4FF' }}>{currentStage.label.toUpperCase()}</span>
              </span>
              <span style={{ fontSize: 13, fontFamily: 'var(--font-mono)', fontWeight: 800, color: '#00D4FF' }}>
                {missionCompletion}% Complete
              </span>
            </div>

            <div style={{ height: 8, background: 'rgba(255,255,255,0.08)', borderRadius: 4, overflow: 'hidden', marginBottom: 16 }}>
              <motion.div
                initial={{ width: '0%' }}
                animate={{ width: `${missionCompletion}%` }}
                transition={{ duration: 0.6 }}
                style={{ height: '100%', background: 'linear-gradient(90deg, #00D4FF, #10B981)' }}
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 6 }}>
              {STAGES.map((stage, idx) => {
                const isPassed = idx <= currentStageIdx;
                const isCurrent = idx === currentStageIdx;

                return (
                  <motion.div
                    key={stage.id}
                    animate={isCurrent ? { scale: [1, 1.04, 1], boxShadow: ['0 0 0px rgba(0,212,255,0)', '0 0 14px rgba(0,212,255,0.6)', '0 0 0px rgba(0,212,255,0)'] } : {}}
                    transition={{ duration: 1.2, repeat: isCurrent ? Infinity : 0 }}
                    style={{
                      padding: '8px 6px',
                      borderRadius: 10,
                      background: isCurrent
                        ? 'rgba(0, 212, 255, 0.2)'
                        : isPassed
                          ? 'rgba(16, 185, 129, 0.12)'
                          : 'rgba(255,255,255,0.03)',
                      border: isCurrent
                        ? '1px solid #00D4FF'
                        : isPassed
                          ? '1px solid rgba(16, 185, 129, 0.3)'
                          : '1px solid transparent',
                      color: isCurrent ? '#00D4FF' : isPassed ? '#10B981' : '#64748B',
                      fontSize: 10,
                      fontWeight: 800,
                      textAlign: 'center',
                    }}
                  >
                    {isPassed ? '✓ ' : ''}{stage.label}
                  </motion.div>
                );
              })}
            </div>
          </div>

          <div style={{
            background: 'rgba(7, 11, 20, 0.85)',
            border: '1px solid rgba(0, 212, 255, 0.25)',
            borderRadius: 18,
            padding: 16,
            marginBottom: 20,
            position: 'relative',
            overflow: 'hidden',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <div style={{ fontSize: 12, fontWeight: 800, color: '#00D4FF', display: 'flex', alignItems: 'center', gap: 6, fontFamily: 'var(--font-heading)' }}>
                <Navigation size={16} />
                LIVE MISSION CONTROL ROUTE CORRIDOR MAP · WARD 4 METRO
              </div>
              <span style={{ fontSize: 10, background: 'rgba(16,185,129,0.2)', color: '#10B981', padding: '2px 8px', borderRadius: 6, fontFamily: 'var(--font-mono)', fontWeight: 700 }}>
                TRAFFIC CLEARANCE ACTIVE
              </span>
            </div>

            <div style={{ height: 64, width: '100%', position: 'relative', background: 'rgba(255,255,255,0.02)', borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 24px' }}>
              <svg width="100%" height="100%" style={{ position: 'absolute', inset: 0 }}>
                <line x1="10%" y1="50%" x2="90%" y2="50%" stroke="rgba(0,212,255,0.2)" strokeWidth="4" strokeDasharray="6 6" />
                <motion.line
                  x1="10%" y1="50%" x2="75%" y2="50%"
                  stroke="#00D4FF"
                  strokeWidth="4"
                  initial={{ strokeDashoffset: 100 }}
                  animate={{ strokeDashoffset: 0 }}
                  transition={{ duration: 2, repeat: Infinity }}
                />
              </svg>

              <div style={{ zIndex: 2, display: 'flex', alignItems: 'center', gap: 8, background: '#111827', padding: '4px 10px', borderRadius: 8, border: '1px solid rgba(0,212,255,0.4)' }}>
                <span style={{ fontSize: 14 }}>🏢</span>
                <span style={{ fontSize: 11, fontWeight: 700, color: '#F8FAFC' }}>Station 04 Depot</span>
              </div>

              <div style={{ zIndex: 2, display: 'flex', alignItems: 'center', gap: 8, background: '#111827', padding: '4px 10px', borderRadius: 8, border: '1px solid rgba(239,68,68,0.5)' }}>
                <span style={{ fontSize: 14 }}>🚨</span>
                <span style={{ fontSize: 11, fontWeight: 800, color: '#EF4444' }}>Incident Site (Ward 4)</span>
              </div>
            </div>
          </div>

          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 14, fontWeight: 800, color: '#F8FAFC', marginBottom: 14, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
              <span>Live Dispatched Emergency Fleet Telemetry & Road Navigation</span>
              <span style={{ fontSize: 11, color: '#94A3B8', fontFamily: 'var(--font-mono)' }}>5 Operational Units Active</span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {EMERGENCY_UNITS.map((unit, idx) => {
                const vehicleState = vehicleStates[idx];
                const currentPos = vehicleState?.positionPercent ?? unit.initialPositionPercent;
                const isPrimary = idx === 0;

                return (
                  <motion.div
                    key={unit.id}
                    whileHover={{ scale: 1.01 }}
                    style={{
                      background: isPrimary ? 'rgba(0, 212, 255, 0.08)' : 'rgba(17, 24, 39, 0.85)',
                      backdropFilter: 'blur(20px)',
                      border: isPrimary ? '2px solid #00D4FF' : `1px solid ${unit.color}33`,
                      boxShadow: isPrimary ? '0 0 30px rgba(0, 212, 255, 0.3)' : '0 8px 24px rgba(0,0,0,0.4)',
                      borderRadius: 20,
                      padding: 20,
                      position: 'relative',
                    }}
                  >
                    {isPrimary && (
                      <div style={{ position: 'absolute', top: -10, right: 20, background: 'linear-gradient(135deg, #00D4FF, #8B5CF6)', color: '#fff', fontSize: 10, fontWeight: 900, padding: '2px 10px', borderRadius: 999, fontFamily: 'var(--font-mono)' }}>
                        ⚡ HIGHEST PRIORITY DISPATCH
                      </div>
                    )}

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <span style={{ fontSize: 20 }}>{unit.icon}</span>
                          <h4 style={{ fontFamily: 'var(--font-heading)', fontSize: 16, fontWeight: 800, color: '#F8FAFC', margin: 0 }}>
                            {unit.name}
                          </h4>
                          <span style={{
                            padding: '3px 10px',
                            borderRadius: 8,
                            fontSize: 10,
                            fontWeight: 800,
                            fontFamily: 'var(--font-mono)',
                            background: isResolved ? 'rgba(16,185,129,0.2)' : isPrimary ? 'rgba(0,212,255,0.2)' : 'rgba(245,158,11,0.2)',
                            color: isResolved ? '#10B981' : isPrimary ? '#00D4FF' : '#F59E0B',
                            border: `1px solid ${isResolved ? '#10B981' : isPrimary ? '#00D4FF' : '#F59E0B'}`,
                          }}>
                            {isResolved ? 'REPAIR COMPLETE' : isPrimary ? vehicleStatusLabel.toUpperCase() : (vehicleState?.status || 'DISPATCHING').toUpperCase()}
                          </span>
                        </div>
                        <div style={{ fontSize: 12, color: '#94A3B8', marginTop: 4, display: 'flex', gap: 16 }}>
                          <span>Department: <strong style={{ color: '#F8FAFC' }}>Water & Road Infrastructure Bureau</strong></span>
                          <span>Crew Leader: <strong style={{ color: '#00D4FF' }}>Insp. Suresh Nair</strong></span>
                        </div>
                      </div>

                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: 11, color: '#94A3B8' }}>Live Distance</div>
                        <div style={{ fontSize: 14, fontWeight: 800, color: '#F8FAFC', fontFamily: 'var(--font-mono)' }}>
                          {formatDistance(vehicleState?.distanceMeters ?? unit.initialDistanceMeters)}
                        </div>
                        <div style={{ background: `${unit.color}25`, color: unit.color, padding: '3px 10px', borderRadius: 8, fontWeight: 900, fontFamily: 'var(--font-mono)', fontSize: 12, marginTop: 4 }}>
                          ETA {formatCountdown(vehicleState?.etaSeconds ?? unit.initialEtaSeconds)}
                        </div>
                      </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, fontSize: 11, background: 'rgba(255,255,255,0.03)', padding: 10, borderRadius: 12, marginBottom: 14 }}>
                      <div>
                        <span style={{ color: '#64748B' }}>Equipment Onboard: </span>
                        <span style={{ color: '#F8FAFC', fontWeight: 600 }}>Cold-Patch Asphalt Paver, Hydro-Vac Excavator</span>
                      </div>
                      <div>
                        <span style={{ color: '#64748B' }}>Current Corridor Status: </span>
                        <span style={{ color: '#00D4FF', fontWeight: 600 }}>
                          {isResolved ? 'Work Order Successfully Completed' : `${vehicleState?.status || 'Dispatching'} along Ward 4 Main Corridor`}
                        </span>
                      </div>
                    </div>

                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: '#64748B', fontFamily: 'var(--font-mono)', marginBottom: 4 }}>
                        <span>Station 04 Depot</span>
                        <span>Mission Progress: {Math.round(currentPos)}%</span>
                        <span>Ward 4 Corridor</span>
                      </div>
                      <div style={{ position: 'relative', height: 20, background: 'rgba(7, 11, 20, 0.9)', borderRadius: 10, overflow: 'hidden', padding: '0 8px', border: '1px solid rgba(255,255,255,0.08)' }}>
                        <div style={{ position: 'absolute', top: 9, left: 10, right: 10, height: 2, background: `linear-gradient(90deg, ${unit.color}, rgba(255,255,255,0.1))` }} />
                        <motion.div
                          animate={{ left: `${currentPos}%` }}
                          transition={{ duration: 0.4, ease: 'easeOut' }}
                          style={{
                            position: 'absolute',
                            top: 1,
                            fontSize: 14,
                            transform: 'translateX(-50%)',
                            zIndex: 3,
                          }}
                        >
                          {unit.icon}
                        </motion.div>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </div>

          <div style={{
            padding: 18,
            background: 'linear-gradient(135deg, rgba(0, 212, 255, 0.08), rgba(139, 92, 246, 0.08))',
            border: '1px solid rgba(0, 212, 255, 0.3)',
            borderRadius: 20,
            marginBottom: 20,
            fontSize: 12,
          }}>
            <div style={{ color: '#00D4FF', fontWeight: 900, fontSize: 13, marginBottom: 6, display: 'flex', alignItems: 'center', gap: 8 }}>
              <span>🧠 AI Mission Control Vehicle Selection Justification</span>
              <span style={{ fontSize: 10, background: 'rgba(16,185,129,0.2)', color: '#10B981', padding: '2px 8px', borderRadius: 6, fontFamily: 'var(--font-mono)' }}>
                98.6% SUCCESS PROBABILITY
              </span>
            </div>
            <p style={{ color: '#F8FAFC', lineHeight: 1.6, margin: '0 0 10px 0' }}>
              Heavy Utility Repair Truck #08 was selected based on optimal 1.4km proximity to Ward 4 Metro Corridor, specialized hydro-vacuum excavator availability, and 98.6% historical SLA convergence rate.
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, color: '#94A3B8', fontSize: 11, fontFamily: 'var(--font-mono)', background: 'rgba(255,255,255,0.03)', padding: 10, borderRadius: 12 }}>
              <div>Distance: <strong style={{ color: '#F8FAFC' }}>{formatDistance(vehicleStates[0]?.distanceMeters ?? 1400)}</strong></div>
              <div>Availability: <strong style={{ color: '#10B981' }}>{isResolved ? 'MISSION COMPLETE' : missionStatusLabel.toUpperCase()}</strong></div>
              <div>Required Equipment: <strong style={{ color: '#00D4FF' }}>Hydro-Vac Paver</strong></div>
              <div>Success Rate: <strong style={{ color: '#10B981' }}>{missionCompletion}%</strong></div>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: 16 }}>
            <div style={{ fontSize: 11, color: '#94A3B8', display: 'flex', alignItems: 'center', gap: 6 }}>
              <Radio size={14} color="#10B981" />
              Real-Time Smart City Command Protocol Active · 5 Emergency Fleet Units Operating
            </div>

            <button
              onClick={onClose}
              style={{
                padding: '12px 24px',
                background: 'linear-gradient(135deg, #10B981, #059669)',
                color: '#fff',
                border: 'none',
                borderRadius: 14,
                fontWeight: 800,
                fontSize: 13,
                fontFamily: 'var(--font-heading)',
                cursor: 'pointer',
                boxShadow: '0 4px 20px rgba(16, 185, 129, 0.4)',
              }}
            >
              Acknowledge Simulation & Close HUD
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
