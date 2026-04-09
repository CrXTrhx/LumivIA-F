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

interface EsgTemplateData {
  empresa: string
  ambito: string
  periodo: string
  estandar: string
  proximo_reporte: string
  resumen: {
    alerta: string
    tabla: Array<{ indicador: string; q1: string; q4: string; variacion: string }>
  }
  gobernanza: {
    estructura: Array<{ elemento: string; estado: string }>
    trazabilidad: Array<{ fuente: string; uso: string; precision: string; actualizacion: string }>
    cumplimiento: Array<{ marco: string; aplicabilidad: string; estado: string }>
  }
  estrategia: {
    riesgos: Array<{ horizonte: string; riesgo: string; probabilidad: string; impacto: string; mitigacion: string }>
    oportunidades: string[]
    simulacion: Array<{ parametro: string; resultado: string }>
  }
  riesgos: {
    canales: string[]
    evaluacion: string
    acciones: Array<{ riesgo: string; accion: string; resultado: string }>
  }
  ambiental: {
    scopes: Array<{ alcance: string; fuente: string; ton_co2e: string; vs_q4: string }>
    contaminantes: Array<{ nombre: string; emitido: string; evitado: string; reduccion: string; metodo: string }>
    kpis: Array<{ kpi: string; valor: string; benchmark: string; posicion: string }>
    equivalencias: string[]
  }
  social: {
    seguridad: Array<{ kpi: string; valor: string; benchmark: string; estado: string }>
    exposicion_pm25: Array<{ nivel: string; umbral: string; conductores: string; porcentaje: string; accion: string }>
    cita: string
    diversidad: Array<{ indicador: string; valor: string; objetivo: string; estado: string }>
  }
  gobernanza_metricas: Array<{ indicador: string; valor: string }>
  hoja_ruta: Array<{ horizonte: string; accion: string; responsable: string }>
  glosario: Array<{ termino: string; definicion: string }>
}

export interface EsgInputData {
  drivers: DriverRecord[]
  simulation?: GovernanceSimulationState
  templateJsonRaw?: string
}

type PdfDoc = {
  setFillColor: (...args: number[]) => any
  rect: (...args: any[]) => any
  setTextColor: (...args: number[]) => any
  setFontSize: (size: number) => any
  setFont: (font: string, style: string) => any
  text: (text: string | string[], x: number, y: number, options?: any) => any
  setDrawColor: (...args: number[]) => any
  setLineWidth: (value: number) => any
  line: (...args: number[]) => any
  roundedRect: (...args: any[]) => any
  splitTextToSize: (text: string, width: number) => string[]
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

function alertBox(doc: PdfDoc, y: number, text: string): number {
  const lines = doc.splitTextToSize(text, 155)
  const h = 10 + lines.length * 5
  doc.setFillColor(...C.bg)
  doc.setDrawColor(...C.secondary)
  doc.setLineWidth(0.5)
  doc.roundedRect(20, y, 170, h, 2, 2, "FD")
  doc.setFillColor(...C.secondary)
  doc.rect(20, y, 3, h, "F")
  doc.setTextColor(...C.primary)
  doc.setFontSize(8).setFont("helvetica", "bold")
  doc.text("ALERTA Q1:", 27, y + 6)
  doc.setFont("helvetica", "normal")
  doc.setTextColor(...C.text)
  doc.text(lines, 27, y + 12)
  return y + h + 4
}

function equivalenceBox(doc: PdfDoc, y: number, lines: string[]) {
  const h = 10 + lines.length * 6
  doc.setFillColor(...C.bg)
  doc.setDrawColor(...C.accent)
  doc.setLineWidth(0.4)
  doc.roundedRect(20, y, 170, h, 2, 2, "FD")
  doc.setTextColor(...C.primary)
  doc.setFontSize(8).setFont("helvetica", "bold")
  doc.text("Equivalencias de ahorro LumivIA", 25, y + 7)
  doc.setFont("helvetica", "normal")
  doc.setTextColor(...C.text)
  lines.forEach((line, i) => doc.text(line, 25, y + 13 + i * 6))
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

function toBlob(dataUri: string): Blob {
  const base64 = dataUri.split(",")[1] || ""
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i)
  }
  return new Blob([bytes], { type: "application/pdf" })
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement("a")
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}

function buildMergedTemplate(
  rawTemplate: string | undefined,
  drivers: DriverRecord[],
  simulation: GovernanceSimulationState,
): EsgTemplateData {
  const parsed = rawTemplate ? (JSON.parse(rawTemplate) as EsgTemplateData) : ({} as EsgTemplateData)
  const totalTrips = drivers.reduce((acc, d) => acc + d.performance.completedTrips, 0)
  const highPmDrivers = Math.max(3, Math.round(drivers.length * 0.12))
  const avgPrecision = simulation.officialSources.reduce((acc, src) => acc + src.precisionPct, 0) / simulation.officialSources.length
  const co2Avoided = Math.round(simulation.monthlyCo2SavedKg * 0.012 * 10) / 10
  const co2Total = Math.round((co2Avoided / 0.109) * 10) / 10
  const optimizedRoutes = Math.max(700, Math.round(totalTrips * 1.4))
  const floodPoints = Math.max(30, simulation.avoidedIncidentsToday * 3)
  const citizenReports = Math.max(120, Math.round(optimizedRoutes * 0.25))

  return {
    ...parsed,
    empresa: parsed.empresa || "LumivIA – The 4 Ases",
    ambito: parsed.ambito || "Ciudad de Mexico (CDMX)",
    periodo: parsed.periodo || "Q1 2026 (Enero-Marzo 2026)",
    estandar: parsed.estandar || "IFRS S1/S2 · GRI 305 · SASB Transporte",
    proximo_reporte: parsed.proximo_reporte || "Julio 2026 (Q2)",
    resumen: {
      ...parsed.resumen,
      alerta:
        parsed.resumen?.alerta ||
        "Se detectaron picos de PM2.5 en corredores críticos y se aplicaron redirecciones automáticas para reducir la exposición de conductores.",
      tabla:
        parsed.resumen?.tabla?.map((row) => ({ ...row })) || [],
    },
    gobernanza: parsed.gobernanza,
    estrategia: parsed.estrategia,
    riesgos: parsed.riesgos,
    ambiental: parsed.ambiental,
    social: parsed.social,
    gobernanza_metricas: parsed.gobernanza_metricas,
    hoja_ruta: parsed.hoja_ruta,
    glosario: parsed.glosario,
  }
}

export async function buildEsgPdf({
  drivers,
  simulation = INITIAL_GOVERNANCE_STATE,
  templateJsonRaw,
}: EsgInputData): Promise<{
  name: string
  pdfDataUri: string
  pdfBlob: Blob
}> {
  const [{ jsPDF }, autoTableModule] = await Promise.all([import("jspdf"), import("jspdf-autotable")])
  const autoTable = autoTableModule.default
  const doc = new jsPDF({ orientation: "p", unit: "mm", format: "a4" }) as unknown as PdfDoc
  const data = buildMergedTemplate(templateJsonRaw, drivers, simulation)

  const now = new Date()
  const dateLabel = now.toLocaleDateString("es-MX")
  const timeLabel = now.toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" })
  const fileName = `Reporte ESG Q1 2026 - ${dateLabel.replaceAll("/", "-")} ${timeLabel.replaceAll(":", "-")}.pdf`

  const avgPrecision = simulation.officialSources.reduce((acc, src) => acc + src.precisionPct, 0) / simulation.officialSources.length
  const co2Avoided = Math.round(simulation.monthlyCo2SavedKg * 0.012 * 10) / 10
  const co2Total = Math.round((co2Avoided / 0.109) * 10) / 10

  // Página 1
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
  doc.setTextColor(...C.muted).setFontSize(10)
  doc.text(`Período: ${data.periodo}`, 20, 102)
  autoTable(doc, {
    startY: 115,
    body: [
      ["Empresa", data.empresa],
      ["Ámbito", data.ambito],
      ["Período", data.periodo],
      ["Fecha", `${dateLabel} ${timeLabel}`],
      ["Marco", data.estandar],
      ["Próx. reporte", data.proximo_reporte],
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
  doc.setTextColor(...C.white).setFontSize(8).setFont("helvetica", "normal")
  doc.text("Confidencial – Para uso interno IBM y revisión de Comité ESG", 105, 291, { align: "center" })

  // Página 2
  doc.addPage()
  sectionTitle(doc, 18, "00 RESUMEN EJECUTIVO")
  kpiCard(doc, 20, 35, `${co2Total.toFixed(1)} t`, "CO2e totales (Scope 1+2)")
  kpiCard(doc, 62, 35, `-${co2Avoided.toFixed(1)} t`, "CO2e evitado por optimización")
  kpiCard(doc, 104, 35, "-10.9%", "Reducción vs ruta directa")
  kpiCard(doc, 146, 35, `${avgPrecision.toFixed(1)}%`, "Precisión modelo YOLOv8")
  autoTable(doc, {
    startY: 65,
    head: [["Indicador clave", "Q1 2026", "Q4 2025", "Variación"]],
    body: data.resumen.tabla.map((row) => [row.indicador, row.q1, row.q4, row.variacion]),
    headStyles: { fillColor: C.primary, textColor: C.white, fontStyle: "bold", fontSize: 9 },
    styles: { fontSize: 9, cellPadding: 3, textColor: C.text, font: "helvetica" },
    alternateRowStyles: { fillColor: C.bg },
    margin: { left: 20, right: 20 },
    columnStyles: { 0: { cellWidth: 90 }, 1: { cellWidth: 27 }, 2: { cellWidth: 27 }, 3: { cellWidth: 26 } },
  })
  alertBox(doc, (doc as any).lastAutoTable.finalY + 6, data.resumen.alerta)

  // Página 3
  doc.addPage()
  let y = sectionTitle(doc, 18, "PILAR 1 · GOBERNANZA")
  y = sectionTitle(doc, y, "1.1 Estructura de supervisión ESG")
  autoTable(doc, {
    startY: y,
    head: [["Elemento de gobernanza", "Estado Q1 2026"]],
    body: data.gobernanza.estructura.map((r) => [r.elemento, r.estado]),
    headStyles: { fillColor: C.primary, textColor: C.white },
    styles: { fontSize: 9, cellPadding: 3, textColor: C.text, font: "helvetica" },
    alternateRowStyles: { fillColor: C.bg },
    columnStyles: { 0: { cellWidth: 100 }, 1: { cellWidth: 70 } },
    margin: { left: 20, right: 20 },
  })
  y = (doc as any).lastAutoTable.finalY + 6
  y = sectionTitle(doc, y, "1.2 Trazabilidad de datos")
  autoTable(doc, {
    startY: y,
    head: [["Fuente de dato", "Uso en LumivIA", "Precisión", "Actualización"]],
    body: data.gobernanza.trazabilidad.map((r) => [r.fuente, r.uso, r.precision, r.actualizacion]),
    headStyles: { fillColor: C.primary, textColor: C.white, fontSize: 8 },
    styles: { fontSize: 8, cellPadding: 2.5, textColor: C.text, font: "helvetica" },
    alternateRowStyles: { fillColor: C.bg },
    margin: { left: 20, right: 20 },
    columnStyles: { 0: { cellWidth: 45 }, 1: { cellWidth: 65 }, 2: { cellWidth: 30 }, 3: { cellWidth: 30 } },
  })

  // Página 4
  doc.addPage()
  y = sectionTitle(doc, 18, "PILAR 2 · ESTRATEGIA")
  autoTable(doc, {
    startY: y,
    head: [["Horizonte", "Riesgo identificado", "Prob.", "Impacto", "Mitigación LumivIA"]],
    body: data.estrategia.riesgos.map((r) => [r.horizonte, r.riesgo, r.probabilidad, r.impacto, r.mitigacion]),
    headStyles: { fillColor: C.primary, textColor: C.white, fontSize: 8 },
    styles: { fontSize: 8, cellPadding: 2.6, textColor: C.text, font: "helvetica" },
    alternateRowStyles: { fillColor: C.bg },
    margin: { left: 20, right: 20 },
    columnStyles: { 0: { cellWidth: 22 }, 1: { cellWidth: 65 }, 2: { cellWidth: 15 }, 3: { cellWidth: 18 }, 4: { cellWidth: 50 } },
  })
  y = (doc as any).lastAutoTable.finalY + 6
  sectionTitle(doc, y, "2.2 Oportunidades ESG")
  data.estrategia.oportunidades.slice(0, 4).forEach((item, i) => {
    const lines = doc.splitTextToSize(`→ ${item}`, 166)
    doc.setFontSize(8.5).setTextColor(...C.text).setFont("helvetica", "normal")
    doc.text(lines, 20, y + 16 + i * 12)
  })

  // Página 5
  doc.addPage()
  y = sectionTitle(doc, 18, "PILAR 3 · GESTIÓN DE RIESGOS")
  data.riesgos.canales.slice(0, 3).forEach((item, i) => {
    const lines = doc.splitTextToSize(`• ${item}`, 166)
    doc.setFontSize(8.6).setTextColor(...C.text).setFont("helvetica", "normal")
    doc.text(lines, 20, y + 2 + i * 11)
  })
  const evalLines = doc.splitTextToSize(data.riesgos.evaluacion, 166)
  doc.setTextColor(...C.muted).setFontSize(8)
  doc.text(evalLines, 20, y + 39)
  autoTable(doc, {
    startY: y + 60,
    head: [["Riesgo detectado", "Acción LumivIA", "Resultado Q1"]],
    body: data.riesgos.acciones.map((r) => [r.riesgo, r.accion, r.resultado]),
    headStyles: { fillColor: C.primary, textColor: C.white },
    styles: { fontSize: 8.6, cellPadding: 2.8, textColor: C.text, font: "helvetica" },
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
    body: data.ambiental.scopes.map((r) => [r.alcance, r.fuente, r.ton_co2e, r.vs_q4]),
    headStyles: { fillColor: C.primary, textColor: C.white },
    styles: { fontSize: 8.8, cellPadding: 2.8, textColor: C.text, font: "helvetica" },
    alternateRowStyles: { fillColor: C.bg },
    margin: { left: 20, right: 20 },
    columnStyles: { 0: { cellWidth: 40 }, 1: { cellWidth: 80 }, 2: { cellWidth: 25 }, 3: { cellWidth: 25 } },
  })
  y = (doc as any).lastAutoTable.finalY + 6
  autoTable(doc, {
    startY: y,
    head: [["Contaminante", "Emitido Q1 (kg)", "Evitado (kg)", "Reducción", "Método"]],
    body: data.ambiental.contaminantes.map((r) => [r.nombre, r.emitido, r.evitado, r.reduccion, r.metodo]),
    headStyles: { fillColor: C.primary, textColor: C.white, fontSize: 8 },
    styles: { fontSize: 8, cellPadding: 2.6, textColor: C.text, font: "helvetica" },
    alternateRowStyles: { fillColor: C.bg },
    margin: { left: 20, right: 20 },
    columnStyles: { 0: { cellWidth: 25 }, 1: { cellWidth: 30 }, 2: { cellWidth: 30 }, 3: { cellWidth: 22 }, 4: { cellWidth: 63 } },
  })
  equivalenceBox(doc, (doc as any).lastAutoTable.finalY + 6, data.ambiental.equivalencias.slice(0, 3))

  // Página 7
  doc.addPage()
  y = sectionTitle(doc, 18, "PILAR 4 · MÉTRICAS — SOCIAL (S)")
  autoTable(doc, {
    startY: y,
    head: [["KPI", "Valor Q1 2026", "Benchmark", "Estado"]],
    body: data.social.seguridad.map((r) => [r.kpi, r.valor, r.benchmark, r.estado]),
    headStyles: { fillColor: C.primary, textColor: C.white },
    styles: { fontSize: 8.8, cellPadding: 2.7, textColor: C.text, font: "helvetica" },
    alternateRowStyles: { fillColor: C.bg },
    margin: { left: 20, right: 20 },
    columnStyles: { 0: { cellWidth: 90 }, 1: { cellWidth: 27 }, 2: { cellWidth: 27 }, 3: { cellWidth: 26 } },
  })
  y = (doc as any).lastAutoTable.finalY + 6
  autoTable(doc, {
    startY: y,
    head: [["Nivel de riesgo", "Umbral PM2.5", "Conductores Q1", "% total", "Acción"]],
    body: data.social.exposicion_pm25.map((r) => [r.nivel, r.umbral, r.conductores, r.porcentaje, r.accion]),
    headStyles: { fillColor: C.primary, textColor: C.white, fontSize: 8 },
    styles: { fontSize: 8, cellPadding: 2.5, textColor: C.text, font: "helvetica" },
    alternateRowStyles: { fillColor: C.bg },
    margin: { left: 20, right: 20 },
    columnStyles: { 0: { cellWidth: 25 }, 1: { cellWidth: 45 }, 2: { cellWidth: 30 }, 3: { cellWidth: 20 }, 4: { cellWidth: 50 } },
  })

  // Página 8
  doc.addPage()
  y = sectionTitle(doc, 18, "PILAR 4 · MÉTRICAS — GOBERNANZA (G)")
  autoTable(doc, {
    startY: y,
    head: [["Indicador", "Q1 2026"]],
    body: data.gobernanza_metricas.map((r) => [r.indicador, r.valor]),
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
    body: data.hoja_ruta.map((r) => [r.horizonte, r.accion, r.responsable]),
    headStyles: { fillColor: C.primary, textColor: C.white },
    styles: { fontSize: 8.8, cellPadding: 2.8, textColor: C.text, font: "helvetica" },
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
    body: data.glosario.map((row) => [row.termino, row.definicion]),
    headStyles: { fillColor: C.primary, textColor: C.white },
    styles: { fontSize: 8.5, cellPadding: 2.7, textColor: C.text, font: "helvetica" },
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

  const pdfDataUri = toDataUri(doc)
  const pdfBlob = toBlob(pdfDataUri)
  downloadBlob(pdfBlob, fileName)
  return { name: fileName, pdfDataUri, pdfBlob }
}

