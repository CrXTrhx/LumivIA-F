import { useEffect, useRef, useCallback } from 'react';

// ═══════════════════════════════════════════════════════════════════════════════
// CONFIGURACIÓN DE INUNDACIONES
// ═══════════════════════════════════════════════════════════════════════════════

// Colores de agua según nivel de riesgo - MÁS VISIBLES
const WATER_COLORS = {
  low: {
    fill: 'rgba(79, 195, 247, 0.45)',      // Más opaco
    extrusion: '#4FC3F7',
    glow: 'rgba(79, 195, 247, 0.25)',
  },
  medium: {
    fill: 'rgba(2, 136, 209, 0.55)',       // Más opaco
    extrusion: '#0288D1',
    glow: 'rgba(2, 136, 209, 0.30)',
  },
  high: {
    fill: 'rgba(1, 87, 155, 0.65)',        // Más opaco
    extrusion: '#01579B',
    glow: 'rgba(1, 87, 155, 0.35)',
  },
};

// Alturas de agua según riesgo (metros) - MÁS ALTAS
const WATER_HEIGHT = {
  low: 2.5,
  medium: 6,
  high: 12,
};

// Colores de reportes según severidad
const REPORT_COLORS = {
  LEVE: '#4CAF50',
  MODERADO: '#FF9800',
  SEVERO: '#F44336',
};

// ═══════════════════════════════════════════════════════════════════════════════
// UTILIDADES
// ═══════════════════════════════════════════════════════════════════════════════

// Crear círculo GeoJSON
function createCirclePolygon(lng, lat, radiusMeters, points = 32) {
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

// ═══════════════════════════════════════════════════════════════════════════════
// COMPONENTE PRINCIPAL
// ═══════════════════════════════════════════════════════════════════════════════

export default function FloodRenderer({
  map,
  floodGrid,
  reports = [],
  isActive = false,
  isRaining = false,
}) {
  const animationRef = useRef(null);
  const timeRef = useRef(0);
  const layersAddedRef = useRef(false);

  // ─────────────────────────────────────────────────────────────────────────────
  // AGREGAR CAPAS DE INUNDACIÓN (HEATMAP + 3D)
  // ─────────────────────────────────────────────────────────────────────────────

  const addFloodLayers = useCallback(() => {
    if (!map || !isActive) return;
    
    const heatmapSourceId = 'flood-heatmap-source';
    const heatmapLayerId = 'flood-heatmap';
    const waterSourceId = 'flood-water-source';
    const waterLayerId = 'flood-water-3d';
    const waterGlowLayerId = 'flood-water-glow';
    
    // Preparar datos del grid
    const gridData = floodGrid || { type: 'FeatureCollection', features: [] };
    
    try {
      // ─────────────────────────────────────────────────
      // HEATMAP DE RIESGO
      // ─────────────────────────────────────────────────
      
      if (map.getSource(heatmapSourceId)) {
        map.getSource(heatmapSourceId).setData(gridData);
      } else {
        map.addSource(heatmapSourceId, {
          type: 'geojson',
          data: gridData,
        });
      }
      
      if (!map.getLayer(heatmapLayerId)) {
        map.addLayer({
          id: heatmapLayerId,
          type: 'heatmap',
          source: heatmapSourceId,
          paint: {
            // Peso basado en el riesgo
            'heatmap-weight': [
              'interpolate', ['linear'], ['get', 'risk'],
              0, 0,
              0.3, 0.3,
              0.6, 0.6,
              1, 1
            ],
            // Intensidad según zoom - MÁS INTENSO
            'heatmap-intensity': [
              'interpolate', ['linear'], ['zoom'],
              10, 0.8,
              15, 1.5,
              18, 2.2
            ],
            // Colores: de transparente a azul intenso - MÁS SATURADOS
            'heatmap-color': [
              'interpolate', ['linear'], ['heatmap-density'],
              0, 'rgba(0, 0, 0, 0)',
              0.1, 'rgba(85, 200, 255, 0.15)',
              0.25, 'rgba(65, 170, 240, 0.35)',
              0.4, 'rgba(45, 150, 220, 0.5)',
              0.55, 'rgba(30, 130, 200, 0.65)',
              0.7, 'rgba(20, 110, 180, 0.8)',
              0.85, 'rgba(10, 90, 160, 0.9)',
              1, 'rgba(5, 70, 140, 1.0)'
            ],
            // Radio del heatmap - MÁS GRANDE
            'heatmap-radius': [
              'interpolate', ['linear'], ['zoom'],
              10, 35,
              14, 55,
              18, 80
            ],
            'heatmap-opacity': isRaining ? 1.0 : 0.4,
          },
        }, '3d-buildings');
      } else {
        // Actualizar opacidad si ya existe
        map.setPaintProperty(heatmapLayerId, 'heatmap-opacity', isRaining ? 1.0 : 0.4);
      }
      
      // ─────────────────────────────────────────────────
      // AGUA 3D EXTRUIDA (zonas de alto riesgo)
      // ─────────────────────────────────────────────────
      
      // Crear polígonos para zonas de alto riesgo - UMBRAL MÁS BAJO
      const highRiskFeatures = (gridData.features || [])
        .filter(f => f.properties?.risk > 0.3)  // Antes era 0.4
        .map(f => {
          const [lng, lat] = f.geometry.coordinates;
          const risk = f.properties.risk;
          const radius = 100 + risk * 150; // Más grande: 100-250 metros
          
          return {
            type: 'Feature',
            geometry: {
              type: 'Polygon',
              coordinates: [createCirclePolygon(lng, lat, radius)],
            },
            properties: {
              risk,
              height: risk > 0.7 ? WATER_HEIGHT.high : risk > 0.5 ? WATER_HEIGHT.medium : WATER_HEIGHT.low,
              color: risk > 0.7 ? WATER_COLORS.high.extrusion : risk > 0.5 ? WATER_COLORS.medium.extrusion : WATER_COLORS.low.extrusion,
            },
          };
        });
      
      const waterGeoJSON = { type: 'FeatureCollection', features: highRiskFeatures };
      
      if (map.getSource(waterSourceId)) {
        map.getSource(waterSourceId).setData(waterGeoJSON);
      } else {
        map.addSource(waterSourceId, {
          type: 'geojson',
          data: waterGeoJSON,
        });
      }
      
      // Capa de glow (base)
      if (!map.getLayer(waterGlowLayerId)) {
        map.addLayer({
          id: waterGlowLayerId,
          type: 'fill',
          source: waterSourceId,
          paint: {
            'fill-color': [
              'interpolate', ['linear'], ['get', 'risk'],
              0.4, WATER_COLORS.low.glow,
              0.6, WATER_COLORS.medium.glow,
              0.8, WATER_COLORS.high.glow,
            ],
            'fill-opacity': isRaining ? 0.8 : 0.3,
          },
        });
      } else {
        map.setPaintProperty(waterGlowLayerId, 'fill-opacity', isRaining ? 0.8 : 0.3);
      }
      
      // Capa 3D extruida
      if (!map.getLayer(waterLayerId)) {
        map.addLayer({
          id: waterLayerId,
          type: 'fill-extrusion',
          source: waterSourceId,
          paint: {
            'fill-extrusion-color': [
              'interpolate', ['linear'], ['get', 'risk'],
              0.4, WATER_COLORS.low.extrusion,
              0.6, WATER_COLORS.medium.extrusion,
              0.8, WATER_COLORS.high.extrusion,
            ],
            'fill-extrusion-height': ['get', 'height'],
            'fill-extrusion-base': 0,
            'fill-extrusion-opacity': isRaining ? 0.7 : 0.2,
          },
        });
      } else {
        map.setPaintProperty(waterLayerId, 'fill-extrusion-opacity', isRaining ? 0.7 : 0.2);
      }
      
      layersAddedRef.current = true;
    } catch (e) {
      console.error('Error agregando capas de inundación:', e);
    }
  }, [map, floodGrid, isActive, isRaining]);

  // ─────────────────────────────────────────────────────────────────────────────
  // AGREGAR CAPAS DE REPORTES
  // ─────────────────────────────────────────────────────────────────────────────

  const addReportLayers = useCallback(() => {
    if (!map || !isActive) return;
    
    const sourceId = 'flood-reports-source';
    const circleLayerId = 'flood-reports-circles';
    const pulseLayerId = 'flood-reports-pulse';
    
    // Convertir reportes a GeoJSON
    const features = reports.map(r => ({
      type: 'Feature',
      geometry: {
        type: 'Point',
        coordinates: [r.lng, r.lat],
      },
      properties: {
        id: r.id,
        severity: r.severity,
        color: r.color || REPORT_COLORS[r.severity] || '#FF9800',
        radius: r.radius || 10,
        upvotes: r.upvotes || 0,
        description: r.description || '',
      },
    }));
    
    const geojson = { type: 'FeatureCollection', features };
    
    try {
      if (map.getSource(sourceId)) {
        map.getSource(sourceId).setData(geojson);
      } else {
        map.addSource(sourceId, {
          type: 'geojson',
          data: geojson,
        });
      }
      
      // Capa de pulso (animada)
      if (!map.getLayer(pulseLayerId)) {
        map.addLayer({
          id: pulseLayerId,
          type: 'circle',
          source: sourceId,
          paint: {
            'circle-radius': [
              'interpolate', ['linear'], ['get', 'radius'],
              8, 16,
              12, 22,
              16, 28,
            ],
            'circle-color': ['get', 'color'],
            'circle-opacity': 0.2,
            'circle-stroke-width': 0,
          },
        });
      }
      
      // Capa principal de círculos
      if (!map.getLayer(circleLayerId)) {
        map.addLayer({
          id: circleLayerId,
          type: 'circle',
          source: sourceId,
          paint: {
            'circle-radius': ['get', 'radius'],
            'circle-color': ['get', 'color'],
            'circle-opacity': 0.85,
            'circle-stroke-width': 2,
            'circle-stroke-color': '#ffffff',
          },
        });
        
        // Click handler para reportes
        map.on('click', circleLayerId, (e) => {
          if (e.features && e.features[0]) {
            const props = e.features[0].properties;
            const coords = e.features[0].geometry.coordinates;
            
            const popup = new mapboxgl.Popup({ closeButton: true, maxWidth: '280px' })
              .setLngLat(coords)
              .setHTML(`
                <div style="font-family: 'Inter', system-ui, sans-serif; padding: 8px;">
                  <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px;">
                    <span style="
                      display: inline-block;
                      padding: 3px 8px;
                      border-radius: 4px;
                      font-size: 10px;
                      font-weight: 700;
                      color: white;
                      background: ${props.color};
                    ">${props.severity}</span>
                    <span style="font-size: 11px; color: #666;">👍 ${props.upvotes}</span>
                  </div>
                  <p style="margin: 0; font-size: 12px; color: #333; line-height: 1.4;">
                    ${props.description || 'Sin descripción'}
                  </p>
                </div>
              `)
              .addTo(map);
          }
        });
        
        // Cursor pointer
        map.on('mouseenter', circleLayerId, () => {
          map.getCanvas().style.cursor = 'pointer';
        });
        map.on('mouseleave', circleLayerId, () => {
          map.getCanvas().style.cursor = '';
        });
      }
    } catch (e) {
      console.error('Error agregando capas de reportes:', e);
    }
  }, [map, reports, isActive]);

  // ─────────────────────────────────────────────────────────────────────────────
  // ANIMACIÓN DE ONDAS EN AGUA
  // ─────────────────────────────────────────────────────────────────────────────

  const animateWater = useCallback(() => {
    if (!map || !isActive || !layersAddedRef.current) return;
    
    timeRef.current += 16;
    const t = timeRef.current * 0.001;
    
    try {
      // Animar el pulso de los reportes
      const pulseLayerId = 'flood-reports-pulse';
      if (map.getLayer(pulseLayerId)) {
        const pulseScale = 1 + Math.sin(t * 2) * 0.3;
        const pulseOpacity = 0.15 + Math.sin(t * 2) * 0.1;
        
        map.setPaintProperty(pulseLayerId, 'circle-radius', [
          'interpolate', ['linear'], ['get', 'radius'],
          8, 16 * pulseScale,
          12, 22 * pulseScale,
          16, 28 * pulseScale,
        ]);
        map.setPaintProperty(pulseLayerId, 'circle-opacity', pulseOpacity);
      }
    } catch (e) {}
    
    animationRef.current = requestAnimationFrame(animateWater);
  }, [map, isActive]);

  // ─────────────────────────────────────────────────────────────────────────────
  // EFECTOS
  // ─────────────────────────────────────────────────────────────────────────────

  // Agregar capas cuando el mapa está listo
  useEffect(() => {
    if (!map) return;
    
    const setup = () => {
      addFloodLayers();
      addReportLayers();
    };
    
    if (map.loaded()) {
      setup();
    } else {
      map.once('load', setup);
    }
  }, [map, addFloodLayers, addReportLayers]);

  // Actualizar cuando cambian los datos
  useEffect(() => {
    if (map && isActive) {
      addFloodLayers();
    }
  }, [floodGrid, isRaining, addFloodLayers]);

  useEffect(() => {
    if (map && isActive) {
      addReportLayers();
    }
  }, [reports, addReportLayers]);

  // Animación
  useEffect(() => {
    if (isActive) {
      animationRef.current = requestAnimationFrame(animateWater);
    }
    
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
        animationRef.current = null;
      }
    };
  }, [isActive, animateWater]);

  // Cleanup al desactivar
  useEffect(() => {
    if (!isActive && map) {
      const layersToRemove = [
        'flood-heatmap',
        'flood-water-3d',
        'flood-water-glow',
        'flood-reports-circles',
        'flood-reports-pulse',
      ];
      const sourcesToRemove = [
        'flood-heatmap-source',
        'flood-water-source',
        'flood-reports-source',
      ];
      
      try {
        layersToRemove.forEach(id => {
          if (map.getLayer(id)) map.removeLayer(id);
        });
        sourcesToRemove.forEach(id => {
          if (map.getSource(id)) map.removeSource(id);
        });
      } catch (e) {}
      
      layersAddedRef.current = false;
    }
  }, [isActive, map]);

  return null;
}
