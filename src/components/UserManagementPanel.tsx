import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Users, Shield, Activity, Plus, Search,
  RefreshCw, CheckCircle2, XCircle, AlertCircle,
  Server, Database, Cpu, Check, X, ShieldAlert,
  Edit2, UserCheck, Smartphone
} from 'lucide-react';
import {
  apiFetchAdminUsers,
  apiCreateStaffUser,
  apiUpdateUserStatus,
  apiUpdateUserRole,
  apiFetchPlatformAuditLogs,
  apiFetchSystemTelemetry
} from '../services/apiClient';

export const UserManagementPanel: React.FC = () => {
  const queryClient = useQueryClient();
  const [activeSubTab, setActiveSubTab] = useState<'users' | 'audit' | 'telemetry'>('users');

  // Filter & Search state for Users tab
  const [selectedRoleFilter, setSelectedRoleFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Modals state
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editingRoleUser, setEditingRoleUser] = useState<any | null>(null);

  // Form state: Create Staff Account
  const [newEmail, setNewEmail] = useState('');
  const [newFullName, setNewFullName] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newRole, setNewRole] = useState<'engineer' | 'commissioner' | 'admin'>('engineer');
  const [newDepartment, setNewDepartment] = useState('Roads & Infrastructure Engineering');
  const [formError, setFormError] = useState<string | null>(null);

  // Form state: Edit Role
  const [editRoleVal, setEditRoleVal] = useState<'citizen' | 'engineer' | 'commissioner' | 'admin'>('engineer');
  const [editDeptVal, setEditDeptVal] = useState('');

  // Action toast state
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  };

  // 1. Query: Users Directory
  const {
    data: usersData,
    isLoading: isLoadingUsers,
    refetch: refetchUsers,
  } = useQuery({
    queryKey: ['admin-users', selectedRoleFilter, searchQuery],
    queryFn: () => apiFetchAdminUsers(selectedRoleFilter, searchQuery),
    enabled: activeSubTab === 'users',
    refetchInterval: 8000,
  });

  // 2. Query: Audit Logs
  const {
    data: auditLogs = [],
    isLoading: isLoadingAudit,
    refetch: refetchAudit,
  } = useQuery({
    queryKey: ['admin-audit-logs'],
    queryFn: () => apiFetchPlatformAuditLogs(100),
    enabled: activeSubTab === 'audit',
    refetchInterval: 6000,
  });

  // 3. Query: System Telemetry
  const {
    data: telemetry,
    isLoading: isLoadingTelemetry,
    refetch: refetchTelemetry,
  } = useQuery({
    queryKey: ['admin-system-telemetry'],
    queryFn: apiFetchSystemTelemetry,
    enabled: activeSubTab === 'telemetry',
    refetchInterval: 8000,
  });

  // Mutations
  const createStaffMutation = useMutation({
    mutationFn: apiCreateStaffUser,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      queryClient.invalidateQueries({ queryKey: ['admin-system-telemetry'] });
      showToast('Staff account created successfully!');
      setIsCreateModalOpen(false);
      setNewEmail('');
      setNewFullName('');
      setNewPassword('');
      setFormError(null);
    },
    onError: (err: any) => {
      setFormError(err.message || 'Failed to create staff account');
    },
  });

  const updateStatusMutation = useMutation({
    mutationFn: ({ userId, isActive }: { userId: string; isActive: boolean }) =>
      apiUpdateUserStatus(userId, isActive),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      queryClient.invalidateQueries({ queryKey: ['admin-system-telemetry'] });
      showToast(data.message || 'User status updated');
    },
    onError: (err: any) => {
      showToast(err.message || 'Failed to update user status', 'error');
    },
  });

  const updateRoleMutation = useMutation({
    mutationFn: ({ userId, role, department }: { userId: string; role: string; department?: string }) =>
      apiUpdateUserRole(userId, role, department),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      queryClient.invalidateQueries({ queryKey: ['admin-system-telemetry'] });
      showToast(data.message || 'Role updated successfully');
      setEditingRoleUser(null);
    },
    onError: (err: any) => {
      showToast(err.message || 'Failed to update user role', 'error');
    },
  });

  const handleCreateStaffSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    if (!newEmail || !newFullName || !newPassword) {
      setFormError('All fields are required.');
      return;
    }
    if (newPassword.length < 8) {
      setFormError('Password must be at least 8 characters long.');
      return;
    }
    createStaffMutation.mutate({
      email: newEmail,
      fullName: newFullName,
      password: newPassword,
      role: newRole,
      department: newDepartment,
    });
  };

  const handleSaveRole = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingRoleUser) return;
    updateRoleMutation.mutate({
      userId: editingRoleUser.id,
      role: editRoleVal,
      department: editDeptVal,
    });
  };

  const usersList = usersData?.users || [];
  const totalCount = usersData?.total ?? usersList.length;

  return (
    <div style={{ maxWidth: 1280, margin: '0 auto', padding: '24px 16px 80px', display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Toast Notification */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            style={{
              position: 'fixed',
              top: 24,
              right: 24,
              zIndex: 99999,
              background: toast.type === 'success' ? '#10B981' : '#EF4444',
              color: '#000',
              padding: '12px 20px',
              borderRadius: 12,
              fontWeight: 800,
              fontSize: 13,
              boxShadow: '0 10px 30px rgba(0,0,0,0.4)',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
            }}
          >
            {toast.type === 'success' ? <Check size={18} /> : <AlertCircle size={18} />}
            <span>{toast.message}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header Banner */}
      <div style={{
        background: 'linear-gradient(135deg, rgba(8, 27, 51, 0.75), rgba(15, 23, 42, 0.85))',
        backdropFilter: 'blur(20px)',
        border: '1px solid rgba(0, 212, 255, 0.25)',
        borderRadius: 24,
        padding: '28px 32px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: 20,
        boxShadow: '0 12px 40px rgba(0, 0, 0, 0.4)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{
            width: 56,
            height: 56,
            borderRadius: 18,
            background: 'linear-gradient(135deg, #00D4FF 0%, #8B5CF6 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 0 25px rgba(0, 212, 255, 0.35)',
            color: '#000',
          }}>
            <Shield size={28} />
          </div>
          <div>
            <h1 style={{ fontFamily: 'var(--font-heading)', fontSize: 24, fontWeight: 800, color: '#F8FAFC', margin: 0 }}>
              Administrator Control Center
            </h1>
            <p style={{ color: '#94A3B8', fontSize: 13, margin: '4px 0 0 0' }}>
              Municipal User Directory, RBAC Access Control, Audit Logs, and Operational Telemetry
            </p>
          </div>
        </div>

        {/* Sub-tab Navigation */}
        <div style={{
          display: 'flex',
          gap: 6,
          background: 'rgba(17, 24, 39, 0.75)',
          padding: 5,
          borderRadius: 14,
          border: '1px solid rgba(255, 255, 255, 0.08)',
        }}>
          {[
            { id: 'users', label: 'Users & Roles', icon: Users },
            { id: 'audit', label: 'Audit Logs', icon: Activity },
            { id: 'telemetry', label: 'System Health', icon: Server },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeSubTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveSubTab(tab.id as any)}
                style={{
                  padding: '8px 16px',
                  borderRadius: 10,
                  border: 'none',
                  background: isActive ? 'linear-gradient(135deg, #00D4FF, #0EA5E9)' : 'transparent',
                  color: isActive ? '#000' : '#94A3B8',
                  fontWeight: isActive ? 800 : 600,
                  fontSize: 12,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  transition: 'all 0.15s ease',
                }}
              >
                <Icon size={14} />
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* ═══════════════════════════════════════════
          TAB 1: USERS & ROLES DIRECTORY
      ═══════════════════════════════════════════ */}
      {activeSubTab === 'users' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* Action Toolbar */}
          <div style={{
            background: 'rgba(17, 24, 39, 0.6)',
            backdropFilter: 'blur(16px)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            borderRadius: 18,
            padding: '14px 18px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: 14,
          }}>
            {/* Role Filter Tabs */}
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {[
                { id: 'all', label: `All Users (${totalCount})` },
                { id: 'citizen', label: 'Citizens' },
                { id: 'engineer', label: 'Field Engineers' },
                { id: 'commissioner', label: 'Commissioners' },
                { id: 'admin', label: 'Administrators' },
              ].map((f) => (
                <button
                  key={f.id}
                  onClick={() => setSelectedRoleFilter(f.id)}
                  style={{
                    padding: '6px 14px',
                    borderRadius: 10,
                    background: selectedRoleFilter === f.id ? 'rgba(0, 212, 255, 0.2)' : 'rgba(255, 255, 255, 0.04)',
                    border: selectedRoleFilter === f.id ? '1px solid #00D4FF' : '1px solid rgba(255, 255, 255, 0.08)',
                    color: selectedRoleFilter === f.id ? '#00D4FF' : '#94A3B8',
                    fontWeight: selectedRoleFilter === f.id ? 700 : 500,
                    fontSize: 12,
                    cursor: 'pointer',
                  }}
                >
                  {f.label}
                </button>
              ))}
            </div>

            {/* Search & Create Actions */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <div style={{ position: 'relative' }}>
                <Search size={14} color="#64748B" style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)' }} />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search name or email..."
                  style={{
                    padding: '8px 12px 8px 34px',
                    borderRadius: 10,
                    background: 'rgba(0, 0, 0, 0.4)',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    color: '#F8FAFC',
                    fontSize: 12,
                    outline: 'none',
                    width: 200,
                  }}
                />
              </div>

              <button
                onClick={() => refetchUsers()}
                style={{
                  padding: '8px 12px',
                  borderRadius: 10,
                  background: 'rgba(255, 255, 255, 0.04)',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  color: '#94A3B8',
                  fontSize: 12,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                <RefreshCw size={13} />
                Refresh
              </button>

              <button
                onClick={() => setIsCreateModalOpen(true)}
                style={{
                  padding: '8px 16px',
                  borderRadius: 10,
                  background: 'linear-gradient(135deg, #00D4FF, #0EA5E9)',
                  border: 'none',
                  color: '#000',
                  fontWeight: 800,
                  fontSize: 12,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  boxShadow: '0 0 15px rgba(0, 212, 255, 0.3)',
                }}
              >
                <Plus size={15} />
                Provision Staff
              </button>
            </div>
          </div>

          {/* Users Table */}
          <div style={{
            background: 'rgba(17, 24, 39, 0.75)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            borderRadius: 20,
            overflow: 'hidden',
          }}>
            {isLoadingUsers ? (
              <div style={{ padding: 40, textAlign: 'center', color: '#94A3B8' }}>
                <RefreshCw size={24} style={{ animation: 'spin 1s linear infinite', margin: '0 auto 10px' }} />
                Loading municipal user directory...
              </div>
            ) : usersList.length === 0 ? (
              <div style={{ padding: 50, textAlign: 'center', color: '#94A3B8' }}>
                <Users size={36} color="#64748B" style={{ margin: '0 auto 12px' }} />
                <h4 style={{ margin: '0 0 4px', color: '#F8FAFC' }}>No Accounts Found</h4>
                <p style={{ margin: 0, fontSize: 13 }}>Try adjusting your search or role filter.</p>
              </div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, textAlign: 'left' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.08)', color: '#64748B', background: 'rgba(0,0,0,0.2)' }}>
                    <th style={{ padding: '14px 18px' }}>User Details</th>
                    <th style={{ padding: '14px 18px' }}>Role Badge</th>
                    <th style={{ padding: '14px 18px' }}>Department</th>
                    <th style={{ padding: '14px 18px' }}>Account Status</th>
                    <th style={{ padding: '14px 18px', textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {usersList.map((u: any) => {
                    const roleColors: Record<string, string> = {
                      commissioner: '#10B981',
                      engineer: '#8B5CF6',
                      citizen: '#00D4FF',
                      admin: '#F59E0B'
                    };
                    const color = roleColors[u.role] || '#00D4FF';
                    const isActive = u.is_active;

                    return (
                      <tr key={u.id} style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.04)' }}>
                        <td style={{ padding: '14px 18px' }}>
                          <div style={{ fontWeight: 700, color: '#F8FAFC' }}>{u.full_name}</div>
                          <div style={{ fontSize: 12, color: '#94A3B8', fontFamily: 'var(--font-mono)' }}>{u.email}</div>
                        </td>
                        <td style={{ padding: '14px 18px' }}>
                          <span style={{
                            padding: '4px 10px',
                            borderRadius: 999,
                            background: `${color}20`,
                            border: `1px solid ${color}`,
                            color: color,
                            fontWeight: 700,
                            fontSize: 11,
                            textTransform: 'uppercase',
                            letterSpacing: '0.04em',
                          }}>
                            {u.role}
                          </span>
                        </td>
                        <td style={{ padding: '14px 18px', color: '#94A3B8' }}>
                          {u.department || 'Citizen Registry'}
                        </td>
                        <td style={{ padding: '14px 18px' }}>
                          <span style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 5,
                            padding: '4px 10px',
                            borderRadius: 8,
                            background: isActive ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                            border: isActive ? '1px solid rgba(16, 185, 129, 0.4)' : '1px solid rgba(239, 68, 68, 0.4)',
                            color: isActive ? '#10B981' : '#F87171',
                            fontWeight: 700,
                            fontSize: 11,
                          }}>
                            {isActive ? <CheckCircle2 size={12} /> : <XCircle size={12} />}
                            {isActive ? 'Active' : 'Inactive'}
                          </span>
                        </td>
                        <td style={{ padding: '14px 18px', textAlign: 'right' }}>
                          <div style={{ display: 'inline-flex', gap: 6 }}>
                            <button
                              onClick={() => {
                                setEditingRoleUser(u);
                                setEditRoleVal(u.role);
                                setEditDeptVal(u.department || '');
                              }}
                              style={{
                                padding: '6px 10px',
                                borderRadius: 8,
                                background: 'rgba(255, 255, 255, 0.05)',
                                border: '1px solid rgba(255, 255, 255, 0.1)',
                                color: '#E2E8F0',
                                fontSize: 11,
                                fontWeight: 600,
                                cursor: 'pointer',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 4,
                              }}
                            >
                              <Edit2 size={12} />
                              Role
                            </button>

                            <button
                              disabled={updateStatusMutation.isPending}
                              onClick={() => updateStatusMutation.mutate({ userId: u.id, isActive: !isActive })}
                              style={{
                                padding: '6px 10px',
                                borderRadius: 8,
                                background: isActive ? 'rgba(239, 68, 68, 0.15)' : 'rgba(16, 185, 129, 0.15)',
                                border: isActive ? '1px solid rgba(239, 68, 68, 0.4)' : '1px solid rgba(16, 185, 129, 0.4)',
                                color: isActive ? '#F87171' : '#10B981',
                                fontSize: 11,
                                fontWeight: 700,
                                cursor: 'pointer',
                              }}
                            >
                              {isActive ? 'Deactivate' : 'Activate'}
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════
          TAB 2: SYSTEM AUDIT LOGS
      ═══════════════════════════════════════════ */}
      {activeSubTab === 'audit' && (
        <div style={{
          background: 'rgba(17, 24, 39, 0.75)',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          borderRadius: 20,
          padding: 24,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
            <div>
              <h3 style={{ fontSize: 18, fontWeight: 700, color: '#F8FAFC', margin: 0 }}>
                Platform Security & Stage Audit Trail
              </h3>
              <p style={{ margin: '4px 0 0', fontSize: 12, color: '#94A3B8' }}>
                Immutable ledger of all stage transitions, administrative actions, and user events
              </p>
            </div>
            <button
              onClick={() => refetchAudit()}
              style={{
                padding: '8px 14px',
                borderRadius: 10,
                background: 'rgba(255, 255, 255, 0.05)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                color: '#F8FAFC',
                fontSize: 12,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              <RefreshCw size={13} />
              Refresh Logs
            </button>
          </div>

          {isLoadingAudit ? (
            <div style={{ padding: 40, textAlign: 'center', color: '#94A3B8' }}>
              <RefreshCw size={24} style={{ animation: 'spin 1s linear infinite', margin: '0 auto 10px' }} />
              Loading audit records...
            </div>
          ) : auditLogs.length === 0 ? (
            <div style={{ padding: 40, textAlign: 'center', color: '#94A3B8' }}>
              No audit logs recorded yet.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {auditLogs.map((log: any) => (
                <div
                  key={log.id}
                  style={{
                    padding: '12px 16px',
                    background: 'rgba(255, 255, 255, 0.02)',
                    border: '1px solid rgba(255, 255, 255, 0.05)',
                    borderRadius: 12,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    flexWrap: 'wrap',
                    gap: 12,
                    fontSize: 12,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                    <span style={{ color: '#00D4FF', fontWeight: 700, fontFamily: 'var(--font-mono)' }}>
                      {log.when ? new Date(log.when).toLocaleTimeString() : 'Recent'}
                    </span>
                    <span style={{
                      padding: '2px 8px',
                      borderRadius: 6,
                      background: 'rgba(139, 92, 246, 0.15)',
                      border: '1px solid rgba(139, 92, 246, 0.3)',
                      color: '#C4B5FD',
                      fontWeight: 600,
                      fontFamily: 'var(--font-mono)',
                      fontSize: 11,
                    }}>
                      {log.incident_id}
                    </span>
                    <span style={{ color: '#F8FAFC', fontWeight: 700 }}>
                      {log.who}
                    </span>
                    <span style={{ color: '#CBD5E1' }}>
                      {log.what}
                    </span>
                  </div>
                  <span style={{
                    color: log.result?.includes('Success') ? '#10B981' : '#94A3B8',
                    fontWeight: 600,
                    fontSize: 11,
                  }}>
                    {log.result}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ═══════════════════════════════════════════
          TAB 3: SYSTEM HEALTH & TELEMETRY
      ═══════════════════════════════════════════ */}
      {activeSubTab === 'telemetry' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <h3 style={{ fontSize: 16, fontWeight: 700, color: '#F8FAFC', margin: 0 }}>Live System Telemetry & Infrastructure Health</h3>
              <p style={{ fontSize: 13, color: '#94A3B8', margin: '4px 0 0 0' }}>Real-time diagnostics across persistence, AI engines, messaging and auth.</p>
            </div>
            <button
              onClick={() => refetchTelemetry()}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                padding: '8px 14px',
                borderRadius: 10,
                background: 'rgba(0, 212, 255, 0.1)',
                border: '1px solid rgba(0, 212, 255, 0.3)',
                color: '#00D4FF',
                fontSize: 12,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              <RefreshCw size={14} />
              Refresh Diagnostics
            </button>
          </div>

          {isLoadingTelemetry ? (
            <div style={{ padding: 40, textAlign: 'center', color: '#94A3B8' }}>
              <RefreshCw size={24} style={{ animation: 'spin 1s linear infinite', margin: '0 auto 10px' }} />
              Connecting to platform diagnostics...
            </div>
          ) : (
            <>
              {/* Telemetry KPI Cards */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 16 }}>
                {/* Database Card */}
                <div style={{
                  background: 'rgba(17, 24, 39, 0.75)',
                  border: '1px solid rgba(0, 212, 255, 0.25)',
                  borderRadius: 18,
                  padding: 20,
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase' }}>Database Engine</span>
                    <Database size={18} color="#00D4FF" />
                  </div>
                  <div style={{ fontSize: 20, fontWeight: 800, color: '#F8FAFC', marginBottom: 4 }}>
                    {telemetry?.database?.dialect?.toUpperCase()}
                  </div>
                  <div style={{ fontSize: 12, color: telemetry?.database?.status === 'connected' ? '#10B981' : '#EF4444', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <CheckCircle2 size={13} /> {telemetry?.database?.status} ({telemetry?.database?.latency_ms} ms)
                  </div>
                </div>

                {/* AI Engine Card */}
                <div style={{
                  background: 'rgba(17, 24, 39, 0.75)',
                  border: '1px solid rgba(139, 92, 246, 0.25)',
                  borderRadius: 18,
                  padding: 20,
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase' }}>AI Pipeline</span>
                    <Cpu size={18} color="#8B5CF6" />
                  </div>
                  <div style={{ fontSize: 16, fontWeight: 800, color: '#F8FAFC', marginBottom: 4 }}>
                    {telemetry?.ai_engine?.active_vision_engine || 'Gemini Vision'}
                  </div>
                  <div style={{ fontSize: 12, color: '#A78BFA' }}>
                    Chat: {telemetry?.ai_engine?.active_chat_engine || 'Ollama / Gemini'}
                  </div>
                </div>

                {/* WhatsApp Webhook Card */}
                <div style={{
                  background: 'rgba(17, 24, 39, 0.75)',
                  border: '1px solid rgba(16, 185, 129, 0.25)',
                  borderRadius: 18,
                  padding: 20,
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase' }}>WhatsApp Cloud API</span>
                    <Smartphone size={18} color="#10B981" />
                  </div>
                  <div style={{ fontSize: 16, fontWeight: 800, color: '#F8FAFC', marginBottom: 4 }}>
                    {telemetry?.whatsapp?.transport_mode}
                  </div>
                  <div style={{ fontSize: 12, color: telemetry?.whatsapp?.configured ? '#10B981' : '#F59E0B' }}>
                    Webhook: {telemetry?.whatsapp?.configured ? 'Configured & Verified' : 'In Mock Mode'}
                  </div>
                </div>

                {/* Security & Rate Limiter Card */}
                <div style={{
                  background: 'rgba(17, 24, 39, 0.75)',
                  border: '1px solid rgba(245, 158, 11, 0.25)',
                  borderRadius: 18,
                  padding: 20,
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase' }}>Security & Rate Limit</span>
                    <ShieldAlert size={18} color="#F59E0B" />
                  </div>
                  <div style={{ fontSize: 20, fontWeight: 800, color: '#F8FAFC', marginBottom: 4 }}>
                    {telemetry?.security?.rate_limit_events_last_24h ?? 0} Events
                  </div>
                  <div style={{ fontSize: 12, color: '#94A3B8' }}>
                    Token Expiry: {telemetry?.security?.access_token_expiry_minutes} mins
                  </div>
                </div>
              </div>

              {/* User Distribution Telemetry */}
              <div style={{
                background: 'rgba(17, 24, 39, 0.75)',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                borderRadius: 18,
                padding: 24,
              }}>
                <h3 style={{ fontSize: 16, fontWeight: 700, color: '#F8FAFC', margin: '0 0 16px' }}>
                  Account Distribution Breakdown
                </h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 14 }}>
                  {[
                    { label: 'Total Accounts', val: telemetry?.user_telemetry?.total_users, color: '#00D4FF' },
                    { label: 'Active Users', val: telemetry?.user_telemetry?.active_users, color: '#10B981' },
                    { label: 'Citizens', val: telemetry?.user_telemetry?.citizens, color: '#00D4FF' },
                    { label: 'Field Engineers', val: telemetry?.user_telemetry?.engineers, color: '#8B5CF6' },
                    { label: 'Commissioners', val: telemetry?.user_telemetry?.commissioners, color: '#10B981' },
                    { label: 'Administrators', val: telemetry?.user_telemetry?.administrators, color: '#F59E0B' },
                  ].map((stat, i) => (
                    <div key={i} style={{ background: 'rgba(255, 255, 255, 0.02)', padding: 14, borderRadius: 12, border: '1px solid rgba(255, 255, 255, 0.05)' }}>
                      <div style={{ fontSize: 11, color: '#64748B', fontWeight: 600 }}>{stat.label}</div>
                      <div style={{ fontSize: 22, fontWeight: 800, color: stat.color, marginTop: 4 }}>{stat.val ?? 0}</div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* ── MODAL: Provision Staff User ── */}
      <AnimatePresence>
        {isCreateModalOpen && (
          <div style={{
            position: 'fixed',
            inset: 0,
            zIndex: 9999,
            background: 'rgba(0,0,0,0.85)',
            backdropFilter: 'blur(16px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 20,
          }}>
            <motion.div
              initial={{ scale: 0.95, y: 10 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 10 }}
              style={{
                width: '100%',
                maxWidth: 480,
                background: 'linear-gradient(135deg, rgba(8, 27, 51, 0.95), rgba(15, 23, 42, 0.98))',
                border: '1px solid rgba(0, 212, 255, 0.3)',
                borderRadius: 24,
                padding: 28,
                boxShadow: '0 20px 60px rgba(0, 0, 0, 0.6), 0 0 30px rgba(0, 212, 255, 0.15)',
                position: 'relative',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ width: 40, height: 40, borderRadius: 12, background: 'rgba(0, 212, 255, 0.15)', border: '1px solid #00D4FF', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#00D4FF' }}>
                    <UserCheck size={20} />
                  </div>
                  <div>
                    <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: '#F8FAFC' }}>
                      Provision Staff Account
                    </h3>
                    <p style={{ margin: 0, fontSize: 12, color: '#94A3B8' }}>
                      Authorizes official municipal personnel
                    </p>
                  </div>
                </div>
                <button onClick={() => setIsCreateModalOpen(false)} style={{ background: 'none', border: 'none', color: '#94A3B8', cursor: 'pointer' }}>
                  <X size={20} />
                </button>
              </div>

              {formError && (
                <div style={{ padding: '10px 14px', borderRadius: 10, background: 'rgba(239, 68, 68, 0.15)', border: '1px solid rgba(239, 68, 68, 0.4)', color: '#FCA5A5', fontSize: 12, marginBottom: 14 }}>
                  {formError}
                </div>
              )}

              <form onSubmit={handleCreateStaffSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#F8FAFC', marginBottom: 6 }}>Full Name</label>
                  <input
                    type="text"
                    value={newFullName}
                    onChange={(e) => setNewFullName(e.target.value)}
                    placeholder="e.g. Eng. Vikram Malhotra"
                    required
                    style={{ width: '100%', padding: '10px 14px', background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(0, 212, 255, 0.25)', borderRadius: 10, color: '#F8FAFC', fontSize: 13, outline: 'none', boxSizing: 'border-box' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#F8FAFC', marginBottom: 6 }}>Email Address</label>
                  <input
                    type="email"
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    placeholder="v.malhotra@civicsense.ai"
                    required
                    style={{ width: '100%', padding: '10px 14px', background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(0, 212, 255, 0.25)', borderRadius: 10, color: '#F8FAFC', fontSize: 13, outline: 'none', boxSizing: 'border-box' }}
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div>
                    <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#F8FAFC', marginBottom: 6 }}>Municipal Role</label>
                    <select
                      value={newRole}
                      onChange={(e) => setNewRole(e.target.value as any)}
                      style={{ width: '100%', padding: '10px 12px', background: 'rgba(0,0,0,0.6)', border: '1px solid rgba(0, 212, 255, 0.25)', borderRadius: 10, color: '#F8FAFC', fontSize: 13, outline: 'none' }}
                    >
                      <option value="engineer">Field Engineer</option>
                      <option value="commissioner">Commissioner</option>
                      <option value="admin">Administrator</option>
                    </select>
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#F8FAFC', marginBottom: 6 }}>Password (min. 8)</label>
                    <input
                      type="password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="••••••••"
                      required
                      minLength={8}
                      style={{ width: '100%', padding: '10px 14px', background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(0, 212, 255, 0.25)', borderRadius: 10, color: '#F8FAFC', fontSize: 13, outline: 'none', boxSizing: 'border-box' }}
                    />
                  </div>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#F8FAFC', marginBottom: 6 }}>Department</label>
                  <input
                    type="text"
                    value={newDepartment}
                    onChange={(e) => setNewDepartment(e.target.value)}
                    placeholder="e.g. Roads & Works Dept"
                    required
                    style={{ width: '100%', padding: '10px 14px', background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(0, 212, 255, 0.25)', borderRadius: 10, color: '#F8FAFC', fontSize: 13, outline: 'none', boxSizing: 'border-box' }}
                  />
                </div>

                <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
                  <button
                    type="button"
                    onClick={() => setIsCreateModalOpen(false)}
                    style={{ flex: 1, padding: 12, borderRadius: 12, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: '#F8FAFC', fontWeight: 600, cursor: 'pointer' }}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={createStaffMutation.isPending}
                    style={{ flex: 1, padding: 12, borderRadius: 12, background: 'linear-gradient(135deg, #00D4FF, #0EA5E9)', border: 'none', color: '#000', fontWeight: 800, cursor: createStaffMutation.isPending ? 'not-allowed' : 'pointer' }}
                  >
                    {createStaffMutation.isPending ? 'Provisioning...' : 'Confirm Provisioning'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ── MODAL: Edit User Role & Department ── */}
      <AnimatePresence>
        {editingRoleUser && (
          <div style={{
            position: 'fixed',
            inset: 0,
            zIndex: 9999,
            background: 'rgba(0,0,0,0.85)',
            backdropFilter: 'blur(16px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 20,
          }}>
            <motion.div
              initial={{ scale: 0.95, y: 10 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 10 }}
              style={{
                width: '100%',
                maxWidth: 440,
                background: 'linear-gradient(135deg, rgba(8, 27, 51, 0.95), rgba(15, 23, 42, 0.98))',
                border: '1px solid rgba(139, 92, 246, 0.35)',
                borderRadius: 24,
                padding: 28,
                boxShadow: '0 20px 60px rgba(0, 0, 0, 0.6)',
                position: 'relative',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: '#F8FAFC' }}>
                    Reassign User Role
                  </h3>
                  <p style={{ margin: 0, fontSize: 12, color: '#94A3B8' }}>
                    {editingRoleUser.email}
                  </p>
                </div>
                <button onClick={() => setEditingRoleUser(null)} style={{ background: 'none', border: 'none', color: '#94A3B8', cursor: 'pointer' }}>
                  <X size={20} />
                </button>
              </div>

              <form onSubmit={handleSaveRole} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#F8FAFC', marginBottom: 6 }}>Role</label>
                  <select
                    value={editRoleVal}
                    onChange={(e) => setEditRoleVal(e.target.value as any)}
                    style={{ width: '100%', padding: '10px 12px', background: 'rgba(0,0,0,0.6)', border: '1px solid rgba(139, 92, 246, 0.3)', borderRadius: 10, color: '#F8FAFC', fontSize: 13, outline: 'none' }}
                  >
                    <option value="citizen">Citizen</option>
                    <option value="engineer">Field Engineer</option>
                    <option value="commissioner">Commissioner</option>
                    <option value="admin">Administrator</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#F8FAFC', marginBottom: 6 }}>Department</label>
                  <input
                    type="text"
                    value={editDeptVal}
                    onChange={(e) => setEditDeptVal(e.target.value)}
                    placeholder="Department name"
                    style={{ width: '100%', padding: '10px 14px', background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(139, 92, 246, 0.3)', borderRadius: 10, color: '#F8FAFC', fontSize: 13, outline: 'none', boxSizing: 'border-box' }}
                  />
                </div>

                <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
                  <button
                    type="button"
                    onClick={() => setEditingRoleUser(null)}
                    style={{ flex: 1, padding: 12, borderRadius: 12, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: '#F8FAFC', fontWeight: 600, cursor: 'pointer' }}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={updateRoleMutation.isPending}
                    style={{ flex: 1, padding: 12, borderRadius: 12, background: 'linear-gradient(135deg, #8B5CF6, #6D28D9)', border: 'none', color: '#fff', fontWeight: 800, cursor: updateRoleMutation.isPending ? 'not-allowed' : 'pointer' }}
                  >
                    {updateRoleMutation.isPending ? 'Saving...' : 'Save Role'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
