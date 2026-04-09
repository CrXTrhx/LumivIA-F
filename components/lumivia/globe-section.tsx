"use client"

import { useEffect, useRef, useState } from "react"
import mapboxgl from "mapbox-gl"
import "mapbox-gl/dist/mapbox-gl.css"

mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN || ""

interface GlobeSectionProps {
  onTransitionStart?: () => void
  isTransitioning?: boolean
}

export default function GlobeSection({ onTransitionStart, isTransitioning = false }: GlobeSectionProps) {
  const mapContainer = useRef<HTMLDivElement | null>(null)
  const mapRef = useRef<mapboxgl.Map | null>(null)
  const animFrameRef = useRef<number>(0)
  const [isLoaded, setIsLoaded] = useState(false)

  useEffect(() => {
    if (!mapContainer.current || mapRef.current) return

    const map = new mapboxgl.Map({
      container: mapContainer.current,
      style: "mapbox://styles/mapbox/satellite-v9",
      center: [-99.1332, 19.4326],
      zoom: 2.5,
      pitch: 0,
      bearing: 0,
      projection: "globe",
      interactive: false,
    })

    map.on("style.load", () => {
      map.setFog({
        color: "rgb(3, 5, 12)",
        "high-color": "rgb(8, 12, 25)",
        "horizon-blend": 0.05,
        "space-color": "rgb(0, 0, 0)",
        "star-intensity": 0.8,
      })
      setIsLoaded(true)
    })

    mapRef.current = map

    return () => {
      cancelAnimationFrame(animFrameRef.current)
      map.remove()
      mapRef.current = null
    }
  }, [])

  useEffect(() => {
    if (!mapRef.current || !isLoaded) return

    let angle = 0
    const rotate = () => {
      angle -= 0.01
      mapRef.current?.rotateTo(angle, { duration: 0 })
      animFrameRef.current = requestAnimationFrame(rotate)
    }

    if (!isTransitioning) {
      animFrameRef.current = requestAnimationFrame(rotate)
    }

    return () => cancelAnimationFrame(animFrameRef.current)
  }, [isLoaded, isTransitioning])

  useEffect(() => {
    if (!mapRef.current || !isTransitioning) return

    cancelAnimationFrame(animFrameRef.current)
    mapRef.current.flyTo({
      center: [-99.1332, 19.4326],
      zoom: 14.6,
      pitch: 58,
      bearing: -20,
      duration: 4600,
      essential: true,
      easing: (t) => 1 - Math.pow(1 - t, 3),
    })

    mapRef.current.once("moveend", () => {
      setTimeout(() => {
        if (mapRef.current) {
          mapRef.current.setStyle("mapbox://styles/mapbox/dark-v11")
          mapRef.current.once("style.load", () => {
            onTransitionStart?.()
          })
        }
      }, 180)
    })
  }, [isTransitioning, onTransitionStart])

  return (
    <div
      ref={mapContainer}
      style={{
        width: "100%",
        height: "100%",
        backgroundColor: "#000000",
      }}
    />
  )
}

