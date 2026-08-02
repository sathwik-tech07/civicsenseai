import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { LogOut, X } from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

export const LogoutConfirmationModal: React.FC<Props> = ({ isOpen, onClose, onConfirm }) => {
  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 999999,
          background: 'rgba(7, 11, 20, 0.8)',
          backdropFilter: 'blur(16px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 24,
        }}
      >
        <motion.div
          initial={{ scale: 0.92, y: 10, opacity: 0 }}
          animate={{ scale: 1, y: 0, opacity: 1 }}
          exit={{ scale: 0.92, y: 10, opacity: 0 }}
          transition={{ duration: 0.2 }}
          style={{
            width: '100%',
            maxWidth: 420,
            background: 'rgba(17, 24, 39, 0.95)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            borderRadius: 24,
            padding: 28,
            boxShadow: '0 25px 50px rgba(0,0,0,0.8), 0 0 30px rgba(239, 68, 68, 0.15)',
            fontFamily: 'var(--font-body)',
            color: '#F8FAFC',
            position: 'relative',
          }}
        >
          {/* Close Button */}
          <button
            onClick={onClose}
            style={{
              position: 'absolute',
              top: 20,
              right: 20,
              background: 'none',
              border: 'none',
              color: '#94A3B8',
              cursor: 'pointer',
            }}
          >
            <X size={18} />
          </button>

          {/* Icon Badge */}
          <div style={{
            width: 48,
            height: 48,
            borderRadius: 16,
            background: 'rgba(239, 68, 68, 0.15)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: 20,
          }}>
            <LogOut size={24} color="#EF4444" />
          </div>

          <h2 style={{
            margin: '0 0 8px 0',
            fontFamily: 'var(--font-heading)',
            fontSize: 20,
            fontWeight: 700,
            color: '#F8FAFC',
          }}>
            Are you sure you want to sign out?
          </h2>

          <p style={{
            margin: '0 0 24px 0',
            fontSize: 13,
            color: '#94A3B8',
            lineHeight: 1.5,
          }}>
            You will be signed out of CivicSense AI. Your local session will be cleared and you will be returned to the login screen.
          </p>

          <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
            <button
              onClick={onClose}
              style={{
                flex: 1,
                padding: '12px 16px',
                borderRadius: 12,
                background: 'rgba(255, 255, 255, 0.05)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                color: '#F8FAFC',
                fontSize: 13,
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'background 0.2s',
              }}
            >
              Cancel
            </button>
            <button
              onClick={onConfirm}
              style={{
                flex: 1,
                padding: '12px 16px',
                borderRadius: 12,
                background: '#EF4444',
                border: 'none',
                color: '#FFFFFF',
                fontSize: 13,
                fontWeight: 700,
                cursor: 'pointer',
                boxShadow: '0 4px 15px rgba(239, 68, 68, 0.4)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
              }}
            >
              <LogOut size={16} />
              Sign Out
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};
