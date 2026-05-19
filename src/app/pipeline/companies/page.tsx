"use client";

import { useCallback, useEffect, useState } from "react";
import { Building, ExternalLink, Plus } from "lucide-react";
import { PageLayout } from "@/components/layout/page-layout";
import { PipelineTabs } from "@/components/pipeline/pipeline-tabs";
import { supabase } from "@/lib/supabase";
import { NewCompanyDialog } from "@/components/pipeline/new-company-dialog";
import { STAGE_COLOR, type DealStage } from "@/types/pipeline";

const mono = "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace";

function formatCurrency(cents: number | null): string {
  if (cents == null || cents === 0) return "—";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(cents / 100);
}

type CompanyRow = {
  id: string;
  name: string;
  domain: string | null;
  website: string | null;
  industry: string | null;
  headcount: number | null;
  hq: string | null;
  contacts: { count: number }[];
  deals: { id: string; stage: DealStage; value_cents: number | null }[];
};

export default function CompaniesPage() {
  const [companies, setCompanies] = useState<CompanyRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [addOpen, setAddOpen] = useState(false);

  const fetchCompanies = useCallback(async () => {
    const res = await fetch("/api/pipeline/companies");
    const json = await res.json();
    setCompanies(json.data ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchCompanies();
    const ch = supabase
      .channel("crm-companies-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "crm_companies" }, () => fetchCompanies())
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [fetchCompanies]);

  const filtered = search.trim()
    ? companies.filter((c) => {
        const q = search.toLowerCase();
        return (
          c.name.toLowerCase().includes(q) ||
          (c.industry ?? "").toLowerCase().includes(q) ||
          (c.hq ?? "").toLowerCase().includes(q) ||
          (c.domain ?? "").toLowerCase().includes(q)
        );
      })
    : companies;

  return (
    <PageLayout title="Companies" description="Niewdel CRM accounts" icon={Building} maxWidth="xl" loading={loading}>
      <PipelineTabs />

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search name, industry, HQ..."
          className="flex-1 max-w-md px-3 py-2 text-xs rounded-md border bg-transparent outline-none focus:border-[rgba(0,180,216,0.4)] transition-colors"
          style={{ borderColor: "rgba(255,255,255,0.08)", color: "rgba(245,245,245,0.85)" }}
        />
        <button
          onClick={() => setAddOpen(true)}
          className="flex items-center gap-1.5 px-3 py-2 text-[10px] uppercase tracking-wider rounded-md transition-colors hover:bg-[rgba(0,180,216,0.15)]"
          style={{ fontFamily: mono, color: "#00B4D8", border: "1px solid rgba(0,180,216,0.3)" }}
        >
          <Plus size={12} /> Add Company
        </button>
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-12 rounded-lg border" style={{ backgroundColor: "rgba(26,26,26,0.5)", borderColor: "rgba(255,255,255,0.06)", color: "rgba(245,245,245,0.4)" }}>
          <p className="text-sm" style={{ fontFamily: mono }}>
            {companies.length === 0 ? "No companies yet." : "No matches."}
          </p>
        </div>
      ) : (
        <ul className="space-y-2">
          {filtered.map((c) => {
            const contactCount = c.contacts[0]?.count ?? 0;
            const activeDeals = c.deals.filter((d) => d.stage !== "lost");
            const totalValue = activeDeals.reduce((s, d) => s + (d.value_cents ?? 0), 0);
            return (
              <li
                key={c.id}
                className="p-3 rounded-lg border"
                style={{ backgroundColor: "rgba(26,26,26,0.5)", borderColor: "rgba(255,255,255,0.06)" }}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold truncate">{c.name}</p>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-0.5 text-[11px]" style={{ color: "rgba(245,245,245,0.5)" }}>
                      {c.industry && <span>{c.industry}</span>}
                      {c.hq && <span>· {c.hq}</span>}
                      {c.headcount && <span>· {c.headcount} people</span>}
                      {c.website && (
                        <a
                          href={c.website.startsWith("http") ? c.website : `https://${c.website}`}
                          target="_blank"
                          rel="noreferrer"
                          className="flex items-center gap-1 hover:text-foreground"
                        >
                          <ExternalLink size={10} style={{ color: "#00B4D8" }} />
                          {c.domain ?? c.website}
                        </a>
                      )}
                    </div>
                  </div>
                  <div className="text-right shrink-0 space-y-0.5">
                    <p className="text-[10px] uppercase tracking-wider" style={{ color: "rgba(245,245,245,0.4)", fontFamily: mono }}>
                      {contactCount} contact{contactCount === 1 ? "" : "s"}
                    </p>
                    <p className="text-[10px] uppercase tracking-wider" style={{ color: "#00B4D8", fontFamily: mono }}>
                      {activeDeals.length} deal{activeDeals.length === 1 ? "" : "s"}
                    </p>
                    {totalValue > 0 && (
                      <p className="text-[10px] tabular-nums" style={{ color: STAGE_COLOR.live, fontFamily: mono }}>
                        {formatCurrency(totalValue)}
                      </p>
                    )}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <NewCompanyDialog open={addOpen} onClose={() => setAddOpen(false)} onCreated={fetchCompanies} />
    </PageLayout>
  );
}
