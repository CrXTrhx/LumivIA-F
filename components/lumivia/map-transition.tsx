"use client"

import { useEffect, useState } from "react"
import { CityCanvas } from "./city-canvas"

interface MapTransitionProps {
  children: React.ReactNode
}

export function MapTransition({ children }: MapTransitionProps) {
  const [phase, setPhase] = useState<'loading' | 'transitioning' | 'complete'>('loading')
  const [progress, setProgress] = useState(0)
  const [canvasOpacity, setCanvasOpacity] = useState(1)
  const [mapOpacity, setMapOpacity] = useState(0)

  useEffect(() => {
    // Fase 1: Carga inicial - progress aumenta
    const loadInterval = setInterval(() => {
      setProgress(prev => {
        if (prev >= 90) {
          clearInterval(loadInterval)
          return 90
        }
        return prev + 2
      })
    }, 40)

    // Fase 2: Transición después de 2 segundos
    const transitionTimeout = setTimeout(() => {
      clearInterval(loadInterval)
      setProgress(100)
      setPhase('transitioning')

      // Fade out canvas, fade in map (500ms)
      let opacity = 1
      const fadeInterval = setInterval(() => {
        opacity -= 0.04
        const newOpacity = Math.max(0, opacity)
        setCanvasOpacity(newOpacity)
        setMapOpacity(Math.min(1, 1 - opacity))

        if (opacity <= 0) {
          clearInterval(fadeInterval)
          setPhase('complete')
        }
      }, 20)
    }, 2000)

    return () => {
      clearInterval(loadInterval)
      clearTimeout(transitionTimeout)
    }
  }, [])

  return (
    <div className="relative w-full h-full">
      {/* Canvas con carritos (se desvanece) */}
      <div 
        className="absolute inset-0 transition-opacity duration-100"
        style={{ opacity: canvasOpacity }}
      >
        <CityCanvas />
      </div>

      {/* Mapa real (aparece) */}
      <div 
        className="absolute inset-0 transition-opacity duration-500"
        style={{ opacity: mapOpacity }}
      >
        {children}
      </div>

      {/* Progress bar overlay - CENTRADO */}
      {phase !== 'complete' && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/40">
          <div className="bg-[#111827]/95 backdrop-blur-md px-12 py-10 rounded-2xl border border-[#374151] shadow-2xl z-10">
            <div className="text-center mb-6">
              <p className="font-sans text-xl text-[#e5e7eb] mb-4">
                Cargando mapa de CDMX...
              </p>
              <p className="font-mono text-5xl font-bold text-[#00e5c8] tracking-wider">
                {progress}%
              </p>
            </div>
            <div className="w-96 h-3 bg-[#1f2937] rounded-full overflow-hidden mb-5 shadow-inner">
              <div 
                className="h-full bg-gradient-to-r from-[#00e5c8] to-[#00b8a9] rounded-full transition-all duration-150 ease-out shadow-[0_0_15px_rgba(0,229,200,0.6)]"
                style={{ width: `${progress}%` }}
              />
            </div>
            <div className="flex items-center justify-center gap-3">
              <div className="w-2.5 h-2.5 rounded-full bg-[#00e5c8] animate-pulse shadow-[0_0_8px_rgba(0,229,200,0.8)]" />
              <span className="font-sans text-base text-[#9ca3af]">
                {progress < 30 && "Inicializando vista de ciudad..."}
                {progress >= 30 && progress < 70 && "Cargando datos geoespaciales..."}
                {progress >= 70 && progress < 100 && "Preparando mapa interactivo..."}
                {progress === 100 && "¡Listo!"}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
