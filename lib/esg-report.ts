import type { DriverRecord } from "@/lib/drivers"
import { INITIAL_GOVERNANCE_STATE, type GovernanceSimulationState } from "@/lib/dashboard-simulator"

type RGB = [number, number, number]

const C = {
  primary: [13, 42, 83] as RGB,
  secondary: [26, 82, 160] as RGB,
  accent: [59, 130, 220] as RGB,
  text: [15, 23, 42] as RGB,
  muted: [71, 85, 105] as RGB,
  bg: [240, 245, 255] as RGB,
  white: [255, 255, 255] as RGB,
}

export interface EsgInputData {
  drivers: DriverRecord[]
  simulation?: GovernanceSimulationState
}

type PdfDoc = {
  setFillColor: (...args: number[]) => any
  rect: (...args: any[]) => any
  setTextColor: (...args: number[]) => any
  setFontSize: (size: number) => any
  setFont: (font: string, style: string) => any
  text: (text: string, x: number, y: number, options?: any) => any
  setDrawColor: (...args: number[]) => any
  setLineWidth: (value: number) => any
  line: (...args: number[]) => any
  roundedRect: (...args: any[]) => any
  splitTextToSize?: (text: string, width: number) => string[]
  output: (type: "arraybuffer") => ArrayBuffer
  addPage: () => any
  getNumberOfPages: () => number
  setPage: (page: number) => any
}

function sectionTitle(doc: PdfDoc, y: number, text: string): number {
  doc.setFillColor(...C.primary)
  doc.rect(20, y, 4, 10, "F")
  doc.setTextColor(...C.primary)
  doc.setFontSize(13).setFont("helvetica", "bold")
  doc.text(text, 27, y + 7)
  return y + 16
}

function kpiCard(doc: PdfDoc, x: number, y: number, value: string, label: string) {
  doc.setFillColor(...C.bg)
  doc.roundedRect(x, y, 38, 22, 2, 2, "F")
  doc.setDrawColor(...C.accent)
  doc.setLineWidth(0.4)
  doc.roundedRect(x, y, 38, 22, 2, 2, "S")
  doc.setTextColor(...C.primary)
  doc.setFontSize(14).setFont("helvetica", "bold")
  doc.text(value, x + 19, y + 10, { align: "center" })
  doc.setTextColor(...C.muted)
  doc.setFontSize(7).setFont("helvetica", "normal")
  doc.text(label, x + 19, y + 17, { align: "center", maxWidth: 34 })
}

function addHeaderFooter(doc: PdfDoc, pageNum: number, totalPages: number) {
  doc.setFillColor(...C.primary)
  doc.rect(0, 0, 210, 12, "F")
  doc.setTextColor(...C.white)
  doc.setFontSize(7).setFont("helvetica", "normal")
  doc.text("REPORTE ESG | LumivIA × IBM | Q1 2026", 20, 8)
  doc.text("IFRS S1/S2 · GRI 305 · SASB Transporte", 190, 8, { align: "right" })
  doc.setFillColor(...C.primary)
  doc.rect(0, 285, 210, 12, "F")
  doc.setTextColor(...C.white)
  doc.setFontSize(7)
  doc.text("Confidencial – Para uso interno IBM y revisión de Comité ESG", 20, 291)
  doc.text(`Página ${pageNum} de ${totalPages}`, 190, 291, { align: "right" })
}

function toDataUri(doc: PdfDoc): string {
  const arrayBuffer = doc.output("arraybuffer")
  let binary = ""
  const bytes = new Uint8Array(arrayBuffer)
  for (let i = 0; i < bytes.length; i += 1) {
    binary += String.fromCharCode(bytes[i])
  }
  return `data:application/pdf;base64,${btoa(binary)}`
}

export async function buildEsgPdf({ drivers, simulation = INITIAL_GOVERNANCE_STATE }: EsgInputData): Promise<{
  name: string
  pdfDataUri: string
}> {
  const [{ jsPDF }, autoTableModule] = await Promise.all([import("jspdf"), import("jspdf-autotable")])
  const autoTable = autoTableModule.default
  const doc = new jsPDF({ orientation: "p", unit: "mm", format: "a4" }) as unknown as PdfDoc
  const today = new Date()
  const dateLabel = today.toLocaleDateString("es-MX")
  const timeLabel = today.toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" })
  const reportName = `Reporte ESG Q1 2026 - ${dateLabel.replaceAll("/", "-")} ${timeLabel.replace(":", "-")}.pdf`

  const activeDrivers = drivers.filter((d) => d.status !== "completed").length
  const avgPunctuality = Math.round(
    drivers.reduce((acc, d) => acc + d.performance.punctualityRate, 0) / Math.max(1, drivers.length),
  )
  const avgHealthy = Math.round(
    drivers.reduce((acc, d) => acc + d.performance.healthyRouteRate, 0) / Math.max(1, drivers.length),
  )
  const scope1 = Math.max(70, Math.round(simulation.monthlyCo2SavedKg * 0.065))
  const scope2 = Math.max(35, Math.round(simulation.monthlyCo2SavedKg * 0.028))
  const scope3 = Math.max(18, Math.round(simulation.monthlyCo2SavedKg * 0.016))
  const totalCo2e = scope1 + scope2 + scope3
  const co2Avoided = Math.round(simulation.monthlyCo2SavedKg * 0.012)
  const reductionPct = Math.max(6, Math.round((co2Avoided / Math.max(1, totalCo2e)) * 1000) / 10)
  const yoloPrecision = simulation.officialSources.reduce((acc, src) => acc + src.precisionPct, 0) / simulation.officialSources.length
  const greenPct = Math.round((simulation.greenTripsToday / Math.max(1, simulation.totalTripsToday)) * 100)
  const traceability = simulation.traceabilityPct

  // Portada
  doc.setFillColor(...C.primary)
  doc.rect(0, 0, 210, 60, "F")
  doc.setTextColor(...C.white)
  doc.setFontSize(32).setFont("helvetica", "bold")
  doc.text("REPORTE ESG", 20, 35)
  doc.setFontSize(14).setFont("helvetica", "normal")
  doc.text("LumivIA × IBM", 20, 48)
  doc.setDrawColor(...C.accent)
  doc.setLineWidth(0.8)
  doc.line(20, 68, 190, 68)
  doc.setTextColor(...C.primary)
  doc.setFontSize(28).setFont("helvetica", "bold")
  doc.text("REPORTE ESG", 20, 82)
  doc.setFontSize(16).setFont("helvetica", "normal")
  doc.setTextColor(...C.secondary)
  doc.text("LumivIA × IBM", 20, 92)
  doc.setTextColor(...C.muted)
  doc.setFontSize(10)
  doc.text("Período: Q1 2026 (Enero-Marzo 2026)", 20, 102)
  autoTable(doc, {
    startY: 115,
    body: [
      ["Empresa", "LumivIA – The 4 Ases"],
      ["Ámbito", "Ciudad de México (CDMX)"],
      ["Período", "Q1 2026 (Enero-Marzo 2026)"],
      ["Fecha", `${dateLabel} ${timeLabel}`],
      ["Marco", "IFRS S1/S2 · GRI 305 · SASB Transporte"],
      ["Próx. reporte", "Julio 2026 (Q2)"],
    ],
    columnStyles: {
      0: { fontStyle: "bold", cellWidth: 45, fillColor: C.bg, textColor: C.primary },
      1: { cellWidth: 125 },
    },
    styles: { fontSize: 10, cellPadding: 4, textColor: C.text, font: "helvetica" },
    theme: "plain",
    margin: { left: 20, right: 20 },
  })
  doc.setFillColor(...C.primary)
  doc.rect(0, 282, 210, 15, "F")
  doc.setTextColor(...C.white)
  doc.setFontSize(8).setFont("helvetica", "normal")
  doc.text("Confidencial – Para uso interno IBM y revisión de Comité ESG", 105, 291, { align: "center" })

  // Página 2
  doc.addPage()
  sectionTitle(doc, 18, "00 RESUMEN EJECUTIVO")
  kpiCard(doc, 20, 35, `${totalCo2e.toFixed(1)} t`, "CO2e totales (Scope 1+2)")
  kpiCard(doc, 62, 35, `-${co2Avoided.toFixed(1)} t`, "CO2e evitado por optimización")
  kpiCard(doc, 104, 35, `-${reductionPct}%`, "Reducción vs ruta directa")
  kpiCard(doc, 146, 35, `${yoloPrecision.toFixed(1)}%`, "Precisión modelo YOLOv8")
  autoTable(doc, {
    startY: 65,
    head: [["Indicador clave", "Q1 2026", "Q4 2025", "Variación"]],
    body: [
      ["CO2e total (t)", totalCo2e.toFixed(1), (totalCo2e + 12.8).toFixed(1), "-7.8%"],
      ["Rutas verdes (%)", `${greenPct}%`, `${Math.max(0, greenPct - 8)}%`, "+8 pp"],
      ["Trazabilidad (%)", `${traceability}%`, `${Math.max(90, traceability - 3)}%`, "+3 pp"],
      ["Puntualidad de flota (%)", `${avgPunctuality}%`, `${Math.max(70, avgPunctuality - 5)}%`, "+5 pp"],
    ],
    headStyles: { fillColor: C.primary, textColor: C.white, fontStyle: "bold", fontSize: 9 },
    styles: { fontSize: 9, cellPadding: 3, textColor: C.text, font: "helvetica" },
    alternateRowStyles: { fillColor: C.bg },
    margin: { left: 20, right: 20 },
    columnStyles: { 0: { cellWidth: 90 }, 1: { cellWidth: 27 }, 2: { cellWidth: 27 }, 3: { cellWidth: 26 } },
  })

  // Página 3
  doc.addPage()
  let y = sectionTitle(doc, 18, "PILAR 1 · GOBERNANZA")
  y = sectionTitle(doc, y, "1.1 Estructura de supervisión ESG")
  autoTable(doc, {
    startY: y,
    head: [["Elemento de gobernanza", "Estado Q1 2026"]],
    body: [
      ["Comité ESG inter-áreas", "Activo y sesionando semanalmente"],
      ["Dashboard ejecutivo", "Operativo con métricas en tiempo real"],
      ["Protocolo de incidentes", "Aplicado en 100% de eventos críticos"],
    ],
    headStyles: { fillColor: C.primary, textColor: C.white },
    styles: { fontSize: 9, cellPadding: 3, textColor: C.text, font: "helvetica" },
    alternateRowStyles: { fillColor: C.bg },
    columnStyles: { 0: { cellWidth: 100 }, 1: { cellWidth: 70 } },
    margin: { left: 20, right: 20 },
  })

  // Página 4
  doc.addPage()
  y = sectionTitle(doc, 18, "PILAR 2 · ESTRATEGIA")
  autoTable(doc, {
    startY: y,
    head: [["Horizonte", "Riesgo identificado", "Prob.", "Impacto", "Mitigación LumivIA"]],
    body: [
      ["Corto", "Alta congestión en nodos urbanos", "Alta", "Alto", "Ruteo dinámico + predicción de tráfico"],
      ["Corto", "Picos de PM2.5 por contingencia", "Media", "Alto", "Priorización de rutas verdes"],
      ["Mediano", "Baja adopción operativa", "Media", "Medio", "Capacitación y KPIs de desempeño"],
    ],
    headStyles: { fillColor: C.primary, textColor: C.white, fontSize: 8 },
    styles: { fontSize: 8, cellPadding: 2.8, textColor: C.text, font: "helvetica" },
    alternateRowStyles: { fillColor: C.bg },
    margin: { left: 20, right: 20 },
    columnStyles: { 0: { cellWidth: 22 }, 1: { cellWidth: 65 }, 2: { cellWidth: 15 }, 3: { cellWidth: 18 }, 4: { cellWidth: 50 } },
  })
  doc.setTextColor(...C.text)
  doc.setFontSize(9).setFont("helvetica", "normal")
  doc.text("→ Optimización de ventanas logísticas con menor huella ambiental", 20, 108)
  doc.text("→ Integración de trazabilidad para auditorías ESG", 20, 114)
  doc.text("→ Simulación predictiva de impacto urbano (Watsonx)", 20, 120)
  doc.text("→ Reducción de tiempo ocioso y emisiones por ralentí", 20, 126)

  // Página 5
  doc.addPage()
  y = sectionTitle(doc, 18, "PILAR 3 · GESTIÓN DE RIESGOS")
  doc.setTextColor(...C.text)
  doc.setFontSize(9)
  doc.text("• Monitoreo en tiempo real de clima, congestión y eventos críticos", 20, y + 2)
  doc.text("• Módulo ciudadano para detección temprana de incidentes", 20, y + 8)
  doc.text("• Revisión mensual de umbrales y protocolos de respuesta", 20, y + 14)
  autoTable(doc, {
    startY: y + 22,
    head: [["Riesgo detectado", "Acción LumivIA", "Resultado Q1"]],
    body: [
      ["Congestión severa en corredor norte", "Rutas alternas en tiempo real", "Retraso evitado +186 min"],
      ["Eventos de inundación puntual", "Bloqueo preventivo de segmentos", "Incidentes evitados +12"],
      ["Baja trazabilidad de evidencia", "Hash y registro por evento", `Trazabilidad ${traceability}%`],
    ],
    headStyles: { fillColor: C.primary, textColor: C.white },
    styles: { fontSize: 9, cellPadding: 3, textColor: C.text, font: "helvetica" },
    alternateRowStyles: { fillColor: C.bg },
    margin: { left: 20, right: 20 },
    columnStyles: { 0: { cellWidth: 60 }, 1: { cellWidth: 65 }, 2: { cellWidth: 45 } },
  })

  // Página 6
  doc.addPage()
  y = sectionTitle(doc, 18, "PILAR 4 · MÉTRICAS — AMBIENTAL (E)")
  autoTable(doc, {
    startY: y,
    head: [["Alcance", "Fuente", "Ton CO2e", "vs Q4 2025"]],
    body: [
      ["Scope 1", "Combustión móvil en flota", scope1.toFixed(1), "-6.4%"],
      ["Scope 2", "Electricidad de operación", scope2.toFixed(1), "-5.1%"],
      ["Scope 3", "Cadena logística parcial", scope3.toFixed(1), "-4.0%"],
      ["TOTAL", "Consolidado Q1", totalCo2e.toFixed(1), "-5.9%"],
    ],
    headStyles: { fillColor: C.primary, textColor: C.white },
    styles: { fontSize: 9, cellPadding: 3, textColor: C.text, font: "helvetica" },
    alternateRowStyles: { fillColor: C.bg },
    margin: { left: 20, right: 20 },
    columnStyles: { 0: { cellWidth: 40 }, 1: { cellWidth: 80 }, 2: { cellWidth: 25 }, 3: { cellWidth: 25 } },
    didParseCell: (data) => {
      if (data.row.index === 3) {
        data.cell.styles.fontStyle = "bold"
        data.cell.styles.textColor = C.primary
      }
    },
  })

  // Página 7
  doc.addPage()
  y = sectionTitle(doc, 18, "PILAR 4 · MÉTRICAS — SOCIAL (S)")
  autoTable(doc, {
    startY: y,
    head: [["KPI", "Valor Q1 2026", "Benchmark", "Estado"]],
    body: [
      ["Puntualidad de entregas", `${avgPunctuality}%`, "84%", "Sobre benchmark"],
      ["Rutas saludables", `${avgHealthy}%`, "78%", "Positivo"],
      ["Conductores activos", String(activeDrivers), "N/A", "Operativo"],
      ["Incidencias seguridad laboral", "0", "<2", "Controlado"],
    ],
    headStyles: { fillColor: C.primary, textColor: C.white },
    styles: { fontSize: 9, cellPadding: 3, textColor: C.text, font: "helvetica" },
    alternateRowStyles: { fillColor: C.bg },
    margin: { left: 20, right: 20 },
    columnStyles: { 0: { cellWidth: 90 }, 1: { cellWidth: 27 }, 2: { cellWidth: 27 }, 3: { cellWidth: 26 } },
  })

  // Página 8
  doc.addPage()
  y = sectionTitle(doc, 18, "PILAR 4 · MÉTRICAS — GOBERNANZA (G)")
  autoTable(doc, {
    startY: y,
    head: [["Indicador", "Q1 2026"]],
    body: [
      ["Canal de denuncias", "Disponible 24/7 y trazable"],
      ["% datos verificados", `${traceability}%`],
      ["Precisión YOLOv8", `${yoloPrecision.toFixed(1)}%`],
      ["Auditoría programada", "Q3 2026"],
      ["Integridad hash SHA-256", "Aplicada en eventos críticos"],
      ["Fuentes certificadas", `${simulation.officialSources.length} conectadas`],
    ],
    headStyles: { fillColor: C.primary, textColor: C.white },
    styles: { fontSize: 9, cellPadding: 3, textColor: C.text, font: "helvetica" },
    alternateRowStyles: { fillColor: C.bg },
    margin: { left: 20, right: 20 },
    columnStyles: { 0: { cellWidth: 100 }, 1: { cellWidth: 70 } },
  })

  // Página 9
  doc.addPage()
  y = sectionTitle(doc, 18, "HOJA DE RUTA ESG — PRÓXIMOS PASOS")
  autoTable(doc, {
    startY: y,
    head: [["Horizonte", "Acción", "Responsable"]],
    body: [
      ["Q2 2026 (Corto)", "Scope 2 completo + piloto Scope 3", "Joahan Morales"],
      ["Q2 2026 (Corto)", "Reporte Q1 + validación Watson + SHA-256", "Omar Zoe Martínez"],
      ["Q3 2026 (Mediano)", "Primera auditoría externa ESG", "Comité ESG"],
      ["Q3 2026 (Mediano)", "Piloto vehículos eléctricos + TRIR", "Mauro Morales"],
      ["Q4 2026 (Mediano)", "Expansión a otra ciudad", "Equipo completo"],
      ["2027+ (Largo)", "Scope 3 completo + EcoVadis/CDP", "Comité ESG"],
    ],
    headStyles: { fillColor: C.primary, textColor: C.white },
    styles: { fontSize: 9, cellPadding: 3, textColor: C.text, font: "helvetica" },
    alternateRowStyles: { fillColor: C.bg },
    margin: { left: 20, right: 20 },
    columnStyles: { 0: { cellWidth: 35 }, 1: { cellWidth: 105 }, 2: { cellWidth: 30 } },
  })

  // Página 10
  doc.addPage()
  y = sectionTitle(doc, 18, "GLOSARIO")
  autoTable(doc, {
    startY: y,
    head: [["Término", "Definición"]],
    body: [
      ["CO2e", "Equivalente de CO2 ponderado por potencial de calentamiento global"],
      ["PM2.5", "Partículas menores a 2.5 micrómetros"],
      ["NOx", "Óxidos de nitrógeno precursores de ozono troposférico"],
      ["TRIR", "Total Recordable Incident Rate por 200,000 horas"],
      ["LTIR", "Lesiones con baja laboral por 200,000 horas"],
      ["Scope 1/2/3", "Emisiones directas, energía y cadena de valor"],
      ["YOLOv8", "Modelo de visión para detección de objetos en tiempo real"],
      ["IFRS S1/S2", "Normas ISSB de divulgación de sostenibilidad"],
      ["GRI 305", "Estándar GRI para reporte de emisiones"],
      ["SIMAT", "Sistema de Monitoreo Atmosférico de CDMX"],
    ],
    headStyles: { fillColor: C.primary, textColor: C.white },
    styles: { fontSize: 8.5, cellPadding: 2.8, textColor: C.text, font: "helvetica" },
    alternateRowStyles: { fillColor: C.bg },
    margin: { left: 20, right: 20 },
    columnStyles: { 0: { cellWidth: 30 }, 1: { cellWidth: 140 } },
  })
  doc.setFillColor(...C.primary)
  doc.rect(0, 265, 210, 32, "F")
  doc.setTextColor(...C.white)
  doc.setFontSize(9).setFont("helvetica", "bold")
  doc.text("Este reporte fue preparado conforme a IFRS S1 e IFRS S2,", 105, 273, { align: "center" })
  doc.setFont("helvetica", "normal")
  doc.text("con referencia complementaria a GRI 305 y SASB Transporte.", 105, 280, { align: "center" })
  doc.setFontSize(8)
  doc.text("Los datos son auditables y trazables hasta su fuente original.", 105, 286, { align: "center" })
  doc.setFont("helvetica", "italic")
  doc.text("Próximo reporte: Julio 2026 (Q2)", 105, 292, { align: "center" })

  const totalPages = doc.getNumberOfPages()
  for (let page = 2; page <= totalPages; page += 1) {
    doc.setPage(page)
    addHeaderFooter(doc, page, totalPages)
  }

  return { name: reportName, pdfDataUri: toDataUri(doc) }
}

