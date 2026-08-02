import React, { useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { Sun, AlertTriangle } from 'lucide-react';
import type { WeatherMode, WeatherConfig } from './types';

export const WEATHER_CONFIGS: Record<WeatherMode, WeatherConfig> = {
  sunny: {
    id: 'sunny',
    name: 'Sunny Clear',
    icon: '☀️',
    description: 'Baseline solar radiation. Road surfaces dry.',
    riskMultiplier: 1.0,
    precipitationIntensity: 0,
    fogDensity: 0,
    isNight: false,
    lightning: false,
  },
  cloudy: {
    id: 'cloudy',
    name: 'Overcast Sky',
    icon: '⛅',
    description: 'Cloud cover 85%. Ambient lighting dim.',
    riskMultiplier: 1.15,
    precipitationIntensity: 0,
    fogDensity: 0.15,
    isNight: false,
    lightning: false,
  },
  rain: {
    id: 'rain',
    name: 'Moderate Rain',
    icon: '🌧️',
    description: 'Rainfall 18mm/hr. Roads specular wet. +35% Drainage load.',
    riskMultiplier: 1.45,
    precipitationIntensity: 0.5,
    fogDensity: 0.25,
    isNight: false,
    lightning: false,
    alertNotice: '⚠️ Drainage Capacity Warning: Ward 4 Storm Drains 74% capacity',
  },
  heavy_rain: {
    id: 'heavy_rain',
    name: 'Heavy Downpour',
    icon: '🌩️',
    description: 'Rainfall 48mm/hr. Surface water pooling. +80% Drainage surge.',
    riskMultiplier: 1.85,
    precipitationIntensity: 0.85,
    fogDensity: 0.4,
    isNight: false,
    lightning: false,
    alertNotice: '🚨 DRAINAGE SURGE ALERT: Flood risk expanding along Sector 2',
  },
  storm: {
    id: 'storm',
    name: 'Severe Storm',
    icon: '⛈️',
    description: 'High winds + Lightning flashes. Severe structural strain.',
    riskMultiplier: 2.45,
    precipitationIntensity: 1.0,
    fogDensity: 0.5,
    isNight: true,
    lightning: true,
    alertNotice: '⚡ EMERGENCY STORM WARNING: Substation 4 on standby. Emergency units alerted.',
  },
  fog: {
    id: 'fog',
    name: 'Atmospheric Fog',
    icon: '🌫️',
    description: 'Visibility < 120m. Traffic speed advisory active.',
    riskMultiplier: 1.3,
    precipitationIntensity: 0.1,
    fogDensity: 0.8,
    isNight: false,
    lightning: false,
    alertNotice: '🌫️ Visibility Warning: Drone flight ceiling reduced to 40m',
  },
  night: {
    id: 'night',
    name: 'Night Operations',
    icon: '🌙',
    description: 'Illuminated building windows & streetlights active.',
    riskMultiplier: 1.1,
    precipitationIntensity: 0,
    fogDensity: 0.1,
    isNight: true,
    lightning: false,
  },
};

interface WeatherControlPanelProps {
  currentWeather: WeatherMode;
  onChangeWeather: (weather: WeatherMode) => void;
}

export const WeatherControlPanel: React.FC<WeatherControlPanelProps> = ({
  currentWeather,
  onChangeWeather,
}) => {
  const config = WEATHER_CONFIGS[currentWeather];

  return (
    <div style={{
      background: 'rgba(17, 24, 39, 0.85)',
      backdropFilter: 'blur(20px)',
      border: '1px solid rgba(0, 212, 255, 0.3)',
      borderRadius: 16,
      padding: 12,
      display: 'flex',
      flexDirection: 'column',
      gap: 10,
    }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <Sun size={15} color="#00D4FF" />
          <span style={{ fontSize: 11, fontWeight: 800, color: '#F8FAFC', fontFamily: "'Space Grotesk', sans-serif" }}>
            DYNAMIC WEATHER & ATMOSPHERE
          </span>
        </div>
        <div style={{
          padding: '2px 8px',
          borderRadius: 6,
          background: config.riskMultiplier > 1.8 ? 'rgba(239, 68, 68, 0.2)' : 'rgba(0, 212, 255, 0.15)',
          border: config.riskMultiplier > 1.8 ? '1px solid #EF4444' : '1px solid #00D4FF',
          color: config.riskMultiplier > 1.8 ? '#EF4444' : '#00D4FF',
          fontSize: 10,
          fontWeight: 800,
          fontFamily: "'IBM Plex Mono', monospace",
        }}>
          Risk Multiplier: {config.riskMultiplier.toFixed(2)}x
        </div>
      </div>

      {/* Weather Selector Buttons */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4 }}>
        {(Object.keys(WEATHER_CONFIGS) as WeatherMode[]).map((wKey) => {
          const cfg = WEATHER_CONFIGS[wKey];
          const isActive = currentWeather === wKey;

          return (
            <button
              key={wKey}
              onClick={() => onChangeWeather(wKey)}
              title={`${cfg.name} - ${cfg.description}`}
              style={{
                padding: '6px 4px',
                borderRadius: 8,
                border: isActive ? '1px solid #00D4FF' : '1px solid rgba(255,255,255,0.08)',
                background: isActive ? 'rgba(0, 212, 255, 0.2)' : 'rgba(255,255,255,0.03)',
                color: isActive ? '#F8FAFC' : '#94A3B8',
                fontSize: 12,
                cursor: 'pointer',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 2,
                transition: 'all 0.2s ease',
              }}
            >
              <span>{cfg.icon}</span>
              <span style={{ fontSize: 9, fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '100%' }}>
                {cfg.name.split(' ')[0]}
              </span>
            </button>
          );
        })}
      </div>

      {/* Weather Impact Summary Card */}
      <div style={{
        background: 'rgba(7, 11, 20, 0.6)',
        border: '1px solid rgba(255,255,255,0.06)',
        borderRadius: 10,
        padding: '8px 10px',
        fontSize: 10,
        color: '#94A3B8',
        lineHeight: 1.4,
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
          <strong style={{ color: '#F8FAFC' }}>{config.name} State Active</strong>
          <span style={{ color: config.isNight ? '#8B5CF6' : '#F59E0B' }}>
            {config.isNight ? '🌙 Night Mode' : '☀️ Daylight'}
          </span>
        </div>
        <div>{config.description}</div>
      </div>

      {/* Alert Notice Toast Banner */}
      {config.alertNotice && (
        <motion.div
          initial={{ opacity: 0, y: -5 }}
          animate={{ opacity: 1, y: 0 }}
          style={{
            background: config.riskMultiplier > 2.0 ? 'rgba(239, 68, 68, 0.2)' : 'rgba(245, 158, 11, 0.2)',
            border: config.riskMultiplier > 2.0 ? '1px solid rgba(239, 68, 68, 0.5)' : '1px solid rgba(245, 158, 11, 0.5)',
            borderRadius: 8,
            padding: '6px 10px',
            color: config.riskMultiplier > 2.0 ? '#EF4444' : '#F59E0B',
            fontSize: 10,
            fontWeight: 700,
            display: 'flex',
            alignItems: 'center',
            gap: 6,
          }}
        >
          <AlertTriangle size={14} />
          {config.alertNotice}
        </motion.div>
      )}
    </div>
  );
};

// ── CANVAS WEATHER OVERLAY PARTICLES EFFECT ──
export const WeatherCanvasOverlay: React.FC<{ currentWeather: WeatherMode }> = ({ currentWeather }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const config = WEATHER_CONFIGS[currentWeather];

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;
    let width = (canvas.width = canvas.parentElement?.clientWidth || window.innerWidth);
    let height = (canvas.height = canvas.parentElement?.clientHeight || window.innerHeight);

    const handleResize = () => {
      if (canvas && canvas.parentElement) {
        width = canvas.width = canvas.parentElement.clientWidth;
        height = canvas.height = canvas.parentElement.clientHeight;
      }
    };
    window.addEventListener('resize', handleResize);

    // Particle Array
    const count = Math.floor(config.precipitationIntensity * 220);
    const raindrops: Array<{ x: number; y: number; length: number; speed: number; opacity: number }> = [];

    for (let i = 0; i < count; i++) {
      raindrops.push({
        x: Math.random() * width,
        y: Math.random() * height,
        length: Math.random() * 18 + 12,
        speed: Math.random() * 12 + 10,
        opacity: Math.random() * 0.4 + 0.2,
      });
    }

    let lightningFlash = 0;

    const render = () => {
      ctx.clearRect(0, 0, width, height);

      // Rain Particle Render
      if (config.precipitationIntensity > 0) {
        ctx.strokeStyle = '#00D4FF';
        ctx.lineWidth = 1.2;

        raindrops.forEach((drop) => {
          ctx.beginPath();
          ctx.globalAlpha = drop.opacity;
          ctx.moveTo(drop.x, drop.y);
          ctx.lineTo(drop.x - 2, drop.y + drop.length);
          ctx.stroke();

          drop.y += drop.speed;
          drop.x -= 0.8;

          if (drop.y > height) {
            drop.y = -20;
            drop.x = Math.random() * width;
          }
        });
      }

      // Fog Volumetrics Overlay
      if (config.fogDensity > 0) {
        ctx.fillStyle = `rgba(180, 200, 220, ${config.fogDensity * 0.22})`;
        ctx.fillRect(0, 0, width, height);
      }

      // Lightning Flashes for Storm Mode
      if (config.lightning) {
        if (Math.random() < 0.02) {
          lightningFlash = 0.8;
        }
        if (lightningFlash > 0) {
          ctx.fillStyle = `rgba(255, 255, 255, ${lightningFlash})`;
          ctx.fillRect(0, 0, width, height);
          lightningFlash -= 0.08;
        }
      }

      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('resize', handleResize);
    };
  }, [currentWeather, config]);

  if (config.precipitationIntensity === 0 && config.fogDensity === 0 && !config.lightning) {
    return null;
  }

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'absolute',
        inset: 0,
        pointerEvents: 'none',
        zIndex: 15,
      }}
    />
  );
};
