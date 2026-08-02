import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { AlertTriangle, FileText, Sparkles, Brain, CheckCircle, ShieldCheck } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

interface HeroSectionProps {
  cityHealthScore: number;
  criticalCount: number;
  onViewAlerts: () => void;
  onGenerateReport: () => void;
  activeIncidentsCount?: number;
  pendingAssignmentsCount?: number;
}

const AI_TAGLINES = [
  "Building Smarter Cities Through AI.",
  "Every Complaint Matters. Every Citizen Counts.",
  "Turning Civic Data into Better Decisions.",
  "Predict Today. Prevent Tomorrow.",
  "AI-Powered Governance for Smarter Communities.",
];

export const HeroSection: React.FC<HeroSectionProps> = ({
  cityHealthScore,
  criticalCount,
  onViewAlerts,
  onGenerateReport,
  activeIncidentsCount = 12,
  pendingAssignmentsCount = 4
}) => {
  const { user } = useAuth();
  const [greeting, setGreeting] = useState('Good Day');
  const [tagline, setTagline] = useState(AI_TAGLINES[0]);

  useEffect(() => {
    const hour = new Date().getHours();
    if (hour < 12) setGreeting('Good Morning');
    else if (hour < 18) setGreeting('Good Afternoon');
    else setGreeting('Good Evening');

    // Rotate tagline based on day/session index
    const index = new Date().getDate() % AI_TAGLINES.length;
    setTagline(AI_TAGLINES[index]);
  }, []);

  const radius = 60;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (cityHealthScore / 100) * circumference;

  // Role personalization message
  const getRoleMessage = () => {
    if (!user) return "System health is normal.";
    switch (user.role) {
      case 'citizen':
        return "Thank you for helping improve your city.";
      case 'engineer':
        return `You have ${pendingAssignmentsCount} assigned incidents today.`;
      case 'commissioner':
        return "City operations are running at 87% efficiency.";
      case 'admin':
      default:
        return "System health is normal.";
    }
  };

  const displayName = user ? user.fullName : 'Authenticated User';

  return (
    <div style={{
      position: 'relative',
      padding: '3rem 2.5rem',
      borderRadius: 'var(--radius-xl)',
      overflow: 'hidden',
      background: 'var(--bg-surface)',
      border: '1px solid var(--border)',
      boxShadow: '0 10px 40px rgba(0,0,0,0.2)',
      marginBottom: '2rem'
    }}>
      {/* Animated Gradient Background */}
      <motion.div
        animate={{
          background: [
            'radial-gradient(circle at 0% 0%, var(--accent-glow) 0%, transparent 50%)',
            'radial-gradient(circle at 100% 100%, var(--violet-glow) 0%, transparent 50%)',
            'radial-gradient(circle at 0% 100%, var(--accent-glow) 0%, transparent 50%)',
            'radial-gradient(circle at 0% 0%, var(--accent-glow) 0%, transparent 50%)',
          ]
        }}
        transition={{ duration: 15, repeat: Infinity, ease: "linear" }}
        style={{
          position: 'absolute',
          inset: 0,
          opacity: 0.5,
          zIndex: 0
        }}
      />

      <div style={{ position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column', gap: '2rem' }}>
        {/* Top Header & Health Ring */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1.5rem' }}>
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6 }}
            style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', maxWidth: '650px' }}
          >
            <div>
              <motion.h2 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                style={{ margin: 0, fontSize: '2.25rem', fontFamily: 'var(--font-heading)', color: 'var(--text-primary)', fontWeight: 800 }}
              >
                {greeting}, {displayName}
              </motion.h2>
              <motion.p
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                style={{ margin: '0.4rem 0 0 0', fontSize: '1.1rem', color: '#00D4FF', fontFamily: 'var(--font-body)', fontWeight: 600 }}
              >
                Welcome back to CivicSense AI.
              </motion.p>
            </div>

            {/* AI Insight Tagline */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              color: '#8B5CF6',
              fontSize: '0.95rem',
              fontStyle: 'italic',
              fontWeight: 600,
            }}>
              <Sparkles size={16} color="#8B5CF6" />
              <span>"{tagline}"</span>
            </div>

            {/* Role Personalization Badge */}
            <div style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.6rem',
              padding: '0.5rem 1rem',
              background: 'rgba(0, 212, 255, 0.08)',
              border: '1px solid rgba(0, 212, 255, 0.25)',
              borderRadius: 'var(--radius-full)',
              width: 'fit-content',
              fontSize: '0.875rem',
              color: 'var(--text-primary)',
              fontWeight: 600,
            }}>
              <ShieldCheck size={16} color="#10B981" />
              <span>{getRoleMessage()}</span>
            </div>
          </motion.div>

          {/* Health Index SVG Gauge */}
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.8, type: 'spring' }}
            style={{ position: 'relative', width: '180px', height: '180px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          >
            <svg width="180" height="180" style={{ transform: 'rotate(-90deg)', position: 'absolute' }}>
              <circle
                cx="90" cy="90" r={radius}
                stroke="var(--bg-elevated)"
                strokeWidth="12" fill="none"
              />
              <motion.circle
                initial={{ strokeDashoffset: circumference }}
                animate={{ strokeDashoffset }}
                transition={{ duration: 1.5, ease: "easeOut", delay: 0.3 }}
                cx="90" cy="90" r={radius}
                stroke="var(--accent)"
                strokeWidth="12" fill="none"
                strokeLinecap="round"
                style={{ strokeDasharray: circumference }}
              />
            </svg>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'baseline' }}>
                <span style={{ fontSize: '2.75rem', fontWeight: 800, fontFamily: 'var(--font-heading)', color: 'var(--text-primary)' }}>{cityHealthScore}</span>
                <span style={{ fontSize: '0.9rem', color: 'var(--text-muted)', fontFamily: 'var(--font-body)' }}>/100</span>
              </div>
              <span style={{ fontSize: '0.75rem', color: 'var(--accent)', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '1px' }}>City Health Score</span>
            </div>
          </motion.div>
        </div>

        {/* Daily AI Briefing Box & Action Buttons */}
        <div style={{
          padding: '1.25rem 1.5rem',
          borderRadius: 'var(--radius-md)',
          background: 'rgba(17, 24, 39, 0.75)',
          border: '1px solid rgba(139, 92, 246, 0.3)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '1rem',
        }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '1rem', maxWidth: '700px' }}>
            <div style={{
              padding: '10px',
              borderRadius: '12px',
              background: 'rgba(139, 92, 246, 0.2)',
              border: '1px solid rgba(139, 92, 246, 0.4)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}>
              <Brain size={22} color="#8B5CF6" />
            </div>
            <div>
              <div style={{ fontSize: '0.85rem', fontWeight: 800, color: '#8B5CF6', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>
                Daily AI Briefing
              </div>
              <p style={{ margin: 0, fontSize: '0.925rem', color: '#F8FAFC', lineHeight: 1.5 }}>
                <strong>{greeting}, {displayName}.</strong> There are <strong>{criticalCount} critical incidents</strong> today. Ward 6 has the highest complaint density. Heavy rainfall expected — AI recommends prioritizing drainage maintenance.
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <button
              onClick={onViewAlerts}
              style={{
                display: 'flex', alignItems: 'center', gap: '0.5rem',
                padding: '0.65rem 1.25rem',
                backgroundColor: 'rgba(239, 68, 68, 0.1)',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                color: 'var(--critical)',
                borderRadius: 'var(--radius-sm)',
                fontFamily: 'var(--font-body)', fontWeight: 600,
                fontSize: '0.875rem',
                cursor: 'pointer',
                transition: 'all 0.2s'
              }}
              onMouseOver={(e) => e.currentTarget.style.backgroundColor = 'rgba(239, 68, 68, 0.2)'}
              onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'rgba(239, 68, 68, 0.1)'}
            >
              <AlertTriangle size={16} />
              Critical Alerts
              {criticalCount > 0 && <span style={{ padding: '0.1rem 0.4rem', backgroundColor: 'var(--critical)', color: '#fff', borderRadius: '10px', fontSize: '0.75rem' }}>{criticalCount}</span>}
            </button>

            <button
              onClick={onGenerateReport}
              style={{
                display: 'flex', alignItems: 'center', gap: '0.5rem',
                padding: '0.65rem 1.25rem',
                backgroundColor: 'var(--bg-elevated)',
                border: '1px solid var(--border)',
                color: 'var(--text-primary)',
                borderRadius: 'var(--radius-sm)',
                fontFamily: 'var(--font-body)', fontWeight: 500,
                fontSize: '0.875rem',
                cursor: 'pointer',
                transition: 'all 0.2s'
              }}
              onMouseOver={(e) => e.currentTarget.style.backgroundColor = 'var(--bg-hover)'}
              onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'var(--bg-elevated)'}
            >
              <FileText size={16} />
              Generate Report
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
