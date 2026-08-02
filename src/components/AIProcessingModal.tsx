import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Upload, ScanLine, Cpu, Search, AlertTriangle,
  Copy, MapPin, Brain, FileText, PackagePlus,
  CheckCircle2, Sparkles
} from 'lucide-react';
import type { Incident } from '../types';

interface AIProcessingModalProps {
  isOpen: boolean;
  incident: Incident | null;
  onComplete: (incident: Incident) => void;
  onClose: () => void;
}

interface ProcessingStep {
  id: string;
  label: string;
  icon: React.ReactNode;
  detail: string;
  durationMs: number;
}

const STEPS: ProcessingStep[] = [
  { id: 'upload',       label: 'Uploading Image',                icon: <Upload size={18} />,         detail: 'Securely transmitting 4.2 MB image to AI pipeline…',          durationMs: 800 },
  { id: 'scan',         label: 'Scanning Infrastructure',        icon: <ScanLine size={18} />,       detail: 'Analyzing pixel grid for infrastructure anomalies…',          durationMs: 1100 },
  { id: 'cv',           label: 'Running Computer Vision Model',  icon: <Cpu size={18} />,            detail: 'YOLOv11x + SAM Defect Segmenter processing at 98.6% conf…',  durationMs: 1400 },
  { id: 'detect',       label: 'Detecting Object',               icon: <Search size={18} />,         detail: 'Object classified: Pothole — Depth > 18cm detected',         durationMs: 900 },
  { id: 'severity',     label: 'Estimating Severity',            icon: <AlertTriangle size={18} />,  detail: 'Multi-factor severity assessment: HIGH / CRITICAL range',     durationMs: 700 },
  { id: 'duplicates',   label: 'Checking Nearby Duplicates',     icon: <Copy size={18} />,           detail: 'Cross-referencing 14 duplicate complaints in 500m radius…',   durationMs: 1000 },
  { id: 'gps',          label: 'Finding GPS Location',           icon: <MapPin size={18} />,         detail: 'Reverse geocoding: 12.9732°N, 77.5962°E — Victoria Rd',      durationMs: 600 },
  { id: 'priority',     label: 'Calculating AI Priority Score',  icon: <Brain size={18} />,          detail: 'XAI Engine: Hospital proximity +22, Traffic +12, History +15', durationMs: 1200 },
  { id: 'summary',      label: 'Generating AI Summary',          icon: <FileText size={18} />,       detail: 'LLM narrative generation with Gemini Pro context…',           durationMs: 1000 },
  { id: 'create',       label: 'Creating Incident',              icon: <PackagePlus size={18} />,    detail: 'Writing to CivicSense AI incident ledger…',                   durationMs: 600 },
  { id: 'done',         label: 'Completed',                      icon: <CheckCircle2 size={18} />,   detail: 'Incident created successfully. AI Priority Score: 96/100',    durationMs: 0 },
];

/* ─── Pulsing AI Orb ─── */
const AIPulse: React.FC = () => (
  <div style={{ position: 'relative', width: 64, height: 64, margin: '0 auto 24px' }}>
    {/* Outer glow rings */}
    {[0, 1, 2].map((i) => (
      <motion.div
        key={i}
        style={{
          position: 'absolute',
          inset: -8 * (i + 1),
          borderRadius: '50%',
          border: '1px solid rgba(0, 212, 255, 0.12)',
        }}
        animate={{
          scale: [1, 1.15, 1],
          opacity: [0.3, 0.08, 0.3],
        }}
        transition={{
          duration: 2.4,
          repeat: Infinity,
          delay: i * 0.4,
          ease: 'easeInOut',
        }}
      />
    ))}
    {/* Core orb */}
    <motion.div
      style={{
        width: 64,
        height: 64,
        borderRadius: '50%',
        background: 'radial-gradient(circle at 35% 35%, #00D4FF, #0EA5E9 50%, #0369A1)',
        boxShadow: '0 0 40px rgba(0, 212, 255, 0.4), inset 0 0 20px rgba(255,255,255,0.15)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
      animate={{
        scale: [1, 1.06, 1],
        boxShadow: [
          '0 0 40px rgba(0, 212, 255, 0.4), inset 0 0 20px rgba(255,255,255,0.15)',
          '0 0 60px rgba(0, 212, 255, 0.6), inset 0 0 30px rgba(255,255,255,0.2)',
          '0 0 40px rgba(0, 212, 255, 0.4), inset 0 0 20px rgba(255,255,255,0.15)',
        ],
      }}
      transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
    >
      <Sparkles size={28} color="#fff" />
    </motion.div>
  </div>
);

/* ─── Individual Step Row ─── */
const StepRow: React.FC<{
  step: ProcessingStep;
  status: 'pending' | 'active' | 'done';
  index: number;
}> = ({ step, status, index }) => {
  const isActive = status === 'active';
  const isDone = status === 'done';

  return (
    <motion.div
      initial={{ opacity: 0, x: -16 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.06, duration: 0.35, ease: 'easeOut' }}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 14,
        padding: '10px 16px',
        borderRadius: 12,
        background: isActive ? 'rgba(0, 212, 255, 0.06)' : 'transparent',
        border: isActive ? '1px solid rgba(0, 212, 255, 0.18)' : '1px solid transparent',
        transition: 'all 0.3s ease',
        minHeight: 48,
      }}
    >
      {/* Icon / check */}
      <div
        style={{
          width: 32,
          height: 32,
          borderRadius: 8,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          background: isDone
            ? 'rgba(16, 185, 129, 0.15)'
            : isActive
            ? 'rgba(0, 212, 255, 0.12)'
            : 'rgba(255,255,255,0.04)',
          color: isDone ? '#10B981' : isActive ? '#00D4FF' : '#475569',
          transition: 'all 0.3s ease',
        }}
      >
        {isDone ? <CheckCircle2 size={16} /> : step.icon}
      </div>

      {/* Label & detail */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize: 13,
            fontWeight: 600,
            fontFamily: 'var(--font-body)',
            color: isDone ? '#10B981' : isActive ? '#F8FAFC' : '#64748B',
            transition: 'color 0.3s',
          }}
        >
          {step.label}
        </div>
        <AnimatePresence>
          {isActive && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.25 }}
              style={{
                fontSize: 11,
                fontFamily: 'var(--font-mono)',
                color: '#94A3B8',
                marginTop: 2,
                overflow: 'hidden',
              }}
            >
              {step.detail}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Status indicator */}
      <div style={{ flexShrink: 0, width: 20, display: 'flex', justifyContent: 'center' }}>
        {isDone && (
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: 'spring' as const, stiffness: 400, damping: 20 }}
          >
            <CheckCircle2 size={16} color="#10B981" />
          </motion.div>
        )}
        {isActive && (
          <motion.div
            style={{
              width: 8,
              height: 8,
              borderRadius: '50%',
              background: '#00D4FF',
            }}
            animate={{
              scale: [1, 1.5, 1],
              opacity: [1, 0.5, 1],
            }}
            transition={{ duration: 1, repeat: Infinity }}
          />
        )}
      </div>
    </motion.div>
  );
};

/* ─── Main Modal ─── */
export const AIProcessingModal: React.FC<AIProcessingModalProps> = ({
  isOpen,
  incident,
  onComplete,
  onClose,
}) => {
  const [activeIndex, setActiveIndex] = useState(-1);
  const [finished, setFinished] = useState(false);

  const runProcessing = useCallback(() => {
    setActiveIndex(0);
    setFinished(false);

    let idx = 0;
    const advance = () => {
      if (idx >= STEPS.length - 1) {
        setActiveIndex(STEPS.length - 1);
        setFinished(true);
        return;
      }
      const delay = STEPS[idx].durationMs;
      setTimeout(() => {
        idx++;
        setActiveIndex(idx);
        advance();
      }, delay);
    };
    advance();
  }, []);

  useEffect(() => {
    if (isOpen && incident) {
      const timer = setTimeout(() => runProcessing(), 400);
      return () => clearTimeout(timer);
    } else {
      setActiveIndex(-1);
      setFinished(false);
    }
  }, [isOpen, incident, runProcessing]);

  /* Auto-navigate after completion */
  useEffect(() => {
    if (finished && incident) {
      const timeout = setTimeout(() => {
        onComplete(incident);
      }, 1800);
      return () => clearTimeout(timeout);
    }
  }, [finished, incident, onComplete]);

  const progressPct = activeIndex < 0 ? 0 : Math.round(((activeIndex + 1) / STEPS.length) * 100);

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          key="ai-processing-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.35 }}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'rgba(0, 0, 0, 0.75)',
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
          }}
          onClick={(e: React.MouseEvent) => { if (e.target === e.currentTarget && finished) onClose(); }}
        >
          <motion.div
            initial={{ scale: 0.92, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.92, opacity: 0, y: 20 }}
            transition={{ duration: 0.4, ease: [0.4, 0, 0.2, 1] as const }}
            style={{
              width: '100%',
              maxWidth: 520,
              maxHeight: '90vh',
              overflowY: 'auto',
              background: 'rgba(17, 24, 39, 0.92)',
              backdropFilter: 'blur(40px)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              borderRadius: 24,
              padding: '36px 28px 28px',
              position: 'relative',
            }}
          >
            {/* Top accent line */}
            <div
              style={{
                position: 'absolute',
                top: 0,
                left: '10%',
                right: '10%',
                height: 2,
                borderRadius: 2,
                background: 'linear-gradient(90deg, transparent, #00D4FF, #8B5CF6, transparent)',
                opacity: 0.6,
              }}
            />

            {/* AI Pulse Orb */}
            <AIPulse />

            {/* Title */}
            <div style={{ textAlign: 'center', marginBottom: 8 }}>
              <h2
                style={{
                  fontFamily: 'var(--font-heading)',
                  fontSize: 20,
                  fontWeight: 700,
                  color: '#F8FAFC',
                  margin: 0,
                  letterSpacing: '-0.02em',
                }}
              >
                {finished ? 'Incident Created Successfully' : 'AI Processing Pipeline'}
              </h2>
              <p
                style={{
                  fontFamily: 'var(--font-body)',
                  fontSize: 13,
                  color: '#94A3B8',
                  margin: '6px 0 0',
                }}
              >
                {finished
                  ? 'Redirecting to incident details…'
                  : 'CivicSense AI is analyzing your submission'}
              </p>
            </div>

            {/* Progress bar */}
            <div
              style={{
                margin: '20px 0 24px',
                height: 4,
                borderRadius: 2,
                background: 'rgba(255,255,255,0.06)',
                overflow: 'hidden',
              }}
            >
              <motion.div
                style={{
                  height: '100%',
                  borderRadius: 2,
                  background: finished
                    ? 'linear-gradient(90deg, #10B981, #059669)'
                    : 'linear-gradient(90deg, #00D4FF, #8B5CF6)',
                  boxShadow: finished
                    ? '0 0 12px rgba(16, 185, 129, 0.5)'
                    : '0 0 12px rgba(0, 212, 255, 0.5)',
                }}
                animate={{ width: `${progressPct}%` }}
                transition={{ duration: 0.5, ease: 'easeOut' }}
              />
            </div>

            {/* Percentage & Time */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: 16,
                padding: '0 4px',
              }}
            >
              <span
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: 12,
                  fontWeight: 600,
                  color: finished ? '#10B981' : '#00D4FF',
                }}
              >
                {progressPct}%
              </span>
              <span
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: 11,
                  color: '#64748B',
                }}
              >
                {activeIndex >= 0 ? `Step ${Math.min(activeIndex + 1, STEPS.length)} of ${STEPS.length}` : 'Initializing…'}
              </span>
            </div>

            {/* Steps list */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {STEPS.map((step, idx) => (
                <StepRow
                  key={step.id}
                  step={step}
                  index={idx}
                  status={
                    idx < activeIndex ? 'done' : idx === activeIndex ? 'active' : 'pending'
                  }
                />
              ))}
            </div>

            {/* Completed state */}
            <AnimatePresence>
              {finished && incident && (
                <motion.div
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3, duration: 0.4 }}
                  style={{
                    marginTop: 24,
                    padding: 20,
                    background: 'rgba(16, 185, 129, 0.08)',
                    border: '1px solid rgba(16, 185, 129, 0.2)',
                    borderRadius: 16,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ type: 'spring' as const, stiffness: 300, damping: 18, delay: 0.4 }}
                    >
                      <CheckCircle2 size={24} color="#10B981" />
                    </motion.div>
                    <span
                      style={{
                        fontFamily: 'var(--font-heading)',
                        fontSize: 15,
                        fontWeight: 700,
                        color: '#10B981',
                      }}
                    >
                      Incident {incident.id}
                    </span>
                  </div>
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '1fr 1fr',
                      gap: '8px 16px',
                      fontSize: 12,
                    }}
                  >
                    <div>
                      <div style={{ color: '#64748B', fontFamily: 'var(--font-body)', marginBottom: 2 }}>Type</div>
                      <div style={{ color: '#F8FAFC', fontWeight: 600, textTransform: 'capitalize' }}>{incident.type.replace('_', ' ')}</div>
                    </div>
                    <div>
                      <div style={{ color: '#64748B', fontFamily: 'var(--font-body)', marginBottom: 2 }}>Severity</div>
                      <div style={{ color: incident.severity === 'critical' ? '#EF4444' : '#F59E0B', fontWeight: 600, textTransform: 'capitalize' }}>{incident.severity}</div>
                    </div>
                    <div>
                      <div style={{ color: '#64748B', fontFamily: 'var(--font-body)', marginBottom: 2 }}>Priority Score</div>
                      <div style={{ color: '#00D4FF', fontWeight: 700, fontFamily: 'var(--font-mono)' }}>{incident.priorityScore}/100</div>
                    </div>
                    <div>
                      <div style={{ color: '#64748B', fontFamily: 'var(--font-body)', marginBottom: 2 }}>Ward</div>
                      <div style={{ color: '#F8FAFC', fontWeight: 600 }}>{incident.wardName.split(' - ')[0]}</div>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
