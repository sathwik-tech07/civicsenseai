import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Brain,
  TrendingUp,
  Shield,
  Zap,
  Sparkles,
  AlertTriangle,
  Clock,
  Users
} from 'lucide-react';

import type { Incident, Ward, DepartmentPerformance, IncidentSeverity } from '../types';
import { HeroSection } from './HeroSection';
import { AnimatedKPICards } from './AnimatedKPICards';

interface ExecutiveDashboardProps {
  wards: Ward[];
  incidents: Incident[];
  departments: DepartmentPerformance[];
  onSelectIncident: (incident: Incident) => void;
  onOpenReportGenerator: () => void;
  onTriggerEmergency: () => void;
}

const INSIGHTS = [
  { icon: Brain, title: 'Predictive Alert', text: 'Ward 4 drainage system shows 87% failure probability. Monsoon season approaching.', tag: 'URGENT', color: 'var(--critical)' },
  { icon: TrendingUp, title: 'Resource Optimization', text: 'Reallocating 3 crews from Ward 3 to Ward 5 could reduce resolution time by 34%.', tag: 'RECOMMENDATION', color: 'var(--info)' },
  { icon: Shield, title: 'Pattern Detected', text: 'Pothole recurrence rate increased 23% near hospital corridors after heavy rainfall events.', tag: 'INSIGHT', color: 'var(--violet)' },
  { icon: Zap, title: 'Budget Intelligence', text: 'Early intervention on 4 predicted failures could save ₹4.2L this quarter.', tag: 'SAVINGS', color: 'var(--success)' },
  { icon: AlertTriangle, title: 'Escalation Required', text: 'Water main burst in Industrial Zone has been unresolved for 26 hours. SLA breach imminent.', tag: 'CRITICAL', color: 'var(--warning)' }
];

const severityColors: Record<string, string> = {
  critical: 'var(--critical)',
  high: 'var(--warning)',
  medium: 'var(--info)',
  low: 'var(--success)'
};

export default function ExecutiveDashboard({
  wards,
  incidents,
  departments,
  onSelectIncident,
  onOpenReportGenerator,
  onTriggerEmergency: _onTriggerEmergency
}: ExecutiveDashboardProps) {
  const [filter, setFilter] = useState<IncidentSeverity | 'all'>('all');

  const cityHealthScore = wards.length > 0
    ? Math.round(wards.reduce((s, w) => s + w.overallScore, 0) / wards.length)
    : 0;

  const criticalCount = incidents.filter(i => i.severity === 'critical' && i.status !== 'resolved').length;

  const filteredIncidents = filter === 'all'
    ? incidents
    : incidents.filter(i => i.severity === filter);

  // Styles
  const containerStyle: React.CSSProperties = {
    padding: '32px',
    display: 'flex',
    flexDirection: 'column',
    gap: '40px',
    minHeight: '100vh',
    fontFamily: 'var(--font-body)',
    background: 'var(--bg-base)'
  };

  const gridLayout: React.CSSProperties = {
    display: 'grid',
    gridTemplateColumns: '1fr 380px',
    gap: '32px',
    alignItems: 'start'
  };

  const sectionHeaderStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    marginBottom: '24px'
  };

  const headerTextStyle: React.CSSProperties = {
    fontFamily: 'var(--font-heading)',
    fontSize: '24px',
    fontWeight: 600,
    color: 'var(--text-primary)',
    margin: 0
  };

  const badgeStyle: React.CSSProperties = {
    padding: '4px 8px',
    borderRadius: '12px',
    fontSize: '12px',
    fontWeight: 600,
    letterSpacing: '0.5px'
  };

  return (
    <div style={containerStyle}>
      <HeroSection
        cityHealthScore={cityHealthScore}
        criticalCount={criticalCount}
        onViewAlerts={() => {
          const feed = document.getElementById('incident-feed');
          if (feed) feed.scrollIntoView({ behavior: 'smooth' });
        }}
        onGenerateReport={onOpenReportGenerator}
      />

      <AnimatedKPICards
        incidents={incidents}
        avgResolutionHours={18.4}
        aiSavings={142800}
      />

      <div style={gridLayout}>
        {/* Live Incident Feed */}
        <div id="incident-feed" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div style={sectionHeaderStyle}>
            <div style={{ position: 'relative', width: '12px', height: '12px' }}>
              <motion.div
                animate={{ scale: [1, 1.5, 1], opacity: [0.7, 0, 0.7] }}
                transition={{ repeat: Infinity, duration: 2 }}
                style={{ position: 'absolute', inset: 0, borderRadius: '50%', backgroundColor: 'var(--critical)' }}
              />
              <div style={{ position: 'absolute', inset: '2px', borderRadius: '50%', backgroundColor: 'var(--critical)' }} />
            </div>
            <h2 style={headerTextStyle}>Live Incident Feed</h2>
            <span style={{ ...badgeStyle, backgroundColor: 'rgba(255,255,255,0.1)', color: 'var(--text-secondary)' }}>
              {filteredIncidents.length}
            </span>
          </div>

          <div style={{ display: 'flex', gap: '8px', marginBottom: '8px', overflowX: 'auto', paddingBottom: '8px' }}>
            {['all', 'critical', 'high', 'medium', 'low'].map(f => (
              <button
                key={f}
                onClick={() => setFilter(f as IncidentSeverity | 'all')}
                style={{
                  padding: '6px 16px',
                  borderRadius: '20px',
                  border: `1px solid ${filter === f ? 'var(--accent)' : 'var(--border)'}`,
                  background: filter === f ? 'var(--accent-glow)' : 'transparent',
                  color: filter === f ? 'var(--accent)' : 'var(--text-secondary)',
                  fontFamily: 'var(--font-heading)',
                  fontSize: '13px',
                  fontWeight: 500,
                  cursor: 'pointer',
                  textTransform: 'capitalize',
                  transition: 'all 0.2s'
                }}
              >
                {f}
              </button>
            ))}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <AnimatePresence>
              {filteredIncidents.map((incident, i) => (
                <motion.div
                  key={incident.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ delay: i * 0.05 }}
                  onClick={() => onSelectIncident(incident)}
                  whileHover={{ translateY: -2, boxShadow: `0 0 15px ${severityColors[incident.severity]}20`, borderColor: severityColors[incident.severity] }}
                  style={{
                    background: 'var(--bg-card)',
                    border: '1px solid var(--border)',
                    borderLeft: `4px solid ${severityColors[incident.severity]}`,
                    borderRadius: '12px',
                    padding: '20px',
                    cursor: 'pointer',
                    backdropFilter: 'blur(12px)',
                    WebkitBackdropFilter: 'blur(12px)',
                    transition: 'border-color 0.3s'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                      <span style={{
                        ...badgeStyle,
                        backgroundColor: `${severityColors[incident.severity]}20`,
                        color: severityColors[incident.severity],
                        textTransform: 'uppercase'
                      }}>
                        {incident.severity}
                      </span>
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--accent)', background: 'var(--accent-glow)', padding: '2px 6px', borderRadius: '4px' }}>
                        Score: {incident.priorityScore}
                      </span>
                    </div>
                    <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                      {new Date(incident.reportedDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: '18px', color: 'var(--text-primary)', margin: '0 0 8px 0' }}>
                    {incident.title}
                  </h3>
                  <p style={{ fontFamily: 'var(--font-body)', fontSize: '14px', color: 'var(--text-muted)', margin: '0 0 16px 0' }}>
                    {incident.address}
                  </p>
                  
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--border)', paddingTop: '16px' }}>
                    <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                      <span style={{ fontSize: '13px', color: 'var(--text-secondary)', background: 'rgba(255,255,255,0.05)', padding: '4px 10px', borderRadius: '12px' }}>
                        {incident.wardName}
                      </span>
                      <span style={{ fontSize: '13px', color: 'var(--success)', display: 'flex', alignItems: 'center', gap: '2px', fontFamily: 'var(--font-mono)' }}>
                        ${incident.estimatedRepairCost.toLocaleString('en-US')}
                      </span>
                    </div>
                    <button style={{
                      background: 'transparent',
                      border: 'none',
                      color: 'var(--accent)',
                      fontSize: '13px',
                      fontWeight: 500,
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                      cursor: 'pointer'
                    }}>
                      Analyze XAI →
                    </button>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </div>

        {/* AI Insights Panel */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div style={sectionHeaderStyle}>
            <Sparkles size={20} color="var(--accent)" />
            <h2 style={headerTextStyle}>AI Intelligence</h2>
          </div>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {INSIGHTS.map((insight, i) => {
              const Icon = insight.icon;
              return (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.1 + i * 0.1 }}
                  style={{
                    background: 'var(--bg-card)',
                    border: '1px solid var(--border)',
                    borderLeft: `3px solid ${insight.color}`,
                    borderRadius: '12px',
                    padding: '20px',
                    backdropFilter: 'blur(12px)',
                    WebkitBackdropFilter: 'blur(12px)'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <div style={{ 
                        width: '32px', height: '32px', 
                        borderRadius: '8px', 
                        background: `${insight.color}20`,
                        display: 'flex', alignItems: 'center', justifyContent: 'center'
                      }}>
                        <Icon size={16} color={insight.color} />
                      </div>
                      <h4 style={{ margin: 0, fontFamily: 'var(--font-heading)', fontSize: '15px', color: 'var(--text-primary)' }}>
                        {insight.title}
                      </h4>
                    </div>
                    <span style={{
                      ...badgeStyle,
                      backgroundColor: `${insight.color}15`,
                      color: insight.color,
                      fontSize: '10px'
                    }}>
                      {insight.tag}
                    </span>
                  </div>
                  <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                    {insight.text}
                  </p>
                </motion.div>
              )
            })}
          </div>
        </div>
      </div>

      {/* Department Operations */}
      <div style={{ marginTop: '20px' }}>
        <h2 style={{ ...headerTextStyle, marginBottom: '24px' }}>Department Operations</h2>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
          gap: '24px'
        }}>
          {departments.map((dept, i) => (
            <motion.div
              key={dept.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 + i * 0.1 }}
              whileHover={{ translateY: -4, borderColor: 'var(--border-accent)' }}
              style={{
                background: 'var(--bg-elevated)',
                border: '1px solid var(--border)',
                borderRadius: '16px',
                padding: '24px',
                transition: 'all 0.3s'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <h3 style={{ margin: 0, fontFamily: 'var(--font-heading)', fontSize: '18px', color: 'var(--text-primary)' }}>
                  {dept.name}
                </h3>
              </div>
              <p style={{ margin: '0 0 24px 0', fontSize: '13px', color: 'var(--text-muted)' }}>
                Head: {dept.headOfficer}
              </p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {/* Crew Utilization */}
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '6px' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Crew Utilization</span>
                    <span style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>{dept.activeCrews} / {dept.totalCrews}</span>
                  </div>
                  <div style={{ height: '6px', background: 'rgba(255,255,255,0.05)', borderRadius: '3px', overflow: 'hidden' }}>
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${(dept.activeCrews / dept.totalCrews) * 100}%` }}
                      transition={{ duration: 1, delay: 0.5 }}
                      style={{ height: '100%', background: 'linear-gradient(90deg, var(--accent), var(--violet))', borderRadius: '3px' }}
                    />
                  </div>
                </div>

                {/* Budget Utilization */}
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '6px' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Budget Utilized</span>
                    <span style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>
                      ₹{(dept.spentBudget / 100000).toFixed(1)}L / ₹{(dept.allocatedBudget / 100000).toFixed(1)}L
                    </span>
                  </div>
                  <div style={{ height: '6px', background: 'rgba(255,255,255,0.05)', borderRadius: '3px', overflow: 'hidden' }}>
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${(dept.spentBudget / dept.allocatedBudget) * 100}%` }}
                      transition={{ duration: 1, delay: 0.6 }}
                      style={{ height: '100%', background: 'var(--success)', borderRadius: '3px' }}
                    />
                  </div>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginTop: '24px', paddingTop: '20px', borderTop: '1px solid var(--border)' }}>
                <div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '4px' }}>Avg Resolution</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-primary)', fontFamily: 'var(--font-mono)', fontSize: '14px' }}>
                    <Clock size={14} color="var(--warning)" />
                    {dept.avgResolutionDays} days
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '4px' }}>Citizen Sat.</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-primary)', fontFamily: 'var(--font-mono)', fontSize: '14px' }}>
                    <Users size={14} color="var(--success)" />
                    {dept.satisfactionRating}%
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '4px' }}>Open Incidents</div>
                  <div style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-mono)', fontSize: '14px' }}>
                    {dept.openIncidents}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '4px' }}>Resolved (Mo)</div>
                  <div style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-mono)', fontSize: '14px' }}>
                    {dept.resolvedThisMonth}
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
}
