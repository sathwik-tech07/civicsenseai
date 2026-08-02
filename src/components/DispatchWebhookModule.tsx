import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Terminal, CheckCircle2, ShieldAlert } from 'lucide-react';

interface DispatchWebhookModuleProps {
  crewName?: string;
  incidentId?: string;
  onComplete?: () => void;
}

export const DispatchWebhookModule: React.FC<DispatchWebhookModuleProps> = ({
  crewName = 'Alpha-1 Rapid Response',
  incidentId = 'INC-2026-X',
  onComplete,
}) => {
  const [logs, setLogs] = useState<string[]>([]);
  const [isFinished, setIsFinished] = useState(false);

  useEffect(() => {
    const sequence = [
      `> INITIATING DISPATCH PROTOCOL FOR ${incidentId}...`,
      `> RESOLVING NEAREST AVAILABLE RAPID RESPONSE CREW...`,
      `> [MATCH FOUND] CREW ${crewName.toUpperCase()}`,
      `> PINGING SLACK API: POST /api/webhooks/dispatch`,
      `> SLACK RESPONSE: 200 OK (Message Delivered)`,
      `> PINGING TWILIO SMS API FOR OFFLINE ALERTS...`,
      `> SMS DELIVERED TO FIELD COMMANDER (+91 98*** ****)`,
      `> DISPATCH SUCCESSFUL. ETA: 12 MINS`,
    ];

    let currentStep = 0;
    
    const tick = () => {
      if (currentStep < sequence.length) {
        setLogs(prev => [...prev, sequence[currentStep]]);
        currentStep++;
        const nextDelay = currentStep === 3 || currentStep === 5 ? 800 : 300;
        setTimeout(tick, nextDelay);
      } else {
        setIsFinished(true);
        setTimeout(() => {
          if (onComplete) onComplete();
        }, 3000);
      }
    };

    setTimeout(tick, 500);
    
    return () => {};
  }, [crewName, incidentId, onComplete]);

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 50, scale: 0.9 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95, filter: 'blur(10px)' }}
        style={{
          position: 'fixed',
          bottom: '40px',
          right: '40px',
          width: '400px',
          background: 'rgba(7, 11, 20, 0.95)',
          backdropFilter: 'blur(16px)',
          border: '1px solid rgba(0, 212, 255, 0.3)',
          borderRadius: '12px',
          boxShadow: '0 10px 40px rgba(0, 212, 255, 0.15)',
          zIndex: 10000,
          overflow: 'hidden',
          fontFamily: 'var(--font-mono)'
        }}
      >
        {/* Terminal Header */}
        <div style={{
          padding: '10px 16px',
          background: 'rgba(0, 212, 255, 0.1)',
          borderBottom: '1px solid rgba(0, 212, 255, 0.2)',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          color: '#00D4FF',
          fontSize: '0.85rem',
          fontWeight: 700
        }}>
          <Terminal size={16} />
          AUTOMATED DISPATCH TERMINAL
        </div>
        
        {/* Terminal Body */}
        <div style={{ padding: '16px', minHeight: '180px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {logs.map((log, index) => {
            const isSuccess = log.includes('SUCCESS');
            const isWarning = log.includes('MATCH FOUND');
            return (
              <motion.div
                key={index}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                style={{
                  fontSize: '0.8rem',
                  color: isSuccess ? '#10B981' : isWarning ? '#F59E0B' : '#94A3B8',
                  fontWeight: isSuccess || isWarning ? 700 : 400
                }}
              >
                {log}
              </motion.div>
            );
          })}
          
          {!isFinished && (
            <motion.div
              animate={{ opacity: [1, 0, 1] }}
              transition={{ repeat: Infinity, duration: 0.8 }}
              style={{ width: '8px', height: '14px', background: '#00D4FF', marginTop: '4px' }}
            />
          )}

          {isFinished && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              style={{
                marginTop: '16px',
                padding: '12px',
                background: 'rgba(16, 185, 129, 0.1)',
                border: '1px solid rgba(16, 185, 129, 0.3)',
                borderRadius: '8px',
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                color: '#10B981'
              }}
            >
              <CheckCircle2 size={24} />
              <div>
                <div style={{ fontWeight: 700, fontSize: '0.9rem' }}>Crew Deployed successfully</div>
                <div style={{ fontSize: '0.75rem', marginTop: '2px', color: '#A7F3D0' }}>Closing terminal...</div>
              </div>
            </motion.div>
          )}
        </div>
      </motion.div>
    </AnimatePresence>
  );
};
