"use client";

export function Background() {
  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden" aria-hidden="true">
      {/* Base dot grid */}
      <div className="absolute inset-0 bg-dot-grid opacity-40" />

      {/* Floating gradient orbs — slow CSS animation, GPU-accelerated */}
      <div className="orb orb-1" />
      <div className="orb orb-2" />
      <div className="orb orb-3" />

      {/* Top vignette for depth */}
      <div
        className="absolute inset-x-0 top-0 h-[40%]"
        style={{
          background: "linear-gradient(to bottom, oklch(0.06 0.008 265 / 0.6) 0%, transparent 100%)",
        }}
      />

      {/* Noise grain overlay */}
      <div
        className="absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
          backgroundRepeat: "repeat",
          backgroundSize: "256px 256px",
        }}
      />
    </div>
  );
}
