// Pure, framework-free state transitions for onboarding. Kept separate from
// useOnboarding.ts (the React hook) so the logic is testable without
// rendering a component or mocking React state.
import { CHECKLIST_DISMISSED_KEY, type ChecklistKey, type OnboardingChecklist, type OnboardingState } from "@/types/onboarding";

export const DEFAULT_ONBOARDING_STATE: OnboardingState = { completedAt: null, step: 0, checklist: {} };

export type OnboardingRowLike = {
  onboarding_completed_at: string | null;
  onboarding_step: number | null;
  onboarding_checklist: OnboardingChecklist | null;
};

/** Maps a `user_onboarding` row (or null, if no row exists yet) to hook state. */
export function stateFromRow(row: OnboardingRowLike | null): OnboardingState {
  if (!row) return DEFAULT_ONBOARDING_STATE;
  return {
    completedAt: row.onboarding_completed_at,
    step: row.onboarding_step ?? 0,
    checklist: row.onboarding_checklist ?? {},
  };
}

export function advanceState(state: OnboardingState, step: number): OnboardingState {
  return { ...state, step };
}

export function completeState(state: OnboardingState, now: string): OnboardingState {
  return { ...state, completedAt: now };
}

export function toggleChecklistItemState(state: OnboardingState, key: ChecklistKey): OnboardingState {
  return { ...state, checklist: { ...state.checklist, [key]: !state.checklist[key] } };
}

export function dismissChecklistState(state: OnboardingState): OnboardingState {
  return { ...state, checklist: { ...state.checklist, [CHECKLIST_DISMISSED_KEY]: true } };
}

/** Whether the tour should auto-start: never if already completed, unless forced. */
export function shouldStartTour(state: OnboardingState, force: boolean): boolean {
  return force || !state.completedAt;
}

/** Count of activation-checklist items marked done, out of the given keys. */
export function checklistProgress(
  checklist: OnboardingChecklist,
  items: readonly ChecklistKey[]
): { done: number; total: number; allDone: boolean } {
  const done = items.filter((key) => checklist[key]).length;
  return { done, total: items.length, allDone: done === items.length };
}
