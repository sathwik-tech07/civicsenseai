import React from 'react';
import { motion } from 'framer-motion';
import { CheckCircle, Clock, Zap, Brain } from 'lucide-react';

export const AIRoadmapModal: React.FC = () => {
  const milestones = [
    { 
      quarter: 'Q3 2026', 
      title: 'Current Platform (Active)', 
      status: 'active',
      features: ['Predictive Incident Scoring', 'Citizen App Gamification', 'Ward Analytics Dashboard'],
      progress: 85
    },
    { 
      quarter: 'Q4 2026', 
      title: 'Automated Dispatch Phase', 
      status: 'upcoming',
      features: ['AI Crew Routing', 'Automated Work Orders', 'IoT Sensor Integration'],
      progress: 30
    },
    { 
      quarter: 'Q1 2027', 
      title: 'City-Scale Digital Twin', 
      status: 'planned',
      features: ['3D Infrastructure Mapping', 'Real-time Traffic Impact', 'Weather Integration'],
      progress: 0
    },
    { 
      quarter: 'Q2 2027', 
      title: 'Autonomous Budgeting', 
      status: 'planned',
      features: ['AI Fund Allocation', 'Cost Prediction Engine', 'Vendor Optimization'],
      progress: 0
    },
    { 
      quarter: 'Q4 2027', 
      title: 'Predictive Maintenance 2.0', 
      status: 'planned',
      features: ['Pre-failure Interventions', 'Material Degradation Modeling'],
      progress: 0
    },
    { 
      quarter: 'Q2 2028', 
      title: 'Full Autonomous Civic Brain', 
      status: 'planned',
      features: ['Self-healing City Grids', 'Autonomous Drone Inspections'],
      progress: 0
    }
  ];

  return (
    <div style={{ 
      padding: '2.5rem', 
      fontFamily: 'var(--font-body)', 
      color: 'var(--text-primary)',
      background: 'var(--bg-base)',
      minHeight: '100vh'
    }}>
      <div style={{ maxWidth: '900px', margin: '0 auto' }}>
        
        <motion.div 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          style={{ textAlign: 'center', marginBottom: '4rem' }}
        >
          <div style={{ display: 'inline-flex', padding: '1rem', background: 'var(--bg-elevated)', borderRadius: '50%', marginBottom: '1rem', border: '1px solid var(--border)' }}>
            <Brain color="var(--accent)" size={40} />
          </div>
          <h1 style={{ margin: 0, fontFamily: 'var(--font-heading)', fontSize: '2.5rem' }}>AI Intelligence Roadmap 2028</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '1.1rem', maxWidth: '600px', margin: '1rem auto 0' }}>
            The evolutionary path of CivicSense AI towards a fully autonomous, self-healing urban infrastructure grid.
          </p>
        </motion.div>

        <div style={{ position: 'relative', paddingLeft: '2rem' }}>
          {/* Vertical Line */}
          <div style={{ 
            position: 'absolute', top: 0, bottom: 0, left: '2rem', width: '2px', 
            background: 'linear-gradient(to bottom, var(--accent) 0%, var(--border) 20%, var(--border) 100%)' 
          }} />

          {milestones.map((m, idx) => {
            const isActive = m.status === 'active';
            
            return (
              <motion.div
                key={m.quarter}
                initial={{ opacity: 0, x: -30 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: idx * 0.15, type: 'spring', stiffness: 100 }}
                style={{ 
                  position: 'relative', 
                  paddingLeft: '3rem', 
                  marginBottom: '3rem',
                }}
              >
                {/* Timeline Dot */}
                <div style={{
                  position: 'absolute', left: '-6px', top: '24px', width: '14px', height: '14px',
                  borderRadius: '50%', background: isActive ? 'var(--accent)' : 'var(--bg-card)',
                  border: `2px solid ${isActive ? '#fff' : 'var(--border)'}`,
                  boxShadow: isActive ? '0 0 10px var(--accent)' : 'none',
                  zIndex: 2
                }} />

                <div style={{
                  background: isActive ? 'var(--bg-elevated)' : 'var(--bg-card)',
                  border: `1px solid ${isActive ? 'var(--border-accent)' : 'var(--border)'}`,
                  borderRadius: '16px',
                  padding: '1.5rem',
                  boxShadow: isActive ? '0 8px 30px var(--accent-glow)' : 'none',
                  position: 'relative',
                  overflow: 'hidden'
                }}>
                  {isActive && <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '2px', background: 'var(--accent)' }} />}
                  
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
                    <div>
                      <div style={{ color: 'var(--accent)', fontWeight: 'bold', fontFamily: 'var(--font-mono)', fontSize: '0.9rem', marginBottom: '0.25rem' }}>
                        {m.quarter}
                      </div>
                      <h3 style={{ margin: 0, fontSize: '1.4rem', fontFamily: 'var(--font-heading)' }}>{m.title}</h3>
                    </div>
                    <span style={{ 
                      padding: '4px 10px', 
                      borderRadius: '99px', 
                      fontSize: '0.75rem', 
                      fontWeight: 600,
                      textTransform: 'uppercase',
                      background: isActive ? 'rgba(0,212,255,0.1)' : m.status === 'upcoming' ? 'rgba(139,92,246,0.1)' : 'rgba(255,255,255,0.05)',
                      color: isActive ? 'var(--accent)' : m.status === 'upcoming' ? 'var(--violet)' : 'var(--text-muted)',
                      display: 'flex', alignItems: 'center', gap: '4px'
                    }}>
                      {isActive ? <Zap size={12} /> : m.status === 'upcoming' ? <Clock size={12} /> : <CheckCircle size={12} />}
                      {m.status}
                    </span>
                  </div>

                  <ul style={{ paddingLeft: '1.5rem', color: 'var(--text-secondary)', margin: '0 0 1.5rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    {m.features.map(f => (
                      <li key={f} style={{ listStyleType: 'disc' }}>{f}</li>
                    ))}
                  </ul>

                  {(isActive || m.status === 'upcoming') && (
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>
                        <span>Development Progress</span>
                        <span>{m.progress}%</span>
                      </div>
                      <div style={{ height: '6px', background: 'var(--border)', borderRadius: '3px', overflow: 'hidden' }}>
                        <motion.div 
                          initial={{ width: 0 }}
                          animate={{ width: `${m.progress}%` }}
                          transition={{ duration: 1, delay: 0.5 + idx * 0.1 }}
                          style={{ height: '100%', background: isActive ? 'var(--accent)' : 'var(--violet)' }}
                        />
                      </div>
                    </div>
                  )}

                </div>
              </motion.div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
