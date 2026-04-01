"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { cn } from "@/lib/utils";
import { isAiInput, cleanAiInput } from "@/lib/ai/parser";
import { useSpeechRecognition } from "@/lib/hooks/use-speech-recognition";
import type { AiParseResult } from "@/types/database";
import {
  Search,
  ListTodo,
  Target,
  FileText,
  Sunrise,
  Moon,
  Settings,
  CalendarDays,
  Mic,
  MicOff,
  Sparkles,
  Check,
  Pencil,
  X,
  Calendar,
  MapPin,
  Clock,
  Loader2,
} from "lucide-react";

type SearchResult = {
  id: string;
  type: "task" | "goal" | "note" | "action";
  title: string;
  subtitle?: string;
  icon: React.ReactNode;
  href?: string;
  action?: () => void;
};

type AiState = "idle" | "parsing" | "preview" | "executing" | "done" | "error";

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);

  // AI state
  const [aiMode, setAiMode] = useState(false);
  const [aiState, setAiState] = useState<AiState>("idle");
  const [aiResult, setAiResult] = useState<AiParseResult | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);

  // Voice
  const { isListening, transcript, isSupported, start: startVoice, stop: stopVoice } =
    useSpeechRecognition();

  // Quick actions (always available)
  const quickActions: SearchResult[] = [
    {
      id: "action-plan",
      type: "action",
      title: "Plan My Day",
      subtitle: "Start morning planning ritual",
      icon: <Sunrise className="size-4 text-indigo-400" />,
      href: "/dashboard",
    },
    {
      id: "action-shutdown",
      type: "action",
      title: "Evening Shutdown",
      subtitle: "Close out your day",
      icon: <Moon className="size-4 text-violet-400" />,
      href: "/dashboard",
    },
    {
      id: "action-upcoming",
      type: "action",
      title: "Upcoming Week",
      icon: <CalendarDays className="size-4 text-cyan-400" />,
      href: "/upcoming",
    },
    {
      id: "action-settings",
      type: "action",
      title: "Settings",
      icon: <Settings className="size-4 text-muted-foreground" />,
      href: "/settings",
    },
  ];

  // Detect AI mode based on input
  useEffect(() => {
    setAiMode(isAiInput(query));
  }, [query]);

  // Sync voice transcript to query
  useEffect(() => {
    if (transcript) {
      setQuery(transcript);
    }
  }, [transcript]);

  // Auto-submit when voice stops and we have a transcript
  useEffect(() => {
    if (!isListening && transcript && aiMode) {
      handleAiSubmit();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isListening]);

  // Global keyboard shortcut
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      }
      if (e.key === "Escape") {
        setOpen(false);
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, []);

  useEffect(() => {
    if (open) {
      setQuery("");
      setResults([]);
      setSelectedIndex(0);
      setAiState("idle");
      setAiResult(null);
      setAiError(null);
      setAiResponseData(null);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  const search = useCallback(async (q: string) => {
    if (!q.trim()) {
      setResults([]);
      setSelectedIndex(0);
      return;
    }

    const searchResults: SearchResult[] = [];
    const pattern = `%${q}%`;

    // Search tasks
    const { data: tasks } = await supabase
      .from("tasks")
      .select("id, title, status, workspace_id")
      .ilike("title", pattern)
      .limit(5);

    if (tasks) {
      tasks.forEach((t) =>
        searchResults.push({
          id: t.id,
          type: "task",
          title: t.title,
          subtitle: t.status === "done" ? "Completed" : "Active",
          icon: <ListTodo className="size-4 text-indigo-400" />,
          href: `/dashboard?task=${t.id}`,
        })
      );
    }


    setResults(searchResults);
    setSelectedIndex(0);
  }, []);

  useEffect(() => {
    if (!aiMode) {
      const timer = setTimeout(() => search(query), 200);
      return () => clearTimeout(timer);
    }
  }, [query, search, aiMode]);

  const handleAiSubmit = async () => {
    const input = cleanAiInput(query);
    if (!input) return;

    setAiState("parsing");
    setAiError(null);

    try {
      const res = await fetch("/api/ai/parse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          input,
          context: {
            currentDate: new Date().toISOString(),
            timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          },
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to parse");
      }

      const parsed: AiParseResult = await res.json();
      setAiResult(parsed);
      setAiState("preview");
    } catch (err) {
      setAiError(err instanceof Error ? err.message : "Something went wrong");
      setAiState("error");
    }
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [aiResponseData, setAiResponseData] = useState<Record<string, any> | null>(null);

  const handleAiConfirm = async () => {
    if (!aiResult) return;

    setAiState("executing");

    try {
      const res = await fetch("/api/ai/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ parsed: aiResult, source: "command_bar" }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to execute");
      }

      const data = await res.json();
      setAiResponseData(data);
      setAiState("done");

      // Auto-close for action intents, keep open for queries
      if (!data.events && !data.tasks && !data.free_slots) {
        setTimeout(() => setOpen(false), 1200);
      }
    } catch (err) {
      setAiError(err instanceof Error ? err.message : "Something went wrong");
      setAiState("error");
    }
  };

  const displayResults = query.trim() && !aiMode ? results : !query.trim() ? quickActions : [];

  const handleSelect = (result: SearchResult) => {
    setOpen(false);
    if (result.action) {
      result.action();
    } else if (result.href) {
      router.push(result.href);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (aiMode) {
      if (e.key === "Enter") {
        e.preventDefault();
        if (aiState === "idle" || aiState === "error") {
          handleAiSubmit();
        } else if (aiState === "preview") {
          handleAiConfirm();
        }
      }
      return;
    }

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((i) => Math.min(i + 1, displayResults.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter" && displayResults[selectedIndex]) {
      e.preventDefault();
      handleSelect(displayResults[selectedIndex]);
    }
  };

  const handleVoiceToggle = () => {
    if (isListening) {
      stopVoice();
    } else {
      startVoice();
    }
  };

  if (!open) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-30 bg-black/60 backdrop-blur-sm"
        onClick={() => setOpen(false)}
      />

      {/* Palette */}
      <div className="fixed inset-x-0 top-[15%] z-40 flex justify-center px-4">
        <div className="w-full max-w-lg rounded-lg border border-border bg-card shadow-md overflow-hidden">
          {/* Input */}
          <div className="flex items-center gap-3 border-b border-border/50 px-4">
            {aiMode ? (
              <Sparkles className="size-4 text-purple-400 shrink-0" />
            ) : (
              <Search className="size-4 text-muted-foreground shrink-0" />
            )}
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={
                aiMode
                  ? 'Try: "Book meeting with Alex Friday 10am at Starbucks"'
                  : "Search or type a command..."
              }
              className="flex-1 bg-transparent py-4 text-sm outline-none placeholder:text-muted-foreground/60"
            />
            <div className="flex items-center gap-2">
              {/* Mode indicator */}
              <span
                className={cn(
                  "text-[10px] font-medium px-2 py-0.5 rounded-full",
                  aiMode
                    ? "bg-purple-500/20 text-purple-400"
                    : "bg-muted/50 text-muted-foreground/60"
                )}
              >
                {aiMode ? "AI" : "Search"}
              </span>

              {/* Voice button */}
              {isSupported && (
                <button
                  onClick={handleVoiceToggle}
                  aria-label={isListening ? "Stop listening" : "Start voice input"}
                  className={cn(
                    "p-1.5 rounded-lg transition-colors",
                    isListening
                      ? "bg-red-500/20 text-red-400"
                      : "text-muted-foreground/60 hover:text-muted-foreground hover:bg-muted/50"
                  )}
                >
                  {isListening ? (
                    <MicOff className="h-3.5 w-3.5" />
                  ) : (
                    <Mic className="h-3.5 w-3.5" />
                  )}
                </button>
              )}

              <kbd className="text-[10px] text-muted-foreground/60 bg-muted/50 px-1.5 py-0.5 rounded">
                ESC
              </kbd>
            </div>
          </div>

          {/* AI Mode Content */}
          {aiMode && aiState !== "idle" && (
            <div className="p-4">
              {/* Parsing state */}
              {aiState === "parsing" && (
                <div className="flex items-center gap-3 py-4">
                  <Loader2 className="size-5 text-purple-400 animate-spin" />
                  <span className="text-sm text-muted-foreground">
                    Understanding your command...
                  </span>
                </div>
              )}

              {/* Preview state */}
              {aiState === "preview" && aiResult && (
                <div className="space-y-3">
                  <div className="rounded-lg border border-border/50 bg-background/50 p-4 space-y-2">
                    {/* Intent badge */}
                    <div className="flex items-center gap-2">
                      <span
                        className={cn(
                          "text-[10px] font-semibold uppercase px-2 py-0.5 rounded-full",
                          aiResult.intent === "create_event" &&
                            "bg-blue-500/20 text-blue-400",
                          aiResult.intent === "create_task" &&
                            "bg-indigo-500/20 text-indigo-400",
                          aiResult.intent === "reschedule" &&
                            "bg-amber-500/20 text-amber-400",
                          aiResult.intent === "cancel" &&
                            "bg-red-500/20 text-red-400",
                          aiResult.intent === "query_schedule" &&
                            "bg-cyan-500/20 text-cyan-400",
                          aiResult.intent === "find_free_time" &&
                            "bg-emerald-500/20 text-emerald-400"
                        )}
                      >
                        {aiResult.intent.replace("_", " ")}
                      </span>
                      <span className="text-[10px] text-muted-foreground/60">
                        {Math.round(aiResult.confidence * 100)}% confident
                      </span>
                    </div>

                    {/* Display text */}
                    <p className="text-sm font-medium text-pretty">{aiResult.display_text}</p>

                    {/* Event details */}
                    {aiResult.event && (
                      <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Clock className="size-3" />
                          {new Date(aiResult.event.start_time).toLocaleTimeString(
                            "en-US",
                            { hour: "numeric", minute: "2-digit" }
                          )}{" "}
                          -{" "}
                          {new Date(aiResult.event.end_time).toLocaleTimeString(
                            "en-US",
                            { hour: "numeric", minute: "2-digit" }
                          )}
                        </span>
                        {aiResult.event.location && (
                          <span className="flex items-center gap-1">
                            <MapPin className="size-3" />
                            {aiResult.event.location}
                          </span>
                        )}
                      </div>
                    )}

                    {/* Task details */}
                    {aiResult.task && (
                      <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                        {aiResult.task.due_date && (
                          <span className="flex items-center gap-1">
                            <CalendarDays className="size-3" />
                            Due{" "}
                            {new Date(
                              aiResult.task.due_date + "T00:00:00"
                            ).toLocaleDateString("en-US", {
                              weekday: "short",
                              month: "short",
                              day: "numeric",
                            })}
                          </span>
                        )}
                        {aiResult.task.priority &&
                          aiResult.task.priority !== "none" && (
                            <span className="flex items-center gap-1 capitalize">
                              {aiResult.task.priority} priority
                            </span>
                          )}
                      </div>
                    )}
                  </div>

                  {/* Action buttons */}
                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleAiConfirm}
                      className="flex items-center gap-2 px-4 py-2 rounded-lg bg-foreground text-background text-sm font-medium hover:bg-foreground/90 transition-colors shadow-sm"
                    >
                      <Check className="h-3.5 w-3.5" />
                      Confirm
                      <kbd className="text-[10px] opacity-70 ml-1">Enter</kbd>
                    </button>
                    <button
                      onClick={() => {
                        setAiState("idle");
                        setAiResult(null);
                        inputRef.current?.focus();
                      }}
                      className="flex items-center gap-2 px-4 py-2 rounded-lg border border-border/50 text-sm text-muted-foreground hover:bg-accent transition-colors"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                      Edit
                    </button>
                    <button
                      onClick={() => setOpen(false)}
                      aria-label="Close"
                      className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm text-muted-foreground/60 hover:text-muted-foreground transition-colors"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              )}

              {/* Executing state */}
              {aiState === "executing" && (
                <div className="flex items-center gap-3 py-4">
                  <Loader2 className="size-5 text-purple-400 animate-spin" />
                  <span className="text-sm text-muted-foreground">
                    Creating...
                  </span>
                </div>
              )}

              {/* Done state */}
              {aiState === "done" && (
                <div className="space-y-3">
                  <div className="flex items-center gap-3 py-2">
                    <div className="size-5 rounded-full bg-emerald-500/20 flex items-center justify-center">
                      <Check className="size-3 text-emerald-400" />
                    </div>
                    <span className="text-sm text-emerald-400 font-medium">
                      {aiResponseData?.action_taken || "Done!"}
                    </span>
                  </div>

                  {/* Query schedule results */}
                  {aiResponseData?.events && aiResponseData.events.length > 0 && (
                    <div className="rounded-lg border border-border/50 bg-background/50 p-3 space-y-2 max-h-[200px] overflow-y-auto">
                      <p className="text-[10px] font-semibold uppercase text-muted-foreground">Events</p>
                      {aiResponseData.events.map((e: { id: string; title: string; start_time: string; end_time: string; location?: string; all_day?: boolean }) => (
                        <div key={e.id} className="flex items-center gap-2 text-xs">
                          <Calendar className="size-3 text-blue-400 shrink-0" />
                          <span className="font-medium">{e.title}</span>
                          <span className="text-muted-foreground">
                            {e.all_day ? "All day" : `${new Date(e.start_time).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })} - ${new Date(e.end_time).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}`}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}

                  {aiResponseData?.tasks && aiResponseData.tasks.length > 0 && (
                    <div className="rounded-lg border border-border/50 bg-background/50 p-3 space-y-2 max-h-[200px] overflow-y-auto">
                      <p className="text-[10px] font-semibold uppercase text-muted-foreground">Tasks</p>
                      {aiResponseData.tasks.map((t: { id: string; title: string; due_date?: string; priority?: string }) => (
                        <div key={t.id} className="flex items-center gap-2 text-xs">
                          <ListTodo className="size-3 text-indigo-400 shrink-0" />
                          <span className="font-medium">{t.title}</span>
                          {t.due_date && (
                            <span className="text-muted-foreground">
                              Due {new Date(t.due_date + "T00:00:00").toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Free time results */}
                  {aiResponseData?.free_slots && aiResponseData.free_slots.length > 0 && (
                    <div className="rounded-lg border border-border/50 bg-background/50 p-3 space-y-2 max-h-[200px] overflow-y-auto">
                      <p className="text-[10px] font-semibold uppercase text-muted-foreground">Available Slots</p>
                      {aiResponseData.free_slots.map((s: { start: string; end: string; duration_minutes: number }, i: number) => (
                        <div key={i} className="flex items-center gap-2 text-xs">
                          <Clock className="size-3 text-emerald-400 shrink-0" />
                          <span className="font-medium">
                            {new Date(s.start).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}
                          </span>
                          <span className="text-muted-foreground">
                            {new Date(s.start).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })} - {new Date(s.end).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
                          </span>
                          <span className="text-muted-foreground/60">
                            ({s.duration_minutes >= 60 ? `${Math.floor(s.duration_minutes / 60)}h${s.duration_minutes % 60 ? ` ${s.duration_minutes % 60}m` : ""}` : `${s.duration_minutes}m`})
                          </span>
                        </div>
                      ))}
                    </div>
                  )}

                  {(aiResponseData?.events || aiResponseData?.tasks || aiResponseData?.free_slots) && (
                    <button
                      onClick={() => setOpen(false)}
                      className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                    >
                      Close
                    </button>
                  )}
                </div>
              )}

              {/* Error state */}
              {aiState === "error" && (
                <div className="space-y-3">
                  <div className="flex items-center gap-3 py-2">
                    <div className="size-5 rounded-full bg-red-500/20 flex items-center justify-center">
                      <X className="size-3 text-red-400" />
                    </div>
                    <span className="text-sm text-red-400">
                      {aiError || "Something went wrong"}
                    </span>
                  </div>
                  <button
                    onClick={() => {
                      setAiState("idle");
                      setAiError(null);
                      inputRef.current?.focus();
                    }}
                    className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                  >
                    Try again
                  </button>
                </div>
              )}
            </div>
          )}

          {/* AI Mode - Idle hints */}
          {aiMode && aiState === "idle" && (
            <div className="p-4">
              <p className="text-xs text-muted-foreground/60 mb-3 text-pretty">
                Press <kbd className="bg-muted/50 px-1 rounded text-[10px]">Enter</kbd> to
                send your command
              </p>
              <div className="space-y-1.5">
                {[
                  "Book meeting with Alex Friday 10am at Starbucks",
                  "Add task: prepare Q2 report by next Wednesday",
                  "Remind me to call mom tomorrow evening",
                  "Schedule a Zoom call with team Thursday 2pm",
                ].map((example) => (
                  <button
                    key={example}
                    onClick={() => {
                      setQuery(example);
                      setTimeout(() => handleAiSubmit(), 100);
                    }}
                    className="block w-full text-left text-xs text-muted-foreground/50 hover:text-muted-foreground py-1 px-2 rounded-lg hover:bg-accent/50 transition-colors"
                  >
                    &ldquo;{example}&rdquo;
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Search Mode Results */}
          {!aiMode && (
            <div className="max-h-[320px] overflow-y-auto py-2">
              {!query.trim() && (
                <p className="px-4 py-1.5 text-[11px] font-medium text-muted-foreground uppercase">
                  Quick Actions
                </p>
              )}
              {query.trim() && results.length === 0 && (
                <div className="px-4 py-8 text-center">
                  <p className="text-sm text-muted-foreground text-pretty">
                    No results found
                  </p>
                  <p className="text-xs text-muted-foreground/60 mt-1 text-pretty">
                    Try typing a natural language command instead
                  </p>
                </div>
              )}
              {displayResults.map((result, i) => (
                <button
                  key={result.id}
                  onClick={() => handleSelect(result)}
                  className={cn(
                    "w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors",
                    i === selectedIndex ? "bg-accent" : "hover:bg-accent/50"
                  )}
                >
                  {result.icon}
                  <div className="flex-1 min-w-0">
                    <span className="text-sm font-medium">{result.title}</span>
                    {result.subtitle && (
                      <span className="ml-2 text-xs text-muted-foreground">
                        {result.subtitle}
                      </span>
                    )}
                  </div>
                  {result.type !== "action" && (
                    <span className="text-[10px] text-muted-foreground/60 uppercase">
                      {result.type}
                    </span>
                  )}
                </button>
              ))}
            </div>
          )}

          {/* Voice listening indicator */}
          {isListening && (
            <div className="border-t border-border/50 px-4 py-2 flex items-center gap-2">
              <div className="size-2 rounded-full bg-red-500 animate-pulse" />
              <span className="text-xs text-muted-foreground">
                Listening... speak your command
              </span>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
