import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Wifi, Battery, Signal, Smartphone } from 'lucide-react';

interface Props {
  children: React.ReactNode;
}

export const MobileEmulatorFrame: React.FC<Props> = ({ children }) => {
  const [time, setTime] = useState('');

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setTime(now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false }));
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div style={{
      width: '100%',
      minHeight: 'calc(100vh - 80px)', // account for navbar
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'radial-gradient(circle at center, rgba(139, 92, 246, 0.1) 0%, transparent 60%)',
      padding: '40px 0'
    }}>
      <motion.div 
        initial={{ y: 50, opacity: 0, scale: 0.95 }}
        animate={{ y: 0, opacity: 1, scale: 1 }}
        transition={{ type: 'spring', damping: 25, stiffness: 200 }}
        style={{
          width: '390px', // iPhone 14 Pro width
          height: '844px', // iPhone 14 Pro height
          background: '#000',
          borderRadius: '55px',
          boxShadow: '0 0 0 12px #1E293B, 0 30px 60px rgba(0,0,0,0.6), inset 0 0 0 2px rgba(255,255,255,0.1)',
          position: 'relative',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column'
        }}
      >
        {/* Dynamic Island / Notch Area */}
        <div style={{
          position: 'absolute',
          top: 14,
          left: '50%',
          transform: 'translateX(-50%)',
          width: '120px',
          height: '32px',
          background: '#000',
          borderRadius: '16px',
          zIndex: 1000,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 10px',
          boxShadow: 'inset 0 0 4px rgba(255,255,255,0.1)'
        }}>
          {/* Camera Lens */}
          <div style={{
            width: 12,
            height: 12,
            borderRadius: '50%',
            background: 'radial-gradient(circle at top left, #475569 0%, #000 70%)',
            border: '1px solid rgba(255,255,255,0.05)'
          }} />
          {/* Privacy Dot */}
          <motion.div 
            animate={{ opacity: [0.2, 1, 0.2] }}
            transition={{ duration: 3, repeat: Infinity }}
            style={{ width: 4, height: 4, borderRadius: '50%', background: '#10B981', boxShadow: '0 0 4px #10B981' }} 
          />
        </div>

        {/* Status Bar */}
        <div style={{
          height: '54px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '0 24px',
          fontSize: '14px',
          fontWeight: 600,
          color: '#fff',
          zIndex: 999,
          fontFamily: 'system-ui, -apple-system, sans-serif'
        }}>
          <div>{time}</div>
          <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
            <Signal size={14} />
            <Wifi size={14} />
            <Battery size={16} />
          </div>
        </div>

        {/* Inner Content (Citizen App) */}
        <div style={{ 
          flex: 1, 
          overflowY: 'auto', 
          overflowX: 'hidden',
          background: '#070B14', // Base theme color
          position: 'relative'
        }}>
          {/* The actual mobile reporter goes here */}
          {children}
        </div>

        {/* Home Indicator */}
        <div style={{
          height: '34px',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          background: '#070B14'
        }}>
          <div style={{
            width: '140px',
            height: '5px',
            background: 'rgba(255,255,255,0.4)',
            borderRadius: '10px'
          }} />
        </div>
      </motion.div>

      {/* Decorative Elements */}
      <div style={{
        position: 'absolute',
        top: '20%',
        right: '10%',
        color: 'var(--text-muted)',
        fontFamily: 'var(--font-heading)',
        fontSize: '24px',
        opacity: 0.2,
        display: 'flex',
        alignItems: 'center',
        gap: '12px'
      }}>
        <Smartphone size={32} />
        CIVICSENSE CITIZEN APP PREVIEW
      </div>
    </div>
  );
};
