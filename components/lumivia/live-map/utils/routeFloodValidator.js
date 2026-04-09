/**
 * routeFloodValidator.js
 * 
 * Valida rutas generadas contra datos de inundación para determinar
 * si la ruta cruza zonas inundadas y generar estadísticas de seguridad.
 */

/**
 * Calcula la distancia más corta de un punto a un segmento de línea
 * @param {Object} point - Punto { lat, lng }
 * @param {Object} segmentStart - Inicio del segmento { lat, lng }
 * @param {Object} segmentEnd - Fin del segmento { lat, lng }
 * @returns {number} Distancia en metros
 */
function pointToSegmentDistance(point, segmentStart, segmentEnd) {
  const { lat: px, lng: py } = point;
  const { lat: x1, lng: y1 } = segmentStart;
  const { lat: x2, lng: y2 } = segmentEnd;

  // Convertir a coordenadas cartesianas aproximadas (metros)
  const lat0 = (x1 + x2) / 2;
  const meterPerDegreeLat = 111320;
  const meterPerDegreeLng = 111320 * Math.cos((lat0 * Math.PI) / 180);

  const pxM = px * meterPerDegreeLat;
  const pyM = py * meterPerDegreeLng;
  const x1M = x1 * meterPerDegreeLat;
  const y1M = y1 * meterPerDegreeLng;
  const x2M = x2 * meterPerDegreeLat;
  const y2M = y2 * meterPerDegreeLng;

  // Vector del segmento
  const dx = x2M - x1M;
  const dy = y2M - y1M;
  const lengthSquared = dx * dx + dy * dy;

  if (lengthSquared === 0) {
    // El segmento es un punto
    return Math.sqrt((pxM - x1M) ** 2 + (pyM - y1M) ** 2);
  }

  // Parámetro t del punto más cercano en el segmento
  let t = ((pxM - x1M) * dx + (pyM - y1M) * dy) / lengthSquared;
  t = Math.max(0, Math.min(1, t)); // Clamp a [0, 1]

  // Punto más cercano en el segmento
  const closestX = x1M + t * dx;
  const closestY = y1M + t * dy;

  // Distancia del punto al punto más cercano
  return Math.sqrt((pxM - closestX) ** 2 + (pyM - closestY) ** 2);
}

/**
 * Extrae las coordenadas de una geometría de ruta
 * @param {Object} routeGeometry - Geometría de Mapbox Directions API
 * @returns {Array} Array de puntos [{ lat, lng }, ...]
 */
function extractRouteCoordinates(routeGeometry) {
  if (!routeGeometry || !routeGeometry.coordinates) {
    return [];
  }

  return routeGeometry.coordinates.map(([lng, lat]) => ({ lat, lng }));
}

/**
 * Valida una ruta contra datos de inundación
 * @param {Object} route - Ruta de Mapbox Directions API
 * @param {Object} floodData - Datos de inundación { floodGrid, reports, rainZones }
 * @param {Object} excludePolygons - Polígonos que fueron excluidos (GeoJSON FeatureCollection)
 * @returns {Object} Resultado de validación
 */
export function validateRouteAgainstFloods(route, floodData, excludePolygons = null) {
  const result = {
    isSafe: true,
    zonesCrossed: 0,
    zonesEvaded: 0,
    crossedZones: [],
    riskLevel: 'bajo', // 'bajo' | 'medio' | 'alto'
    maxRiskEncountered: 0,
    warnings: [],
  };

  if (!route || !route.geometry) {
    console.warn('[routeFloodValidator] Ruta inválida, no se puede validar');
    return result;
  }

  if (!floodData || (!floodData.floodGrid && !floodData.reports)) {
    console.log('[routeFloodValidator] No hay datos de inundación, ruta considerada segura');
    return result;
  }

  // Extraer coordenadas de la ruta
  const routePoints = extractRouteCoordinates(route.geometry);
  
  if (routePoints.length === 0) {
    console.warn('[routeFloodValidator] Ruta sin coordenadas');
    return result;
  }

  console.log(`[routeFloodValidator] Validando ruta con ${routePoints.length} puntos`);

  // Contar zonas evadidas (polígonos que fueron excluidos)
  if (excludePolygons && excludePolygons.features) {
    result.zonesEvaded = excludePolygons.features.length;
    console.log(`[routeFloodValidator] Zonas evadidas: ${result.zonesEvaded}`);
  }

  // 1. Verificar cruces con puntos de alto riesgo del floodGrid
  if (floodData.floodGrid && floodData.floodGrid.features) {
    const highRiskPoints = floodData.floodGrid.features.filter(
      (feature) => feature.properties.risk > 0.6
    );

    console.log(`[routeFloodValidator] Verificando ${highRiskPoints.length} puntos de alto riesgo`);

    for (const feature of highRiskPoints) {
      const [lng, lat] = feature.geometry.coordinates;
      const floodPoint = { lat, lng };
      const risk = feature.properties.risk;

      // Verificar si algún segmento de la ruta pasa cerca del punto de inundación
      for (let i = 0; i < routePoints.length - 1; i++) {
        const distance = pointToSegmentDistance(
          floodPoint,
          routePoints[i],
          routePoints[i + 1]
        );

        // Si la ruta pasa a menos de 80m del punto de inundación, considerarlo cruce
        if (distance < 80) {
          result.zonesCrossed++;
          result.isSafe = false;
          result.maxRiskEncountered = Math.max(result.maxRiskEncountered, risk);

          result.crossedZones.push({
            type: 'floodPoint',
            lat,
            lng,
            risk,
            riskLevel: feature.properties.riskLevel || 'alto',
            distance: Math.round(distance),
          });

          break; // No contar el mismo punto múltiples veces
        }
      }
    }
  }

  // 2. Verificar cruces con reportes de usuarios (MODERADO/SEVERO)
  if (floodData.reports && Array.isArray(floodData.reports)) {
    const criticalReports = floodData.reports.filter(
      (report) => report.severity === 'MODERADO' || report.severity === 'SEVERO'
    );

    console.log(`[routeFloodValidator] Verificando ${criticalReports.length} reportes críticos`);

    for (const report of criticalReports) {
      const reportPoint = { lat: report.lat, lng: report.lng };
      const severityValue = report.severityValue || (report.severity === 'SEVERO' ? 1.0 : 0.7);

      // Verificar si algún segmento de la ruta pasa cerca del reporte
      for (let i = 0; i < routePoints.length - 1; i++) {
        const distance = pointToSegmentDistance(
          reportPoint,
          routePoints[i],
          routePoints[i + 1]
        );

        // Radio de afectación basado en severidad
        const affectedRadius = report.severity === 'SEVERO' ? 100 : 80;

        if (distance < affectedRadius) {
          result.zonesCrossed++;
          result.isSafe = false;
          result.maxRiskEncountered = Math.max(result.maxRiskEncountered, severityValue);

          result.crossedZones.push({
            type: 'userReport',
            lat: report.lat,
            lng: report.lng,
            severity: report.severity,
            severityValue,
            description: report.description,
            distance: Math.round(distance),
          });

          break; // No contar el mismo reporte múltiples veces
        }
      }
    }
  }

  // 3. Determinar nivel de riesgo general
  if (result.maxRiskEncountered > 0.8) {
    result.riskLevel = 'alto';
    result.warnings.push('La ruta cruza zonas de inundación de ALTO riesgo');
  } else if (result.maxRiskEncountered > 0.6) {
    result.riskLevel = 'medio';
    result.warnings.push('La ruta cruza zonas de inundación de riesgo MODERADO');
  }

  // 4. Generar resumen
  if (!result.isSafe) {
    console.warn(
      `[routeFloodValidator] ⚠️ RUTA NO SEGURA: ${result.zonesCrossed} zonas cruzadas, riesgo ${result.riskLevel.toUpperCase()}`
    );
  } else {
    console.log('[routeFloodValidator] ✅ Ruta segura, sin cruces de inundación');
  }

  if (result.zonesEvaded > 0) {
    console.log(`[routeFloodValidator] 🛡️ ${result.zonesEvaded} zonas de inundación evitadas exitosamente`);
  }

  return result;
}

/**
 * Valida múltiples rutas y agrega información de validación a cada una
 * @param {Array} routes - Array de rutas generadas
 * @param {Object} floodData - Datos de inundación
 * @param {Object} excludePolygons - Polígonos excluidos
 * @returns {Array} Rutas con información de validación agregada
 */
export function validateMultipleRoutes(routes, floodData, excludePolygons = null) {
  if (!routes || !Array.isArray(routes)) {
    return routes;
  }

  console.log(`[routeFloodValidator] Validando ${routes.length} rutas`);

  return routes.map((route, index) => {
    const validation = validateRouteAgainstFloods(route, floodData, excludePolygons);
    
    console.log(`[routeFloodValidator] Ruta ${index + 1}:`, {
      nombre: route.nombre,
      segura: validation.isSafe,
      cruzadas: validation.zonesCrossed,
      evadidas: validation.zonesEvaded,
      riesgo: validation.riskLevel,
    });

    return {
      ...route,
      floodValidation: validation,
    };
  });
}

/**
 * Genera un resumen textual de la validación para mostrar en UI
 * @param {Object} validation - Resultado de validateRouteAgainstFloods
 * @returns {string} Resumen textual
 */
export function getValidationSummary(validation) {
  if (!validation) {
    return 'Sin información de inundaciones';
  }

  const parts = [];

  if (validation.zonesEvaded > 0) {
    parts.push(`✅ ${validation.zonesEvaded} zona${validation.zonesEvaded > 1 ? 's' : ''} evitada${validation.zonesEvaded > 1 ? 's' : ''}`);
  }

  if (validation.zonesCrossed > 0) {
    parts.push(`⚠️ ${validation.zonesCrossed} zona${validation.zonesCrossed > 1 ? 's' : ''} inundada${validation.zonesCrossed > 1 ? 's' : ''} en ruta`);
  }

  if (parts.length === 0) {
    return '✅ Sin inundaciones en el área';
  }

  return parts.join(' • ');
}

export default {
  validateRouteAgainstFloods,
  validateMultipleRoutes,
  getValidationSummary,
};
