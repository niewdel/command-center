"use client";

import { useEffect, useState, useCallback, useRef, use } from "react";
import {
  TrendingUp,
  Loader2,
  Play,
  Settings,
  ExternalLink,
  FileText,
  Copy,
  Download,
  Mail,
  Check as CheckIcon,
  Link2,
} from "lucide-react";
import { PageLayout } from "@/components/layout/page-layout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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
import { ClientReport } from "@/components/seo/report";
import type { ReportData } from "@/lib/seo/report-data";

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
  ga4_property_id?: string;
};

type Client = {
  id: string;
  workspace_id: string;
  name: string;
  seo_config: SeoConfig | null;
};

type Check = {
  id: string;
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
  const [reportData, setReportData] = useState<ReportData | null>(null);
  const [runningKw, setRunningKw] = useState(false);
  const [runningComp, setRunningComp] = useState(false);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [runningReport, setRunningReport] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [fixPlanOpen, setFixPlanOpen] = useState(false);
  const [fixPlanLoading, setFixPlanLoading] = useState(false);
  const [fixPlanMarkdown, setFixPlanMarkdown] = useState<string | null>(null);
  const [fixPlanFilename, setFixPlanFilename] = useState<string | null>(null);
  const [fixPlanError, setFixPlanError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [magicLinkCopied, setMagicLinkCopied] = useState(false);
  const [magicLinkLoading, setMagicLinkLoading] = useState(false);

  const fetchAll = useCallback(async () => {
    const [res, reportRes] = await Promise.all([
      fetch(`/api/seo/clients/${id}`).then((r) => r.json()),
      fetch(`/api/seo/clients/${id}/report-data?range=30d`).then((r) =>
        r.ok ? r.json() : null
      ),
    ]);
    if (res.client) {
      setClient(res.client);
      setChecks(res.checks ?? []);
      setIssues(res.issues ?? []);
      setJobs(res.jobs ?? []);
      setKeywordRanks(res.keyword_ranks ?? []);
      setCompetitorGaps(res.competitor_gaps ?? []);
    }
    if (reportRes && !reportRes.error) {
      setReportData(reportRes as ReportData);
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
        return;
      }
      await fetchAll();
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
        return;
      }
      await fetchAll();
    } finally {
      setRunningComp(false);
    }
  };

  // Lightweight refresh for jobs/issues/checks state — skips the heavy
  // report-data query. Used by the polling fallback below so we don't hammer
  // getReportData (5 SQL queries) every 2 seconds.
  const refreshClient = useCallback(async () => {
    const res = await fetch(`/api/seo/clients/${id}`).then((r) => r.json());
    if (res.client) {
      setClient(res.client);
      setChecks(res.checks ?? []);
      setIssues(res.issues ?? []);
      setJobs(res.jobs ?? []);
      setKeywordRanks(res.keyword_ranks ?? []);
      setCompetitorGaps(res.competitor_gaps ?? []);
    }
  }, [id]);

  useEffect(() => {
    fetchAll();
    // No server-side filter clause: Supabase realtime applies postgres_changes
    // filters alongside RLS evaluation and tends to throttle/drop UPDATEs on
    // RLS-protected tables when filtered. We subscribe broadly and filter
    // client-side. We also DON'T subscribe to seo_issues here because that
    // table isn't in the supabase_realtime publication — events would never
    // arrive, and a dead binding can put the whole channel in a bad state.
    // seo_issues changes are caught by the seo_checks completion event +
    // the polling fallback below.
    const matchesClient = (row: unknown): boolean => {
      const r = row as { client_id?: string } | null;
      return !!r && r.client_id === id;
    };
    const ch = supabase
      .channel(`seo-client-${id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "seo_jobs" },
        (payload) => {
          // Filter to this client client-side.
          if (
            !matchesClient(payload.new) &&
            !matchesClient(payload.old)
          ) {
            return;
          }
          // Apply seo_jobs changes from the realtime payload directly so the
          // progress bar and stage label update instantly, instead of
          // round-tripping through fetchAll() (which fires getReportData ->
          // 5 SQL queries on every tick and queues up). seo_checks still
          // goes through fetchAll() since it only fires at completion.
          setJobs((prev) => {
            if (payload.eventType === "DELETE") {
              const oldId = (payload.old as { id?: string } | null)?.id;
              return oldId ? prev.filter((j) => j.id !== oldId) : prev;
            }
            const next = payload.new as Job;
            if (!next?.id) return prev;
            const idx = prev.findIndex((j) => j.id === next.id);
            if (idx >= 0) {
              const out = prev.slice();
              out[idx] = next;
              return out;
            }
            // INSERT — prepend (jobs are sorted by created_at desc).
            return [next, ...prev];
          });
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "seo_checks" },
        (payload) => {
          if (matchesClient(payload.new) || matchesClient(payload.old)) {
            fetchAll();
          }
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "seo_keyword_ranks" },
        (payload) => {
          if (matchesClient(payload.new) || matchesClient(payload.old)) {
            fetchAll();
          }
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "seo_competitor_gaps" },
        (payload) => {
          if (matchesClient(payload.new) || matchesClient(payload.old)) {
            fetchAll();
          }
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "seo_traffic_snapshots" },
        (payload) => {
          if (matchesClient(payload.new) || matchesClient(payload.old)) {
            fetchAll();
          }
        }
      )
      .subscribe((status, err) => {
        if (
          status === "CHANNEL_ERROR" ||
          status === "TIMED_OUT" ||
          status === "CLOSED"
        ) {
          // Realtime delivery has failed for this channel. Polling below keeps
          // the UI in sync regardless; surface this in the console for future
          // debugging.
          console.warn(`[seo-client-${id}] realtime ${status}`, err);
        }
      });
    return () => {
      supabase.removeChannel(ch);
    };
  }, [id, fetchAll]);

  const activeJob = jobs.find((j) => j.status === "queued" || j.status === "running");
  const latest = checks[0] ?? null;

  // Polling fallback for active-job progress. Realtime is best-effort: RLS +
  // REPLICA IDENTITY quirks have silently dropped UPDATEs on this page
  // before, leaving the progress bar frozen. Polling every 2s while a job is
  // running guarantees the bar advances regardless of realtime health.
  // Only the lightweight client endpoint is refetched (no getReportData), so
  // the cost is one cheap query every 2s for the lifetime of a single check.
  const activeJobId = activeJob?.id ?? null;
  useEffect(() => {
    if (!activeJobId) return;
    const interval = setInterval(() => {
      refreshClient().catch(() => {
        // ignore — next tick will retry
      });
    }, 2000);
    return () => clearInterval(interval);
  }, [activeJobId, refreshClient]);

  // When a job transitions from active → done, do one final full fetch so the
  // embedded report and recent-runs reflect the new check. Realtime usually
  // catches this via seo_checks INSERT, but if realtime is dead this ensures
  // the page still updates within ~2s of completion. useRef avoids triggering
  // the "setState in effect" lint by not creating an extra render.
  const lastActiveJobIdRef = useRef<string | null>(null);
  useEffect(() => {
    if (lastActiveJobIdRef.current && !activeJobId) {
      fetchAll();
    }
    lastActiveJobIdRef.current = activeJobId;
  }, [activeJobId, fetchAll]);

  const handleRun = async () => {
    setRunning(true);
    try {
      const res = await fetch(`/api/seo/clients/${id}/run-check`, {
        method: "POST",
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        alert(err.error ?? "Failed to start check");
        return;
      }
      // Eagerly refresh so the active-job progress card appears immediately;
      // realtime keeps it updated after this.
      await fetchAll();
    } finally {
      setRunning(false);
    }
  };

  // Monthly report runner. Fires the job and relies on realtime to reflect
  // progress in the Recent runs panel. No polling needed — the job completes
  // quickly (email send only; no PDF generation) and Supabase realtime pushes
  // the status update within a second or two.
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
      // Job is running — realtime will surface stage/status in Recent runs.
    } finally {
      setRunningReport(false);
    }
  };

  const copyMagicLink = async () => {
    setMagicLinkLoading(true);
    try {
      const res = await fetch(`/api/seo/clients/${id}/view-link`);
      const json = await res.json();
      if (!res.ok || !json.url) {
        alert(json.error ?? "Failed to generate magic link");
        return;
      }
      try {
        await navigator.clipboard.writeText(json.url as string);
        setMagicLinkCopied(true);
        setTimeout(() => setMagicLinkCopied(false), 1800);
      } catch {
        // Clipboard denied — fall back to a prompt so the user can still grab it.
        window.prompt("Copy this magic link:", json.url as string);
      }
    } finally {
      setMagicLinkLoading(false);
    }
  };

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
                : "Send a preview of the monthly report to justin.ledwein@niewdel.com (the client never receives this)"
            }
          >
            {runningReport ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <Mail className="size-3.5" />
            )}
            Email preview
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
            onClick={copyMagicLink}
            disabled={magicLinkLoading || !cfg.domain}
            className="rounded gap-1.5"
            title="Copy a permanent client-facing link to the live report (no login required)"
          >
            {magicLinkLoading ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : magicLinkCopied ? (
              <CheckIcon className="size-3.5 text-emerald-400" />
            ) : (
              <Link2 className="size-3.5" />
            )}
            {magicLinkCopied ? "Copied" : "Magic link"}
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

      {/* Last check metadata strip */}
      {latest && (
        <Card className="p-3 flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
          <span>
            Last check: <span className="text-foreground font-medium">{formatDate(latest.created_at)}</span>
          </span>
        </Card>
      )}

      {/* Embedded report — same components as the standalone /report route */}
      {reportData && (
        <div className="mt-4">
          <ClientReport data={reportData} mode="embedded" />
        </div>
      )}

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
              const ga4Captured = j.metadata?.traffic_captured as boolean | undefined;
              const ga4Error = j.metadata?.traffic_error as string | null | undefined;
              const ga4Badge =
                j.type === "weekly_check" && j.status === "complete"
                  ? ga4Captured === true
                    ? { label: "GA4 ✓", tone: "ok" as const, title: "Traffic snapshot captured" }
                    : ga4Captured === false
                      ? { label: "GA4 ✗", tone: "err" as const, title: ga4Error ?? "GA4 fetch failed" }
                      : null
                  : null;
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
                    {ga4Badge && (
                      <span
                        title={ga4Badge.title}
                        className={cn(
                          "rounded px-1.5 py-0.5 text-[10px] uppercase font-semibold border",
                          ga4Badge.tone === "ok"
                            ? "border-emerald-400/40 text-emerald-400 bg-emerald-400/10"
                            : "border-destructive/40 text-destructive bg-destructive/10"
                        )}
                      >
                        {ga4Badge.label}
                      </span>
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
  const [ga4PropertyId, setGa4PropertyId] = useState(cfg.ga4_property_id ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Google connection + property list (loaded on mount).
  const [googleConnected, setGoogleConnected] = useState<boolean | null>(null);
  const [googleEmail, setGoogleEmail] = useState<string | null>(null);
  const [ga4Properties, setGa4Properties] = useState<
    Array<{ property_id: string; property_name: string; account_name: string }>
  >([]);
  const [ga4Loading, setGa4Loading] = useState(false);
  const [ga4Error, setGa4Error] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const status = await fetch("/api/integrations/google/status").then((r) =>
          r.json()
        );
        setGoogleConnected(!!status.connected);
        setGoogleEmail(status.google_email ?? null);
        if (status.connected) {
          setGa4Loading(true);
          const props = await fetch("/api/integrations/google/properties").then(
            (r) => r.json()
          );
          if (props.error) setGa4Error(props.error);
          else setGa4Properties(props.properties ?? []);
          setGa4Loading(false);
        }
      } catch (err) {
        setGa4Error(err instanceof Error ? err.message : "Failed to load");
        setGa4Loading(false);
      }
    })();
  }, []);

  const handleConnectGoogle = () => {
    window.location.href = "/api/integrations/google/authorize";
  };

  const handleDisconnectGoogle = async () => {
    await fetch("/api/integrations/google/disconnect", { method: "POST" });
    setGoogleConnected(false);
    setGoogleEmail(null);
    setGa4Properties([]);
    setGa4PropertyId("");
  };

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
      ga4_property_id: ga4PropertyId.trim() || undefined,
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
          Dry-run (no client emails sent)
        </label>
      </div>

      {/* Google Analytics integration */}
      <div className="space-y-2 pt-3 border-t border-border">
        <div className="flex items-center justify-between">
          <Label className="text-xs uppercase tracking-wide text-muted-foreground">
            Google Analytics
          </Label>
          {googleConnected === true ? (
            <button
              type="button"
              onClick={handleDisconnectGoogle}
              className="text-[11px] text-muted-foreground hover:text-rose-400"
            >
              Disconnect
            </button>
          ) : null}
        </div>

        {googleConnected === null ? (
          <div className="text-xs text-muted-foreground">Loading...</div>
        ) : googleConnected ? (
          <>
            <p className="text-[11px] text-muted-foreground">
              Connected as{" "}
              <span className="font-mono text-foreground">{googleEmail}</span>
            </p>
            <div className="space-y-1.5">
              <Label className="text-xs">GA4 property for this client</Label>
              {ga4Loading ? (
                <div className="text-xs text-muted-foreground">
                  Loading properties...
                </div>
              ) : ga4Error ? (
                <p className="text-xs text-rose-400">{ga4Error}</p>
              ) : (
                <select
                  value={ga4PropertyId}
                  onChange={(e) => setGa4PropertyId(e.target.value)}
                  className="w-full h-9 rounded border border-border bg-background px-3 text-sm"
                >
                  <option value="">None — skip traffic tracking</option>
                  {ga4Properties.map((p) => (
                    <option key={p.property_id} value={p.property_id}>
                      {p.account_name}: {p.property_name} ({p.property_id})
                    </option>
                  ))}
                </select>
              )}
              <p className="text-[11px] text-muted-foreground">
                Pick the GA4 property that tracks {domain || "this client&rsquo;s site"}.
                Traffic data lands in the next weekly check.
              </p>
            </div>
          </>
        ) : (
          <div className="space-y-2">
            <p className="text-[11px] text-muted-foreground">
              Connect your Google account once. The same connection works for
              all clients.
            </p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleConnectGoogle}
              className="rounded"
            >
              Connect Google Analytics
            </Button>
          </div>
        )}
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
