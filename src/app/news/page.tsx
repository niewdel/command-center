"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { supabase } from "@/lib/supabase";
import { ContentDigest, NewsStory, NewsTopic } from "@/types/database";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { PageLayout } from "@/components/layout/page-layout";
import { SkeletonPage } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import {
  Newspaper,
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
  Copy,
  Check,
  X,
} from "lucide-react";

// Copy button component for code blocks
function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation();
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <button
      onClick={handleCopy}
      className="absolute top-2 right-2 p-1.5 rounded-md bg-foreground/10 hover:bg-foreground/20 text-muted-foreground hover:text-foreground transition-colors"
      aria-label="Copy code"
    >
      {copied ? (
        <Check className="size-3.5 text-emerald-400" />
      ) : (
        <Copy className="size-3.5" />
      )}
    </button>
  );
}

// Markdown renderer with code block copy buttons
function MarkdownRenderer({ content }: { content: string }) {
  const containerRef = useRef<HTMLDivElement>(null);

  // Parse markdown into structured blocks
  const blocks = parseMarkdown(content);

  return (
    <div ref={containerRef} className="space-y-0">
      {blocks.map((block, i) => {
        switch (block.type) {
          case "heading1":
            return (
              <h1
                key={i}
                className="text-lg font-bold mt-4 mb-3 text-foreground text-balance"
              >
                {block.content}
              </h1>
            );
          case "heading2":
            return (
              <h2
                key={i}
                className="text-base font-bold mt-6 mb-2 text-foreground text-balance"
              >
                {block.content}
              </h2>
            );
          case "heading3":
            return (
              <h3
                key={i}
                className="text-sm font-semibold mt-4 mb-1 text-foreground"
              >
                {block.content}
              </h3>
            );
          case "code":
            return (
              <div key={i} className="relative group my-3">
                <CopyButton text={block.content} />
                {block.lang && (
                  <span className="absolute top-2 left-3 text-[10px] uppercase tracking-wide text-muted-foreground/60 font-mono">
                    {block.lang}
                  </span>
                )}
                <pre
                  className={cn(
                    "bg-background/80 border border-border/50 rounded-lg overflow-x-auto text-xs font-mono leading-relaxed",
                    block.lang ? "pt-7 pb-3 px-3" : "p-3"
                  )}
                >
                  <code>{block.content}</code>
                </pre>
              </div>
            );
          case "blockquote":
            return (
              <blockquote
                key={i}
                className="border-l-2 border-border/60 pl-3 my-2 text-sm text-muted-foreground italic"
              >
                <InlineMarkdown text={block.content} />
              </blockquote>
            );
          case "checkbox":
            return (
              <div
                key={i}
                className="flex items-start gap-2 my-1 ml-1"
              >
                <div
                  className={cn(
                    "mt-0.5 size-4 rounded border flex items-center justify-center shrink-0",
                    block.checked
                      ? "bg-emerald-500/20 border-emerald-500/40"
                      : "border-border/60"
                  )}
                >
                  {block.checked && (
                    <Check className="size-2.5 text-emerald-400" />
                  )}
                </div>
                <span className="text-sm text-muted-foreground leading-relaxed">
                  <InlineMarkdown text={block.content} />
                </span>
              </div>
            );
          case "list":
            return (
              <li
                key={i}
                className="text-sm text-muted-foreground ml-4 list-disc leading-relaxed"
              >
                <InlineMarkdown text={block.content} />
              </li>
            );
          case "numbered":
            return (
              <li
                key={i}
                className="text-sm text-muted-foreground ml-4 list-decimal leading-relaxed"
                value={block.number}
              >
                <InlineMarkdown text={block.content} />
              </li>
            );
          case "paragraph":
            return (
              <p
                key={i}
                className="text-sm text-muted-foreground leading-relaxed text-pretty my-1.5"
              >
                <InlineMarkdown text={block.content} />
              </p>
            );
          case "empty":
            return <div key={i} className="h-2" />;
          default:
            return null;
        }
      })}
    </div>
  );
}

// Inline markdown: bold, code, links
function InlineMarkdown({ text }: { text: string }) {
  // Process inline elements: bold, inline code, links
  const parts: React.ReactNode[] = [];
  let remaining = text;
  let key = 0;

  while (remaining.length > 0) {
    // Find the next special pattern
    const boldMatch = remaining.match(/\*\*(.+?)\*\*/);
    const codeMatch = remaining.match(/`([^`]+)`/);
    const linkMatch = remaining.match(/\[([^\]]+)\]\(([^)]+)\)/);

    // Find which comes first
    const candidates = [
      boldMatch ? { type: "bold", index: boldMatch.index!, match: boldMatch } : null,
      codeMatch ? { type: "code", index: codeMatch.index!, match: codeMatch } : null,
      linkMatch ? { type: "link", index: linkMatch.index!, match: linkMatch } : null,
    ].filter(Boolean) as { type: string; index: number; match: RegExpMatchArray }[];

    if (candidates.length === 0) {
      parts.push(remaining);
      break;
    }

    const first = candidates.reduce((a, b) => (a.index < b.index ? a : b));

    // Add text before the match
    if (first.index > 0) {
      parts.push(remaining.slice(0, first.index));
    }

    switch (first.type) {
      case "bold":
        parts.push(
          <strong key={key++} className="text-foreground font-semibold">
            {first.match[1]}
          </strong>
        );
        remaining = remaining.slice(first.index + first.match[0].length);
        break;
      case "code":
        parts.push(
          <code
            key={key++}
            className="bg-muted/50 px-1.5 py-0.5 rounded text-[11px] text-pink-400 font-mono"
          >
            {first.match[1]}
          </code>
        );
        remaining = remaining.slice(first.index + first.match[0].length);
        break;
      case "link":
        parts.push(
          <a
            key={key++}
            href={first.match[2]}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-400 hover:text-blue-300 underline underline-offset-2"
          >
            {first.match[1]}
          </a>
        );
        remaining = remaining.slice(first.index + first.match[0].length);
        break;
    }
  }

  return <>{parts}</>;
}

type Block =
  | { type: "heading1"; content: string }
  | { type: "heading2"; content: string }
  | { type: "heading3"; content: string }
  | { type: "code"; content: string; lang?: string }
  | { type: "blockquote"; content: string }
  | { type: "checkbox"; content: string; checked: boolean }
  | { type: "list"; content: string }
  | { type: "numbered"; content: string; number: number }
  | { type: "paragraph"; content: string }
  | { type: "empty" };

function parseMarkdown(content: string): Block[] {
  const blocks: Block[] = [];
  const lines = content.split("\n");
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Code block
    if (line.startsWith("```")) {
      const lang = line.slice(3).trim() || undefined;
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i].startsWith("```")) {
        codeLines.push(lines[i]);
        i++;
      }
      blocks.push({ type: "code", content: codeLines.join("\n"), lang });
      i++; // skip closing ```
      continue;
    }

    // Headings
    if (line.startsWith("### ")) {
      blocks.push({ type: "heading3", content: line.slice(4) });
      i++;
      continue;
    }
    if (line.startsWith("## ")) {
      blocks.push({ type: "heading2", content: line.slice(3) });
      i++;
      continue;
    }
    if (line.startsWith("# ")) {
      blocks.push({ type: "heading1", content: line.slice(2) });
      i++;
      continue;
    }

    // Blockquote
    if (line.startsWith("> ")) {
      blocks.push({ type: "blockquote", content: line.slice(2) });
      i++;
      continue;
    }

    // Checkbox
    if (line.match(/^- \[[ x]\] /)) {
      const checked = line.charAt(3) === "x";
      blocks.push({ type: "checkbox", content: line.slice(6), checked });
      i++;
      continue;
    }

    // Bullet list
    if (line.match(/^[-*] /)) {
      blocks.push({ type: "list", content: line.slice(2) });
      i++;
      continue;
    }

    // Numbered list
    const numMatch = line.match(/^(\d+)\. (.+)/);
    if (numMatch) {
      blocks.push({
        type: "numbered",
        content: numMatch[2],
        number: parseInt(numMatch[1], 10),
      });
      i++;
      continue;
    }

    // Empty line
    if (line.trim() === "") {
      blocks.push({ type: "empty" });
      i++;
      continue;
    }

    // Paragraph (default)
    blocks.push({ type: "paragraph", content: line });
    i++;
  }

  return blocks;
}

// ── Top Stories Component ──
function TopStories({ filterTopic }: { filterTopic: string }) {
  const [stories, setStories] = useState<NewsStory[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchStories = useCallback(async () => {
    let query = supabase
      .from("news_stories")
      .select("*")
      .gte("fetched_at", new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString())
      .order("relevance_score", { ascending: false })
      .limit(10);

    if (filterTopic !== "all") {
      query = query.eq("topic", filterTopic);
    }

    const { data } = await query;
    setStories(data || []);
    setLoading(false);
  }, [filterTopic]);

  useEffect(() => {
    fetchStories();
  }, [fetchStories]);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await fetch("/api/cron/refresh-news", {
        method: "POST",
        headers: { "x-cron-secret": "manual-refresh" },
      });
      await fetchStories();
    } catch {
      // silent
    }
    setRefreshing(false);
  };

  const timeAgo = (date: string | null) => {
    if (!date) return "";
    const diff = Date.now() - new Date(date).getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    if (hours < 1) return "just now";
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  };

  if (loading) {
    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-[11px] font-medium uppercase text-muted-foreground">Top Stories</p>
        </div>
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-16 rounded-md bg-muted/30 animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-[11px] font-medium uppercase text-muted-foreground">Top Stories</p>
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          className="text-xs text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"
        >
          <RefreshCw className={cn("size-3", refreshing && "animate-spin")} />
          {refreshing ? "Refreshing..." : "Refresh"}
        </button>
      </div>

      {stories.length === 0 ? (
        <div className="text-center py-8">
          <p className="text-sm text-muted-foreground">No stories yet</p>
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="text-sm text-primary hover:underline mt-1"
          >
            Fetch latest news
          </button>
        </div>
      ) : (
        <div className="divide-y divide-border">
          {stories.map((story) => (
            <a
              key={story.id}
              href={story.url}
              target="_blank"
              rel="noopener noreferrer"
              className="group flex items-start gap-3 py-3 transition-colors hover:bg-accent/30 -mx-2 px-2 rounded-md"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium group-hover:text-primary transition-colors line-clamp-1">
                    {story.title}
                  </span>
                  <ExternalLink className="size-3 text-muted-foreground shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
                <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{story.summary}</p>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-[11px] text-muted-foreground">{story.source_name}</span>
                  <span className="text-[11px] text-muted-foreground/50">·</span>
                  <span className="text-[11px] text-muted-foreground tabular-nums">{timeAgo(story.published_at || story.fetched_at)}</span>
                  <span className="text-[11px] text-muted-foreground/50">·</span>
                  <span className="text-[11px] text-muted-foreground">{story.topic}</span>
                </div>
              </div>
            </a>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Topic Pills Component ──
function TopicPills({
  activeTopic,
  onTopicChange,
}: {
  activeTopic: string;
  onTopicChange: (topic: string) => void;
}) {
  const [topics, setTopics] = useState<NewsTopic[]>([]);
  const [showEdit, setShowEdit] = useState(false);
  const [newTopicName, setNewTopicName] = useState("");
  const [newTopicFeeds, setNewTopicFeeds] = useState("");

  const fetchTopics = useCallback(async () => {
    const { data } = await supabase
      .from("news_topics")
      .select("*")
      .order("position");
    setTopics(data || []);
  }, []);

  useEffect(() => {
    fetchTopics();
  }, [fetchTopics]);

  const toggleTopic = async (id: string, active: boolean) => {
    await supabase.from("news_topics").update({ active, updated_at: new Date().toISOString() }).eq("id", id);
    fetchTopics();
  };

  const deleteTopic = async (id: string) => {
    await supabase.from("news_topics").delete().eq("id", id);
    fetchTopics();
    if (activeTopic !== "all") onTopicChange("all");
  };

  const addTopic = async () => {
    if (!newTopicName.trim()) return;
    const feeds = newTopicFeeds
      .split("\n")
      .map((f) => f.trim())
      .filter(Boolean);
    await supabase.from("news_topics").insert({
      name: newTopicName.trim(),
      keywords: [newTopicName.toLowerCase()],
      rss_feeds: feeds,
      position: topics.length,
    });
    setNewTopicName("");
    setNewTopicFeeds("");
    fetchTopics();
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-1.5 flex-wrap">
        <button
          onClick={() => onTopicChange("all")}
          className={cn(
            "px-2.5 py-1 rounded-md text-xs font-medium transition-colors",
            activeTopic === "all" ? "bg-accent text-foreground" : "text-muted-foreground hover:text-foreground"
          )}
        >
          All
        </button>
        {topics
          .filter((t) => t.active)
          .map((topic) => (
            <button
              key={topic.id}
              onClick={() => onTopicChange(topic.name === activeTopic ? "all" : topic.name)}
              className={cn(
                "px-2.5 py-1 rounded-md text-xs font-medium transition-colors",
                activeTopic === topic.name ? "bg-accent text-foreground" : "text-muted-foreground hover:text-foreground"
              )}
            >
              {topic.name}
            </button>
          ))}
        <button
          onClick={() => setShowEdit(!showEdit)}
          className="px-2 py-1 rounded-md text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          {showEdit ? "Done" : "+ Edit"}
        </button>
      </div>

      {showEdit && (
        <div className="border border-border rounded-md p-3 space-y-3">
          <div className="space-y-1.5">
            {topics.map((topic) => (
              <div key={topic.id} className="flex items-center justify-between py-1">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => toggleTopic(topic.id, !topic.active)}
                    className={cn(
                      "size-4 rounded border transition-colors",
                      topic.active ? "bg-primary border-primary" : "border-muted-foreground/40"
                    )}
                  />
                  <span className={cn("text-sm", !topic.active && "text-muted-foreground")}>{topic.name}</span>
                </div>
                <button
                  onClick={() => deleteTopic(topic.id)}
                  className="p-1 text-muted-foreground hover:text-red-400 transition-colors"
                >
                  <X className="size-3" />
                </button>
              </div>
            ))}
          </div>
          <div className="border-t border-border pt-3 space-y-2">
            <Input
              placeholder="Topic name"
              value={newTopicName}
              onChange={(e) => setNewTopicName(e.target.value)}
              className="h-8 text-sm"
            />
            <textarea
              placeholder="RSS feed URLs (one per line, optional)"
              value={newTopicFeeds}
              onChange={(e) => setNewTopicFeeds(e.target.value)}
              rows={2}
              className="w-full rounded-md border border-border bg-transparent px-3 py-2 text-xs placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-ring resize-none"
            />
            <Button onClick={addTopic} size="sm" variant="outline" className="h-7 text-xs" disabled={!newTopicName.trim()}>
              Add Topic
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function DigestsContent() {
  const searchParams = useSearchParams();
  const highlightId = searchParams.get("id");

  const [digests, setDigests] = useState<ContentDigest[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterTag, setFilterTag] = useState<string>("all");
  const [filterTopic, setFilterTopic] = useState<string>("all");
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
    // Reset status to queued, then trigger reprocessing
    await supabase
      .from("content_digests")
      .update({ status: "queued", error_message: null, updated_at: new Date().toISOString() })
      .eq("id", digestId);
    fetchDigests();

    await fetch("/api/digest/retry", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ digestId }),
    });
    fetchDigests();
  };

  const handleDiscard = async (digestId: string) => {
    await supabase
      .from("content_digests")
      .delete()
      .eq("id", digestId);
    setDigests((prev) => prev.filter((d) => d.id !== digestId));
    if (selectedDigest?.id === digestId) setSelectedDigest(null);
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

  // Extract verdict badge from guide content
  const getVerdictBadge = (guide: string | null) => {
    if (!guide) return null;
    const verdictMatch = guide.match(/\b(MUST-ACT|WORTH EXPLORING|REFERENCE ONLY|SKIP)\b/);
    if (!verdictMatch) return null;
    const verdict = verdictMatch[1];
    const colors: Record<string, string> = {
      "MUST-ACT": "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
      "WORTH EXPLORING": "bg-blue-500/20 text-blue-400 border-blue-500/30",
      "REFERENCE ONLY": "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
      "SKIP": "bg-muted text-muted-foreground border-border/50",
    };
    return (
      <span className={cn("text-[10px] font-semibold px-1.5 py-0.5 rounded border", colors[verdict])}>
        {verdict}
      </span>
    );
  };

  return (
    <PageLayout
      title="News"
      description="Curated stories & video guides"
      icon={Newspaper}
      loading={loading}
      maxWidth="lg"
      actions={
        <Button
          onClick={() => setShowAddDialog(true)}
          variant="outline"
          size="sm"
          className="gap-1.5 h-8"
        >
          <Plus className="size-3.5" />
          Add Link
        </Button>
      }
    >
      {/* Top Stories */}
      <TopStories filterTopic={filterTopic} />

      {/* Topic filters */}
      <TopicPills activeTopic={filterTopic} onTopicChange={setFilterTopic} />

      {/* Divider */}
      <div className="flex items-center gap-3 pt-2">
        <div className="h-px flex-1 bg-border" />
        <span className="text-[11px] font-medium uppercase text-muted-foreground">Your Digests</span>
        <div className="h-px flex-1 bg-border" />
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
            <Newspaper className="h-7 w-7 text-muted-foreground" />
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
                    {getVerdictBadge(digest.guide)}
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
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDiscard(digest.id);
                          }}
                          className="ml-1 text-red-400 hover:text-red-300 flex items-center gap-1"
                        >
                          <XCircle className="h-3 w-3" />
                          Discard
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
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDiscard(digest.id);
                          }}
                          className="ml-1 text-red-400 hover:text-red-300 flex items-center gap-1"
                        >
                          <XCircle className="h-3 w-3" />
                          Discard
                        </button>
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
        <DialogContent className="sm:max-w-[750px] max-h-[85vh] overflow-y-auto bg-card border-border rounded-lg shadow-md">
          {selectedDigest && (
            <>
              <DialogHeader>
                <div className="flex items-center gap-2 mb-1">
                  {sourceIcon(selectedDigest.source)}
                  <DialogTitle className="text-lg leading-snug">
                    {selectedDigest.title}
                  </DialogTitle>
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground flex-wrap">
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
                  {getVerdictBadge(selectedDigest.guide)}
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
              <div className="pt-2">
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
    </PageLayout>
  );
}

export default function DigestsPage() {
  return (
    <Suspense fallback={<SkeletonPage />}>
      <DigestsContent />
    </Suspense>
  );
}
