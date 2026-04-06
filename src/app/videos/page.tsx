"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { supabase } from "@/lib/supabase";
import { ContentDigest } from "@/types/database";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { PageLayout } from "@/components/layout/page-layout";
import { SkeletonPage } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { Play, Plus, Search, ExternalLink, Clock, CheckCircle2, XCircle, Loader2, Camera, RefreshCw, Copy, Check, Trash2, Pencil } from "lucide-react";

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button onClick={async (e) => { e.stopPropagation(); await navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 2000); }} className="absolute top-2 right-2 p-1.5 rounded-md bg-foreground/10 hover:bg-foreground/20 text-muted-foreground hover:text-foreground transition-colors" aria-label="Copy code">
      {copied ? <Check className="size-3.5 text-emerald-400" /> : <Copy className="size-3.5" />}
    </button>
  );
}

function InlineMarkdown({ text }: { text: string }) {
  const parts: React.ReactNode[] = [];
  let remaining = text;
  let key = 0;
  while (remaining.length > 0) {
    const boldMatch = remaining.match(/\*\*(.+?)\*\*/);
    const codeMatch = remaining.match(/`([^`]+)`/);
    const linkMatch = remaining.match(/\[([^\]]+)\]\(([^)]+)\)/);
    const candidates = [
      boldMatch ? { type: "bold", index: boldMatch.index!, match: boldMatch } : null,
      codeMatch ? { type: "code", index: codeMatch.index!, match: codeMatch } : null,
      linkMatch ? { type: "link", index: linkMatch.index!, match: linkMatch } : null,
    ].filter(Boolean) as { type: string; index: number; match: RegExpMatchArray }[];
    if (candidates.length === 0) { parts.push(remaining); break; }
    const first = candidates.reduce((a, b) => (a.index < b.index ? a : b));
    if (first.index > 0) parts.push(remaining.slice(0, first.index));
    switch (first.type) {
      case "bold": parts.push(<strong key={key++} className="text-foreground font-semibold">{first.match[1]}</strong>); break;
      case "code": parts.push(<code key={key++} className="bg-muted/50 px-1.5 py-0.5 rounded text-[11px] text-pink-400 font-mono">{first.match[1]}</code>); break;
      case "link": parts.push(<a key={key++} href={first.match[2]} target="_blank" rel="noopener noreferrer" className="text-primary hover:text-primary/80 underline underline-offset-2">{first.match[1]}</a>); break;
    }
    remaining = remaining.slice(first.index + first.match[0].length);
  }
  return <>{parts}</>;
}

type Block = { type: "heading1"; content: string } | { type: "heading2"; content: string } | { type: "heading3"; content: string } | { type: "code"; content: string; lang?: string } | { type: "blockquote"; content: string } | { type: "checkbox"; content: string; checked: boolean } | { type: "list"; content: string } | { type: "numbered"; content: string; number: number } | { type: "paragraph"; content: string } | { type: "empty" };

function parseMarkdown(content: string): Block[] {
  const blocks: Block[] = [];
  const lines = content.split("\n");
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (line.startsWith("```")) { const lang = line.slice(3).trim() || undefined; const codeLines: string[] = []; i++; while (i < lines.length && !lines[i].startsWith("```")) { codeLines.push(lines[i]); i++; } blocks.push({ type: "code", content: codeLines.join("\n"), lang }); i++; continue; }
    if (line.startsWith("### ")) { blocks.push({ type: "heading3", content: line.slice(4) }); i++; continue; }
    if (line.startsWith("## ")) { blocks.push({ type: "heading2", content: line.slice(3) }); i++; continue; }
    if (line.startsWith("# ")) { blocks.push({ type: "heading1", content: line.slice(2) }); i++; continue; }
    if (line.startsWith("> ")) { blocks.push({ type: "blockquote", content: line.slice(2) }); i++; continue; }
    if (line.match(/^- \[[ x]\] /)) { blocks.push({ type: "checkbox", content: line.slice(6), checked: line.charAt(3) === "x" }); i++; continue; }
    if (line.match(/^[-*] /)) { blocks.push({ type: "list", content: line.slice(2) }); i++; continue; }
    const numMatch = line.match(/^(\d+)\. (.+)/);
    if (numMatch) { blocks.push({ type: "numbered", content: numMatch[2], number: parseInt(numMatch[1], 10) }); i++; continue; }
    if (line.trim() === "") { blocks.push({ type: "empty" }); i++; continue; }
    blocks.push({ type: "paragraph", content: line }); i++;
  }
  return blocks;
}

function MarkdownRenderer({ content }: { content: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const blocks = parseMarkdown(content);
  return (
    <div ref={containerRef} className="space-y-0">
      {blocks.map((block, i) => {
        switch (block.type) {
          case "heading1": return <h1 key={i} className="text-lg font-bold mt-4 mb-3 text-foreground text-balance">{block.content}</h1>;
          case "heading2": return <h2 key={i} className="text-base font-bold mt-6 mb-2 text-foreground text-balance">{block.content}</h2>;
          case "heading3": return <h3 key={i} className="text-sm font-semibold mt-4 mb-1 text-foreground">{block.content}</h3>;
          case "code": return (<div key={i} className="relative group my-3"><CopyButton text={block.content} />{block.lang && <span className="absolute top-2 left-3 text-[10px] uppercase tracking-wide text-muted-foreground/60 font-mono">{block.lang}</span>}<pre className={cn("bg-background/80 border border-border/50 rounded overflow-x-auto text-xs font-mono leading-relaxed", block.lang ? "pt-7 pb-3 px-3" : "p-3")}><code>{block.content}</code></pre></div>);
          case "blockquote": return <blockquote key={i} className="border-l-2 border-primary/30 pl-3 my-2 text-sm text-muted-foreground italic"><InlineMarkdown text={block.content} /></blockquote>;
          case "checkbox": return (<div key={i} className="flex items-start gap-2 my-1 ml-1"><div className={cn("mt-0.5 size-4 rounded border flex items-center justify-center shrink-0", block.checked ? "bg-emerald-500/20 border-emerald-500/40" : "border-border/60")}>{block.checked && <Check className="size-2.5 text-emerald-400" />}</div><span className="text-sm text-muted-foreground leading-relaxed"><InlineMarkdown text={block.content} /></span></div>);
          case "list": return <li key={i} className="text-sm text-muted-foreground ml-4 list-disc leading-relaxed"><InlineMarkdown text={block.content} /></li>;
          case "numbered": return <li key={i} className="text-sm text-muted-foreground ml-4 list-decimal leading-relaxed" value={block.number}><InlineMarkdown text={block.content} /></li>;
          case "paragraph": return <p key={i} className="text-sm text-muted-foreground leading-relaxed text-pretty my-1.5"><InlineMarkdown text={block.content} /></p>;
          case "empty": return <div key={i} className="h-2" />;
          default: return null;
        }
      })}
    </div>
  );
}

function VideosContent() {
  const searchParams = useSearchParams();
  const highlightId = searchParams.get("id");
  const [digests, setDigests] = useState<ContentDigest[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterTag, setFilterTag] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedDigest, setSelectedDigest] = useState<ContentDigest | null>(null);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [addUrl, setAddUrl] = useState("");
  const [addLoading, setAddLoading] = useState(false);
  const [addError, setAddError] = useState("");
  const [editingTitleId, setEditingTitleId] = useState<string | null>(null);
  const [editingTitleValue, setEditingTitleValue] = useState("");

  const fetchDigests = useCallback(async () => {
    const { data } = await supabase.from("content_digests").select("*").order("created_at", { ascending: false });
    setDigests(data || []);
    setLoading(false);
    if (highlightId && data) { const found = data.find((d) => d.id === highlightId); if (found) setSelectedDigest(found); }
  }, [highlightId]);

  useEffect(() => {
    fetchDigests();
    const channel = supabase.channel("digests-realtime").on("postgres_changes", { event: "*", schema: "public", table: "content_digests" }, () => fetchDigests()).subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [fetchDigests]);

  const allTags = Array.from(new Set(digests.flatMap((d) => d.tags || []))).sort();
  const filtered = digests.filter((d) => {
    if (filterStatus !== "all" && d.status !== filterStatus) return false;
    if (filterTag !== "all" && !(d.tags || []).includes(filterTag)) return false;
    if (searchQuery) { const q = searchQuery.toLowerCase(); return (d.title || "").toLowerCase().includes(q) || (d.guide || "").toLowerCase().includes(q) || d.url.toLowerCase().includes(q) || (d.tags || []).some((t) => t.includes(q)); }
    return true;
  });

  const handleAddUrl = async () => {
    if (!addUrl.trim()) return;
    setAddLoading(true); setAddError("");
    try {
      const res = await fetch("/api/digest/ingest", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ url: addUrl.trim() }) });
      const data = await res.json();
      if (!res.ok) { setAddError(data.error || "Failed to add URL"); setAddLoading(false); return; }
      setAddUrl(""); setShowAddDialog(false); fetchDigests();
    } catch { setAddError("Failed to submit URL"); }
    setAddLoading(false);
  };

  const handleRetry = async (digestId: string) => {
    await supabase.from("content_digests").update({ status: "queued", error_message: null, updated_at: new Date().toISOString() }).eq("id", digestId);
    fetchDigests();
    await fetch("/api/digest/retry", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ digestId }) });
    fetchDigests();
  };

  const handleDiscard = async (digestId: string) => {
    await supabase.from("content_digests").delete().eq("id", digestId);
    setDigests((prev) => prev.filter((d) => d.id !== digestId));
    if (selectedDigest?.id === digestId) setSelectedDigest(null);
  };

  const handleSaveTitle = async (digestId: string) => {
    const trimmed = editingTitleValue.trim();
    if (!trimmed) return;
    await supabase.from("content_digests").update({ title: trimmed, updated_at: new Date().toISOString() }).eq("id", digestId);
    setDigests((prev) => prev.map((d) => d.id === digestId ? { ...d, title: trimmed } : d));
    if (selectedDigest?.id === digestId) setSelectedDigest({ ...selectedDigest, title: trimmed });
    setEditingTitleId(null);
  };

  const statusIcon = (status: string) => { switch (status) { case "queued": return <Clock className="h-3.5 w-3.5 text-yellow-400" />; case "processing": return <Loader2 className="h-3.5 w-3.5 text-primary animate-spin" />; case "completed": return <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />; case "failed": return <XCircle className="h-3.5 w-3.5 text-red-400" />; default: return null; } };
  const sourceIcon = (source: string) => { switch (source) { case "youtube": return <Play className="size-4 text-red-500" />; case "instagram": return <Camera className="size-4 text-pink-500" />; default: return <ExternalLink className="size-4 text-muted-foreground" />; } };
  const getVerdictBadge = (guide: string | null) => { if (!guide) return null; const m = guide.match(/\b(MUST-ACT|WORTH EXPLORING|REFERENCE ONLY|SKIP)\b/); if (!m) return null; const v = m[1]; const c: Record<string, string> = { "MUST-ACT": "bg-emerald-500/20 text-emerald-400 border-emerald-500/30", "WORTH EXPLORING": "bg-primary/20 text-primary border-primary/30", "REFERENCE ONLY": "bg-yellow-500/20 text-yellow-400 border-yellow-500/30", "SKIP": "bg-muted text-muted-foreground border-border/50" }; return <span className={cn("text-[10px] font-semibold px-1.5 py-0.5 rounded border", c[v])}>{v}</span>; };

  return (
    <PageLayout title="Videos" icon={Play} loading={loading} maxWidth="lg" actions={<Button onClick={() => setShowAddDialog(true)} variant="outline" size="sm" className="gap-1.5 h-8"><Plus className="size-3.5" />Add Link</Button>}>
      <div className="space-y-3">
        <div className="relative"><Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" /><Input value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Search guides, tags, URLs..." className="pl-10 bg-card border-border rounded h-10" /></div>
        <div className="flex gap-2 flex-wrap">{["all", "completed", "processing", "queued", "failed"].map((s) => (<button key={s} onClick={() => setFilterStatus(s)} className={cn("px-3 py-1.5 rounded text-xs font-medium transition-colors", filterStatus === s ? "bg-primary text-primary-foreground" : "bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground")}>{s.charAt(0).toUpperCase() + s.slice(1)}</button>))}</div>
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-16"><p className="text-sm text-muted-foreground">No video digests yet</p><p className="text-xs text-muted-foreground mt-1">Send a YouTube link to your Telegram bot or add one above.</p></div>
      ) : (
        <div className="grid gap-3">{filtered.map((digest) => (
          <div key={digest.id} className={cn("group rounded border border-border bg-card/50 p-4 hover:bg-card transition-colors cursor-pointer hud-glow-hover", highlightId === digest.id && "ring-2 ring-primary/50")} onClick={() => digest.status === "completed" && setSelectedDigest(digest)}>
            <div className="flex items-start gap-4">
              {digest.thumbnail_url ? (<div className="hidden sm:block shrink-0 w-24 h-16 rounded overflow-hidden bg-muted"><img src={digest.thumbnail_url} alt="" className="w-full h-full object-cover" /></div>) : (<div className="hidden sm:flex shrink-0 w-24 h-16 rounded bg-muted/50 items-center justify-center">{sourceIcon(digest.source)}</div>)}
              <div className="flex-1 min-w-0 space-y-1.5">
                <div className="flex items-center gap-2">
                  {statusIcon(digest.status)}{sourceIcon(digest.source)}
                  {editingTitleId === digest.id ? (
                    <input
                      autoFocus
                      value={editingTitleValue}
                      onChange={(e) => setEditingTitleValue(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter") handleSaveTitle(digest.id); if (e.key === "Escape") setEditingTitleId(null); }}
                      onBlur={() => handleSaveTitle(digest.id)}
                      onClick={(e) => e.stopPropagation()}
                      className="text-sm font-semibold flex-1 bg-background/50 border border-border rounded px-2 py-0.5 outline-none focus:ring-1 focus:ring-primary"
                    />
                  ) : (
                    <h3 className="text-sm font-semibold truncate flex-1">{digest.title || digest.url}</h3>
                  )}
                  {editingTitleId !== digest.id && (
                    <button onClick={(e) => { e.stopPropagation(); setEditingTitleId(digest.id); setEditingTitleValue(digest.title || ""); }} className="shrink-0 p-1 rounded text-muted-foreground hover:text-foreground transition-colors opacity-0 group-hover:opacity-100" aria-label="Edit title"><Pencil className="size-3" /></button>
                  )}
                  {getVerdictBadge(digest.guide)}
                </div>
                <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                  <span className="font-mono">{new Date(digest.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</span>
                  {digest.status === "failed" && digest.error_message && (<><span className="text-border">|</span><span className="text-red-400 truncate max-w-[200px]">{digest.error_message}</span><button onClick={(e) => { e.stopPropagation(); handleRetry(digest.id); }} className="ml-1 text-primary hover:text-primary/80 flex items-center gap-1"><RefreshCw className="h-3 w-3" />Retry</button><button onClick={(e) => { e.stopPropagation(); handleDiscard(digest.id); }} className="ml-1 text-red-400 hover:text-red-300 flex items-center gap-1"><XCircle className="h-3 w-3" />Discard</button></>)}
                  {digest.status === "processing" && (<><span className="text-border">|</span><span className="text-primary">Processing...</span></>)}
                  {digest.status === "queued" && (<><span className="text-border">|</span><span className="text-yellow-400">In queue</span><button onClick={(e) => { e.stopPropagation(); handleDiscard(digest.id); }} className="ml-1 text-red-400 hover:text-red-300 flex items-center gap-1"><XCircle className="h-3 w-3" />Discard</button></>)}
                  {(digest.status === "completed" || digest.status === "queued") && (<><span className="text-border">|</span><button onClick={(e) => { e.stopPropagation(); handleDiscard(digest.id); }} className="text-red-400 hover:text-red-300 flex items-center gap-1"><Trash2 className="h-3 w-3" />Delete</button></>)}
                </div>
              </div>
              <a href={digest.url} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} className="shrink-0 p-2 rounded text-muted-foreground hover:text-foreground hover:bg-accent/50 transition-colors opacity-0 group-hover:opacity-100"><ExternalLink className="size-4" /></a>
            </div>
          </div>
        ))}</div>
      )}

      <Dialog open={!!selectedDigest} onOpenChange={() => setSelectedDigest(null)}>
        <DialogContent className="sm:max-w-[750px] max-h-[90dvh] h-[90dvh] sm:h-auto overflow-y-auto bg-card border-border rounded shadow-md mx-2 sm:mx-auto">
          {selectedDigest && (<><DialogHeader><div className="flex items-center gap-2 mb-1 pr-8">
            {sourceIcon(selectedDigest.source)}
            {editingTitleId === selectedDigest.id ? (
              <input
                autoFocus
                value={editingTitleValue}
                onChange={(e) => setEditingTitleValue(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") handleSaveTitle(selectedDigest.id); if (e.key === "Escape") setEditingTitleId(null); }}
                onBlur={() => handleSaveTitle(selectedDigest.id)}
                className="text-lg font-semibold flex-1 bg-background/50 border border-border rounded px-2 py-0.5 outline-none focus:ring-1 focus:ring-primary"
              />
            ) : (
              <DialogTitle className="text-lg leading-snug flex-1">{selectedDigest.title}</DialogTitle>
            )}
            {editingTitleId !== selectedDigest.id && (
              <button onClick={() => { setEditingTitleId(selectedDigest.id); setEditingTitleValue(selectedDigest.title || ""); }} className="shrink-0 p-1 rounded text-muted-foreground hover:text-foreground transition-colors" aria-label="Edit title"><Pencil className="size-3.5" /></button>
            )}
          </div><div className="flex items-center gap-2 text-xs text-muted-foreground flex-wrap"><a href={selectedDigest.url} target="_blank" rel="noopener noreferrer" className="text-primary hover:text-primary/80 flex items-center gap-1"><ExternalLink className="h-3 w-3" />Original video</a><span className="text-border">|</span><span className="font-mono">{new Date(selectedDigest.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</span>{getVerdictBadge(selectedDigest.guide)}<span className="text-border">|</span><button onClick={() => { handleDiscard(selectedDigest.id); }} className="text-red-400 hover:text-red-300 flex items-center gap-1"><Trash2 className="h-3 w-3" />Delete</button></div></DialogHeader><div className="pt-2"><MarkdownRenderer content={selectedDigest.guide || ""} /></div></>)}
        </DialogContent>
      </Dialog>

      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="sm:max-w-[500px] max-h-[85dvh] overflow-y-auto bg-card border-border rounded shadow-md">
          <DialogHeader><DialogTitle>Add Video Link</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <Input autoFocus value={addUrl} onChange={(e) => { setAddUrl(e.target.value); setAddError(""); }} placeholder="Paste YouTube or Instagram URL..." className="bg-card border-border rounded h-11" onKeyDown={(e) => e.key === "Enter" && handleAddUrl()} />
            {addError && <p className="text-xs text-red-400 text-pretty">{addError}</p>}
            <div className="flex justify-end gap-2"><Button variant="ghost" onClick={() => setShowAddDialog(false)} className="rounded">Cancel</Button><Button onClick={handleAddUrl} disabled={!addUrl.trim() || addLoading} className="bg-primary hover:bg-primary/90 text-primary-foreground border-0 rounded">{addLoading ? (<><Loader2 className="size-4 animate-spin mr-2" />Adding...</>) : "Add & Process"}</Button></div>
          </div>
        </DialogContent>
      </Dialog>
    </PageLayout>
  );
}

export default function VideosPage() {
  return (<Suspense fallback={<SkeletonPage />}><VideosContent /></Suspense>);
}
