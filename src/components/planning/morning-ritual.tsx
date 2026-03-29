"use client";

import { useState, useMemo } from "react";
import { supabase } from "@/lib/supabase";
import { Task, Workspace, UserSettings } from "@/types/database";
import { calculateCapacity, formatMinutes, ESTIMATE_PRESETS } from "@/lib/capacity";
import { CapacityBar } from "@/components/dashboard/capacity-bar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
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
  onComplete: () => void;
  onCancel: () => void;
};

const todayStr = () => new Date().toISOString().split("T")[0];

type TriageAction = "today" | "reschedule" | "drop";

type TriagedTask = {
  task: Task;
  action: TriageAction;
  newDate?: string;
};

const STEPS = [
  "Review Overdue",
  "Carry Over",
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

    return plannable;
  }, [tasks, td, triagedOverdue, triagedCarryover]);

  const step = STEPS[currentStep];

  const canProceed = () => {
    if (step === "Review Overdue") return triagedOverdue.size >= overdueTasks.length;
    if (step === "Carry Over") return triagedCarryover.size >= yesterdayCarryover.length;
    return true;
  };

  const nextStep = () => {
    // Skip steps that don't apply
    let next = currentStep + 1;
    if (next === 0 && overdueTasks.length === 0) next++;
    if (next === 1 && yesterdayCarryover.length === 0) next++;
    if (next >= STEPS.length) return;
    setCurrentStep(next);
  };

  const prevStep = () => {
    let prev = currentStep - 1;
    if (prev === 1 && yesterdayCarryover.length === 0) prev--;
    if (prev === 0 && overdueTasks.length === 0) prev--;
    if (prev < 0) return;
    setCurrentStep(prev);
  };

  // Figure out starting step
  useMemo(() => {
    let start = 0;
    if (overdueTasks.length === 0) start = 1;
    if (start === 1 && yesterdayCarryover.length === 0) start = 2;
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
    const { data: user } = await supabase.auth.getUser();
    if (user?.user) {
      await supabase.from("user_settings").upsert(
        {
          user_id: user.user.id,
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
    return calculateCapacity([...mergedTasks, ...otherTasks], new Date(), settings);
  }, [todayTasks, estimates, tasks, td, settings]);

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <div className="border-b border-border/50 bg-card/30 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/25">
              <Sunrise className="h-4.5 w-4.5 text-white" />
            </div>
            <div>
              <h1 className="text-sm font-semibold">Morning Planning</h1>
              <p className="text-xs text-muted-foreground">
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
            className="h-full bg-gradient-to-r from-indigo-500 to-purple-600 transition-all duration-500"
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
                <AlertCircle className="h-5 w-5" />
                <h2 className="text-lg font-semibold">Review Overdue</h2>
              </div>
              <p className="text-sm text-muted-foreground">
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
                <CalendarClock className="h-5 w-5" />
                <h2 className="text-lg font-semibold">Yesterday&apos;s Unfinished</h2>
              </div>
              <p className="text-sm text-muted-foreground">
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

        {/* Step: Pick Focus */}
        {step === "Pick Focus" && (
          <div className="space-y-6">
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-indigo-400">
                <Star className="h-5 w-5" />
                <h2 className="text-lg font-semibold">Pick Your Focus</h2>
              </div>
              <p className="text-sm text-muted-foreground">
                Choose up to 3 tasks as today&apos;s priorities. These will be highlighted at the top of your day.
              </p>
            </div>
            {todayTasks.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-sm text-muted-foreground">
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
                      "w-full flex items-center gap-3 rounded-xl border p-4 text-left transition-all duration-200",
                      focusIds.has(task.id)
                        ? "border-indigo-500/30 bg-indigo-500/5 ring-1 ring-indigo-500/10"
                        : "border-border/50 bg-card/50 hover:bg-card hover:border-border"
                    )}
                  >
                    <div
                      className={cn(
                        "h-6 w-6 rounded-full border-2 flex items-center justify-center transition-all",
                        focusIds.has(task.id)
                          ? "border-indigo-500 bg-indigo-500"
                          : "border-muted-foreground/30"
                      )}
                    >
                      {focusIds.has(task.id) && (
                        <Star className="h-3 w-3 text-white fill-white" />
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
            <p className="text-xs text-muted-foreground text-center">
              {focusIds.size}/3 selected
            </p>
          </div>
        )}

        {/* Step: Estimate Time */}
        {step === "Estimate Time" && (
          <div className="space-y-6">
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-emerald-400">
                <Clock className="h-5 w-5" />
                <h2 className="text-lg font-semibold">Estimate Time</h2>
              </div>
              <p className="text-sm text-muted-foreground">
                How long will each task take? This helps you avoid overcommitting.
              </p>
            </div>
            {todayTasks.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-sm text-muted-foreground">
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
                      className="rounded-xl border border-border/50 bg-card/50 p-4 space-y-3"
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
                              "px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-200",
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
              <h2 className="text-lg font-semibold">Capacity Check</h2>
              <p className="text-sm text-muted-foreground">
                Here&apos;s how your day looks based on your estimates.
              </p>
            </div>
            <CapacityBar capacity={capacityWithEstimates} />
            {capacityWithEstimates.level === "red" && (
              <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4">
                <p className="text-sm text-amber-400">
                  You&apos;re overbooked. Consider moving some tasks to another day or reducing your estimates. It&apos;s better to finish 3 things well than start 8.
                </p>
              </div>
            )}
            <div className="space-y-2">
              <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-widest">
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
                        <Clock className="h-3 w-3" />
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
                <Sparkles className="h-5 w-5" />
                <h2 className="text-lg font-semibold">Set Your Intention</h2>
              </div>
              <p className="text-sm text-muted-foreground">
                In one sentence — what does a great day look like?
              </p>
            </div>
            <Input
              autoFocus
              value={intention}
              onChange={(e) => setIntention(e.target.value)}
              placeholder="e.g., Finish the proposal and take a real lunch break"
              className="bg-background/50 border-border/50 rounded-xl h-12 text-sm focus-visible:ring-primary/50"
            />
            <div className="rounded-xl border border-border/50 bg-card/30 p-5 space-y-3">
              <h3 className="text-sm font-semibold">Your day at a glance</h3>
              <div className="grid grid-cols-3 gap-4 text-center">
                <div>
                  <p className="text-2xl font-bold">{todayTasks.length}</p>
                  <p className="text-xs text-muted-foreground">Tasks</p>
                </div>
                <div>
                  <p className="text-2xl font-bold">{focusIds.size}</p>
                  <p className="text-xs text-muted-foreground">Focus</p>
                </div>
                <div>
                  <p className="text-2xl font-bold">
                    {formatMinutes(capacityWithEstimates.estimatedMinutes)}
                  </p>
                  <p className="text-xs text-muted-foreground">Estimated</p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Navigation footer */}
      <div className="border-t border-border/50 bg-card/30 backdrop-blur-sm sticky bottom-0">
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center justify-between">
          <Button
            variant="ghost"
            size="sm"
            onClick={prevStep}
            disabled={currentStep === 0 || (currentStep === 1 && overdueTasks.length === 0)}
            className="gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </Button>

          {step === "Set Intention" ? (
            <Button
              onClick={handleFinish}
              disabled={saving}
              className="gap-2 bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white border-0 rounded-xl shadow-lg shadow-indigo-500/25"
              size="sm"
            >
              {saving ? (
                "Saving..."
              ) : (
                <>
                  <Check className="h-4 w-4" />
                  Start My Day
                </>
              )}
            </Button>
          ) : (
            <Button
              onClick={nextStep}
              disabled={!canProceed()}
              className="gap-2 bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white border-0 rounded-xl shadow-lg shadow-indigo-500/25"
              size="sm"
            >
              Continue
              <ArrowRight className="h-4 w-4" />
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
        "rounded-xl border bg-card/50 p-4 space-y-3 transition-all duration-200",
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
                Due {new Date(task.due_date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
              </span>
            )}
          </div>
        </div>
      </div>
      <div className="flex gap-2 flex-wrap">
        <button
          onClick={() => onAction("today")}
          className={cn(
            "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all",
            triage?.action === "today"
              ? "bg-emerald-500 text-white"
              : "bg-muted/50 text-muted-foreground hover:bg-emerald-500/20 hover:text-emerald-400"
          )}
        >
          <Checkbox
            checked={triage?.action === "today"}
            className="h-3 w-3 border-current data-[state=checked]:bg-transparent data-[state=checked]:border-current"
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
            "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all",
            triage?.action === "reschedule"
              ? "bg-amber-500 text-white"
              : "bg-muted/50 text-muted-foreground hover:bg-amber-500/20 hover:text-amber-400"
          )}
        >
          <CalendarClock className="h-3 w-3" />
          Reschedule
        </button>
        <button
          onClick={() => {
            setShowDatePicker(false);
            onAction("drop");
          }}
          className={cn(
            "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all",
            triage?.action === "drop"
              ? "bg-muted text-foreground"
              : "bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground"
          )}
        >
          <Trash2 className="h-3 w-3" />
          Drop
        </button>
      </div>
      {showDatePicker && triage?.action === "reschedule" && (
        <Input
          type="date"
          autoFocus
          min={new Date().toISOString().split("T")[0]}
          onChange={(e) => onAction("reschedule", e.target.value)}
          className="w-[180px] bg-background/50 border-border/50 rounded-lg h-9 text-xs"
        />
      )}
    </div>
  );
}
