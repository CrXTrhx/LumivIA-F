"use client"

import { motion } from "framer-motion"
import { cn } from "@/lib/utils"

type Tab = "home" | "mapa" | "dashboard" | "conductores" | "simulacion" | "reportes"

interface NavbarProps {
  activeTab: Tab
  onTabChange: (tab: Tab) => void
}

const tabs = [
  { id: "mapa" as Tab, label: "Mapa en vivo" },
  { id: "dashboard" as Tab, label: "Dashboard" },
  { id: "conductores" as Tab, label: "Conductores" },
  { id: "simulacion" as Tab, label: "Simulación" },
  { id: "reportes" as Tab, label: "Reportes" },
]

export function Navbar({ activeTab, onTabChange }: NavbarProps) {
  const handleTabClick = (tabId: Tab) => {
    onTabChange(tabId)
  }

  const handleLogoClick = () => {
    onTabChange("home")
  }

  return (
    <nav className="fixed left-0 right-0 top-0 z-50 h-14 border-b border-[#1e293b] bg-[#060a14]/95 px-3 backdrop-blur-xl sm:px-4 lg:px-6">
      <div className="mx-auto flex h-full w-full max-w-7xl items-center justify-between gap-3">
      <div className="flex items-center gap-3 sm:gap-6">
        {/* Logo with Orbitron font */}
        <button 
          onClick={handleLogoClick}
          className="font-display text-lg tracking-wider transition-opacity hover:opacity-80 sm:text-xl"
        >
          <span className="text-white">Lumiv</span>
          <span className="text-[#00d4aa]">IA</span>
        </button>

        {/* Navigation tabs */}
        <div className="relative hidden items-center rounded-full border border-[#1e293b]/50 bg-[#0c1220] p-1 md:flex">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => handleTabClick(tab.id)}
              className="relative z-10 px-5 py-2 text-sm cursor-pointer"
            >
              {activeTab === tab.id && (
                <motion.div
                  layoutId="tab-highlight"
                  className="absolute inset-0 bg-[#00d4aa] rounded-full"
                  transition={{
                    type: "spring",
                    stiffness: 500,
                    damping: 40,
                  }}
                />
              )}
              <span className={cn(
                "relative z-10 font-medium transition-colors duration-200 tracking-wide",
                activeTab === tab.id ? "text-[#060a14]" : "text-[#64748b] hover:text-[#00d4aa]"
              )}>
                {tab.label}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Right side: Status */}
      <div className="flex items-center gap-2 sm:gap-4">
        <div className="relative flex items-center rounded-full border border-[#1e293b]/50 bg-[#0c1220] p-1 md:hidden">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => handleTabClick(tab.id)}
              className="relative z-10 px-2 py-1 text-xs cursor-pointer"
            >
              {activeTab === tab.id && (
                <motion.div
                  layoutId="tab-highlight"
                  className="absolute inset-0 rounded-full bg-[#00d4aa]"
                  transition={{
                    type: "spring",
                    stiffness: 500,
                    damping: 40,
                  }}
                />
              )}
              <span
                className={cn(
                  "relative z-10 font-medium transition-colors duration-200 tracking-wide",
                  activeTab === tab.id ? "text-[#060a14]" : "text-[#64748b] hover:text-[#00d4aa]",
                )}
              >
                {tab.label.slice(0, 3)}
              </span>
            </button>
          ))}
        </div>
        {/* Real-time status */}
        <div className="hidden items-center gap-2 sm:flex">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#00d4aa] opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-[#00d4aa]"></span>
          </span>
          <span className="text-xs text-[#64748b] tracking-wide">EN VIVO · CDMX</span>
        </div>
      </div>
      </div>
    </nav>
  )
}
