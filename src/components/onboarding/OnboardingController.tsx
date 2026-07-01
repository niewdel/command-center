"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { useOnboarding } from "@/lib/onboarding/useOnboarding";
import { CRM_TOUR_STEPS } from "@/lib/onboarding/tour-steps";
import { consumeTourReplaySignal } from "@/lib/onboarding/replay-signal";

// driver.js touches `document` at import time — must stay client-only.
const Tour = dynamic(() => import("@/components/onboarding/Tour").then((mod) => mod.Tour), { ssr: false });

// Mounted once in the authenticated app shell. Auto-starts the CRM tour on
// first login (when onboarding_completed_at is null) once the user reaches
// a /pipeline route (every tour target lives there). Also honors a
// "replay" request from Settings regardless of completion state.
export function OnboardingController() {
  const pathname = usePathname();
  const { state, loading, tourOpen, tourForced, startTour, complete, advance } = useOnboarding();
  const autoTriedRef = useRef(false);

  useEffect(() => {
    if (!pathname.startsWith("/pipeline")) return;
    if (consumeTourReplaySignal()) {
      autoTriedRef.current = true;
      startTour(true);
    }
  }, [pathname, startTour]);

  useEffect(() => {
    if (loading || autoTriedRef.current) return;
    if (state.completedAt) return;
    if (!pathname.startsWith("/pipeline")) return;
    autoTriedRef.current = true;
    startTour();
  }, [loading, state.completedAt, pathname, startTour]);

  if (!tourOpen) return null;

  return (
    <Tour
      steps={CRM_TOUR_STEPS}
      open={tourOpen}
      startAtStep={tourForced ? 0 : state.step}
      onStepChange={advance}
      onClose={complete}
    />
  );
}
