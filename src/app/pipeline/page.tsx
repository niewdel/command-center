"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plus, KanbanSquare, Search, Clock3 } from "lucide-react";
import { PageLayout } from "@/components/layout/page-layout";
import { PipelineTabs } from "@/components/pipeline/pipeline-tabs";
import { useRealtime } from "@/lib/providers/realtime-provider";
import { DEAL_STAGES, STAGE_LABEL, STAGE_COLOR, ACTIVE_STAGES, type DealStage, type DealWithLinks } from "@/types/pipeline";
import { isDealStale } from "@/lib/pipeline/stale";
import { NewDealDialog } from "@/components/pipeline/new-deal-dialog";

function formatCurrency(cents: number | null): string {
  if (cents == null) return "—";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(cents / 100);
}

export default function PipelinePage() {
  const router = useRouter();
  const [deals, setDeals] = useState<DealWithLinks[]>([]);
  const [loading, setLoading] = useState(true);
  const [newDealOpen, setNewDealOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [dragId, setDragId] = useState<string | null>(null);
  const [needsAttentionOnly, setNeedsAttentionOnly] = useState(false);

  const fetchDeals = useCallback(async () => {
    const res = await fetch("/api/pipeline/deals");
    const json = await res.json();
    setDeals(json.data ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchDeals();
  }, [fetchDeals]);

  useRealtime("crm_deals", fetchDeals);

  const handleMoveStage = useCallback(async (dealId: string, newStage: DealStage) => {
    // Optimistic
    setDeals((prev) => prev.map((d) => (d.id === dealId ? { ...d, stage: newStage } : d)));
    await fetch(`/api/pipeline/deals/${dealId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ stage: newStage }),
    });
  }, []);

  const searched = search.trim()
    ? deals.filter((d) => {
        const q = search.toLowerCase();
        return (
          d.title.toLowerCase().includes(q) ||
          d.company?.name.toLowerCase().includes(q) ||
          d.contact?.full_name.toLowerCase().includes(q)
        );
      })
    : deals;

  const staleCount = searched.filter((d) => isDealStale(d)).length;
  const filtered = needsAttentionOnly ? searched.filter((d) => isDealStale(d)) : searched;

  const dealsByStage: Record<DealStage, DealWithLinks[]> = {
    discovery: [], scope: [], proposal: [], build: [], live: [], lost: [], disqualified: [],
  };
  for (const d of filtered) dealsByStage[d.stage].push(d);

  const totalActive = searched.filter((d) => ACTIVE_STAGES.includes(d.stage));
  const totalValue = totalActive.reduce((s, d) => s + (d.value_cents ?? 0), 0);
  const live = searched.filter((d) => d.stage === "live");
  const liveValue = live.reduce((s, d) => s + (d.value_cents ?? 0), 0);

  return (
    <PageLayout
      title="Pipeline"
      eyebrow="Sales · Niewdel"
      description="Discovery to live. Drag a card across stages to advance it."
      icon={KanbanSquare}
      maxWidth="2xl"
      loading={loading}
    >
      <PipelineTabs />

      {/* Summary row — sentence-style stat strip, not the SaaS hero-metric grid */}
      <div className="flex flex-wrap items-end gap-x-10 gap-y-4 pb-2">
        <Stat label="Open deals" value={String(totalActive.length)} />
        <Stat label="Open value" value={formatCurrency(totalValue)} />
        <Stat label="Live" value={String(live.length)} />
        <Stat label="Live value" value={formatCurrency(liveValue)} />
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="relative flex-1 max-w-md">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search deals, contacts, companies"
            className="w-full pl-9 pr-3 py-2 text-sm rounded-md border border-border bg-card outline-none transition-colors focus:border-foreground/40 placeholder:text-muted-foreground"
          />
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setNeedsAttentionOnly((v) => !v)}
            aria-pressed={needsAttentionOnly}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-md border transition-colors"
            style={{
              borderColor: needsAttentionOnly ? "#EF4444" : "var(--border)",
              color: needsAttentionOnly ? "#EF4444" : "var(--ink-soft)",
              backgroundColor: needsAttentionOnly ? "rgba(239,68,68,0.08)" : "transparent",
            }}
          >
            <Clock3 size={13} /> Needs attention
            {staleCount > 0 && (
              <span
                className="text-[10px] font-mono tabular-nums px-1.5 py-0.5 rounded-full"
                style={{ backgroundColor: needsAttentionOnly ? "#EF4444" : "var(--paper-sunken)", color: needsAttentionOnly ? "#fff" : "var(--ink-soft)" }}
              >
                {staleCount}
              </span>
            )}
          </button>
          <button
            onClick={() => setNewDealOpen(true)}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-md bg-primary text-primary-foreground hover:bg-[var(--rust-hot)] transition-colors"
          >
            <Plus size={14} /> New deal
          </button>
        </div>
      </div>

      {/* Kanban */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-7 gap-3">
        {DEAL_STAGES.map((stage) => {
          const stageDeals = dealsByStage[stage];
          const stageTotal = stageDeals.reduce((s, d) => s + (d.value_cents ?? 0), 0);
          return (
            <section
              key={stage}
              onDragOver={(e) => {
                if (dragId) e.preventDefault();
              }}
              onDrop={(e) => {
                e.preventDefault();
                if (dragId) {
                  handleMoveStage(dragId, stage);
                  setDragId(null);
                }
              }}
              className="rounded-lg p-2.5 min-h-[60vh] bg-card border border-border"
            >
              <header className="flex items-center justify-between mb-2 px-1">
                <span className="flex items-center gap-1.5 text-[11px] font-mono font-semibold uppercase tracking-[0.18em] text-foreground">
                  <span className="size-1.5 rounded-full" style={{ backgroundColor: STAGE_COLOR[stage] }} />
                  {STAGE_LABEL[stage]}
                </span>
                <span className="text-[11px] font-mono tabular-nums text-muted-foreground">
                  {stageDeals.length}
                </span>
              </header>
              {stageDeals.length > 0 && (
                <p className="text-[11px] mb-2 px-1 tabular-nums font-mono text-muted-foreground">
                  {formatCurrency(stageTotal)}
                </p>
              )}
              <div className="space-y-1.5">
                {stageDeals.map((deal) => (
                  <Link
                    key={deal.id}
                    href={`/pipeline/deals/${deal.id}`}
                    draggable
                    onDragStart={() => setDragId(deal.id)}
                    onDragEnd={() => setDragId(null)}
                    className={`block p-3 rounded-md border bg-background hover:border-foreground/30 cursor-grab active:cursor-grabbing transition-colors ${
                      dragId === deal.id ? "border-primary/60" : "border-border"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-semibold text-foreground line-clamp-2 text-pretty">
                        {deal.title}
                      </p>
                      {isDealStale(deal) && (
                        <span
                          className="flex items-center gap-1 shrink-0 px-1.5 py-0.5 rounded text-[9px] uppercase tracking-wider font-mono"
                          style={{ backgroundColor: "rgba(239,68,68,0.12)", color: "#EF4444" }}
                          title="No upcoming next action"
                        >
                          <Clock3 size={9} /> Stale
                        </span>
                      )}
                    </div>
                    {deal.company && (
                      <p className="text-xs mt-0.5 truncate text-muted-foreground">
                        {deal.company.name}
                      </p>
                    )}
                    {deal.contact && (() => {
                      const total = deal.contact_count?.[0]?.count ?? (deal.contact ? 1 : 0);
                      const extras = Math.max(0, total - 1);
                      return (
                        <p className="text-[11px] mt-1 truncate font-mono text-muted-foreground">
                          {deal.contact.full_name}
                          {extras > 0 && (
                            <span className="text-primary"> +{extras}</span>
                          )}
                        </p>
                      );
                    })()}
                    <div className="flex items-center justify-between mt-2.5 gap-2">
                      <span className="text-xs tabular-nums font-mono font-semibold text-foreground">
                        {formatCurrency(deal.value_cents)}
                      </span>
                      {deal.close_date_est && (
                        <span className="text-[11px] tabular-nums font-mono text-muted-foreground">
                          {new Date(deal.close_date_est + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                        </span>
                      )}
                    </div>
                  </Link>
                ))}
                {stageDeals.length === 0 && (
                  <div className="text-center py-8 text-[11px] font-mono text-muted-foreground">
                    —
                  </div>
                )}
              </div>
            </section>
          );
        })}
      </div>

      <NewDealDialog
        open={newDealOpen}
        onClose={() => setNewDealOpen(false)}
        onCreated={(deal) => {
          setNewDealOpen(false);
          router.push(`/pipeline/deals/${deal.id}`);
        }}
      />
    </PageLayout>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="mono-tag-muted">{label}</span>
      <span className="text-2xl font-bold tabular-nums tracking-tight text-foreground">{value}</span>
    </div>
  );
}
