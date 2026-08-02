import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search, Clock, MapPin, CheckCircle2, Wrench, ShieldCheck, Download,
  Navigation, Sparkles, X, ChevronLeft, ChevronRight, RefreshCw, Cpu, Truck,
  ShieldAlert, Layers, UserCheck, SearchCode
} from 'lucide-react';
import type { Incident, IncidentStatus, IncidentSeverity } from '../types';

interface ComplaintHistoryProps {
  incidents: Incident[];
  onSelectIncident: (incident: Incident) => void;
}

const DEPARTMENTS_MAP: Record<string, string> = {
  pothole: 'Road Infrastructure & Works Dept',
  road_crack: 'Road Surface Maintenance Bureau',
  water_leak: 'Water Supply & Sewerage Board',
  water_leakage: 'Water Supply & Sewerage Board',
  garbage: 'Solid Waste Management Division',
  garbage_overflow: 'Solid Waste Management Division',
  drainage: 'Stormwater & Drainage Dept',
  drainage_blockage: 'Stormwater & Drainage Dept',
  streetlight: 'Electrical & Street Lighting Bureau',
  broken_streetlight: 'Electrical & Street Lighting Bureau',
  illegal_dumping: 'Environmental Sanitation Taskforce',
  fallen_tree: 'Urban Forestry & Disaster Corps',
  traffic_signal_failure: 'Traffic Management & Signals Division',
  road_collapse: 'Emergency Heavy Civil Engineering',
};

const SEVERITY_COLORS: Record<IncidentSeverity, string> = {
  critical: '#EF4444',
  high: '#F59E0B',
  medium: '#3B82F6',
  low: '#10B981',
};

const STATUS_COLORS: Record<IncidentStatus, string> = {
  reported: '#F59E0B',
  in_progress: '#00D4FF',
  resolved: '#10B981',
};

// 6-Stage Timeline Nodes
const TIMELINE_STAGES = [
  { id: 'reported', label: 'Reported', sub: 'Citizen Logged', icon: CheckCircle2 },
  { id: 'ai_analysis', label: 'AI Analysis', sub: 'XAI Scored', icon: Cpu },
  { id: 'assigned', label: 'Assigned', sub: 'Crew Allocated', icon: UserCheck },
  { id: 'inspection', label: 'Inspection', sub: 'Site Verified', icon: SearchCode },
  { id: 'repair', label: 'Repair', sub: 'Works En Route', icon: Wrench },
  { id: 'resolved', label: 'Resolved', sub: 'Audit Complete', icon: ShieldCheck },
];

export const ComplaintHistory: React.FC<ComplaintHistoryProps> = ({
  incidents,
  onSelectIncident,
}) => {
  // ── Filters & Search State ──
  const [searchTerm, setSearchTerm] = useState('');
  const [quickFilter, setQuickFilter] = useState<'all' | 'pending' | 'in_progress' | 'resolved' | 'critical'>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'newest' | 'oldest' | 'priority' | 'severity'>('newest');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 5;

  // ── Modal / Expander state ──
  const [liveTrackIncident, setLiveTrackIncident] = useState<Incident | null>(null);
  const [aiSummaryIncident, setAiSummaryIncident] = useState<Incident | null>(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);

  // ── Filtered & Sorted Incidents ──
  const filteredIncidents = useMemo(() => {
    return incidents.filter((inc) => {
      // Search by ID or Location/Address
      const query = searchTerm.toLowerCase();
      const matchesSearch =
        inc.id.toLowerCase().includes(query) ||
        inc.address.toLowerCase().includes(query) ||
        inc.title.toLowerCase().includes(query) ||
        inc.wardName.toLowerCase().includes(query);

      // Quick Filter Pills (All, Pending/Reported, In Progress, Resolved, Critical)
      let matchesQuick = true;
      if (quickFilter === 'pending') matchesQuick = inc.status === 'reported';
      else if (quickFilter === 'in_progress') matchesQuick = inc.status === 'in_progress';
      else if (quickFilter === 'resolved') matchesQuick = inc.status === 'resolved';
      else if (quickFilter === 'critical') matchesQuick = inc.severity === 'critical';

      // Type Filter
      const matchesType = typeFilter === 'all' || inc.type === typeFilter;

      return matchesSearch && matchesQuick && matchesType;
    }).sort((a, b) => {
      if (sortBy === 'newest') return new Date(b.reportedDate).getTime() - new Date(a.reportedDate).getTime();
      if (sortBy === 'oldest') return new Date(a.reportedDate).getTime() - new Date(b.reportedDate).getTime();
      if (sortBy === 'priority') return b.priorityScore - a.priorityScore;
      if (sortBy === 'severity') {
        const order: Record<IncidentSeverity, number> = { critical: 4, high: 3, medium: 2, low: 1 };
        return order[b.severity] - order[a.severity];
      }
      return 0;
    });
  }, [incidents, searchTerm, quickFilter, typeFilter, sortBy]);

  // ── Pagination ──
  const totalPages = Math.ceil(filteredIncidents.length / itemsPerPage) || 1;
  const paginatedIncidents = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredIncidents.slice(start, start + itemsPerPage);
  }, [filteredIncidents, currentPage]);

  const resetFilters = () => {
    setSearchTerm('');
    setQuickFilter('all');
    setTypeFilter('all');
    setSortBy('newest');
    setCurrentPage(1);
  };

  // ── Download Report ──
  const handleDownloadReport = (inc: Incident) => {
    const reportText = `=====================================================
CIVICSENSE AI — CITIZEN COMPLAINT DOSSIER
=====================================================
Complaint ID:     ${inc.id}
Issue Type:       ${inc.type.toUpperCase().replace('_', ' ')}
Title:            ${inc.title}
Submission Date:  ${inc.reportedDate}
Current Status:   ${inc.status.toUpperCase()}
Severity:         ${inc.severity.toUpperCase()}
AI Priority Score:${inc.priorityScore} / 100
AI CV Confidence: ${inc.xai.cvConfidence}%

LOCATION & WARD
Ward:             ${inc.wardName}
Address:          ${inc.address}
Coordinates:      ${inc.lat.toFixed(4)}°N, ${inc.lng.toFixed(4)}°E

ROUTING & OFFICER
Assigned Dept:    ${DEPARTMENTS_MAP[inc.type] || 'Municipal Works'}
Assigned Officer: Insp. Suresh Nair (Chief Field Engineer)
Assigned Crew:    ${inc.assignedCrew || 'Rapid Response Alpha-2'}
Est. Resolution:  ${inc.estimatedCompletionTimeHours || 18} Hours

RESOLUTION TIMELINE
1. Reported:      ${inc.reportedDate}
2. AI Analysis:   CV Model ${inc.xai.cvModel}
3. Assigned:      ${inc.assignedCrew || 'Rapid Crew Alpha-2'}
4. Inspection:    Verified via XAI Engine
5. Repair:        ${inc.status === 'in_progress' ? 'Active On-Site' : 'Scheduled'}
6. Resolved:      ${inc.status === 'resolved' ? 'Audit Complete' : 'In Progress'}

Generated via CivicSense AI Citizen Dashboard v5.0
Date: ${new Date().toLocaleString()}
=====================================================`;

    const blob = new Blob([reportText], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Complaint_Report_${inc.id}.txt`;
    link.click();
    URL.revokeObjectURL(url);
  };

  // Helper to determine stage completion state for 6-step timeline
  const getStageStatus = (stageIdx: number, status: IncidentStatus) => {
    // Stage 0: Reported (Always done)
    // Stage 1: AI Analysis (Always done)
    // Stage 2: Assigned (Done if in_progress or resolved)
    // Stage 3: Inspection (Done if in_progress or resolved)
    // Stage 4: Repair (Done if resolved, active if in_progress)
    // Stage 5: Resolved (Done if resolved)
    if (stageIdx <= 1) return 'done';
    if (status === 'resolved') return 'done';
    if (status === 'in_progress') {
      if (stageIdx <= 3) return 'done';
      if (stageIdx === 4) return 'active';
      return 'pending';
    }
    // status === 'reported'
    if (stageIdx === 2) return 'active';
    return 'pending';
  };

  return (
    <div style={{ maxWidth: 1220, margin: '0 auto', paddingBottom: 50 }}>
      
      {/* ── Page Header Banner (Linear + Notion Style) ── */}
      <div style={{ marginBottom: 28 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16, marginBottom: 8 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
              <div style={{
                padding: '6px 14px',
                borderRadius: 999,
                background: 'rgba(0, 212, 255, 0.1)',
                border: '1px solid rgba(0, 212, 255, 0.25)',
                color: '#00D4FF',
                fontSize: 12,
                fontWeight: 700,
                fontFamily: 'var(--font-mono)',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
              }}>
                <Layers size={14} />
                MY COMPLAINTS DASHBOARD
              </div>
            </div>
            <h1 style={{
              fontFamily: 'var(--font-heading)',
              fontSize: 28,
              fontWeight: 700,
              color: '#F8FAFC',
              margin: 0,
              letterSpacing: '-0.02em',
            }}>
              Citizen Complaint History & Resolution Tracker
            </h1>
            <p style={{ fontFamily: 'var(--font-body)', fontSize: 14, color: '#94A3B8', margin: '6px 0 0' }}>
              Track your reported issues, inspect live AI diagnostics, and follow progress across every resolution stage.
            </p>
          </div>
        </div>

        {/* ── Quick KPI Stat Cards Bar ── */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: 16,
          marginTop: 24,
        }}>
          {[
            { label: 'All Complaints', val: incidents.length, color: '#00D4FF', icon: <Layers size={18} /> },
            { label: 'Pending Action', val: incidents.filter(i => i.status === 'reported').length, color: '#F59E0B', icon: <Clock size={18} /> },
            { label: 'In Progress', val: incidents.filter(i => i.status === 'in_progress').length, color: '#3B82F6', icon: <Wrench size={18} /> },
            { label: 'Resolved', val: incidents.filter(i => i.status === 'resolved').length, color: '#10B981', icon: <CheckCircle2 size={18} /> },
          ].map((stat, idx) => (
            <motion.div
              key={idx}
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.08 }}
              style={{
                background: 'rgba(17, 24, 39, 0.65)',
                backdropFilter: 'blur(20px)',
                border: '1px solid rgba(255,255,255,0.08)',
                borderTop: `2px solid ${stat.color}`,
                borderRadius: 16,
                padding: '16px 20px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <div>
                <div style={{ fontSize: 11, fontWeight: 600, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.06em', fontFamily: 'var(--font-body)', marginBottom: 4 }}>
                  {stat.label}
                </div>
                <div style={{ fontSize: 24, fontWeight: 700, color: '#F8FAFC', fontFamily: 'var(--font-mono)' }}>
                  {stat.val}
                </div>
              </div>
              <div style={{
                width: 40,
                height: 40,
                borderRadius: 10,
                background: `${stat.color}15`,
                color: stat.color,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}>
                {stat.icon}
              </div>
            </motion.div>
          ))}
        </div>
      </div>

      {/* ── Filters & Search Control Bar ── */}
      <div style={{
        background: 'rgba(17, 24, 39, 0.65)',
        backdropFilter: 'blur(24px)',
        border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: 20,
        padding: 20,
        marginBottom: 28,
        display: 'flex',
        flexDirection: 'column',
        gap: 16,
      }}>
        {/* Top Row: Search Box + Filter Pills */}
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
          
          {/* Search Box */}
          <div style={{ flex: '1 1 300px', position: 'relative' }}>
            <Search size={16} color="#64748B" style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)' }} />
            <input
              type="text"
              placeholder="Search by Complaint ID or Location / Address..."
              value={searchTerm}
              onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
              style={{
                width: '100%',
                padding: '12px 16px 12px 40px',
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: 12,
                color: '#F8FAFC',
                fontFamily: 'var(--font-body)',
                fontSize: 13,
                outline: 'none',
                boxSizing: 'border-box',
              }}
            />
          </div>

          {/* Quick Status Filter Pills: All | Pending | In Progress | Resolved | Critical */}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {[
              { id: 'all', label: 'All' },
              { id: 'pending', label: 'Pending' },
              { id: 'in_progress', label: 'In Progress' },
              { id: 'resolved', label: 'Resolved' },
              { id: 'critical', label: 'Critical 🔥' },
            ].map((tab) => {
              const isActive = quickFilter === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => { setQuickFilter(tab.id as any); setCurrentPage(1); }}
                  style={{
                    padding: '10px 16px',
                    borderRadius: 12,
                    background: isActive ? 'linear-gradient(135deg, #00D4FF, #0EA5E9)' : 'rgba(255,255,255,0.04)',
                    color: isActive ? '#000' : '#94A3B8',
                    border: isActive ? 'none' : '1px solid rgba(255,255,255,0.08)',
                    fontWeight: isActive ? 700 : 500,
                    fontSize: 13,
                    fontFamily: 'var(--font-body)',
                    cursor: 'pointer',
                    transition: 'all 0.25s',
                    boxShadow: isActive ? '0 4px 14px rgba(0, 212, 255, 0.25)' : 'none',
                  }}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Bottom Row: Type Filter & Sort Dropdowns */}
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', paddingTop: 12, borderTop: '1px solid rgba(255,255,255,0.06)' }}>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            {/* Defect Type Filter */}
            <select
              value={typeFilter}
              onChange={(e) => { setTypeFilter(e.target.value); setCurrentPage(1); }}
              style={{
                padding: '10px 14px',
                background: '#111827',
                border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: 10,
                color: '#F8FAFC',
                fontFamily: 'var(--font-body)',
                fontSize: 13,
                outline: 'none',
              }}
            >
              <option value="all">Issue Type: All</option>
              <option value="pothole">Pothole</option>
              <option value="garbage">Garbage Dump</option>
              <option value="drainage">Drainage</option>
              <option value="water_leak">Water Leak</option>
              <option value="streetlight">Streetlight</option>
              <option value="road_collapse">Road Collapse</option>
            </select>

            {/* Sort Dropdown */}
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              style={{
                padding: '10px 14px',
                background: '#111827',
                border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: 10,
                color: '#00D4FF',
                fontFamily: 'var(--font-body)',
                fontWeight: 600,
                fontSize: 13,
                outline: 'none',
              }}
            >
              <option value="newest">Sort: Newest First</option>
              <option value="oldest">Sort: Oldest First</option>
              <option value="priority">Sort: Priority Score</option>
              <option value="severity">Sort: Severity Level</option>
            </select>

            {(searchTerm || quickFilter !== 'all' || typeFilter !== 'all' || sortBy !== 'newest') && (
              <button
                onClick={resetFilters}
                style={{
                  padding: '10px 14px',
                  background: 'rgba(255,255,255,0.06)',
                  border: '1px solid rgba(255,255,255,0.1)',
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
                <RefreshCw size={13} />
                Reset Filters
              </button>
            )}
          </div>

          <div style={{ fontSize: 12, color: '#64748B', fontFamily: 'var(--font-mono)' }}>
            Showing <span style={{ color: '#00D4FF', fontWeight: 700 }}>{filteredIncidents.length}</span> complaints
          </div>
        </div>
      </div>

      {/* ── Empty State (When zero matching complaints) ── */}
      {paginatedIncidents.length === 0 ? (
        <motion.div
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          style={{
            background: 'rgba(17, 24, 39, 0.65)',
            backdropFilter: 'blur(24px)',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: 24,
            padding: '70px 24px',
            textAlign: 'center',
          }}
        >
          <div style={{
            width: 72,
            height: 72,
            borderRadius: '50%',
            background: 'rgba(0, 212, 255, 0.1)',
            border: '1px solid rgba(0, 212, 255, 0.2)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 20px',
          }}>
            <ShieldAlert size={36} color="#00D4FF" />
          </div>

          <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: 20, fontWeight: 700, color: '#F8FAFC', margin: '0 0 8px 0' }}>
            No Matching Complaints Found
          </h3>
          <p style={{ fontFamily: 'var(--font-body)', fontSize: 14, color: '#94A3B8', maxWidth: 460, margin: '0 auto 24px', lineHeight: 1.5 }}>
            We couldn't find any complaints matching your search query or active filter settings.
          </p>

          <button
            onClick={resetFilters}
            style={{
              padding: '12px 24px',
              background: 'linear-gradient(135deg, #00D4FF, #0EA5E9)',
              color: '#000',
              border: 'none',
              borderRadius: 12,
              fontWeight: 700,
              fontSize: 14,
              cursor: 'pointer',
              boxShadow: '0 4px 16px rgba(0, 212, 255, 0.3)',
            }}
          >
            Reset All Filters
          </button>
        </motion.div>
      ) : (
        /* ── Complaint Cards List ── */
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          {paginatedIncidents.map((inc, index) => {
            const severityColor = SEVERITY_COLORS[inc.severity];
            const statusColor = STATUS_COLORS[inc.status];
            const deptName = DEPARTMENTS_MAP[inc.type] || 'Municipal Works';

            return (
              <motion.div
                key={inc.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.35, delay: index * 0.06 }}
                whileHover={{ y: -3, boxShadow: `0 12px 36px rgba(0, 0, 0, 0.35), 0 0 20px ${severityColor}22` }}
                style={{
                  background: 'rgba(17, 24, 39, 0.75)',
                  backdropFilter: 'blur(24px)',
                  border: '1px solid rgba(255,255,255,0.08)',
                  borderLeft: `4px solid ${severityColor}`,
                  borderRadius: 24,
                  padding: 24,
                  position: 'relative',
                  overflow: 'hidden',
                  transition: 'all 0.3s ease',
                }}
              >
                {/* ── Main Layout: Image (Left) + Details & Timeline (Right) ── */}
                <div style={{ display: 'grid', gridTemplateColumns: '240px 1fr', gap: 24 }}>
                  
                  {/* Left Column: Image & Highlights */}
                  <div>
                    <div
                      onClick={() => setImagePreviewUrl(inc.photoUrl)}
                      style={{
                        position: 'relative',
                        height: 165,
                        borderRadius: 16,
                        overflow: 'hidden',
                        cursor: 'pointer',
                        border: '1px solid rgba(255,255,255,0.1)',
                      }}
                    >
                      <img
                        src={inc.photoUrl}
                        alt={inc.title}
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      />
                      <div style={{
                        position: 'absolute',
                        inset: 0,
                        background: 'linear-gradient(to top, rgba(7,11,20,0.9), transparent 65%)',
                      }} />

                      {/* Complaint ID Pill */}
                      <div style={{
                        position: 'absolute',
                        top: 10,
                        left: 10,
                        padding: '4px 10px',
                        borderRadius: 999,
                        background: 'rgba(7,11,20,0.85)',
                        border: '1px solid rgba(0,212,255,0.3)',
                        color: '#00D4FF',
                        fontSize: 10,
                        fontWeight: 700,
                        fontFamily: 'var(--font-mono)',
                      }}>
                        {inc.id}
                      </div>

                      {/* Severity Pill */}
                      <div style={{
                        position: 'absolute',
                        top: 10,
                        right: 10,
                        padding: '4px 10px',
                        borderRadius: 999,
                        background: `${severityColor}22`,
                        border: `1px solid ${severityColor}66`,
                        color: severityColor,
                        fontSize: 10,
                        fontWeight: 700,
                        textTransform: 'uppercase',
                        fontFamily: 'var(--font-body)',
                      }}>
                        {inc.severity}
                      </div>

                      <div style={{
                        position: 'absolute',
                        bottom: 8,
                        left: 10,
                        right: 10,
                        fontSize: 10,
                        color: '#94A3B8',
                        fontFamily: 'var(--font-body)',
                        textAlign: 'center',
                      }}>
                        🔍 Click to enlarge photo
                      </div>
                    </div>

                    {/* AI Diagnostics Box (Score & Confidence) */}
                    <div style={{
                      marginTop: 12,
                      padding: 12,
                      background: 'rgba(255,255,255,0.03)',
                      borderRadius: 14,
                      border: '1px solid rgba(255,255,255,0.06)',
                      display: 'grid',
                      gridTemplateColumns: '1fr 1fr',
                      gap: 8,
                      fontSize: 11,
                    }}>
                      <div>
                        <div style={{ color: '#64748B', fontSize: 10, marginBottom: 2 }}>Priority Score</div>
                        <div style={{ color: '#00D4FF', fontWeight: 700, fontFamily: 'var(--font-mono)', fontSize: 13 }}>
                          {inc.priorityScore}/100
                        </div>
                      </div>
                      <div>
                        <div style={{ color: '#64748B', fontSize: 10, marginBottom: 2 }}>AI Confidence</div>
                        <div style={{ color: '#10B981', fontWeight: 700, fontFamily: 'var(--font-mono)', fontSize: 13 }}>
                          {inc.xai.cvConfidence}%
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Right Column: All Metadata, 6-Stage Timeline, Action Buttons */}
                  <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                    
                    <div>
                      {/* Title & Status Badge Header */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12, marginBottom: 8 }}>
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                            <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: 18, fontWeight: 700, color: '#F8FAFC', margin: 0 }}>
                              {inc.title}
                            </h3>
                            <span style={{
                              padding: '2px 8px',
                              borderRadius: 6,
                              background: 'rgba(0, 212, 255, 0.1)',
                              color: '#00D4FF',
                              fontSize: 11,
                              fontWeight: 600,
                              fontFamily: 'var(--font-mono)',
                              textTransform: 'capitalize',
                            }}>
                              {inc.type.replace('_', ' ')}
                            </span>
                          </div>

                          <div style={{ display: 'flex', alignItems: 'center', gap: 14, fontSize: 12, color: '#94A3B8', flexWrap: 'wrap' }}>
                            <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                              <MapPin size={13} color="#00D4FF" />
                              {inc.address}
                            </span>
                            <span>•</span>
                            <span style={{ color: '#F8FAFC', fontWeight: 500 }}>{inc.wardName}</span>
                          </div>
                        </div>

                        {/* Status Badge */}
                        <div style={{
                          padding: '6px 14px',
                          borderRadius: 999,
                          background: `${statusColor}15`,
                          border: `1px solid ${statusColor}44`,
                          color: statusColor,
                          fontSize: 12,
                          fontWeight: 700,
                          textTransform: 'uppercase',
                          letterSpacing: '0.05em',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 6,
                        }}>
                          <span style={{ width: 8, height: 8, borderRadius: '50%', background: statusColor }} />
                          {inc.status.replace('_', ' ')}
                        </div>
                      </div>

                      {/* 12 Required Metadata Fields Grid */}
                      <div style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))',
                        gap: '10px 16px',
                        margin: '14px 0',
                        padding: '12px 16px',
                        background: 'rgba(255,255,255,0.03)',
                        borderRadius: 14,
                        border: '1px solid rgba(255,255,255,0.06)',
                        fontSize: 12,
                      }}>
                        <div>
                          <div style={{ color: '#64748B', fontSize: 10, marginBottom: 2 }}>Submission Date</div>
                          <div style={{ color: '#F8FAFC', fontWeight: 600 }}>{inc.reportedDate}</div>
                        </div>
                        <div>
                          <div style={{ color: '#64748B', fontSize: 10, marginBottom: 2 }}>Assigned Dept</div>
                          <div style={{ color: '#F8FAFC', fontWeight: 600 }}>{deptName}</div>
                        </div>
                        <div>
                          <div style={{ color: '#64748B', fontSize: 10, marginBottom: 2 }}>Assigned Officer</div>
                          <div style={{ color: '#00D4FF', fontWeight: 600 }}>Insp. Suresh Nair</div>
                        </div>
                        <div>
                          <div style={{ color: '#64748B', fontSize: 10, marginBottom: 2 }}>Est. Resolution Time</div>
                          <div style={{ color: '#10B981', fontWeight: 600 }}>{inc.estimatedCompletionTimeHours || 18} Hours</div>
                        </div>
                      </div>

                      {/* ── 6-STAGE PROGRESS TIMELINE ── */}
                      <div style={{ margin: '18px 0 12px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10, fontSize: 11, fontWeight: 600, color: '#94A3B8' }}>
                          <span>Progress Timeline (6 Stages)</span>
                          <span style={{ color: statusColor, fontFamily: 'var(--font-mono)' }}>
                            {inc.status === 'resolved' ? '100% Resolved' : inc.status === 'in_progress' ? '65% Active' : '25% Logged'}
                          </span>
                        </div>

                        {/* 6 Stage Timeline Grid */}
                        <div style={{
                          display: 'grid',
                          gridTemplateColumns: 'repeat(6, 1fr)',
                          gap: 6,
                          position: 'relative',
                        }}>
                          {TIMELINE_STAGES.map((stage, sIdx) => {
                            const stageState = getStageStatus(sIdx, inc.status);
                            const isDone = stageState === 'done';
                            const isActive = stageState === 'active';
                            const IconComp = stage.icon;

                            return (
                              <div key={stage.id} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
                                {/* Stage Node Circle */}
                                <div style={{
                                  width: 28,
                                  height: 28,
                                  borderRadius: '50%',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  background: isDone
                                    ? 'rgba(16, 185, 129, 0.2)'
                                    : isActive
                                    ? 'rgba(0, 212, 255, 0.2)'
                                    : 'rgba(255, 255, 255, 0.04)',
                                  border: isDone
                                    ? '1px solid #10B981'
                                    : isActive
                                    ? '1px solid #00D4FF'
                                    : '1px solid rgba(255, 255, 255, 0.1)',
                                  color: isDone ? '#10B981' : isActive ? '#00D4FF' : '#475569',
                                  marginBottom: 6,
                                  boxShadow: isActive ? '0 0 12px rgba(0, 212, 255, 0.4)' : 'none',
                                }}>
                                  <IconComp size={13} />
                                </div>

                                {/* Label */}
                                <div style={{
                                  fontSize: 10,
                                  fontWeight: isDone || isActive ? 700 : 500,
                                  color: isDone ? '#10B981' : isActive ? '#00D4FF' : '#475569',
                                  fontFamily: 'var(--font-body)',
                                  lineHeight: 1.2,
                                }}>
                                  {stage.label}
                                </div>
                                <div style={{ fontSize: 9, color: '#64748B', marginTop: 2 }}>
                                  {stage.sub}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>

                    {/* ── 4 REQUIRED ACTION BUTTONS ── */}
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      flexWrap: 'wrap',
                      gap: 10,
                      marginTop: 14,
                      paddingTop: 14,
                      borderTop: '1px solid rgba(255,255,255,0.06)',
                    }}>
                      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                        {/* 1. View Details */}
                        <button
                          onClick={() => onSelectIncident(inc)}
                          style={{
                            padding: '8px 14px',
                            background: 'rgba(0, 212, 255, 0.1)',
                            border: '1px solid rgba(0, 212, 255, 0.25)',
                            borderRadius: 10,
                            color: '#00D4FF',
                            fontSize: 12,
                            fontWeight: 600,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 6,
                          }}
                        >
                          <Search size={14} />
                          View Details
                        </button>

                        {/* 2. Track Live */}
                        <button
                          onClick={() => setLiveTrackIncident(inc)}
                          style={{
                            padding: '8px 14px',
                            background: 'rgba(139, 92, 246, 0.1)',
                            border: '1px solid rgba(139, 92, 246, 0.25)',
                            borderRadius: 10,
                            color: '#8B5CF6',
                            fontSize: 12,
                            fontWeight: 600,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 6,
                          }}
                        >
                          <Navigation size={14} />
                          Track Live
                        </button>

                        {/* 3. Generate AI Summary */}
                        <button
                          onClick={() => setAiSummaryIncident(inc)}
                          style={{
                            padding: '8px 14px',
                            background: 'rgba(245, 158, 11, 0.1)',
                            border: '1px solid rgba(245, 158, 11, 0.25)',
                            borderRadius: 10,
                            color: '#F59E0B',
                            fontSize: 12,
                            fontWeight: 600,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 6,
                          }}
                        >
                          <Sparkles size={14} />
                          Generate AI Summary
                        </button>
                      </div>

                      {/* 4. Download Report */}
                      <button
                        onClick={() => handleDownloadReport(inc)}
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
                        Download Report
                      </button>
                    </div>

                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* ── Pagination Controls ── */}
      {totalPages > 1 && (
        <div style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          gap: 12,
          marginTop: 32,
        }}>
          <button
            onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
            disabled={currentPage === 1}
            style={{
              padding: '10px 16px',
              background: currentPage === 1 ? 'rgba(255,255,255,0.02)' : 'rgba(255,255,255,0.06)',
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: 12,
              color: currentPage === 1 ? '#475569' : '#F8FAFC',
              cursor: currentPage === 1 ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              fontSize: 13,
              fontWeight: 600,
            }}
          >
            <ChevronLeft size={16} />
            Previous
          </button>

          <div style={{ display: 'flex', gap: 6 }}>
            {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
              <button
                key={p}
                onClick={() => setCurrentPage(p)}
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 10,
                  background: currentPage === p ? '#00D4FF' : 'rgba(255,255,255,0.04)',
                  border: currentPage === p ? 'none' : '1px solid rgba(255,255,255,0.08)',
                  color: currentPage === p ? '#000' : '#94A3B8',
                  fontWeight: 700,
                  fontSize: 13,
                  cursor: 'pointer',
                  fontFamily: 'var(--font-mono)',
                }}
              >
                {p}
              </button>
            ))}
          </div>

          <button
            onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
            disabled={currentPage === totalPages}
            style={{
              padding: '10px 16px',
              background: currentPage === totalPages ? 'rgba(255,255,255,0.02)' : 'rgba(255,255,255,0.06)',
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: 12,
              color: currentPage === totalPages ? '#475569' : '#F8FAFC',
              cursor: currentPage === totalPages ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              fontSize: 13,
              fontWeight: 600,
            }}
          >
            Next
            <ChevronRight size={16} />
          </button>
        </div>
      )}

      {/* ── MODAL 1: Track Live Status ── */}
      <AnimatePresence>
        {liveTrackIncident && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 9999,
              background: 'rgba(0,0,0,0.82)',
              backdropFilter: 'blur(24px)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 20,
            }}
            onClick={() => setLiveTrackIncident(null)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              style={{
                width: '100%',
                maxWidth: 580,
                background: 'rgba(17, 24, 39, 0.95)',
                border: '1px solid rgba(0, 212, 255, 0.3)',
                borderRadius: 24,
                padding: 28,
                position: 'relative',
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <Navigation size={22} color="#00D4FF" />
                  <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: 18, color: '#F8FAFC', margin: 0 }}>
                    Live Rapid Response Tracker
                  </h3>
                </div>
                <button
                  onClick={() => setLiveTrackIncident(null)}
                  style={{ background: 'none', border: 'none', color: '#94A3B8', cursor: 'pointer' }}
                >
                  <X size={20} />
                </button>
              </div>

              {/* Live Telemetry Radar */}
              <div style={{
                height: 180,
                borderRadius: 16,
                background: 'radial-gradient(circle at 50% 50%, #061527, #070B14)',
                border: '1px solid rgba(0, 212, 255, 0.2)',
                marginBottom: 20,
                position: 'relative',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                overflow: 'hidden',
              }}>
                <div style={{ position: 'absolute', inset: 0, opacity: 0.15, background: 'radial-gradient(circle, #00D4FF 1px, transparent 1px)', backgroundSize: '20px 20px' }} />
                
                <div style={{ textAlign: 'center', zIndex: 2 }}>
                  <Truck size={36} color="#00D4FF" style={{ marginBottom: 8 }} />
                  <div style={{ color: '#00D4FF', fontWeight: 700, fontSize: 14, fontFamily: 'var(--font-mono)' }}>
                    CREW ACTIVE · EN ROUTE
                  </div>
                  <div style={{ color: '#94A3B8', fontSize: 12, marginTop: 4 }}>
                    GPS: {liveTrackIncident.lat.toFixed(4)}°N, {liveTrackIncident.lng.toFixed(4)}°E
                  </div>
                </div>
              </div>

              {/* Crew & Officer Info */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, fontSize: 13, marginBottom: 20 }}>
                <div style={{ padding: 12, background: 'rgba(255,255,255,0.03)', borderRadius: 12, border: '1px solid rgba(255,255,255,0.06)' }}>
                  <div style={{ color: '#64748B', fontSize: 11, marginBottom: 2 }}>Assigned Officer</div>
                  <div style={{ color: '#F8FAFC', fontWeight: 600 }}>Insp. Suresh Nair</div>
                </div>
                <div style={{ padding: 12, background: 'rgba(255,255,255,0.03)', borderRadius: 12, border: '1px solid rgba(255,255,255,0.06)' }}>
                  <div style={{ color: '#64748B', fontSize: 11, marginBottom: 2 }}>Est. Arrival / Completion</div>
                  <div style={{ color: '#10B981', fontWeight: 600 }}>{liveTrackIncident.estimatedCompletionTimeHours || 18} Hours</div>
                </div>
              </div>

              <button
                onClick={() => setLiveTrackIncident(null)}
                style={{
                  width: '100%',
                  padding: 12,
                  background: 'linear-gradient(135deg, #00D4FF, #0EA5E9)',
                  color: '#000',
                  border: 'none',
                  borderRadius: 12,
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                Close Tracker
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── MODAL 2: AI Summary Narrative Modal ── */}
      <AnimatePresence>
        {aiSummaryIncident && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 9999,
              background: 'rgba(0,0,0,0.82)',
              backdropFilter: 'blur(24px)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 20,
            }}
            onClick={() => setAiSummaryIncident(null)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              style={{
                width: '100%',
                maxWidth: 580,
                background: 'rgba(17, 24, 39, 0.95)',
                border: '1px solid rgba(245, 158, 11, 0.3)',
                borderRadius: 24,
                padding: 28,
                position: 'relative',
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <Sparkles size={22} color="#F59E0B" />
                  <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: 18, color: '#F8FAFC', margin: 0 }}>
                    AI Executive Narrative Summary
                  </h3>
                </div>
                <button
                  onClick={() => setAiSummaryIncident(null)}
                  style={{ background: 'none', border: 'none', color: '#94A3B8', cursor: 'pointer' }}
                >
                  <X size={20} />
                </button>
              </div>

              <div style={{
                background: 'rgba(245, 158, 11, 0.06)',
                border: '1px solid rgba(245, 158, 11, 0.2)',
                borderRadius: 16,
                padding: 20,
                marginBottom: 20,
                fontSize: 14,
                lineHeight: 1.6,
                color: '#F8FAFC',
              }}>
                <div style={{ fontWeight: 700, color: '#F59E0B', marginBottom: 8, fontSize: 15 }}>
                  Executive Briefing: {aiSummaryIncident.title}
                </div>
                <p style={{ margin: '0 0 12px 0', color: '#94A3B8' }}>
                  Incident <strong style={{ color: '#00D4FF' }}>{aiSummaryIncident.id}</strong> scored an AI Priority Rating of <strong style={{ color: '#00D4FF' }}>{aiSummaryIncident.priorityScore}/100</strong> via Computer Vision model <em>{aiSummaryIncident.xai.cvModel}</em> at <strong>{aiSummaryIncident.xai.cvConfidence}%</strong> confidence.
                </p>
                <div style={{ background: 'rgba(0,0,0,0.3)', padding: 12, borderRadius: 10, fontSize: 12, fontFamily: 'var(--font-mono)', color: '#10B981' }}>
                  • Proximity to {aiSummaryIncident.xai.hospitalName}: {aiSummaryIncident.xai.hospitalProximityMeters}m<br />
                  • Traffic Impact: {aiSummaryIncident.xai.estimatedDailyTraffic.toLocaleString()} vehicles/day<br />
                  • Est. Intervention Savings: ${aiSummaryIncident.savedEarlyIntervention.toLocaleString()}
                </div>
              </div>

              <button
                onClick={() => setAiSummaryIncident(null)}
                style={{
                  width: '100%',
                  padding: 12,
                  background: 'rgba(255,255,255,0.08)',
                  color: '#F8FAFC',
                  border: '1px solid rgba(255,255,255,0.12)',
                  borderRadius: 12,
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Close Summary
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── MODAL 3: Image Enlarge Preview Modal ── */}
      <AnimatePresence>
        {imagePreviewUrl && (
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
            onClick={() => setImagePreviewUrl(null)}
          >
            <div style={{ position: 'relative', maxWidth: '90vw', maxHeight: '90vh' }}>
              <img
                src={imagePreviewUrl}
                alt="Enlarged view"
                style={{ maxWidth: '100%', maxHeight: '85vh', borderRadius: 16, border: '1px solid rgba(255,255,255,0.2)' }}
              />
              <button
                onClick={() => setImagePreviewUrl(null)}
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
                  boxShadow: '0 4px 12px rgba(239, 68, 68, 0.4)',
                }}
              >
                <X size={20} />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
};
