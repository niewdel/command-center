"use client";

import { useEffect, useState, useCallback } from "react";
import { Suspense } from "react";
import { supabase } from "@/lib/supabase";
import { NewsStory, NewsTopic } from "@/types/database";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageLayout } from "@/components/layout/page-layout";
import { SkeletonPage } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { Newspaper, ExternalLink, RefreshCw, X } from "lucide-react";

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
    if (filterTopic !== "all") query = query.eq("topic", filterTopic);
    const { data } = await query;
    setStories(data || []);
    setLoading(false);
  }, [filterTopic]);

  useEffect(() => { fetchStories(); }, [fetchStories]);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await fetch("/api/news/refresh", { method: "POST" });
      await fetchStories();
    } catch { /* silent */ }
    setRefreshing(false);
  };

  const timeAgo = (date: string | null) => {
    if (!date) return "";
    const diff = Date.now() - new Date(date).getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    if (hours < 1) return "just now";
    if (hours < 24) return `${hours}h ago`;
    return `${Math.floor(hours / 24)}d ago`;
  };

  if (loading) {
    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-[11px] font-medium uppercase text-muted-foreground">Top Stories</p>
        </div>
        <div className="space-y-2">{[1, 2, 3].map((i) => (<div key={i} className="h-16 rounded bg-muted/30 animate-pulse" />))}</div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-[11px] font-medium uppercase text-muted-foreground">Top Stories</p>
        <button onClick={handleRefresh} disabled={refreshing} className="text-xs text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1">
          <RefreshCw className={cn("size-3", refreshing && "animate-spin")} />
          {refreshing ? "Refreshing..." : "Refresh"}
        </button>
      </div>
      {stories.length === 0 ? (
        <div className="text-center py-8">
          <p className="text-sm text-muted-foreground">No stories yet</p>
          <button onClick={handleRefresh} disabled={refreshing} className="text-sm text-primary hover:underline mt-1">Fetch latest news</button>
        </div>
      ) : (
        <div className="divide-y divide-border">
          {stories.map((story) => (
            <a key={story.id} href={story.url} target="_blank" rel="noopener noreferrer" className="group flex items-start gap-3 py-3 transition-colors hover:bg-primary/[0.03] -mx-2 px-2 rounded">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium group-hover:text-primary transition-colors line-clamp-1">{story.title}</span>
                  <ExternalLink className="size-3 text-muted-foreground shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
                <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{story.summary}</p>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-[11px] text-muted-foreground">{story.source_name}</span>
                  <span className="text-[11px] text-muted-foreground/50">·</span>
                  <span className="text-[11px] text-muted-foreground font-mono tabular-nums">{timeAgo(story.published_at || story.fetched_at)}</span>
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

function TopicPills({ activeTopic, onTopicChange }: { activeTopic: string; onTopicChange: (topic: string) => void }) {
  const [topics, setTopics] = useState<NewsTopic[]>([]);
  const [showManage, setShowManage] = useState(false);
  const [newTopicName, setNewTopicName] = useState("");
  const [newTopicFeeds, setNewTopicFeeds] = useState("");

  const fetchTopics = useCallback(async () => {
    const { data } = await supabase.from("news_topics").select("*").order("position");
    setTopics(data || []);
  }, []);

  useEffect(() => { fetchTopics(); }, [fetchTopics]);

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
    const feeds = newTopicFeeds.split("\n").map((f) => f.trim()).filter(Boolean);
    await supabase.from("news_topics").insert({ name: newTopicName.trim(), keywords: [newTopicName.toLowerCase()], rss_feeds: feeds, position: topics.length });
    setNewTopicName(""); setNewTopicFeeds(""); fetchTopics();
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-1.5 flex-wrap">
        <span className="text-[11px] text-muted-foreground mr-1">Topics:</span>
        <button onClick={() => onTopicChange("all")} className={cn("px-2.5 py-1 rounded text-xs font-medium transition-colors", activeTopic === "all" ? "bg-primary/15 text-primary" : "text-muted-foreground hover:text-foreground")}>All</button>
        {topics.filter((t) => t.active).map((topic) => (
          <button key={topic.id} onClick={() => onTopicChange(topic.name === activeTopic ? "all" : topic.name)} className={cn("px-2.5 py-1 rounded text-xs font-medium transition-colors", activeTopic === topic.name ? "bg-primary/15 text-primary" : "text-muted-foreground hover:text-foreground")}>{topic.name}</button>
        ))}
        <button onClick={() => setShowManage(!showManage)} className="px-2 py-1 rounded text-xs text-muted-foreground hover:text-foreground transition-colors">{showManage ? "Done" : "Manage"}</button>
      </div>

      {showManage && (
        <div className="border border-border rounded p-3 space-y-3">
          <p className="text-[11px] font-medium uppercase text-muted-foreground">Your Topics</p>
          {topics.length === 0 ? (
            <p className="text-xs text-muted-foreground py-2">No topics yet. Add one below.</p>
          ) : (
            <div className="space-y-2">
              {topics.map((topic) => {
                const feeds: string[] = Array.isArray(topic.rss_feeds) ? topic.rss_feeds : [];
                const keywords: string[] = Array.isArray(topic.keywords) ? topic.keywords : [];
                return (
                  <div key={topic.id} className="border border-border/50 rounded p-2.5 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <button onClick={() => toggleTopic(topic.id, !topic.active)} className={cn("size-4 rounded border transition-colors shrink-0", topic.active ? "bg-primary border-primary" : "border-muted-foreground/40")} aria-label={topic.active ? "Disable" : "Enable"} />
                        <span className={cn("text-sm font-medium", !topic.active && "text-muted-foreground line-through")}>{topic.name}</span>
                        {!topic.active && <span className="text-[10px] text-muted-foreground">(disabled)</span>}
                      </div>
                      <button onClick={() => deleteTopic(topic.id)} className="p-1 text-muted-foreground hover:text-red-400 transition-colors"><X className="size-3.5" /></button>
                    </div>
                    {keywords.length > 0 && (
                      <div className="flex items-center gap-1 flex-wrap pl-6">
                        <span className="text-[10px] text-muted-foreground/60">Keywords:</span>
                        {keywords.map((kw) => (<span key={kw} className="text-[10px] text-muted-foreground bg-muted/50 px-1.5 py-0.5 rounded">{kw}</span>))}
                      </div>
                    )}
                    {feeds.length > 0 && (
                      <div className="pl-6 space-y-0.5">
                        <span className="text-[10px] text-muted-foreground/60">Feeds:</span>
                        {feeds.map((feed) => (<p key={feed} className="text-[10px] text-muted-foreground truncate" title={feed}>{feed}</p>))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
          <div className="border-t border-border pt-3 space-y-2">
            <p className="text-[11px] font-medium uppercase text-muted-foreground">Add Topic</p>
            <Input placeholder="Topic name (e.g. Machine Learning)" value={newTopicName} onChange={(e) => setNewTopicName(e.target.value)} className="h-8 text-sm" />
            <textarea placeholder="RSS feed URLs (one per line, optional)" value={newTopicFeeds} onChange={(e) => setNewTopicFeeds(e.target.value)} rows={2} className="w-full rounded border border-border bg-transparent px-3 py-2 text-xs placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-ring resize-none" />
            <Button onClick={addTopic} size="sm" variant="outline" className="h-7 text-xs" disabled={!newTopicName.trim()}>Add Topic</Button>
          </div>
        </div>
      )}
    </div>
  );
}

function NewsContent() {
  const [filterTopic, setFilterTopic] = useState<string>("all");

  return (
    <PageLayout title="News" icon={Newspaper} maxWidth="lg">
      <TopStories filterTopic={filterTopic} />
      <TopicPills activeTopic={filterTopic} onTopicChange={setFilterTopic} />
    </PageLayout>
  );
}

export default function NewsPage() {
  return (<Suspense fallback={<SkeletonPage />}><NewsContent /></Suspense>);
}
