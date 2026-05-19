"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plus, KanbanSquare, Search } from "lucide-react";
import { PageLayout } from "@/components/layout/page-layout";
import { PipelineTabs } from "@/components/pipeline/pipeline-tabs";
import { supabase } from "@/lib/supabase";
import { DEAL_STAGES, STAGE_LABEL, STAGE_COLOR, ACTIVE_STAGES, type DealStage, type DealWithLinks } from "@/types/pipeline";
import { NewDealDialog } from "@/components/pipeline/new-deal-dialog";

const mono = "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace";

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

  const fetchDeals = useCallback(async () => {
    const res = await fetch("/api/pipeline/deals");
    const json = await res.json();
    setDeals(json.data ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchDeals();
    const ch = supabase
      .channel("pipeline-deals-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "crm_deals" }, () => fetchDeals())
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [fetchDeals]);

  const handleMoveStage = useCallback(async (dealId: string, newStage: DealStage) => {
    // Optimistic
    setDeals((prev) => prev.map((d) => (d.id === dealId ? { ...d, stage: newStage } : d)));
    await fetch(`/api/pipeline/deals/${dealId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ stage: newStage }),
    });
  }, []);

  const filtered = search.trim()
    ? deals.filter((d) => {
        const q = search.toLowerCase();
        return (
          d.title.toLowerCase().includes(q) ||
          d.company?.name.toLowerCase().includes(q) ||
          d.contact?.full_name.toLowerCase().includes(q)
        );
      })
    : deals;

  const dealsByStage: Record<DealStage, DealWithLinks[]> = {
    discovery: [], scope: [], proposal: [], build: [], live: [], lost: [],
  };
  for (const d of filtered) dealsByStage[d.stage].push(d);

  const totalActive = filtered.filter((d) => ACTIVE_STAGES.includes(d.stage));
  const totalValue = totalActive.reduce((s, d) => s + (d.value_cents ?? 0), 0);
  const live = filtered.filter((d) => d.stage === "live");
  const liveValue = live.reduce((s, d) => s + (d.value_cents ?? 0), 0);

  return (
    <PageLayout title="Pipeline" description="Niewdel deals — discovery to live" icon={KanbanSquare} maxWidth="xl" loading={loading}>
      <PipelineTabs />

      <style>{`
        @keyframes fadeIn { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
        {[
          { label: "Open deals", value: String(totalActive.length) },
          { label: "Open value", value: formatCurrency(totalValue) },
          { label: "Live", value: String(live.length) },
          { label: "Live value", value: formatCurrency(liveValue) },
        ].map((s) => (
          <div
            key={s.label}
            className="p-3 rounded-lg border text-center"
            style={{ backgroundColor: "rgba(26,26,26,0.5)", borderColor: "rgba(255,255,255,0.06)" }}
          >
            <p className="text-lg font-bold tabular-nums" style={{ color: "#00B4D8" }}>{s.value}</p>
            <p className="text-[9px] uppercase tracking-wider" style={{ color: "rgba(245,245,245,0.3)", fontFamily: mono }}>
              {s.label}
            </p>
          </div>
        ))}
      </div>

      {/* Toolbar */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="relative flex-1 max-w-md">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "rgba(245,245,245,0.3)" }} />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search deals, contacts, companies..."
            className="w-full pl-9 pr-3 py-2 text-xs rounded-md border bg-transparent outline-none focus:border-[rgba(0,180,216,0.4)] transition-colors"
            style={{ borderColor: "rgba(255,255,255,0.08)", color: "rgba(245,245,245,0.85)" }}
          />
        </div>
        <button
          onClick={() => setNewDealOpen(true)}
          className="flex items-center gap-1.5 px-3 py-2 text-[10px] uppercase tracking-wider rounded-md transition-colors hover:bg-[rgba(0,180,216,0.15)]"
          style={{ fontFamily: mono, color: "#00B4D8", border: "1px solid rgba(0,180,216,0.3)" }}
        >
          <Plus size={12} /> New Deal
        </button>
      </div>

      {/* Kanban */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3">
        {DEAL_STAGES.map((stage) => {
          const stageDeals = dealsByStage[stage];
          const stageTotal = stageDeals.reduce((s, d) => s + (d.value_cents ?? 0), 0);
          return (
            <div
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
              className="rounded-lg p-2 min-h-[200px]"
              style={{
                backgroundColor: "rgba(13,13,13,0.5)",
                border: "1px solid rgba(255,255,255,0.04)",
              }}
            >
              <div className="flex items-center justify-between mb-2 px-1">
                <span
                  className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider font-semibold"
                  style={{ color: STAGE_COLOR[stage], fontFamily: mono }}
                >
                  <span className="size-1.5 rounded-full" style={{ backgroundColor: STAGE_COLOR[stage] }} />
                  {STAGE_LABEL[stage]}
                </span>
                <span className="text-[10px] tabular-nums" style={{ color: "rgba(245,245,245,0.3)", fontFamily: mono }}>
                  {stageDeals.length}
                </span>
              </div>
              {stageDeals.length > 0 && (
                <p className="text-[10px] mb-2 px-1 tabular-nums" style={{ color: "rgba(245,245,245,0.4)", fontFamily: mono }}>
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
                    className="block p-2.5 rounded-md border transition-colors hover:border-[rgba(0,180,216,0.3)] cursor-grab active:cursor-grabbing"
                    style={{
                      backgroundColor: "rgba(26,26,26,0.7)",
                      borderColor: dragId === deal.id ? "rgba(0,180,216,0.4)" : "rgba(255,255,255,0.06)",
                      animation: "fadeIn 0.3s ease",
                    }}
                  >
                    <p className="text-xs font-semibold truncate">{deal.title}</p>
                    {deal.company && (
                      <p className="text-[10px] mt-0.5 truncate" style={{ color: "rgba(245,245,245,0.45)" }}>
                        {deal.company.name}
                      </p>
                    )}
                    {deal.contact && (
                      <p className="text-[10px] mt-0.5 truncate" style={{ color: "rgba(245,245,245,0.35)", fontFamily: mono }}>
                        {deal.contact.full_name}
                      </p>
                    )}
                    <div className="flex items-center justify-between mt-2 gap-2">
                      <span className="text-[10px] tabular-nums" style={{ color: "#00B4D8", fontFamily: mono }}>
                        {formatCurrency(deal.value_cents)}
                      </span>
                      {deal.close_date_est && (
                        <span className="text-[9px] tabular-nums" style={{ color: "rgba(245,245,245,0.3)", fontFamily: mono }}>
                          {new Date(deal.close_date_est).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                        </span>
                      )}
                    </div>
                  </Link>
                ))}
                {stageDeals.length === 0 && (
                  <div className="text-center py-6 text-[10px]" style={{ color: "rgba(245,245,245,0.2)", fontFamily: mono }}>
                    —
                  </div>
                )}
              </div>
            </div>
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
