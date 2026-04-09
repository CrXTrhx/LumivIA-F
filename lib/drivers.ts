export type RouteKey = "traditional" | "safe" | "express"
export type DriverStatus = "assigned" | "in_progress" | "completed"

export interface DriverHistoryEntry {
  id: string
  dateISO: string
  routeKey: RouteKey
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
  routeKey: RouteKey
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
  routeKey: RouteKey
  routeDateISO: string
}

export const DRIVERS_STORAGE_KEY = "lumivia:drivers:v1"

export const ROUTE_DETAILS: Record<RouteKey, { label: string; description: string }> = {
  safe: {
    label: "Ruta segura",
    description: "Menor riesgo hidrometeorológico y mejor trazabilidad.",
  },
  traditional: {
    label: "Ruta tradicional",
    description: "Trayecto estándar de operación diaria.",
  },
  express: {
    label: "Ruta express",
    description: "Enfoque en velocidad y ventanas de entrega.",
  },
}

const DRIVER_COLORS = ["#60a5fa", "#22d3ee", "#94a3b8", "#34d399", "#c4b5fd", "#fb7185"]

const routeBaseScore: Record<RouteKey, { healthy: number; punctuality: number; eco: number }> = {
  safe: { healthy: 90, punctuality: 86, eco: 91 },
  traditional: { healthy: 74, punctuality: 81, eco: 72 },
  express: { healthy: 83, punctuality: 89, eco: 79 },
}

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

function buildTripEntry(routeKey: RouteKey, dateISO: string): DriverHistoryEntry {
  const base = routeBaseScore[routeKey]
  const healthyScore = clamp(base.healthy + randomJitter(9), 52, 99)
  const punctuality = clamp(base.punctuality + randomJitter(8), 58, 99)
  const ecoScore = clamp(base.eco + randomJitter(10), 54, 99)
  const pantryGranted = healthyScore >= 88 && ecoScore >= 84
  const bonusMXN = healthyScore >= 90 ? 650 : healthyScore >= 84 ? 420 : healthyScore >= 78 ? 260 : 0

  return {
    id: `${dateISO}-${Math.random().toString(36).slice(2, 10)}`,
    dateISO,
    routeKey,
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
  const totalHealthy = history.reduce((sum, item) => sum + item.healthyScore, 0)
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

function applyRouteAssignment(driver: DriverRecord, routeKey: RouteKey, routeDateISO: string): DriverRecord {
  const newTrip = buildTripEntry(routeKey, routeDateISO)
  const updatedHistory = [newTrip, ...driver.history].slice(0, 60)
  const summarized = summarizeHistory(updatedHistory)

  return {
    ...driver,
    routeKey,
    routeDateISO,
    status: "in_progress",
    history: updatedHistory,
    performance: summarized.performance,
    rewards: summarized.rewards,
  }
}

export function createDriverRecord(input: RegisterDriverInput, existingDrivers: DriverRecord[]): DriverRecord {
  const trimmedName = input.fullName.trim()
  const trimmedLicense = input.licenseNumber.trim().toUpperCase()
  const trimmedPhone = input.phone.trim()

  const baseDriver: DriverRecord = {
    id: `drv-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    code: nextDriverCode(existingDrivers),
    fullName: trimmedName,
    licenseNumber: trimmedLicense,
    phone: trimmedPhone,
    unitColor: DRIVER_COLORS[existingDrivers.length % DRIVER_COLORS.length],
    routeKey: input.routeKey,
    routeDateISO: input.routeDateISO,
    status: "assigned",
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

  return applyRouteAssignment(baseDriver, input.routeKey, input.routeDateISO)
}

export function assignRouteToDriver(driver: DriverRecord, routeKey: RouteKey, routeDateISO: string): DriverRecord {
  return applyRouteAssignment(driver, routeKey, routeDateISO)
}

export function updateDriverStatus(driver: DriverRecord, status: DriverStatus): DriverRecord {
  return {
    ...driver,
    status,
  }
}

export function getActiveDriversForDate(drivers: DriverRecord[], dateISO = getTodayISODate()): DriverRecord[] {
  return drivers.filter((driver) => driver.routeDateISO === dateISO && driver.status !== "completed")
}

export function parseStoredDrivers(raw: string | null): DriverRecord[] | null {
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw) as DriverRecord[]
    if (!Array.isArray(parsed)) return null

    return parsed.filter((item) => {
      return (
        typeof item?.id === "string" &&
        typeof item?.code === "string" &&
        typeof item?.fullName === "string" &&
        typeof item?.licenseNumber === "string" &&
        typeof item?.phone === "string" &&
        typeof item?.unitColor === "string" &&
        (item?.routeKey === "safe" || item?.routeKey === "traditional" || item?.routeKey === "express") &&
        typeof item?.routeDateISO === "string" &&
        (item?.status === "assigned" || item?.status === "in_progress" || item?.status === "completed") &&
        Array.isArray(item?.history) &&
        typeof item?.performance?.healthyRouteRate === "number" &&
        typeof item?.rewards?.bonusMXN === "number"
      )
    })
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
    routeKey: "safe",
    routeDateISO: getTodayISODate(),
    status: "in_progress",
    performance: {
      healthyRouteRate: 92,
      punctualityRate: 88,
      ecoDriveRate: 90,
      completedTrips: 24,
      healthyTrips: 22,
    },
    rewards: {
      pantryCredits: 8,
      bonusMXN: 14500,
      lifetimeBonusMXN: 14500,
    },
    history: [
      {
        id: "seed-h1",
        dateISO: getTodayISODate(),
        routeKey: "safe",
        healthyScore: 93,
        punctuality: 87,
        ecoScore: 91,
        pantryGranted: true,
        bonusMXN: 650,
      },
    ],
    createdAt: new Date().toISOString(),
  },
  {
    id: "drv-seed-311",
    code: "LUM-311",
    fullName: "Carlos Juarez",
    licenseNumber: "CDMX-B11-2041",
    phone: "55 6587 3210",
    unitColor: "#cbd5e1",
    routeKey: "traditional",
    routeDateISO: getTodayISODate(),
    status: "in_progress",
    performance: {
      healthyRouteRate: 78,
      punctualityRate: 85,
      ecoDriveRate: 80,
      completedTrips: 21,
      healthyTrips: 16,
    },
    rewards: {
      pantryCredits: 5,
      bonusMXN: 9800,
      lifetimeBonusMXN: 9800,
    },
    history: [
      {
        id: "seed-h2",
        dateISO: getTodayISODate(),
        routeKey: "traditional",
        healthyScore: 79,
        punctuality: 86,
        ecoScore: 78,
        pantryGranted: false,
        bonusMXN: 260,
      },
    ],
    createdAt: new Date().toISOString(),
  },
  {
    id: "drv-seed-187",
    code: "LUM-187",
    fullName: "Renata Solis",
    licenseNumber: "CDMX-C07-1722",
    phone: "55 7712 9981",
    unitColor: "#93c5fd",
    routeKey: "express",
    routeDateISO: getTodayISODate(),
    status: "in_progress",
    performance: {
      healthyRouteRate: 86,
      punctualityRate: 91,
      ecoDriveRate: 84,
      completedTrips: 19,
      healthyTrips: 16,
    },
    rewards: {
      pantryCredits: 6,
      bonusMXN: 11200,
      lifetimeBonusMXN: 11200,
    },
    history: [
      {
        id: "seed-h3",
        dateISO: getTodayISODate(),
        routeKey: "express",
        healthyScore: 88,
        punctuality: 90,
        ecoScore: 84,
        pantryGranted: true,
        bonusMXN: 420,
      },
    ],
    createdAt: new Date().toISOString(),
  },
]
