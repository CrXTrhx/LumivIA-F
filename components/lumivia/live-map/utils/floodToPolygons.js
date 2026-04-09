// ═══════════════════════════════════════════════════════════════════════════════
// FLOOD TO POLYGONS - Conversión de Datos de Inundación a Polígonos de Exclusión
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Convierte floodGrid + reports en polígonos de exclusión para Mapbox Directions API
 * 
 * @param {Object} floodGrid - GeoJSON FeatureCollection con puntos de riesgo
 * @param {Array} reports - Array de reportes de usuarios
 * @param {Object} options - Opciones de configuración
 * @returns {Object} GeoJSON FeatureCollection con polígonos de exclusión
 */
export function convertFloodDataToExcludePolygons(floodGrid, reports, options = {}) {
  const {
    riskThreshold = 0.6,                    // Solo alto riesgo
    reportSeverities = ['MODERADO', 'SEVERO'], // Severidades a evitar
    bufferMeters = 80,                      // Buffer alrededor de puntos
    maxPolygons = 20,                       // Límite de polígonos
    clusterDistance = 150,                  // Distancia para agrupar puntos (metros)
  } = options;
  
  const polygons = [];
  
  // 1. Filtrar puntos de alto riesgo del grid
  const highRiskPoints = floodGrid?.features
    ?.filter(f => f.properties.risk > riskThreshold)
    .map(f => ({
      lng: f.geometry.coordinates[0],
      lat: f.geometry.coordinates[1],
      risk: f.properties.risk,
    })) || [];
  
  console.log(`🚧 Flood exclusion: ${highRiskPoints.length} high-risk points (risk > ${riskThreshold})`);
  
  // 2. Agrupar puntos cercanos (clustering simple)
  const clusters = clusterPoints(highRiskPoints, clusterDistance);
  console.log(`🚧 Flood exclusion: ${clusters.length} clusters created`);
  
  // 3. Crear polígonos para cada cluster
  for (const cluster of clusters) {
    if (cluster.points.length === 1) {
      // Un solo punto: crear círculo
      polygons.push(createCirclePolygon(
        cluster.points[0].lng,
        cluster.points[0].lat,
        bufferMeters,
        16 // 16 puntos para círculo
      ));
    } else if (cluster.points.length === 2) {
      // Dos puntos: crear cápsula (2 círculos + rectángulo)
      polygons.push(createCapsulePolygon(
        cluster.points[0],
        cluster.points[1],
        bufferMeters
      ));
    } else {
      // Múltiples puntos: convex hull + buffer
      polygons.push(createConvexHullWithBuffer(cluster.points, bufferMeters));
    }
  }
  
  // 4. Agregar círculos para reportes MODERADO/SEVERO
  const filteredReports = reports?.filter(r => 
    reportSeverities.includes(r.severity)
  ) || [];
  
  console.log(`🚧 Flood exclusion: ${filteredReports.length} dangerous reports (${reportSeverities.join(', ')})`);
  
  for (const report of filteredReports) {
    const radius = report.severity === 'SEVERO' ? 100 : 70; // Mayor radio para SEVERO
    polygons.push(createCirclePolygon(report.lng, report.lat, radius, 16));
  }
  
  // 5. Limitar número de polígonos (Mapbox tiene límites)
  if (polygons.length > maxPolygons) {
    // Ordenar por área y mantener los más grandes
    polygons.sort((a, b) => calculatePolygonArea(b) - calculatePolygonArea(a));
    polygons.splice(maxPolygons);
    console.warn(`⚠️ Flood exclusion: Limited to ${maxPolygons} polygons (had ${polygons.length})`);
  }
  
  console.log(`✅ Flood exclusion: ${polygons.length} total exclusion polygons created`);
  
  return {
    type: 'FeatureCollection',
    features: polygons.map((coords, idx) => ({
      type: 'Feature',
      properties: {
        exclude: true,
        index: idx,
      },
      geometry: {
        type: 'Polygon',
        coordinates: [coords],
      },
    })),
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// CLUSTERING DE PUNTOS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Agrupa puntos cercanos usando clustering simple (greedy)
 */
function clusterPoints(points, maxDistance) {
  if (!points || points.length === 0) return [];
  
  const clusters = [];
  const used = new Set();
  
  for (let i = 0; i < points.length; i++) {
    if (used.has(i)) continue;
    
    const cluster = { points: [points[i]] };
    used.add(i);
    
    // Buscar puntos cercanos
    for (let j = i + 1; j < points.length; j++) {
      if (used.has(j)) continue;
      
      const dist = haversineDistance(
        [points[i].lng, points[i].lat],
        [points[j].lng, points[j].lat]
      );
      
      if (dist <= maxDistance) {
        cluster.points.push(points[j]);
        used.add(j);
      }
    }
    
    clusters.push(cluster);
  }
  
  return clusters;
}

// ═══════════════════════════════════════════════════════════════════════════════
// CREACIÓN DE POLÍGONOS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Crea un polígono circular
 */
function createCirclePolygon(lng, lat, radiusMeters, points = 16) {
  const coords = [];
  for (let i = 0; i <= points; i++) {
    const angle = (i / points) * Math.PI * 2;
    const dx = Math.cos(angle) * radiusMeters;
    const dy = Math.sin(angle) * radiusMeters;
    coords.push([
      lng + dx / (111000 * Math.cos(lat * Math.PI / 180)),
      lat + dy / 111000,
    ]);
  }
  return coords;
}

/**
 * Crea una cápsula (polígono alargado entre dos puntos)
 */
function createCapsulePolygon(p1, p2, radiusMeters) {
  const points = 12;
  const coords = [];
  
  // Calcular ángulo entre puntos
  const angle = Math.atan2(p2.lat - p1.lat, p2.lng - p1.lng);
  const perpAngle = angle + Math.PI / 2;
  
  // Semicírculo en p1
  for (let i = 0; i <= points / 2; i++) {
    const a = perpAngle + (i / (points / 2)) * Math.PI;
    const dx = Math.cos(a) * radiusMeters;
    const dy = Math.sin(a) * radiusMeters;
    coords.push([
      p1.lng + dx / (111000 * Math.cos(p1.lat * Math.PI / 180)),
      p1.lat + dy / 111000,
    ]);
  }
  
  // Semicírculo en p2
  for (let i = 0; i <= points / 2; i++) {
    const a = perpAngle + Math.PI + (i / (points / 2)) * Math.PI;
    const dx = Math.cos(a) * radiusMeters;
    const dy = Math.sin(a) * radiusMeters;
    coords.push([
      p2.lng + dx / (111000 * Math.cos(p2.lat * Math.PI / 180)),
      p2.lat + dy / 111000,
    ]);
  }
  
  // Cerrar polígono
  coords.push(coords[0]);
  
  return coords;
}

/**
 * Crea convex hull con buffer para múltiples puntos
 */
function createConvexHullWithBuffer(points, bufferMeters) {
  if (points.length < 3) {
    // Fallback a círculo en centroide
    const centroid = calculateCentroid(points);
    return createCirclePolygon(centroid.lng, centroid.lat, bufferMeters * 1.5, 16);
  }
  
  // Calcular convex hull (algoritmo de Graham scan simplificado)
  const hull = convexHull(points);
  
  // Aplicar buffer expandiendo hacia afuera
  const buffered = [];
  for (let i = 0; i < hull.length; i++) {
    const point = hull[i];
    const prev = hull[(i - 1 + hull.length) % hull.length];
    const next = hull[(i + 1) % hull.length];
    
    // Calcular normal hacia afuera
    const angle1 = Math.atan2(point.lat - prev.lat, point.lng - prev.lng);
    const angle2 = Math.atan2(next.lat - point.lat, next.lng - point.lng);
    const normalAngle = (angle1 + angle2) / 2 + Math.PI / 2;
    
    // Desplazar punto
    const dx = Math.cos(normalAngle) * bufferMeters;
    const dy = Math.sin(normalAngle) * bufferMeters;
    
    buffered.push([
      point.lng + dx / (111000 * Math.cos(point.lat * Math.PI / 180)),
      point.lat + dy / 111000,
    ]);
  }
  
  // Cerrar polígono
  buffered.push(buffered[0]);
  
  return buffered;
}

/**
 * Convex hull usando Graham scan
 */
function convexHull(points) {
  if (points.length < 3) return points;
  
  // Copiar y ordenar por coordenada X
  const sorted = [...points].sort((a, b) => a.lng - b.lng || a.lat - b.lat);
  
  // Construir lower hull
  const lower = [];
  for (const p of sorted) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) {
      lower.pop();
    }
    lower.push(p);
  }
  
  // Construir upper hull
  const upper = [];
  for (let i = sorted.length - 1; i >= 0; i--) {
    const p = sorted[i];
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) {
      upper.pop();
    }
    upper.push(p);
  }
  
  // Remover último punto de cada mitad (duplicado)
  lower.pop();
  upper.pop();
  
  return [...lower, ...upper];
}

/**
 * Producto cruz para determinar orientación
 */
function cross(o, a, b) {
  return (a.lng - o.lng) * (b.lat - o.lat) - (a.lat - o.lat) * (b.lng - o.lng);
}

// ═══════════════════════════════════════════════════════════════════════════════
// UTILIDADES GEOMÉTRICAS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Calcula centroide de un conjunto de puntos
 */
function calculateCentroid(points) {
  if (!points || points.length === 0) return { lng: 0, lat: 0 };
  
  const sum = points.reduce(
    (acc, p) => ({ lng: acc.lng + p.lng, lat: acc.lat + p.lat }),
    { lng: 0, lat: 0 }
  );
  
  return {
    lng: sum.lng / points.length,
    lat: sum.lat / points.length,
  };
}

/**
 * Calcula área de un polígono (Shoelace formula)
 */
function calculatePolygonArea(coords) {
  if (!coords || coords.length < 3) return 0;
  
  let area = 0;
  for (let i = 0; i < coords.length - 1; i++) {
    area += coords[i][0] * coords[i + 1][1];
    area -= coords[i + 1][0] * coords[i][1];
  }
  return Math.abs(area / 2);
}

/**
 * Distancia Haversine entre dos coordenadas
 */
function haversineDistance(coord1, coord2) {
  const R = 6371000; // Radio de la Tierra en metros
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
