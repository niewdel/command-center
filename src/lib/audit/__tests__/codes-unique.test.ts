import { describe, it, expect } from "vitest";
import { FINDING_CODES } from "../finding-codes";

describe("FINDING_CODES", () => {
  it("has no duplicate codes", () => {
    const seen = new Set<string>();
    const duplicates: string[] = [];

    for (const code of FINDING_CODES) {
      if (seen.has(code)) {
        duplicates.push(code);
      }
      seen.add(code);
    }

    expect(duplicates).toEqual([]);
    expect(seen.size).toBe(FINDING_CODES.length);
  });
});
