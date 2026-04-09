"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { Eye, FileText } from "lucide-react"
import type { DriverRecord } from "@/lib/drivers"
import { INITIAL_GOVERNANCE_STATE, nextGovernanceState } from "@/lib/dashboard-simulator"
import { appendEsgReport, loadEsgReports, type EsgReportRecord } from "@/lib/esg-storage"
import { buildEsgPdf } from "@/lib/esg-report"
import { lumivIAToasts } from "@/lib/toast-actions"

export function EsgSection({ drivers }: { drivers: DriverRecord[] }) {
  const [reports, setReports] = useState<EsgReportRecord[]>([])
  const [isGenerating, setIsGenerating] = useState(false)

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
      const report = await buildEsgPdf({ drivers, simulation: simulated })
      const record: EsgReportRecord = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        name: report.name,
        createdAtISO: new Date().toISOString(),
        pdfDataUri: report.pdfDataUri,
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
        <div className="glass-card-strong mb-6 rounded-2xl p-4 sm:mb-8 sm:p-5">
          <h2 className="font-display mb-2 text-2xl tracking-[0.12em] text-slate-100">ESG</h2>
          <p className="text-base text-slate-300">Genera reportes ESG en PDF y consulta el historial local.</p>
        </div>

        <div className="glass-card mb-8 rounded-2xl p-4 sm:p-5">
          <button
            onClick={() => void handleGenerate()}
            disabled={isGenerating}
            className="rounded-xl bg-[#00e5c8] px-6 py-3 font-sans text-sm font-medium text-[#0a0f1a] transition-colors hover:bg-[#00e5c8]/90 disabled:cursor-not-allowed disabled:opacity-60"
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
                      href={report.pdfDataUri}
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

