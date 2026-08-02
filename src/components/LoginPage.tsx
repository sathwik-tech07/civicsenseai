import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Mail, Lock, Eye, EyeOff, ShieldCheck, Sparkles, ArrowRight, Loader2, User } from 'lucide-react';
import { useAuth, type UserRole } from '../context/AuthContext';

interface LoginPageProps {
  onLoginSuccess?: (role: UserRole) => void;
}

const ROLES: { id: UserRole; label: string; icon: string; desc: string }[] = [
  { id: 'commissioner', label: 'Commissioner', icon: '🏛️', desc: 'Executive Command & War Room' },
  { id: 'engineer',     label: 'Field Engineer', icon: '👨‍🔧', desc: 'Incident Operations & Work Orders' },
  { id: 'citizen',      label: 'Citizen', icon: '📱', desc: 'Mobile Reporter & Tracking' },
  { id: 'admin',        label: 'Administrator', icon: '⚡', desc: 'Ward Analytics & System Control' },
];

export const LoginPage: React.FC<LoginPageProps> = ({ onLoginSuccess }) => {
  const { loginUser } = useAuth();

  const [selectedRole, setSelectedRole] = useState<UserRole>('commissioner');
  const [fullName, setFullName] = useState('Dr. Anita Roy');
  const [email, setEmail] = useState('commissioner@civicsense.ai');

  const ROLE_PRESETS: Record<UserRole, { name: string; email: string }> = {
    commissioner: { name: 'Dr. Anita Roy', email: 'commissioner@civicsense.ai' },
    engineer: { name: 'Eng. Rajesh V', email: 'engineer@civicsense.ai' },
    citizen: { name: 'Priya Sharma', email: 'citizen@civicsense.ai' },
    admin: { name: 'System Administrator', email: 'admin@civicsense.ai' },
  };

  const handleRoleSelect = (role: UserRole) => {
    setSelectedRole(role);
    const preset = ROLE_PRESETS[role];
    if (preset) {
      setFullName(preset.name);
      setEmail(preset.email);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const finalName = fullName.trim() || ROLE_PRESETS[selectedRole].name;
    const finalEmail = email.trim() || ROLE_PRESETS[selectedRole].email;

    const user = loginUser(finalName, finalEmail, selectedRole);
    if (onLoginSuccess) onLoginSuccess(user.role);
  };


  return (
    <div style={{
      width: '100vw',
      height: '100vh',
      overflow: 'hidden',
      background: '#070B14',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      position: 'relative',
      fontFamily: 'var(--font-body)',
    }}>
      {/* Background Radial Glow Mesh */}
      <div style={{
        position: 'absolute',
        top: '-20%',
        left: '-10%',
        width: '60vw',
        height: '60vw',
        borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(0, 212, 255, 0.12) 0%, transparent 70%)',
        pointerEvents: 'none',
      }} />
      <div style={{
        position: 'absolute',
        bottom: '-20%',
        right: '-10%',
        width: '60vw',
        height: '60vw',
        borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(139, 92, 246, 0.12) 0%, transparent 70%)',
        pointerEvents: 'none',
      }} />

      {/* Main Dual-Panel Glass Container */}
      <div style={{
        width: '90%',
        maxWidth: 1140,
        height: '84vh',
        maxHeight: 760,
        background: 'rgba(17, 24, 39, 0.75)',
        backdropFilter: 'blur(32px)',
        border: '1px solid rgba(0, 212, 255, 0.25)',
        borderRadius: 32,
        boxShadow: '0 24px 80px rgba(0, 0, 0, 0.6), inset 0 1px 0 rgba(255, 255, 255, 0.1)',
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        overflow: 'hidden',
        position: 'relative',
        zIndex: 10,
      }}>

        {/* ═══════════════════════════════════════════
            LEFT SIDE: Smart City AI Visualization & Brand
        ═══════════════════════════════════════════ */}
        <div style={{
          padding: '48px 40px',
          background: 'linear-gradient(135deg, rgba(8, 27, 51, 0.6), rgba(7, 11, 20, 0.9))',
          borderRight: '1px solid rgba(255, 255, 255, 0.08)',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          position: 'relative',
          overflow: 'hidden',
        }}>
          {/* Animated GIS Network Grid Background */}
          <div style={{
            position: 'absolute',
            inset: 0,
            backgroundImage: 'radial-gradient(circle at 1px 1px, rgba(0, 212, 255, 0.15) 1px, transparent 0)',
            backgroundSize: '24px 24px',
            opacity: 0.6,
            pointerEvents: 'none',
          }} />

          {/* Floating Neural Particles */}
          {[...Array(6)].map((_, i) => (
            <motion.div
              key={i}
              animate={{
                y: [0, -20, 0],
                x: [0, 10, 0],
                opacity: [0.3, 0.7, 0.3],
              }}
              transition={{
                duration: 4 + i * 0.8,
                repeat: Infinity,
                ease: 'easeInOut',
              }}
              style={{
                position: 'absolute',
                top: `${15 + i * 14}%`,
                left: `${20 + (i % 3) * 25}%`,
                width: 6 + i * 2,
                height: 6 + i * 2,
                borderRadius: '50%',
                background: i % 2 === 0 ? '#00D4FF' : '#8B5CF6',
                boxShadow: i % 2 === 0 ? '0 0 12px #00D4FF' : '0 0 12px #8B5CF6',
                pointerEvents: 'none',
              }}
            />
          ))}

          {/* Brand Logo & Title Header */}
          <div style={{ zIndex: 2 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
              <div style={{
                width: 44,
                height: 44,
                borderRadius: 14,
                background: 'linear-gradient(135deg, #00D4FF, #8B5CF6)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 0 20px rgba(0, 212, 255, 0.4)',
              }}>
                <Sparkles size={24} color="#000" />
              </div>
              <div>
                <h1 style={{
                  fontFamily: 'var(--font-heading)',
                  fontSize: 26,
                  fontWeight: 800,
                  color: '#F8FAFC',
                  margin: 0,
                  letterSpacing: '-0.02em',
                }}>
                  CivicSense <span style={{ color: '#00D4FF' }}>AI</span>
                </h1>
                <div style={{ fontSize: 11, color: '#94A3B8', fontFamily: 'var(--font-mono)' }}>
                  OS v5.0 · AI Command System
                </div>
              </div>
            </div>

            <div style={{ fontSize: 13, color: '#00D4FF', fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase', marginBottom: 6 }}>
              Welcome to CivicSense AI · Smart City Operations Platform
            </div>
          </div>

          {/* Center Graphic & Tagline */}
          <div style={{ zIndex: 2, margin: '20px 0' }}>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8 }}
            >
              <div style={{
                fontSize: 28,
                fontWeight: 800,
                fontFamily: 'var(--font-heading)',
                color: '#F8FAFC',
                lineHeight: 1.3,
                marginBottom: 16,
              }}>
                "Transforming Citizen Complaints into <br />
                <span style={{
                  background: 'linear-gradient(135deg, #00D4FF, #8B5CF6)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                }}>
                  Intelligent City Actions.
                </span>"
              </div>
              <p style={{ fontSize: 14, color: '#94A3B8', lineHeight: 1.6, maxWidth: 420 }}>
                Instant role-based command entry for Citizens, Field Engineers, Municipal Commissioners, and System Administrators.
              </p>
            </motion.div>

            {/* Feature Pills */}
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 20 }}>
              {['Gemini 2.5 Vision', 'OpenStreetMap GIS', 'XAI Diagnostics', 'Real-Time Dispatch'].map((feat, idx) => (
                <span key={idx} style={{
                  padding: '5px 12px',
                  borderRadius: 999,
                  background: 'rgba(0, 212, 255, 0.08)',
                  border: '1px solid rgba(0, 212, 255, 0.2)',
                  color: '#00D4FF',
                  fontSize: 11,
                  fontWeight: 600,
                  fontFamily: 'var(--font-mono)',
                }}>
                  ✓ {feat}
                </span>
              ))}
            </div>
          </div>

          {/* Footer Security Badge */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#64748B', fontSize: 12, zIndex: 2 }}>
            <ShieldCheck size={16} color="#10B981" />
            <span>256-bit AES Encryption · ISO 27001 Certified Smart City Core</span>
          </div>
        </div>

        {/* ═══════════════════════════════════════════
            RIGHT SIDE: Enterprise Entry Form Card
        ═══════════════════════════════════════════ */}
        <div style={{
          padding: '44px 48px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          overflowY: 'auto',
        }}>
          <div>
            {/* Header */}
            <div style={{ marginBottom: 20 }}>
              <h2 style={{
                fontFamily: 'var(--font-heading)',
                fontSize: 22,
                fontWeight: 800,
                color: '#F8FAFC',
                margin: '0 0 4px 0',
              }}>
                Smart City Entry Portal
              </h2>
              <p style={{ fontSize: 12, color: '#94A3B8', margin: 0 }}>
                Select your role and enter your details to launch your dashboard.
              </p>
            </div>

            {/* Role Support Selector Tabs */}
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>
                Select Operational Role
              </div>
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(4, 1fr)',
                gap: 6,
                background: 'rgba(0, 0, 0, 0.4)',
                padding: 4,
                borderRadius: 14,
                border: '1px solid rgba(255, 255, 255, 0.08)',
              }}>
                {ROLES.map((r) => {
                  const isSelected = selectedRole === r.id;
                  return (
                    <button
                      key={r.id}
                      type="button"
                      onClick={() => handleRoleSelect(r.id)}
                      style={{
                        padding: '8px 6px',
                        borderRadius: 10,
                        background: isSelected ? 'linear-gradient(135deg, rgba(0, 212, 255, 0.2), rgba(139, 92, 246, 0.2))' : 'transparent',
                        border: isSelected ? '1px solid #00D4FF' : '1px solid transparent',
                        color: isSelected ? '#00D4FF' : '#94A3B8',
                        cursor: 'pointer',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: 2,
                        transition: 'all 0.2s',
                      }}
                    >
                      <span style={{ fontSize: 16 }}>{r.icon}</span>
                      <span style={{ fontSize: 10, fontWeight: isSelected ? 800 : 600 }}>{r.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {/* Full Name Field */}
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#F8FAFC', marginBottom: 6 }}>
                  Full Name <span style={{ color: '#00D4FF' }}>*</span>
                </label>
                <div style={{ position: 'relative' }}>
                  <User size={16} color="#00D4FF" style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)' }} />
                  <input
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="e.g. Dr. Anita Roy"
                    required
                    style={{
                      width: '100%',
                      padding: '11px 14px 11px 40px',
                      background: 'rgba(0, 0, 0, 0.4)',
                      border: '1px solid rgba(0, 212, 255, 0.25)',
                      borderRadius: 12,
                      color: '#F8FAFC',
                      fontSize: 13,
                      outline: 'none',
                      boxSizing: 'border-box',
                    }}
                  />
                </div>
              </div>

              {/* Email Field */}
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#F8FAFC', marginBottom: 6 }}>
                  Email Address <span style={{ color: '#00D4FF' }}>*</span>
                </label>
                <div style={{ position: 'relative' }}>
                  <Mail size={16} color="#00D4FF" style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)' }} />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="name@civicsense.ai"
                    required
                    style={{
                      width: '100%',
                      padding: '11px 14px 11px 40px',
                      background: 'rgba(0, 0, 0, 0.4)',
                      border: '1px solid rgba(0, 212, 255, 0.25)',
                      borderRadius: 12,
                      color: '#F8FAFC',
                      fontSize: 13,
                      outline: 'none',
                      boxSizing: 'border-box',
                    }}
                  />
                </div>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                style={{
                  marginTop: 10,
                  width: '100%',
                  padding: '13px',
                  borderRadius: 12,
                  border: 'none',
                  background: 'linear-gradient(135deg, #00D4FF 0%, #8B5CF6 100%)',
                  color: '#000',
                  fontWeight: 800,
                  fontSize: 14,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                  boxShadow: '0 0 20px rgba(0, 212, 255, 0.3)',
                  transition: 'all 0.2s ease',
                }}
              >
                <span>Enter Command Center</span>
                <ArrowRight size={18} />
              </button>
            </form>
          </div>

          {/* Quick Demo Presets Header */}
          <div style={{ marginTop: 24, paddingTop: 16, borderTop: '1px solid rgba(255,255,255,0.08)' }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 10 }}>
              Quick Role Switch Presets
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8 }}>
              {ROLES.map((r) => (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => handleRoleSelect(r.id)}
                  style={{
                    padding: '8px 10px',
                    borderRadius: 10,
                    background: selectedRole === r.id ? 'rgba(0, 212, 255, 0.15)' : 'rgba(255, 255, 255, 0.03)',
                    border: selectedRole === r.id ? '1px solid #00D4FF' : '1px solid rgba(255, 255, 255, 0.08)',
                    color: '#F8FAFC',
                    fontSize: 11,
                    fontWeight: 600,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    textAlign: 'left',
                  }}
                >
                  <span>{r.icon}</span>
                  <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

function showToast(msg: string) {
  alert(msg);
}
