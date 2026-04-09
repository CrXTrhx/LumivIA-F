"use client"

export function AbstractBackground() {
  return (
    <div className="pointer-events-none fixed inset-0 z-0">
      {/* Base gradient */}
      <div className="absolute inset-0 bg-gradient-to-br from-[#020817] via-[#0f172a] to-[#020817]" />
      
      {/* Abstract blue waves - inspired by Windows 11 Bloom */}
      <div className="absolute inset-0 overflow-hidden">
        {/* Large wave 1 */}
        <div 
          className="absolute opacity-40"
          style={{
            width: '140%',
            height: '140%',
            top: '-20%',
            left: '-20%',
            background: 'radial-gradient(ellipse at 30% 40%, rgba(59, 130, 246, 0.35) 0%, rgba(37, 99, 235, 0.2) 25%, rgba(29, 78, 216, 0.1) 50%, transparent 70%)',
            transform: 'rotate(-25deg)',
            filter: 'blur(80px)',
          }}
        />
        
        {/* Large wave 2 */}
        <div 
          className="absolute opacity-35"
          style={{
            width: '130%',
            height: '130%',
            top: '10%',
            right: '-30%',
            background: 'radial-gradient(ellipse at 70% 50%, rgba(96, 165, 250, 0.3) 0%, rgba(59, 130, 246, 0.18) 30%, rgba(37, 99, 235, 0.08) 55%, transparent 75%)',
            transform: 'rotate(15deg)',
            filter: 'blur(90px)',
          }}
        />
        
        {/* Medium wave 3 */}
        <div 
          className="absolute opacity-30"
          style={{
            width: '100%',
            height: '100%',
            top: '40%',
            left: '20%',
            background: 'radial-gradient(ellipse at 40% 60%, rgba(147, 197, 253, 0.25) 0%, rgba(96, 165, 250, 0.15) 35%, rgba(59, 130, 246, 0.05) 60%, transparent 80%)',
            transform: 'rotate(8deg)',
            filter: 'blur(70px)',
          }}
        />
        
        {/* Accent glow - cyan */}
        <div 
          className="absolute opacity-20"
          style={{
            width: '80%',
            height: '80%',
            bottom: '-10%',
            left: '10%',
            background: 'radial-gradient(circle at 50% 80%, rgba(34, 211, 238, 0.2) 0%, rgba(14, 165, 233, 0.12) 30%, transparent 60%)',
            filter: 'blur(60px)',
          }}
        />
        
        {/* Subtle overlay ribbons */}
        <div 
          className="absolute opacity-15"
          style={{
            width: '120%',
            height: '60%',
            top: '25%',
            left: '-10%',
            background: 'linear-gradient(120deg, transparent 30%, rgba(96, 165, 250, 0.2) 45%, rgba(147, 197, 253, 0.15) 55%, transparent 70%)',
            transform: 'skewY(-12deg)',
            filter: 'blur(40px)',
          }}
        />
      </div>
      
      {/* Dark overlay for contrast */}
      <div className="absolute inset-0 bg-[#020817]/40" />
      
      {/* Subtle noise texture */}
      <div 
        className="absolute inset-0 opacity-[0.015]"
        style={{
          backgroundImage: 'url("data:image/svg+xml,%3Csvg viewBox=\'0 0 400 400\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cfilter id=\'noiseFilter\'%3E%3CfeTurbulence type=\'fractalNoise\' baseFrequency=\'0.9\' numOctaves=\'4\' stitchTiles=\'stitch\'/%3E%3C/filter%3E%3Crect width=\'100%25\' height=\'100%25\' filter=\'url(%23noiseFilter)\'/%3E%3C/svg%3E")',
          backgroundRepeat: 'repeat',
        }}
      />
    </div>
  )
}
