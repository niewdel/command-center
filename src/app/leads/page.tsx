"use client";

import { useCallback, useEffect, useState, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  Play,
  Loader2,
  CheckCircle2,
  AlertCircle,
  X,
  Copy,
  Sparkles,
} from "lucide-react";
import { PageLayout } from "@/components/layout/page-layout";
import { LeadsTabs } from "@/components/leads/leads-tabs";
import { supabase } from "@/lib/supabase";
import type { LeadStats } from "@/types/leads";

const mono = "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace";

const STATUS_DOT: Record<string, string> = {
  new: "var(--ink-faint)",
  researched: "var(--rust)",
  outreach_ready: "#10B981",
  in_sequence: "#F59E0B",
  replied: "#10B981",
  qualified: "#10B981",
  disqualified: "#EF4444",
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

const PHASE_LABEL: Record<string, string> = {
  queued: "Queued...",
  scraping: "Finding prospects...",
  enriching: "Enriching company data...",
  researching: "Researching companies...",
  writing: "Writing email sequences...",
};

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
    const channel = supabase
      .channel("lead-jobs-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "lead_jobs" }, () => fetchAll())
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchAll]);

  const activeJobs = jobs.filter((j) => ACTIVE_STATUSES.includes(j.status));
  const recentJobs = jobs.filter((j) => !ACTIVE_STATUSES.includes(j.status));

  return (
    <PageLayout
      title="Lead Gen Agent"
      eyebrow="Agent · Outbound"
      description="Pipeline overview across all verticals."
      maxWidth="xl"
      loading={loading}
    >
      <LeadsTabs />

      <style>{`
        @keyframes fadeIn { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes pulseGlow { 0%, 100% { box-shadow: 0 0 0 0 color-mix(in oklch, var(--rust) calc(0 * 100%), transparent); } 50% { box-shadow: 0 0 14px 2px color-mix(in oklch, var(--rust) calc(0.18 * 100%), transparent); } }
      `}</style>

      {!stats ? (
        <p className="text-sm text-muted-foreground">No data yet.</p>
      ) : (
        <div className="space-y-6">
          {/* Hero CTA — matches the niewdel.com/lab "Launch Lead Gen Agent" */}
          <Link
            href="/leads/new"
            className="block w-full py-5 rounded-xl text-sm font-bold uppercase tracking-wider flex items-center justify-center gap-3 transition-all duration-200 hover:scale-[1.005] active:scale-[0.995]"
            style={{
              backgroundColor: "color-mix(in oklch, var(--rust) calc(0.1 * 100%), transparent)",
              color: "var(--rust)",
              border: "1px solid color-mix(in oklch, var(--rust) calc(0.3 * 100%), transparent)",
              animation: activeJobs.length === 0 ? "pulseGlow 2.4s ease-in-out infinite" : undefined,
            }}
          >
            <Play size={18} fill="var(--rust)" />
            Launch Lead Gen Agent
          </Link>

          {/* Active jobs */}
          {(activeJobs.length > 0 || focusJobId) && (
            <section className="space-y-2">
              <p
                className="text-[10px] uppercase tracking-wider"
                style={{ color: "var(--ink-soft)", fontFamily: mono }}
              >
                Active jobs
              </p>
              {activeJobs.length === 0 ? (
                <div
                  className="p-4 rounded-lg border text-sm"
                  style={{
                    backgroundColor: "var(--card)",
                    borderColor: "var(--border)",
                    color: "var(--ink-soft)",
                  }}
                >
                  Job is starting…
                </div>
              ) : (
                <ul className="space-y-2">
                  {activeJobs.map((job) => (
                    <JobRow key={job.id} job={job} highlighted={job.id === focusJobId} />
                  ))}
                </ul>
              )}
            </section>
          )}

          {/* Stats grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <StatCard
              label="Companies"
              value={stats.companies.total}
              sub={`${stats.companies.byStatus.outreach_ready ?? 0} outreach ready`}
            />
            <StatCard label="Contacts" value={stats.contacts.total} sub="with verified emails" />
            <StatCard
              label="Emails Drafted"
              value={stats.emails.total}
              sub={`${stats.emails.byStatus.draft ?? 0} drafts`}
            />
            <StatCard
              label="Pipeline Events"
              value={Object.values(stats.events).reduce((a, b) => a + b, 0)}
              sub={`${stats.events.scraped ?? 0} scraped · ${stats.events.researched ?? 0} researched`}
            />
          </div>

          {/* Verticals */}
          <section className="space-y-2">
            <p
              className="text-[10px] uppercase tracking-wider"
              style={{ color: "var(--ink-soft)", fontFamily: mono }}
            >
              Verticals
            </p>
            {stats.verticals.length === 0 ? (
              <div
                className="p-4 rounded-lg border text-sm"
                style={{
                  backgroundColor: "var(--card)",
                  borderColor: "var(--border)",
                  color: "var(--ink-soft)",
                }}
              >
                No verticals yet. Click "Launch Lead Gen Agent" above to start your first run.
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {stats.verticals.map((v) => (
                  <div
                    key={v.id}
                    className="px-4 py-3 rounded-lg border flex items-center justify-between"
                    style={{
                      backgroundColor: "var(--card)",
                      borderColor: "var(--border)",
                    }}
                  >
                    <div className="min-w-0">
                      <p className="font-medium truncate text-sm">{v.name}</p>
                      <p
                        className="text-[10px] uppercase tracking-wider mt-0.5"
                        style={{
                          color: v.is_active ? "#10B981" : "var(--ink-faint)",
                          fontFamily: mono,
                        }}
                      >
                        {v.is_active ? "Active" : "Inactive"}
                      </p>
                    </div>
                    <span
                      className="size-2 rounded-full shrink-0"
                      style={{ backgroundColor: v.is_active ? "#10B981" : "var(--ink-faint)" }}
                      aria-hidden
                    />
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Recent jobs */}
          {recentJobs.length > 0 && (
            <section className="space-y-2">
              <p
                className="text-[10px] uppercase tracking-wider"
                style={{ color: "var(--ink-soft)", fontFamily: mono }}
              >
                Recent jobs
              </p>
              <ul className="space-y-2">
                {recentJobs.slice(0, 5).map((job) => (
                  <JobRow key={job.id} job={job} />
                ))}
              </ul>
            </section>
          )}

          {/* Pipeline breakdown */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            <div
              className="p-4 rounded-lg border"
              style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}
            >
              <p
                className="text-[10px] uppercase tracking-wider mb-3"
                style={{ color: "var(--ink-soft)", fontFamily: mono }}
              >
                Company pipeline
              </p>
              {Object.keys(stats.companies.byStatus).length === 0 ? (
                <p className="text-sm" style={{ color: "var(--ink-soft)" }}>
                  No companies yet.
                </p>
              ) : (
                <ul className="space-y-2">
                  {Object.entries(stats.companies.byStatus).map(([status, count]) => (
                    <li key={status} className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2">
                        <span
                          className="size-2 rounded-full"
                          style={{ backgroundColor: STATUS_DOT[status] ?? "var(--ink-faint)" }}
                          aria-hidden
                        />
                        <span className="capitalize" style={{ color: "rgba(245,245,245,0.75)" }}>
                          {status.replace(/_/g, " ")}
                        </span>
                      </div>
                      <span
                        className="tabular-nums"
                        style={{ color: "var(--ink-soft)", fontFamily: mono }}
                      >
                        {count}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div
              className="p-4 rounded-lg border"
              style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}
            >
              <p
                className="text-[10px] uppercase tracking-wider mb-3"
                style={{ color: "var(--ink-soft)", fontFamily: mono }}
              >
                Pipeline events
              </p>
              {Object.keys(stats.events).length === 0 ? (
                <p className="text-sm" style={{ color: "var(--ink-soft)" }}>
                  No events yet.
                </p>
              ) : (
                <ul className="space-y-2">
                  {Object.entries(stats.events).map(([type, count]) => (
                    <li key={type} className="flex items-center justify-between text-sm">
                      <span className="capitalize" style={{ color: "rgba(245,245,245,0.75)" }}>
                        {type.replace(/_/g, " ")}
                      </span>
                      <span
                        className="tabular-nums"
                        style={{ color: "var(--ink-soft)", fontFamily: mono }}
                      >
                        {count}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      )}
    </PageLayout>
  );
}

function StatCard({ label, value, sub }: { label: string; value: number; sub: string }) {
  return (
    <div
      className="p-3 rounded-lg border"
      style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}
    >
      <p
        className="text-[9px] uppercase tracking-wider"
        style={{ color: "var(--ink-faint)", fontFamily: mono }}
      >
        {label}
      </p>
      <p className="text-2xl font-bold tabular-nums mt-1" style={{ color: "var(--rust)" }}>
        {value}
      </p>
      <p className="text-[10px] mt-0.5" style={{ color: "var(--ink-soft)" }}>
        {sub}
      </p>
    </div>
  );
}

function JobRow({ job, highlighted }: { job: LeadJob; highlighted?: boolean }) {
  const isActive = ACTIVE_STATUSES.includes(job.status);
  const failed = job.status === "failed";
  const complete = job.status === "complete";
  const cancelled = job.status === "cancelled";

  return (
    <li>
      <div
        className="px-4 py-3 rounded-lg border space-y-2"
        style={{
          backgroundColor: isActive ? "color-mix(in oklch, var(--rust) calc(0.04 * 100%), transparent)" : "var(--card)",
          borderColor: highlighted
            ? "color-mix(in oklch, var(--rust) calc(0.5 * 100%), transparent)"
            : isActive
              ? "color-mix(in oklch, var(--rust) calc(0.2 * 100%), transparent)"
              : "var(--border)",
          animation: isActive ? "pulseGlow 1.6s ease-in-out infinite" : undefined,
        }}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="font-medium truncate text-sm">{job.verticals?.name ?? "Unnamed run"}</p>
              <JobStatusBadge status={job.status} />
            </div>
            <p
              className="text-[10px] mt-0.5 truncate"
              style={{ color: "var(--ink-soft)", fontFamily: mono }}
            >
              {job.current_stage ?? PHASE_LABEL[job.status] ?? "Waiting…"}
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {isActive && <Loader2 size={14} className="animate-spin" style={{ color: "var(--rust)" }} />}
            {complete && <CheckCircle2 size={14} style={{ color: "#10B981" }} />}
            {failed && <AlertCircle size={14} style={{ color: "#EF4444" }} />}
            {cancelled && <X size={14} style={{ color: "var(--ink-soft)" }} />}
          </div>
        </div>

        {isActive && (
          <div className="space-y-1">
            <div
              className="h-1 w-full rounded-full overflow-hidden"
              style={{ backgroundColor: "var(--border)" }}
            >
              <div
                className="h-full rounded-full"
                style={{
                  width: `${job.progress_pct}%`,
                  backgroundColor: "var(--rust)",
                  transition: "width 0.3s ease",
                }}
              />
            </div>
            <div
              className="flex items-center justify-between text-[10px] tabular-nums"
              style={{ color: "var(--ink-soft)", fontFamily: mono }}
            >
              <span>{job.progress_pct}%</span>
              <span>
                {job.companies_found} co · {job.contacts_found} contacts · {job.emails_drafted} emails
              </span>
            </div>
          </div>
        )}

        {complete && (
          <p className="text-[10px]" style={{ color: "var(--ink-soft)", fontFamily: mono }}>
            {job.companies_found} companies · {job.contacts_found} contacts · {job.emails_drafted} email drafts ready
          </p>
        )}

        {failed && job.error && (
          <p className="text-[10px]" style={{ color: "#EF4444", fontFamily: mono }}>
            {job.error}
          </p>
        )}

        {(failed || complete || cancelled) && (
          <div className="pt-1 flex items-center gap-2">
            <Link
              href={`/leads/new?clone=${job.id}`}
              className="inline-flex items-center gap-1.5 text-[10px] uppercase tracking-wider px-2.5 py-1 rounded-md transition-colors hover:bg-[var(--border)]"
              style={{
                color: "var(--ink-soft)",
                border: "1px solid var(--border)",
                fontFamily: mono,
              }}
            >
              <Copy size={11} /> Clone & edit
            </Link>
            {complete && (
              <Link
                href="/leads/prospects"
                className="inline-flex items-center gap-1.5 text-[10px] uppercase tracking-wider px-2.5 py-1 rounded-md transition-colors hover:bg-[color-mix(in oklch, var(--rust) calc(0.15 * 100%), transparent)]"
                style={{
                  color: "var(--rust)",
                  border: "1px solid color-mix(in oklch, var(--rust) calc(0.2 * 100%), transparent)",
                  fontFamily: mono,
                }}
              >
                <Sparkles size={11} /> View prospects
              </Link>
            )}
          </div>
        )}
      </div>
    </li>
  );
}

function JobStatusBadge({ status }: { status: string }) {
  const map: Record<string, { color: string; bg: string }> = {
    queued: { color: "var(--ink-soft)", bg: "var(--border)" },
    scraping: { color: "var(--rust)", bg: "color-mix(in oklch, var(--rust) calc(0.1 * 100%), transparent)" },
    enriching: { color: "var(--rust)", bg: "color-mix(in oklch, var(--rust) calc(0.1 * 100%), transparent)" },
    researching: { color: "#A78BFA", bg: "rgba(167,139,250,0.1)" },
    writing: { color: "#F59E0B", bg: "rgba(245,158,11,0.1)" },
    complete: { color: "#10B981", bg: "rgba(16,185,129,0.1)" },
    failed: { color: "#EF4444", bg: "rgba(239,68,68,0.1)" },
    cancelled: { color: "var(--ink-soft)", bg: "var(--border)" },
  };
  const s = map[status] ?? map.queued;
  return (
    <span
      className="text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded"
      style={{ color: s.color, backgroundColor: s.bg, fontFamily: mono }}
    >
      {status}
    </span>
  );
}
