import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, BrainCircuit, Activity, Car, Copy, CloudRain, Clock, Truck } from 'lucide-react';
import type { Incident } from '../types';

interface Props {
  incident: Incident | null;
  onClose: () => void;
  onDispatchCrew: (incidentId: string) => void;
}

export const ExplainableAIModal: React.FC<Props> = ({ incident, onClose, onDispatchCrew }) => {
  return (
    <AnimatePresence>
      {incident && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 100, display: 'flex', justifyContent: 'flex-end' }}>
          {/* Backdrop Overlay */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            style={{
              position: 'absolute',
              inset: 0,
              background: 'rgba(7,11,20,0.7)',
              backdropFilter: 'blur(8px)'
            }}
          />
          
          {/* Drawer */}
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="glass-elevated"
            style={{
              position: 'relative',
              width: '520px',
              maxWidth: '100%',
              height: '100%',
              background: 'var(--bg-elevated)',
              borderLeft: '1px solid var(--border)',
              display: 'flex',
              flexDirection: 'column',
              boxShadow: '-10px 0 30px rgba(0,0,0,0.5)',
              fontFamily: 'var(--font-body)'
            }}
          >
            {/* Header */}
            <div style={{ padding: '1.5rem', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
                  <BrainCircuit color="var(--accent)" size={24} />
                  <span style={{ 
                    background: incident.severity === 'critical' ? 'rgba(239,68,68,0.2)' : 'rgba(245,158,11,0.2)',
                    color: incident.severity === 'critical' ? 'var(--critical)' : 'var(--warning)',
                    padding: '2px 8px',
                    borderRadius: '4px',
                    fontSize: '0.75rem',
                    fontWeight: 'bold',
                    textTransform: 'uppercase'
                  }}>
                    {incident.severity}
                  </span>
                </div>
                <h2 style={{ margin: 0, color: 'var(--text-primary)', fontSize: '1.25rem', fontFamily: 'var(--font-heading)' }}>
                  {incident.title}
                </h2>
              </div>
              <button 
                onClick={onClose}
                style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', padding: '4px' }}
              >
                <X size={24} />
              </button>
            </div>

            {/* Content Scrollable */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '2rem' }}>
              
              {/* Priority Score */}
              <div style={{ textAlign: 'center', padding: '2rem', background: 'rgba(0,0,0,0.2)', borderRadius: 'var(--radius-xl)', border: '1px solid var(--border)' }}>
                <div style={{ color: 'var(--text-secondary)', textTransform: 'uppercase', fontSize: '0.85rem', letterSpacing: '1px', marginBottom: '0.5rem' }}>AI Priority Score</div>
                <motion.div 
                  initial={{ scale: 0.5, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ type: 'spring', delay: 0.2 }}
                  style={{ 
                    fontSize: '4rem', 
                    fontWeight: 800, 
                    color: incident.priorityScore > 85 ? 'var(--critical)' : 'var(--accent)',
                    fontFamily: 'var(--font-heading)',
                    lineHeight: 1,
                    textShadow: incident.priorityScore > 85 ? '0 0 20px rgba(239,68,68,0.4)' : '0 0 20px var(--accent-glow)'
                  }}
                >
                  {incident.priorityScore}
                </motion.div>
                <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: '0.5rem' }}>Model: {incident.xai.cvModel}</div>
              </div>

              {/* Factors */}
              <div>
                <h3 style={{ margin: '0 0 1rem', color: 'var(--text-primary)', fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Activity size={18} color="var(--accent)" /> Explanatory Factors
                </h3>
                
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  {[
                    { label: 'CV Confidence', val: incident.xai.cvConfidence * 100, max: 100, unit: '%', icon: <BrainCircuit size={16}/> },
                    { label: 'Hospital Proximity', val: Math.max(0, 100 - (incident.xai.hospitalProximityMeters/10)), max: 100, unit: ' risk', icon: <Activity size={16}/> },
                    { label: 'Traffic Impact', val: incident.xai.estimatedDailyTraffic / 100, max: 100, unit: 'k vol', icon: <Car size={16}/> },
                    { label: 'Duplicate Reports', val: incident.xai.duplicateComplaintsCount * 10, max: 100, unit: 'x weight', icon: <Copy size={16}/> },
                    { label: 'Historical Failure', val: incident.xai.historicalFailureRate * 100, max: 100, unit: '%', icon: <Clock size={16}/> }
                  ].map((factor, idx) => (
                    <div key={idx}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem', fontSize: '0.85rem' }}>
                        <span style={{ color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          {factor.icon} {factor.label}
                        </span>
                        <span style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>{factor.val.toFixed(0)}{factor.unit}</span>
                      </div>
                      <div style={{ height: '6px', background: 'var(--border)', borderRadius: '3px', overflow: 'hidden' }}>
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${Math.min(100, factor.val)}%` }}
                          transition={{ delay: 0.3 + idx * 0.1, duration: 0.8 }}
                          style={{ height: '100%', background: 'var(--accent)', borderRadius: '3px' }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Categorical Factors */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div style={{ background: 'var(--bg-card)', padding: '1rem', borderRadius: '12px', border: '1px solid var(--border)' }}>
                  <div style={{ color: 'var(--text-secondary)', fontSize: '0.75rem', marginBottom: '0.25rem' }}>Road Type</div>
                  <div style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{incident.xai.roadClassification}</div>
                </div>
                <div style={{ background: 'var(--bg-card)', padding: '1rem', borderRadius: '12px', border: '1px solid var(--border)' }}>
                  <div style={{ color: 'var(--text-secondary)', fontSize: '0.75rem', marginBottom: '0.25rem' }}>Weather Risk</div>
                  <div style={{ color: 'var(--warning)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                    <CloudRain size={16} /> {incident.xai.weatherRiskFactor}
                  </div>
                </div>
              </div>

              {/* Financial Analysis */}
              <div style={{ borderTop: '1px dashed var(--border)', paddingTop: '1.5rem' }}>
                <h3 style={{ margin: '0 0 1rem', color: 'var(--text-primary)', fontSize: '1rem' }}>Cost Analysis</h3>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                  <div>
                    <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Est. Repair Cost</div>
                    <div style={{ color: 'var(--text-primary)', fontSize: '1.5rem', fontWeight: 'bold', fontFamily: 'var(--font-mono)' }}>
                      ${incident.estimatedRepairCost.toLocaleString()}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ color: 'var(--success)', fontSize: '0.85rem' }}>Saved by Early Intervention</div>
                    <div style={{ color: 'var(--success)', fontSize: '1.5rem', fontWeight: 'bold', fontFamily: 'var(--font-mono)' }}>
                      +${incident.savedEarlyIntervention.toLocaleString()}
                    </div>
                  </div>
                </div>
              </div>

            </div>

            {/* Actions */}
            <div style={{ padding: '1.5rem', borderTop: '1px solid var(--border)', display: 'flex', gap: '1rem' }}>
              <button
                onClick={onClose}
                style={{ 
                  flex: 1, padding: '0.75rem', background: 'transparent', color: 'var(--text-primary)', 
                  border: '1px solid var(--border)', borderRadius: '8px', cursor: 'pointer', fontWeight: 600
                }}
              >
                Close
              </button>
              <button
                onClick={() => onDispatchCrew(incident.id)}
                style={{ 
                  flex: 2, padding: '0.75rem', background: 'var(--accent)', color: '#000', 
                  border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold',
                  display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.5rem',
                  boxShadow: '0 0 15px var(--accent-glow)'
                }}
              >
                <Truck size={18} /> Dispatch Crew Now
              </button>
            </div>

          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
