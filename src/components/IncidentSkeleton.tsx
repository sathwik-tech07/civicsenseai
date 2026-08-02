import React from 'react';
import { motion } from 'framer-motion';

export const IncidentSkeleton: React.FC = () => {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      style={{
        padding: '24px',
        borderRadius: 'var(--radius-xl)',
        background: 'var(--bg-card)',
        border: '1px solid var(--border)',
        display: 'flex',
        flexDirection: 'column',
        gap: '16px',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      <div
        className="skeleton-shimmer"
        style={{
          position: 'absolute',
          top: 0,
          left: '-100%',
          width: '50%',
          height: '100%',
          background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.05), transparent)',
          animation: 'shimmer 1.5s infinite',
        }}
      />
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ width: '60%', height: '24px', borderRadius: '4px', background: 'rgba(255,255,255,0.1)' }} />
        <div style={{ width: '80px', height: '24px', borderRadius: '12px', background: 'rgba(255,255,255,0.1)' }} />
      </div>
      <div style={{ width: '40%', height: '16px', borderRadius: '4px', background: 'rgba(255,255,255,0.05)' }} />
      <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
        <div style={{ width: '100px', height: '32px', borderRadius: '16px', background: 'rgba(255,255,255,0.05)' }} />
        <div style={{ width: '100px', height: '32px', borderRadius: '16px', background: 'rgba(255,255,255,0.05)' }} />
      </div>
      
      {/* Injecting CSS for the shimmer animation */}
      <style>
        {`
          @keyframes shimmer {
            100% { left: 100%; }
          }
        `}
      </style>
    </motion.div>
  );
};
