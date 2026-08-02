import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Activity, Map, Cpu, DollarSign, Smartphone, BarChart3, FileText, Rocket, PlayCircle, AlertTriangle, Box, Layers, ShieldAlert, Bell, User, Settings, HelpCircle, LogOut, ChevronDown } from 'lucide-react';
import { useAuth, getAvatarInitials } from '../context/AuthContext';

interface NavbarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  onStartDemoStory: () => void;
  emergencyCount: number;
  onOpenNotifications?: () => void;
  unreadNotifCount?: number;
  onOpenLogoutModal?: () => void;
}

const ROLE_TABS: Record<string, Array<{ id: string; label: string; icon: any }>> = {
  citizen: [
    { id: 'mobile', label: 'Report Incident', icon: Smartphone },
    { id: 'my-complaints', label: 'Track & History', icon: Layers },
  ],
  engineer: [
    { id: 'dashboard', label: 'Assigned Incidents', icon: Activity },
    { id: 'gis', label: 'Field GIS Map', icon: Map },
    { id: 'my-complaints', label: 'Work Orders', icon: Layers },
  ],
  commissioner: [
    { id: 'dashboard', label: 'Command Center', icon: Activity },
    { id: 'analytics', label: 'Analytics', icon: BarChart3 },
    { id: 'gis', label: 'GIS Map', icon: Map },
    { id: '3d-twin', label: '3D Digital Twin', icon: Box },
    { id: 'war-room', label: 'Emergency Command', icon: ShieldAlert },
    { id: 'predictive', label: 'AI Copilot', icon: Cpu },
    { id: 'reports', label: 'Reports', icon: FileText },
    { id: 'budget', label: 'Smart Budget', icon: DollarSign },
  ],
  admin: [
    { id: 'dashboard', label: 'System Overview', icon: Activity },
    { id: 'users', label: 'Users & Roles', icon: User },
    { id: 'budget', label: 'Departments', icon: DollarSign },
    { id: 'predictive', label: 'AI Configuration', icon: Cpu },
    { id: 'reports', label: 'Audit Logs', icon: FileText },
  ],
};

const ALL_TABS = [
  { id: 'war-room', label: 'War Room', icon: ShieldAlert },
  { id: 'dashboard', label: 'Command', icon: Activity },
  { id: '3d-twin', label: '3D Twin', icon: Box },
  { id: 'gis', label: 'GIS Map', icon: Map },
  { id: 'predictive', label: 'Predictive', icon: Cpu },
  { id: 'budget', label: 'Budget', icon: DollarSign },
  { id: 'mobile', label: 'Reporter', icon: Smartphone },
  { id: 'my-complaints', label: 'My Complaints', icon: Layers },
  { id: 'analytics', label: 'Analytics', icon: BarChart3 },
  { id: 'reports', label: 'Reports', icon: FileText },
  { id: 'users', label: 'Users & Roles', icon: User },
  { id: 'roadmap', label: 'Roadmap', icon: Rocket },
];

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  setActiveTab,
  onStartDemoStory,
  emergencyCount,
  onOpenNotifications,
  unreadNotifCount,
  onOpenLogoutModal,
}) => {
  const { user } = useAuth();
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);

  const role = user?.role || 'commissioner';
  const visibleTabs = ROLE_TABS[role] || ALL_TABS;

  return (
    <nav style={{
      position: 'sticky',
      top: 0,
      zIndex: 50,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '0.75rem 1.5rem',
      backgroundColor: 'var(--bg-elevated)',
      backdropFilter: 'blur(12px)',
      borderBottom: '1px solid var(--border)',
    }}>
      {/* Brand Logo */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
        <div style={{
          position: 'relative',
          width: '32px',
          height: '32px',
          borderRadius: '50%',
          background: 'linear-gradient(45deg, var(--accent), var(--violet))',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: '0 0 15px var(--accent-glow)'
        }}>
          <motion.div 
            animate={{ rotate: 360 }}
            transition={{ duration: 10, repeat: Infinity, ease: "linear" }}
            style={{
              position: 'absolute',
              inset: '-2px',
              borderRadius: '50%',
              background: 'linear-gradient(90deg, transparent, var(--accent), transparent)',
            }}
          />
          <div style={{ width: '28px', height: '28px', backgroundColor: 'var(--bg-base)', borderRadius: '50%', zIndex: 1 }} />
        </div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.75rem' }}>
          <h1 style={{ margin: 0, fontFamily: 'var(--font-heading)', fontSize: '1.25rem', color: 'var(--text-primary)', fontWeight: 600 }}>
            CivicSense AI
          </h1>
          <span style={{ fontSize: '0.75rem', padding: '0.1rem 0.4rem', borderRadius: 'var(--radius-sm)', backgroundColor: 'var(--accent-subtle)', color: 'var(--accent)', border: '1px solid var(--border-accent)', fontFamily: 'var(--font-mono)' }}>
            OS v5.0
          </span>
        </div>
      </div>

      {/* Center Navigation Tabs */}
      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', backgroundColor: 'var(--bg-card)', padding: '0.25rem', borderRadius: 'var(--radius-full)', border: '1px solid var(--border)' }}>
        {visibleTabs.map((tab) => {
          const isActive = activeTab === tab.id;
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                position: 'relative',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                padding: '0.5rem 1rem',
                border: 'none',
                background: 'transparent',
                color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)',
                cursor: 'pointer',
                fontFamily: 'var(--font-body)',
                fontSize: '0.875rem',
                fontWeight: 500,
                borderRadius: 'var(--radius-full)',
                transition: 'color 0.2s',
              }}
            >
              {isActive && (
                <motion.div
                  layoutId="activeTab"
                  style={{
                    position: 'absolute',
                    inset: 0,
                    backgroundColor: 'var(--bg-hover)',
                    borderRadius: 'var(--radius-full)',
                    borderBottom: '2px solid var(--accent)',
                  }}
                  transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                />
              )}
              <Icon size={16} style={{ position: 'relative', zIndex: 1 }} />
              <span style={{ position: 'relative', zIndex: 1 }}>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Right Action Icons & User Badge */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
        
        {/* Notification Bell Button */}
        <button
          onClick={onOpenNotifications}
          style={{
            position: 'relative',
            width: 36,
            height: 36,
            borderRadius: '50%',
            background: 'rgba(255, 255, 255, 0.05)',
            border: '1px solid rgba(0, 212, 255, 0.3)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            color: '#00D4FF',
          }}
          title="Notification Center"
        >
          <Bell size={18} />
          {(unreadNotifCount || 0) > 0 && (
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              style={{
                position: 'absolute',
                top: -2,
                right: -2,
                minWidth: 16,
                height: 16,
                borderRadius: 8,
                background: '#EF4444',
                color: '#fff',
                fontSize: 9,
                fontWeight: 800,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '0 4px',
                border: '2px solid #070B14',
              }}
            >
              {unreadNotifCount}
            </motion.div>
          )}
        </button>

        {/* Emergency Badge */}
        {emergencyCount > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.4rem 0.75rem', backgroundColor: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)', borderRadius: 'var(--radius-full)', color: 'var(--critical)' }}>
            <motion.div
              animate={{ opacity: [1, 0.5, 1] }}
              transition={{ duration: 1.5, repeat: Infinity }}
            >
              <AlertTriangle size={16} />
            </motion.div>
            <span style={{ fontSize: '0.8125rem', fontWeight: 600 }}>{emergencyCount} Critical</span>
          </div>
        )}

        {/* User Session Avatar Badge & Direct Logout Button */}
        <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 8 }}>
          <button
            onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '4px 10px 4px 6px',
              background: 'rgba(255, 255, 255, 0.05)',
              border: '1px solid rgba(0, 212, 255, 0.3)',
              borderRadius: 999,
              cursor: 'pointer',
            }}
          >
            <div style={{
              position: 'relative',
              width: 28,
              height: 28,
              borderRadius: '50%',
              background: 'linear-gradient(135deg, #00D4FF, #8B5CF6)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 11,
              fontWeight: 800,
              color: '#000',
            }}>
              {user ? getAvatarInitials(user.fullName) : 'CS'}
              <div style={{
                position: 'absolute',
                bottom: 0,
                right: 0,
                width: 7,
                height: 7,
                borderRadius: '50%',
                background: '#10B981',
                border: '1.5px solid #070B14',
              }} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', textAlign: 'left', lineHeight: 1.1 }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: '#F8FAFC' }}>{user ? user.fullName : 'Authenticated User'}</span>
              <span style={{ fontSize: 9, color: '#00D4FF', fontWeight: 600, textTransform: 'uppercase' }}>{user ? user.role : 'Officer'}</span>
            </div>
            <ChevronDown size={14} color="#94A3B8" style={{ transform: isUserMenuOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
          </button>

          {/* Prominent Direct Logout Button */}
          <button
            onClick={() => onOpenLogoutModal && onOpenLogoutModal()}
            title="Sign Out of CivicSense AI"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '6px 14px',
              borderRadius: 999,
              background: 'rgba(239, 68, 68, 0.18)',
              border: '1px solid rgba(239, 68, 68, 0.4)',
              color: '#EF4444',
              fontSize: 12,
              fontWeight: 700,
              cursor: 'pointer',
              boxShadow: '0 2px 10px rgba(239, 68, 68, 0.2)',
              transition: 'transform 0.2s',
            }}
          >
            <LogOut size={14} color="#EF4444" />
            Logout
          </button>

          {/* Dropdown Menu */}
          <AnimatePresence>
            {isUserMenuOpen && (
              <motion.div
                initial={{ opacity: 0, y: 8, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 8, scale: 0.95 }}
                transition={{ duration: 0.15 }}
                style={{
                  position: 'absolute',
                  right: 90,
                  top: 44,
                  width: 240,
                  background: 'rgba(17, 24, 39, 0.95)',
                  backdropFilter: 'blur(20px)',
                  border: '1px solid rgba(0, 212, 255, 0.3)',
                  borderRadius: 16,
                  padding: 12,
                  boxShadow: '0 15px 35px rgba(0,0,0,0.6)',
                  zIndex: 99999,
                }}
              >
                <div style={{ paddingBottom: 10, borderBottom: '1px solid rgba(255,255,255,0.08)', marginBottom: 8 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                    <div style={{
                      width: 36, height: 36, borderRadius: '50%',
                      background: 'linear-gradient(135deg, #00D4FF, #8B5CF6)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 13, fontWeight: 800, color: '#000',
                    }}>
                      {user ? getAvatarInitials(user.fullName) : 'CS'}
                    </div>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: '#F8FAFC', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {user ? user.fullName : 'Authenticated User'}
                      </div>
                      <div style={{ fontSize: 11, color: '#94A3B8', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {user ? user.email : 'user@civicsense.ai'}
                      </div>
                    </div>
                  </div>
                  <span style={{
                    display: 'inline-block',
                    padding: '2px 8px',
                    borderRadius: 6,
                    background: 'rgba(0, 212, 255, 0.15)',
                    border: '1px solid rgba(0, 212, 255, 0.3)',
                    color: '#00D4FF',
                    fontSize: 10,
                    fontWeight: 800,
                    textTransform: 'uppercase',
                  }}>
                    Role: {user ? user.role : 'Officer'}
                  </span>
                </div>

                <button
                  onClick={() => setIsUserMenuOpen(false)}
                  style={{
                    width: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    padding: '8px 10px',
                    borderRadius: 8,
                    background: 'none',
                    border: 'none',
                    color: '#F8FAFC',
                    fontSize: 12,
                    fontWeight: 500,
                    cursor: 'pointer',
                  }}
                >
                  <User size={14} color="#00D4FF" />
                  My Profile
                </button>

                <button
                  onClick={() => setIsUserMenuOpen(false)}
                  style={{
                    width: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    padding: '8px 10px',
                    borderRadius: 8,
                    background: 'none',
                    border: 'none',
                    color: '#F8FAFC',
                    fontSize: 12,
                    fontWeight: 500,
                    cursor: 'pointer',
                  }}
                >
                  <Settings size={14} color="#8B5CF6" />
                  Settings
                </button>

                <button
                  onClick={() => setIsUserMenuOpen(false)}
                  style={{
                    width: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    padding: '8px 10px',
                    borderRadius: 8,
                    background: 'none',
                    border: 'none',
                    color: '#F8FAFC',
                    fontSize: 12,
                    fontWeight: 500,
                    cursor: 'pointer',
                  }}
                >
                  <HelpCircle size={14} color="#3B82F6" />
                  Help & Support
                </button>

                <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', margin: '4px 0' }} />

                <button
                  onClick={() => {
                    setIsUserMenuOpen(false);
                    if (onOpenLogoutModal) onOpenLogoutModal();
                  }}
                  style={{
                    width: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    padding: '8px 10px',
                    borderRadius: 8,
                    background: 'rgba(239, 68, 68, 0.1)',
                    border: '1px solid rgba(239, 68, 68, 0.2)',
                    color: '#EF4444',
                    fontSize: 12,
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  <LogOut size={14} color="#EF4444" />
                  Logout
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Demo Button */}
        <button 
          onClick={onStartDemoStory}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            padding: '0.4rem 0.85rem',
            background: 'linear-gradient(45deg, var(--accent), var(--violet))',
            border: 'none',
            borderRadius: 'var(--radius-full)',
            color: '#fff',
            fontFamily: 'var(--font-body)',
            fontWeight: 600,
            fontSize: '0.8125rem',
            cursor: 'pointer',
            boxShadow: '0 4px 15px var(--violet-glow)'
          }}
        >
          <PlayCircle size={16} />
          Start Demo
        </button>
      </div>
    </nav>
  );
};
