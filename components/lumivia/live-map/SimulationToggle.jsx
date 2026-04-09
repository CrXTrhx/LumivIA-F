import { useState, useEffect } from 'react';

const MOBILE_BREAKPOINT = 768;

export default function SimulationToggle({ isSimulation, onToggle, mapTheme = 'dark' }) {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth <= MOBILE_BREAKPOINT);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const isLight = mapTheme === 'light';

  const containerStyle = {
    position: 'fixed',
    top: isMobile ? 16 : 24,
    left: isMobile ? 70 : 80,
    zIndex: 100,
  };

  const buttonStyle = {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: isMobile ? '8px 12px' : '10px 16px',
    borderRadius: 10,
    border: 'none',
    cursor: 'pointer',
    fontFamily: "'Inter', system-ui, sans-serif",
    fontSize: isMobile ? 10 : 11,
    fontWeight: 600,
    letterSpacing: '0.05em',
    textTransform: 'uppercase',
    transition: 'all 0.25s ease',
    backdropFilter: 'blur(12px)',
    WebkitBackdropFilter: 'blur(12px)',
    boxShadow: '0 2px 12px rgba(0,0,0,0.15)',
    background: isSimulation
      ? (isLight ? 'rgba(255,180,0,0.15)' : 'rgba(255,180,0,0.2)')
      : (isLight ? 'rgba(0,200,150,0.15)' : 'rgba(0,200,150,0.2)'),
    color: isSimulation
      ? (isLight ? '#B8860B' : '#FFD700')
      : (isLight ? '#0d9488' : '#2DD4BF'),
  };

  const iconStyle = {
    fontSize: isMobile ? 14 : 16,
  };

  const indicatorStyle = {
    width: 6,
    height: 6,
    borderRadius: '50%',
    background: isSimulation ? '#FFD700' : '#2DD4BF',
    boxShadow: isSimulation
      ? '0 0 8px rgba(255,215,0,0.6)'
      : '0 0 8px rgba(45,212,191,0.6)',
    animation: 'pulse-glow 2s ease-in-out infinite',
  };

  return (
    <div style={containerStyle}>
      <button
        type="button"
        style={buttonStyle}
        onClick={onToggle}
        title={isSimulation ? 'Modo Simulación - Click para cambiar a Real' : 'Modo Real - Click para cambiar a Simulación'}
      >
        <span style={iconStyle}>
          {isSimulation ? '🔬' : '📡'}
        </span>
        <span>{isSimulation ? 'SIMULACIÓN' : 'EN VIVO'}</span>
        <div style={indicatorStyle} />
      </button>
      <style>{`
        @keyframes pulse-glow {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.6; transform: scale(1.2); }
        }
      `}</style>
    </div>
  );
}
