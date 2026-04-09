import { useState, useCallback, useEffect } from 'react';

// ═══════════════════════════════════════════════════════════════════════════════
// CONFIGURACIÓN
// ═══════════════════════════════════════════════════════════════════════════════

const SEVERITY_OPTIONS = [
  { 
    id: 'LEVE', 
    label: 'Leve', 
    description: 'Encharcamiento menor, se puede caminar',
    color: '#4CAF50',
    icon: '💧',
  },
  { 
    id: 'MODERADO', 
    label: 'Moderado', 
    description: 'Agua hasta los tobillos, difícil transitar',
    color: '#FF9800',
    icon: '🌊',
  },
  { 
    id: 'SEVERO', 
    label: 'Severo', 
    description: 'Inundación grave, imposible pasar',
    color: '#F44336',
    icon: '⚠️',
  },
];

const MOBILE_BREAKPOINT = 768;

// ═══════════════════════════════════════════════════════════════════════════════
// UTILIDADES
// ═══════════════════════════════════════════════════════════════════════════════

function formatTimeAgo(dateStr) {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);
  
  if (diffMins < 1) return 'Ahora';
  if (diffMins < 60) return `Hace ${diffMins}m`;
  
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `Hace ${diffHours}h`;
  
  const diffDays = Math.floor(diffHours / 24);
  return `Hace ${diffDays}d`;
}

// ═══════════════════════════════════════════════════════════════════════════════
// COMPONENTE PRINCIPAL
// ═══════════════════════════════════════════════════════════════════════════════

export default function ReportPanel({
  map,
  reports = [],
  onCreateReport,
  onUpvoteReport,
  isActive = false,
  mapTheme = 'dark',
  weatherInfo = null,
}) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedLocation, setSelectedLocation] = useState(null);
  const [selectedSeverity, setSelectedSeverity] = useState(null);
  const [description, setDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [selectingLocation, setSelectingLocation] = useState(false);

  // Detectar móvil
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth <= MOBILE_BREAKPOINT);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Handler para seleccionar ubicación en el mapa
  useEffect(() => {
    if (!map || !selectingLocation) return;
    
    const handleClick = (e) => {
      setSelectedLocation({
        lat: e.lngLat.lat,
        lng: e.lngLat.lng,
      });
      setSelectingLocation(false);
      map.getCanvas().style.cursor = '';
    };
    
    map.getCanvas().style.cursor = 'crosshair';
    map.once('click', handleClick);
    
    return () => {
      map.off('click', handleClick);
      map.getCanvas().style.cursor = '';
    };
  }, [map, selectingLocation]);

  // Resetear al cerrar modal
  const resetForm = useCallback(() => {
    setSelectedLocation(null);
    setSelectedSeverity(null);
    setDescription('');
    setSelectingLocation(false);
  }, []);

  const handleCloseModal = useCallback(() => {
    setShowCreateModal(false);
    resetForm();
  }, [resetForm]);

  const handleSubmit = useCallback(async () => {
    if (!selectedLocation || !selectedSeverity || !onCreateReport) return;
    
    setIsSubmitting(true);
    try {
      await onCreateReport(
        selectedLocation.lat,
        selectedLocation.lng,
        selectedSeverity,
        description
      );
      handleCloseModal();
    } catch (e) {
      console.error('Error creating report:', e);
    } finally {
      setIsSubmitting(false);
    }
  }, [selectedLocation, selectedSeverity, description, onCreateReport, handleCloseModal]);

  const handleUpvote = useCallback((reportId) => {
    if (onUpvoteReport) {
      onUpvoteReport(reportId);
    }
  }, [onUpvoteReport]);

  if (!isActive) return null;

  const isLight = mapTheme === 'light';

  // ─────────────────────────────────────────────────────────────────────────────
  // ESTILOS
  // ─────────────────────────────────────────────────────────────────────────────

  const containerStyle = {
    position: 'fixed',
    right: isMobile ? 8 : 24,
    bottom: isMobile ? 90 : 24,
    zIndex: 200,
    fontFamily: 'Inter, system-ui, sans-serif',
    width: isMobile ? 'calc(100vw - 16px)' : 'auto',
    maxWidth: isMobile ? 'calc(100vw - 16px)' : 'none',
  };

  const panelStyle = {
    background: isLight ? 'rgba(255,255,255,0.92)' : 'rgba(18,18,24,0.95)',
    backdropFilter: 'blur(16px)',
    WebkitBackdropFilter: 'blur(16px)',
    borderRadius: 16,
    border: isLight ? '1px solid rgba(0,0,0,0.08)' : '1px solid rgba(255,255,255,0.1)',
    boxShadow: '0 8px 32px rgba(0,0,0,0.2)',
    overflow: 'hidden',
    width: isMobile ? '100%' : 320,
    maxHeight: isExpanded ? (isMobile ? 400 : 500) : 'auto',
    transition: 'max-height 0.3s ease',
  };

  const headerStyle = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '14px 16px',
    borderBottom: isExpanded 
      ? (isLight ? '1px solid rgba(0,0,0,0.06)' : '1px solid rgba(255,255,255,0.08)')
      : 'none',
    cursor: 'pointer',
  };

  const titleStyle = {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
  };

  const titleTextStyle = {
    fontSize: 12,
    fontWeight: 600,
    color: isLight ? 'rgba(0,0,0,0.85)' : 'rgba(255,255,255,0.92)',
    letterSpacing: '0.02em',
  };

  const badgeStyle = {
    background: isLight ? 'rgba(0,120,255,0.1)' : 'rgba(0,180,255,0.15)',
    color: isLight ? '#0066cc' : '#4dd0e1',
    padding: '2px 7px',
    borderRadius: 10,
    fontSize: 10,
    fontWeight: 600,
  };

  const expandIconStyle = {
    width: 20,
    height: 20,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: isLight ? 'rgba(0,0,0,0.4)' : 'rgba(255,255,255,0.4)',
    transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
    transition: 'transform 0.2s ease',
  };

  const contentStyle = {
    maxHeight: isExpanded ? 350 : 0,
    overflow: 'hidden',
    transition: 'max-height 0.3s ease',
  };

  const createButtonStyle = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    width: 'calc(100% - 24px)',
    margin: '12px',
    padding: '12px 16px',
    background: isLight ? 'linear-gradient(135deg, #0077ff, #0055cc)' : 'linear-gradient(135deg, #00b4d8, #0077b6)',
    border: 'none',
    borderRadius: 10,
    color: '#fff',
    fontSize: 12,
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'transform 0.15s ease, box-shadow 0.15s ease',
  };

  const listContainerStyle = {
    padding: '0 12px 12px',
    maxHeight: 250,
    overflowY: 'auto',
  };

  const reportItemStyle = {
    display: 'flex',
    alignItems: 'flex-start',
    gap: 10,
    padding: '10px 12px',
    background: isLight ? 'rgba(0,0,0,0.03)' : 'rgba(255,255,255,0.04)',
    borderRadius: 10,
    marginBottom: 8,
  };

  const reportIconStyle = (color) => ({
    width: 32,
    height: 32,
    borderRadius: 8,
    background: color + '20',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 14,
    flexShrink: 0,
  });

  const reportContentStyle = {
    flex: 1,
    minWidth: 0,
  };

  const reportSeverityStyle = (color) => ({
    display: 'inline-block',
    padding: '2px 6px',
    borderRadius: 4,
    background: color + '20',
    color: color,
    fontSize: 9,
    fontWeight: 700,
    letterSpacing: '0.05em',
    textTransform: 'uppercase',
  });

  const reportDescStyle = {
    fontSize: 11,
    color: isLight ? 'rgba(0,0,0,0.7)' : 'rgba(255,255,255,0.7)',
    marginTop: 4,
    lineHeight: 1.4,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    display: '-webkit-box',
    WebkitLineClamp: 2,
    WebkitBoxOrient: 'vertical',
  };

  const reportMetaStyle = {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    marginTop: 6,
    fontSize: 10,
    color: isLight ? 'rgba(0,0,0,0.4)' : 'rgba(255,255,255,0.4)',
  };

  const upvoteButtonStyle = {
    display: 'flex',
    alignItems: 'center',
    gap: 4,
    padding: '4px 8px',
    background: isLight ? 'rgba(0,0,0,0.05)' : 'rgba(255,255,255,0.08)',
    border: 'none',
    borderRadius: 6,
    cursor: 'pointer',
    color: isLight ? 'rgba(0,0,0,0.6)' : 'rgba(255,255,255,0.6)',
    fontSize: 10,
    fontWeight: 500,
    transition: 'background 0.15s ease',
  };

  // ─────────────────────────────────────────────────────────────────────────────
  // MODAL DE CREACIÓN
  // ─────────────────────────────────────────────────────────────────────────────

  const modalOverlayStyle = {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: 'rgba(0,0,0,0.6)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
    padding: 16,
  };

  const modalStyle = {
    background: isLight ? '#fff' : '#1a1a24',
    borderRadius: 20,
    width: '100%',
    maxWidth: 380,
    maxHeight: '90vh',
    overflow: 'auto',
    boxShadow: '0 20px 60px rgba(0,0,0,0.4)',
  };

  const modalHeaderStyle = {
    padding: '20px 20px 16px',
    borderBottom: isLight ? '1px solid rgba(0,0,0,0.08)' : '1px solid rgba(255,255,255,0.08)',
  };

  const modalTitleStyle = {
    fontSize: 18,
    fontWeight: 700,
    color: isLight ? 'rgba(0,0,0,0.9)' : 'rgba(255,255,255,0.95)',
    marginBottom: 4,
  };

  const modalSubtitleStyle = {
    fontSize: 12,
    color: isLight ? 'rgba(0,0,0,0.5)' : 'rgba(255,255,255,0.5)',
  };

  const modalBodyStyle = {
    padding: '16px 20px',
  };

  const sectionLabelStyle = {
    fontSize: 10,
    fontWeight: 600,
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
    color: isLight ? 'rgba(0,0,0,0.5)' : 'rgba(255,255,255,0.5)',
    marginBottom: 10,
  };

  const locationSelectStyle = {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    padding: '12px 14px',
    background: selectedLocation 
      ? (isLight ? 'rgba(0,180,100,0.08)' : 'rgba(0,220,130,0.1)')
      : (isLight ? 'rgba(0,0,0,0.04)' : 'rgba(255,255,255,0.06)'),
    border: selectedLocation
      ? '1px solid rgba(0,200,120,0.3)'
      : (isLight ? '1px dashed rgba(0,0,0,0.15)' : '1px dashed rgba(255,255,255,0.15)'),
    borderRadius: 10,
    cursor: 'pointer',
    marginBottom: 16,
    transition: 'all 0.2s ease',
  };

  const locationIconStyle = {
    width: 36,
    height: 36,
    borderRadius: 10,
    background: selectedLocation 
      ? 'rgba(0,200,120,0.15)'
      : (isLight ? 'rgba(0,0,0,0.06)' : 'rgba(255,255,255,0.08)'),
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 18,
  };

  const locationTextStyle = {
    flex: 1,
  };

  const locationMainStyle = {
    fontSize: 12,
    fontWeight: 500,
    color: isLight ? 'rgba(0,0,0,0.85)' : 'rgba(255,255,255,0.9)',
  };

  const locationSubStyle = {
    fontSize: 10,
    color: isLight ? 'rgba(0,0,0,0.4)' : 'rgba(255,255,255,0.4)',
    marginTop: 2,
  };

  const severityGridStyle = {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap: 8,
    marginBottom: 16,
  };

  const severityOptionStyle = (option, isSelected) => ({
    padding: '14px 8px',
    borderRadius: 10,
    border: isSelected 
      ? `2px solid ${option.color}`
      : (isLight ? '1px solid rgba(0,0,0,0.1)' : '1px solid rgba(255,255,255,0.1)'),
    background: isSelected 
      ? option.color + '15'
      : (isLight ? 'rgba(0,0,0,0.02)' : 'rgba(255,255,255,0.03)'),
    cursor: 'pointer',
    textAlign: 'center',
    transition: 'all 0.15s ease',
  });

  const severityIconBigStyle = {
    fontSize: 24,
    marginBottom: 6,
  };

  const severityLabelStyle = (option, isSelected) => ({
    fontSize: 11,
    fontWeight: 600,
    color: isSelected ? option.color : (isLight ? 'rgba(0,0,0,0.7)' : 'rgba(255,255,255,0.7)'),
  });

  const textareaStyle = {
    width: '100%',
    minHeight: 80,
    padding: '12px 14px',
    borderRadius: 10,
    border: isLight ? '1px solid rgba(0,0,0,0.12)' : '1px solid rgba(255,255,255,0.12)',
    background: isLight ? 'rgba(0,0,0,0.02)' : 'rgba(255,255,255,0.04)',
    color: isLight ? 'rgba(0,0,0,0.85)' : 'rgba(255,255,255,0.9)',
    fontSize: 12,
    fontFamily: 'Inter, system-ui, sans-serif',
    resize: 'vertical',
    outline: 'none',
    boxSizing: 'border-box',
    marginBottom: 16,
  };

  const modalFooterStyle = {
    padding: '16px 20px 20px',
    display: 'flex',
    gap: 10,
  };

  const cancelButtonStyle = {
    flex: 1,
    padding: '12px 16px',
    borderRadius: 10,
    border: isLight ? '1px solid rgba(0,0,0,0.12)' : '1px solid rgba(255,255,255,0.15)',
    background: 'transparent',
    color: isLight ? 'rgba(0,0,0,0.6)' : 'rgba(255,255,255,0.6)',
    fontSize: 12,
    fontWeight: 600,
    cursor: 'pointer',
  };

  const submitButtonStyle = {
    flex: 2,
    padding: '12px 16px',
    borderRadius: 10,
    border: 'none',
    background: (selectedLocation && selectedSeverity)
      ? 'linear-gradient(135deg, #0077ff, #0055cc)'
      : (isLight ? 'rgba(0,0,0,0.1)' : 'rgba(255,255,255,0.1)'),
    color: (selectedLocation && selectedSeverity) ? '#fff' : (isLight ? 'rgba(0,0,0,0.3)' : 'rgba(255,255,255,0.3)'),
    fontSize: 12,
    fontWeight: 600,
    cursor: (selectedLocation && selectedSeverity) ? 'pointer' : 'not-allowed',
    transition: 'all 0.2s ease',
  };

  const emptyStateStyle = {
    padding: '24px 16px',
    textAlign: 'center',
    color: isLight ? 'rgba(0,0,0,0.4)' : 'rgba(255,255,255,0.4)',
    fontSize: 12,
  };

  // ─────────────────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────────────────

  return (
    <>
      <div style={containerStyle}>
        <div style={panelStyle}>
          {/* Header */}
          <div style={headerStyle} onClick={() => setIsExpanded(!isExpanded)}>
            <div style={titleStyle}>
              <span style={{ fontSize: 16 }}>🌊</span>
              <span style={titleTextStyle}>Reportes de Inundación</span>
              {reports.length > 0 && (
                <span style={badgeStyle}>{reports.length}</span>
              )}
            </div>
            <div style={expandIconStyle}>
              <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor">
                <path d="M2.5 4.5L6 8L9.5 4.5" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round"/>
              </svg>
            </div>
          </div>

          {/* Content */}
          <div style={contentStyle}>
            {/* Create Button */}
            <button 
              style={createButtonStyle}
              onClick={() => setShowCreateModal(true)}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-1px)';
                e.currentTarget.style.boxShadow = '0 4px 16px rgba(0,120,255,0.3)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = 'none';
              }}
            >
              <span style={{ fontSize: 14 }}>+</span>
              <span>Reportar inundación</span>
            </button>

            {/* Reports List */}
            <div style={listContainerStyle}>
              {reports.length === 0 ? (
                <div style={emptyStateStyle}>
                  <p style={{ marginBottom: 4 }}>No hay reportes activos</p>
                  <p style={{ fontSize: 10, opacity: 0.7 }}>Se el primero en reportar</p>
                </div>
              ) : (
                reports.slice(0, 10).map(report => {
                  const severityConfig = SEVERITY_OPTIONS.find(s => s.id === report.severity) || SEVERITY_OPTIONS[1];
                  return (
                    <div key={report.id} style={reportItemStyle}>
                      <div style={reportIconStyle(severityConfig.color)}>
                        {severityConfig.icon}
                      </div>
                      <div style={reportContentStyle}>
                        <span style={reportSeverityStyle(severityConfig.color)}>
                          {report.severity}
                        </span>
                        <p style={reportDescStyle}>
                          {report.description || 'Sin descripción adicional'}
                        </p>
                        <div style={reportMetaStyle}>
                          <span>{formatTimeAgo(report.createdAt)}</span>
                          <button 
                            style={upvoteButtonStyle}
                            onClick={() => handleUpvote(report.id)}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.background = isLight ? 'rgba(0,0,0,0.1)' : 'rgba(255,255,255,0.12)';
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.background = isLight ? 'rgba(0,0,0,0.05)' : 'rgba(255,255,255,0.08)';
                            }}
                          >
                            <span>👍</span>
                            <span>{report.upvotes}</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Create Report Modal */}
      {showCreateModal && (
        <div style={modalOverlayStyle} onClick={handleCloseModal}>
          <div style={modalStyle} onClick={(e) => e.stopPropagation()}>
            {/* Modal Header */}
            <div style={modalHeaderStyle}>
              <h2 style={modalTitleStyle}>Reportar Inundación</h2>
              <p style={modalSubtitleStyle}>Ayuda a otros usuarios indicando zonas afectadas</p>
            </div>

            {/* Modal Body */}
            <div style={modalBodyStyle}>
              {/* Location Selection */}
              <div style={sectionLabelStyle}>Ubicación</div>
              <div 
                style={locationSelectStyle}
                onClick={() => {
                  setSelectingLocation(true);
                  // Minimizar modal temporalmente para ver el mapa
                }}
              >
                <div style={locationIconStyle}>
                  {selectedLocation ? '📍' : '🗺️'}
                </div>
                <div style={locationTextStyle}>
                  <div style={locationMainStyle}>
                    {selectingLocation 
                      ? 'Haz clic en el mapa...'
                      : selectedLocation 
                        ? 'Ubicación seleccionada'
                        : 'Seleccionar en el mapa'}
                  </div>
                  <div style={locationSubStyle}>
                    {selectedLocation 
                      ? `${selectedLocation.lat.toFixed(5)}, ${selectedLocation.lng.toFixed(5)}`
                      : 'Toca para elegir el punto exacto'}
                  </div>
                </div>
              </div>

              {/* Severity Selection */}
              <div style={sectionLabelStyle}>Severidad</div>
              <div style={severityGridStyle}>
                {SEVERITY_OPTIONS.map(option => (
                  <div
                    key={option.id}
                    style={severityOptionStyle(option, selectedSeverity === option.id)}
                    onClick={() => setSelectedSeverity(option.id)}
                  >
                    <div style={severityIconBigStyle}>{option.icon}</div>
                    <div style={severityLabelStyle(option, selectedSeverity === option.id)}>
                      {option.label}
                    </div>
                  </div>
                ))}
              </div>

              {/* Description */}
              <div style={sectionLabelStyle}>Descripción (opcional)</div>
              <textarea
                style={textareaStyle}
                placeholder="Describe la situación: nivel del agua, si hay autos varados, etc."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                maxLength={200}
              />
            </div>

            {/* Modal Footer */}
            <div style={modalFooterStyle}>
              <button style={cancelButtonStyle} onClick={handleCloseModal}>
                Cancelar
              </button>
              <button 
                style={submitButtonStyle}
                onClick={handleSubmit}
                disabled={!selectedLocation || !selectedSeverity || isSubmitting}
              >
                {isSubmitting ? 'Enviando...' : 'Enviar reporte'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
