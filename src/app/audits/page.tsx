"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Gauge,
  Loader2,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  Wrench,
  Globe,
  Sparkles,
  Check,
} from "lucide-react";
import { PageLayout } from "@/components/layout/page-layout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useRealtime } from "@/lib/providers/realtime-provider";
import { cn } from "@/lib/utils";

type Audit = {
  id: string;
  url: string;
  site_name: string | null;
  status: string;
  current_stage: string | null;
  progress_pct: number;
  overall_score: number | null;
  overall_severity: string | null;
  pages_crawled: number | null;
  report_path: string | null;
  fix_plan_path: string | null;
  error: string | null;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
};

const ACTIVE_STATUSES = ["pending", "crawling", "scoring", "rendering"];

function reportUrl(auditId: string, path: string | null): string | null {
  return path ? `/api/audits/${auditId}/report` : null;
}

function fixPlanUrl(auditId: string, path: string | null): string | null {
  return path ? `/api/audits/${auditId}/fix-plan` : null;
}

export default function AuditsPage() {
  const [audits, setAudits] = useState<Audit[]>([]);
  const [loading, setLoading] = useState(true);
  const [url, setUrl] = useState("");
  const [maxPages, setMaxPages] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchAudits = useCallback(async () => {
    const res = await fetch("/api/audits/list").then((r) => r.json());
    setAudits(res.data ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchAudits();
  }, [fetchAudits]);

  // Shared realtime hub: reuses the "audits" channel across pages.
  useRealtime("audits", fetchAudits);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim()) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/audits/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: url.trim(), maxPages }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? "Failed to start audit");
      } else {
        setUrl("");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to start audit");
    } finally {
      setSubmitting(false);
    }
  };

  const active = audits.filter((a) => ACTIVE_STATUSES.includes(a.status));
  const recent = audits.filter((a) => !ACTIVE_STATUSES.includes(a.status));

  return (
    <PageLayout
      title="Website Scoring"
      eyebrow="Tool · Site Audit"
      description="Run a website audit: crawl, score, and render a sales-ready report."
      icon={Gauge}
      maxWidth="xl"
      loading={loading}
    >
      <Card className="p-4 space-y-3">
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="flex flex-col sm:flex-row gap-2">
            <div className="relative flex-1">
              <Globe
                className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground"
                aria-hidden
              />
              <Input
                type="text"
                inputMode="url"
                placeholder="example.com or https://example.com"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                className="pl-9"
                disabled={submitting}
              />
            </div>
            <select
              aria-label="Pages to crawl"
              value={maxPages}
              onChange={(e) => setMaxPages(parseInt(e.target.value, 10))}
              disabled={submitting}
              className="h-9 rounded-md border border-border bg-background px-3 text-sm"
            >
              <option value={1}>1 page</option>
              <option value={10}>10 pages</option>
              <option value={25}>25 pages</option>
              <option value={50}>50 pages</option>
            </select>
            <Button type="submit" disabled={submitting || !url.trim()}>
              {submitting ? (
                <>
                  <Loader2 className="size-4 animate-spin" /> Starting…
                </>
              ) : (
                <>
                  <Gauge className="size-4" /> Run audit
                </>
              )}
            </Button>
          </div>
          {error && (
            <p className="text-xs text-destructive">{error}</p>
          )}
          <p className="text-xs text-muted-foreground">
            Crawls via Playwright, runs Google PageSpeed Insights on the homepage + up to 4 inner pages, scores 8 categories, and renders an HTML report + fix plan.
            {maxPages > 1 && ` Multi-page crawl follows internal links + sitemap; expect ~${Math.max(30, maxPages * 4)}s.`}
          </p>
        </form>
      </Card>

      {active.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
            Active
          </h2>
          <ul className="space-y-2">
            {active.map((a) => (
              <AuditRow key={a.id} audit={a} />
            ))}
          </ul>
        </section>
      )}

      <section className="space-y-2">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
          History
        </h2>
        {recent.length === 0 ? (
          <Card className="p-4 text-sm text-muted-foreground">
            No audits yet. Paste a URL above to run your first one.
          </Card>
        ) : (
          <ul className="space-y-2">
            {recent.map((a) => (
              <AuditRow key={a.id} audit={a} />
            ))}
          </ul>
        )}
      </section>
    </PageLayout>
  );
}

function AuditRow({ audit }: { audit: Audit }) {
  const isActive = ACTIVE_STATUSES.includes(audit.status);
  const failed = audit.status === "failed";
  const complete = audit.status === "complete";
  const rUrl = reportUrl(audit.id, audit.report_path);
  const fUrl = fixPlanUrl(audit.id, audit.fix_plan_path);

  return (
    <li>
      <Card className="px-4 py-3 space-y-2">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="font-medium truncate">
                {audit.site_name ?? hostnameOf(audit.url)}
              </p>
              <StatusBadge status={audit.status} />
              {complete && audit.overall_score !== null && (
                <ScoreBadge
                  score={audit.overall_score}
                  severity={audit.overall_severity}
                />
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-0.5 truncate">
              {audit.url}
              {audit.current_stage && ` · ${audit.current_stage}`}
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {isActive && (
              <Loader2 className="size-4 animate-spin text-muted-foreground" />
            )}
            {complete && <CheckCircle2 className="size-4 text-emerald-400" />}
            {failed && <AlertCircle className="size-4 text-destructive" />}
          </div>
        </div>

        {isActive && (
          <div className="space-y-1">
            <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
              <div
                className="h-full bg-foreground transition-all"
                style={{ width: `${audit.progress_pct}%` }}
              />
            </div>
            <div className="flex items-center justify-between text-xs text-muted-foreground tabular-nums">
              <span>{audit.progress_pct}%</span>
              <span>{audit.current_stage ?? "Working…"}</span>
            </div>
          </div>
        )}

        {complete && (rUrl || fUrl) && (
          <div className="flex flex-wrap items-center gap-2 pt-1">
            {rUrl && (
              <a
                href={rUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-md border border-border hover:bg-muted transition-colors"
              >
                <ExternalLink className="size-3" /> Report
              </a>
            )}
            {fUrl && (
              <a
                href={fUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-md border border-border hover:bg-muted transition-colors"
              >
                <Wrench className="size-3" /> Fix plan
              </a>
            )}
            <CopyPromptButton auditId={audit.id} />
            {audit.pages_crawled !== null && (
              <span className="text-xs text-muted-foreground">
                {audit.pages_crawled} page{audit.pages_crawled === 1 ? "" : "s"} crawled
              </span>
            )}
          </div>
        )}

        {failed && audit.error && (
          <p className="text-xs text-destructive line-clamp-3">{audit.error}</p>
        )}
      </Card>
    </li>
  );
}

function CopyPromptButton({ auditId }: { auditId: string }) {
  const [state, setState] = useState<"idle" | "loading" | "copied" | "error">("idle");

  const handleClick = async () => {
    setState("loading");
    try {
      const res = await fetch(`/api/audits/${auditId}/prompt`);
      if (!res.ok) throw new Error(await res.text());
      const text = await res.text();
      await navigator.clipboard.writeText(text);
      setState("copied");
      setTimeout(() => setState("idle"), 2500);
    } catch {
      setState("error");
      setTimeout(() => setState("idle"), 2500);
    }
  };

  const label =
    state === "loading"
      ? "Generating…"
      : state === "copied"
      ? "Copied"
      : state === "error"
      ? "Failed"
      : "Copy Claude prompt";

  const Icon =
    state === "loading"
      ? Loader2
      : state === "copied"
      ? Check
      : state === "error"
      ? AlertCircle
      : Sparkles;

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={state === "loading"}
      className={cn(
        "inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-md border border-border transition-colors",
        state === "copied" && "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
        state === "error" && "bg-red-500/15 text-red-400 border-red-500/30",
        state === "idle" && "hover:bg-muted",
        state === "loading" && "opacity-60 cursor-wait"
      )}
    >
      <Icon className={cn("size-3", state === "loading" && "animate-spin")} />
      {label}
    </button>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    pending: "bg-muted text-muted-foreground",
    crawling: "bg-foreground/8 text-foreground",
    scoring: "bg-purple-500/15 text-purple-400",
    rendering: "bg-amber-500/15 text-amber-400",
    complete: "bg-emerald-500/15 text-emerald-400",
    failed: "bg-red-500/15 text-red-400",
  };
  return (
    <Badge
      variant="secondary"
      className={cn("text-[10px] h-5 capitalize", map[status] ?? map.pending)}
    >
      {status}
    </Badge>
  );
}

function ScoreBadge({
  score,
  severity,
}: {
  score: number;
  severity: string | null;
}) {
  const tone = severityToTone(severity);
  return (
    <Badge
      variant="secondary"
      className={cn("text-[10px] h-5 tabular-nums font-mono", tone)}
    >
      {score}/100
    </Badge>
  );
}

function severityToTone(severity: string | null): string {
  switch (severity) {
    case "strong":
      return "bg-foreground/8 text-foreground";
    case "acceptable":
      return "bg-emerald-500/15 text-emerald-400";
    case "moderate":
      return "bg-amber-500/15 text-amber-400";
    case "serious":
      return "bg-orange-500/15 text-orange-400";
    case "critical":
      return "bg-red-500/15 text-red-400";
    default:
      return "bg-muted text-muted-foreground";
  }
}

function hostnameOf(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
}
