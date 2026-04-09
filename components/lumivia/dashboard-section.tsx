"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import mapboxgl from "mapbox-gl"
import "mapbox-gl/dist/mapbox-gl.css"
import {
  Activity,
  Car,
  Clock3,
  MapPin,
  ShieldCheck,
  Timer,
  TreePine,
  Truck,
} from "lucide-react"
import { Bar, BarChart, Cell, Line, LineChart, Pie, PieChart, XAxis, YAxis } from "recharts"
import { INITIAL_GOVERNANCE_STATE, nextGovernanceState } from "@/lib/dashboard-simulator"
import { AbstractBackground } from "@/components/ui/abstract-background"
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart"

const DASHBOARD_MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN_DASHBOARD || ""

type Coordinate = [number, number]
type RouteKey = "traditional" | "safe" | "express"
type CongestionLevel = "unknown" | "low" | "moderate" | "heavy" | "severe"

const mapCenter: Coordinate = [-99.1603, 19.4188]

const fallbackTraditionalRoute: Coordinate[] = [
  [-99.1762, 19.4341],
  [-99.1695, 19.4302],
  [-99.1642, 19.4276],
  [-99.1601, 19.4242],
  [-99.1568, 19.4201],
  [-99.1524, 19.4153],
  [-99.1468, 19.4071],
]

const fallbackSafeRoute: Coordinate[] = [
  [-99.1698, 19.4381],
  [-99.1652, 19.4362],
  [-99.1603, 19.4334],
  [-99.1549, 19.4289],
  [-99.1506, 19.4238],
  [-99.1471, 19.4175],
  [-99.1438, 19.4106],
  [-99.1412, 19.4044],
]

const fallbackExpressRoute: Coordinate[] = [
  [-99.1814, 19.4288],
  [-99.1767, 19.4264],
  [-99.1719, 19.4222],
  [-99.1663, 19.4181],
  [-99.1608, 19.4144],
  [-99.1551, 19.4097],
  [-99.1497, 19.4064],
  [-99.1445, 19.4037],
]

const routeWaypoints: Record<RouteKey, Coordinate[]> = {
  traditional: fallbackTraditionalRoute,
  safe: fallbackSafeRoute,
  express: fallbackExpressRoute,
}

const hazardEvents = [
  {
    id: "flood-1",
    title: "Inundacion detectada",
    detail: "Anomalia hidrica en ruta tradicional.",
    coords: [-99.1609, 19.4239] as [number, number],
    color: "#f59e0b",
  },
  {
    id: "traffic-1",
    title: "Congestion extrema",
    detail: "Velocidad media por debajo de 8 km/h.",
    coords: [-99.1578, 19.4206] as [number, number],
    color: "#ef4444",
  },
]

const carProfiles = [
  { id: "LUM-204", color: "#94a3b8", speed: 0.036, start: 0 },
  { id: "LUM-311", color: "#cbd5e1", speed: 0.03, start: 0 },
  { id: "LUM-187", color: "#93c5fd", speed: 0.028, start: 0 },
]

const vehicleRouteAssignments: RouteKey[] = ["safe", "traditional", "express"]
const CAR_HEADING_OFFSET = -90

const mapboxDarkStyle = "mapbox://styles/mapbox/dark-v11"

const openStreetMapStyle: mapboxgl.StyleSpecification = {
  version: 8,
  sources: {
    osm: {
      type: "raster",
      tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
      tileSize: 256,
      attribution: "© OpenStreetMap contributors",
    },
  },
  layers: [{ id: "osm-base", type: "raster", source: "osm" }],
}

function add3DBuildingsLayer(map: mapboxgl.Map) {
  const style = map.getStyle()
  if (!style?.sources || !("composite" in style.sources)) return

  const existingLayers = style.layers || []
  const labelLayer = existingLayers.find((layer) => layer.type === "symbol" && layer.layout && "text-field" in layer.layout)

  if (map.getLayer("3d-buildings")) return
  map.addLayer(
    {
      id: "3d-buildings",
      source: "composite",
      "source-layer": "building",
      filter: ["==", ["get", "extrude"], "true"],
      type: "fill-extrusion",
      minzoom: 13,
      paint: {
        "fill-extrusion-color": "#1f2937",
        "fill-extrusion-height": ["interpolate", ["linear"], ["zoom"], 13, 0, 16, ["get", "height"]],
        "fill-extrusion-base": ["interpolate", ["linear"], ["zoom"], 13, 0, 16, ["get", "min_height"]],
        "fill-extrusion-opacity": 0.66,
      },
    },
    labelLayer?.id,
  )
}

interface RouteTrack {
  coordinates: Coordinate[]
  cumulative: number[]
  total: number
}

function routeEndpoints(route: Coordinate[]): { origin: Coordinate; destination: Coordinate } {
  return {
    origin: route[0],
    destination: route[route.length - 1],
  }
}

interface DirectionsRoute {
  distance: number
  duration: number
  geometry: { coordinates: Coordinate[] }
  legs?: Array<{
    steps?: Array<{
      distance?: number
      duration?: number
      name?: string
      maneuver?: {
        instruction?: string
      }
    }>
    annotation?: {
      congestion?: CongestionLevel[]
      duration?: number[]
      distance?: number[]
    }
  }>
}

interface NavigationStep {
  instruction: string
  street: string
  distanceM: number
  durationS: number
}

interface NavigationUpdate {
  steps: NavigationStep[]
  activeStepIndex: number
  etaMinutes: number
  remainingKm: number
}

interface KpiHistoryPoint {
  t: string
  active: number
  delay: number
  avoided: number
  traceability: number
  green: number
  co2: number
}

function coordinateDistance(from: Coordinate, to: Coordinate): number {
  return haversineDistance(from, to)
}

function createRouteTrack(coordinates: Coordinate[]): RouteTrack {
  const safeCoordinates = coordinates.length > 1 ? coordinates : fallbackSafeRoute
  const cumulative: number[] = [0]

  for (let i = 1; i < safeCoordinates.length; i += 1) {
    const prev = safeCoordinates[i - 1]
    const current = safeCoordinates[i]
    cumulative.push(cumulative[i - 1] + coordinateDistance(prev, current))
  }

  const total = cumulative[cumulative.length - 1] || 1
  return { coordinates: safeCoordinates, cumulative, total }
}

function positionOnTrack(track: RouteTrack, progress: number): Coordinate {
  const clampedProgress = Math.max(0, Math.min(0.999, progress))
  const targetDistance = track.total * clampedProgress

  let segmentIndex = 0
  while (segmentIndex < track.cumulative.length - 1 && track.cumulative[segmentIndex + 1] < targetDistance) {
    segmentIndex += 1
  }

  const from = track.coordinates[segmentIndex]
  const to = track.coordinates[Math.min(track.coordinates.length - 1, segmentIndex + 1)]
  const segmentStart = track.cumulative[segmentIndex]
  const segmentEnd = track.cumulative[Math.min(track.cumulative.length - 1, segmentIndex + 1)]
  const segmentDistance = Math.max(segmentEnd - segmentStart, 0.000001)
  const t = (targetDistance - segmentStart) / segmentDistance
  return [from[0] + (to[0] - from[0]) * t, from[1] + (to[1] - from[1]) * t]
}

function bearingBetween(from: Coordinate, to: Coordinate): number {
  const latMid = ((from[1] + to[1]) / 2) * (Math.PI / 180)
  const dx = (to[0] - from[0]) * Math.cos(latMid)
  const dy = to[1] - from[1]
  return (Math.atan2(dx, dy) * 180) / Math.PI
}

function bearingOnTrack(track: RouteTrack, progress: number): number {
  const clampedProgress = Math.max(0, Math.min(0.999, progress))
  const lookAround = 0.012
  const backwardProgress = Math.max(0, clampedProgress - lookAround)
  const forwardProgress = Math.min(0.999, clampedProgress + lookAround)
  const from = positionOnTrack(track, backwardProgress)
  const to = positionOnTrack(track, forwardProgress)
  return bearingBetween(from, to)
}

function haversineDistance(coord1: Coordinate, coord2: Coordinate): number {
  const R = 6371000
  const lat1 = (coord1[1] * Math.PI) / 180
  const lat2 = (coord2[1] * Math.PI) / 180
  const dLat = ((coord2[1] - coord1[1]) * Math.PI) / 180
  const dLon = ((coord2[0] - coord1[0]) * Math.PI) / 180

  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2
  return R * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)))
}

function lerpCoordinate(from: Coordinate, to: Coordinate, t: number): Coordinate {
  return [from[0] + (to[0] - from[0]) * t, from[1] + (to[1] - from[1]) * t]
}

function normalizeAngle(angle: number): number {
  let normalized = angle
  while (normalized > 180) normalized -= 360
  while (normalized < -180) normalized += 360
  return normalized
}

function smoothAngle(from: number, to: number, factor: number): number {
  const delta = normalizeAngle(to - from)
  return from + delta * factor
}

function densifyRouteCoordinates(coords: Coordinate[], maxSegmentMeters = 22): Coordinate[] {
  if (coords.length < 2) return coords
  const output: Coordinate[] = [coords[0]]

  for (let i = 1; i < coords.length; i += 1) {
    const start = coords[i - 1]
    const end = coords[i]
    const segmentDistance = haversineDistance(start, end)
    const steps = Math.max(1, Math.ceil(segmentDistance / maxSegmentMeters))
    for (let step = 1; step <= steps; step += 1) {
      output.push(lerpCoordinate(start, end, step / steps))
    }
  }

  return output
}

function maxRouteSegmentDistance(coords: Coordinate[]): number {
  if (coords.length < 2) return 0
  let maxDistance = 0
  for (let i = 1; i < coords.length; i += 1) {
    maxDistance = Math.max(maxDistance, haversineDistance(coords[i - 1], coords[i]))
  }
  return maxDistance
}

function findClosestPointOnRoute(userPos: Coordinate, routeCoords: Coordinate[]): { index: number; distance: number } {
  let minDist = Number.POSITIVE_INFINITY
  let closestIdx = 0

  routeCoords.forEach((coord, idx) => {
    const dist = haversineDistance(userPos, coord)
    if (dist < minDist) {
      minDist = dist
      closestIdx = idx
    }
  })

  return { index: closestIdx, distance: minDist }
}

function calculateEmissionsFromCongestion(congestion: CongestionLevel[] | undefined, distanceMeters: number): number {
  if (!congestion || congestion.length === 0) return Math.round((distanceMeters / 1000) * 120)

  const factors: Record<CongestionLevel, number> = {
    unknown: 100,
    low: 80,
    moderate: 120,
    heavy: 180,
    severe: 250,
  }

  const segmentDistanceKm = (distanceMeters / Math.max(1, congestion.length)) / 1000
  const totalGrams = congestion.reduce((sum, level) => sum + segmentDistanceKm * (factors[level] ?? 120), 0)
  return Math.round(totalGrams)
}

function fallbackNavigationSteps(): NavigationStep[] {
  return [
    { instruction: "Avanza por corredor principal", street: "Circuito interior", distanceM: 1800, durationS: 210 },
    { instruction: "Mantente por carril derecho", street: "Eje 2", distanceM: 1300, durationS: 170 },
    { instruction: "Incorpórate a ruta segura", street: "Sonora", distanceM: 1100, durationS: 160 },
    { instruction: "Llegada al destino", street: "Punto B", distanceM: 0, durationS: 0 },
  ]
}

function deriveNavigationSteps(route: DirectionsRoute): NavigationStep[] {
  const steps = route.legs?.flatMap((leg) => leg.steps ?? []) ?? []
  if (!steps.length) return fallbackNavigationSteps()

  const normalized = steps.map((step) => ({
    instruction: step.maneuver?.instruction || "Continua por la ruta",
    street: step.name || "Vialidad principal",
    distanceM: Math.round(step.distance ?? 0),
    durationS: Math.round(step.duration ?? 0),
  }))
  return normalized.length ? normalized : fallbackNavigationSteps()
}

function removeRouteLayer(map: mapboxgl.Map, id: string) {
  if (map.getLayer(id)) map.removeLayer(id)
  if (map.getLayer(`${id}-border`)) map.removeLayer(`${id}-border`)
  if (map.getSource(id)) map.removeSource(id)
}

function addRouteLayer(
  map: mapboxgl.Map,
  id: string,
  coordinates: Coordinate[],
  color: string,
  width: number,
  opacity = 1,
) {
  removeRouteLayer(map, id)
  map.addSource(id, {
    type: "geojson",
    data: {
      type: "Feature",
      properties: {},
      geometry: { type: "LineString", coordinates },
    },
  })
  map.addLayer({
    id: `${id}-border`,
    type: "line",
    source: id,
    layout: { "line-join": "round", "line-cap": "round" },
    paint: { "line-color": "#1e293b", "line-width": width + 4, "line-opacity": opacity },
  })
  map.addLayer({
    id,
    type: "line",
    source: id,
    layout: { "line-join": "round", "line-cap": "round" },
    paint: { "line-color": color, "line-width": width, "line-opacity": opacity },
  })
}

function updateRouteLayer(map: mapboxgl.Map, id: string, coordinates: Coordinate[]) {
  const source = map.getSource(id) as mapboxgl.GeoJSONSource | undefined
  if (!source) return
  source.setData({
    type: "Feature",
    properties: {},
    geometry: { type: "LineString", coordinates },
  })
}

function updateProgressiveLayers(map: mapboxgl.Map, routeCoords: Coordinate[], currentIndex: number) {
  if (routeCoords.length < 2 || currentIndex < 1) return
  const traveled = routeCoords.slice(0, currentIndex + 1)
  const remaining = routeCoords.slice(Math.max(0, currentIndex))
  if (traveled.length > 1) {
    if (!map.getSource("safe-traveled")) {
      addRouteLayer(map, "safe-traveled", traveled, "#6b7280", 6, 0.82)
    } else {
      updateRouteLayer(map, "safe-traveled", traveled)
    }
  }
  if (remaining.length > 1) {
    if (!map.getSource("safe-remaining")) {
      addRouteLayer(map, "safe-remaining", remaining, "#7dd3fc", 6, 0.9)
    } else {
      updateRouteLayer(map, "safe-remaining", remaining)
    }
  }
}

function fitToRoutes(map: mapboxgl.Map, coordinates: Coordinate[]) {
  if (coordinates.length < 2) return
  const lngs = coordinates.map((coord) => coord[0])
  const lats = coordinates.map((coord) => coord[1])
  map.fitBounds(
    [
      [Math.min(...lngs), Math.min(...lats)],
      [Math.max(...lngs), Math.max(...lats)],
    ],
    {
      padding: { top: 90, bottom: 120, left: 70, right: 70 },
      duration: 900,
    },
  )
}

async function fetchDirections(origin: Coordinate, destination: Coordinate): Promise<DirectionsRoute[] | null> {
  const token = DASHBOARD_MAPBOX_TOKEN
  if (!token) return null

  const requestUrl =
    `https://api.mapbox.com/directions/v5/mapbox/driving-traffic/${origin[0]},${origin[1]};${destination[0]},${destination[1]}` +
    `?access_token=${token}&alternatives=true&geometries=geojson&overview=full&steps=true&annotations=congestion,duration,distance&language=es`

  try {
    const response = await fetch(requestUrl)
    if (!response.ok) return null
    const payload = (await response.json()) as {
      code?: string
      routes?: Array<{
        distance: number
        duration: number
        geometry?: { coordinates?: number[][] }
        legs?: Array<{
          steps?: Array<{
            distance?: number
            duration?: number
            name?: string
            maneuver?: {
              instruction?: string
            }
          }>
          annotation?: {
            congestion?: CongestionLevel[]
            duration?: number[]
            distance?: number[]
          }
        }>
      }>
    }
    if (payload.code !== "Ok" || !payload.routes?.length) return null
    return payload.routes
      .filter((route) => (route.geometry?.coordinates?.length ?? 0) > 1)
      .map((route) => ({
        distance: route.distance,
        duration: route.duration,
        geometry: { coordinates: (route.geometry?.coordinates ?? []).map(([lng, lat]) => [lng, lat] as Coordinate) },
        legs: route.legs,
      }))
  } catch {
    return null
  }
}

async function fetchDirectionsFromWaypoints(waypoints: Coordinate[]): Promise<DirectionsRoute | null> {
  const token = DASHBOARD_MAPBOX_TOKEN
  if (!token || waypoints.length < 2) return null

  const waypointString = waypoints.map(([lng, lat]) => `${lng},${lat}`).join(";")
  const requestUrl =
    `https://api.mapbox.com/directions/v5/mapbox/driving-traffic/${waypointString}` +
    `?access_token=${token}&alternatives=false&geometries=geojson&overview=full&steps=true&annotations=congestion,duration,distance&language=es`

  try {
    const response = await fetch(requestUrl)
    if (!response.ok) return null
    const payload = (await response.json()) as {
      code?: string
      routes?: Array<{
        distance: number
        duration: number
        geometry?: { coordinates?: number[][] }
        legs?: Array<{
          steps?: Array<{
            distance?: number
            duration?: number
            name?: string
            maneuver?: { instruction?: string }
          }>
          annotation?: {
            congestion?: CongestionLevel[]
            duration?: number[]
            distance?: number[]
          }
        }>
      }>
    }
    const route = payload.code === "Ok" ? payload.routes?.[0] : undefined
    if (!route || (route.geometry?.coordinates?.length ?? 0) < 2) return null
    return {
      distance: route.distance,
      duration: route.duration,
      geometry: { coordinates: (route.geometry?.coordinates ?? []).map(([lng, lat]) => [lng, lat] as Coordinate) },
      legs: route.legs,
    }
  } catch {
    return null
  }
}

async function fetchMatchedRoute(routeCoords: Coordinate[]): Promise<Coordinate[] | null> {
  const token = DASHBOARD_MAPBOX_TOKEN
  if (!token || routeCoords.length < 2) return null

  const limitedCoords = routeCoords.slice(0, 100)
  const coordsString = limitedCoords.map(([lng, lat]) => `${lng},${lat}`).join(";")
  const requestUrl =
    `https://api.mapbox.com/matching/v5/mapbox/driving/${coordsString}` +
    `?access_token=${token}&geometries=geojson&overview=full&tidy=true&steps=false`

  try {
    const response = await fetch(requestUrl)
    if (!response.ok) return null
    const payload = (await response.json()) as {
      code?: string
      matchings?: Array<{ geometry?: { coordinates?: number[][] } }>
    }
    const coords = payload.code === "Ok" ? payload.matchings?.[0]?.geometry?.coordinates : undefined
    if (!coords || coords.length < 2) return null
    return coords.map(([lng, lat]) => [lng, lat] as Coordinate)
  } catch {
    return null
  }
}

function DashboardMap({ onNavigationUpdate }: { onNavigationUpdate?: (payload: NavigationUpdate) => void }) {
  const mapContainer = useRef<HTMLDivElement>(null)
  const mapRef = useRef<mapboxgl.Map | null>(null)
  const staticMarkersRef = useRef<mapboxgl.Marker[]>([])
  const carMarkersRef = useRef<mapboxgl.Marker[]>([])
  const carMarkerElementsRef = useRef<HTMLDivElement[]>([])
  const animationRef = useRef<number | null>(null)
  const lastFrameRef = useRef<number | null>(null)
  const progressRef = useRef<number[]>(carProfiles.map((car) => car.start))
  const completedCarsRef = useRef<boolean[]>(carProfiles.map(() => false))
  const routeCoordinatesRef = useRef<Record<RouteKey, Coordinate[]>>({
    traditional: fallbackTraditionalRoute,
    safe: fallbackSafeRoute,
    express: fallbackExpressRoute,
  })
  const routeTracksRef = useRef<Record<RouteKey, RouteTrack>>({
    traditional: createRouteTrack(fallbackTraditionalRoute),
    safe: createRouteTrack(fallbackSafeRoute),
    express: createRouteTrack(fallbackExpressRoute),
  })
  const vehicleStateRef = useRef<Array<{ position: Coordinate; bearing: number } | null>>(carProfiles.map(() => null))

  useEffect(() => {
    if (!mapContainer.current || mapRef.current) return

    const map = new mapboxgl.Map({
      container: mapContainer.current,
      style: DASHBOARD_MAPBOX_TOKEN ? mapboxDarkStyle : openStreetMapStyle,
      accessToken: DASHBOARD_MAPBOX_TOKEN,
      center: mapCenter,
      zoom: 13.8,
      pitch: 55,
      bearing: -20,
      interactive: true,
      antialias: true,
      attributionControl: false,
      maxPitch: 70,
    })

    map.on("style.load", () => {
      void (async () => {
        add3DBuildingsLayer(map)

        const safeEndpoints = routeEndpoints(routeWaypoints.safe)
        const traditionalEndpoints = routeEndpoints(routeWaypoints.traditional)
        const expressEndpoints = routeEndpoints(routeWaypoints.express)
        const [safeDirection, traditionalDirection, expressDirection, safeFallbackDirections, traditionalFallbackDirections, expressFallbackDirections] = await Promise.all([
          fetchDirectionsFromWaypoints(routeWaypoints.safe),
          fetchDirectionsFromWaypoints(routeWaypoints.traditional),
          fetchDirectionsFromWaypoints(routeWaypoints.express),
          fetchDirections(safeEndpoints.origin, safeEndpoints.destination),
          fetchDirections(traditionalEndpoints.origin, traditionalEndpoints.destination),
          fetchDirections(expressEndpoints.origin, expressEndpoints.destination),
        ])

        const fallbackTraditional: DirectionsRoute = {
          distance: 8400,
          duration: 760,
          geometry: { coordinates: fallbackTraditionalRoute },
          legs: [{ annotation: { congestion: ["moderate", "heavy", "moderate"] } }],
        }
        const fallbackSafe: DirectionsRoute = {
          distance: 9100,
          duration: 840,
          geometry: { coordinates: fallbackSafeRoute },
          legs: [{ annotation: { congestion: ["low", "moderate", "low"] } }],
        }
        const fallbackExpress: DirectionsRoute = {
          distance: 8600,
          duration: 720,
          geometry: { coordinates: fallbackExpressRoute },
          legs: [{ annotation: { congestion: ["moderate", "low", "moderate"] } }],
        }

        const selectedSafeRoute = safeDirection ?? safeFallbackDirections?.[0] ?? fallbackSafe
        const selectedTraditionalRoute = traditionalDirection ?? traditionalFallbackDirections?.[0] ?? fallbackTraditional
        const selectedExpressRoute = expressDirection ?? expressFallbackDirections?.[0] ?? fallbackExpress
        const [matchedSafeRoute, matchedTraditionalRoute, matchedExpressRoute] = await Promise.all([
          fetchMatchedRoute(selectedSafeRoute.geometry.coordinates),
          fetchMatchedRoute(selectedTraditionalRoute.geometry.coordinates),
          fetchMatchedRoute(selectedExpressRoute.geometry.coordinates),
        ])
        const safeRoute = densifyRouteCoordinates(matchedSafeRoute ?? selectedSafeRoute.geometry.coordinates)
        const traditionalRoute = densifyRouteCoordinates(matchedTraditionalRoute ?? selectedTraditionalRoute.geometry.coordinates)
        const expressRouteCandidate = densifyRouteCoordinates(matchedExpressRoute ?? selectedExpressRoute.geometry.coordinates)
        const expressRoute =
          maxRouteSegmentDistance(expressRouteCandidate) > 260
            ? densifyRouteCoordinates(fallbackExpressRoute)
            : expressRouteCandidate
        const safeRouteEmissions = calculateEmissionsFromCongestion(
          selectedSafeRoute.legs?.[0]?.annotation?.congestion,
          selectedSafeRoute.distance,
        )
        const traditionalRouteEmissions = calculateEmissionsFromCongestion(
          selectedTraditionalRoute.legs?.[0]?.annotation?.congestion,
          selectedTraditionalRoute.distance,
        )
        const expressRouteEmissions = calculateEmissionsFromCongestion(
          selectedExpressRoute.legs?.[0]?.annotation?.congestion,
          selectedExpressRoute.distance,
        )
        const safeNavigationSteps = deriveNavigationSteps(selectedSafeRoute)

        routeCoordinatesRef.current = { traditional: traditionalRoute, safe: safeRoute, express: expressRoute }
        routeTracksRef.current = {
          traditional: createRouteTrack(traditionalRoute),
          safe: createRouteTrack(safeRoute),
          express: createRouteTrack(expressRoute),
        }
        completedCarsRef.current = carProfiles.map(() => false)

        addRouteLayer(map, "traditional-route", traditionalRoute, "#4b5563", 5, 0.6)
        addRouteLayer(map, "safe-route", safeRoute, "#60a5fa", 7, 0.88)
        addRouteLayer(map, "express-route", expressRoute, "#34d399", 5, 0.75)
        fitToRoutes(map, [...safeRoute, ...traditionalRoute, ...expressRoute])

        hazardEvents.forEach((event) => {
          const markerEl = document.createElement("div")
          markerEl.className = "hazard-marker"
          markerEl.style.background = event.color
          const popup = new mapboxgl.Popup({ offset: 12 }).setHTML(
            `<strong>${event.title}</strong><p style="margin-top:4px">${event.detail}</p>`,
          )
          staticMarkersRef.current.push(new mapboxgl.Marker({ element: markerEl }).setLngLat(event.coords).setPopup(popup).addTo(map))
        })

        carProfiles.forEach((car, index) => {
          const markerEl = document.createElement("div")
          markerEl.className = "car-marker"
          markerEl.style.setProperty("--car-color", car.color)
          markerEl.innerHTML = `
            <span class="truck-trailer"></span>
            <span class="truck-cab"></span>
            <span class="truck-window"></span>
            <span class="car-wheel car-wheel-front"></span>
            <span class="car-wheel car-wheel-mid"></span>
            <span class="car-wheel car-wheel-back"></span>
            <span class="car-marker-id">${index + 1}</span>
          `
          const routeKey = vehicleRouteAssignments[index] || "safe"
          const routeLabelByKey: Record<RouteKey, string> = {
            safe: "ruta segura",
            traditional: "ruta tradicional",
            express: "ruta express",
          }
          const routeEmissionByKey: Record<RouteKey, number> = {
            safe: safeRouteEmissions,
            traditional: traditionalRouteEmissions,
            express: expressRouteEmissions,
          }
          const routeLabel = routeLabelByKey[routeKey]
          const routeEmission = routeEmissionByKey[routeKey]
          const popup = new mapboxgl.Popup({ offset: 12 }).setHTML(
            `<strong>Unidad ${car.id}</strong><p style="margin-top:4px">Seguimiento en ${routeLabel}</p><p style="margin-top:4px">CO₂ estimado: ${routeEmission} g</p>`,
          )
          const routeTrack = routeTracksRef.current[routeKey]
          const initialPosition = positionOnTrack(routeTrack, progressRef.current[index])
          const initialBearing = bearingOnTrack(routeTrack, progressRef.current[index]) + CAR_HEADING_OFFSET
          const marker = new mapboxgl.Marker({
            element: markerEl,
            rotationAlignment: "map",
            pitchAlignment: "map",
            anchor: "center",
          })
            .setLngLat(initialPosition)
            .setRotation(initialBearing)
            .setPopup(popup)
            .addTo(map)
          vehicleStateRef.current[index] = { position: initialPosition, bearing: initialBearing }
          carMarkersRef.current.push(marker)
          carMarkerElementsRef.current.push(markerEl)
        })

        const updateCarMarkerScale = () => {
          const zoom = map.getZoom()
          const normalized = Math.max(0, Math.min(1, (zoom - 12) / 6))
          const scale = 1 - normalized * 0.34
          carMarkerElementsRef.current.forEach((el) => {
            el.style.setProperty("--car-scale", scale.toFixed(3))
          })
        }
        updateCarMarkerScale()
        map.on("zoom", updateCarMarkerScale)

        const animateCars = (timestamp: number) => {
          const previousFrame = lastFrameRef.current ?? timestamp
          const deltaSeconds = Math.min(0.1, Math.max(0.001, (timestamp - previousFrame) / 1000))
          const blend = Math.min(0.9, Math.max(0.2, deltaSeconds * 7))
          lastFrameRef.current = timestamp
          let latestSafePosition: Coordinate | null = null
          carMarkersRef.current.forEach((marker, idx) => {
            if (completedCarsRef.current[idx]) return
            const routeKey = vehicleRouteAssignments[idx] || "safe"
            const routeTrack = routeTracksRef.current[routeKey]
            const zoom = map.getZoom()
            const zoomSlowdown = Math.max(0.42, 1 - Math.max(0, zoom - 13) * 0.12)
            const nextProgress = Math.min(1, progressRef.current[idx] + carProfiles[idx].speed * zoomSlowdown * deltaSeconds)
            progressRef.current[idx] = nextProgress
            const reachedDestination = nextProgress >= 1
            const targetPosition = reachedDestination
              ? routeTrack.coordinates[routeTrack.coordinates.length - 1]
              : positionOnTrack(routeTrack, nextProgress)
            const targetBearing = reachedDestination
              ? bearingBetween(
                  routeTrack.coordinates[Math.max(0, routeTrack.coordinates.length - 2)],
                  routeTrack.coordinates[routeTrack.coordinates.length - 1],
                ) + CAR_HEADING_OFFSET
              : bearingOnTrack(routeTrack, nextProgress) + CAR_HEADING_OFFSET
            const previousState = vehicleStateRef.current[idx]
            const displayBearing = previousState ? smoothAngle(previousState.bearing, targetBearing, blend) : targetBearing
            vehicleStateRef.current[idx] = { position: targetPosition, bearing: displayBearing }
            marker.setLngLat(targetPosition)
            marker.setRotation(displayBearing)
            if (reachedDestination) completedCarsRef.current[idx] = true
            if (routeKey === "safe" && idx === 0) latestSafePosition = targetPosition
          })
          if (latestSafePosition) {
            const safeCoords = routeCoordinatesRef.current.safe
            const { index } = findClosestPointOnRoute(latestSafePosition, safeCoords)
            updateProgressiveLayers(map, safeCoords, index)
            const routeProgress = safeCoords.length > 1 ? index / (safeCoords.length - 1) : 0
            const stepIndex = Math.min(
              safeNavigationSteps.length - 1,
              Math.max(0, Math.floor(routeProgress * safeNavigationSteps.length)),
            )
            const remainingProgress = 1 - routeProgress
            const remainingMeters = selectedSafeRoute.distance * remainingProgress
            const remainingSeconds = selectedSafeRoute.duration * remainingProgress
            onNavigationUpdate?.({
              steps: safeNavigationSteps,
              activeStepIndex: stepIndex,
              remainingKm: Number((remainingMeters / 1000).toFixed(2)),
              etaMinutes: Math.max(1, Math.round(remainingSeconds / 60)),
            })
          }
          animationRef.current = window.requestAnimationFrame(animateCars)
        }
        animationRef.current = window.requestAnimationFrame(animateCars)
      })()
    })

    mapRef.current = map

    const styleTagId = "lumivia-route-markers-style"
    if (!document.getElementById(styleTagId)) {
      const styleTag = document.createElement("style")
      styleTag.id = styleTagId
      styleTag.textContent = `
        .hazard-marker {
          width: 12px;
          height: 12px;
          border-radius: 999px;
          border: 2px solid rgba(255,255,255,0.85);
          box-shadow: 0 0 0 0 rgba(248, 250, 252, 0.35);
          animation: hazardPulse 1.8s infinite;
        }
        .car-marker {
          width: calc(44px * var(--car-scale, 1));
          height: calc(24px * var(--car-scale, 1));
          position: relative;
          transform-origin: 50% 50%;
          filter: drop-shadow(0 6px 14px rgba(2, 6, 23, 0.8));
        }
        .truck-trailer {
          position: absolute;
          left: calc(2px * var(--car-scale, 1));
          width: calc(24px * var(--car-scale, 1));
          bottom: calc(5px * var(--car-scale, 1));
          height: calc(12px * var(--car-scale, 1));
          border-radius: calc(4px * var(--car-scale, 1));
          background: linear-gradient(180deg, color-mix(in srgb, var(--car-color, #93c5fd) 72%, white), var(--car-color, #93c5fd));
          border: 1px solid rgba(226, 232, 240, 0.85);
          box-shadow: inset 0 -2px 3px rgba(2, 6, 23, 0.35), inset 0 2px 2px rgba(255,255,255,0.25);
        }
        .truck-cab {
          position: absolute;
          right: calc(2px * var(--car-scale, 1));
          bottom: calc(5px * var(--car-scale, 1));
          width: calc(14px * var(--car-scale, 1));
          height: calc(13px * var(--car-scale, 1));
          border-radius: calc(5px * var(--car-scale, 1)) calc(5px * var(--car-scale, 1)) calc(3px * var(--car-scale, 1)) calc(3px * var(--car-scale, 1));
          background: linear-gradient(180deg, rgba(241, 245, 249, 0.95), rgba(203, 213, 225, 0.88));
          border: 1px solid rgba(226, 232, 240, 0.85);
        }
        .truck-window {
          position: absolute;
          right: calc(5px * var(--car-scale, 1));
          bottom: calc(11px * var(--car-scale, 1));
          width: calc(8px * var(--car-scale, 1));
          height: calc(4px * var(--car-scale, 1));
          border-radius: calc(2px * var(--car-scale, 1));
          background: linear-gradient(180deg, rgba(186, 230, 253, 0.95), rgba(125, 211, 252, 0.85));
        }
        .car-wheel {
          position: absolute;
          bottom: 0;
          width: calc(6px * var(--car-scale, 1));
          height: calc(6px * var(--car-scale, 1));
          border-radius: 999px;
          background: #020617;
          border: 1px solid rgba(148, 163, 184, 0.9);
        }
        .car-wheel-front { right: calc(6px * var(--car-scale, 1)); }
        .car-wheel-mid { right: calc(18px * var(--car-scale, 1)); }
        .car-wheel-back { left: calc(7px * var(--car-scale, 1)); }
        .car-marker::after {
          content: "";
          position: absolute;
          inset: calc(-4px * var(--car-scale, 1));
          border-radius: 999px;
          border: 1px solid color-mix(in srgb, var(--car-color, #93c5fd) 60%, transparent);
          opacity: 0.65;
        }
        .car-marker-id {
          position: absolute;
          top: calc(2px * var(--car-scale, 1));
          left: calc(13px * var(--car-scale, 1));
          z-index: 1;
          color: #0f172a;
          font-size: calc(9px * var(--car-scale, 1));
          font-weight: 800;
          line-height: 1;
        }
        @keyframes hazardPulse {
          0% { box-shadow: 0 0 0 0 rgba(248, 250, 252, 0.3); }
          70% { box-shadow: 0 0 0 10px rgba(248, 250, 252, 0); }
          100% { box-shadow: 0 0 0 0 rgba(248, 250, 252, 0); }
        }
      `
      document.head.appendChild(styleTag)
    }

    return () => {
      if (animationRef.current) window.cancelAnimationFrame(animationRef.current)
      lastFrameRef.current = null
      vehicleStateRef.current = carProfiles.map(() => null)
      completedCarsRef.current = carProfiles.map(() => false)
      staticMarkersRef.current.forEach((marker) => marker.remove())
      carMarkersRef.current.forEach((marker) => marker.remove())
      staticMarkersRef.current = []
      carMarkersRef.current = []
      carMarkerElementsRef.current = []
      map.remove()
      mapRef.current = null
    }
  }, [onNavigationUpdate])

  return (
    <div className="relative h-full w-full">
      <div ref={mapContainer} className="h-full w-full" />
      <div className="pointer-events-none absolute left-6 top-5 rounded-md border border-slate-200/25 bg-slate-950/55 px-3 py-1.5 text-xs uppercase tracking-[0.24em] text-slate-200 backdrop-blur">
        Tracking multi-route
      </div>
    </div>
  )
}

function MetricBlock({
  title,
  value,
  unit,
  icon: Icon,
}: {
  title: string
  value: string
  unit: string
  icon: typeof Activity
}) {
  return (
    <article className="glass-card group rounded-2xl p-3 transition-all duration-300 sm:p-4">
      <div className="mb-2 flex items-center justify-between sm:mb-3">
        <Icon className="h-4 w-4 text-sky-300" />
        <span className="text-xs uppercase tracking-[0.28em] text-slate-400">Live</span>
      </div>
      <p className="text-xs uppercase tracking-[0.26em] text-slate-400">{title}</p>
      <div className="mt-2 flex items-end gap-2">
        <span className="overflow-hidden text-ellipsis font-display text-3xl leading-none text-slate-100">{value}</span>
        <span className="pb-1 text-xs uppercase tracking-[0.2em] text-slate-400">{unit}</span>
      </div>
    </article>
  )
}

export function DashboardSection() {
  const [currentTime, setCurrentTime] = useState(new Date())
  const [simulation, setSimulation] = useState(INITIAL_GOVERNANCE_STATE)
  const [kpiHistory, setKpiHistory] = useState<KpiHistoryPoint[]>([])
  const [navigation, setNavigation] = useState<NavigationUpdate>({
    steps: fallbackNavigationSteps(),
    activeStepIndex: 0,
    etaMinutes: 14,
    remainingKm: 8.4,
  })

  useEffect(() => {
    const interval = setInterval(() => setCurrentTime(new Date()), 1000)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    const liveTelemetry = setInterval(() => {
      setSimulation((prev) => {
        const next = nextGovernanceState(prev)
        const now = new Date()
        const timeLabel = now.toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" })
        const nextGreenRoutePct = Math.round((next.greenTripsToday / Math.max(1, next.totalTripsToday)) * 100)

        setKpiHistory((history) => {
          const updated = [
            ...history,
            {
              t: timeLabel,
              active: next.activeVehicles,
              delay: next.delayAvoidedMin,
              avoided: next.avoidedIncidentsToday,
              traceability: next.traceabilityPct,
              green: nextGreenRoutePct,
              co2: next.monthlyCo2SavedKg,
            },
          ]
          return updated.slice(-12)
        })

        return next
      })
    }, 5200)
    return () => clearInterval(liveTelemetry)
  }, [])

  const treesEquivalent = useMemo(() => Math.round(simulation.monthlyCo2SavedKg / 34), [simulation.monthlyCo2SavedKg])
  const greenRoutePct = useMemo(
    () => Math.round((simulation.greenTripsToday / Math.max(1, simulation.totalTripsToday)) * 100),
    [simulation.greenTripsToday, simulation.totalTripsToday],
  )
  const totalComplianceViolations = useMemo(
    () => simulation.zeroEmissionViolations + simulation.contingencyViolations,
    [simulation.zeroEmissionViolations, simulation.contingencyViolations],
  )
  const complianceOk = totalComplianceViolations === 0
  const healthySources = useMemo(
    () => simulation.officialSources.filter((source) => source.connected && source.precisionPct >= 95).length,
    [simulation.officialSources],
  )
  const kpiTrendChart = useMemo(
    () =>
      kpiHistory.map((point) => ({
        t: point.t,
        Activos: point.active,
        Retraso: point.delay,
        Incidentes: point.avoided,
        Trazabilidad: point.traceability,
        Verdes: point.green,
        CO2: point.co2,
      })),
    [kpiHistory],
  )

  return (
    <section className="relative min-h-screen overflow-x-hidden text-slate-100">
      {/* New Abstract Background */}
      <AbstractBackground />
      
      <div className="relative mx-auto w-full max-w-7xl px-3 pb-6 pt-4 sm:px-4 sm:pt-6 lg:px-8 xl:px-10">
        <header className="glass-card-strong mb-3 grid gap-3 rounded-2xl p-3 sm:mb-4 sm:p-4 lg:grid-cols-[1fr_auto]">
          <div>
            <p className="text-xs uppercase tracking-[0.35em] text-slate-400">Lumivia Mobility Intelligence</p>
            <h1 className="font-display mt-1 text-2xl tracking-[0.14em] text-slate-100 md:text-3xl">TRACKING DASHBOARD</h1>
            <p className="mt-2 flex items-center gap-2 overflow-hidden text-ellipsis text-sm text-slate-300">
              <MapPin className="h-4 w-4" />
              Ruta segura punto A a punto B en tiempo real
            </p>
          </div>
          <div className="flex items-end">
            <div className="glass-card rounded-xl px-4 py-3 text-right">
              <p className="flex items-center justify-end gap-2 text-sm font-semibold text-slate-100">
                <Clock3 className="h-4 w-4 text-slate-400" />
                {currentTime.toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
              </p>
              <p className="mt-1 text-xs uppercase tracking-[0.26em] text-slate-500">
                {currentTime.toLocaleDateString("es-MX", { weekday: "long", day: "numeric", month: "short" })}
              </p>
            </div>
          </div>
        </header>

        <div className="grid grid-cols-1 gap-4">
          <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <MetricBlock title="Vehiculos activos en ruta segura" value={String(simulation.activeVehicles)} unit="unidades" icon={Truck} />
            <MetricBlock title="Incidentes climaticos esquivados" value={String(simulation.avoidedIncidentsToday)} unit="eventos" icon={ShieldCheck} />
            <MetricBlock title="Retraso evitado estimado" value={String(simulation.delayAvoidedMin)} unit="min" icon={Timer} />
            <article className="glass-card rounded-2xl p-3 sm:p-4">
              <p className="text-xs uppercase tracking-[0.26em] text-slate-400">Cumplimiento</p>
              <p className={`mt-2 text-3xl ${complianceOk ? "text-emerald-300" : "text-rose-300"}`}>{complianceOk ? "OK" : "ALERTA"}</p>
              <p className="mt-1 text-xs text-slate-400">{totalComplianceViolations} incidencias activas</p>
            </article>
          </section>

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.6fr)_minmax(320px,1fr)] xl:items-start">
            <main className="min-w-0 space-y-4">
              <section className="glass-panel rounded-3xl p-2">
                <div className="relative h-[300px] min-h-[260px] overflow-hidden rounded-[22px] md:h-[360px] lg:h-[410px] xl:h-[460px]">
                  <DashboardMap onNavigationUpdate={setNavigation} />
                  <div className="glass-card pointer-events-none absolute right-4 top-4 rounded-lg px-3 py-1.5 text-xs uppercase tracking-[0.22em] text-slate-200">
                    3 carritos en seguimiento
                  </div>
                </div>
              </section>

              <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
                <article className="glass-card min-w-0 rounded-2xl p-3 sm:p-4">
                  <p className="text-xs uppercase tracking-[0.26em] text-slate-400">Trazabilidad</p>
                  <p className="mt-2 truncate text-3xl text-slate-100">{simulation.traceabilityPct}%</p>
                  <p className="mt-1 text-xs text-slate-400">viajes auditables</p>
                </article>
                <article className="glass-card min-w-0 rounded-2xl p-3 sm:p-4">
                  <p className="text-xs uppercase tracking-[0.26em] text-slate-400">Fuentes oficiales</p>
                  <p className="mt-2 truncate text-3xl text-slate-100">{healthySources}/{simulation.officialSources.length}</p>
                  <p className="mt-1 text-xs text-slate-400">APIs estables</p>
                </article>
                <article className="glass-card min-w-0 rounded-2xl p-3 sm:p-4">
                  <p className="text-xs uppercase tracking-[0.26em] text-slate-400">CO₂ mensual</p>
                  <p className="mt-2 truncate text-3xl text-slate-100">{simulation.monthlyCo2SavedKg.toLocaleString("es-MX")}</p>
                  <p className="mt-1 text-xs text-slate-400">kg ahorrados</p>
                </article>
                <article className="glass-card min-w-0 rounded-2xl p-3 sm:p-4">
                  <p className="text-xs uppercase tracking-[0.26em] text-slate-400">Rutas verdes</p>
                  <p className="mt-2 truncate text-3xl text-slate-100">{greenRoutePct}%</p>
                  <p className="mt-1 text-xs text-slate-400">del total diario</p>
                </article>
              </section>

              <section className="grid grid-cols-1 gap-3 lg:grid-cols-2">
                <article className="glass-card min-w-0 rounded-2xl p-3 sm:p-4">
                  <p className="text-xs uppercase tracking-[0.26em] text-slate-400">Operacion en tiempo real</p>
                  <p className="mt-1 text-xs text-slate-500">Vehiculos activos, retraso evitado e incidentes esquivados</p>
                  <ChartContainer
                    className="mt-3 h-[230px] w-full"
                    config={{
                      Activos: { label: "Activos", color: "#60a5fa" },
                      Retraso: { label: "Retraso evitado", color: "#f59e0b" },
                      Incidentes: { label: "Incidentes esquivados", color: "#22d3ee" },
                    }}
                  >
                    <LineChart data={kpiTrendChart}>
                      <XAxis dataKey="t" tickLine={false} axisLine={false} tick={{ fontSize: 10 }} />
                      <YAxis hide />
                      <ChartTooltip content={<ChartTooltipContent />} />
                      <Line type="monotone" dataKey="Activos" stroke="var(--color-Activos)" strokeWidth={2.4} dot={false} />
                      <Line type="monotone" dataKey="Retraso" stroke="var(--color-Retraso)" strokeWidth={2.4} dot={false} />
                      <Line type="monotone" dataKey="Incidentes" stroke="var(--color-Incidentes)" strokeWidth={2.4} dot={false} />
                    </LineChart>
                  </ChartContainer>
                </article>

                <article className="glass-card min-w-0 rounded-2xl p-3 sm:p-4">
                  <p className="text-xs uppercase tracking-[0.26em] text-slate-400">Mix de rutas (pastel)</p>
                  <p className="mt-1 text-xs text-slate-500">Proporción de viajes verdes vs tradicionales</p>
                  <ChartContainer
                    className="mt-3 h-[230px] w-full"
                    config={{
                      verdes: { label: "Verdes", color: "#34d399" },
                      tradicionales: { label: "Tradicionales", color: "#64748b" },
                    }}
                  >
                    <PieChart>
                      <ChartTooltip content={<ChartTooltipContent />} />
                      <Pie
                        data={[
                          { name: "verdes", value: simulation.greenTripsToday },
                          { name: "tradicionales", value: Math.max(0, simulation.totalTripsToday - simulation.greenTripsToday) },
                        ]}
                        dataKey="value"
                        nameKey="name"
                        innerRadius={52}
                        outerRadius={88}
                        paddingAngle={3}
                        strokeWidth={0}
                      >
                        <Cell fill="var(--color-verdes)" />
                        <Cell fill="var(--color-tradicionales)" />
                      </Pie>
                    </PieChart>
                  </ChartContainer>
                </article>
              </section>

              <section className="glass-card min-w-0 rounded-2xl p-3 sm:p-4">
                <p className="text-xs uppercase tracking-[0.26em] text-slate-400">Fuentes oficiales (barras dinamicas)</p>
                <p className="mt-1 text-xs text-slate-500">Comparativo de precisión y latencia por API</p>
                <ChartContainer
                  className="mt-3 h-[220px] w-full"
                  config={{
                    precision: { label: "Precision", color: "#22d3ee" },
                    latenciaNorm: { label: "Latencia normalizada", color: "#f59e0b" },
                  }}
                >
                  <BarChart
                    data={simulation.officialSources.map((source) => ({
                      fuente: source.name,
                      precision: source.precisionPct,
                      latenciaNorm: Math.round((source.latencyMs / 10) * 10 / 10),
                    }))}
                  >
                    <XAxis dataKey="fuente" tickLine={false} axisLine={false} tick={{ fontSize: 11 }} />
                    <YAxis hide />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Bar dataKey="precision" fill="var(--color-precision)" radius={[6, 6, 0, 0]} />
                    <Bar dataKey="latenciaNorm" fill="var(--color-latenciaNorm)" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ChartContainer>
              </section>
            </main>

            <aside className="min-w-0 space-y-4">
              <section className="glass-card rounded-2xl p-3 sm:p-4">
              <h3 className="font-display text-lg tracking-[0.14em] text-slate-100">ESG DEL MES</h3>
              <div className="mt-3 space-y-2 sm:mt-4 sm:space-y-3">
                <div className="glass-card min-w-0 rounded-lg border-0 p-3">
                  <p className="text-xs uppercase tracking-[0.24em] text-slate-400">Ahorro acumulado CO2</p>
                  <p className="mt-1 truncate text-2xl text-slate-100">{simulation.monthlyCo2SavedKg.toLocaleString("es-MX")} kg</p>
                </div>
                <div className="glass-card min-w-0 rounded-lg border-0 p-3">
                  <p className="text-xs uppercase tracking-[0.24em] text-slate-400">Equivalencia ecologica</p>
                  <p className="mt-1 flex items-center gap-2 text-2xl text-slate-100">
                    <TreePine className="h-5 w-5 flex-shrink-0 text-emerald-400" />
                    <span className="truncate">{treesEquivalent} arboles</span>
                  </p>
                </div>
                <div className="glass-card min-w-0 rounded-lg border-0 p-3">
                  <p className="text-xs uppercase tracking-[0.24em] text-slate-400">Porcentaje rutas verdes</p>
                  <p className="mt-1 text-2xl text-slate-100">{greenRoutePct}%</p>
                </div>
              </div>
            </section>

            <section className="glass-card rounded-2xl p-3 sm:p-4">
              <h3 className="font-display text-lg tracking-[0.14em] text-slate-100">FLOTA EN RUTA</h3>
              <div className="mt-3 space-y-2">
                {carProfiles.map((car) => (
                  <div key={car.id} className="glass-card flex min-w-0 items-center justify-between rounded-lg border-0 px-3 py-2 text-sm">
                    <p className="flex min-w-0 items-center gap-2 text-slate-200">
                      <Car className="h-4 w-4 flex-shrink-0 text-sky-400" />
                      <span className="truncate">{car.id}</span>
                    </p>
                    <span className="flex-shrink-0 text-xs uppercase tracking-[0.2em] text-slate-500">En camino</span>
                  </div>
                ))}
              </div>
            </section>

            <section className="glass-card rounded-2xl p-3 sm:p-4">
              <h3 className="font-display text-lg tracking-[0.14em] text-slate-100">TURN BY TURN</h3>
              <p className="mt-2 text-xs uppercase tracking-[0.2em] text-slate-400">
                ETA {navigation.etaMinutes} min · {navigation.remainingKm} km restantes
              </p>
              <div className="mt-3 space-y-2">
                {navigation.steps.slice(0, 4).map((step, idx) => {
                  const isActive = idx === navigation.activeStepIndex
                  return (
                    <div
                      key={`${step.instruction}-${idx}`}
                      className={`glass-card rounded-lg border-0 px-3 py-2 text-sm transition-all ${
                        isActive ? "ring-2 ring-sky-400/50" : ""
                      }`}
                    >
                      <p className={`truncate font-medium ${isActive ? "text-sky-100" : "text-slate-200"}`}>{step.instruction}</p>
                      <p className="mt-1 truncate text-xs text-slate-400">
                        {step.street} · {Math.max(0, Math.round(step.distanceM / 10) * 10)} m
                      </p>
                    </div>
                  )
                })}
              </div>
            </section>
            </aside>
          </div>
        </div>
      </div>
    </section>
  )
}

