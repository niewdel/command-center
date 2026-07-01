"use client";

import { useCallback, useEffect, useState } from "react";
import { CheckSquare, Square, Loader2, Trash2, Pencil } from "lucide-react";
import { isTaskOverdue } from "@/lib/pipeline/tasks";
import type { CrmTask } from "@/types/pipeline";

const mono = "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace";

/** ISO timestamp -> `<input type="date">` value. */
function toDateInputValue(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toISOString().slice(0, 10);
}

function formatDueDate(iso: string | null): string {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function DealTasks({ dealId }: { dealId: string }) {
  const [tasks, setTasks] = useState<CrmTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [title, setTitle] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editDueDate, setEditDueDate] = useState("");

  const fetchTasks = useCallback(async () => {
    const res = await fetch(`/api/pipeline/tasks?deal_id=${dealId}`);
    const json = await res.json();
    setTasks(json.data ?? []);
    setLoading(false);
  }, [dealId]);

  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  const handleAdd = async () => {
    const trimmed = title.trim();
    if (!trimmed || submitting) return;
    setSubmitting(true);

    const optimistic: CrmTask = {
      id: `temp-${Date.now()}`,
      workspace_id: "",
      deal_id: dealId,
      crm_company_id: null,
      contact_id: null,
      title: trimmed,
      due_date: dueDate ? new Date(dueDate).toISOString() : null,
      done: false,
      created_by: null,
      created_at: new Date().toISOString(),
    };
    setTasks((prev) => [...prev, optimistic]);
    setTitle("");
    setDueDate("");

    try {
      const res = await fetch("/api/pipeline/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: trimmed, due_date: optimistic.due_date, deal_id: dealId }),
      });
      if (res.ok) {
        const json = await res.json();
        setTasks((prev) => prev.map((t) => (t.id === optimistic.id ? json.data : t)));
      } else {
        setTasks((prev) => prev.filter((t) => t.id !== optimistic.id));
      }
    } catch {
      setTasks((prev) => prev.filter((t) => t.id !== optimistic.id));
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggle = async (task: CrmTask) => {
    setTasks((prev) => prev.map((t) => (t.id === task.id ? { ...t, done: !t.done } : t)));
    const res = await fetch(`/api/pipeline/tasks/${task.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ done: !task.done }),
    });
    if (!res.ok) {
      // Roll back on failure.
      setTasks((prev) => prev.map((t) => (t.id === task.id ? { ...t, done: task.done } : t)));
    }
  };

  const startEdit = (task: CrmTask) => {
    setEditingId(task.id);
    setEditTitle(task.title);
    setEditDueDate(toDateInputValue(task.due_date));
  };

  const saveEdit = async (taskId: string) => {
    const trimmed = editTitle.trim();
    if (!trimmed) return;
    const due_date = editDueDate ? new Date(editDueDate).toISOString() : null;
    setEditingId(null);
    setTasks((prev) => prev.map((t) => (t.id === taskId ? { ...t, title: trimmed, due_date } : t)));
    await fetch(`/api/pipeline/tasks/${taskId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: trimmed, due_date }),
    });
  };

  const handleDelete = async (taskId: string) => {
    setTasks((prev) => prev.filter((t) => t.id !== taskId));
    await fetch(`/api/pipeline/tasks/${taskId}`, { method: "DELETE" });
  };

  const open = tasks.filter((t) => !t.done);
  const done = tasks.filter((t) => t.done);

  return (
    <div
      className="rounded-lg border p-4 space-y-4"
      style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}
    >
      <p
        className="text-[10px] uppercase tracking-wider"
        style={{ color: "color-mix(in oklch, var(--rust) calc(0.5 * 100%), transparent)", fontFamily: mono }}
      >
        Tasks
      </p>

      {/* Add task */}
      <div className="flex flex-col sm:flex-row gap-2">
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleAdd();
          }}
          placeholder="Send follow-up email…"
          className="flex-1 text-sm bg-transparent outline-none border rounded-md px-2 py-1.5"
          style={{ borderColor: "var(--border)" }}
        />
        <input
          type="date"
          value={dueDate}
          onChange={(e) => setDueDate(e.target.value)}
          className="text-sm bg-transparent outline-none border rounded-md px-2 py-1.5"
          style={{ borderColor: "var(--border)" }}
        />
        <button
          type="button"
          onClick={handleAdd}
          disabled={!title.trim() || submitting}
          className="px-3 py-1.5 text-[10px] uppercase tracking-wider rounded-md transition-colors hover:bg-[color-mix(in oklch, var(--rust) calc(0.15 * 100%), transparent)] disabled:opacity-50 disabled:cursor-not-allowed"
          style={{ fontFamily: mono, color: "var(--rust)", border: "1px solid color-mix(in oklch, var(--rust) calc(0.3 * 100%), transparent)" }}
        >
          Add task
        </button>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-[11px]" style={{ color: "var(--ink-soft)", fontFamily: mono }}>
          <Loader2 size={12} className="animate-spin" /> Loading…
        </div>
      ) : tasks.length === 0 ? (
        <p className="text-[11px]" style={{ color: "var(--ink-soft)", fontFamily: mono }}>
          No tasks yet. Add one to track the next step on this deal.
        </p>
      ) : (
        <ul className="space-y-1.5">
          {[...open, ...done].map((task) => {
            const overdue = isTaskOverdue(task);
            const isEditing = editingId === task.id;
            return (
              <li
                key={task.id}
                className="flex items-center gap-2 rounded-md px-2 py-1.5 group"
                style={{ backgroundColor: "var(--paper-sunken)" }}
              >
                <button
                  type="button"
                  onClick={() => handleToggle(task)}
                  aria-label={task.done ? "Mark task incomplete" : "Mark task complete"}
                  className="shrink-0"
                  style={{ color: task.done ? "rgba(16,185,129,0.7)" : "var(--ink-soft)" }}
                >
                  {task.done ? <CheckSquare size={16} /> : <Square size={16} />}
                </button>

                {isEditing ? (
                  <div className="flex-1 flex flex-col sm:flex-row gap-1.5">
                    <input
                      type="text"
                      value={editTitle}
                      onChange={(e) => setEditTitle(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") saveEdit(task.id);
                        if (e.key === "Escape") setEditingId(null);
                      }}
                      autoFocus
                      className="flex-1 text-sm bg-transparent outline-none border rounded px-1.5 py-0.5"
                      style={{ borderColor: "var(--border)" }}
                    />
                    <input
                      type="date"
                      value={editDueDate}
                      onChange={(e) => setEditDueDate(e.target.value)}
                      className="text-sm bg-transparent outline-none border rounded px-1.5 py-0.5"
                      style={{ borderColor: "var(--border)" }}
                    />
                    <button
                      type="button"
                      onClick={() => saveEdit(task.id)}
                      className="text-[10px] uppercase tracking-wider px-2 py-1 rounded"
                      style={{ fontFamily: mono, color: "var(--rust)" }}
                    >
                      Save
                    </button>
                  </div>
                ) : (
                  <>
                    <div className="flex-1 min-w-0">
                      <p
                        className="text-sm truncate"
                        style={{ textDecoration: task.done ? "line-through" : "none", color: task.done ? "var(--ink-soft)" : "inherit" }}
                      >
                        {task.title}
                      </p>
                    </div>
                    {task.due_date && (
                      <span
                        className="text-[10px] uppercase tracking-wider shrink-0"
                        style={{ fontFamily: mono, color: overdue ? "#EF4444" : "var(--ink-faint)" }}
                      >
                        {formatDueDate(task.due_date)}
                      </span>
                    )}
                    <div className="flex items-center gap-0.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        type="button"
                        onClick={() => startEdit(task)}
                        aria-label="Edit task"
                        className="p-1 rounded hover:bg-[color-mix(in oklch, var(--rust) calc(0.1 * 100%), transparent)]"
                        style={{ color: "var(--ink-soft)" }}
                      >
                        <Pencil size={12} />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(task.id)}
                        aria-label="Delete task"
                        className="p-1 rounded hover:bg-[rgba(239,68,68,0.1)]"
                        style={{ color: "var(--ink-soft)" }}
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
