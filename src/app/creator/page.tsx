"use client";

import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { useRealtime } from "@/lib/providers/realtime-provider";
import { CreatorIdea, CreatorHook, ContentDigest } from "@/types/database";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { PageLayout } from "@/components/layout/page-layout";
import { cn } from "@/lib/utils";
import {
  Clapperboard,
  Plus,
  Lightbulb,
  Mic,
  Film,
  Send,
  Archive,
  CalendarDays,
  BarChart3,
  Pencil,
  Trash2,
  ExternalLink,
  CheckCircle2,
  Circle,
} from "lucide-react";

type Tab = "ideas" | "hooks" | "calendar" | "performance";
type Pillar = NonNullable<CreatorIdea["pillar"]>;
type IdeaStatus = CreatorIdea["status"];
type HookCategory = NonNullable<CreatorHook["category"]>;

const STATUSES: { value: IdeaStatus; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { value: "idea", label: "Idea", icon: Lightbulb },
  { value: "scripted", label: "Scripted", icon: Pencil },
  { value: "recorded", label: "Recorded", icon: Mic },
  { value: "edited", label: "Edited", icon: Film },
  { value: "posted", label: "Posted", icon: Send },
  { value: "archived", label: "Archived", icon: Archive },
];

const PILLARS: { value: Pillar; label: string; color: string }[] = [
  { value: "build_breakdown", label: "Build breakdown", color: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30" },
  { value: "slop_callout", label: "Slop callout", color: "bg-red-500/20 text-red-400 border-red-500/30" },
  { value: "tactical_tip", label: "Tactical tip", color: "bg-primary/20 text-primary border-primary/30" },
  { value: "trend_reaction", label: "Trend reaction", color: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30" },
];

const HOOK_CATEGORIES: { value: HookCategory; label: string }[] = [
  { value: "cognitive_dissonance", label: "Cognitive dissonance" },
  { value: "pattern_interrupt", label: "Pattern interrupt" },
  { value: "curiosity_gap", label: "Curiosity gap" },
  { value: "authority_flex", label: "Authority flex" },
  { value: "controversy", label: "Controversy" },
  { value: "list_promise", label: "List promise" },
  { value: "other", label: "Other" },
];

function pillarLabel(p: Pillar | null) {
  return PILLARS.find((x) => x.value === p)?.label || "—";
}

function pillarColor(p: Pillar | null) {
  return PILLARS.find((x) => x.value === p)?.color || "bg-muted text-muted-foreground border-border/50";
}

export default function CreatorHubPage() {
  const [tab, setTab] = useState<Tab>("ideas");
  const [ideas, setIdeas] = useState<CreatorIdea[]>([]);
  const [hooks, setHooks] = useState<CreatorHook[]>([]);
  const [inspirations, setInspirations] = useState<ContentDigest[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<IdeaStatus | "all">("all");
  const [filterPillar, setFilterPillar] = useState<Pillar | "all">("all");
  const [selectedIdea, setSelectedIdea] = useState<CreatorIdea | null>(null);
  const [selectedHook, setSelectedHook] = useState<CreatorHook | null>(null);
  const [showAddIdea, setShowAddIdea] = useState(false);
  const [showAddHook, setShowAddHook] = useState(false);

  const fetchAll = useCallback(async () => {
    const [ideasRes, hooksRes, inspoRes] = await Promise.all([
      supabase.from("creator_ideas").select("*").order("created_at", { ascending: false }),
      supabase.from("creator_hooks").select("*").order("position", { ascending: true }).order("created_at", { ascending: false }),
      supabase.from("content_digests").select("*").eq("kind", "inspiration").order("created_at", { ascending: false }),
    ]);
    setIdeas(ideasRes.data || []);
    setHooks(hooksRes.data || []);
    setInspirations(inspoRes.data || []);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  // Shared realtime hub: one channel per table, reused across pages.
  useRealtime("creator_ideas", fetchAll);
  useRealtime("creator_hooks", fetchAll);

  const filteredIdeas = ideas.filter((i) => {
    if (filterStatus !== "all" && i.status !== filterStatus) return false;
    if (filterPillar !== "all" && i.pillar !== filterPillar) return false;
    return true;
  });

  const counts: Record<IdeaStatus, number> = {
    idea: 0, scripted: 0, recorded: 0, edited: 0, posted: 0, archived: 0,
  };
  for (const i of ideas) counts[i.status]++;

  const postedIdeas = ideas.filter((i) => i.status === "posted").sort((a, b) => {
    const ta = a.posted_at ? new Date(a.posted_at).getTime() : 0;
    const tb = b.posted_at ? new Date(b.posted_at).getTime() : 0;
    return tb - ta;
  });

  const tabButton = (value: Tab, label: string, Icon: React.ComponentType<{ className?: string }>) => (
    <button
      key={value}
      onClick={() => setTab(value)}
      className={cn(
        "flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium transition-colors",
        tab === value ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground"
      )}
    >
      <Icon className="size-3.5" />{label}
    </button>
  );

  const pageActions = (
    <>
      {tab === "ideas" && (
        <Button onClick={() => setShowAddIdea(true)} variant="outline" size="sm" className="gap-1.5 h-8">
          <Plus className="size-3.5" />New idea
        </Button>
      )}
      {tab === "hooks" && (
        <Button onClick={() => setShowAddHook(true)} variant="outline" size="sm" className="gap-1.5 h-8">
          <Plus className="size-3.5" />New hook
        </Button>
      )}
    </>
  );

  return (
    <PageLayout
      title="Creator Hub"
      eyebrow="Tool · Content"
      icon={Clapperboard}
      loading={loading}
      maxWidth="lg"
      actions={pageActions}
    >
      <div className="space-y-3">
        <div className="inline-flex rounded border border-border bg-card/50 p-0.5 flex-wrap">
          {tabButton("ideas", "Ideas", Lightbulb)}
          {tabButton("hooks", "Hooks", Pencil)}
          {tabButton("calendar", "Calendar", CalendarDays)}
          {tabButton("performance", "Performance", BarChart3)}
        </div>
      </div>

      {tab === "ideas" && (
        <IdeasTab
          ideas={filteredIdeas}
          counts={counts}
          filterStatus={filterStatus}
          setFilterStatus={setFilterStatus}
          filterPillar={filterPillar}
          setFilterPillar={setFilterPillar}
          onSelect={setSelectedIdea}
        />
      )}

      {tab === "hooks" && <HooksTab hooks={hooks} onSelect={setSelectedHook} />}

      {tab === "calendar" && <CalendarTab posted={postedIdeas} />}

      {tab === "performance" && <PerformanceTab posted={postedIdeas} onSelect={setSelectedIdea} />}

      <IdeaDialog
        idea={selectedIdea}
        inspirations={inspirations}
        onClose={() => setSelectedIdea(null)}
        onChange={() => fetchAll()}
      />

      <HookDialog hook={selectedHook} onClose={() => setSelectedHook(null)} onChange={() => fetchAll()} />

      <AddIdeaDialog open={showAddIdea} onOpenChange={setShowAddIdea} onAdded={() => fetchAll()} />
      <AddHookDialog open={showAddHook} onOpenChange={setShowAddHook} onAdded={() => fetchAll()} />
    </PageLayout>
  );
}

function IdeasTab({
  ideas, counts, filterStatus, setFilterStatus, filterPillar, setFilterPillar, onSelect,
}: {
  ideas: CreatorIdea[];
  counts: Record<IdeaStatus, number>;
  filterStatus: IdeaStatus | "all";
  setFilterStatus: (s: IdeaStatus | "all") => void;
  filterPillar: Pillar | "all";
  setFilterPillar: (p: Pillar | "all") => void;
  onSelect: (i: CreatorIdea) => void;
}) {
  const totalCount = Object.values(counts).reduce((a, b) => a + b, 0);
  return (
    <div className="space-y-3">
      <div className="flex gap-2 flex-wrap">
        <button onClick={() => setFilterStatus("all")} className={cn("px-3 py-1.5 rounded text-xs font-medium transition-colors", filterStatus === "all" ? "bg-primary text-primary-foreground" : "bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground")}>All <span className="opacity-70 tabular-nums">{totalCount}</span></button>
        {STATUSES.map((s) => (
          <button key={s.value} onClick={() => setFilterStatus(s.value)} className={cn("flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium transition-colors", filterStatus === s.value ? "bg-primary text-primary-foreground" : "bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground")}>
            <s.icon className="size-3" />{s.label} <span className="opacity-70 tabular-nums">{counts[s.value]}</span>
          </button>
        ))}
      </div>
      <div className="flex gap-2 flex-wrap">
        <button onClick={() => setFilterPillar("all")} className={cn("px-2.5 py-1 rounded text-[11px] font-medium transition-colors border", filterPillar === "all" ? "border-foreground text-foreground" : "border-border/50 text-muted-foreground hover:text-foreground")}>All pillars</button>
        {PILLARS.map((p) => (
          <button key={p.value} onClick={() => setFilterPillar(p.value)} className={cn("px-2.5 py-1 rounded text-[11px] font-medium transition-colors border", filterPillar === p.value ? "border-foreground text-foreground" : "border-border/50 text-muted-foreground hover:text-foreground")}>{p.label}</button>
        ))}
      </div>
      {ideas.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-sm text-muted-foreground">No ideas yet</p>
          <p className="text-xs text-muted-foreground mt-1">Hit &quot;New idea&quot; to start the pipeline.</p>
        </div>
      ) : (
        <div className="grid gap-2">
          {ideas.map((idea) => {
            const StatusIcon = STATUSES.find((s) => s.value === idea.status)?.icon || Circle;
            return (
              <div key={idea.id} onClick={() => onSelect(idea)} className="group rounded border border-border bg-card/50 p-3 hover:bg-card transition-colors cursor-pointer">
                <div className="flex items-start gap-3">
                  <div className="flex items-center justify-center size-8 rounded bg-muted/50 shrink-0"><StatusIcon className="size-4 text-muted-foreground" /></div>
                  <div className="flex-1 min-w-0 space-y-1">
                    <h3 className="text-sm font-semibold truncate">{idea.title}</h3>
                    {idea.hook && <p className="text-xs text-muted-foreground truncate text-pretty">{idea.hook}</p>}
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[10px] font-medium text-muted-foreground capitalize">{idea.status}</span>
                      {idea.pillar && (
                        <span className={cn("text-[10px] font-semibold px-1.5 py-0.5 rounded border", pillarColor(idea.pillar))}>{pillarLabel(idea.pillar)}</span>
                      )}
                      <span className="text-[10px] text-muted-foreground font-mono">{new Date(idea.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function HooksTab({ hooks, onSelect }: { hooks: CreatorHook[]; onSelect: (h: CreatorHook) => void }) {
  const tested = hooks.filter((h) => h.tested).length;
  return (
    <div className="space-y-3">
      <div className="rounded border border-border bg-card/50 p-3 flex items-center gap-3">
        <div className="flex-1">
          <p className="text-sm font-semibold">Hook library — {hooks.length} patterns, {tested} tested</p>
          <p className="text-xs text-muted-foreground text-pretty">Phase 1 exit criteria: 25 tested patterns. Each one gets used in a real video before it counts as tested.</p>
        </div>
      </div>
      {hooks.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-sm text-muted-foreground">No hooks yet</p>
          <p className="text-xs text-muted-foreground mt-1">Hit &quot;New hook&quot; to start the library.</p>
        </div>
      ) : (
        <div className="grid gap-2">
          {hooks.map((hook) => (
            <div key={hook.id} onClick={() => onSelect(hook)} className="group rounded border border-border bg-card/50 p-3 hover:bg-card transition-colors cursor-pointer">
              <div className="flex items-start gap-3">
                <div className="flex items-center justify-center size-8 rounded bg-muted/50 shrink-0">
                  {hook.tested ? <CheckCircle2 className="size-4 text-emerald-400" /> : <Circle className="size-4 text-muted-foreground" />}
                </div>
                <div className="flex-1 min-w-0 space-y-1">
                  <p className="text-sm font-semibold text-pretty">{hook.pattern}</p>
                  {hook.example && <p className="text-xs text-muted-foreground italic text-pretty">&ldquo;{hook.example}&rdquo;</p>}
                  <div className="flex items-center gap-2">
                    {hook.category && (
                      <span className="text-[10px] font-medium text-muted-foreground capitalize">{HOOK_CATEGORIES.find((c) => c.value === hook.category)?.label}</span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function CalendarTab({ posted }: { posted: CreatorIdea[] }) {
  const grouped = posted.reduce<Record<string, CreatorIdea[]>>((acc, idea) => {
    const date = idea.posted_at ? new Date(idea.posted_at).toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" }) : "Undated";
    (acc[date] = acc[date] || []).push(idea);
    return acc;
  }, {});
  return (
    <div className="space-y-3">
      <div className="rounded border border-border bg-card/50 p-3">
        <p className="text-xs text-muted-foreground text-pretty">Posted videos by date. Set <code className="text-[10px] bg-background/60 px-1 py-0.5 rounded">posted_at</code> on each idea when it goes live.</p>
      </div>
      {posted.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-sm text-muted-foreground">Nothing posted yet</p>
          <p className="text-xs text-muted-foreground mt-1">Posted ideas show up here once their status is &quot;posted&quot;.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {Object.entries(grouped).map(([date, items]) => (
            <div key={date} className="space-y-2">
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-tight">{date}</h3>
              {items.map((idea) => (
                <div key={idea.id} className="rounded border border-border bg-card/50 p-3">
                  <p className="text-sm font-semibold">{idea.title}</p>
                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                    {idea.posted_url_tiktok && <a href={idea.posted_url_tiktok} target="_blank" rel="noopener noreferrer" className="text-[11px] text-primary hover:text-primary/80 flex items-center gap-1"><ExternalLink className="size-3" />TikTok</a>}
                    {idea.posted_url_instagram && <a href={idea.posted_url_instagram} target="_blank" rel="noopener noreferrer" className="text-[11px] text-primary hover:text-primary/80 flex items-center gap-1"><ExternalLink className="size-3" />Instagram</a>}
                    {idea.posted_url_youtube && <a href={idea.posted_url_youtube} target="_blank" rel="noopener noreferrer" className="text-[11px] text-primary hover:text-primary/80 flex items-center gap-1"><ExternalLink className="size-3" />YouTube</a>}
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function PerformanceTab({ posted, onSelect }: { posted: CreatorIdea[]; onSelect: (i: CreatorIdea) => void }) {
  const totals = posted.reduce(
    (acc, i) => ({
      tt: acc.tt + (i.views_tiktok || 0),
      ig: acc.ig + (i.views_instagram || 0),
      yt: acc.yt + (i.views_youtube || 0),
    }),
    { tt: 0, ig: 0, yt: 0 }
  );
  const topPerformers = [...posted].sort((a, b) => {
    const aSum = (a.views_tiktok || 0) + (a.views_instagram || 0) + (a.views_youtube || 0);
    const bSum = (b.views_tiktok || 0) + (b.views_instagram || 0) + (b.views_youtube || 0);
    return bSum - aSum;
  }).slice(0, 10);
  return (
    <div className="space-y-3">
      <div className="rounded border border-border bg-card/50 p-3">
        <p className="text-xs text-muted-foreground text-pretty">Manual entry for now (open an idea, type in the view counts). Phase 2 candidate: auto-pull from each platform&apos;s API.</p>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded border border-border bg-card/50 p-3"><p className="text-[10px] uppercase text-muted-foreground tracking-tight">TikTok</p><p className="text-xl font-bold tabular-nums">{totals.tt.toLocaleString()}</p></div>
        <div className="rounded border border-border bg-card/50 p-3"><p className="text-[10px] uppercase text-muted-foreground tracking-tight">Instagram</p><p className="text-xl font-bold tabular-nums">{totals.ig.toLocaleString()}</p></div>
        <div className="rounded border border-border bg-card/50 p-3"><p className="text-[10px] uppercase text-muted-foreground tracking-tight">YouTube</p><p className="text-xl font-bold tabular-nums">{totals.yt.toLocaleString()}</p></div>
      </div>
      {topPerformers.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-sm text-muted-foreground">No performance data yet</p>
        </div>
      ) : (
        <div className="space-y-2">
          <h3 className="text-xs font-semibold text-muted-foreground uppercase">Top performers</h3>
          {topPerformers.map((idea) => {
            const sum = (idea.views_tiktok || 0) + (idea.views_instagram || 0) + (idea.views_youtube || 0);
            return (
              <div key={idea.id} onClick={() => onSelect(idea)} className="rounded border border-border bg-card/50 p-3 hover:bg-card transition-colors cursor-pointer">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold truncate">{idea.title}</p>
                    <div className="flex items-center gap-2 text-[11px] text-muted-foreground tabular-nums mt-0.5">
                      <span>TT {idea.views_tiktok?.toLocaleString() ?? "—"}</span>
                      <span>IG {idea.views_instagram?.toLocaleString() ?? "—"}</span>
                      <span>YT {idea.views_youtube?.toLocaleString() ?? "—"}</span>
                    </div>
                  </div>
                  <p className="text-lg font-bold tabular-nums shrink-0">{sum.toLocaleString()}</p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function IdeaDialog({ idea, inspirations, onClose, onChange }: { idea: CreatorIdea | null; inspirations: ContentDigest[]; onClose: () => void; onChange: () => void }) {
  const [draft, setDraft] = useState<CreatorIdea | null>(null);

  useEffect(() => {
    setDraft(idea);
  }, [idea]);

  if (!draft) return null;

  const save = async (patch: Partial<CreatorIdea>) => {
    const next = { ...draft, ...patch, updated_at: new Date().toISOString() };
    setDraft(next);
    await supabase.from("creator_ideas").update({ ...patch, updated_at: next.updated_at }).eq("id", draft.id);
    onChange();
  };

  const remove = async () => {
    if (!confirm("Delete this idea?")) return;
    await supabase.from("creator_ideas").delete().eq("id", draft.id);
    onChange();
    onClose();
  };

  const linkedInspos = inspirations.filter((i) => draft.inspiration_ids.includes(i.id));

  return (
    <Dialog open={!!idea} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[700px] max-h-[90dvh] overflow-y-auto bg-card border-border rounded shadow-md">
        <DialogHeader>
          <DialogTitle className="text-lg leading-snug pr-8">
            <input value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} onBlur={() => save({ title: draft.title })} className="w-full bg-transparent outline-none focus:ring-1 focus:ring-primary rounded px-1" />
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div>
            <label className="text-[10px] uppercase text-muted-foreground tracking-tight block mb-1">Status</label>
            <div className="flex gap-1.5 flex-wrap">
              {STATUSES.map((s) => (
                <button key={s.value} onClick={() => save({ status: s.value, posted_at: s.value === "posted" && !draft.posted_at ? new Date().toISOString() : draft.posted_at })} className={cn("flex items-center gap-1 px-2.5 py-1 rounded text-[11px] font-medium border transition-colors", draft.status === s.value ? "bg-foreground text-background border-foreground" : "border-border/50 text-muted-foreground hover:text-foreground")}>
                  <s.icon className="size-3" />{s.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-[10px] uppercase text-muted-foreground tracking-tight block mb-1">Pillar</label>
            <div className="flex gap-1.5 flex-wrap">
              <button onClick={() => save({ pillar: null })} className={cn("px-2.5 py-1 rounded text-[11px] font-medium border", !draft.pillar ? "border-foreground text-foreground" : "border-border/50 text-muted-foreground")}>None</button>
              {PILLARS.map((p) => (
                <button key={p.value} onClick={() => save({ pillar: p.value })} className={cn("px-2.5 py-1 rounded text-[11px] font-semibold border", draft.pillar === p.value ? p.color : "border-border/50 text-muted-foreground hover:text-foreground")}>{p.label}</button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-[10px] uppercase text-muted-foreground tracking-tight block mb-1">Hook</label>
            <textarea value={draft.hook || ""} onChange={(e) => setDraft({ ...draft, hook: e.target.value })} onBlur={() => save({ hook: draft.hook })} placeholder="The first 3 seconds — make it impossible to scroll past." className="w-full bg-background/50 border border-border rounded px-2 py-1.5 text-sm outline-none focus:ring-1 focus:ring-primary min-h-[60px] resize-y" />
          </div>

          <div>
            <label className="text-[10px] uppercase text-muted-foreground tracking-tight block mb-1">Script</label>
            <textarea value={draft.script || ""} onChange={(e) => setDraft({ ...draft, script: e.target.value })} onBlur={() => save({ script: draft.script })} placeholder="Beat-by-beat script. Rehook every 5-7s. Pattern interrupt at 0:08, 0:15, 0:22..." className="w-full bg-background/50 border border-border rounded px-2 py-1.5 text-sm font-mono outline-none focus:ring-1 focus:ring-primary min-h-[200px] resize-y" />
          </div>

          <div>
            <label className="text-[10px] uppercase text-muted-foreground tracking-tight block mb-1">Notes</label>
            <textarea value={draft.notes || ""} onChange={(e) => setDraft({ ...draft, notes: e.target.value })} onBlur={() => save({ notes: draft.notes })} placeholder="Production notes, b-roll ideas, things to remember on shoot day." className="w-full bg-background/50 border border-border rounded px-2 py-1.5 text-sm outline-none focus:ring-1 focus:ring-primary min-h-[60px] resize-y" />
          </div>

          <div>
            <label className="text-[10px] uppercase text-muted-foreground tracking-tight block mb-1">Linked inspirations ({linkedInspos.length})</label>
            <InspirationPicker
              all={inspirations}
              selectedIds={draft.inspiration_ids}
              onChange={(ids) => save({ inspiration_ids: ids })}
            />
          </div>

          {draft.status === "posted" && (
            <div className="rounded border border-border bg-background/30 p-3 space-y-3">
              <p className="text-[10px] uppercase text-muted-foreground tracking-tight">Posted URLs + view counts</p>
              <div className="grid sm:grid-cols-2 gap-2">
                <Input placeholder="TikTok URL" value={draft.posted_url_tiktok || ""} onChange={(e) => setDraft({ ...draft, posted_url_tiktok: e.target.value })} onBlur={() => save({ posted_url_tiktok: draft.posted_url_tiktok })} className="bg-card border-border rounded h-9 text-xs" />
                <Input type="number" placeholder="TikTok views" value={draft.views_tiktok ?? ""} onChange={(e) => setDraft({ ...draft, views_tiktok: e.target.value ? parseInt(e.target.value) : null })} onBlur={() => save({ views_tiktok: draft.views_tiktok })} className="bg-card border-border rounded h-9 text-xs" />
                <Input placeholder="Instagram URL" value={draft.posted_url_instagram || ""} onChange={(e) => setDraft({ ...draft, posted_url_instagram: e.target.value })} onBlur={() => save({ posted_url_instagram: draft.posted_url_instagram })} className="bg-card border-border rounded h-9 text-xs" />
                <Input type="number" placeholder="Instagram views" value={draft.views_instagram ?? ""} onChange={(e) => setDraft({ ...draft, views_instagram: e.target.value ? parseInt(e.target.value) : null })} onBlur={() => save({ views_instagram: draft.views_instagram })} className="bg-card border-border rounded h-9 text-xs" />
                <Input placeholder="YouTube URL" value={draft.posted_url_youtube || ""} onChange={(e) => setDraft({ ...draft, posted_url_youtube: e.target.value })} onBlur={() => save({ posted_url_youtube: draft.posted_url_youtube })} className="bg-card border-border rounded h-9 text-xs" />
                <Input type="number" placeholder="YouTube views" value={draft.views_youtube ?? ""} onChange={(e) => setDraft({ ...draft, views_youtube: e.target.value ? parseInt(e.target.value) : null })} onBlur={() => save({ views_youtube: draft.views_youtube })} className="bg-card border-border rounded h-9 text-xs" />
              </div>
            </div>
          )}

          <div className="flex justify-between pt-2">
            <button onClick={remove} className="text-xs text-red-400 hover:text-red-300 flex items-center gap-1"><Trash2 className="size-3" />Delete</button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function InspirationPicker({ all, selectedIds, onChange }: { all: ContentDigest[]; selectedIds: string[]; onChange: (ids: string[]) => void }) {
  const [showAll, setShowAll] = useState(false);
  const visible = showAll ? all : all.slice(0, 8);
  const toggle = (id: string) => {
    if (selectedIds.includes(id)) onChange(selectedIds.filter((x) => x !== id));
    else onChange([...selectedIds, id]);
  };
  if (all.length === 0) {
    return <p className="text-xs text-muted-foreground">No inspirations saved yet. Send a video to the Telegram bot and pick 💡 Inspiration to populate this list.</p>;
  }
  return (
    <div className="space-y-2">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {visible.map((inspo) => {
          const sel = selectedIds.includes(inspo.id);
          return (
            <button key={inspo.id} onClick={() => toggle(inspo.id)} className={cn("relative rounded border overflow-hidden text-left", sel ? "border-primary ring-1 ring-primary" : "border-border/50 hover:border-border")}>
              <div className="aspect-[9/16] bg-muted">
                {inspo.thumbnail_url ? <img src={inspo.thumbnail_url} alt="" className="w-full h-full object-cover" /> : <div className="w-full h-full" />}
              </div>
              <p className="px-1.5 py-1 text-[10px] truncate">{inspo.title || new URL(inspo.url).hostname}</p>
              {sel && <div className="absolute top-1 right-1 size-4 rounded-full bg-primary flex items-center justify-center"><CheckCircle2 className="size-3 text-primary-foreground" /></div>}
            </button>
          );
        })}
      </div>
      {all.length > 8 && (
        <button onClick={() => setShowAll(!showAll)} className="text-[11px] text-muted-foreground hover:text-foreground">{showAll ? "Show less" : `Show all ${all.length}`}</button>
      )}
    </div>
  );
}

function HookDialog({ hook, onClose, onChange }: { hook: CreatorHook | null; onClose: () => void; onChange: () => void }) {
  const [draft, setDraft] = useState<CreatorHook | null>(null);
  useEffect(() => { setDraft(hook); }, [hook]);
  if (!draft) return null;

  const save = async (patch: Partial<CreatorHook>) => {
    const next = { ...draft, ...patch, updated_at: new Date().toISOString() };
    setDraft(next);
    await supabase.from("creator_hooks").update({ ...patch, updated_at: next.updated_at }).eq("id", draft.id);
    onChange();
  };

  const remove = async () => {
    if (!confirm("Delete this hook?")) return;
    await supabase.from("creator_hooks").delete().eq("id", draft.id);
    onChange();
    onClose();
  };

  return (
    <Dialog open={!!hook} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[600px] max-h-[85dvh] overflow-y-auto bg-card border-border rounded shadow-md">
        <DialogHeader>
          <DialogTitle className="text-base leading-snug pr-8">Hook pattern</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div>
            <label className="text-[10px] uppercase text-muted-foreground tracking-tight block mb-1">Pattern</label>
            <textarea value={draft.pattern} onChange={(e) => setDraft({ ...draft, pattern: e.target.value })} onBlur={() => save({ pattern: draft.pattern })} className="w-full bg-background/50 border border-border rounded px-2 py-1.5 text-sm outline-none focus:ring-1 focus:ring-primary min-h-[60px] resize-y" />
          </div>
          <div>
            <label className="text-[10px] uppercase text-muted-foreground tracking-tight block mb-1">Example</label>
            <textarea value={draft.example || ""} onChange={(e) => setDraft({ ...draft, example: e.target.value })} onBlur={() => save({ example: draft.example })} placeholder="A real first-line that uses this pattern." className="w-full bg-background/50 border border-border rounded px-2 py-1.5 text-sm italic outline-none focus:ring-1 focus:ring-primary min-h-[60px] resize-y" />
          </div>
          <div>
            <label className="text-[10px] uppercase text-muted-foreground tracking-tight block mb-1">Category</label>
            <div className="flex gap-1.5 flex-wrap">
              {HOOK_CATEGORIES.map((c) => (
                <button key={c.value} onClick={() => save({ category: c.value })} className={cn("px-2.5 py-1 rounded text-[11px] font-medium border", draft.category === c.value ? "bg-foreground text-background border-foreground" : "border-border/50 text-muted-foreground hover:text-foreground")}>{c.label}</button>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => save({ tested: !draft.tested })} className="flex items-center gap-2 text-sm">
              {draft.tested ? <CheckCircle2 className="size-4 text-emerald-400" /> : <Circle className="size-4 text-muted-foreground" />}
              <span className="font-medium">Tested in a real video</span>
            </button>
          </div>
          <div>
            <label className="text-[10px] uppercase text-muted-foreground tracking-tight block mb-1">Performance notes</label>
            <textarea value={draft.performance_notes || ""} onChange={(e) => setDraft({ ...draft, performance_notes: e.target.value })} onBlur={() => save({ performance_notes: draft.performance_notes })} placeholder="What happened when you used this? Views, retention, comments." className="w-full bg-background/50 border border-border rounded px-2 py-1.5 text-sm outline-none focus:ring-1 focus:ring-primary min-h-[60px] resize-y" />
          </div>
          <div className="flex justify-between pt-2">
            <button onClick={remove} className="text-xs text-red-400 hover:text-red-300 flex items-center gap-1"><Trash2 className="size-3" />Delete</button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function AddIdeaDialog({ open, onOpenChange, onAdded }: { open: boolean; onOpenChange: (v: boolean) => void; onAdded: () => void }) {
  const [title, setTitle] = useState("");
  const [hook, setHook] = useState("");
  const [pillar, setPillar] = useState<Pillar | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!title.trim()) return;
    setBusy(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setBusy(false); return; }
    await supabase.from("creator_ideas").insert({
      user_id: user.id,
      title: title.trim(),
      hook: hook.trim() || null,
      pillar,
      status: "idea",
    });
    setTitle(""); setHook(""); setPillar(null); setBusy(false); onOpenChange(false); onAdded();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] bg-card border-border rounded shadow-md">
        <DialogHeader><DialogTitle>New idea</DialogTitle></DialogHeader>
        <div className="space-y-3 py-2">
          <Input autoFocus value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Title (working name, can change)" className="bg-card border-border rounded h-10" />
          <textarea value={hook} onChange={(e) => setHook(e.target.value)} placeholder="Hook (optional — first 3 seconds)" className="w-full bg-card border border-border rounded px-2 py-1.5 text-sm outline-none focus:ring-1 focus:ring-primary min-h-[60px] resize-y" />
          <div className="flex gap-1.5 flex-wrap">
            <button onClick={() => setPillar(null)} className={cn("px-2.5 py-1 rounded text-[11px] font-medium border", !pillar ? "border-foreground text-foreground" : "border-border/50 text-muted-foreground")}>No pillar</button>
            {PILLARS.map((p) => (
              <button key={p.value} onClick={() => setPillar(p.value)} className={cn("px-2.5 py-1 rounded text-[11px] font-semibold border", pillar === p.value ? p.color : "border-border/50 text-muted-foreground")}>{p.label}</button>
            ))}
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => onOpenChange(false)} className="rounded">Cancel</Button>
            <Button onClick={submit} disabled={!title.trim() || busy} className="bg-primary hover:bg-primary/90 text-primary-foreground border-0 rounded">Add idea</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function AddHookDialog({ open, onOpenChange, onAdded }: { open: boolean; onOpenChange: (v: boolean) => void; onAdded: () => void }) {
  const [pattern, setPattern] = useState("");
  const [example, setExample] = useState("");
  const [category, setCategory] = useState<HookCategory | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!pattern.trim()) return;
    setBusy(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setBusy(false); return; }
    await supabase.from("creator_hooks").insert({
      user_id: user.id,
      pattern: pattern.trim(),
      example: example.trim() || null,
      category,
      tested: false,
    });
    setPattern(""); setExample(""); setCategory(null); setBusy(false); onOpenChange(false); onAdded();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] bg-card border-border rounded shadow-md">
        <DialogHeader><DialogTitle>New hook pattern</DialogTitle></DialogHeader>
        <div className="space-y-3 py-2">
          <textarea autoFocus value={pattern} onChange={(e) => setPattern(e.target.value)} placeholder="The pattern itself. e.g. &ldquo;Most people think X. They're wrong because Y.&rdquo;" className="w-full bg-card border border-border rounded px-2 py-1.5 text-sm outline-none focus:ring-1 focus:ring-primary min-h-[80px] resize-y" />
          <textarea value={example} onChange={(e) => setExample(e.target.value)} placeholder="A real example using the pattern (optional)." className="w-full bg-card border border-border rounded px-2 py-1.5 text-sm italic outline-none focus:ring-1 focus:ring-primary min-h-[60px] resize-y" />
          <div className="flex gap-1.5 flex-wrap">
            {HOOK_CATEGORIES.map((c) => (
              <button key={c.value} onClick={() => setCategory(c.value)} className={cn("px-2.5 py-1 rounded text-[11px] font-medium border", category === c.value ? "bg-foreground text-background border-foreground" : "border-border/50 text-muted-foreground")}>{c.label}</button>
            ))}
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => onOpenChange(false)} className="rounded">Cancel</Button>
            <Button onClick={submit} disabled={!pattern.trim() || busy} className="bg-primary hover:bg-primary/90 text-primary-foreground border-0 rounded">Add hook</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
