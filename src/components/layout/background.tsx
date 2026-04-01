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
      {/* Dot grid */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          opacity: 0.4,
          backgroundImage: "radial-gradient(circle, rgba(255,255,255,0.08) 1px, transparent 1px)",
          backgroundSize: "32px 32px",
        }}
      />

      {/* Floating orbs */}
      <div
        className="orb orb-1"
        style={{
          position: "absolute",
          width: 600,
          height: 600,
          top: "-10%",
          right: "-5%",
          borderRadius: "50%",
          background: "rgba(120, 80, 220, 0.1)",
          filter: "blur(100px)",
        }}
      />
      <div
        className="orb orb-2"
        style={{
          position: "absolute",
          width: 500,
          height: 500,
          bottom: "-15%",
          left: "-10%",
          borderRadius: "50%",
          background: "rgba(60, 120, 220, 0.07)",
          filter: "blur(100px)",
        }}
      />
      <div
        className="orb orb-3"
        style={{
          position: "absolute",
          width: 400,
          height: 400,
          top: "40%",
          left: "50%",
          borderRadius: "50%",
          background: "rgba(140, 60, 200, 0.05)",
          filter: "blur(100px)",
        }}
      />

      {/* Top vignette */}
      <div
        style={{
          position: "absolute",
          inset: "0",
          top: 0,
          height: "40%",
          left: 0,
          right: 0,
          background: "linear-gradient(to bottom, rgba(10, 10, 30, 0.6) 0%, transparent 100%)",
        }}
      />

      {/* Noise grain */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          opacity: 0.03,
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
          backgroundRepeat: "repeat",
          backgroundSize: "256px 256px",
        }}
      />
    </div>
  );
}
