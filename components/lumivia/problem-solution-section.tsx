"use client"

import { motion } from "framer-motion"
import { 
  AlertTriangle, 
  Clock, 
  Layers, 
  MapPin, 
  Brain, 
  LayoutDashboard 
} from "lucide-react"

interface CardProps {
  icon: React.ReactNode
  title: string
  description: string
  variant: "problem" | "solution"
}

function Card({ icon, title, description, variant }: CardProps) {
  const isProblem = variant === "problem"
  
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-50px" }}
      transition={{ duration: 0.5 }}
      className={`bg-[#111827] rounded-xl p-6 border ${
        isProblem ? "border-[#ef4444]/20" : "border-[#00e5c8]/20"
      }`}
    >
      <div className={`w-12 h-12 rounded-lg flex items-center justify-center mb-4 ${
        isProblem ? "bg-[#ef4444]/10" : "bg-[#00e5c8]/10"
      }`}>
        <div className={isProblem ? "text-[#ef4444]" : "text-[#00e5c8]"}>
          {icon}
        </div>
      </div>
      <h3 className={`font-mono text-lg font-semibold mb-2 ${
        isProblem ? "text-[#ef4444]" : "text-[#00e5c8]"
      }`}>
        {title}
      </h3>
      <p className="font-sans text-[#9ca3af] text-sm leading-relaxed">
        {description}
      </p>
    </motion.div>
  )
}

const painPoints = [
  {
    icon: <MapPin className="w-6 h-6" />,
    title: "Sin datos granulares",
    description: "Los sistemas actuales reportan por delegación, no por calle. Imposible saber el estado real de tu colonia."
  },
  {
    icon: <Clock className="w-6 h-6" />,
    title: "Reacción tardía",
    description: "Las alertas llegan horas después del evento. Cuando te enteras, ya es demasiado tarde para actuar."
  },
  {
    icon: <Layers className="w-6 h-6" />,
    title: "Datos dispersos",
    description: "Contaminación, tráfico e inundaciones en sistemas separados. No hay una visión unificada de la ciudad."
  }
]

const solutions = [
  {
    icon: <MapPin className="w-6 h-6" />,
    title: "Calle por calle",
    description: "400+ puntos de medición con actualización cada 60 segundos. Conoce el estado exacto de tu ruta."
  },
  {
    icon: <Brain className="w-6 h-6" />,
    title: "Predicción con IA",
    description: "IBM Watsonx anticipa eventos con 2 horas de anticipación. Toma decisiones antes de que ocurra el problema."
  },
  {
    icon: <LayoutDashboard className="w-6 h-6" />,
    title: "Plataforma unificada",
    description: "Emisiones, tráfico y riesgos en un solo dashboard. Una sola fuente de verdad para toda la ciudad."
  }
]

export function ProblemSolutionSection() {
  return (
    <section className="min-h-screen bg-[#050810] border-t border-[#1f2937] py-20 px-6 md:px-10">
      <div className="max-w-[900px] mx-auto">
        {/* PROBLEMA */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.6 }}
          className="mb-16"
        >
          <h2 className="font-mono text-xs uppercase tracking-widest text-[#ef4444] mb-4">
            Problema
          </h2>
          <p className="font-sans text-2xl md:text-3xl font-semibold text-white mb-8 leading-relaxed">
            La Ciudad de México enfrenta una crisis silenciosa de contaminación 
            y riesgos urbanos <span className="text-[#ef4444]">sin datos accesibles en tiempo real</span>.
          </p>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {painPoints.map((point, index) => (
              <Card
                key={index}
                icon={point.icon}
                title={point.title}
                description={point.description}
                variant="problem"
              />
            ))}
          </div>
        </motion.div>

        {/* DIVIDER */}
        <div className="flex items-center justify-center gap-4 my-16">
          <div className="flex-1 h-px bg-gradient-to-r from-transparent via-[#1f2937] to-transparent" />
          <span className="font-mono text-xs text-[#6b7280]">vs</span>
          <div className="flex-1 h-px bg-gradient-to-r from-transparent via-[#1f2937] to-transparent" />
        </div>

        {/* SOLUCIÓN */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.6 }}
        >
          <h2 className="font-mono text-xs uppercase tracking-widest text-[#00e5c8] mb-4">
            Solución
          </h2>
          <p className="font-sans text-2xl md:text-3xl font-semibold text-white mb-8 leading-relaxed">
            LumivIA centraliza sensores IoT, análisis de video e IA generativa 
            en <span className="text-[#00e5c8]">una sola plataforma</span>.
          </p>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {solutions.map((solution, index) => (
              <Card
                key={index}
                icon={solution.icon}
                title={solution.title}
                description={solution.description}
                variant="solution"
              />
            ))}
          </div>
        </motion.div>
      </div>
    </section>
  )
}
