import { ACTIVE_STAGES, DEAL_STAGES, resolveDealProbability, type CrmDeal, type DealStage } from "@/types/pipeline";

/**
 * Weighted pipeline forecast (Task E4).
 *
 * A deal's forecast probability is its manual override
 * (`crm_deals.probability`) when set, else the stage default from
 * `STAGE_PROBABILITY`. Weighted value = value_cents x probability / 100,
 * rounded to the nearest cent.
 */

/** A deal's resolved win probability (0-100): manual override, else stage default. */
export function dealProbability(deal: Pick<CrmDeal, "stage" | "probability">): number {
  return resolveDealProbability(deal);
}

/** A deal's weighted value in cents: value_cents x probability / 100. */
export function weightedValue(deal: Pick<CrmDeal, "stage" | "probability" | "value_cents">): number {
  const value = deal.value_cents ?? 0;
  const prob = dealProbability(deal);
  return Math.round((value * prob) / 100);
}

export type PipelineForecast = {
  /** Sum of value_cents across OPEN-stage deals (discovery/scope/proposal/build). */
  openValue: number;
  /** Sum of weighted values across OPEN-stage deals. */
  weightedValue: number;
  /**
   * Keyed by every stage for convenience, but only OPEN stages
   * (discovery/scope/proposal/build) ever accumulate a nonzero total — live/
   * lost/disqualified stay at zero since they're resolved, not forecast.
   */
  byStage: Record<DealStage, { openValue: number; weightedValue: number; count: number }>;
};

/**
 * Aggregate open-pipeline value and weighted (probability-adjusted) value,
 * both overall and broken out by stage. Only OPEN stages (ACTIVE_STAGES)
 * contribute — live/lost/disqualified deals are excluded since they're no
 * longer "forecast", they're resolved.
 */
export function pipelineForecast(
  deals: Pick<CrmDeal, "stage" | "probability" | "value_cents">[]
): PipelineForecast {
  const byStage = {} as PipelineForecast["byStage"];
  for (const stage of DEAL_STAGES) {
    byStage[stage] = { openValue: 0, weightedValue: 0, count: 0 };
  }

  let openValue = 0;
  let weighted = 0;

  for (const deal of deals) {
    if (!ACTIVE_STAGES.includes(deal.stage)) continue;
    const value = deal.value_cents ?? 0;
    const w = weightedValue(deal);
    openValue += value;
    weighted += w;
    const bucket = byStage[deal.stage];
    bucket.openValue += value;
    bucket.weightedValue += w;
    bucket.count += 1;
  }

  return { openValue, weightedValue: weighted, byStage };
}
