"use client"

import { useMotionValue, useTransform, motion, useSpring } from "framer-motion"
import { useEffect, useRef } from "react"
import { useRouter } from "next/navigation"

export function InteractivePortal() {
  const router = useRouter()
  const ref = useRef<HTMLDivElement>(null)
  
  // Motion values for mouse tracking
  const x = useMotionValue(0)
  const y = useMotionValue(0)

  // Spring physics for smooth movement
  const mouseXSpring = useSpring(x, { stiffness: 150, damping: 20 })
  const mouseYSpring = useSpring(y, { stiffness: 150, damping: 20 })

  // 3D rotation transforms
  const rotateX = useTransform(mouseYSpring, [-0.5, 0.5], ["15deg", "-15deg"])
  const rotateY = useTransform(mouseXSpring, [-0.5, 0.5], ["-15deg", "15deg"])
  
  // Outer ring rotation (continuous slow rotation)
  const ringRotation = useMotionValue(0)

  useEffect(() => {
    // Event listener for mouse movement to calculate 3D tilt
    const handleMouseMove = (e: MouseEvent) => {
      if (!ref.current) return
      const rect = ref.current.getBoundingClientRect()
      
      const width = rect.width
      const height = rect.height
      
      const mouseX = e.clientX - rect.left
      const mouseY = e.clientY - rect.top
      
      const xPct = mouseX / width - 0.5
      const yPct = mouseY / height - 0.5
      
      x.set(xPct)
      y.set(yPct)
    }

    window.addEventListener("mousemove", handleMouseMove)
    return () => window.removeEventListener("mousemove", handleMouseMove)
  }, [x, y])

  return (
    <div className="relative flex items-center justify-center h-full w-full z-10" style={{ perspective: 1000 }}>
      <motion.div
        ref={ref}
        style={{
          rotateX,
          rotateY,
          transformStyle: "preserve-3d",
        }}
        className="relative group cursor-pointer"
        onClick={() => router.push('/')} // Clicking the portal goes back to the main dash
      >
        {/* Outer glowing ring */}
        <motion.div 
          animate={{ rotate: 360 }}
          transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
          className="absolute inset-[-40px] rounded-full border border-green-500/30 border-t-green-400/80 border-r-transparent border-b-green-300/10 border-l-transparent"
          style={{ transform: "translateZ(10px)" }}
        />
        
        {/* Second ring slower reverse direction */}
        <motion.div 
          animate={{ rotate: -360 }}
          transition={{ duration: 30, repeat: Infinity, ease: "linear" }}
          className="absolute inset-[-60px] rounded-full border border-[rgba(255,255,255,0.1)] border-b-white/40 border-t-transparent border-r-transparent"
          style={{ transform: "translateZ(-10px)" }}
        />

        {/* Central Element / Logo Mark */}
        <div 
          className="w-40 h-40 rounded-full border border-white/10 bg-black/40 backdrop-blur-md flex items-center justify-center text-white/80 shadow-[0_0_50px_rgba(88,201,153,0.3)] transition-all duration-500 group-hover:shadow-[0_0_80px_rgba(167,219,13,0.5)] group-hover:bg-black/50"
          style={{ transform: "translateZ(30px)" }}
        >
          {/* Abstract symbol inside like the 'D' in the screenshot */}
          <div className="text-6xl font-light tracking-tighter opacity-80 mix-blend-screen overflow-hidden relative w-16 h-16">
            <div className="absolute inset-0 border-4 border-l-0 border-white/90 rounded-r-full group-hover:border-green-400 transition-colors duration-500 shadow-[0_0_15px_rgba(255,255,255,0.8)]" />
            <div className="absolute top-0 bottom-0 left-0 w-1 bg-white/90 group-hover:bg-green-400 transition-colors duration-500 shadow-[0_0_15px_rgba(255,255,255,0.8)]" />
          </div>
        </div>
      </motion.div>
    </div>
  )
}
