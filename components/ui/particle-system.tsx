"use client"

import { useEffect, useRef } from "react"

interface Particle {
  x: number
  y: number
  size: number
  baseX: number
  baseY: number
  density: number
  color: string
}

export function ParticleSystem() {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext("2d")
    if (!ctx) return

    let particleArray: Particle[] = []

    // Resize canvas to fill window
    const handleResize = () => {
      canvas.width = window.innerWidth
      canvas.height = window.innerHeight
      initParticles()
    }

    let mouse = {
      x: window.innerWidth / 2,
      y: window.innerHeight / 2,
      radius: 150
    }

    const mouseMoveHandler = (e: MouseEvent) => {
      mouse.x = e.x
      mouse.y = e.y
    }
    
    // Set initial size
    canvas.width = window.innerWidth
    canvas.height = window.innerHeight

    window.addEventListener("resize", handleResize)
    window.addEventListener("mousemove", mouseMoveHandler)

    // Colors matching the "premium dark glowing" vibe
    const baseColors = [
      "rgba(167, 219, 13, 0.8)",  // yellow-green
      "rgba(88, 201, 153, 0.7)",  // teal
      "rgba(255, 255, 255, 0.5)", // white spark
      "rgba(102, 126, 234, 0.3)"  // subtle purple/blue
    ]

    function initParticles() {
      particleArray = []
      // Number of particles depends on screen size
      const numberOfParticles = (canvas.width * canvas.height) / 8000
      
      for (let i = 0; i < numberOfParticles; i++) {
        const x = Math.random() * canvas.width
        const y = Math.random() * canvas.height
        const size = Math.random() * 2 + 0.5
        const color = baseColors[Math.floor(Math.random() * baseColors.length)]
        // Different movement density
        const density = (Math.random() * 20) + 1
        
        particleArray.push({
          x,
          y,
          size,
          baseX: x,
          baseY: y,
          density,
          color
        })
      }
    }

    function animate() {
      // Clear with a dark fade effect to create trails
      ctx.fillStyle = "rgba(4, 7, 10, 0.15)" // Very dark blue/black
      ctx.fillRect(0, 0, canvas.width, canvas.height)

      for (let i = 0; i < particleArray.length; i++) {
        const p = particleArray[i]

        // Interaction logic
        let dx = mouse.x - p.x
        let dy = mouse.y - p.y
        let distance = Math.sqrt(dx * dx + dy * dy)
        let forceDirectionX = dx / distance
        let forceDirectionY = dy / distance

        // max distance
        const maxDistance = mouse.radius
        let force = (maxDistance - distance) / maxDistance

        // If distance is less than max distance, push particles away softly but also add some drift
        if (distance < maxDistance) {
          let directionX = (forceDirectionX * force * p.density) * 0.6
          let directionY = (forceDirectionY * force * p.density) * 0.6
          p.x -= directionX
          p.y -= directionY
        } else {
          // Slow return to base position with an organic floating behavior
          if (p.x !== p.baseX) {
            let dx = p.x - p.baseX
            p.x -= dx / 50
          }
          if (p.y !== p.baseY) {
            let dy = p.y - p.baseY
            p.y -= dy / 50
          }
        }

        // Draw particle
        ctx.beginPath()
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2)
        ctx.closePath()
        ctx.fillStyle = p.color
        
        // Add glow occasionally or based on size
        if (p.size > 1.5) {
          ctx.shadowBlur = 10
          ctx.shadowColor = p.color
        } else {
          ctx.shadowBlur = 0
        }

        ctx.fill()
      }
      requestAnimationFrame(animate)
    }

    initParticles()
    animate()

    return () => {
      window.removeEventListener("resize", handleResize)
      window.removeEventListener("mousemove", mouseMoveHandler)
    }
  }, [])

  return (
    <canvas
      ref={canvasRef}
      className="absolute top-0 left-0 w-full h-full object-cover pointer-events-none z-0"
      style={{ mixBlendMode: "screen" }}
    />
  )
}
