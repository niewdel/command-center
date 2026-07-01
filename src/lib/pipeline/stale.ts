import { ACTIVE_STAGES, STAGE_LABEL, type CrmDeal } from "@/types/pipeline";

/**
 * "Needs next action" / going-stale check (Task E1).
 *
 * A deal is stale when it's in an OPEN stage (discovery/scope/proposal/build
 * — see ACTIVE_STAGES) and has no `next_action_at` set, or the one it has is
 * past-due. Deals in a closed stage (live/lost/disqualified) are never
 * flagged — there's nothing left to nudge.
 */
export function isDealStale(
  deal: Pick<CrmDeal, "stage" | "next_action_at">,
  now: Date = new Date()
): boolean {
  if (!ACTIVE_STAGES.includes(deal.stage)) return false;
  if (!deal.next_action_at) return true;
  return new Date(deal.next_action_at).getTime() < now.getTime();
}

/** Server-side message for the auto-logged stage_change activity. */
export function buildStageChangeBody(from: CrmDeal["stage"], to: CrmDeal["stage"]): string {
  return `Moved from ${STAGE_LABEL[from]} to ${STAGE_LABEL[to]}`;
}
