import type { PageSnapshot, SeoConfig } from "./types";

interface IssueRow {
  id: string;
  fingerprint: string;
  severity: "critical" | "high" | "medium" | "low";
  category: string;
  sub_type: string | null;
  page_url: string | null;
  title: string;
  description: string | null;
  recommendation: string | null;
  first_seen_at: string;
  last_seen_at: string;
}

interface CheckRow {
  id: string;
  technical_score: number | null;
  onpage_score: number | null;
  lighthouse_mobile: number | null;
  lighthouse_desktop: number | null;
  pages_crawled: number | null;
  pages: PageSnapshot[] | null;
  ai_summary: string | null;
  created_at: string;
}

interface ClientRow {
  id: string;
  name: string;
  seo_config: SeoConfig | null;
}

const SEVERITY_ORDER = { critical: 0, high: 1, medium: 2, low: 3 } as const;

function pageKey(url: string | null): string {
  if (!url) return "__site__";
  try {
    const u = new URL(url);
    const path = u.pathname.replace(/\/+$/, "") || "/";
    return path;
  } catch {
    return url;
  }
}

function shortDate(iso: string): string {
  return new Date(iso).toISOString().split("T")[0];
}

function severityBadge(s: string): string {
  switch (s) {
    case "critical":
      return "🔴 CRITICAL";
    case "high":
      return "🟠 HIGH";
    case "medium":
      return "🟡 MEDIUM";
    case "low":
      return "⚪ LOW";
    default:
      return s.toUpperCase();
  }
}

/**
 * Render a markdown fix-plan suitable for feeding into a Claude Code
 * project. The file teaches Claude what its job is, lists every open
 * issue grouped by page, and includes the current page snapshot so
 * Claude can compare desired vs actual state without re-crawling.
 */
export function renderFixPlanMarkdown(input: {
  client: ClientRow;
  check: CheckRow;
  issues: IssueRow[];
}): string {
  const { client, check, issues } = input;
  const cfg: Partial<SeoConfig> = client.seo_config ?? {};
  const domain = cfg.domain ?? "";
  const generatedAt = new Date().toISOString();

  // Group issues by page
  const byPage = new Map<string, IssueRow[]>();
  for (const i of issues) {
    const key = pageKey(i.page_url);
    if (!byPage.has(key)) byPage.set(key, []);
    byPage.get(key)!.push(i);
  }
  for (const arr of byPage.values()) {
    arr.sort(
      (a, b) =>
        (SEVERITY_ORDER[a.severity] ?? 99) - (SEVERITY_ORDER[b.severity] ?? 99)
    );
  }

  // Index page snapshots by path so we can show current state per page
  const snapshotByKey = new Map<string, PageSnapshot>();
  for (const p of check.pages ?? []) {
    snapshotByKey.set(pageKey(p.url), p);
  }

  const counts = {
    critical: issues.filter((i) => i.severity === "critical").length,
    high: issues.filter((i) => i.severity === "high").length,
    medium: issues.filter((i) => i.severity === "medium").length,
    low: issues.filter((i) => i.severity === "low").length,
  };

  const lines: string[] = [];

  // ----- Header / brief -----
  lines.push(`# SEO Fix Plan: ${client.name}`);
  lines.push("");
  lines.push(`**Domain:** ${domain || "n/a"}`);
  lines.push(`**Generated:** ${generatedAt}`);
  lines.push(`**Based on check:** ${shortDate(check.created_at)} (id \`${check.id}\`)`);
  lines.push("");

  lines.push("## Your job");
  lines.push("");
  lines.push(
    "You are working in this site's repository. Implement the fixes listed below. Each issue includes the affected page URL, severity, the problem, and a concrete recommendation. Apply the fix in the appropriate template/component file in this repo."
  );
  lines.push("");
  lines.push("**Rules:**");
  lines.push("");
  lines.push("- Fix issues in **severity order**: critical → high → medium → low.");
  lines.push("- For each fix, briefly state which file you edited and why.");
  lines.push("- Do NOT add tracking, analytics, or third-party scripts unless asked.");
  lines.push("- Do NOT change visual design or copy unless required to fix a specific issue (e.g. rewriting a too-long title).");
  lines.push(
    "- For title/meta rewrites: keep the brand voice. Aim for 50-60 char titles, 150-160 char meta descriptions. Include the page's primary keyword naturally."
  );
  lines.push("- For schema markup: use schema.org JSON-LD, embedded in the page <head>. For local-service businesses prefer LocalBusiness or appropriate sub-type.");
  lines.push("- Skip any issue you can't fix without more information; note it under \"## Deferred\" at the end of your response.");
  lines.push("");

  // ----- Snapshot summary -----
  lines.push("## Current state");
  lines.push("");
  lines.push("| Metric | Score |");
  lines.push("| --- | --- |");
  lines.push(`| Technical | ${check.technical_score ?? "n/a"}/100 |`);
  lines.push(`| On-page | ${check.onpage_score ?? "n/a"}/100 |`);
  lines.push(`| Lighthouse mobile | ${check.lighthouse_mobile ?? "n/a"}/100 |`);
  if (check.lighthouse_desktop != null) {
    lines.push(`| Lighthouse desktop | ${check.lighthouse_desktop}/100 |`);
  }
  lines.push(`| Pages monitored | ${check.pages_crawled ?? 0} |`);
  lines.push("");
  lines.push(
    `**Issue counts:** ${counts.critical} critical, ${counts.high} high, ${counts.medium} medium, ${counts.low} low. ${issues.length} total open issues.`
  );
  lines.push("");
  if (check.ai_summary) {
    lines.push("> " + check.ai_summary.replace(/\n/g, "\n> "));
    lines.push("");
  }

  // ----- Issues by page -----
  // Order: site-wide first, then pages by issue count (worst first)
  const orderedKeys = [...byPage.keys()].sort((a, b) => {
    if (a === "__site__") return -1;
    if (b === "__site__") return 1;
    return (byPage.get(b)!.length - byPage.get(a)!.length);
  });

  lines.push("## Issues");
  lines.push("");
  for (const key of orderedKeys) {
    const pageIssues = byPage.get(key)!;
    if (key === "__site__") {
      lines.push(`### Site-wide (${pageIssues.length} issue${pageIssues.length === 1 ? "" : "s"})`);
      lines.push("");
      lines.push("Issues that affect multiple pages or the site overall.");
      lines.push("");
    } else {
      const snap = snapshotByKey.get(key);
      const heading = snap ? `${key}` : key;
      lines.push(`### \`${heading}\` (${pageIssues.length} issue${pageIssues.length === 1 ? "" : "s"})`);
      lines.push("");
      if (snap) {
        lines.push("**Current page state:**");
        lines.push(`- URL: ${snap.url}`);
        lines.push(`- HTTP status: ${snap.status_code}`);
        lines.push(`- Title (${snap.title.length} chars): ${snap.title ? `"${snap.title}"` : "*(missing)*"}`);
        lines.push(`- Meta description (${snap.meta_desc.length} chars): ${snap.meta_desc ? `"${snap.meta_desc}"` : "*(missing)*"}`);
        lines.push(`- H1 count: ${snap.h1_count}, H2 count: ${snap.h2_count}`);
        lines.push(`- Images: ${snap.alt_total} total, ${snap.alt_missing} missing alt`);
        lines.push(`- Has canonical: ${snap.has_canonical ? "yes" : "no"}`);
        lines.push(
          `- Schema types: ${snap.schema_types.length === 0 ? "*(none)*" : snap.schema_types.join(", ")}`
        );
        if (snap.psi_mobile != null) {
          lines.push(`- Lighthouse mobile: ${snap.psi_mobile}/100`);
        }
        lines.push("");
      }
    }

    for (const i of pageIssues) {
      lines.push(`#### ${severityBadge(i.severity)} ${i.title}`);
      lines.push("");
      lines.push(`- **Category:** \`${i.category}\` / \`${i.sub_type ?? "n/a"}\``);
      if (i.page_url && key !== "__site__") {
        lines.push(`- **Page:** ${i.page_url}`);
      }
      if (i.description) {
        lines.push(`- **What's wrong:** ${i.description}`);
      }
      if (i.recommendation) {
        lines.push(`- **Fix:** ${i.recommendation}`);
      }
      lines.push(`- **First seen:** ${shortDate(i.first_seen_at)}`);
      lines.push("");
    }
  }

  // ----- Footer -----
  lines.push("---");
  lines.push("");
  lines.push("## When you're done");
  lines.push("");
  lines.push(
    "Reply with a short summary: which issues you fixed, which files changed, and any issues you deferred (with the reason). The next weekly SEO check will confirm the fixes. Issues that disappear in the next crawl are auto-marked resolved in Command Center."
  );
  lines.push("");

  return lines.join("\n");
}
