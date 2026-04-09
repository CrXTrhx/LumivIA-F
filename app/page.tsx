"use client"

import { useEffect, useRef, useState } from "react"
import { Navbar } from "@/components/lumivia/navbar"
import { HomeSection } from "@/components/lumivia/home-section"
import GlobeThree from "@/components/lumivia/globe-three"
import GlobeSection from "@/components/lumivia/globe-section"
import MapSection from "@/components/lumivia/map-section"
import { DashboardSection } from "@/components/lumivia/dashboard-section"
import { DriversSection } from "@/components/lumivia/drivers-section"
import { SimulationSection } from "@/components/lumivia/simulation-section"
import { ReportsSection } from "@/components/lumivia/reports-section"
import { AnimatedSection } from "@/components/ui/animated-section"
import { Toaster } from "@/components/ui/toaster"
import {
  assignRouteToDriver,
  createDriverRecord,
  DRIVERS_STORAGE_KEY,
  INITIAL_DRIVERS,
  parseStoredDrivers,
  type DriverRecord,
  type DriverStatus,
  type RegisterDriverInput,
  updateDriverStatus,
} from "@/lib/drivers"

type Tab = "home" | "mapa" | "dashboard" | "conductores" | "simulacion" | "reportes"

function cloneDrivers(list: DriverRecord[]): DriverRecord[] {
  return list.map((driver) => ({
    ...driver,
    performance: { ...driver.performance },
    rewards: { ...driver.rewards },
    history: driver.history.map((entry) => ({ ...entry })),
  }))
}

export default function LumivIADashboard() {
  const [activeTab, setActiveTab] = useState<Tab>("home")
  const [isTransitioning, setIsTransitioning] = useState(false)
  const [overlayVisible, setOverlayVisible] = useState(true)
  const [showMap, setShowMap] = useState(false)
  const [drivers, setDrivers] = useState<DriverRecord[]>(() => {
    if (typeof window === "undefined") return cloneDrivers(INITIAL_DRIVERS)
    const stored = parseStoredDrivers(window.localStorage.getItem(DRIVERS_STORAGE_KEY))
    return cloneDrivers(stored && stored.length ? stored : INITIAL_DRIVERS)
  })
  const driversReadyRef = useRef(false)

  useEffect(() => {
    driversReadyRef.current = true
  }, [])

  useEffect(() => {
    if (!driversReadyRef.current || typeof window === "undefined") return
    window.localStorage.setItem(DRIVERS_STORAGE_KEY, JSON.stringify(drivers))
  }, [drivers])

  const handleCreateDriver = (payload: RegisterDriverInput) => {
    setDrivers((prev) => [createDriverRecord(payload, prev), ...prev])
  }

  const handleAssignDriverRoute = (driverId: string, routeId: string, routeDateISO: string) => {
    setDrivers((prev) => prev.map((driver) => (driver.id === driverId ? assignRouteToDriver(driver, routeId, routeDateISO) : driver)))
  }

  const handleDriverStatus = (driverId: string, status: DriverStatus) => {
    setDrivers((prev) => prev.map((driver) => (driver.id === driverId ? updateDriverStatus(driver, status) : driver)))
  }

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
          className="fixed left-2 top-2 z-[80] max-w-[calc(100vw-16px)] rounded-full border border-[#1e293b] bg-[#060a14]/90 px-3 py-2 text-xs backdrop-blur-xl transition-opacity hover:opacity-85 sm:left-3 sm:top-3 sm:px-4 sm:text-sm"
        >
          <span className="font-display text-sm tracking-wider sm:text-base">
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
            <DashboardSection drivers={drivers} />
          </AnimatedSection>
        )}

        {/* Drivers */}
        {activeTab === "conductores" && (
          <AnimatedSection>
            <DriversSection
              drivers={drivers}
              onCreateDriver={handleCreateDriver}
              onAssignRoute={handleAssignDriverRoute}
              onUpdateDriverStatus={handleDriverStatus}
            />
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
