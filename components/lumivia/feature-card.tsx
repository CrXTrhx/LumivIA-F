"use client"

import { cn } from "@/lib/utils"
import { ReactNode } from "react"

interface FeatureCardProps {
  icon: ReactNode
  title: string
  description: string
  className?: string
}

export function FeatureCard({ icon, title, description, className }: FeatureCardProps) {
  return (
    <div
      className={cn(
        "group relative bg-[#0c1220] rounded-xl p-6 border border-[#1e293b]",
        "hover:border-[#00d4aa]/50 hover:shadow-[0_0_40px_rgba(0,212,170,0.1)]",
        "transition-all duration-300 ease-out hover:scale-[1.02] hover:-translate-y-1",
        "cursor-pointer",
        className
      )}
    >
      <div className="absolute inset-0 rounded-xl bg-gradient-to-br from-[#00d4aa]/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
      
      <div className="relative z-10">
        <div className="w-12 h-12 rounded-lg bg-[#0f172a] flex items-center justify-center mb-4 group-hover:bg-[#00d4aa]/20 transition-colors duration-300">
          <div className="text-[#00d4aa] group-hover:scale-110 transition-transform duration-300">
            {icon}
          </div>
        </div>
        
        <h3 className="font-display text-base text-white mb-2 group-hover:text-[#00d4aa] transition-colors duration-300 tracking-wide">
          {title}
        </h3>
        
        <p className="text-sm text-[#64748b] leading-relaxed group-hover:text-[#94a3b8] transition-colors duration-300">
          {description}
        </p>
      </div>
    </div>
  )
}

interface StatCounterProps {
  value: string
  label: string
  className?: string
}

export function StatCounter({ value, label, className }: StatCounterProps) {
  return (
    <div
      className={cn(
        "text-center p-6 bg-[#0c1220]/80 rounded-xl border border-[#1e293b]",
        "hover:border-[#00d4aa]/30 hover:bg-[#0c1220]",
        "transition-all duration-300",
        className
      )}
    >
      <div className="font-display text-4xl font-bold text-[#00d4aa] mb-2">
        {value}
      </div>
      <div className="text-sm text-[#64748b]">
        {label}
      </div>
    </div>
  )
}
