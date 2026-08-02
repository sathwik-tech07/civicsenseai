import React, { useState } from 'react';
import { Users, Shield, Cpu, Activity, CheckCircle2 } from 'lucide-react';
import type { UserRole } from '../context/AuthContext';

interface UserItem {
  id: string;
  fullName: string;
  email: string;
  role: UserRole;
  department?: string;
  status: 'Active' | 'Inactive';
  lastActive: string;
}

const INITIAL_USERS: UserItem[] = [
  { id: 'usr-1', fullName: 'Dr. Anita Roy', email: 'commissioner@civicsense.ai', role: 'commissioner', department: 'Executive Commission', status: 'Active', lastActive: '2 mins ago' },
  { id: 'usr-2', fullName: 'Eng. Rajesh V', email: 'engineer@civicsense.ai', role: 'engineer', department: 'Road Infrastructure & Works', status: 'Active', lastActive: '12 mins ago' },
  { id: 'usr-3', fullName: 'Priya Sharma', email: 'citizen@civicsense.ai', role: 'citizen', department: 'Ward 4 Resident Corps', status: 'Active', lastActive: '1 hour ago' },
  { id: 'usr-4', fullName: 'System Administrator', email: 'admin@civicsense.ai', role: 'admin', department: 'Smart City IT Command', status: 'Active', lastActive: 'Just now' },
  { id: 'usr-5', fullName: 'Insp. Suresh Nair', email: 'suresh.nair@civicsense.ai', role: 'engineer', department: 'Water Supply & Sewerage Board', status: 'Active', lastActive: '45 mins ago' },
];

export const UserManagementPanel: React.FC = () => {
  const [users, _setUsers] = useState<UserItem[]>(INITIAL_USERS);
  const [activeSubTab, setActiveSubTab] = useState<'users' | 'ai_config' | 'audit'>('users');
  const [confidenceThreshold, setConfidenceThreshold] = useState<number>(80);

  return (
    <div style={{ maxWidth: 1280, margin: '0 auto', padding: '24px 16px', display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: 24, fontWeight: 700, color: '#F8FAFC', margin: 0, display: 'flex', alignItems: 'center', gap: 10 }}>
            <Shield size={28} color="#00D4FF" />
            Administrator Control Center
          </h2>
          <p style={{ color: '#94A3B8', fontSize: 13, margin: '4px 0 0 0' }}>
            Manage System Roles, User Access Control, AI Model Configurations, and Platform Audit Logs
          </p>
        </div>

        {/* Sub-tab Selectors */}
        <div style={{ display: 'flex', gap: 8, background: 'rgba(17,24,39,0.75)', padding: 4, borderRadius: 12, border: '1px solid rgba(255,255,255,0.08)' }}>
          <button
            onClick={() => setActiveSubTab('users')}
            style={{
              padding: '8px 16px', borderRadius: 8, border: 'none',
              background: activeSubTab === 'users' ? '#00D4FF' : 'transparent',
              color: activeSubTab === 'users' ? '#000' : '#94A3B8',
              fontWeight: 700, fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6,
            }}
          >
            <Users size={14} />
            Users & Roles
          </button>
          <button
            onClick={() => setActiveSubTab('ai_config')}
            style={{
              padding: '8px 16px', borderRadius: 8, border: 'none',
              background: activeSubTab === 'ai_config' ? '#00D4FF' : 'transparent',
              color: activeSubTab === 'ai_config' ? '#000' : '#94A3B8',
              fontWeight: 700, fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6,
            }}
          >
            <Cpu size={14} />
            AI Configuration
          </button>
          <button
            onClick={() => setActiveSubTab('audit')}
            style={{
              padding: '8px 16px', borderRadius: 8, border: 'none',
              background: activeSubTab === 'audit' ? '#00D4FF' : 'transparent',
              color: activeSubTab === 'audit' ? '#000' : '#94A3B8',
              fontWeight: 700, fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6,
            }}
          >
            <Activity size={14} />
            Audit Logs
          </button>
        </div>
      </div>

      {/* Role Cards KPI Summary */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
        <div style={{ background: 'rgba(17,24,39,0.75)', border: '1px solid rgba(0,212,255,0.2)', borderRadius: 16, padding: 16 }}>
          <div style={{ fontSize: 11, color: '#64748B', fontWeight: 600 }}>Role: Citizen</div>
          <div style={{ fontSize: 22, fontWeight: 800, color: '#00D4FF', marginTop: 4 }}>1,420 Active</div>
          <div style={{ fontSize: 11, color: '#94A3B8', marginTop: 4 }}>Report & Track Complaints</div>
        </div>
        <div style={{ background: 'rgba(17,24,39,0.75)', border: '1px solid rgba(139,92,246,0.2)', borderRadius: 16, padding: 16 }}>
          <div style={{ fontSize: 11, color: '#64748B', fontWeight: 600 }}>Role: Engineer</div>
          <div style={{ fontSize: 22, fontWeight: 800, color: '#8B5CF6', marginTop: 4 }}>48 Active Crews</div>
          <div style={{ fontSize: 11, color: '#94A3B8', marginTop: 4 }}>Field Operations & Repairs</div>
        </div>
        <div style={{ background: 'rgba(17,24,39,0.75)', border: '1px solid rgba(16,185,129,0.2)', borderRadius: 16, padding: 16 }}>
          <div style={{ fontSize: 11, color: '#64748B', fontWeight: 600 }}>Role: Commissioner</div>
          <div style={{ fontSize: 22, fontWeight: 800, color: '#10B981', marginTop: 4 }}>12 Executive Board</div>
          <div style={{ fontSize: 11, color: '#94A3B8', marginTop: 4 }}>Analytics, GIS & Command</div>
        </div>
        <div style={{ background: 'rgba(17,24,39,0.75)', border: '1px solid rgba(245,158,11,0.2)', borderRadius: 16, padding: 16 }}>
          <div style={{ fontSize: 11, color: '#64748B', fontWeight: 600 }}>Role: Administrator</div>
          <div style={{ fontSize: 22, fontWeight: 800, color: '#F59E0B', marginTop: 4 }}>3 Superadmins</div>
          <div style={{ fontSize: 11, color: '#94A3B8', marginTop: 4 }}>System & Security Control</div>
        </div>
      </div>

      {/* Main Content Area */}
      {activeSubTab === 'users' && (
        <div style={{ background: 'rgba(17,24,39,0.75)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 20, padding: 20 }}>
          <h3 style={{ fontSize: 16, fontWeight: 700, color: '#F8FAFC', marginBottom: 16 }}>
            System Users Directory
          </h3>

          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, textAlign: 'left' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.08)', color: '#64748B' }}>
                <th style={{ padding: 12 }}>User Name</th>
                <th style={{ padding: 12 }}>Email Address</th>
                <th style={{ padding: 12 }}>Role Badge</th>
                <th style={{ padding: 12 }}>Department</th>
                <th style={{ padding: 12 }}>Status</th>
                <th style={{ padding: 12 }}>Last Active</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => {
                const roleColors: Record<UserRole, string> = {
                  commissioner: '#10B981',
                  engineer: '#8B5CF6',
                  citizen: '#00D4FF',
                  admin: '#F59E0B'
                };
                const color = roleColors[u.role] || '#00D4FF';

                return (
                  <tr key={u.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                    <td style={{ padding: 12, fontWeight: 600, color: '#F8FAFC' }}>{u.fullName}</td>
                    <td style={{ padding: 12, color: '#94A3B8', fontFamily: 'var(--font-mono)' }}>{u.email}</td>
                    <td style={{ padding: 12 }}>
                      <span style={{
                        padding: '4px 10px', borderRadius: 999,
                        background: color + '22', border: `1px solid ${color}`, color: color,
                        fontWeight: 700, fontSize: 11, textTransform: 'uppercase'
                      }}>
                        {u.role}
                      </span>
                    </td>
                    <td style={{ padding: 12, color: '#94A3B8' }}>{u.department}</td>
                    <td style={{ padding: 12, color: '#10B981', fontWeight: 600 }}>{u.status}</td>
                    <td style={{ padding: 12, color: '#64748B' }}>{u.lastActive}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {activeSubTab === 'ai_config' && (
        <div style={{ background: 'rgba(17,24,39,0.75)', border: '1px solid rgba(0,212,255,0.2)', borderRadius: 20, padding: 24, display: 'flex', flexDirection: 'column', gap: 20 }}>
          <h3 style={{ fontSize: 16, fontWeight: 700, color: '#F8FAFC', margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Cpu size={18} color="#00D4FF" />
            AI Model Engine & Vision Pipeline Configuration
          </h3>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
            <div style={{ background: 'rgba(255,255,255,0.03)', padding: 16, borderRadius: 16 }}>
              <div style={{ fontSize: 12, color: '#64748B', fontWeight: 600 }}>Active Multimodal Vision Model</div>
              <div style={{ fontSize: 16, fontWeight: 700, color: '#00D4FF', marginTop: 4 }}>Gemini 2.5 Flash Multimodal</div>
              <div style={{ fontSize: 12, color: '#10B981', marginTop: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                <CheckCircle2 size={14} /> Model Status: ONLINE (Latency 340ms)
              </div>
            </div>

            <div style={{ background: 'rgba(255,255,255,0.03)', padding: 16, borderRadius: 16 }}>
              <div style={{ fontSize: 12, color: '#64748B', fontWeight: 600 }}>Manual Review Confidence Threshold</div>
              <div style={{ fontSize: 20, fontWeight: 800, color: '#F59E0B', marginTop: 4, fontFamily: 'var(--font-mono)' }}>
                {confidenceThreshold}%
              </div>
              <input
                type="range"
                min="50"
                max="95"
                value={confidenceThreshold}
                onChange={(e) => setConfidenceThreshold(Number(e.target.value))}
                style={{ width: '100%', marginTop: 8 }}
              />
              <div style={{ fontSize: 11, color: '#64748B', marginTop: 4 }}>
                Classifications with confidence &lt; {confidenceThreshold}% trigger automatic officer manual review flag.
              </div>
            </div>
          </div>
        </div>
      )}

      {activeSubTab === 'audit' && (
        <div style={{ background: 'rgba(17,24,39,0.75)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 20, padding: 20 }}>
          <h3 style={{ fontSize: 16, fontWeight: 700, color: '#F8FAFC', marginBottom: 16 }}>
            System Audit & Security Event Logs
          </h3>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {[
              { time: '10:42 AM', user: 'Dr. Anita Roy (Commissioner)', action: 'Generated Executive PDF Report', ip: '192.168.1.102' },
              { time: '10:38 AM', user: 'System Administrator (Admin)', action: 'Migrated Database Schema (SQLite)', ip: '127.0.0.1' },
              { time: '10:25 AM', user: 'Eng. Rajesh V (Engineer)', action: 'Dispatched Crew Alpha-1 to INC-2026-8819', ip: '192.168.1.145' },
              { time: '10:12 AM', user: 'Priya Sharma (Citizen)', action: 'Submitted Incident Report via Vision AI', ip: '10.0.4.12' }
            ].map((log, idx) => (
              <div key={idx} style={{ padding: 12, background: 'rgba(255,255,255,0.02)', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 12 }}>
                <div>
                  <span style={{ color: '#00D4FF', fontWeight: 700, fontFamily: 'var(--font-mono)', marginRight: 12 }}>{log.time}</span>
                  <span style={{ color: '#F8FAFC', fontWeight: 600, marginRight: 12 }}>{log.user}</span>
                  <span style={{ color: '#94A3B8' }}>{log.action}</span>
                </div>
                <span style={{ color: '#64748B', fontFamily: 'var(--font-mono)' }}>{log.ip}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
