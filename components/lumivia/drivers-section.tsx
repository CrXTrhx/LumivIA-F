"use client"

import { useMemo, useState } from "react"
import { Award, CalendarDays, Gift, IdCard, MapPin, Phone, Plus, ShieldCheck, Star, Truck } from "lucide-react"
import {
  getTodayISODate,
  ROUTE_TEMPLATES,
  ROUTE_TEMPLATE_BY_ID,
  type DriverRecord,
  type DriverStatus,
  type RegisterDriverInput,
} from "@/lib/drivers"

interface DriversSectionProps {
  drivers: DriverRecord[]
  onCreateDriver: (payload: RegisterDriverInput) => void
  onAssignRoute: (driverId: string, routeId: string, routeDateISO: string) => void
  onUpdateDriverStatus: (driverId: string, status: DriverStatus) => void
}

const statusLabel: Record<DriverStatus, string> = {
  pendiente: "Pendiente",
  en_curso: "En curso",
  completada: "Completada",
}

const statusStyle: Record<DriverStatus, string> = {
  pendiente: "text-amber-200 bg-amber-500/15 border-amber-400/35",
  en_curso: "text-cyan-200 bg-cyan-500/15 border-cyan-400/35",
  completada: "text-emerald-200 bg-emerald-500/15 border-emerald-400/35",
}

interface DriverFormState {
  fullName: string
  licenseNumber: string
  phone: string
  routeId: string
  routeDateISO: string
}

const initialForm: DriverFormState = {
  fullName: "",
  licenseNumber: "",
  phone: "",
  routeId: ROUTE_TEMPLATES[0]?.id ?? "rt-01",
  routeDateISO: getTodayISODate(),
}

function routeBadgeClasses(routeId: string): string {
  const route = ROUTE_TEMPLATE_BY_ID[routeId]
  if (!route) return "text-slate-200 bg-slate-500/15 border-slate-400/35"
  return "text-slate-100 border-slate-300/35"
}

function routeLabel(routeId: string): string {
  return ROUTE_TEMPLATE_BY_ID[routeId]?.label ?? "Ruta"
}

function routeDescription(routeId: string): string {
  return ROUTE_TEMPLATE_BY_ID[routeId]?.description ?? "Ruta operativa"
}

function formatMXN(value: number): string {
  return value.toLocaleString("es-MX", { style: "currency", currency: "MXN", maximumFractionDigits: 0 })
}

function scoreToTier(score: number): string {
  if (score >= 92) return "Elite"
  if (score >= 84) return "Excelente"
  if (score >= 74) return "Estable"
  return "En mejora"
}

export function DriversSection({ drivers, onCreateDriver, onAssignRoute, onUpdateDriverStatus }: DriversSectionProps) {
  const [form, setForm] = useState<DriverFormState>(initialForm)
  const [selectedDriverId, setSelectedDriverId] = useState<string>(drivers[0]?.id ?? "")

  const selectedDriver = useMemo(
    () => drivers.find((driver) => driver.id === selectedDriverId) ?? drivers[0] ?? null,
    [drivers, selectedDriverId],
  )

  const activeToday = useMemo(
    () => drivers.filter((driver) => driver.routeDateISO === getTodayISODate() && driver.status !== "completada").length,
    [drivers],
  )

  const activeInCourse = useMemo(() => drivers.filter((driver) => driver.status === "en_curso").length, [drivers])

  const handleSubmit = () => {
    if (!form.fullName.trim() || !form.licenseNumber.trim() || !form.phone.trim()) return

    onCreateDriver({
      fullName: form.fullName,
      licenseNumber: form.licenseNumber,
      phone: form.phone,
      routeId: form.routeId,
      routeDateISO: form.routeDateISO,
    })

    setForm(initialForm)
  }

  return (
    <section className="relative min-h-screen overflow-x-hidden text-slate-100">
      <div className="absolute inset-0">
        <div className="h-full w-full bg-[#060a14]" />
      </div>
      <div className="absolute inset-0 opacity-25">
        <div className="h-full w-full bg-[radial-gradient(circle_at_top_left,_rgba(34,211,238,0.22),_transparent_60%)]" />
      </div>

      <div className="relative mx-auto w-full max-w-7xl px-3 pb-8 pt-4 sm:px-4 sm:pt-6 lg:px-8 xl:px-10">
        <header className="glass-card-strong mb-4 rounded-2xl p-4 sm:p-5">
          <p className="text-xs uppercase tracking-[0.35em] text-slate-400">Gestión operativa</p>
          <h1 className="font-display mt-1 text-2xl tracking-[0.14em] text-slate-100 md:text-3xl">CONDUCTORES Y RUTAS</h1>
          <p className="mt-2 text-sm text-slate-300">Registra conductores, asigna una de las 15 rutas definidas y conecta su operación con el dashboard.</p>
          <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
            <article className="glass-card rounded-xl border-0 p-3">
              <p className="text-xs uppercase tracking-[0.24em] text-slate-400">Total conductores</p>
              <p className="mt-1 text-2xl text-slate-100">{drivers.length}</p>
            </article>
            <article className="glass-card rounded-xl border-0 p-3">
              <p className="text-xs uppercase tracking-[0.24em] text-slate-400">Activos hoy</p>
              <p className="mt-1 text-2xl text-cyan-200">{activeToday}</p>
            </article>
            <article className="glass-card rounded-xl border-0 p-3">
              <p className="text-xs uppercase tracking-[0.24em] text-slate-400">En curso</p>
              <p className="mt-1 text-2xl text-cyan-200">{activeInCourse}</p>
            </article>
            <article className="glass-card rounded-xl border-0 p-3">
              <p className="text-xs uppercase tracking-[0.24em] text-slate-400">Bonos acreditados</p>
              <p className="mt-1 text-2xl text-emerald-200">{formatMXN(drivers.reduce((sum, driver) => sum + driver.rewards.bonusMXN, 0))}</p>
            </article>
          </div>
        </header>

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
          <main className="min-w-0 space-y-4">
            <section className="glass-card rounded-2xl p-3 sm:p-4">
              <h2 className="font-display text-lg tracking-[0.12em] text-slate-100">Alta de conductor</h2>
              <p className="mt-1 text-xs text-slate-400">Cada conductor nuevo se agrega al dashboard cuando su estado esté en curso.</p>

              <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
                <label className="space-y-1 text-xs text-slate-400">
                  Nombre completo
                  <input
                    value={form.fullName}
                    onChange={(event) => setForm((prev) => ({ ...prev, fullName: event.target.value }))}
                    className="glass-card w-full rounded-lg border border-slate-700/60 px-3 py-2 text-sm text-slate-100 outline-none focus:border-cyan-400"
                    placeholder="Ej. Andrea Escalante"
                  />
                </label>

                <label className="space-y-1 text-xs text-slate-400">
                  Licencia
                  <input
                    value={form.licenseNumber}
                    onChange={(event) => setForm((prev) => ({ ...prev, licenseNumber: event.target.value }))}
                    className="glass-card w-full rounded-lg border border-slate-700/60 px-3 py-2 text-sm text-slate-100 outline-none focus:border-cyan-400"
                    placeholder="CDMX-Z00-1234"
                  />
                </label>

                <label className="space-y-1 text-xs text-slate-400">
                  Teléfono
                  <input
                    value={form.phone}
                    onChange={(event) => setForm((prev) => ({ ...prev, phone: event.target.value }))}
                    className="glass-card w-full rounded-lg border border-slate-700/60 px-3 py-2 text-sm text-slate-100 outline-none focus:border-cyan-400"
                    placeholder="55 1234 5678"
                  />
                </label>

                <label className="space-y-1 text-xs text-slate-400">
                  Ruta diaria (15 predefinidas)
                  <select
                    value={form.routeId}
                    onChange={(event) => setForm((prev) => ({ ...prev, routeId: event.target.value }))}
                    className="glass-card w-full rounded-lg border border-slate-700/60 px-3 py-2 text-sm text-slate-100 outline-none focus:border-cyan-400"
                  >
                    {ROUTE_TEMPLATES.map((route) => (
                      <option key={route.id} value={route.id} className="bg-slate-900 text-slate-100">
                        {route.label}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="space-y-1 text-xs text-slate-400 md:col-span-2">
                  Fecha de cobertura
                  <input
                    type="date"
                    value={form.routeDateISO}
                    onChange={(event) => setForm((prev) => ({ ...prev, routeDateISO: event.target.value }))}
                    className="glass-card w-full rounded-lg border border-slate-700/60 px-3 py-2 text-sm text-slate-100 outline-none focus:border-cyan-400"
                  />
                </label>
              </div>

              <button
                type="button"
                onClick={handleSubmit}
                className="mt-4 inline-flex items-center gap-2 rounded-xl bg-[#00d4aa] px-4 py-2 text-sm font-semibold text-[#04131f] transition-colors hover:bg-[#37e3bf]"
              >
                <Plus className="h-4 w-4" /> Registrar y asignar ruta
              </button>
            </section>

            <section className="glass-card rounded-2xl p-3 sm:p-4">
              <h2 className="font-display text-lg tracking-[0.12em] text-slate-100">Registro de conductores</h2>
              <div className="mt-3 space-y-2">
                {drivers.map((driver) => (
                  <article key={driver.id} className="glass-card rounded-xl border-0 p-3">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-slate-100">{driver.fullName}</p>
                        <p className="text-xs text-slate-400">{driver.code} · Lic. {driver.licenseNumber}</p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <span className={`rounded-full border px-2 py-0.5 text-xs ${routeBadgeClasses(driver.routeId)}`}>
                          {routeLabel(driver.routeId)}
                        </span>
                        <span className={`rounded-full border px-2 py-0.5 text-xs ${statusStyle[driver.status]}`}>
                          {statusLabel[driver.status]}
                        </span>
                      </div>
                    </div>

                    <div className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-2">
                      <label className="space-y-1 text-xs text-slate-500">
                        Reasignar ruta
                        <select
                          value={driver.routeId}
                          onChange={(event) => onAssignRoute(driver.id, event.target.value, driver.routeDateISO)}
                          className="glass-card w-full rounded-lg border border-slate-700/60 px-2.5 py-2 text-xs text-slate-100 outline-none focus:border-cyan-400"
                        >
                          {ROUTE_TEMPLATES.map((route) => (
                            <option key={route.id} value={route.id} className="bg-slate-900 text-slate-100">{route.label}</option>
                          ))}
                        </select>
                      </label>

                      <label className="space-y-1 text-xs text-slate-500">
                        Estado
                        <select
                          value={driver.status}
                          onChange={(event) => onUpdateDriverStatus(driver.id, event.target.value as DriverStatus)}
                          className="glass-card w-full rounded-lg border border-slate-700/60 px-2.5 py-2 text-xs text-slate-100 outline-none focus:border-cyan-400"
                        >
                          <option value="pendiente" className="bg-slate-900 text-slate-100">Pendiente</option>
                          <option value="en_curso" className="bg-slate-900 text-slate-100">En curso</option>
                          <option value="completada" className="bg-slate-900 text-slate-100">Completada</option>
                        </select>
                      </label>
                    </div>

                    <button
                      type="button"
                      onClick={() => setSelectedDriverId(driver.id)}
                      className="mt-3 inline-flex items-center gap-2 rounded-lg border border-slate-700/70 bg-slate-900/35 px-3 py-1.5 text-xs text-slate-200 transition-colors hover:border-cyan-400/60 hover:text-cyan-100"
                    >
                      <IdCard className="h-3.5 w-3.5" /> Ver perfil
                    </button>
                  </article>
                ))}
              </div>
            </section>
          </main>

          <aside className="min-w-0">
            <section className="glass-card rounded-2xl p-3 sm:p-4">
              <h2 className="font-display text-lg tracking-[0.12em] text-slate-100">Perfil del conductor</h2>
              {!selectedDriver ? (
                <p className="mt-3 text-sm text-slate-400">Aún no hay conductores registrados.</p>
              ) : (
                <>
                  <article className="glass-card mt-3 rounded-xl border-0 p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-base font-semibold text-slate-100">{selectedDriver.fullName}</p>
                        <p className="text-xs text-slate-400">{selectedDriver.code}</p>
                      </div>
                      <span className={`rounded-full border px-2 py-0.5 text-xs ${routeBadgeClasses(selectedDriver.routeId)}`}>
                        {routeLabel(selectedDriver.routeId)}
                      </span>
                    </div>

                    <div className="mt-3 space-y-2 text-xs text-slate-300">
                      <p className="flex items-center gap-2"><IdCard className="h-3.5 w-3.5 text-slate-400" /> Licencia: {selectedDriver.licenseNumber}</p>
                      <p className="flex items-center gap-2"><Phone className="h-3.5 w-3.5 text-slate-400" /> Contacto: {selectedDriver.phone}</p>
                      <p className="flex items-center gap-2"><CalendarDays className="h-3.5 w-3.5 text-slate-400" /> Ruta del día: {selectedDriver.routeDateISO}</p>
                      <p className="flex items-center gap-2"><MapPin className="h-3.5 w-3.5 text-slate-400" /> {routeDescription(selectedDriver.routeId)}</p>
                      <p className="flex items-center gap-2"><Truck className="h-3.5 w-3.5 text-slate-400" /> Estado: {statusLabel[selectedDriver.status]}</p>
                    </div>
                  </article>

                  <article className="glass-card mt-3 rounded-xl border-0 p-3">
                    <h3 className="text-xs uppercase tracking-[0.24em] text-slate-400">Evaluación saludable</h3>
                    <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
                      <div className="rounded-lg border border-slate-700/60 bg-slate-900/35 p-2.5">
                        <p className="text-[11px] text-slate-400">Rutas saludables</p>
                        <p className="mt-1 text-xl text-cyan-200">{selectedDriver.performance.healthyRouteRate}%</p>
                      </div>
                      <div className="rounded-lg border border-slate-700/60 bg-slate-900/35 p-2.5">
                        <p className="text-[11px] text-slate-400">Puntualidad</p>
                        <p className="mt-1 text-xl text-slate-100">{selectedDriver.performance.punctualityRate}%</p>
                      </div>
                      <div className="rounded-lg border border-slate-700/60 bg-slate-900/35 p-2.5">
                        <p className="text-[11px] text-slate-400">Eco conducción</p>
                        <p className="mt-1 text-xl text-emerald-200">{selectedDriver.performance.ecoDriveRate}%</p>
                      </div>
                    </div>

                    <p className="mt-3 flex items-center gap-2 text-sm text-slate-300">
                      <Star className="h-4 w-4 text-amber-300" />
                      Nivel de desempeño: <span className="font-semibold text-slate-100">{scoreToTier(selectedDriver.performance.healthyRouteRate)}</span>
                    </p>
                  </article>

                  <article className="glass-card mt-3 rounded-xl border-0 p-3">
                    <h3 className="text-xs uppercase tracking-[0.24em] text-slate-400">Recompensas acreditadas</h3>
                    <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
                      <div className="rounded-lg border border-emerald-500/35 bg-emerald-500/10 p-3">
                        <p className="flex items-center gap-2 text-xs text-emerald-200"><Gift className="h-4 w-4" /> Despensas</p>
                        <p className="mt-1 text-2xl text-emerald-100">{selectedDriver.rewards.pantryCredits}</p>
                      </div>
                      <div className="rounded-lg border border-cyan-500/35 bg-cyan-500/10 p-3">
                        <p className="flex items-center gap-2 text-xs text-cyan-200"><Award className="h-4 w-4" /> Bono económico</p>
                        <p className="mt-1 text-2xl text-cyan-100">{formatMXN(selectedDriver.rewards.bonusMXN)}</p>
                      </div>
                    </div>
                  </article>

                  <article className="glass-card mt-3 rounded-xl border-0 p-3">
                    <h3 className="text-xs uppercase tracking-[0.24em] text-slate-400">Historial reciente</h3>
                    <div className="mt-2 space-y-2">
                      {selectedDriver.history.slice(0, 5).map((entry) => (
                        <div key={entry.id} className="rounded-lg border border-slate-700/70 bg-slate-900/35 p-2.5 text-xs">
                          <p className="flex items-center justify-between text-slate-200">
                            <span>{entry.dateISO}</span>
                            <span className={`rounded-full border px-2 py-0.5 ${routeBadgeClasses(entry.routeId)}`}>{routeLabel(entry.routeId)}</span>
                          </p>
                          <p className="mt-1 flex items-center gap-2 text-slate-400">
                            <ShieldCheck className="h-3.5 w-3.5" />
                            Saludable {entry.healthyScore}% · Puntualidad {entry.punctuality}% · ECO {entry.ecoScore}%
                          </p>
                        </div>
                      ))}
                    </div>
                  </article>
                </>
              )}
            </section>
          </aside>
        </div>
      </div>
    </section>
  )
}
