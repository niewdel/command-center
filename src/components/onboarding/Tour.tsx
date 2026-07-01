"use client";

import { useEffect, useRef } from "react";
import { driver, type Driver } from "driver.js";
import "driver.js/dist/driver.css";
import "./tour.css";
import type { TourStep } from "@/types/onboarding";

type TourProps = {
  steps: TourStep[];
  /** Tour is mounted + should attempt to start when true. */
  open: boolean;
  /** Resume from this step (0-based). Defaults to the first step. */
  startAtStep?: number;
  /** Called on every step change so the caller can persist progress. */
  onStepChange: (step: number) => void;
  /** Called when the tour ends, whether finished or skipped/closed. */
  onClose: () => void;
};

// Client-only wrapper around driver.js. Mount this via `next/dynamic` with
// `ssr: false` — driver.js touches `document` at import time.
export function Tour({ steps, open, startAtStep = 0, onStepChange, onClose }: TourProps) {
  const driverRef = useRef<Driver | null>(null);
  const closedRef = useRef(false);

  useEffect(() => {
    if (!open || steps.length === 0) return;

    closedRef.current = false;

    const driverObj = driver({
      showProgress: true,
      allowClose: true,
      overlayOpacity: 0.65,
      stagePadding: 6,
      stageRadius: 8,
      popoverClass: "niewdel-tour-popover",
      progressText: "{{current}} of {{total}}",
      nextBtnText: "Next",
      prevBtnText: "Back",
      doneBtnText: "Finish",
      steps: steps.map((s) => ({
        element: s.element,
        popover: {
          title: s.title,
          description: s.body,
          side: s.side,
        },
      })),
      onHighlighted: (_el, _step, opts) => {
        onStepChange(opts.state.activeIndex ?? 0);
      },
      onDestroyed: () => {
        if (closedRef.current) return;
        closedRef.current = true;
        onClose();
      },
    });

    driverRef.current = driverObj;

    const startIndex = Math.min(Math.max(startAtStep, 0), steps.length - 1);
    const startElement = steps[startIndex]?.element;

    // If the target for the resume step isn't on the page (e.g. resuming on
    // a different route), don't get stuck — just end the tour quietly.
    if (startElement && document.querySelector(startElement)) {
      driverObj.drive(startIndex);
    } else if (steps.some((s) => document.querySelector(s.element))) {
      driverObj.drive(0);
    } else {
      closedRef.current = true;
      onClose();
    }

    return () => {
      closedRef.current = true;
      driverObj.destroy();
    };
    // Re-run only when the tour is (re)opened, not on every callback identity
    // change — driver.js owns its own step index internally once started.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  return null;
}
