import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Mail, 
  ShieldCheck, 
  Sparkles, 
  ArrowRight, 
  User, 
  Lock, 
  AlertCircle, 
  KeyRound, 
  X, 
  Check, 
  Eye, 
  EyeOff, 
  Loader2, 
  CheckCircle2
} from 'lucide-react';
import { useAuth, type UserRole } from '../context/AuthContext';
import { apiForgotPassword, apiResetPassword } from '../services/apiClient';

interface LoginPageProps {
  onLoginSuccess?: (role: UserRole) => void;
}

const isStrictProduction = typeof window !== 'undefined' && window.location.hostname === 'civicsenseai-theta.vercel.app';

const ROLES: { id: UserRole; label: string; icon: string; desc: string; badge: string }[] = [
  { id: 'commissioner', label: 'Commissioner', icon: '🏛️', desc: 'Executive Command & War Room', badge: 'Leadership' },
  { id: 'engineer',     label: 'Field Engineer', icon: '👨‍🔧', desc: 'Incident Operations & Work Orders', badge: 'Ops' },
  { id: 'citizen',      label: 'Citizen', icon: '📱', desc: 'Mobile Reporter & Tracking', badge: 'Public' },
  { id: 'admin',        label: 'Administrator', icon: '⚡', desc: 'Ward Analytics & System Control', badge: 'Root' },
];

const ROLE_THEMES: Record<UserRole, { primary: string; secondary: string; glow: string; border: string }> = {
  commissioner: { primary: '#8B5CF6', secondary: '#C084FC', glow: 'rgba(139, 92, 246, 0.4)', border: 'rgba(139, 92, 246, 0.3)' },
  engineer:     { primary: '#F59E0B', secondary: '#FBBF24', glow: 'rgba(245, 158, 11, 0.4)', border: 'rgba(245, 158, 11, 0.3)' },
  citizen:      { primary: '#10B981', secondary: '#34D399', glow: 'rgba(16, 185, 129, 0.4)', border: 'rgba(16, 185, 129, 0.3)' },
  admin:        { primary: '#00D4FF', secondary: '#38BDF8', glow: 'rgba(0, 212, 255, 0.4)', border: 'rgba(0, 212, 255, 0.3)' },
};

const ROLE_PRESETS: Record<UserRole, { name: string; email: string; defaultPassword?: string }> = {
  commissioner: { name: 'Dr. Anita Roy', email: 'commissioner@civicsense.ai', defaultPassword: 'password123' },
  engineer:     { name: 'Eng. Rajesh V', email: 'engineer@civicsense.ai', defaultPassword: 'password123' },
  citizen:      { name: 'Priya Sharma', email: 'citizen@civicsense.ai', defaultPassword: 'password123' },
  admin:        { name: 'System Administrator', email: 'admin@civicsense.ai', defaultPassword: 'password123' },
};

export const LoginPage: React.FC<LoginPageProps> = ({ onLoginSuccess }) => {
  const { signup, loginUser } = useAuth();

  const [selectedRole, setSelectedRole] = useState<UserRole>('admin');
  const [fullName, setFullName] = useState('System Administrator');
  const [email, setEmail] = useState('admin@civicsense.ai');
  const [password, setPassword] = useState(isStrictProduction ? '' : 'password123');
  const [showPassword, setShowPassword] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submittingSeconds, setSubmittingSeconds] = useState(0);
  const [isSignUp, setIsSignUp] = useState(false);
  const [focusedField, setFocusedField] = useState<string | null>(null);

  // Live System Clock for Mission Control Aesthetic
  const [clockTime, setClockTime] = useState('');
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setClockTime(now.toLocaleTimeString('en-US', { hour12: false }) + ' UTC');
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  // Timer for Cloud Server Warmup Feedback
  useEffect(() => {
    let timer: any;
    if (isSubmitting) {
      setSubmittingSeconds(0);
      timer = setInterval(() => {
        setSubmittingSeconds((s) => s + 1);
      }, 1000);
    } else {
      setSubmittingSeconds(0);
    }
    return () => clearInterval(timer);
  }, [isSubmitting]);

  // Password Recovery State
  const [showRecoveryModal, setShowRecoveryModal] = useState(false);
  const [recoveryEmail, setRecoveryEmail] = useState('');
  const [recoveryToken, setRecoveryToken] = useState('');
  const [recoveryNewPassword, setRecoveryNewPassword] = useState('');
  const [recoveryStep, setRecoveryStep] = useState<1 | 2>(1);
  const [recoveryMsg, setRecoveryMsg] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  const [isRecovering, setIsRecovering] = useState(false);

  const currentTheme = ROLE_THEMES[selectedRole];

  const handleRoleSelect = (role: UserRole) => {
    setSelectedRole(role);
    setErrorMsg(null);
    if (isSignUp) setIsSignUp(false);
    const preset = ROLE_PRESETS[role];
    if (preset) {
      setFullName(preset.name);
      setEmail(preset.email);
      setPassword(isStrictProduction ? '' : (preset.defaultPassword || 'password123'));
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
      background: '#050811',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      position: 'relative',
      fontFamily: 'var(--font-body)',
    }}>
      {/* Dynamic Background Ambient Glow (Reflects Active Role) */}
      <motion.div
        animate={{
          background: `radial-gradient(circle at 20% 20%, ${currentTheme.glow} 0%, transparent 60%)`,
        }}
        transition={{ duration: 0.8 }}
        style={{
          position: 'absolute',
          inset: 0,
          pointerEvents: 'none',
          opacity: 0.7,
        }}
      />
      <div style={{
        position: 'absolute',
        bottom: '-15%',
        right: '-10%',
        width: '50vw',
        height: '50vw',
        borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(14, 165, 233, 0.1) 0%, transparent 70%)',
        pointerEvents: 'none',
      }} />

      {/* Cyber Grid Background Mesh */}
      <div style={{
        position: 'absolute',
        inset: 0,
        backgroundImage: 'linear-gradient(rgba(255, 255, 255, 0.02) 1px, transparent 1px), linear-gradient(90deg, rgba(255, 255, 255, 0.02) 1px, transparent 1px)',
        backgroundSize: '48px 48px',
        opacity: 0.6,
        pointerEvents: 'none',
      }} />

      {/* Main Dual-Panel Glass Container */}
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        style={{
          width: '92%',
          maxWidth: 1160,
          height: '86vh',
          maxHeight: 780,
          background: 'rgba(11, 18, 33, 0.78)',
          backdropFilter: 'blur(36px)',
          WebkitBackdropFilter: 'blur(36px)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          borderRadius: 28,
          boxShadow: '0 32px 100px rgba(0, 0, 0, 0.7), inset 0 1px 0 rgba(255, 255, 255, 0.12)',
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          overflow: 'hidden',
          zIndex: 10,
        }}
      >
        {/* ═══════════════════════════════════════════
            LEFT SIDE: Cyber Brand Mission Control
        ═══════════════════════════════════════════ */}
        <div style={{
          padding: '48px',
          background: 'linear-gradient(145deg, rgba(15, 23, 42, 0.8), rgba(7, 11, 20, 0.95))',
          borderRight: '1px solid rgba(255, 255, 255, 0.08)',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          position: 'relative',
        }}>
          {/* Top Live Telemetry Bar */}
          <div style={{ zIndex: 2 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
              <div style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                padding: '4px 12px',
                borderRadius: 999,
                background: 'rgba(16, 185, 129, 0.1)',
                border: '1px solid rgba(16, 185, 129, 0.3)',
                color: '#34D399',
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: '0.04em',
              }}>
                <span style={{
                  width: 7,
                  height: 7,
                  borderRadius: '50%',
                  background: '#10B981',
                  boxShadow: '0 0 10px #10B981',
                  animation: 'pulse 2s infinite',
                }} />
                METRO WAR ROOM ONLINE
              </div>
              <div style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 11,
                color: '#64748B',
                background: 'rgba(0, 0, 0, 0.3)',
                padding: '4px 10px',
                borderRadius: 8,
                border: '1px solid rgba(255, 255, 255, 0.05)',
              }}>
                {clockTime}
              </div>
            </div>

            {/* Brand Logo & Title Header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <div style={{
                width: 46,
                height: 46,
                borderRadius: 14,
                background: `linear-gradient(135deg, ${currentTheme.primary}, #38BDF8)`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: `0 0 24px ${currentTheme.glow}`,
                transition: 'all 0.4s ease',
              }}>
                <Sparkles size={24} color="#000" />
              </div>
              <div>
                <h1 style={{
                  fontFamily: 'var(--font-heading)',
                  fontSize: 26,
                  fontWeight: 900,
                  color: '#F8FAFC',
                  margin: 0,
                  letterSpacing: '-0.02em',
                }}>
                  CivicSense <span style={{ color: currentTheme.primary, transition: 'color 0.4s ease' }}>AI</span>
                </h1>
                <div style={{ fontSize: 11, color: '#94A3B8', fontFamily: 'var(--font-mono)', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span>OS v5.0</span>
                  <span>·</span>
                  <span>Smart City Command System</span>
                </div>
              </div>
            </div>
          </div>

          {/* Center Graphic & Tagline */}
          <div style={{ zIndex: 2, margin: '24px 0' }}>
            <motion.div
              key={selectedRole}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35 }}
            >
              <div style={{
                fontSize: 27,
                fontWeight: 800,
                fontFamily: 'var(--font-heading)',
                color: '#F8FAFC',
                lineHeight: 1.32,
                marginBottom: 14,
              }}>
                "Transforming Citizen Reports into <br />
                <span style={{
                  background: `linear-gradient(135deg, ${currentTheme.primary} 0%, #38BDF8 100%)`,
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  transition: 'all 0.4s ease',
                }}>
                  Intelligent City Actions.
                </span>"
              </div>
              <p style={{ fontSize: 13, color: '#94A3B8', lineHeight: 1.6, maxWidth: 440, margin: 0 }}>
                {ROLE_PRESETS[selectedRole]?.name} · {ROLE_PRESETS[selectedRole]?.email}
              </p>
            </motion.div>

            {/* Smart Feature Chips */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 24 }}>
              {[
                { title: 'Gemini 2.5 Flash Vision', desc: 'Instant defect detection' },
                { title: 'WhatsApp Closed-Loop', desc: 'Direct citizen updates' },
                { title: 'Dynamic GIS Dispatch', desc: 'Autonomous route triage' },
                { title: 'XAI Explainability Core', desc: 'Audited repair budget' },
              ].map((feat, idx) => (
                <div
                  key={idx}
                  style={{
                    padding: '10px 14px',
                    borderRadius: 12,
                    background: 'rgba(255, 255, 255, 0.03)',
                    border: '1px solid rgba(255, 255, 255, 0.06)',
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: 8,
                  }}
                >
                  <CheckCircle2 size={15} color={currentTheme.primary} style={{ marginTop: 2, flexShrink: 0, transition: 'color 0.4s ease' }} />
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 700, color: '#F8FAFC' }}>{feat.title}</div>
                    <div style={{ fontSize: 10, color: '#64748B' }}>{feat.desc}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Footer Security Badge */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingTop: 16,
            borderTop: '1px solid rgba(255, 255, 255, 0.06)',
            color: '#64748B',
            fontSize: 11,
            zIndex: 2,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <ShieldCheck size={15} color="#10B981" />
              <span>256-bit AES · End-to-End Encrypted</span>
            </div>
            <span style={{ fontFamily: 'var(--font-mono)' }}>ISO 27001</span>
          </div>
        </div>

        {/* ═══════════════════════════════════════════
            RIGHT SIDE: Silky-Smooth Entry Form Card
        ═══════════════════════════════════════════ */}
        <div style={{
          padding: '44px 46px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          overflowY: 'auto',
          background: 'rgba(11, 18, 33, 0.65)',
        }}>
          <div>
            {/* Header */}
            <div style={{ marginBottom: 18 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <h2 style={{
                  fontFamily: 'var(--font-heading)',
                  fontSize: 22,
                  fontWeight: 800,
                  color: '#F8FAFC',
                  margin: '0 0 4px 0',
                }}>
                  Smart City Entry Portal
                </h2>
                <span style={{
                  fontSize: 10,
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  padding: '3px 8px',
                  borderRadius: 6,
                  background: `${currentTheme.primary}20`,
                  color: currentTheme.primary,
                  border: `1px solid ${currentTheme.primary}40`,
                  transition: 'all 0.3s ease',
                }}>
                  {ROLES.find(r => r.id === selectedRole)?.badge} Access
                </span>
              </div>
              <p style={{ fontSize: 12, color: '#94A3B8', margin: 0 }}>
                {isSignUp
                  ? 'Create a citizen account to report and track municipal issues.'
                  : 'Select your operational role or click any profile tab to launch.'}
              </p>
            </div>

            {/* Silky-Smooth Animated Role Tabs */}
            <div style={{ marginBottom: 18 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>
                Select Operational Role
              </div>
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(4, 1fr)',
                gap: 6,
                background: 'rgba(0, 0, 0, 0.45)',
                padding: 4,
                borderRadius: 14,
                border: '1px solid rgba(255, 255, 255, 0.08)',
                position: 'relative',
              }}>
                {ROLES.map((r) => {
                  const isSelected = selectedRole === r.id;
                  const theme = ROLE_THEMES[r.id];
                  return (
                    <button
                      key={r.id}
                      type="button"
                      onClick={() => handleRoleSelect(r.id)}
                      style={{
                        padding: '9px 6px',
                        borderRadius: 11,
                        background: 'transparent',
                        border: 'none',
                        color: isSelected ? '#F8FAFC' : '#94A3B8',
                        cursor: 'pointer',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: 3,
                        position: 'relative',
                        zIndex: 1,
                        transition: 'color 0.2s',
                        outline: 'none',
                      }}
                    >
                      {isSelected && (
                        <motion.div
                          layoutId="activeRoleHighlight"
                          transition={{ type: 'spring', stiffness: 450, damping: 35 }}
                          style={{
                            position: 'absolute',
                            inset: 0,
                            borderRadius: 11,
                            background: `linear-gradient(135deg, ${theme.primary}25, ${theme.secondary}12)`,
                            border: `1.5px solid ${theme.primary}`,
                            boxShadow: `0 0 16px ${theme.glow}`,
                            zIndex: -1,
                          }}
                        />
                      )}
                      <span style={{ fontSize: 16 }}>{r.icon}</span>
                      <span style={{ fontSize: 10, fontWeight: isSelected ? 800 : 600 }}>{r.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Login Form with Smooth Validation & Input Focus States */}
            <motion.form 
              onSubmit={handleSubmit} 
              animate={{ x: errorMsg ? [-6, 6, -4, 4, -2, 2, 0] : 0 }}
              transition={{ duration: 0.4 }}
              style={{ display: 'flex', flexDirection: 'column', gap: 14 }}
            >
              {/* Full Name Field */}
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#F8FAFC', marginBottom: 6 }}>
                  Full Name <span style={{ color: currentTheme.primary }}>*</span>
                </label>
                <div style={{ position: 'relative' }}>
                  <User 
                    size={16} 
                    color={focusedField === 'name' ? currentTheme.primary : '#64748B'} 
                    style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', transition: 'color 0.2s' }} 
                  />
                  <input
                    type="text"
                    value={fullName}
                    onFocus={() => setFocusedField('name')}
                    onBlur={() => setFocusedField(null)}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="e.g. System Administrator"
                    required
                    style={{
                      width: '100%',
                      padding: '11px 14px 11px 40px',
                      background: 'rgba(0, 0, 0, 0.35)',
                      border: focusedField === 'name' ? `1px solid ${currentTheme.primary}` : '1px solid rgba(255, 255, 255, 0.1)',
                      boxShadow: focusedField === 'name' ? `0 0 14px ${currentTheme.glow}` : 'none',
                      borderRadius: 12,
                      color: '#F8FAFC',
                      fontSize: 13,
                      outline: 'none',
                      boxSizing: 'border-box',
                      transition: 'border 0.2s, box-shadow 0.2s',
                    }}
                  />
                </div>
              </div>

              {/* Email Field */}
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#F8FAFC', marginBottom: 6 }}>
                  Email Address <span style={{ color: currentTheme.primary }}>*</span>
                </label>
                <div style={{ position: 'relative' }}>
                  <Mail 
                    size={16} 
                    color={focusedField === 'email' ? currentTheme.primary : '#64748B'} 
                    style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', transition: 'color 0.2s' }} 
                  />
                  <input
                    type="email"
                    value={email}
                    onFocus={() => setFocusedField('email')}
                    onBlur={() => setFocusedField(null)}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="name@civicsense.ai"
                    required
                    style={{
                      width: '100%',
                      padding: '11px 14px 11px 40px',
                      background: 'rgba(0, 0, 0, 0.35)',
                      border: focusedField === 'email' ? `1px solid ${currentTheme.primary}` : '1px solid rgba(255, 255, 255, 0.1)',
                      boxShadow: focusedField === 'email' ? `0 0 14px ${currentTheme.glow}` : 'none',
                      borderRadius: 12,
                      color: '#F8FAFC',
                      fontSize: 13,
                      outline: 'none',
                      boxSizing: 'border-box',
                      transition: 'border 0.2s, box-shadow 0.2s',
                    }}
                  />
                </div>
              </div>

              {/* Password Field with Show/Hide Toggle */}
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#F8FAFC', marginBottom: 6 }}>
                  Password <span style={{ color: currentTheme.primary }}>*</span>
                </label>
                <div style={{ position: 'relative' }}>
                  <Lock 
                    size={16} 
                    color={focusedField === 'password' ? currentTheme.primary : '#64748B'} 
                    style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', transition: 'color 0.2s' }} 
                  />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onFocus={() => setFocusedField('password')}
                    onBlur={() => setFocusedField(null)}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••••••"
                    required
                    style={{
                      width: '100%',
                      padding: '11px 42px 11px 40px',
                      background: 'rgba(0, 0, 0, 0.35)',
                      border: focusedField === 'password' ? `1px solid ${currentTheme.primary}` : '1px solid rgba(255, 255, 255, 0.1)',
                      boxShadow: focusedField === 'password' ? `0 0 14px ${currentTheme.glow}` : 'none',
                      borderRadius: 12,
                      color: '#F8FAFC',
                      fontSize: 13,
                      outline: 'none',
                      boxSizing: 'border-box',
                      transition: 'border 0.2s, box-shadow 0.2s',
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    style={{
                      position: 'absolute',
                      right: 12,
                      top: '50%',
                      transform: 'translateY(-50%)',
                      background: 'none',
                      border: 'none',
                      color: '#64748B',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      padding: 4,
                    }}
                    title={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>

                {/* Demo Password Auto-Fill Chip & Forgot Password */}
                {!isSignUp && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 6 }}>
                    {!isStrictProduction ? (
                      <span style={{ fontSize: 11, color: '#94A3B8' }}>
                        Preset Password:{' '}
                        <button
                          type="button"
                          onClick={() => setPassword('password123')}
                          style={{
                            background: `${currentTheme.primary}18`,
                            border: `1px solid ${currentTheme.primary}40`,
                            color: currentTheme.primary,
                            fontWeight: 700,
                            padding: '2px 7px',
                            borderRadius: 6,
                            cursor: 'pointer',
                            fontSize: 11,
                            fontFamily: 'var(--font-mono)',
                            transition: 'all 0.2s',
                          }}
                        >
                          password123
                        </button>
                      </span>
                    ) : <span />}
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
                        color: currentTheme.primary,
                        fontSize: 11,
                        fontWeight: 600,
                        cursor: 'pointer',
                        padding: 0,
                        transition: 'color 0.2s',
                      }}
                    >
                      Forgot Password?
                    </button>
                  </div>
                )}
              </div>

              {/* Error Message Display */}
              <AnimatePresence>
                {errorMsg && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    style={{
                      padding: '10px 14px',
                      borderRadius: 10,
                      background: 'rgba(239, 68, 68, 0.15)',
                      border: '1px solid rgba(239, 68, 68, 0.4)',
                      color: '#FCA5A5',
                      fontSize: 12,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      overflow: 'hidden',
                    }}
                  >
                    <AlertCircle size={16} color="#EF4444" style={{ flexShrink: 0 }} />
                    <span style={{ flex: 1 }}>{errorMsg}</span>
                    <button
                      type="button"
                      onClick={() => setErrorMsg(null)}
                      style={{ background: 'none', border: 'none', color: '#FCA5A5', cursor: 'pointer', padding: 0 }}
                    >
                      <X size={14} />
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Submit Button with Ultra-Smooth State Feedback */}
              <motion.button
                type="submit"
                disabled={isSubmitting}
                whileHover={!isSubmitting ? { scale: 1.01 } : {}}
                whileTap={!isSubmitting ? { scale: 0.99 } : {}}
                style={{
                  marginTop: 6,
                  width: '100%',
                  padding: '13px',
                  borderRadius: 14,
                  border: 'none',
                  background: isSubmitting 
                    ? `linear-gradient(135deg, ${currentTheme.primary}70 0%, #38BDF870 100%)` 
                    : `linear-gradient(135deg, ${currentTheme.primary} 0%, #38BDF8 100%)`,
                  color: '#000',
                  fontWeight: 800,
                  fontSize: 14,
                  cursor: isSubmitting ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 10,
                  boxShadow: `0 8px 24px ${currentTheme.glow}`,
                  transition: 'background 0.3s, box-shadow 0.3s, opacity 0.2s',
                  position: 'relative',
                  overflow: 'hidden',
                }}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 size={18} className="animate-spin" color="#000" />
                    <span>
                      {submittingSeconds >= 3 
                        ? 'Waking Cloud Server & Database...' 
                        : 'Authenticating Credentials...'}
                    </span>
                  </>
                ) : (
                  <>
                    <span>{isSignUp ? 'Register Citizen Account' : 'Enter Command Center'}</span>
                    <ArrowRight size={18} color="#000" />
                  </>
                )}
              </motion.button>

              {/* Citizen Registration / Sign-in Toggle */}
              <div style={{ marginTop: 6, textAlign: 'center' }}>
                <button
                  type="button"
                  onClick={() => {
                    setIsSignUp(!isSignUp);
                    setErrorMsg(null);
                    if (!isSignUp) {
                      setSelectedRole('citizen');
                      setFullName('Priya Sharma');
                      setEmail('citizen@civicsense.ai');
                    }
                  }}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#94A3B8',
                    fontSize: 12,
                    cursor: 'pointer',
                    transition: 'color 0.2s',
                  }}
                >
                  {isSignUp ? (
                    <>Existing municipal account? <span style={{ color: currentTheme.primary, fontWeight: 700 }}>Log In</span></>
                  ) : (
                    <>New citizen reporter? <span style={{ color: currentTheme.primary, fontWeight: 700 }}>Create an account</span></>
                  )}
                </button>
              </div>
            </motion.form>
          </div>

          {/* Bottom Quick-Switch Bar */}
          <div style={{
            marginTop: 20,
            paddingTop: 16,
            borderTop: '1px solid rgba(255, 255, 255, 0.06)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}>
            <div style={{ fontSize: 11, color: '#64748B' }}>
              Switch Operational Profile:
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              {ROLES.map((r) => (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => handleRoleSelect(r.id)}
                  style={{
                    padding: '5px 10px',
                    borderRadius: 8,
                    background: selectedRole === r.id ? `${ROLE_THEMES[r.id].primary}20` : 'rgba(255, 255, 255, 0.03)',
                    border: selectedRole === r.id ? `1px solid ${ROLE_THEMES[r.id].primary}` : '1px solid rgba(255, 255, 255, 0.06)',
                    color: selectedRole === r.id ? '#F8FAFC' : '#94A3B8',
                    fontSize: 11,
                    fontWeight: 600,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4,
                    transition: 'all 0.2s',
                  }}
                >
                  <span>{r.icon}</span>
                  <span>{r.label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </motion.div>

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
              background: 'rgba(0, 0, 0, 0.8)',
              backdropFilter: 'blur(16px)',
              padding: 20,
            }}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.94, y: 14 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.94, y: 14 }}
              transition={{ duration: 0.3 }}
              style={{
                width: '100%',
                maxWidth: 440,
                background: 'linear-gradient(135deg, rgba(8, 27, 51, 0.98), rgba(15, 23, 42, 0.99))',
                border: '1px solid rgba(0, 212, 255, 0.3)',
                borderRadius: 24,
                padding: '28px 24px',
                boxShadow: '0 24px 70px rgba(0, 0, 0, 0.7), 0 0 30px rgba(0, 212, 255, 0.15)',
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
