"use client";

import { useState, useMemo } from "react";
import { supabase, getUserId } from "@/lib/supabase";
import { Task, Workspace, UserSettings, CalendarEvent } from "@/types/database";
import { calculateCapacityWithEvents, formatMinutes, ESTIMATE_PRESETS } from "@/lib/capacity";
import { CapacityBar } from "@/components/dashboard/capacity-bar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { cn, localDateString } from "@/lib/utils";
import {
  AlertCircle,
  ArrowRight,
  ArrowLeft,
  CalendarClock,
  Clock,
  Star,
  Sunrise,
  Sparkles,
  Trash2,
  Check,
} from "lucide-react";

type MorningRitualProps = {
  tasks: Task[];
  workspaces: Workspace[];
  settings: UserSettings | null;
  calendarEvents?: CalendarEvent[];
  onComplete: () => void;
  onCancel: () => void;
};

const todayStr = () => localDateString();

type TriageAction = "today" | "reschedule" | "drop";

type TriagedTask = {
  task: Task;
  action: TriageAction;
  newDate?: string;
};

const STEPS = [
  "Review Overdue",
  "Carry Over",
  "Review Calendar",
  "Pick Focus",
  "Estimate Time",
  "Capacity Check",
  "Set Intention",
] as const;

type Step = (typeof STEPS)[number];

export function MorningRitual({
  tasks,
  workspaces,
  settings,
  calendarEvents = [],
  onComplete,
  onCancel,
}: MorningRitualProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [triagedOverdue, setTriagedOverdue] = useState<Map<string, TriagedTask>>(new Map());
  const [triagedCarryover, setTriagedCarryover] = useState<Map<string, TriagedTask>>(new Map());
  const [focusIds, setFocusIds] = useState<Set<string>>(new Set());
  const [estimates, setEstimates] = useState<Map<string, number>>(new Map());
  const [intention, setIntention] = useState("");
  const [saving, setSaving] = useState(false);
  const [addedBacklogIds, setAddedBacklogIds] = useState<Set<string>>(new Set());
  const [showBacklog, setShowBacklog] = useState(false);

  const td = todayStr();
  const workspaceMap = Object.fromEntries(workspaces.map((w) => [w.id, w]));

  // Categorize tasks
  const overdueTasks = useMemo(
    () => tasks.filter((t) => t.due_date && t.due_date < td && t.status !== "done"),
    [tasks, td]
  );

  const yesterdayCarryover = useMemo(
    () =>
      tasks.filter(
        (t) =>
          t.status !== "done" &&
          t.planned_date &&
          t.planned_date < td &&
          !(t.due_date && t.due_date < td) // not already in overdue
      ),
    [tasks, td]
  );

  // Backlog tasks (no planned_date, not overdue, not done)
  const backlogTasks = useMemo(
    () =>
      tasks.filter(
        (t) =>
          t.status !== "done" &&
          !t.planned_date &&
          !(t.due_date && t.due_date < td)
      ),
    [tasks, td]
  );

  // Tasks that will be planned for today after triage
  const todayTasks = useMemo(() => {
    const plannable: Task[] = [];

    // Tasks already planned for today
    tasks
      .filter((t) => t.planned_date === td && t.status !== "done")
      .forEach((t) => plannable.push(t));

    // Triaged overdue → today
    triagedOverdue.forEach(({ task, action }) => {
      if (action === "today" && !plannable.find((p) => p.id === task.id)) {
        plannable.push(task);
      }
    });

    // Triaged carryover → today
    triagedCarryover.forEach(({ task, action }) => {
      if (action === "today" && !plannable.find((p) => p.id === task.id)) {
        plannable.push(task);
      }
    });

    // Added from backlog
    addedBacklogIds.forEach((id) => {
      const task = tasks.find((t) => t.id === id);
      if (task && !plannable.find((p) => p.id === id)) {
        plannable.push(task);
      }
    });

    return plannable;
  }, [tasks, td, triagedOverdue, triagedCarryover, addedBacklogIds]);

  const step = STEPS[currentStep];

  const canProceed = () => {
    if (step === "Review Overdue") return triagedOverdue.size >= overdueTasks.length;
    if (step === "Carry Over") return triagedCarryover.size >= yesterdayCarryover.length;
    return true;
  };

  const todayEvents = useMemo(
    () => calendarEvents.filter((e) => !e.all_day && e.status !== "cancelled"),
    [calendarEvents]
  );

  const meetingMinutes = useMemo(
    () =>
      todayEvents.reduce(
        (sum, e) =>
          sum +
          Math.max(
            0,
            (new Date(e.end_time).getTime() - new Date(e.start_time).getTime()) / 60000
          ),
        0
      ),
    [todayEvents]
  );

  const shouldSkipStep = (idx: number) => {
    if (idx === 0 && overdueTasks.length === 0) return true;
    if (idx === 1 && yesterdayCarryover.length === 0) return true;
    if (idx === 2 && todayEvents.length === 0) return true;
    return false;
  };

  const nextStep = () => {
    let next = currentStep + 1;
    while (next < STEPS.length && shouldSkipStep(next)) next++;
    if (next >= STEPS.length) return;
    setCurrentStep(next);
  };

  const prevStep = () => {
    let prev = currentStep - 1;
    while (prev >= 0 && shouldSkipStep(prev)) prev--;
    if (prev < 0) return;
    setCurrentStep(prev);
  };

  // Figure out starting step
  useMemo(() => {
    let start = 0;
    while (start < STEPS.length && shouldSkipStep(start)) start++;
    setCurrentStep(start);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleTriageOverdue = (task: Task, action: TriageAction, newDate?: string) => {
    setTriagedOverdue((prev) => {
      const next = new Map(prev);
      next.set(task.id, { task, action, newDate });
      return next;
    });
  };

  const handleTriageCarryover = (task: Task, action: TriageAction, newDate?: string) => {
    setTriagedCarryover((prev) => {
      const next = new Map(prev);
      next.set(task.id, { task, action, newDate });
      return next;
    });
  };

  const toggleFocus = (taskId: string) => {
    setFocusIds((prev) => {
      const next = new Set(prev);
      if (next.has(taskId)) {
        next.delete(taskId);
      } else if (next.size < 3) {
        next.add(taskId);
      }
      return next;
    });
  };

  const setEstimate = (taskId: string, minutes: number) => {
    setEstimates((prev) => {
      const next = new Map(prev);
      if (next.get(taskId) === minutes) {
        next.delete(taskId);
      } else {
        next.set(taskId, minutes);
      }
      return next;
    });
  };

  const handleFinish = async () => {
    setSaving(true);

    // Process triaged overdue tasks
    for (const [, { task, action, newDate }] of triagedOverdue) {
      if (action === "today") {
        await supabase
          .from("tasks")
          .update({ planned_date: td })
          .eq("id", task.id);
      } else if (action === "reschedule" && newDate) {
        await supabase
          .from("tasks")
          .update({ due_date: newDate, planned_date: newDate })
          .eq("id", task.id);
      } else if (action === "drop") {
        await supabase
          .from("tasks")
          .update({ status: "done", completed_at: new Date().toISOString() })
          .eq("id", task.id);
      }
    }

    // Process triaged carryover tasks
    for (const [, { task, action, newDate }] of triagedCarryover) {
      if (action === "today") {
        await supabase
          .from("tasks")
          .update({ planned_date: td })
          .eq("id", task.id);
      } else if (action === "reschedule" && newDate) {
        await supabase
          .from("tasks")
          .update({ planned_date: newDate })
          .eq("id", task.id);
      } else if (action === "drop") {
        await supabase
          .from("tasks")
          .update({ planned_date: null })
          .eq("id", task.id);
      }
    }

    // Set focus and estimates on today's tasks
    for (const task of todayTasks) {
      const updates: Record<string, unknown> = {};
      updates.is_focus = focusIds.has(task.id);
      const est = estimates.get(task.id);
      if (est !== undefined) updates.estimated_minutes = est;
      updates.planned_date = td;

      await supabase.from("tasks").update(updates).eq("id", task.id);
    }

    // Save settings
    const userId = await getUserId();
    if (userId) {
      await supabase.from("user_settings").upsert(
        {
          user_id: userId,
          planning_completed_date: td,
          daily_intention: intention || null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id" }
      );
    }

    setSaving(false);
    onComplete();
  };

  const capacityWithEstimates = useMemo(() => {
    // Merge estimates into tasks for capacity calc
    const mergedTasks = todayTasks.map((t) => ({
      ...t,
      estimated_minutes: estimates.get(t.id) ?? t.estimated_minutes,
      planned_date: td,
    }));
    // Include all other tasks too
    const otherTasks = tasks.filter((t) => !todayTasks.find((tt) => tt.id === t.id));
    return calculateCapacityWithEvents([...mergedTasks, ...otherTasks], calendarEvents, new Date(), settings);
  }, [todayTasks, estimates, tasks, td, settings, calendarEvents]);

  return (
    <div className="min-h-dvh flex flex-col">
      {/* Header */}
      <div className="border-b border-border/50 bg-card/30 sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="size-9 rounded-lg bg-foreground flex items-center justify-center shadow-sm">
              <Sunrise className="h-4.5 w-4.5 text-background" />
            </div>
            <div>
              <h1 className="text-sm font-semibold text-balance">Morning Planning</h1>
              <p className="text-xs text-muted-foreground text-pretty">
                Step {currentStep + 1} of {STEPS.length}
              </p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={onCancel}
            className="text-muted-foreground"
          >
            Skip for now
          </Button>
        </div>
        {/* Progress bar */}
        <div className="h-1 bg-muted/30">
          <div
            className="h-full bg-foreground transition-colors"
            style={{
              width: `${((currentStep + 1) / STEPS.length) * 100}%`,
            }}
          />
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 max-w-2xl mx-auto w-full px-4 py-8 space-y-6">
        {/* Step: Review Overdue */}
        {step === "Review Overdue" && (
          <div className="space-y-6">
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-red-400">
                <AlertCircle className="size-5" />
                <h2 className="text-lg font-semibold text-balance">Review Overdue</h2>
              </div>
              <p className="text-sm text-muted-foreground text-pretty">
                These tasks are past their due date. Decide what to do with each one.
              </p>
            </div>
            <div className="space-y-4">
              {overdueTasks.map((task) => {
                const triage = triagedOverdue.get(task.id);
                return (
                  <TriageCard
                    key={task.id}
                    task={task}
                    workspace={workspaceMap[task.workspace_id]}
                    triage={triage}
                    onAction={(action, date) => handleTriageOverdue(task, action, date)}
                  />
                );
              })}
            </div>
          </div>
        )}

        {/* Step: Carry Over */}
        {step === "Carry Over" && (
          <div className="space-y-6">
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-amber-400">
                <CalendarClock className="size-5" />
                <h2 className="text-lg font-semibold text-balance">Yesterday&apos;s Unfinished</h2>
              </div>
              <p className="text-sm text-muted-foreground text-pretty">
                These tasks were planned but not completed. Move them to today, reschedule, or let them go.
              </p>
            </div>
            <div className="space-y-4">
              {yesterdayCarryover.map((task) => {
                const triage = triagedCarryover.get(task.id);
                return (
                  <TriageCard
                    key={task.id}
                    task={task}
                    workspace={workspaceMap[task.workspace_id]}
                    triage={triage}
                    onAction={(action, date) => handleTriageCarryover(task, action, date)}
                  />
                );
              })}
            </div>
          </div>
        )}

        {/* Step: Review Calendar */}
        {step === "Review Calendar" && (
          <div className="space-y-6">
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-blue-400">
                <CalendarClock className="size-5" />
                <h2 className="text-lg font-semibold text-balance">Today&apos;s Calendar</h2>
              </div>
              <p className="text-sm text-muted-foreground text-pretty">
                You have{" "}
                <span className="text-blue-400 font-medium">
                  {formatMinutes(meetingMinutes)}
                </span>{" "}
                of meetings today, leaving{" "}
                <span className="text-foreground font-medium">
                  {formatMinutes(
                    Math.max(
                      0,
                      (settings
                        ? (new Date().getDay() === 0 || new Date().getDay() === 6
                            ? settings.available_hours_weekend
                            : settings.available_hours_weekday) * 60
                        : 480) - meetingMinutes
                    )
                  )}
                </span>{" "}
                for deep work.
              </p>
            </div>
            <div className="space-y-2">
              {todayEvents
                .sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime())
                .map((event) => {
                  const start = new Date(event.start_time);
                  const end = new Date(event.end_time);
                  const durMin = (end.getTime() - start.getTime()) / 60000;
                  return (
                    <div
                      key={event.id}
                      className="flex items-center gap-3 rounded-lg border border-border/30 bg-card/30 px-4 py-3"
                    >
                      <div
                        className="w-0.5 h-8 rounded-full shrink-0"
                        style={{ backgroundColor: event.color || "#3b82f6" }}
                      />
                      <div className="flex-1 min-w-0">
                        <span className="text-sm font-medium">{event.title}</span>
                        <div className="flex items-center gap-2 mt-0.5 text-[11px] text-muted-foreground">
                          <span className="tabular-nums">
                            {start.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
                            {" – "}
                            {end.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
                          </span>
                          <span className="text-muted-foreground/50">
                            {formatMinutes(durMin)}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>
        )}

        {/* Step: Pick Focus */}
        {step === "Pick Focus" && (
          <div className="space-y-6">
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-indigo-400">
                <Star className="size-5" />
                <h2 className="text-lg font-semibold text-balance">Pick Your Focus</h2>
              </div>
              <p className="text-sm text-muted-foreground text-pretty">
                Choose up to 3 tasks as today&apos;s priorities. These will be highlighted at the top of your day.
              </p>
            </div>
            {todayTasks.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-sm text-muted-foreground text-pretty">
                  No tasks planned for today yet. You can add tasks after planning.
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {todayTasks.map((task) => (
                  <button
                    key={task.id}
                    onClick={() => toggleFocus(task.id)}
                    className={cn(
                      "w-full flex items-center gap-3 rounded-lg border p-4 text-left transition-colors",
                      focusIds.has(task.id)
                        ? "border-indigo-500/30 bg-indigo-500/5 ring-1 ring-indigo-500/10"
                        : "border-border/50 bg-card/50 hover:bg-card hover:border-border"
                    )}
                  >
                    <div
                      className={cn(
                        "size-6 rounded-full border-2 flex items-center justify-center transition-colors",
                        focusIds.has(task.id)
                          ? "border-indigo-500 bg-indigo-500"
                          : "border-muted-foreground/30"
                      )}
                    >
                      {focusIds.has(task.id) && (
                        <Star className="size-3 text-white fill-white" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <span className="text-sm font-medium">{task.title}</span>
                      {workspaceMap[task.workspace_id] && (
                        <span className="ml-2 text-xs text-muted-foreground">
                          {workspaceMap[task.workspace_id].name}
                        </span>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            )}
            <p className="text-xs text-muted-foreground text-center text-pretty">
              {focusIds.size}/3 selected
            </p>

            {/* Add from backlog */}
            {backlogTasks.filter((t) => !addedBacklogIds.has(t.id)).length > 0 && (
              <div className="pt-4 border-t border-border/30 space-y-3">
                <button
                  onClick={() => setShowBacklog(!showBacklog)}
                  className="flex items-center gap-2 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
                >
                  <ArrowRight className={cn("size-3 transition-transform", showBacklog && "rotate-90")} />
                  Pull from backlog ({backlogTasks.filter((t) => !addedBacklogIds.has(t.id)).length} tasks)
                </button>
                {showBacklog && (
                  <div className="space-y-2 max-h-[300px] overflow-y-auto">
                    {backlogTasks
                      .filter((t) => !addedBacklogIds.has(t.id))
                      .map((task) => (
                        <button
                          key={task.id}
                          onClick={() => {
                            setAddedBacklogIds((prev) => new Set([...prev, task.id]));
                          }}
                          className="w-full flex items-center gap-3 rounded-lg border border-border/50 bg-card/30 p-3 text-left hover:bg-card hover:border-border transition-colors"
                        >
                          <div className="size-5 rounded border border-dashed border-muted-foreground/30 flex items-center justify-center">
                            <ArrowRight className="size-3 text-muted-foreground/50" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <span className="text-sm">{task.title}</span>
                            {workspaceMap[task.workspace_id] && (
                              <span className="ml-2 text-xs text-muted-foreground">
                                {workspaceMap[task.workspace_id].name}
                              </span>
                            )}
                          </div>
                        </button>
                      ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Step: Estimate Time */}
        {step === "Estimate Time" && (
          <div className="space-y-6">
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-emerald-400">
                <Clock className="size-5" />
                <h2 className="text-lg font-semibold text-balance">Estimate Time</h2>
              </div>
              <p className="text-sm text-muted-foreground text-pretty">
                How long will each task take? This helps you avoid overcommitting.
              </p>
            </div>
            {todayTasks.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-sm text-muted-foreground text-pretty">
                  No tasks to estimate.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {todayTasks.map((task) => {
                  const est = estimates.get(task.id) ?? task.estimated_minutes;
                  return (
                    <div
                      key={task.id}
                      className="rounded-lg border border-border/50 bg-card/50 p-4 space-y-3"
                    >
                      <div className="flex items-center gap-2">
                        {focusIds.has(task.id) && (
                          <Star className="h-3.5 w-3.5 text-indigo-400 fill-indigo-400" />
                        )}
                        <span className="text-sm font-medium">{task.title}</span>
                      </div>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {ESTIMATE_PRESETS.map((preset) => (
                          <button
                            key={preset.value}
                            type="button"
                            onClick={() => setEstimate(task.id, preset.value)}
                            className={cn(
                              "px-3 py-1.5 rounded-lg text-xs font-medium transition-colors",
                              est === preset.value
                                ? "bg-primary text-primary-foreground shadow-sm"
                                : "bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground"
                            )}
                          >
                            {preset.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Step: Capacity Check */}
        {step === "Capacity Check" && (
          <div className="space-y-6">
            <div className="space-y-2">
              <h2 className="text-lg font-semibold text-balance">Capacity Check</h2>
              <p className="text-sm text-muted-foreground text-pretty">
                Here&apos;s how your day looks based on your estimates.
              </p>
            </div>
            <CapacityBar capacity={capacityWithEstimates} />
            {capacityWithEstimates.level === "red" && (
              <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-4">
                <p className="text-sm text-amber-400 text-pretty">
                  You&apos;re overbooked. Consider moving some tasks to another day or reducing your estimates. It&apos;s better to finish 3 things well than start 8.
                </p>
              </div>
            )}
            <div className="space-y-2">
              <h3 className="text-xs font-medium text-muted-foreground uppercase">
                Today&apos;s Plan ({todayTasks.length} tasks)
              </h3>
              {todayTasks.map((task) => {
                const est = estimates.get(task.id) ?? task.estimated_minutes;
                return (
                  <div
                    key={task.id}
                    className={cn(
                      "flex items-center gap-3 rounded-lg border border-border/30 bg-card/30 px-4 py-3",
                      focusIds.has(task.id) && "border-indigo-500/20 bg-indigo-500/5"
                    )}
                  >
                    {focusIds.has(task.id) && (
                      <Star className="h-3.5 w-3.5 text-indigo-400 fill-indigo-400 shrink-0" />
                    )}
                    <span className="text-sm flex-1">{task.title}</span>
                    {est && (
                      <span className="text-xs text-muted-foreground flex items-center gap-1">
                        <Clock className="size-3" />
                        {formatMinutes(est)}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Step: Set Intention */}
        {step === "Set Intention" && (
          <div className="space-y-6">
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-purple-400">
                <Sparkles className="size-5" />
                <h2 className="text-lg font-semibold text-balance">Set Your Intention</h2>
              </div>
              <p className="text-sm text-muted-foreground text-pretty">
                In one sentence — what does a great day look like?
              </p>
            </div>
            <Input
              autoFocus
              value={intention}
              onChange={(e) => setIntention(e.target.value)}
              placeholder="e.g., Finish the proposal and take a real lunch break"
              className="bg-background/50 border-border/50 rounded-lg h-12 text-sm focus-visible:ring-primary/50"
            />
            <div className="rounded-lg border border-border/50 bg-card/30 p-5 space-y-3">
              <h3 className="text-sm font-semibold">Your day at a glance</h3>
              <div className="grid grid-cols-3 gap-4 text-center">
                <div>
                  <p className="text-2xl font-bold">{todayTasks.length}</p>
                  <p className="text-xs text-muted-foreground text-pretty">Tasks</p>
                </div>
                <div>
                  <p className="text-2xl font-bold">{focusIds.size}</p>
                  <p className="text-xs text-muted-foreground text-pretty">Focus</p>
                </div>
                <div>
                  <p className="text-2xl font-bold">
                    {formatMinutes(capacityWithEstimates.estimatedMinutes)}
                  </p>
                  <p className="text-xs text-muted-foreground text-pretty">Estimated</p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Navigation footer */}
      <div className="border-t border-border/50 bg-card/30 sticky bottom-0">
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center justify-between">
          <Button
            variant="ghost"
            size="sm"
            onClick={prevStep}
            disabled={(() => {
              let prev = currentStep - 1;
              while (prev >= 0 && shouldSkipStep(prev)) prev--;
              return prev < 0;
            })()}
            className="gap-2"
          >
            <ArrowLeft className="size-4" />
            Back
          </Button>

          {step === "Set Intention" ? (
            <Button
              onClick={handleFinish}
              disabled={saving}
              className="gap-2 bg-foreground hover:bg-foreground/90 text-background border-0 rounded-lg shadow-sm"
              size="sm"
            >
              {saving ? (
                "Saving..."
              ) : (
                <>
                  <Check className="size-4" />
                  Start My Day
                </>
              )}
            </Button>
          ) : (
            <Button
              onClick={nextStep}
              disabled={!canProceed()}
              className="gap-2 bg-foreground hover:bg-foreground/90 text-background border-0 rounded-lg shadow-sm"
              size="sm"
            >
              Continue
              <ArrowRight className="size-4" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Triage Card Component ──

function TriageCard({
  task,
  workspace,
  triage,
  onAction,
}: {
  task: Task;
  workspace?: Workspace;
  triage?: TriagedTask;
  onAction: (action: TriageAction, date?: string) => void;
}) {
  const [showDatePicker, setShowDatePicker] = useState(false);

  return (
    <div
      className={cn(
        "rounded-lg border bg-card/50 p-4 space-y-3 transition-colors",
        triage?.action === "today" && "border-emerald-500/30 bg-emerald-500/5",
        triage?.action === "reschedule" && "border-amber-500/30 bg-amber-500/5",
        triage?.action === "drop" && "border-muted opacity-50",
        !triage && "border-border/50"
      )}
    >
      <div className="flex items-start gap-3">
        <div className="flex-1">
          <span className="text-sm font-medium">{task.title}</span>
          <div className="flex items-center gap-2 mt-1">
            {workspace && (
              <span className="text-[11px] text-muted-foreground">
                {workspace.name}
              </span>
            )}
            {task.due_date && (
              <span className="text-[11px] text-red-400">
                Due {new Date(task.due_date + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })}
              </span>
            )}
          </div>
        </div>
      </div>
      <div className="flex gap-2 flex-wrap">
        <button
          onClick={() => onAction("today")}
          className={cn(
            "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors",
            triage?.action === "today"
              ? "bg-emerald-500 text-white"
              : "bg-muted/50 text-muted-foreground hover:bg-emerald-500/20 hover:text-emerald-400"
          )}
        >
          <Checkbox
            checked={triage?.action === "today"}
            className="size-3 border-current data-[state=checked]:bg-transparent data-[state=checked]:border-current"
          />
          Do Today
        </button>
        <button
          onClick={() => {
            if (triage?.action === "reschedule") {
              setShowDatePicker(!showDatePicker);
            } else {
              setShowDatePicker(true);
              onAction("reschedule");
            }
          }}
          className={cn(
            "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors",
            triage?.action === "reschedule"
              ? "bg-amber-500 text-white"
              : "bg-muted/50 text-muted-foreground hover:bg-amber-500/20 hover:text-amber-400"
          )}
        >
          <CalendarClock className="size-3" />
          Reschedule
        </button>
        <button
          onClick={() => {
            setShowDatePicker(false);
            onAction("drop");
          }}
          className={cn(
            "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors",
            triage?.action === "drop"
              ? "bg-muted text-foreground"
              : "bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground"
          )}
        >
          <Trash2 className="size-3" />
          Drop
        </button>
      </div>
      {showDatePicker && triage?.action === "reschedule" && (
        <Input
          type="date"
          autoFocus
          min={localDateString()}
          onChange={(e) => onAction("reschedule", e.target.value)}
          className="w-[180px] bg-background/50 border-border/50 rounded-lg h-9 text-xs"
        />
      )}
    </div>
  );
}
