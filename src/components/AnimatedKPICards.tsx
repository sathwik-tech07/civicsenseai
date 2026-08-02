import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { AlertTriangle, Clock, Activity, ShieldCheck, Brain, CheckSquare } from 'lucide-react';
import type { Incident } from '../types';

interface AnimatedKPICardsProps {
  incidents: Incident[];
  avgResolutionHours: number;
  aiSavings: number;
  cityHealthScore?: number;
  aiRecommendation?: string;
}

const CountUp: React.FC<{ end: number; duration?: number; prefix?: string; suffix?: string; decimals?: number }> = ({ end, duration = 1500, prefix = '', suffix = '', decimals = 0 }) => {
  const [count, setCount] = useState(0);

  useEffect(() => {
    let startTime: number | null = null;
    let animationFrame: number;

    const step = (timestamp: number) => {
      if (!startTime) startTime = timestamp;
      const progress = Math.min((timestamp - startTime) / duration, 1);
      const easeOutQuart = 1 - Math.pow(1 - progress, 4);
      setCount(easeOutQuart * end);

      if (progress < 1) {
        animationFrame = requestAnimationFrame(step);
      }
    };

    animationFrame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(animationFrame);
  }, [end, duration]);

  return <>{prefix}{count.toFixed(decimals)}{suffix}</>;
};

export const AnimatedKPICards: React.FC<AnimatedKPICardsProps> = ({
  incidents,
  avgResolutionHours: _avg,
  aiSavings: _savings,
  cityHealthScore = 87,
  aiRecommendation = "Prioritize Ward 6 Drainage"
}) => {
  const activeIncidents = incidents.filter((i) => i.status !== 'resolved').length;
  const criticalAlerts = incidents.filter((i) => i.severity === 'critical').length;
  const pendingAssignments = incidents.filter((i) => i.status === 'reported').length;

  const cards = [
    {
      title: "Today's Active Incidents",
      value: activeIncidents,
      icon: Activity,
      color: 'var(--accent)',
      trend: '+12%',
      trendUp: false,
      isText: false,
    },
    {
      title: 'Critical Alerts',
      value: criticalAlerts,
      icon: AlertTriangle,
      color: 'var(--critical)',
      trend: '-8%',
      trendUp: true,
      isText: false,
    },
    {
      title: 'Pending Assignments',
      value: pendingAssignments,
      icon: CheckSquare,
      color: 'var(--warning)',
      trend: '4 Active',
      trendUp: true,
      isText: false,
    },
    {
      title: 'City Health Score',
      value: cityHealthScore,
      suffix: '/100',
      icon: ShieldCheck,
      color: 'var(--success)',
      trend: 'Optimal',
      trendUp: true,
      isText: false,
    },
    {
      title: 'AI Recommendation',
      textValue: aiRecommendation,
      icon: Brain,
      color: 'var(--violet)',
      trend: 'Urgent Priority',
      trendUp: true,
      isText: true,
    }
  ];

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { staggerChildren: 0.1 }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0, transition: { type: 'spring' as const, stiffness: 300, damping: 24 } }
  };

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
        gap: '1.5rem',
        marginBottom: '2rem'
      }}
    >
      {cards.map((card, idx) => {
        const Icon = card.icon;
        return (
          <motion.div
            key={idx}
            variants={itemVariants}
            whileHover={{ y: -4, boxShadow: `0 0 15px ${card.color}33`, borderColor: card.color }}
            style={{
              background: 'var(--bg-card)',
              border: '1px solid var(--border)',
              borderTop: `2px solid ${card.color}`,
              borderRadius: 'var(--radius-lg)',
              padding: '1.5rem',
              position: 'relative',
              overflow: 'hidden',
              backdropFilter: 'blur(10px)',
              transition: 'all 0.3s ease'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
              <span style={{ color: 'var(--text-secondary)', fontFamily: 'var(--font-body)', fontSize: '0.875rem', fontWeight: 500 }}>
                {card.title}
              </span>
              <div style={{ padding: '0.5rem', borderRadius: 'var(--radius-md)', backgroundColor: `${card.color}15`, color: card.color }}>
                <Icon size={20} />
              </div>
            </div>
            
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem', minHeight: '44px' }}>
              {card.isText ? (
                <div style={{ fontSize: '0.95rem', fontFamily: 'var(--font-heading)', color: '#00D4FF', fontWeight: 700, lineHeight: 1.3 }}>
                  {card.textValue}
                </div>
              ) : (
                <h3 style={{ margin: 0, fontSize: '2rem', fontFamily: 'var(--font-heading)', color: 'var(--text-primary)', fontWeight: 700 }}>
                  <CountUp end={card.value || 0} prefix={card.prefix} suffix={card.suffix} decimals={card.decimals} />
                </h3>
              )}
            </div>

            <div style={{ marginTop: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.75rem', fontFamily: 'var(--font-body)' }}>
              <span style={{ 
                color: card.trendUp ? 'var(--success)' : 'var(--critical)',
                display: 'flex', alignItems: 'center', gap: '0.25rem', fontWeight: 600
              }}>
                {card.trendUp ? '↑' : '↓'} {card.trend}
              </span>
              <span style={{ color: 'var(--text-muted)' }}>vs last month</span>
            </div>
          </motion.div>
        );
      })}
    </motion.div>
  );
};
