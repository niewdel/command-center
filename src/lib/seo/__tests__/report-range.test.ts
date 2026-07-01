import { describe, it, expect } from "vitest";
import { rangeWindowMs } from "../report-data";
import { REPORT_RANGES, RANGE_LABEL, type ReportRange } from "../report-types";

describe("rangeWindowMs", () => {
  it("returns a 30-day window in ms for 30d", () => {
    expect(rangeWindowMs("30d")).toBe(30 * 86_400_000);
  });

  it("returns a 60-day window in ms for 60d", () => {
    expect(rangeWindowMs("60d")).toBe(60 * 86_400_000);
  });

  it("returns a 90-day window in ms for 90d", () => {
    expect(rangeWindowMs("90d")).toBe(90 * 86_400_000);
  });

  it("returns null for life (no window bound)", () => {
    expect(rangeWindowMs("life")).toBeNull();
  });

  it("60d window is exactly double the 30d window", () => {
    expect(rangeWindowMs("60d")).toBe((rangeWindowMs("30d") as number) * 2);
  });
});

describe("ReportRange constants", () => {
  it("REPORT_RANGES includes 60d alongside the existing ranges", () => {
    expect(REPORT_RANGES).toEqual(["30d", "60d", "90d", "life"]);
  });

  it("RANGE_LABEL has a label for every range", () => {
    for (const range of REPORT_RANGES) {
      expect(RANGE_LABEL[range as ReportRange]).toBeTruthy();
    }
    expect(RANGE_LABEL["60d"]).toBe("Last 60 days");
  });
});
