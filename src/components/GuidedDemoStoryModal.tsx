import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onJumpToTab: (tab: string) => void;
}

const steps = [
  { title: 'Welcome to CivicSense AI', desc: 'The next-generation AI-powered municipal management system.', icon: '🌆' },
  { title: 'Command Center', desc: 'Monitor live incidents, track resolution times, and manage city resources efficiently.', icon: '📊' },
  { title: 'Predictive Intelligence', desc: 'AI models predict infrastructure failures before they happen, saving costs and preventing accidents.', icon: '🧠' },
  { title: 'Digital Twin City', desc: 'Explore a fully interactive 3D and GIS map of the city infrastructure.', icon: '🗺️' },
  { title: 'Ready to Explore!', desc: 'Start managing your city smarter.', icon: '🚀' },
];

export const GuidedDemoStoryModal: React.FC<Props> = ({ isOpen, onClose, onJumpToTab: _onJumpToTab }) => {
  const [currentStep, setCurrentStep] = useState(0);

  if (!isOpen) return null;

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      onClose();
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            background: 'rgba(7, 11, 20, 0.8)', backdropFilter: 'blur(12px)',
            zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center'
          }}
        >
          <motion.div
            key={currentStep}
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.95 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            style={{
              background: 'var(--bg-elevated)', border: '1px solid var(--border)',
              borderRadius: 'var(--radius-xl)', padding: '40px', maxWidth: '600px', width: '90%',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5), 0 0 40px var(--accent-glow)'
            }}
          >
            <div style={{ fontSize: '64px', textAlign: 'center', marginBottom: '24px' }}>
              {steps[currentStep].icon}
            </div>
            <h2 style={{ fontSize: '32px', color: 'var(--text-primary)', textAlign: 'center', marginBottom: '16px', fontFamily: 'var(--font-heading)' }}>
              {steps[currentStep].title}
            </h2>
            <p style={{ fontSize: '18px', color: 'var(--text-secondary)', textAlign: 'center', marginBottom: '40px', lineHeight: '1.6' }}>
              {steps[currentStep].desc}
            </p>

            {/* Dots */}
            <div style={{ display: 'flex', justifyContent: 'center', gap: '8px', marginBottom: '40px' }}>
              {steps.map((_, i) => (
                <div key={i} style={{
                  width: '8px', height: '8px', borderRadius: '50%',
                  background: i === currentStep ? 'var(--accent)' : 'var(--bg-card)',
                  transition: 'background 0.3s'
                }} />
              ))}
            </div>

            {/* Actions */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <button
                onClick={onClose}
                style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '16px' }}
              >
                Skip Demo
              </button>
              
              <div style={{ display: 'flex', gap: '12px' }}>
                {currentStep > 0 && (
                  <button
                    onClick={() => setCurrentStep(prev => prev - 1)}
                    style={{ padding: '12px 24px', background: 'var(--bg-card)', color: 'var(--text-primary)', border: '1px solid var(--border)', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}
                  >
                    Back
                  </button>
                )}
                <button
                  onClick={handleNext}
                  style={{ padding: '12px 24px', background: 'var(--accent)', color: '#000', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}
                >
                  {currentStep === steps.length - 1 ? 'Get Started' : 'Next'}
                </button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
