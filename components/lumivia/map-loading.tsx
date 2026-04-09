"use client"

import { useEffect, useState } from "react"
import { cn } from "@/lib/utils"

interface MapLoadingScreenProps {
  onComplete: () => void
  duration?: number
}

interface Building {
  x: number
  y: number
  width: number
  height: number
  color: string
  delay: number
  opacity: number
  scale: number
}

function createInitialBuildings(): Building[] {
  const initialBuildings: Building[] = []
  const colors = ['#1f2937', '#374151', '#4b5563', '#1e3a5f', '#2d3748']

  for (let row = 0; row < 12; row++) {
    for (let col = 0; col < 16; col++) {
      if (Math.random() > 0.2) {
        const width = 30 + Math.random() * 40
        const height = 20 + Math.random() * 30
        const delay = (row * 16 + col) * 15

        initialBuildings.push({
          x: col * 55 + 10,
          y: row * 45 + 10,
          width,
          height,
          color: colors[Math.floor(Math.random() * colors.length)],
          delay,
          opacity: 0,
          scale: 0.8
        })
      }
    }
  }

  return initialBuildings
}

export function MapLoadingScreen({ onComplete, duration = 2800 }: MapLoadingScreenProps) {
  const [progress, setProgress] = useState(0)
  const [zoom, setZoom] = useState(0.3)
  const [showContent, setShowContent] = useState(false)
  const [fadeOut, setFadeOut] = useState(false)
  const [buildings, setBuildings] = useState<Building[]>(() => createInitialBuildings())
  const [phase, setPhase] = useState<'initial' | 'zooming' | 'complete'>('initial')

  useEffect(() => {
    const showTimer = setTimeout(() => {
      setShowContent(true)
      setPhase('zooming')
      
      const zoomInterval = setInterval(() => {
        setZoom(prev => {
          const next = prev + 0.02
          if (next >= 1) {
            clearInterval(zoomInterval)
            return 1
          }
          return next
        })
      }, 20)
      
      const buildingInterval = setInterval(() => {
        setBuildings(prev => {
          const updated = prev.map(b => {
            if (b.delay <= 0) {
              return { ...b, opacity: Math.min(b.opacity + 0.15, 1), scale: Math.min(b.scale + 0.02, 1) }
            }
            return { ...b, delay: b.delay - 20 }
          })
          
          if (updated.every(b => b.opacity >= 1)) {
            clearInterval(buildingInterval)
          }
          
          return updated
        })
      }, 50)
      
      return () => {
        clearInterval(zoomInterval)
        clearInterval(buildingInterval)
      }
    }, 300)
    
    const progressInterval = setInterval(() => {
      setProgress(prev => {
        if (prev >= 100) {
          clearInterval(progressInterval)
          return 100
        }
        return prev + 1
      })
    }, duration / 100)
    
    const completeTimer = setTimeout(() => {
      setPhase('complete')
      setFadeOut(true)
      
      setTimeout(() => {
        onComplete()
      }, 400)
    }, duration)
    
    return () => {
      clearTimeout(showTimer)
      clearTimeout(completeTimer)
      clearInterval(progressInterval)
    }
  }, [duration, onComplete])

  return (
    <div
      className={cn(
        "fixed inset-0 bg-[#0d1520] z-50 flex flex-col items-center justify-center transition-opacity duration-500",
        fadeOut ? "opacity-0" : "opacity-100"
      )}
    >
      <div
        className="relative w-full px-4 sm:px-6"
        style={{
          transform: `scale(${zoom})`,
          transition: phase === 'zooming' ? 'transform 0.02s linear' : 'none'
        }}
      >
        <div className="relative mx-auto h-[220px] w-full max-w-[900px] bg-[#0d1520] overflow-hidden rounded-lg border border-[#1f2937] sm:h-[360px] md:h-[500px] lg:h-[600px]">
          <svg
            className="absolute inset-0 w-full h-full"
            viewBox="0 0 900 600"
            preserveAspectRatio="xMidYMid slice"
          >
            <defs>
              <pattern id="grid" width="55" height="45" patternUnits="userSpaceOnUse">
                <path
                  d="M 55 0 L 0 0 0 45"
                  fill="none"
                  stroke="#1a2744"
                  strokeWidth="1"
                />
              </pattern>
              
              <filter id="glow">
                <feGaussianBlur stdDeviation="2" result="coloredBlur"/>
                <feMerge>
                  <feMergeNode in="coloredBlur"/>
                  <feMergeNode in="SourceGraphic"/>
                </feMerge>
              </filter>
            </defs>
            
            <rect width="100%" height="100%" fill="url(#grid)" />
            
            {buildings.map((building, i) => (
              <g key={i}>
                <rect
                  x={building.x}
                  y={building.y}
                  width={building.width}
                  height={building.height}
                  fill={building.color}
                  rx="2"
                  style={{
                    opacity: building.opacity,
                    transform: `scale(${building.scale})`,
                    transformOrigin: `${building.x + building.width/2}px ${building.y + building.height/2}px`
                  }}
                />
                {building.opacity > 0.5 && building.width > 35 && building.height > 25 && (
                  <g style={{ opacity: building.opacity * 0.5 }}>
                    {[...Array(Math.floor(building.width / 12))].map((_, wi) => (
                      <rect
                        key={wi}
                        x={building.x + 4 + wi * 12}
                        y={building.y + 4}
                        width="6"
                        height="3"
                        fill="#00e5c8"
                        opacity="0.3"
                        rx="0.5"
                      />
                    ))}
                    {[...Array(Math.floor(building.width / 12))].map((_, wi) => (
                      <rect
                        key={`bottom-${wi}`}
                        x={building.x + 4 + wi * 12}
                        y={building.y + building.height - 7}
                        width="6"
                        height="3"
                        fill="#00e5c8"
                        opacity="0.3"
                        rx="0.5"
                      />
                    ))}
                  </g>
                )}
              </g>
            ))}
            
            <line
              x1="450"
              y1="300"
              x2="900"
              y2="200"
              stroke="#243656"
              strokeWidth="3"
              opacity={zoom > 0.5 ? 1 : 0}
              style={{ transition: 'opacity 0.3s' }}
            />
            <line
              x1="450"
              y1="300"
              x2="600"
              y2="550"
              stroke="#243656"
              strokeWidth="3"
              opacity={zoom > 0.6 ? 1 : 0}
              style={{ transition: 'opacity 0.3s' }}
            />
          </svg>
          
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center">
              <div className="font-mono text-2xl text-[#00e5c8] mb-2 opacity-80">
                CDMX
              </div>
              <div className="font-sans text-sm text-[#9ca3af]">
                [-99.1332, 19.4326]
              </div>
            </div>
          </div>
          
          {zoom > 0.7 && (
            <>
              <div
                className="absolute w-4 h-4 bg-[#ff6b4a] rounded-full animate-ping"
                style={{ left: '35%', top: '40%', opacity: 0.7 }}
              />
              <div
                className="absolute w-4 h-4 bg-[#ff6b4a] rounded-full"
                style={{ left: '35%', top: '40%' }}
              />
              
              <div
                className="absolute w-4 h-4 bg-[#7c6bff] rounded-full animate-ping"
                style={{ left: '60%', top: '55%', opacity: 0.7 }}
              />
              <div
                className="absolute w-4 h-4 bg-[#7c6bff] rounded-full"
                style={{ left: '60%', top: '55%' }}
              />
              
              <div
                className="absolute w-4 h-4 bg-[#f5c842] rounded-full animate-ping"
                style={{ left: '50%', top: '35%', opacity: 0.7 }}
              />
              <div
                className="absolute w-4 h-4 bg-[#f5c842] rounded-full"
                style={{ left: '50%', top: '35%' }}
              />
            </>
          )}
        </div>
      </div>
      
      <div className="mt-6 w-full max-w-96 px-4 sm:mt-8 sm:px-0">
        <div className="flex items-center justify-between mb-2">
          <span className="font-sans text-sm text-[#9ca3af]">
            Cargando datos urbanos de CDMX...
          </span>
          <span className="font-mono text-sm text-[#00e5c8]">
            {Math.round(progress)}%
          </span>
        </div>
        <div className="h-1.5 bg-[#1f2937] rounded-full overflow-hidden">
          <div
            className="h-full bg-[#00e5c8] rounded-full transition-all duration-100"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>
      
      <div className="mt-5 flex items-center gap-3 px-4 text-center sm:mt-6 sm:px-0">
        <div className="w-2 h-2 rounded-full bg-[#00e5c8] animate-pulse" />
        <span className="font-sans text-sm text-[#6b7280]">
          {progress < 30 && "Inicializando mapas..."}
          {progress >= 30 && progress < 60 && "Cargando edificios..."}
          {progress >= 60 && progress < 90 && "Sincronizando datos..."}
          {progress >= 90 && "Listo para mostrar"}
        </span>
      </div>
    </div>
  )
}
