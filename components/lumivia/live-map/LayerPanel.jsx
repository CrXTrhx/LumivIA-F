import { useState, useEffect } from 'react';

const LAYERS = [
  { id: 'traffic', label: 'TRAFICO', labelShort: 'TRÁF', enabled: true },
  { id: 'emissions', label: 'EMISIONES', labelShort: 'EMIS', enabled: true },
  { id: 'flood', label: 'INUNDACIONES', labelShort: 'INUND', enabled: true },
  { id: 'routes', label: 'RUTAS', labelShort: 'RUTAS', enabled: true },
];

const MOBILE_BREAKPOINT = 768;

export default function LayerPanel({ activeLayer, onLayerChange, mapTheme = 'dark' }) {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth <= MOBILE_BREAKPOINT);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const isLight = mapTheme === 'light';

  // Desktop: panel vertical a la derecha
  // Mobile: barra horizontal centrada abajo
  const panelStyle = isMobile
    ? {
        position: 'fixed',
        bottom: 16,
        left: '50%',
        transform: 'translateX(-50%)',
        display: 'flex',
        flexDirection: 'row',
        gap: 6,
        zIndex: 100,
        padding: '8px 12px',
        background: isLight ? 'rgba(255,255,255,0.9)' : 'rgba(15,15,20,0.9)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        borderRadius: 16,
        border: isLight ? '1px solid rgba(0,0,0,0.08)' : '1px solid rgba(255,255,255,0.1)',
        boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
      }
    : {
        position: 'fixed',
        right: 24,
        top: '50%',
        transform: 'translateY(-50%)',
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        zIndex: 100,
      };

  const baseButtonStyle = isMobile
    ? {
        padding: '8px 12px',
        borderRadius: 8,
        borderWidth: 1,
        borderStyle: 'solid',
        cursor: 'pointer',
        fontFamily: 'Inter, system-ui, sans-serif',
        fontSize: 9,
        fontWeight: 500,
        letterSpacing: '0.04em',
        textTransform: 'uppercase',
        transition: 'all 0.2s ease',
        display: 'flex',
        alignItems: 'center',
        gap: 5,
        whiteSpace: 'nowrap',
      }
    : {
        width: 140,
        padding: '10px 16px',
        borderRadius: 8,
        borderWidth: 1,
        borderStyle: 'solid',
        cursor: 'pointer',
        fontFamily: 'Inter, system-ui, sans-serif',
        fontSize: 11,
        fontWeight: 500,
        letterSpacing: '0.06em',
        textTransform: 'uppercase',
        transition: 'all 0.2s ease',
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
      };

  const getButtonStyle = (isActive, enabled) => {
    if (!enabled) {
      if (isLight) {
        return {
          background: 'rgba(255,255,255,0.45)',
          borderColor: 'rgba(0,0,0,0.06)',
          color: 'rgba(0,0,0,0.22)',
          cursor: 'not-allowed',
        };
      }
      return {
        background: 'rgba(15,15,15,0.4)',
        borderColor: 'rgba(255,255,255,0.05)',
        color: 'rgba(255,255,255,0.2)',
        cursor: 'not-allowed',
      };
    }

    if (isLight) {
      if (isActive) {
        return {
          background: 'rgba(0,0,0,0.06)',
          borderColor: 'rgba(0,0,0,0.3)',
          color: 'rgba(0,0,0,0.85)',
        };
      }
      return {
        background: 'rgba(255,255,255,0.7)',
        borderColor: 'rgba(0,0,0,0.1)',
        color: 'rgba(0,0,0,0.4)',
      };
    }

    if (isActive) {
      return {
        background: 'rgba(255,255,255,0.08)',
        borderColor: 'rgba(255,255,255,0.35)',
        color: 'rgba(255,255,255,0.92)',
      };
    }
    return {
      background: 'rgba(15,15,15,0.75)',
      borderColor: 'rgba(255,255,255,0.1)',
      color: 'rgba(255,255,255,0.45)',
    };
  };

  const getHoverStyle = enabled => {
    if (!enabled) return {};
    if (isLight) {
      return {
        borderColor: 'rgba(0,0,0,0.2)',
        color: 'rgba(0,0,0,0.65)',
      };
    }
    return {
      borderColor: 'rgba(255,255,255,0.25)',
      color: 'rgba(255,255,255,0.7)',
    };
  };

  const indicatorStyle = isActive => {
    if (isActive) {
      return {
        width: 5,
        height: 5,
        borderRadius: '50%',
        background: isLight ? 'rgba(0,0,0,0.9)' : 'rgba(255,255,255,0.9)',
        flexShrink: 0,
      };
    }
    return {
      width: 5,
      height: 5,
      borderRadius: '50%',
      background: 'transparent',
      border: isLight ? '1px solid rgba(0,0,0,0.2)' : '1px solid rgba(255,255,255,0.2)',
      flexShrink: 0,
    };
  };

  return (
    <div style={panelStyle}>
      {LAYERS.map(layer => {
        const isActive = activeLayer === layer.id;
        const style = {
          ...baseButtonStyle,
          ...getButtonStyle(isActive, layer.enabled),
        };

        return (
          <button
            key={layer.id}
            type="button"
            disabled={!layer.enabled}
            onClick={() => layer.enabled && onLayerChange(layer.id)}
            style={style}
            onMouseEnter={e => {
              if (isActive || !layer.enabled || isMobile) return;
              Object.assign(e.currentTarget.style, getHoverStyle(layer.enabled));
            }}
            onMouseLeave={e => {
              if (isActive || !layer.enabled || isMobile) return;
              const restore = getButtonStyle(false, layer.enabled);
              e.currentTarget.style.borderColor = restore.borderColor;
              e.currentTarget.style.color = restore.color;
            }}
          >
            <div style={indicatorStyle(isActive)} />
            <span>{isMobile ? layer.labelShort : layer.label}</span>
          </button>
        );
      })}
    </div>
  );
}
