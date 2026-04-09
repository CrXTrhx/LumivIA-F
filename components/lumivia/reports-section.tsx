"use client"

import { useState, useEffect } from "react"
import { Search, ThumbsUp, Plus, X } from "lucide-react"
import { ReportsListSkeleton } from "@/components/ui/skeleton"
import { lumivIAToasts } from "@/lib/toast-actions"

type ReportType = "inundacion" | "bache" | "contaminacion" | "obstruccion"

interface Report {
  id: string
  street: string
  type: ReportType
  description: string
  timestamp: string
  upvotes: number
  severity: "critical" | "moderate" | "low"
}

const mockReports: Report[] = [
  {
    id: "1",
    street: "Av. Insurgentes Norte altura Metro La Raza",
    type: "inundacion",
    description: "Encharcamiento severo de aproximadamente 40cm impidiendo el paso de vehículos pequeños",
    timestamp: "hace 23 min",
    upvotes: 47,
    severity: "critical"
  },
  {
    id: "2",
    street: "Calle Sonora esquina con Álvaro Obregón",
    type: "bache",
    description: "Bache de gran tamaño en el carril central, peligroso para motociclistas",
    timestamp: "hace 1 hora",
    upvotes: 32,
    severity: "moderate"
  },
  {
    id: "3",
    street: "Eje Central Lázaro Cárdenas frente a Bellas Artes",
    type: "contaminacion",
    description: "Humo denso proveniente de obras de construcción afectando visibilidad",
    timestamp: "hace 2 horas",
    upvotes: 18,
    severity: "moderate"
  },
  {
    id: "4",
    street: "Paseo de la Reforma altura Ángel de la Independencia",
    type: "obstruccion",
    description: "Árbol caído bloqueando un carril después de la tormenta de anoche",
    timestamp: "hace 4 horas",
    upvotes: 89,
    severity: "low"
  }
]

const filterOptions = ["Todos", "Inundación", "Bache", "Contaminación", "Obstrucción"]

export function ReportsSection() {
  const [searchQuery, setSearchQuery] = useState("")
  const [activeFilter, setActiveFilter] = useState("Todos")
  const [showModal, setShowModal] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [newReport, setNewReport] = useState({
    street: "",
    type: "inundacion" as ReportType,
    description: ""
  })

  const typeColors: Record<ReportType, { bg: string; text: string; label: string }> = {
    inundacion: { bg: "bg-[#7c6bff]/20", text: "text-[#7c6bff]", label: "Inundación" },
    bache: { bg: "bg-[#ff6b4a]/20", text: "text-[#ff6b4a]", label: "Bache" },
    contaminacion: { bg: "bg-[#ff6b4a]/20", text: "text-[#ff6b4a]", label: "Contaminación" },
    obstruccion: { bg: "bg-[#f5c842]/20", text: "text-[#f5c842]", label: "Obstrucción" }
  }

  const severityColors: Record<string, string> = {
    critical: "border-l-[#ff6b4a]",
    moderate: "border-l-[#f5c842]",
    low: "border-l-[#00e5c8]"
  }

  const filteredReports = mockReports.filter(report => {
    const matchesSearch = report.street.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesFilter = activeFilter === "Todos" || typeColors[report.type].label === activeFilter
    return matchesSearch && matchesFilter
  })

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsLoading(false)
    }, 1200)
    return () => clearTimeout(timer)
  }, [])

  const handleSubmitReport = () => {
    // In a real app, this would POST to BACKEND_URL/api/reporte
    console.log("New report:", newReport)
    setShowModal(false)
    setNewReport({ street: "", type: "inundacion", description: "" })
    lumivIAToasts.reportSubmitted()
  }

  return (
    <section className="relative mt-12 min-h-[calc(100vh-48px)] overflow-hidden text-slate-100">
      <div className="absolute inset-0">
        <div className="h-full w-full bg-[#060a14]" />
      </div>
      <div className="absolute inset-0 opacity-20">
        <div className="h-full w-full bg-[radial-gradient(ellipse_at_top,_rgba(59,130,246,0.25),_transparent_60%)]" />
      </div>
      <div className="relative mx-auto max-w-4xl px-4 py-8 sm:px-6 pb-20">
        {/* Header */}
        <div className="glass-card-strong mb-6 rounded-2xl p-4 sm:mb-8 sm:p-5">
          <h2 className="font-display mb-2 text-2xl tracking-[0.12em] text-slate-100">Reportes ciudadanos</h2>
          <p className="text-base text-slate-300">
            Consulta y reporta el estado de las calles en tiempo real
          </p>
        </div>

        {/* Search bar */}
        <div className="flex gap-3 mb-6">
          <div className="flex-1 relative">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar calle o colonia..."
              className="glass-card w-full rounded-xl border border-slate-700/50 px-4 py-3 pl-11 text-sm text-slate-100 placeholder-slate-500 focus:border-sky-400 focus:outline-none"
            />
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[#6b7280]" />
          </div>
          <button className="bg-[#00e5c8] text-[#0a0f1a] px-6 py-3 rounded-xl font-sans font-medium text-sm hover:bg-[#00e5c8]/90 transition-colors">
            Buscar
          </button>
        </div>

        {/* Filter pills */}
        <div className="flex flex-wrap gap-2 mb-6">
          {filterOptions.map((filter) => (
            <button
              key={filter}
              onClick={() => setActiveFilter(filter)}
              className={`px-4 py-2 rounded-full text-sm font-sans transition-colors ${
                activeFilter === filter
                  ? "bg-[#00e5c8] text-[#0a0f1a]"
                  : "glass-card text-slate-300 hover:text-slate-100"
              }`}
            >
              {filter}
            </button>
          ))}
        </div>

        {/* Report cards or skeleton */}
        {isLoading ? (
          <ReportsListSkeleton count={4} />
        ) : (
          <div className="space-y-4">
            {filteredReports.map((report) => (
              <div
                key={report.id}
                className={`glass-card rounded-xl border-l-4 p-4 ${severityColors[report.severity]} transition-colors`}
              >
                <div className="flex items-start justify-between mb-2">
                  <h3 className="font-mono text-sm text-slate-100">{report.street}</h3>
                  <span className={`${typeColors[report.type].bg} ${typeColors[report.type].text} px-2 py-0.5 rounded text-xs font-mono uppercase tracking-widest`}>
                    {typeColors[report.type].label}
                  </span>
                </div>
                <p className="mb-3 text-sm leading-relaxed text-slate-300">
                  {report.description}
                </p>
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs text-[#6b7280]">{report.timestamp}</span>
                  <button className="flex items-center gap-1.5 text-[#9ca3af] hover:text-[#00e5c8] transition-colors">
                    <ThumbsUp className="w-4 h-4" />
                    <span className="font-mono text-xs">{report.upvotes}</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Floating Action Button */}
      <button
        onClick={() => setShowModal(true)}
        className="fixed bottom-6 right-6 bg-[#00e5c8] text-[#0a0f1a] px-5 py-3 rounded-full font-sans font-medium text-sm hover:bg-[#00e5c8]/90 transition-all hover:shadow-[0_0_20px_rgba(0,229,200,0.3)] flex items-center gap-2 z-40"
      >
        <Plus className="w-5 h-5" />
        Nuevo reporte
      </button>

      {/* New Report Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 px-4">
          <div className="bg-[#111827] rounded-2xl p-6 w-full max-w-md border border-[#1f2937]">
            <div className="flex items-center justify-between mb-6">
              <h3 className="font-mono text-xl text-[#e5e7eb]">Nuevo reporte</h3>
              <button 
                onClick={() => setShowModal(false)}
                className="text-[#6b7280] hover:text-[#e5e7eb] transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block font-sans text-sm text-[#9ca3af] mb-2">
                  Calle / Ubicación
                </label>
                <input
                  type="text"
                  value={newReport.street}
                  onChange={(e) => setNewReport(prev => ({ ...prev, street: e.target.value }))}
                  placeholder="Ej: Av. Insurgentes Norte #123"
                  className="w-full bg-[#1f2937] border border-[#374151] rounded-lg px-4 py-3 text-sm font-sans text-[#e5e7eb] placeholder-[#6b7280] focus:outline-none focus:border-[#00e5c8]"
                />
              </div>

              <div>
                <label className="block font-sans text-sm text-[#9ca3af] mb-2">
                  Tipo de reporte
                </label>
                <select
                  value={newReport.type}
                  onChange={(e) => setNewReport(prev => ({ ...prev, type: e.target.value as ReportType }))}
                  className="w-full bg-[#1f2937] border border-[#374151] rounded-lg px-4 py-3 text-sm font-sans text-[#e5e7eb] focus:outline-none focus:border-[#00e5c8]"
                >
                  <option value="inundacion">Inundación</option>
                  <option value="bache">Bache</option>
                  <option value="contaminacion">Contaminación</option>
                  <option value="obstruccion">Obstrucción</option>
                </select>
              </div>

              <div>
                <label className="block font-sans text-sm text-[#9ca3af] mb-2">
                  Descripción
                </label>
                <textarea
                  value={newReport.description}
                  onChange={(e) => setNewReport(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Describe la situación..."
                  rows={4}
                  className="w-full bg-[#1f2937] border border-[#374151] rounded-lg px-4 py-3 text-sm font-sans text-[#e5e7eb] placeholder-[#6b7280] focus:outline-none focus:border-[#00e5c8] resize-none"
                />
              </div>

              <button
                onClick={handleSubmitReport}
                className="w-full bg-[#00e5c8] text-[#0a0f1a] py-3 rounded-lg font-sans font-medium hover:bg-[#00e5c8]/90 transition-colors"
              >
                Enviar reporte
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}
