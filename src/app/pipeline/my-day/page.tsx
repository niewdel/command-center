"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Square, AlarmClock, CalendarClock, CalendarDays, Compass } from "lucide-react";
import { PageLayout } from "@/components/layout/page-layout";
import { PipelineTabs } from "@/components/pipeline/pipeline-tabs";
import { isDealStale } from "@/lib/pipeline/stale";
import { getTaskBucket } from "@/lib/pipeline/tasks";
import { STAGE_LABEL, type DealWithLinks } from "@/types/pipeline";
import type { CrmTask } from "@/types/pipeline";

const mono = "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace";

function formatDueDate(iso: string | null): string {
  if (!iso) return "No due date";
  return new Date(iso).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}

export default function MyDayPage() {
  const [tasks, setTasks] = useState<CrmTask[]>([]);
  const [deals, setDeals] = useState<DealWithLinks[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchAll = useCallback(async () => {
    const [tasksRes, dealsRes] = await Promise.all([
      fetch("/api/pipeline/tasks?done=false"),
      fetch("/api/pipeline/deals"),
    ]);
    const tasksJson = await tasksRes.json();
    const dealsJson = await dealsRes.json();
    setTasks(tasksJson.data ?? []);
    setDeals(dealsJson.data ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const handleToggle = async (task: CrmTask) => {
    // Optimistic: a completed task just disappears from the (all-open) list.
    setTasks((prev) => prev.filter((t) => t.id !== task.id));
    const res = await fetch(`/api/pipeline/tasks/${task.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ done: true }),
    });
    if (!res.ok) {
      // Roll back on failure.
      setTasks((prev) => [...prev, task]);
    }
  };

  const buckets = useMemo(() => {
    const overdue: CrmTask[] = [];
    const today: CrmTask[] = [];
    const upcoming: CrmTask[] = [];
    for (const t of tasks) {
      const bucket = getTaskBucket(t);
      if (bucket === "overdue") overdue.push(t);
      else if (bucket === "today") today.push(t);
      else if (bucket === "upcoming") upcoming.push(t);
    }
    return { overdue, today, upcoming };
  }, [tasks]);

  const staleDeals = useMemo(() => deals.filter((d) => isDealStale(d)), [deals]);

  const allCaughtUp = buckets.overdue.length === 0 && buckets.today.length === 0 && buckets.upcoming.length === 0;

  if (loading) {
    return (
      <PageLayout title="My Day" maxWidth="lg" loading>
        {null}
      </PageLayout>
    );
  }

  return (
    <PageLayout title="My Day" description="Today's agenda. Overdue, today, and what's coming up." maxWidth="lg">
      <PipelineTabs />

      <div className="space-y-4">
        <TaskSection
          icon={AlarmClock}
          label="Overdue"
          tone="#EF4444"
          tasks={buckets.overdue}
          onToggle={handleToggle}
          emptyLabel="Nothing overdue. Clean slate."
        />
        <TaskSection
          icon={CalendarClock}
          label="Today"
          tone="var(--rust)"
          tasks={buckets.today}
          onToggle={handleToggle}
          emptyLabel="Nothing due today."
        />
        <TaskSection
          icon={CalendarDays}
          label="Upcoming (next 7 days)"
          tone="var(--ink-soft)"
          tasks={buckets.upcoming}
          onToggle={handleToggle}
          emptyLabel="Nothing on deck for the next week."
        />

        {allCaughtUp && (
          <div
            className="rounded-lg border p-6 text-center"
            style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}
          >
            <p className="text-sm font-semibold">You&apos;re all caught up.</p>
            <p className="text-[11px] mt-1" style={{ color: "var(--ink-soft)", fontFamily: mono }}>
              No overdue, no due-today, nothing on deck. Go make something happen.
            </p>
          </div>
        )}

        {/* Deals needing a next action (Task E1 stale logic, surfaced here) */}
        <div
          className="rounded-lg border p-4 space-y-3"
          style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}
        >
          <p
            className="text-[10px] uppercase tracking-wider flex items-center gap-1.5"
            style={{ color: "color-mix(in oklch, var(--rust) calc(0.5 * 100%), transparent)", fontFamily: mono }}
          >
            <Compass size={11} /> Deals needing a next action
          </p>
          {staleDeals.length === 0 ? (
            <p className="text-[11px]" style={{ color: "var(--ink-soft)", fontFamily: mono }}>
              Every open deal has a next action scheduled. Nice.
            </p>
          ) : (
            <ul className="space-y-1.5">
              {staleDeals.map((deal) => (
                <li key={deal.id}>
                  <Link
                    href={`/pipeline/deals/${deal.id}`}
                    className="flex items-center justify-between gap-2 rounded-md px-2.5 py-2 transition-colors hover:bg-[color-mix(in oklch, var(--rust) calc(0.06 * 100%), transparent)]"
                    style={{ backgroundColor: "var(--paper-sunken)" }}
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{deal.title}</p>
                      <p className="text-[11px] truncate" style={{ color: "var(--ink-soft)" }}>
                        {deal.company?.name ?? "No company"} &middot; {STAGE_LABEL[deal.stage]}
                      </p>
                    </div>
                    <span
                      className="text-[10px] uppercase tracking-wider shrink-0"
                      style={{ fontFamily: mono, color: "#EF4444" }}
                    >
                      {deal.next_action_at ? "Past due" : "No next action"}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </PageLayout>
  );
}

function TaskSection({
  icon: Icon,
  label,
  tone,
  tasks,
  onToggle,
  emptyLabel,
}: {
  icon: typeof AlarmClock;
  label: string;
  tone: string;
  tasks: CrmTask[];
  onToggle: (task: CrmTask) => void;
  emptyLabel: string;
}) {
  return (
    <div
      className="rounded-lg border p-4 space-y-2"
      style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}
    >
      <p
        className="text-[10px] uppercase tracking-wider flex items-center gap-1.5"
        style={{ color: tone, fontFamily: mono }}
      >
        <Icon size={11} /> {label} {tasks.length > 0 && `(${tasks.length})`}
      </p>
      {tasks.length === 0 ? (
        <p className="text-[11px]" style={{ color: "var(--ink-faint)", fontFamily: mono }}>
          {emptyLabel}
        </p>
      ) : (
        <ul className="space-y-1.5">
          {tasks.map((task) => (
            <li
              key={task.id}
              className="flex items-center gap-2 rounded-md px-2 py-1.5"
              style={{ backgroundColor: "var(--paper-sunken)" }}
            >
              <button
                type="button"
                onClick={() => onToggle(task)}
                aria-label="Mark task complete"
                className="shrink-0"
                style={{ color: "var(--ink-soft)" }}
              >
                <Square size={16} />
              </button>
              <div className="flex-1 min-w-0">
                {task.deal_id ? (
                  <Link href={`/pipeline/deals/${task.deal_id}`} className="text-sm truncate block hover:underline">
                    {task.title}
                  </Link>
                ) : (
                  <p className="text-sm truncate">{task.title}</p>
                )}
              </div>
              <span className="text-[10px] uppercase tracking-wider shrink-0" style={{ fontFamily: mono, color: "var(--ink-faint)" }}>
                {formatDueDate(task.due_date)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
