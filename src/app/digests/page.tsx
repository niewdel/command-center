"use client";

import { useEffect, useState, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { supabase } from "@/lib/supabase";
import { ContentDigest } from "@/types/database";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import {
  BookOpen,
  Plus,
  Search,
  ExternalLink,
  Clock,
  CheckCircle2,
  XCircle,
  Loader2,
  Play,
  Camera,
  RefreshCw,
} from "lucide-react";

function DigestsContent() {
  const searchParams = useSearchParams();
  const highlightId = searchParams.get("id");

  const [digests, setDigests] = useState<ContentDigest[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterTag, setFilterTag] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedDigest, setSelectedDigest] = useState<ContentDigest | null>(
    null
  );
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [addUrl, setAddUrl] = useState("");
  const [addLoading, setAddLoading] = useState(false);
  const [addError, setAddError] = useState("");

  const fetchDigests = useCallback(async () => {
    const { data } = await supabase
      .from("content_digests")
      .select("*")
      .order("created_at", { ascending: false });
    setDigests(data || []);
    setLoading(false);

    // Auto-open if ?id= is in URL
    if (highlightId && data) {
      const found = data.find((d) => d.id === highlightId);
      if (found) setSelectedDigest(found);
    }
  }, [highlightId]);

  useEffect(() => {
    fetchDigests();

    const channel = supabase
      .channel("digests-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "content_digests" },
        () => fetchDigests()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchDigests]);

  // Collect all unique tags
  const allTags = Array.from(
    new Set(digests.flatMap((d) => d.tags || []))
  ).sort();

  // Filter digests
  const filtered = digests.filter((d) => {
    if (filterStatus !== "all" && d.status !== filterStatus) return false;
    if (filterTag !== "all" && !(d.tags || []).includes(filterTag)) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return (
        (d.title || "").toLowerCase().includes(q) ||
        (d.guide || "").toLowerCase().includes(q) ||
        d.url.toLowerCase().includes(q) ||
        (d.tags || []).some((t) => t.includes(q))
      );
    }
    return true;
  });

  const handleAddUrl = async () => {
    if (!addUrl.trim()) return;
    setAddLoading(true);
    setAddError("");

    try {
      const res = await fetch("/api/digest/ingest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: addUrl.trim() }),
      });

      const data = await res.json();
      if (!res.ok) {
        setAddError(data.error || "Failed to add URL");
        setAddLoading(false);
        return;
      }

      setAddUrl("");
      setShowAddDialog(false);
      fetchDigests();
    } catch {
      setAddError("Failed to submit URL");
    }
    setAddLoading(false);
  };

  const handleRetry = async (digestId: string) => {
    await fetch("/api/digest/process", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.NEXT_PUBLIC_DIGEST_PROCESS_SECRET || ""}`,
      },
      body: JSON.stringify({ digestId }),
    });
    fetchDigests();
  };

  const statusIcon = (status: string) => {
    switch (status) {
      case "queued":
        return <Clock className="h-3.5 w-3.5 text-yellow-400" />;
      case "processing":
        return <Loader2 className="h-3.5 w-3.5 text-blue-400 animate-spin" />;
      case "completed":
        return <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />;
      case "failed":
        return <XCircle className="h-3.5 w-3.5 text-red-400" />;
      default:
        return null;
    }
  };

  const sourceIcon = (source: string) => {
    switch (source) {
      case "youtube":
        return <Play className="size-4 text-red-500" />;
      case "instagram":
        return <Camera className="size-4 text-pink-500" />;
      default:
        return <ExternalLink className="size-4 text-muted-foreground" />;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-dvh">
        <div className="flex items-center gap-3 text-muted-foreground">
          <div className="size-5 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
          <span className="text-sm">Loading...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="pt-10 md:pt-2 flex items-start justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <div className="size-10 rounded-lg bg-foreground flex items-center justify-center shadow-sm">
              <BookOpen className="size-5 text-background" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-balance">Digests</h1>
              <p className="text-xs text-muted-foreground text-pretty">
                Video guides, auto-analyzed
              </p>
            </div>
          </div>
        </div>
        <Button
          onClick={() => setShowAddDialog(true)}
          className="gap-2 bg-foreground hover:bg-foreground/90 text-background border-0 rounded-lg shadow-sm"
          size="sm"
        >
          <Plus className="size-4" />
          Add Link
        </Button>
      </div>

      {/* Search + Filters */}
      <div className="space-y-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search guides, tags, URLs..."
            className="pl-10 bg-background/50 border-border/50 rounded-lg h-10"
          />
        </div>

        <div className="flex gap-2 flex-wrap">
          {/* Status filters */}
          {["all", "completed", "processing", "queued", "failed"].map((s) => (
            <button
              key={s}
              onClick={() => setFilterStatus(s)}
              className={cn(
                "px-3 py-1.5 rounded-lg text-xs font-medium transition-colors",
                filterStatus === s
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              {s.charAt(0).toUpperCase() + s.slice(1)}
            </button>
          ))}
        </div>

        {/* Tag filters */}
        {allTags.length > 0 && (
          <div className="flex gap-1.5 flex-wrap">
            <button
              onClick={() => setFilterTag("all")}
              className={cn(
                "px-2 py-1 rounded-md text-[11px] font-medium transition-colors",
                filterTag === "all"
                  ? "bg-accent text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              All tags
            </button>
            {allTags.map((tag) => (
              <button
                key={tag}
                onClick={() => setFilterTag(tag)}
                className={cn(
                  "px-2 py-1 rounded-md text-[11px] font-medium transition-colors",
                  filterTag === tag
                    ? "bg-red-500/20 text-red-400"
                    : "bg-muted/30 text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                )}
              >
                {tag}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Digest cards */}
      {filtered.length === 0 ? (
        <div className="text-center py-16">
          <div className="inline-flex size-14 items-center justify-center rounded-2xl bg-muted/50 mb-4">
            <BookOpen className="h-7 w-7 text-muted-foreground" />
          </div>
          <p className="text-sm font-medium text-pretty">No digests yet</p>
          <p className="text-xs text-muted-foreground mt-1 text-pretty">
            Drop a YouTube or Instagram link in Slack, or add one above.
          </p>
        </div>
      ) : (
        <div className="grid gap-3">
          {filtered.map((digest) => (
            <div
              key={digest.id}
              className={cn(
                "group rounded-lg border border-border/50 bg-card/50 p-4 hover:bg-card hover:border-border transition-colors cursor-pointer",
                highlightId === digest.id && "ring-2 ring-primary/50"
              )}
              onClick={() =>
                digest.status === "completed" && setSelectedDigest(digest)
              }
            >
              <div className="flex items-start gap-4">
                {/* Thumbnail */}
                {digest.thumbnail_url ? (
                  <div className="shrink-0 w-24 h-16 rounded-lg overflow-hidden bg-muted">
                    <img
                      src={digest.thumbnail_url}
                      alt=""
                      className="w-full h-full object-cover"
                    />
                  </div>
                ) : (
                  <div className="shrink-0 w-24 h-16 rounded-lg bg-muted/50 flex items-center justify-center">
                    {sourceIcon(digest.source)}
                  </div>
                )}

                <div className="flex-1 min-w-0 space-y-1.5">
                  <div className="flex items-center gap-2">
                    {statusIcon(digest.status)}
                    {sourceIcon(digest.source)}
                    <h3 className="text-sm font-semibold truncate flex-1">
                      {digest.title || digest.url}
                    </h3>
                  </div>

                  {/* Tags */}
                  {digest.tags && digest.tags.length > 0 && (
                    <div className="flex gap-1 flex-wrap">
                      {digest.tags.slice(0, 5).map((tag) => (
                        <Badge
                          key={tag}
                          variant="secondary"
                          className="text-[10px] px-1.5 py-0 rounded-md bg-muted/50"
                        >
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  )}

                  <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                    <span>
                      {new Date(digest.created_at).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        hour: "numeric",
                        minute: "2-digit",
                      })}
                    </span>
                    {digest.status === "failed" && digest.error_message && (
                      <>
                        <span className="text-border">|</span>
                        <span className="text-red-400 truncate max-w-[200px]">
                          {digest.error_message}
                        </span>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleRetry(digest.id);
                          }}
                          className="ml-1 text-blue-400 hover:text-blue-300 flex items-center gap-1"
                        >
                          <RefreshCw className="h-3 w-3" />
                          Retry
                        </button>
                      </>
                    )}
                    {digest.status === "processing" && (
                      <>
                        <span className="text-border">|</span>
                        <span className="text-blue-400">Processing...</span>
                      </>
                    )}
                    {digest.status === "queued" && (
                      <>
                        <span className="text-border">|</span>
                        <span className="text-yellow-400">In queue</span>
                      </>
                    )}
                  </div>
                </div>

                {/* Open link */}
                <a
                  href={digest.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className="shrink-0 p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent/50 transition-colors opacity-0 group-hover:opacity-100"
                >
                  <ExternalLink className="size-4" />
                </a>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Guide Viewer Dialog */}
      <Dialog
        open={!!selectedDigest}
        onOpenChange={() => setSelectedDigest(null)}
      >
        <DialogContent className="sm:max-w-[700px] max-h-[85vh] overflow-y-auto bg-card border-border rounded-lg shadow-md">
          {selectedDigest && (
            <>
              <DialogHeader>
                <div className="flex items-center gap-2 mb-1">
                  {sourceIcon(selectedDigest.source)}
                  <DialogTitle className="text-lg">
                    {selectedDigest.title}
                  </DialogTitle>
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <a
                    href={selectedDigest.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-400 hover:text-blue-300 flex items-center gap-1"
                  >
                    <ExternalLink className="h-3 w-3" />
                    Original video
                  </a>
                  <span className="text-border">|</span>
                  <span>
                    {new Date(selectedDigest.created_at).toLocaleDateString(
                      "en-US",
                      { month: "short", day: "numeric", year: "numeric" }
                    )}
                  </span>
                </div>
                {selectedDigest.tags && selectedDigest.tags.length > 0 && (
                  <div className="flex gap-1.5 flex-wrap pt-2">
                    {selectedDigest.tags.map((tag) => (
                      <Badge
                        key={tag}
                        variant="secondary"
                        className="text-[11px] px-2 py-0.5 rounded-md"
                      >
                        {tag}
                      </Badge>
                    ))}
                  </div>
                )}
              </DialogHeader>
              <div className="prose prose-invert prose-sm max-w-none pt-2">
                <MarkdownRenderer content={selectedDigest.guide || ""} />
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Add Link Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="sm:max-w-[500px] bg-card border-border rounded-lg shadow-md">
          <DialogHeader>
            <DialogTitle>Add Video Link</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <Input
              autoFocus
              value={addUrl}
              onChange={(e) => {
                setAddUrl(e.target.value);
                setAddError("");
              }}
              placeholder="Paste YouTube or Instagram URL..."
              className="bg-background/50 border-border/50 rounded-lg h-11"
              onKeyDown={(e) => e.key === "Enter" && handleAddUrl()}
            />
            {addError && (
              <p className="text-xs text-red-400 text-pretty">{addError}</p>
            )}
            <div className="flex justify-end gap-2">
              <Button
                variant="ghost"
                onClick={() => setShowAddDialog(false)}
                className="rounded-lg"
              >
                Cancel
              </Button>
              <Button
                onClick={handleAddUrl}
                disabled={!addUrl.trim() || addLoading}
                className="bg-foreground hover:bg-foreground/90 text-background border-0 rounded-lg shadow-sm"
              >
                {addLoading ? (
                  <>
                    <Loader2 className="size-4 animate-spin mr-2" />
                    Adding...
                  </>
                ) : (
                  "Add & Process"
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Simple markdown renderer for the guide content
function MarkdownRenderer({ content }: { content: string }) {
  // Convert markdown to basic HTML
  const html = content
    // Code blocks
    .replace(
      /```(\w*)\n([\s\S]*?)```/g,
      '<pre class="bg-background/80 border border-border/50 rounded-lg p-3 overflow-x-auto text-xs"><code>$2</code></pre>'
    )
    // Headers
    .replace(
      /^### (.+)$/gm,
      '<h3 class="text-sm font-semibold mt-4 mb-1">$1</h3>'
    )
    .replace(
      /^## (.+)$/gm,
      '<h2 class="text-base font-bold mt-6 mb-2 text-foreground text-balance">$1</h2>'
    )
    .replace(
      /^# (.+)$/gm,
      '<h1 class="text-lg font-bold mt-4 mb-3 text-foreground text-balance">$1</h1>'
    )
    // Bold
    .replace(/\*\*(.+?)\*\*/g, '<strong class="text-foreground">$1</strong>')
    // Inline code
    .replace(
      /`([^`]+)`/g,
      '<code class="bg-muted/50 px-1.5 py-0.5 rounded text-[11px] text-pink-400">$1</code>'
    )
    // Bullet points
    .replace(
      /^- (.+)$/gm,
      '<li class="text-sm text-muted-foreground ml-4 list-disc">$1</li>'
    )
    // Numbered lists
    .replace(
      /^(\d+)\. (.+)$/gm,
      '<li class="text-sm text-muted-foreground ml-4 list-decimal" value="$1">$2</li>'
    )
    // Paragraphs (lines that aren't already wrapped)
    .replace(
      /^(?!<[hluop]|<li|<pre|<code)(.+)$/gm,
      '<p class="text-sm text-muted-foreground leading-relaxed text-pretty">$1</p>'
    );

  return <div dangerouslySetInnerHTML={{ __html: html }} />;
}

export default function DigestsPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center min-h-dvh">
          <div className="flex items-center gap-3 text-muted-foreground">
            <div className="size-5 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
            <span className="text-sm">Loading...</span>
          </div>
        </div>
      }
    >
      <DigestsContent />
    </Suspense>
  );
}
