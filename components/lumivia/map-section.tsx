"use client"

import LiveMapApp from "@/components/lumivia/live-map/App"
import type { DriverRecord, DriverStatus } from "@/lib/drivers"
import "mapbox-gl/dist/mapbox-gl.css"

interface MapSectionProps {
  style?: React.CSSProperties
  triggerFlyTo?: boolean
  drivers?: DriverRecord[]
  onDriverStatusChange?: (driverId: string, status: DriverStatus) => void
  onAssignmentStatusChange?: (driverId: string, assignmentId: string, status: DriverStatus) => void
}

export default function MapSection({ style, drivers = [], onDriverStatusChange, onAssignmentStatusChange }: MapSectionProps) {
  return (
    <div style={{ position: "relative", width: "100%", height: "100%", ...style }}>
      <style jsx global>{`
        * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
        }

        html,
        body,
        #root {
          width: 100%;
          height: 100%;
          overflow: hidden;
        }

        @media (max-width: 768px) {
          button,
          input,
          [role="button"] {
            -webkit-tap-highlight-color: transparent;
            touch-action: manipulation;
          }

          button {
            min-height: 44px;
          }

          button,
          input {
            touch-action: manipulation;
          }

          * {
            -webkit-overflow-scrolling: touch;
          }

          body {
            overscroll-behavior: none;
          }
        }
      `}</style>
      <LiveMapApp
        drivers={drivers}
        onDriverStatusChange={onDriverStatusChange}
        onAssignmentStatusChange={onAssignmentStatusChange}
      />
    </div>
  )
}
