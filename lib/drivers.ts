export type DriverStatus = "pendiente" | "en_curso" | "completada"

export interface DriverRouteTemplate {
  id: string
  label: string
  description: string
  color: string
  waypoints: [number, number][]
}

export interface DriverHistoryEntry {
  id: string
  dateISO: string
  routeId: string
  healthyScore: number
  punctuality: number
  ecoScore: number
  pantryGranted: boolean
  bonusMXN: number
}

export interface DriverPerformanceState {
  healthyRouteRate: number
  punctualityRate: number
  ecoDriveRate: number
  completedTrips: number
  healthyTrips: number
}

export interface DriverRewardsState {
  pantryCredits: number
  bonusMXN: number
  lifetimeBonusMXN: number
}

export interface DriverRecord {
  id: string
  code: string
  fullName: string
  licenseNumber: string
  phone: string
  unitColor: string
  routeId: string
  routeDateISO: string
  status: DriverStatus
  performance: DriverPerformanceState
  rewards: DriverRewardsState
  history: DriverHistoryEntry[]
  createdAt: string
}

export interface RegisterDriverInput {
  fullName: string
  licenseNumber: string
  phone: string
  routeId: string
  routeDateISO: string
}

export const DRIVERS_STORAGE_KEY = "lumivia:drivers:v2"

const ORIGIN: [number, number] = [-99.1603, 19.4188]

export const ROUTE_TEMPLATES: DriverRouteTemplate[] = [
  { id: "rt-01", label: "Ruta Norte 1", description: "Centro a Polanco por corredor norte", color: "#60a5fa", waypoints: [ORIGIN, [-99.163, 19.427], [-99.169, 19.438], [-99.176, 19.449]] },
  { id: "rt-02", label: "Ruta Norte 2", description: "Centro a Anzures con desvio controlado", color: "#38bdf8", waypoints: [ORIGIN, [-99.154, 19.425], [-99.149, 19.434], [-99.143, 19.445]] },
  { id: "rt-03", label: "Ruta Noroeste 1", description: "Centro a Reforma poniente", color: "#22d3ee", waypoints: [ORIGIN, [-99.168, 19.422], [-99.178, 19.429], [-99.188, 19.438]] },
  { id: "rt-04", label: "Ruta Noroeste 2", description: "Centro a Tacuba por ejes primarios", color: "#67e8f9", waypoints: [ORIGIN, [-99.171, 19.415], [-99.183, 19.416], [-99.194, 19.419]] },
  { id: "rt-05", label: "Ruta Oeste 1", description: "Centro a Condesa por vialidad arbolada", color: "#34d399", waypoints: [ORIGIN, [-99.168, 19.412], [-99.178, 19.408], [-99.188, 19.404]] },
  { id: "rt-06", label: "Ruta Oeste 2", description: "Centro a Roma norte", color: "#10b981", waypoints: [ORIGIN, [-99.164, 19.408], [-99.169, 19.401], [-99.176, 19.395]] },
  { id: "rt-07", label: "Ruta Suroeste 1", description: "Centro a Del Valle", color: "#86efac", waypoints: [ORIGIN, [-99.158, 19.408], [-99.161, 19.397], [-99.166, 19.385]] },
  { id: "rt-08", label: "Ruta Suroeste 2", description: "Centro a Coyoacan por eje sur", color: "#4ade80", waypoints: [ORIGIN, [-99.152, 19.405], [-99.151, 19.393], [-99.151, 19.379]] },
  { id: "rt-09", label: "Ruta Sur 1", description: "Centro a Viaducto sur", color: "#fbbf24", waypoints: [ORIGIN, [-99.147, 19.409], [-99.142, 19.398], [-99.137, 19.388]] },
  { id: "rt-10", label: "Ruta Sur 2", description: "Centro a Portales", color: "#f59e0b", waypoints: [ORIGIN, [-99.142, 19.414], [-99.134, 19.406], [-99.127, 19.397]] },
  { id: "rt-11", label: "Ruta Sureste 1", description: "Centro a Iztacalco", color: "#fb7185", waypoints: [ORIGIN, [-99.149, 19.422], [-99.139, 19.425], [-99.126, 19.428]] },
  { id: "rt-12", label: "Ruta Sureste 2", description: "Centro a Avena industrial", color: "#f43f5e", waypoints: [ORIGIN, [-99.152, 19.427], [-99.143, 19.435], [-99.132, 19.443]] },
  { id: "rt-13", label: "Ruta Este 1", description: "Centro a aeropuerto por vialidad este", color: "#c084fc", waypoints: [ORIGIN, [-99.146, 19.431], [-99.134, 19.438], [-99.121, 19.446]] },
  { id: "rt-14", label: "Ruta Este 2", description: "Centro a Balbuena", color: "#a78bfa", waypoints: [ORIGIN, [-99.154, 19.434], [-99.145, 19.442], [-99.136, 19.452]] },
  { id: "rt-15", label: "Ruta Noreste", description: "Centro a corredor norte-este", color: "#93c5fd", waypoints: [ORIGIN, [-99.158, 19.429], [-99.157, 19.441], [-99.156, 19.454]] },
]

export const ROUTE_TEMPLATE_BY_ID = Object.fromEntries(ROUTE_TEMPLATES.map((route) => [route.id, route])) as Record<string, DriverRouteTemplate>

const DRIVER_COLORS = ["#60a5fa", "#22d3ee", "#94a3b8", "#34d399", "#c4b5fd", "#fb7185"]

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value))

export function getTodayISODate(): string {
  return new Date().toISOString().slice(0, 10)
}

function toInt(value: string): number {
  const parsed = Number.parseInt(value, 10)
  return Number.isFinite(parsed) ? parsed : 0
}

function nextDriverCode(existing: DriverRecord[]): string {
  const maxCode = existing.reduce((max, driver) => {
    const codeNum = toInt(driver.code.replace(/[^0-9]/g, ""))
    return Math.max(max, codeNum)
  }, 186)
  return `LUM-${String(maxCode + 1).padStart(3, "0")}`
}

function randomJitter(range: number): number {
  return Math.round((Math.random() * 2 - 1) * range)
}

function buildTripEntry(routeId: string, dateISO: string): DriverHistoryEntry {
  const routeIdx = ROUTE_TEMPLATES.findIndex((route) => route.id === routeId)
  const healthyBase = routeIdx >= 0 ? 82 + ((routeIdx % 5) - 2) * 2 : 82
  const punctualityBase = routeIdx >= 0 ? 84 + ((routeIdx % 4) - 1) * 2 : 84
  const ecoBase = routeIdx >= 0 ? 80 + ((routeIdx % 3) - 1) * 3 : 80
  const healthyScore = clamp(healthyBase + randomJitter(8), 52, 99)
  const punctuality = clamp(punctualityBase + randomJitter(8), 58, 99)
  const ecoScore = clamp(ecoBase + randomJitter(10), 54, 99)
  const pantryGranted = healthyScore >= 88 && ecoScore >= 84
  const bonusMXN = healthyScore >= 90 ? 650 : healthyScore >= 84 ? 420 : healthyScore >= 78 ? 260 : 0

  return {
    id: `${dateISO}-${Math.random().toString(36).slice(2, 10)}`,
    dateISO,
    routeId,
    healthyScore,
    punctuality,
    ecoScore,
    pantryGranted,
    bonusMXN,
  }
}

function summarizeHistory(history: DriverHistoryEntry[]): {
  performance: DriverPerformanceState
  rewards: DriverRewardsState
} {
  const completedTrips = history.length
  const healthyTrips = history.filter((item) => item.healthyScore >= 80).length
  const totalPunctuality = history.reduce((sum, item) => sum + item.punctuality, 0)
  const totalEco = history.reduce((sum, item) => sum + item.ecoScore, 0)
  const pantryCredits = history.filter((item) => item.pantryGranted).length
  const lifetimeBonusMXN = history.reduce((sum, item) => sum + item.bonusMXN, 0)

  return {
    performance: {
      healthyRouteRate: completedTrips ? Math.round((healthyTrips / completedTrips) * 100) : 0,
      punctualityRate: completedTrips ? Math.round(totalPunctuality / completedTrips) : 0,
      ecoDriveRate: completedTrips ? Math.round(totalEco / completedTrips) : 0,
      completedTrips,
      healthyTrips,
    },
    rewards: {
      pantryCredits,
      bonusMXN: lifetimeBonusMXN,
      lifetimeBonusMXN,
    },
  }
}

function normalizeRouteId(routeId: string): string {
  if (ROUTE_TEMPLATE_BY_ID[routeId]) return routeId
  const fallback: Record<string, string> = {
    safe: "rt-01",
    traditional: "rt-05",
    express: "rt-11",
  }
  return fallback[routeId] || ROUTE_TEMPLATES[0].id
}

function applyRouteAssignment(driver: DriverRecord, routeId: string, routeDateISO: string): DriverRecord {
  const normalizedRouteId = normalizeRouteId(routeId)
  const newTrip = buildTripEntry(normalizedRouteId, routeDateISO)
  const updatedHistory = [newTrip, ...driver.history].slice(0, 60)
  const summarized = summarizeHistory(updatedHistory)

  return {
    ...driver,
    routeId: normalizedRouteId,
    routeDateISO,
    status: "en_curso",
    history: updatedHistory,
    performance: summarized.performance,
    rewards: summarized.rewards,
  }
}

export function createDriverRecord(input: RegisterDriverInput, existingDrivers: DriverRecord[]): DriverRecord {
  const trimmedName = input.fullName.trim()
  const trimmedLicense = input.licenseNumber.trim().toUpperCase()
  const trimmedPhone = input.phone.trim()
  const normalizedRouteId = normalizeRouteId(input.routeId)

  const baseDriver: DriverRecord = {
    id: `drv-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    code: nextDriverCode(existingDrivers),
    fullName: trimmedName,
    licenseNumber: trimmedLicense,
    phone: trimmedPhone,
    unitColor: DRIVER_COLORS[existingDrivers.length % DRIVER_COLORS.length],
    routeId: normalizedRouteId,
    routeDateISO: input.routeDateISO,
    status: "pendiente",
    performance: {
      healthyRouteRate: 0,
      punctualityRate: 0,
      ecoDriveRate: 0,
      completedTrips: 0,
      healthyTrips: 0,
    },
    rewards: {
      pantryCredits: 0,
      bonusMXN: 0,
      lifetimeBonusMXN: 0,
    },
    history: [],
    createdAt: new Date().toISOString(),
  }

  return applyRouteAssignment(baseDriver, normalizedRouteId, input.routeDateISO)
}

export function assignRouteToDriver(driver: DriverRecord, routeId: string, routeDateISO: string): DriverRecord {
  return applyRouteAssignment(driver, routeId, routeDateISO)
}

export function updateDriverStatus(driver: DriverRecord, status: DriverStatus): DriverRecord {
  const normalizedStatus =
    status === "assigned"
      ? "pendiente"
      : status === "in_progress"
        ? "en_curso"
        : status === "completed"
          ? "completada"
          : status
  return {
    ...driver,
    status: normalizedStatus,
  }
}

export function parseStoredDrivers(raw: string | null): DriverRecord[] | null {
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw) as any[]
    if (!Array.isArray(parsed)) return null

    const migrated = parsed
      .filter((item) => item && typeof item === "object")
      .map((item) => {
        const routeId = normalizeRouteId(item.routeId || item.routeKey)
        const statusRaw = item.status
        const status: DriverStatus =
          statusRaw === "assigned"
            ? "pendiente"
            : statusRaw === "in_progress"
              ? "en_curso"
              : statusRaw === "completed"
                ? "completada"
                : statusRaw === "pendiente" || statusRaw === "en_curso" || statusRaw === "completada"
                  ? statusRaw
                  : "pendiente"

        const history = Array.isArray(item.history)
          ? item.history.map((entry: any) => ({
              id: typeof entry?.id === "string" ? entry.id : `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
              dateISO: typeof entry?.dateISO === "string" ? entry.dateISO : getTodayISODate(),
              routeId: normalizeRouteId(entry?.routeId || entry?.routeKey || routeId),
              healthyScore: Number.isFinite(entry?.healthyScore) ? entry.healthyScore : 80,
              punctuality: Number.isFinite(entry?.punctuality) ? entry.punctuality : 82,
              ecoScore: Number.isFinite(entry?.ecoScore) ? entry.ecoScore : 80,
              pantryGranted: Boolean(entry?.pantryGranted),
              bonusMXN: Number.isFinite(entry?.bonusMXN) ? entry.bonusMXN : 0,
            }))
          : []

        const summarized = summarizeHistory(history)

        return {
          id: typeof item.id === "string" ? item.id : `drv-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          code: typeof item.code === "string" ? item.code : nextDriverCode([]),
          fullName: typeof item.fullName === "string" ? item.fullName : "Conductor",
          licenseNumber: typeof item.licenseNumber === "string" ? item.licenseNumber : "N/A",
          phone: typeof item.phone === "string" ? item.phone : "N/A",
          unitColor: typeof item.unitColor === "string" ? item.unitColor : DRIVER_COLORS[0],
          routeId,
          routeDateISO: typeof item.routeDateISO === "string" ? item.routeDateISO : getTodayISODate(),
          status,
          performance: summarized.performance,
          rewards: summarized.rewards,
          history,
          createdAt: typeof item.createdAt === "string" ? item.createdAt : new Date().toISOString(),
        } as DriverRecord
      })

    return migrated
  } catch {
    return null
  }
}

export const INITIAL_DRIVERS: DriverRecord[] = [
  {
    id: "drv-seed-204",
    code: "LUM-204",
    fullName: "Alicia Medina",
    licenseNumber: "CDMX-A23-1987",
    phone: "55 1203 4498",
    unitColor: "#94a3b8",
    routeId: "rt-01",
    routeDateISO: getTodayISODate(),
    status: "en_curso",
    performance: { healthyRouteRate: 92, punctualityRate: 88, ecoDriveRate: 90, completedTrips: 24, healthyTrips: 22 },
    rewards: { pantryCredits: 8, bonusMXN: 14500, lifetimeBonusMXN: 14500 },
    history: [{ id: "seed-h1", dateISO: getTodayISODate(), routeId: "rt-01", healthyScore: 93, punctuality: 87, ecoScore: 91, pantryGranted: true, bonusMXN: 650 }],
    createdAt: new Date().toISOString(),
  },
  {
    id: "drv-seed-311",
    code: "LUM-311",
    fullName: "Carlos Juarez",
    licenseNumber: "CDMX-B11-2041",
    phone: "55 6587 3210",
    unitColor: "#cbd5e1",
    routeId: "rt-05",
    routeDateISO: getTodayISODate(),
    status: "en_curso",
    performance: { healthyRouteRate: 78, punctualityRate: 85, ecoDriveRate: 80, completedTrips: 21, healthyTrips: 16 },
    rewards: { pantryCredits: 5, bonusMXN: 9800, lifetimeBonusMXN: 9800 },
    history: [{ id: "seed-h2", dateISO: getTodayISODate(), routeId: "rt-05", healthyScore: 79, punctuality: 86, ecoScore: 78, pantryGranted: false, bonusMXN: 260 }],
    createdAt: new Date().toISOString(),
  },
  {
    id: "drv-seed-187",
    code: "LUM-187",
    fullName: "Renata Solis",
    licenseNumber: "CDMX-C07-1722",
    phone: "55 7712 9981",
    unitColor: "#93c5fd",
    routeId: "rt-11",
    routeDateISO: getTodayISODate(),
    status: "en_curso",
    performance: { healthyRouteRate: 86, punctualityRate: 91, ecoDriveRate: 84, completedTrips: 19, healthyTrips: 16 },
    rewards: { pantryCredits: 6, bonusMXN: 11200, lifetimeBonusMXN: 11200 },
    history: [{ id: "seed-h3", dateISO: getTodayISODate(), routeId: "rt-11", healthyScore: 88, punctuality: 90, ecoScore: 84, pantryGranted: true, bonusMXN: 420 }],
    createdAt: new Date().toISOString(),
  },
]
