import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Bell, CheckCheck, Search, X, Cpu, AlertTriangle, Truck, Wrench, CheckCircle, FileText } from 'lucide-react';
import type { NotificationItem } from '../types';
import { apiFetchNotifications, apiMarkNotificationRead, apiMarkAllNotificationsRead } from '../services/apiClient';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSelectIncident?: (incidentId: string) => void;
}

export const NotificationCenterModal: React.FC<Props> = ({ isOpen, onClose, onSelectIncident }) => {
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<'all' | 'unread' | 'ai' | 'crew' | 'pdf'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Fetch live notifications with real-time polling (every 3000ms)
  const { data: notifications = [] } = useQuery<NotificationItem[]>({
    queryKey: ['notifications'],
    queryFn: apiFetchNotifications,
    refetchInterval: 3000,
  });

  const markReadMutation = useMutation({
    mutationFn: apiMarkNotificationRead,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    }
  });

  const markAllReadMutation = useMutation({
    mutationFn: apiMarkAllNotificationsRead,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    }
  });

  const unreadCount = notifications.filter(n => !n.read).length;

  const filteredNotifications = notifications.filter(n => {
    const matchesFilter =
      filter === 'all' ? true :
      filter === 'unread' ? !n.read :
      filter === 'ai' ? n.type.includes('AI') :
      filter === 'crew' ? (n.type.includes('CREW') || n.type.includes('REPAIR')) :
      filter === 'pdf' ? n.type.includes('PDF') : true;

    const matchesSearch =
      searchQuery === '' ? true :
      n.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      n.message.toLowerCase().includes(searchQuery.toLowerCase()) ||
      n.incidentId.toLowerCase().includes(searchQuery.toLowerCase());

    return matchesFilter && matchesSearch;
  });

  const getNotifIcon = (type: string) => {
    if (type.includes('AI')) return <Cpu size={16} color="#8B5CF6" />;
    if (type.includes('CREW')) return <Truck size={16} color="#00D4FF" />;
    if (type.includes('REPAIR_STARTED')) return <Wrench size={16} color="#F59E0B" />;
    if (type.includes('REPAIR_COMPLETED') || type.includes('CLOSED')) return <CheckCircle size={16} color="#10B981" />;
    if (type.includes('PDF')) return <FileText size={16} color="#3B82F6" />;
    return <AlertTriangle size={16} color="#EF4444" />;
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -10, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: -10, scale: 0.96 }}
        transition={{ duration: 0.2 }}
        style={{
          position: 'fixed',
          top: 64,
          right: 24,
          width: 440,
          maxHeight: 620,
          zIndex: 99999,
          background: 'rgba(17, 24, 39, 0.92)',
          backdropFilter: 'blur(28px)',
          border: '1px solid rgba(0, 212, 255, 0.3)',
          borderRadius: 24,
          boxShadow: '0 20px 60px rgba(0,0,0,0.7), inset 0 1px 0 rgba(255,255,255,0.1)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          fontFamily: 'var(--font-body)',
        }}
      >
        {/* Header */}
        <div style={{
          padding: '16px 20px',
          borderBottom: '1px solid rgba(255,255,255,0.08)',
          background: 'rgba(0,0,0,0.3)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 32,
              height: 32,
              borderRadius: 10,
              background: 'rgba(0, 212, 255, 0.15)',
              border: '1px solid rgba(0, 212, 255, 0.3)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}>
              <Bell size={18} color="#00D4FF" />
            </div>
            <div>
              <div style={{ fontFamily: 'var(--font-heading)', fontSize: 14, fontWeight: 800, color: '#F8FAFC', display: 'flex', alignItems: 'center', gap: 8 }}>
                Notifications
                {unreadCount > 0 && (
                  <span style={{
                    padding: '2px 8px',
                    borderRadius: 999,
                    background: '#EF4444',
                    color: '#fff',
                    fontSize: 10,
                    fontWeight: 800,
                  }}>
                    {unreadCount} NEW
                  </span>
                )}
              </div>
              <div style={{ fontSize: 10, color: '#94A3B8' }}>Real-time Smart City Workflow Stream</div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {unreadCount > 0 && (
              <button
                onClick={() => markAllReadMutation.mutate()}
                style={{
                  padding: '4px 8px',
                  borderRadius: 6,
                  background: 'rgba(0, 212, 255, 0.12)',
                  border: '1px solid rgba(0, 212, 255, 0.3)',
                  color: '#00D4FF',
                  fontSize: 10,
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                }}
              >
                <CheckCheck size={12} />
                Mark all read
              </button>
            )}
            <button
              onClick={onClose}
              style={{ background: 'none', border: 'none', color: '#94A3B8', cursor: 'pointer', padding: 4 }}
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Search Bar & Filter Tabs */}
        <div style={{ padding: '12px 16px', borderBottom: '1px solid rgba(255,255,255,0.06)', background: 'rgba(0,0,0,0.2)' }}>
          {/* Search Input */}
          <div style={{ position: 'relative', marginBottom: 10 }}>
            <Search size={14} color="#94A3B8" style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)' }} />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search notifications or Incident ID…"
              style={{
                width: '100%',
                padding: '8px 12px 8px 34px',
                background: 'rgba(0,0,0,0.4)',
                border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: 10,
                color: '#F8FAFC',
                fontSize: 11,
                outline: 'none',
                boxSizing: 'border-box',
              }}
            />
          </div>

          {/* Filter Pills */}
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
            {[
              { id: 'all', label: 'All' },
              { id: 'unread', label: `Unread (${unreadCount})` },
              { id: 'ai', label: 'AI Diagnostic' },
              { id: 'crew', label: 'Crew & Repair' },
              { id: 'pdf', label: 'Reports' },
            ].map((f) => (
              <button
                key={f.id}
                onClick={() => setFilter(f.id as any)}
                style={{
                  padding: '4px 10px',
                  borderRadius: 8,
                  background: filter === f.id ? '#00D4FF' : 'rgba(255,255,255,0.04)',
                  color: filter === f.id ? '#000' : '#94A3B8',
                  border: 'none',
                  fontSize: 10,
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {/* Notifications History List */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
          {filteredNotifications.length > 0 ? (
            filteredNotifications.map((n) => (
              <motion.div
                key={n.id}
                whileHover={{ scale: 1.01, backgroundColor: 'rgba(255,255,255,0.04)' }}
                onClick={() => {
                  if (!n.read) markReadMutation.mutate(n.id);
                  if (onSelectIncident && n.incidentId) {
                    onSelectIncident(n.incidentId);
                    onClose();
                  }
                }}
                style={{
                  padding: '12px 14px',
                  borderRadius: 14,
                  background: n.read ? 'rgba(255,255,255,0.02)' : 'rgba(0, 212, 255, 0.06)',
                  border: n.read ? '1px solid rgba(255,255,255,0.06)' : '1px solid rgba(0, 212, 255, 0.3)',
                  cursor: 'pointer',
                  display: 'flex',
                  gap: 12,
                  alignItems: 'flex-start',
                  position: 'relative',
                  transition: 'background 0.2s',
                }}
              >
                <div style={{
                  width: 32,
                  height: 32,
                  borderRadius: 10,
                  background: 'rgba(0,0,0,0.4)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}>
                  {getNotifIcon(n.type)}
                </div>

                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 }}>
                    <span style={{ fontSize: 12, fontWeight: 800, color: n.read ? '#F8FAFC' : '#00D4FF' }}>
                      {n.title}
                    </span>
                    <span style={{ fontSize: 9, color: '#64748B', fontFamily: 'var(--font-mono)' }}>
                      {new Date(n.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>

                  <p style={{ fontSize: 11, color: '#94A3B8', margin: '0 0 6px 0', lineHeight: 1.3 }}>
                    {n.message}
                  </p>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{
                      padding: '2px 6px',
                      borderRadius: 4,
                      background: 'rgba(0,0,0,0.4)',
                      border: '1px solid rgba(255,255,255,0.1)',
                      color: '#00D4FF',
                      fontSize: 9,
                      fontFamily: 'var(--font-mono)',
                      fontWeight: 700,
                    }}>
                      {n.incidentId}
                    </span>
                  </div>
                </div>

                {!n.read && (
                  <div style={{
                    position: 'absolute',
                    top: 12,
                    right: 12,
                    width: 6,
                    height: 6,
                    borderRadius: '50%',
                    background: '#00D4FF',
                    boxShadow: '0 0 8px #00D4FF',
                  }} />
                )}
              </motion.div>
            ))
          ) : (
            <div style={{ padding: '40px 20px', textAlign: 'center', color: '#64748B', fontSize: 12 }}>
              <Bell size={24} style={{ opacity: 0.3, marginBottom: 8 }} />
              <div>No notifications match your current filter.</div>
            </div>
          )}
        </div>
      </motion.div>
    </AnimatePresence>
  );
};
