import { useEffect, useRef } from 'react';
import useFloodData from './useFloodData';
import RainRenderer from './RainRenderer';
import FloodRenderer from './FloodRenderer';
import ReportPanel from './ReportPanel';

// ═══════════════════════════════════════════════════════════════════════════════
// COMPONENTE ORQUESTADOR DE INUNDACIONES
// ═══════════════════════════════════════════════════════════════════════════════

export default function FloodLayer({
  map,
  activeLayer,
  mapTheme = 'dark',
  isSimulation = true,
  forceRain = false,
  onWeatherInfoUpdate = null,
  onFloodDataUpdate = null,
}) {
  const isFloodLayerActive = activeLayer === 'flood';
  const isFloodVisible = activeLayer === 'flood' || activeLayer === 'routes';
  
  // Hook para obtener datos de inundación (ahora con forceRain)
  const {
    isRaining,
    rainZones,
    floodGrid,
    reports,
    getRiskAtPoint,
    weatherInfo,
    loading,
    error,
    createReport,
    upvoteReport,
  } = useFloodData(isSimulation, forceRain);
  
  const prevWeatherRef = useRef(null);
  
  // Notificar cambios de clima al componente padre
  useEffect(() => {
    if (onWeatherInfoUpdate && weatherInfo) {
      const newInfo = {
        ...weatherInfo,
        isRaining,
        isSimulation,
        forceRain,
      };
      
      // Solo actualizar si hay cambios
      const prevStr = JSON.stringify(prevWeatherRef.current);
      const newStr = JSON.stringify(newInfo);
      
      if (prevStr !== newStr) {
        prevWeatherRef.current = newInfo;
        onWeatherInfoUpdate(newInfo);
      }
    }
  }, [weatherInfo, isRaining, isSimulation, forceRain, onWeatherInfoUpdate]);
  
  // Exportar datos de inundación para RouteLayer
  const prevFloodDataRef = useRef(null);
  
  useEffect(() => {
    if (onFloodDataUpdate) {
      const newFloodData = {
        floodGrid,
        reports,
        rainZones,
        getRiskAtPoint,
        isRaining: isRaining || forceRain,
        isSimulation,
        loading,
      };
      
      // Solo actualizar si hay cambios significativos
      const prevStr = JSON.stringify(prevFloodDataRef.current);
      const newStr = JSON.stringify(newFloodData);
      
      if (prevStr !== newStr) {
        prevFloodDataRef.current = newFloodData;
        onFloodDataUpdate(newFloodData);
        console.log('🌊 FloodLayer: Datos exportados a RouteLayer', {
          puntosRiesgo: floodGrid?.features?.length || 0,
          reportes: reports?.length || 0,
          zonasLluvia: rainZones?.length || 0,
        });
      }
    }
  }, [floodGrid, reports, rainZones, getRiskAtPoint, isRaining, forceRain, isSimulation, loading, onFloodDataUpdate]);
  
  // Log de estado
  useEffect(() => {
    if (isFloodVisible && !loading) {
      console.log('🌊 FloodLayer activo:', {
        isRaining,
        forceRain,
        zonas: rainZones.length,
        reportes: reports.length,
        modo: isSimulation ? 'simulación' : 'real',
      });
    }
  }, [isFloodVisible, isRaining, forceRain, rainZones.length, reports.length, isSimulation, loading]);

  if (!map) {
    return null;
  }

  return (
    <>
      {/* Renderizador de lluvia - activo cuando está lloviendo O forceRain */}
      <RainRenderer
        map={map}
        rainZones={rainZones}
        isActive={isFloodVisible && (isRaining || forceRain)}
      />
      
      {/* Renderizador de inundaciones */}
      <FloodRenderer
        map={map}
        floodGrid={floodGrid}
        reports={reports}
        isActive={isFloodVisible}
        isRaining={isRaining || forceRain}
      />
      
      {/* Panel de reportes */}
      <ReportPanel
        map={map}
        reports={reports}
        onCreateReport={createReport}
        onUpvoteReport={upvoteReport}
        isActive={isFloodLayerActive}
        mapTheme={mapTheme}
        weatherInfo={weatherInfo}
      />
      
      {/* Notificación de error API (temporal, desaparece en 8 segundos) */}
      {isFloodLayerActive && error && error.includes('OpenWeatherMap') && (
        <div style={{
          position: 'fixed',
          top: 80,
          left: '50%',
          transform: 'translateX(-50%)',
          background: 'rgba(255, 152, 0, 0.95)',
          color: '#fff',
          padding: '10px 20px',
          borderRadius: 8,
          fontSize: 12,
          fontWeight: 500,
          zIndex: 1000,
          boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
          animation: 'fadeIn 0.3s ease',
        }}>
          ⚠️ {error}
        </div>
      )}
    </>
  );
}
