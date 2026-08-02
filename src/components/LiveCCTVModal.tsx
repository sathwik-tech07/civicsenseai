import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Video, ShieldAlert, Wifi, MapPin } from 'lucide-react';

interface LiveCCTVModalProps {
  isOpen: boolean;
  incidentId: string;
  incidentLocation?: string;
  lat?: number;
  lng?: number;
  onClose: () => void;
}

export const LiveCCTVModal: React.FC<LiveCCTVModalProps> = ({
  isOpen,
  incidentId,
  incidentLocation,
  lat,
  lng,
  onClose,
}) => {
  const [time, setTime] = useState<string>('');
  
  useEffect(() => {
    if (!isOpen) return;
    const interval = setInterval(() => {
      const now = new Date();
      setTime(now.toLocaleTimeString('en-US', { hour12: false }) + ':' + now.getMilliseconds().toString().padStart(3, '0'));
    }, 47);
    return () => clearInterval(interval);
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 9999,
          background: 'rgba(7, 11, 20, 0.95)',
          backdropFilter: 'blur(12px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: 'var(--font-mono)'
        }}
      >
        <motion.div
          initial={{ scale: 0.95, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          style={{
            position: 'relative',
            width: '90vw',
            maxWidth: '1000px',
            height: '70vh',
            maxHeight: '700px',
            background: '#000',
            borderRadius: '16px',
            overflow: 'hidden',
            border: '1px solid rgba(0, 212, 255, 0.3)',
            boxShadow: '0 0 40px rgba(0, 212, 255, 0.1), inset 0 0 20px rgba(0,0,0,0.8)'
          }}
        >
          {/* Header Bar */}
          <div style={{
            position: 'absolute',
            top: 0, left: 0, right: 0,
            padding: '12px 20px',
            background: 'linear-gradient(180deg, rgba(0,0,0,0.8) 0%, transparent 100%)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            zIndex: 10
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#EF4444', fontWeight: 'bold' }}>
                <motion.div
                  animate={{ opacity: [1, 0, 1] }}
                  transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
                  style={{ width: 10, height: 10, borderRadius: '50%', background: '#EF4444', boxShadow: '0 0 10px #EF4444' }}
                />
                REC
              </div>
              <div style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                <Wifi size={14} style={{ display: 'inline', marginRight: 4 }} />
                STREAM ESTABLISHED
              </div>
            </div>
            
            <button
              onClick={onClose}
              style={{
                background: 'rgba(255,255,255,0.1)',
                border: 'none',
                color: '#fff',
                padding: '8px',
                borderRadius: '50%',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                backdropFilter: 'blur(4px)'
              }}
            >
              <X size={18} />
            </button>
          </div>

          {/* Simulated CCTV Background Image */}
          <div style={{
            position: 'absolute',
            inset: 0,
            backgroundImage: 'url("https://images.unsplash.com/photo-1541888946425-d0fbb186a5b3?q=80&w=1200")',
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            filter: 'contrast(1.2) brightness(0.7) grayscale(0.2)',
            zIndex: 1
          }} />

          {/* Glitch & Scanline Overlay */}
          <div style={{
            position: 'absolute',
            inset: 0,
            background: 'linear-gradient(rgba(18, 16, 16, 0) 50%, rgba(0, 0, 0, 0.25) 50%), linear-gradient(90deg, rgba(255, 0, 0, 0.06), rgba(0, 255, 0, 0.02), rgba(0, 0, 255, 0.06))',
            backgroundSize: '100% 4px, 3px 100%',
            pointerEvents: 'none',
            zIndex: 2,
            opacity: 0.7
          }} />

          {/* AI Bounding Box */}
          <motion.div
            initial={{ opacity: 0, scale: 1.1 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.5, duration: 0.3 }}
            style={{
              position: 'absolute',
              top: '40%',
              left: '35%',
              width: '25%',
              height: '30%',
              border: '2px solid #00D4FF',
              background: 'rgba(0, 212, 255, 0.1)',
              zIndex: 3
            }}
          >
            <div style={{
              position: 'absolute',
              top: '-24px',
              left: '-2px',
              background: '#00D4FF',
              color: '#000',
              fontSize: '12px',
              fontWeight: 700,
              padding: '2px 8px',
              display: 'flex',
              alignItems: 'center',
              gap: '4px'
            }}>
              <ShieldAlert size={12} />
              YOLOv11x [98.4%]
            </div>
            {/* Corner brackets */}
            <div style={{ position: 'absolute', top: -5, left: -5, width: 10, height: 10, borderTop: '2px solid #fff', borderLeft: '2px solid #fff' }} />
            <div style={{ position: 'absolute', top: -5, right: -5, width: 10, height: 10, borderTop: '2px solid #fff', borderRight: '2px solid #fff' }} />
            <div style={{ position: 'absolute', bottom: -5, left: -5, width: 10, height: 10, borderBottom: '2px solid #fff', borderLeft: '2px solid #fff' }} />
            <div style={{ position: 'absolute', bottom: -5, right: -5, width: 10, height: 10, borderBottom: '2px solid #fff', borderRight: '2px solid #fff' }} />
          </motion.div>

          {/* Target Crosshair */}
          <motion.div
            animate={{ x: [0, 20, -10, 0], y: [0, 15, -5, 0] }}
            transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
            style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              width: '40px',
              height: '40px',
              border: '1px solid rgba(255,255,255,0.4)',
              borderRadius: '50%',
              zIndex: 4,
              transform: 'translate(-50%, -50%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            <div style={{ position: 'absolute', width: '2px', height: '10px', background: '#fff', top: -5 }} />
            <div style={{ position: 'absolute', width: '2px', height: '10px', background: '#fff', bottom: -5 }} />
            <div style={{ position: 'absolute', width: '10px', height: '2px', background: '#fff', left: -5 }} />
            <div style={{ position: 'absolute', width: '10px', height: '2px', background: '#fff', right: -5 }} />
            <div style={{ width: 4, height: 4, background: '#EF4444', borderRadius: '50%' }} />
          </motion.div>

          {/* Footer Telemetry */}
          <div style={{
            position: 'absolute',
            bottom: 0, left: 0, right: 0,
            padding: '16px 20px',
            background: 'linear-gradient(0deg, rgba(0,0,0,0.9) 0%, transparent 100%)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-end',
            zIndex: 10,
            color: 'var(--text-primary)',
            fontSize: '0.85rem'
          }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <div style={{ color: '#00D4FF', fontWeight: 700, fontSize: '1rem' }}>CAM-042 • SECTOR 7</div>
              <div>LOC: {incidentLocation || 'Metro Health Corridor'}</div>
              <div>GPS: {lat?.toFixed(4) || '12.9716'}°N, {lng?.toFixed(4) || '77.5946'}°E</div>
            </div>
            
            <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <div style={{ color: '#10B981', fontWeight: 600 }}>INCIDENT ID: {incidentId}</div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: '1.2rem', color: '#fff', letterSpacing: '2px' }}>
                {time}
              </div>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};
