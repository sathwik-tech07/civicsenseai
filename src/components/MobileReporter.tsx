import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Camera, Mic, ChevronRight, ChevronLeft, Sparkles } from 'lucide-react';
import type { Incident, IncidentLocation } from '../types';
import { AIProcessingModal } from './AIProcessingModal';
import { ImageUploadZone } from './ImageUploadZone';
import { AIAnalysisModal, type AIAnalysisResult } from './AIAnalysisModal';
import { VoiceReporterModal, type ExtractedVoiceData } from './VoiceReporterModal';
import { SmartLocationPicker } from './SmartLocationPicker';
import { DEFAULT_LOCATION } from '../services/locationService';

interface Props {
  onAddNewIncident: (inc: Incident) => void;
  onIncidentCreated?: (inc: Incident) => void;
}

const SUPPORTED_CATEGORIES = [
  { id: 'pothole', label: 'Pothole' },
  { id: 'road_crack', label: 'Road Crack' },
  { id: 'water_leakage', label: 'Water Leakage' },
  { id: 'garbage_overflow', label: 'Garbage Overflow' },
  { id: 'broken_streetlight', label: 'Broken Streetlight' },
  { id: 'drainage_blockage', label: 'Drainage Blockage' },
  { id: 'illegal_dumping', label: 'Illegal Dumping' },
  { id: 'fallen_tree', label: 'Fallen Tree' },
  { id: 'traffic_signal_failure', label: 'Traffic Signal Failure' },
];

export const MobileReporter: React.FC<Props> = ({ onAddNewIncident, onIncidentCreated }) => {
  const [step, setStep] = useState(1);

  // ── Image state ──
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  // ── AI Analysis Modal state ──
  const [showAnalysisModal, setShowAnalysisModal] = useState(false);
  const [aiResult, setAiResult] = useState<AIAnalysisResult | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>('Pothole');

  // ── Smart Location Architecture state ──
  const [incidentLocation, setIncidentLocation] = useState<IncidentLocation>(DEFAULT_LOCATION);
  const [description, setDescription] = useState('');

  // ── Voice Reporter Modal state ──
  const [showVoiceModal, setShowVoiceModal] = useState(false);

  // ── AI Submission Processing Modal ──
  const [showProcessing, setShowProcessing] = useState(false);
  const [pendingIncident, setPendingIncident] = useState<Incident | null>(null);

  // ────────────────────────────────────────────────
  // Handlers
  // ────────────────────────────────────────────────

  const handleAcceptVoiceData = (data: ExtractedVoiceData) => {
    setIncidentLocation({
      lat: 12.9716,
      lng: 77.5946,
      street: data.location,
      area: 'Central Corridor',
      ward: 'Ward 1 - Metro Health Corridor',
      wardId: 'w-1',
      city: 'Bengaluru',
      state: 'Karnataka',
      postalCode: '560001',
      country: 'India',
      formattedAddress: `${data.location}, Ward 1, Bengaluru, Karnataka 560001`,
      method: 'search',
    });
    setDescription(data.transcript);
    setAiResult({
      type: data.issueType,
      severity: data.severity,
      confidence: 96.5,
      priorityScore: 90,
      summary: data.transcript,
      objectsDetected: [],
      gpsLocation: '12.9716° N, 77.5946° E',
      duplicatesFound: 0,
      estimatedCost: 15000,
      estimatedTime: '24 Hours',
      recommendedDepartment: 'General Operations'
    });
  };

  const handleImageSelected = (file: File, dataUrl: string) => {
    setSelectedFile(file);
    setPreviewUrl(dataUrl);
    setAiResult(null);
  };

  const handleImageRemoved = () => {
    setSelectedFile(null);
    setPreviewUrl(null);
    setAiResult(null);
  };

  const handleStartAnalysis = () => {
    if (!selectedFile || !previewUrl) return;
    setShowAnalysisModal(true);
  };

  const handleAnalysisComplete = (result: AIAnalysisResult) => {
    setAiResult(result);
    setSelectedCategory(result.type);
    setShowAnalysisModal(false);
  };

  const handleSubmit = () => {
    const severity = (aiResult?.severity?.toLowerCase() || 'high') as 'low' | 'medium' | 'high' | 'critical';
    const categoryName = selectedCategory || aiResult?.type || 'Pothole';
    const typeKey = categoryName.toLowerCase().replace(/ /g, '_');
    const priorityScore = aiResult?.priorityScore || (severity === 'critical' ? 96 : severity === 'high' ? 85 : severity === 'medium' ? 74 : 52);
    const sevCap = severity.charAt(0).toUpperCase() + severity.slice(1);

    const newInc: Incident = {
      id: `INC-2026-${Math.floor(Math.random() * 9000) + 1000}`,
      title: `${sevCap} ${categoryName} Detected Near ${incidentLocation.street}`,
      type: typeKey as Incident['type'],
      severity,
      status: 'reported',
      wardId: incidentLocation.wardId,
      wardName: incidentLocation.ward,
      lat: incidentLocation.lat,
      lng: incidentLocation.lng,
      address: incidentLocation.formattedAddress,
      reportedDate: new Date().toLocaleString('en-US', {
        year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit',
      }),
      reportedBy: 'Citizen Reporter',
      priorityScore,
      estimatedRepairCost: aiResult?.estimatedCost || Math.round(500 + Math.random() * 14000),
      savedEarlyIntervention: Math.round(2000 + Math.random() * 80000),
      photoUrl: previewUrl ?? 'https://images.unsplash.com/photo-1515162816999-a0c47dc192f7?auto=format&fit=crop&w=800&q=80',
      voiceNoteText: description || undefined,
      xai: {
        cvConfidence: aiResult?.confidence || 98.0,
        cvModel: 'Gemini 2.5 Flash Multimodal',
        hospitalProximityMeters: Math.round(100 + Math.random() * 3000),
        hospitalName: 'City General Government Hospital',
        roadClassification: 'Primary Arterial Corridor',
        duplicateComplaintsCount: aiResult?.duplicatesFound || 0,
        estimatedDailyTraffic: Math.round(5000 + Math.random() * 18000),
        historicalFailureRate: Math.round(30 + Math.random() * 60),
        weatherRiskFactor: 'High Vulnerability to Heavy Rainfall',
      },
    };

    setPendingIncident(newInc);
    setShowProcessing(true);
  };

  const handleProcessingComplete = (inc: Incident) => {
    onAddNewIncident(inc);
    setShowProcessing(false);
    setPendingIncident(null);
    setStep(1);
    setSelectedFile(null);
    setPreviewUrl(null);
    setAiResult(null);
    setDescription('');
    if (onIncidentCreated) onIncidentCreated(inc);
  };

  // ────────────────────────────────────────────────
  // Shared styles
  // ────────────────────────────────────────────────

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '14px 16px',
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: 12,
    color: '#F8FAFC',
    fontFamily: 'var(--font-body)',
    fontSize: 14,
    boxSizing: 'border-box',
    outline: 'none',
    transition: 'border-color 0.2s',
  };

  const focusHandlers = {
    onFocus: (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
      e.currentTarget.style.borderColor = 'rgba(0, 212, 255, 0.4)';
    },
    onBlur: (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
      e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)';
    },
  };

  const label = (text: string, icon?: React.ReactNode): React.ReactNode => (
    <label style={{
      display: 'flex',
      fontSize: 11,
      fontWeight: 600,
      color: '#94A3B8',
      marginBottom: 6,
      textTransform: 'uppercase',
      letterSpacing: '0.06em',
      fontFamily: 'var(--font-body)',
      alignItems: 'center',
      gap: 5,
    } as React.CSSProperties}>
      {icon}{text}
    </label>
  );

  return (
    <>
      <div style={{
        maxWidth: 520,
        margin: '0 auto',
        background: 'rgba(17, 24, 39, 0.65)',
        backdropFilter: 'blur(24px)',
        border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: 24,
        padding: '32px 28px',
        position: 'relative',
        overflow: 'hidden',
      }}>
        {/* Accent line */}
        <div style={{
          position: 'absolute', top: 0, left: '15%', right: '15%', height: 2,
          background: 'linear-gradient(90deg, transparent, #00D4FF, #8B5CF6, transparent)',
          opacity: 0.5,
        }} />

        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, marginBottom: 6 }}>
            <Camera size={22} color="#00D4FF" />
            <h2 style={{
              fontFamily: 'var(--font-heading)', fontSize: 22, fontWeight: 700,
              color: '#F8FAFC', margin: 0, letterSpacing: '-0.02em',
            }}>
              AI-Powered Reporter
            </h2>
          </div>
          <p style={{ fontFamily: 'var(--font-body)', fontSize: 13, color: '#94A3B8', margin: 0 }}>
            Upload a photo and let AI analyze and create the incident report
          </p>
        </div>

        {/* Step Indicators */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, padding: '0 8px' }}>
          {[1, 2, 3].map((s) => (
            <React.Fragment key={s}>
              <div style={{
                width: 28, height: 28, borderRadius: '50%',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 12, fontWeight: 700, fontFamily: 'var(--font-mono)',
                background: s <= step
                  ? 'linear-gradient(135deg, #00D4FF, #0EA5E9)'
                  : 'rgba(255,255,255,0.06)',
                color: s <= step ? '#000' : '#64748B',
                boxShadow: s <= step ? '0 0 16px rgba(0, 212, 255, 0.3)' : 'none',
                transition: 'all 0.4s ease',
                flexShrink: 0,
              }}>
                {s}
              </div>
              {s < 3 && (
                <div style={{
                  flex: 1, height: 2, borderRadius: 1,
                  background: s < step ? '#00D4FF' : 'rgba(255,255,255,0.06)',
                  transition: 'background 0.4s',
                }} />
              )}
            </React.Fragment>
          ))}
        </div>

        {/* Step labels */}
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 28, padding: '0 4px' }}>
          {['Photo & AI', 'Location', 'Submit'].map((lbl, i) => (
            <div key={i} style={{
              fontSize: 10, fontWeight: 600,
              color: i + 1 <= step ? '#94A3B8' : '#475569',
              fontFamily: 'var(--font-body)', textAlign: 'center', width: '33%',
            }}>
              {lbl}
            </div>
          ))}
        </div>

        <AnimatePresence mode="wait">

          {/* STEP 1 — Photo & AI Analysis */}
          {step === 1 && (
            <motion.div
              key="step1"
              initial={{ opacity: 0, x: 30 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -30 }}
              transition={{ duration: 0.3 }}
            >
              <ImageUploadZone
                onImageSelected={handleImageSelected}
                onImageRemoved={handleImageRemoved}
                selectedFile={selectedFile}
                previewUrl={previewUrl}
              />

              <div style={{ height: 16 }} />

              <AnimatePresence mode="wait">
                {aiResult ? (
                  <motion.div
                    key="result"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    style={{
                      background: 'rgba(0, 212, 255, 0.06)',
                      border: '1px solid rgba(0, 212, 255, 0.2)',
                      borderRadius: 16,
                      padding: 20,
                      marginBottom: 16,
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
                      <Sparkles size={16} color="#00D4FF" />
                      <span style={{
                        fontFamily: 'var(--font-heading)', fontSize: 14,
                        fontWeight: 700, color: '#00D4FF',
                      }}>
                        AI Detection Results
                      </span>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
                      {[
                        { label: 'Detected', value: aiResult.type, color: '#F8FAFC' },
                        {
                          label: 'Severity',
                          value: aiResult.severity,
                          color: aiResult.severity.toLowerCase() === 'critical' ? '#EF4444'
                            : aiResult.severity.toLowerCase() === 'high' ? '#F59E0B' : '#3B82F6',
                        },
                        { label: 'Confidence', value: aiResult.confidence, color: '#10B981' },
                      ].map((item) => (
                        <div key={item.label}>
                          <div style={{
                            fontSize: 10, color: '#64748B', marginBottom: 4,
                            fontFamily: 'var(--font-body)', textTransform: 'uppercase',
                            letterSpacing: '0.05em',
                          }}>
                            {item.label}
                          </div>
                          <div style={{
                            fontSize: 14, fontWeight: 700, color: item.color,
                            textTransform: 'capitalize',
                            fontFamily: item.label === 'Confidence' ? 'var(--font-mono)' : 'var(--font-body)',
                          }}>
                            {item.value}
                          </div>
                        </div>
                      ))}
                    </div>
                  </motion.div>
                ) : (
                  <motion.button
                    key="analyze-btn"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    onClick={handleStartAnalysis}
                    disabled={!selectedFile}
                    whileHover={selectedFile ? { scale: 1.02 } : {}}
                    whileTap={selectedFile ? { scale: 0.98 } : {}}
                    style={{
                      width: '100%',
                      padding: '14px 24px',
                      background: !selectedFile
                        ? 'rgba(255,255,255,0.04)'
                        : 'linear-gradient(135deg, #00D4FF, #0EA5E9)',
                      color: !selectedFile ? '#475569' : '#000',
                      border: !selectedFile
                        ? '1px solid rgba(255,255,255,0.08)'
                        : 'none',
                      borderRadius: 12,
                      fontWeight: 700,
                      fontSize: 14,
                      fontFamily: 'var(--font-body)',
                      cursor: !selectedFile ? 'not-allowed' : 'pointer',
                      marginBottom: 12,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 8,
                      transition: 'all 0.3s',
                      boxShadow: selectedFile
                        ? '0 4px 16px rgba(0, 212, 255, 0.25)'
                        : 'none',
                    }}
                  >
                    <Sparkles size={18} />
                    {selectedFile ? 'Analyze with AI ✨' : 'Upload an image first'}
                  </motion.button>
                )}
              </AnimatePresence>

              <button
                onClick={() => setStep(2)}
                disabled={!aiResult}
                style={{
                  width: '100%',
                  padding: '14px 24px',
                  background: aiResult ? 'rgba(255,255,255,0.06)' : 'transparent',
                  color: aiResult ? '#F8FAFC' : '#475569',
                  border: '1px solid rgba(255,255,255,0.08)',
                  borderRadius: 12,
                  fontWeight: 600,
                  fontSize: 14,
                  fontFamily: 'var(--font-body)',
                  cursor: aiResult ? 'pointer' : 'not-allowed',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                  transition: 'all 0.3s',
                }}
              >
                Continue
                <ChevronRight size={16} />
              </button>
            </motion.div>
          )}

          {/* STEP 2 — Location */}
          {step === 2 && (
            <motion.div
              key="step2"
              initial={{ opacity: 0, x: 30 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -30 }}
              transition={{ duration: 0.3 }}
            >
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {/* Production Smart Location Picker System */}
                <SmartLocationPicker
                  selectedLocation={incidentLocation}
                  onChangeLocation={(loc) => setIncidentLocation(loc)}
                />

                {/* Category Classification Selector */}
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: '#94A3B8', fontFamily: "'Space Grotesk', sans-serif" }}>
                      ISSUE CATEGORY
                    </span>
                    {(aiResult?.confidence ?? 95) < 80 && (
                      <span style={{
                        fontSize: 10,
                        fontWeight: 800,
                        color: '#F59E0B',
                        background: 'rgba(245, 158, 11, 0.15)',
                        border: '1px solid #F59E0B',
                        padding: '2px 8px',
                        borderRadius: 6,
                        fontFamily: "'IBM Plex Mono', monospace",
                      }}>
                        ⚡ Suggested Category (AI Low Confidence)
                      </span>
                    )}
                  </div>

                  <select
                    value={selectedCategory}
                    onChange={(e) => setSelectedCategory(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '10px 14px',
                      background: 'rgba(7, 11, 20, 0.8)',
                      border: '1px solid rgba(0, 212, 255, 0.3)',
                      borderRadius: 10,
                      color: '#F8FAFC',
                      fontSize: 12,
                      fontWeight: 600,
                      outline: 'none',
                    }}
                  >
                    {SUPPORTED_CATEGORIES.map((cat) => (
                      <option key={cat.id} value={cat.label} style={{ background: '#111827' }}>
                        {cat.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  {label('Additional Notes')}
                  <textarea
                    placeholder="Describe what you see…"
                    rows={3}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    style={{ ...inputStyle, resize: 'vertical' as const }}
                    {...focusHandlers}
                  />
                </div>

                <div
                  onClick={() => setShowVoiceModal(true)}
                  style={{
                    padding: 14,
                    background: 'rgba(0, 212, 255, 0.05)',
                    borderRadius: 12,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 14,
                    border: '1px solid rgba(0, 212, 255, 0.2)',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                  }}
                >
                  <button
                    onClick={(e) => { e.stopPropagation(); setShowVoiceModal(true); }}
                    style={{
                      width: 42, height: 42, borderRadius: '50%',
                      background: 'linear-gradient(135deg, #EF4444, #DC2626)',
                      border: 'none', color: '#fff', cursor: 'pointer',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      boxShadow: '0 4px 14px rgba(239, 68, 68, 0.4)',
                      flexShrink: 0,
                    }}
                  >
                    <Mic size={20} />
                  </button>
                  <div style={{ flex: 1 }}>
                    <div style={{ color: '#F8FAFC', fontSize: 13, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
                      AI Voice Reporting & Parsing
                      <Sparkles size={13} color="#00D4FF" />
                    </div>
                    <div style={{ color: '#94A3B8', fontSize: 11, marginTop: 2 }}>
                      Speak complaint naturally to auto-fill fields with AI
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: 12, marginTop: 4 }}>
                  <button
                    onClick={() => setStep(1)}
                    style={{
                      flex: 1, padding: 14, background: 'transparent', color: '#94A3B8',
                      border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12,
                      cursor: 'pointer', fontWeight: 600, fontSize: 14,
                      fontFamily: 'var(--font-body)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                    }}
                  >
                    <ChevronLeft size={16} />
                    Back
                  </button>
                  <button
                    onClick={() => setStep(3)}
                    style={{
                      flex: 2, padding: 14,
                      background: 'linear-gradient(135deg, #00D4FF, #0EA5E9)',
                      color: '#000', border: 'none', borderRadius: 12,
                      fontWeight: 700, fontSize: 14, fontFamily: 'var(--font-body)',
                      cursor: 'pointer',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                      boxShadow: '0 4px 16px rgba(0, 212, 255, 0.25)',
                    }}
                  >
                    Review
                    <ChevronRight size={16} />
                  </button>
                </div>
              </div>
            </motion.div>
          )}

          {/* STEP 3 — Review & Submit */}
          {step === 3 && (
            <motion.div
              key="step3"
              initial={{ opacity: 0, x: 30 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -30 }}
              transition={{ duration: 0.3 }}
            >
              {previewUrl && (
                <div style={{ marginBottom: 20, borderRadius: 14, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.08)' }}>
                  <img
                    src={previewUrl}
                    alt="Preview"
                    style={{ width: '100%', maxHeight: 160, objectFit: 'cover', display: 'block' }}
                  />
                </div>
              )}

              <div style={{
                background: 'rgba(255,255,255,0.03)',
                border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: 16,
                padding: 24,
                marginBottom: 24,
              }}>
                <h4 style={{
                  fontFamily: 'var(--font-heading)', fontSize: 16, fontWeight: 700,
                  color: '#F8FAFC', margin: '0 0 20px 0',
                }}>
                  Report Summary
                </h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14, fontSize: 14 }}>
                  {[
                    { lbl: 'Detected Type', val: aiResult?.type || 'Pothole', col: '#F8FAFC' },
                    {
                      lbl: 'Severity',
                      val: aiResult?.severity || 'High',
                      col: (aiResult?.severity?.toLowerCase() === 'critical') ? '#EF4444'
                        : (aiResult?.severity?.toLowerCase() === 'high') ? '#F59E0B' : '#3B82F6',
                    },
                    { lbl: 'AI Confidence', val: aiResult?.confidence || '98%', col: '#10B981' },
                    { lbl: 'Ward', val: incidentLocation.ward, col: '#F8FAFC' },
                    { lbl: 'Location', val: incidentLocation.formattedAddress, col: '#94A3B8' },
                  ].map((row) => (
                    <div key={row.lbl} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ color: '#64748B', fontFamily: 'var(--font-body)' }}>{row.lbl}</span>
                      <span style={{ color: row.col, fontWeight: 600, textTransform: 'capitalize' }}>{row.val}</span>
                    </div>
                  ))}
                  {description && (
                    <div style={{
                      marginTop: 4, padding: '10px 14px',
                      background: 'rgba(255,255,255,0.03)', borderRadius: 8,
                      color: '#94A3B8', fontSize: 12, fontStyle: 'italic',
                    }}>
                      "{description}"
                    </div>
                  )}
                </div>
              </div>

              <div style={{ display: 'flex', gap: 12 }}>
                <button
                  onClick={() => setStep(2)}
                  style={{
                    flex: 1, padding: 14, background: 'transparent', color: '#94A3B8',
                    border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12,
                    cursor: 'pointer', fontWeight: 600, fontSize: 14,
                    fontFamily: 'var(--font-body)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                  }}
                >
                  <ChevronLeft size={16} />
                  Back
                </button>
                <button
                  onClick={handleSubmit}
                  style={{
                    flex: 2, padding: 14,
                    background: 'linear-gradient(135deg, #10B981, #059669)',
                    color: '#fff', border: 'none', borderRadius: 12,
                    fontWeight: 700, fontSize: 14, fontFamily: 'var(--font-body)',
                    cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                    boxShadow: '0 4px 16px rgba(16, 185, 129, 0.3)',
                  }}
                >
                  <Sparkles size={16} />
                  Submit to AI Pipeline
                </button>
              </div>
            </motion.div>
          )}

        </AnimatePresence>
      </div>

      {/* AI Voice Reporter Modal */}
      <VoiceReporterModal
        isOpen={showVoiceModal}
        onClose={() => setShowVoiceModal(false)}
        onAcceptExtractedData={handleAcceptVoiceData}
      />

      {/* Full-screen AI Analysis Modal */}
      <AIAnalysisModal
        isOpen={showAnalysisModal}
        imageUrl={previewUrl}
        imageName={selectedFile?.name || 'infrastructure_photo.png'}
        onComplete={handleAnalysisComplete}
        onClose={() => setShowAnalysisModal(false)}
      />

      {/* Submission Processing Modal */}
      <AIProcessingModal
        isOpen={showProcessing}
        incident={pendingIncident}
        onComplete={handleProcessingComplete}
        onClose={() => setShowProcessing(false)}
      />
    </>
  );
};
