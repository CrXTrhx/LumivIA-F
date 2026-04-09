import type { Metadata } from 'next'
import { Orbitron, Inter, Bebas_Neue } from 'next/font/google'
import { Analytics } from '@vercel/analytics/next'
import './globals.css'

const orbitron = Orbitron({
  subsets: ['latin'],
  variable: '--font-orbitron',
  display: 'swap',
})

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
})

const bebasNeue = Bebas_Neue({
  subsets: ['latin'],
  variable: '--font-bebas',
  weight: '400',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'LumivIA - Inteligencia Urbana en Tiempo Real',
  description: 'Plataforma de monitoreo urbano que combina análisis de video en tiempo real, datos geoespaciales e inteligencia artificial generativa para la Ciudad de México.',
  generator: 'v0.app',
  icons: {
    icon: [
      {
        url: '/icon-light-32x32.png',
        media: '(prefers-color-scheme: light)',
      },
      {
        url: '/icon-dark-32x32.png',
        media: '(prefers-color-scheme: dark)',
      },
      {
        url: '/icon.svg',
        type: 'image/svg+xml',
      },
    ],
    apple: '/apple-icon.png',
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="es" className={`dark ${orbitron.variable} ${inter.variable} ${bebasNeue.variable}`}>
      <body className="font-sans antialiased bg-[#0a0e1a]">
        {children}
        <Analytics />
      </body>
    </html>
  )
}
