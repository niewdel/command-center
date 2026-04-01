"use client";

export function Background() {
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        pointerEvents: "none",
        overflow: "hidden",
        zIndex: 0,
      }}
      aria-hidden="true"
    >
      {/* Grid lines */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          backgroundImage: `
            linear-gradient(to right, rgba(100, 160, 220, 0.06) 1px, transparent 1px),
            linear-gradient(to bottom, rgba(100, 160, 220, 0.06) 1px, transparent 1px)
          `,
          backgroundSize: "48px 48px",
          animation: "grid-fade 1s ease-out",
        }}
      />

      {/* Scanline */}
      <div
        style={{
          position: "absolute",
          width: "100%",
          height: "2px",
          background: "linear-gradient(to bottom, transparent, rgba(100, 200, 255, 0.04) 50%, transparent)",
          boxShadow: "0 0 30px 15px rgba(100, 200, 255, 0.03)",
          animation: "hud-scan 12s linear infinite",
          willChange: "transform",
          opacity: 0.7,
        }}
      />

      {/* Bottom ambient glow */}
      <div
        style={{
          position: "absolute",
          bottom: 0,
          left: "50%",
          transform: "translateX(-50%)",
          width: "120%",
          height: "35%",
          background: "radial-gradient(ellipse at center bottom, rgba(80, 180, 240, 0.06) 0%, transparent 70%)",
        }}
      />

      {/* Noise grain */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          opacity: 0.025,
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
          backgroundRepeat: "repeat",
          backgroundSize: "256px 256px",
        }}
      />
    </div>
  );
}
