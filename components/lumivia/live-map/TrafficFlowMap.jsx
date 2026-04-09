import { useCallback, useEffect, useRef, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import { MapboxOverlay } from '@deck.gl/mapbox';
import { ScatterplotLayer } from '@deck.gl/layers';
import { Client } from '@stomp/stompjs';
import SockJS from 'sockjs-client';

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN_LIVE_MAP || '';
mapboxgl.accessToken = MAPBOX_TOKEN;

const BACKEND_URL = 'http://localhost:8080';
const MODO_SIMULADO = true; // Se reemplaza dinámicamente por isSimulation prop

// API Key de OpenWeatherMap (gratuita)
const OPENWEATHER_API_KEY = process.env.NEXT_PUBLIC_OPENWEATHER_API_KEY || '';
const MEXICO_CITY_COORDS = { lat: 19.4326, lon: -99.1332 };

// Perfiles de emisiones por cámara
const PERFILES_EMISION = [
  { co2: 175, nox: 0.68, pm25: 0.035 },
  { co2: 110, nox: 0.38, pm25: 0.018 },
  { co2: 65, nox: 0.22, pm25: 0.011 },
  { co2: 150, nox: 0.52, pm25: 0.028 },
  { co2: 95, nox: 0.32, pm25: 0.016 },
];

const CAMARAS_CONFIG = [
  { id: 'camara_insurgentes_reforma', nombre: 'Insurgentes × Reforma', origen: [-99.1332, 19.4390], destino: [-99.1332, 19.4260] },
  { id: 'camara_reforma_poniente', nombre: 'Reforma Poniente', origen: [-99.1820, 19.4248], destino: [-99.1600, 19.4300] },
  { id: 'camara_insurgentes_norte', nombre: 'Insurgentes Norte', origen: [-99.1476, 19.4580], destino: [-99.1476, 19.4400] },
  { id: 'camara_eje_central', nombre: 'Eje Central Lázaro Cárdenas', origen: [-99.1410, 19.4420], destino: [-99.1410, 19.4250] },
  { id: 'camara_juarez', nombre: 'Av. Juárez', origen: [-99.1530, 19.4356], destino: [-99.1360, 19.4356] },
];

// ═══════════════════════════════════════════════════════════════════════════════
// COLORES PARA CÁMARAS (PALETA SOBRIA — SIN NEÓN)
// ═══════════════════════════════════════════════════════════════════════════════

function getColorCamara(emissionScore) {
  // score normalizado 0-1: <0.35 bajo, <0.65 medio, >=0.65 alto
  if (emissionScore < 0.35) {
    return {
      primary: '#6B7B8A',    // gris acero
      secondary: '#4A5568',  // gris oscuro
      bg: '#2D3748',         // fondo oscuro
    };
  } else if (emissionScore < 0.65) {
    return {
      primary: '#B8860B',    // dorado oscuro (sin neón)
      secondary: '#8B6914',  // marrón dorado
      bg: '#3D3424',         // fondo cálido oscuro
    };
  }
  return {
    primary: '#9B4D4D',      // rojo terracota apagado
    secondary: '#7A3333',    // rojo oscuro
    bg: '#3D2828',           // fondo rojizo oscuro
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// INYECCIÓN DE ESTILOS CSS PARA ANIMACIÓN RADAR
// ═══════════════════════════════════════════════════════════════════════════════

let radarStylesInjected = false;
function injectRadarStyles() {
  if (radarStylesInjected) return;
  radarStylesInjected = true;
  
  const style = document.createElement('style');
  style.id = 'lumivia-radar-styles';
  style.textContent = `
    @keyframes radar-pulse {
      0% {
        transform: scale(1);
        opacity: 0.7;
      }
      100% {
        transform: scale(2.5);
        opacity: 0;
      }
    }
    
    @keyframes led-blink {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.4; }
    }
    
    .lumivia-radar-wave {
      transform-origin: center;
      animation: radar-pulse 2.4s ease-out infinite;
    }
    .lumivia-radar-wave-1 { animation-delay: 0s; }
    .lumivia-radar-wave-2 { animation-delay: 0.8s; }
    .lumivia-radar-wave-3 { animation-delay: 1.6s; }
    
    .lumivia-led-indicator {
      animation: led-blink 1.5s ease-in-out infinite;
    }
    
    .lumivia-camera-container {
      position: relative;
      width: 52px;
      height: 52px;
    }
    .lumivia-camera-container svg {
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
    }
  `;
  document.head.appendChild(style);
}

function crearCameraMarkerSVG(colors, isLight = false) {
  // Inyectar estilos CSS si no existen
  injectRadarStyles();
  
  const bgFill = isLight ? '#FFFFFF' : colors.bg;
  const strokeColor = isLight ? colors.secondary : colors.primary;
  const waveColor = colors.primary;
  const ledColor = '#4ADE80'; // verde brillante para LED
  
  // Diseño innovador: Ondas de radar pulsantes + centro con cámara tecnológica
  return `
    <div class="lumivia-camera-container">
      <svg width="52" height="52" viewBox="0 0 52 52" xmlns="http://www.w3.org/2000/svg">
        <!-- Ondas de radar pulsantes (escaneando) -->
        <circle class="lumivia-radar-wave lumivia-radar-wave-1" cx="26" cy="26" r="12" 
                fill="none" stroke="${waveColor}" stroke-width="1.5"/>
        <circle class="lumivia-radar-wave lumivia-radar-wave-2" cx="26" cy="26" r="12" 
                fill="none" stroke="${waveColor}" stroke-width="1.5"/>
        <circle class="lumivia-radar-wave lumivia-radar-wave-3" cx="26" cy="26" r="12" 
                fill="none" stroke="${waveColor}" stroke-width="1.5"/>
        
        <!-- Anillo exterior decorativo (tech look) -->
        <circle cx="26" cy="26" r="15" fill="none" stroke="${waveColor}" stroke-width="0.5" opacity="0.3" stroke-dasharray="3 2"/>
        
        <!-- Círculo base del marcador -->
        <circle cx="26" cy="26" r="12" fill="${bgFill}"/>
        <circle cx="26" cy="26" r="12" fill="none" stroke="${strokeColor}" stroke-width="2"/>
        
        <!-- Icono de cámara de vigilancia (estilizado tech) -->
        <g transform="translate(17, 19)">
          <!-- Cuerpo de cámara con esquinas redondeadas -->
          <rect x="0" y="3" width="10" height="7" rx="1.5" fill="${strokeColor}"/>
          <!-- Lente circular -->
          <circle cx="13" cy="6.5" r="4" fill="${strokeColor}"/>
          <circle cx="13" cy="6.5" r="2.5" fill="${isLight ? '#F5F5F5' : '#1a1a2e'}"/>
          <circle cx="13" cy="6.5" r="1" fill="${strokeColor}" opacity="0.5"/>
          <!-- LED indicador de estado (parpadea) -->
          <circle class="lumivia-led-indicator" cx="2" cy="5" r="1.2" fill="${ledColor}"/>
        </g>
        
        <!-- Resplandor interior sutil -->
        <circle cx="26" cy="26" r="10" fill="url(#radarGlow-${colors.primary.replace('#', '')})" opacity="0.15"/>
        
        <!-- Definición de gradiente radial para glow -->
        <defs>
          <radialGradient id="radarGlow-${colors.primary.replace('#', '')}">
            <stop offset="0%" stop-color="${waveColor}"/>
            <stop offset="100%" stop-color="transparent"/>
          </radialGradient>
        </defs>
      </svg>
    </div>`;
}

// ═══════════════════════════════════════════════════════════════════════════════
// UTILIDADES
// ═══════════════════════════════════════════════════════════════════════════════

async function fetchRoutePoints(origen, destino) {
  const url = `https://api.mapbox.com/directions/v5/mapbox/driving/${origen[0]},${origen[1]};${destino[0]},${destino[1]}?geometries=geojson&overview=full&access_token=${MAPBOX_TOKEN}`;
  try {
    const res = await fetch(url);
    const data = await res.json();
    if (data.routes?.[0]) return data.routes[0].geometry.coordinates;
  } catch (e) {
    console.error('Directions error:', e);
  }
  return Array.from({ length: 30 }, (_, i) => {
    const t = i / 29;
    return [origen[0] + (destino[0] - origen[0]) * t, origen[1] + (destino[1] - origen[1]) * t];
  });
}

async function fetchWindData() {
  try {
    const url = `https://api.openweathermap.org/data/2.5/weather?lat=${MEXICO_CITY_COORDS.lat}&lon=${MEXICO_CITY_COORDS.lon}&appid=${OPENWEATHER_API_KEY}&units=metric`;
    const res = await fetch(url);
    const data = await res.json();
    if (data.wind) {
      return {
        speed: data.wind.speed || 2,  // m/s
        deg: data.wind.deg || 0,       // dirección en grados (0 = Norte, 90 = Este)
      };
    }
  } catch (e) {
    console.error('Wind API error:', e);
  }
  // Fallback: viento suave del norte
  return { speed: 2.5, deg: 15 };
}

async function buildCamarasWithRoutes() {
  const result = [];
  for (const cam of CAMARAS_CONFIG) {
    const pts = await fetchRoutePoints(cam.origen, cam.destino);
    result.push({ id: cam.id, nombre: cam.nombre, routePoints: pts, markerCoord: pts[Math.floor(pts.length / 2)] });
  }
  return result;
}

function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }

function densificarRuta(routePoints, intervaloM = 12) {
  const K = 111320;
  const out = [];
  for (let i = 0; i < routePoints.length - 1; i++) {
    const p1 = routePoints[i], p2 = routePoints[i + 1];
    const dist = Math.hypot(p2[0] - p1[0], p2[1] - p1[1]) * K;
    const steps = Math.max(1, Math.floor(dist / intervaloM));
    for (let s = 0; s < steps; s++) {
      const t = s / steps;
      out.push([p1[0] + (p2[0] - p1[0]) * t, p1[1] + (p2[1] - p1[1]) * t]);
    }
  }
  out.push(routePoints[routePoints.length - 1]);
  return out;
}

// Calcular dirección de cada segmento de la ruta (para modo sentido vial)
function calcularDirecciones(route) {
  const dirs = [];
  for (let i = 0; i < route.length; i++) {
    const next = route[Math.min(i + 1, route.length - 1)];
    const curr = route[i];
    const dx = next[0] - curr[0];
    const dy = next[1] - curr[1];
    const angle = Math.atan2(dy, dx); // radianes
    dirs.push(angle);
  }
  return dirs;
}

function intensidadEvento(emisiones) {
  return clamp(
    ((emisiones.co2 || 0) / 220) * 0.6 +
    ((emisiones.nox || 0) / 1.0) * 0.3 +
    ((emisiones.pm25 || 0) / 0.05) * 0.1,
    0, 1
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// COLORES
// ═══════════════════════════════════════════════════════════════════════════════

function colorTrafico(d, alpha = 200) {
  let r, g, b;
  if (d < 0.25) {
    const t = d / 0.25;
    r = Math.floor(30 + t * 120); g = Math.floor(180 + t * 40); b = 60;
  } else if (d < 0.5) {
    const t = (d - 0.25) / 0.25;
    r = Math.floor(150 + t * 105); g = Math.floor(220 - t * 60); b = Math.floor(60 - t * 40);
  } else if (d < 0.75) {
    const t = (d - 0.5) / 0.25;
    r = 255; g = Math.floor(160 - t * 100); b = 20;
  } else {
    const t = (d - 0.75) / 0.25;
    r = 255; g = Math.floor(60 - t * 50); b = Math.floor(20 - t * 15);
  }
  return [r, g, b, Math.min(alpha, 230)];
}

function colorEmision(d, alpha = 120) {
  const gray = Math.floor(100 + d * 80);
  const r = Math.min(255, gray + Math.floor(d * 60));
  const g = Math.max(60, gray - Math.floor(d * 30));
  const b = Math.max(50, gray - Math.floor(d * 40));
  return [r, g, b, Math.min(alpha, 150)];
}

// ═══════════════════════════════════════════════════════════════════════════════
// PARTÍCULAS DE TRÁFICO
// ═══════════════════════════════════════════════════════════════════════════════

function crearParticulasTrafico(camaraId, cantidad = 180) {
  const particles = [];
  for (let i = 0; i < cantidad; i++) {
    // Velocidad base positiva
    const velBase = 0.012 + Math.random() * 0.028;
    // En modo libre, 40% van en sentido contrario
    const direccion = Math.random() < 0.4 ? -1 : 1;
    
    particles.push({
      id: `${camaraId}-t-${i}`,
      progreso: Math.random(),
      velocidadBase: velBase,
      direccionLibre: direccion, // dirección en modo partículas libres
      carril: Math.floor(Math.random() * 5) - 2, // -2, -1, 0, 1, 2 (5 carriles)
      capa: Math.floor(Math.random() * 3),
      intensidad: 0.25 + Math.random() * 0.75,
    });
  }
  return particles;
}

function actualizarParticulasTrafico(particles, deltaTime, streetFlowMode) {
  const dt = deltaTime / 1000;
  for (const p of particles) {
    if (streetFlowMode) {
      // Modo sentido vial: TODAS van en dirección positiva (origen → destino)
      p.progreso += p.velocidadBase * dt;
    } else {
      // Modo partículas libres: cada una va en su dirección asignada
      p.progreso += p.velocidadBase * p.direccionLibre * dt;
    }
    
    // Wrap around
    if (p.progreso > 1) {
      p.progreso -= 1;
    }
    if (p.progreso < 0) {
      p.progreso += 1;
    }
  }
}

function buildTrafficData(particles, route, densidad, direcciones, streetFlowMode) {
  if (!route || route.length < 2) return [];
  
  const data = [];
  const N = route.length;
  
  for (const p of particles) {
    const idx = Math.floor(p.progreso * (N - 1));
    const nextIdx = Math.min(idx + 1, N - 1);
    const frac = (p.progreso * (N - 1)) - idx;
    
    const p1 = route[idx];
    const p2 = route[nextIdx];
    const lng = p1[0] + (p2[0] - p1[0]) * frac;
    const lat = p1[1] + (p2[1] - p1[1]) * frac;
    
    const d = (densidad[idx] || 0) * p.intensidad;
    if (d < 0.06) continue;
    
    // Vector perpendicular a la dirección del segmento
    const dx = p2[0] - p1[0];
    const dy = p2[1] - p1[1];
    const len = Math.sqrt(dx * dx + dy * dy) || 1e-9;
    const nx = -dy / len;
    const ny = dx / len;
    
    // Ancho de carril más estrecho para más densidad visual
    const anchoCarril = 6 / 111320;
    const offsetLng = nx * p.carril * anchoCarril;
    const offsetLat = ny * p.carril * anchoCarril;
    
    const alturaMax = 20 + d * 30;
    const altura = (p.capa / 2) * alturaMax * d;
    
    const alpha = Math.floor(210 * d * (1 - p.capa * 0.15));
    
    data.push({
      position: [lng + offsetLng, lat + offsetLat, altura],
      color: colorTrafico(d, alpha),
    });
  }
  
  return data;
}

// ═══════════════════════════════════════════════════════════════════════════════
// PARTÍCULAS DE EMISIONES
// ═══════════════════════════════════════════════════════════════════════════════

function crearParticulasEmisiones(camaraId, cantidad = 60) {
  const particles = [];
  for (let i = 0; i < cantidad; i++) {
    // Reducir maxVida en 40% para que las partículas desaparezcan más rápido
    // Antes: 8000 + random * 6000 = 8000-14000ms
    // Ahora: 4800 + random * 3600 = 4800-8400ms (60% del original)
    particles.push({
      id: `${camaraId}-e-${i}`,
      // Posición base en la ruta
      progresoRuta: Math.random(),
      // Offset desde el punto de origen (para dispersión)
      offsetX: 0,
      offsetY: 0,
      // Altura actual
      altura: 150 + Math.random() * 200,
      // Velocidad vertical base
      velVertical: 5 + Math.random() * 10,
      // Fase para oscilación
      fase: Math.random() * Math.PI * 2,
      intensidad: 0.4 + Math.random() * 0.6,
      // Tiempo de vida
      vida: 0,
      maxVida: 4800 + Math.random() * 3600, // 40% más rápido
    });
  }
  return particles;
}

function actualizarParticulasEmisiones(particles, deltaTime, windMode, windData) {
  const dt = deltaTime / 1000;
  
  // Convertir dirección del viento a vector
  // windDeg: 0 = Norte (viento VIENE del norte, va hacia el sur)
  // Entonces el humo se mueve EN la dirección del viento
  const windRad = windData ? (windData.deg * Math.PI / 180) : 0;
  
  // Velocidad fija y lenta para movimiento suave (ignora windData.speed)
  const FIXED_SLOW_SPEED = 1.2; // velocidad fija lenta
  
  // Vector de movimiento del viento (hacia donde va el humo)
  // Usa solo la DIRECCIÓN del viento, no la velocidad real
  const windVx = Math.sin(windRad) * FIXED_SLOW_SPEED * 0.00001; // escala para grados
  const windVy = -Math.cos(windRad) * FIXED_SLOW_SPEED * 0.00001;
  
  for (const p of particles) {
    p.vida += deltaTime;
    
    // Subida vertical con oscilación
    p.altura += p.velVertical * dt + Math.sin(p.vida * 0.001 + p.fase) * 2 * dt;
    
    if (windMode && windData) {
      // Modo viento real: las partículas se mueven en dirección del viento (velocidad fija)
      p.offsetX += windVx * dt * 60;
      p.offsetY += windVy * dt * 60;
      
      // Dispersión lateral reducida
      p.offsetX += (Math.random() - 0.5) * 0.000005;
      p.offsetY += (Math.random() - 0.5) * 0.000005;
    } else {
      // Modo dispersión: movimiento más caótico/orgánico
      p.offsetX += (Math.random() - 0.5) * 0.00002;
      p.offsetY += (Math.random() - 0.5) * 0.00002;
    }
    
    // Resetear cuando expira (también con maxVida reducido)
    if (p.vida > p.maxVida || p.altura > 500) {
      p.vida = 0;
      p.altura = 150 + Math.random() * 100;
      p.offsetX = 0;
      p.offsetY = 0;
      p.progresoRuta = Math.random();
      p.maxVida = 4800 + Math.random() * 3600; // 40% más rápido (consistente con crearParticulasEmisiones)
    }
  }
}

function buildEmissionsData(particles, route, densidad, time) {
  if (!route || route.length < 2) return [];
  
  const data = [];
  const N = route.length;
  
  for (const p of particles) {
    const idx = Math.floor(p.progresoRuta * (N - 1));
    const d = (densidad[idx] || 0) * p.intensidad;
    if (d < 0.1) continue;
    
    const punto = route[idx];
    
    // Fade out con la vida
    const vidaRatio = p.vida / p.maxVida;
    const fadeAlpha = 1 - vidaRatio * 0.6;
    const alpha = Math.floor((100 + d * 60) * fadeAlpha);
    
    // Escala con la vida (se expanden al subir)
    const escala = 1 + vidaRatio * 0.5;
    
    data.push({
      position: [
        punto[0] + p.offsetX,
        punto[1] + p.offsetY,
        (p.altura + d * 50) * 0.7  // 30% más cerca del suelo
      ],
      color: colorEmision(d, Math.max(alpha, 30)),
      radius: 18 * escala,
    });
  }
  
  return data;
}

// ═══════════════════════════════════════════════════════════════════════════════
// COMPONENTE PRINCIPAL
// ═══════════════════════════════════════════════════════════════════════════════

export default function TrafficFlowMap({ 
  activeLayer = 'traffic', 
  mapTheme = 'dark',
  trafficMode = false,  // false = partículas, true = sentido vial
  windMode = false,     // false = dispersión, true = viento real
  isSimulation = true,  // NUEVO: true = simulación, false = backend real
  onWindDataUpdate,     // callback para pasar datos del viento al padre
  onMapReady,           // callback para exponer el mapa al padre
}) {
  const mapContainer = useRef(null);
  const map = useRef(null);
  const deckOverlay = useRef(null);

  const activeLayerRef = useRef(activeLayer);
  const mapThemeRef = useRef(mapTheme);
  const trafficModeRef = useRef(trafficMode);
  const windModeRef = useRef(windMode);
  const lastStyleRef = useRef(null);
  const initializedRef = useRef(false);
  const [isMapReady, setIsMapReady] = useState(false); // Estado reactivo para el mapa

  const camarasRef = useRef([]);
  const markersRef = useRef([]);
  const openPopupRef = useRef(null);

  const routesDensasRef = useRef({});
  const direccionesRef = useRef({}); // direcciones de cada segmento
  const depositosRef = useRef([]);
  const densidadRef = useRef({});
  
  const trafficParticlesRef = useRef({});
  const emissionParticlesRef = useRef({});
  const windDataRef = useRef({ speed: 2, deg: 0 });

  const rafRef = useRef(null);
  const lastTimeRef = useRef(0);
  const simIntervalRef = useRef(null);
  const windIntervalRef = useRef(null);
  const stompClientRef = useRef(null); // NUEVO: Cliente WebSocket

  // Actualizar refs cuando cambian props
  useEffect(() => { trafficModeRef.current = trafficMode; }, [trafficMode]);
  useEffect(() => { windModeRef.current = windMode; }, [windMode]);

  // ─────────────────────────────────────────────────────────────────────────────
  // EDIFICIOS 3D
  // ─────────────────────────────────────────────────────────────────────────────
  
  const addBuildingsLayer = useCallback(() => {
    if (!map.current || map.current.getLayer('3d-buildings')) return;
    map.current.addLayer({
      id: '3d-buildings',
      source: 'composite',
      'source-layer': 'building',
      filter: ['==', 'extrude', 'true'],
      type: 'fill-extrusion',
      minzoom: 12,
      paint: {
        'fill-extrusion-color': mapThemeRef.current === 'dark' 
          ? ['interpolate', ['linear'], ['coalesce', ['get', 'height'], 0], 0, '#1a2535', 100, '#2a3b54', 200, '#3a4b64']
          : ['interpolate', ['linear'], ['coalesce', ['get', 'height'], 0], 0, '#d0d5dd', 100, '#b8bfc9', 200, '#a0a8b4'],
        'fill-extrusion-height': ['get', 'height'],
        'fill-extrusion-base': ['get', 'min_height'],
        'fill-extrusion-opacity': 0.5,
      },
    });
  }, []);

  // ─────────────────────────────────────────────────────────────────────────────
  // RENDER DECK.GL
  // ─────────────────────────────────────────────────────────────────────────────

  const renderDeck = useCallback((time) => {
    if (!deckOverlay.current) return;

    const layers = [];
    const currentLayer = activeLayerRef.current;

    // Show traffic when layer is 'traffic' OR 'routes' (to display background traffic with routes)
    if (currentLayer === 'traffic' || currentLayer === 'routes') {
      for (const cam of camarasRef.current) {
        const particles = trafficParticlesRef.current[cam.id];
        const route = routesDensasRef.current[cam.id];
        const densidad = densidadRef.current[cam.id];
        const direcciones = direccionesRef.current[cam.id];
        if (!particles || !route) continue;
        
        const data = buildTrafficData(particles, route, densidad, direcciones, trafficModeRef.current);
        if (data.length === 0) continue;
        
        layers.push(new ScatterplotLayer({
          id: `traffic-${cam.id}`,
          data,
          getPosition: d => d.position,
          getFillColor: d => d.color,
          getRadius: 4,
          radiusUnits: 'meters',
          radiusMinPixels: 1.5,
          radiusMaxPixels: 4,
          billboard: true,
          opacity: 1,
          pickable: false,
          parameters: { depthTest: false },
        }));
      }
    }
    
    // Show emissions when layer is 'emissions' OR 'routes' (to display background emissions with routes)
    if (currentLayer === 'emissions' || currentLayer === 'routes') {
      for (const cam of camarasRef.current) {
        const particles = emissionParticlesRef.current[cam.id];
        const route = routesDensasRef.current[cam.id];
        const densidad = densidadRef.current[cam.id];
        if (!particles || !route) continue;

        const data = buildEmissionsData(particles, route, densidad, time);
        if (data.length === 0) continue;

        layers.push(new ScatterplotLayer({
          id: `emissions-${cam.id}`,
          data,
          getPosition: d => d.position,
          getFillColor: d => d.color,
          getRadius: d => d.radius || 18,
          radiusUnits: 'meters',
          radiusMinPixels: 6,
          radiusMaxPixels: 24,
          billboard: true,
          opacity: 0.8,
          pickable: false,
          parameters: { depthTest: false },
        }));
      }
    }

    deckOverlay.current.setProps({ layers });
  }, []);

  // ─────────────────────────────────────────────────────────────────────────────
  // PROCESAR EVENTO → DEPÓSITO
  // ─────────────────────────────────────────────────────────────────────────────

  const procesarEvento = useCallback((camaraIdOrPayload, routeIdx, intensity) => {
    // Si recibimos un objeto con estructura de payload del backend
    if (typeof camaraIdOrPayload === 'object' && camaraIdOrPayload.camara) {
      const payload = camaraIdOrPayload;
      const { camara, vehiculo_nuevo, emisiones } = payload;
      
      if (!vehiculo_nuevo) return; // Solo procesar cuando hay vehículo nuevo
      
      // Buscar la cámara
      const cam = camarasRef.current.find(c => c.id === camara);
      if (!cam) return;
      
      const route = routesDensasRef.current[camara];
      if (!route) return;
      
      // Calcular intensity desde emisiones
      const calcIntensity = intensidadEvento(emisiones);
      const routeIdxRandom = Math.floor(Math.random() * route.length);
      
      // Recursión con parámetros tradicionales
      return procesarEvento(camara, routeIdxRandom, calcIntensity);
    }
    
    // Modo tradicional (simulación o llamada recursiva)
    const camaraId = camaraIdOrPayload;
    if (intensity < 0.2) return;
    depositosRef.current.push({
      camaraId,
      routeIdx,
      intensity,
      ttl: 8000 + Math.random() * 8000,
      startTime: Date.now(),
    });
    if (depositosRef.current.length > 300) {
      depositosRef.current = depositosRef.current.slice(-300);
    }
  }, [intensidadEvento]);

  // ─────────────────────────────────────────────────────────────────────────────
  // RECALCULAR CAMPO DE DENSIDAD
  // ─────────────────────────────────────────────────────────────────────────────

  const recalcularDensidad = useCallback(() => {
    const now = Date.now();
    depositosRef.current = depositosRef.current.filter(d => now - d.startTime < d.ttl);

    for (const cam of CAMARAS_CONFIG) {
      const route = routesDensasRef.current[cam.id];
      if (!route || route.length === 0) {
        densidadRef.current[cam.id] = new Float32Array(0);
        continue;
      }

      const N = route.length;
      const densidad = new Float32Array(N);
      const RADIO = 15;
      const sigma2 = 2 * (RADIO / 2) * (RADIO / 2);

      const deps = depositosRef.current.filter(d => d.camaraId === cam.id);
      for (const dep of deps) {
        const age = clamp((now - dep.startTime) / dep.ttl, 0, 1);
        const intensidad = dep.intensity * (1 - age);
        const idx = clamp(dep.routeIdx, 0, N - 1);
        for (let di = -RADIO; di <= RADIO; di++) {
          const i = idx + di;
          if (i < 0 || i >= N) continue;
          densidad[i] += intensidad * Math.exp(-(di * di) / sigma2);
        }
      }

      for (let i = 0; i < N; i++) {
        densidad[i] = Math.min(densidad[i], 1);
      }
      densidadRef.current[cam.id] = densidad;
    }
  }, []);

  // ─────────────────────────────────────────────────────────────────────────────
  // GENERAR NUEVOS EVENTOS
  // ─────────────────────────────────────────────────────────────────────────────

  const generarEventos = useCallback(() => {
    for (let c = 0; c < CAMARAS_CONFIG.length; c++) {
      const cam = CAMARAS_CONFIG[c];
      const route = routesDensasRef.current[cam.id];
      if (!route || route.length === 0) continue;
      
      const perfil = PERFILES_EMISION[c];
      const variar = (base) => base * (0.7 + Math.random() * 0.6);
      
      const n = 2 + Math.floor(Math.random() * 3);
      for (let i = 0; i < n; i++) {
        const routeIdx = Math.floor(Math.random() * route.length);
        const intensity = intensidadEvento({
          co2: variar(perfil.co2),
          nox: variar(perfil.nox),
          pm25: variar(perfil.pm25),
        });
        procesarEvento(cam.id, routeIdx, intensity);
      }
    }
    recalcularDensidad();
  }, [procesarEvento, recalcularDensidad]);

  // ─────────────────────────────────────────────────────────────────────────────
  // WARMUP
  // ─────────────────────────────────────────────────────────────────────────────

  const warmup = useCallback(() => {
    for (const cam of camarasRef.current) {
      const route = routesDensasRef.current[cam.id];
      if (!route) continue;
      trafficParticlesRef.current[cam.id] = crearParticulasTrafico(cam.id, 200);
      emissionParticlesRef.current[cam.id] = crearParticulasEmisiones(cam.id, 60);
    }
    
    for (let i = 0; i < 10; i++) {
      generarEventos();
    }
  }, [generarEventos]);

  // ─────────────────────────────────────────────────────────────────────────────
  // ANIMATION LOOP
  // ─────────────────────────────────────────────────────────────────────────────

  const animate = useCallback((time) => {
    const deltaTime = lastTimeRef.current ? time - lastTimeRef.current : 16;
    lastTimeRef.current = time;

    for (const cam of camarasRef.current) {
      const trafficP = trafficParticlesRef.current[cam.id];
      const emissionP = emissionParticlesRef.current[cam.id];
      if (trafficP) actualizarParticulasTrafico(trafficP, deltaTime, trafficModeRef.current);
      if (emissionP) actualizarParticulasEmisiones(emissionP, deltaTime, windModeRef.current, windDataRef.current);
    }

    renderDeck(time);
    rafRef.current = requestAnimationFrame(animate);
  }, [renderDeck]);

  // ─────────────────────────────────────────────────────────────────────────────
  // EFECTO PRINCIPAL
  // ─────────────────────────────────────────────────────────────────────────────

  useEffect(() => {
    if (map.current) return;

    const initialStyle = mapTheme === 'light'
      ? 'mapbox://styles/mapbox/light-v11'
      : 'mapbox://styles/mapbox/dark-v11';

    mapThemeRef.current = mapTheme;
    lastStyleRef.current = initialStyle;

    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      accessToken: MAPBOX_TOKEN,
      style: initialStyle,
      center: [-99.1410, 19.4320],
      zoom: 14,
      pitch: 55,
      bearing: -15,
      antialias: true,
    });

    map.current.addControl(new mapboxgl.NavigationControl(), 'top-right');

    deckOverlay.current = new MapboxOverlay({ interleaved: false, layers: [] });
    map.current.addControl(deckOverlay.current);

    map.current.on('load', async () => {
      if (initializedRef.current) return;
      initializedRef.current = true;

      // Exponer el mapa al padre
      if (onMapReady) onMapReady(map.current);

      addBuildingsLayer();

      // Cargar datos del viento
      const wind = await fetchWindData();
      windDataRef.current = wind;
      if (onWindDataUpdate) onWindDataUpdate(wind);

      // Cargar cámaras (simulación o backend)
      if (isSimulation) {
        camarasRef.current = await buildCamarasWithRoutes();
      } else {
        // Modo real: cargar desde backend
        try {
          const res = await fetch(`${BACKEND_URL}/api/camaras`);
          const camarasData = await res.json();
          
          // Convertir formato backend a formato interno
          camarasRef.current = camarasData.map(c => ({
            id: c.nombre,
            nombre: c.descripcion || c.nombre,
            lat: c.lat,
            lng: c.lng,
          }));
          
          // Generar rutas para cada cámara (simuladas geométricamente)
          for (const cam of camarasRef.current) {
            const route = crearRutaDensa([cam.lng, cam.lat], [cam.lng + 0.002, cam.lat + 0.002], 50);
            routesDensasRef.current[cam.id] = route;
            direccionesRef.current[cam.id] = calcularDirecciones(route);
            densidadRef.current[cam.id] = new Array(route.length).fill(0);
          }
        } catch (e) {
          console.error('Error loading cameras from backend:', e);
          // Fallback a simulación
          camarasRef.current = await buildCamarasWithRoutes();
        }
      }

      for (const cam of camarasRef.current) {
        const rutaDensa = densificarRuta(cam.routePoints, 12);
        routesDensasRef.current[cam.id] = rutaDensa;
        direccionesRef.current[cam.id] = calcularDirecciones(rutaDensa);
        densidadRef.current[cam.id] = new Float32Array(0);
      }
      depositosRef.current = [];

      // Marcadores de cámara (diseño radar pulse innovador)
      for (let i = 0; i < camarasRef.current.length; i++) {
        const cam = camarasRef.current[i];
        // Calcular score de emisión basado en el perfil (normalizado 0-1)
        const perfil = PERFILES_EMISION[i % PERFILES_EMISION.length];
        const emissionScore = Math.min(perfil.co2 / 200, 1); // Normalizar CO2 max ~200
        const camaraColors = getColorCamara(emissionScore);
        
        const el = document.createElement('div');
        el.style.cssText = 'cursor:pointer;width:52px;height:52px;';
        el.innerHTML = crearCameraMarkerSVG(camaraColors, mapThemeRef.current === 'light');

        const popup = new mapboxgl.Popup({ offset: 25, closeButton: false, focusAfterOpen: false })
          .setHTML(`<div style="background:${mapThemeRef.current === 'light' ? 'rgba(255,255,255,0.95)' : 'rgba(26,26,46,0.95)'};color:${mapThemeRef.current === 'light' ? '#333' : '#F5F5F5'};padding:12px 16px;border-radius:8px;font-size:11px;border:1px solid ${camaraColors.primary}44;font-family:'Inter',system-ui,sans-serif;box-shadow:0 4px 12px rgba(0,0,0,0.15);">
            <div style="font-weight:600;margin-bottom:6px;">${cam.nombre}</div>
            <div style="display:flex;align-items:center;gap:6px;">
              <span style="width:6px;height:6px;border-radius:50%;background:${camaraColors.primary};"></span>
              <span style="color:${mapThemeRef.current === 'light' ? 'rgba(0,0,0,0.5)' : 'rgba(255,255,255,0.6)'};font-size:10px;letter-spacing:0.04em;">ESCANEANDO</span>
            </div>
          </div>`);

        popup.on('close', () => { if (openPopupRef.current === popup) openPopupRef.current = null; });

        const marker = new mapboxgl.Marker({ element: el, anchor: 'center' })
          .setLngLat(cam.markerCoord)
          .addTo(map.current);

        // Solo popup en hover, sin animación de escala
        el.addEventListener('mouseenter', () => {
          if (openPopupRef.current) openPopupRef.current.remove();
          popup.setLngLat(cam.markerCoord).addTo(map.current);
          openPopupRef.current = popup;
        });
        el.addEventListener('mouseleave', () => {
          if (openPopupRef.current === popup) { popup.remove(); openPopupRef.current = null; }
        });

        markersRef.current.push(marker);
      }

      map.current.on('click', () => {
        if (openPopupRef.current) { openPopupRef.current.remove(); openPopupRef.current = null; }
      });

      warmup();
      rafRef.current = requestAnimationFrame(animate);
      
      // Marcar mapa como listo para que el efecto de simulación se active
      setIsMapReady(true);

      // Actualizar viento cada 5 minutos
      windIntervalRef.current = setInterval(async () => {
        const wind = await fetchWindData();
        windDataRef.current = wind;
        if (onWindDataUpdate) onWindDataUpdate(wind);
      }, 300000);
    });

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      if (simIntervalRef.current) clearInterval(simIntervalRef.current);
      if (windIntervalRef.current) clearInterval(windIntervalRef.current);
      if (stompClientRef.current) {
        stompClientRef.current.deactivate();
        stompClientRef.current = null;
      }
      markersRef.current.forEach(m => m.remove());
      markersRef.current = [];
      deckOverlay.current?.finalize();
      map.current?.remove();
      map.current = null;
      deckOverlay.current = null;
      setIsMapReady(false);
    };
  }, [addBuildingsLayer, mapTheme, animate, warmup, generarEventos, onWindDataUpdate, onMapReady, procesarEvento, recalcularDensidad, intensidadEvento]);

  // ─────────────────────────────────────────────────────────────────────────────
  // MANEJO DE CAMBIOS EN EL MODO (SIMULACIÓN ↔ REAL)
  // ─────────────────────────────────────────────────────────────────────────────
  useEffect(() => {
    // Esperar a que el mapa esté inicializado completamente
    if (!isMapReady) return;

    // Limpiar intervalo de simulación si existe
    if (simIntervalRef.current) {
      clearInterval(simIntervalRef.current);
      simIntervalRef.current = null;
    }

    // Limpiar WebSocket si existe
    if (stompClientRef.current) {
      stompClientRef.current.deactivate();
      stompClientRef.current = null;
    }

    // Iniciar nuevo modo
    if (isSimulation) {
      // Modo simulación: generar eventos aleatorios
      console.log('🔬 Activando modo SIMULACIÓN');
      simIntervalRef.current = setInterval(generarEventos, 1200);
    } else {
      // Modo real: conectar WebSocket STOMP
      console.log('📡 Activando modo REAL - Conectando al backend');
      const stompClient = new Client({
        webSocketFactory: () => new SockJS(`${BACKEND_URL}/ws`),
        reconnectDelay: 5000,
        heartbeatIncoming: 4000,
        heartbeatOutgoing: 4000,
        onConnect: () => {
          console.log('✅ WebSocket STOMP conectado');
          stompClient.subscribe('/topic/camaras', (message) => {
            try {
              const payload = JSON.parse(message.body);
              procesarEvento(payload);
            } catch (e) {
              console.error('Error procesando mensaje WebSocket:', e);
            }
          });
        },
        onStompError: (frame) => {
          console.error('❌ Error STOMP:', frame.headers.message);
        },
        onWebSocketError: (error) => {
          console.error('❌ Error WebSocket:', error);
        },
      });

      stompClient.activate();
      stompClientRef.current = stompClient;
    }

    // Cleanup al desmontar o cambiar de modo
    return () => {
      if (simIntervalRef.current) {
        clearInterval(simIntervalRef.current);
        simIntervalRef.current = null;
      }
      if (stompClientRef.current) {
        stompClientRef.current.deactivate();
        stompClientRef.current = null;
      }
    };
  }, [isSimulation, isMapReady, generarEventos, procesarEvento]);

  useEffect(() => {
    activeLayerRef.current = activeLayer;
  }, [activeLayer]);

  useEffect(() => {
    mapThemeRef.current = mapTheme;
    if (!map.current) return;

    const desiredStyle = mapTheme === 'light'
      ? 'mapbox://styles/mapbox/light-v11'
      : 'mapbox://styles/mapbox/dark-v11';

    if (lastStyleRef.current === desiredStyle) return;

    const handleStyleLoad = () => {
      if (!map.current) return;
      if (deckOverlay.current) {
        try { map.current.removeControl(deckOverlay.current); } catch (e) {}
        map.current.addControl(deckOverlay.current);
      }
      addBuildingsLayer();
    };

    map.current.once('style.load', handleStyleLoad);
    map.current.setStyle(desiredStyle);
    lastStyleRef.current = desiredStyle;

    return () => { map.current?.off('style.load', handleStyleLoad); };
  }, [addBuildingsLayer, mapTheme]);

  return (
    <div
      ref={mapContainer}
      style={{ width: '100vw', height: '100vh', position: 'absolute', top: 0, left: 0 }}
    />
  );
}
