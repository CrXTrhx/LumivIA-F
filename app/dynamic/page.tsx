"use client"

import { ParticleSystem } from "@/components/ui/particle-system"
import { InteractivePortal } from "@/components/ui/interactive-portal"
import { CustomCursor } from "@/components/ui/custom-cursor"
import { motion } from "framer-motion"
import Link from "next/navigation"

export default function DynamicDashboard() {
  return (
    <main className="relative w-full h-screen overflow-hidden bg-[#04070a] selection:bg-green-500/30 font-sans cursor-none">
      <CustomCursor />
      {/* Background Layer */}
      <ParticleSystem />

      {/* Atmospheric Overlays */}
      <div className="absolute inset-0 z-0 bg-[radial-gradient(circle_at_center,_transparent_0%,_#04070a_80%)] opacity-80 pointer-events-none" />
      <div className="absolute top-1/2 left-1/4 -translate-y-1/2 w-[40rem] h-[40rem] bg-indigo-500/5 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute top-[40%] right-1/4 w-[35rem] h-[35rem] bg-green-500/5 rounded-full blur-[100px] pointer-events-none" />

      {/* Top Right Navigation Pill */}
      <nav className="absolute top-8 right-12 z-20">
        <motion.div 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1, delay: 0.5 }}
          className="flex items-center gap-6 px-6 py-2 rounded-full border border-white/10 bg-black/30 backdrop-blur-md shadow-lg"
        >
          <a href="#" className="text-white/70 hover:text-white text-xs tracking-widest uppercase transition-colors duration-300">
            Work
          </a>
          {/* separator line */}
          <div className="w-12 h-[1px] bg-white/20" />
          <a href="#" className="text-white/70 hover:text-white text-xs tracking-widest uppercase transition-colors duration-300">
            Contact
          </a>
        </motion.div>
      </nav>

      {/* Main Interactive Center */}
      <div className="absolute inset-0 flex items-center justify-center z-10">
        <motion.div
           initial={{ scale: 0.8, opacity: 0 }}
           animate={{ scale: 1, opacity: 1 }}
           transition={{ duration: 1.5, ease: "easeOut" }}
           className="w-full h-full"
        >
          <InteractivePortal />
        </motion.div>
      </div>
      
      {/* Footer / Context instructions */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-20 pointer-events-none">
        <motion.p 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 2, delay: 1.5 }}
          className="text-white/30 text-xs tracking-[0.2em] font-mono text-center uppercase"
        >
          LumivIA &middot; Interactive Experience
        </motion.p>
      </div>

    </main>
  )
}
