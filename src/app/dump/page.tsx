"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { Workspace } from "@/types/database";
import { PageLayout } from "@/components/layout/page-layout";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  Zap,
  Loader2,
  CheckCircle2,
  ArrowRight,
  Clock,
  ChevronDown,
  ChevronUp,
  Trash2,
} from "lucide-react";

type DumpResult = {
  id: string;
  title: string;
  workspace_id: string;
  workspace_name: string;
  priority: string;
  research: string;
  estimated_minutes: number | null;
  timestamp: number;
};

export default function DumpPage() {
  const [input, setInput] = useState("");
  const [processing, setProcessing] = useState(false);
  const [results, setResults] = useState<DumpResult[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [recentTasks, setRecentTasks] = useState<DumpResult[]>([]);
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Load workspaces + recent AI-created tasks on mount
  useEffect(() => {
    async function loadData() {
      const [{ data: ws }, { data: tasks }] = await Promise.all([
        supabase.from("workspaces").select("*").order("name"),
        supabase
          .from("tasks")
          .select("id, title, priority, description, estimated_minutes, workspace_id, created_at, workspaces(name)")
          .eq("source", "ai")
          .order("created_at", { ascending: false })
          .limit(20),
      ]);

      setWorkspaces(ws || []);

      if (tasks) {
        setRecentTasks(
          tasks.map((t) => ({
            id: t.id,
            title: t.title,
            workspace_id: t.workspace_id,
            workspace_name: (t.workspaces as unknown as { name: string } | null)?.name || "Unknown",
            priority: t.priority,
            research: extractResearch(t.description || ""),
            estimated_minutes: t.estimated_minutes,
            timestamp: new Date(t.created_at).getTime(),
          }))
        );
      }
    }
    loadData();
  }, []);

  const handleSubmit = useCallback(async () => {
    const text = input.trim();
    if (!text || processing) return;

    setProcessing(true);
    setInput("");

    try {
      const res = await fetch("/api/tasks/dump", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });

      const data = await res.json();

      if (res.ok && data.task) {
        const result: DumpResult = {
          id: data.task.id,
          title: data.task.title,
          workspace_id: data.task.workspace_id,
          workspace_name: data.workspace_name,
          priority: data.task.priority,
          research: data.research,
          estimated_minutes: data.task.estimated_minutes,
          timestamp: Date.now(),
        };
        setResults((prev) => [result, ...prev]);
        setExpandedId(result.id);
      }
    } catch {
      // Silently handle
    }

    setProcessing(false);
    inputRef.current?.focus();
  }, [input, processing]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleChangeWorkspace = async (taskId: string, newWorkspaceId: string) => {
    const ws = workspaces.find((w) => w.id === newWorkspaceId);
    if (!ws) return;

    await supabase.from("tasks").update({ workspace_id: newWorkspaceId }).eq("id", taskId);

    // Update local state
    const update = (list: DumpResult[]) =>
      list.map((r) =>
        r.id === taskId ? { ...r, workspace_id: newWorkspaceId, workspace_name: ws.name } : r
      );
    setResults(update);
    setRecentTasks(update);
  };

  const handleDiscard = async (taskId: string) => {
    await supabase.from("tasks").delete().eq("id", taskId);
    setResults((prev) => prev.filter((r) => r.id !== taskId));
    setRecentTasks((prev) => prev.filter((r) => r.id !== taskId));
  };

  const allResults = [...results, ...recentTasks.filter((r) => !results.some((s) => s.id === r.id))];

  const priorityColor: Record<string, string> = {
    high: "bg-red-500/20 text-red-400 border-red-500/30",
    medium: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
    low: "bg-blue-500/20 text-blue-400 border-blue-500/30",
    none: "bg-muted text-muted-foreground border-border/50",
  };

  return (
    <PageLayout title="Dump" description="Throw tasks in. AI sorts them." icon={Zap} maxWidth="md">
      {/* Input area */}
      <div className="relative">
        <textarea
          ref={inputRef}
          autoFocus
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={processing}
          rows={3}
          placeholder="Dump a task... hit Enter to file it"
          className={cn(
            "w-full rounded-md border bg-transparent px-4 py-3 text-sm text-foreground resize-none",
            "placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-ring",
            "border-border",
            processing && "opacity-60"
          )}
        />
        <div className="absolute bottom-3 right-3 flex items-center gap-2">
          {processing ? (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Loader2 className="size-3.5 animate-spin" />
              Filing...
            </div>
          ) : input.trim() ? (
            <button
              onClick={handleSubmit}
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              <ArrowRight className="size-3.5" />
              Enter
            </button>
          ) : null}
        </div>
      </div>

      {/* Results */}
      {allResults.length > 0 && (
        <div className="space-y-2">
          <p className="text-[11px] font-medium uppercase text-muted-foreground px-1">
            Filed Tasks
          </p>
          {allResults.map((result) => {
            const isExpanded = expandedId === result.id;
            return (
              <div
                key={result.id}
                className="rounded-md border border-border overflow-hidden transition-colors"
              >
                <button
                  onClick={() => setExpandedId(isExpanded ? null : result.id)}
                  className="w-full flex items-center gap-3 p-3 text-left"
                >
                  <CheckCircle2 className="size-4 text-emerald-400 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{result.title}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-[11px] text-muted-foreground">
                        {result.workspace_name}
                      </span>
                      {result.estimated_minutes && (
                        <>
                          <span className="text-border">·</span>
                          <span className="text-[11px] text-muted-foreground flex items-center gap-0.5">
                            <Clock className="size-2.5" />
                            {result.estimated_minutes}m
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                  <Badge
                    variant="secondary"
                    className={cn("text-[10px] px-1.5 py-0 rounded border shrink-0", priorityColor[result.priority])}
                  >
                    {result.priority}
                  </Badge>
                  {isExpanded ? (
                    <ChevronUp className="size-3.5 text-muted-foreground shrink-0" />
                  ) : (
                    <ChevronDown className="size-3.5 text-muted-foreground shrink-0" />
                  )}
                </button>

                {isExpanded && (
                  <div className="px-3 pb-3 pt-0 border-t border-border/30 space-y-3">
                    {/* Workspace switcher + discard */}
                    <div className="flex items-center justify-between mt-2">
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] text-muted-foreground">Workspace:</span>
                        <select
                          value={result.workspace_id}
                          onChange={(e) => handleChangeWorkspace(result.id, e.target.value)}
                          className="text-xs bg-transparent border border-border rounded-md px-2 py-1 text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                        >
                          {workspaces.map((ws) => (
                            <option key={ws.id} value={ws.id}>
                              {ws.name}
                            </option>
                          ))}
                        </select>
                      </div>
                      <button
                        onClick={() => handleDiscard(result.id)}
                        className="flex items-center gap-1 text-xs text-muted-foreground hover:text-red-400 transition-colors"
                      >
                        <Trash2 className="size-3" />
                        Discard
                      </button>
                    </div>

                    {/* Research */}
                    {result.research && (
                      <>
                        <p className="text-[11px] font-medium uppercase text-muted-foreground">
                          AI Research & Tips
                        </p>
                        <div className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap">
                          {result.research}
                        </div>
                      </>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Empty state */}
      {allResults.length === 0 && !processing && (
        <div className="text-center py-16">
          <p className="text-sm text-muted-foreground">No tasks dumped yet</p>
          <p className="text-xs text-muted-foreground mt-1">
            Type a task above and hit Enter. AI will sort it, prioritize it, and give you tips.
          </p>
        </div>
      )}
    </PageLayout>
  );
}

function extractResearch(description: string): string {
  const match = description.match(/\*\*AI Research & Tips:\*\*\n([\s\S]*)/);
  return match?.[1]?.trim() || "";
}
