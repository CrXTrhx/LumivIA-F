"use client"

import { useState } from "react"
import { Send } from "lucide-react"

interface Message {
  id: string
  type: "user" | "ai"
  content: string
}

const initialMessages: Message[] = [
  {
    id: "1",
    type: "user",
    content: "¿Qué pasaría con las emisiones si se amplía la red de ciclovías en Insurgentes?"
  },
  {
    id: "2",
    type: "ai",
    content: "Según el modelo de simulación, ampliar la red de ciclovías en Insurgentes Norte reduciría el tráfico vehicular en un estimado de 18-24%, lo que equivale a una disminución de aproximadamente 340 kg de CO2 por hora en ese corredor. Las calles paralelas como Sonora y Campeche también mostrarían mejora por redistribución del flujo. Se recomienda combinar esta medida con restricción de circulación en horario pico."
  }
]

const suggestionChips = [
  "¿Qué zonas tienen mayor riesgo de inundación este mes?",
  "¿Impacto de restringir tráfico en Reforma?",
  "¿Dónde instalar zonas verdes prioritarias?"
]

export function SimulationSection() {
  const [messages, setMessages] = useState<Message[]>(initialMessages)
  const [input, setInput] = useState("")

  const handleSend = () => {
    if (!input.trim()) return
    
    const newMessage: Message = {
      id: Date.now().toString(),
      type: "user",
      content: input
    }
    
    setMessages(prev => [...prev, newMessage])
    setInput("")
    
    // Simulate AI response
    setTimeout(() => {
      const aiResponse: Message = {
        id: (Date.now() + 1).toString(),
        type: "ai",
        content: "Analizando tu consulta con los modelos de IBM Watsonx. Basado en los datos urbanos actuales de CDMX, estoy procesando las variables relevantes para brindarte una respuesta precisa..."
      }
      setMessages(prev => [...prev, aiResponse])
    }, 1000)
  }

  const handleChipClick = (chip: string) => {
    setInput(chip)
  }

  return (
    <section className="relative mt-12 min-h-[calc(100vh-48px)] overflow-hidden text-slate-100">
      <div className="absolute inset-0">
        <div className="h-full w-full bg-[#060a14]" />
      </div>
      <div className="absolute inset-0 opacity-20">
        <div className="h-full w-full bg-[radial-gradient(ellipse_at_top,_rgba(59,130,246,0.25),_transparent_60%)]" />
      </div>
      {/* Subtle grid background */}
      <div className="absolute inset-0 opacity-5">
        <div 
          className="w-full h-full"
          style={{
            backgroundImage: `
              linear-gradient(rgba(0, 229, 200, 0.3) 1px, transparent 1px),
              linear-gradient(90deg, rgba(0, 229, 200, 0.3) 1px, transparent 1px)
            `,
            backgroundSize: '40px 40px'
          }}
        />
      </div>

      <div className="relative z-10 mx-auto flex w-full max-w-4xl flex-1 flex-col px-4 py-8 sm:px-6">
        {/* Header */}
        <div className="glass-card-strong mb-6 rounded-2xl p-4 text-center sm:mb-8 sm:p-5">
          <h2 className="font-display text-2xl tracking-[0.12em] text-slate-100">Simulación Urbana</h2>
          <p className="mt-2 text-sm text-slate-300 sm:text-base">
            Pregunta cómo cambiaría la ciudad con distintos escenarios urbanos
          </p>
        </div>

        {/* Chat messages */}
        <div className="flex-1 overflow-y-auto space-y-4 mb-6">
          {messages.map((message) => (
            <div key={message.id} className={`flex ${message.type === 'user' ? 'justify-end' : 'justify-start'}`}>
              {message.type === 'user' ? (
                <div className="glass-card max-w-[80%] rounded-xl px-4 py-3">
                  <p className="text-sm leading-relaxed text-slate-100">{message.content}</p>
                </div>
              ) : (
                <div className="glass-card max-w-[80%] rounded-r-xl border-l-2 border-sky-400 px-4 py-3">
                  <p className="text-sm leading-relaxed text-slate-100">{message.content}</p>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Suggestion chips */}
        <div className="flex flex-wrap gap-2 mb-4">
          {suggestionChips.map((chip, i) => (
            <button
              key={i}
              onClick={() => handleChipClick(chip)}
              className="glass-card rounded-full border border-slate-700/50 px-3 py-1.5 text-xs text-slate-300 transition-colors hover:text-slate-100"
            >
              {chip}
            </button>
          ))}
        </div>

        {/* Input bar */}
        <div className="flex gap-3">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            placeholder="Escribe tu pregunta sobre escenarios urbanos..."
            className="glass-card flex-1 rounded-xl border border-slate-700/50 px-4 py-3 text-sm text-slate-100 placeholder-slate-500 focus:border-sky-400 focus:outline-none"
          />
          <button 
            onClick={handleSend}
            className="rounded-xl bg-[#00e5c8] px-4 py-3 text-[#0a0f1a] transition-colors hover:bg-[#00e5c8]/90"
          >
            <Send className="w-5 h-5" />
          </button>
        </div>

        {/* Note */}
        <p className="mt-4 text-center text-xs text-slate-500">
          Las respuestas se generan con el motor de simulación urbana usando datos en tiempo real de CDMX
        </p>
      </div>
    </section>
  )
}
