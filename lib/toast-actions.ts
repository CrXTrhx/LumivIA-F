"use client"

import { toast } from "@/hooks/use-toast"

export const lumivIAToasts = {
  success: (title: string, description?: string) => {
    toast({
      title,
      description,
      variant: "default",
      className: "bg-[#00e5c8] border-[#00e5c8] text-[#0a0f1a]",
    })
  },

  error: (title: string, description?: string) => {
    toast({
      title,
      description,
      variant: "destructive",
      className: "bg-[#ff6b4a] border-[#ff6b4a] text-white",
    })
  },

  reportSubmitted: () => {
    toast({
      title: "Reporte enviado exitosamente",
      description: "Gracias por contribuir a mejorar la ciudad",
      variant: "default",
      className: "bg-[#10b981] border-[#10b981] text-white",
    })
  },

  reportError: () => {
    toast({
      title: "Error al enviar reporte",
      description: "Por favor intenta de nuevo",
      variant: "destructive",
    })
  },

  routeCalculated: () => {
    toast({
      title: "Ruta calculada",
      description: "Mostrando mejores rutas disponibles",
      variant: "default",
      className: "bg-[#7c6bff] border-[#7c6bff] text-white",
    })
  },

  dataLoaded: () => {
    toast({
      title: "Datos actualizados",
      description: "La información está sincronizada",
      variant: "default",
      className: "bg-[#00e5c8] border-[#00e5c8] text-[#0a0f1a]",
    })
  },

  aiResponse: () => {
    toast({
      title: "Respuesta generada",
      description: "IBM Watsonx AI ha procesado tu consulta",
      variant: "default",
      className: "bg-[#7c6bff] border-[#7c6bff] text-white",
    })
  },

  esgReportGenerated: () => {
    toast({
      title: "Reporte ESG generado",
      description: "Se agregó al historial y está disponible para previsualización.",
      variant: "default",
      className: "bg-[#1a52a0] border-[#1a52a0] text-white",
    })
  },
}
