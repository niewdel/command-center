"use client";

import { useEffect, useState, useCallback, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Users, Sparkles, CheckCircle2, AlertCircle, Loader2, X, Copy } from "lucide-react";
import { PageLayout } from "@/components/layout/page-layout";
import { LeadsTabs } from "@/components/leads/leads-tabs";
import { Card } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/lib/supabase";
import { cn } from "@/lib/utils";
import type { LeadStats } from "@/types/leads";

const STATUS_DOT: Record<string, string> = {
  new: "bg-zinc-500",
  researched: "bg-blue-400",
  outreach_ready: "bg-emerald-400",
  in_sequence: "bg-amber-400",
  replied: "bg-purple-400",
  qualified: "bg-green-400",
  disqualified: "bg-red-400",
};

type LeadJob = {
  id: string;
  status: string;
  current_stage: string | null;
  progress_pct: number;
  target_count: number;
  companies_found: number;
  contacts_found: number;
  emails_drafted: number;
  error: string | null;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
  verticals: { name: string } | null;
};

const ACTIVE_STATUSES = ["queued", "scraping", "enriching", "researching", "writing"];

export default function LeadsStatsPage() {
  return (
    <Suspense fallback={null}>
      <LeadsStatsContent />
    </Suspense>
  );
}

function LeadsStatsContent() {
  const searchParams = useSearchParams();
  const focusJobId = searchParams.get("job");

  const [stats, setStats] = useState<LeadStats | null>(null);
  const [jobs, setJobs] = useState<LeadJob[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchAll = useCallback(async () => {
    const [statsRes, jobsRes] = await Promise.all([
      fetch("/api/leads/stats").then((r) => r.json()),
      fetch("/api/leads/jobs?limit=10").then((r) => r.json()),
    ]);
    setStats(statsRes);
    setJobs(jobsRes.data ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchAll();
    // Realtime: any change to lead_jobs refetches the list (and stats if status flipped to complete)
    const channel = supabase
      .channel("lead-jobs-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "lead_jobs" },
        () => fetchAll()
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchAll]);

  const activeJobs = jobs.filter((j) => ACTIVE_STATUSES.includes(j.status));
  const recentJobs = jobs.filter((j) => !ACTIVE_STATUSES.includes(j.status));

  return (
    <PageLayout
      title="Leads"
      description="Pipeline overview across all verticals"
      icon={Users}
      maxWidth="xl"
      loading={loading}
      actions={
        <Link href="/leads/new" className={buttonVariants()}>
          <Sparkles className="size-4" /> Generate Leads
        </Link>
      }
    >
      <LeadsTabs />

      {!stats ? (
        <p className="text-sm text-muted-foreground">No data yet.</p>
      ) : (
        <div className="space-y-6">
          {(activeJobs.length > 0 || focusJobId) && (
            <section className="space-y-2">
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                Active jobs
              </h2>
              {activeJobs.length === 0 ? (
                <Card className="p-4 text-sm text-muted-foreground">
                  Job is starting…
                </Card>
              ) : (
                <ul className="space-y-2">
                  {activeJobs.map((job) => (
                    <JobRow
                      key={job.id}
                      job={job}
                      highlighted={job.id === focusJobId}
                    />
                  ))}
                </ul>
              )}
            </section>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <StatCard
              label="Companies"
              value={stats.companies.total}
              sub={`${stats.companies.byStatus.outreach_ready ?? 0} outreach ready`}
            />
            <StatCard
              label="Contacts"
              value={stats.contacts.total}
              sub="with verified emails"
            />
            <StatCard
              label="Emails Drafted"
              value={stats.emails.total}
              sub={`${stats.emails.byStatus.draft ?? 0} drafts`}
            />
            <StatCard
              label="Pipeline Events"
              value={Object.values(stats.events).reduce((a, b) => a + b, 0)}
              sub={`${stats.events.scraped ?? 0} scraped \u00b7 ${stats.events.researched ?? 0} researched`}
            />
          </div>

          <section className="space-y-3">
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
              Verticals
            </h2>
            {stats.verticals.length === 0 ? (
              <Card className="p-4 text-sm text-muted-foreground">
                No verticals yet. Click "Generate Leads" to start your first run.
              </Card>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {stats.verticals.map((v) => (
                  <Card
                    key={v.id}
                    className="px-4 py-3 flex items-center justify-between"
                  >
                    <div className="min-w-0">
                      <p className="font-medium truncate">{v.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {v.is_active ? "Active" : "Inactive"}
                      </p>
                    </div>
                    <span
                      className={cn(
                        "size-2 rounded-full shrink-0",
                        v.is_active ? "bg-emerald-400" : "bg-muted-foreground/40"
                      )}
                      aria-hidden
                    />
                  </Card>
                ))}
              </div>
            )}
          </section>

          {recentJobs.length > 0 && (
            <section className="space-y-2">
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                Recent jobs
              </h2>
              <ul className="space-y-2">
                {recentJobs.slice(0, 5).map((job) => (
                  <JobRow key={job.id} job={job} />
                ))}
              </ul>
            </section>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card className="p-4">
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                Company pipeline
              </h3>
              {Object.keys(stats.companies.byStatus).length === 0 ? (
                <p className="text-sm text-muted-foreground">No companies yet.</p>
              ) : (
                <ul className="space-y-2">
                  {Object.entries(stats.companies.byStatus).map(([status, count]) => (
                    <li
                      key={status}
                      className="flex items-center justify-between text-sm"
                    >
                      <div className="flex items-center gap-2">
                        <span
                          className={cn(
                            "size-2 rounded-full",
                            STATUS_DOT[status] ?? "bg-muted-foreground/40"
                          )}
                          aria-hidden
                        />
                        <span className="capitalize">
                          {status.replace(/_/g, " ")}
                        </span>
                      </div>
                      <span className="font-mono tabular-nums text-muted-foreground">
                        {count}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </Card>

            <Card className="p-4">
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                Pipeline events
              </h3>
              {Object.keys(stats.events).length === 0 ? (
                <p className="text-sm text-muted-foreground">No events yet.</p>
              ) : (
                <ul className="space-y-2">
                  {Object.entries(stats.events).map(([type, count]) => (
                    <li
                      key={type}
                      className="flex items-center justify-between text-sm"
                    >
                      <span className="capitalize">
                        {type.replace(/_/g, " ")}
                      </span>
                      <span className="font-mono tabular-nums text-muted-foreground">
                        {count}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </div>
        </div>
      )}
    </PageLayout>
  );
}

function StatCard({
  label,
  value,
  sub,
}: {
  label: string;
  value: number;
  sub: string;
}) {
  return (
    <Card className="px-4 py-3">
      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
        {label}
      </p>
      <p className="text-2xl font-semibold mt-1 tabular-nums">{value}</p>
      <p className="text-xs text-muted-foreground mt-1">{sub}</p>
    </Card>
  );
}

function JobRow({ job, highlighted }: { job: LeadJob; highlighted?: boolean }) {
  const isActive = ACTIVE_STATUSES.includes(job.status);
  const failed = job.status === "failed";
  const complete = job.status === "complete";
  const cancelled = job.status === "cancelled";

  return (
    <li>
      <Card
        className={cn(
          "px-4 py-3 space-y-2",
          highlighted && "ring-2 ring-foreground/40"
        )}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="font-medium truncate">
                {job.verticals?.name ?? "Unnamed run"}
              </p>
              <JobStatusBadge status={job.status} />
            </div>
            <p className="text-xs text-muted-foreground mt-0.5 truncate">
              {job.current_stage ?? "Waiting…"}
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {isActive && (
              <Loader2 className="size-4 animate-spin text-muted-foreground" />
            )}
            {complete && <CheckCircle2 className="size-4 text-emerald-400" />}
            {failed && <AlertCircle className="size-4 text-destructive" />}
            {cancelled && <X className="size-4 text-muted-foreground" />}
          </div>
        </div>

        {isActive && (
          <div className="space-y-1">
            <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
              <div
                className="h-full bg-foreground transition-all"
                style={{ width: `${job.progress_pct}%` }}
              />
            </div>
            <div className="flex items-center justify-between text-xs text-muted-foreground tabular-nums">
              <span>{job.progress_pct}%</span>
              <span>
                {job.companies_found} co · {job.contacts_found} contacts ·{" "}
                {job.emails_drafted} emails
              </span>
            </div>
          </div>
        )}

        {complete && (
          <p className="text-xs text-muted-foreground">
            {job.companies_found} companies · {job.contacts_found} contacts ·{" "}
            {job.emails_drafted} email drafts ready
          </p>
        )}

        {failed && job.error && (
          <p className="text-xs text-destructive line-clamp-2">{job.error}</p>
        )}

        {(failed || complete || cancelled) && (
          <div className="pt-1">
            <Link
              href={`/leads/new?clone=${job.id}`}
              className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-md border border-border hover:bg-muted transition-colors"
            >
              <Copy className="size-3" /> Clone &amp; edit
            </Link>
          </div>
        )}
      </Card>
    </li>
  );
}

function JobStatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    queued: "bg-muted text-muted-foreground",
    scraping: "bg-blue-500/15 text-blue-400",
    enriching: "bg-blue-500/15 text-blue-400",
    researching: "bg-purple-500/15 text-purple-400",
    writing: "bg-amber-500/15 text-amber-400",
    complete: "bg-emerald-500/15 text-emerald-400",
    failed: "bg-red-500/15 text-red-400",
    cancelled: "bg-muted text-muted-foreground",
  };
  return (
    <Badge
      variant="secondary"
      className={cn("text-[10px] h-5 capitalize", map[status] ?? map.queued)}
    >
      {status}
    </Badge>
  );
}
