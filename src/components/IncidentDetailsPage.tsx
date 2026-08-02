import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft, MapPin, CheckCircle2, Truck, Cpu, Brain,
  Download, Send, ChevronRight, Layers, Phone, Users,
  Sparkles, Check, X, Bot, Maximize2, LogOut,
  AlertTriangle, TrendingUp, ShieldAlert, DollarSign, Clock, Building, Activity
} from 'lucide-react';
import type { IncidentStatus, WorkflowStageItem, AuditLogItem } from '../types';
import { 
  apiFetchIncidentById, apiUpdateIncident,
  apiTransitionWorkflowStage, apiFetchWorkflowTimeline, apiFetchAuditLogs
} from '../services/apiClient';
import { downloadIncidentPDFReport } from '../services/pdfReportGenerator';
import { AISimulationTimelineModal } from './AISimulationTimelineModal';
import { IncidentSkeleton } from './IncidentSkeleton';

interface IncidentDetailsPageProps {
  incidentId: string;
  onBack: () => void;
  onStatusChange?: (incidentId: string, newStatus: IncidentStatus) => void;
  onDispatchCrew?: (incidentId: string) => void;
  onOpenGISMap?: () => void;
  onOpenComplaintHistory?: () => void;
  onOpenLogoutModal?: () => void;
}

const DEPARTMENTS_MAP: Record<string, string> = {
  pothole: 'Road Infrastructure & Civil Works Dept',
  garbage: 'Solid Waste Management Division',
  drainage: 'Stormwater & Drainage Bureau',
  water_leak: 'Water Supply & Sewerage Board',
  streetlight: 'Electrical & Lighting Department',
  road_collapse: 'Emergency Civil Engineering Taskforce',
};

const SEVERITY_COLORS: Record<string, string> = {
  critical: '#EF4444',
  high: '#F59E0B',
  medium: '#3B82F6',
  low: '#10B981',
};

const STATUS_COLORS: Record<string, string> = {
  reported: '#F59E0B',
  ai_analysis: '#8B5CF6',
  verified: '#3B82F6',
  priority_assigned: '#EC4899',
  commissioner_review: '#F97316',
  crew_assigned: '#00D4FF',
  en_route: '#38BDF8',
  repair_started: '#EAB308',
  quality_inspection: '#A855F7',
  resolved: '#10B981',
  citizen_notified: '#059669',
  in_progress: '#00D4FF',
};

// Complete 11-Stage Enterprise Lifecycle Stages
const LIFECYCLE_STAGES_CONFIG = [
  { id: 'reported', label: '1. Reported', icon: '📝', dept: 'Citizen Services' },
  { id: 'ai_analysis', label: '2. AI Analysis', icon: '🧠', dept: 'AI Vision Engine' },
  { id: 'verified', label: '3. Verified', icon: '🔍', dept: 'Field Inspection' },
  { id: 'priority_assigned', label: '4. Priority Assigned', icon: '⚡', dept: 'XAI Risk Core' },
  { id: 'commissioner_review', label: '5. Commissioner Review', icon: '🏛️', dept: 'Office of Commissioner' },
  { id: 'crew_assigned', label: '6. Crew Assigned', icon: '🚒', dept: 'Rapid Logistics' },
  { id: 'en_route', label: '7. En Route', icon: '🚚', dept: 'Field Operations' },
  { id: 'repair_started', label: '8. Repair Started', icon: '🔧', dept: 'Civil Engineering' },
  { id: 'quality_inspection', label: '9. Quality Inspection', icon: '🔬', dept: 'QA Bureau' },
  { id: 'resolved', label: '10. Resolved', icon: '✅', dept: 'Resolution Taskforce' },
  { id: 'citizen_notified', label: '11. Citizen Notified', icon: '📱', dept: 'Citizen Portal' },
];

export const IncidentDetailsPage: React.FC<IncidentDetailsPageProps> = ({
  incidentId,
  onBack,
  onStatusChange,
  onDispatchCrew,
  onOpenGISMap,
  onOpenComplaintHistory,
  onOpenLogoutModal,
}) => {
  const queryClient = useQueryClient();
  const [showBoundingBox, setShowBoundingBox] = useState(true);
  const [viewTab, setViewTab] = useState<'current' | 'repaired'>('current');
  const [isLightboxOpen, setIsLightboxOpen] = useState(false);
  const [isCopilotOpen, setIsCopilotOpen] = useState(false);
  const [isSimulationOpen, setIsSimulationOpen] = useState(false);

  // ── Role Selector State ──
  const [activeRole, setActiveRole] = useState<'citizen' | 'engineer' | 'commissioner' | 'admin'>('commissioner');
  const [transitionNotes, setTransitionNotes] = useState('');
  const [completionPhotoUrl, setCompletionPhotoUrl] = useState('');

  // Fetch live incident details from GET /api/v1/incidents/{id}
  const { data: incident, isLoading, isError } = useQuery({
    queryKey: ['incident', incidentId],
    queryFn: () => apiFetchIncidentById(incidentId),
  });

  // Fetch 11-Stage Live Workflow Timeline
  const { data: timelineItems = [] } = useQuery<WorkflowStageItem[]>({
    queryKey: ['workflow-timeline', incidentId],
    queryFn: () => apiFetchWorkflowTimeline(incidentId),
    refetchInterval: 3000,
  });

  // Fetch Live Incident Audit Logs
  const { data: auditLogs = [] } = useQuery<AuditLogItem[]>({
    queryKey: ['audit-logs', incidentId],
    queryFn: () => apiFetchAuditLogs(incidentId),
    refetchInterval: 3000,
  });

  const transitionStageMutation = useMutation({
    mutationFn: ({ targetStage, actor, notes, resolvedPhotoUrl, assignedCrew }: { targetStage: string; actor: string; notes?: string; resolvedPhotoUrl?: string; assignedCrew?: string }) =>
      apiTransitionWorkflowStage(incidentId, targetStage, actor, notes, resolvedPhotoUrl, assignedCrew),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['incident', incidentId] });
      queryClient.invalidateQueries({ queryKey: ['incidents'] });
      queryClient.invalidateQueries({ queryKey: ['workflow-timeline', incidentId] });
      queryClient.invalidateQueries({ queryKey: ['audit-logs', incidentId] });
      setTransitionNotes('');
      if (onStatusChange) onStatusChange(incidentId, data.current_stage);
      showToast(`Workflow Advanced: ${data.current_stage.replace('_', ' ').toUpperCase()}`);
    }
  });
  // Incident Operations Copilot Messages
  const [copilotMessages, setCopilotMessages] = useState<Array<{ sender: 'ai' | 'user'; text: string }>>([]);
  const [copilotInput, setCopilotInput] = useState('');

  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const handleStatusUpdate = (status: IncidentStatus) => {
    updateStatusMutation.mutate(status);
  };

  const handleDispatch = () => {
    if (onDispatchCrew) onDispatchCrew(incidentId);
    handleStatusUpdate('in_progress');
  };

  const handleDownloadPDF = async () => {
    if (!incident) return;
    showToast('Generating Production PDF Audit Dossier...');
    await downloadIncidentPDFReport(incident);
    showToast('Official PDF Dossier downloaded successfully');
  };

  if (isLoading) {
    return (
      <div style={{ maxWidth: 1280, margin: '0 auto', paddingBottom: 80 }}>
        <button onClick={onBack} style={{ marginBottom: 24, padding: '8px 14px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, color: '#F8FAFC', cursor: 'pointer' }}>Back</button>
        <IncidentSkeleton />
      </div>
    );
  }

  if (isError || !incident) {
    return (
      <div style={{ maxWidth: 1280, margin: '0 auto', paddingBottom: 80, textAlign: 'center', color: '#EF4444' }}>
        <h2>Error Loading Incident Data</h2>
        <button onClick={onBack} style={{ marginTop: 16, padding: '8px 14px', background: '#EF4444', color: '#fff', border: 'none', borderRadius: 8 }}>Go Back</button>
      </div>
    );
  }

  const severityColor = SEVERITY_COLORS[incident.severity] || '#F59E0B';
  const statusColor = STATUS_COLORS[incident.status];

  // 6-stage active index calculation
  const getStageIndex = () => {
    if (incident.status === 'resolved') return 5;
    if (incident.status === 'in_progress') return 4;
    return 2; // reported
  };
  const activeStageIndex = getStageIndex();

  // Repaired photo simulation (for before/after)
  const repairedPhotoUrl = 'https://images.unsplash.com/photo-1578575437130-527eed3abbec?auto=format&fit=crop&w=1000&q=80';

  // Initialize Copilot message safely
  if (copilotMessages.length === 0) {
    setCopilotMessages([{
      sender: 'ai',
      text: `Incident Operations Copilot active for ${incident.title} (Priority: ${incident.priorityScore}/100). Automatically tracking SLA, crew dispatch, and root cause analysis for this location. How can I assist?`,
    }]);
  }

  return (
    <div style={{ maxWidth: 1280, margin: '0 auto', paddingBottom: 80, position: 'relative' }}>
      
      {/* Toast Notification */}
      <AnimatePresence>
        {toastMessage && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            style={{
              position: 'fixed',
              top: 80,
              right: 30,
              zIndex: 9999,
              background: 'rgba(0, 212, 255, 0.95)',
              color: '#000',
              padding: '10px 18px',
              borderRadius: 12,
              fontWeight: 700,
              fontSize: 13,
              fontFamily: 'var(--font-body)',
              boxShadow: '0 8px 24px rgba(0,212,255,0.4)',
            }}
          >
            ✓ {toastMessage}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Top Command Action Header Bar ── */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: 16,
        marginBottom: 24,
        paddingBottom: 16,
        borderBottom: '1px solid rgba(255,255,255,0.08)',
      }}>
        {/* Back & Breadcrumbs */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button
            onClick={onBack}
            style={{
              padding: '8px 14px',
              background: 'rgba(255,255,255,0.05)',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: 10,
              color: '#F8FAFC',
              fontSize: 13,
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            <ArrowLeft size={16} />
            Back
          </button>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: '#94A3B8', fontFamily: 'var(--font-mono)' }}>
            <span>Central Command</span>
            <ChevronRight size={14} />
            <span>{incident.wardName.split(' - ')[0]}</span>
            <ChevronRight size={14} />
            <span style={{ color: '#00D4FF', fontWeight: 700 }}>{incident.id}</span>
          </div>
        </div>

        {/* 5 Action Buttons */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          {/* Logout Button */}
          <button
            onClick={() => onOpenLogoutModal && onOpenLogoutModal()}
            title="Sign Out"
            style={{
              padding: '8px 14px',
              background: 'rgba(239, 68, 68, 0.18)',
              border: '1px solid rgba(239, 68, 68, 0.4)',
              borderRadius: 10,
              color: '#EF4444',
              fontSize: 12,
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            <LogOut size={14} color="#EF4444" />
            Logout
          </button>
          {/* 1. Run AI Simulation Time Machine */}
          <button
            onClick={() => setIsSimulationOpen(true)}
            style={{
              padding: '8px 14px',
              background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.25), rgba(0, 212, 255, 0.25))',
              border: '1px solid #8B5CF6',
              borderRadius: 10,
              color: '#F8FAFC',
              fontSize: 12,
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              boxShadow: '0 4px 14px rgba(139, 92, 246, 0.3)',
            }}
          >
            <Brain size={14} color="#00D4FF" />
            Run AI Simulation
          </button>

          {/* 1B. Generate PDF Report */}
          <button
            onClick={handleDownloadPDF}
            style={{
              padding: '8px 14px',
              background: 'rgba(255, 255, 255, 0.05)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              borderRadius: 10,
              color: '#F8FAFC',
              fontSize: 12,
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            <Download size={14} />
            Generate PDF Report
          </button>

          {/* 2. Assign Crew */}
          <button
            onClick={handleDispatch}
            style={{
              padding: '8px 14px',
              background: 'linear-gradient(135deg, #00D4FF, #0EA5E9)',
              color: '#000',
              border: 'none',
              borderRadius: 10,
              fontWeight: 700,
              fontSize: 12,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              boxShadow: '0 4px 14px rgba(0, 212, 255, 0.3)',
            }}
          >
            <Truck size={14} />
            Assign Crew
          </button>

          {/* 3. Open GIS Map */}
          <button
            onClick={onOpenGISMap || onBack}
            style={{
              padding: '8px 14px',
              background: 'rgba(139, 92, 246, 0.12)',
              border: '1px solid rgba(139, 92, 246, 0.3)',
              color: '#8B5CF6',
              borderRadius: 10,
              fontWeight: 600,
              fontSize: 12,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            <MapPin size={14} />
            Open GIS Map
          </button>

          {/* 4. View Complaint History */}
          <button
            onClick={onOpenComplaintHistory || onBack}
            style={{
              padding: '8px 14px',
              background: 'rgba(255, 255, 255, 0.05)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              borderRadius: 10,
              color: '#94A3B8',
              fontSize: 12,
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            <Layers size={14} />
            View History
          </button>

          {/* 5. Mark as Resolved */}
          <button
            onClick={() => handleStatusUpdate(incident.status === 'resolved' ? 'in_progress' : 'resolved')}
            style={{
              padding: '8px 14px',
              background: incident.status === 'resolved' ? 'rgba(16, 185, 129, 0.2)' : 'rgba(16, 185, 129, 0.1)',
              border: '1px solid rgba(16, 185, 129, 0.3)',
              color: '#10B981',
              borderRadius: 10,
              fontWeight: 700,
              fontSize: 12,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            <CheckCircle2 size={14} />
            {incident.status === 'resolved' ? 'Resolved ✓' : 'Mark as Resolved'}
          </button>
        </div>
      </div>

      {/* ── Main 2-Column Command Grid (Palantir Gotham + Linear + Tesla) ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 28 }}>
        
        {/* ═══════════════════════════════════════════
            LEFT COLUMN: Visual Inspection & Media AI
        ═══════════════════════════════════════════ */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>

          {/* 1. Large Image Card with Bounding Box & Before/After */}
          <div style={{
            background: 'rgba(17, 24, 39, 0.75)',
            backdropFilter: 'blur(24px)',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: 24,
            overflow: 'hidden',
            position: 'relative',
          }}>
            {/* Header Tabs: Current vs Repaired Preview */}
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '12px 18px',
              background: 'rgba(0,0,0,0.3)',
              borderBottom: '1px solid rgba(255,255,255,0.06)',
            }}>
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  onClick={() => setViewTab('current')}
                  style={{
                    padding: '6px 12px',
                    borderRadius: 8,
                    background: viewTab === 'current' ? '#00D4FF' : 'transparent',
                    color: viewTab === 'current' ? '#000' : '#94A3B8',
                    border: 'none',
                    fontWeight: 700,
                    fontSize: 12,
                    cursor: 'pointer',
                  }}
                >
                  Current Reported State
                </button>
                <button
                  onClick={() => setViewTab('repaired')}
                  style={{
                    padding: '6px 12px',
                    borderRadius: 8,
                    background: viewTab === 'repaired' ? '#10B981' : 'transparent',
                    color: viewTab === 'repaired' ? '#000' : '#94A3B8',
                    border: 'none',
                    fontWeight: 700,
                    fontSize: 12,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4,
                  }}
                >
                  <Sparkles size={12} />
                  AI Repaired Preview
                </button>
              </div>

              {/* Lightbox Zoom Trigger */}
              <button
                onClick={() => setIsLightboxOpen(true)}
                style={{
                  padding: '6px 10px',
                  background: 'rgba(255,255,255,0.06)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: 8,
                  color: '#F8FAFC',
                  fontSize: 11,
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                }}
              >
                <Maximize2 size={12} />
                Zoom
              </button>
            </div>

            {/* Image Container */}
            <div style={{ position: 'relative', height: 420, width: '100%', background: '#000' }}>
              <img
                src={viewTab === 'current' ? incident.photoUrl : repairedPhotoUrl}
                alt={incident.title}
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              />

              {/* Overlay AI Detection Bounding Box (Only on current tab) */}
              <AnimatePresence>
                {viewTab === 'current' && showBoundingBox && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0 }}
                    style={{
                      position: 'absolute',
                      top: '22%',
                      left: '25%',
                      width: '45%',
                      height: '50%',
                      border: '2px dashed #00D4FF',
                      borderRadius: 14,
                      boxShadow: '0 0 24px rgba(0, 212, 255, 0.4), inset 0 0 24px rgba(0, 212, 255, 0.18)',
                      pointerEvents: 'none',
                    }}
                  >
                    <div style={{
                      position: 'absolute',
                      top: -28,
                      left: 0,
                      background: '#00D4FF',
                      color: '#000',
                      padding: '4px 10px',
                      borderRadius: '6px 6px 6px 0',
                      fontSize: 11,
                      fontWeight: 700,
                      fontFamily: 'var(--font-mono)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                    }}>
                      <Cpu size={13} />
                      {incident.type.toUpperCase().replace('_', ' ')} · Confidence: {incident.xai.cvConfidence}%
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Toggle Box Control */}
              {viewTab === 'current' && (
                <div style={{ position: 'absolute', bottom: 12, right: 12 }}>
                  <button
                    onClick={() => setShowBoundingBox(!showBoundingBox)}
                    style={{
                      padding: '6px 12px',
                      background: 'rgba(7,11,20,0.85)',
                      backdropFilter: 'blur(10px)',
                      border: '1px solid rgba(0,212,255,0.3)',
                      borderRadius: 8,
                      color: '#00D4FF',
                      fontSize: 11,
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    {showBoundingBox ? 'Hide Bounding Box' : 'Show Bounding Box'}
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* 2. Interactive GIS Mini Map Location Card */}
          <div style={{
            background: 'rgba(17, 24, 39, 0.75)',
            backdropFilter: 'blur(24px)',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: 24,
            padding: 20,
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#00D4FF', fontSize: 13, fontWeight: 700 }}>
                <MapPin size={15} />
                GIS Location & Coordinates
              </div>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: '#94A3B8' }}>
                {incident.lat.toFixed(4)}°N, {incident.lng.toFixed(4)}°E
              </span>
            </div>

            <div style={{
              height: 160,
              borderRadius: 16,
              background: 'radial-gradient(circle at 50% 50%, #081B33, #070B14)',
              border: '1px solid rgba(0, 212, 255, 0.2)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              position: 'relative',
              overflow: 'hidden',
            }}>
              <div style={{ position: 'absolute', inset: 0, opacity: 0.15, background: 'radial-gradient(circle, #00D4FF 1px, transparent 1px)', backgroundSize: '16px 16px' }} />
              
              <div style={{ textAlign: 'center', zIndex: 2 }}>
                <motion.div
                  animate={{ scale: [1, 1.2, 1] }}
                  transition={{ duration: 2, repeat: Infinity }}
                  style={{ display: 'inline-block', marginBottom: 6 }}
                >
                  <MapPin size={32} color="#00D4FF" />
                </motion.div>
                <div style={{ color: '#F8FAFC', fontWeight: 600, fontSize: 13 }}>{incident.address}</div>
                <div style={{ color: '#64748B', fontSize: 11, marginTop: 2 }}>{incident.wardName}</div>
              </div>
            </div>
          </div>

        </div>


        {/* ═══════════════════════════════════════════
            RIGHT COLUMN: Incident Info, XAI, Timeline, Officer & AI Summary
        ═══════════════════════════════════════════ */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>

          {/* ═══════════════════════════════════════════
              CENTRAL AI INTELLIGENCE PANEL (13 Output Cards)
          ═══════════════════════════════════════════ */}
          <div style={{
            background: 'rgba(17, 24, 39, 0.85)',
            backdropFilter: 'blur(28px)',
            border: '1px solid rgba(0, 212, 255, 0.35)',
            borderRadius: 24,
            padding: 24,
            boxShadow: '0 20px 40px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.1)',
            display: 'flex',
            flexDirection: 'column',
            gap: 16,
          }}>
            {/* Panel Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{
                  width: 34,
                  height: 34,
                  borderRadius: 10,
                  background: 'linear-gradient(135deg, #00D4FF, #8B5CF6)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: '0 0 16px rgba(0, 212, 255, 0.4)',
                }}>
                  <Brain size={20} color="#000" />
                </div>
                <div>
                  <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: 16, fontWeight: 700, color: '#F8FAFC', margin: 0 }}>
                    AI Incident Intelligence Panel
                  </h3>
                  <div style={{ fontSize: 11, color: '#00D4FF', fontWeight: 600 }}>
                    Central Decision-Making Engine · Gemini 2.5 Flash Multimodal
                  </div>
                </div>
              </div>

              {(incident.confidence || incident.xai.cvConfidence || 85) < 80 || incident.requiresManualReview ? (
                <span style={{
                  padding: '4px 10px',
                  borderRadius: 999,
                  background: 'rgba(245, 158, 11, 0.2)',
                  border: '1px solid #F59E0B',
                  color: '#F59E0B',
                  fontSize: 11,
                  fontWeight: 800,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                }}>
                  <AlertTriangle size={12} />
                  Manual Review Suggested (&lt; 80%)
                </span>
              ) : (
                <span style={{
                  padding: '4px 10px',
                  borderRadius: 999,
                  background: 'rgba(16, 185, 129, 0.2)',
                  border: '1px solid #10B981',
                  color: '#10B981',
                  fontSize: 11,
                  fontWeight: 800,
                }}>
                  High Confidence Classification
                </span>
              )}
            </div>

            {/* CARD 1: Detected Civic Issue & Confidence Gauge */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: '1.2fr 1fr',
              gap: 14,
              background: 'rgba(255, 255, 255, 0.03)',
              border: '1px solid rgba(255, 255, 255, 0.06)',
              borderRadius: 16,
              padding: 16,
            }}>
              <div>
                <div style={{ fontSize: 11, color: '#64748B', fontWeight: 600, textTransform: 'uppercase' }}>Detected Civic Issue</div>
                <div style={{ fontSize: 18, fontWeight: 800, color: '#F8FAFC', textTransform: 'capitalize', marginTop: 2 }}>
                  {incident.category || incident.title || incident.type.replace(/_/g, ' ')}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8 }}>
                  <span style={{
                    padding: '3px 8px',
                    borderRadius: 6,
                    background: severityColor + '22',
                    border: `1px solid ${severityColor}`,
                    color: severityColor,
                    fontSize: 10,
                    fontWeight: 800,
                    textTransform: 'uppercase',
                  }}>
                    Severity: {incident.severity.toUpperCase()}
                  </span>
                  <span style={{
                    padding: '3px 8px',
                    borderRadius: 6,
                    background: 'rgba(0, 212, 255, 0.15)',
                    border: '1px solid rgba(0, 212, 255, 0.3)',
                    color: '#00D4FF',
                    fontSize: 10,
                    fontWeight: 800,
                    fontFamily: 'var(--font-mono)',
                  }}>
                    Priority Score: {incident.priorityScore} / 100
                  </span>
                </div>
              </div>

              {/* Confidence Score Bar */}
              <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 4 }}>
                  <span style={{ color: '#64748B', fontWeight: 600 }}>Confidence Score</span>
                  <span style={{ color: '#10B981', fontWeight: 800, fontFamily: 'var(--font-mono)' }}>
                    {incident.confidence || incident.xai.cvConfidence}%
                  </span>
                </div>
                <div style={{ height: 8, background: 'rgba(255,255,255,0.08)', borderRadius: 4, overflow: 'hidden' }}>
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${incident.confidence || incident.xai.cvConfidence}%` }}
                    transition={{ duration: 1 }}
                    style={{
                      height: '100%',
                      background: (incident.confidence || incident.xai.cvConfidence || 85) >= 80 ? 'linear-gradient(90deg, #00D4FF, #10B981)' : 'linear-gradient(90deg, #F59E0B, #EF4444)',
                      borderRadius: 4,
                    }}
                  />
                </div>
              </div>
            </div>

            {/* CARD 2: Executive Summary & Technical Description */}
            <div style={{
              background: 'rgba(0, 212, 255, 0.05)',
              border: '1px solid rgba(0, 212, 255, 0.2)',
              borderRadius: 16,
              padding: 16,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#00D4FF', fontSize: 12, fontWeight: 700, marginBottom: 6 }}>
                <Sparkles size={14} />
                Executive Summary
              </div>
              <p style={{ margin: 0, fontSize: 13, lineHeight: 1.5, color: '#F8FAFC', fontWeight: 500 }}>
                {incident.executiveSummary || incident.explanation || "High-priority municipal infrastructure hazard detected requiring immediate maintenance crew dispatch and arterial route stabilization."}
              </p>
              {incident.description && (
                <div style={{ marginTop: 8, paddingTop: 8, borderTop: '1px solid rgba(255,255,255,0.06)', fontSize: 12, color: '#94A3B8' }}>
                  <strong style={{ color: '#F8FAFC' }}>Short Description:</strong> {incident.description}
                </div>
              )}
            </div>

            {/* CARD 3 & 4: Public Safety Risk & Environmental Impact Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              {/* Public Safety Risk */}
              <div style={{
                background: 'rgba(239, 68, 68, 0.06)',
                border: '1px solid rgba(239, 68, 68, 0.2)',
                borderRadius: 16,
                padding: 14,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#EF4444', fontSize: 12, fontWeight: 700, marginBottom: 4 }}>
                  <ShieldAlert size={14} />
                  Public Safety Risk
                </div>
                <div style={{ fontSize: 12, color: '#F8FAFC', lineHeight: 1.4 }}>
                  {incident.publicSafetyRisk || "Presents severe collision hazard for vehicles, two-wheelers, and emergency ambulances during peak transit hours."}
                </div>
              </div>

              {/* Environmental Impact */}
              <div style={{
                background: 'rgba(245, 158, 11, 0.06)',
                border: '1px solid rgba(245, 158, 11, 0.2)',
                borderRadius: 16,
                padding: 14,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#F59E0B', fontSize: 12, fontWeight: 700, marginBottom: 4 }}>
                  <TrendingUp size={14} />
                  Environmental Impact
                </div>
                <div style={{ fontSize: 12, color: '#F8FAFC', lineHeight: 1.4 }}>
                  {incident.environmentalImpact || "Sub-surface runoff erosion threat; potential contamination of urban drainage channels if unsealed."}
                </div>
              </div>
            </div>

            {/* CARD 5 & 6: Future Damage Prediction & AI Recommendation Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              {/* Future Damage Prediction */}
              <div style={{
                background: 'rgba(139, 92, 246, 0.06)',
                border: '1px solid rgba(139, 92, 246, 0.2)',
                borderRadius: 16,
                padding: 14,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#8B5CF6', fontSize: 12, fontWeight: 700, marginBottom: 4 }}>
                  <Activity size={14} />
                  Future Damage Prediction (48h)
                </div>
                <div style={{ fontSize: 12, color: '#F8FAFC', lineHeight: 1.4 }}>
                  {incident.futureDamagePrediction || "Defect area predicted to expand by 35% within 48 hours due to monsoon precipitation dynamics."}
                </div>
              </div>

              {/* AI Strategic Recommendation */}
              <div style={{
                background: 'rgba(16, 185, 129, 0.06)',
                border: '1px solid rgba(16, 185, 129, 0.2)',
                borderRadius: 16,
                padding: 14,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#10B981', fontSize: 12, fontWeight: 700, marginBottom: 4 }}>
                  <CheckCircle2 size={14} />
                  AI Recommendation
                </div>
                <div style={{ fontSize: 12, color: '#F8FAFC', lineHeight: 1.4 }}>
                  {incident.aiRecommendation || "Deploy Rapid Response Crew with hot-mix asphalt patching equipment immediately to prevent secondary failure."}
                </div>
              </div>
            </div>

            {/* CARD 7: Recommended Department, Estimated Time & Cost Grid */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              gap: 10,
              background: 'rgba(255, 255, 255, 0.02)',
              border: '1px solid rgba(255, 255, 255, 0.06)',
              borderRadius: 16,
              padding: 14,
            }}>
              <div>
                <div style={{ fontSize: 10, color: '#64748B', fontWeight: 600 }}>Recommended Department</div>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#F8FAFC', marginTop: 2 }}>
                  {incident.recommendedDepartment || DEPARTMENTS_MAP[incident.type] || 'Road Infrastructure Dept'}
                </div>
              </div>
              <div>
                <div style={{ fontSize: 10, color: '#64748B', fontWeight: 600 }}>Estimated Repair Time</div>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#10B981', marginTop: 2 }}>
                  {incident.estimatedRepairTime || `${incident.estimatedCompletionTimeHours || 3.5} Hours`}
                </div>
              </div>
              <div>
                <div style={{ fontSize: 10, color: '#64748B', fontWeight: 600 }}>Estimated Repair Cost</div>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#00D4FF', fontFamily: 'var(--font-mono)', marginTop: 2 }}>
                  ₹{incident.estimatedRepairCost.toLocaleString()}
                </div>
              </div>
            </div>
          </div>

          {/* ═══════════════════════════════════════════
              WEATHER INTELLIGENCE PANEL
          ═══════════════════════════════════════════ */}
          <div style={{
            background: 'rgba(17, 24, 39, 0.75)',
            backdropFilter: 'blur(24px)',
            border: '1px solid rgba(0,212,255,0.15)',
            borderRadius: 24,
            padding: 20,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#00D4FF', fontSize: 15, fontWeight: 700 }}>
                <Sparkles size={18} />
                Weather Intelligence System
              </div>
              <span style={{ fontSize: 11, background: 'rgba(245,158,11,0.15)', border: '1px solid #F59E0B', color: '#F59E0B', padding: '2px 8px', borderRadius: 6, fontWeight: 700 }}>
                MONSOON RUNOFF WARNING
              </span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, fontSize: 12 }}>
              <div style={{ padding: 10, background: 'rgba(255,255,255,0.03)', borderRadius: 12 }}>
                <div style={{ color: '#64748B', fontSize: 10 }}>Rainfall</div>
                <div style={{ color: '#00D4FF', fontWeight: 700, fontSize: 14, fontFamily: 'var(--font-mono)' }}>48 mm/hr</div>
              </div>
              <div style={{ padding: 10, background: 'rgba(255,255,255,0.03)', borderRadius: 12 }}>
                <div style={{ color: '#64748B', fontSize: 10 }}>Temperature</div>
                <div style={{ color: '#F8FAFC', fontWeight: 700, fontSize: 14, fontFamily: 'var(--font-mono)' }}>27.4 °C</div>
              </div>
              <div style={{ padding: 10, background: 'rgba(255,255,255,0.03)', borderRadius: 12 }}>
                <div style={{ color: '#64748B', fontSize: 10 }}>Flood Risk</div>
                <div style={{ color: '#EF4444', fontWeight: 700, fontSize: 14 }}>HIGH (88%)</div>
              </div>
              <div style={{ padding: 10, background: 'rgba(255,255,255,0.03)', borderRadius: 12 }}>
                <div style={{ color: '#64748B', fontSize: 10 }}>Wind Speed</div>
                <div style={{ color: '#F8FAFC', fontWeight: 600 }}>18 km/h SSW</div>
              </div>
              <div style={{ padding: 10, background: 'rgba(255,255,255,0.03)', borderRadius: 12 }}>
                <div style={{ color: '#64748B', fontSize: 10 }}>Visibility</div>
                <div style={{ color: '#10B981', fontWeight: 600 }}>4.2 km</div>
              </div>
              <div style={{ padding: 10, background: 'rgba(255,255,255,0.03)', borderRadius: 12 }}>
                <div style={{ color: '#64748B', fontSize: 10 }}>Weather Impact</div>
                <div style={{ color: '#F59E0B', fontWeight: 700 }}>+35% Runoff Surge</div>
              </div>
            </div>
          </div>

          {/* ═══════════════════════════════════════════
              TRAFFIC INTELLIGENCE PANEL
          ═══════════════════════════════════════════ */}
          <div style={{
            background: 'rgba(17, 24, 39, 0.75)',
            backdropFilter: 'blur(24px)',
            border: '1px solid rgba(139,92,246,0.2)',
            borderRadius: 24,
            padding: 20,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#8B5CF6', fontSize: 15, fontWeight: 700 }}>
                <Truck size={18} />
                Traffic & Mobility Intelligence
              </div>
              <span style={{ fontSize: 11, background: 'rgba(139,92,246,0.15)', border: '1px solid #8B5CF6', color: '#8B5CF6', padding: '2px 8px', borderRadius: 6, fontWeight: 700 }}>
                HEAVY CONGESTION
              </span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, fontSize: 12 }}>
              <div style={{ padding: 10, background: 'rgba(255,255,255,0.03)', borderRadius: 12 }}>
                <div style={{ color: '#64748B', fontSize: 10 }}>Current Daily Traffic</div>
                <div style={{ color: '#F8FAFC', fontWeight: 700, fontFamily: 'var(--font-mono)' }}>{incident.xai.estimatedDailyTraffic.toLocaleString()} vehicles/day</div>
              </div>
              <div style={{ padding: 10, background: 'rgba(255,255,255,0.03)', borderRadius: 12 }}>
                <div style={{ color: '#64748B', fontSize: 10 }}>Road Congestion</div>
                <div style={{ color: '#EF4444', fontWeight: 700 }}>HEAVY (84% Capacity)</div>
              </div>
              <div style={{ padding: 10, background: 'rgba(255,255,255,0.03)', borderRadius: 12 }}>
                <div style={{ color: '#64748B', fontSize: 10 }}>Emergency Delay</div>
                <div style={{ color: '#F59E0B', fontWeight: 700 }}>+6.2 Mins Delay</div>
              </div>
              <div style={{ padding: 10, background: 'rgba(255,255,255,0.03)', borderRadius: 12 }}>
                <div style={{ color: '#64748B', fontSize: 10 }}>Suggested Bypass Route</div>
                <div style={{ color: '#00D4FF', fontWeight: 600 }}>Victoria Rd → Hospital Bypass</div>
              </div>
            </div>
          </div>

          {/* ═══════════════════════════════════════════
              NEARBY CRITICAL INFRASTRUCTURE
          ═══════════════════════════════════════════ */}
          <div style={{
            background: 'rgba(17, 24, 39, 0.75)',
            backdropFilter: 'blur(24px)',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: 24,
            padding: 20,
          }}>
            <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: 15, fontWeight: 700, color: '#F8FAFC', margin: '0 0 14px 0' }}>
              Nearby Critical Infrastructure Proximity
            </h3>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, fontSize: 12 }}>
              <div style={{ padding: 10, background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 12 }}>
                <div style={{ color: '#EF4444', fontWeight: 700 }}>🏥 Hospital</div>
                <div style={{ color: '#F8FAFC', fontWeight: 600 }}>{incident.xai.hospitalName} ({incident.xai.hospitalProximityMeters}m)</div>
              </div>
              <div style={{ padding: 10, background: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.2)', borderRadius: 12 }}>
                <div style={{ color: '#3B82F6', fontWeight: 700 }}>🏫 School</div>
                <div style={{ color: '#F8FAFC', fontWeight: 600 }}>St. Joseph Academy (520m)</div>
              </div>
              <div style={{ padding: 10, background: 'rgba(139,92,246,0.08)', border: '1px solid rgba(139,92,246,0.2)', borderRadius: 12 }}>
                <div style={{ color: '#8B5CF6', fontWeight: 700 }}>🚆 Metro Station</div>
                <div style={{ color: '#F8FAFC', fontWeight: 600 }}>MG Road Metro Transit (680m)</div>
              </div>
              <div style={{ padding: 10, background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)', borderRadius: 12 }}>
                <div style={{ color: '#F59E0B', fontWeight: 700 }}>🚒 Fire Station</div>
                <div style={{ color: '#F8FAFC', fontWeight: 600 }}>Central Fire Station #04 (1.1 km)</div>
              </div>
              <div style={{ padding: 10, background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.2)', borderRadius: 12 }}>
                <div style={{ color: '#10B981', fontWeight: 700 }}>👮 Police Post</div>
                <div style={{ color: '#F8FAFC', fontWeight: 600 }}>Sector 2 Police Station (600m)</div>
              </div>
              <div style={{ padding: 10, background: 'rgba(0,212,255,0.08)', border: '1px solid rgba(0,212,255,0.2)', borderRadius: 12 }}>
                <div style={{ color: '#00D4FF', fontWeight: 700 }}>💧 Water Plant</div>
                <div style={{ color: '#F8FAFC', fontWeight: 600 }}>Kaveri Pumping Station (850m)</div>
              </div>
            </div>
          </div>

          {/* ═══════════════════════════════════════════
              AI PREDICTION ENGINE (SCENARIO SIMULATION)
          ═══════════════════════════════════════════ */}
          <div style={{
            background: 'rgba(17, 24, 39, 0.75)',
            backdropFilter: 'blur(24px)',
            border: '1px solid rgba(0,212,255,0.2)',
            borderRadius: 24,
            padding: 20,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
              <Brain size={18} color="#00D4FF" />
              <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: 15, fontWeight: 700, color: '#F8FAFC', margin: 0 }}>
                AI Prediction Simulation Engine
              </h3>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              {/* Without Action */}
              <div style={{ padding: 14, background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 16 }}>
                <div style={{ color: '#EF4444', fontWeight: 800, fontSize: 12, marginBottom: 8, textTransform: 'uppercase' }}>
                  ⚠️ Scenario A: Without Action (48 Hours)
                </div>
                <div style={{ fontSize: 11, color: '#94A3B8', display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <div>• <strong>Damage Spread:</strong> +350% Structural Deterioration</div>
                  <div>• <strong>Complaints:</strong> +18 Duplicate Reports</div>
                  <div>• <strong>Budget Loss:</strong> ₹4,500,000 Failure Loss</div>
                  <div>• <strong>Risk Level:</strong> Escalated to Level L1 Emergency</div>
                </div>
              </div>

              {/* With Immediate Repair */}
              <div style={{ padding: 14, background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.3)', borderRadius: 16 }}>
                <div style={{ color: '#10B981', fontWeight: 800, fontSize: 12, marginBottom: 8, textTransform: 'uppercase' }}>
                  ✅ Scenario B: With Immediate Repair
                </div>
                <div style={{ fontSize: 11, color: '#94A3B8', display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <div>• <strong>Damage Spread:</strong> Stabilized (0% Expansion)</div>
                  <div>• <strong>Complaints:</strong> 0 New Complaints</div>
                  <div>• <strong>Budget Savings:</strong> ₹{incident.savedEarlyIntervention.toLocaleString()} Saved</div>
                  <div>• <strong>Risk Level:</strong> Risk Mitigated to Safe Operating Zone</div>
                </div>
              </div>
            </div>
          </div>

          {/* ═══════════════════════════════════════════
              ROLE-BASED WORKFLOW ACTION ENGINE
          ═══════════════════════════════════════════ */}
          <div style={{
            background: 'linear-gradient(135deg, rgba(0,212,255,0.08), rgba(139,92,246,0.08))',
            border: '1px solid rgba(0,212,255,0.3)',
            borderRadius: 24,
            padding: 20,
          }}>
            {/* Role Selector Header Bar */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14, flexWrap: 'wrap', gap: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#00D4FF', fontSize: 15, fontWeight: 700 }}>
                <Users size={18} />
                Role-Based Workflow Operations
              </div>

              {/* Role Switcher Pills */}
              <div style={{ display: 'flex', gap: 4, background: 'rgba(0,0,0,0.4)', padding: 4, borderRadius: 12 }}>
                {(['citizen', 'engineer', 'commissioner', 'admin'] as const).map((r) => (
                  <button
                    key={r}
                    onClick={() => setActiveRole(r)}
                    style={{
                      padding: '4px 10px',
                      borderRadius: 8,
                      background: activeRole === r ? '#00D4FF' : 'transparent',
                      color: activeRole === r ? '#000' : '#94A3B8',
                      border: 'none',
                      fontSize: 11,
                      fontWeight: 700,
                      textTransform: 'capitalize',
                      cursor: 'pointer',
                    }}
                  >
                    {r}
                  </button>
                ))}
              </div>
            </div>

            {/* Current Stage Indicator */}
            <div style={{ padding: '8px 12px', background: 'rgba(255,255,255,0.03)', borderRadius: 10, marginBottom: 14, display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12 }}>
              <span style={{ color: '#94A3B8' }}>Active Stage:</span>
              <span style={{ color: STATUS_COLORS[incident.status] || '#00D4FF', fontWeight: 800, textTransform: 'uppercase', fontFamily: 'var(--font-mono)' }}>
                {incident.status.replace(/_/g, ' ')}
              </span>
            </div>

            {/* Role Action Panels */}
            {activeRole === 'citizen' && (
              <div style={{ fontSize: 12, color: '#94A3B8' }}>
                <div style={{ marginBottom: 10, color: '#F8FAFC' }}>
                  📱 <strong>Citizen Tracking Portal:</strong> Your reported incident is currently in stage <strong style={{ color: '#00D4FF' }}>{incident.status.replace(/_/g, ' ').toUpperCase()}</strong>.
                </div>
                <button
                  onClick={() => showToast('Subscribed to SMS & Push notifications for this incident!')}
                  style={{
                    padding: '8px 14px', borderRadius: 8, background: 'rgba(16,185,129,0.15)', border: '1px solid #10B981', color: '#10B981', fontWeight: 700, cursor: 'pointer', fontSize: 11,
                  }}
                >
                  🔔 Enable Live Status Notifications
                </button>
              </div>
            )}

            {activeRole === 'engineer' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div style={{ fontSize: 11, color: '#94A3B8' }}>👨‍🔧 <strong>Field Engineer Actions:</strong></div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  <button
                    onClick={() => transitionStageMutation.mutate({ targetStage: 'en_route', actor: 'Eng. Rajesh V (Lead Engineer)', notes: 'Crew en route to site' })}
                    style={{ padding: '10px', borderRadius: 10, background: 'rgba(56,189,248,0.2)', border: '1px solid #38BDF8', color: '#38BDF8', fontWeight: 700, fontSize: 11, cursor: 'pointer' }}
                  >
                    🚚 Go En Route
                  </button>
                  <button
                    onClick={() => transitionStageMutation.mutate({ targetStage: 'repair_started', actor: 'Eng. Rajesh V (Lead Engineer)', notes: 'Asphalt cold patch & structural work started' })}
                    style={{ padding: '10px', borderRadius: 10, background: 'rgba(234,179,8,0.2)', border: '1px solid #EAB308', color: '#EAB308', fontWeight: 700, fontSize: 11, cursor: 'pointer' }}
                  >
                    🔧 Start Repair Work
                  </button>
                </div>
                <button
                  onClick={() => transitionStageMutation.mutate({ targetStage: 'quality_inspection', actor: 'Eng. Rajesh V (Lead Engineer)', notes: 'Repair complete. Submitted for QA Inspection', resolvedPhotoUrl: completionPhotoUrl || incident.photoUrl })}
                  style={{ width: '100%', padding: '10px', borderRadius: 10, background: 'linear-gradient(135deg, #10B981, #059669)', color: '#fff', border: 'none', fontWeight: 800, fontSize: 12, cursor: 'pointer' }}
                >
                  🔬 Complete Repair & Submit Quality Inspection
                </button>
              </div>
            )}

            {activeRole === 'commissioner' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div style={{ fontSize: 11, color: '#94A3B8' }}>🏛️ <strong>Commissioner Executive Controls:</strong></div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  <button
                    onClick={() => transitionStageMutation.mutate({ targetStage: 'crew_assigned', actor: 'Dr. Anita Roy (City Commissioner)', notes: 'Approved emergency deployment for Rapid Crew Alpha-3' })}
                    style={{ padding: '10px', borderRadius: 10, background: 'linear-gradient(135deg, #00D4FF, #0EA5E9)', color: '#000', border: 'none', fontWeight: 800, fontSize: 11, cursor: 'pointer' }}
                  >
                    🚒 Approve & Dispatch Crew
                  </button>
                  <button
                    onClick={() => transitionStageMutation.mutate({ targetStage: 'commissioner_review', actor: 'Dr. Anita Roy (City Commissioner)', notes: 'Escalated to Executive War Room' })}
                    style={{ padding: '10px', borderRadius: 10, background: 'rgba(249,115,22,0.2)', border: '1px solid #F97316', color: '#F97316', fontWeight: 700, fontSize: 11, cursor: 'pointer' }}
                  >
                    🚨 Escalate Priority
                  </button>
                </div>
                <button
                  onClick={() => transitionStageMutation.mutate({ targetStage: 'citizen_notified', actor: 'Dr. Anita Roy (City Commissioner)', notes: 'Verified resolution & closed incident dossier' })}
                  style={{ width: '100%', padding: '10px', borderRadius: 10, background: 'rgba(16,185,129,0.2)', border: '1px solid #10B981', color: '#10B981', fontWeight: 800, fontSize: 12, cursor: 'pointer' }}
                >
                  ✅ Close Incident & Notify Citizen
                </button>
              </div>
            )}

            {activeRole === 'admin' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div style={{ fontSize: 11, color: '#94A3B8' }}>⚡ <strong>System Admin Override:</strong></div>
                <div style={{ display: 'flex', gap: 6 }}>
                  <select
                    id="adminStageSelect"
                    style={{ flex: 1, background: 'rgba(0,0,0,0.6)', color: '#fff', border: '1px solid rgba(0,212,255,0.3)', borderRadius: 8, padding: '6px 10px', fontSize: 11 }}
                  >
                    {LIFECYCLE_STAGES_CONFIG.map(s => (
                      <option key={s.id} value={s.id}>{s.label}</option>
                    ))}
                  </select>
                  <button
                    onClick={() => {
                      const sel = (document.getElementById('adminStageSelect') as HTMLSelectElement).value;
                      transitionStageMutation.mutate({ targetStage: sel, actor: 'System Administrator (Root)', notes: 'Manual admin stage override' });
                    }}
                    style={{ padding: '6px 14px', borderRadius: 8, background: '#00D4FF', color: '#000', border: 'none', fontWeight: 800, fontSize: 11, cursor: 'pointer' }}
                  >
                    Advance Stage
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* 2. Explainable AI (XAI) Section with Priority & Confidence Rings + 6 Animated Reason Cards */}
          <div style={{
            background: 'rgba(17, 24, 39, 0.75)',
            backdropFilter: 'blur(24px)',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: 24,
            padding: 24,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20 }}>
              <Brain size={20} color="#00D4FF" />
              <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: 16, fontWeight: 700, color: '#F8FAFC', margin: 0 }}>
                Explainable AI (XAI) Diagnostic Engine
              </h3>
            </div>

            {/* Priority Ring & AI Confidence Ring Gauges */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 24, padding: 16, background: 'rgba(0,212,255,0.03)', borderRadius: 16, border: '1px solid rgba(0,212,255,0.1)' }}>
              
              {/* Priority Ring */}
              <div style={{ textAlign: 'center' }}>
                <div style={{ position: 'relative', width: 80, height: 80, margin: '0 auto' }}>
                  <svg width={80} height={80} viewBox="0 0 80 80" style={{ transform: 'rotate(-90deg)' }}>
                    <circle cx={40} cy={40} r={32} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={5} />
                    <motion.circle
                      cx={40} cy={40} r={32} fill="none"
                      stroke="#00D4FF" strokeWidth={5} strokeLinecap="round"
                      strokeDasharray={2 * Math.PI * 32}
                      initial={{ strokeDashoffset: 2 * Math.PI * 32 }}
                      animate={{ strokeDashoffset: 2 * Math.PI * 32 * (1 - incident.priorityScore / 100) }}
                      transition={{ duration: 1, ease: 'easeOut' }}
                    />
                  </svg>
                  <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', fontFamily: 'var(--font-mono)', fontSize: 16, fontWeight: 800, color: '#00D4FF' }}>
                    {incident.priorityScore}
                  </div>
                </div>
                <div style={{ fontSize: 11, fontWeight: 600, color: '#94A3B8', marginTop: 6 }}>Priority Ring</div>
              </div>

              {/* Confidence Ring */}
              <div style={{ textAlign: 'center' }}>
                <div style={{ position: 'relative', width: 80, height: 80, margin: '0 auto' }}>
                  <svg width={80} height={80} viewBox="0 0 80 80" style={{ transform: 'rotate(-90deg)' }}>
                    <circle cx={40} cy={40} r={32} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={5} />
                    <motion.circle
                      cx={40} cy={40} r={32} fill="none"
                      stroke="#10B981" strokeWidth={5} strokeLinecap="round"
                      strokeDasharray={2 * Math.PI * 32}
                      initial={{ strokeDashoffset: 2 * Math.PI * 32 }}
                      animate={{ strokeDashoffset: 2 * Math.PI * 32 * (1 - incident.xai.cvConfidence / 100) }}
                      transition={{ duration: 1, ease: 'easeOut', delay: 0.2 }}
                    />
                  </svg>
                  <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', fontFamily: 'var(--font-mono)', fontSize: 16, fontWeight: 800, color: '#10B981' }}>
                    {incident.xai.cvConfidence}%
                  </div>
                </div>
                <div style={{ fontSize: 11, fontWeight: 600, color: '#94A3B8', marginTop: 6 }}>AI Confidence Ring</div>
              </div>
            </div>

            {/* 6 Animated Reason Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              {[
                { title: 'Hospital Nearby', detail: `${incident.xai.hospitalProximityMeters}m to ${incident.xai.hospitalName}`, pts: '+22 pts', color: '#EF4444' },
                { title: 'Heavy Traffic', detail: `${incident.xai.estimatedDailyTraffic.toLocaleString()} vehicles/day`, pts: '+18 pts', color: '#F59E0B' },
                { title: 'Historical Incidents', detail: `${incident.xai.historicalFailureRate}% failure recurrence rate`, pts: '+15 pts', color: '#8B5CF6' },
                { title: 'Rain Forecast', detail: incident.xai.weatherRiskFactor, pts: '+14 pts', color: '#3B82F6' },
                { title: 'Road Condition', detail: incident.xai.roadClassification, pts: '+12 pts', color: '#00D4FF' },
                { title: 'Nearby Complaints', detail: `${incident.xai.duplicateComplaintsCount} duplicate reports in 500m`, pts: '+15 pts', color: '#10B981' },
              ].map((reason, rIdx) => (
                <motion.div
                  key={reason.title}
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 * rIdx, duration: 0.35 }}
                  style={{
                    padding: 12,
                    background: 'rgba(255,255,255,0.03)',
                    border: '1px solid rgba(255,255,255,0.06)',
                    borderRadius: 14,
                    borderLeft: `3px solid ${reason.color}`,
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
                    <span style={{ fontSize: 12, fontWeight: 700, color: '#F8FAFC' }}>{reason.title}</span>
                    <span style={{ fontSize: 10, fontWeight: 700, color: reason.color, fontFamily: 'var(--font-mono)' }}>{reason.pts}</span>
                  </div>
                  <div style={{ fontSize: 11, color: '#94A3B8' }}>{reason.detail}</div>
                </motion.div>
              ))}
            </div>
          </div>

          {/* 3. 6-Stage Incident Progress Timeline */}
          <div style={{
            background: 'rgba(17, 24, 39, 0.75)',
            backdropFilter: 'blur(24px)',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: 24,
            padding: 24,
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: 16, fontWeight: 700, color: '#F8FAFC', margin: 0 }}>
                11-Stage Live Lifecycle Timeline
              </h3>
              <span style={{ color: STATUS_COLORS[incident.status] || '#00D4FF', fontWeight: 800, fontSize: 12, fontFamily: 'var(--font-mono)' }}>
                Stage {LIFECYCLE_STAGES_CONFIG.findIndex(s => s.id === incident.status) + 1} of 11
              </span>
            </div>

            {/* 11-Stage Animated Timeline Track */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(11, 1fr)', gap: 4, textAlign: 'center', marginBottom: 20 }}>
              {LIFECYCLE_STAGES_CONFIG.map((st, sIdx) => {
                const activeIdx = LIFECYCLE_STAGES_CONFIG.findIndex(s => s.id === incident.status);
                const isDone = sIdx < activeIdx;
                const isActive = sIdx === activeIdx;

                return (
                  <div key={st.id} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                    <div style={{
                      width: 24,
                      height: 24,
                      borderRadius: '50%',
                      margin: '0 auto 4px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      background: isDone ? 'rgba(16,185,129,0.2)' : isActive ? 'rgba(0,212,255,0.25)' : 'rgba(255,255,255,0.04)',
                      border: isDone ? '1px solid #10B981' : isActive ? '1px solid #00D4FF' : '1px solid rgba(255,255,255,0.1)',
                      color: isDone ? '#10B981' : isActive ? '#00D4FF' : '#475569',
                      fontSize: 10,
                      boxShadow: isActive ? '0 0 12px rgba(0,212,255,0.5)' : 'none',
                    }}>
                      {isDone ? '✓' : st.icon}
                    </div>
                    <div style={{ fontSize: 9, fontWeight: isDone ? 700 : isActive ? 800 : 500, color: isDone ? '#10B981' : isActive ? '#00D4FF' : '#475569', lineHeight: 1.1 }}>
                      {st.label.split('. ')[1]}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Timeline Detailed Milestones Stream */}
            <div style={{ background: 'rgba(0,0,0,0.3)', borderRadius: 16, padding: 14, border: '1px solid rgba(255,255,255,0.06)', maxHeight: 200, overflowY: 'auto', marginBottom: 20 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#94A3B8', marginBottom: 8, textTransform: 'uppercase' }}>Timeline Stage History</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 11 }}>
                {(timelineItems.length > 0 ? timelineItems : LIFECYCLE_STAGES_CONFIG.map(s => ({
                  stage: s.id,
                  label: s.label,
                  status: s.id === incident.status ? 'current' : 'pending',
                  timestamp: incident.reportedDate,
                  assignedUser: s.dept,
                  department: s.dept,
                  notes: s.label,
                  durationSeconds: 0
                }))).map((t, idx) => (
                  <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 10px', background: t.status === 'current' ? 'rgba(0,212,255,0.08)' : 'transparent', borderRadius: 8, borderLeft: `3px solid ${t.status === 'completed' ? '#10B981' : t.status === 'current' ? '#00D4FF' : 'transparent'}` }}>
                    <div>
                      <span style={{ color: t.status === 'completed' ? '#10B981' : t.status === 'current' ? '#00D4FF' : '#64748B', fontWeight: 700 }}>
                        {t.label}
                      </span>
                      <span style={{ color: '#94A3B8', marginLeft: 8 }}>· {t.department} ({t.assignedUser})</span>
                    </div>
                    <div style={{ fontSize: 10, color: '#64748B', fontFamily: 'var(--font-mono)' }}>
                      {t.timestamp ? new Date(t.timestamp).toLocaleTimeString() : 'Pending'}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Audit Log Table */}
            <div>
              <div style={{ fontSize: 11, fontWeight: 800, color: '#00D4FF', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em', display: 'flex', alignItems: 'center', gap: 6 }}>
                📋 Live Security Audit Log
              </div>
              <div style={{ background: 'rgba(0,0,0,0.4)', borderRadius: 12, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.06)' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11, textAlign: 'left' }}>
                  <thead>
                    <tr style={{ background: 'rgba(255,255,255,0.03)', color: '#64748B', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                      <th style={{ padding: '8px 12px' }}>WHO</th>
                      <th style={{ padding: '8px 12px' }}>WHAT</th>
                      <th style={{ padding: '8px 12px' }}>WHEN</th>
                      <th style={{ padding: '8px 12px' }}>RESULT</th>
                    </tr>
                  </thead>
                  <tbody>
                    {auditLogs.length > 0 ? auditLogs.map((log) => (
                      <tr key={log.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)', color: '#94A3B8' }}>
                        <td style={{ padding: '8px 12px', color: '#F8FAFC', fontWeight: 600 }}>{log.who}</td>
                        <td style={{ padding: '8px 12px', color: '#00D4FF' }}>{log.what}</td>
                        <td style={{ padding: '8px 12px', fontFamily: 'var(--font-mono)', fontSize: 10 }}>{new Date(log.when).toLocaleTimeString()}</td>
                        <td style={{ padding: '8px 12px', color: '#10B981', fontWeight: 600 }}>{log.result}</td>
                      </tr>
                    )) : (
                      <tr>
                        <td colSpan={4} style={{ padding: '12px', color: '#64748B', textAlign: 'center' }}>No audit logs recorded for this incident yet.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* 4. Officer Information Card */}
          <div style={{
            background: 'rgba(17, 24, 39, 0.75)',
            backdropFilter: 'blur(24px)',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: 24,
            padding: 24,
          }}>
            <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: 16, fontWeight: 700, color: '#F8FAFC', margin: '0 0 16px 0', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Assigned Field Officer & Crew Telemetry
            </h3>

            <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 16 }}>
              <img
                src="https://images.unsplash.com/photo-1560250097-0b93528c311a?auto=format&fit=crop&w=120&q=80"
                alt="Officer"
                style={{ width: 56, height: 56, borderRadius: '50%', border: '2px solid rgba(0,212,255,0.4)' }}
              />
              <div>
                <div style={{ fontSize: 16, fontWeight: 700, color: '#F8FAFC' }}>Insp. Suresh Nair</div>
                <div style={{ fontSize: 12, color: '#00D4FF', fontWeight: 600 }}>{DEPARTMENTS_MAP[incident.type] || 'Road Works Division'}</div>
                <div style={{ fontSize: 11, color: '#94A3B8', marginTop: 2 }}>Chief Operations Officer · Badge #FW-8492</div>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, fontSize: 12, padding: 12, background: 'rgba(255,255,255,0.03)', borderRadius: 14 }}>
              <div>
                <div style={{ color: '#64748B', fontSize: 10 }}>Phone Direct</div>
                <div style={{ color: '#F8FAFC', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}>
                  <Phone size={11} color="#00D4FF" />
                  +91 98765-43210
                </div>
              </div>
              <div>
                <div style={{ color: '#64748B', fontSize: 10 }}>Crew Size</div>
                <div style={{ color: '#F8FAFC', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}>
                  <Users size={11} color="#10B981" />
                  6 Technicians
                </div>
              </div>
              <div>
                <div style={{ color: '#64748B', fontSize: 10 }}>Vehicle & ETA</div>
                <div style={{ color: '#F8FAFC', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}>
                  <Truck size={11} color="#F59E0B" />
                  Truck #08 (18m)
                </div>
              </div>
            </div>
          </div>

          {/* 5. AI Executive Summary Card (Palantir Gotham Style) */}
          <div style={{
            background: 'rgba(0, 212, 255, 0.04)',
            border: '1px solid rgba(0, 212, 255, 0.2)',
            borderRadius: 24,
            padding: 24,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
              <Sparkles size={18} color="#00D4FF" />
              <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: 16, fontWeight: 700, color: '#00D4FF', margin: 0 }}>
                AI Executive Intelligence Briefing
              </h3>
            </div>
            <p style={{ fontFamily: 'var(--font-body)', fontSize: 13, color: '#F8FAFC', lineHeight: 1.6, margin: 0 }}>
              High-severity structural defect detected on primary hospital corridor. AI priority rating of <strong style={{ color: '#00D4FF' }}>{incident.priorityScore}/100</strong> triggered rapid automated dispatch for Crew Alpha-3 under Insp. Suresh Nair. Expected resolution within 18 hours, saving an estimated <strong style={{ color: '#10B981' }}>${incident.savedEarlyIntervention.toLocaleString()}</strong> in early intervention losses.
            </p>
          </div>

        </div>

      </div>

      {/* ── Floating AI Copilot Button (Bottom-Right Corner) ── */}
      <motion.button
        whileHover={{ scale: 1.08 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => setIsCopilotOpen(!isCopilotOpen)}
        style={{
          position: 'fixed',
          bottom: 28,
          right: 28,
          zIndex: 9999,
          padding: '14px 22px',
          borderRadius: 999,
          background: 'linear-gradient(135deg, #00D4FF, #8B5CF6)',
          color: '#fff',
          border: 'none',
          fontWeight: 700,
          fontSize: 14,
          fontFamily: 'var(--font-body)',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          boxShadow: '0 8px 32px rgba(0, 212, 255, 0.4)',
        }}
      >
        <Bot size={20} />
        CivicSense AI Copilot
      </motion.button>

      {/* ── AI Copilot Chat Drawer ── */}
      <AnimatePresence>
        {isCopilotOpen && (
          <motion.div
            initial={{ opacity: 0, y: 30, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 30, scale: 0.95 }}
            style={{
              position: 'fixed',
              bottom: 90,
              right: 28,
              width: 380,
              height: 480,
              zIndex: 9999,
              background: 'rgba(17, 24, 39, 0.96)',
              backdropFilter: 'blur(30px)',
              border: '1px solid rgba(0, 212, 255, 0.3)',
              borderRadius: 24,
              padding: 20,
              display: 'flex',
              flexDirection: 'column',
              boxShadow: '0 20px 50px rgba(0, 0, 0, 0.6)',
            }}
          >
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, paddingBottom: 10, borderBottom: '1px solid rgba(0, 212, 255, 0.2)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Bot size={18} color="#00D4FF" />
                <div>
                  <span style={{ fontFamily: 'var(--font-heading)', fontSize: 13, fontWeight: 800, color: '#F8FAFC', display: 'flex', alignItems: 'center', gap: 6 }}>
                    Incident Operations Copilot
                    <span style={{ fontSize: 9, padding: '2px 6px', borderRadius: 4, background: 'rgba(0, 212, 255, 0.2)', border: '1px solid #00D4FF', color: '#00D4FF', fontFamily: "'IBM Plex Mono', monospace" }}>
                      CYAN CONTEXT
                    </span>
                  </span>
                  <div style={{ fontSize: 9, color: '#94A3B8' }}>{incident.title}</div>
                </div>
              </div>
              <button onClick={() => setIsCopilotOpen(false)} style={{ background: 'none', border: 'none', color: '#94A3B8', cursor: 'pointer' }}>
                <X size={18} />
              </button>
            </div>

            {/* Messages Stream */}
            <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 10, paddingRight: 4 }}>
              {copilotMessages.map((msg, i) => (
                <div key={i} style={{
                  alignSelf: msg.sender === 'user' ? 'flex-end' : 'flex-start',
                  maxWidth: '88%',
                  padding: '10px 14px',
                  borderRadius: 14,
                  background: msg.sender === 'user' ? 'rgba(0, 212, 255, 0.2)' : 'rgba(255,255,255,0.04)',
                  border: msg.sender === 'user' ? '1px solid #00D4FF' : '1px solid rgba(255,255,255,0.06)',
                  color: '#F8FAFC',
                  fontSize: 12,
                  lineHeight: 1.4,
                }}>
                  {msg.text}
                </div>
              ))}
            </div>

            {/* Incident Prompt Shortcuts */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 10 }}>
              {[
                'Why is this incident critical?',
                'Assign nearest crew',
                'Explain AI vision reasoning',
                'Estimate repair budget',
              ].map((chip, idx) => (
                <button
                  key={idx}
                  onClick={() => {
                    setCopilotMessages((prev) => [
                      ...prev,
                      { sender: 'user', text: chip },
                      {
                        sender: 'ai',
                        text: chip.includes('critical')
                          ? `Priority score is ${incident.priorityScore}/100 due to 340m proximity to Victoria Hospital and high daily traffic volume.`
                          : chip.includes('crew')
                          ? `Crew Alpha-3 assigned under Insp. Suresh Nair. Vehicle ENG-3092 ETA 4.2 mins.`
                          : chip.includes('vision')
                          ? `CV Model Vision Confidence: ${incident.xai?.cvConfidence || 96.4}% using ResNet-v4 classifier.`
                          : `Estimated repair budget: ₹${(incident.estimatedRepairCost || 85000).toLocaleString()} with estimated completion in 3.5 hrs.`,
                      },
                    ]);
                  }}
                  style={{
                    background: 'rgba(0, 212, 255, 0.1)',
                    border: '1px solid rgba(0, 212, 255, 0.25)',
                    color: '#00D4FF',
                    padding: '3px 8px',
                    borderRadius: 6,
                    fontSize: 10,
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  ⚡ {chip}
                </button>
              ))}
            </div>

            {/* Input & Send */}
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                type="text"
                placeholder="Ask Incident Copilot about this issue..."
                value={copilotInput}
                onChange={(e) => setCopilotInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && copilotInput.trim()) {
                    setCopilotMessages((prev) => [
                      ...prev,
                      { sender: 'user', text: copilotInput },
                      { sender: 'ai', text: `Analyzing ${incident.title}: ${copilotInput}. Incident resolution SLA on track.` }
                    ]);
                    setCopilotInput('');
                  }
                }}
                style={{
                  flex: 1,
                  padding: '10px 14px',
                  background: 'rgba(255,255,255,0.04)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: 10,
                  color: '#F8FAFC',
                  fontSize: 12,
                  outline: 'none',
                }}
              />
              <button
                onClick={() => {
                  if (copilotInput.trim()) {
                    setCopilotMessages((prev) => [
                      ...prev,
                      { sender: 'user', text: copilotInput },
                      { sender: 'ai', text: `Analyzing ${incident.title}: ${copilotInput}. Incident resolution SLA on track.` }
                    ]);
                    setCopilotInput('');
                  }
                }}
                style={{
                  padding: '10px 14px',
                  background: 'linear-gradient(135deg, #00D4FF, #0EA5E9)',
                  color: '#000',
                  border: 'none',
                  borderRadius: 10,
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                <Send size={14} />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Image Lightbox Modal ── */}
      <AnimatePresence>
        {isLightboxOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 9999,
              background: 'rgba(0,0,0,0.92)',
              backdropFilter: 'blur(24px)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 20,
            }}
            onClick={() => setIsLightboxOpen(false)}
          >
            <div style={{ position: 'relative', maxWidth: '90vw', maxHeight: '90vh' }}>
              <img
                src={viewTab === 'current' ? incident.photoUrl : repairedPhotoUrl}
                alt="Enlarged view"
                style={{ maxWidth: '100%', maxHeight: '85vh', borderRadius: 16, border: '1px solid rgba(255,255,255,0.2)' }}
              />
              <button
                onClick={() => setIsLightboxOpen(false)}
                style={{
                  position: 'absolute',
                  top: -16,
                  right: -16,
                  width: 36,
                  height: 36,
                  borderRadius: '50%',
                  background: '#EF4444',
                  border: 'none',
                  color: '#fff',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <X size={20} />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── AI Digital Twin Time Machine Simulation Modal ── */}
      <AISimulationTimelineModal
        isOpen={isSimulationOpen}
        onClose={() => setIsSimulationOpen(false)}
        incident={incident}
        onDeployCrew={() => handleDispatch()}
      />

    </div>
  );
};
