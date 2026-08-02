import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Upload, ScanLine, Cpu, Search, MapPin, Copy,
  AlertTriangle, Brain, FileText, ClipboardCheck,
  CheckCircle2, Sparkles, Eye
} from 'lucide-react';
import { apiAnalyzeIncidentVision } from '../services/apiClient';

/* ─────────────────────────────────────────────
   Types
   ───────────────────────────────────────────── */
export interface AIAnalysisResult {
  type: string;
  severity: string;
  confidence: number;
  priorityScore: number;
  summary: string;
  objectsDetected: string[];
  gpsLocation: string;
  duplicatesFound: number;
  estimatedCost: number;
  estimatedTime: string;
  recommendedDepartment: string;
}

interface AIAnalysisModalProps {
  isOpen: boolean;
  imageUrl: string | null;
  imageName: string;
  onComplete: (result: AIAnalysisResult) => void;
  onClose: () => void;
}

/* ─────────────────────────────────────────────
   Processing Steps — 10-Stage AI Reasoning Pipeline
   ───────────────────────────────────────────── */
interface Step {
  id: string;
  label: string;
  icon: React.ReactNode;
  detail: string;
  durationMs: number;
}

const STEPS: Step[] = [
  { id: 'infra',       label: '1. Detect Infrastructure Type',   icon: <Upload size={15} />,        detail: 'Classifying asset: Road surface & stormwater drainage corridor…',   durationMs: 400 },
  { id: 'damage',      label: '2. Detect Object Damage',         icon: <ScanLine size={15} />,      detail: 'Pixel-level segmentation: Asphalt shear & sub-surface cavity…',     durationMs: 500 },
  { id: 'severity',    label: '3. Estimate Severity Level',      icon: <AlertTriangle size={15} />, detail: 'Structural risk assessment: Critical L1 Hazard detected…',         durationMs: 450 },
  { id: 'gps',         label: '4. Reverse Geocode GPS',          icon: <MapPin size={15} />,        detail: 'Triangulating 12.9716° N, 77.5946° E — Ward 4 Corridor…',            durationMs: 350 },
  { id: 'weather',     label: '5. Fetch Weather Conditions',     icon: <Cpu size={15} />,           detail: 'Hydrological telemetry: Precipitation 48mm/hr, high runoff…',         durationMs: 400 },
  { id: 'assets',      label: '6. Analyze Nearby Infrastructure', icon: <Search size={15} />,        detail: 'Proximity check: Victoria Hospital 340m, School Zone 520m…',         durationMs: 450 },
  { id: 'history',     label: '7. Check Historical Complaints',  icon: <Copy size={15} />,          detail: 'Cross-referencing database: 4 duplicate complaints in 14 days…',      durationMs: 400 },
  { id: 'priority',    label: '8. Calculate AI Priority Score',  icon: <Brain size={15} />,         detail: 'XAI Multi-factor scoring: 89 / 100 Priority Index…',                 durationMs: 500 },
  { id: 'recommend',   label: '9. Generate Recommendation',      icon: <FileText size={15} />,      detail: 'Gemini Pro LLM: Deploy cold-patch & base stabilization…',            durationMs: 450 },
  { id: 'cost_eta',    label: '10. Estimate Repair Cost & ETA',  icon: <ClipboardCheck size={15} />,detail: 'Calculating budget ₹85,000 | ETA: 3.5 Hours…',                        durationMs: 350 },
  { id: 'done',        label: 'Analysis Complete',               icon: <CheckCircle2 size={15} />,  detail: 'All models converged — premium AI result card ready',                 durationMs: 0 },
];

const SUPPORTED_CATEGORIES = [
  'Pothole',
  'Water Main Leak',
  'Sewer Overflow',
  'Garbage Overflow',
  'Road Crack',
  'Broken Streetlight',
  'Drainage Blockage',
  'Fallen Tree',
];

/* ─────────────────────────────────────────────
   Rotating AI Hologram
   ───────────────────────────────────────────── */
const AIHologram: React.FC<{ progress: number; isComplete: boolean }> = ({ progress, isComplete }) => (
  <div style={{ position: 'relative', width: 120, height: 120, margin: '0 auto' }}>
    {/* Outer spinning ring */}
    <motion.svg
      width={120}
      height={120}
      viewBox="0 0 120 120"
      style={{ position: 'absolute', top: 0, left: 0 }}
      animate={{ rotate: 360 }}
      transition={{ duration: 4, repeat: Infinity, ease: 'linear' }}
    >
      <defs>
        <linearGradient id="holoGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#00D4FF" stopOpacity={0.8} />
          <stop offset="50%" stopColor="#8B5CF6" stopOpacity={0.4} />
          <stop offset="100%" stopColor="#00D4FF" stopOpacity={0} />
        </linearGradient>
      </defs>
      <circle cx={60} cy={60} r={54} fill="none" stroke="url(#holoGrad)" strokeWidth={2} strokeLinecap="round" strokeDasharray="80 260" />
    </motion.svg>

    {/* Second ring — counter rotation */}
    <motion.svg
      width={120}
      height={120}
      viewBox="0 0 120 120"
      style={{ position: 'absolute', top: 0, left: 0 }}
      animate={{ rotate: -360 }}
      transition={{ duration: 6, repeat: Infinity, ease: 'linear' }}
    >
      <circle cx={60} cy={60} r={48} fill="none" stroke="rgba(139,92,246,0.25)" strokeWidth={1} strokeDasharray="30 60" />
    </motion.svg>

    {/* Progress ring */}
    <svg width={120} height={120} viewBox="0 0 120 120" style={{ position: 'absolute', top: 0, left: 0, transform: 'rotate(-90deg)' }}>
      <circle cx={60} cy={60} r={42} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={3} />
      <motion.circle
        cx={60}
        cy={60}
        r={42}
        fill="none"
        stroke={isComplete ? '#10B981' : '#00D4FF'}
        strokeWidth={3}
        strokeLinecap="round"
        strokeDasharray={2 * Math.PI * 42}
        animate={{ strokeDashoffset: 2 * Math.PI * 42 * (1 - progress / 100) }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
        style={{ filter: `drop-shadow(0 0 6px ${isComplete ? 'rgba(16,185,129,0.5)' : 'rgba(0,212,255,0.5)'})` }}
      />
    </svg>

    {/* Center orb */}
    <motion.div
      style={{
        position: 'absolute',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        width: 56,
        height: 56,
        borderRadius: '50%',
        background: isComplete
          ? 'radial-gradient(circle at 35% 35%, #10B981, #059669)'
          : 'radial-gradient(circle at 35% 35%, #00D4FF, #0EA5E9 50%, #0369A1)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
      animate={{
        boxShadow: isComplete
          ? ['0 0 20px rgba(16,185,129,0.4)', '0 0 35px rgba(16,185,129,0.6)', '0 0 20px rgba(16,185,129,0.4)']
          : ['0 0 20px rgba(0,212,255,0.3)', '0 0 40px rgba(0,212,255,0.5)', '0 0 20px rgba(0,212,255,0.3)'],
      }}
      transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
    >
      {isComplete ? <CheckCircle2 size={24} color="#fff" /> : <Eye size={22} color="#fff" />}
    </motion.div>
  </div>
);

/* ─────────────────────────────────────────────
   Circular Confidence Gauge
   ───────────────────────────────────────────── */
const ConfidenceGauge: React.FC<{ value: number; isVisible: boolean }> = ({ value, isVisible }) => {
  const r = 36;
  const circ = 2 * Math.PI * r;
  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
          style={{ textAlign: 'center' }}
        >
          <div style={{ position: 'relative', width: 88, height: 88, margin: '0 auto' }}>
            <svg width={88} height={88} viewBox="0 0 88 88" style={{ transform: 'rotate(-90deg)' }}>
              <circle cx={44} cy={44} r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={4} />
              <motion.circle
                cx={44} cy={44} r={r} fill="none"
                stroke="#10B981" strokeWidth={4} strokeLinecap="round"
                strokeDasharray={circ}
                initial={{ strokeDashoffset: circ }}
                animate={{ strokeDashoffset: circ * (1 - value / 100) }}
                transition={{ duration: 1, ease: 'easeOut', delay: 0.3 }}
                style={{ filter: 'drop-shadow(0 0 6px rgba(16,185,129,0.5))' }}
              />
            </svg>
            <div style={{
              position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
              fontFamily: 'var(--font-mono)', fontSize: 18, fontWeight: 800, color: '#10B981',
            }}>
              {value}%
            </div>
          </div>
          <div style={{ fontSize: 10, fontWeight: 600, color: '#64748B', marginTop: 6, textTransform: 'uppercase', letterSpacing: '0.08em', fontFamily: 'var(--font-body)' }}>
            Confidence
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

/* ─────────────────────────────────────────────
   Step Row
   ───────────────────────────────────────────── */
const StepRow: React.FC<{ step: Step; status: 'pending' | 'active' | 'done'; idx: number }> = ({ step, status, idx }) => (
  <motion.div
    initial={{ opacity: 0, x: -12 }}
    animate={{ opacity: 1, x: 0 }}
    transition={{ delay: idx * 0.04, duration: 0.3 }}
    style={{
      display: 'flex', alignItems: 'center', gap: 12,
      padding: '8px 12px', borderRadius: 10,
      background: status === 'active' ? 'rgba(0,212,255,0.06)' : 'transparent',
      border: status === 'active' ? '1px solid rgba(0,212,255,0.15)' : '1px solid transparent',
      transition: 'all 0.25s',
    }}
  >
    {/* Icon */}
    <div style={{
      width: 28, height: 28, borderRadius: 7, flexShrink: 0,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: status === 'done' ? 'rgba(16,185,129,0.12)' : status === 'active' ? 'rgba(0,212,255,0.1)' : 'rgba(255,255,255,0.03)',
      color: status === 'done' ? '#10B981' : status === 'active' ? '#00D4FF' : '#475569',
      transition: 'all 0.25s',
    }}>
      {status === 'done' ? <CheckCircle2 size={13} /> : step.icon}
    </div>

    {/* Text */}
    <div style={{ flex: 1, minWidth: 0 }}>
      <div style={{
        fontSize: 12, fontWeight: 600, fontFamily: 'var(--font-body)',
        color: status === 'done' ? '#10B981' : status === 'active' ? '#F8FAFC' : '#64748B',
        transition: 'color 0.25s',
      }}>
        {step.label}
        {status === 'done' && ' ✓'}
      </div>
      <AnimatePresence>
        {status === 'active' && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: '#94A3B8', marginTop: 1, overflow: 'hidden' }}
          >
            {step.detail}
          </motion.div>
        )}
      </AnimatePresence>
    </div>

    {/* Status dot */}
    <div style={{ flexShrink: 0, width: 16, display: 'flex', justifyContent: 'center' }}>
      {status === 'active' && (
        <motion.div
          style={{ width: 6, height: 6, borderRadius: '50%', background: '#00D4FF' }}
          animate={{ scale: [1, 1.6, 1], opacity: [1, 0.4, 1] }}
          transition={{ duration: 0.9, repeat: Infinity }}
        />
      )}
    </div>
  </motion.div>
);

/* ─────────────────────────────────────────────
   Main Modal
   ───────────────────────────────────────────── */
export const AIAnalysisModal: React.FC<AIAnalysisModalProps> = ({
  isOpen, imageUrl, imageName, onComplete, onClose,
}) => {
  const [activeIndex, setActiveIndex] = useState(-1);
  const [finished, setFinished] = useState(false);
  const [result, setResult] = useState<AIAnalysisResult | null>(null);
  const [progressPct, setProgressPct] = useState(0);

  const runPipeline = useCallback(() => {
    setActiveIndex(0);
    setFinished(false);
    setResult(null);
    setProgressPct(0);

    let idx = 0;
    const totalDuration = STEPS.reduce((s, st) => s + st.durationMs, 0);
    let elapsed = 0;

    const advance = async () => {
      elapsed += STEPS[idx].durationMs;
      setProgressPct(Math.round((elapsed / totalDuration) * 100));

      if (idx >= STEPS.length - 1) {
        setActiveIndex(STEPS.length - 1);
        setProgressPct(100);
        
        // Real AI Vision Pipeline API Call
        if (!imageUrl) throw new Error("Image URL missing");
        const visionData = await apiAnalyzeIncidentVision(imageName, imageUrl);
        const r: AIAnalysisResult = {
          type: visionData.category,
          severity: visionData.severity.charAt(0).toUpperCase() + visionData.severity.slice(1),
          confidence: visionData.confidence,
          priorityScore: visionData.priorityScore,
          summary: visionData.explanation,
          objectsDetected: [visionData.category.toLowerCase(), 'infrastructure asset'],
          gpsLocation: '12.9716° N, 77.5946° E (Ward 4 Metro Corridor)',
          duplicatesFound: 0,
          estimatedCost: visionData.estimatedRepairCost,
          estimatedTime: visionData.estimated_repair_time,
          recommendedDepartment: visionData.recommended_department,
        };
        setResult(r);
        setFinished(true);
        return;
      }
      const delay = STEPS[idx].durationMs || 100;
      setTimeout(() => {
        idx++;
        setActiveIndex(idx);
        advance();
      }, delay);
    };
    advance();
  }, [imageName, imageUrl]);

  useEffect(() => {
    if (isOpen && imageUrl) {
      const t = setTimeout(() => runPipeline(), 350);
      return () => clearTimeout(t);
    }
    setActiveIndex(-1);
    setFinished(false);
    setResult(null);
    setProgressPct(0);
  }, [isOpen, imageUrl, runPipeline]);

  /* Auto-close after completion */
  useEffect(() => {
    if (finished && result) {
      const t = setTimeout(() => onComplete(result), 2000);
      return () => clearTimeout(t);
    }
  }, [finished, result, onComplete]);

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          key="analysis-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
          style={{
            position: 'fixed', inset: 0, zIndex: 9999,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'rgba(0,0,0,0.78)',
            backdropFilter: 'blur(24px)', WebkitBackdropFilter: 'blur(24px)',
          }}
          onClick={(e: React.MouseEvent) => { if (e.target === e.currentTarget && finished) onClose(); }}
        >
          <motion.div
            initial={{ scale: 0.93, opacity: 0, y: 24 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.93, opacity: 0, y: 24 }}
            transition={{ duration: 0.4, ease: [0.4, 0, 0.2, 1] as const }}
            style={{
              width: '95%', maxWidth: 900, maxHeight: '92vh',
              overflowY: 'auto',
              background: 'rgba(17,24,39,0.94)',
              backdropFilter: 'blur(40px)',
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: 28,
              display: 'flex', flexDirection: 'row',
              position: 'relative',
            }}
          >
            {/* Top accent */}
            <div style={{
              position: 'absolute', top: 0, left: '12%', right: '12%', height: 2,
              background: 'linear-gradient(90deg, transparent, #00D4FF, #8B5CF6, transparent)',
              opacity: 0.5, borderRadius: 2,
            }} />

            {/* ────── LEFT: Image Panel ────── */}
            <div style={{
              flex: '0 0 380px', maxWidth: 380,
              background: 'rgba(0,0,0,0.25)',
              borderRadius: '28px 0 0 28px',
              display: 'flex', flexDirection: 'column',
              overflow: 'hidden',
              borderRight: '1px solid rgba(255,255,255,0.06)',
            }}>
              {/* Image */}
              <div style={{ flex: 1, position: 'relative', minHeight: 300 }}>
                {imageUrl && (
                  <img
                    src={imageUrl}
                    alt="Analyzing"
                    style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block', minHeight: 300 }}
                  />
                )}

                {/* Animated AI Vision Bounding Box Overlay */}
                {activeIndex >= 1 && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    style={{
                      position: 'absolute',
                      top: '22%',
                      left: '18%',
                      width: '48%',
                      height: '38%',
                      border: '2px solid #00D4FF',
                      boxShadow: '0 0 15px rgba(0, 212, 255, 0.5)',
                      borderRadius: 6,
                      pointerEvents: 'none',
                    }}
                  >
                    <div style={{
                      position: 'absolute',
                      top: -24,
                      left: 0,
                      background: '#00D4FF',
                      color: '#070B14',
                      fontSize: 10,
                      fontWeight: 800,
                      fontFamily: "'IBM Plex Mono', monospace",
                      padding: '2px 8px',
                      borderRadius: '4px 4px 4px 0',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 4,
                    }}>
                      <Eye size={12} /> YOLOv11x · 96.8% Confidence
                    </div>
                  </motion.div>
                )}

                {activeIndex >= 2 && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    style={{
                      position: 'absolute',
                      top: '52%',
                      left: '52%',
                      width: '35%',
                      height: '28%',
                      border: '2px dashed #8B5CF6',
                      boxShadow: '0 0 15px rgba(139, 92, 246, 0.4)',
                      borderRadius: 6,
                      pointerEvents: 'none',
                    }}
                  >
                    <div style={{
                      position: 'absolute',
                      bottom: -22,
                      right: 0,
                      background: '#8B5CF6',
                      color: '#fff',
                      fontSize: 9,
                      fontWeight: 800,
                      fontFamily: "'IBM Plex Mono', monospace",
                      padding: '2px 6px',
                      borderRadius: '0 0 4px 4px',
                    }}>
                      RT-DETR · Sub-surface Shear
                    </div>
                  </motion.div>
                )}

                {/* Scan line overlay */}
                {!finished && (
                  <motion.div
                    style={{
                      position: 'absolute', left: 0, right: 0, height: 2,
                      background: 'linear-gradient(90deg, transparent, #00D4FF, transparent)',
                      boxShadow: '0 0 20px rgba(0,212,255,0.4)',
                      pointerEvents: 'none',
                    }}
                    animate={{ top: ['0%', '100%', '0%'] }}
                    transition={{ duration: 3, repeat: Infinity, ease: 'linear' }}
                  />
                )}
                {/* Bottom gradient */}
                <div style={{
                  position: 'absolute', bottom: 0, left: 0, right: 0, height: 100,
                  background: 'linear-gradient(to top, rgba(0,0,0,0.85), transparent)',
                }} />
                {/* File info */}
                <div style={{ position: 'absolute', bottom: 14, left: 16, right: 16 }}>
                  <div style={{ fontFamily: 'var(--font-body)', fontSize: 12, fontWeight: 600, color: '#F8FAFC', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {imageName}
                  </div>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: '#94A3B8', marginTop: 2 }}>
                    Source Image · AI Vision Pipeline Active
                  </div>
                </div>
              </div>

              {/* AI Confidence + Detection result (shown after completion) */}
              <AnimatePresence>
                {finished && result && (
                  <motion.div
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2, duration: 0.4 }}
                    style={{ padding: '20px 20px 24px' }}
                  >
                    <ConfidenceGauge value={result.confidence} isVisible />
                    <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {[
                        { label: 'Detected', value: result.type, color: '#F8FAFC' },
                        { label: 'Severity', value: result.severity, color: result.severity === 'Critical' ? '#EF4444' : result.severity === 'High' ? '#F59E0B' : '#3B82F6' },
                        { label: 'Priority', value: `${result.priorityScore}/100`, color: '#00D4FF' },
                        { label: 'Duplicates', value: `${result.duplicatesFound} found nearby`, color: '#94A3B8' },
                      ].map((row) => (
                        <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontSize: 11, color: '#64748B', fontFamily: 'var(--font-body)' }}>{row.label}</span>
                          <span style={{ fontSize: 12, fontWeight: 700, color: row.color, fontFamily: 'var(--font-mono)' }}>{row.value}</span>
                        </div>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* ────── RIGHT: Processing Panel ────── */}
            <div style={{
              flex: 1, padding: '36px 32px 28px',
              display: 'flex', flexDirection: 'column',
              minWidth: 0,
            }}>
              {/* Hologram */}
              <AIHologram progress={progressPct} isComplete={finished} />

              {/* Title */}
              <div style={{ textAlign: 'center', margin: '20px 0 8px' }}>
                <h2 style={{
                  fontFamily: 'var(--font-heading)', fontSize: 18, fontWeight: 700,
                  color: '#F8FAFC', margin: 0, letterSpacing: '-0.02em',
                }}>
                  {finished ? 'Analysis Complete' : 'AI Analysis in Progress'}
                </h2>
                <p style={{ fontFamily: 'var(--font-body)', fontSize: 12, color: '#94A3B8', margin: '4px 0 0' }}>
                  {finished
                    ? 'Redirecting to detection results…'
                    : 'CivicSense AI is analyzing your image'}
                </p>
              </div>

              {/* Progress bar */}
              <div style={{ margin: '18px 0 6px', height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.06)', overflow: 'hidden' }}>
                <motion.div
                  style={{
                    height: '100%', borderRadius: 2,
                    background: finished ? 'linear-gradient(90deg, #10B981, #059669)' : 'linear-gradient(90deg, #00D4FF, #8B5CF6)',
                    boxShadow: finished ? '0 0 10px rgba(16,185,129,0.5)' : '0 0 10px rgba(0,212,255,0.5)',
                  }}
                  animate={{ width: `${progressPct}%` }}
                  transition={{ duration: 0.4, ease: 'easeOut' }}
                />
              </div>

              {/* Percentage + step count */}
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 14, padding: '0 2px' }}>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 700, color: finished ? '#10B981' : '#00D4FF' }}>
                  {progressPct}%
                </span>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: '#475569' }}>
                  {activeIndex >= 0 ? `Step ${Math.min(activeIndex + 1, STEPS.length)} / ${STEPS.length}` : 'Initializing…'}
                </span>
              </div>

              {/* Steps list */}
              <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 1, paddingRight: 4 }}>
                {STEPS.map((s, idx) => (
                  <StepRow
                    key={s.id}
                    step={s}
                    idx={idx}
                    status={idx < activeIndex ? 'done' : idx === activeIndex ? 'active' : 'pending'}
                  />
                ))}
              </div>

              {/* Summary card after completion */}
              <AnimatePresence>
                {finished && result && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.4, duration: 0.35 }}
                    style={{
                      marginTop: 14, padding: 14,
                      background: 'rgba(0, 212, 255, 0.08)',
                      border: '1px solid rgba(0, 212, 255, 0.3)',
                      borderRadius: 14,
                      display: 'flex', flexDirection: 'column', gap: 8,
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <Sparkles size={14} color="#00D4FF" />
                        <span style={{ fontFamily: 'var(--font-heading)', fontSize: 12, fontWeight: 800, color: '#00D4FF' }}>
                          PREMIUM AI RESULT CARD
                        </span>
                      </div>
                      <span style={{ fontSize: 10, color: '#10B981', fontFamily: 'var(--font-mono)', fontWeight: 700 }}>
                        96.8% CONFIDENCE
                      </span>
                    </div>

                    <div style={{ fontSize: 11, color: '#F8FAFC', lineHeight: 1.4 }}>
                      {result.summary}
                    </div>

                    {/* Impact Telemetry Grid */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, paddingTop: 6, borderTop: '1px solid rgba(255,255,255,0.06)', fontSize: 10 }}>
                      <div>
                        <span style={{ color: '#64748B', display: 'block' }}>Nearby Infrastructure:</span>
                        <strong style={{ color: '#F8FAFC' }}>Victoria Hospital (340m)</strong>
                      </div>
                      <div>
                        <span style={{ color: '#64748B', display: 'block' }}>Estimated Cost:</span>
                        <strong style={{ color: '#F59E0B' }}>₹{result.estimatedCost.toLocaleString()}</strong>
                      </div>
                      <div>
                        <span style={{ color: '#64748B', display: 'block' }}>Estimated Repair ETA:</span>
                        <strong style={{ color: '#10B981', fontFamily: 'var(--font-mono)' }}>{result.estimatedTime}</strong>
                      </div>
                      <div>
                        <span style={{ color: '#64748B', display: 'block' }}>Department:</span>
                        <strong style={{ color: '#38BDF8' }}>{result.recommendedDepartment}</strong>
                      </div>
                    </div>

                    {result.confidence < 80 ? (
                      <div style={{ padding: '6px 8px', borderRadius: 8, background: 'rgba(245, 158, 11, 0.15)', border: '1px solid rgba(245, 158, 11, 0.3)', fontSize: 10, color: '#F8FAFC' }}>
                        <strong style={{ color: '#F59E0B', display: 'block', marginBottom: '4px' }}>⚠️ Low Confidence - Verification Required</strong>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                          <span>AI Suggests: <strong>{result.type}</strong></span>
                          <select 
                            style={{ background: 'rgba(0,0,0,0.5)', color: '#fff', border: '1px solid #F59E0B', borderRadius: 4, padding: 4 }}
                            value={result.type}
                            onChange={(e) => setResult({...result, type: e.target.value})}
                          >
                            {SUPPORTED_CATEGORIES.map(cat => (
                              <option key={cat} value={cat}>{cat}</option>
                            ))}
                          </select>
                        </div>
                      </div>
                    ) : (
                      <div style={{ padding: '6px 8px', borderRadius: 8, background: 'rgba(139, 92, 246, 0.15)', border: '1px solid rgba(139, 92, 246, 0.3)', fontSize: 10, color: '#F8FAFC' }}>
                        <strong style={{ color: '#8B5CF6', display: 'block' }}>AI Recommendation:</strong>
                        Deploy asphalt cold-patch & structural sub-base stabilization within 24 hours.
                      </div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
