import React from 'react';
import { motion } from 'framer-motion';
import { BarChart3, Trophy } from 'lucide-react';
import {
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  Legend,
  ResponsiveContainer,
  Tooltip
} from 'recharts';
import type { Ward, CitizenContributor } from '../types';

interface WardAnalyticsProps {
  wards: Ward[];
  citizens: CitizenContributor[];
}

export const WardAnalytics: React.FC<WardAnalyticsProps> = ({ wards, citizens }) => {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem', padding: '1.5rem', fontFamily: 'var(--font-body)' }}>
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}
      >
        <div style={{ padding: '0.75rem', borderRadius: '12px', background: 'var(--bg-elevated)', border: '1px solid var(--border)' }}>
          <BarChart3 color="var(--accent)" size={28} />
        </div>
        <h2 style={{ margin: 0, fontFamily: 'var(--font-heading)', color: 'var(--text-primary)', fontSize: '1.75rem', fontWeight: 600 }}>
          Ward Performance Analytics
        </h2>
      </motion.div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(380px, 1fr))', gap: '2rem' }}>
        {/* Radar Chart */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.1 }}
          className="glass"
          style={{ padding: '1.5rem', borderRadius: 'var(--radius-xl)', border: '1px solid var(--border)', background: 'var(--bg-card)' }}
        >
          <h3 style={{ margin: '0 0 1.5rem', color: 'var(--text-primary)', fontSize: '1.25rem' }}>Comparative Metrics</h3>
          <div style={{ height: '350px', width: '100%' }}>
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart cx="50%" cy="50%" outerRadius="70%" data={wards}>
                <PolarGrid stroke="var(--border)" />
                <PolarAngleAxis dataKey="name" tick={{ fill: 'var(--text-secondary)', fontSize: 12 }} />
                <PolarRadiusAxis angle={30} domain={[0, 100]} tick={{ fill: 'var(--text-muted)' }} />
                <Radar name="Overall Score" dataKey="overallScore" stroke="var(--accent)" fill="var(--accent)" fillOpacity={0.3} />
                <Radar name="Cleanliness" dataKey="garbageCleanliness" stroke="var(--success)" fill="var(--success)" fillOpacity={0.3} />
                <Tooltip contentStyle={{ backgroundColor: 'var(--bg-elevated)', borderColor: 'var(--border)', borderRadius: '8px', color: '#fff' }} />
                <Legend wrapperStyle={{ paddingTop: '20px' }} />
              </RadarChart>
            </ResponsiveContainer>
          </div>
        </motion.div>

        {/* Citizen Leaderboard */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.2 }}
          className="glass-elevated"
          style={{ padding: '1.5rem', borderRadius: 'var(--radius-xl)', border: '1px solid var(--border)', background: 'var(--bg-card)' }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem' }}>
            <Trophy color="var(--warning)" size={24} />
            <h3 style={{ margin: 0, color: 'var(--text-primary)', fontSize: '1.25rem' }}>Citizen Leaderboard</h3>
          </div>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {citizens.slice(0, 3).map((citizen, idx) => (
              <motion.div
                key={citizen.id}
                initial={{ x: -20, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                transition={{ delay: 0.3 + idx * 0.1 }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  padding: '1rem',
                  background: 'rgba(255,255,255,0.03)',
                  borderRadius: '12px',
                  border: '1px solid var(--border)',
                  gap: '1rem'
                }}
              >
                <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: idx === 0 ? 'var(--warning)' : 'var(--text-muted)', width: '30px', textAlign: 'center' }}>
                  #{citizen.rank}
                </div>
                <img src={citizen.avatar} alt={citizen.name} style={{ width: '48px', height: '48px', borderRadius: '50%', border: '2px solid var(--border)' }} />
                <div style={{ flex: 1 }}>
                  <div style={{ color: 'var(--text-primary)', fontWeight: 600, fontSize: '1.1rem' }}>{citizen.name}</div>
                  <div style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>{citizen.reportsSubmitted} Reports • {citizen.verifiedFixes} Fixed</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ color: 'var(--accent)', fontWeight: 'bold', fontSize: '1.25rem', fontFamily: 'var(--font-mono)' }}>
                    {citizen.points}
                  </div>
                  <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem', textTransform: 'uppercase' }}>Pts</div>
                </div>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </div>
      
      {/* Ward Cards */}
      <h3 style={{ margin: '1rem 0 0', color: 'var(--text-primary)', fontSize: '1.25rem' }}>Ward Profiles</h3>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1.5rem' }}>
        {wards.map((ward, idx) => (
          <motion.div
            key={ward.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 + idx * 0.05 }}
            className="glass"
            style={{
              padding: '1.5rem',
              borderRadius: '16px',
              border: '1px solid var(--border)',
              background: 'var(--bg-elevated)',
              position: 'relative',
              overflow: 'hidden'
            }}
          >
            <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '4px', background: 'var(--accent)', opacity: 0.8 }} />
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
              <div>
                <h4 style={{ margin: 0, color: 'var(--text-primary)', fontSize: '1.15rem' }}>{ward.name}</h4>
                <span style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>Code: {ward.code} • Zone: {ward.zone}</span>
              </div>
              <div style={{ 
                background: ward.overallScore >= 80 ? 'rgba(16,185,129,0.1)' : ward.overallScore >= 60 ? 'rgba(245,158,11,0.1)' : 'rgba(239,68,68,0.1)',
                color: ward.overallScore >= 80 ? 'var(--success)' : ward.overallScore >= 60 ? 'var(--warning)' : 'var(--critical)',
                padding: '0.25rem 0.75rem',
                borderRadius: '99px',
                fontWeight: 'bold',
                fontFamily: 'var(--font-mono)'
              }}>
                {ward.overallScore}
              </div>
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                <span>Budget Utilized</span>
                <span>{((ward.budgetUtilized / ward.budgetTotal) * 100).toFixed(1)}%</span>
              </div>
              <div style={{ width: '100%', height: '6px', background: 'var(--border)', borderRadius: '4px', overflow: 'hidden' }}>
                <motion.div 
                  initial={{ width: 0 }}
                  animate={{ width: `${(ward.budgetUtilized / ward.budgetTotal) * 100}%` }}
                  transition={{ duration: 1, delay: 0.5 + idx * 0.1 }}
                  style={{ height: '100%', background: 'var(--accent)', borderRadius: '4px' }}
                />
              </div>
              
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.5rem', paddingTop: '1rem', borderTop: '1px solid var(--border)' }}>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem', textTransform: 'uppercase' }}>Open Complaints</span>
                  <span style={{ color: 'var(--warning)', fontWeight: 'bold', fontSize: '1.2rem', fontFamily: 'var(--font-mono)' }}>{ward.openComplaints}</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                  <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem', textTransform: 'uppercase' }}>Resolution Time</span>
                  <span style={{ color: 'var(--text-primary)', fontWeight: 'bold', fontSize: '1.2rem', fontFamily: 'var(--font-mono)' }}>{ward.resolutionTimeHours}h</span>
                </div>
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
};
