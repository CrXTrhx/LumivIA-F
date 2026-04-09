"use client"

import { useEffect, useState } from "react"
import { cn } from "@/lib/utils"

interface AnimatedSectionProps {
  children: React.ReactNode
  className?: string
  delay?: number
  direction?: "up" | "down" | "left" | "right"
}

export function AnimatedSection({
  children,
  className,
  delay = 0,
  direction = "up"
}: AnimatedSectionProps) {
  const [isVisible, setIsVisible] = useState(false)

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsVisible(true)
    }, delay)

    return () => clearTimeout(timer)
  }, [delay])

  const directionClasses = {
    up: "translate-y-8",
    down: "-translate-y-8",
    left: "-translate-x-8",
    right: "translate-x-8"
  }

  return (
    <div
      className={cn(
        "transition-all duration-700 ease-out",
        isVisible ? "opacity-100 translate-y-0 translate-x-0" : `opacity-0 ${directionClasses[direction]}`,
        className
      )}
    >
      {children}
    </div>
  )
}

interface StaggeredAnimationProps {
  children: React.ReactNode[]
  className?: string
  staggerDelay?: number
}

export function StaggeredAnimation({
  children,
  className,
  staggerDelay = 100
}: StaggeredAnimationProps) {
  return (
    <div className={cn("flex flex-wrap", className)}>
      {children.map((child, index) => (
        <AnimatedSection
          key={index}
          delay={index * staggerDelay}
          className="flex-1 min-w-[280px]"
        >
          {child}
        </AnimatedSection>
      ))}
    </div>
  )
}
