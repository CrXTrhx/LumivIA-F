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
import { ROUTE_TEMPLATE_BY_ID, ROUTE_TEMPLATES, type DriverRecord } from "@/lib/drivers"

const DASHBOARD_MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN_DASHBOARD || ""

type Coordinate = [number, number]
type CongestionLevel = "unknown" | "low" | "moderate" | "heavy" | "severe"

const mapCenter: Coordinate = [-99.1603, 19.4188]

const defaultFallbackRoute: Coordinate[] = ROUTE_TEMPLATES[0].waypoints

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

const CAR_HEADING_OFFSET = 0

interface VehicleProfile {
  id: string
  code: string
  name: string
  color: string
  routeId: string
  speed: number
  start: number
}

function buildVehicleProfiles(drivers: DriverRecord[]): VehicleProfile[] {
  const active = drivers
    .map((driver) => {
      const activeAssignment = (driver.assignments || []).find((assignment) => assignment.status === "en_curso")
      if (!activeAssignment) return null
      return { driver, activeAssignment }
    })
    .filter(Boolean)

  return active.slice(0, 18).map((entry, index) => {
    const { driver, activeAssignment } = entry
    const routeIdx = ROUTE_TEMPLATES.findIndex((route) => route.id === activeAssignment.routeId)
    const routeBaseSpeed = 0.0138 + ((routeIdx >= 0 ? routeIdx % 4 : 0) * 0.00035)
    const reliabilityFactor = 1 + (driver.performance.punctualityRate - 80) / 800
    const speed = Math.max(0.0095, routeBaseSpeed * reliabilityFactor - index * 0.00016)
    return {
      id: driver.id,
      code: driver.code,
      name: driver.fullName,
      color: driver.unitColor,
      routeId: activeAssignment.routeId,
      speed,
      start: ((index * 0.12) % 0.78),
    }
  })
}

function routeBadgeClasses(routeId: string): string {
  const route = ROUTE_TEMPLATE_BY_ID[routeId]
  if (!route) return "text-slate-200 bg-slate-500/15 border-slate-400/35"
  return "text-slate-100 border-slate-300/35"
}

function routeLabelById(routeId: string): string {
  return ROUTE_TEMPLATE_BY_ID[routeId]?.label ?? "Ruta"
}

function routeWaypointsForId(routeId: string): Coordinate[] {
  const template = ROUTE_TEMPLATE_BY_ID[routeId]
  return (template?.waypoints as Coordinate[] | undefined) ?? defaultFallbackRoute
}

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
  const safeCoordinates = coordinates.length > 1 ? coordinates : defaultFallbackRoute
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

function densifyRouteCoordinates(coords: Coordinate[], maxSegmentMeters = 8): Coordinate[] {
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

function updateProgressiveLayers(map: mapboxgl.Map, routeCoords: Coordinate[], currentIndex: number, layerPrefix: string) {
  if (routeCoords.length < 2 || currentIndex < 1) return
  const traveled = routeCoords.slice(0, currentIndex + 1)
  const remaining = routeCoords.slice(Math.max(0, currentIndex))
  const traveledId = `${layerPrefix}-traveled`
  const remainingId = `${layerPrefix}-remaining`
  if (traveled.length > 1) {
    if (!map.getSource(traveledId)) {
      addRouteLayer(map, traveledId, traveled, "#6b7280", 6, 0.82)
    } else {
      updateRouteLayer(map, traveledId, traveled)
    }
  }
  if (remaining.length > 1) {
    if (!map.getSource(remainingId)) {
      addRouteLayer(map, remainingId, remaining, "#7dd3fc", 6, 0.9)
    } else {
      updateRouteLayer(map, remainingId, remaining)
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

function DashboardMap({
  vehicleProfiles,
  onNavigationUpdate,
}: {
  vehicleProfiles: VehicleProfile[]
  onNavigationUpdate?: (payload: NavigationUpdate) => void
}) {
  const mapContainer = useRef<HTMLDivElement>(null)
  const mapRef = useRef<mapboxgl.Map | null>(null)
  const staticMarkersRef = useRef<mapboxgl.Marker[]>([])
  const carMarkersRef = useRef<mapboxgl.Marker[]>([])
  const carMarkerElementsRef = useRef<HTMLDivElement[]>([])
  const animationRef = useRef<number | null>(null)
  const lastFrameRef = useRef<number | null>(null)
  const progressRef = useRef<number[]>([])
  const completedCarsRef = useRef<boolean[]>([])
  const routeCoordinatesRef = useRef<Record<string, Coordinate[]>>({})
  const routeTracksRef = useRef<Record<string, RouteTrack>>({})
  const vehicleStateRef = useRef<Array<{ position: Coordinate; bearing: number } | null>>([])

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

    // Keep fleet markers visually anchored to routes.
    // Disables camera angle changes that make markers feel detached.
    map.dragRotate.disable()
    map.touchZoomRotate.disableRotation()
    map.keyboard.disableRotation()

    map.on("style.load", () => {
      void (async () => {
        add3DBuildingsLayer(map)

        const uniqueRouteIds = Array.from(new Set(vehicleProfiles.map((vehicle) => vehicle.routeId)))
        const routeById: Record<string, Coordinate[]> = {}
        const routeMetaById: Record<string, { emissions: number; steps: NavigationStep[]; distance: number; duration: number }> = {}

        await Promise.all(
          uniqueRouteIds.map(async (routeId) => {
            const fallbackCoords = routeWaypointsForId(routeId)
            const fallbackRoute: DirectionsRoute = {
              distance: Math.round(createRouteTrack(fallbackCoords).total),
              duration: 820,
              geometry: { coordinates: fallbackCoords },
              legs: [{ annotation: { congestion: ["moderate", "low", "moderate"] } }],
            }

            const directionsByWaypoints = await fetchDirectionsFromWaypoints(fallbackCoords)
            const endpointPair = routeEndpoints(fallbackCoords)
            const alternativeRoutes = await fetchDirections(endpointPair.origin, endpointPair.destination)
            const selectedRoute = directionsByWaypoints ?? alternativeRoutes?.[0] ?? fallbackRoute
            const matched = await fetchMatchedRoute(selectedRoute.geometry.coordinates)
            const normalizedRoute = densifyRouteCoordinates(matched ?? selectedRoute.geometry.coordinates, 5)

            routeById[routeId] = normalizedRoute
            routeMetaById[routeId] = {
              emissions: calculateEmissionsFromCongestion(selectedRoute.legs?.[0]?.annotation?.congestion, selectedRoute.distance),
              steps: deriveNavigationSteps(selectedRoute),
              distance: selectedRoute.distance,
              duration: selectedRoute.duration,
            }
          }),
        )

        routeCoordinatesRef.current = routeById
        routeTracksRef.current = Object.fromEntries(
          Object.entries(routeById).map(([routeId, coords]) => [routeId, createRouteTrack(coords)]),
        )
        progressRef.current = vehicleProfiles.map((vehicle) => vehicle.start)
        completedCarsRef.current = vehicleProfiles.map(() => false)
        vehicleStateRef.current = vehicleProfiles.map(() => null)

        const allRoutePoints: Coordinate[] = []
        Object.entries(routeById).forEach(([routeId, coords], idx) => {
          const color = ROUTE_TEMPLATE_BY_ID[routeId]?.color ?? ["#60a5fa", "#34d399", "#f59e0b"][idx % 3]
          addRouteLayer(map, `route-${routeId}`, coords, color, 5.5, 0.8)
          allRoutePoints.push(...coords)
        })
        fitToRoutes(map, allRoutePoints)

        hazardEvents.forEach((event) => {
          const markerEl = document.createElement("div")
          markerEl.className = "hazard-marker"
          markerEl.style.background = event.color
          const popup = new mapboxgl.Popup({ offset: 12 }).setHTML(
            `<strong>${event.title}</strong><p style="margin-top:4px">${event.detail}</p>`,
          )
          staticMarkersRef.current.push(new mapboxgl.Marker({ element: markerEl }).setLngLat(event.coords).setPopup(popup).addTo(map))
        })

        const navigationVehicleIndex = 0

        vehicleProfiles.forEach((car, index) => {
          const markerEl = document.createElement("div")
          markerEl.className = "car-marker"
          markerEl.style.setProperty("--car-color", car.color)
          markerEl.innerHTML = `
            <span class="truck-body"></span>
            <span class="truck-chassis"></span>
            <span class="truck-cab"></span>
            <span class="truck-windshield"></span>
            <span class="car-wheel car-wheel-front"></span>
            <span class="car-wheel car-wheel-mid"></span>
            <span class="car-wheel car-wheel-back"></span>
            <span class="car-marker-id">${car.code.replace("LUM-", "")}</span>
          `
          const routeId = car.routeId
          const routeLabel = routeLabelById(routeId).toLowerCase()
          const routeEmission = routeMetaById[routeId]?.emissions ?? 0
          const popup = new mapboxgl.Popup({ offset: 12 }).setHTML(
            `<div style="color:#111827"><strong>${car.name}</strong><p style="margin-top:4px">Unidad ${car.code}</p><p style="margin-top:4px">Seguimiento en ${routeLabel}</p><p style="margin-top:4px">CO₂ estimado: ${routeEmission} g</p></div>`,
          )
          const routeTrack = routeTracksRef.current[routeId]
          if (!routeTrack) return
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
          const normalized = Math.max(0, Math.min(1, (zoom - 11) / 7))
          const scale = 0.62 + normalized * 0.46
          carMarkerElementsRef.current.forEach((el) => {
            el.style.setProperty("--car-scale", scale.toFixed(3))
          })
        }
        updateCarMarkerScale()
        map.on("zoom", updateCarMarkerScale)

        const animateCars = (timestamp: number) => {
          const previousFrame = lastFrameRef.current ?? timestamp
          const deltaSeconds = Math.min(0.1, Math.max(0.001, (timestamp - previousFrame) / 1000))
          const blend = Math.min(0.82, Math.max(0.18, deltaSeconds * 5.5))
          lastFrameRef.current = timestamp
          let latestTrackedPosition: { pos: Coordinate; routeId: string; progress: number } | null = null
          carMarkersRef.current.forEach((marker, idx) => {
            if (completedCarsRef.current[idx]) return
            const currentVehicle = vehicleProfiles[idx]
            if (!currentVehicle) return
            const routeId = currentVehicle.routeId
            const routeTrack = routeTracksRef.current[routeId]
            if (!routeTrack) return
            const zoom = map.getZoom()
            const zoomSlowdown = Math.max(0.5, Math.min(1.06, 0.7 + (zoom - 13) * 0.06))
            const nextProgress = Math.min(1, progressRef.current[idx] + currentVehicle.speed * zoomSlowdown * deltaSeconds)
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
            const snappedPosition = positionOnTrack(routeTrack, nextProgress)
            vehicleStateRef.current[idx] = { position: snappedPosition, bearing: displayBearing }
            marker.setLngLat(snappedPosition)
            marker.setRotation(displayBearing)
            if (reachedDestination) completedCarsRef.current[idx] = true
            if (idx === navigationVehicleIndex) latestTrackedPosition = { pos: snappedPosition, routeId, progress: nextProgress }
          })
          if (latestTrackedPosition) {
            const trackedCoords = routeCoordinatesRef.current[latestTrackedPosition.routeId] ?? []
            const { index } = findClosestPointOnRoute(latestTrackedPosition.pos, trackedCoords)
            updateProgressiveLayers(map, trackedCoords, index, `route-progress-${latestTrackedPosition.routeId}`)
            const routeProgress = trackedCoords.length > 1 ? index / (trackedCoords.length - 1) : latestTrackedPosition.progress
            const routeMeta = routeMetaById[latestTrackedPosition.routeId]
            const navigationSteps = routeMeta?.steps ?? fallbackNavigationSteps()
            const stepIndex = Math.min(
              navigationSteps.length - 1,
              Math.max(0, Math.floor(routeProgress * navigationSteps.length)),
            )
            const remainingProgress = 1 - routeProgress
            const remainingMeters = (routeMeta?.distance ?? 0) * remainingProgress
            const remainingSeconds = (routeMeta?.duration ?? 0) * remainingProgress
            onNavigationUpdate?.({
              steps: navigationSteps,
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
          width: calc(34px * var(--car-scale, 1));
          height: calc(18px * var(--car-scale, 1));
          position: relative;
          transform-origin: 50% 50%;
          filter: drop-shadow(0 6px 14px rgba(2, 6, 23, 0.8));
        }
        .truck-body {
          position: absolute;
          left: calc(4px * var(--car-scale, 1));
          width: calc(17px * var(--car-scale, 1));
          bottom: calc(4px * var(--car-scale, 1));
          height: calc(10px * var(--car-scale, 1));
          border-radius: calc(3px * var(--car-scale, 1));
          background: linear-gradient(180deg, color-mix(in srgb, var(--car-color, #93c5fd) 75%, white), var(--car-color, #93c5fd));
          border: 1px solid rgba(226, 232, 240, 0.72);
        }
        .truck-chassis {
          position: absolute;
          left: calc(4px * var(--car-scale, 1));
          width: calc(24px * var(--car-scale, 1));
          bottom: calc(3px * var(--car-scale, 1));
          height: calc(2px * var(--car-scale, 1));
          border-radius: 999px;
          background: rgba(15, 23, 42, 0.85);
        }
        .truck-cab {
          position: absolute;
          right: calc(4px * var(--car-scale, 1));
          bottom: calc(4px * var(--car-scale, 1));
          width: calc(9px * var(--car-scale, 1));
          height: calc(9px * var(--car-scale, 1));
          border-radius: calc(3px * var(--car-scale, 1));
          background: linear-gradient(180deg, rgba(241, 245, 249, 0.94), rgba(203, 213, 225, 0.82));
          border: 1px solid rgba(226, 232, 240, 0.85);
        }
        .truck-windshield {
          position: absolute;
          right: calc(6px * var(--car-scale, 1));
          bottom: calc(8px * var(--car-scale, 1));
          width: calc(5px * var(--car-scale, 1));
          height: calc(3px * var(--car-scale, 1));
          border-radius: calc(1.5px * var(--car-scale, 1));
          background: linear-gradient(180deg, rgba(186, 230, 253, 0.95), rgba(125, 211, 252, 0.82));
        }
        .car-wheel {
          position: absolute;
          bottom: calc(1px * var(--car-scale, 1));
          width: calc(4px * var(--car-scale, 1));
          height: calc(4px * var(--car-scale, 1));
          border-radius: 999px;
          background: #020617;
          border: 1px solid rgba(148, 163, 184, 0.82);
        }
        .car-wheel-front { right: calc(5px * var(--car-scale, 1)); }
        .car-wheel-mid { right: calc(12px * var(--car-scale, 1)); }
        .car-wheel-back { left: calc(7px * var(--car-scale, 1)); }
        .car-marker::after {
          content: "";
          position: absolute;
          inset: calc(-2px * var(--car-scale, 1));
          border-radius: 999px;
          border: 1px solid color-mix(in srgb, var(--car-color, #93c5fd) 58%, transparent);
          opacity: 0.55;
        }
        .car-marker-id {
          position: absolute;
          top: calc(1px * var(--car-scale, 1));
          left: calc(10px * var(--car-scale, 1));
          z-index: 1;
          color: #0f172a;
          font-size: calc(6px * var(--car-scale, 1));
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
      vehicleStateRef.current = []
      completedCarsRef.current = []
      progressRef.current = []
      staticMarkersRef.current.forEach((marker) => marker.remove())
      carMarkersRef.current.forEach((marker) => marker.remove())
      staticMarkersRef.current = []
      carMarkersRef.current = []
      carMarkerElementsRef.current = []
      map.remove()
      mapRef.current = null
    }
  }, [onNavigationUpdate, vehicleProfiles])

  return (
    <div className="relative h-full w-full">
      <div ref={mapContainer} className="h-full w-full" />
      <div className="pointer-events-none absolute left-3 top-3 rounded-md border border-slate-200/25 bg-slate-950/55 px-2.5 py-1 text-[10px] uppercase tracking-[0.2em] text-slate-200 backdrop-blur sm:left-6 sm:top-5 sm:px-3 sm:py-1.5 sm:text-xs sm:tracking-[0.24em]">
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

export function DashboardSection({ drivers }: { drivers: DriverRecord[] }) {
  const vehicleProfiles = useMemo(() => buildVehicleProfiles(drivers), [drivers])
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
            <MetricBlock title="Vehiculos activos en ruta segura" value={String(vehicleProfiles.length)} unit="unidades" icon={Truck} />
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
                  <DashboardMap vehicleProfiles={vehicleProfiles} onNavigationUpdate={setNavigation} />
                  <div className="glass-card pointer-events-none absolute right-2 top-2 rounded-lg px-2 py-1 text-[10px] uppercase tracking-[0.18em] text-slate-200 sm:right-4 sm:top-4 sm:px-3 sm:py-1.5 sm:text-xs sm:tracking-[0.22em]">
                    {vehicleProfiles.length} unidades en seguimiento
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
                    className="mt-3 h-[190px] w-full sm:h-[230px]"
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
                    className="mt-3 h-[190px] w-full sm:h-[230px]"
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
                  className="mt-3 h-[180px] w-full sm:h-[220px]"
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
                {vehicleProfiles.map((car) => (
                  <div key={car.id} className="glass-card flex min-w-0 items-center justify-between rounded-lg border-0 px-3 py-2 text-sm">
                    <p className="flex min-w-0 items-center gap-2 text-slate-200">
                      <Car className="h-4 w-4 flex-shrink-0 text-sky-400" />
                      <span className="truncate">{car.code}</span>
                    </p>
                    <span className={`flex-shrink-0 rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-[0.16em] ${routeBadgeClasses(car.routeId)}`}>
                      {routeLabelById(car.routeId)}
                    </span>
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

