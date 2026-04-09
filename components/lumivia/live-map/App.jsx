import { useState, useCallback } from 'react';
import LayerPanel from './LayerPanel';
import TrafficFlowMap from './TrafficFlowMap';
import ThemeToggle from './ThemeToggle';
import FlowControls from './FlowControls';
import RouteLayer from './RouteLayer';
import FloodLayer from './FloodLayer';

export default function App({ drivers = [], onAssignmentStatusChange }) {
  const [activeLayer, setActiveLayer] = useState('traffic');
  const [mapTheme, setMapTheme] = useState('dark');
  const isSimulation = true;
  
  // Referencia al mapa de Mapbox + estado para forzar re-render
  const [mapInstance, setMapInstance] = useState(null);
  
  // Modo de tráfico: false = partículas libres, true = sentido vial
  const [trafficMode, setTrafficMode] = useState(false);
  
  // Modo de viento: false = dispersión natural, true = dirección del viento real
  const [windMode, setWindMode] = useState(false);
  
  // Datos del viento desde la API
  const [windData, setWindData] = useState(null);
  
  // Datos del clima para inundaciones
  const [weatherInfo, setWeatherInfo] = useState(null);
  
  // Forzar lluvia manualmente
  const [forceRain, setForceRain] = useState(false);
  
  // Datos de inundación compartidos entre FloodLayer y RouteLayer
  const [floodData, setFloodData] = useState(null);

  const handleWindDataUpdate = useCallback((data) => {
    setWindData(data);
  }, []);
  
  const handleWeatherInfoUpdate = useCallback((data) => {
    setWeatherInfo(data);
  }, []);
  
  const handleFloodDataUpdate = useCallback((data) => {
    setFloodData(data);
  }, []);

  const handleMapReady = useCallback((map) => {
    setMapInstance(map);
  }, []);

  return (
    <>
      <TrafficFlowMap 
        activeLayer={activeLayer} 
        mapTheme={mapTheme}
        trafficMode={trafficMode}
        windMode={windMode}
        isSimulation={isSimulation}
        onWindDataUpdate={handleWindDataUpdate}
        onMapReady={handleMapReady}
      />
      <RouteLayer
        map={mapInstance}
        activeLayer={activeLayer}
        mapTheme={mapTheme}
        isSimulation={isSimulation}
        floodData={floodData}
        drivers={drivers}
        onAssignmentStatusChange={onAssignmentStatusChange}
      />
      <FloodLayer
        map={mapInstance}
        activeLayer={activeLayer}
        mapTheme={mapTheme}
        isSimulation={isSimulation}
        forceRain={forceRain}
        onWeatherInfoUpdate={handleWeatherInfoUpdate}
        onFloodDataUpdate={handleFloodDataUpdate}
      />
      <LayerPanel 
        activeLayer={activeLayer} 
        onLayerChange={setActiveLayer} 
        mapTheme={mapTheme} 
      />
      <ThemeToggle
        mapTheme={mapTheme}
        onThemeToggle={() => setMapTheme(prev => (prev === 'dark' ? 'light' : 'dark'))}
      />
      <FlowControls
        activeLayer={activeLayer}
        trafficMode={trafficMode}
        onTrafficModeChange={setTrafficMode}
        windMode={windMode}
        onWindModeChange={setWindMode}
        windData={windData}
        weatherInfo={weatherInfo}
        forceRain={forceRain}
        onForceRainChange={setForceRain}
        isSimulation={isSimulation}
        mapTheme={mapTheme}
      />
    </>
  );
}
