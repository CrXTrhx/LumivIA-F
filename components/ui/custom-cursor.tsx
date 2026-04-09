"use client"

import { useEffect, useRef } from "react"

export function CustomCursor() {
  const cursorRef = useRef<HTMLDivElement>(null)
  const trailingRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let mouseX = window.innerWidth / 2
    let mouseY = window.innerHeight / 2
    let trailingX = window.innerWidth / 2
    let trailingY = window.innerHeight / 2

    const onMouseMove = (e: MouseEvent) => {
      mouseX = e.clientX
      mouseY = e.clientY
    }

    window.addEventListener("mousemove", onMouseMove)

    const animate = () => {
      trailingX += (mouseX - trailingX) * 0.1
      trailingY += (mouseY - trailingY) * 0.1

      if (cursorRef.current) {
        cursorRef.current.style.transform = `translate3d(${mouseX}px, ${mouseY}px, 0)`
      }
      
      if (trailingRef.current) {
        trailingRef.current.style.transform = `translate3d(${trailingX}px, ${trailingY}px, 0)`
      }

      requestAnimationFrame(animate)
    }
    
    animate()

    return () => window.removeEventListener("mousemove", onMouseMove)
  }, [])

  return (
    <>
      <div 
        ref={cursorRef} 
        className="fixed top-0 left-0 w-2 h-2 bg-white rounded-full pointer-events-none z-[100] mix-blend-difference"
        style={{ transform: "translate(-50%, -50%)" }}
      />
      <div 
        ref={trailingRef} 
        className="fixed top-0 left-0 w-32 h-32 bg-green-500/20 blur-[30px] rounded-full pointer-events-none z-[99]"
        style={{ transform: "translate(-50%, -50%)", transition: "opacity 0.2s" }}
      />
    </>
  )
}
