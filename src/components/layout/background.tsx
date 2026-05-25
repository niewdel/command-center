"use client";

// Editorial paper underlay. A single warm vignette so the foreground content
// reads as letterpress on textured stock without leaning on animation or
// cyberpunk glows. Pure CSS, no animation, no JS.
export function Background() {
  return (
    <div
      aria-hidden="true"
      style={{
        position: "fixed",
        inset: 0,
        pointerEvents: "none",
        overflow: "hidden",
        zIndex: 0,
        background:
          "radial-gradient(120% 80% at 50% 0%, oklch(0.97 0.012 75) 0%, var(--paper) 55%, oklch(0.94 0.013 70) 100%)",
      }}
    />
  );
}
