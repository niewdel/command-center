"use client";

import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { Goal, Workspace, Task } from "@/types/database";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { Target, Plus, CheckCircle2, Pencil, Trash2 } from "lucide-react";

export default function GoalsPage() {
  const [goals, setGoals] = useState<Goal[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [editingGoal, setEditingGoal] = useState<Goal | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    const [{ data: g }, { data: w }, { data: t }] = await Promise.all([
      supabase.from("goals").select("*").order("created_at", { ascending: false }),
      supabase.from("workspaces").select("*").order("name"),
      supabase.from("tasks").select("*").not("goal_id", "is", null),
    ]);
    setGoals(g || []);
    setWorkspaces(w || []);
    setTasks(t || []);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchData();

    const channel = supabase
      .channel("goals-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "goals" }, () => fetchData())
      .on("postgres_changes", { event: "*", schema: "public", table: "tasks" }, () => fetchData())
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchData]);

  const workspaceMap = Object.fromEntries(workspaces.map((w) => [w.id, w]));
  const activeGoals = goals.filter((g) => g.status === "active");
  const completedGoals = goals.filter((g) => g.status === "completed");

  const getGoalProgress = (goalId: string) => {
    const goalTasks = tasks.filter((t) => t.goal_id === goalId);
    if (goalTasks.length === 0) return { total: 0, done: 0, percent: 0 };
    const done = goalTasks.filter((t) => t.status === "done").length;
    return {
      total: goalTasks.length,
      done,
      percent: Math.round((done / goalTasks.length) * 100),
    };
  };

  const handleDelete = async (id: string) => {
    await supabase.from("goals").delete().eq("id", id);
    fetchData();
  };

  const handleComplete = async (id: string) => {
    await supabase.from("goals").update({ status: "completed" }).eq("id", id);
    fetchData();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="flex items-center gap-3 text-muted-foreground">
          <div className="h-5 w-5 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
          <span className="text-sm">Loading...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 max-w-3xl mx-auto space-y-8">
      <div className="pt-10 md:pt-2 flex items-start justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-rose-500 to-pink-600 flex items-center justify-center shadow-lg shadow-rose-500/25">
              <Target className="h-5 w-5 text-white" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight">Goals</h1>
          </div>
          <p className="text-sm text-muted-foreground mt-2">
            What are you working toward? Link tasks to goals to track your progress.
          </p>
        </div>
        <Button
          onClick={() => {
            setEditingGoal(null);
            setShowAdd(true);
          }}
          className="gap-2 bg-gradient-to-r from-rose-500 to-pink-600 hover:from-rose-600 hover:to-pink-700 text-white border-0 rounded-xl shadow-lg shadow-rose-500/25"
          size="sm"
        >
          <Plus className="h-4 w-4" />
          New Goal
        </Button>
      </div>

      {/* Active Goals */}
      {activeGoals.length === 0 && completedGoals.length === 0 && (
        <div className="text-center py-16">
          <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-muted/50 mb-4">
            <Target className="h-7 w-7 text-muted-foreground" />
          </div>
          <p className="text-sm font-medium">No goals yet</p>
          <p className="text-xs text-muted-foreground mt-1">
            Set a goal to connect your daily tasks to what really matters.
          </p>
        </div>
      )}

      {activeGoals.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-xs font-medium text-muted-foreground uppercase tracking-widest">
            Active Goals
          </h2>
          {activeGoals.map((goal) => {
            const progress = getGoalProgress(goal.id);
            const ws = workspaceMap[goal.workspace_id];
            return (
              <div
                key={goal.id}
                className="group rounded-xl border border-border/50 bg-card/50 p-5 space-y-3 hover:bg-card hover:border-border transition-all"
              >
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <h3 className="text-sm font-semibold">{goal.title}</h3>
                    {goal.description && (
                      <p className="text-xs text-muted-foreground">{goal.description}</p>
                    )}
                  </div>
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-all">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 rounded-lg"
                      onClick={() => {
                        setEditingGoal(goal);
                        setShowAdd(true);
                      }}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 rounded-lg text-emerald-400"
                      onClick={() => handleComplete(goal.id)}
                    >
                      <CheckCircle2 className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 rounded-lg text-muted-foreground hover:text-red-400"
                      onClick={() => handleDelete(goal.id)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                  {ws && <span>{ws.name}</span>}
                  {goal.target_date && (
                    <>
                      <span className="text-border">|</span>
                      <span>
                        Target:{" "}
                        {new Date(goal.target_date).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })}
                      </span>
                    </>
                  )}
                </div>
                {progress.total > 0 && (
                  <div className="space-y-1.5">
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>
                        {progress.done}/{progress.total} tasks
                      </span>
                      <span>{progress.percent}%</span>
                    </div>
                    <div className="h-2 rounded-full bg-muted/50 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-rose-500 to-pink-500 transition-all duration-500"
                        style={{ width: `${progress.percent}%` }}
                      />
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {completedGoals.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-xs font-medium text-muted-foreground uppercase tracking-widest">
            Completed
          </h2>
          {completedGoals.map((goal) => (
            <div
              key={goal.id}
              className="rounded-xl border border-border/30 bg-card/30 p-4 opacity-60"
            >
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                <span className="text-sm font-medium line-through">{goal.title}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add/Edit Dialog */}
      <GoalDialog
        goal={editingGoal}
        workspaces={workspaces}
        open={showAdd}
        onClose={() => {
          setShowAdd(false);
          setEditingGoal(null);
        }}
        onSaved={fetchData}
      />
    </div>
  );
}

function GoalDialog({
  goal,
  workspaces,
  open,
  onClose,
  onSaved,
}: {
  goal: Goal | null;
  workspaces: Workspace[];
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [workspaceId, setWorkspaceId] = useState("");
  const [type, setType] = useState<"business" | "personal">("business");
  const [targetDate, setTargetDate] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (goal) {
      setTitle(goal.title);
      setDescription(goal.description || "");
      setWorkspaceId(goal.workspace_id);
      setType(goal.type);
      setTargetDate(goal.target_date || "");
    } else {
      setTitle("");
      setDescription("");
      setWorkspaceId(workspaces[0]?.id || "");
      setType("business");
      setTargetDate("");
    }
  }, [goal, workspaces]);

  const handleSave = async () => {
    if (!title.trim() || !workspaceId) return;
    setSaving(true);

    const data = {
      title: title.trim(),
      description: description || null,
      workspace_id: workspaceId,
      type,
      target_date: targetDate || null,
    };

    if (goal) {
      await supabase.from("goals").update(data).eq("id", goal.id);
    } else {
      await supabase.from("goals").insert({ ...data, status: "active" });
    }

    setSaving(false);
    onClose();
    onSaved();
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[460px] bg-card border-border rounded-2xl shadow-2xl shadow-black/30">
        <DialogHeader>
          <DialogTitle>{goal ? "Edit Goal" : "New Goal"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              What&apos;s the goal?
            </Label>
            <Input
              autoFocus
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g., Launch Command Center on the App Store"
              className="bg-background/50 border-border/50 rounded-lg"
            />
          </div>
          <div className="space-y-2">
            <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Description
            </Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              placeholder="Why does this matter?"
              className="bg-background/50 border-border/50 rounded-lg resize-none"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Workspace
              </Label>
              <Select value={workspaceId} onValueChange={(v) => v && setWorkspaceId(v)}>
                <SelectTrigger className="bg-background/50 border-border/50 rounded-lg">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-popover border-border rounded-xl">
                  {workspaces.map((ws) => (
                    <SelectItem key={ws.id} value={ws.id} className="rounded-lg">
                      {ws.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Type
              </Label>
              <Select value={type} onValueChange={(v) => setType(v as "business" | "personal")}>
                <SelectTrigger className="bg-background/50 border-border/50 rounded-lg">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-popover border-border rounded-xl">
                  <SelectItem value="business" className="rounded-lg">Business</SelectItem>
                  <SelectItem value="personal" className="rounded-lg">Personal</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-2">
            <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Target Date
            </Label>
            <Input
              type="date"
              value={targetDate}
              onChange={(e) => setTargetDate(e.target.value)}
              className="w-[180px] bg-background/50 border-border/50 rounded-lg"
            />
          </div>
        </div>
        <DialogFooter className="gap-2">
          <Button variant="ghost" onClick={onClose} className="rounded-lg">
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={!title.trim() || saving}
            className="bg-gradient-to-r from-rose-500 to-pink-600 hover:from-rose-600 hover:to-pink-700 text-white border-0 rounded-lg shadow-lg shadow-rose-500/25"
          >
            {saving ? "Saving..." : goal ? "Save Changes" : "Create Goal"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
