import { useState, useEffect } from 'react';

const MOBILE_BREAKPOINT = 768;

export default function FlowControls({ 
  activeLayer, 
  trafficMode, 
  onTrafficModeChange, 
  windMode, 
  onWindModeChange,
  windData,
  weatherInfo,
  forceRain,
  onForceRainChange,
  mapTheme = 'dark',
}) {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth <= MOBILE_BREAKPOINT);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const isLight = mapTheme === 'light';
  
  // Solo mostrar si estamos en traffic, emissions o flood
  if (activeLayer !== 'traffic' && activeLayer !== 'emissions' && activeLayer !== 'flood') {
    return null;
  }

  // En móvil, posicionar arriba de la barra de capas (bottom ~90px)
  const containerStyle = {
    position: 'fixed',
    left: isMobile ? 8 : 24,
    bottom: isMobile ? 90 : 24,
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
    zIndex: 100,
    width: isMobile ? 'calc(100vw - 16px)' : 'auto',
    maxWidth: isMobile ? 'calc(100vw - 16px)' : 'none',
  };

  const cardStyle = {
    background: isLight ? 'rgba(255,255,255,0.85)' : 'rgba(15,15,20,0.9)',
    backdropFilter: 'blur(12px)',
    WebkitBackdropFilter: 'blur(12px)',
    borderRadius: 12,
    padding: isMobile ? '10px 14px' : '14px 18px',
    border: isLight ? '1px solid rgba(0,0,0,0.08)' : '1px solid rgba(255,255,255,0.1)',
    minWidth: isMobile ? 0 : 220,
    width: isMobile ? '100%' : 'auto',
  };

  const labelStyle = {
    fontSize: 9,
    fontWeight: 600,
    letterSpacing: '0.1em',
    textTransform: 'uppercase',
    color: isLight ? 'rgba(0,0,0,0.5)' : 'rgba(255,255,255,0.5)',
    marginBottom: 10,
    fontFamily: 'Inter, system-ui, sans-serif',
  };

  const toggleContainerStyle = {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
  };

  const toggleTrackStyle = (isActive) => ({
    width: 44,
    height: 24,
    borderRadius: 12,
    background: isActive 
      ? (isLight ? 'rgba(0,120,255,0.8)' : 'rgba(0,200,255,0.7)')
      : (isLight ? 'rgba(0,0,0,0.15)' : 'rgba(255,255,255,0.15)'),
    cursor: 'pointer',
    position: 'relative',
    transition: 'background 0.2s ease',
    flexShrink: 0,
  });

  const toggleKnobStyle = (isActive) => ({
    width: 18,
    height: 18,
    borderRadius: '50%',
    background: isLight ? '#fff' : '#fff',
    position: 'absolute',
    top: 3,
    left: isActive ? 23 : 3,
    transition: 'left 0.2s ease',
    boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
  });

  const optionTextStyle = (isActive) => ({
    fontSize: 11,
    fontWeight: 500,
    color: isActive 
      ? (isLight ? 'rgba(0,0,0,0.9)' : 'rgba(255,255,255,0.95)')
      : (isLight ? 'rgba(0,0,0,0.4)' : 'rgba(255,255,255,0.4)'),
    fontFamily: 'Inter, system-ui, sans-serif',
    transition: 'color 0.2s ease',
  });

  const windInfoStyle = {
    marginTop: 10,
    padding: '8px 10px',
    background: isLight ? 'rgba(0,0,0,0.04)' : 'rgba(255,255,255,0.05)',
    borderRadius: 6,
    fontSize: 10,
    fontFamily: 'monospace',
    color: isLight ? 'rgba(0,0,0,0.6)' : 'rgba(255,255,255,0.6)',
  };

  // Convertir grados a dirección cardinal
  const getWindDirection = (deg) => {
    const directions = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
    const index = Math.round(deg / 45) % 8;
    return directions[index];
  };

  return (
    <div style={containerStyle}>
      {activeLayer === 'traffic' && (
        <div style={cardStyle}>
          <div style={labelStyle}>Modo de flujo</div>
          <div style={toggleContainerStyle}>
            <span style={optionTextStyle(!trafficMode)}>Partículas</span>
            <div 
              style={toggleTrackStyle(trafficMode)}
              onClick={() => onTrafficModeChange(!trafficMode)}
            >
              <div style={toggleKnobStyle(trafficMode)} />
            </div>
            <span style={optionTextStyle(trafficMode)}>Sentido vial</span>
          </div>
        </div>
      )}

      {activeLayer === 'emissions' && (
        <div style={cardStyle}>
          <div style={labelStyle}>Dirección del humo</div>
          <div style={toggleContainerStyle}>
            <span style={optionTextStyle(!windMode)}>Dispersión</span>
            <div 
              style={toggleTrackStyle(windMode)}
              onClick={() => onWindModeChange(!windMode)}
            >
              <div style={toggleKnobStyle(windMode)} />
            </div>
            <span style={optionTextStyle(windMode)}>Viento real</span>
          </div>
          
          {windMode && windData && (
            <div style={windInfoStyle}>
              <div>
                <span style={{ color: isLight ? 'rgba(0,150,255,0.9)' : 'rgba(0,200,255,0.9)' }}>
                  {getWindDirection(windData.deg)}
                </span>
                {' '}@ {windData.speed.toFixed(1)} m/s
              </div>
              <div style={{ opacity: 0.7, marginTop: 2 }}>
                {windData.deg.toFixed(0)}° — {(windData.speed * 3.6).toFixed(1)} km/h
              </div>
            </div>
          )}
          
        </div>
      )}

      {activeLayer === 'flood' && (
        <div style={cardStyle}>
          <div style={labelStyle}>Control de lluvia</div>
          
          {/* Toggle para forzar lluvia */}
          <div style={toggleContainerStyle}>
            <span style={optionTextStyle(!forceRain)}>Natural</span>
            <div 
              style={toggleTrackStyle(forceRain)}
              onClick={() => onForceRainChange && onForceRainChange(!forceRain)}
            >
              <div style={toggleKnobStyle(forceRain)} />
            </div>
            <span style={optionTextStyle(forceRain)}>Forzar lluvia</span>
          </div>
          
          {forceRain && (
            <div style={{
              marginTop: 10,
              padding: '8px 10px',
              background: isLight ? 'rgba(0,120,255,0.08)' : 'rgba(0,180,255,0.1)',
              borderRadius: 6,
              fontSize: 10,
              color: isLight ? '#0066cc' : '#4dd0e1',
              textAlign: 'center',
              fontWeight: 500,
            }}>
              🌧️ Lluvia activada manualmente
            </div>
          )}
          
          {/* Weather Info Card */}
          {weatherInfo && (
            <div style={{
              padding: '10px 12px',
              background: isLight ? 'rgba(0,0,0,0.04)' : 'rgba(255,255,255,0.05)',
              borderRadius: 8,
              marginTop: 10,
            }}>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                marginBottom: 6,
              }}>
                <span style={{ fontSize: 20 }}>
                  {weatherInfo.isRaining || forceRain ? '🌧️' : '☀️'}
                </span>
                <div>
                  <div style={{
                    fontSize: 12,
                    fontWeight: 600,
                    color: isLight ? 'rgba(0,0,0,0.85)' : 'rgba(255,255,255,0.9)',
                    textTransform: 'capitalize',
                  }}>
                    {weatherInfo.description || (weatherInfo.isRaining || forceRain ? 'Lluvia' : 'Despejado')}
                  </div>
                  <div style={{
                    fontSize: 10,
                    color: isLight ? 'rgba(0,0,0,0.5)' : 'rgba(255,255,255,0.5)',
                  }}>
                    {weatherInfo.temp ? `${Math.round(weatherInfo.temp)}°C` : ''} 
                    {weatherInfo.humidity ? ` • ${weatherInfo.humidity}% hum.` : ''}
                  </div>
                </div>
              </div>
              
              {(weatherInfo.isRaining || forceRain) && weatherInfo.rainVolume > 0 && (
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '6px 8px',
                  background: isLight ? 'rgba(0,120,255,0.08)' : 'rgba(0,180,255,0.1)',
                  borderRadius: 6,
                  marginTop: 6,
                }}>
                  <span style={{ fontSize: 12 }}>💧</span>
                  <span style={{
                    fontSize: 10,
                    color: isLight ? '#0066cc' : '#4dd0e1',
                    fontWeight: 500,
                  }}>
                    {weatherInfo.rainVolume.toFixed(1)} mm/h
                  </span>
                  <span style={{
                    fontSize: 9,
                    color: isLight ? 'rgba(0,0,0,0.4)' : 'rgba(255,255,255,0.4)',
                    marginLeft: 'auto',
                  }}>
                    {weatherInfo.rainVolume > 7 ? 'Intensa' : weatherInfo.rainVolume > 2 ? 'Moderada' : 'Ligera'}
                  </span>
                </div>
              )}
            </div>
          )}
          
        </div>
      )}
    </div>
  );
}
