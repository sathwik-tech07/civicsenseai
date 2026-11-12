import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Mail, ShieldCheck, Sparkles, ArrowRight, User, Lock, AlertCircle, KeyRound, X, Check } from 'lucide-react';
import { useAuth, type UserRole } from '../context/AuthContext';
import { apiForgotPassword, apiResetPassword } from '../services/apiClient';

interface LoginPageProps {
  onLoginSuccess?: (role: UserRole) => void;
}

const isProd = import.meta.env.PROD;

const ROLES: { id: UserRole; label: string; icon: string; desc: string }[] = [
  { id: 'commissioner', label: 'Commissioner', icon: '🏛️', desc: 'Executive Command & War Room' },
  { id: 'engineer',     label: 'Field Engineer', icon: '👨‍🔧', desc: 'Incident Operations & Work Orders' },
  { id: 'citizen',      label: 'Citizen', icon: '📱', desc: 'Mobile Reporter & Tracking' },
  { id: 'admin',        label: 'Administrator', icon: '⚡', desc: 'Ward Analytics & System Control' },
];

const ROLE_PRESETS: Record<UserRole, { name: string; email: string; defaultPassword?: string }> = {
  commissioner: { name: 'Dr. Anita Roy', email: 'commissioner@civicsense.ai', defaultPassword: isProd ? '' : 'password123' },
  engineer: { name: 'Eng. Rajesh V', email: 'engineer@civicsense.ai', defaultPassword: isProd ? '' : 'password123' },
  citizen: { name: 'Priya Sharma', email: 'citizen@civicsense.ai', defaultPassword: isProd ? '' : 'password123' },
  admin: { name: 'System Administrator', email: 'admin@civicsense.ai', defaultPassword: isProd ? '' : 'password123' },
};

export const LoginPage: React.FC<LoginPageProps> = ({ onLoginSuccess }) => {
  const { signup, loginUser } = useAuth();

  const [selectedRole, setSelectedRole] = useState<UserRole>('commissioner');
  const [fullName, setFullName] = useState('Dr. Anita Roy');
  const [email, setEmail] = useState('commissioner@civicsense.ai');
  const [password, setPassword] = useState(isProd ? '' : 'password123');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);

  // Password Recovery State
  const [showRecoveryModal, setShowRecoveryModal] = useState(false);
  const [recoveryEmail, setRecoveryEmail] = useState('');
  const [recoveryToken, setRecoveryToken] = useState('');
  const [recoveryNewPassword, setRecoveryNewPassword] = useState('');
  const [recoveryStep, setRecoveryStep] = useState<1 | 2>(1);
  const [recoveryMsg, setRecoveryMsg] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  const [isRecovering, setIsRecovering] = useState(false);

  const handleRoleSelect = (role: UserRole) => {
    setSelectedRole(role);
    setErrorMsg(null);
    if (isSignUp) setIsSignUp(false);
    const preset = ROLE_PRESETS[role];
    if (preset) {
      setFullName(preset.name);
      setEmail(preset.email);
      setPassword(isProd ? '' : (preset.defaultPassword || ''));
    }
  };

  const handleRequestRecovery = async (e: React.FormEvent) => {
    e.preventDefault();
    setRecoveryMsg(null);
    setIsRecovering(true);
    try {
      const res = await apiForgotPassword(recoveryEmail);
      setRecoveryMsg({ text: res.message, type: 'success' });
      if (res.reset_token) {
        setRecoveryToken(res.reset_token);
      }
      setRecoveryStep(2);
    } catch (err: any) {
      setRecoveryMsg({ text: err.message || 'Failed to request recovery', type: 'error' });
    } finally {
      setIsRecovering(false);
    }
  };

  const handleExecuteReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setRecoveryMsg(null);
    setIsRecovering(true);
    try {
      const res = await apiResetPassword(recoveryEmail, recoveryToken, recoveryNewPassword);
      setRecoveryMsg({ text: res.message, type: 'success' });
      setTimeout(() => {
        setShowRecoveryModal(false);
        setRecoveryStep(1);
        setRecoveryToken('');
        setRecoveryNewPassword('');
        setRecoveryMsg(null);
      }, 2500);
    } catch (err: any) {
      setRecoveryMsg({ text: err.message || 'Failed to reset password', type: 'error' });
    } finally {
      setIsRecovering(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setIsSubmitting(true);

    const finalEmail = email.trim();
    const finalPassword = password;
    const finalName = fullName.trim() || ROLE_PRESETS[selectedRole]?.name || 'Municipal User';

    if (!finalEmail || !finalPassword) {
      setErrorMsg('Please enter both email and password.');
      setIsSubmitting(false);
      return;
    }

    try {
      if (isSignUp) {
        if (!finalName) {
          setErrorMsg('Full name is required to create a citizen account.');
          setIsSubmitting(false);
          return;
        }
        const user = await signup(finalName, finalEmail, finalPassword, 'citizen');
        if (onLoginSuccess) onLoginSuccess(user.role);
      } else {
        const user = await loginUser(finalName, finalEmail, selectedRole, finalPassword);
        if (onLoginSuccess) onLoginSuccess(user.role);
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Incorrect email or password. Please verify credentials.');
    } finally {
      setIsSubmitting(false);
    }
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
                {isSignUp
                  ? 'Create a citizen account to report and track municipal issues.'
                  : 'Select your operational role and enter your details to launch your command center.'}
              </p>
            </div>

            {/* Permanent Operational Role Support Selector Tabs */}
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

              {/* Password Field */}
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#F8FAFC', marginBottom: 6 }}>
                  Password <span style={{ color: '#00D4FF' }}>*</span>
                </label>
                <div style={{ position: 'relative' }}>
                  <Lock size={16} color="#00D4FF" style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)' }} />
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
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
                {!isSignUp && (
                  <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 4 }}>
                    <button
                      type="button"
                      onClick={() => {
                        setRecoveryEmail(email);
                        setRecoveryMsg(null);
                        setRecoveryStep(1);
                        setShowRecoveryModal(true);
                      }}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: '#00D4FF',
                        fontSize: 11,
                        fontWeight: 600,
                        cursor: 'pointer',
                        padding: 0,
                      }}
                    >
                      Forgot Password?
                    </button>
                  </div>
                )}
              </div>

              {/* Error Message Display */}
              {errorMsg && (
                <div style={{
                  padding: '10px 14px',
                  borderRadius: 10,
                  background: 'rgba(239, 68, 68, 0.15)',
                  border: '1px solid rgba(239, 68, 68, 0.4)',
                  color: '#FCA5A5',
                  fontSize: 12,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                }}>
                  <AlertCircle size={16} color="#EF4444" style={{ flexShrink: 0 }} />
                  <span>{errorMsg}</span>
                </div>
              )}

              {/* Submit Button */}
              <button
                type="submit"
                disabled={isSubmitting}
                style={{
                  marginTop: 6,
                  width: '100%',
                  padding: '13px',
                  borderRadius: 12,
                  border: 'none',
                  background: isSubmitting ? 'rgba(0, 212, 255, 0.4)' : 'linear-gradient(135deg, #00D4FF 0%, #8B5CF6 100%)',
                  color: '#000',
                  fontWeight: 800,
                  fontSize: 14,
                  cursor: isSubmitting ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                  boxShadow: '0 0 20px rgba(0, 212, 255, 0.3)',
                  transition: 'all 0.2s ease',
                  opacity: isSubmitting ? 0.7 : 1,
                }}
              >
                <span>{isSubmitting ? 'Verifying Credentials...' : (isSignUp ? 'Register Citizen Account' : 'Enter Command Center')}</span>
                <ArrowRight size={18} />
              </button>

              {/* Citizen Registration / Sign-in Toggle */}
              <div style={{ marginTop: 10, textAlign: 'center' }}>
                <button
                  type="button"
                  onClick={() => {
                    setIsSignUp(!isSignUp);
                    setErrorMsg(null);
                    if (!isSignUp) {
                      setSelectedRole('citizen');
                      setFullName('');
                      setEmail('');
                      setPassword('');
                    } else {
                      handleRoleSelect('commissioner');
                    }
                  }}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: '#00D4FF',
                    fontSize: 12,
                    cursor: 'pointer',
                    textDecoration: 'underline',
                    padding: 4,
                  }}
                >
                  {isSignUp ? 'Already registered? Sign in with role selector' : 'New citizen? Create an account'}
                </button>
              </div>
            </form>
          </div>

          {/* Quick Role Switch Presets */}
          <div style={{ marginTop: 24, paddingTop: 16, borderTop: '1px solid rgba(255,255,255,0.08)' }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 10 }}>
              Quick Role Switch Presets
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8 }}>
              {ROLES.map((r) => (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => {
                    if (isSignUp) setIsSignUp(false);
                    handleRoleSelect(r.id);
                  }}
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

      {/* ── Password Recovery Modal ── */}
      <AnimatePresence>
        {showRecoveryModal && (
          <div
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 9999,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'rgba(0, 0, 0, 0.75)',
              backdropFilter: 'blur(12px)',
              padding: 20,
            }}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              style={{
                width: '100%',
                maxWidth: 440,
                background: 'linear-gradient(135deg, rgba(8, 27, 51, 0.95), rgba(15, 23, 42, 0.98))',
                border: '1px solid rgba(0, 212, 255, 0.3)',
                borderRadius: 24,
                padding: '28px 24px',
                boxShadow: '0 20px 60px rgba(0, 0, 0, 0.6), 0 0 30px rgba(0, 212, 255, 0.15)',
                position: 'relative',
              }}
            >
              {/* Close Button */}
              <button
                type="button"
                onClick={() => setShowRecoveryModal(false)}
                style={{
                  position: 'absolute',
                  top: 18,
                  right: 18,
                  background: 'rgba(255, 255, 255, 0.05)',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  borderRadius: 10,
                  width: 32,
                  height: 32,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#94A3B8',
                  cursor: 'pointer',
                }}
              >
                <X size={16} />
              </button>

              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
                <div style={{
                  width: 44,
                  height: 44,
                  borderRadius: 12,
                  background: 'linear-gradient(135deg, rgba(0, 212, 255, 0.2), rgba(139, 92, 246, 0.2))',
                  border: '1px solid #00D4FF',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#00D4FF',
                }}>
                  <KeyRound size={22} />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: '#F8FAFC', fontFamily: 'var(--font-heading)' }}>
                    {recoveryStep === 1 ? 'Recover Password' : 'Set New Password'}
                  </h3>
                  <p style={{ margin: '2px 0 0', fontSize: 12, color: '#94A3B8' }}>
                    {recoveryStep === 1 ? 'Enter your registered email address' : 'Enter the recovery token and new password'}
                  </p>
                </div>
              </div>

              {recoveryMsg && (
                <div style={{
                  padding: '10px 14px',
                  borderRadius: 10,
                  background: recoveryMsg.type === 'success' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                  border: recoveryMsg.type === 'success' ? '1px solid rgba(16, 185, 129, 0.4)' : '1px solid rgba(239, 68, 68, 0.4)',
                  color: recoveryMsg.type === 'success' ? '#6EE7B7' : '#FCA5A5',
                  fontSize: 12,
                  marginBottom: 16,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                }}>
                  {recoveryMsg.type === 'success' ? <Check size={16} /> : <AlertCircle size={16} />}
                  <span>{recoveryMsg.text}</span>
                </div>
              )}

              {recoveryStep === 1 ? (
                <form onSubmit={handleRequestRecovery} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  <div>
                    <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#F8FAFC', marginBottom: 6 }}>
                      Email Address
                    </label>
                    <input
                      type="email"
                      value={recoveryEmail}
                      onChange={(e) => setRecoveryEmail(e.target.value)}
                      placeholder="user@civicsense.ai"
                      required
                      style={{
                        width: '100%',
                        padding: '11px 14px',
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
                  <button
                    type="submit"
                    disabled={isRecovering}
                    style={{
                      padding: '12px',
                      borderRadius: 12,
                      background: 'linear-gradient(135deg, #00D4FF, #0EA5E9)',
                      border: 'none',
                      color: '#000',
                      fontWeight: 800,
                      fontSize: 13,
                      cursor: isRecovering ? 'not-allowed' : 'pointer',
                      marginTop: 4,
                    }}
                  >
                    {isRecovering ? 'Dispatching Token...' : 'Send Recovery Token'}
                  </button>
                </form>
              ) : (
                <form onSubmit={handleExecuteReset} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  <div>
                    <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#F8FAFC', marginBottom: 6 }}>
                      Reset Token
                    </label>
                    <input
                      type="text"
                      value={recoveryToken}
                      onChange={(e) => setRecoveryToken(e.target.value)}
                      placeholder="Paste recovery token"
                      required
                      style={{
                        width: '100%',
                        padding: '11px 14px',
                        background: 'rgba(0, 0, 0, 0.4)',
                        border: '1px solid rgba(0, 212, 255, 0.25)',
                        borderRadius: 12,
                        color: '#F8FAFC',
                        fontSize: 12,
                        fontFamily: 'var(--font-mono)',
                        outline: 'none',
                        boxSizing: 'border-box',
                      }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#F8FAFC', marginBottom: 6 }}>
                      New Password (min. 8 characters)
                    </label>
                    <input
                      type="password"
                      value={recoveryNewPassword}
                      onChange={(e) => setRecoveryNewPassword(e.target.value)}
                      placeholder="••••••••"
                      required
                      minLength={8}
                      style={{
                        width: '100%',
                        padding: '11px 14px',
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
                  <button
                    type="submit"
                    disabled={isRecovering}
                    style={{
                      padding: '12px',
                      borderRadius: 12,
                      background: 'linear-gradient(135deg, #10B981, #059669)',
                      border: 'none',
                      color: '#000',
                      fontWeight: 800,
                      fontSize: 13,
                      cursor: isRecovering ? 'not-allowed' : 'pointer',
                      marginTop: 4,
                    }}
                  >
                    {isRecovering ? 'Updating Password...' : 'Confirm Password Reset'}
                  </button>
                </form>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
