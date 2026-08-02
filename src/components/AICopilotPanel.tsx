import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useMutation } from '@tanstack/react-query';
import {
  Mic, MicOff, Send, X,
  Search, Globe, TrendingUp, Loader2, Volume2, VolumeX
} from 'lucide-react';
import type { Incident } from '../types';
import { apiSendAIChat } from '../services/apiClient';
import type { AIAction } from '../services/apiClient';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  incidents: Incident[];
  onTriggerAction: (action: AIAction) => void;
  onFlyToLocation?: (coords: [number, number]) => void;
}

interface Message {
  id: string;
  sender: 'user' | 'ai';
  text: string;
  timestamp: string;
  actions?: AIAction[];
  dataSummary?: Record<string, string>;
}

export const AICopilotPanel: React.FC<Props> = ({
  isOpen,
  onClose,
  incidents,
  onTriggerAction,
  onFlyToLocation,
}) => {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'm-1',
      sender: 'ai',
      text: 'Greetings Commissioner. I am AI Command OS, your global smart city intelligence system. I monitor all wards, departments, and infrastructure networks. How can I assist with city-wide operations today?',
      timestamp: 'Just now',
      actions: [
        { label: 'Which ward needs immediate attention?', actionType: 'NAVIGATE_TO_TAB', payload: 'gis' },
        { label: "Generate today's city briefing", actionType: 'NAVIGATE_TO_TAB', payload: 'reports' },
      ],
      dataSummary: {
        'City Health Index': '88/100',
        'Active Incidents': `${incidents.filter(i => i.status !== 'resolved').length} Open`,
        'Critical Risk Wards': 'Ward 4 & Ward 2',
        'AI Models Active': '5 Ensembles Running',
      },
    },
  ]);
  const [inputText, setInputText] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [execViewMode, setExecViewMode] = useState(false);
  const [isVoiceEnabled, setIsVoiceEnabled] = useState(true);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const aiChatMutation = useMutation({
    mutationFn: (query: string) => apiSendAIChat(query, 'command_os'),
    onSuccess: (data) => {
      const aiMsg: Message = {
        id: `ai-${Date.now()}`,
        sender: 'ai',
        text: data.text,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        actions: data.actions,
        dataSummary: data.dataSummary,
      };
      setMessages((prev) => [...prev, aiMsg]);

      // Voice OS TTS Synthesis
      if (isVoiceEnabled && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(data.text);
        utterance.rate = 1.05;
        utterance.pitch = 0.95;
        // Optionally try to find a female/AI voice
        const voices = window.speechSynthesis.getVoices();
        const aiVoice = voices.find(v => v.name.includes('Google') || v.name.includes('Siri') || v.name.includes('Female'));
        if (aiVoice) utterance.voice = aiVoice;
        window.speechSynthesis.speak(utterance);
      }
      
      // Auto-execute if FLY_TO_COORDS is in actions
      const flyAction = data.actions.find(a => a.actionType === 'FLY_TO_COORDS');
      if (flyAction && onFlyToLocation) {
        onFlyToLocation(flyAction.payload);
      }
    }
  });

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, aiChatMutation.isPending]);

  const handleSendMessage = (textToSend?: string) => {
    const query = textToSend || inputText;
    if (!query.trim()) return;

    const userMsg: Message = {
      id: `usr-${Date.now()}`,
      sender: 'user',
      text: query,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMsg]);
    if (!textToSend) setInputText('');

    aiChatMutation.mutate(query);
  };

  const handleVoiceToggle = () => {
    if (!isListening) {
      setIsListening(true);
      setTimeout(() => {
        setIsListening(false);
        handleSendMessage('Which ward needs immediate attention?');
      }, 2500);
    } else {
      setIsListening(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ x: '100%', opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: '100%', opacity: 0 }}
          transition={{ type: 'spring', damping: 25, stiffness: 220 }}
          style={{
            position: 'fixed',
            top: 0,
            right: 0,
            bottom: 0,
            width: 440,
            maxWidth: '100vw',
            background: 'rgba(17, 24, 39, 0.96)',
            backdropFilter: 'blur(28px)',
            borderLeft: '1px solid rgba(139, 92, 246, 0.4)',
            boxShadow: '-20px 0 60px rgba(0, 0, 0, 0.6)',
            zIndex: 90,
            display: 'flex',
            flexDirection: 'column',
            fontFamily: "'Inter', sans-serif",
          }}
        >
          {/* Header */}
          <div style={{
            padding: '16px 20px',
            background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.25), rgba(0, 212, 255, 0.15))',
            borderBottom: '1px solid rgba(139, 92, 246, 0.3)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{
                padding: 8,
                borderRadius: 12,
                background: 'linear-gradient(135deg, #8B5CF6, #00D4FF)',
                boxShadow: '0 0 15px rgba(139, 92, 246, 0.5)',
                color: '#fff',
                display: 'flex',
              }}>
                <Globe size={20} />
              </div>
              <div>
                <h3 style={{
                  margin: 0,
                  fontSize: 15,
                  fontWeight: 800,
                  color: '#F8FAFC',
                  fontFamily: "'Space Grotesk', sans-serif",
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                }}>
                  AI COMMAND OS
                  <span style={{ fontSize: 10, padding: '2px 6px', borderRadius: 4, background: 'rgba(139, 92, 246, 0.3)', border: '1px solid #8B5CF6', color: '#C084FC', fontFamily: "'IBM Plex Mono', monospace" }}>
                    GLOBAL
                  </span>
                </h3>
                <p style={{ margin: '2px 0 0', fontSize: 10, color: '#94A3B8' }}>
                  Autonomous Action Engine
                </p>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <button
                onClick={() => setIsVoiceEnabled(!isVoiceEnabled)}
                title="Toggle Voice OS"
                style={{
                  background: isVoiceEnabled ? 'rgba(16, 185, 129, 0.2)' : 'rgba(255,255,255,0.05)',
                  border: isVoiceEnabled ? '1px solid #10B981' : '1px solid rgba(255,255,255,0.1)',
                  color: isVoiceEnabled ? '#10B981' : '#94A3B8',
                  padding: '6px 10px',
                  borderRadius: 8,
                  fontSize: 10,
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                }}
              >
                {isVoiceEnabled ? <Volume2 size={12} /> : <VolumeX size={12} />}
                Voice OS
              </button>
              <button
                onClick={() => setExecViewMode(!execViewMode)}
                title="Toggle Executive Mode"
                style={{
                  background: execViewMode ? 'rgba(0, 212, 255, 0.2)' : 'rgba(255,255,255,0.05)',
                  border: execViewMode ? '1px solid #00D4FF' : '1px solid rgba(255,255,255,0.1)',
                  color: execViewMode ? '#00D4FF' : '#94A3B8',
                  padding: '6px 10px',
                  borderRadius: 8,
                  fontSize: 10,
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                }}
              >
                <TrendingUp size={12} />
                Exec Mode
              </button>

              <button
                onClick={onClose}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: '#94A3B8',
                  padding: 4,
                  cursor: 'pointer',
                  borderRadius: 6,
                }}
              >
                <X size={18} />
              </button>
            </div>
          </div>

          {/* Quick Search Bar */}
          <div style={{ padding: '10px 16px', borderBottom: '1px solid rgba(255,255,255,0.06)', background: 'rgba(7, 11, 20, 0.5)' }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: 8,
              padding: '6px 10px',
            }}>
              <Search size={14} color="#94A3B8" />
              <input
                type="text"
                placeholder="Search city metrics, wards, SLAs, or forecasts..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: '#F8FAFC',
                  fontSize: 11,
                  width: '100%',
                  outline: 'none',
                }}
              />
            </div>
          </div>

          {/* Chat Stream Area */}
          <div style={{
            flex: 1,
            overflowY: 'auto',
            padding: 16,
            display: 'flex',
            flexDirection: 'column',
            gap: 14,
          }}>
            {messages.map((msg) => (
              <motion.div
                key={msg.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: msg.sender === 'user' ? 'flex-end' : 'flex-start',
                  gap: 6,
                }}
              >
                <div style={{
                  maxWidth: '88%',
                  padding: '12px 14px',
                  borderRadius: msg.sender === 'user' ? '14px 14px 2px 14px' : '14px 14px 14px 2px',
                  background: msg.sender === 'user' ? 'linear-gradient(135deg, #8B5CF6, #6D28D9)' : 'rgba(30, 41, 59, 0.8)',
                  border: msg.sender === 'user' ? 'none' : '1px solid rgba(139, 92, 246, 0.25)',
                  color: '#F8FAFC',
                  fontSize: 12,
                  lineHeight: 1.5,
                  boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                }}>
                  {msg.sender === 'ai' && (
                    <div style={{ fontSize: 10, fontWeight: 700, color: '#C084FC', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
                      <Globe size={11} /> AI Command OS
                    </div>
                  )}
                  {msg.text}

                  {msg.dataSummary && (
                    <div style={{
                      marginTop: 10,
                      padding: 10,
                      borderRadius: 8,
                      background: 'rgba(7, 11, 20, 0.6)',
                      border: '1px solid rgba(255,255,255,0.08)',
                      display: 'grid',
                      gridTemplateColumns: '1fr 1fr',
                      gap: 6,
                      fontSize: 10,
                    }}>
                      {Object.entries(msg.dataSummary).map(([k, v]) => (
                        <div key={k}>
                          <span style={{ color: '#64748B', display: 'block' }}>{k}</span>
                          <strong style={{ color: '#00D4FF', fontFamily: "'IBM Plex Mono', monospace" }}>{v}</strong>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Suggested Action Chips */}
                {msg.actions && msg.actions.length > 0 && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, maxWidth: '90%' }}>
                    {msg.actions.map((act, i) => (
                      <button
                        key={i}
                        onClick={() => {
                          if (act.actionType === 'FLY_TO_COORDS' && onFlyToLocation) {
                            onFlyToLocation(act.payload);
                          } else if (act.actionType === 'NAVIGATE_TO_TAB') {
                            onTriggerAction(act);
                          } else if (act.actionType === 'DISPATCH_CREW') {
                            onTriggerAction(act);
                          } else {
                            handleSendMessage(act.label);
                          }
                        }}
                        style={{
                          background: 'rgba(139, 92, 246, 0.15)',
                          border: '1px solid rgba(139, 92, 246, 0.3)',
                          color: '#E9D5FF',
                          padding: '4px 10px',
                          borderRadius: 8,
                          fontSize: 10,
                          fontWeight: 600,
                          cursor: 'pointer',
                          textAlign: 'left',
                          transition: 'all 0.2s ease',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 4
                        }}
                      >
                        ⚡ {act.label}
                      </button>
                    ))}
                  </div>
                )}
                <span style={{ fontSize: 9, color: '#64748B' }}>{msg.timestamp}</span>
              </motion.div>
            ))}
            
            {/* AI Typing Indicator */}
            {aiChatMutation.isPending && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '12px 14px',
                  borderRadius: '14px 14px 14px 2px',
                  background: 'rgba(30, 41, 59, 0.8)',
                  border: '1px solid rgba(139, 92, 246, 0.25)',
                  width: 'fit-content',
                  color: '#00D4FF',
                  fontSize: 12,
                  fontWeight: 600
                }}
              >
                <Loader2 size={14} className="spin" />
                Processing city telemetry...
              </motion.div>
            )}
            
            <div ref={chatEndRef} />
          </div>

          {/* Voice Listening Overlay */}
          {isListening && (
            <div style={{
              background: 'rgba(139, 92, 246, 0.2)',
              borderTop: '1px solid #8B5CF6',
              padding: '8px 16px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              color: '#C084FC',
              fontSize: 11,
              fontWeight: 700,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: '#EF4444', animation: 'pulse 1s infinite' }} />
                <span>Listening for global city command...</span>
              </div>
              <MicOff size={14} style={{ cursor: 'pointer' }} onClick={() => setIsListening(false)} />
            </div>
          )}

          {/* Input Footer */}
          <div style={{
            padding: 14,
            borderTop: '1px solid rgba(255, 255, 255, 0.08)',
            background: 'rgba(7, 11, 20, 0.8)',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}>
            <button
              onClick={handleVoiceToggle}
              style={{
                background: isListening ? 'rgba(239, 68, 68, 0.2)' : 'rgba(255,255,255,0.05)',
                border: isListening ? '1px solid #EF4444' : '1px solid rgba(255,255,255,0.1)',
                color: isListening ? '#EF4444' : '#94A3B8',
                padding: 10,
                borderRadius: 10,
                cursor: 'pointer',
                display: 'flex',
              }}
            >
              <Mic size={16} />
            </button>

            <input
              type="text"
              placeholder="Ask AI Command OS about city-wide operations..."
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleSendMessage(); }}
              style={{
                flex: 1,
                background: 'rgba(255,255,255,0.05)',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: 10,
                padding: '8px 12px',
                color: '#F8FAFC',
                fontSize: 12,
                outline: 'none',
              }}
              disabled={aiChatMutation.isPending}
            />

            <button
              onClick={() => handleSendMessage()}
              disabled={aiChatMutation.isPending}
              style={{
                background: aiChatMutation.isPending ? 'rgba(255,255,255,0.1)' : 'linear-gradient(135deg, #8B5CF6, #00D4FF)',
                border: 'none',
                color: '#fff',
                padding: '8px 14px',
                borderRadius: 10,
                fontWeight: 700,
                cursor: aiChatMutation.isPending ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 4,
              }}
            >
              <Send size={14} />
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
