"use client";

import { useEffect, useState, useCallback, use } from "react";
import {
  TrendingUp,
  Loader2,
  CheckCircle2,
  Globe,
  Play,
  Settings,
  ExternalLink,
  FileText,
  Copy,
  Download,
  Check as CheckIcon,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import { PageLayout } from "@/components/layout/page-layout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { supabase } from "@/lib/supabase";
import { cn } from "@/lib/utils";
import { ScoreHistoryChart } from "@/components/seo/score-history-chart";

type SeoConfig = {
  enabled?: boolean;
  domain?: string;
  contact_email?: string;
  contact_name?: string;
  target_keywords?: string[];
  competitor_domains?: string[];
  crawl_config?: { max_pages?: number };
  dry_run?: boolean;
  report_status?: "enabled" | "paused";
};

type Client = {
  id: string;
  workspace_id: string;
  name: string;
  seo_config: SeoConfig | null;
};

type PageSnap = {
  url: string;
  status_code: number;
  title: string;
  meta_desc: string;
  h1_count: number;
  h2_count: number;
  alt_total: number;
  alt_missing: number;
  schema_types: string[];
  has_canonical: boolean;
  psi_mobile?: number;
  psi_desktop?: number;
  word_count: number;
};

type Check = {
  id: string;
  technical_score: number | null;
  lighthouse_mobile: number | null;
  lighthouse_desktop: number | null;
  onpage_score: number | null;
  freshness_days: number | null;
  pages_crawled: number | null;
  ai_summary: string | null;
  diff_from_previous: {
    new_issues_count?: number;
    resolved_issues_count?: number;
    pages_added?: number;
    pages_removed?: number;
    pages_changed?: number;
    score_deltas?: {
      technical?: number | null;
      onpage?: number | null;
      lighthouse_mobile?: number | null;
      lighthouse_desktop?: number | null;
    };
  } | null;
  pages: PageSnap[] | null;
  created_at: string;
};

type Issue = {
  id: string;
  fingerprint: string;
  severity: "critical" | "high" | "medium" | "low";
  category: string;
  sub_type: string | null;
  page_url: string | null;
  title: string;
  description: string | null;
  recommendation: string | null;
  status: string;
  first_seen_at: string;
  last_seen_at: string;
};

type KeywordRank = {
  keyword: string;
  rank: number | null;
  url: string | null;
  captured_at: string;
  prior_rank: number | null;
  delta: number | null;
};

type CompetitorGap = {
  competitor_domain: string;
  keyword: string;
  competitor_rank: number;
  competitor_url: string | null;
  search_volume: number | null;
  cpc: number | null;
  captured_at: string;
};

type Job = {
  id: string;
  type: string;
  status: string;
  current_stage: string | null;
  progress_pct: number;
  error_message: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
  completed_at: string | null;
};

const SEVERITY_ORDER = { critical: 0, high: 1, medium: 2, low: 3 } as const;

function severityClass(s: string): string {
  switch (s) {
    case "critical":
      return "bg-rose-500/15 text-rose-400 border-rose-500/30";
    case "high":
      return "bg-orange-500/15 text-orange-400 border-orange-500/30";
    case "medium":
      return "bg-amber-500/15 text-amber-400 border-amber-500/30";
    default:
      return "bg-muted/40 text-muted-foreground border-border";
  }
}

function categoryLabel(c: string): string {
  switch (c) {
    case "ai_search":
      return "AI search";
    case "onpage":
      return "on-page";
    case "gbp":
      return "GBP";
    default:
      return c;
  }
}

function scoreColor(score: number | null | undefined): string {
  if (score == null) return "text-muted-foreground";
  if (score >= 85) return "text-emerald-400";
  if (score >= 65) return "text-amber-400";
  return "text-rose-400";
}

function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export default function SeoClientDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [client, setClient] = useState<Client | null>(null);
  const [checks, setChecks] = useState<Check[]>([]);
  const [issues, setIssues] = useState<Issue[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [keywordRanks, setKeywordRanks] = useState<KeywordRank[]>([]);
  const [competitorGaps, setCompetitorGaps] = useState<CompetitorGap[]>([]);
  const [runningKw, setRunningKw] = useState(false);
  const [runningComp, setRunningComp] = useState(false);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [runningReport, setRunningReport] = useState(false);
  // When the user clicks "Monthly report" we stash the returned jobId here,
  // then watch the jobs realtime feed below — when this jobId transitions
  // to status=complete with a report_url, we auto-open it in a new tab.
  const [awaitingReportJobId, setAwaitingReportJobId] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [fixPlanOpen, setFixPlanOpen] = useState(false);
  const [fixPlanLoading, setFixPlanLoading] = useState(false);
  const [fixPlanMarkdown, setFixPlanMarkdown] = useState<string | null>(null);
  const [fixPlanFilename, setFixPlanFilename] = useState<string | null>(null);
  const [fixPlanError, setFixPlanError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const fetchAll = useCallback(async () => {
    const res = await fetch(`/api/seo/clients/${id}`).then((r) => r.json());
    if (res.client) {
      setClient(res.client);
      setChecks(res.checks ?? []);
      setIssues(res.issues ?? []);
      setJobs(res.jobs ?? []);
      setKeywordRanks(res.keyword_ranks ?? []);
      setCompetitorGaps(res.competitor_gaps ?? []);
    }
    setLoading(false);
  }, [id]);

  const handleRunKeyword = async () => {
    setRunningKw(true);
    try {
      const res = await fetch(`/api/seo/clients/${id}/run-keyword`, {
        method: "POST",
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        alert(err.error ?? "Failed to start keyword check");
      }
    } finally {
      setRunningKw(false);
    }
  };

  const handleRunCompetitor = async () => {
    setRunningComp(true);
    try {
      const res = await fetch(`/api/seo/clients/${id}/run-competitor`, {
        method: "POST",
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        alert(err.error ?? "Failed to start competitor check");
      }
    } finally {
      setRunningComp(false);
    }
  };

  useEffect(() => {
    fetchAll();
    const ch = supabase
      .channel(`seo-client-${id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "seo_jobs", filter: `client_id=eq.${id}` },
        () => fetchAll()
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "seo_checks", filter: `client_id=eq.${id}` },
        () => fetchAll()
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "seo_issues", filter: `client_id=eq.${id}` },
        () => fetchAll()
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "seo_keyword_ranks", filter: `client_id=eq.${id}` },
        () => fetchAll()
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "seo_competitor_gaps", filter: `client_id=eq.${id}` },
        () => fetchAll()
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [id, fetchAll]);

  const activeJob = jobs.find((j) => j.status === "queued" || j.status === "running");
  const latest = checks[0] ?? null;

  const handleRun = async () => {
    setRunning(true);
    try {
      const res = await fetch(`/api/seo/clients/${id}/run-check`, {
        method: "POST",
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        alert(err.error ?? "Failed to start check");
      }
    } finally {
      setRunning(false);
    }
  };

  const handleRunMonthly = async () => {
    setRunningReport(true);
    try {
      const res = await fetch(`/api/seo/clients/${id}/run-monthly`, {
        method: "POST",
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        alert(json.error ?? "Failed to start monthly report");
        return;
      }
      if (json.jobId) {
        setAwaitingReportJobId(json.jobId as string);
      }
    } finally {
      setRunningReport(false);
    }
  };

  // Auto-open the PDF the moment the just-clicked monthly_report job completes.
  // Realtime updates jobs[] which triggers this effect; we match by jobId so
  // older completed reports don't re-trigger an open on every page mount.
  useEffect(() => {
    if (!awaitingReportJobId) return;
    const job = jobs.find((j) => j.id === awaitingReportJobId);
    if (!job) return;
    if (job.status === "complete") {
      const url = job.metadata?.report_url as string | undefined;
      if (url) {
        window.open(url, "_blank", "noopener,noreferrer");
      }
      setAwaitingReportJobId(null);
    } else if (job.status === "failed" || job.status === "cancelled") {
      setAwaitingReportJobId(null);
    }
  }, [awaitingReportJobId, jobs]);

  const openFixPlan = async () => {
    setFixPlanOpen(true);
    setFixPlanLoading(true);
    setFixPlanError(null);
    setFixPlanMarkdown(null);
    try {
      const res = await fetch(`/api/seo/clients/${id}/fix-plan`);
      const json = await res.json();
      if (!res.ok) {
        setFixPlanError(json.error ?? "Failed to generate fix plan");
      } else {
        setFixPlanMarkdown(json.markdown as string);
        setFixPlanFilename(json.filename as string);
      }
    } catch (err) {
      setFixPlanError(err instanceof Error ? err.message : "Failed");
    } finally {
      setFixPlanLoading(false);
    }
  };

  const copyFixPlan = async () => {
    if (!fixPlanMarkdown) return;
    try {
      await navigator.clipboard.writeText(fixPlanMarkdown);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // ignore — clipboard may be denied
    }
  };

  const downloadFixPlan = () => {
    if (!fixPlanMarkdown || !fixPlanFilename) return;
    const blob = new Blob([fixPlanMarkdown], {
      type: "text/markdown;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = fixPlanFilename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const sortedIssues = [...issues].sort((a, b) => {
    return (
      (SEVERITY_ORDER[a.severity] ?? 99) - (SEVERITY_ORDER[b.severity] ?? 99)
    );
  });

  if (!loading && !client) {
    return (
      <PageLayout title="SEO Client Not Found" icon={TrendingUp} maxWidth="xl">
        <Card className="p-6 text-sm text-muted-foreground">
          No client at this URL.
        </Card>
      </PageLayout>
    );
  }

  const cfg = client?.seo_config ?? {};

  return (
    <PageLayout
      title={client?.name ?? "SEO Client"}
      description={cfg.domain}
      icon={TrendingUp}
      maxWidth="xl"
      loading={loading}
      breadcrumbs={[
        { label: "SEO", href: "/seo" },
        { label: client?.name ?? "Client" },
      ]}
      actions={
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={handleRunMonthly}
            disabled={runningReport || !latest || !cfg.enabled || !cfg.domain}
            className="rounded gap-1.5"
            title={
              !latest
                ? "Run a weekly check first"
                : "Generate + email monthly PDF report"
            }
          >
            {runningReport ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <Download className="size-3.5" />
            )}
            Monthly report
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={openFixPlan}
            disabled={!latest || sortedIssues.length === 0}
            className="rounded gap-1.5"
            title={
              !latest
                ? "Run a check first"
                : sortedIssues.length === 0
                  ? "No open issues to fix"
                  : "Generate Claude Code fix plan"
            }
          >
            <FileText className="size-3.5" />
            Fix plan
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setSettingsOpen(true)}
            className="rounded gap-1.5"
          >
            <Settings className="size-3.5" />
            Settings
          </Button>
          <Button
            size="sm"
            onClick={handleRun}
            disabled={running || !!activeJob || !cfg.enabled || !cfg.domain}
            className="rounded gap-1.5"
          >
            {running || activeJob ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <Play className="size-3.5" />
            )}
            Run check
          </Button>
        </div>
      }
    >
      {/* Active job progress */}
      {activeJob && (
        <Card className="p-3 space-y-1.5">
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground inline-flex items-center gap-1.5">
              <Loader2 className="size-3 animate-spin" />
              {activeJob.current_stage ?? "Working..."}
            </span>
            <span className="font-mono">{activeJob.progress_pct}%</span>
          </div>
          <div className="h-1 rounded bg-muted/40 overflow-hidden">
            <div
              className="h-full bg-primary transition-all duration-300"
              style={{ width: `${activeJob.progress_pct}%` }}
            />
          </div>
        </Card>
      )}

      {/* Header scores + meta */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <ScoreCard
          label="Technical"
          score={latest?.technical_score}
          delta={latest?.diff_from_previous?.score_deltas?.technical}
        />
        <ScoreCard
          label="On-page"
          score={latest?.onpage_score}
          delta={latest?.diff_from_previous?.score_deltas?.onpage}
        />
        <ScoreCard
          label="Mobile"
          score={latest?.lighthouse_mobile}
          delta={latest?.diff_from_previous?.score_deltas?.lighthouse_mobile}
        />
        <ScoreCard
          label="Desktop"
          score={latest?.lighthouse_desktop}
          delta={latest?.diff_from_previous?.score_deltas?.lighthouse_desktop}
        />
        <Card className="p-4 space-y-1">
          <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
            Last check
          </div>
          <div className="text-sm font-medium">
            {latest ? formatDate(latest.created_at) : "Never"}
          </div>
          <div className="text-xs text-muted-foreground">
            {latest ? `${latest.pages_crawled ?? 0} pages` : "—"}
            {latest?.freshness_days != null
              ? ` · ${latest.freshness_days}d median age`
              : ""}
          </div>
        </Card>
      </div>

      {/* Score history */}
      {checks.length >= 2 && (
        <ScoreHistoryChart
          points={checks.map((c) => ({
            created_at: c.created_at,
            technical_score: c.technical_score,
            onpage_score: c.onpage_score,
            lighthouse_mobile: c.lighthouse_mobile,
            lighthouse_desktop: c.lighthouse_desktop,
          }))}
        />
      )}

      {/* AI summary */}
      {latest?.ai_summary && (
        <Card className="p-4 border-l-2 border-l-primary/60">
          <p className="text-sm text-pretty leading-relaxed">
            {latest.ai_summary}
          </p>
        </Card>
      )}

      {/* Diff strip */}
      {latest?.diff_from_previous &&
        ((latest.diff_from_previous.new_issues_count ?? 0) > 0 ||
          (latest.diff_from_previous.resolved_issues_count ?? 0) > 0 ||
          (latest.diff_from_previous.pages_added ?? 0) > 0 ||
          (latest.diff_from_previous.pages_removed ?? 0) > 0 ||
          (latest.diff_from_previous.pages_changed ?? 0) > 0) && (
          <Card className="p-3 flex flex-wrap items-center gap-3 text-xs">
            <span className="text-muted-foreground uppercase tracking-wide text-[10px]">
              Since last check
            </span>
            {(latest.diff_from_previous.new_issues_count ?? 0) > 0 && (
              <span className="text-rose-400">
                +{latest.diff_from_previous.new_issues_count} new issues
              </span>
            )}
            {(latest.diff_from_previous.resolved_issues_count ?? 0) > 0 && (
              <span className="text-emerald-400">
                -{latest.diff_from_previous.resolved_issues_count} fixed
              </span>
            )}
            {(latest.diff_from_previous.pages_added ?? 0) > 0 && (
              <span className="text-muted-foreground">
                +{latest.diff_from_previous.pages_added} pages added
              </span>
            )}
            {(latest.diff_from_previous.pages_removed ?? 0) > 0 && (
              <span className="text-muted-foreground">
                -{latest.diff_from_previous.pages_removed} pages removed
              </span>
            )}
            {(latest.diff_from_previous.pages_changed ?? 0) > 0 && (
              <span className="text-muted-foreground">
                {latest.diff_from_previous.pages_changed} pages changed
              </span>
            )}
          </Card>
        )}

      {/* Open issues — grouped by page */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold font-heading">
            Open issues ({sortedIssues.length})
          </h2>
        </div>
        {sortedIssues.length === 0 ? (
          <Card className="p-6 text-center text-sm text-muted-foreground inline-flex items-center justify-center gap-2 w-full">
            <CheckCircle2 className="size-4 text-emerald-400" />
            All clear — no open issues from the latest check.
          </Card>
        ) : (
          <IssueGroupedList
            issues={sortedIssues}
            pages={latest?.pages ?? null}
            onRefresh={fetchAll}
          />
        )}
      </div>

      {/* Keyword ranks */}
      {(cfg.target_keywords ?? []).length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold font-heading">
              Keyword ranks ({keywordRanks.length})
            </h2>
            <Button
              size="sm"
              variant="outline"
              onClick={handleRunKeyword}
              disabled={runningKw}
              className="rounded h-7 text-xs gap-1.5"
            >
              {runningKw ? (
                <Loader2 className="size-3 animate-spin" />
              ) : (
                <Play className="size-3" />
              )}
              Run keyword check
            </Button>
          </div>
          {keywordRanks.length === 0 ? (
            <Card className="p-4 text-xs text-muted-foreground">
              No rank data yet. Click <strong>Run keyword check</strong> to track{" "}
              {cfg.target_keywords?.length} keyword
              {cfg.target_keywords?.length === 1 ? "" : "s"}.
            </Card>
          ) : (
            <Card className="p-2 divide-y divide-border">
              {keywordRanks.map((kw) => (
                <div
                  key={kw.keyword}
                  className="flex items-center justify-between gap-3 p-2 text-xs"
                >
                  <div className="min-w-0 flex-1">
                    <div className="font-medium truncate">{kw.keyword}</div>
                    {kw.url && (
                      <a
                        href={kw.url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-[11px] font-mono text-muted-foreground hover:text-foreground inline-flex items-center gap-1 truncate"
                      >
                        {kw.url}
                        <ExternalLink className="size-3 opacity-60 shrink-0" />
                      </a>
                    )}
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className="font-mono tabular-nums">
                      {kw.rank == null ? (
                        <span className="text-muted-foreground">not in top 50</span>
                      ) : (
                        <>#{kw.rank}</>
                      )}
                    </span>
                    {kw.delta != null && kw.delta !== 0 && (
                      <span
                        className={cn(
                          "font-mono tabular-nums text-[11px]",
                          kw.delta > 0 ? "text-emerald-400" : "text-rose-400"
                        )}
                      >
                        {kw.delta > 0 ? "↑" : "↓"}
                        {Math.abs(kw.delta)}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </Card>
          )}
        </div>
      )}

      {/* Competitor gaps */}
      {(cfg.competitor_domains ?? []).length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold font-heading">
              Competitor gaps ({competitorGaps.length})
            </h2>
            <Button
              size="sm"
              variant="outline"
              onClick={handleRunCompetitor}
              disabled={runningComp}
              className="rounded h-7 text-xs gap-1.5"
            >
              {runningComp ? (
                <Loader2 className="size-3 animate-spin" />
              ) : (
                <Play className="size-3" />
              )}
              Run competitor check
            </Button>
          </div>
          {competitorGaps.length === 0 ? (
            <Card className="p-4 text-xs text-muted-foreground">
              No gap data yet. Click <strong>Run competitor check</strong> to compare
              against {cfg.competitor_domains?.length} competitor
              {cfg.competitor_domains?.length === 1 ? "" : "s"}.
            </Card>
          ) : (
            <Card className="p-2 divide-y divide-border max-h-[420px] overflow-auto">
              {competitorGaps.slice(0, 50).map((gap, i) => (
                <div
                  key={`${gap.competitor_domain}-${gap.keyword}-${i}`}
                  className="flex items-center justify-between gap-3 p-2 text-xs"
                >
                  <div className="min-w-0 flex-1">
                    <div className="font-medium truncate">{gap.keyword}</div>
                    <div className="text-[11px] text-muted-foreground inline-flex items-center gap-2">
                      <span className="font-mono">{gap.competitor_domain}</span>
                      <span>#{gap.competitor_rank}</span>
                    </div>
                  </div>
                  {gap.search_volume != null && (
                    <span className="font-mono tabular-nums text-muted-foreground shrink-0">
                      {gap.search_volume.toLocaleString()}/mo
                    </span>
                  )}
                </div>
              ))}
            </Card>
          )}
        </div>
      )}

      {/* Recent runs */}
      <div className="space-y-2">
        <h2 className="text-sm font-semibold font-heading">Recent runs</h2>
        <Card className="p-2 divide-y divide-border">
          {jobs.length === 0 ? (
            <div className="p-3 text-sm text-muted-foreground">No runs yet.</div>
          ) : (
            jobs.map((j) => {
              const reportUrl =
                j.type === "monthly_report" && j.status === "complete"
                  ? (j.metadata?.report_url as string | undefined)
                  : undefined;
              return (
                <div
                  key={j.id}
                  className="flex items-center justify-between gap-3 p-2 text-xs"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span
                      className={cn(
                        "size-2 rounded-full",
                        j.status === "complete" && "bg-emerald-400",
                        j.status === "failed" && "bg-rose-400",
                        (j.status === "queued" || j.status === "running") && "bg-primary animate-pulse"
                      )}
                    />
                    <span className="font-medium">{j.type}</span>
                    <span className="text-muted-foreground truncate">
                      {j.current_stage ?? j.error_message ?? j.status}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {reportUrl && (
                      <a
                        href={reportUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-primary hover:underline"
                        title="Open monthly report PDF"
                      >
                        <Download className="size-3" />
                        PDF
                      </a>
                    )}
                    <span className="font-mono text-muted-foreground">
                      {formatDate(j.created_at)}
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </Card>
      </div>

      {/* Fix-plan modal */}
      <Dialog open={fixPlanOpen} onOpenChange={setFixPlanOpen}>
        <DialogContent className="sm:max-w-[860px] max-h-[85dvh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between gap-3 pr-10">
              <span>Fix plan for {client?.name}</span>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={copyFixPlan}
                  disabled={!fixPlanMarkdown}
                  className="rounded gap-1.5"
                >
                  {copied ? (
                    <>
                      <CheckIcon className="size-3.5 text-emerald-400" />
                      Copied
                    </>
                  ) : (
                    <>
                      <Copy className="size-3.5" />
                      Copy
                    </>
                  )}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={downloadFixPlan}
                  disabled={!fixPlanMarkdown}
                  className="rounded gap-1.5"
                >
                  <Download className="size-3.5" />
                  Download
                </Button>
              </div>
            </DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto">
            {fixPlanLoading ? (
              <div className="flex items-center justify-center py-12 text-sm text-muted-foreground">
                <Loader2 className="size-4 animate-spin mr-2" />
                Building fix plan...
              </div>
            ) : fixPlanError ? (
              <p className="text-sm text-rose-400 p-4">{fixPlanError}</p>
            ) : fixPlanMarkdown ? (
              <pre className="text-xs bg-muted/30 rounded p-3 whitespace-pre-wrap font-mono leading-relaxed text-pretty">
                {fixPlanMarkdown}
              </pre>
            ) : null}
          </div>
          <p className="text-[11px] text-muted-foreground border-t border-border pt-2">
            Paste this into Claude Code (or save as .md) inside the site&apos;s
            repo. It includes per-page state, severity-ordered issues, and
            instructions for the agent.
          </p>
        </DialogContent>
      </Dialog>

      {/* Settings drawer */}
      <Sheet open={settingsOpen} onOpenChange={setSettingsOpen}>
        <SheetContent className="w-full sm:max-w-md overflow-y-auto">
          <SheetHeader>
            <SheetTitle>SEO settings</SheetTitle>
          </SheetHeader>
          {client && (
            <SettingsForm
              client={client}
              onSaved={() => {
                setSettingsOpen(false);
                fetchAll();
              }}
            />
          )}
        </SheetContent>
      </Sheet>
    </PageLayout>
  );
}

function pageKeyOf(url: string | null): string {
  if (!url) return "__site__";
  try {
    const u = new URL(url);
    return u.pathname.replace(/\/+$/, "") || "/";
  } catch {
    return url;
  }
}

function IssueGroupedList({
  issues,
  pages,
  onRefresh,
}: {
  issues: Issue[];
  pages: PageSnap[] | null;
  onRefresh: () => void;
}) {
  const [acting, setActing] = useState<Record<string, boolean>>({});

  const setIssueStatus = async (
    id: string,
    status: "fixed" | "ignored"
  ) => {
    setActing((s) => ({ ...s, [id]: true }));
    try {
      const res = await fetch(`/api/seo/issues/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        alert(err.error ?? "Failed to update issue");
        return;
      }
      onRefresh();
    } finally {
      setActing((s) => {
        const next = { ...s };
        delete next[id];
        return next;
      });
    }
  };
  // Group by page (site-wide first, then by issue count desc)
  const groups = new Map<string, Issue[]>();
  for (const i of issues) {
    const k = pageKeyOf(i.page_url);
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k)!.push(i);
  }
  const orderedKeys = [...groups.keys()].sort((a, b) => {
    if (a === "__site__") return -1;
    if (b === "__site__") return 1;
    return groups.get(b)!.length - groups.get(a)!.length;
  });

  // Index snapshots by page key for quick lookup in headers
  const snapByKey = new Map<string, PageSnap>();
  for (const p of pages ?? []) snapByKey.set(pageKeyOf(p.url), p);

  // Open the first 2 groups by default; collapse the rest
  const [open, setOpen] = useState<Record<string, boolean>>(() => {
    const init: Record<string, boolean> = {};
    orderedKeys.slice(0, 2).forEach((k) => {
      init[k] = true;
    });
    return init;
  });

  return (
    <div className="space-y-2">
      {orderedKeys.map((key) => {
        const grpIssues = groups.get(key)!;
        const isOpen = open[key] ?? false;
        const counts = {
          critical: grpIssues.filter((i) => i.severity === "critical").length,
          high: grpIssues.filter((i) => i.severity === "high").length,
          medium: grpIssues.filter((i) => i.severity === "medium").length,
          low: grpIssues.filter((i) => i.severity === "low").length,
        };
        const label = key === "__site__" ? "Site-wide" : key;
        const snap = snapByKey.get(key);
        return (
          <Card key={key} className="overflow-hidden">
            <button
              type="button"
              onClick={() => setOpen((s) => ({ ...s, [key]: !isOpen }))}
              className="w-full flex items-center gap-2 p-3 text-left hover:bg-accent/30 transition-colors"
            >
              {isOpen ? (
                <ChevronDown className="size-4 text-muted-foreground shrink-0" />
              ) : (
                <ChevronRight className="size-4 text-muted-foreground shrink-0" />
              )}
              <span className="font-medium text-sm font-mono truncate flex-1">
                {label}
              </span>
              {/* Page health markers */}
              {snap && (
                <div className="flex items-center gap-1.5 shrink-0 text-[10px] text-muted-foreground">
                  {snap.psi_mobile != null && (
                    <span
                      className={cn(
                        "tabular-nums font-mono",
                        snap.psi_mobile >= 85 && "text-emerald-400",
                        snap.psi_mobile >= 65 && snap.psi_mobile < 85 && "text-amber-400",
                        snap.psi_mobile < 65 && "text-rose-400"
                      )}
                      title="Lighthouse mobile score"
                    >
                      {snap.psi_mobile}
                    </span>
                  )}
                  {snap.status_code !== 200 && (
                    <span className="text-rose-400 font-mono" title="HTTP status">
                      {snap.status_code}
                    </span>
                  )}
                </div>
              )}
              <div className="flex items-center gap-1.5 shrink-0">
                {counts.critical > 0 && (
                  <Badge
                    variant="outline"
                    className={cn("text-[10px] uppercase", severityClass("critical"))}
                  >
                    {counts.critical} crit
                  </Badge>
                )}
                {counts.high > 0 && (
                  <Badge
                    variant="outline"
                    className={cn("text-[10px] uppercase", severityClass("high"))}
                  >
                    {counts.high} high
                  </Badge>
                )}
                {counts.medium > 0 && (
                  <Badge
                    variant="outline"
                    className={cn("text-[10px] uppercase", severityClass("medium"))}
                  >
                    {counts.medium} med
                  </Badge>
                )}
                {counts.low > 0 && (
                  <Badge
                    variant="outline"
                    className={cn("text-[10px] uppercase", severityClass("low"))}
                  >
                    {counts.low} low
                  </Badge>
                )}
              </div>
            </button>
            {isOpen && (
              <div className="border-t border-border divide-y divide-border">
                {/* Per-page snapshot summary */}
                {snap && key !== "__site__" && (
                  <div className="p-3 bg-muted/20 text-xs space-y-1">
                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-muted-foreground">
                      <span>HTTP {snap.status_code}</span>
                      {snap.psi_mobile != null && (
                        <span>Mobile {snap.psi_mobile}/100</span>
                      )}
                      <span>H1: {snap.h1_count}</span>
                      <span>
                        Images: {snap.alt_total - snap.alt_missing}/{snap.alt_total} with alt
                      </span>
                      <span>{snap.has_canonical ? "Canonical ✓" : "No canonical"}</span>
                      <span>
                        Schema: {snap.schema_types.length === 0 ? "none" : snap.schema_types.join(", ")}
                      </span>
                    </div>
                    {snap.title && (
                      <div className="text-foreground/80 truncate">
                        <span className="text-muted-foreground">Title ({snap.title.length}): </span>
                        {snap.title}
                      </div>
                    )}
                  </div>
                )}
                {grpIssues.map((iss) => (
                  <div key={iss.id} className="p-3 space-y-1.5">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Badge
                            variant="outline"
                            className={cn("text-[10px] uppercase", severityClass(iss.severity))}
                          >
                            {iss.severity}
                          </Badge>
                          <Badge variant="outline" className="text-[10px]">
                            {categoryLabel(iss.category)}
                          </Badge>
                          <span className="text-sm font-medium">
                            {iss.title}
                          </span>
                        </div>
                        {iss.page_url && key !== "__site__" && (
                          <a
                            href={iss.page_url}
                            target="_blank"
                            rel="noreferrer"
                            className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1 mt-0.5"
                          >
                            <Globe className="size-3" />
                            {iss.page_url}
                            <ExternalLink className="size-3 opacity-60" />
                          </a>
                        )}
                      </div>
                      <span className="text-[10px] text-muted-foreground shrink-0">
                        seen {formatDate(iss.first_seen_at)}
                      </span>
                    </div>
                    {iss.description && (
                      <p className="text-xs text-muted-foreground text-pretty">
                        {iss.description}
                      </p>
                    )}
                    {iss.recommendation && (
                      <p className="text-xs text-pretty">
                        <span className="text-muted-foreground">Fix: </span>
                        {iss.recommendation}
                      </p>
                    )}
                    <div className="flex items-center gap-2 pt-1">
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-6 text-[11px] rounded gap-1 text-muted-foreground"
                        disabled={!!acting[iss.id]}
                        onClick={() => setIssueStatus(iss.id, "ignored")}
                        title="Hide from digests — use only for issues you've decided not to fix"
                      >
                        Ignore
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        );
      })}
    </div>
  );
}

function ScoreCard({
  label,
  score,
  delta,
}: {
  label: string;
  score: number | null | undefined;
  delta?: number | null;
}) {
  const showDelta = delta != null && delta !== 0;
  return (
    <Card className="p-4 space-y-1">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
      <div className="flex items-baseline gap-1.5">
        <div className={cn("text-2xl font-semibold tabular-nums font-heading", scoreColor(score))}>
          {score == null ? "—" : score}
        </div>
        {showDelta && (
          <span
            className={cn(
              "text-xs font-mono tabular-nums",
              (delta as number) > 0 ? "text-emerald-400" : "text-rose-400"
            )}
          >
            {(delta as number) > 0 ? "+" : ""}
            {delta}
          </span>
        )}
      </div>
      <div className="text-xs text-muted-foreground">
        {score == null ? "Not yet measured" : "out of 100"}
      </div>
    </Card>
  );
}

function SettingsForm({
  client,
  onSaved,
}: {
  client: Client;
  onSaved: () => void;
}) {
  const cfg = client.seo_config ?? {};
  const [domain, setDomain] = useState(cfg.domain ?? "");
  const [contactEmail, setContactEmail] = useState(cfg.contact_email ?? "");
  const [contactName, setContactName] = useState(cfg.contact_name ?? "");
  const [keywords, setKeywords] = useState(
    (cfg.target_keywords ?? []).join("\n")
  );
  const [competitors, setCompetitors] = useState(
    (cfg.competitor_domains ?? []).join("\n")
  );
  const [maxPages, setMaxPages] = useState(
    String(cfg.crawl_config?.max_pages ?? 25)
  );
  const [enabled, setEnabled] = useState(cfg.enabled !== false);
  const [dryRun, setDryRun] = useState(!!cfg.dry_run);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const splitLines = (s: string) =>
    s
      .split(/[\n,]/)
      .map((x) => x.trim())
      .filter(Boolean);

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    const next = {
      enabled,
      domain: domain.trim(),
      contact_email: contactEmail.trim() || undefined,
      contact_name: contactName.trim() || undefined,
      target_keywords: splitLines(keywords),
      competitor_domains: splitLines(competitors),
      crawl_config: { max_pages: Math.max(1, Math.min(100, Number(maxPages) || 25)) },
      dry_run: dryRun,
      report_status: cfg.report_status ?? "enabled",
    };
    const res = await fetch(`/api/seo/clients/${client.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ seo_config: next }),
    });
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      setError(j.error ?? "Failed to save");
    } else {
      onSaved();
    }
    setSaving(false);
  };

  return (
    <div className="space-y-4 py-2">
      <div className="space-y-1.5">
        <Label>Domain</Label>
        <Input
          value={domain}
          onChange={(e) => setDomain(e.target.value)}
          placeholder="niewdel.com"
        />
        <p className="text-[11px] text-muted-foreground">
          No protocol — just the domain. The agent crawls https:// by default.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label>Contact email</Label>
          <Input
            type="email"
            value={contactEmail}
            onChange={(e) => setContactEmail(e.target.value)}
            placeholder="client@example.com"
          />
        </div>
        <div className="space-y-1.5">
          <Label>Contact name</Label>
          <Input
            value={contactName}
            onChange={(e) => setContactName(e.target.value)}
            placeholder="Client name"
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label>Target keywords</Label>
        <Textarea
          rows={3}
          value={keywords}
          onChange={(e) => setKeywords(e.target.value)}
          placeholder="One keyword per line"
        />
        <p className="text-[11px] text-muted-foreground">
          Used in paid keyword check. One per line or comma-separated.
        </p>
      </div>

      <div className="space-y-1.5">
        <Label>Competitor domains</Label>
        <Textarea
          rows={2}
          value={competitors}
          onChange={(e) => setCompetitors(e.target.value)}
          placeholder="competitor.com"
        />
      </div>

      <div className="space-y-1.5">
        <Label>Max pages per crawl</Label>
        <Input
          type="number"
          min={1}
          max={100}
          value={maxPages}
          onChange={(e) => setMaxPages(e.target.value)}
        />
      </div>

      <div className="space-y-1.5">
        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <input
            type="checkbox"
            checked={enabled}
            onChange={(e) => setEnabled(e.target.checked)}
            className="size-4"
          />
          Enabled (run weekly automatically)
        </label>
        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <input
            type="checkbox"
            checked={dryRun}
            onChange={(e) => setDryRun(e.target.checked)}
            className="size-4"
          />
          Dry-run (no auto-tasks, no client emails)
        </label>
      </div>

      {error && <p className="text-xs text-rose-400">{error}</p>}

      <div className="flex justify-end gap-2 pt-2">
        <Button onClick={handleSave} disabled={saving} className="rounded">
          {saving ? "Saving..." : "Save"}
        </Button>
      </div>
    </div>
  );
}
