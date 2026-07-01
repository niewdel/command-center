import { describe, it, expect } from "vitest";
import { FINDING_CODES } from "../finding-codes";
import { findingCopy } from "../finding-copy";

describe("finding-copy coverage", () => {
  it("has a plain-English entry for every finding code", () => {
    const missing: string[] = [];

    for (const code of FINDING_CODES) {
      try {
        const entry = findingCopy(code);
        if (!entry.plain || entry.plain.trim().length === 0) {
          missing.push(`${code} (empty "plain")`);
        }
        if (!entry.impact || entry.impact.trim().length === 0) {
          missing.push(`${code} (empty "impact")`);
        }
      } catch {
        missing.push(`${code} (no entry)`);
      }
    }

    expect(missing).toEqual([]);
  });

  it("throws a clear error for an unknown code", () => {
    expect(() => findingCopy("not.a.real.code")).toThrow();
  });
});
