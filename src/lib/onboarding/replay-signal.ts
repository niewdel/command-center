// Transient "please replay the tour" signal set by Settings before
// navigating to /pipeline. Deliberately NOT part of the server-persisted
// onboarding state (user_onboarding) — it's a one-shot UI handoff, not
// onboarding progress, so sessionStorage is fine here.
const REPLAY_SIGNAL_KEY = "onboarding:replay-tour";

export function requestTourReplay(): void {
  if (typeof window === "undefined") return;
  window.sessionStorage.setItem(REPLAY_SIGNAL_KEY, "1");
}

/** Reads and clears the pending replay signal. Returns true if one was set. */
export function consumeTourReplaySignal(): boolean {
  if (typeof window === "undefined") return false;
  const pending = window.sessionStorage.getItem(REPLAY_SIGNAL_KEY) === "1";
  if (pending) window.sessionStorage.removeItem(REPLAY_SIGNAL_KEY);
  return pending;
}
