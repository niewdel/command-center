"use client";

// Solid Jet Black underlay. Brand v3 is dark-first with solid surfaces only —
// no gradients, no glows. Pure CSS, no animation, no JS.
export function Background() {
  return (
    <div
      aria-hidden="true"
      style={{
        position: "fixed",
        inset: 0,
        pointerEvents: "none",
        zIndex: 0,
        background: "var(--paper)",
      }}
    />
  );
}
