"use client"

import LiveMapApp from "@/components/lumivia/live-map/App"
import "mapbox-gl/dist/mapbox-gl.css"

interface MapSectionProps {
  style?: React.CSSProperties
  triggerFlyTo?: boolean
}

export default function MapSection({ style }: MapSectionProps) {
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
      <LiveMapApp />
    </div>
  )
}
