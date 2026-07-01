"use client";

// src/components/portal/LiveSpendCounter.tsx
//
// Prominent animated count-up to the current ad spend. Counts up on
// mount and again whenever `ads` (or its identity) changes — the portal
// page re-renders this component with a fresh `data.ads` slice whenever
// the range tab changes, so a plain effect dependency on the target
// value is enough to re-trigger the animation on range switch.
//
// Respects prefers-reduced-motion (jumps straight to the target).
// Falls back to setTimeout when requestAnimationFrame isn't available
// (older environments / test environments like jsdom that don't
// implement rAF) — same easing curve, just driven by a timer instead.

import { useEffect, useRef, useState } from "react";
import type { ReportData } from "@/lib/seo/report-types";

const DURATION_MS = 1200;
const FRAME_MS = 16;

function scheduleFrame(cb: (t: number) => void): number {
  if (typeof window !== "undefined" && typeof window.requestAnimationFrame === "function") {
    return window.requestAnimationFrame(cb);
  }
  return window.setTimeout(() => cb(performance.now()), FRAME_MS) as unknown as number;
}

function cancelFrame(id: number): void {
  if (typeof window !== "undefined" && typeof window.cancelAnimationFrame === "function") {
    window.cancelAnimationFrame(id);
  } else {
    window.clearTimeout(id);
  }
}

function fmtUsd(n: number): string {
  return n.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

interface LiveSpendCounterProps {
  ads: ReportData["ads"];
}

export function LiveSpendCounter({ ads }: LiveSpendCounterProps) {
  const target = ads.state === "ok" && ads.metrics ? ads.metrics.cost : null;
  const [value, setValue] = useState(0);
  const frameRef = useRef<number | null>(null);

  useEffect(() => {
    if (target == null) return;

    const reduceMotion =
      typeof window !== "undefined" &&
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    // Reduced motion still resolves through the same scheduled-frame path
    // (duration 0 so the very first tick lands on the target) rather than
    // calling setState synchronously in the effect body.
    const duration = reduceMotion ? 0 : DURATION_MS;

    // No synchronous setState here: the initial `useState(0)` already
    // renders 0 on mount, and the first scheduled tick (below) naturally
    // reports a value near 0 as `elapsed` starts at ~0 — the reset and
    // the animation share one code path instead of two setState calls.
    const start = performance.now();

    function tick(now: number) {
      const elapsed = now - start;
      const progress = duration === 0 ? 1 : Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setValue(target! * eased);
      if (progress < 1) {
        frameRef.current = scheduleFrame(tick);
      }
    }
    frameRef.current = scheduleFrame(tick);

    return () => {
      if (frameRef.current != null) cancelFrame(frameRef.current);
    };
  }, [target]);

  if (target == null) {
    return (
      <div>
        <div className="report-label mb-2" style={{ color: "#9DBEE8" }}>
          Ad spend this period
        </div>
        <div className="text-2xl font-bold text-white/60 font-data">
          {ads.state === "needs_reconnect"
            ? "Google Ads needs reconnecting"
            : ads.state === "error"
              ? "Spend unavailable right now"
              : "No ads running yet"}
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="report-label mb-2" style={{ color: "#9DBEE8" }}>
        Ad spend this period
      </div>
      <div
        className="text-5xl md:text-6xl font-bold text-white font-data tabular-nums tracking-tight"
        aria-live="polite"
        data-testid="live-spend-value"
      >
        {fmtUsd(value)}
      </div>
      <div className="text-sm mt-2" style={{ color: "#9DBEE8" }}>
        as of {fmtDate(ads.metrics!.period_end)}
      </div>
    </div>
  );
}
