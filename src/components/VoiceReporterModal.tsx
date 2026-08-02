import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Mic, MicOff, Sparkles, X, RotateCcw, Check, Edit3, Volume2, Play
} from 'lucide-react';

/* ─────────────────────────────────────────────
   Types
   ───────────────────────────────────────────── */
export interface ExtractedVoiceData {
  transcript: string;
  issueType: string;
  location: string;
  severity: 'Critical' | 'High' | 'Medium' | 'Low';
  landmarks: string;
  department: string;
  priorityScore: number;
}

interface VoiceReporterModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAcceptExtractedData: (data: ExtractedVoiceData) => void;
}

// Sample demo voice prompts for fallback or quick testing
const SAMPLE_PROMPTS = [
  "There is a massive pothole on Victoria Road near City Hospital causing major traffic delay!",
  "Water main pipe burst near Metro Station in Ward 1 causing severe flooding on main road!",
  "Large garbage heap overflowing near Tech Park entrance near Central Market for 3 days!",
];

/* ─────────────────────────────────────────────
   NLP Extractor Helper (Client-side AI Parser)
   ───────────────────────────────────────────── */
function parseVoiceTranscript(text: string): ExtractedVoiceData {
  const lower = text.toLowerCase();

  // 1. Issue Type
  let issueType = 'Pothole';
  if (lower.includes('water') || lower.includes('leak') || lower.includes('burst') || lower.includes('flood')) {
    issueType = 'Water Leak';
  } else if (lower.includes('garbage') || lower.includes('trash') || lower.includes('waste') || lower.includes('dump')) {
    issueType = 'Garbage Dump';
  } else if (lower.includes('drain') || lower.includes('sewer') || lower.includes('overflow')) {
    issueType = 'Drainage Overflow';
  } else if (lower.includes('light') || lower.includes('street') || lower.includes('dark')) {
    issueType = 'Streetlight Outage';
  } else if (lower.includes('collapse') || lower.includes('cave')) {
    issueType = 'Road Collapse';
  } else if (lower.includes('pothole') || lower.includes('crack') || lower.includes('road')) {
    issueType = 'Pothole';
  }

  // 2. Severity
  let severity: 'Critical' | 'High' | 'Medium' | 'Low' = 'High';
  if (lower.includes('massive') || lower.includes('severe') || lower.includes('burst') || lower.includes('emergency') || lower.includes('critical') || lower.includes('hazard')) {
    severity = 'Critical';
  } else if (lower.includes('major') || lower.includes('large') || lower.includes('overflowing') || lower.includes('flooding')) {
    severity = 'High';
  } else if (lower.includes('minor') || lower.includes('small')) {
    severity = 'Low';
  }

  // 3. Location & Landmarks
  let location = 'Victoria Road, Near Metro Station';
  let landmarks = 'City Hospital & Central Metro';

  if (lower.includes('victoria')) {
    location = 'Victoria Road, Sector 4';
    landmarks = 'Near City Hospital';
  } else if (lower.includes('metro')) {
    location = 'Metro Station Junction, Ward 1';
    landmarks = 'Central Metro Station Entrance';
  } else if (lower.includes('tech park')) {
    location = 'Tech Innovation Belt, Gate 3';
    landmarks = 'Near Central Market & Tech Park';
  }

  // 4. Department Mapping
  const deptMap: Record<string, string> = {
    'Pothole': 'Road Infrastructure & Civil Works Dept',
    'Water Leak': 'Water Supply & Sewerage Board',
    'Garbage Dump': 'Solid Waste Management Division',
    'Drainage Overflow': 'Stormwater & Drainage Bureau',
    'Streetlight Outage': 'Electrical & Lighting Department',
    'Road Collapse': 'Emergency Civil Engineering Taskforce',
  };

  const sevStr: string = severity;
  const priorityScore = sevStr === 'Critical' ? 94 : sevStr === 'High' ? 84 : sevStr === 'Medium' ? 68 : 45;

  return {
    transcript: text,
    issueType,
    location,
    severity,
    landmarks,
    department: deptMap[issueType] || 'Municipal Works',
    priorityScore,
  };
}

/* ─────────────────────────────────────────────
   Main Component
   ───────────────────────────────────────────── */
export const VoiceReporterModal: React.FC<VoiceReporterModalProps> = ({
  isOpen,
  onClose,
  onAcceptExtractedData,
}) => {
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [isEditingTranscript, setIsEditingTranscript] = useState(false);
  const [extractedData, setExtractedData] = useState<ExtractedVoiceData | null>(null);
  const [audioVolume, setAudioVolume] = useState(0);
  const [permissionError, setPermissionError] = useState<string | null>(null);

  // References for Web Speech API & Web Audio API
  const recognitionRef = useRef<any>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const animFrameRef = useRef<number | null>(null);

  // Cleanup function for microphone stream & speech recognition
  const stopAudio = useCallback(() => {
    if (recognitionRef.current) {
      try { recognitionRef.current.stop(); } catch (_) {}
    }
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(track => track.stop());
      mediaStreamRef.current = null;
    }
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
    }
    setIsRecording(false);
    setAudioVolume(0);
  }, []);

  // Start Voice Recording & Speech Recognition
  const startRecording = useCallback(async () => {
    setPermissionError(null);
    setTranscript('');
    setExtractedData(null);
    setIsEditingTranscript(false);

    // 1. Microphone Web Audio Stream for Volume Visualization
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;

      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      audioContextRef.current = audioCtx;
      const source = audioCtx.createMediaStreamSource(stream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 64;
      source.connect(analyser);

      const dataArray = new Uint8Array(analyser.frequencyBinCount);
      const updateVolume = () => {
        analyser.getByteFrequencyData(dataArray);
        const sum = dataArray.reduce((acc, val) => acc + val, 0);
        const avg = sum / dataArray.length;
        setAudioVolume(Math.min(100, Math.round((avg / 128) * 100)));
        animFrameRef.current = requestAnimationFrame(updateVolume);
      };
      updateVolume();
    } catch (err: any) {
      console.warn('Microphone access warning:', err);
      setPermissionError('Microphone permission not granted. You can use the quick sample prompts below.');
    }

    // 2. Web Speech Recognition API
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      try {
        const recognition = new SpeechRecognition();
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = 'en-US';

        recognition.onresult = (event: any) => {
          let currentTranscript = '';
          for (let i = event.resultIndex; i < event.results.length; i++) {
            currentTranscript += event.results[i][0].transcript;
          }
          setTranscript(currentTranscript);
        };

        recognition.onerror = (event: any) => {
          console.warn('Speech recognition error:', event.error);
        };

        recognition.start();
        recognitionRef.current = recognition;
      } catch (e) {
        console.warn('Failed to start SpeechRecognition:', e);
      }
    }

    setIsRecording(true);
  }, []);

  // Stop Recording & Process Transcript with AI NLP
  const handleStopRecordingAndParse = useCallback((finalText?: string) => {
    stopAudio();
    const textToProcess = finalText || transcript;

    if (!textToProcess || textToProcess.trim().length === 0) {
      return;
    }

    setIsProcessing(true);
    setTimeout(() => {
      const parsed = parseVoiceTranscript(textToProcess);
      setExtractedData(parsed);
      setIsProcessing(false);
    }, 1200);
  }, [stopAudio, transcript]);

  // Use Sample Prompt for instant test
  const handleUseSamplePrompt = (promptText: string) => {
    setTranscript(promptText);
    handleStopRecordingAndParse(promptText);
  };

  // Reset / Retry
  const handleRetry = () => {
    stopAudio();
    setTranscript('');
    setExtractedData(null);
    setIsEditingTranscript(false);
    startRecording();
  };

  // Close & Accept
  const handleAccept = () => {
    if (extractedData) {
      onAcceptExtractedData(extractedData);
      onClose();
    }
  };

  // Effect to clean up when modal closes
  useEffect(() => {
    if (!isOpen) {
      stopAudio();
      setTranscript('');
      setExtractedData(null);
      setIsEditingTranscript(false);
    } else {
      // Auto start recording when opened
      startRecording();
    }
  }, [isOpen, startRecording, stopAudio]);

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 9999,
            background: 'rgba(0, 0, 0, 0.82)',
            backdropFilter: 'blur(28px)',
            WebkitBackdropFilter: 'blur(28px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 20,
          }}
          onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
        >
          <motion.div
            initial={{ scale: 0.92, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.92, opacity: 0, y: 20 }}
            transition={{ duration: 0.35, ease: [0.4, 0, 0.2, 1] as const }}
            style={{
              width: '100%',
              maxWidth: 540,
              maxHeight: '92vh',
              overflowY: 'auto',
              background: 'rgba(17, 24, 39, 0.94)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              borderRadius: 28,
              padding: 32,
              position: 'relative',
              boxShadow: '0 20px 60px rgba(0, 0, 0, 0.5)',
            }}
          >
            {/* Top Accent Line */}
            <div style={{
              position: 'absolute', top: 0, left: '15%', right: '15%', height: 2,
              background: isRecording
                ? 'linear-gradient(90deg, transparent, #EF4444, #00D4FF, transparent)'
                : extractedData
                ? 'linear-gradient(90deg, transparent, #10B981, #00D4FF, transparent)'
                : 'linear-gradient(90deg, transparent, #00D4FF, #8B5CF6, transparent)',
              borderRadius: 2,
              transition: 'background 0.5s',
            }} />

            {/* Close X */}
            <button
              onClick={onClose}
              style={{
                position: 'absolute', top: 20, right: 20,
                background: 'none', border: 'none', color: '#94A3B8',
                cursor: 'pointer', padding: 4, borderRadius: 8,
              }}
            >
              <X size={20} />
            </button>

            {/* ── ChatGPT Voice Orb Visualizer ── */}
            <div style={{ position: 'relative', width: 140, height: 140, margin: '10px auto 24px' }}>
              {/* Outer pulsing rings */}
              {[1, 2, 3].map((ring) => (
                <motion.div
                  key={ring}
                  style={{
                    position: 'absolute',
                    inset: -12 * ring,
                    borderRadius: '50%',
                    border: `1px solid ${
                      isRecording
                        ? `rgba(239, 68, 68, ${0.25 / ring})`
                        : extractedData
                        ? `rgba(16, 185, 129, ${0.25 / ring})`
                        : `rgba(0, 212, 255, ${0.25 / ring})`
                    }`,
                  }}
                  animate={isRecording ? {
                    scale: [1, 1 + (audioVolume / 100) * 0.25 + ring * 0.05, 1],
                    opacity: [0.4, 0.1, 0.4],
                  } : {
                    scale: [1, 1.08, 1],
                    opacity: [0.3, 0.1, 0.3],
                  }}
                  transition={{
                    duration: isRecording ? 0.8 / ring : 2.5,
                    repeat: Infinity,
                    ease: 'easeInOut',
                  }}
                />
              ))}

              {/* Core Orb Button */}
              <motion.div
                onClick={isRecording ? () => handleStopRecordingAndParse() : startRecording}
                animate={isRecording ? {
                  scale: [1, 1 + (audioVolume / 100) * 0.15, 1],
                  boxShadow: [
                    '0 0 30px rgba(239, 68, 68, 0.5), inset 0 0 20px rgba(255,255,255,0.2)',
                    `0 0 ${40 + audioVolume * 0.5}px rgba(239, 68, 68, 0.8), inset 0 0 30px rgba(255,255,255,0.4)`,
                    '0 0 30px rgba(239, 68, 68, 0.5), inset 0 0 20px rgba(255,255,255,0.2)',
                  ],
                } : {
                  scale: [1, 1.04, 1],
                  boxShadow: extractedData
                    ? '0 0 40px rgba(16, 185, 129, 0.5)'
                    : '0 0 40px rgba(0, 212, 255, 0.4)',
                }}
                transition={{ duration: 1.2, repeat: Infinity, ease: 'easeInOut' }}
                style={{
                  width: 140,
                  height: 140,
                  borderRadius: '50%',
                  background: isRecording
                    ? 'radial-gradient(circle at 35% 35%, #EF4444, #DC2626 50%, #991B1B)'
                    : extractedData
                    ? 'radial-gradient(circle at 35% 35%, #10B981, #059669 50%, #047857)'
                    : 'radial-gradient(circle at 35% 35%, #00D4FF, #0EA5E9 50%, #0369A1)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  margin: '0 auto',
                }}
              >
                {isRecording ? (
                  <Mic size={48} color="#fff" />
                ) : extractedData ? (
                  <Check size={48} color="#fff" />
                ) : (
                  <Volume2 size={48} color="#fff" />
                )}
              </motion.div>
            </div>

            {/* Title & Status */}
            <div style={{ textAlign: 'center', marginBottom: 20 }}>
              <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: 20, fontWeight: 700, color: '#F8FAFC', margin: '0 0 6px 0' }}>
                {isRecording
                  ? 'Listening… Speak your complaint'
                  : isProcessing
                  ? 'AI Parsing Voice Report…'
                  : extractedData
                  ? 'AI Voice Extraction Complete'
                  : 'Tap to Record Voice Complaint'}
              </h2>
              <p style={{ fontFamily: 'var(--font-body)', fontSize: 13, color: '#94A3B8', margin: 0 }}>
                {isRecording
                  ? 'Describe the issue, location, and severity naturally in English'
                  : isProcessing
                  ? 'Extracting defect type, GPS location, and department routing'
                  : extractedData
                  ? 'Review extracted fields and tap Accept to auto-fill form'
                  : 'Speak your report or select a sample prompt below'}
              </p>
            </div>

            {/* Permission Warning */}
            {permissionError && (
              <div style={{
                padding: 12,
                borderRadius: 12,
                background: 'rgba(245, 158, 11, 0.1)',
                border: '1px solid rgba(245, 158, 11, 0.3)',
                color: '#F59E0B',
                fontSize: 12,
                marginBottom: 16,
                textAlign: 'center',
              }}>
                {permissionError}
              </div>
            )}

            {/* ── Live Transcript Box ── */}
            <div style={{
              background: 'rgba(255, 255, 255, 0.03)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              borderRadius: 16,
              padding: 16,
              marginBottom: 20,
              minHeight: 80,
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <span style={{ fontSize: 11, fontWeight: 600, color: '#64748B', fontFamily: 'var(--font-body)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  Live Voice Transcript
                </span>
                {transcript && !isRecording && (
                  <button
                    onClick={() => setIsEditingTranscript(!isEditingTranscript)}
                    style={{ background: 'none', border: 'none', color: '#00D4FF', fontSize: 12, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}
                  >
                    <Edit3 size={12} />
                    {isEditingTranscript ? 'Done Editing' : 'Edit Text'}
                  </button>
                )}
              </div>

              {isEditingTranscript ? (
                <textarea
                  value={transcript}
                  onChange={(e) => setTranscript(e.target.value)}
                  onBlur={() => handleStopRecordingAndParse(transcript)}
                  rows={3}
                  style={{
                    width: '100%',
                    background: 'rgba(0,0,0,0.3)',
                    border: '1px solid rgba(0,212,255,0.3)',
                    borderRadius: 8,
                    color: '#F8FAFC',
                    padding: 8,
                    fontSize: 13,
                    fontFamily: 'var(--font-body)',
                    boxSizing: 'border-box',
                  }}
                />
              ) : (
                <div style={{
                  fontSize: 14,
                  lineHeight: 1.5,
                  color: transcript ? '#F8FAFC' : '#475569',
                  fontStyle: transcript ? 'normal' : 'italic',
                  fontFamily: 'var(--font-body)',
                }}>
                  {transcript ? `"${transcript}"` : isRecording ? 'Start speaking now… (e.g. "Pothole on Victoria Road near City Hospital")' : 'No transcript recorded yet.'}
                </div>
              )}
            </div>

            {/* ── Extracted AI Fields Summary (When completed) ── */}
            <AnimatePresence>
              {extractedData && (
                <motion.div
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 12 }}
                  style={{
                    background: 'rgba(16, 185, 129, 0.08)',
                    border: '1px solid rgba(16, 185, 129, 0.25)',
                    borderRadius: 16,
                    padding: 20,
                    marginBottom: 20,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                    <Sparkles size={16} color="#10B981" />
                    <span style={{ fontFamily: 'var(--font-heading)', fontSize: 14, fontWeight: 700, color: '#10B981' }}>
                      Extracted Incident Metadata
                    </span>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px 16px', fontSize: 13 }}>
                    <div>
                      <div style={{ color: '#64748B', fontSize: 11 }}>Issue Type</div>
                      <div style={{ color: '#F8FAFC', fontWeight: 600 }}>{extractedData.issueType}</div>
                    </div>
                    <div>
                      <div style={{ color: '#64748B', fontSize: 11 }}>Severity</div>
                      <div style={{ color: extractedData.severity === 'Critical' ? '#EF4444' : '#F59E0B', fontWeight: 700 }}>
                        {extractedData.severity}
                      </div>
                    </div>
                    <div>
                      <div style={{ color: '#64748B', fontSize: 11 }}>Location</div>
                      <div style={{ color: '#F8FAFC', fontWeight: 600 }}>{extractedData.location}</div>
                    </div>
                    <div>
                      <div style={{ color: '#64748B', fontSize: 11 }}>AI Priority Score</div>
                      <div style={{ color: '#00D4FF', fontWeight: 700, fontFamily: 'var(--font-mono)' }}>
                        {extractedData.priorityScore}/100
                      </div>
                    </div>
                    <div style={{ gridColumn: 'span 2' }}>
                      <div style={{ color: '#64748B', fontSize: 11 }}>Routed Department</div>
                      <div style={{ color: '#94A3B8', fontWeight: 500 }}>{extractedData.department}</div>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* ── Sample Demo Prompts (Quick Click) ── */}
            {!extractedData && !isRecording && (
              <div style={{ marginBottom: 20 }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>
                  Or click a sample voice prompt:
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {SAMPLE_PROMPTS.map((prompt, idx) => (
                    <button
                      key={idx}
                      onClick={() => handleUseSamplePrompt(prompt)}
                      style={{
                        padding: '10px 14px',
                        background: 'rgba(255,255,255,0.03)',
                        border: '1px solid rgba(255,255,255,0.08)',
                        borderRadius: 10,
                        color: '#94A3B8',
                        fontSize: 12,
                        textAlign: 'left',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        transition: 'all 0.2s',
                      }}
                    >
                      <Play size={12} color="#00D4FF" />
                      "{prompt}"
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* ── Action Buttons ── */}
            <div style={{ display: 'flex', gap: 12 }}>
              {isRecording ? (
                <button
                  onClick={() => handleStopRecordingAndParse()}
                  style={{
                    flex: 1,
                    padding: 14,
                    background: 'linear-gradient(135deg, #EF4444, #DC2626)',
                    color: '#fff',
                    border: 'none',
                    borderRadius: 12,
                    fontWeight: 700,
                    fontSize: 14,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 8,
                    boxShadow: '0 4px 16px rgba(239, 68, 68, 0.4)',
                  }}
                >
                  <MicOff size={18} />
                  Stop & Parse with AI
                </button>
              ) : extractedData ? (
                <>
                  <button
                    onClick={handleRetry}
                    style={{
                      flex: 1,
                      padding: 14,
                      background: 'rgba(255,255,255,0.06)',
                      color: '#94A3B8',
                      border: '1px solid rgba(255,255,255,0.1)',
                      borderRadius: 12,
                      fontWeight: 600,
                      fontSize: 14,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 6,
                    }}
                  >
                    <RotateCcw size={16} />
                    Retry
                  </button>
                  <button
                    onClick={handleAccept}
                    style={{
                      flex: 2,
                      padding: 14,
                      background: 'linear-gradient(135deg, #10B981, #059669)',
                      color: '#fff',
                      border: 'none',
                      borderRadius: 12,
                      fontWeight: 700,
                      fontSize: 14,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 8,
                      boxShadow: '0 4px 16px rgba(16, 185, 129, 0.4)',
                    }}
                  >
                    <Check size={18} />
                    Accept & Auto-Fill Form
                  </button>
                </>
              ) : (
                <button
                  onClick={startRecording}
                  style={{
                    flex: 1,
                    padding: 14,
                    background: 'linear-gradient(135deg, #00D4FF, #0EA5E9)',
                    color: '#000',
                    border: 'none',
                    borderRadius: 12,
                    fontWeight: 700,
                    fontSize: 14,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 8,
                    boxShadow: '0 4px 16px rgba(0, 212, 255, 0.3)',
                  }}
                >
                  <Mic size={18} />
                  Start Recording
                </button>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
