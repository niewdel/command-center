import { describe, it, expect } from "vitest";
import {
  DEFAULT_ONBOARDING_STATE,
  advanceState,
  checklistProgress,
  completeState,
  dismissChecklistState,
  shouldStartTour,
  stateFromRow,
  toggleChecklistItemState,
} from "../onboarding-state";
import { CHECKLIST_ITEMS } from "@/types/onboarding";

describe("stateFromRow", () => {
  it("returns the default state when there is no row yet", () => {
    expect(stateFromRow(null)).toEqual(DEFAULT_ONBOARDING_STATE);
  });

  it("maps a row to onboarding state, defaulting a null checklist to {}", () => {
    const state = stateFromRow({
      onboarding_completed_at: "2026-07-01T00:00:00Z",
      onboarding_step: 3,
      onboarding_checklist: null,
    });
    expect(state).toEqual({ completedAt: "2026-07-01T00:00:00Z", step: 3, checklist: {} });
  });

  it("defaults a null step to 0", () => {
    const state = stateFromRow({ onboarding_completed_at: null, onboarding_step: null, onboarding_checklist: {} });
    expect(state.step).toBe(0);
  });
});

describe("advanceState", () => {
  it("updates the step and leaves everything else untouched", () => {
    const start = { completedAt: null, step: 0, checklist: { create_first_deal: true } };
    const next = advanceState(start, 2);
    expect(next.step).toBe(2);
    expect(next.completedAt).toBeNull();
    expect(next.checklist).toEqual(start.checklist);
  });
});

describe("completeState", () => {
  it("sets completedAt to the given timestamp", () => {
    const start = { completedAt: null, step: 4, checklist: {} };
    const next = completeState(start, "2026-07-01T12:00:00Z");
    expect(next.completedAt).toBe("2026-07-01T12:00:00Z");
    expect(next.step).toBe(4);
  });
});

describe("toggleChecklistItemState", () => {
  it("checks an unchecked item", () => {
    const start = { completedAt: null, step: 0, checklist: {} };
    const next = toggleChecklistItemState(start, "create_first_deal");
    expect(next.checklist.create_first_deal).toBe(true);
  });

  it("unchecks a checked item", () => {
    const start = { completedAt: null, step: 0, checklist: { create_first_deal: true } };
    const next = toggleChecklistItemState(start, "create_first_deal");
    expect(next.checklist.create_first_deal).toBe(false);
  });

  it("does not mutate other checklist keys", () => {
    const start = { completedAt: null, step: 0, checklist: { set_next_action: true } };
    const next = toggleChecklistItemState(start, "explore_my_day");
    expect(next.checklist.set_next_action).toBe(true);
    expect(next.checklist.explore_my_day).toBe(true);
  });
});

describe("dismissChecklistState", () => {
  it("sets the dismissed flag without touching item flags", () => {
    const start = { completedAt: null, step: 0, checklist: { create_first_deal: true } };
    const next = dismissChecklistState(start);
    expect(next.checklist.dismissed).toBe(true);
    expect(next.checklist.create_first_deal).toBe(true);
  });
});

describe("shouldStartTour", () => {
  it("starts when not completed and not forced", () => {
    expect(shouldStartTour({ completedAt: null, step: 0, checklist: {} }, false)).toBe(true);
  });

  it("does not start when already completed and not forced", () => {
    expect(shouldStartTour({ completedAt: "2026-07-01T00:00:00Z", step: 0, checklist: {} }, false)).toBe(false);
  });

  it("starts when forced, even if already completed", () => {
    expect(shouldStartTour({ completedAt: "2026-07-01T00:00:00Z", step: 0, checklist: {} }, true)).toBe(true);
  });
});

describe("checklistProgress", () => {
  it("counts done items out of the total", () => {
    const checklist = { create_first_deal: true, set_next_action: true };
    const { done, total, allDone } = checklistProgress(checklist, CHECKLIST_ITEMS);
    expect(done).toBe(2);
    expect(total).toBe(CHECKLIST_ITEMS.length);
    expect(allDone).toBe(false);
  });

  it("reports allDone once every item is checked", () => {
    const checklist = Object.fromEntries(CHECKLIST_ITEMS.map((k) => [k, true]));
    const { allDone } = checklistProgress(checklist, CHECKLIST_ITEMS);
    expect(allDone).toBe(true);
  });

  it("ignores the dismissed flag when computing progress", () => {
    const checklist = { dismissed: true };
    const { done } = checklistProgress(checklist, CHECKLIST_ITEMS);
    expect(done).toBe(0);
  });
});
