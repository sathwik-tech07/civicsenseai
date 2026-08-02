import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import { Brain, AlertTriangle, TrendingDown, Wrench, ShieldAlert, Droplets, MapPin } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import type { PredictiveRiskZone } from '../types';

interface Props {
  predictiveRisks: PredictiveRiskZone[];
  onTriggerProactiveWorkOrder: (risk: PredictiveRiskZone) => void;
}

const formatCurrency = (val: number) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(val);

const riskColors = {
  road_failure: 'var(--accent)',
  drainage_overflow: 'var(--info)',
  garbage_overflow: 'var(--warning)',
  water_leakage: 'var(--violet)'
};

const riskIcons = {
  road_failure: <MapPin size={16} />,
  drainage_overflow: <Droplets size={16} />,
  garbage_overflow: <AlertTriangle size={16} />,
  water_leakage: <Droplets size={16} />
};

const CircularProgress: React.FC<{ value: number, color: string }> = ({ value, color }) => {
  const radius = 28;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (value / 100) * circumference;

  return (
    <div style={{ position: 'relative', width: 64, height: 64, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <svg width="64" height="64" style={{ transform: 'rotate(-90deg)' }}>
        <circle cx="32" cy="32" r={radius} fill="transparent" stroke="var(--border)" strokeWidth="6" />
        <motion.circle
          cx="32"
          cy="32"
          r={radius}
          fill="transparent"
          stroke={color}
          strokeWidth="6"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset }}
          transition={{ duration: 1.5, ease: "easeOut" }}
          style={{ strokeLinecap: 'round' }}
        />
      </svg>
      <div style={{ position: 'absolute', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <span className="mono" style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)' }}>{Math.round(value)}%</span>
      </div>
    </div>
  );
};

export const PredictiveMaintenancePanel: React.FC<Props> = ({ predictiveRisks, onTriggerProactiveWorkOrder }) => {
  const stats = useMemo(() => {
    const totalRisks = predictiveRisks.length;
    const avgProb = totalRisks > 0 ? predictiveRisks.reduce((acc, r) => acc + r.failureProbabilityScore, 0) / totalRisks : 0;
    const totalSavings = predictiveRisks.reduce((acc, r) => acc + (r.potentialDamageCostIfIgnored - r.estimatedInterventionCost), 0);
    return { totalRisks, avgProb, totalSavings };
  }, [predictiveRisks]);

  const chartData = useMemo(() => {
    const counts: Record<string, number> = {};
    predictiveRisks.forEach(r => {
      counts[r.riskType] = (counts[r.riskType] || 0) + 1;
    });
    return Object.entries(counts).map(([name, value]) => ({ name: name.replace('_', ' ').toUpperCase(), value, originalKey: name as keyof typeof riskColors }));
  }, [predictiveRisks]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', width: '100%' }}>
      
      {/* Header */}
      <motion.div 
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        style={{ display: 'flex', alignItems: 'center', gap: '16px', paddingBottom: '16px', borderBottom: '1px solid var(--border)' }}
      >
        <div style={{ padding: '12px', borderRadius: '12px', background: 'var(--accent-glow)', color: 'var(--accent)' }}>
          <Brain size={32} />
        </div>
        <div>
          <h2 className="heading-lg" style={{ margin: 0, color: 'var(--text-primary)' }}>Predictive Maintenance Engine</h2>
          <p className="body-sm" style={{ margin: 0, color: 'var(--text-secondary)', marginTop: '4px' }}>AI-powered risk forecasting and proactive intervention</p>
        </div>
      </motion.div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '16px' }}>
        {[
          { label: 'High Risk Zones', value: stats.totalRisks, icon: <ShieldAlert size={20}/>, color: 'var(--critical)' },
          { label: 'Avg Failure Probability', value: `${stats.avgProb.toFixed(1)}%`, icon: <TrendingDown size={20}/>, color: 'var(--warning)' },
          { label: 'Potential Savings', value: formatCurrency(stats.totalSavings), icon: <Brain size={20}/>, color: 'var(--success)' },
        ].map((stat, i) => (
          <motion.div 
            key={i}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            className="glass"
            style={{ padding: '20px', borderRadius: '16px', display: 'flex', alignItems: 'center', gap: '16px' }}
          >
            <div style={{ padding: '12px', borderRadius: '12px', background: `${stat.color}20`, color: stat.color }}>
              {stat.icon}
            </div>
            <div>
              <div className="label" style={{ color: 'var(--text-secondary)', marginBottom: '4px' }}>{stat.label}</div>
              <div className="kpi-value" style={{ fontSize: '24px', color: 'var(--text-primary)' }}>{stat.value}</div>
            </div>
          </motion.div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '24px' }}>
        
        {/* Risk Cards */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <h3 className="heading-md" style={{ color: 'var(--text-primary)', margin: 0 }}>Predicted Incidents</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))', gap: '16px' }}>
            {predictiveRisks.map((risk, i) => (
              <motion.div
                key={risk.id}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: i * 0.05 }}
                className="glass-elevated"
                style={{
                  padding: '20px',
                  borderRadius: '16px',
                  borderLeft: `4px solid ${riskColors[risk.riskType]}`,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '16px',
                  position: 'relative',
                  overflow: 'hidden'
                }}
                whileHover={{ y: -4, boxShadow: '0 8px 32px rgba(0,0,0,0.2)' }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                      <span style={{ 
                        padding: '4px 8px', borderRadius: '20px', fontSize: '12px', fontWeight: 600, 
                        background: `${riskColors[risk.riskType]}20`, color: riskColors[risk.riskType],
                        display: 'flex', alignItems: 'center', gap: '4px'
                      }}>
                        {riskIcons[risk.riskType]} {risk.riskType.replace('_', ' ').toUpperCase()}
                      </span>
                    </div>
                    <h4 className="heading-sm" style={{ margin: '0 0 4px 0', color: 'var(--text-primary)' }}>{risk.zoneName}</h4>
                    <span className="body-sm" style={{ color: 'var(--text-secondary)' }}>{risk.wardName}</span>
                  </div>
                  <CircularProgress value={risk.failureProbabilityScore} color={riskColors[risk.riskType]} />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', background: 'var(--bg-base)', padding: '12px', borderRadius: '12px' }}>
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <span className="label" style={{ color: 'var(--text-muted)' }}>Road Age</span>
                    <span className="mono" style={{ color: 'var(--text-primary)' }}>{risk.roadAgeYears} yrs</span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <span className="label" style={{ color: 'var(--text-muted)' }}>Heavy Traffic</span>
                    <span className="mono" style={{ color: 'var(--text-primary)' }}>{risk.heavyVehicleVolumePerDay}/day</span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <span className="label" style={{ color: 'var(--text-muted)' }}>Rainfall</span>
                    <span className="mono" style={{ color: 'var(--text-primary)' }}>{risk.rainfallForecastMm} mm</span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <span className="label" style={{ color: 'var(--text-muted)' }}>Past Repairs</span>
                    <span className="mono" style={{ color: 'var(--text-primary)' }}>{risk.pastRepairsCount}</span>
                  </div>
                </div>

                <div style={{ padding: '12px', background: 'var(--bg-base)', borderRadius: '12px', borderLeft: '2px solid var(--success)' }}>
                  <span className="label" style={{ color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>AI Recommendation</span>
                  <span style={{ color: 'var(--text-primary)', fontSize: '14px', lineHeight: 1.4 }}>{risk.recommendedAction}</span>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '8px', borderTop: '1px solid var(--border)' }}>
                  <div>
                    <div className="label" style={{ color: 'var(--text-muted)' }}>Intervention vs Damage</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span className="mono" style={{ color: 'var(--text-primary)', fontSize: '14px' }}>{formatCurrency(risk.estimatedInterventionCost)}</span>
                      <span className="mono" style={{ color: 'var(--critical)', fontSize: '12px', textDecoration: 'line-through' }}>{formatCurrency(risk.potentialDamageCostIfIgnored)}</span>
                    </div>
                    <div className="mono" style={{ color: 'var(--success)', fontSize: '12px', marginTop: '2px' }}>
                      Save {formatCurrency(risk.potentialDamageCostIfIgnored - risk.estimatedInterventionCost)}
                    </div>
                  </div>
                  
                  <button 
                    className="btn-ai animate-glow" 
                    onClick={() => onTriggerProactiveWorkOrder(risk)}
                    style={{ padding: '8px 16px', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', cursor: 'pointer', border: 'none' }}
                  >
                    <Wrench size={16} /> Approve
                  </button>
                </div>
              </motion.div>
            ))}
          </div>
        </div>

        {/* Chart */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <h3 className="heading-md" style={{ color: 'var(--text-primary)', margin: 0 }}>Risk Distribution</h3>
          <div className="glass" style={{ padding: '24px', borderRadius: '16px', height: '300px' }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 20 }}>
                <XAxis dataKey="name" stroke="var(--text-muted)" fontSize={10} angle={-45} textAnchor="end" height={60} />
                <YAxis stroke="var(--text-muted)" fontSize={12} />
                <Tooltip 
                  cursor={{ fill: 'var(--border)' }}
                  contentStyle={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: '8px', color: 'var(--text-primary)' }}
                />
                <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                  {chartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={riskColors[entry.originalKey] || 'var(--accent)'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

      </div>
    </div>
  );
};
