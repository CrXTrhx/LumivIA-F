"use client"

import { useState } from "react"
import { AnimatedSection } from "@/components/ui/animated-section"
import { FeatureCard } from "./feature-card"
import { Activity, MapPin, Route, ArrowRight, ChevronDown } from "lucide-react"

interface HomeSectionProps {
  onNavigateToMap: () => void
  overlayVisible?: boolean
}

export function HomeSection({ onNavigateToMap, overlayVisible = true }: HomeSectionProps) {
  const [showDetails, setShowDetails] = useState(false)

  const handleNavigate = () => {
    onNavigateToMap()
  }

  const handleToggleDetails = () => {
    setShowDetails(!showDetails)
  }

  return (
    <div 
      className="absolute inset-0 flex flex-col items-center justify-center"
      style={{
        opacity: overlayVisible ? 1 : 0,
        transition: "opacity 0.5s ease",
        zIndex: 10,
        pointerEvents: overlayVisible ? "auto" : "none",
      }}
    >
      {/* Gradient overlay */}
      <div 
        className="absolute inset-0"
        style={{
          background: `
            radial-gradient(ellipse 56% 50% at 50% 48%, rgba(4, 10, 24, 0.02) 0%, rgba(4, 10, 24, 0.11) 38%, rgba(4, 10, 24, 0.5) 100%),
            radial-gradient(ellipse 94% 74% at 50% 52%, rgba(59, 130, 246, 0.2) 0%, rgba(29, 78, 216, 0.08) 42%, rgba(6, 10, 20, 0.0) 72%),
            linear-gradient(to bottom, rgba(3, 7, 18, 0.82) 0%, rgba(6, 10, 20, 0.2) 34%, rgba(6, 10, 20, 0.24) 70%, rgba(6, 10, 20, 0.9) 100%)
          `,
          backdropFilter: "blur(1px)",
          transition: "opacity 700ms ease, backdrop-filter 700ms ease",
        }}
      />

      <div className="relative z-10 max-w-4xl mx-auto px-6 text-center pointer-events-none [&_button]:pointer-events-auto">
        {/* Logo with Orbitron */}
        <AnimatedSection delay={0}>
          <h1 className="font-display text-5xl md:text-7xl tracking-wider text-white mb-4 drop-shadow-[0_0_24px_rgba(255,255,255,0.35)]">
            <span className="font-bold">Lumiv</span>
            <span className="text-[#e2f3ff] font-bold">IA</span>
          </h1>
        </AnimatedSection>

        {/* Stats */}
        <AnimatedSection delay={300}>
          <div className="flex flex-wrap justify-center gap-4 mb-10">
            <div className="px-8 py-4 bg-[#0f1730]/80 backdrop-blur-md border border-[#2d447a] rounded-xl shadow-[0_0_30px_rgba(59,130,246,0.25)]">
              <p className="font-display text-3xl md:text-4xl text-[#7ee7ff] mb-1 drop-shadow-[0_0_12px_rgba(126,231,255,0.5)]">9.2M</p>
              <p className="text-sm text-[#b3c4e9]">habitantes beneficiados</p>
            </div>
            <div className="px-8 py-4 bg-[#0f1730]/80 backdrop-blur-md border border-[#2d447a] rounded-xl shadow-[0_0_30px_rgba(59,130,246,0.25)]">
              <p className="font-display text-3xl md:text-4xl text-[#7ee7ff] mb-1 drop-shadow-[0_0_12px_rgba(126,231,255,0.5)]">400+</p>
              <p className="text-sm text-[#b3c4e9]">puntos de inundación mapeados</p>
            </div>
          </div>
        </AnimatedSection>

        {/* Buttons */}
        <AnimatedSection delay={400}>
          <div className="flex flex-wrap gap-4 justify-center mb-8">
            <button
              onClick={handleNavigate}
              className="group flex items-center gap-2 px-8 py-3 bg-[#7ee7ff] text-[#060a14] font-semibold rounded-full hover:bg-[#9aeeff] transition-all shadow-[0_0_28px_rgba(126,231,255,0.4)]"
            >
              Ver mapa en vivo
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </button>
             
            <button
              onClick={handleToggleDetails}
              className="group flex items-center gap-2 px-8 py-3 border border-[#355089] bg-[#0f1730]/45 text-[#b9c9ea] rounded-full hover:border-[#7ee7ff] hover:text-[#d8f7ff] transition-all"
            >
              Conocer más
              <ChevronDown className={`w-4 h-4 transition-transform ${showDetails ? 'rotate-180' : ''}`} />
            </button>
          </div>
        </AnimatedSection>

        {/* Feature cards */}
        {showDetails && (
          <AnimatedSection delay={0}>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 max-w-4xl mx-auto mb-8 mt-8">
              <FeatureCard
                icon={<Activity className="w-5 h-5" />}
                title="Emisiones en tiempo real"
                description="Detección vehicular con YOLOv8 para estimar CO2, NOx y PM2.5 por segmento vial"
              />
              <FeatureCard
                icon={<MapPin className="w-5 h-5" />}
                title="Riesgo de inundación"
                description="Cálculo dinámico usando datos de elevación INEGI y pronóstico climático"
              />
              <FeatureCard
                icon={<Route className="w-5 h-5" />}
                title="Rutas optimizadas"
                description="Caminos con menor exposición a contaminantes y menor riesgo de inundación"
              />
            </div>
          </AnimatedSection>
        )}
      </div>
    </div>
  )
}
