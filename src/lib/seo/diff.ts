import { getServiceClient } from "./db";
import type { CheckScores, PageSnapshot } from "./types";

export interface CheckDiff {
  // Issue movement (computed before-and-after the upsert step in the pipeline)
  new_issues_count: number;
  resolved_issues_count: number;
  unchanged_issues_count: number;

  // Score deltas — null when no previous check exists for the client.
  score_deltas: {
    technical: number | null;
    onpage: number | null;
    lighthouse_mobile: number | null;
    lighthouse_desktop: number | null;
  };

  // Page set churn — pages that appeared since last check, pages that
  // disappeared, pages whose content_hash changed.
  pages_added: number;
  pages_removed: number;
  pages_changed: number;

  // For UI/Claude consumption: which previous check we diffed against.
  previous_check_id: string | null;
  previous_check_at: string | null;
}

/**
 * Compute the diff between this run's snapshot and the immediately-prior
 * complete seo_check for the same client. Returns null when no prior
 * check exists.
 */
export async function computeDiff(input: {
  client_id: string;
  exclude_check_id: string;        // the seo_check we just inserted
  current_pages: PageSnapshot[];
  current_scores: CheckScores;
  observed_open_fingerprints: Set<string>;
  newly_inserted_count: number;
  resolved_count: number;
}): Promise<CheckDiff> {
  const sb = getServiceClient();

  const { data: prev } = await sb
    .from("seo_checks")
    .select("id, created_at, technical_score, onpage_score, lighthouse_mobile, lighthouse_desktop, pages")
    .eq("client_id", input.client_id)
    .neq("id", input.exclude_check_id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!prev) {
    return {
      new_issues_count: 0,
      resolved_issues_count: 0,
      unchanged_issues_count: input.observed_open_fingerprints.size,
      score_deltas: {
        technical: null,
        onpage: null,
        lighthouse_mobile: null,
        lighthouse_desktop: null,
      },
      pages_added: 0,
      pages_removed: 0,
      pages_changed: 0,
      previous_check_id: null,
      previous_check_at: null,
    };
  }

  const prevPages = (prev.pages ?? []) as PageSnapshot[];
  const prevByUrl = new Map(prevPages.map((p) => [p.url, p]));
  const curByUrl = new Map(input.current_pages.map((p) => [p.url, p]));

  let pagesAdded = 0;
  let pagesRemoved = 0;
  let pagesChanged = 0;
  for (const [url, cur] of curByUrl) {
    const prior = prevByUrl.get(url);
    if (!prior) {
      pagesAdded++;
    } else if (prior.content_hash !== cur.content_hash) {
      pagesChanged++;
    }
  }
  for (const url of prevByUrl.keys()) {
    if (!curByUrl.has(url)) pagesRemoved++;
  }

  const deltaOrNull = (a: number | null | undefined, b: number | null | undefined) =>
    a == null || b == null ? null : a - b;

  return {
    new_issues_count: input.newly_inserted_count,
    resolved_issues_count: input.resolved_count,
    unchanged_issues_count: Math.max(
      0,
      input.observed_open_fingerprints.size - input.newly_inserted_count
    ),
    score_deltas: {
      technical: deltaOrNull(input.current_scores.technical, prev.technical_score as number | null),
      onpage: deltaOrNull(input.current_scores.onpage, prev.onpage_score as number | null),
      lighthouse_mobile: deltaOrNull(
        input.current_scores.lighthouse_mobile,
        prev.lighthouse_mobile as number | null
      ),
      lighthouse_desktop: deltaOrNull(
        input.current_scores.lighthouse_desktop,
        prev.lighthouse_desktop as number | null
      ),
    },
    pages_added: pagesAdded,
    pages_removed: pagesRemoved,
    pages_changed: pagesChanged,
    previous_check_id: prev.id as string,
    previous_check_at: prev.created_at as string,
  };
}
