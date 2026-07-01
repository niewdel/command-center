import { describe, it, expect } from "vitest";
import { dealProbability, weightedValue, pipelineForecast } from "../forecast";
import type { CrmDeal } from "@/types/pipeline";

type MinimalDeal = Pick<CrmDeal, "stage" | "probability" | "value_cents">;

function deal(overrides: Partial<MinimalDeal>): MinimalDeal {
  return { stage: "discovery", probability: null, value_cents: 100_00, ...overrides };
}

describe("dealProbability", () => {
  it("falls back to the stage default when probability is null", () => {
    expect(dealProbability(deal({ stage: "proposal", probability: null }))).toBe(50);
  });

  it("uses the manual override when set", () => {
    expect(dealProbability(deal({ stage: "proposal", probability: 90 }))).toBe(90);
  });

  it("honors a manual override of 0", () => {
    expect(dealProbability(deal({ stage: "build", probability: 0 }))).toBe(0);
  });

  it("live is always 100 by default", () => {
    expect(dealProbability(deal({ stage: "live", probability: null }))).toBe(100);
  });

  it("lost and disqualified are 0 by default", () => {
    expect(dealProbability(deal({ stage: "lost", probability: null }))).toBe(0);
    expect(dealProbability(deal({ stage: "disqualified", probability: null }))).toBe(0);
  });
});

describe("weightedValue", () => {
  it("multiplies value_cents by the resolved probability", () => {
    // $1000 at scope's default 25% = $250
    expect(weightedValue(deal({ stage: "scope", value_cents: 100_000, probability: null }))).toBe(25_000);
  });

  it("respects a manual probability override", () => {
    expect(weightedValue(deal({ stage: "discovery", value_cents: 100_000, probability: 80 }))).toBe(80_000);
  });

  it("treats a null value_cents as zero", () => {
    expect(weightedValue(deal({ stage: "proposal", value_cents: null, probability: null }))).toBe(0);
  });

  it("rounds to the nearest cent", () => {
    // $10.01 at 25% = $2.5025 -> rounds to 250 cents... actually 1001 * 25 / 100 = 250.25 -> 250
    expect(weightedValue(deal({ stage: "scope", value_cents: 1001, probability: null }))).toBe(250);
  });
});

describe("pipelineForecast", () => {
  it("sums open value and weighted value across open-stage deals only", () => {
    const deals: MinimalDeal[] = [
      deal({ stage: "discovery", value_cents: 100_000, probability: null }), // 10% -> 10,000
      deal({ stage: "proposal", value_cents: 200_000, probability: null }), // 50% -> 100,000
      deal({ stage: "live", value_cents: 500_000, probability: null }), // excluded (closed)
      deal({ stage: "lost", value_cents: 999_999, probability: null }), // excluded (closed)
    ];

    const forecast = pipelineForecast(deals);
    expect(forecast.openValue).toBe(300_000);
    expect(forecast.weightedValue).toBe(110_000);
  });

  it("breaks totals out by stage", () => {
    const deals: MinimalDeal[] = [
      deal({ stage: "discovery", value_cents: 100_000, probability: null }),
      deal({ stage: "discovery", value_cents: 50_000, probability: 20 }),
      deal({ stage: "build", value_cents: 400_000, probability: null }),
    ];

    const forecast = pipelineForecast(deals);
    expect(forecast.byStage.discovery.count).toBe(2);
    expect(forecast.byStage.discovery.openValue).toBe(150_000);
    // 100,000*10% + 50,000*20% = 10,000 + 10,000 = 20,000
    expect(forecast.byStage.discovery.weightedValue).toBe(20_000);
    expect(forecast.byStage.build.count).toBe(1);
    expect(forecast.byStage.build.weightedValue).toBe(300_000);
  });

  it("returns zeroed buckets for closed stages", () => {
    const forecast = pipelineForecast([deal({ stage: "live", value_cents: 500_000, probability: null })]);
    expect(forecast.byStage.live).toEqual({ openValue: 0, weightedValue: 0, count: 0 });
    expect(forecast.openValue).toBe(0);
    expect(forecast.weightedValue).toBe(0);
  });

  it("handles an empty deal list", () => {
    const forecast = pipelineForecast([]);
    expect(forecast.openValue).toBe(0);
    expect(forecast.weightedValue).toBe(0);
  });
});
