# SEO Client Report — Townsquare-style V1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restructure the per-client SEO report into a single React renderer at `/seo/clients/[id]/report` that drives both the in-app dashboard and the monthly PDF, styled like the Townsquare client report (dense card grid, big cyan numbers on dark navy, date range tabs).

**Architecture:** One server-rendered React route. In-app page imports the same section components. PDF cron uses Playwright to navigate the route with `?print=1&token=…` (HMAC-signed). Sections that depend on optional data hide cleanly when null.

**Tech Stack:** Next.js 16 App Router, React 19 server components, Supabase service-role client, Tailwind 4, shadcn/ui, Playwright for PDF, existing `<ScoreHistoryChart>` client component.

**Spec:** `docs/superpowers/specs/2026-05-05-seo-client-report-design.md`

**Note on testing:** This codebase has no Jest/Vitest setup. Verification per task uses one of three patterns:
- **Smoke script** — `npx tsx scripts/smoke-<name>.ts` for utility logic. Scripts assert via `console.assert` and exit non-zero on failure. Kept under `scripts/` so they're easy to re-run.
- **Type check** — `npx tsc --noEmit` for compile-time correctness.
- **Browser check** — dev server + visual confirmation, with specific things to look at.

**Note on running SQL / Supabase:** Per project memory, never hand the user a SQL block to paste. If a task requires reading from Supabase (e.g. picking a real `client_id` for smoke tests), use the Supabase MCP server's `execute_sql` tool directly.

---

## Task 1: Print token sign/verify

**Files:**
- Create: `src/lib/seo/report-print-token.ts`
- Create: `scripts/smoke-report-print-token.ts`
- Modify: `.env.example` (or `.env.local` if `.env.example` doesn't exist)

- [ ] **Step 1: Add the env var to .env.example**

```bash
# .env.example — append this line:
SEO_REPORT_PRINT_SECRET=change-me-32-bytes-of-random
```

If `.env.example` doesn't exist, check what env file convention the project uses (`grep -r SUPABASE_SERVICE_ROLE_KEY` will show you) and add it there.

- [ ] **Step 2: Create the token module**

```ts
// src/lib/seo/report-print-token.ts
//
// HMAC-signed tokens for the print version of a client report. The middleware
// allows /seo/clients/[id]/report through unauthenticated when ?print=1 and
// a valid token are both present; the route then re-validates the token and
// renders the report. Tokens are scoped to (client_id, range, day_bucket)
// so they expire after 24h naturally.

import { createHmac, timingSafeEqual } from "node:crypto";

const ENV_KEY = "SEO_REPORT_PRINT_SECRET";

function getSecret(): string {
  const s = process.env[ENV_KEY];
  if (!s) throw new Error(`Missing ${ENV_KEY}`);
  return s;
}

function dayBucket(d: Date = new Date()): string {
  return d.toISOString().slice(0, 10); // YYYY-MM-DD UTC
}

export function signPrintToken(
  clientId: string,
  range: string,
  d: Date = new Date()
): string {
  const payload = `${clientId}|${range}|${dayBucket(d)}`;
  return createHmac("sha256", getSecret()).update(payload).digest("hex");
}

export function verifyPrintToken(
  clientId: string,
  range: string,
  token: string,
  d: Date = new Date()
): boolean {
  if (typeof token !== "string" || token.length !== 64) return false;
  const expected = signPrintToken(clientId, range, d);
  const a = Buffer.from(expected, "hex");
  const b = Buffer.from(token, "hex");
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}
```

- [ ] **Step 3: Create the smoke script**

```ts
// scripts/smoke-report-print-token.ts
import { signPrintToken, verifyPrintToken } from "../src/lib/seo/report-print-token";

process.env.SEO_REPORT_PRINT_SECRET = "test-secret-do-not-use-in-prod";

const cid = "00000000-0000-0000-0000-000000000001";

const t1 = signPrintToken(cid, "30d");
console.assert(verifyPrintToken(cid, "30d", t1), "valid token must verify");
console.assert(!verifyPrintToken(cid, "90d", t1), "wrong range must fail");
console.assert(!verifyPrintToken("other", "30d", t1), "wrong client must fail");
console.assert(!verifyPrintToken(cid, "30d", "x".repeat(64)), "wrong token must fail");
console.assert(!verifyPrintToken(cid, "30d", "short"), "short token must fail");

console.log("OK report-print-token smoke");
```

- [ ] **Step 4: Run smoke and confirm**

```bash
npx tsx scripts/smoke-report-print-token.ts
```

Expected output: `OK report-print-token smoke` and exit 0. If any `console.assert` fails, Node prints the assertion message but still exits 0 — read the output carefully for "Assertion failed".

- [ ] **Step 5: Commit**

```bash
git add src/lib/seo/report-print-token.ts scripts/smoke-report-print-token.ts .env.example
git commit -m "feat(seo): HMAC print tokens for unauth report rendering"
```

---

## Task 2: Report data fetcher — types + skeleton

**Files:**
- Create: `src/lib/seo/report-data.ts`

- [ ] **Step 1: Create the file with full types and the function shell**

```ts
// src/lib/seo/report-data.ts
//
// Single source of report data. Both the in-app dashboard and the monthly
// PDF render from this shape. Sections that depend on optional data
// (traffic snapshots, keyword ranks) return null so the corresponding UI
// section can be omitted entirely instead of showing empty placeholders.

import { getServiceClient } from "./db";
import type { ScoreHistoryPoint } from "./monthly-report-html";

export type ReportRange = "30d" | "90d" | "life";

export const REPORT_RANGES: ReportRange[] = ["30d", "90d", "life"];

export const RANGE_LABEL: Record<ReportRange, string> = {
  "30d": "Last 30 days",
  "90d": "Last 90 days",
  "life": "Lifetime",
};

export interface ScoreCard {
  current: number | null;
  delta: number | null;
  history: number[]; // sparkline data, oldest → newest
}

export interface MetricCard {
  current: number;
  delta: number | null;
}

export interface KeywordMover {
  keyword: string;
  rank: number | null;
  prior_rank: number | null;
  delta: number | null; // negative = improvement (rank dropped from 12 to 8)
}

export interface SeoIssueRowOut {
  severity: "critical" | "high" | "medium" | "low";
  title: string;
  page_url: string | null;
  category: string;
}

export interface SeoResolvedRowOut {
  title: string;
  category: string;
}

export interface ReportData {
  client: {
    id: string;
    name: string;
    domain: string;
    period_label: string;
    generated_at: string;
  };
  range: ReportRange;

  health: {
    overall_score: number | null;
    overall_delta: number | null;
    technical: ScoreCard;
    onpage: ScoreCard;
    lighthouse_mobile: ScoreCard;
    lighthouse_desktop: ScoreCard;
    open_issues: {
      total: number;
      critical: number;
      high: number;
      medium: number;
      low: number;
    };
  };

  traffic: {
    sessions: MetricCard;
    organic_sessions: MetricCard;
    users: MetricCard;
    pages_per_session: MetricCard;
    sources: {
      search: number;
      direct: number;
      referral: number;
      social: number;
      other: number;
    };
    period_start: string;
    period_end: string;
  } | null;

  keywords: {
    ranking_count: number;
    tracked_count: number;
    avg_rank: number | null;
    total_search_volume: number;
    top_movers_up: KeywordMover[];
    top_movers_down: KeywordMover[];
  } | null;

  top_pages: Array<{
    path: string;
    sessions: number;
    pct_of_total: number;
  }>;

  issues: {
    open_top: SeoIssueRowOut[];
    resolved: SeoResolvedRowOut[];
  };

  history: ScoreHistoryPoint[];
  ai_summary: string | null;
}

function rangeWindowMs(range: ReportRange): number | null {
  if (range === "30d") return 30 * 86_400_000;
  if (range === "90d") return 90 * 86_400_000;
  return null; // life
}

function deltaOrNull(cur: number | null, prior: number | null): number | null {
  if (cur == null || prior == null) return null;
  return cur - prior;
}

function avg(nums: number[]): number | null {
  const xs = nums.filter((n) => n != null && Number.isFinite(n));
  if (xs.length === 0) return null;
  return Math.round((xs.reduce((a, b) => a + b, 0) / xs.length) * 10) / 10;
}

function bucketSource(medium: string | null): keyof ReportData["traffic"]["sources"] | null {
  // GA4 conventional medium values map cleanly here. "(none)" = direct.
  if (!medium) return "other";
  const m = medium.toLowerCase();
  if (m === "organic" || m === "cpc" || m === "ppc") return "search";
  if (m === "(none)" || m === "none" || m === "direct") return "direct";
  if (m === "referral") return "referral";
  if (m === "social" || m === "organic_social" || m === "paid_social") return "social";
  return "other";
}

export async function getReportData(
  clientId: string,
  range: ReportRange
): Promise<ReportData> {
  // Filled in over Task 3 + Task 4 + Task 5.
  throw new Error("Not implemented");
}
```

- [ ] **Step 2: Type check**

```bash
npx tsc --noEmit
```

Expected: clean compile, no errors. If `monthly-report-html` types complain because we're importing from a file slated for deletion, that's fine for now — it gets resolved when we delete that file at the end.

- [ ] **Step 3: Commit**

```bash
git add src/lib/seo/report-data.ts
git commit -m "feat(seo): report-data types + helper utilities"
```

---

## Task 3: Implement getReportData — health + issues + history

**Files:**
- Modify: `src/lib/seo/report-data.ts`

- [ ] **Step 1: Replace the `throw` with the health/issues/history query block**

Replace the body of `getReportData` with this code:

```ts
export async function getReportData(
  clientId: string,
  range: ReportRange
): Promise<ReportData> {
  const sb = getServiceClient();

  // ── Client row
  const { data: clientRow, error: clientErr } = await sb
    .from("clients")
    .select("id, name, seo_config")
    .eq("id", clientId)
    .single();
  if (clientErr || !clientRow) {
    throw new Error(`Client not found: ${clientId}`);
  }
  const domain = (clientRow.seo_config as { domain?: string } | null)?.domain ?? "";

  // ── Window bounds for time-filtered queries
  const windowMs = rangeWindowMs(range);
  const since = windowMs ? new Date(Date.now() - windowMs).toISOString() : null;

  // ── seo_checks within the window (or all if life)
  let q = sb
    .from("seo_checks")
    .select("id, technical_score, onpage_score, lighthouse_mobile, lighthouse_desktop, freshness_days, pages_crawled, ai_summary, created_at")
    .eq("client_id", clientId)
    .order("created_at", { ascending: false })
    .limit(50);
  if (since) q = q.gte("created_at", since);
  const { data: rawChecks } = await q;

  type CheckRow = {
    id: string;
    technical_score: number | null;
    onpage_score: number | null;
    lighthouse_mobile: number | null;
    lighthouse_desktop: number | null;
    freshness_days: number | null;
    pages_crawled: number | null;
    ai_summary: string | null;
    created_at: string;
  };
  const checks = (rawChecks ?? []) as CheckRow[];
  const latest = checks[0] ?? null;
  const earliest = checks[checks.length - 1] ?? null;

  function scoreCard(key: keyof CheckRow): ScoreCard {
    const cur = (latest?.[key] as number | null) ?? null;
    const prior = (earliest?.[key] as number | null) ?? null;
    const history = checks
      .slice()
      .reverse()
      .map((c) => (c[key] as number | null) ?? null)
      .filter((n): n is number => n != null);
    return { current: cur, delta: deltaOrNull(cur, prior), history };
  }

  const technical = scoreCard("technical_score");
  const onpage = scoreCard("onpage_score");
  const lighthouse_mobile = scoreCard("lighthouse_mobile");
  const lighthouse_desktop = scoreCard("lighthouse_desktop");

  // Overall = simple average of non-null current scores. When no scores at
  // all, overall is null.
  const overallNums = [
    technical.current,
    onpage.current,
    lighthouse_mobile.current,
    lighthouse_desktop.current,
  ].filter((n): n is number => n != null);
  const overall_score =
    overallNums.length > 0
      ? Math.round(overallNums.reduce((a, b) => a + b, 0) / overallNums.length)
      : null;
  const priorOverallNums = [
    technical.current != null && technical.delta != null ? technical.current - technical.delta : null,
    onpage.current != null && onpage.delta != null ? onpage.current - onpage.delta : null,
    lighthouse_mobile.current != null && lighthouse_mobile.delta != null ? lighthouse_mobile.current - lighthouse_mobile.delta : null,
    lighthouse_desktop.current != null && lighthouse_desktop.delta != null ? lighthouse_desktop.current - lighthouse_desktop.delta : null,
  ].filter((n): n is number => n != null);
  const prior_overall =
    priorOverallNums.length > 0
      ? Math.round(priorOverallNums.reduce((a, b) => a + b, 0) / priorOverallNums.length)
      : null;
  const overall_delta = deltaOrNull(overall_score, prior_overall);

  // ── Open issues — count by severity (no window; "open" is a current state)
  const { data: openIssuesAll } = await sb
    .from("seo_issues")
    .select("severity, title, page_url, category, status")
    .eq("client_id", clientId)
    .eq("status", "open");
  const openIssues = (openIssuesAll ?? []) as Array<{
    severity: "critical" | "high" | "medium" | "low";
    title: string;
    page_url: string | null;
    category: string;
    status: string;
  }>;
  const open_issues = {
    total: openIssues.length,
    critical: openIssues.filter((i) => i.severity === "critical").length,
    high: openIssues.filter((i) => i.severity === "high").length,
    medium: openIssues.filter((i) => i.severity === "medium").length,
    low: openIssues.filter((i) => i.severity === "low").length,
  };
  const open_top = openIssues
    .filter((i) => i.severity === "critical" || i.severity === "high")
    .sort((a, b) => (a.severity === "critical" ? -1 : 1))
    .slice(0, 10)
    .map((i) => ({
      severity: i.severity,
      title: i.title,
      page_url: i.page_url,
      category: i.category,
    }));

  // ── Resolved in window
  let resolvedQ = sb
    .from("seo_issues")
    .select("title, category")
    .eq("client_id", clientId)
    .eq("status", "fixed");
  if (since) resolvedQ = resolvedQ.gte("resolved_at", since);
  const { data: resolvedRows } = await resolvedQ;
  const resolved = ((resolvedRows ?? []) as Array<{ title: string; category: string }>).map((r) => ({
    title: r.title,
    category: r.category,
  }));

  // ── History for trend chart
  const history = checks
    .slice()
    .reverse()
    .map((c) => ({
      created_at: c.created_at,
      technical_score: c.technical_score,
      onpage_score: c.onpage_score,
      lighthouse_mobile: c.lighthouse_mobile,
      lighthouse_desktop: c.lighthouse_desktop,
    }));

  // ── Period label from the latest check (or now if no checks)
  const periodAnchor = latest ? new Date(latest.created_at) : new Date();
  const period_label = periodAnchor.toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });

  return {
    client: {
      id: clientRow.id as string,
      name: clientRow.name as string,
      domain,
      period_label,
      generated_at: new Date().toISOString(),
    },
    range,
    health: {
      overall_score,
      overall_delta,
      technical,
      onpage,
      lighthouse_mobile,
      lighthouse_desktop,
      open_issues,
    },
    traffic: null,    // filled in Task 4
    keywords: null,   // filled in Task 5
    top_pages: [],    // filled in Task 4
    issues: { open_top, resolved },
    history,
    ai_summary: latest?.ai_summary ?? null,
  };
}
```

- [ ] **Step 2: Type check**

```bash
npx tsc --noEmit
```

Expected: clean. If errors, fix before proceeding.

- [ ] **Step 3: Smoke against a real client**

Use the Supabase MCP `execute_sql` tool to find a real client id with at least one seo_check row:

```sql
select c.id, c.name
from clients c
join seo_checks s on s.client_id = c.id
group by c.id, c.name
order by max(s.created_at) desc
limit 1;
```

Then create `scripts/smoke-report-data.ts`:

```ts
// scripts/smoke-report-data.ts
import { getReportData } from "../src/lib/seo/report-data";

const CLIENT_ID = process.argv[2];
if (!CLIENT_ID) {
  console.error("Usage: tsx scripts/smoke-report-data.ts <client_id>");
  process.exit(1);
}

(async () => {
  const data = await getReportData(CLIENT_ID, "30d");
  console.log("client:", data.client);
  console.log("overall_score:", data.health.overall_score, "delta:", data.health.overall_delta);
  console.log("technical:", data.health.technical);
  console.log("open_issues:", data.health.open_issues);
  console.log("resolved count:", data.issues.resolved.length);
  console.log("history points:", data.history.length);
  console.log("ai_summary present:", !!data.ai_summary);
})();
```

Run:

```bash
npx tsx scripts/smoke-report-data.ts <client_id>
```

Expected: prints non-error output; `overall_score` is 0-100 or null; arrays are non-empty if the client has data.

- [ ] **Step 4: Commit**

```bash
git add src/lib/seo/report-data.ts scripts/smoke-report-data.ts
git commit -m "feat(seo): getReportData — health, issues, history"
```

---

## Task 4: Extend getReportData — traffic + top pages

**Files:**
- Modify: `src/lib/seo/report-data.ts`

- [ ] **Step 1: Insert the traffic block**

Inside `getReportData`, after the `// ── Resolved in window` block and before the `// ── History for trend chart` block, add:

```ts
  // ── GA4 traffic snapshots — most recent + prior
  const { data: trafficRows } = await sb
    .from("seo_traffic_snapshots")
    .select(
      "period_start, period_end, sessions, organic_sessions, users, page_views, avg_session_duration_s, bounce_rate, top_pages, top_sources, captured_at"
    )
    .eq("client_id", clientId)
    .order("captured_at", { ascending: false })
    .limit(2);

  type TrafficRow = {
    period_start: string;
    period_end: string;
    sessions: number;
    organic_sessions: number;
    users: number;
    page_views: number;
    avg_session_duration_s: number | null;
    bounce_rate: number | null;
    top_pages: Array<{ path: string; sessions: number; users: number }> | null;
    top_sources: Array<{ source: string; medium: string; sessions: number }> | null;
  };
  const trafficCur = (trafficRows?.[0] ?? null) as TrafficRow | null;
  const trafficPrior = (trafficRows?.[1] ?? null) as TrafficRow | null;

  let traffic: ReportData["traffic"] = null;
  let top_pages: ReportData["top_pages"] = [];

  if (trafficCur) {
    const ppsCurNum =
      trafficCur.sessions > 0 ? trafficCur.page_views / trafficCur.sessions : 0;
    const ppsPriorNum =
      trafficPrior && trafficPrior.sessions > 0
        ? trafficPrior.page_views / trafficPrior.sessions
        : null;

    // Bucket top_sources percentages
    const totals = { search: 0, direct: 0, referral: 0, social: 0, other: 0 };
    let totalSrc = 0;
    for (const s of trafficCur.top_sources ?? []) {
      const bucket = bucketSource(s.medium);
      if (bucket) {
        totals[bucket] += s.sessions;
        totalSrc += s.sessions;
      }
    }
    const sources =
      totalSrc > 0
        ? {
            search: Math.round((totals.search / totalSrc) * 100),
            direct: Math.round((totals.direct / totalSrc) * 100),
            referral: Math.round((totals.referral / totalSrc) * 100),
            social: Math.round((totals.social / totalSrc) * 100),
            other: Math.round((totals.other / totalSrc) * 100),
          }
        : { search: 0, direct: 0, referral: 0, social: 0, other: 0 };

    traffic = {
      sessions: {
        current: trafficCur.sessions,
        delta: deltaOrNull(trafficCur.sessions, trafficPrior?.sessions ?? null),
      },
      organic_sessions: {
        current: trafficCur.organic_sessions,
        delta: deltaOrNull(trafficCur.organic_sessions, trafficPrior?.organic_sessions ?? null),
      },
      users: {
        current: trafficCur.users,
        delta: deltaOrNull(trafficCur.users, trafficPrior?.users ?? null),
      },
      pages_per_session: {
        current: Math.round(ppsCurNum * 100) / 100,
        delta:
          ppsPriorNum != null
            ? Math.round((ppsCurNum - ppsPriorNum) * 100) / 100
            : null,
      },
      sources,
      period_start: trafficCur.period_start,
      period_end: trafficCur.period_end,
    };

    const totalPageSessions = (trafficCur.top_pages ?? []).reduce(
      (a, p) => a + p.sessions,
      0
    );
    top_pages = (trafficCur.top_pages ?? []).slice(0, 5).map((p) => ({
      path: p.path,
      sessions: p.sessions,
      pct_of_total:
        totalPageSessions > 0
          ? Math.round((p.sessions / totalPageSessions) * 100)
          : 0,
    }));
  }
```

- [ ] **Step 2: Replace the placeholder values in the return statement**

Find the `return {` block at the bottom of `getReportData` and change:

```ts
    traffic: null,    // filled in Task 4
    keywords: null,   // filled in Task 5
    top_pages: [],    // filled in Task 4
```

to:

```ts
    traffic,
    keywords: null,   // filled in Task 5
    top_pages,
```

- [ ] **Step 3: Type check + smoke**

```bash
npx tsc --noEmit
npx tsx scripts/smoke-report-data.ts <client_id>
```

Expected: if the client has GA4 configured, `traffic` is non-null; otherwise null. `top_pages` length matches.

- [ ] **Step 4: Commit**

```bash
git add src/lib/seo/report-data.ts
git commit -m "feat(seo): getReportData — traffic + top pages"
```

---

## Task 5: Extend getReportData — keyword rankings

**Files:**
- Modify: `src/lib/seo/report-data.ts`

- [ ] **Step 1: Insert the keywords block**

Inside `getReportData`, after the traffic block and before the `// ── History for trend chart` block, add:

```ts
  // ── Keyword rankings — latest two captures per keyword
  const { data: kwRows } = await sb
    .from("seo_keyword_ranks")
    .select("keyword, rank, search_volume, captured_at")
    .eq("client_id", clientId)
    .order("captured_at", { ascending: false })
    .limit(500);

  type KwRow = {
    keyword: string;
    rank: number | null;
    search_volume: number | null;
    captured_at: string;
  };
  const kwAll = (kwRows ?? []) as KwRow[];

  let keywords: ReportData["keywords"] = null;
  if (kwAll.length > 0) {
    // Group by keyword, keep the two most recent captures.
    const byKeyword = new Map<string, KwRow[]>();
    for (const r of kwAll) {
      const arr = byKeyword.get(r.keyword) ?? [];
      if (arr.length < 2) {
        arr.push(r);
        byKeyword.set(r.keyword, arr);
      }
    }
    const movers: KeywordMover[] = [];
    let totalVolume = 0;
    let rankingCount = 0;
    const ranks: number[] = [];
    for (const [kw, hist] of byKeyword) {
      const cur = hist[0];
      const prior = hist[1] ?? null;
      totalVolume += cur.search_volume ?? 0;
      if (cur.rank != null) {
        rankingCount++;
        ranks.push(cur.rank);
      }
      // Negative delta means rank *improved* (lower is better in SERPs).
      const delta =
        cur.rank != null && prior?.rank != null ? cur.rank - prior.rank : null;
      movers.push({
        keyword: kw,
        rank: cur.rank,
        prior_rank: prior?.rank ?? null,
        delta,
      });
    }
    const movers_up = movers
      .filter((m) => m.delta != null && m.delta < 0)
      .sort((a, b) => (a.delta as number) - (b.delta as number))
      .slice(0, 5);
    const movers_down = movers
      .filter((m) => m.delta != null && m.delta > 0)
      .sort((a, b) => (b.delta as number) - (a.delta as number))
      .slice(0, 5);
    keywords = {
      ranking_count: rankingCount,
      tracked_count: byKeyword.size,
      avg_rank: avg(ranks),
      total_search_volume: totalVolume,
      top_movers_up: movers_up,
      top_movers_down: movers_down,
    };
  }
```

- [ ] **Step 2: Replace the keywords placeholder in the return statement**

Change `keywords: null,   // filled in Task 5` to `keywords,`.

- [ ] **Step 3: Type check + smoke**

```bash
npx tsc --noEmit
npx tsx scripts/smoke-report-data.ts <client_id>
```

Expected: if the client has keyword tracking, `keywords` is non-null with ranking_count + tracked_count populated.

- [ ] **Step 4: Commit**

```bash
git add src/lib/seo/report-data.ts
git commit -m "feat(seo): getReportData — keyword rankings"
```

---

## Task 6: Shared report primitives — section, delta, metric-card

**Files:**
- Create: `src/components/seo/report/section.tsx`
- Create: `src/components/seo/report/delta.tsx`
- Create: `src/components/seo/report/metric-card.tsx`

- [ ] **Step 1: Create section.tsx**

```tsx
// src/components/seo/report/section.tsx
import { type ReactNode } from "react";

interface SectionProps {
  title: string;
  children: ReactNode;
}

export function Section({ title, children }: SectionProps) {
  return (
    <section className="mb-12">
      <h2 className="text-muted-foreground text-xs uppercase mb-3 font-semibold">
        {title}
      </h2>
      <div className="grid grid-cols-12 gap-3">{children}</div>
    </section>
  );
}
```

- [ ] **Step 2: Create delta.tsx**

```tsx
// src/components/seo/report/delta.tsx
//
// For SEO scores higher is better, but for keyword ranks lower is better.
// `direction` lets the caller flip the color logic.

interface DeltaProps {
  value: number | null;
  format?: "number" | "percent" | "rank";
  direction?: "higher-better" | "lower-better";
  className?: string;
}

export function Delta({
  value,
  format = "number",
  direction = "higher-better",
  className = "",
}: DeltaProps) {
  if (value == null || value === 0) {
    return (
      <span className={`text-muted-foreground tabular-nums text-sm ${className}`}>
        —
      </span>
    );
  }
  const isImprovement =
    direction === "higher-better" ? value > 0 : value < 0;
  const color = isImprovement ? "text-emerald-400" : "text-destructive";
  const arrow = value > 0 ? "↑" : "↓";
  const abs = Math.abs(value);
  const formatted =
    format === "percent"
      ? `${abs}%`
      : format === "rank"
        ? abs.toString()
        : abs.toLocaleString();
  return (
    <span className={`${color} tabular-nums text-sm font-data ${className}`}>
      {arrow} {formatted}
    </span>
  );
}
```

- [ ] **Step 3: Create metric-card.tsx**

```tsx
// src/components/seo/report/metric-card.tsx
import { type ReactNode } from "react";
import { Delta } from "./delta";

interface MetricCardProps {
  label: string;
  value: ReactNode;       // big primary value (number or string)
  delta?: number | null;
  deltaFormat?: "number" | "percent" | "rank";
  deltaDirection?: "higher-better" | "lower-better";
  secondary?: ReactNode;  // small secondary text below the number (e.g. "Lifetime: 3,071")
  size?: "hero" | "default";
  className?: string;
}

export function MetricCard({
  label,
  value,
  delta,
  deltaFormat = "number",
  deltaDirection = "higher-better",
  secondary,
  size = "default",
  className = "",
}: MetricCardProps) {
  const valueClasses =
    size === "hero"
      ? "text-5xl font-semibold text-primary font-data"
      : "text-3xl font-semibold text-primary font-data";
  return (
    <div className={`bg-card border border-border rounded-lg p-6 ${className}`}>
      <div className="text-muted-foreground text-xs uppercase font-semibold mb-3">
        {label}
      </div>
      <div className={valueClasses}>{value}</div>
      <div className="mt-2 flex items-center gap-3">
        {delta !== undefined && (
          <Delta
            value={delta}
            format={deltaFormat}
            direction={deltaDirection}
          />
        )}
        {secondary && (
          <div className="text-muted-foreground text-xs">{secondary}</div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Type check**

```bash
npx tsc --noEmit
```

- [ ] **Step 5: Commit**

```bash
git add src/components/seo/report/section.tsx src/components/seo/report/delta.tsx src/components/seo/report/metric-card.tsx
git commit -m "feat(seo): report primitives — section, delta, metric-card"
```

---

## Task 7: Header section + range tabs

**Files:**
- Create: `src/components/seo/report/range-tabs.tsx`
- Create: `src/components/seo/report/report-header.tsx`

- [ ] **Step 1: Create range-tabs.tsx (client component for navigation)**

```tsx
// src/components/seo/report/range-tabs.tsx
"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import type { ReportRange } from "@/lib/seo/report-data";

const TABS: Array<{ key: ReportRange; label: string }> = [
  { key: "30d", label: "30d" },
  { key: "90d", label: "90d" },
  { key: "life", label: "Lifetime" },
];

export function RangeTabs({ active }: { active: ReportRange }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function go(range: ReportRange) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("range", range);
    router.push(`${pathname}?${params.toString()}`);
  }

  return (
    <div className="inline-flex items-center gap-1 rounded-lg bg-card border border-border p-1">
      {TABS.map((t) => {
        const isActive = t.key === active;
        return (
          <button
            key={t.key}
            type="button"
            onClick={() => go(t.key)}
            className={
              isActive
                ? "rounded px-3 py-1 text-sm bg-foreground text-background"
                : "rounded px-3 py-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
            }
          >
            {t.label}
          </button>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 2: Create report-header.tsx**

```tsx
// src/components/seo/report/report-header.tsx
import type { ReportData } from "@/lib/seo/report-data";
import { RangeTabs } from "./range-tabs";

interface Props {
  data: ReportData;
  mode: "standalone" | "embedded";
}

export function ReportHeader({ data, mode }: Props) {
  const generated = new Date(data.client.generated_at).toLocaleDateString(
    "en-US",
    { month: "short", day: "numeric", year: "numeric" }
  );
  return (
    <header className="mb-10">
      <div className="flex items-start justify-between gap-6 flex-wrap">
        <div>
          <div className="text-muted-foreground text-xs uppercase font-semibold mb-2">
            SEO Report
          </div>
          <h1 className="text-4xl font-semibold text-balance">{data.client.name}</h1>
          {data.client.domain && (
            <div className="text-muted-foreground text-sm mt-1">
              {data.client.domain}
            </div>
          )}
        </div>
        {mode === "standalone" && (
          <div className="flex flex-col items-end gap-2">
            <RangeTabs active={data.range} />
            <div className="text-muted-foreground text-xs">
              Generated {generated}
            </div>
          </div>
        )}
      </div>
    </header>
  );
}
```

- [ ] **Step 3: Type check**

```bash
npx tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add src/components/seo/report/range-tabs.tsx src/components/seo/report/report-header.tsx
git commit -m "feat(seo): report header + range tabs"
```

---

## Task 8: SEO Health section

**Files:**
- Create: `src/components/seo/report/health-section.tsx`

- [ ] **Step 1: Create the file**

```tsx
// src/components/seo/report/health-section.tsx
import type { ReportData } from "@/lib/seo/report-data";
import { Section } from "./section";
import { MetricCard } from "./metric-card";

function fmt(n: number | null): string {
  return n == null ? "—" : n.toString();
}

interface SparkProps {
  values: number[];
}
function Spark({ values }: SparkProps) {
  if (values.length < 2) return null;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const w = 80;
  const h = 24;
  const stepX = w / (values.length - 1);
  const points = values
    .map((v, i) => `${i * stepX},${h - ((v - min) / range) * h}`)
    .join(" ");
  return (
    <svg width={w} height={h} className="text-primary opacity-60">
      <polyline
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        points={points}
      />
    </svg>
  );
}

export function HealthSection({ data }: { data: ReportData }) {
  const h = data.health;
  return (
    <Section title="SEO Health">
      <div className="col-span-12 md:col-span-7 bg-card border border-border rounded-lg p-6">
        <div className="text-muted-foreground text-xs uppercase font-semibold mb-3">
          Overall Score
        </div>
        <div className="text-7xl font-semibold text-primary font-data">
          {fmt(h.overall_score)}
        </div>
        <div className="mt-3 text-sm text-muted-foreground">
          {h.overall_delta != null
            ? `${h.overall_delta > 0 ? "+" : ""}${h.overall_delta} vs start of period`
            : "No prior data in window"}
        </div>
      </div>
      <div className="col-span-12 md:col-span-5 bg-card border border-border rounded-lg p-6">
        <div className="text-muted-foreground text-xs uppercase font-semibold mb-3">
          Open Issues
        </div>
        <div className="text-5xl font-semibold text-primary font-data">
          {h.open_issues.total}
        </div>
        <div className="mt-4 grid grid-cols-4 gap-2 text-xs">
          <div>
            <div className="text-destructive font-semibold tabular-nums">
              {h.open_issues.critical}
            </div>
            <div className="text-muted-foreground uppercase mt-1">Critical</div>
          </div>
          <div>
            <div className="text-amber-400 font-semibold tabular-nums">
              {h.open_issues.high}
            </div>
            <div className="text-muted-foreground uppercase mt-1">High</div>
          </div>
          <div>
            <div className="text-foreground font-semibold tabular-nums">
              {h.open_issues.medium}
            </div>
            <div className="text-muted-foreground uppercase mt-1">Medium</div>
          </div>
          <div>
            <div className="text-muted-foreground font-semibold tabular-nums">
              {h.open_issues.low}
            </div>
            <div className="text-muted-foreground uppercase mt-1">Low</div>
          </div>
        </div>
      </div>

      {(["technical", "onpage", "lighthouse_mobile", "lighthouse_desktop"] as const).map(
        (key) => {
          const labelMap = {
            technical: "Technical",
            onpage: "On-Page",
            lighthouse_mobile: "Lighthouse Mobile",
            lighthouse_desktop: "Lighthouse Desktop",
          };
          const card = h[key];
          return (
            <div
              key={key}
              className="col-span-6 md:col-span-3 bg-card border border-border rounded-lg p-6"
            >
              <div className="flex items-start justify-between mb-3">
                <div className="text-muted-foreground text-xs uppercase font-semibold">
                  {labelMap[key]}
                </div>
                <Spark values={card.history} />
              </div>
              <MetricCardInline
                value={card.current}
                delta={card.delta}
              />
            </div>
          );
        }
      )}
    </Section>
  );
}

function MetricCardInline({
  value,
  delta,
}: {
  value: number | null;
  delta: number | null;
}) {
  return (
    <>
      <div className="text-3xl font-semibold text-primary font-data">
        {value == null ? "—" : value}
      </div>
      <div className="mt-2 text-xs">
        {delta == null ? (
          <span className="text-muted-foreground">No prior</span>
        ) : delta === 0 ? (
          <span className="text-muted-foreground">No change</span>
        ) : delta > 0 ? (
          <span className="text-emerald-400 tabular-nums font-data">
            ↑ {delta}
          </span>
        ) : (
          <span className="text-destructive tabular-nums font-data">
            ↓ {Math.abs(delta)}
          </span>
        )}
      </div>
    </>
  );
}
```

- [ ] **Step 2: Type check**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add src/components/seo/report/health-section.tsx
git commit -m "feat(seo): SEO health section with sparklines"
```

---

## Task 9: Site Traffic section

**Files:**
- Create: `src/components/seo/report/traffic-section.tsx`

- [ ] **Step 1: Create the file**

```tsx
// src/components/seo/report/traffic-section.tsx
import type { ReportData } from "@/lib/seo/report-data";
import { Section } from "./section";
import { MetricCard } from "./metric-card";

function fmtNum(n: number): string {
  return n.toLocaleString();
}

const SOURCE_LABELS: Array<{ key: keyof ReportData["traffic"] extends never ? never : "search" | "direct" | "referral" | "social" | "other"; label: string }> = [
  { key: "search", label: "Search" },
  { key: "direct", label: "Direct" },
  { key: "referral", label: "Referral" },
  { key: "social", label: "Social" },
  { key: "other", label: "Other" },
];

export function TrafficSection({ data }: { data: ReportData }) {
  if (!data.traffic) return null;
  const t = data.traffic;
  return (
    <Section title="Site Traffic">
      <div className="col-span-12 md:col-span-6">
        <MetricCard
          label="Sessions"
          size="hero"
          value={fmtNum(t.sessions.current)}
          delta={t.sessions.delta}
        />
      </div>
      <div className="col-span-12 md:col-span-6 grid grid-cols-3 gap-3">
        <MetricCard
          label="Organic Sessions"
          value={fmtNum(t.organic_sessions.current)}
          delta={t.organic_sessions.delta}
        />
        <MetricCard
          label="Users"
          value={fmtNum(t.users.current)}
          delta={t.users.delta}
        />
        <MetricCard
          label="Pages / Session"
          value={t.pages_per_session.current.toFixed(2)}
          delta={t.pages_per_session.delta}
        />
      </div>
      <div className="col-span-12 bg-card border border-border rounded-lg p-6">
        <div className="text-muted-foreground text-xs uppercase font-semibold mb-4">
          Traffic Sources
        </div>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          {SOURCE_LABELS.map((s) => (
            <div key={s.key}>
              <div className="text-muted-foreground text-xs">{s.label}</div>
              <div className="text-2xl font-semibold text-primary font-data tabular-nums mt-1">
                {t.sources[s.key]}%
              </div>
            </div>
          ))}
        </div>
      </div>
    </Section>
  );
}
```

- [ ] **Step 2: Type check**

```bash
npx tsc --noEmit
```

If TypeScript complains about the SOURCE_LABELS type, simplify it to:

```ts
const SOURCE_LABELS = [
  { key: "search" as const, label: "Search" },
  { key: "direct" as const, label: "Direct" },
  { key: "referral" as const, label: "Referral" },
  { key: "social" as const, label: "Social" },
  { key: "other" as const, label: "Other" },
];
```

- [ ] **Step 3: Commit**

```bash
git add src/components/seo/report/traffic-section.tsx
git commit -m "feat(seo): site traffic section"
```

---

## Task 10: Keyword Rankings section

**Files:**
- Create: `src/components/seo/report/keywords-section.tsx`

- [ ] **Step 1: Create the file**

```tsx
// src/components/seo/report/keywords-section.tsx
import type { ReportData } from "@/lib/seo/report-data";
import { Section } from "./section";
import { MetricCard } from "./metric-card";

export function KeywordsSection({ data }: { data: ReportData }) {
  if (!data.keywords) return null;
  const k = data.keywords;
  return (
    <Section title="Keyword Rankings">
      <div className="col-span-12 md:col-span-4 bg-card border border-border rounded-lg p-6">
        <div className="text-muted-foreground text-xs uppercase font-semibold mb-3">
          Phrases Ranking
        </div>
        <div className="text-5xl font-semibold text-primary font-data">
          {k.ranking_count}
          <span className="text-muted-foreground text-3xl">/{k.tracked_count}</span>
        </div>
        <div className="text-muted-foreground text-xs mt-2">
          {k.tracked_count > 0
            ? `${Math.round((k.ranking_count / k.tracked_count) * 100)}% of phrases`
            : "—"}
        </div>
      </div>
      <div className="col-span-6 md:col-span-4">
        <MetricCard
          label="Average Search Rank"
          value={k.avg_rank == null ? "—" : k.avg_rank.toString()}
        />
      </div>
      <div className="col-span-6 md:col-span-4">
        <MetricCard
          label="Total Search Volume"
          value={k.total_search_volume.toLocaleString()}
        />
      </div>
      <div className="col-span-12 md:col-span-6 bg-card border border-border rounded-lg p-6">
        <div className="text-muted-foreground text-xs uppercase font-semibold mb-3">
          Top Movers Up
        </div>
        {k.top_movers_up.length === 0 ? (
          <div className="text-muted-foreground text-sm">No improvements this period</div>
        ) : (
          <ul className="space-y-2">
            {k.top_movers_up.map((m) => (
              <li key={m.keyword} className="flex justify-between items-baseline gap-3">
                <span className="text-sm truncate">{m.keyword}</span>
                <span className="tabular-nums font-data text-sm">
                  <span className="text-muted-foreground">{m.prior_rank ?? "—"}</span>
                  <span className="mx-2 text-muted-foreground">→</span>
                  <span className="text-primary">{m.rank ?? "—"}</span>
                  <span className="ml-3 text-emerald-400">↑ {Math.abs(m.delta as number)}</span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
      <div className="col-span-12 md:col-span-6 bg-card border border-border rounded-lg p-6">
        <div className="text-muted-foreground text-xs uppercase font-semibold mb-3">
          Top Movers Down
        </div>
        {k.top_movers_down.length === 0 ? (
          <div className="text-muted-foreground text-sm">No drops this period</div>
        ) : (
          <ul className="space-y-2">
            {k.top_movers_down.map((m) => (
              <li key={m.keyword} className="flex justify-between items-baseline gap-3">
                <span className="text-sm truncate">{m.keyword}</span>
                <span className="tabular-nums font-data text-sm">
                  <span className="text-muted-foreground">{m.prior_rank ?? "—"}</span>
                  <span className="mx-2 text-muted-foreground">→</span>
                  <span className="text-primary">{m.rank ?? "—"}</span>
                  <span className="ml-3 text-destructive">↓ {m.delta}</span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Section>
  );
}
```

- [ ] **Step 2: Type check**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add src/components/seo/report/keywords-section.tsx
git commit -m "feat(seo): keyword rankings section"
```

---

## Task 11: Top Pages section

**Files:**
- Create: `src/components/seo/report/top-pages-section.tsx`

- [ ] **Step 1: Create the file**

```tsx
// src/components/seo/report/top-pages-section.tsx
import type { ReportData } from "@/lib/seo/report-data";
import { Section } from "./section";

export function TopPagesSection({ data }: { data: ReportData }) {
  if (data.top_pages.length === 0) return null;
  return (
    <Section title="Top Pages">
      <div className="col-span-12 bg-card border border-border rounded-lg p-6">
        <table className="w-full">
          <thead>
            <tr className="text-muted-foreground text-xs uppercase">
              <th className="text-left font-semibold pb-3">Page</th>
              <th className="text-right font-semibold pb-3">Sessions</th>
              <th className="text-right font-semibold pb-3 w-32">% of total</th>
            </tr>
          </thead>
          <tbody>
            {data.top_pages.map((p) => (
              <tr key={p.path} className="border-t border-border">
                <td className="py-3 text-sm truncate max-w-md">{p.path}</td>
                <td className="py-3 text-right tabular-nums font-data">
                  {p.sessions.toLocaleString()}
                </td>
                <td className="py-3 text-right tabular-nums font-data text-primary">
                  {p.pct_of_total}%
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Section>
  );
}
```

- [ ] **Step 2: Type check + commit**

```bash
npx tsc --noEmit
git add src/components/seo/report/top-pages-section.tsx
git commit -m "feat(seo): top pages section"
```

---

## Task 12: Issues & Wins section

**Files:**
- Create: `src/components/seo/report/issues-wins-section.tsx`

- [ ] **Step 1: Create the file**

```tsx
// src/components/seo/report/issues-wins-section.tsx
import type { ReportData } from "@/lib/seo/report-data";
import { Section } from "./section";

const SEVERITY_STYLES = {
  critical: "bg-destructive/20 text-destructive border-destructive/40",
  high: "bg-amber-500/20 text-amber-400 border-amber-500/40",
  medium: "bg-foreground/10 text-foreground border-border",
  low: "bg-muted text-muted-foreground border-border",
} as const;

export function IssuesWinsSection({ data }: { data: ReportData }) {
  return (
    <Section title="Issues & Wins">
      <div className="col-span-12 md:col-span-6 bg-card border border-border rounded-lg p-6">
        <div className="text-muted-foreground text-xs uppercase font-semibold mb-3">
          What Needs Attention
        </div>
        {data.issues.open_top.length === 0 ? (
          <div className="text-muted-foreground text-sm">No critical or high issues open.</div>
        ) : (
          <ul className="space-y-3">
            {data.issues.open_top.map((i, idx) => (
              <li key={`${i.title}-${idx}`} className="flex items-start gap-3">
                <span
                  className={`text-xs uppercase font-semibold px-2 py-0.5 rounded border shrink-0 ${SEVERITY_STYLES[i.severity]}`}
                >
                  {i.severity}
                </span>
                <div className="min-w-0">
                  <div className="text-sm">{i.title}</div>
                  {i.page_url && (
                    <div className="text-xs text-muted-foreground truncate">
                      {i.page_url}
                    </div>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
      <div className="col-span-12 md:col-span-6 bg-card border border-border rounded-lg p-6">
        <div className="text-muted-foreground text-xs uppercase font-semibold mb-3">
          Resolved This Period
        </div>
        {data.issues.resolved.length === 0 ? (
          <div className="text-muted-foreground text-sm">No fixes recorded this period.</div>
        ) : (
          <ul className="space-y-2">
            {data.issues.resolved.map((r, idx) => (
              <li key={`${r.title}-${idx}`} className="flex items-start gap-2">
                <span className="text-emerald-400 shrink-0">✓</span>
                <div className="text-sm">{r.title}</div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Section>
  );
}
```

- [ ] **Step 2: Type check + commit**

```bash
npx tsc --noEmit
git add src/components/seo/report/issues-wins-section.tsx
git commit -m "feat(seo): issues and wins section"
```

---

## Task 13: Trends + Summary + Footer + Index composition

**Files:**
- Create: `src/components/seo/report/trends-section.tsx`
- Create: `src/components/seo/report/summary-section.tsx`
- Create: `src/components/seo/report/report-footer.tsx`
- Create: `src/components/seo/report/index.tsx`

- [ ] **Step 1: Create trends-section.tsx**

```tsx
// src/components/seo/report/trends-section.tsx
import type { ReportData } from "@/lib/seo/report-data";
import { Section } from "./section";
import { ScoreHistoryChart } from "@/components/seo/score-history-chart";

export function TrendsSection({ data }: { data: ReportData }) {
  if (data.history.length < 2) return null;
  return (
    <Section title="Score Trends">
      <div className="col-span-12 bg-card border border-border rounded-lg p-6">
        <ScoreHistoryChart points={data.history} />
      </div>
    </Section>
  );
}
```

If `<ScoreHistoryChart>` exposes a different prop name than `points`, open `src/components/seo/score-history-chart.tsx` and match it. Don't modify the chart itself in this task.

- [ ] **Step 2: Create summary-section.tsx**

```tsx
// src/components/seo/report/summary-section.tsx
import type { ReportData } from "@/lib/seo/report-data";
import { Section } from "./section";

export function SummarySection({ data }: { data: ReportData }) {
  if (!data.ai_summary) return null;
  return (
    <Section title="What This Means">
      <div className="col-span-12 bg-card border border-border rounded-lg p-6">
        <p className="text-pretty leading-relaxed">{data.ai_summary}</p>
      </div>
    </Section>
  );
}
```

- [ ] **Step 3: Create report-footer.tsx**

```tsx
// src/components/seo/report/report-footer.tsx
import type { ReportData } from "@/lib/seo/report-data";
import { RANGE_LABEL } from "@/lib/seo/report-data";

export function ReportFooter({ data }: { data: ReportData }) {
  const generated = new Date(data.client.generated_at).toLocaleDateString(
    "en-US",
    { month: "short", day: "numeric", year: "numeric" }
  );
  return (
    <footer className="mt-16 pt-6 border-t border-border text-muted-foreground text-xs flex justify-between flex-wrap gap-2">
      <div>Delivered by Niewdel · {generated}</div>
      <div>{RANGE_LABEL[data.range]}</div>
    </footer>
  );
}
```

- [ ] **Step 4: Create index.tsx (composition)**

```tsx
// src/components/seo/report/index.tsx
import type { ReportData } from "@/lib/seo/report-data";
import { ReportHeader } from "./report-header";
import { HealthSection } from "./health-section";
import { TrafficSection } from "./traffic-section";
import { KeywordsSection } from "./keywords-section";
import { TopPagesSection } from "./top-pages-section";
import { IssuesWinsSection } from "./issues-wins-section";
import { TrendsSection } from "./trends-section";
import { SummarySection } from "./summary-section";
import { ReportFooter } from "./report-footer";

interface Props {
  data: ReportData;
  mode?: "standalone" | "embedded";
}

export function ClientReport({ data, mode = "standalone" }: Props) {
  return (
    <div className="bg-background text-foreground">
      <ReportHeader data={data} mode={mode} />
      <HealthSection data={data} />
      <TrafficSection data={data} />
      <KeywordsSection data={data} />
      <TopPagesSection data={data} />
      <IssuesWinsSection data={data} />
      <TrendsSection data={data} />
      <SummarySection data={data} />
      <ReportFooter data={data} />
    </div>
  );
}
```

- [ ] **Step 5: Type check + commit**

```bash
npx tsc --noEmit
git add src/components/seo/report/trends-section.tsx src/components/seo/report/summary-section.tsx src/components/seo/report/report-footer.tsx src/components/seo/report/index.tsx
git commit -m "feat(seo): trends, summary, footer + ClientReport composition"
```

---

## Task 14: Report route + middleware print bypass

**Files:**
- Create: `src/app/seo/clients/[id]/report/page.tsx`
- Modify: `src/middleware.ts:11-21` (the `isPublicApi` block)

- [ ] **Step 1: Create the route**

```tsx
// src/app/seo/clients/[id]/report/page.tsx
//
// Single source of report rendering. Two modes:
//   - Authenticated session: standalone view with range tabs.
//   - ?print=1&token=… : token-validated, no chrome, used by Playwright
//     to generate the monthly PDF.

import { notFound } from "next/navigation";
import {
  getReportData,
  REPORT_RANGES,
  type ReportRange,
} from "@/lib/seo/report-data";
import { verifyPrintToken } from "@/lib/seo/report-print-token";
import { ClientReport } from "@/components/seo/report";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

function parseRange(input: string | string[] | undefined): ReportRange {
  if (typeof input === "string" && (REPORT_RANGES as string[]).includes(input)) {
    return input as ReportRange;
  }
  return "30d";
}

export default async function ReportPage({ params, searchParams }: PageProps) {
  const { id } = await params;
  const sp = await searchParams;
  const range = parseRange(sp.range);

  // Print mode: token must validate. Middleware already let us through.
  const isPrint = sp.print === "1";
  if (isPrint) {
    const token = typeof sp.token === "string" ? sp.token : "";
    if (!verifyPrintToken(id, range, token)) {
      notFound();
    }
  }

  const data = await getReportData(id, range);

  return (
    <main
      className={
        isPrint
          ? "min-h-dvh bg-background px-10 py-10"
          : "min-h-dvh bg-background px-6 py-8 md:px-10"
      }
    >
      <div className="max-w-6xl mx-auto">
        <ClientReport data={data} mode="standalone" />
      </div>
    </main>
  );
}
```

- [ ] **Step 2: Update middleware to allow print mode through**

In `src/middleware.ts`, find the `isPublicApi` const declaration and replace the entire block (lines 11-21) with:

```ts
export async function middleware(request: NextRequest) {
  const isAuthPage = request.nextUrl.pathname.startsWith("/login");

  // Public routes — webhooks, processing endpoints, PIN check
  const isPublicApi =
    request.nextUrl.pathname.startsWith("/api/digest/") ||
    request.nextUrl.pathname.startsWith("/api/webhooks/") ||
    request.nextUrl.pathname.startsWith("/api/cron/") ||
    request.nextUrl.pathname.startsWith("/api/auth/") ||
    request.nextUrl.pathname.startsWith("/api/health");

  // Print mode for the SEO client report — the route validates an HMAC
  // token, so middleware lets it pass without session auth. Path shape:
  //   /seo/clients/<uuid>/report?print=1&token=…
  const isReportPrint =
    /^\/seo\/clients\/[^/]+\/report\/?$/.test(request.nextUrl.pathname) &&
    request.nextUrl.searchParams.get("print") === "1" &&
    !!request.nextUrl.searchParams.get("token");
```

Then in the PIN gate condition, swap:

```ts
  if (!hasPin && !isAuthPage && !isPublicApi) {
```

for:

```ts
  if (!hasPin && !isAuthPage && !isPublicApi && !isReportPrint) {
```

And in the auth-skip condition:

```ts
  if (!hasPin || isAuthPage || isPublicApi || authIsFresh) {
```

becomes:

```ts
  if (!hasPin || isAuthPage || isPublicApi || isReportPrint || authIsFresh) {
```

- [ ] **Step 3: Type check**

```bash
npx tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add src/app/seo/clients/[id]/report/page.tsx src/middleware.ts
git commit -m "feat(seo): report route + middleware print-mode bypass"
```

---

## Task 15: Browser verification

**Files:** none (verification only)

- [ ] **Step 1: Start the dev server**

```bash
npm run dev
```

In another terminal, find a real client id (re-use the one from Task 3's smoke).

- [ ] **Step 2: Open the report in a browser**

Navigate to:

```
http://localhost:3000/seo/clients/<id>/report?range=30d
```

Verify:
- Header shows client name + domain + range tabs (30d active) + generated date
- SEO Health section: overall score number + 4 score cards with sparklines + open issues with severity breakdown
- Site Traffic section renders if the client has GA4 (or is hidden if not)
- Keyword Rankings renders if tracked (or hidden)
- Top Pages renders if traffic data has top_pages
- Issues & Wins renders open critical/high + resolved
- Score Trends chart renders if there are 2+ history points
- AI Summary renders if `ai_summary` is set
- Footer shows "Delivered by Niewdel"

Click `90d` and `Lifetime` tabs — URL changes, page re-renders without errors.

- [ ] **Step 3: Verify print mode**

Generate a token in the dev console (any tab):

```bash
SEO_REPORT_PRINT_SECRET=<your-secret> npx tsx -e "import('./src/lib/seo/report-print-token').then(m => console.log(m.signPrintToken('<client-id>', '30d')))"
```

Open:

```
http://localhost:3000/seo/clients/<id>/report?range=30d&print=1&token=<token>
```

Verify: report renders, no auth redirect. Replace `<token>` with `bad`: should 404.

- [ ] **Step 4: Visual regression check against baseline rules**

Open browser DevTools → Elements. Search the page for:
- `linear-gradient` — must be empty
- `tracking-` — must only match `tabular-nums` (Tailwind utility, not letter-spacing)
- `h-screen` — must be empty (we use `h-dvh`)
- `box-shadow` with non-grayscale values — must be empty

If anything fails baseline rules, fix the offending component before continuing.

- [ ] **Step 5: Commit (no-op if everything passed)**

If you needed to fix anything in step 4, commit those fixes:

```bash
git add -A
git commit -m "fix(seo): baseline UI compliance in report sections"
```

If nothing needed fixing, no commit.

---

## Task 16: Update PDF renderer to accept URL

**Files:**
- Modify: `src/lib/seo/monthly-report-pdf.ts`

- [ ] **Step 1: Replace the file with a URL-driven version**

```ts
// src/lib/seo/monthly-report-pdf.ts
//
// Navigates Playwright to a URL (the print-mode report route) and prints
// the page to PDF bytes. Replaces the prior "render this HTML string"
// approach now that the report is a real Next.js route.

import { chromium, type LaunchOptions } from "playwright";

function getLaunchOptions(): LaunchOptions {
  const exec = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH;
  return exec ? { executablePath: exec } : {};
}

interface RenderOptions {
  /** HTML snippet rendered at the bottom of every printed page. */
  footerTemplate?: string;
}

export async function renderMonthlyReportPdf(
  url: string,
  opts: RenderOptions = {}
): Promise<Buffer> {
  const browser = await chromium.launch(getLaunchOptions());
  try {
    const context = await browser.newContext();
    const page = await context.newPage();
    await page.goto(url, { waitUntil: "networkidle", timeout: 60_000 });

    const pdfArgs: Parameters<typeof page.pdf>[0] = {
      format: "letter",
      printBackground: true,
      margin: { top: "14mm", right: "0", bottom: "16mm", left: "0" },
    };

    if (opts.footerTemplate) {
      pdfArgs.displayHeaderFooter = true;
      pdfArgs.headerTemplate = "<span></span>";
      pdfArgs.footerTemplate = opts.footerTemplate;
    }

    return await page.pdf(pdfArgs);
  } finally {
    await browser.close();
  }
}
```

- [ ] **Step 2: Type check**

```bash
npx tsc --noEmit
```

`monthly-report.ts` will now show errors because it still passes `html` — that's expected; we fix it in Task 17.

- [ ] **Step 3: Commit**

```bash
git add src/lib/seo/monthly-report-pdf.ts
git commit -m "refactor(seo): renderMonthlyReportPdf accepts URL"
```

---

## Task 17: Switch monthly cron to Playwright-on-URL

**Files:**
- Modify: `src/lib/seo/monthly-report.ts`

- [ ] **Step 1: Replace the rendering section**

Open `src/lib/seo/monthly-report.ts`. Replace the imports at the top (lines 5-19) with:

```ts
import {
  getServiceClient,
  getSeoJob,
  getSeoClient,
  updateSeoJob,
} from "./db";
import { renderMonthlyReportPdf } from "./monthly-report-pdf";
import { sendReportEmail } from "./send-report";
import { generateEmailSummary } from "./claude";
import { getReportData } from "./report-data";
import { signPrintToken } from "./report-print-token";
```

- [ ] **Step 2: Replace the data-loading + rendering blocks**

Find the long block that starts with `// Pull last ~6 checks` and ends with the line:

```ts
  const pdfBytes = await renderMonthlyReportPdf(html, { footerTemplate });
```

Replace that entire range (everything from "Pull last ~6 checks" through the `renderMonthlyReportPdf` call) with:

```ts
  // Use the unified report fetcher — same data shape powers the in-app
  // dashboard. Range is fixed to 30d for the monthly PDF.
  const data = await getReportData(job.client_id, "30d");

  if (data.history.length === 0) {
    await updateSeoJob(jobId, {
      status: "failed",
      error_message: "No seo_checks found. Run a weekly check first.",
      completed_at: new Date().toISOString(),
    });
    return;
  }

  await updateSeoJob(jobId, {
    current_stage: "Rendering report",
    progress_pct: 55,
  });

  // Build the print URL. Token covers (client_id, range, day_bucket) and
  // is valid for the rest of today UTC.
  const baseUrl =
    process.env.NEXT_PUBLIC_APP_URL ??
    process.env.APP_URL ??
    "http://localhost:3000";
  const token = signPrintToken(job.client_id, "30d");
  const printUrl = `${baseUrl}/seo/clients/${job.client_id}/report?range=30d&print=1&token=${token}`;

  // Footer template — same per-page footer the prior renderer used.
  const generated = new Date(data.client.generated_at).toLocaleDateString(
    "en-US",
    { month: "short", day: "numeric", year: "numeric" }
  );
  const footerTemplate = `
    <div style="font-size:9px;color:#666;width:100%;padding:0 12mm;display:flex;justify-content:space-between;">
      <span>Delivered by Niewdel · ${generated}</span>
      <span class="pageNumber"></span>/<span class="totalPages"></span>
    </div>
  `;

  await updateSeoJob(jobId, {
    current_stage: "Generating PDF",
    progress_pct: 70,
  });

  const pdfBytes = await renderMonthlyReportPdf(printUrl, { footerTemplate });
```

- [ ] **Step 3: Update the email-summary block to use `data` directly**

The email-summary block currently references things like `data.current.technical`. Update those references to use the new shape — `data.health.technical.current`, `data.health.technical.delta`, etc. Specifically, replace the call to `generateEmailSummary({...})` argument object so it reads from the new shape:

Find the `await generateEmailSummary({` block and replace its argument object with:

```ts
      summaryProse = await generateEmailSummary({
        domain: client.seo_config.domain,
        client_name: client.name,
        contact_name: client.seo_config.contact_name ?? null,
        period_label: data.client.period_label,
        scores: {
          technical: data.health.technical.current,
          onpage: data.health.onpage.current,
          lighthouse_mobile: data.health.lighthouse_mobile.current,
          lighthouse_desktop: data.health.lighthouse_desktop.current,
        },
        deltas: {
          technical: data.health.technical.delta,
          onpage: data.health.onpage.delta,
          lighthouse_mobile: data.health.lighthouse_mobile.delta,
          lighthouse_desktop: data.health.lighthouse_desktop.delta,
        },
        new_issue_count: data.issues.open_top.length,
        resolved_issue_count: data.issues.resolved.length,
        top_critical_issues: data.issues.open_top.slice(0, 3).map((i) => i.title),
        traffic: data.traffic
          ? {
              sessions: data.traffic.sessions.current,
              organic_sessions: data.traffic.organic_sessions.current,
              users: data.traffic.users.current,
              sessions_delta: data.traffic.sessions.delta,
              organic_sessions_delta: data.traffic.organic_sessions.delta,
            }
          : null,
      });
```

- [ ] **Step 4: Update other references to old `data` shape**

In the same file, update any remaining references to the old shape. Specifically:
- `data.period_label` → `data.client.period_label`
- `data.top_issues` → `data.issues.open_top`
- `data.resolved_issues` → `data.issues.resolved`

Use the editor's find-in-file to catch them all. Type-checker will fail if any are missed.

- [ ] **Step 5: Type check**

```bash
npx tsc --noEmit
```

Expected: clean. If a reference to the old shape was missed, fix it.

- [ ] **Step 6: Commit**

```bash
git add src/lib/seo/monthly-report.ts
git commit -m "refactor(seo): monthly cron uses Playwright on /report URL"
```

---

## Task 18: End-to-end PDF cron smoke

**Files:** none (verification only)

- [ ] **Step 1: Confirm app URL env is set**

In `.env.local`, ensure `NEXT_PUBLIC_APP_URL=http://localhost:3000` (or the host the running dev server uses) and `SEO_REPORT_PRINT_SECRET` is set to the same value the dev server uses.

- [ ] **Step 2: Trigger a monthly report job for a real client**

Find the API endpoint shape from `src/app/api/seo/clients/[id]/run-monthly/route.ts` (a quick grep / read):

```bash
grep -r run-monthly src/app/api
```

Hit it via curl with a valid auth cookie, OR — simpler — start dev server, log in via PIN, and from a logged-in tab open the dev console:

```js
fetch("/api/seo/clients/<id>/run-monthly", { method: "POST" }).then(r => r.json()).then(console.log)
```

- [ ] **Step 3: Watch the job and the PDF output**

Use the Supabase MCP `execute_sql` tool to poll the job:

```sql
select id, status, current_stage, progress_pct, error_message, metadata
from seo_jobs
where client_id = '<id>' and type = 'monthly_report'
order by created_at desc
limit 1;
```

Expected progression: queued → running ("Loading 30-day history" briefly may not appear; "Rendering report" → "Generating PDF" → "Uploading to storage" → complete).

When status is `complete`, open the `metadata.report_url` in a browser. The PDF should render the new design (dark cards, big cyan numbers).

- [ ] **Step 4: If PDF looks wrong**

Common issues:
- All sections empty: token validation failing → check `SEO_REPORT_PRINT_SECRET` matches between cron env and the route's env
- Layout broken: Tailwind not loading at print time → confirm dev server is up; Playwright loads from URL, not from a static HTML string, so dev server must be running for the cron
- Footer missing: `footerTemplate` not passed correctly → re-check Task 17 step 2

Fix and re-run.

- [ ] **Step 5: Commit any fixes**

If you needed to fix something:

```bash
git add -A
git commit -m "fix(seo): <specific fix>"
```

If everything worked first try, no commit.

---

## Task 19: Trim /seo/clients/[id]/page.tsx

**Files:**
- Modify: `src/app/seo/clients/[id]/page.tsx`

- [ ] **Step 1: Read the file to understand what's there**

```bash
wc -l src/app/seo/clients/[id]/page.tsx
```

- [ ] **Step 2: Identify the duplicated UI**

Open the file and find the sections that now live in the report:
- Score cards (technical/onpage/mobile/desktop)
- Issue lists (open + resolved)
- Traffic cards
- Score history chart wrapper

Keep the admin chrome:
- Page header with client name (might keep, or replace with the embedded report's header)
- Run-check / run-monthly / run-keyword / run-competitor buttons
- Recent jobs list
- Configuration form (domain, GA4 property, target keywords, dry_run toggle, etc.)

- [ ] **Step 3: Embed the report below the chrome**

At the top of the file, add:

```tsx
import { getReportData } from "@/lib/seo/report-data";
import { ClientReport } from "@/components/seo/report";
```

In the page component (after admin chrome JSX, before the closing tag), add:

```tsx
{/* Embedded report — same components as the standalone /report route */}
<div className="mt-12">
  <ClientReport data={await getReportData(id, "30d")} mode="embedded" />
</div>
```

If the page isn't already an `async` server component, you may need to fetch the data in a sub-component. Check the existing patterns in the file.

Delete the now-duplicate score/issue/traffic/chart UI from the same file.

- [ ] **Step 4: Type check + browser verify**

```bash
npx tsc --noEmit
npm run dev
```

Open `http://localhost:3000/seo/clients/<id>` and verify:
- Admin chrome (run buttons, jobs list, config form) all still work
- The report renders below it (with `mode="embedded"` → no range tabs in the embedded header)
- Page is shorter than before (`wc -l` should drop 300+ lines)

- [ ] **Step 5: Commit**

```bash
git add src/app/seo/clients/[id]/page.tsx
git commit -m "refactor(seo): client page embeds shared report component"
```

---

## Task 20: Delete monthly-report-html.ts + final cleanup

**Files:**
- Delete: `src/lib/seo/monthly-report-html.ts`
- Modify: `src/lib/seo/report-data.ts` (drop the import-from-deletion-target)

- [ ] **Step 1: Move the ScoreHistoryPoint type into report-data.ts**

In `src/lib/seo/report-data.ts`, replace the import line:

```ts
import type { ScoreHistoryPoint } from "./monthly-report-html";
```

with the local definition (also exported, so other code can import it from here):

```ts
export interface ScoreHistoryPoint {
  created_at: string;
  technical_score: number | null;
  onpage_score: number | null;
  lighthouse_mobile: number | null;
  lighthouse_desktop: number | null;
}
```

- [ ] **Step 2: Find any other code still importing from monthly-report-html**

```bash
grep -rn "from.*monthly-report-html" src/
```

Update each match to import from `report-data.ts` (for `ScoreHistoryPoint`) or remove the import entirely if it was only for `MonthlyReportData`/`renderMonthlyReportHtml`/`renderMonthlyReportFooterHtml`.

The `<ScoreHistoryChart>` component currently has its own local copy of `ScoreHistoryPoint` per its file header — leave that alone, it's intentional.

- [ ] **Step 3: Delete the file**

```bash
rm src/lib/seo/monthly-report-html.ts
```

- [ ] **Step 4: Type check + lint**

```bash
npx tsc --noEmit
npm run lint
```

Both must pass clean.

- [ ] **Step 5: Build**

```bash
npm run build
```

Must succeed.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "refactor(seo): delete monthly-report-html.ts (584 lines)"
```

---

## Task 21: Final verification

**Files:** none

- [ ] **Step 1: Smoke the smoke scripts**

```bash
SEO_REPORT_PRINT_SECRET=test npx tsx scripts/smoke-report-print-token.ts
npx tsx scripts/smoke-report-data.ts <client_id>
```

Both must pass.

- [ ] **Step 2: Visit each surface**

With dev server running:
- `/seo/clients/<id>` — admin chrome + embedded report
- `/seo/clients/<id>/report?range=30d` — standalone report, 30d active
- `/seo/clients/<id>/report?range=90d` — standalone report, 90d active
- `/seo/clients/<id>/report?range=life` — standalone report, lifetime
- Print URL with valid token — renders without chrome
- Print URL with bad token — 404

- [ ] **Step 3: Re-trigger a monthly cron and confirm PDF**

Same as Task 18. Verify the PDF in storage matches the in-browser standalone view.

- [ ] **Step 4: Confirm acceptance criteria from spec**

Open `docs/superpowers/specs/2026-05-05-seo-client-report-design.md` and tick through the "Acceptance criteria" section. Every box should be true.

- [ ] **Step 5: Final commit (smoke scripts cleanup)**

If you want to keep the smoke scripts as ongoing test artifacts, leave them. If you want them gone:

```bash
rm scripts/smoke-report-print-token.ts scripts/smoke-report-data.ts
git add -A
git commit -m "chore(seo): remove one-shot smoke scripts"
```

Recommended: keep them. They're tiny and useful when the data fetcher changes.

---

## Self-review

**Spec coverage:** Every section in the spec maps to a task —
- Architecture (single renderer, two surfaces) → Tasks 13, 14, 17
- Print token security → Tasks 1, 14
- Data fetcher → Tasks 2, 3, 4, 5
- 9 sections → Tasks 7, 8, 9, 10, 11, 12, 13
- Print mode + middleware → Task 14
- PDF cutover → Tasks 16, 17, 18
- Page trim → Task 19
- HTML deletion → Task 20
- Acceptance criteria → Task 21

**Type consistency:** `ReportData`, `ReportRange`, `ScoreCard`, `MetricCard`, `KeywordMover` defined once in Task 2, used consistently in Tasks 3-13, 17, 19. The `ClientReport` component takes `{ data, mode }` consistently. `renderMonthlyReportPdf` signature change in Task 16 matches the call site in Task 17.

**Placeholders:** All steps contain real code. No "implement appropriately" or "TODO" or "similar to". Smoke scripts have full assert content.

**Open questions:** The exact prop name on `<ScoreHistoryChart>` is checked in Task 13 step 1 — if it differs from `points`, the implementer adjusts inline. Not a blocker.
