import React, { useState } from 'react';
import {
  Layers,
  Building2,
  Route,
  Zap,
  Droplet,
  Flame,
  Activity,
  HeartPulse,
  GraduationCap,
  AlertTriangle,
  Radio,
  Sliders,
  ChevronDown,
  ChevronUp,
  Eye,
  EyeOff,
} from 'lucide-react';
import type { GISLayerConfig, LayerCategory } from './types';

interface LayerControlProps {
  layers: GISLayerConfig[];
  onToggleLayer: (layerId: string) => void;
  onChangeOpacity: (layerId: string, opacity: number) => void;
  isOpen: boolean;
  onToggleOpen: () => void;
}

const CATEGORY_LABELS: Record<LayerCategory, { label: string; icon: React.ReactNode }> = {
  urban: { label: 'Urban Infrastructure', icon: <Building2 size={16} color="#00D4FF" /> },
  transport: { label: 'Transport & Roads', icon: <Route size={16} color="#8B5CF6" /> },
  utilities: { label: 'Power & Water Grid', icon: <Zap size={16} color="#F59E0B" /> },
  facilities: { label: 'Civic Facilities', icon: <HeartPulse size={16} color="#10B981" /> },
  iot: { label: 'IoT & Telemetry', icon: <Radio size={16} color="#3B82F6" /> },
  risk: { label: 'Hazards & Incidents', icon: <AlertTriangle size={16} color="#EF4444" /> },
};

const ICON_MAP: Record<string, React.ReactNode> = {
  Building2: <Building2 size={16} />,
  Route: <Route size={16} />,
  Droplet: <Droplet size={16} color="#00D4FF" />,
  Zap: <Zap size={16} color="#F59E0B" />,
  HeartPulse: <HeartPulse size={16} color="#EF4444" />,
  GraduationCap: <GraduationCap size={16} color="#3B82F6" />,
  Radio: <Radio size={16} color="#10B981" />,
  Activity: <Activity size={16} color="#F59E0B" />,
  Flame: <Flame size={16} color="#EF4444" />,
  AlertTriangle: <AlertTriangle size={16} color="#EF4444" />,
};

export const LayerControl: React.FC<LayerControlProps> = ({
  layers,
  onToggleLayer,
  onChangeOpacity,
  isOpen,
  onToggleOpen,
}) => {
  const [activeCategory, setActiveCategory] = useState<LayerCategory | 'all'>('all');
  const [activeOpacityId, setActiveOpacityId] = useState<string | null>(null);

  const categories: LayerCategory[] = ['urban', 'transport', 'utilities', 'facilities', 'iot', 'risk'];

  const filteredLayers = activeCategory === 'all'
    ? layers
    : layers.filter((l) => l.category === activeCategory);

  const visibleCount = layers.filter((l) => l.visible).length;

  return (
    <div style={{ position: 'relative', zIndex: 30, fontFamily: "'Inter', sans-serif" }}>
      {/* Floating Toggle Button */}
      <button
        onClick={onToggleOpen}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          padding: '8px 12px',
          borderRadius: '12px',
          transition: 'all 200ms',
          border: isOpen ? '1px solid rgba(0,212,255,0.5)' : '1px solid rgba(255,255,255,0.08)',
          backgroundColor: isOpen ? 'rgba(17,24,39,0.9)' : 'rgba(17,24,39,0.8)',
          color: isOpen ? '#00D4FF' : '#F8FAFC',
          boxShadow: isOpen ? '0 10px 15px -3px rgba(0,212,255,0.4)' : 'none',
          backdropFilter: 'blur(12px)',
          fontSize: '12px',
          fontWeight: 600,
          cursor: 'pointer'
        }}
        title="Toggle GIS Layers Panel"
      >
        <Layers size={16} color="#00D4FF" />
        <span>GIS Layers</span>
        <span style={{
          padding: '2px 6px',
          borderRadius: '9999px',
          backgroundColor: 'rgba(0,212,255,0.2)',
          color: '#00D4FF',
          fontFamily: "'IBM Plex Mono', monospace",
          fontSize: '10px'
        }}>
          {visibleCount}/{layers.length}
        </span>
        {isOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
      </button>

      {/* Glassmorphism Panel */}
      {isOpen && (
        <div style={{
          position: 'absolute',
          top: '44px',
          left: 0,
          width: '320px',
          maxHeight: '75vh',
          display: 'flex',
          flexDirection: 'column',
          backgroundColor: 'rgba(17,24,39,0.85)',
          backdropFilter: 'blur(20px)',
          border: '1px solid rgba(0,212,255,0.3)',
          borderRadius: '16px',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
          overflow: 'hidden',
          zIndex: 40,
          color: '#F8FAFC'
        }}>
          {/* Header */}
          <div style={{
            padding: '12px',
            borderBottom: '1px solid rgba(255,255,255,0.08)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            backgroundColor: 'rgba(17,24,39,0.4)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{
                padding: '6px',
                borderRadius: '8px',
                backgroundColor: 'rgba(0,212,255,0.1)',
                border: '1px solid rgba(0,212,255,0.3)'
              }}>
                <Layers size={16} color="#00D4FF" />
              </div>
              <div>
                <h3 style={{
                  fontWeight: 600,
                  fontSize: '14px',
                  letterSpacing: '0.025em',
                  color: '#F8FAFC',
                  margin: 0,
                  fontFamily: "'Space Grotesk', sans-serif"
                }}>GIS Layer Stack</h3>
                <p style={{ fontSize: '10px', color: '#94A3B8', margin: 0 }}>10+ Interactive Urban Layers</p>
              </div>
            </div>
            <button
              onClick={onToggleOpen}
              style={{
                color: '#94A3B8',
                fontSize: '12px',
                padding: '4px',
                borderRadius: '4px',
                background: 'transparent',
                border: 'none',
                cursor: 'pointer'
              }}
            >
              ✕
            </button>
          </div>

          {/* Category Selector Tabs */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            padding: '8px',
            borderBottom: '1px solid rgba(255,255,255,0.08)',
            overflowX: 'auto',
            backgroundColor: 'rgba(17,24,39,0.2)'
          }}>
            <button
              onClick={() => setActiveCategory('all')}
              style={{
                padding: '4px 10px',
                borderRadius: '8px',
                fontSize: '11px',
                fontWeight: 500,
                whiteSpace: 'nowrap',
                transition: 'colors 200ms',
                border: activeCategory === 'all' ? '1px solid rgba(0,212,255,0.4)' : '1px solid transparent',
                backgroundColor: activeCategory === 'all' ? 'rgba(0,212,255,0.2)' : 'transparent',
                color: activeCategory === 'all' ? '#00D4FF' : '#94A3B8',
                cursor: 'pointer'
              }}
            >
              All ({layers.length})
            </button>
            {categories.map((cat) => {
              const catCount = layers.filter((l) => l.category === cat).length;
              return (
                <button
                  key={cat}
                  onClick={() => setActiveCategory(cat)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    padding: '4px 8px',
                    borderRadius: '8px',
                    fontSize: '11px',
                    fontWeight: 500,
                    whiteSpace: 'nowrap',
                    transition: 'colors 200ms',
                    border: activeCategory === cat ? '1px solid rgba(0,212,255,0.4)' : '1px solid transparent',
                    backgroundColor: activeCategory === cat ? 'rgba(0,212,255,0.2)' : 'transparent',
                    color: activeCategory === cat ? '#00D4FF' : '#94A3B8',
                    cursor: 'pointer'
                  }}
                >
                  {CATEGORY_LABELS[cat].icon}
                  <span>{catCount}</span>
                </button>
              );
            })}
          </div>

          {/* Layers List */}
          <div style={{
            flex: 1,
            overflowY: 'auto',
            padding: '8px',
            display: 'flex',
            flexDirection: 'column',
            gap: '4px'
          }}>
            {filteredLayers.map((layer) => {
              const isOpacityExpanded = activeOpacityId === layer.id;
              return (
                <div
                  key={layer.id}
                  style={{
                    padding: '8px',
                    transition: 'all 200ms',
                    borderRadius: '12px',
                    backgroundColor: layer.visible ? 'rgba(17,24,39,0.4)' : 'rgba(17,24,39,0.3)',
                    opacity: layer.visible ? 1 : 0.7,
                    borderBottom: '1px solid rgba(255,255,255,0.08)'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1, minWidth: 0 }}>
                      <button
                        onClick={() => onToggleLayer(layer.id)}
                        style={{
                          padding: '6px',
                          borderRadius: '8px',
                          border: layer.visible ? '1px solid rgba(0,212,255,0.4)' : '1px solid rgba(255,255,255,0.08)',
                          backgroundColor: layer.visible ? 'rgba(0,212,255,0.2)' : 'rgba(17,24,39,1)',
                          color: layer.visible ? '#00D4FF' : '#64748B',
                          boxShadow: layer.visible ? '0 1px 2px 0 rgba(0, 0, 0, 0.05)' : 'none',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center'
                        }}
                      >
                        {layer.visible ? <Eye size={14} /> : <EyeOff size={14} />}
                      </button>
                      <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span style={{ color: '#F8FAFC', display: 'flex' }}>{ICON_MAP[layer.iconName] || <Layers size={16} />}</span>
                          <span
                            onClick={() => onToggleLayer(layer.id)}
                            style={{
                              fontWeight: 500,
                              fontSize: '12px',
                              color: '#F8FAFC',
                              cursor: 'pointer',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis'
                            }}
                          >
                            {layer.name}
                          </span>
                        </div>
                        <p style={{ fontSize: '10px', color: '#94A3B8', margin: '2px 0 0 0', overflow: 'hidden', textOverflow: 'ellipsis' }}>{layer.description}</p>
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginLeft: '8px' }}>
                      <button
                        onClick={() => setActiveOpacityId(isOpacityExpanded ? null : layer.id)}
                        style={{
                          padding: '4px',
                          borderRadius: '4px',
                          color: isOpacityExpanded ? '#00D4FF' : '#94A3B8',
                          backgroundColor: isOpacityExpanded ? 'rgba(0,212,255,0.2)' : 'transparent',
                          transition: 'colors 200ms',
                          border: 'none',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center'
                        }}
                        title="Adjust Layer Opacity"
                      >
                        <Sliders size={14} />
                      </button>
                    </div>
                  </div>

                  {/* Opacity Slider Overlay */}
                  {isOpacityExpanded && (
                    <div style={{
                      marginTop: '8px',
                      paddingTop: '8px',
                      borderTop: '1px solid rgba(255,255,255,0.08)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      paddingLeft: '4px',
                      paddingRight: '4px'
                    }}>
                      <span style={{
                        fontSize: '10px',
                        fontFamily: "'IBM Plex Mono', monospace",
                        color: '#94A3B8',
                        width: '48px'
                      }}>
                        Opacity: {Math.round(layer.opacity * 100)}%
                      </span>
                      <input
                        type="range"
                        min="0"
                        max="1"
                        step="0.05"
                        value={layer.opacity}
                        onChange={(e) => onChangeOpacity(layer.id, parseFloat(e.target.value))}
                        style={{
                          flex: 1,
                          accentColor: '#00D4FF',
                          height: '4px',
                          backgroundColor: '#64748B',
                          borderRadius: '8px',
                          cursor: 'pointer'
                        }}
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Footer Quick Controls */}
          <div style={{
            padding: '8px',
            borderTop: '1px solid rgba(255,255,255,0.08)',
            backgroundColor: 'rgba(17,24,39,0.6)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontSize: '11px'
          }}>
            <button
              onClick={() => layers.forEach((l) => !l.visible && onToggleLayer(l.id))}
              style={{
                color: '#00D4FF',
                fontWeight: 500,
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                textDecoration: 'none'
              }}
            >
              Enable All
            </button>
            <button
              onClick={() => layers.forEach((l) => l.visible && onToggleLayer(l.id))}
              style={{
                color: '#94A3B8',
                background: 'transparent',
                border: 'none',
                cursor: 'pointer'
              }}
            >
              Disable All
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
