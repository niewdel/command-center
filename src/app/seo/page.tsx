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
} from "lucide-react";
import { PageLayout } from "@/components/layout/page-layout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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

function ScorePill({
  label,
  score,
}: {
  label: string;
  score: number | null | undefined;
}) {
  return (
    <div className="flex flex-col items-center gap-0.5 px-2 py-1 rounded bg-muted/40 min-w-[70px]">
      <span className={cn("text-base font-semibold tabular-nums font-heading", scoreColor(score))}>
        {score == null ? "—" : score}
      </span>
      <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
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
      title="SEO Agent"
      eyebrow="Agent · Search"
      description="Weekly automated SEO monitoring across your sites."
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
            return (
              <Card key={c.id} className="p-4 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="text-base font-semibold font-heading truncate">
                        {c.name}
                      </h3>
                      {!enabled && (
                        <Badge variant="outline" className="text-[10px]">
                          Paused
                        </Badge>
                      )}
                      {isDryRun && (
                        <Badge variant="outline" className="text-[10px]">
                          Dry-run
                        </Badge>
                      )}
                    </div>
                    {cfg.domain && (
                      <a
                        href={`https://${cfg.domain.replace(/^https?:\/\//, "")}`}
                        target="_blank"
                        rel="noreferrer"
                        className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1 mt-0.5"
                      >
                        <Globe className="size-3" />
                        {cfg.domain}
                        <ExternalLink className="size-3 opacity-60" />
                      </a>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <Link
                      href={`/seo/clients/${c.id}`}
                      className="text-xs text-primary hover:underline"
                    >
                      Open
                    </Link>
                  </div>
                </div>

                {/* Scores row */}
                <div className="flex items-center gap-1.5 flex-wrap">
                  <ScorePill label="Tech" score={last?.technical_score ?? null} />
                  <ScorePill label="On-page" score={last?.onpage_score ?? null} />
                  <ScorePill label="Mobile" score={last?.lighthouse_mobile ?? null} />
                  <ScorePill label="Desktop" score={last?.lighthouse_desktop ?? null} />
                </div>

                {/* Low-page-count warning */}
                {last && (last.pages_crawled ?? 0) <= 2 && (
                  <div className="flex items-start gap-2 text-xs px-2 py-1.5 rounded bg-amber-500/10 border border-amber-500/30 text-amber-400">
                    <AlertCircle className="size-3.5 shrink-0 mt-0.5" />
                    <span className="text-pretty">
                      Only {last.pages_crawled ?? 0} page{(last.pages_crawled ?? 0) === 1 ? "" : "s"} crawled — site likely has no sitemap.xml or its homepage doesn&apos;t link to internal pages. Issue counts will be incomplete.
                    </span>
                  </div>
                )}

                {/* Issue summary */}
                <div className="flex items-center justify-between text-xs">
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
                        {c.open_issues.open} open issue{c.open_issues.open === 1 ? "" : "s"}
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
                  <span className="text-muted-foreground">
                    {last ? `Last: ${formatDate(last.created_at)}` : "Never run"}
                  </span>
                </div>

                {/* AI summary */}
                {last?.ai_summary && (
                  <p className="text-xs text-muted-foreground text-pretty leading-relaxed border-l-2 border-primary/40 pl-2">
                    {last.ai_summary}
                  </p>
                )}

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

                <div className="flex items-center justify-end pt-1">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleRun(c.id)}
                    disabled={isRunning || running[c.id] || !enabled || !cfg.domain}
                    className="rounded gap-1.5"
                  >
                    {running[c.id] || isRunning ? (
                      <Loader2 className="size-3 animate-spin" />
                    ) : (
                      <Play className="size-3" />
                    )}
                    Run check
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </PageLayout>
  );
}
