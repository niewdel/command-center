import { describe, it, expect } from "vitest";
import { CATEGORY_WEIGHTS } from "../scoring";

describe("category weights", () => {
  it("sums to exactly 100", () => {
    const total = Object.values(CATEGORY_WEIGHTS).reduce((sum, w) => sum + w, 0);
    expect(total).toBe(100);
  });

  it("includes AEO at weight 12", () => {
    expect(CATEGORY_WEIGHTS.aeo).toBe(12);
  });
});
