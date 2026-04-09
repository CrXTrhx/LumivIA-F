import { useEffect, useRef, useCallback, useMemo } from 'react';
import { MapboxOverlay } from '@deck.gl/mapbox';
import { ScatterplotLayer } from '@deck.gl/layers';

// ═══════════════════════════════════════════════════════════════════════════════
// CONFIGURACIÓN DE LLUVIA - GOTAS 2D BILLBOARD OPTIMIZADAS
// ═══════════════════════════════════════════════════════════════════════════════

const TAU = Math.PI * 2;
const INV_111000 = 1 / 111000; // Pre-calcular inverso para división más rápida

// Configuración por intensidad
const RAIN_CONFIG = {
  light: {
    dropsPerZone: 2500,
    fallSpeed: 200,          
    dropRadius: 4,
    dropAlpha: 220,
  },
  medium: {
    dropsPerZone: 4000,
    fallSpeed: 280,
    dropRadius: 5,
    dropAlpha: 240,
  },
  heavy: {
    dropsPerZone: 6000,
    fallSpeed: 360,
    dropRadius: 6,
    dropAlpha: 255,
  },
};

// Constantes pre-calculadas
const MAX_HEIGHT = 500;  // Reducido de 800 para mejor visibilidad
const MIN_HEIGHT = 0;
const SPAWN_HEIGHT_VARIANCE = 150;  // Reducido para gotas más concentradas
const DROP_COLOR = [220, 240, 255];
const EDGE_FADE = 0.3;
const FADE_START = 0.7;
const ALPHA_THRESHOLD = 40;

// ═══════════════════════════════════════════════════════════════════════════════
// FUNCIONES MATEMÁTICAS OPTIMIZADAS
// ═══════════════════════════════════════════════════════════════════════════════

// Cache para cosenos de latitud (evitar recalcular)
const latCosCache = new Map();

function getCosLat(lat) {
  const key = Math.round(lat * 1000);
  if (!latCosCache.has(key)) {
    latCosCache.set(key, Math.cos(lat * Math.PI / 180));
  }
  return latCosCache.get(key);
}

function metersToDegreesLat(meters) {
  return meters * INV_111000;
}

function metersToDegreesLng(meters, lat) {
  return meters * INV_111000 / getCosLat(lat);
}

// Noise optimizado - menos cálculos trigonométricos
function irregularNoise(angle, time, seed) {
  const t = time * 0.0003;
  return (
    Math.sin(angle * 2.7 + seed) * 0.18 +
    Math.sin(angle * 5.3 + t + seed * 1.3) * 0.12
  );
}

function getIrregularRadius(baseRadius, angle, time, seed) {
  return baseRadius * (1 + irregularNoise(angle, time, seed));
}

// ═══════════════════════════════════════════════════════════════════════════════
// OBJECT POOL - Reusar arrays para evitar GC
// ═══════════════════════════════════════════════════════════════════════════════

const rainDataPool = [];

function getRainDataArray(size) {
  if (rainDataPool.length > 0) {
    const arr = rainDataPool.pop();
    arr.length = 0; // Limpiar
    return arr;
  }
  return new Array(size);
}

function returnRainDataArray(arr) {
  if (rainDataPool.length < 5) { // Mantener máximo 5 en pool
    rainDataPool.push(arr);
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// POOL DE GOTAS
// ═══════════════════════════════════════════════════════════════════════════════

function createDropPool(zone, zoneIndex, time) {
  const config = RAIN_CONFIG[zone.intensity] || RAIN_CONFIG.medium;
  const drops = new Array(config.dropsPerZone);
  const seed = zoneIndex * 100;
  
  for (let i = 0; i < config.dropsPerZone; i++) {
    const angle = Math.random() * TAU;
    const distRatio = Math.random();
    const irregRadius = getIrregularRadius(zone.radius, angle, time, seed);
    const dist = distRatio * irregRadius;
    
    // Calcular alpha con fade en bordes
    let alpha = config.dropAlpha;
    if (distRatio > FADE_START) {
      alpha = config.dropAlpha * (1 - (distRatio - FADE_START) / EDGE_FADE);
    }
    
    const cosAngle = Math.cos(angle);
    const sinAngle = Math.sin(angle);
    
    drops[i] = {
      zoneIndex,
      angle,
      distRatio,
      cosAngle,  // Cache trig values
      sinAngle,
      offsetX: cosAngle * dist,
      offsetY: sinAngle * dist,
      z: Math.random() * MAX_HEIGHT,
      vz: config.fallSpeed * (0.8 + Math.random() * 0.4),
      alpha,
      baseAlpha: alpha,
      radiusMultiplier: 0.7 + Math.random() * 0.6,
    };
  }
  
  return drops;
}

// ═══════════════════════════════════════════════════════════════════════════════
// FÍSICA - OPTIMIZADA CON MENOS BRANCHES
// ═══════════════════════════════════════════════════════════════════════════════

function updateDrops(drops, zones, deltaTime, currentTime) {
  const dt = deltaTime * 0.001; // Pre-calcular división
  const dropsLength = drops.length;
  
  for (let i = 0; i < dropsLength; i++) {
    const drop = drops[i];
    const zone = zones[drop.zoneIndex];
    if (!zone) continue;
    
    // Caída
    drop.z -= drop.vz * dt;
    
    // Reciclar (branch prediction friendly - raro que pase)
    if (drop.z <= MIN_HEIGHT) {
      drop.z = MAX_HEIGHT + Math.random() * SPAWN_HEIGHT_VARIANCE;
      
      // Nueva posición
      drop.angle = Math.random() * TAU;
      drop.distRatio = Math.random();
      drop.cosAngle = Math.cos(drop.angle);
      drop.sinAngle = Math.sin(drop.angle);
      
      const irregRadius = getIrregularRadius(
        zone.radius, drop.angle, currentTime, drop.zoneIndex * 100
      );
      const dist = drop.distRatio * irregRadius;
      drop.offsetX = drop.cosAngle * dist;
      drop.offsetY = drop.sinAngle * dist;
      
      // Recalcular alpha
      const config = RAIN_CONFIG[zone.intensity] || RAIN_CONFIG.medium;
      if (drop.distRatio > FADE_START) {
        drop.baseAlpha = config.dropAlpha * (1 - (drop.distRatio - FADE_START) / EDGE_FADE);
      } else {
        drop.baseAlpha = config.dropAlpha;
      }
    }
    
    // Alpha por altura (inline para evitar function call)
    const heightRatio = drop.z / MAX_HEIGHT;
    drop.alpha = drop.baseAlpha * (0.6 + (1 - heightRatio) * 0.4);
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// CONSTRUIR RENDER DATA - OPTIMIZADO CON PRE-ALLOCATION
// ═══════════════════════════════════════════════════════════════════════════════

// Reusar objetos de color y posición
const colorCache = new Array(256);
for (let i = 0; i < 256; i++) {
  colorCache[i] = [...DROP_COLOR, i];
}

function buildRainData(drops, zones) {
  // Estimar tamaño (4 objetos por gota: 1 principal + 3 trail)
  const estimatedSize = drops.length * 4;
  const data = getRainDataArray(estimatedSize);
  let dataIndex = 0;
  
  const dropsLength = drops.length;
  
  for (let i = 0; i < dropsLength; i++) {
    const drop = drops[i];
    const zone = zones[drop.zoneIndex];
    
    if (!zone || !zone.isRaining || drop.alpha < ALPHA_THRESHOLD) continue;
    
    const config = RAIN_CONFIG[zone.intensity] || RAIN_CONFIG.medium;
    const lng = zone.lng + metersToDegreesLng(drop.offsetX, zone.lat);
    const lat = zone.lat + metersToDegreesLat(drop.offsetY);
    const alphaInt = Math.floor(drop.alpha);
    const baseRadius = config.dropRadius * drop.radiusMultiplier;
    
    // Gota principal
    data[dataIndex++] = {
      position: [lng, lat, drop.z],
      color: colorCache[Math.min(255, alphaInt)],
      radius: baseRadius,
    };
    
    // Estela (3 segmentos) - loop unrolled para performance
    const z1 = drop.z + 8;
    const alpha1 = Math.floor(drop.alpha * 0.45);
    data[dataIndex++] = {
      position: [lng, lat, z1],
      color: colorCache[Math.min(255, alpha1)],
      radius: baseRadius * 0.8,
    };
    
    const z2 = drop.z + 16;
    const alpha2 = Math.floor(drop.alpha * 0.3);
    data[dataIndex++] = {
      position: [lng, lat, z2],
      color: colorCache[Math.min(255, alpha2)],
      radius: baseRadius * 0.6,
    };
    
    const z3 = drop.z + 24;
    const alpha3 = Math.floor(drop.alpha * 0.15);
    data[dataIndex++] = {
      position: [lng, lat, z3],
      color: colorCache[Math.min(255, alpha3)],
      radius: baseRadius * 0.4,
    };
  }
  
  data.length = dataIndex; // Trim al tamaño real
  
  // Debug: mostrar muestra de datos cada 120 frames (~2 segundos a 60fps)
  if (buildRainData.frameCount === undefined) buildRainData.frameCount = 0;
  buildRainData.frameCount++;
  if (buildRainData.frameCount % 120 === 0) {
    console.log(`🌧️ buildRainData: ${dataIndex} particles from ${dropsLength} drops`);
    if (dataIndex > 0) {
      console.log('Sample particle:', data[0]);
    }
  }
  
  return data;
}

// ═══════════════════════════════════════════════════════════════════════════════
// COMPONENTE PRINCIPAL
// ═══════════════════════════════════════════════════════════════════════════════

export default function RainRenderer({ 
  map,
  rainZones = [],
  isActive = false,
}) {
  const deckOverlayRef = useRef(null);
  const dropsRef = useRef([]);
  const zonesRef = useRef([]);
  const rafRef = useRef(null);
  const lastTimeRef = useRef(0);
  const isInitializedRef = useRef(false);
  const lastRainDataRef = useRef(null); // Cache del último frame

  // ─────────────────────────────────────────────────────────────────────────────
  // INICIALIZAR OVERLAY
  // ─────────────────────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!map) return;
    
    const initOverlay = () => {
      if (deckOverlayRef.current) return;
      
      try {
        deckOverlayRef.current = new MapboxOverlay({
          interleaved: true,
          layers: [],
        });
        map.addControl(deckOverlayRef.current);
        isInitializedRef.current = true;
        console.log('🌧️ RainRenderer: Overlay inicializado (optimizado)');
      } catch (e) {
        console.error('Error inicializando RainRenderer:', e);
      }
    };
    
    if (map.loaded()) {
      initOverlay();
    } else {
      map.once('load', initOverlay);
    }
    
    return () => {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      if (deckOverlayRef.current && map) {
        try {
          map.removeControl(deckOverlayRef.current);
        } catch (e) {}
        deckOverlayRef.current = null;
      }
      isInitializedRef.current = false;
      // Limpiar cache
      if (lastRainDataRef.current) {
        returnRainDataArray(lastRainDataRef.current);
        lastRainDataRef.current = null;
      }
    };
  }, [map]);

  // ─────────────────────────────────────────────────────────────────────────────
  // CREAR POOL DE PARTÍCULAS
  // ─────────────────────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!isActive || !rainZones || rainZones.length === 0) {
      console.log('🌧️ Pool: clearing (not active or no zones)');
      dropsRef.current = [];
      zonesRef.current = [];
      return;
    }
    
    const activeZones = rainZones.filter(z => z.isRaining);
    
    if (activeZones.length === 0) {
      console.log('🌧️ Pool: clearing (no raining zones)');
      dropsRef.current = [];
      zonesRef.current = [];
      return;
    }
    
    const currentTime = performance.now();
    
    // Pre-calcular tamaño total
    let totalDrops = 0;
    for (const zone of activeZones) {
      const config = RAIN_CONFIG[zone.intensity] || RAIN_CONFIG.medium;
      totalDrops += config.dropsPerZone;
    }
    
    // Pre-allocar array
    const allDrops = new Array(totalDrops);
    let dropIndex = 0;
    
    activeZones.forEach((zone, idx) => {
      const zoneDrops = createDropPool(zone, idx, currentTime);
      for (let i = 0; i < zoneDrops.length; i++) {
        allDrops[dropIndex++] = zoneDrops[i];
      }
    });
    
    dropsRef.current = allDrops;
    zonesRef.current = activeZones;
    
    console.log(`🌧️ Pool created: ${allDrops.length} drops in ${activeZones.length} zones`);
    console.log('🌧️ Zones:', activeZones.map(z => `${z.name || z.id} (${z.intensity})`).join(', '));
  }, [rainZones, isActive]);

  // ─────────────────────────────────────────────────────────────────────────────
  // RENDER LOOP - OPTIMIZADO
  // ─────────────────────────────────────────────────────────────────────────────

  const render = useCallback((time) => {
    if (!deckOverlayRef.current) return;
    
    if (!isActive || zonesRef.current.length === 0) {
      deckOverlayRef.current.setProps({ layers: [] });
      return;
    }
    
    const deltaTime = lastTimeRef.current ? time - lastTimeRef.current : 16;
    lastTimeRef.current = time;
    const dt = Math.min(deltaTime, 50);
    
    updateDrops(dropsRef.current, zonesRef.current, dt, time);
    
    // Devolver array anterior al pool
    if (lastRainDataRef.current) {
      returnRainDataArray(lastRainDataRef.current);
    }
    
    const rainData = buildRainData(dropsRef.current, zonesRef.current);
    lastRainDataRef.current = rainData;
    
    if (rainData.length === 0) {
      deckOverlayRef.current.setProps({ layers: [] });
      return;
    }
    
    // Debug log (solo cada 2 segundos)
    if (Math.floor(time / 2000) !== Math.floor((lastTimeRef.current - dt) / 2000)) {
      console.log(`🌧️ Rain rendering: ${rainData.length} particles, ${dropsRef.current.length} drops total`);
    }
    
    // Single layer (más eficiente que múltiples)
    const layer = new ScatterplotLayer({
      id: 'rain-drops-billboard',
      data: rainData,
      getPosition: d => d.position,
      getFillColor: d => d.color,
      getRadius: d => d.radius,
      radiusUnits: 'pixels',
      radiusMinPixels: 2,
      radiusMaxPixels: 15,
      radiusScale: 1,
      opacity: 1,
      pickable: false,
      billboard: true,
      parameters: { 
        depthTest: false,
        blend: true,
        blendFunc: ['SRC_ALPHA', 'ONE_MINUS_SRC_ALPHA'],
      },
      updateTriggers: {
        getPosition: time,
      },
    });
    
    deckOverlayRef.current.setProps({ layers: [layer] });
  }, [isActive]);

  // ─────────────────────────────────────────────────────────────────────────────
  // ANIMATION LOOP
  // ─────────────────────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!isInitializedRef.current) {
      console.log('🌧️ Animation loop: waiting for initialization');
      return;
    }
    
    console.log('🌧️ Animation loop: starting');
    let animating = true;
    let frameCount = 0;
    
    const animate = (time) => {
      if (!animating) return;
      render(time);
      frameCount++;
      rafRef.current = requestAnimationFrame(animate);
    };
    
    rafRef.current = requestAnimationFrame(animate);
    
    return () => {
      console.log(`🌧️ Animation loop: stopping (rendered ${frameCount} frames)`);
      animating = false;
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, [render]);

  // ─────────────────────────────────────────────────────────────────────────────
  // ZONAS DE LLUVIA EN MAPBOX (optimizado - menos updates)
  // ─────────────────────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!map || !isActive) return;
    
    const sourceId = 'rain-zones-source';
    const fillLayerId = 'rain-zones-fill';
    const glowLayerId = 'rain-zones-glow';
    
    const addZoneLayers = () => {
      const activeZones = (rainZones || []).filter(z => z.isRaining);
      
      if (activeZones.length === 0) {
        try {
          if (map.getLayer(glowLayerId)) map.removeLayer(glowLayerId);
          if (map.getLayer(fillLayerId)) map.removeLayer(fillLayerId);
          if (map.getSource(sourceId)) map.removeSource(sourceId);
        } catch (e) {}
        return;
      }
      
      const features = activeZones.map((zone, i) => {
        const points = 36; // Reducido de 48 para mejor performance
        const coords = new Array(points + 1);
        const time = performance.now();
        const seed = i * 100;
        
        for (let j = 0; j <= points; j++) {
          const angle = (j / points) * TAU;
          const radius = getIrregularRadius(zone.radius, angle, time, seed);
          coords[j] = [
            zone.lng + metersToDegreesLng(Math.cos(angle) * radius, zone.lat),
            zone.lat + metersToDegreesLat(Math.sin(angle) * radius),
          ];
        }
        
        return {
          type: 'Feature',
          properties: {
            intensity: zone.intensity,
          },
          geometry: {
            type: 'Polygon',
            coordinates: [coords],
          },
        };
      });
      
      const geojson = { type: 'FeatureCollection', features };
      
      try {
        if (map.getSource(sourceId)) {
          map.getSource(sourceId).setData(geojson);
        } else {
          map.addSource(sourceId, { type: 'geojson', data: geojson });
          
          // Añadir capas solo una vez
          map.addLayer({
            id: glowLayerId,
            type: 'fill',
            source: sourceId,
            paint: {
              'fill-color': [
                'match', ['get', 'intensity'],
                'heavy', 'rgba(80, 140, 220, 0.15)',
                'medium', 'rgba(100, 160, 230, 0.10)',
                'rgba(120, 180, 240, 0.07)'
              ],
              'fill-opacity': 1,
            },
          }, '3d-buildings');
          
          map.addLayer({
            id: fillLayerId,
            type: 'fill',
            source: sourceId,
            paint: {
              'fill-color': [
                'match', ['get', 'intensity'],
                'heavy', 'rgba(60, 100, 180, 0.18)',
                'medium', 'rgba(80, 120, 200, 0.12)',
                'rgba(100, 140, 220, 0.08)'
              ],
              'fill-opacity': 1,
            },
          }, '3d-buildings');
        }
      } catch (e) {
        console.error('Error agregando zonas de lluvia:', e);
      }
    };
    
    if (map.loaded()) {
      addZoneLayers();
    } else {
      map.once('load', addZoneLayers);
    }
    
    // Update cada 2 segundos en lugar de 1 (menos overhead)
    const updateInterval = setInterval(() => {
      if (map && isActive) {
        addZoneLayers();
      }
    }, 2000);
    
    return () => {
      clearInterval(updateInterval);
      try {
        if (map.getLayer(glowLayerId)) map.removeLayer(glowLayerId);
        if (map.getLayer(fillLayerId)) map.removeLayer(fillLayerId);
        if (map.getSource(sourceId)) map.removeSource(sourceId);
      } catch (e) {}
    };
  }, [map, rainZones, isActive]);

  return null;
}
