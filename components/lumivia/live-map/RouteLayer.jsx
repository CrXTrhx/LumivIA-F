import { useState, useEffect, useRef, useCallback } from 'react';
import mapboxgl from 'mapbox-gl';
import { convertFloodDataToExcludePolygons } from './utils/floodToPolygons';
import { validateMultipleRoutes, getValidationSummary } from './utils/routeFloodValidator';

// ═══════════════════════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════════

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN_LIVE_MAP || '';
const MOBILE_BREAKPOINT = 768;
const BACKEND_URL = 'http://localhost:8080';

const BACKEND_API_URL = `${BACKEND_URL}/api/ruta`;

// Route colors (Mapbox paint properties)
const ROUTE_COLORS = {
  saludable: '#22C55E',      // Green
  saludableBorder: '#166534', // Dark green
  rapida: '#EF4444',         // Red
  rapidaBorder: '#991B1B',   // Dark red
};

const FLOOD_OVERLAY_IDS = {
  source: 'flood-exclusion-zones',
  fill: 'flood-exclusion-fill',
  line: 'flood-exclusion-line',
};

// Marker colors
const MARKER_COLORS = {
  destino: '#22C55E',
};

// Destinos simulados (para demo)
const DESTINOS_SIMULADOS = [
  { nombre: 'Torre Latinoamericana', coordenadas: [-99.1405, 19.4339] },
  { nombre: 'Palacio de Bellas Artes', coordenadas: [-99.1413, 19.4353] },
  { nombre: 'Zócalo CDMX', coordenadas: [-99.1332, 19.4326] },
  { nombre: 'Monumento a la Revolución', coordenadas: [-99.1547, 19.4362] },
  { nombre: 'Ángel de la Independencia', coordenadas: [-99.1677, 19.4271] },
];

// ═══════════════════════════════════════════════════════════════════════════════
// MANEUVER ICONS (SVG)
// ═══════════════════════════════════════════════════════════════════════════════

const MANEUVER_ICONS = {
  'turn-right': `<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18V6"/><path d="M9 6l6 6-6 6"/></svg>`,
  'turn-left': `<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M15 18V6"/><path d="M15 6l-6 6 6 6"/></svg>`,
  'straight': `<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 19V5"/><path d="M5 12l7-7 7 7"/></svg>`,
  'arrive': `<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 8v4"/><circle cx="12" cy="16" r="1"/></svg>`,
  'depart': `<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M12 2v4"/><path d="M12 18v4"/><path d="M4.93 4.93l2.83 2.83"/><path d="M16.24 16.24l2.83 2.83"/><path d="M2 12h4"/><path d="M18 12h4"/><path d="M4.93 19.07l2.83-2.83"/><path d="M16.24 7.76l2.83-2.83"/></svg>`,
  'roundabout': `<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v6"/><path d="M12 16v6"/></svg>`,
  'merge': `<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M6 20V10l6-6 6 6v10"/></svg>`,
  'fork': `<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20V10"/><path d="M6 4l6 6 6-6"/></svg>`,
  'default': `<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>`,
};

// ═══════════════════════════════════════════════════════════════════════════════
// UTILITIES
// ═══════════════════════════════════════════════════════════════════════════════

function formatNumber(num) {
  if (num >= 1000) {
    return num.toLocaleString('es-MX', { maximumFractionDigits: 0 });
  }
  return num.toFixed(1);
}

function formatDistance(meters) {
  if (meters >= 1000) {
    return `${(meters / 1000).toFixed(1)} km`;
  }
  return `${Math.round(meters)} m`;
}

function formatDuration(seconds) {
  const mins = Math.round(seconds / 60);
  if (mins >= 60) {
    const hrs = Math.floor(mins / 60);
    const remainMins = mins % 60;
    return `${hrs}h ${remainMins}min`;
  }
  return `${mins} min`;
}

// Haversine distance between two coordinates
function haversineDistance(coord1, coord2) {
  const R = 6371000; // Earth radius in meters
  const lat1 = coord1[1] * Math.PI / 180;
  const lat2 = coord2[1] * Math.PI / 180;
  const dLat = (coord2[1] - coord1[1]) * Math.PI / 180;
  const dLon = (coord2[0] - coord1[0]) * Math.PI / 180;
  
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(lat1) * Math.cos(lat2) *
            Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  
  return R * c;
}

// Calculate bearing between two coordinates (for camera rotation)
function calculateBearing(from, to) {
  const lon1 = from[0] * Math.PI / 180;
  const lon2 = to[0] * Math.PI / 180;
  const lat1 = from[1] * Math.PI / 180;
  const lat2 = to[1] * Math.PI / 180;
  
  const y = Math.sin(lon2 - lon1) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2) -
            Math.sin(lat1) * Math.cos(lat2) * Math.cos(lon2 - lon1);
  
  let bearing = Math.atan2(y, x) * 180 / Math.PI;
  return (bearing + 360) % 360; // Normalize to 0-360
}

// Find closest point on route to user position
function findClosestPointOnRoute(userPos, routeCoords) {
  let minDist = Infinity;
  let closestIdx = 0;
  
  for (let i = 0; i < routeCoords.length; i++) {
    const dist = haversineDistance(userPos, routeCoords[i]);
    if (dist < minDist) {
      minDist = dist;
      closestIdx = i;
    }
  }
  
  return { index: closestIdx, distance: minDist };
}

// Get maneuver icon based on type
function getManeuverIcon(type, modifier) {
  if (type === 'arrive') return MANEUVER_ICONS.arrive;
  if (type === 'depart') return MANEUVER_ICONS.depart;
  if (type === 'roundabout' || type === 'rotary') return MANEUVER_ICONS.roundabout;
  if (type === 'merge') return MANEUVER_ICONS.merge;
  if (type === 'fork') return MANEUVER_ICONS.fork;
  
  if (modifier?.includes('right')) return MANEUVER_ICONS['turn-right'];
  if (modifier?.includes('left')) return MANEUVER_ICONS['turn-left'];
  if (modifier?.includes('straight') || type === 'continue') return MANEUVER_ICONS.straight;
  
  return MANEUVER_ICONS.default;
}

// Calculate emissions based on congestion (simulation)
function calculateEmissionsFromCongestion(annotations, distance) {
  if (!annotations?.congestion) {
    // Default: moderate emissions based on distance
    return Math.round(distance * 0.12); // ~120g CO2 per km
  }
  
  const congestionFactors = {
    'unknown': 0.10,
    'low': 0.08,
    'moderate': 0.12,
    'heavy': 0.18,
    'severe': 0.25,
  };
  
  let totalEmissions = 0;
  const segmentLength = distance / annotations.congestion.length;
  
  for (const level of annotations.congestion) {
    const factor = congestionFactors[level] || 0.12;
    totalEmissions += segmentLength * factor;
  }
  
  return Math.round(totalEmissions);
}

// ═══════════════════════════════════════════════════════════════════════════════
// API FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════════

// Fetch directions from Mapbox API
async function fetchDirections(origin, destination, profile = 'driving-traffic', excludeGeometry = null) {
  const params = {
    access_token: MAPBOX_TOKEN,
    alternatives: 'true',
    geometries: 'geojson',
    overview: 'full',
    steps: 'true',
    annotations: 'congestion,duration,distance',
    language: 'es',
  };
  
  // Add exclude parameter if flood polygons provided
  if (excludeGeometry && excludeGeometry.features && excludeGeometry.features.length > 0) {
    const excludeString = JSON.stringify(excludeGeometry);
    console.log(`[fetchDirections] Excluyendo ${excludeGeometry.features.length} polígonos de inundación (${excludeString.length} chars)`);
    params.exclude = excludeString;
  }
  
  const url = `https://api.mapbox.com/directions/v5/mapbox/${profile}/${origin[0]},${origin[1]};${destination[0]},${destination[1]}?` +
    new URLSearchParams(params);

  try {
    const res = await fetch(url);
    const data = await res.json();
    
    if (data.code !== 'Ok' || !data.routes?.length) {
      console.error('Directions API error:', data);
      return null;
    }
    
    return data;
  } catch (e) {
    console.error('Fetch directions error:', e);
    return null;
  }
}

// Generate simulated route (using Mapbox Directions)
async function generarRutaSimulada(origen, destino, floodData = null) {
  let excludePolygons = null;
  
  // Generate flood exclusion polygons if flood data provided
  if (floodData && (floodData.floodGrid || floodData.reports)) {
    console.log('🌊 [generarRutaSimulada] Generando polígonos de exclusión de inundaciones...');
    excludePolygons = convertFloodDataToExcludePolygons(
      floodData.floodGrid,
      floodData.reports
    );
    
    if (excludePolygons && excludePolygons.features.length > 0) {
      console.log(`🛡️ [generarRutaSimulada] ${excludePolygons.features.length} polígonos de exclusión creados`);
    } else {
      console.log('✅ [generarRutaSimulada] No hay inundaciones de alto riesgo para evitar');
      excludePolygons = null;
    }
  }
  
  // Fetch real directions from Mapbox (with flood exclusions)
  let data = await fetchDirections(origen, destino, 'driving-traffic', excludePolygons);
  
  // If no routes found with exclusions, try without (unavoidable flood scenario)
  if (!data && excludePolygons && excludePolygons.features.length > 0) {
    console.warn('⚠️ [generarRutaSimulada] No se encontró ruta evitando inundaciones, intentando sin exclusiones...');
    data = await fetchDirections(origen, destino, 'driving-traffic', null);
    
    if (data) {
      console.warn('⚠️ [generarRutaSimulada] Ruta generada atraviesa zonas inundadas (inevitables)');
    }
  }
  
  if (!data || !data.routes?.length) {
    return null;
  }
  
  const rutaPrincipal = data.routes[0];
  const rutaAlternativa = data.routes[1] || data.routes[0]; // Use same if no alternative
  
  // Calculate emissions (simulated based on congestion)
  const emisionesPrincipal = calculateEmissionsFromCongestion(
    rutaPrincipal.legs[0]?.annotation,
    rutaPrincipal.distance
  );
  
  const emisionesAlternativa = calculateEmissionsFromCongestion(
    rutaAlternativa.legs[0]?.annotation,
    rutaAlternativa.distance
  );
  
  // Determine which is "healthier" (less emissions)
  const principalEsSaludable = emisionesPrincipal <= emisionesAlternativa;
  
  const saludable = principalEsSaludable ? rutaPrincipal : rutaAlternativa;
  const rapida = principalEsSaludable ? rutaAlternativa : rutaPrincipal;
  const emisionesSaludable = principalEsSaludable ? emisionesPrincipal : emisionesAlternativa;
  const emisionesRapida = principalEsSaludable ? emisionesAlternativa : emisionesPrincipal;
  
  return {
    ruta_saludable: {
      coordenadas: saludable.geometry.coordinates,
      distancia_km: saludable.distance / 1000,
      tiempo_estimado_min: Math.round(saludable.duration / 60),
      nivel_riesgo: emisionesSaludable < 500 ? 'bajo' : emisionesSaludable < 1000 ? 'medio' : 'alto',
      emisiones_ruta: { co2: emisionesSaludable, nox: emisionesSaludable * 0.003, pm25: emisionesSaludable * 0.0001 },
      descripcion: `Ruta saludable: ${formatDistance(saludable.distance)}, ${formatDuration(saludable.duration)}`,
      steps: saludable.legs[0]?.steps || [],
      duration: saludable.duration,
      distance: saludable.distance,
      geometry: saludable.geometry, // Add full geometry for validation
    },
    ruta_rapida: {
      coordenadas: rapida.geometry.coordinates,
      distancia_km: rapida.distance / 1000,
      tiempo_estimado_min: Math.round(rapida.duration / 60),
      nivel_riesgo: emisionesRapida < 500 ? 'bajo' : emisionesRapida < 1000 ? 'medio' : 'alto',
      emisiones_ruta: { co2: emisionesRapida, nox: emisionesRapida * 0.003, pm25: emisionesRapida * 0.0001 },
      descripcion: `Ruta rápida: ${formatDistance(rapida.distance)}, ${formatDuration(rapida.duration)}`,
      steps: rapida.legs[0]?.steps || [],
      duration: rapida.duration,
      distance: rapida.distance,
      geometry: rapida.geometry, // Add full geometry for validation
    },
    ahorro_co2: Math.max(0, emisionesRapida - emisionesSaludable),
    tiempo_extra_min: Math.max(0, Math.round((saludable.duration - rapida.duration) / 60)),
    destino_nombre: 'Destino asignado',
    destino_direccion: `${destino[1].toFixed(4)}, ${destino[0].toFixed(4)}`,
    excludePolygons, // Include for visualization
  };
}

// Fetch route from backend (modo real)
async function fetchRutaDesdeBackend(origen, destino) {
  try {
    const res = await fetch(BACKEND_API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        origen: { lat: origen[1], lng: origen[0] },
        destino: { lat: destino[1], lng: destino[0] },
        perfil: 'PEATON',
      }),
    });
    
    if (!res.ok) {
      console.error('Backend route error:', res.status);
      return null;
    }
    
    const data = await res.json();
    
    // El backend ya devuelve en el formato correcto
    // Solo necesitamos agregar steps (para turn-by-turn) desde Mapbox
    const mapboxData = await fetchDirections(origen, destino, 'driving-traffic');
    
    if (mapboxData && mapboxData.routes?.length > 0) {
      data.ruta_saludable.steps = mapboxData.routes[0].legs[0]?.steps || [];
      data.ruta_saludable.duration = data.ruta_saludable.tiempo_estimado_min * 60;
      data.ruta_saludable.distance = data.ruta_saludable.distancia_km * 1000;
      
      if (mapboxData.routes[1]) {
        data.ruta_rapida.steps = mapboxData.routes[1].legs[0]?.steps || [];
      } else {
        data.ruta_rapida.steps = mapboxData.routes[0].legs[0]?.steps || [];
      }
      data.ruta_rapida.duration = data.ruta_rapida.tiempo_estimado_min * 60;
      data.ruta_rapida.distance = data.ruta_rapida.distancia_km * 1000;
    }
    
    return data;
  } catch (e) {
    console.error('Error fetching route from backend:', e);
    return null;
  }
}

function procesarRutaConValidacion(ruta, floodData) {
  if (!ruta) return ruta;

  const rutaProcesada = {
    ...ruta,
    ruta_saludable: { ...ruta.ruta_saludable },
    ruta_rapida: { ...ruta.ruta_rapida },
  };

  if (!floodData) {
    return rutaProcesada;
  }

  try {
    const routesForValidation = [
      {
        nombre: 'ruta_saludable',
        geometry: rutaProcesada.ruta_saludable.geometry || {
          type: 'LineString',
          coordinates: rutaProcesada.ruta_saludable.coordenadas || [],
        },
      },
      {
        nombre: 'ruta_rapida',
        geometry: rutaProcesada.ruta_rapida.geometry || {
          type: 'LineString',
          coordinates: rutaProcesada.ruta_rapida.coordenadas || [],
        },
      },
    ];

    const validated = validateMultipleRoutes(
      routesForValidation,
      floodData,
      rutaProcesada.excludePolygons || null
    );

    rutaProcesada.ruta_saludable.floodValidation = validated[0]?.floodValidation || null;
    rutaProcesada.ruta_rapida.floodValidation = validated[1]?.floodValidation || null;
    rutaProcesada.ruta_saludable.floodSummary = getValidationSummary(rutaProcesada.ruta_saludable.floodValidation);
    rutaProcesada.ruta_rapida.floodSummary = getValidationSummary(rutaProcesada.ruta_rapida.floodValidation);

    rutaProcesada.floodStatus = {
      zonasEvitadas: rutaProcesada.ruta_saludable.floodValidation?.zonesEvaded || 0,
      zonasCruzadas: rutaProcesada.ruta_saludable.floodValidation?.zonesCrossed || 0,
      rutaSegura: rutaProcesada.ruta_saludable.floodValidation?.isSafe ?? true,
      riesgo: rutaProcesada.ruta_saludable.floodValidation?.riskLevel || 'bajo',
    };
  } catch (e) {
    console.warn('[RouteLayer] Error validando rutas contra inundaciones:', e);
  }

  return rutaProcesada;
}

function sanitizeForRoutingFloodData(floodData) {
  if (!floodData) return null;

  const riskThreshold = 0.6;
  const floodGrid = floodData.floodGrid
    ? {
        ...floodData.floodGrid,
        features: (floodData.floodGrid.features || []).filter(
          (feature) => (feature?.properties?.risk || 0) > riskThreshold
        ),
      }
    : null;

  const reports = Array.isArray(floodData.reports)
    ? floodData.reports.filter(
        (report) => report?.severity === 'MODERADO' || report?.severity === 'SEVERO'
      )
    : [];

  const hasData = (floodGrid?.features?.length || 0) > 0 || reports.length > 0;
  if (!hasData) return null;

  return {
    floodGrid,
    reports,
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAP LAYER FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════════

function addRouteLayer(map, id, coordinates, color, width, opacity = 1) {
  // Remove existing if any
  removeRouteLayer(map, id);
  
  // Add source
  map.addSource(id, {
    type: 'geojson',
    data: {
      type: 'Feature',
      properties: {},
      geometry: {
        type: 'LineString',
        coordinates: coordinates,
      },
    },
  });
  
  // Add border layer
  map.addLayer({
    id: `${id}-border`,
    type: 'line',
    source: id,
    layout: {
      'line-join': 'round',
      'line-cap': 'round',
    },
    paint: {
      'line-color': color === ROUTE_COLORS.saludable ? ROUTE_COLORS.saludableBorder : ROUTE_COLORS.rapidaBorder,
      'line-width': width + 4,
      'line-opacity': opacity,
    },
  });
  
  // Add main layer
  map.addLayer({
    id: id,
    type: 'line',
    source: id,
    layout: {
      'line-join': 'round',
      'line-cap': 'round',
    },
    paint: {
      'line-color': color,
      'line-width': width,
      'line-opacity': opacity,
    },
  });
}

function removeRouteLayer(map, id) {
  if (!map) return;
  
  try {
    if (map.getLayer(id)) map.removeLayer(id);
    if (map.getLayer(`${id}-border`)) map.removeLayer(`${id}-border`);
    if (map.getSource(id)) map.removeSource(id);
  } catch (e) {
    // Layer might not exist
  }
}

function addFloodExclusionOverlay(map, excludePolygons) {
  if (!map) return;
  removeFloodExclusionOverlay(map);

  if (!excludePolygons?.features?.length) return;

  try {
    map.addSource(FLOOD_OVERLAY_IDS.source, {
      type: 'geojson',
      data: excludePolygons,
    });

    map.addLayer({
      id: FLOOD_OVERLAY_IDS.fill,
      type: 'fill',
      source: FLOOD_OVERLAY_IDS.source,
      paint: {
        'fill-color': '#DC2626',
        'fill-opacity': 0.2,
      },
    });

    map.addLayer({
      id: FLOOD_OVERLAY_IDS.line,
      type: 'line',
      source: FLOOD_OVERLAY_IDS.source,
      paint: {
        'line-color': '#B91C1C',
        'line-width': 2,
        'line-opacity': 0.75,
      },
    });
  } catch (e) {
    console.warn('[RouteLayer] No se pudo agregar overlay de exclusión de inundaciones', e);
  }
}

function removeFloodExclusionOverlay(map) {
  if (!map) return;

  try {
    if (map.getLayer(FLOOD_OVERLAY_IDS.fill)) map.removeLayer(FLOOD_OVERLAY_IDS.fill);
    if (map.getLayer(FLOOD_OVERLAY_IDS.line)) map.removeLayer(FLOOD_OVERLAY_IDS.line);
    if (map.getSource(FLOOD_OVERLAY_IDS.source)) map.removeSource(FLOOD_OVERLAY_IDS.source);
  } catch (e) {
    // ignore cleanup race conditions
  }
}

// Split route into traveled and remaining segments
function updateProgressiveLayers(map, routeCoords, currentIndex) {
  if (!map || !routeCoords || currentIndex < 0) return;
  
  // Traveled portion (0 to currentIndex) - opaque gray
  const traveledCoords = routeCoords.slice(0, currentIndex + 1);
  if (traveledCoords.length > 1) {
    if (!map.getSource('ruta-recorrida')) {
      map.addSource('ruta-recorrida', {
        type: 'geojson',
        data: {
          type: 'Feature',
          properties: {},
          geometry: { type: 'LineString', coordinates: traveledCoords },
        },
      });
      
      map.addLayer({
        id: 'ruta-recorrida-border',
        type: 'line',
        source: 'ruta-recorrida',
        layout: { 'line-join': 'round', 'line-cap': 'round' },
        paint: {
          'line-color': '#6B7280',
          'line-width': 12,
          'line-opacity': 0.5,
        },
      });
      
      map.addLayer({
        id: 'ruta-recorrida',
        type: 'line',
        source: 'ruta-recorrida',
        layout: { 'line-join': 'round', 'line-cap': 'round' },
        paint: {
          'line-color': '#9CA3AF',
          'line-width': 8,
          'line-opacity': 0.6,
        },
      });
    } else {
      map.getSource('ruta-recorrida').setData({
        type: 'Feature',
        properties: {},
        geometry: { type: 'LineString', coordinates: traveledCoords },
      });
    }
  }
  
  // Remaining portion (currentIndex to end) - bright green
  const remainingCoords = routeCoords.slice(currentIndex);
  if (remainingCoords.length > 1) {
    if (!map.getSource('ruta-restante')) {
      map.addSource('ruta-restante', {
        type: 'geojson',
        data: {
          type: 'Feature',
          properties: {},
          geometry: { type: 'LineString', coordinates: remainingCoords },
        },
      });
      
      map.addLayer({
        id: 'ruta-restante-border',
        type: 'line',
        source: 'ruta-restante',
        layout: { 'line-join': 'round', 'line-cap': 'round' },
        paint: {
          'line-color': ROUTE_COLORS.saludableBorder,
          'line-width': 12,
          'line-opacity': 1,
        },
      });
      
      map.addLayer({
        id: 'ruta-restante',
        type: 'line',
        source: 'ruta-restante',
        layout: { 'line-join': 'round', 'line-cap': 'round' },
        paint: {
          'line-color': ROUTE_COLORS.saludable,
          'line-width': 8,
          'line-opacity': 1,
        },
      });
    } else {
      map.getSource('ruta-restante').setData({
        type: 'Feature',
        properties: {},
        geometry: { type: 'LineString', coordinates: remainingCoords },
      });
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

export default function RouteLayer({ map, activeLayer, isSimulation = true, floodData = null }) {
  // Responsive state
  const [isMobile, setIsMobile] = useState(false);
  const [isExpanded, setIsExpanded] = useState(true);
  
  // GPS states
  const [modo, setModo] = useState('cargando'); // 'cargando' | 'preview' | 'navegando' | 'finalizado'
  const [ubicacionUsuario, setUbicacionUsuario] = useState(null);
  const [ubicacionError, setUbicacionError] = useState(null);
  const [rutaAsignada, setRutaAsignada] = useState(null);
  const [destinoSimulado, setDestinoSimulado] = useState(null);
  
  // Navigation states
  const [instrucciones, setInstrucciones] = useState([]);
  const [instruccionActual, setInstruccionActual] = useState(null);
  const [instruccionIndex, setInstruccionIndex] = useState(0);
  const [progreso, setProgreso] = useState({ distancia: 0, tiempo: 0 });
  const [haLlegado, setHaLlegado] = useState(false);
  
  // Refs
  const geolocateControlRef = useRef(null);
  const markersRef = useRef({ destino: null });
  const rutasCargadasRef = useRef(false);
  const simIndexRef = useRef(0);
  
  const isActive = activeLayer === 'routes';
  const hasPersistentRoute = Boolean(rutaAsignada);
  const shouldKeepGpsTracking = isActive || hasPersistentRoute || modo === 'navegando' || modo === 'finalizado';

  // ─────────────────────────────────────────────────────────────────────────────
  // MOBILE DETECTION
  // ─────────────────────────────────────────────────────────────────────────────

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth <= MOBILE_BREAKPOINT);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // ─────────────────────────────────────────────────────────────────────────────
  // GEOLOCATE CONTROL
  // ─────────────────────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!map || !shouldKeepGpsTracking) return;
    
    // Create GeolocateControl
    const geolocate = new mapboxgl.GeolocateControl({
      positionOptions: {
        enableHighAccuracy: true,
        timeout: 10000,
      },
      trackUserLocation: true,
      showUserHeading: true,
      showUserLocation: true,
      showAccuracyCircle: false,
    });
    
    map.addControl(geolocate, 'top-right');
    geolocateControlRef.current = geolocate;
    
    // Listen for position updates
    geolocate.on('geolocate', (e) => {
      const newPos = [e.coords.longitude, e.coords.latitude];
      setUbicacionUsuario(newPos);
      setUbicacionError(null);
    });
    
    geolocate.on('error', (e) => {
      console.error('Geolocation error:', e);
      setUbicacionError('No se pudo obtener tu ubicación');
    });
    
    // Trigger geolocation after map is idle
    const triggerGeolocate = () => {
      setTimeout(() => {
        geolocate.trigger();
      }, 500);
    };
    
    if (map.loaded()) {
      triggerGeolocate();
    } else {
      map.once('load', triggerGeolocate);
    }
    
    return () => {
      if (geolocateControlRef.current && map) {
        try {
          map.removeControl(geolocateControlRef.current);
        } catch (e) {}
        geolocateControlRef.current = null;
      }
    };
  }, [map, shouldKeepGpsTracking]);

  // ─────────────────────────────────────────────────────────────────────────────
  // LOAD ROUTE WHEN USER LOCATION IS AVAILABLE
  // ─────────────────────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!map || !isActive || !ubicacionUsuario || rutasCargadasRef.current) return;
    if (!floodData) return;
    if (floodData?.loading) return;
    
    const cargarRuta = async () => {
      rutasCargadasRef.current = true;
      
      // Select random destination for simulation
      const destinoRandom = DESTINOS_SIMULADOS[Math.floor(Math.random() * DESTINOS_SIMULADOS.length)];
      setDestinoSimulado(destinoRandom);
      
      try {
        let ruta;
        const floodDataForRouting = sanitizeForRoutingFloodData(floodData);
        
        if (isSimulation) {
          // Modo simulación: usar Mapbox Directions directamente
          ruta = await generarRutaSimulada(ubicacionUsuario, destinoRandom.coordenadas, floodDataForRouting);
        } else {
          // Modo real: usar backend
          ruta = await fetchRutaDesdeBackend(ubicacionUsuario, destinoRandom.coordenadas);

          // En modo real, intentar optimizar con exclusión de inundaciones
          if (ruta && floodDataForRouting) {
            const rutaConExclusion = await generarRutaSimulada(
              ubicacionUsuario,
              destinoRandom.coordenadas,
              floodDataForRouting
            );

            if (rutaConExclusion) {
              console.log('🌊 [RouteLayer] Ruta real optimizada con exclusión de inundaciones');
              ruta = {
                ...rutaConExclusion,
                destino_nombre: ruta.destino_nombre || rutaConExclusion.destino_nombre,
                destino_direccion: ruta.destino_direccion || rutaConExclusion.destino_direccion,
              };
            }
          }
          
          // Si el backend falla, fallback a simulación
          if (!ruta) {
            console.warn('Backend route failed, falling back to simulation');
            ruta = await generarRutaSimulada(ubicacionUsuario, destinoRandom.coordenadas, floodDataForRouting);
          }
        }
        
        if (!ruta) {
          setUbicacionError('No se pudo calcular la ruta');
          return;
        }
        
        const rutaConValidacion = procesarRutaConValidacion(ruta, floodDataForRouting);
        setRutaAsignada(rutaConValidacion);
        setModo('preview');

        addFloodExclusionOverlay(map, rutaConValidacion.excludePolygons);
        
        // Draw routes on map
        // Ruta rápida (reference, dimmed)
        addRouteLayer(
          map,
          'ruta-rapida',
          rutaConValidacion.ruta_rapida.coordenadas,
          ROUTE_COLORS.rapida,
          6,
          0.4
        );
        
        // Ruta saludable (main route)
        addRouteLayer(
          map,
          'ruta-saludable',
          rutaConValidacion.ruta_saludable.coordenadas,
          ROUTE_COLORS.saludable,
          8,
          1
        );
        
        // Add destination marker
        if (markersRef.current.destino) {
          markersRef.current.destino.remove();
        }
        
        const destEl = document.createElement('div');
        destEl.innerHTML = `
          <svg width="32" height="42" viewBox="0 0 32 42" xmlns="http://www.w3.org/2000/svg">
            <ellipse cx="16" cy="40" rx="6" ry="2" fill="rgba(0,0,0,0.2)"/>
            <path d="M16 0C7.2 0 0 7.2 0 16c0 12 16 26 16 26s16-14 16-26c0-8.8-7.2-16-16-16z" fill="${MARKER_COLORS.destino}"/>
            <circle cx="16" cy="16" r="6" fill="#FFFFFF"/>
          </svg>`;
        destEl.style.cursor = 'pointer';
        
        markersRef.current.destino = new mapboxgl.Marker({ element: destEl, anchor: 'bottom' })
          .setLngLat(destinoRandom.coordenadas)
          .addTo(map);
        
        // Fit bounds to show route
        const allCoords = [
          ...rutaConValidacion.ruta_saludable.coordenadas,
          ...rutaConValidacion.ruta_rapida.coordenadas,
        ];
        const lngs = allCoords.map(c => c[0]);
        const lats = allCoords.map(c => c[1]);
        
        map.fitBounds(
          [[Math.min(...lngs), Math.min(...lats)], [Math.max(...lngs), Math.max(...lats)]],
          { padding: { top: 150, bottom: 200, left: 50, right: 50 }, duration: 1000 }
        );
        
      } catch (e) {
        console.error('Error loading route:', e);
        setUbicacionError('Error al cargar la ruta');
      }
    };
    
    cargarRuta();
  }, [map, isActive, ubicacionUsuario, isSimulation, floodData]);

  // ─────────────────────────────────────────────────────────────────────────────
  // NAVIGATION LOGIC
  // ─────────────────────────────────────────────────────────────────────────────

  const iniciarNavegacion = useCallback(() => {
    if (!rutaAsignada || !map) return;
    
    setModo('navegando');
    setHaLlegado(false);
    setInstruccionIndex(0);
    simIndexRef.current = 0;
    
    // Get instructions from route
    const steps = rutaAsignada.ruta_saludable.steps || [];
    setInstrucciones(steps);
    
    if (steps.length > 0) {
      setInstruccionActual({
        texto: steps[0].maneuver?.instruction || 'Inicia el recorrido',
        distancia: steps[0].distance || 0,
        icono: getManeuverIcon(steps[0].maneuver?.type, steps[0].maneuver?.modifier),
        calle: steps[0].name || '',
        tipo: steps[0].maneuver?.type || 'depart',
      });
    }
    
    setProgreso({
      distancia: rutaAsignada.ruta_saludable.distance,
      tiempo: rutaAsignada.ruta_saludable.duration,
    });
    
    // Remove fast route, keep only healthy route
    removeRouteLayer(map, 'ruta-rapida');
    
    // Hide original healthy route layer (we'll use progressive layers)
    if (map.getLayer('ruta-saludable')) {
      map.setLayoutProperty('ruta-saludable', 'visibility', 'none');
    }
    if (map.getLayer('ruta-saludable-border')) {
      map.setLayoutProperty('ruta-saludable-border', 'visibility', 'none');
    }
    
    // Adjust map view for navigation (Waze-style)
    if (ubicacionUsuario && rutaAsignada.ruta_saludable.coordenadas.length > 1) {
      // Calculate bearing from current position to next point
      const nextPoint = rutaAsignada.ruta_saludable.coordenadas[1];
      const bearing = calculateBearing(ubicacionUsuario, nextPoint);
      
      // Waze-style camera: high pitch, rotated to route direction, user at bottom third
      map.easeTo({
        center: ubicacionUsuario,
        zoom: 18.5,
        pitch: 65,
        bearing: bearing,
        duration: 1500,
        padding: { bottom: window.innerHeight * 0.35 }, // Usuario en tercio inferior
      });
    }
  }, [rutaAsignada, map, ubicacionUsuario]);

  // Update navigation based on user position
  useEffect(() => {
    if (modo !== 'navegando' || !ubicacionUsuario || !rutaAsignada || instrucciones.length === 0) return;
    
    const routeCoords = rutaAsignada.ruta_saludable.coordenadas;
    const destino = routeCoords[routeCoords.length - 1];
    
    // Check if arrived
    const distToDestino = haversineDistance(ubicacionUsuario, destino);
    if (distToDestino < 30) {
      setHaLlegado(true);
      setModo('finalizado');
      setInstruccionActual({
        texto: '¡Has llegado a tu destino!',
        distancia: 0,
        icono: MANEUVER_ICONS.arrive,
        calle: destinoSimulado?.nombre || 'Destino',
        tipo: 'arrive',
      });
      return;
    }
    
    // Find current position on route
    const { index: closestIdx } = findClosestPointOnRoute(ubicacionUsuario, routeCoords);
    
    // Update progressive route visualization (Waze-style)
    updateProgressiveLayers(map, routeCoords, closestIdx);
    
    // Calculate remaining distance
    let remainingDist = 0;
    for (let i = closestIdx; i < routeCoords.length - 1; i++) {
      remainingDist += haversineDistance(routeCoords[i], routeCoords[i + 1]);
    }
    
    // Estimate remaining time (based on average speed from route)
    const avgSpeed = rutaAsignada.ruta_saludable.distance / rutaAsignada.ruta_saludable.duration;
    const remainingTime = remainingDist / avgSpeed;
    
    setProgreso({
      distancia: remainingDist,
      tiempo: remainingTime,
    });
    
    // Find current instruction based on position
    let accumulatedDist = 0;
    let currentStepIdx = 0;
    
    for (let i = 0; i < instrucciones.length; i++) {
      accumulatedDist += instrucciones[i].distance || 0;
      if (accumulatedDist > (rutaAsignada.ruta_saludable.distance - remainingDist)) {
        currentStepIdx = i;
        break;
      }
    }
    
    if (currentStepIdx !== instruccionIndex && currentStepIdx < instrucciones.length) {
      const step = instrucciones[currentStepIdx];
      setInstruccionIndex(currentStepIdx);
      setInstruccionActual({
        texto: step.maneuver?.instruction || 'Continúa',
        distancia: step.distance || 0,
        icono: getManeuverIcon(step.maneuver?.type, step.maneuver?.modifier),
        calle: step.name || '',
        tipo: step.maneuver?.type || 'continue',
      });
    }
    
    // Center map on user (if navigating)
    if (map && modo === 'navegando') {
      // Calculate bearing to next point for smooth rotation
      let bearing = 0;
      if (closestIdx < routeCoords.length - 1) {
        bearing = calculateBearing(ubicacionUsuario, routeCoords[closestIdx + 1]);
      }
      
      map.easeTo({
        center: ubicacionUsuario,
        bearing: bearing,
        duration: 500,
        padding: { bottom: window.innerHeight * 0.35 },
      });
    }
  }, [ubicacionUsuario, modo, rutaAsignada, instrucciones, instruccionIndex, map, destinoSimulado]);

  // ─────────────────────────────────────────────────────────────────────────────
  // CANCEL / FINISH NAVIGATION
  // ─────────────────────────────────────────────────────────────────────────────

  // Simulate car movement (debug)
  const simularAvance = useCallback(() => {
    if (!rutaAsignada || modo !== 'navegando') return;
    
    const coords = rutaAsignada.ruta_saludable.coordenadas;
    simIndexRef.current = Math.min(simIndexRef.current + 5, coords.length - 1);
    const newPos = coords[simIndexRef.current];
    setUbicacionUsuario(newPos);
    
    // Move map to new position
    if (map) {
      map.easeTo({ center: newPos, duration: 300 });
    }
  }, [rutaAsignada, modo, map]);

  const cancelarNavegacion = useCallback(() => {
    setModo('preview');
    setHaLlegado(false);
    
    if (map && rutaAsignada) {
      // Remove progressive layers
      removeRouteLayer(map, 'ruta-recorrida');
      removeRouteLayer(map, 'ruta-restante');

      // Keep flood overlay visible in preview
      addFloodExclusionOverlay(map, rutaAsignada.excludePolygons);
      
      // Show original route layers
      if (map.getLayer('ruta-saludable')) {
        map.setLayoutProperty('ruta-saludable', 'visibility', 'visible');
      }
      if (map.getLayer('ruta-saludable-border')) {
        map.setLayoutProperty('ruta-saludable-border', 'visibility', 'visible');
      }
      
      // Re-add fast route
      addRouteLayer(
        map,
        'ruta-rapida',
        rutaAsignada.ruta_rapida.coordenadas,
        ROUTE_COLORS.rapida,
        6,
        0.4
      );
      
      // Reset map view
      const allCoords = [
        ...rutaAsignada.ruta_saludable.coordenadas,
        ...rutaAsignada.ruta_rapida.coordenadas,
      ];
      const lngs = allCoords.map(c => c[0]);
      const lats = allCoords.map(c => c[1]);
      
      map.easeTo({
        pitch: 55,
        bearing: 0,
        duration: 500,
      });
      
      map.fitBounds(
        [[Math.min(...lngs), Math.min(...lats)], [Math.max(...lngs), Math.max(...lats)]],
        { padding: { top: 150, bottom: 200, left: 50, right: 50 }, duration: 800 }
      );
    }
  }, [map, rutaAsignada]);

  const finalizarYNuevaRuta = useCallback(() => {
    // Clean up routes
    if (map) {
      removeRouteLayer(map, 'ruta-saludable');
      removeRouteLayer(map, 'ruta-rapida');
      removeRouteLayer(map, 'ruta-recorrida');
      removeRouteLayer(map, 'ruta-restante');
      removeFloodExclusionOverlay(map);
    }
    
    // Remove markers
    if (markersRef.current.destino) {
      markersRef.current.destino.remove();
      markersRef.current.destino = null;
    }
    
    // Reset states
    setRutaAsignada(null);
    setDestinoSimulado(null);
    setModo('cargando');
    setHaLlegado(false);
    setInstrucciones([]);
    setInstruccionActual(null);
    rutasCargadasRef.current = false;
    simIndexRef.current = 0;
    
    // This will trigger route loading again
  }, [map]);

  // ─────────────────────────────────────────────────────────────────────────────
  // CLEANUP ON LAYER DEACTIVATION
  // ─────────────────────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!isActive && map && !hasPersistentRoute && modo !== 'navegando' && modo !== 'finalizado') {
      // Clean up everything
      removeRouteLayer(map, 'ruta-saludable');
      removeRouteLayer(map, 'ruta-rapida');
      removeRouteLayer(map, 'ruta-recorrida');
      removeRouteLayer(map, 'ruta-restante');
      removeFloodExclusionOverlay(map);
      
      if (markersRef.current.destino) {
        markersRef.current.destino.remove();
        markersRef.current.destino = null;
      }
      
      setRutaAsignada(null);
      setDestinoSimulado(null);
      setModo('cargando');
      setHaLlegado(false);
      setInstrucciones([]);
      setInstruccionActual(null);
      rutasCargadasRef.current = false;
      setUbicacionUsuario(null);
      simIndexRef.current = 0;
    }
  }, [isActive, map, hasPersistentRoute, modo]);

  // ─────────────────────────────────────────────────────────────────────────────
  // RENDER - Return null if not active
  // ─────────────────────────────────────────────────────────────────────────────

  if (!isActive && modo !== 'navegando' && modo !== 'finalizado') return null;

  // ═══════════════════════════════════════════════════════════════════════════════
  // STYLES
  // ═══════════════════════════════════════════════════════════════════════════════

  const panelBaseStyle = {
    position: 'fixed',
    background: 'rgba(18, 22, 28, 0.95)',
    backdropFilter: 'blur(20px)',
    WebkitBackdropFilter: 'blur(20px)',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: 16,
    fontFamily: "'Inter', system-ui, sans-serif",
    color: 'rgba(255,255,255,0.85)',
    boxShadow: '0 4px 24px rgba(0,0,0,0.2)',
    zIndex: 200,
  };

  const previewPanelStyle = {
    ...panelBaseStyle,
    ...(isMobile ? {
      bottom: 80,
      left: 16,
      right: 16,
      maxHeight: isExpanded ? '60vh' : 'auto',
      overflowY: isExpanded ? 'auto' : 'hidden',
    } : {
      top: 24,
      left: 24,
      width: 340,
    }),
    padding: 0,
  };

  const navTopPanelStyle = {
    ...panelBaseStyle,
    top: isMobile ? 16 : 24,
    left: isMobile ? 16 : 24,
    right: isMobile ? 16 : 'auto',
    width: isMobile ? 'auto' : 340,
    padding: '16px 20px',
  };

  const navBottomPanelStyle = {
    ...panelBaseStyle,
    bottom: isMobile ? 80 : 24,
    left: isMobile ? 16 : 24,
    right: isMobile ? 16 : 'auto',
    width: isMobile ? 'auto' : 340,
    padding: '12px 16px',
  };

  const headerStyle = {
    fontSize: 10,
    letterSpacing: '0.12em',
    textTransform: 'uppercase',
    color: 'rgba(255,255,255,0.4)',
    marginBottom: 8,
  };

  const buttonPrimaryStyle = {
    width: '100%',
    padding: '14px 20px',
    background: MARKER_COLORS.destino,
    border: 'none',
    borderRadius: 10,
    color: 'white',
    fontSize: 13,
    fontWeight: 600,
    letterSpacing: '0.03em',
    cursor: 'pointer',
    transition: 'opacity 0.15s ease',
  };

  const buttonSecondaryStyle = {
    ...buttonPrimaryStyle,
    background: 'rgba(255,255,255,0.1)',
    border: '1px solid rgba(255,255,255,0.15)',
  };

  const routeCardStyle = (isMain) => ({
    padding: '14px 16px',
    background: isMain ? 'rgba(34,197,94,0.1)' : 'transparent',
    borderLeft: isMain ? `3px solid ${ROUTE_COLORS.saludable}` : '3px solid transparent',
  });

  const statStyle = {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    fontSize: 14,
    fontWeight: 600,
  };

  const chevronIcon = isExpanded
    ? `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 15l6-6 6 6"/></svg>`
    : `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 9l6 6 6-6"/></svg>`;

  // ═══════════════════════════════════════════════════════════════════════════════
  // RENDER: LOADING STATE
  // ═══════════════════════════════════════════════════════════════════════════════

  if (modo === 'cargando') {
    return (
      <div style={{ ...previewPanelStyle, padding: 20 }}>
        <div style={headerStyle}>RUTA ASIGNADA</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 12 }}>
          <div style={{
            width: 24,
            height: 24,
            border: '3px solid rgba(255,255,255,0.2)',
            borderTopColor: MARKER_COLORS.destino,
            borderRadius: '50%',
            animation: 'spin 1s linear infinite',
          }} />
          <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.6)' }}>
            {ubicacionError || 'Obteniendo ubicación...'}
          </span>
        </div>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // RENDER: PREVIEW STATE
  // ═══════════════════════════════════════════════════════════════════════════════

  if (modo === 'preview' && rutaAsignada) {
    const { ruta_saludable, ruta_rapida, ahorro_co2, tiempo_extra_min } = rutaAsignada;
    const validacionSaludable = ruta_saludable.floodValidation;
    const zonasEvitadas = validacionSaludable?.zonesEvaded || rutaAsignada.floodStatus?.zonasEvitadas || 0;
    const zonasCruzadas = validacionSaludable?.zonesCrossed || rutaAsignada.floodStatus?.zonasCruzadas || 0;
    const rutaConRiesgo = validacionSaludable ? !validacionSaludable.isSafe : false;
    const resumenInundacion = ruta_saludable.floodSummary || null;

    return (
      <div style={previewPanelStyle}>
        {/* Header */}
        <div
          style={{
            padding: '16px 20px',
            borderBottom: '1px solid rgba(255,255,255,0.06)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            cursor: isMobile ? 'pointer' : 'default',
          }}
          onClick={() => isMobile && setIsExpanded(!isExpanded)}
        >
          <div>
            <div style={headerStyle}>DESTINO ASIGNADO</div>
            <div style={{ fontSize: 15, fontWeight: 600, marginTop: 4 }}>
              {destinoSimulado?.nombre || 'Destino'}
            </div>
          </div>
          {isMobile && (
            <div
              style={{ color: 'rgba(255,255,255,0.5)' }}
              dangerouslySetInnerHTML={{ __html: chevronIcon }}
            />
          )}
        </div>

        {/* Content - collapsible on mobile */}
        {(!isMobile || isExpanded) && (
          <>
            {/* Ruta Saludable (asignada) */}
            <div style={routeCardStyle(true)}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                <span style={{ fontSize: 18 }}>🌿</span>
                <span style={{ ...headerStyle, marginBottom: 0, color: ROUTE_COLORS.saludable }}>
                  RUTA ASIGNADA
                </span>
                {rutaConRiesgo && (
                  <span style={{
                    marginLeft: 'auto',
                    fontSize: 10,
                    fontWeight: 700,
                    color: '#FCA5A5',
                    background: 'rgba(185,28,28,0.35)',
                    border: '1px solid rgba(252,165,165,0.45)',
                    borderRadius: 999,
                    padding: '3px 8px',
                    letterSpacing: '0.04em',
                  }}>
                    RIESGO INUNDACION
                  </span>
                )}
              </div>
              <div style={{ display: 'flex', gap: 20, marginBottom: 8 }}>
                <div style={statStyle}>
                  <span>{formatDistance(ruta_saludable.distance)}</span>
                </div>
                <div style={statStyle}>
                  <span>{formatDuration(ruta_saludable.duration)}</span>
                </div>
              </div>
              <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)' }}>
                CO₂: {formatNumber(ruta_saludable.emisiones_ruta.co2)}g
              </div>
              {resumenInundacion && (
                <div style={{
                  marginTop: 8,
                  fontSize: 11,
                  color: rutaConRiesgo ? '#FCA5A5' : 'rgba(255,255,255,0.65)',
                }}>
                  {resumenInundacion}
                </div>
              )}
            </div>

            {/* Divider */}
            <div style={{ height: 1, background: 'rgba(255,255,255,0.06)' }} />

            {/* Ruta Rápida (referencia) */}
            <div style={routeCardStyle(false)}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                <span style={{ fontSize: 18, opacity: 0.5 }}>⚡</span>
                <span style={{ ...headerStyle, marginBottom: 0, color: 'rgba(255,255,255,0.4)' }}>
                  RUTA ALTERNATIVA (no asignada)
                </span>
              </div>
              <div style={{ display: 'flex', gap: 20, marginBottom: 8, opacity: 0.6 }}>
                <div style={statStyle}>
                  <span>{formatDistance(ruta_rapida.distance)}</span>
                </div>
                <div style={statStyle}>
                  <span>{formatDuration(ruta_rapida.duration)}</span>
                </div>
              </div>
              <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)' }}>
                CO₂: {formatNumber(ruta_rapida.emisiones_ruta.co2)}g
              </div>
            </div>

            {(zonasEvitadas > 0 || zonasCruzadas > 0) && (
              <>
                <div style={{ height: 1, background: 'rgba(255,255,255,0.06)' }} />
                <div style={{
                  padding: '12px 16px',
                  background: rutaConRiesgo ? 'rgba(185,28,28,0.16)' : 'rgba(16,185,129,0.12)',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,0.88)' }}>
                      Estado de inundaciones
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      {zonasEvitadas > 0 && (
                        <span style={{
                          fontSize: 10,
                          fontWeight: 700,
                          color: '#86EFAC',
                          background: 'rgba(21,128,61,0.35)',
                          border: '1px solid rgba(134,239,172,0.45)',
                          borderRadius: 999,
                          padding: '3px 8px',
                        }}>
                          {zonasEvitadas} evitada{zonasEvitadas > 1 ? 's' : ''}
                        </span>
                      )}
                      {zonasCruzadas > 0 && (
                        <span style={{
                          fontSize: 10,
                          fontWeight: 700,
                          color: '#FCA5A5',
                          background: 'rgba(185,28,28,0.35)',
                          border: '1px solid rgba(252,165,165,0.45)',
                          borderRadius: 999,
                          padding: '3px 8px',
                        }}>
                          {zonasCruzadas} cruzada{zonasCruzadas > 1 ? 's' : ''}
                        </span>
                      )}
                    </div>
                  </div>
                  {rutaConRiesgo && (
                    <div style={{ marginTop: 8, fontSize: 11, color: '#FECACA' }}>
                      No existe ruta completamente libre de inundaciones para este destino.
                    </div>
                  )}
                </div>
              </>
            )}

            {/* Ahorro */}
            {ahorro_co2 > 0 && (
              <>
                <div style={{ height: 1, background: 'rgba(255,255,255,0.06)' }} />
                <div style={{ padding: '12px 16px', background: 'rgba(34,197,94,0.08)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 16 }}>💚</span>
                    <span style={{ fontSize: 13, fontWeight: 600, color: ROUTE_COLORS.saludable }}>
                      Ahorro: {formatNumber(ahorro_co2)}g CO₂
                    </span>
                    {tiempo_extra_min > 0 && (
                      <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>
                        (+{tiempo_extra_min} min)
                      </span>
                    )}
                  </div>
                </div>
              </>
            )}

            {/* Action button */}
            <div style={{ padding: 16 }}>
              <button
                type="button"
                style={buttonPrimaryStyle}
                onClick={iniciarNavegacion}
              >
                INICIAR NAVEGACIÓN
              </button>
            </div>
          </>
        )}
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // RENDER: NAVIGATION STATE
  // ═══════════════════════════════════════════════════════════════════════════════

  if ((modo === 'navegando' || modo === 'finalizado') && instruccionActual) {
    return (
      <>
        {/* Top panel: Current instruction */}
        <div style={navTopPanelStyle}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <div
              style={{
                width: 48,
                height: 48,
                borderRadius: 12,
                background: haLlegado ? ROUTE_COLORS.saludable : 'rgba(255,255,255,0.1)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: haLlegado ? 'white' : 'rgba(255,255,255,0.9)',
              }}
              dangerouslySetInnerHTML={{ __html: instruccionActual.icono }}
            />
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 4 }}>
                {instruccionActual.texto}
              </div>
              {instruccionActual.calle && !haLlegado && (
                <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)' }}>
                  {instruccionActual.calle}
                </div>
              )}
              {!haLlegado && instruccionActual.distancia > 0 && (
                <div style={{ fontSize: 13, color: ROUTE_COLORS.saludable, marginTop: 4 }}>
                  en {formatDistance(instruccionActual.distancia)}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Bottom panel: Progress */}
        <div style={navBottomPanelStyle}>
          {haLlegado ? (
            <button
              type="button"
              style={buttonPrimaryStyle}
              onClick={finalizarYNuevaRuta}
            >
              NUEVA RUTA
            </button>
          ) : (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <div>
                  <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginBottom: 2 }}>
                    TIEMPO RESTANTE
                  </div>
                  <div style={{ fontSize: 18, fontWeight: 700 }}>
                    {formatDuration(progreso.tiempo)}
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginBottom: 2 }}>
                    DISTANCIA
                  </div>
                  <div style={{ fontSize: 18, fontWeight: 700 }}>
                    {formatDistance(progreso.distancia)}
                  </div>
                </div>
              </div>
              <button
                type="button"
                style={buttonSecondaryStyle}
                onClick={cancelarNavegacion}
              >
                CANCELAR NAVEGACIÓN
              </button>
              <button
                type="button"
                style={{ ...buttonSecondaryStyle, marginTop: 8, background: 'rgba(59,130,246,0.3)' }}
                onClick={simularAvance}
              >
                🚗 SIMULAR AVANCE
              </button>
            </>
          )}
        </div>
      </>
    );
  }

  // Fallback
  return null;
}
