"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { BarChart3, Clock3, AlarmClock } from "lucide-react";
import { PageLayout } from "@/components/layout/page-layout";
import { PipelineTabs } from "@/components/pipeline/pipeline-tabs";
import {
  ACTIVE_STAGES,
  ACTIVITY_TYPES,
  ACTIVITY_TYPE_LABEL,
  STAGE_LABEL,
  type ActivityType,
  type CrmActivity,
  type CrmTask,
  type DealWithLinks,
} from "@/types/pipeline";
import {
  activityVolumeByWeek,
  dashboardTopMetrics,
  dealsCreatedVsClosed,
  needsAttention,
  pipelineByStage,
} from "@/lib/pipeline/dashboard";

const mono = "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace";

// One color per activity type, all shades of the brand accent (--rust is
// mapped to Niewdel Blue) so the stacked bars read as one family.
const ACTIVITY_TYPE_OPACITY: Record<ActivityType, number> = {
  call: 1,
  meeting: 0.8,
  email: 0.6,
  note: 0.4,
  stage_change: 0.22,
};

function formatCurrency(cents: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(
    cents / 100
  );
}

function formatPercent(rate: number | null): string {
  if (rate === null) return "—";
  return `${Math.round(rate * 100)}%`;
}

function formatWeekLabel(iso: string): string {
  return new Date(`${iso}T00:00:00.000Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
}

export default function PipelineDashboardPage() {
  const [deals, setDeals] = useState<DealWithLinks[]>([]);
  const [activities, setActivities] = useState<CrmActivity[]>([]);
  const [tasks, setTasks] = useState<CrmTask[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchAll = useCallback(async () => {
    const [dealsRes, activitiesRes, tasksRes] = await Promise.all([
      fetch("/api/pipeline/deals"),
      fetch("/api/pipeline/activities"),
      fetch("/api/pipeline/tasks?done=false"),
    ]);
    const [dealsJson, activitiesJson, tasksJson] = await Promise.all([
      dealsRes.json(),
      activitiesRes.json(),
      tasksRes.json(),
    ]);
    setDeals(dealsJson.data ?? []);
    setActivities(activitiesJson.data ?? []);
    setTasks(tasksJson.data ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const topMetrics = useMemo(() => dashboardTopMetrics(deals), [deals]);
  const byStage = useMemo(() => pipelineByStage(deals), [deals]);
  const createdVsClosed = useMemo(() => dealsCreatedVsClosed(deals, 8), [deals]);
  const activityByWeek = useMemo(() => activityVolumeByWeek(activities, 8), [activities]);
  const attention = useMemo(() => needsAttention(deals, tasks), [deals, tasks]);

  const maxStageValue = Math.max(1, ...ACTIVE_STAGES.map((s) => byStage[s]?.openValue ?? 0));
  const maxWeekCount = Math.max(1, ...createdVsClosed.flatMap((w) => [w.created, w.closed]));
  const maxActivityTotal = Math.max(1, ...activityByWeek.map((w) => w.total));
  const hasAnyDeals = deals.length > 0;
  const hasAnyActivity = activities.length > 0;

  return (
    <PageLayout
      title="Dashboard"
      eyebrow="Sales · Niewdel"
      description="Pipeline health at a glance. Forecast, stage mix, and where deals are stalling."
      icon={BarChart3}
      maxWidth="2xl"
      loading={loading}
    >
      <PipelineTabs />

      {/* Top metrics row */}
      <div className="flex flex-wrap items-end gap-x-10 gap-y-4 pb-2">
        <Stat label="Open pipeline value" value={formatCurrency(topMetrics.openValue)} />
        <Stat
          label="Weighted forecast"
          value={formatCurrency(topMetrics.weightedForecast)}
          hint="Sum of open deal value x stage/probability"
        />
        <Stat
          label="Won this month"
          value={`${topMetrics.wonThisMonth.count} · ${formatCurrency(topMetrics.wonThisMonth.value)}`}
        />
        <Stat
          label="Win rate"
          value={formatPercent(topMetrics.winRate)}
          hint="Won / (won + lost), trailing 90 days"
        />
      </div>

      {/* Pipeline value by stage */}
      <Section title="Pipeline value by stage">
        {!hasAnyDeals ? (
          <EmptyState message="No open deals yet. Add a deal to see stage value here." />
        ) : (
          <div className="space-y-2.5">
            {ACTIVE_STAGES.map((stage) => {
              const bucket = byStage[stage];
              const pct = Math.round((bucket.openValue / maxStageValue) * 100);
              return (
                <div key={stage} className="flex items-center gap-3">
                  <span className="text-xs w-24 shrink-0 truncate" style={{ color: "var(--ink-soft)" }}>
                    {STAGE_LABEL[stage]}
                  </span>
                  <div className="flex-1 h-6 rounded-md overflow-hidden" style={{ backgroundColor: "var(--paper-sunken)" }}>
                    <div
                      className="h-full rounded-md transition-[width]"
                      style={{ width: `${Math.max(pct, bucket.openValue > 0 ? 3 : 0)}%`, backgroundColor: "var(--rust)" }}
                    />
                  </div>
                  <span
                    className="text-xs tabular-nums shrink-0 w-40 text-right"
                    style={{ fontFamily: mono, color: "var(--ink-soft)" }}
                  >
                    {bucket.count} · {formatCurrency(bucket.openValue)}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </Section>

      {/* Deals created vs closed */}
      <Section title="Deals created vs closed" hint="Last 8 weeks">
        {!hasAnyDeals ? (
          <EmptyState message="No deal history yet. This fills in as deals get created and closed." />
        ) : (
          <div className="flex items-end gap-3 h-36 pt-2">
            {createdVsClosed.map((week) => (
              <div key={week.weekStart} className="flex-1 flex flex-col items-center gap-1.5 h-full justify-end">
                <div className="flex items-end gap-1 h-full w-full justify-center">
                  <Bar heightPct={(week.created / maxWeekCount) * 100} color="var(--rust)" title={`${week.created} created`} />
                  <Bar
                    heightPct={(week.closed / maxWeekCount) * 100}
                    color="var(--ink-faint)"
                    title={`${week.closed} closed`}
                  />
                </div>
                <span className="text-[10px] tabular-nums" style={{ fontFamily: mono, color: "var(--ink-soft)" }}>
                  {formatWeekLabel(week.weekStart)}
                </span>
              </div>
            ))}
          </div>
        )}
        <Legend items={[{ label: "Created", color: "var(--rust)" }, { label: "Closed", color: "var(--ink-faint)" }]} />
      </Section>

      {/* Activity volume */}
      <Section title="Activity volume" hint="Last 8 weeks, by type">
        {!hasAnyActivity ? (
          <EmptyState message="No activity logged yet. Notes, calls, emails, and meetings will show up here." />
        ) : (
          <div className="flex items-end gap-3 h-36 pt-2">
            {activityByWeek.map((week) => (
              <div key={week.weekStart} className="flex-1 flex flex-col items-center gap-1.5 h-full justify-end">
                <div
                  className="w-full max-w-10 rounded-t-sm overflow-hidden flex flex-col-reverse"
                  style={{ height: `${Math.max((week.total / maxActivityTotal) * 100, week.total > 0 ? 4 : 0)}%` }}
                  title={`${week.total} activities`}
                >
                  {ACTIVITY_TYPES.map((type) =>
                    week.byType[type] > 0 ? (
                      <div
                        key={type}
                        style={{
                          flexGrow: week.byType[type],
                          backgroundColor: `color-mix(in oklch, var(--rust) ${Math.round(
                            ACTIVITY_TYPE_OPACITY[type] * 100
                          )}%, transparent)`,
                        }}
                      />
                    ) : null
                  )}
                </div>
                <span className="text-[10px] tabular-nums" style={{ fontFamily: mono, color: "var(--ink-soft)" }}>
                  {formatWeekLabel(week.weekStart)}
                </span>
              </div>
            ))}
          </div>
        )}
        <Legend
          items={ACTIVITY_TYPES.map((type) => ({
            label: ACTIVITY_TYPE_LABEL[type],
            color: `color-mix(in oklch, var(--rust) ${Math.round(ACTIVITY_TYPE_OPACITY[type] * 100)}%, transparent)`,
          }))}
        />
      </Section>

      {/* Needs attention */}
      <Section title="Needs attention">
        <div className="flex flex-wrap gap-3">
          <Link
            href="/pipeline?needsAttention=true"
            className="flex-1 min-w-56 flex items-center gap-3 rounded-lg border p-4 transition-colors hover:border-foreground/30"
            style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}
          >
            <Clock3 size={18} style={{ color: attention.staleDeals > 0 ? "#EF4444" : "var(--ink-soft)" }} />
            <div>
              <p className="text-lg font-bold tabular-nums">{attention.staleDeals}</p>
              <p className="text-[11px]" style={{ color: "var(--ink-soft)", fontFamily: mono }}>
                Stale deals, no next action
              </p>
            </div>
          </Link>
          <Link
            href="/pipeline/my-day"
            className="flex-1 min-w-56 flex items-center gap-3 rounded-lg border p-4 transition-colors hover:border-foreground/30"
            style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}
          >
            <AlarmClock size={18} style={{ color: attention.overdueTasks > 0 ? "#EF4444" : "var(--ink-soft)" }} />
            <div>
              <p className="text-lg font-bold tabular-nums">{attention.overdueTasks}</p>
              <p className="text-[11px]" style={{ color: "var(--ink-soft)", fontFamily: mono }}>
                Overdue tasks — see My Day
              </p>
            </div>
          </Link>
        </div>
      </Section>
    </PageLayout>
  );
}

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="mono-tag-muted" title={hint}>
        {label}
      </span>
      <span className="text-2xl font-bold tabular-nums tracking-tight text-foreground">{value}</span>
    </div>
  );
}

function Section({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border p-4 space-y-3" style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}>
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold">{title}</h2>
        {hint && (
          <span className="text-[10px] uppercase tracking-wider" style={{ fontFamily: mono, color: "var(--ink-faint)" }}>
            {hint}
          </span>
        )}
      </div>
      {children}
    </div>
  );
}

function Bar({ heightPct, color, title }: { heightPct: number; color: string; title: string }) {
  return (
    <div
      title={title}
      className="w-3.5 rounded-t-sm"
      style={{ height: `${Math.max(heightPct, heightPct > 0 ? 4 : 0)}%`, backgroundColor: color, minHeight: heightPct > 0 ? 2 : 0 }}
    />
  );
}

function Legend({ items }: { items: { label: string; color: string }[] }) {
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1 pt-1">
      {items.map((item) => (
        <span key={item.label} className="flex items-center gap-1.5 text-[10px]" style={{ color: "var(--ink-soft)", fontFamily: mono }}>
          <span className="size-2 rounded-sm shrink-0" style={{ backgroundColor: item.color }} />
          {item.label}
        </span>
      ))}
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <p className="text-[11px] py-6 text-center" style={{ color: "var(--ink-faint)", fontFamily: mono }}>
      {message}
    </p>
  );
}
