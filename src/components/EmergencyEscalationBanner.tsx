import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { AlertTriangle, X, Radio, ChevronUp, ChevronDown } from 'lucide-react';

interface Props {
  onDismiss: () => void;
  onAcknowledgeAndDeploy?: () => void;
}

export const EmergencyEscalationBanner: React.FC<Props> = ({ onDismiss, onAcknowledgeAndDeploy }) => {
  const [isCollapsed, setIsCollapsed] = useState(false);

  return (
    <motion.div
      initial={{ y: -100, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      exit={{ y: -100, opacity: 0 }}
      transition={{ type: 'spring', damping: 20, stiffness: 100 }}
      style={{
        width: '100%',
        background: 'rgba(239, 68, 68, 0.12)',
        backdropFilter: 'blur(16px)',
        borderBottom: '1px solid rgba(239, 68, 68, 0.35)',
        padding: isCollapsed ? '0.35rem 1rem' : '0.75rem 1.5rem',
        position: 'relative',
        overflow: 'hidden',
        fontFamily: 'var(--font-body)',
        zIndex: 50,
        boxShadow: '0 10px 30px rgba(239, 68, 68, 0.15)',
        transition: 'padding 0.3s ease',
      }}
    >
      {/* Animated Border Glow */}
      <motion.div 
        animate={{ opacity: [0.3, 0.8, 0.3] }}
        transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          height: '2px',
          background: 'var(--critical)',
          boxShadow: '0 0 15px var(--critical)'
        }}
      />

      <div style={{ maxWidth: '100%', margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem' }}>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <motion.div
            animate={{ scale: [1, 1.2, 1] }}
            transition={{ duration: 1, repeat: Infinity }}
            style={{ 
              background: 'var(--critical)', 
              color: '#fff', 
              padding: isCollapsed ? '0.25rem' : '0.4rem', 
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 0 12px rgba(239,68,68,0.5)'
            }}
          >
            <AlertTriangle size={isCollapsed ? 16 : 20} />
          </motion.div>
          
          <div>
            <h3 style={{ margin: 0, color: 'var(--text-primary)', fontSize: isCollapsed ? '0.85rem' : '1rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              EMERGENCY ESCALATION <Radio size={14} color="var(--critical)" />
              {isCollapsed && (
                <span style={{ fontSize: '0.75rem', color: 'var(--critical)', fontFamily: 'var(--font-mono)' }}>
                  [Ward 4 Water Main · 98% Risk]
                </span>
              )}
            </h3>
            {!isCollapsed && (
              <p style={{ margin: '0.15rem 0 0', color: 'var(--text-secondary)', fontSize: '0.825rem' }}>
                AI detected critical failure in <strong style={{color:'var(--text-primary)'}}>Ward 4 Water Mains</strong>. Predictive flood risk: <strong style={{color:'var(--critical)'}}>98%</strong> in next 2 hours.
              </p>
            )}
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <button
            onClick={onAcknowledgeAndDeploy}
            style={{
              background: 'var(--critical)',
              color: '#fff',
              border: 'none',
              padding: isCollapsed ? '0.25rem 0.75rem' : '0.4rem 1.25rem',
              borderRadius: '6px',
              fontWeight: 700,
              cursor: 'pointer',
              boxShadow: '0 0 10px rgba(239,68,68,0.4)',
              textTransform: 'uppercase',
              fontSize: isCollapsed ? '0.75rem' : '0.8rem',
              letterSpacing: '0.5px'
            }}
          >
            Acknowledge & Deploy
          </button>

          <button 
            onClick={() => setIsCollapsed(!isCollapsed)}
            title={isCollapsed ? "Expand Banner" : "Collapse Banner"}
            style={{
              background: 'rgba(255,255,255,0.05)',
              border: '1px solid var(--border)',
              color: 'var(--text-secondary)',
              padding: '0.35rem',
              borderRadius: '6px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            {isCollapsed ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
          </button>
          
          <button 
            onClick={onDismiss}
            title="Dismiss Alert"
            style={{
              background: 'transparent',
              border: '1px solid var(--border)',
              color: 'var(--text-secondary)',
              padding: '0.35rem',
              borderRadius: '6px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            <X size={16} />
          </button>
        </div>

      </div>
    </motion.div>
  );
};
