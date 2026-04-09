export interface OfficialSourceHealth {
  name: "Climatiq" | "INEGI" | "Open-Meteo"
  connected: boolean
  precisionPct: number
  latencyMs: number
}

export interface GovernanceSimulationState {
  activeVehicles: number
  avoidedIncidentsToday: number
  delayAvoidedMin: number
  monthlyCo2SavedKg: number
  totalTripsToday: number
  greenTripsToday: number
  traceabilityPct: number
  zeroEmissionViolations: number
  contingencyViolations: number
  officialSources: OfficialSourceHealth[]
}

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value))

export const INITIAL_GOVERNANCE_STATE: GovernanceSimulationState = {
  activeVehicles: 24,
  avoidedIncidentsToday: 12,
  delayAvoidedMin: 186,
  monthlyCo2SavedKg: 1548,
  totalTripsToday: 74,
  greenTripsToday: 59,
  traceabilityPct: 98,
  zeroEmissionViolations: 0,
  contingencyViolations: 0,
  officialSources: [
    { name: "Climatiq", connected: true, precisionPct: 99, latencyMs: 320 },
    { name: "INEGI", connected: true, precisionPct: 98, latencyMs: 410 },
    { name: "Open-Meteo", connected: true, precisionPct: 99, latencyMs: 280 },
  ],
}

export function nextGovernanceState(prev: GovernanceSimulationState): GovernanceSimulationState {
  const activeVehicles = clamp(prev.activeVehicles + (Math.random() > 0.52 ? 1 : -1), 14, 38)
  const completedTrips = Math.random() > 0.62 ? 1 : 0
  const rerouteEvent = Math.random() > 0.66

  const zeroEmissionViolations =
    Math.random() > 0.95 ? clamp(prev.zeroEmissionViolations + 1, 0, 2) : Math.max(0, prev.zeroEmissionViolations - 1)
  const contingencyViolations =
    Math.random() > 0.97 ? clamp(prev.contingencyViolations + 1, 0, 1) : Math.max(0, prev.contingencyViolations - 1)

  const officialSources = prev.officialSources.map((source) => {
    const outage = Math.random() < 0.03
    const recovered = Math.random() < 0.45
    const connected = source.connected ? !outage : recovered
    const precisionDrift = connected ? (Math.random() > 0.5 ? 1 : -1) : -2
    const latencyDrift = connected ? (Math.random() > 0.5 ? 12 : -10) : 30

    return {
      ...source,
      connected,
      precisionPct: clamp(source.precisionPct + precisionDrift, 92, 100),
      latencyMs: clamp(source.latencyMs + latencyDrift, 180, 980),
    }
  })

  const unhealthySources = officialSources.filter((source) => !source.connected || source.precisionPct < 95).length
  const compliancePenalty = zeroEmissionViolations + contingencyViolations
  const traceabilityDrift = unhealthySources > 0 || compliancePenalty > 0 ? -1 : 1

  return {
    activeVehicles,
    totalTripsToday: prev.totalTripsToday + completedTrips,
    avoidedIncidentsToday: prev.avoidedIncidentsToday + (rerouteEvent ? 1 : 0),
    delayAvoidedMin: prev.delayAvoidedMin + (rerouteEvent ? Math.floor(6 + Math.random() * 7) : 0),
    monthlyCo2SavedKg: prev.monthlyCo2SavedKg + (rerouteEvent ? Math.floor(8 + Math.random() * 9) : 0),
    greenTripsToday: prev.greenTripsToday + (completedTrips && Math.random() > 0.2 ? 1 : 0),
    traceabilityPct: clamp(prev.traceabilityPct + traceabilityDrift, 93, 100),
    zeroEmissionViolations,
    contingencyViolations,
    officialSources,
  }
}
