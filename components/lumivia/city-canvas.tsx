"use client"

import { useEffect, useRef } from "react"

interface Car {
  x: number
  y: number
  speed: number
  direction: "horizontal" | "vertical"
  directionSign: 1 | -1
  color: string
  glowColor: string
  trail: { x: number; y: number; alpha: number }[]
  stopped: boolean
}

interface EmissionZone {
  x: number
  y: number
  radius: number
  color: string
  pulsePhase: number
  pulseSpeed: number
}

type EventType = "flood" | "pothole" | "carAccident" | "roadWork"

interface MapEvent {
  type: EventType
  x: number
  y: number
  radius: number
  duration: number
  elapsed: number
  pulsePhase: number
  waterDroplets?: { x: number; y: number; vy: number; alpha: number }[]
}

export function CityCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const animationRef = useRef<number>(0)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext("2d")
    if (!ctx) return

    // Set canvas size
    const resize = () => {
      canvas.width = window.innerWidth
      canvas.height = window.innerHeight
    }
    resize()
    window.addEventListener("resize", resize)

    // Grid configuration
    const gridSpacing = 80
    const streetWidth = 6

    // Car colors based on emissions
    const carTypes = [
      { color: "#ff6b4a", glowColor: "rgba(255, 107, 74, 0.6)" },
      { color: "#ff8c42", glowColor: "rgba(255, 140, 66, 0.6)" },
      { color: "#f5c842", glowColor: "rgba(245, 200, 66, 0.5)" },
      { color: "#00e5c8", glowColor: "rgba(0, 229, 200, 0.6)" },
      { color: "#10b981", glowColor: "rgba(16, 185, 129, 0.5)" },
    ]

    // Initialize cars
    const cars: Car[] = []
    const numCars = 20

    for (let i = 0; i < numCars; i++) {
      const isHorizontal = Math.random() > 0.5
      const carType = carTypes[Math.floor(Math.random() * carTypes.length)]
      const streetIndex = Math.floor(Math.random() * (isHorizontal ? Math.ceil(canvas.height / gridSpacing) : Math.ceil(canvas.width / gridSpacing)))
      
      cars.push({
        x: isHorizontal ? Math.random() * canvas.width : streetIndex * gridSpacing,
        y: isHorizontal ? streetIndex * gridSpacing : Math.random() * canvas.height,
        speed: 0.5 + Math.random() * 2,
        direction: isHorizontal ? "horizontal" : "vertical",
        directionSign: Math.random() > 0.5 ? 1 : -1,
        color: carType.color,
        glowColor: carType.glowColor,
        trail: [],
        stopped: false,
      })
    }

    // Initialize emission zones
    const emissionZones: EmissionZone[] = [
      { x: canvas.width * 0.2, y: canvas.height * 0.3, radius: 120, color: "rgba(255, 107, 74, 0.15)", pulsePhase: 0, pulseSpeed: 0.02 },
      { x: canvas.width * 0.7, y: canvas.height * 0.2, radius: 100, color: "rgba(255, 140, 66, 0.12)", pulsePhase: Math.PI / 2, pulseSpeed: 0.015 },
      { x: canvas.width * 0.5, y: canvas.height * 0.6, radius: 150, color: "rgba(245, 200, 66, 0.1)", pulsePhase: Math.PI, pulseSpeed: 0.018 },
      { x: canvas.width * 0.15, y: canvas.height * 0.75, radius: 90, color: "rgba(0, 229, 200, 0.1)", pulsePhase: Math.PI / 4, pulseSpeed: 0.025 },
      { x: canvas.width * 0.85, y: canvas.height * 0.7, radius: 110, color: "rgba(124, 107, 255, 0.1)", pulsePhase: Math.PI / 3, pulseSpeed: 0.02 },
    ]

    // Event system
    let currentEvent: MapEvent | null = null
    let timeSinceLastEvent = 0
    const eventInterval = 300 // Time between events
    const eventDuration = 400 // How long each event lasts (longer)
    let currentEventIndex = 0 // Track which event type to show next

    const createEvent = (): MapEvent => {
      const types: EventType[] = ["flood", "speedBump", "carAccident", "roadWork"]
      const type = types[currentEventIndex]
      currentEventIndex = (currentEventIndex + 1) % types.length // Cycle to next event
      
      // Place event on a street intersection
      const streetX = Math.floor(Math.random() * Math.ceil(canvas.width / gridSpacing)) * gridSpacing
      const streetY = Math.floor(Math.random() * Math.ceil(canvas.height / gridSpacing)) * gridSpacing
      
      const event: MapEvent = {
        type,
        x: streetX,
        y: streetY,
        radius: 35,
        duration: eventDuration,
        elapsed: 0,
        pulsePhase: 0,
      }

      if (type === "flood") {
        event.waterDroplets = []
        for (let i = 0; i < 8; i++) {
          event.waterDroplets.push({
            x: event.x + (Math.random() - 0.5) * 40,
            y: event.y + (Math.random() - 0.5) * 40,
            vy: 0.5 + Math.random() * 1,
            alpha: 0.5 + Math.random() * 0.5,
          })
        }
      }

      return event
    }

    const drawFloodEvent = (event: MapEvent) => {
      event.pulsePhase += 0.04
      const waveOffset = Math.sin(event.pulsePhase) * 2

      // Water on the street - narrow strip following street line
      const waterLength = 80
      const waterThickness = streetWidth + 4 // Just slightly wider than street
      
      // Draw water base with gradient along the street
      const waterGradient = ctx.createLinearGradient(
        event.x - waterLength / 2, event.y,
        event.x + waterLength / 2, event.y
      )
      waterGradient.addColorStop(0, "rgba(30, 144, 255, 0)")
      waterGradient.addColorStop(0.15, "rgba(30, 144, 255, 0.5)")
      waterGradient.addColorStop(0.5, "rgba(65, 180, 255, 0.7)")
      waterGradient.addColorStop(0.85, "rgba(30, 144, 255, 0.5)")
      waterGradient.addColorStop(1, "rgba(30, 144, 255, 0)")

      ctx.fillStyle = waterGradient
      ctx.fillRect(event.x - waterLength / 2, event.y - waterThickness / 2, waterLength, waterThickness)

      // Animated wave lines on the water
      ctx.strokeStyle = "rgba(135, 206, 250, 0.7)"
      ctx.lineWidth = 1.5
      ctx.lineCap = "round"

      for (let w = 0; w < 2; w++) {
        ctx.beginPath()
        const yOff = (w - 0.5) * 3
        for (let x = -waterLength / 2 + 8; x < waterLength / 2 - 8; x += 4) {
          const waveY = event.y + yOff + Math.sin((x + event.pulsePhase * 15 + w * 10) * 0.15) * 2 + waveOffset * 0.5
          if (x === -waterLength / 2 + 8) {
            ctx.moveTo(event.x + x, waveY)
          } else {
            ctx.lineTo(event.x + x, waveY)
          }
        }
        ctx.stroke()
      }

      // Floating car on the water
      const carX = event.x + Math.sin(event.pulsePhase * 0.8) * 8 // Car drifts side to side
      const carY = event.y + Math.sin(event.pulsePhase * 2) * 2 + waveOffset // Car bobs with waves
      const carRotation = Math.sin(event.pulsePhase * 1.5) * 0.15 // Car tilts slightly

      ctx.save()
      ctx.translate(carX, carY)
      ctx.rotate(carRotation)

      // Car body
      ctx.fillStyle = "#ff6b4a"
      ctx.beginPath()
      ctx.roundRect(-10, -4, 20, 8, 2)
      ctx.fill()

      // Car roof/cabin
      ctx.fillStyle = "#cc5540"
      ctx.beginPath()
      ctx.roundRect(-5, -7, 10, 4, 1)
      ctx.fill()

      // Windows
      ctx.fillStyle = "rgba(135, 206, 250, 0.6)"
      ctx.fillRect(-4, -6, 3, 2)
      ctx.fillRect(1, -6, 3, 2)

      // Wheels (partially submerged)
      ctx.fillStyle = "#1a1a2e"
      ctx.beginPath()
      ctx.arc(-6, 4, 2, 0, Math.PI * 2)
      ctx.arc(6, 4, 2, 0, Math.PI * 2)
      ctx.fill()

      ctx.restore()

      // Water splashes around car
      ctx.fillStyle = "rgba(135, 206, 250, 0.5)"
      for (let i = 0; i < 4; i++) {
        const splashX = carX + (i - 1.5) * 8 + Math.sin(event.pulsePhase * 3 + i) * 3
        const splashY = carY + 3 + Math.abs(Math.sin(event.pulsePhase * 4 + i * 2)) * 4
        const splashSize = 1.5 + Math.sin(event.pulsePhase * 5 + i) * 0.5
        ctx.beginPath()
        ctx.arc(splashX, splashY, splashSize, 0, Math.PI * 2)
        ctx.fill()
      }
    }

    const drawSpeedBumpEvent = (event: MapEvent) => {
      event.pulsePhase += 0.03

      // Yellow circle background
      const gradient = ctx.createRadialGradient(event.x, event.y, 0, event.x, event.y, event.radius)
      gradient.addColorStop(0, "rgba(245, 200, 66, 0.8)")
      gradient.addColorStop(0.7, "rgba(245, 200, 66, 0.4)")
      gradient.addColorStop(1, "rgba(245, 200, 66, 0)")

      ctx.beginPath()
      ctx.arc(event.x, event.y, event.radius, 0, Math.PI * 2)
      ctx.fillStyle = gradient
      ctx.fill()

      // Stripes on street
      ctx.strokeStyle = "rgba(245, 200, 66, 0.9)"
      ctx.lineWidth = 4
      for (let i = -2; i <= 2; i++) {
        ctx.beginPath()
        ctx.moveTo(event.x + i * 8, event.y - 15)
        ctx.lineTo(event.x + i * 8, event.y + 15)
        ctx.stroke()
      }

      // Exclamation mark
      ctx.fillStyle = "#0a0f1a"
      ctx.font = "bold 24px sans-serif"
      ctx.textAlign = "center"
      ctx.textBaseline = "middle"
      ctx.fillText("!", event.x, event.y)
    }

    const drawCarAccidentEvent = (event: MapEvent) => {
      event.pulsePhase += 0.05

      // Pulsing danger zone
      const pulseScale = 1 + Math.sin(event.pulsePhase * 2) * 0.15
      const dangerGradient = ctx.createRadialGradient(event.x, event.y, 0, event.x, event.y, event.radius * pulseScale * 1.5)
      dangerGradient.addColorStop(0, "rgba(255, 60, 60, 0.3)")
      dangerGradient.addColorStop(0.5, "rgba(255, 60, 60, 0.15)")
      dangerGradient.addColorStop(1, "rgba(255, 60, 60, 0)")
      
      ctx.beginPath()
      ctx.arc(event.x, event.y, event.radius * pulseScale * 1.5, 0, Math.PI * 2)
      ctx.fillStyle = dangerGradient
      ctx.fill()

      // Smoke/debris particles
      ctx.fillStyle = "rgba(100, 100, 100, 0.4)"
      for (let i = 0; i < 6; i++) {
        const smokeX = event.x + Math.sin(event.pulsePhase * 2 + i * 1.5) * 15
        const smokeY = event.y - 10 - Math.abs(Math.sin(event.pulsePhase + i)) * 20
        const smokeSize = 4 + Math.sin(event.pulsePhase * 1.5 + i) * 2
        ctx.beginPath()
        ctx.arc(smokeX, smokeY, smokeSize, 0, Math.PI * 2)
        ctx.fill()
      }

      // First car (red, coming from left, crashed)
      ctx.save()
      ctx.translate(event.x - 12, event.y)
      ctx.rotate(0.3 + Math.sin(event.pulsePhase * 3) * 0.05) // Slight shake

      // Car body
      ctx.fillStyle = "#ff4444"
      ctx.beginPath()
      ctx.roundRect(-12, -5, 22, 10, 2)
      ctx.fill()

      // Car roof
      ctx.fillStyle = "#cc3333"
      ctx.beginPath()
      ctx.roundRect(-6, -9, 12, 5, 1)
      ctx.fill()

      // Windows
      ctx.fillStyle = "rgba(180, 220, 255, 0.7)"
      ctx.fillRect(-5, -8, 4, 3)
      ctx.fillRect(1, -8, 4, 3)

      // Wheels
      ctx.fillStyle = "#1a1a2e"
      ctx.beginPath()
      ctx.arc(-6, 5, 3, 0, Math.PI * 2)
      ctx.arc(6, 5, 3, 0, Math.PI * 2)
      ctx.fill()

      // Damage marks on front
      ctx.strokeStyle = "#aa2222"
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.moveTo(8, -3)
      ctx.lineTo(10, 0)
      ctx.lineTo(8, 3)
      ctx.stroke()

      ctx.restore()

      // Second car (blue, coming from right, crashed)
      ctx.save()
      ctx.translate(event.x + 12, event.y)
      ctx.rotate(-0.25 + Math.sin(event.pulsePhase * 3 + 1) * 0.05) // Slight shake

      // Car body
      ctx.fillStyle = "#4488ff"
      ctx.beginPath()
      ctx.roundRect(-10, -5, 22, 10, 2)
      ctx.fill()

      // Car roof
      ctx.fillStyle = "#3366cc"
      ctx.beginPath()
      ctx.roundRect(-6, -9, 12, 5, 1)
      ctx.fill()

      // Windows
      ctx.fillStyle = "rgba(180, 220, 255, 0.7)"
      ctx.fillRect(-5, -8, 4, 3)
      ctx.fillRect(1, -8, 4, 3)

      // Wheels
      ctx.fillStyle = "#1a1a2e"
      ctx.beginPath()
      ctx.arc(-6, 5, 3, 0, Math.PI * 2)
      ctx.arc(6, 5, 3, 0, Math.PI * 2)
      ctx.fill()

      // Damage marks on front
      ctx.strokeStyle = "#2255aa"
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.moveTo(-8, -3)
      ctx.lineTo(-10, 0)
      ctx.lineTo(-8, 3)
      ctx.stroke()

      ctx.restore()

      // Impact sparks/debris
      ctx.fillStyle = "rgba(255, 200, 50, 0.8)"
      for (let i = 0; i < 5; i++) {
        const sparkX = event.x + Math.sin(event.pulsePhase * 5 + i * 2) * 8
        const sparkY = event.y + Math.cos(event.pulsePhase * 4 + i * 2) * 6
        const sparkSize = 1.5 + Math.random() * 1
        ctx.beginPath()
        ctx.arc(sparkX, sparkY, sparkSize, 0, Math.PI * 2)
        ctx.fill()
      }

      // Glass fragments on ground
      ctx.fillStyle = "rgba(180, 220, 255, 0.5)"
      for (let i = 0; i < 4; i++) {
        const glassX = event.x + (i - 1.5) * 6
        const glassY = event.y + 8 + (i % 2) * 3
        ctx.fillRect(glassX, glassY, 2, 1)
      }
    }

    const drawRoadWorkEvent = (event: MapEvent) => {
      event.pulsePhase += 0.08

      // Construction stripes on the ground
      const stripeWidth = 6
      const stripeLength = 60
      
      ctx.save()
      ctx.translate(event.x, event.y)

      // Draw diagonal stripes on street
      for (let i = -4; i <= 4; i++) {
        ctx.fillStyle = i % 2 === 0 ? "rgba(255, 140, 0, 0.7)" : "rgba(30, 30, 30, 0.7)"
        ctx.save()
        ctx.rotate(Math.PI / 4)
        ctx.fillRect(i * stripeWidth - stripeLength / 2, -8, stripeWidth, 16)
        ctx.restore()
      }

      ctx.restore()

      // Worker 1 - Digging (in front)
      const worker1X = event.x - 10
      const worker1Y = event.y

      // Pickaxe animation
      const pickAngle = Math.sin(event.pulsePhase) * 0.6 - 0.3
      
      ctx.save()
      ctx.translate(worker1X, worker1Y)

      // Body (orange vest)
      ctx.fillStyle = "#ff8c00"
      ctx.fillRect(-4, -6, 8, 10)
      
      // Legs
      ctx.fillStyle = "#2a4d69"
      ctx.fillRect(-3, 4, 3, 6)
      ctx.fillRect(0, 4, 3, 6)

      // Head
      ctx.fillStyle = "#deb887"
      ctx.beginPath()
      ctx.arc(0, -10, 5, 0, Math.PI * 2)
      ctx.fill()

      // Hard hat (yellow)
      ctx.fillStyle = "#f5c842"
      ctx.beginPath()
      ctx.ellipse(0, -14, 6, 3, 0, 0, Math.PI * 2)
      ctx.fill()
      ctx.fillRect(-5, -14, 10, 2)

      // Arms holding pickaxe
      ctx.save()
      ctx.rotate(pickAngle)
      
      // Arm
      ctx.fillStyle = "#ff8c00"
      ctx.fillRect(3, -8, 12, 3)
      
      // Pickaxe handle
      ctx.fillStyle = "#8b4513"
      ctx.fillRect(8, -14, 2, 12)
      
      // Pickaxe head
      ctx.fillStyle = "#555555"
      ctx.beginPath()
      ctx.moveTo(6, -16)
      ctx.lineTo(12, -16)
      ctx.lineTo(14, -14)
      ctx.lineTo(4, -14)
      ctx.closePath()
      ctx.fill()

      ctx.restore()

      // Dust particles when hitting ground
      if (Math.sin(event.pulsePhase) < -0.5) {
        ctx.fillStyle = "rgba(139, 119, 101, 0.6)"
        for (let i = 0; i < 4; i++) {
          const dustX = 5 + Math.random() * 8
          const dustY = 2 + Math.random() * 6
          ctx.beginPath()
          ctx.arc(dustX, dustY, 2, 0, Math.PI * 2)
          ctx.fill()
        }
      }

      ctx.restore()

      // Worker 2 - Holding stop sign (behind)
      const worker2X = event.x + 20
      const worker2Y = event.y - 5

      ctx.save()
      ctx.translate(worker2X, worker2Y)

      // Body (orange vest)
      ctx.fillStyle = "#ff8c00"
      ctx.fillRect(-4, -6, 8, 10)
      
      // Legs
      ctx.fillStyle = "#2a4d69"
      ctx.fillRect(-3, 4, 3, 6)
      ctx.fillRect(0, 4, 3, 6)

      // Head
      ctx.fillStyle = "#deb887"
      ctx.beginPath()
      ctx.arc(0, -10, 5, 0, Math.PI * 2)
      ctx.fill()

      // Hard hat (yellow)
      ctx.fillStyle = "#f5c842"
      ctx.beginPath()
      ctx.ellipse(0, -14, 6, 3, 0, 0, Math.PI * 2)
      ctx.fill()
      ctx.fillRect(-5, -14, 10, 2)

      // Arm holding sign
      ctx.fillStyle = "#ff8c00"
      ctx.fillRect(-8, -6, 4, 3)

      // Sign pole
      ctx.fillStyle = "#666666"
      ctx.fillRect(-14, -35, 2, 32)

      // Stop sign (octagon-ish circle for simplicity)
      ctx.fillStyle = "#cc0000"
      ctx.beginPath()
      ctx.arc(-13, -40, 10, 0, Math.PI * 2)
      ctx.fill()

      // Border
      ctx.strokeStyle = "#ffffff"
      ctx.lineWidth = 1.5
      ctx.beginPath()
      ctx.arc(-13, -40, 8, 0, Math.PI * 2)
      ctx.stroke()

      // ALTO text
      ctx.fillStyle = "#ffffff"
      ctx.font = "bold 6px sans-serif"
      ctx.textAlign = "center"
      ctx.textBaseline = "middle"
      ctx.fillText("ALTO", -13, -40)

      ctx.restore()

      // Traffic cone
      ctx.save()
      ctx.translate(event.x - 25, event.y + 5)
      
      // Cone body
      ctx.fillStyle = "#ff6600"
      ctx.beginPath()
      ctx.moveTo(0, -12)
      ctx.lineTo(-5, 0)
      ctx.lineTo(5, 0)
      ctx.closePath()
      ctx.fill()
      
      // White stripes
      ctx.fillStyle = "#ffffff"
      ctx.fillRect(-3, -8, 6, 2)
      ctx.fillRect(-4, -4, 8, 2)
      
      // Base
      ctx.fillStyle = "#ff6600"
      ctx.fillRect(-6, 0, 12, 2)

      ctx.restore()
    }

    const isCarNearEvent = (car: Car, event: MapEvent): boolean => {
      const stopDistance = event.radius + 40
      const dx = car.x - event.x
      const dy = car.y - event.y
      const distance = Math.sqrt(dx * dx + dy * dy)

      // Check if car is approaching the event (not past it)
      if (car.direction === "horizontal") {
        const isApproaching = (car.directionSign === 1 && car.x < event.x) || (car.directionSign === -1 && car.x > event.x)
        return distance < stopDistance && Math.abs(dy) < gridSpacing / 2 && isApproaching
      } else {
        const isApproaching = (car.directionSign === 1 && car.y < event.y) || (car.directionSign === -1 && car.y > event.y)
        return distance < stopDistance && Math.abs(dx) < gridSpacing / 2 && isApproaching
      }
    }

    // Animation loop
    const animate = () => {
      ctx.fillStyle = "#0a0f1a"
      ctx.fillRect(0, 0, canvas.width, canvas.height)

      // Draw pulsing emission zones
      emissionZones.forEach((zone) => {
        zone.pulsePhase += zone.pulseSpeed
        const pulseScale = 1 + Math.sin(zone.pulsePhase) * 0.3
        const currentRadius = zone.radius * pulseScale

        const gradient = ctx.createRadialGradient(zone.x, zone.y, 0, zone.x, zone.y, currentRadius)
        gradient.addColorStop(0, zone.color)
        gradient.addColorStop(0.5, zone.color.replace(/[\d.]+\)$/, "0.05)"))
        gradient.addColorStop(1, "transparent")

        ctx.beginPath()
        ctx.arc(zone.x, zone.y, currentRadius, 0, Math.PI * 2)
        ctx.fillStyle = gradient
        ctx.fill()
      })

      // Draw grid streets
      ctx.strokeStyle = "rgba(31, 41, 55, 0.7)"
      ctx.lineWidth = streetWidth
      ctx.lineCap = "round"

      // Horizontal streets
      for (let y = 0; y < canvas.height; y += gridSpacing) {
        ctx.beginPath()
        ctx.moveTo(0, y)
        ctx.lineTo(canvas.width, y)
        ctx.stroke()
      }

      // Vertical streets
      for (let x = 0; x < canvas.width; x += gridSpacing) {
        ctx.beginPath()
        ctx.moveTo(x, 0)
        ctx.lineTo(x, canvas.height)
        ctx.stroke()
      }

      // Event system logic
      timeSinceLastEvent++

      if (!currentEvent && timeSinceLastEvent >= eventInterval) {
        currentEvent = createEvent()
        timeSinceLastEvent = 0
      }

      // Draw and update current event
      if (currentEvent) {
        currentEvent.elapsed++

        switch (currentEvent.type) {
          case "flood":
            drawFloodEvent(currentEvent)
            break
          case "speedBump":
            drawSpeedBumpEvent(currentEvent)
            break
          case "carAccident":
            drawCarAccidentEvent(currentEvent)
            break
          case "roadWork":
            drawRoadWorkEvent(currentEvent)
            break
        }

        if (currentEvent.elapsed >= currentEvent.duration) {
          currentEvent = null
        }
      }

      // Update and draw cars
      cars.forEach((car) => {
        // Check if car should stop
        if (currentEvent) {
          car.stopped = isCarNearEvent(car, currentEvent)
        } else {
          car.stopped = false
        }

        // Add current position to trail
        car.trail.unshift({ x: car.x, y: car.y, alpha: 1 })
        
        // Limit trail length
        if (car.trail.length > 15) {
          car.trail.pop()
        }

        // Fade trail
        car.trail.forEach((point, index) => {
          point.alpha = 1 - index / car.trail.length
        })

        // Draw trail
        car.trail.forEach((point, index) => {
          if (index === 0) return
          const size = 4 * point.alpha
          ctx.beginPath()
          ctx.arc(point.x, point.y, size, 0, Math.PI * 2)
          ctx.fillStyle = car.glowColor.replace(/[\d.]+\)$/, `${point.alpha * 0.4})`)
          ctx.fill()
        })

        // Draw car glow
        const glowGradient = ctx.createRadialGradient(car.x, car.y, 0, car.x, car.y, 20)
        glowGradient.addColorStop(0, car.glowColor)
        glowGradient.addColorStop(1, "transparent")
        ctx.beginPath()
        ctx.arc(car.x, car.y, 20, 0, Math.PI * 2)
        ctx.fillStyle = glowGradient
        ctx.fill()

        // Draw car
        ctx.beginPath()
        ctx.arc(car.x, car.y, 4, 0, Math.PI * 2)
        ctx.fillStyle = car.color
        ctx.fill()

        // Move car only if not stopped
        if (!car.stopped) {
          if (car.direction === "horizontal") {
            car.x += car.speed * car.directionSign
            if (car.x > canvas.width + 20) car.x = -20
            if (car.x < -20) car.x = canvas.width + 20
          } else {
            car.y += car.speed * car.directionSign
            if (car.y > canvas.height + 20) car.y = -20
            if (car.y < -20) car.y = canvas.height + 20
          }
        }
      })

      animationRef.current = requestAnimationFrame(animate)
    }

    animate()

    return () => {
      window.removeEventListener("resize", resize)
      cancelAnimationFrame(animationRef.current)
    }
  }, [])

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 w-full h-full"
      style={{ zIndex: 0 }}
    />
  )
}
