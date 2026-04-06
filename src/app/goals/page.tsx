"use client";

import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { Goal, Workspace } from "@/types/database";
import { PageLayout } from "@/components/layout/page-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { Target, Plus, Pencil, Trash2, CheckCircle2, Calendar } from "lucide-react";

export default function GoalsPage() {
  const [goals, setGoals] = useState<Goal[]>([]);
  const [tasks, setTasks] = useState<{ id: string; goal_id: string | null; status: string }[]>([]);
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [showDialog, setShowDialog] = useState(false);
  const [editingGoal, setEditingGoal] = useState<Goal | null>(null);
  const [loading, setLoading] = useState(true);

  // Form
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [type, setType] = useState<"business" | "personal">("business");
  const [targetDate, setTargetDate] = useState("");
  const [workspaceId, setWorkspaceId] = useState("");
  const [saving, setSaving] = useState(false);

  const fetchData = useCallback(async () => {
    const [{ data: g }, { data: t }, { data: ws }] = await Promise.all([
      supabase.from("goals").select("*").order("created_at", { ascending: false }),
      supabase.from("tasks").select("id, goal_id, status"),
      supabase.from("workspaces").select("*").order("name"),
    ]);
    setGoals(g || []);
    setTasks(t || []);
    setWorkspaces(ws || []);
    if (!workspaceId && ws && ws.length > 0) setWorkspaceId(ws[0].id);
    setLoading(false);
  }, [workspaceId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const workspaceMap = Object.fromEntries(workspaces.map((w) => [w.id, w]));

  const getProgress = (goalId: string) => {
    const linked = tasks.filter((t) => t.goal_id === goalId);
    if (linked.length === 0) return { total: 0, done: 0, percent: 0 };
    const done = linked.filter((t) => t.status === "done").length;
    return { total: linked.length, done, percent: Math.round((done / linked.length) * 100) };
  };

  const activeGoals = goals.filter((g) => g.status === "active");
  const completedGoals = goals.filter((g) => g.status !== "active");

  const openAdd = () => {
    setEditingGoal(null);
    setTitle("");
    setDescription("");
    setType("business");
    setTargetDate("");
    setWorkspaceId(workspaces[0]?.id || "");
    setShowDialog(true);
  };

  const openEdit = (goal: Goal) => {
    setEditingGoal(goal);
    setTitle(goal.title);
    setDescription(goal.description || "");
    setType(goal.type);
    setTargetDate(goal.target_date || "");
    setWorkspaceId(goal.workspace_id);
    setShowDialog(true);
  };

  const handleSave = async () => {
    if (!title.trim() || !workspaceId) return;
    setSaving(true);

    const data = {
      title: title.trim(),
      description: description.trim() || null,
      type,
      workspace_id: workspaceId,
      target_date: targetDate || null,
    };

    if (editingGoal) {
      await supabase.from("goals").update(data).eq("id", editingGoal.id);
    } else {
      await supabase.from("goals").insert(data);
    }

    setSaving(false);
    setShowDialog(false);
    fetchData();
  };

  const handleDelete = async (id: string) => {
    await supabase.from("goals").delete().eq("id", id);
    fetchData();
  };

  const toggleStatus = async (goal: Goal) => {
    const newStatus = goal.status === "active" ? "completed" : "active";
    await supabase.from("goals").update({ status: newStatus }).eq("id", goal.id);
    fetchData();
  };

  return (
    <PageLayout
      title="Goals"
      icon={Target}
      loading={loading}
      maxWidth="md"
      actions={
        <Button onClick={openAdd} variant="outline" size="sm" className="gap-1.5 h-8">
          <Plus className="size-3.5" />
          Add Goal
        </Button>
      }
    >
      {goals.length === 0 ? (
        <div className="text-center py-16">
          <Target className="size-8 text-muted-foreground/40 mx-auto mb-3" />
          <p className="text-sm text-muted-foreground text-pretty">No goals set yet</p>
          <button onClick={openAdd} className="text-sm text-primary hover:underline mt-1">Set your first goal</button>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Active Goals */}
          {activeGoals.length > 0 && (
            <div className="space-y-3">
              <h2 className="text-xs font-medium text-muted-foreground uppercase">
                Active ({activeGoals.length})
              </h2>
              <div className="space-y-2">
                {activeGoals.map((goal) => {
                  const progress = getProgress(goal.id);
                  const ws = workspaceMap[goal.workspace_id];
                  return (
                    <div
                      key={goal.id}
                      className="group rounded-lg border border-border/50 bg-card/50 p-4 space-y-3 hover:bg-card transition-colors"
                    >
                      <div className="flex items-start gap-3">
                        <button
                          onClick={() => toggleStatus(goal)}
                          className="size-5 rounded border border-border/60 flex items-center justify-center shrink-0 mt-0.5 hover:border-emerald-500/40 transition-colors"
                          aria-label="Mark complete"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <h3 className="text-sm font-semibold">{goal.title}</h3>
                            <span className={cn(
                              "text-[10px] px-1.5 py-0.5 rounded font-medium",
                              goal.type === "business" ? "bg-blue-500/10 text-blue-400" : "bg-violet-500/10 text-violet-400"
                            )}>
                              {goal.type}
                            </span>
                          </div>
                          {goal.description && (
                            <p className="text-xs text-muted-foreground mt-1 text-pretty">{goal.description}</p>
                          )}
                          <div className="flex items-center gap-3 mt-2 text-[11px] text-muted-foreground">
                            {ws && (
                              <span className="flex items-center gap-1">
                                <span
                                  className="size-2 rounded-full"
                                  style={{ backgroundColor: ws.color }}
                                />
                                {ws.name}
                              </span>
                            )}
                            {goal.target_date && (
                              <span className="flex items-center gap-1">
                                <Calendar className="size-2.5" />
                                {new Date(goal.target_date + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button onClick={() => openEdit(goal)} className="p-1.5 rounded text-muted-foreground hover:text-foreground" aria-label="Edit">
                            <Pencil className="size-3" />
                          </button>
                          <button onClick={() => handleDelete(goal.id)} className="p-1.5 rounded text-muted-foreground hover:text-red-400" aria-label="Delete">
                            <Trash2 className="size-3" />
                          </button>
                        </div>
                      </div>

                      {/* Progress bar */}
                      {progress.total > 0 && (
                        <div className="space-y-1">
                          <div className="flex items-center justify-between text-[11px]">
                            <span className="text-muted-foreground">{progress.done}/{progress.total} tasks</span>
                            <span className={cn(
                              "font-medium tabular-nums",
                              progress.percent === 100 ? "text-emerald-400" : "text-foreground"
                            )}>
                              {progress.percent}%
                            </span>
                          </div>
                          <div className="h-1 rounded-full bg-muted/50 overflow-hidden">
                            <div
                              className={cn(
                                "h-full rounded-full transition-all duration-500",
                                progress.percent === 100 ? "bg-emerald-500" : "bg-primary"
                              )}
                              style={{ width: `${progress.percent}%` }}
                            />
                          </div>
                        </div>
                      )}
                      {progress.total === 0 && (
                        <p className="text-[11px] text-muted-foreground/50">No linked tasks yet — assign tasks to this goal from the task editor</p>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Completed Goals */}
          {completedGoals.length > 0 && (
            <div className="space-y-3">
              <h2 className="text-xs font-medium text-muted-foreground uppercase">
                Completed ({completedGoals.length})
              </h2>
              <div className="space-y-2">
                {completedGoals.map((goal) => {
                  const progress = getProgress(goal.id);
                  const ws = workspaceMap[goal.workspace_id];
                  return (
                    <div
                      key={goal.id}
                      className="group rounded-lg border border-border/30 bg-card/20 p-4 opacity-60 hover:opacity-80 transition-opacity"
                    >
                      <div className="flex items-start gap-3">
                        <button
                          onClick={() => toggleStatus(goal)}
                          className="size-5 rounded bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center shrink-0 mt-0.5"
                          aria-label="Mark active"
                        >
                          <CheckCircle2 className="size-3 text-emerald-400" />
                        </button>
                        <div className="flex-1 min-w-0">
                          <h3 className="text-sm font-medium line-through">{goal.title}</h3>
                          <div className="flex items-center gap-2 mt-1 text-[11px] text-muted-foreground">
                            {ws && <span>{ws.name}</span>}
                            {progress.total > 0 && <span>{progress.done}/{progress.total} tasks</span>}
                          </div>
                        </div>
                        <button onClick={() => handleDelete(goal.id)} className="p-1.5 rounded text-muted-foreground hover:text-red-400 opacity-0 group-hover:opacity-100" aria-label="Delete">
                          <Trash2 className="size-3" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Add/Edit Dialog */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="sm:max-w-[420px] max-h-[85dvh] overflow-y-auto bg-card border-border rounded-2xl shadow-md">
          <DialogHeader>
            <DialogTitle>{editingGoal ? "Edit Goal" : "New Goal"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Title</Label>
              <Input autoFocus value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g., Launch SaaS product" className="bg-background/50 border-border/50 rounded-lg" />
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="What does success look like?"
                rows={3}
                className="w-full rounded-lg border border-border/50 bg-background/50 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring resize-none"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Type</Label>
                <div className="flex gap-1">
                  <button onClick={() => setType("business")} className={cn("flex-1 px-3 py-2 rounded-lg text-xs font-medium transition-colors", type === "business" ? "bg-blue-500/15 text-blue-400" : "bg-muted/50 text-muted-foreground hover:text-foreground")}>Business</button>
                  <button onClick={() => setType("personal")} className={cn("flex-1 px-3 py-2 rounded-lg text-xs font-medium transition-colors", type === "personal" ? "bg-violet-500/15 text-violet-400" : "bg-muted/50 text-muted-foreground hover:text-foreground")}>Personal</button>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Target Date</Label>
                <Input type="date" value={targetDate} onChange={(e) => setTargetDate(e.target.value)} className="bg-background/50 border-border/50 rounded-lg" />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Workspace</Label>
              <select value={workspaceId} onChange={(e) => setWorkspaceId(e.target.value)} className="w-full h-9 rounded-lg border border-border/50 bg-background/50 px-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring">
                {workspaces.map((ws) => (<option key={ws.id} value={ws.id}>{ws.name}</option>))}
              </select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setShowDialog(false)} className="rounded-lg">Cancel</Button>
            <Button onClick={handleSave} disabled={!title.trim() || saving} className="bg-foreground hover:bg-foreground/90 text-background border-0 rounded-lg">
              {saving ? "Saving..." : editingGoal ? "Save" : "Create Goal"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageLayout>
  );
}
