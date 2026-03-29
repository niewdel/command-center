"use client";

import { useState, useMemo } from "react";
import { supabase } from "@/lib/supabase";
import { Task, Workspace, UserSettings } from "@/types/database";
import { formatMinutes } from "@/lib/capacity";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  ArrowRight,
  ArrowLeft,
  CalendarClock,
  Check,
  Moon,
  PartyPopper,
  Sparkles,
  Trash2,
  Plus,
} from "lucide-react";

type ShutdownRitualProps = {
  tasks: Task[];
  workspaces: Workspace[];
  settings: UserSettings | null;
  onComplete: () => void;
  onCancel: () => void;
};

const todayStr = () => new Date().toISOString().split("T")[0];

type CarryAction = "tomorrow" | "reschedule" | "drop";

const STEPS = ["Celebrate", "Process Incomplete", "Loose Ends", "Daily Highlight"] as const;

export function ShutdownRitual({
  tasks,
  workspaces,
  settings,
  onComplete,
  onCancel,
}: ShutdownRitualProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [carryActions, setCarryActions] = useState<Map<string, { action: CarryAction; date?: string }>>(new Map());
  const [looseEnds, setLooseEnds] = useState<{ title: string; workspace_id: string }[]>([]);
  const [newLooseEnd, setNewLooseEnd] = useState("");
  const [highlight, setHighlight] = useState("");
  const [saving, setSaving] = useState(false);

  const td = todayStr();
  const tomorrowStr = new Date(Date.now() + 86400000).toISOString().split("T")[0];
  const workspaceMap = Object.fromEntries(workspaces.map((w) => [w.id, w]));

  const completedToday = useMemo(
    () =>
      tasks.filter(
        (t) => t.status === "done" && t.completed_at && t.completed_at.split("T")[0] === td
      ),
    [tasks, td]
  );

  const incompleteToday = useMemo(
    () => tasks.filter((t) => t.planned_date === td && t.status !== "done"),
    [tasks, td]
  );

  const totalEstimated = completedToday.reduce((sum, t) => sum + (t.estimated_minutes || 0), 0);
  const step = STEPS[currentStep];

  const setCarryAction = (taskId: string, action: CarryAction, date?: string) => {
    setCarryActions((prev) => {
      const next = new Map(prev);
      next.set(taskId, { action, date });
      return next;
    });
  };

  const addLooseEnd = () => {
    if (!newLooseEnd.trim()) return;
    setLooseEnds((prev) => [
      ...prev,
      { title: newLooseEnd.trim(), workspace_id: workspaces[0]?.id || "" },
    ]);
    setNewLooseEnd("");
  };

  const handleFinish = async () => {
    setSaving(true);

    // Process incomplete tasks
    for (const [taskId, { action, date }] of carryActions) {
      if (action === "tomorrow") {
        await supabase
          .from("tasks")
          .update({ planned_date: tomorrowStr, is_focus: false })
          .eq("id", taskId);
      } else if (action === "reschedule" && date) {
        await supabase
          .from("tasks")
          .update({ planned_date: date, is_focus: false })
          .eq("id", taskId);
      } else if (action === "drop") {
        await supabase
          .from("tasks")
          .update({ planned_date: null, is_focus: false })
          .eq("id", taskId);
      }
    }

    // Create loose end tasks
    for (const le of looseEnds) {
      await supabase.from("tasks").insert({
        title: le.title,
        workspace_id: le.workspace_id,
        planned_date: tomorrowStr,
        status: "todo",
        source: "manual",
      });
    }

    // Save shutdown completion
    const { data: user } = await supabase.auth.getUser();
    if (user?.user) {
      await supabase.from("user_settings").upsert(
        {
          user_id: user.user.id,
          shutdown_completed_date: td,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id" }
      );
    }

    setSaving(false);
    onComplete();
  };

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <div className="border-b border-border/50 bg-card/30 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-violet-500 to-indigo-700 flex items-center justify-center shadow-lg shadow-violet-500/25">
              <Moon className="h-4.5 w-4.5 text-white" />
            </div>
            <div>
              <h1 className="text-sm font-semibold">Evening Shutdown</h1>
              <p className="text-xs text-muted-foreground">
                Step {currentStep + 1} of {STEPS.length}
              </p>
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={onCancel} className="text-muted-foreground">
            Skip
          </Button>
        </div>
        <div className="h-1 bg-muted/30">
          <div
            className="h-full bg-gradient-to-r from-violet-500 to-indigo-700 transition-all duration-500"
            style={{ width: `${((currentStep + 1) / STEPS.length) * 100}%` }}
          />
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 max-w-2xl mx-auto w-full px-4 py-8 space-y-6">
        {/* Step: Celebrate */}
        {step === "Celebrate" && (
          <div className="space-y-6">
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-emerald-400">
                <PartyPopper className="h-5 w-5" />
                <h2 className="text-lg font-semibold">Nice Work Today</h2>
              </div>
              <p className="text-sm text-muted-foreground">
                Here&apos;s what you accomplished.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-5 text-center">
                <p className="text-3xl font-bold text-emerald-400">{completedToday.length}</p>
                <p className="text-xs text-muted-foreground mt-1">Tasks completed</p>
              </div>
              {totalEstimated > 0 && (
                <div className="rounded-xl border border-indigo-500/20 bg-indigo-500/5 p-5 text-center">
                  <p className="text-3xl font-bold text-indigo-400">
                    {formatMinutes(totalEstimated)}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">Estimated time completed</p>
                </div>
              )}
            </div>
            {completedToday.length > 0 && (
              <div className="space-y-2">
                {completedToday.map((task) => (
                  <div
                    key={task.id}
                    className="flex items-center gap-3 rounded-lg border border-border/30 bg-card/30 px-4 py-3"
                  >
                    <Check className="h-4 w-4 text-emerald-400 shrink-0" />
                    <span className="text-sm text-muted-foreground line-through">
                      {task.title}
                    </span>
                    {workspaceMap[task.workspace_id] && (
                      <span className="text-[11px] text-muted-foreground/60 ml-auto">
                        {workspaceMap[task.workspace_id].name}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}
            {completedToday.length === 0 && (
              <div className="text-center py-8">
                <p className="text-sm text-muted-foreground">
                  No tasks completed today. That&apos;s okay — every day is different.
                </p>
              </div>
            )}
          </div>
        )}

        {/* Step: Process Incomplete */}
        {step === "Process Incomplete" && (
          <div className="space-y-6">
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-amber-400">
                <CalendarClock className="h-5 w-5" />
                <h2 className="text-lg font-semibold">Process Incomplete</h2>
              </div>
              <p className="text-sm text-muted-foreground">
                {incompleteToday.length > 0
                  ? "These didn't get done today. Move them, reschedule them, or let them go."
                  : "Everything planned for today is done. Clean slate."}
              </p>
            </div>
            <div className="space-y-4">
              {incompleteToday.map((task) => {
                const action = carryActions.get(task.id);
                return (
                  <div
                    key={task.id}
                    className={cn(
                      "rounded-xl border bg-card/50 p-4 space-y-3 transition-all",
                      action?.action === "tomorrow" && "border-emerald-500/30 bg-emerald-500/5",
                      action?.action === "reschedule" && "border-amber-500/30 bg-amber-500/5",
                      action?.action === "drop" && "border-muted opacity-50",
                      !action && "border-border/50"
                    )}
                  >
                    <span className="text-sm font-medium">{task.title}</span>
                    <div className="flex gap-2 flex-wrap">
                      <button
                        onClick={() => setCarryAction(task.id, "tomorrow")}
                        className={cn(
                          "px-3 py-1.5 rounded-lg text-xs font-medium transition-all",
                          action?.action === "tomorrow"
                            ? "bg-emerald-500 text-white"
                            : "bg-muted/50 text-muted-foreground hover:bg-emerald-500/20 hover:text-emerald-400"
                        )}
                      >
                        Tomorrow
                      </button>
                      <button
                        onClick={() => setCarryAction(task.id, "reschedule")}
                        className={cn(
                          "px-3 py-1.5 rounded-lg text-xs font-medium transition-all",
                          action?.action === "reschedule"
                            ? "bg-amber-500 text-white"
                            : "bg-muted/50 text-muted-foreground hover:bg-amber-500/20 hover:text-amber-400"
                        )}
                      >
                        Reschedule
                      </button>
                      <button
                        onClick={() => setCarryAction(task.id, "drop")}
                        className={cn(
                          "px-3 py-1.5 rounded-lg text-xs font-medium transition-all",
                          action?.action === "drop"
                            ? "bg-muted text-foreground"
                            : "bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground"
                        )}
                      >
                        <Trash2 className="h-3 w-3 inline mr-1" />
                        Drop
                      </button>
                    </div>
                    {action?.action === "reschedule" && (
                      <Input
                        type="date"
                        min={tomorrowStr}
                        onChange={(e) => setCarryAction(task.id, "reschedule", e.target.value)}
                        className="w-[180px] bg-background/50 border-border/50 rounded-lg h-9 text-xs"
                      />
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Step: Loose Ends */}
        {step === "Loose Ends" && (
          <div className="space-y-6">
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-blue-400">
                <Plus className="h-5 w-5" />
                <h2 className="text-lg font-semibold">Capture Loose Ends</h2>
              </div>
              <p className="text-sm text-muted-foreground">
                Anything on your mind? Dump it here so you can stop thinking about it. These will land on tomorrow&apos;s plan.
              </p>
            </div>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                addLooseEnd();
              }}
              className="flex gap-2"
            >
              <Input
                autoFocus
                value={newLooseEnd}
                onChange={(e) => setNewLooseEnd(e.target.value)}
                placeholder="What's on your mind?"
                className="bg-background/50 border-border/50 rounded-lg h-10 text-sm flex-1"
              />
              <Button
                type="submit"
                disabled={!newLooseEnd.trim()}
                size="sm"
                className="rounded-lg h-10 px-4 bg-gradient-to-r from-indigo-500 to-purple-600 text-white border-0"
              >
                Add
              </Button>
            </form>
            {looseEnds.length > 0 && (
              <div className="space-y-2">
                {looseEnds.map((le, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-3 rounded-lg border border-border/30 bg-card/30 px-4 py-3"
                  >
                    <span className="text-sm flex-1">{le.title}</span>
                    <button
                      onClick={() => setLooseEnds((prev) => prev.filter((_, j) => j !== i))}
                      className="text-muted-foreground hover:text-red-400 transition-colors"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Step: Daily Highlight */}
        {step === "Daily Highlight" && (
          <div className="space-y-6">
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-purple-400">
                <Sparkles className="h-5 w-5" />
                <h2 className="text-lg font-semibold">Daily Highlight</h2>
              </div>
              <p className="text-sm text-muted-foreground">
                What&apos;s one thing from today you&apos;re most proud of? (Optional)
              </p>
            </div>
            <Input
              autoFocus
              value={highlight}
              onChange={(e) => setHighlight(e.target.value)}
              placeholder="e.g., Finally shipped the proposal"
              className="bg-background/50 border-border/50 rounded-xl h-12 text-sm"
            />
            <div className="rounded-xl border border-border/50 bg-card/30 p-5 space-y-3">
              <h3 className="text-sm font-semibold">Day Summary</h3>
              <div className="grid grid-cols-3 gap-4 text-center">
                <div>
                  <p className="text-2xl font-bold text-emerald-400">{completedToday.length}</p>
                  <p className="text-xs text-muted-foreground">Completed</p>
                </div>
                <div>
                  <p className="text-2xl font-bold text-amber-400">{incompleteToday.length}</p>
                  <p className="text-xs text-muted-foreground">Carried Over</p>
                </div>
                <div>
                  <p className="text-2xl font-bold text-blue-400">{looseEnds.length}</p>
                  <p className="text-xs text-muted-foreground">New for Tomorrow</p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Navigation */}
      <div className="border-t border-border/50 bg-card/30 backdrop-blur-sm sticky bottom-0">
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center justify-between">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setCurrentStep((s) => Math.max(0, s - 1))}
            disabled={currentStep === 0}
            className="gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </Button>
          {currentStep === STEPS.length - 1 ? (
            <Button
              onClick={handleFinish}
              disabled={saving}
              className="gap-2 bg-gradient-to-r from-violet-500 to-indigo-700 hover:from-violet-600 hover:to-indigo-800 text-white border-0 rounded-xl shadow-lg shadow-violet-500/25"
              size="sm"
            >
              {saving ? "Saving..." : (
                <>
                  <Moon className="h-4 w-4" />
                  Close My Day
                </>
              )}
            </Button>
          ) : (
            <Button
              onClick={() => setCurrentStep((s) => Math.min(STEPS.length - 1, s + 1))}
              className="gap-2 bg-gradient-to-r from-violet-500 to-indigo-700 hover:from-violet-600 hover:to-indigo-800 text-white border-0 rounded-xl shadow-lg shadow-violet-500/25"
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
