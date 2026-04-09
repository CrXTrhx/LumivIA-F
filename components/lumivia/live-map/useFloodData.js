import { useState, useEffect, useCallback, useRef } from 'react';

// ═══════════════════════════════════════════════════════════════════════════════
// CONFIGURACIÓN
// ═══════════════════════════════════════════════════════════════════════════════

const BACKEND_URL = 'http://localhost:8080';
const OPENWEATHER_API_KEY = process.env.NEXT_PUBLIC_OPENWEATHER_API_KEY || '';
const MEXICO_CITY_CENTER = { lat: 19.4326, lng: -99.1332 };

// Intervalo de actualización (ms)
const WEATHER_UPDATE_INTERVAL = 5 * 60 * 1000; // 5 minutos
const FLOOD_UPDATE_INTERVAL = 30 * 1000; // 30 segundos
const REPORTS_UPDATE_INTERVAL = 20 * 1000; // 20 segundos

// Zonas simuladas de lluvia (cuando isSimulation = true)
const SIMULATED_RAIN_ZONES = [
  { id: 'sim-1', lat: 19.4390, lng: -99.1350, radius: 600, name: 'Insurgentes-Reforma' },
  { id: 'sim-2', lat: 19.4520, lng: -99.1476, radius: 500, name: 'Insurgentes Norte' },
  { id: 'sim-3', lat: 19.4280, lng: -99.1720, radius: 700, name: 'Reforma Poniente' },
  { id: 'sim-4', lat: 19.4356, lng: -99.1450, radius: 450, name: 'Av. Juárez' },
];

// ═══════════════════════════════════════════════════════════════════════════════
// UTILIDADES
// ═══════════════════════════════════════════════════════════════════════════════

function isRainyWeatherCode(code) {
  // 200-299: Thunderstorm, 300-399: Drizzle, 500-599: Rain
  return code >= 200 && code < 600;
}

function classifyIntensity(rainVolume) {
  if (rainVolume > 7) return 'heavy';
  if (rainVolume > 2) return 'medium';
  return 'light';
}

// Generar reportes simulados
function generateSimulatedReports() {
  const severities = ['LEVE', 'MODERADO', 'SEVERO'];
  const descriptions = [
    'Encharcamiento en la esquina',
    'Agua acumulada, difícil pasar',
    'Calle completamente inundada',
    'Agua hasta los tobillos',
    'Alcantarilla desbordada',
  ];
  
  const reports = [];
  const numReports = 2 + Math.floor(Math.random() * 4);
  
  for (let i = 0; i < numReports; i++) {
    const severity = severities[Math.floor(Math.random() * severities.length)];
    reports.push({
      id: i + 1,
      lat: MEXICO_CITY_CENTER.lat + (Math.random() - 0.5) * 0.04,
      lng: MEXICO_CITY_CENTER.lng + (Math.random() - 0.5) * 0.06,
      severity,
      severityValue: severity === 'LEVE' ? 0.3 : severity === 'MODERADO' ? 0.6 : 1.0,
      description: descriptions[Math.floor(Math.random() * descriptions.length)],
      upvotes: Math.floor(Math.random() * 15),
      createdAt: new Date(Date.now() - Math.random() * 3600000).toISOString(),
      expiresAt: new Date(Date.now() + 6 * 3600000).toISOString(),
      color: severity === 'LEVE' ? '#4CAF50' : severity === 'MODERADO' ? '#FF9800' : '#F44336',
      radius: severity === 'LEVE' ? 8 : severity === 'MODERADO' ? 12 : 16,
    });
  }
  
  return reports;
}

// Generar grid de riesgo simulado
function generateSimulatedFloodGrid(rainZones) {
  const features = [];
  const gridSize = 12;
  const latStep = 0.03;
  const lngStep = 0.04;
  
  for (let row = 0; row < gridSize; row++) {
    for (let col = 0; col < gridSize; col++) {
      const lat = MEXICO_CITY_CENTER.lat - 0.15 + row * latStep;
      const lng = MEXICO_CITY_CENTER.lng - 0.2 + col * lngStep;
      
      // Calcular riesgo basado en cercanía a zonas de lluvia
      let risk = 0;
      for (const zone of rainZones) {
        const dist = Math.sqrt(
          Math.pow((lat - zone.lat) * 111000, 2) + 
          Math.pow((lng - zone.lng) * 111000 * Math.cos(lat * Math.PI / 180), 2)
        );
        if (dist < zone.radius * 2) {
          const zoneRisk = (1 - dist / (zone.radius * 2)) * 
            (zone.intensity === 'heavy' ? 0.9 : zone.intensity === 'medium' ? 0.6 : 0.3);
          risk = Math.max(risk, zoneRisk);
        }
      }
      
      // Agregar variación random
      risk = Math.min(1, risk * (0.7 + Math.random() * 0.6));
      
      if (risk > 0.05) {
        features.push({
          type: 'Feature',
          geometry: { type: 'Point', coordinates: [lng, lat] },
          properties: {
            risk,
            riskLevel: risk > 0.6 ? 'alto' : risk > 0.3 ? 'medio' : 'bajo',
            weight: risk,
          },
        });
      }
    }
  }
  
  return { type: 'FeatureCollection', features };
}

// ═══════════════════════════════════════════════════════════════════════════════
// HOOK PRINCIPAL
// ═══════════════════════════════════════════════════════════════════════════════

export default function useFloodData(isSimulation = true, forceRain = false) {
  // Estado principal
  const [isRaining, setIsRaining] = useState(false);
  const [rainZones, setRainZones] = useState([]);
  const [floodGrid, setFloodGrid] = useState(null);
  const [reports, setReports] = useState([]);
  const [weatherInfo, setWeatherInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // Refs para intervalos
  const weatherIntervalRef = useRef(null);
  const floodIntervalRef = useRef(null);
  const reportsIntervalRef = useRef(null);
  const errorTimeoutRef = useRef(null);
  
  // Auto-limpiar errores después de 8 segundos
  useEffect(() => {
    if (error) {
      if (errorTimeoutRef.current) clearTimeout(errorTimeoutRef.current);
      errorTimeoutRef.current = setTimeout(() => setError(null), 8000);
    }
    return () => {
      if (errorTimeoutRef.current) clearTimeout(errorTimeoutRef.current);
    };
  }, [error]);

  // ─────────────────────────────────────────────────────────────────────────────
  // FETCH CLIMA ACTUAL (OpenWeatherMap)
  // ─────────────────────────────────────────────────────────────────────────────
  
  const fetchWeather = useCallback(async () => {
    // Si forceRain está activo, siempre simular lluvia
    if (forceRain || isSimulation) {
      // Simulación: siempre está lloviendo con zonas aleatorias
      const numZones = 2 + Math.floor(Math.random() * 3);
      const shuffled = [...SIMULATED_RAIN_ZONES].sort(() => Math.random() - 0.5);
      const intensities = forceRain ? ['medium', 'heavy'] : ['light', 'medium', 'heavy'];
      const selectedZones = shuffled.slice(0, numZones).map(zone => ({
        ...zone,
        intensity: intensities[Math.floor(Math.random() * intensities.length)],
        isRaining: true,
      }));
      
      setIsRaining(true);
      setRainZones(selectedZones);
      setWeatherInfo({
        description: forceRain ? 'Lluvia forzada' : 'Lluvia simulada',
        temp: 18 + Math.floor(Math.random() * 8),
        humidity: 60 + Math.floor(Math.random() * 30),
        rainVolume: forceRain ? 5 + Math.random() * 8 : 2 + Math.random() * 10,
        isRaining: true,
      });
      return;
    }
    
    // Modo real: consultar OpenWeatherMap
    try {
      const url = `https://api.openweathermap.org/data/2.5/weather?lat=${MEXICO_CITY_CENTER.lat}&lon=${MEXICO_CITY_CENTER.lng}&appid=${OPENWEATHER_API_KEY}&units=metric&lang=es`;
      const res = await fetch(url);
      
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        console.error('OpenWeatherMap API error:', res.status, errorData);
        throw new Error(`Weather API error: ${res.status} - ${errorData.message || 'Unknown error'}`);
      }
      
      const data = await res.json();
      const weatherCode = data.weather?.[0]?.id || 0;
      const rainVolume = data.rain?.['1h'] || (data.rain?.['3h'] ? data.rain['3h'] / 3 : 0) || 0;
      const raining = isRainyWeatherCode(weatherCode) || rainVolume > 0;
      
      setIsRaining(raining);
      setWeatherInfo({
        description: data.weather?.[0]?.description || '',
        temp: data.main?.temp,
        humidity: data.main?.humidity,
        rainVolume,
        windSpeed: data.wind?.speed,
        cloudiness: data.clouds?.all,
      });
      
      // Si llueve, crear zonas basadas en la intensidad
      if (raining) {
        const intensity = classifyIntensity(rainVolume);
        // Crear 1-3 zonas de lluvia centradas en CDMX
        const zones = [
          {
            id: 'weather-main',
            lat: MEXICO_CITY_CENTER.lat,
            lng: MEXICO_CITY_CENTER.lng,
            radius: 1200,
            intensity,
            isRaining: true,
            name: 'Centro CDMX',
          },
        ];
        
        // Si es lluvia media o fuerte, agregar más zonas
        if (intensity !== 'light') {
          zones.push({
            id: 'weather-north',
            lat: MEXICO_CITY_CENTER.lat + 0.02,
            lng: MEXICO_CITY_CENTER.lng - 0.015,
            radius: 800,
            intensity,
            isRaining: true,
            name: 'Norte CDMX',
          });
        }
        
        if (intensity === 'heavy') {
          zones.push({
            id: 'weather-south',
            lat: MEXICO_CITY_CENTER.lat - 0.018,
            lng: MEXICO_CITY_CENTER.lng + 0.01,
            radius: 700,
            intensity,
            isRaining: true,
            name: 'Sur CDMX',
          });
        }
        
        setRainZones(zones);
      } else {
        setRainZones([]);
      }
    } catch (e) {
      console.error('Error fetching weather:', e);
      console.warn('⚠️ Fallback a modo simulación por error en OpenWeatherMap API');
      
      // Fallback a simulación si la API falla
      const numZones = 2 + Math.floor(Math.random() * 3);
      const shuffled = [...SIMULATED_RAIN_ZONES].sort(() => Math.random() - 0.5);
      const intensities = ['light', 'medium', 'heavy'];
      const selectedZones = shuffled.slice(0, numZones).map(zone => ({
        ...zone,
        intensity: intensities[Math.floor(Math.random() * intensities.length)],
        isRaining: true,
      }));
      
      setIsRaining(true);
      setRainZones(selectedZones);
      setWeatherInfo({
        description: 'Lluvia simulada (API no disponible)',
        temp: 18 + Math.floor(Math.random() * 8),
        humidity: 60 + Math.floor(Math.random() * 30),
        rainVolume: 2 + Math.random() * 10,
        isRaining: true,
      });
      setError('OpenWeatherMap API no disponible - usando simulación');
    }
  }, [isSimulation, forceRain]);

  // ─────────────────────────────────────────────────────────────────────────────
  // FETCH GRID DE INUNDACIONES (Backend)
  // ─────────────────────────────────────────────────────────────────────────────
  
  const fetchFloodGrid = useCallback(async () => {
    if (isSimulation) {
      // Simulación: generar grid basado en zonas de lluvia
      const grid = generateSimulatedFloodGrid(rainZones);
      setFloodGrid(grid);
      return;
    }
    
    // Modo real: consultar backend
    try {
      const url = `${BACKEND_URL}/api/flood/geojson/grid?raining=${isRaining}`;
      const res = await fetch(url);
      
      if (!res.ok) throw new Error('Error fetching flood grid');
      
      const data = await res.json();
      setFloodGrid(data);
    } catch (e) {
      console.error('Error fetching flood grid:', e);
      // Fallback a simulación si el backend falla
      const grid = generateSimulatedFloodGrid(rainZones);
      setFloodGrid(grid);
    }
  }, [isSimulation, isRaining, rainZones]);

  // ─────────────────────────────────────────────────────────────────────────────
  // FETCH REPORTES (Backend)
  // ─────────────────────────────────────────────────────────────────────────────
  
  const fetchReports = useCallback(async () => {
    if (isSimulation) {
      setReports(generateSimulatedReports());
      return;
    }
    
    try {
      const url = `${BACKEND_URL}/api/flood/geojson/reports`;
      const res = await fetch(url);
      
      if (!res.ok) throw new Error('Error fetching reports');
      
      const data = await res.json();
      
      // Convertir GeoJSON a array de reportes
      const reportsList = data.features?.map(f => ({
        id: f.properties.id,
        lat: f.geometry.coordinates[1],
        lng: f.geometry.coordinates[0],
        severity: f.properties.severity,
        severityValue: f.properties.severityValue,
        description: f.properties.description,
        upvotes: f.properties.upvotes,
        createdAt: f.properties.createdAt,
        expiresAt: f.properties.expiresAt,
        color: f.properties.color,
        radius: f.properties.radius,
      })) || [];
      
      setReports(reportsList);
    } catch (e) {
      console.error('Error fetching reports:', e);
      // Fallback a simulación
      setReports(generateSimulatedReports());
    }
  }, [isSimulation]);

  // ─────────────────────────────────────────────────────────────────────────────
  // CREAR REPORTE (Backend)
  // ─────────────────────────────────────────────────────────────────────────────
  
  const createReport = useCallback(async (lat, lng, severity, description = '') => {
    if (isSimulation) {
      // Simulación: agregar reporte local
      const newReport = {
        id: Date.now(),
        lat,
        lng,
        severity,
        severityValue: severity === 'LEVE' ? 0.3 : severity === 'MODERADO' ? 0.6 : 1.0,
        description,
        upvotes: 0,
        createdAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 6 * 3600000).toISOString(),
        color: severity === 'LEVE' ? '#4CAF50' : severity === 'MODERADO' ? '#FF9800' : '#F44336',
        radius: severity === 'LEVE' ? 8 : severity === 'MODERADO' ? 12 : 16,
      };
      setReports(prev => [...prev, newReport]);
      return newReport;
    }
    
    try {
      const res = await fetch(`${BACKEND_URL}/api/flood/reports`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lat, lng, severity, description }),
      });
      
      if (!res.ok) throw new Error('Error creating report');
      
      const newReport = await res.json();
      
      // Refrescar lista de reportes
      await fetchReports();
      
      return newReport;
    } catch (e) {
      console.error('Error creating report:', e);
      throw e;
    }
  }, [isSimulation, fetchReports]);

  // ─────────────────────────────────────────────────────────────────────────────
  // UPVOTE REPORTE (Backend)
  // ─────────────────────────────────────────────────────────────────────────────
  
  const upvoteReport = useCallback(async (reportId) => {
    if (isSimulation) {
      // Simulación: incrementar localmente
      setReports(prev => prev.map(r => 
        r.id === reportId ? { ...r, upvotes: r.upvotes + 1 } : r
      ));
      return;
    }
    
    try {
      const res = await fetch(`${BACKEND_URL}/api/flood/reports/${reportId}/upvote`, {
        method: 'POST',
      });
      
      if (!res.ok) throw new Error('Error upvoting report');
      
      // Refrescar reportes
      await fetchReports();
    } catch (e) {
      console.error('Error upvoting report:', e);
    }
  }, [isSimulation, fetchReports]);

  // ─────────────────────────────────────────────────────────────────────────────
  // CONSULTAR RIESGO EN UN PUNTO (Backend)
  // ─────────────────────────────────────────────────────────────────────────────
  
  const getRiskAtPoint = useCallback(async (lat, lng) => {
    if (isSimulation) {
      // Calcular riesgo basado en cercanía a zonas de lluvia
      let risk = 0;
      for (const zone of rainZones) {
        const dist = Math.sqrt(
          Math.pow((lat - zone.lat) * 111000, 2) + 
          Math.pow((lng - zone.lng) * 111000 * Math.cos(lat * Math.PI / 180), 2)
        );
        if (dist < zone.radius * 1.5) {
          const zoneRisk = (1 - dist / (zone.radius * 1.5)) * 0.8;
          risk = Math.max(risk, zoneRisk);
        }
      }
      return {
        lat, lng, risk,
        nivel_riesgo: risk > 0.6 ? 'alto' : risk > 0.3 ? 'medio' : 'bajo',
        descripcion: risk > 0.6 ? 'Zona de alto riesgo' : risk > 0.3 ? 'Riesgo moderado' : 'Riesgo bajo',
      };
    }
    
    try {
      const url = `${BACKEND_URL}/api/flood/risk?lat=${lat}&lng=${lng}&raining=${isRaining}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error('Error fetching risk');
      return await res.json();
    } catch (e) {
      console.error('Error fetching risk:', e);
      return { lat, lng, risk: 0, nivel_riesgo: 'desconocido', descripcion: 'Error' };
    }
  }, [isSimulation, isRaining, rainZones]);

  // ─────────────────────────────────────────────────────────────────────────────
  // EFECTOS: INICIALIZACIÓN Y POLLING
  // ─────────────────────────────────────────────────────────────────────────────
  
  // Fetch inicial
  useEffect(() => {
    const init = async () => {
      setLoading(true);
      await fetchWeather();
      setLoading(false);
    };
    init();
  }, [fetchWeather]);
  
  // Fetch flood grid cuando cambian las zonas de lluvia
  useEffect(() => {
    if (rainZones.length > 0 || !isSimulation) {
      fetchFloodGrid();
    }
  }, [rainZones, fetchFloodGrid, isSimulation]);
  
  // Fetch reportes inicial
  useEffect(() => {
    fetchReports();
  }, [fetchReports]);
  
  // Polling intervals
  useEffect(() => {
    // Limpiar intervalos anteriores
    if (weatherIntervalRef.current) clearInterval(weatherIntervalRef.current);
    if (floodIntervalRef.current) clearInterval(floodIntervalRef.current);
    if (reportsIntervalRef.current) clearInterval(reportsIntervalRef.current);
    
    // Configurar nuevos intervalos
    weatherIntervalRef.current = setInterval(fetchWeather, WEATHER_UPDATE_INTERVAL);
    floodIntervalRef.current = setInterval(fetchFloodGrid, FLOOD_UPDATE_INTERVAL);
    reportsIntervalRef.current = setInterval(fetchReports, REPORTS_UPDATE_INTERVAL);
    
    return () => {
      if (weatherIntervalRef.current) clearInterval(weatherIntervalRef.current);
      if (floodIntervalRef.current) clearInterval(floodIntervalRef.current);
      if (reportsIntervalRef.current) clearInterval(reportsIntervalRef.current);
    };
  }, [fetchWeather, fetchFloodGrid, fetchReports]);

  // ─────────────────────────────────────────────────────────────────────────────
  // REFETCH MANUAL
  // ─────────────────────────────────────────────────────────────────────────────
  
  const refetch = useCallback(async () => {
    setLoading(true);
    await Promise.all([fetchWeather(), fetchFloodGrid(), fetchReports()]);
    setLoading(false);
  }, [fetchWeather, fetchFloodGrid, fetchReports]);

  return {
    // Estado
    isRaining,
    rainZones,
    floodGrid,
    reports,
    weatherInfo,
    loading,
    error,
    
    // Acciones
    createReport,
    upvoteReport,
    getRiskAtPoint,
    refetch,
  };
}
