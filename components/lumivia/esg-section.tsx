"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { Eye, FileText } from "lucide-react"
import type { DriverRecord } from "@/lib/drivers"
import { INITIAL_GOVERNANCE_STATE, nextGovernanceState } from "@/lib/dashboard-simulator"
import { appendEsgReport, loadEsgReports, type EsgReportRecord } from "@/lib/esg-storage"
import { buildEsgPdf } from "@/lib/esg-report"
import { lumivIAToasts } from "@/lib/toast-actions"

const ESG_TEMPLATE_JSON = String.raw`{
  "_instruccion": "schema para generateESGReport(data)",
  "empresa": "LumivIA – The 4 Ases",
  "ambito": "Ciudad de Mexico (CDMX)",
  "periodo": "Q1 2026 (Enero–Marzo 2026)",
  "estandar": "IFRS S1/S2 · GRI 305 · SASB Transporte",
  "proximo_reporte": "Julio 2026 (Q2)",
  "resumen": {
    "alerta": "La zona Insurgentes Sur registro un promedio de 185 ug/m3 de PM2.5 durante enero, superando el umbral critico.",
    "tabla": [
      { "indicador": "Emisiones totales (ton CO2e)", "q1": "150.2", "q4": "169.0", "variacion": "-11.1%" },
      { "indicador": "CO2e evitado por optimizacion (ton)", "q1": "18.5", "q4": "12.3", "variacion": "+50.4%" },
      { "indicador": "Rutas optimizadas generadas", "q1": "1,247", "q4": "921", "variacion": "+35.4%" },
      { "indicador": "Puntos de inundacion detectados/alertados", "q1": "47", "q4": "38", "variacion": "+23.7%" },
      { "indicador": "Reportes ciudadanos procesados", "q1": "312", "q4": "189", "variacion": "+65.1%" },
      { "indicador": "Conductores con exposicion alta a PM2.5", "q1": "5", "q4": "11", "variacion": "-54.5%" },
      { "indicador": "Consultas medicas respiratorias", "q1": "2", "q4": "4", "variacion": "-50.0%" }
    ]
  },
  "gobernanza": {
    "estructura": [
      { "elemento": "Comite ESG activo", "estado": "Si – sesiones mensuales" },
      { "elemento": "Responsable ESG designado", "estado": "Si" },
      { "elemento": "Politica anticorrupcion documentada", "estado": "Si (v1.0, enero 2026)" },
      { "elemento": "Canal de denuncias activo", "estado": "Si" },
      { "elemento": "Codigo de etica publicado", "estado": "Si – disponible en GitHub" },
      { "elemento": "Auditoria externa ESG", "estado": "Programada Q3 2026" },
      { "elemento": "% datos ESG verificados externamente", "estado": "100% (fuentes publicas certificadas)" }
    ],
    "trazabilidad": [
      { "fuente": "Video urbano + YOLOv8", "uso": "Conteo de vehiculos por tipo y calle", "precision": "+-5% vs conteo manual", "actualizacion": "Tiempo real" },
      { "fuente": "Climatiq API (IPCC 2023)", "uso": "Factores CO2, NOx, PM2.5 por tipo vehiculo", "precision": "Estandar internacional", "actualizacion": "Anual" },
      { "fuente": "Open-Meteo API + INEGI", "uso": "Precipitacion y pronostico riesgo hidrico", "precision": "+-3%", "actualizacion": "Cada hora" },
      { "fuente": "DEM INEGI (1.5m res.)", "uso": "Elevacion del terreno, cuencas, escurrimiento", "precision": "1.5m resolucion", "actualizacion": "Estatico" }
    ],
    "cumplimiento": [
      { "marco": "IFRS S1/S2 (NIS Mexico)", "aplicabilidad": "Divulgacion de sostenibilidad", "estado": "Cumple" },
      { "marco": "GRI 305 – Emisiones", "aplicabilidad": "Reporte de GEI Scope 1, 2 y 3", "estado": "Cumple" },
      { "marco": "SASB – Transporte", "aplicabilidad": "Metricas sectoriales de flota", "estado": "Cumple" }
    ]
  },
  "estrategia": {
    "riesgos": [
      { "horizonte": "Corto (<1 ano)", "riesgo": "Aumento de eventos de lluvia extrema en CDMX", "probabilidad": "Alta", "impacto": "Medio", "mitigacion": "Algoritmo HydroSHEDS + Open-Meteo" },
      { "horizonte": "Mediano (1-5 a.)", "riesgo": "Regulacion obligatoria de Scope 3", "probabilidad": "Alta", "impacto": "Alto", "mitigacion": "Hoja de ruta Scope 3 iniciada Q2 2026" }
    ],
    "oportunidades": [
      "Financiamiento verde con metricas auditables.",
      "Proveedor ESG-verificado de IBM con datos trazables.",
      "Licencias institucionales para dashboards de ciudad.",
      "Expansion a nuevas ciudades con IBM Watsonx."
    ],
    "simulacion": [
      { "parametro": "Reduccion de trafico vehicular proyectada", "resultado": "-8%" },
      { "parametro": "CO2e evitado anual estimado", "resultado": "450 ton" },
      { "parametro": "Mejora calidad de aire – PM2.5", "resultado": "-12%" },
      { "parametro": "ROI estimado de la intervencion", "resultado": "3.2 anos" }
    ]
  },
  "riesgos": {
    "canales": [
      "Monitoreo en tiempo real con alertas automáticas.",
      "Modulo de reporte ciudadano desde telefono.",
      "Revision mensual del Comite ESG."
    ],
    "evaluacion": "Cada riesgo se evalua con matriz Probabilidad x Impacto (1-5) y escalamiento >= 12.",
    "acciones": [
      { "riesgo": "PM2.5 > 150 ug/m3", "accion": "Redireccion automatica de rutas", "resultado": "Exposicion critica reducida" },
      { "riesgo": "Lluvia extrema", "accion": "Activacion de rutas alternativas", "resultado": "0 vehiculos varados" }
    ]
  },
  "ambiental": {
    "scopes": [
      { "alcance": "Scope 1 – Flota propia", "fuente": "Combustible diesel/gasolina", "ton_co2e": "145.8", "vs_q4": "-10.5%" },
      { "alcance": "Scope 2 – Electricidad", "fuente": "Red CFE", "ton_co2e": "4.4", "vs_q4": "-2.2%" },
      { "alcance": "Scope 3 – Cadena de valor", "fuente": "Piloto Q2 2026", "ton_co2e": "–", "vs_q4": "–" },
      { "alcance": "TOTAL", "fuente": "", "ton_co2e": "150.2", "vs_q4": "-10.0%" }
    ],
    "contaminantes": [
      { "nombre": "CO2", "emitido": "150,200", "evitado": "18,500", "reduccion": "-10.9%", "metodo": "Litros x factor IPCC 2023" },
      { "nombre": "NOx", "emitido": "9,240", "evitado": "385", "reduccion": "-4.0%", "metodo": "Factor por tipo vehiculo" },
      { "nombre": "PM2.5", "emitido": "1,248", "evitado": "52", "reduccion": "-4.0%", "metodo": "YOLOv8 + factores de emisión" }
    ],
    "kpis": [
      { "kpi": "Emisiones / $ facturado", "valor": "0.38", "benchmark": "0.45 – 0.85", "posicion": "Por debajo del benchmark" },
      { "kpi": "Emisiones / ton-km", "valor": "0.058", "benchmark": "0.062", "posicion": "Por debajo del benchmark" }
    ],
    "equivalencias": [
      "18.5 ton CO2e evitadas = 840 arboles absorbiendo CO2 durante 1 ano",
      "95,000 km menos recorridos = $127,000 MXN ahorrados en combustible",
      "Progreso meta anual 2026 (-15%): 8.2% acumulado en Q1 – ON TRACK"
    ]
  },
  "social": {
    "seguridad": [
      { "kpi": "TRIR", "valor": "2.1", "benchmark": "< 3.0", "estado": "Cumple" },
      { "kpi": "LTIR", "valor": "1.2", "benchmark": "< 1.5", "estado": "Cumple" }
    ],
    "exposicion_pm25": [
      { "nivel": "Bajo", "umbral": "< 20 hrs/mes", "conductores": "18", "porcentaje": "40%", "accion": "Seguimiento estandar" },
      { "nivel": "Medio", "umbral": "20 – 40 hrs/mes", "conductores": "22", "porcentaje": "49%", "accion": "Revision medica semestral" },
      { "nivel": "Alto", "umbral": "> 40 hrs/mes", "conductores": "5", "porcentaje": "11%", "accion": "Seguimiento medico inmediato" }
    ],
    "cita": "LumivIA no es una herramienta de monitoreo punitivo, sino de proteccion activa del trabajador.",
    "diversidad": [
      { "indicador": "Rotacion de personal (%)", "valor": "11.2%", "objetivo": "< 15%", "estado": "Cumple" },
      { "indicador": "% mujeres en plantilla total", "valor": "22%", "objetivo": "Tendencia +", "estado": "En progreso" }
    ]
  },
  "gobernanza_metricas": [
    { "indicador": "Canal de denuncias activo", "valor": "Si" },
    { "indicador": "% datos ESG verificados externamente", "valor": "100%" },
    { "indicador": "Frecuencia de actualizacion de metricas", "valor": "Tiempo real" },
    { "indicador": "Auditoria externa programada", "valor": "Q3 2026" }
  ],
  "hoja_ruta": [
    { "horizonte": "Q2 2026 (Corto)", "accion": "Implementar Scope 2 completo + piloto Scope 3", "responsable": "Joahan Morales" },
    { "horizonte": "Q3 2026 (Mediano)", "accion": "Primera auditoria externa ESG", "responsable": "Comite ESG" }
  ],
  "glosario": [
    { "termino": "CO2e", "definicion": "Equivalente de CO2 – incluye todos los GEI ponderados por su GWP a 100 anos" },
    { "termino": "PM2.5", "definicion": "Particulas con diametro aerodinamico inferior a 2.5 micrometros" },
    { "termino": "NOx", "definicion": "Oxidos de nitrogeno (NO + NO2) – precursores de ozono troposferico" }
  ]
}`

export function EsgSection({ drivers }: { drivers: DriverRecord[] }) {
  const [reports, setReports] = useState<EsgReportRecord[]>([])
  const [isGenerating, setIsGenerating] = useState(false)
  const previewUrls = useMemo(() => {
    return reports.reduce<Record<string, string>>((acc, report) => {
      if (report.pdfBlob) {
        acc[report.id] = URL.createObjectURL(report.pdfBlob)
      } else if (report.pdfDataUri) {
        acc[report.id] = report.pdfDataUri
      }
      return acc
    }, {})
  }, [reports])

  useEffect(() => {
    return () => {
      Object.values(previewUrls).forEach((url) => {
        if (url.startsWith("blob:")) URL.revokeObjectURL(url)
      })
    }
  }, [previewUrls])

  useEffect(() => {
    let cancelled = false
    void (async () => {
      const stored = await loadEsgReports()
      if (!cancelled) setReports(stored)
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const handleGenerate = useCallback(async () => {
    try {
      setIsGenerating(true)
      // Datos base del dashboard + simulación adicional para completar el formato ESG.
      const simulated = Array.from({ length: 4 }).reduce((acc) => nextGovernanceState(acc), INITIAL_GOVERNANCE_STATE)
      const report = await buildEsgPdf({ drivers, simulation: simulated, templateJsonRaw: ESG_TEMPLATE_JSON })
      const record: EsgReportRecord = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        name: report.name,
        createdAtISO: new Date().toISOString(),
        pdfBlob: report.pdfBlob,
      }
      const next = await appendEsgReport(record)
      setReports(next)
      lumivIAToasts.esgReportGenerated()
    } catch {
      lumivIAToasts.error("No se pudo generar el reporte ESG", "Intenta nuevamente en unos segundos.")
    } finally {
      setIsGenerating(false)
    }
  }, [drivers])

  const sortedReports = useMemo(
    () => [...reports].sort((a, b) => new Date(b.createdAtISO).getTime() - new Date(a.createdAtISO).getTime()),
    [reports],
  )

  return (
    <section className="relative mt-12 min-h-[calc(100vh-56px)] overflow-hidden text-slate-100">
      <div className="absolute inset-0">
        <div className="h-full w-full bg-[#060a14]" />
      </div>
      <div className="absolute inset-0 opacity-20">
        <div className="h-full w-full bg-[radial-gradient(ellipse_at_top,_rgba(59,130,246,0.25),_transparent_60%)]" />
      </div>
      <div className="relative mx-auto max-w-5xl px-4 pb-24 pt-6 sm:px-6 sm:pb-20 sm:pt-8">
        <div className="glass-card mb-8 rounded-2xl p-4 sm:p-5">
          <button
            onClick={() => void handleGenerate()}
            disabled={isGenerating}
            className="w-full rounded-xl bg-[#00e5c8] px-6 py-3 font-sans text-sm font-medium text-[#0a0f1a] transition-colors hover:bg-[#00e5c8]/90 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isGenerating ? "Generando reporte ESG..." : "Generar reporte ESG"}
          </button>
        </div>

        <div className="glass-card rounded-2xl p-4 sm:p-5">
          <h3 className="mb-4 font-display text-lg tracking-[0.12em] text-slate-100">Historial de reportes generados</h3>
          {!sortedReports.length ? (
            <p className="text-sm text-slate-400">Aún no hay reportes ESG generados.</p>
          ) : (
            <div className="space-y-3">
              {sortedReports.map((report) => {
                const date = new Date(report.createdAtISO)
                return (
                  <article
                    key={report.id}
                    className="glass-card flex flex-col gap-3 rounded-xl border border-slate-700/40 p-3 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="min-w-0">
                      <p className="flex items-center gap-2 truncate text-sm text-slate-100">
                        <FileText className="h-4 w-4 flex-shrink-0 text-sky-300" />
                        <span className="truncate">{report.name}</span>
                      </p>
                      <p className="mt-1 text-xs text-slate-400">
                        {date.toLocaleDateString("es-MX")} · {date.toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" })}
                      </p>
                    </div>
                    <a
                      href={previewUrls[report.id] ?? "#"}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-600 px-3 py-2 text-xs font-medium text-slate-200 transition-colors hover:border-sky-400 hover:text-sky-300"
                    >
                      <Eye className="h-4 w-4" />
                      Previsualizar PDF
                    </a>
                  </article>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </section>
  )
}

