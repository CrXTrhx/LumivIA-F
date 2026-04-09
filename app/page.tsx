"use client"

import { useState } from "react"
import { Navbar } from "@/components/lumivia/navbar"
import { HomeSection } from "@/components/lumivia/home-section"
import GlobeThree from "@/components/lumivia/globe-three"
import GlobeSection from "@/components/lumivia/globe-section"
import MapSection from "@/components/lumivia/map-section"
import { DashboardSection } from "@/components/lumivia/dashboard-section"
import { SimulationSection } from "@/components/lumivia/simulation-section"
import { ReportsSection } from "@/components/lumivia/reports-section"
import { AnimatedSection } from "@/components/ui/animated-section"
import { Toaster } from "@/components/ui/toaster"

type Tab = "home" | "mapa" | "dashboard" | "simulacion" | "reportes"

export default function LumivIADashboard() {
  const [activeTab, setActiveTab] = useState<Tab>("home")
  const [isTransitioning, setIsTransitioning] = useState(false)
  const [overlayVisible, setOverlayVisible] = useState(true)
  const [showMap, setShowMap] = useState(false)

  const handleTabChange = (tab: Tab) => {
    if (tab === "home") {
      setOverlayVisible(true)
      setIsTransitioning(false)
      setShowMap(false)
    } else if (tab === "mapa") {
      setShowMap(true)
    }
    setActiveTab(tab)
  }

  const handleNavigateToMap = () => {
    setOverlayVisible(false)
    setShowMap(true)
    setIsTransitioning(true)
  }

  const handleTransitionComplete = () => {
    setActiveTab("mapa")
    setTimeout(() => {
      setIsTransitioning(false)
    }, 720)
  }

  const isHomeOrTransitioning = activeTab === "home" || isTransitioning
  const showGlobeLayer = activeTab === "home" || (activeTab === "mapa" && isTransitioning)
  const usesFullscreenCanvas = activeTab === "home" || activeTab === "mapa" || isTransitioning
  const showNavbar = activeTab !== "mapa" && !isTransitioning
  const showMapBackButton = activeTab === "mapa" || isTransitioning

  return (
    <div className="min-h-screen bg-[#060a14]">
      {showNavbar && <Navbar activeTab={activeTab} onTabChange={handleTabChange} />}
      {showMapBackButton && (
        <button
          onClick={() => handleTabChange("home")}
          className="fixed left-3 top-3 z-[80] rounded-full border border-[#1e293b] bg-[#060a14]/90 px-4 py-2 text-sm backdrop-blur-xl transition-opacity hover:opacity-85"
        >
          <span className="font-display text-base tracking-wider">
            <span className="text-white">Lumiv</span>
            <span className="text-[#00d4aa]">IA</span>
          </span>
        </button>
      )}

      <main
        className={
          usesFullscreenCanvas
            ? "relative h-screen w-full overflow-hidden"
            : "relative min-h-screen w-full overflow-x-hidden overflow-y-auto pt-14"
        }
      >
        {/* Globe background - visible on home */}
        {showGlobeLayer && (
          <div style={{ position: "absolute", inset: 0, zIndex: 1 }}>
            {activeTab === "home" && !isTransitioning ? (
              <GlobeThree />
            ) : (
              <GlobeSection 
                onTransitionStart={handleTransitionComplete}
                isTransitioning={isTransitioning}
              />
            )}
          </div>
        )}

        {/* Home overlay */}
        {isHomeOrTransitioning && (
          <HomeSection 
            onNavigateToMap={handleNavigateToMap}
            overlayVisible={overlayVisible && !isTransitioning}
          />
        )}

        {/* Map section */}
        {(activeTab === "mapa" || isTransitioning) && showMap && (
          <div
            style={{
              position: "absolute",
              inset: 0,
              zIndex: 0,
              opacity: isTransitioning ? 0.56 : 1,
              filter: isTransitioning ? "blur(2.4px)" : "blur(0px)",
              transform: isTransitioning ? "scale(1.008)" : "scale(1)",
              transition: "opacity 820ms cubic-bezier(0.22, 1, 0.36, 1), filter 820ms cubic-bezier(0.22, 1, 0.36, 1), transform 820ms cubic-bezier(0.22, 1, 0.36, 1)",
            }}
          >
            <MapSection triggerFlyTo={isTransitioning} />
          </div>
        )}

        {/* Dashboard */}
        {activeTab === "dashboard" && (
          <AnimatedSection>
            <DashboardSection />
          </AnimatedSection>
        )}

        {/* Simulation */}
        {activeTab === "simulacion" && (
          <AnimatedSection>
            <SimulationSection />
          </AnimatedSection>
        )}

        {/* Reports */}
        {activeTab === "reportes" && (
          <AnimatedSection>
            <ReportsSection />
          </AnimatedSection>
        )}
      </main>

      <Toaster />
    </div>
  )
}
