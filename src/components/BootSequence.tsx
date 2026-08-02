import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Terminal, ShieldCheck } from 'lucide-react';

interface Props {
  onComplete: () => void;
}

export const BootSequence: React.FC<Props> = ({ onComplete }) => {
  const [logs, setLogs] = useState<string[]>([]);
  const [progress, setProgress] = useState(0);
  const [phase, setPhase] = useState<'booting' | 'ready'>('booting');

  useEffect(() => {
    const sequence = [
      '[SYS] Initializing CivicSense Kernel v5.4.1...',
      '[NET] Establishing secure uplink to central mainframe...',
      '[OK] Uplink established (Latency: 12ms)',
      '[GIS] Loading 3D spatial twin textures...',
      '[GIS] Injecting Mapbox Vector Tiles...',
      '[OK] 3D Twin Engine Online.',
      '[AI] Waking up Neural Ensembles...',
      '[AI] Model 1 (XGBoost) - Ready',
      '[AI] Model 2 (YOLOv11x) - Ready',
      '[AI] Model 3 (Prophet) - Ready',
      '[OK] AI Cores synchronized.',
      '[SYS] Running final integrity checks...',
      '[OK] ALL SYSTEMS NOMINAL.',
      '> READY FOR COMMAND INPUT.'
    ];

    let currentLog = 0;
    
    const interval = setInterval(() => {
      if (currentLog < sequence.length) {
        setLogs(prev => [...prev, sequence[currentLog]]);
        setProgress(Math.floor(((currentLog + 1) / sequence.length) * 100));
        currentLog++;
      } else {
        clearInterval(interval);
        setPhase('ready');
        setTimeout(() => {
          onComplete();
        }, 1200);
      }
    }, 200); // Fast typing effect

    return () => clearInterval(interval);
  }, [onComplete]);

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 1 }}
        exit={{ opacity: 0, scale: 1.05, filter: 'blur(20px)' }}
        transition={{ duration: 0.8, ease: 'easeInOut' }}
        style={{
          position: 'fixed',
          inset: 0,
          background: '#04070D',
          zIndex: 99999,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: 'var(--font-mono)',
          color: '#00D4FF',
          overflow: 'hidden'
        }}
      >
        {/* Background Grid */}
        <div style={{
          position: 'absolute',
          inset: 0,
          backgroundImage: 'linear-gradient(rgba(0, 212, 255, 0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(0, 212, 255, 0.05) 1px, transparent 1px)',
          backgroundSize: '40px 40px',
          backgroundPosition: 'center center',
          opacity: 0.4
        }} />

        <motion.div
          animate={{ opacity: phase === 'ready' ? 0 : 1 }}
          transition={{ duration: 0.4 }}
          style={{ width: '100%', maxWidth: '600px', zIndex: 10 }}
        >
          {/* Logo / Header */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 40, justifyContent: 'center' }}>
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 8, repeat: Infinity, ease: 'linear' }}
              style={{
                width: 60, height: 60,
                borderRadius: '50%',
                border: '2px dashed #00D4FF',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 0 30px rgba(0, 212, 255, 0.2)'
              }}
            >
              <Terminal size={28} color="#00D4FF" />
            </motion.div>
            <div>
              <h1 style={{ 
                margin: 0, 
                fontSize: 32, 
                fontFamily: 'var(--font-heading)',
                fontWeight: 800,
                letterSpacing: 2,
                color: '#F8FAFC'
              }}>
                CIVICSENSE OS
              </h1>
              <div style={{ color: '#94A3B8', fontSize: 12, letterSpacing: 4 }}>COMMAND CENTER INITIALIZATION</div>
            </div>
          </div>

          {/* Terminal Logs */}
          <div style={{
            height: '220px',
            background: 'rgba(0,0,0,0.6)',
            border: '1px solid rgba(0, 212, 255, 0.2)',
            borderRadius: 8,
            padding: 16,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'flex-end',
            gap: 8,
            overflow: 'hidden',
            boxShadow: 'inset 0 0 20px rgba(0,0,0,0.8)'
          }}>
            {logs.map((log, i) => {
              if (!log) return null;
              const isOk = log.includes('[OK]');
              const isReady = log.includes('> READY');
              return (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  style={{
                    fontSize: 13,
                    color: isReady ? '#10B981' : isOk ? '#00D4FF' : '#94A3B8',
                    fontWeight: isReady || isOk ? 700 : 400
                  }}
                >
                  {log}
                </motion.div>
              );
            })}
          </div>

          {/* Progress Bar */}
          <div style={{ marginTop: 30 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 8, color: '#94A3B8' }}>
              <span>SYSTEM BOOT</span>
              <span>{progress}%</span>
            </div>
            <div style={{
              width: '100%',
              height: 4,
              background: 'rgba(255,255,255,0.1)',
              borderRadius: 4,
              overflow: 'hidden'
            }}>
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${progress}%` }}
                style={{
                  height: '100%',
                  background: '#00D4FF',
                  boxShadow: '0 0 10px #00D4FF'
                }}
              />
            </div>
          </div>
        </motion.div>

        {/* Ready Flash */}
        <AnimatePresence>
          {phase === 'ready' && (
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              style={{
                position: 'absolute',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 16
              }}
            >
              <ShieldCheck size={80} color="#10B981" />
              <h2 style={{ color: '#10B981', fontSize: 32, fontFamily: 'var(--font-heading)', letterSpacing: 6 }}>
                ACCESS GRANTED
              </h2>
            </motion.div>
          )}
        </AnimatePresence>

      </motion.div>
    </AnimatePresence>
  );
};
