"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import {
  TrendingUp,
  Loader2,
  AlertTriangle,
  CheckCircle2,
  Globe,
  Play,
  ExternalLink,
  AlertCircle,
  ChevronRight,
} from "lucide-react";
import { PageLayout } from "@/components/layout/page-layout";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useRealtime } from "@/lib/providers/realtime-provider";
import { cn } from "@/lib/utils";

type SeoConfig = {
  enabled?: boolean;
  domain?: string;
  contact_email?: string;
  contact_name?: string;
  dry_run?: boolean;
  report_status?: "enabled" | "paused";
};

type DiffSummary = {
  new_issues_count?: number;
  resolved_issues_count?: number;
  score_deltas?: {
    technical?: number | null;
    onpage?: number | null;
    lighthouse_mobile?: number | null;
    lighthouse_desktop?: number | null;
  };
};

type SeoClientRow = {
  id: string;
  workspace_id: string;
  name: string;
  seo_config: SeoConfig | null;
  latest_check: {
    technical_score: number | null;
    lighthouse_mobile: number | null;
    lighthouse_desktop: number | null;
    onpage_score: number | null;
    freshness_days: number | null;
    pages_crawled: number | null;
    ai_summary: string | null;
    diff_from_previous: DiffSummary | null;
    created_at: string;
  } | null;
  open_issues: { open: number; critical: number };
  active_job: {
    id: string;
    status: string;
    current_stage: string | null;
    progress_pct: number;
  } | null;
};

function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function scoreColor(score: number | null | undefined): string {
  if (score == null) return "text-muted-foreground";
  if (score >= 85) return "text-emerald-400";
  if (score >= 65) return "text-amber-400";
  return "text-rose-400";
}

function ScoreCell({
  label,
  score,
}: {
  label: string;
  score: number | null | undefined;
}) {
  return (
    <div className="flex flex-col items-center gap-1 px-2 py-3">
      <span className={cn("text-xl font-semibold tabular-nums font-heading", scoreColor(score))}>
        {score == null ? "—" : score}
      </span>
      <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
        {label}
      </span>
    </div>
  );
}

export default function SeoOverviewPage() {
  const [clients, setClients] = useState<SeoClientRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState<Record<string, boolean>>({});

  const fetchClients = useCallback(async () => {
    const res = await fetch("/api/seo/clients").then((r) => r.json());
    setClients(res.data ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchClients();
  }, [fetchClients]);

  // Shared realtime hub: refetch when any seo_jobs or seo_checks row changes.
  useRealtime("seo_jobs", fetchClients);
  useRealtime("seo_checks", fetchClients);

  const handleRun = async (clientId: string) => {
    setRunning((s) => ({ ...s, [clientId]: true }));
    try {
      const res = await fetch(`/api/seo/clients/${clientId}/run-check`, {
        method: "POST",
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        alert(err.error ?? "Failed to start check");
      }
    } finally {
      setRunning((s) => ({ ...s, [clientId]: false }));
    }
  };

  return (
    <PageLayout
      title="Visibility Agent"
      eyebrow="Agent · Visibility"
      description="Weekly search and AI-visibility monitoring across your sites."
      icon={TrendingUp}
      maxWidth="xl"
      loading={loading}
    >
      {clients.length === 0 ? (
        <Card className="p-8 text-center space-y-3">
          <div className="text-muted-foreground text-sm">
            No SEO clients configured yet.
          </div>
          <p className="text-xs text-muted-foreground max-w-md mx-auto text-pretty">
            Open a client (under any workspace) and add a{" "}
            <code className="font-mono bg-muted/40 px-1 rounded">seo_config</code>{" "}
            with at least <code className="font-mono">enabled: true</code> and a{" "}
            <code className="font-mono">domain</code>. Then run a check to populate this view.
          </p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {clients.map((c) => {
            const cfg = c.seo_config ?? {};
            const isRunning = !!c.active_job;
            const isDryRun = !!cfg.dry_run;
            const enabled = cfg.enabled !== false;
            const last = c.latest_check;
            const busy = isRunning || running[c.id];
            return (
              <Card
                key={c.id}
                className="group relative p-5 transition-colors hover:border-primary/50"
              >
                {/* Whole card opens the client. Interactive children below
                    re-enable pointer events and handle their own clicks. */}
                <Link
                  href={`/seo/clients/${c.id}`}
                  aria-label={`Open ${c.name}`}
                  className="absolute inset-0 z-0 rounded-[inherit]"
                />

                <div className="relative z-[1] pointer-events-none space-y-4">
                  {/* Header */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="text-[15px] font-semibold font-heading truncate">
                          {c.name}
                        </h3>
                        {!enabled && (
                          <Badge variant="outline" className="text-[10px] font-normal">
                            Paused
                          </Badge>
                        )}
                        {isDryRun && (
                          <Badge variant="outline" className="text-[10px] font-normal">
                            Dry-run
                          </Badge>
                        )}
                      </div>
                      {cfg.domain && (
                        <a
                          href={`https://${cfg.domain.replace(/^https?:\/\//, "")}`}
                          target="_blank"
                          rel="noreferrer"
                          className="pointer-events-auto relative mt-1 text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
                        >
                          <Globe className="size-3" />
                          {cfg.domain}
                          <ExternalLink className="size-3 opacity-50" />
                        </a>
                      )}
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={() => handleRun(c.id)}
                        disabled={busy || !enabled || !cfg.domain}
                        aria-label="Run check"
                        title="Run check"
                        className="pointer-events-auto relative inline-flex items-center justify-center size-8 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors disabled:opacity-40 disabled:hover:bg-transparent"
                      >
                        {busy ? (
                          <Loader2 className="size-3.5 animate-spin" />
                        ) : (
                          <Play className="size-3.5" />
                        )}
                      </button>
                      <ChevronRight className="size-4 text-muted-foreground/40 group-hover:text-primary transition-colors" />
                    </div>
                  </div>

                  {/* Scores */}
                  <div className="grid grid-cols-4 rounded-lg border border-border divide-x divide-border overflow-hidden">
                    <ScoreCell label="Tech" score={last?.technical_score ?? null} />
                    <ScoreCell label="On-page" score={last?.onpage_score ?? null} />
                    <ScoreCell label="Mobile" score={last?.lighthouse_mobile ?? null} />
                    <ScoreCell label="Desktop" score={last?.lighthouse_desktop ?? null} />
                  </div>

                  {/* Low-page-count warning */}
                  {last && (last.pages_crawled ?? 0) <= 2 && (
                    <div className="flex items-start gap-2 text-xs px-2.5 py-1.5 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-400">
                      <AlertCircle className="size-3.5 shrink-0 mt-0.5" />
                      <span className="text-pretty">
                        Only {last.pages_crawled ?? 0} page{(last.pages_crawled ?? 0) === 1 ? "" : "s"} crawled — site likely has no sitemap.xml or its homepage doesn&apos;t link to internal pages. Issue counts will be incomplete.
                      </span>
                    </div>
                  )}

                  {/* Status footer */}
                  <div className="flex items-center justify-between gap-3 text-xs border-t border-border pt-3">
                    <div className="flex items-center gap-3 flex-wrap">
                      {c.open_issues.critical > 0 ? (
                        <span className="inline-flex items-center gap-1 text-rose-400">
                          <AlertTriangle className="size-3.5" />
                          {c.open_issues.critical} critical
                        </span>
                      ) : c.open_issues.open === 0 ? (
                        <span className="inline-flex items-center gap-1 text-emerald-400">
                          <CheckCircle2 className="size-3.5" />
                          All clear
                        </span>
                      ) : null}
                      {c.open_issues.open > 0 && (
                        <span className="text-muted-foreground">
                          {c.open_issues.open} open
                        </span>
                      )}
                      {last?.diff_from_previous && (
                        (last.diff_from_previous.new_issues_count ?? 0) > 0 ||
                        (last.diff_from_previous.resolved_issues_count ?? 0) > 0
                      ) && (
                        <span className="text-muted-foreground">
                          {(last.diff_from_previous.new_issues_count ?? 0) > 0 && (
                            <span className="text-rose-400">
                              +{last.diff_from_previous.new_issues_count} new
                            </span>
                          )}
                          {(last.diff_from_previous.new_issues_count ?? 0) > 0 &&
                            (last.diff_from_previous.resolved_issues_count ?? 0) > 0 && (
                              <span> · </span>
                            )}
                          {(last.diff_from_previous.resolved_issues_count ?? 0) > 0 && (
                            <span className="text-emerald-400">
                              -{last.diff_from_previous.resolved_issues_count} fixed
                            </span>
                          )}
                        </span>
                      )}
                    </div>
                    <span className="text-muted-foreground tabular-nums shrink-0">
                      {last ? formatDate(last.created_at) : "Never run"}
                    </span>
                  </div>

                  {/* Active progress */}
                  {isRunning && c.active_job && (
                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground inline-flex items-center gap-1.5">
                          <Loader2 className="size-3 animate-spin" />
                          {c.active_job.current_stage ?? "Working..."}
                        </span>
                        <span className="font-mono text-muted-foreground">
                          {c.active_job.progress_pct}%
                        </span>
                      </div>
                      <div className="h-1 rounded bg-muted/40 overflow-hidden">
                        <div
                          className="h-full bg-primary transition-all duration-300"
                          style={{ width: `${c.active_job.progress_pct}%` }}
                        />
                      </div>
                    </div>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </PageLayout>
  );
}
