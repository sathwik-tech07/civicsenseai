import React, { useState, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Wrench,
  CheckCircle2,
  AlertTriangle,
  Clock,
  MapPin,
  Navigation,
  Camera,
  Layers,
  ShieldCheck,
  RefreshCw,
  X,
  Play,
  FileText,
  Search,
  Check,
  Compass,
  AlertCircle,
  ExternalLink,
  ChevronRight,
  Sparkles,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useIncidents } from '../context/IncidentContext';
import {
  apiTransitionWorkflowStage,
  apiUploadIncidentImage,
} from '../services/apiClient';
import type { Incident, IncidentSeverity } from '../types';

interface FieldEngineerPortalProps {
  incidents: Incident[];
  onSelectIncident: (incident: Incident) => void;
  onOpenGIS?: (incident?: Incident) => void;
}

// SLA Windows based on severity
const SLA_HOURS: Record<IncidentSeverity, number> = {
  critical: 4,
  high: 12,
  medium: 24,
  low: 48,
};

const SEVERITY_COLORS: Record<IncidentSeverity, { bg: string; border: string; text: string; glow: string }> = {
  critical: { bg: 'rgba(239, 68, 68, 0.15)', border: 'rgba(239, 68, 68, 0.4)', text: '#EF4444', glow: '0 0 15px rgba(239, 68, 68, 0.3)' },
  high:     { bg: 'rgba(245, 158, 11, 0.15)', border: 'rgba(245, 158, 11, 0.4)', text: '#F59E0B', glow: '0 0 15px rgba(245, 158, 11, 0.3)' },
  medium:   { bg: 'rgba(59, 130, 246, 0.15)', border: 'rgba(59, 130, 246, 0.4)', text: '#3B82F6', glow: '0 0 15px rgba(59, 130, 246, 0.3)' },
  low:      { bg: 'rgba(16, 185, 129, 0.15)', border: 'rgba(16, 185, 129, 0.4)', text: '#10B981', glow: '0 0 15px rgba(16, 185, 129, 0.3)' },
};

const STATUS_LABELS: Record<string, { label: string; color: string; icon: any }> = {
  reported:           { label: 'Pending Acceptance', color: '#F59E0B', icon: Clock },
  ai_analysis:        { label: 'AI Scored', color: '#8B5CF6', icon: Sparkles },
  verified:           { label: 'Verified', color: '#00D4FF', icon: CheckCircle2 },
  priority_assigned:  { label: 'Priority Assigned', color: '#F59E0B', icon: AlertTriangle },
  commissioner_review:{ label: 'In Review', color: '#8B5CF6', icon: FileText },
  crew_assigned:      { label: 'Accepted & Assigned', color: '#00D4FF', icon: Check },
  en_route:           { label: 'Crew En Route', color: '#38BDF8', icon: Compass },
  repair_started:     { label: 'Work In Progress', color: '#F59E0B', icon: Wrench },
  in_progress:        { label: 'Work In Progress', color: '#F59E0B', icon: Wrench },
  quality_inspection: { label: 'QA Inspection', color: '#A855F7', icon: ShieldCheck },
  resolved:           { label: 'Resolved', color: '#10B981', icon: CheckCircle2 },
  citizen_notified:   { label: 'Closed & Notified', color: '#10B981', icon: CheckCircle2 },
};

export const FieldEngineerPortal: React.FC<FieldEngineerPortalProps> = ({
  incidents,
  onSelectIncident,
  onOpenGIS,
}) => {
  const { user } = useAuth();
  const { refetchIncidents } = useIncidents();

  // Filter & Search State
  const [activeFilterTab, setActiveFilterTab] = useState<'all' | 'pending' | 'active' | 'completed'>('all');
  const [severityFilter, setSeverityFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Modals / Interactive state
  const [actionIncident, setActionIncident] = useState<Incident | null>(null);
  const [actionType, setActionType] = useState<'reject' | 'progress' | 'resolve' | 'evidence' | null>(null);
  const [actionNotes, setActionNotes] = useState('');
  const [actionPhotoUrl, setActionPhotoUrl] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [isSubmittingAction, setIsSubmittingAction] = useState(false);
  const [feedbackMessage, setFeedbackMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Authenticated engineer actor identity
  const engineerActor = user ? `${user.fullName} (Field Engineer)` : 'Field Engineer';

  // Calculate SLA status
  const calculateSLA = (reportedDateStr: string, severity: IncidentSeverity) => {
    try {
      const repDate = new Date(reportedDateStr);
      if (isNaN(repDate.getTime())) {
        return { isBreached: false, timeString: 'Within SLA' };
      }
      const allowedHours = SLA_HOURS[severity] || 24;
      const deadline = new Date(repDate.getTime() + allowedHours * 3600 * 1000);
      const now = new Date();
      const diffMs = deadline.getTime() - now.getTime();

      if (diffMs < 0) {
        const breachedHours = Math.abs(Math.floor(diffMs / (3600 * 1000)));
        const breachedMins = Math.abs(Math.floor((diffMs % (3600 * 1000)) / (60 * 1000)));
        return { isBreached: true, timeString: `Breached by ${breachedHours}h ${breachedMins}m` };
      } else {
        const remainingHours = Math.floor(diffMs / (3600 * 1000));
        const remainingMins = Math.floor((diffMs % (3600 * 1000)) / (60 * 1000));
        return { isBreached: false, timeString: `${remainingHours}h ${remainingMins}m remaining` };
      }
    } catch {
      return { isBreached: false, timeString: 'Within SLA' };
    }
  };

  // Defense-in-depth assignment isolation:
  // Backend /api/v1/incidents/ already filters by assigned_engineer_id for engineers.
  // We also verify in frontend state that if an assignedEngineerId is explicitly set, it matches user.id.
  const assignedIncidents = useMemo(() => {
    return incidents.filter((inc) => {
      if (user?.id && inc.assignedEngineerId && inc.assignedEngineerId !== user.id) {
        return false;
      }
      return true;
    });
  }, [incidents, user?.id]);

  // Filtered Work Orders
  const myWorkOrders = useMemo(() => {
    return assignedIncidents.filter((inc) => {
      // 1. Tab Status Filter
      if (activeFilterTab === 'pending') {
        if (inc.status !== 'reported') return false;
      } else if (activeFilterTab === 'active') {
        if (!['crew_assigned', 'en_route', 'repair_started', 'in_progress'].includes(inc.status)) return false;
      } else if (activeFilterTab === 'completed') {
        if (!['resolved', 'quality_inspection', 'citizen_notified'].includes(inc.status)) return false;
      }

      // 2. Severity Filter
      if (severityFilter !== 'all' && inc.severity !== severityFilter) {
        return false;
      }

      // 3. Search Query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesId = inc.id.toLowerCase().includes(q);
        const matchesTitle = inc.title.toLowerCase().includes(q);
        const matchesAddr = inc.address.toLowerCase().includes(q);
        const matchesWard = inc.wardName.toLowerCase().includes(q);
        const matchesType = (inc.type || '').toLowerCase().includes(q);
        if (!matchesId && !matchesTitle && !matchesAddr && !matchesWard && !matchesType) {
          return false;
        }
      }

      return true;
    });
  }, [assignedIncidents, activeFilterTab, severityFilter, searchQuery]);

  // KPI Metrics
  const metrics = useMemo(() => {
    const total = assignedIncidents.length;
    const pending = assignedIncidents.filter(i => i.status === 'reported').length;
    const inProgress = assignedIncidents.filter(i => ['crew_assigned', 'en_route', 'repair_started', 'in_progress'].includes(i.status)).length;
    const completed = assignedIncidents.filter(i => ['resolved', 'quality_inspection', 'citizen_notified'].includes(i.status)).length;
    const criticalUnresolved = assignedIncidents.filter(i => i.severity === 'critical' && i.status !== 'resolved').length;
    return { total, pending, inProgress, completed, criticalUnresolved };
  }, [assignedIncidents]);

  // Toast feedback helper
  const showFeedback = (text: string, type: 'success' | 'error' = 'success') => {
    setFeedbackMessage({ text, type });
    setTimeout(() => setFeedbackMessage(null), 4000);
  };

  // Accept Assignment Action
  const handleAcceptAssignment = async (incident: Incident) => {
    try {
      setIsSubmittingAction(true);
      await apiTransitionWorkflowStage(
        incident.id,
        'crew_assigned',
        engineerActor,
        'Work order accepted by field engineer. Crew dispatched.'
      );
      showFeedback(`Work Order ${incident.id} Accepted. Status updated to Crew Assigned.`);
      await refetchIncidents();
    } catch (err: any) {
      showFeedback(err.message || 'Failed to accept assignment', 'error');
    } finally {
      setIsSubmittingAction(false);
    }
  };

  // Start Work Action
  const handleStartWork = async (incident: Incident) => {
    try {
      setIsSubmittingAction(true);
      await apiTransitionWorkflowStage(
        incident.id,
        'repair_started',
        engineerActor,
        'Field crew on site. Civil repair work officially commenced.'
      );
      showFeedback(`Work Order ${incident.id}: Work commenced on site.`);
      await refetchIncidents();
    } catch (err: any) {
      showFeedback(err.message || 'Failed to start repair work', 'error');
    } finally {
      setIsSubmittingAction(false);
    }
  };

  // Execute Modal Submit (Reject, Progress Note, Resolve)
  const handleModalSubmit = async () => {
    if (!actionIncident || !actionType) return;
    setIsSubmittingAction(true);

    try {
      if (actionType === 'reject') {
        const reason = actionNotes.trim() || 'Work order rejected: Requires reassignment.';
        await apiTransitionWorkflowStage(
          actionIncident.id,
          'reported',
          engineerActor,
          `Assignment Rejected: ${reason}`
        );
        showFeedback(`Assignment for ${actionIncident.id} was rejected.`);
      } else if (actionType === 'progress') {
        const note = actionNotes.trim() || 'Progress update logged by field crew.';
        await apiTransitionWorkflowStage(
          actionIncident.id,
          actionIncident.status === 'reported' ? 'crew_assigned' : actionIncident.status,
          engineerActor,
          `Progress Update: ${note}`
        );
        showFeedback(`Progress notes recorded for ${actionIncident.id}.`);
      } else if (actionType === 'resolve') {
        const notes = actionNotes.trim() || 'Repair successfully completed and verified on site.';
        await apiTransitionWorkflowStage(
          actionIncident.id,
          'resolved',
          engineerActor,
          notes,
          actionPhotoUrl || actionIncident.photoUrl
        );
        showFeedback(`Work Order ${actionIncident.id} successfully marked RESOLVED!`);
      } else if (actionType === 'evidence') {
        if (actionPhotoUrl) {
          await apiTransitionWorkflowStage(
            actionIncident.id,
            actionIncident.status,
            engineerActor,
            `Field Evidence Attached: ${actionNotes.trim() || 'Photo evidence uploaded'}`,
            actionPhotoUrl
          );
          showFeedback(`Evidence photo attached to ${actionIncident.id}.`);
        }
      }

      await refetchIncidents();
      closeModal();
    } catch (err: any) {
      showFeedback(err.message || 'Action failed', 'error');
    } finally {
      setIsSubmittingAction(false);
    }
  };

  // Image Upload Handler
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!['image/jpeg', 'image/png', 'image/jpg'].includes(file.type)) {
      showFeedback('Only JPG or PNG photos are accepted', 'error');
      return;
    }

    try {
      setIsUploading(true);
      const res = await apiUploadIncidentImage(file);
      setActionPhotoUrl(res.file_url);
      showFeedback('Evidence photo uploaded successfully!');
    } catch (err: any) {
      showFeedback(err.message || 'Failed to upload image', 'error');
    } finally {
      setIsUploading(false);
    }
  };

  const closeModal = () => {
    setActionIncident(null);
    setActionType(null);
    setActionNotes('');
    setActionPhotoUrl('');
  };

  return (
    <div style={{
      maxWidth: 1320,
      margin: '0 auto',
      padding: '24px 20px 80px',
      color: '#F8FAFC',
      fontFamily: 'var(--font-body)',
    }}>
      {/* ═══════════════════════════════════════════
          1. HEADER & ENGINEER PROFILE BANNER
      ═══════════════════════════════════════════ */}
      <div style={{
        background: 'linear-gradient(135deg, rgba(8, 27, 51, 0.75), rgba(15, 23, 42, 0.85))',
        backdropFilter: 'blur(20px)',
        border: '1px solid rgba(0, 212, 255, 0.25)',
        borderRadius: 24,
        padding: '28px 32px',
        marginBottom: 24,
        boxShadow: '0 12px 40px rgba(0, 0, 0, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.08)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: 20,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{
            width: 56,
            height: 56,
            borderRadius: 18,
            background: 'linear-gradient(135deg, #00D4FF 0%, #8B5CF6 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 0 25px rgba(0, 212, 255, 0.35)',
            color: '#000',
          }}>
            <Wrench size={28} />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
              <h1 style={{
                fontFamily: 'var(--font-heading)',
                fontSize: 24,
                fontWeight: 800,
                color: '#F8FAFC',
                margin: 0,
                letterSpacing: '-0.02em',
              }}>
                Field Engineer Work Orders
              </h1>
              <span style={{
                padding: '3px 10px',
                borderRadius: 999,
                background: 'rgba(0, 212, 255, 0.15)',
                border: '1px solid rgba(0, 212, 255, 0.3)',
                color: '#00D4FF',
                fontSize: 10,
                fontWeight: 800,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
              }}>
                OS v5.0 Live
              </span>
            </div>
            <div style={{ fontSize: 13, color: '#94A3B8', display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <span>Officer: <strong style={{ color: '#F8FAFC' }}>{user?.fullName || 'Eng. Rajesh V'}</strong></span>
              <span>·</span>
              <span style={{ color: '#00D4FF' }}>{user?.department || 'Roads & Infrastructure Engineering'}</span>
              <span>·</span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: '#10B981', fontSize: 12 }}>
                <Compass size={14} /> GPS Telemetry Synced
              </span>
            </div>
          </div>
        </div>

        {/* Quick Refresh Button */}
        <button
          onClick={() => refetchIncidents()}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '10px 18px',
            background: 'rgba(255, 255, 255, 0.05)',
            border: '1px solid rgba(0, 212, 255, 0.25)',
            borderRadius: 12,
            color: '#00D4FF',
            fontSize: 12,
            fontWeight: 700,
            cursor: 'pointer',
            transition: 'all 0.2s',
          }}
        >
          <RefreshCw size={15} />
          <span>Sync Work Orders</span>
        </button>
      </div>

      {/* ═══════════════════════════════════════════
          2. TOAST FEEDBACK NOTIFICATION
      ═══════════════════════════════════════════ */}
      <AnimatePresence>
        {feedbackMessage && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            style={{
              padding: '12px 18px',
              borderRadius: 14,
              marginBottom: 20,
              background: feedbackMessage.type === 'success' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
              border: feedbackMessage.type === 'success' ? '1px solid #10B981' : '1px solid #EF4444',
              color: feedbackMessage.type === 'success' ? '#6EE7B7' : '#FCA5A5',
              fontSize: 13,
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              boxShadow: '0 8px 24px rgba(0, 0, 0, 0.3)',
            }}
          >
            {feedbackMessage.type === 'success' ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
            <span>{feedbackMessage.text}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ═══════════════════════════════════════════
          3. CRITICAL DISPATCH ALERT BANNER (If any)
      ═══════════════════════════════════════════ */}
      {metrics.criticalUnresolved > 0 && (
        <div style={{
          padding: '16px 20px',
          borderRadius: 16,
          background: 'linear-gradient(90deg, rgba(239, 68, 68, 0.2), rgba(245, 158, 11, 0.15))',
          border: '1px solid rgba(239, 68, 68, 0.4)',
          marginBottom: 24,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 12,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{
              width: 36,
              height: 36,
              borderRadius: 10,
              background: '#EF4444',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#fff',
            }}>
              <AlertTriangle size={20} />
            </div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 800, color: '#F8FAFC' }}>
                Urgent Priority Alert: {metrics.criticalUnresolved} Critical Work Order(s) Pending Resolution
              </div>
              <div style={{ fontSize: 11, color: '#FCA5A5' }}>
                Municipal emergency protocols in effect. Rapid response SLA window is 4 hours maximum.
              </div>
            </div>
          </div>
          <button
            onClick={() => {
              setSeverityFilter('critical');
              setActiveFilterTab('all');
            }}
            style={{
              padding: '6px 14px',
              borderRadius: 8,
              background: '#EF4444',
              border: 'none',
              color: '#fff',
              fontSize: 11,
              fontWeight: 800,
              cursor: 'pointer',
            }}
          >
            View Critical Orders
          </button>
        </div>
      )}

      {/* ═══════════════════════════════════════════
          4. METRIC KPI CARDS
      ═══════════════════════════════════════════ */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: 16,
        marginBottom: 28,
      }}>
        {[
          { label: 'Assigned Work Orders', val: metrics.total, color: '#00D4FF', icon: Layers, sub: 'Assigned to your queue' },
          { label: 'Pending Acceptance', val: metrics.pending, color: '#F59E0B', icon: Clock, sub: 'Awaiting engineer review' },
          { label: 'In Progress / On Site', val: metrics.inProgress, color: '#38BDF8', icon: Wrench, sub: 'Active repair operations' },
          { label: 'Completed / QA', val: metrics.completed, color: '#10B981', icon: CheckCircle2, sub: 'Resolved & verified' },
        ].map((card, idx) => {
          const Icon = card.icon;
          return (
            <div
              key={idx}
              style={{
                background: 'rgba(17, 24, 39, 0.7)',
                backdropFilter: 'blur(16px)',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                borderRadius: 18,
                padding: '18px 20px',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                boxShadow: '0 8px 24px rgba(0, 0, 0, 0.25)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  {card.label}
                </span>
                <div style={{
                  width: 32,
                  height: 32,
                  borderRadius: 10,
                  background: `${card.color}15`,
                  border: `1px solid ${card.color}30`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: card.color,
                }}>
                  <Icon size={16} />
                </div>
              </div>
              <div style={{ fontSize: 26, fontWeight: 800, color: '#F8FAFC', marginBottom: 4 }}>
                {card.val}
              </div>
              <div style={{ fontSize: 11, color: '#64748B' }}>
                {card.sub}
              </div>
            </div>
          );
        })}
      </div>

      {/* ═══════════════════════════════════════════
          5. SEARCH & FILTER TOOLBAR
      ═══════════════════════════════════════════ */}
      <div style={{
        background: 'rgba(17, 24, 39, 0.6)',
        backdropFilter: 'blur(16px)',
        border: '1px solid rgba(255, 255, 255, 0.08)',
        borderRadius: 18,
        padding: '14px 18px',
        marginBottom: 20,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: 14,
      }}>
        {/* Status Tabs */}
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {[
            { id: 'all', label: 'All Orders' },
            { id: 'pending', label: `Pending (${metrics.pending})` },
            { id: 'active', label: `In Progress (${metrics.inProgress})` },
            { id: 'completed', label: `Resolved (${metrics.completed})` },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveFilterTab(tab.id as any)}
              style={{
                padding: '6px 14px',
                borderRadius: 10,
                background: activeFilterTab === tab.id ? 'linear-gradient(135deg, #00D4FF, #0EA5E9)' : 'rgba(255, 255, 255, 0.04)',
                border: activeFilterTab === tab.id ? 'none' : '1px solid rgba(255, 255, 255, 0.08)',
                color: activeFilterTab === tab.id ? '#000' : '#94A3B8',
                fontWeight: activeFilterTab === tab.id ? 800 : 600,
                fontSize: 12,
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Severity Selector & Search */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          {/* Severity Dropdown */}
          <select
            value={severityFilter}
            onChange={(e) => setSeverityFilter(e.target.value)}
            style={{
              padding: '7px 12px',
              borderRadius: 10,
              background: 'rgba(0, 0, 0, 0.5)',
              border: '1px solid rgba(0, 212, 255, 0.25)',
              color: '#F8FAFC',
              fontSize: 12,
              fontWeight: 600,
              outline: 'none',
              cursor: 'pointer',
            }}
          >
            <option value="all">All Severities</option>
            <option value="critical">Critical Severity</option>
            <option value="high">High Severity</option>
            <option value="medium">Medium Severity</option>
            <option value="low">Low Severity</option>
          </select>

          {/* Search Box */}
          <div style={{ position: 'relative', width: 220 }}>
            <Search size={14} color="#64748B" style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)' }} />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search work orders..."
              style={{
                width: '100%',
                padding: '7px 10px 7px 32px',
                borderRadius: 10,
                background: 'rgba(0, 0, 0, 0.4)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                color: '#F8FAFC',
                fontSize: 12,
                outline: 'none',
                boxSizing: 'border-box',
              }}
            />
          </div>
        </div>
      </div>

      {/* ═══════════════════════════════════════════
          6. WORK ORDER CARD LIST
      ═══════════════════════════════════════════ */}
      {myWorkOrders.length === 0 ? (
        <div style={{
          padding: '60px 20px',
          textAlign: 'center',
          background: 'rgba(17, 24, 39, 0.4)',
          borderRadius: 20,
          border: '1px dashed rgba(255, 255, 255, 0.1)',
        }}>
          <Wrench size={48} color="#64748B" style={{ marginBottom: 16 }} />
          <h3 style={{ fontSize: 18, color: '#F8FAFC', margin: '0 0 6px 0' }}>No Work Orders Found</h3>
          <p style={{ fontSize: 13, color: '#94A3B8', margin: 0 }}>
            {activeFilterTab !== 'all' || severityFilter !== 'all' || searchQuery
              ? 'No work orders match your current filters. Try resetting the search or filter.'
              : 'You have no assigned work orders currently. New assignments will appear here automatically.'}
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {myWorkOrders.map((inc) => {
            const sev = (inc.severity || 'medium').toLowerCase() as IncidentSeverity;
            const sevStyle = SEVERITY_COLORS[sev] || SEVERITY_COLORS.medium;
            const sla = calculateSLA(inc.reportedDate, sev);
            const statusInfo = STATUS_LABELS[inc.status] || { label: inc.status, color: '#94A3B8', icon: Clock };
            const StatusIcon = statusInfo.icon;

            const isPendingAccept = inc.status === 'reported';
            const isResolved = ['resolved', 'quality_inspection', 'citizen_notified'].includes(inc.status);

            return (
              <div
                key={inc.id}
                style={{
                  background: 'rgba(17, 24, 39, 0.8)',
                  backdropFilter: 'blur(20px)',
                  border: `1px solid ${sev === 'critical' ? 'rgba(239, 68, 68, 0.35)' : 'rgba(255, 255, 255, 0.08)'}`,
                  borderRadius: 20,
                  padding: '22px 24px',
                  boxShadow: sev === 'critical' ? sevStyle.glow : '0 10px 30px rgba(0, 0, 0, 0.25)',
                  transition: 'all 0.2s ease',
                  position: 'relative',
                  overflow: 'hidden',
                }}
              >
                {/* Critical Glow Strip */}
                {sev === 'critical' && (
                  <div style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    height: 3,
                    background: 'linear-gradient(90deg, #EF4444, #F59E0B)',
                  }} />
                )}

                {/* Top Row: ID, Badges, SLA Monitor */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10, marginBottom: 14 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                    {/* Complaint ID */}
                    <span style={{
                      padding: '4px 10px',
                      borderRadius: 8,
                      background: 'rgba(0, 0, 0, 0.6)',
                      border: '1px solid rgba(0, 212, 255, 0.3)',
                      color: '#00D4FF',
                      fontSize: 12,
                      fontWeight: 800,
                      fontFamily: 'var(--font-mono)',
                    }}>
                      {inc.id}
                    </span>

                    {/* Severity Badge */}
                    <span style={{
                      padding: '4px 10px',
                      borderRadius: 8,
                      background: sevStyle.bg,
                      border: `1px solid ${sevStyle.border}`,
                      color: sevStyle.text,
                      fontSize: 11,
                      fontWeight: 800,
                      textTransform: 'uppercase',
                      letterSpacing: '0.04em',
                    }}>
                      {inc.severity} Severity
                    </span>

                    {/* Lifecycle Status Badge */}
                    <span style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 5,
                      padding: '4px 10px',
                      borderRadius: 8,
                      background: 'rgba(255, 255, 255, 0.05)',
                      border: `1px solid ${statusInfo.color}40`,
                      color: statusInfo.color,
                      fontSize: 11,
                      fontWeight: 700,
                    }}>
                      <StatusIcon size={13} />
                      <span>{statusInfo.label}</span>
                    </span>
                  </div>

                  {/* SLA Countdown Badge */}
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    padding: '4px 12px',
                    borderRadius: 999,
                    background: sla.isBreached ? 'rgba(239, 68, 68, 0.2)' : 'rgba(0, 212, 255, 0.1)',
                    border: sla.isBreached ? '1px solid #EF4444' : '1px solid rgba(0, 212, 255, 0.25)',
                    color: sla.isBreached ? '#EF4444' : '#00D4FF',
                    fontSize: 11,
                    fontWeight: 700,
                  }}>
                    <Clock size={13} />
                    <span>SLA: {sla.timeString}</span>
                  </div>
                </div>

                {/* Main Content Grid: Details Left, Photo Right */}
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: inc.photoUrl ? '1fr 140px' : '1fr',
                  gap: 20,
                  marginBottom: 18,
                }}>
                  <div>
                    <h3
                      onClick={() => onSelectIncident(inc)}
                      style={{
                        fontFamily: 'var(--font-heading)',
                        fontSize: 17,
                        fontWeight: 700,
                        color: '#F8FAFC',
                        margin: '0 0 6px 0',
                        cursor: 'pointer',
                        transition: 'color 0.2s',
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.color = '#00D4FF')}
                      onMouseLeave={(e) => (e.currentTarget.style.color = '#F8FAFC')}
                    >
                      {inc.title}
                    </h3>

                    {/* Category & Location Details */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 12, color: '#94A3B8' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ color: '#F8FAFC', fontWeight: 600 }}>Category:</span>
                        <span style={{ textTransform: 'capitalize', color: '#38BDF8' }}>{(inc.type || 'Infrastructure Defect').replace(/_/g, ' ')}</span>
                        <span>·</span>
                        <span style={{ color: '#F8FAFC', fontWeight: 600 }}>Ward:</span>
                        <span>{inc.wardName}</span>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <MapPin size={14} color="#00D4FF" style={{ flexShrink: 0 }} />
                        <span>{inc.address}</span>
                      </div>

                      <div style={{ fontSize: 11, color: '#64748B', display: 'flex', alignItems: 'center', gap: 12 }}>
                        <span>Reported: {inc.reportedDate}</span>
                        <span>Coordinates: {inc.lat.toFixed(4)}, {inc.lng.toFixed(4)}</span>
                        {inc.assignedCrew && <span>Crew: <strong style={{ color: '#E2E8F0' }}>{inc.assignedCrew}</strong></span>}
                      </div>
                    </div>
                  </div>

                  {/* Evidence Thumbnails */}
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', justifyContent: 'flex-end' }}>
                    {inc.photoUrl && (
                      <div style={{ position: 'relative', width: 68, height: 68, borderRadius: 12, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.1)' }}>
                        <img src={inc.photoUrl} alt="Initial Defect" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        <span style={{ position: 'absolute', bottom: 2, left: 2, right: 2, background: 'rgba(0,0,0,0.7)', fontSize: 8, textAlign: 'center', borderRadius: 4, padding: '1px 0' }}>Before</span>
                      </div>
                    )}
                    {inc.resolvedPhotoUrl && (
                      <div style={{ position: 'relative', width: 68, height: 68, borderRadius: 12, overflow: 'hidden', border: '1px solid #10B981' }}>
                        <img src={inc.resolvedPhotoUrl} alt="Resolved Site" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        <span style={{ position: 'absolute', bottom: 2, left: 2, right: 2, background: 'rgba(16,185,129,0.85)', fontSize: 8, textAlign: 'center', borderRadius: 4, padding: '1px 0', color: '#000', fontWeight: 800 }}>After</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* ═══════════════════════════════════════════
                    ACTION BUTTONS TOOLBAR
                ═══════════════════════════════════════════ */}
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  flexWrap: 'wrap',
                  gap: 10,
                  paddingTop: 14,
                  borderTop: '1px solid rgba(255, 255, 255, 0.08)',
                }}>
                  {/* Left: GPS & Map Navigation */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    {/* Google Maps External Directions */}
                    <a
                      href={`https://www.google.com/maps/dir/?api=1&destination=${inc.lat},${inc.lng}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 6,
                        padding: '7px 12px',
                        borderRadius: 10,
                        background: 'rgba(0, 212, 255, 0.08)',
                        border: '1px solid rgba(0, 212, 255, 0.25)',
                        color: '#00D4FF',
                        fontSize: 11,
                        fontWeight: 700,
                        textDecoration: 'none',
                        cursor: 'pointer',
                      }}
                    >
                      <Navigation size={13} />
                      <span>GPS Navigation</span>
                      <ExternalLink size={11} />
                    </a>

                    {/* View in Field GIS Map */}
                    {onOpenGIS && (
                      <button
                        onClick={() => onOpenGIS(inc)}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 6,
                          padding: '7px 12px',
                          borderRadius: 10,
                          background: 'rgba(255, 255, 255, 0.04)',
                          border: '1px solid rgba(255, 255, 255, 0.1)',
                          color: '#E2E8F0',
                          fontSize: 11,
                          fontWeight: 700,
                          cursor: 'pointer',
                        }}
                      >
                        <Compass size={13} />
                        <span>View on GIS</span>
                      </button>
                    )}

                    {/* Incident Details Drilldown */}
                    <button
                      onClick={() => onSelectIncident(inc)}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 4,
                        padding: '7px 12px',
                        borderRadius: 10,
                        background: 'transparent',
                        border: 'none',
                        color: '#94A3B8',
                        fontSize: 11,
                        fontWeight: 600,
                        cursor: 'pointer',
                      }}
                    >
                      <span>Full Dossier</span>
                      <ChevronRight size={13} />
                    </button>
                  </div>

                  {/* Right: Operational Stage Actions */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    {/* Stage 1: Pending Acceptance */}
                    {isPendingAccept && (
                      <>
                        <button
                          disabled={isSubmittingAction}
                          onClick={() => {
                            setActionIncident(inc);
                            setActionType('reject');
                          }}
                          style={{
                            padding: '7px 14px',
                            borderRadius: 10,
                            background: 'rgba(239, 68, 68, 0.15)',
                            border: '1px solid rgba(239, 68, 68, 0.4)',
                            color: '#F87171',
                            fontSize: 11,
                            fontWeight: 700,
                            cursor: 'pointer',
                          }}
                        >
                          ✕ Reject Order
                        </button>
                        <button
                          disabled={isSubmittingAction}
                          onClick={() => handleAcceptAssignment(inc)}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 6,
                            padding: '7px 16px',
                            borderRadius: 10,
                            background: 'linear-gradient(135deg, #00D4FF, #0EA5E9)',
                            border: 'none',
                            color: '#000',
                            fontSize: 11,
                            fontWeight: 800,
                            cursor: 'pointer',
                            boxShadow: '0 0 15px rgba(0, 212, 255, 0.3)',
                          }}
                        >
                          <Check size={14} />
                          <span>Accept Assignment</span>
                        </button>
                      </>
                    )}

                    {/* Stage 2: Accepted -> Start Work */}
                    {(inc.status === 'crew_assigned' || inc.status === 'en_route') && (
                      <>
                        <button
                          disabled={isSubmittingAction}
                          onClick={() => {
                            setActionIncident(inc);
                            setActionType('progress');
                          }}
                          style={{
                            padding: '7px 12px',
                            borderRadius: 10,
                            background: 'rgba(255, 255, 255, 0.05)',
                            border: '1px solid rgba(255, 255, 255, 0.15)',
                            color: '#E2E8F0',
                            fontSize: 11,
                            fontWeight: 700,
                            cursor: 'pointer',
                          }}
                        >
                          📝 Log Notes
                        </button>
                        <button
                          disabled={isSubmittingAction}
                          onClick={() => handleStartWork(inc)}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 6,
                            padding: '7px 16px',
                            borderRadius: 10,
                            background: 'linear-gradient(135deg, #F59E0B, #D97706)',
                            border: 'none',
                            color: '#000',
                            fontSize: 11,
                            fontWeight: 800,
                            cursor: 'pointer',
                            boxShadow: '0 0 15px rgba(245, 158, 11, 0.3)',
                          }}
                        >
                          <Play size={13} />
                          <span>Mark Work Started</span>
                        </button>
                      </>
                    )}

                    {/* Stage 3: Repair in Progress -> Log Updates & Resolve */}
                    {(inc.status === 'repair_started' || inc.status === 'in_progress') && (
                      <>
                        <button
                          disabled={isSubmittingAction}
                          onClick={() => {
                            setActionIncident(inc);
                            setActionType('evidence');
                          }}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 6,
                            padding: '7px 12px',
                            borderRadius: 10,
                            background: 'rgba(139, 92, 246, 0.15)',
                            border: '1px solid rgba(139, 92, 246, 0.35)',
                            color: '#C084FC',
                            fontSize: 11,
                            fontWeight: 700,
                            cursor: 'pointer',
                          }}
                        >
                          <Camera size={13} />
                          <span>Attach Photo</span>
                        </button>

                        <button
                          disabled={isSubmittingAction}
                          onClick={() => {
                            setActionIncident(inc);
                            setActionType('progress');
                          }}
                          style={{
                            padding: '7px 12px',
                            borderRadius: 10,
                            background: 'rgba(255, 255, 255, 0.05)',
                            border: '1px solid rgba(255, 255, 255, 0.15)',
                            color: '#E2E8F0',
                            fontSize: 11,
                            fontWeight: 700,
                            cursor: 'pointer',
                          }}
                        >
                          📝 Log Notes
                        </button>

                        <button
                          disabled={isSubmittingAction}
                          onClick={() => {
                            setActionIncident(inc);
                            setActionType('resolve');
                          }}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 6,
                            padding: '7px 16px',
                            borderRadius: 10,
                            background: 'linear-gradient(135deg, #10B981, #059669)',
                            border: 'none',
                            color: '#fff',
                            fontSize: 11,
                            fontWeight: 800,
                            cursor: 'pointer',
                            boxShadow: '0 0 15px rgba(16, 185, 129, 0.3)',
                          }}
                        >
                          <CheckCircle2 size={14} />
                          <span>Resolve Work Order</span>
                        </button>
                      </>
                    )}

                    {/* Stage 4: Resolved / QA */}
                    {isResolved && (
                      <span style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 5,
                        color: '#10B981',
                        fontSize: 11,
                        fontWeight: 700,
                      }}>
                        <CheckCircle2 size={14} /> Completed
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ═══════════════════════════════════════════
          7. MODAL DIALOGS (Reject, Progress, Resolve, Evidence)
      ═══════════════════════════════════════════ */}
      <AnimatePresence>
        {actionIncident && actionType && (
          <div style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.75)',
            backdropFilter: 'blur(8px)',
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 20,
          }}>
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              style={{
                width: '100%',
                maxWidth: 520,
                background: '#0B132B',
                border: '1px solid rgba(0, 212, 255, 0.3)',
                borderRadius: 24,
                padding: '28px',
                boxShadow: '0 24px 60px rgba(0, 0, 0, 0.7)',
                position: 'relative',
              }}
            >
              {/* Close Button */}
              <button
                onClick={closeModal}
                style={{
                  position: 'absolute',
                  top: 20,
                  right: 20,
                  background: 'transparent',
                  border: 'none',
                  color: '#94A3B8',
                  cursor: 'pointer',
                }}
              >
                <X size={20} />
              </button>

              {/* Modal Header */}
              <div style={{ marginBottom: 20 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#00D4FF', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>
                  Work Order Operation · {actionIncident.id}
                </div>
                <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: 18, fontWeight: 800, color: '#F8FAFC', margin: 0 }}>
                  {actionType === 'reject' && 'Reject Work Order Assignment'}
                  {actionType === 'progress' && 'Log Field Crew Progress Notes'}
                  {actionType === 'resolve' && 'Submit Repair Resolution & QA'}
                  {actionType === 'evidence' && 'Upload Field Photographic Evidence'}
                </h3>
              </div>

              {/* Form Body */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {/* Rejection preset pills */}
                {actionType === 'reject' && (
                  <div>
                    <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#94A3B8', marginBottom: 8 }}>
                      Quick Rejection Reason:
                    </label>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      {[
                        'Heavy suction excavator needed',
                        'Outside assigned municipal ward',
                        'Dispatched to critical Kaveri pipe burst',
                        'Material supplies unavailable today'
                      ].map((r, i) => (
                        <button
                          key={i}
                          type="button"
                          onClick={() => setActionNotes(r)}
                          style={{
                            padding: '4px 10px',
                            borderRadius: 8,
                            background: 'rgba(255, 255, 255, 0.05)',
                            border: '1px solid rgba(255, 255, 255, 0.1)',
                            color: '#E2E8F0',
                            fontSize: 11,
                            cursor: 'pointer',
                          }}
                        >
                          {r}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Notes Input Field */}
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#94A3B8', marginBottom: 6 }}>
                    {actionType === 'reject' && 'Reason for Rejection *'}
                    {actionType === 'progress' && 'Operational Field Progress Notes *'}
                    {actionType === 'resolve' && 'Resolution Summary & QA Remarks *'}
                    {actionType === 'evidence' && 'Evidence Description / Note'}
                  </label>
                  <textarea
                    rows={3}
                    value={actionNotes}
                    onChange={(e) => setActionNotes(e.target.value)}
                    placeholder={
                      actionType === 'resolve'
                        ? 'e.g. Cleared 10m stormwater obstruction using jet suction, installed heavy ductile manhole cover B17.'
                        : 'Enter details...'
                    }
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      background: 'rgba(0, 0, 0, 0.4)',
                      border: '1px solid rgba(0, 212, 255, 0.25)',
                      borderRadius: 12,
                      color: '#F8FAFC',
                      fontSize: 12,
                      outline: 'none',
                      boxSizing: 'border-box',
                      resize: 'none',
                    }}
                  />
                </div>

                {/* Photo Upload Section for Evidence and Resolution */}
                {(actionType === 'resolve' || actionType === 'evidence') && (
                  <div>
                    <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#94A3B8', marginBottom: 6 }}>
                      {actionType === 'resolve' ? 'Completion Photo Evidence (After-Repair)' : 'Select Image File'}
                    </label>

                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/jpeg,image/png,image/jpg"
                      onChange={handleImageUpload}
                      style={{ display: 'none' }}
                    />

                    <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                      <button
                        type="button"
                        disabled={isUploading}
                        onClick={() => fileInputRef.current?.click()}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 6,
                          padding: '8px 14px',
                          borderRadius: 10,
                          background: 'rgba(0, 212, 255, 0.1)',
                          border: '1px solid rgba(0, 212, 255, 0.3)',
                          color: '#00D4FF',
                          fontSize: 12,
                          fontWeight: 700,
                          cursor: isUploading ? 'not-allowed' : 'pointer',
                        }}
                      >
                        <Camera size={14} />
                        <span>{isUploading ? 'Uploading...' : 'Choose / Snap Photo'}</span>
                      </button>

                      {actionPhotoUrl && (
                        <div style={{ position: 'relative', width: 44, height: 44, borderRadius: 8, overflow: 'hidden', border: '1px solid #10B981' }}>
                          <img src={actionPhotoUrl} alt="Preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Modal Action Buttons */}
                <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 10 }}>
                  <button
                    type="button"
                    onClick={closeModal}
                    style={{
                      padding: '10px 18px',
                      borderRadius: 12,
                      background: 'rgba(255, 255, 255, 0.05)',
                      border: '1px solid rgba(255, 255, 255, 0.1)',
                      color: '#94A3B8',
                      fontSize: 12,
                      fontWeight: 700,
                      cursor: 'pointer',
                    }}
                  >
                    Cancel
                  </button>

                  <button
                    type="button"
                    disabled={isSubmittingAction || isUploading}
                    onClick={handleModalSubmit}
                    style={{
                      padding: '10px 22px',
                      borderRadius: 12,
                      background: actionType === 'reject'
                        ? '#EF4444'
                        : actionType === 'resolve'
                          ? 'linear-gradient(135deg, #10B981, #059669)'
                          : 'linear-gradient(135deg, #00D4FF, #0EA5E9)',
                      border: 'none',
                      color: actionType === 'resolve' || actionType === 'reject' ? '#fff' : '#000',
                      fontSize: 12,
                      fontWeight: 800,
                      cursor: isSubmittingAction ? 'not-allowed' : 'pointer',
                    }}
                  >
                    {isSubmittingAction ? 'Saving...' : 'Submit Operation'}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
