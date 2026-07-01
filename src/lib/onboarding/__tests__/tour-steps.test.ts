import { describe, it, expect } from "vitest";
import { CRM_TOUR_STEPS } from "../tour-steps";

const VALID_SIDES = ["top", "right", "bottom", "left"];

describe("CRM_TOUR_STEPS", () => {
  it("keeps the tour short (research: 3-step ~72% completion vs 7-step ~16%)", () => {
    expect(CRM_TOUR_STEPS.length).toBeGreaterThanOrEqual(3);
    expect(CRM_TOUR_STEPS.length).toBeLessThanOrEqual(6);
  });

  it("every step has a non-empty selector, title, and body", () => {
    for (const step of CRM_TOUR_STEPS) {
      expect(step.element).toMatch(/^\[data-tour="[a-z-]+"\]$/);
      expect(step.title.length).toBeGreaterThan(0);
      expect(step.body.length).toBeGreaterThan(0);
    }
  });

  it("every step targets a unique data-tour selector", () => {
    const selectors = CRM_TOUR_STEPS.map((s) => s.element);
    expect(new Set(selectors).size).toBe(selectors.length);
  });

  it("only uses valid driver.js popover sides", () => {
    for (const step of CRM_TOUR_STEPS) {
      if (step.side) expect(VALID_SIDES).toContain(step.side);
    }
  });

  it("has no em-dashes in copy (brand voice)", () => {
    for (const step of CRM_TOUR_STEPS) {
      expect(step.title).not.toMatch(/—/);
      expect(step.body).not.toMatch(/—/);
    }
  });
});
