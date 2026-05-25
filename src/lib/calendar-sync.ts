"use client";

// Single-flight calendar sync trigger. The dashboard and calendar pages both
// fire `/api/integrations/calendar/sync-all` on cold load to keep events
// fresh. Without a guard, opening one then navigating to the other in the
// same session re-runs the sync, which can take seconds against external
// calendars. We gate via sessionStorage so the sync runs at most once per
// tab session.

const KEY = "cc-calendar-synced-at";
const TTL_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Fire-and-forget calendar sync. Returns immediately. Safe to call from
 * `useEffect` on multiple pages, and safe across navigations in the same
 * tab session.
 */
export function triggerCalendarSync(): void {
  if (typeof window === "undefined") return;
  try {
    const last = sessionStorage.getItem(KEY);
    if (last && Date.now() - Number(last) < TTL_MS) return;
    sessionStorage.setItem(KEY, String(Date.now()));
  } catch {
    // sessionStorage can throw in some sandboxed contexts; just skip the guard.
  }
  fetch("/api/integrations/calendar/sync-all", { method: "POST" }).catch(() => {});
}
