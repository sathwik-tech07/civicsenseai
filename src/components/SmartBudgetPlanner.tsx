import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import { DollarSign, PieChart as PieChartIcon, Activity, Users, Sparkles, TrendingUp } from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import type { DepartmentPerformance, Incident } from '../types';

interface Props {
  departments: DepartmentPerformance[];
  incidents: Incident[];
}

const formatCurrency = (val: number) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0, notation: 'compact' }).format(val);

const COLORS = ['#00D4FF', '#8B5CF6', '#10B981', '#F59E0B', '#EF4444', '#3B82F6'];

export const SmartBudgetPlanner: React.FC<Props> = ({ departments, incidents: _incidents }) => {
  const stats = useMemo(() => {
    let totalBudget = 0;
    let totalSpent = 0;
    let totalEfficiency = 0;

    departments.forEach(d => {
      totalBudget += d.allocatedBudget;
      totalSpent += d.spentBudget;
      totalEfficiency += (d.resolvedThisMonth / (d.resolvedThisMonth + d.openIncidents || 1)) * 100;
    });

    const avgEfficiency = departments.length ? totalEfficiency / departments.length : 0;
    const available = totalBudget - totalSpent;

    return { totalBudget, totalSpent, available, avgEfficiency };
  }, [departments]);

  const pieData = useMemo(() => {
    return departments.map(d => ({
      name: d.name,
      value: d.allocatedBudget
    }));
  }, [departments]);

  const insights = [
    { title: 'Reallocate Funds', desc: 'Transfer ₹50L from Parks to Road Repair due to monsoon prediction.', severity: 'high', icon: <TrendingUp size={16}/> },
    { title: 'Overtime Risk', desc: 'Drainage crews working at 95% capacity. Approve temporary hires.', severity: 'medium', icon: <Users size={16}/> },
    { title: 'Efficiency Gain', desc: 'Waste mgmt routed optimized. Saved ₹12L this month.', severity: 'low', icon: <Sparkles size={16}/> }
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', width: '100%' }}>
      
      {/* Header */}
      <motion.div 
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        style={{ display: 'flex', alignItems: 'center', gap: '16px', paddingBottom: '16px', borderBottom: '1px solid var(--border)' }}
      >
        <div style={{ padding: '12px', borderRadius: '12px', background: 'var(--accent-glow)', color: 'var(--accent)' }}>
          <DollarSign size={32} />
        </div>
        <div>
          <h2 className="heading-lg" style={{ margin: 0, color: 'var(--text-primary)' }}>Smart Budget & Resource Allocator</h2>
          <p className="body-sm" style={{ margin: 0, color: 'var(--text-secondary)', marginTop: '4px' }}>AI-driven financial planning and crew optimization</p>
        </div>
      </motion.div>

      {/* Overview Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
        {[
          { label: 'Total Budget', value: formatCurrency(stats.totalBudget), icon: <PieChartIcon size={20}/>, color: 'var(--info)' },
          { label: 'Utilized', value: formatCurrency(stats.totalSpent), icon: <Activity size={20}/>, color: 'var(--warning)' },
          { label: 'Available', value: formatCurrency(stats.available), icon: <DollarSign size={20}/>, color: 'var(--success)' },
          { label: 'Overall Efficiency', value: `${stats.avgEfficiency.toFixed(1)}%`, icon: <TrendingUp size={20}/>, color: 'var(--accent)' },
        ].map((stat, i) => (
          <motion.div 
            key={i}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
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
        
        {/* Departments Grid */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <h3 className="heading-md" style={{ color: 'var(--text-primary)', margin: 0 }}>Department Performance</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '16px' }}>
            {departments.map((dept, i) => {
              const utilPercent = (dept.spentBudget / dept.allocatedBudget) * 100;
              return (
                <motion.div
                  key={dept.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                  className="glass-elevated"
                  style={{ padding: '20px', borderRadius: '16px', display: 'flex', flexDirection: 'column', gap: '16px' }}
                  whileHover={{ y: -4, boxShadow: '0 8px 32px rgba(0,0,0,0.2)' }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <h4 className="heading-sm" style={{ margin: '0 0 4px 0', color: 'var(--text-primary)' }}>{dept.name}</h4>
                      <span className="body-sm" style={{ color: 'var(--text-secondary)' }}>Officer: {dept.headOfficer}</span>
                    </div>
                    <span className="mono" style={{ background: 'var(--bg-base)', padding: '4px 8px', borderRadius: '8px', fontSize: '12px', color: 'var(--text-muted)' }}>
                      {dept.code}
                    </span>
                  </div>

                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                      <span className="label" style={{ color: 'var(--text-secondary)' }}>Budget Utilized</span>
                      <span className="mono" style={{ color: 'var(--text-primary)', fontSize: '12px' }}>{formatCurrency(dept.spentBudget)} / {formatCurrency(dept.allocatedBudget)}</span>
                    </div>
                    <div style={{ height: '8px', background: 'var(--bg-base)', borderRadius: '4px', overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${utilPercent}%`, background: utilPercent > 90 ? 'var(--critical)' : utilPercent > 70 ? 'var(--warning)' : 'var(--success)' }} />
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', background: 'var(--bg-base)', padding: '12px', borderRadius: '12px' }}>
                    <div>
                      <span className="label" style={{ color: 'var(--text-muted)', display: 'block' }}>Active Crews</span>
                      <div style={{ display: 'flex', gap: '4px', marginTop: '4px' }}>
                        {Array.from({ length: dept.totalCrews }).map((_, idx) => (
                          <div key={idx} style={{ width: '8px', height: '8px', borderRadius: '50%', background: idx < dept.activeCrews ? 'var(--accent)' : 'var(--border)' }} />
                        ))}
                      </div>
                    </div>
                    <div>
                      <span className="label" style={{ color: 'var(--text-muted)', display: 'block' }}>Avg Resolution</span>
                      <span className="mono" style={{ color: 'var(--text-primary)' }}>{dept.avgResolutionDays} days</span>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>

        {/* Right Column: Insights & Chart */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          
          <div className="glass-accent" style={{ padding: '24px', borderRadius: '16px', border: '1px solid var(--border-accent)' }}>
            <h3 className="heading-md" style={{ color: 'var(--text-primary)', margin: '0 0 16px 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Sparkles size={20} color="var(--accent)" /> AI Recommendations
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {insights.map((insight, i) => (
                <div key={i} style={{ padding: '16px', background: 'var(--bg-base)', borderRadius: '12px', borderLeft: `3px solid ${insight.severity === 'high' ? 'var(--critical)' : insight.severity === 'medium' ? 'var(--warning)' : 'var(--success)'}` }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                    <span style={{ color: insight.severity === 'high' ? 'var(--critical)' : insight.severity === 'medium' ? 'var(--warning)' : 'var(--success)' }}>
                      {insight.icon}
                    </span>
                    <span className="label" style={{ color: 'var(--text-primary)' }}>{insight.title}</span>
                  </div>
                  <p className="body-sm" style={{ margin: 0, color: 'var(--text-secondary)', lineHeight: 1.4 }}>{insight.desc}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="glass" style={{ padding: '24px', borderRadius: '16px', flex: 1, minHeight: '300px' }}>
            <h3 className="heading-md" style={{ color: 'var(--text-primary)', margin: '0 0 16px 0' }}>Allocation Overview</h3>
            <div style={{ height: '220px' }}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {pieData.map((_entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip 
                    formatter={(value: unknown) => formatCurrency(Number(value))}
                    contentStyle={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: '8px', color: 'var(--text-primary)' }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>

        </div>

      </div>
    </div>
  );
};
