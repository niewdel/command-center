"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Mail,
  CheckCircle,
  Clock,
  XCircle,
  Send,
  ChevronDown,
  Phone,
  ExternalLink,
  FileDown,
  Search,
  Sparkles,
  RefreshCw,
  KanbanSquare,
} from "lucide-react";
import { PageLayout } from "@/components/layout/page-layout";
import { LeadsTabs } from "@/components/leads/leads-tabs";
import { supabase } from "@/lib/supabase";
import type { Prospect } from "@/app/api/leads/prospects/route";

type Status = Prospect["status"];

const mono = "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace";

const statusConfig: Record<Status, { icon: React.ReactNode; label: string; color: string }> = {
  queued: { icon: <Clock size={12} />, label: "Queued", color: "var(--ink-faint)" },
  sent: { icon: <Send size={12} />, label: "Sent", color: "var(--rust)" },
  opened: { icon: <Mail size={12} />, label: "Opened", color: "#F59E0B" },
  replied: { icon: <CheckCircle size={12} />, label: "Replied", color: "#10B981" },
  bounced: { icon: <XCircle size={12} />, label: "Bounced", color: "#EF4444" },
};

const STEP_LABEL: Record<string, string> = {
  initial: "Initial Outreach",
  "follow-up-1": "Follow-Up #1",
  "follow-up-2": "Follow-Up #2",
};

const FILTERS: Array<Status | "all"> = ["all", "replied", "opened", "sent", "queued", "bounced"];

export default function ProspectsPage() {
  const router = useRouter();
  const [prospects, setProspects] = useState<Prospect[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Status | "all">("all");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [activeEmail, setActiveEmail] = useState(0);
  const [promotingId, setPromotingId] = useState<string | null>(null);

  const handlePromote = useCallback(async (prospectId: string) => {
    setPromotingId(prospectId);
    const res = await fetch("/api/pipeline/promote", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prospect_contact_id: prospectId }),
    });
    const json = await res.json();
    setPromotingId(null);
    if (res.ok && json.deal_id) {
      router.push(`/pipeline/deals/${json.deal_id}`);
    }
  }, [router]);

  const fetchProspects = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/leads/prospects?limit=200");
    const json = await res.json();
    setProspects(json.data ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchProspects();
    const ch = supabase
      .channel("prospects-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "contacts" }, () => fetchProspects())
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [fetchProspects]);

  const filtered = filter === "all" ? prospects : prospects.filter((p) => p.status === filter);

  const stats = {
    total: prospects.length,
    sent: prospects.filter((p) => p.status !== "queued" && p.status !== "bounced").length,
    opened: prospects.filter((p) => p.status === "opened" || p.status === "replied").length,
    replied: prospects.filter((p) => p.status === "replied").length,
  };

  const exportReport = useCallback(() => {
    window.open("/api/leads/report?limit=200", "_blank");
  }, []);

  return (
    <PageLayout
      title="Prospects"
      eyebrow="Lead Gen · Pipeline"
      description="Generated leads with enrichment and sequences."
      maxWidth="xl"
    >
      <LeadsTabs />

      <style>{`
        @keyframes fadeIn { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        {[
          { label: "Prospects", value: stats.total },
          { label: "Sent", value: stats.sent },
          { label: "Opened", value: stats.opened },
          { label: "Replied", value: stats.replied },
        ].map((s) => (
          <div
            key={s.label}
            className="p-3 rounded-lg border text-center"
            style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}
          >
            <p className="text-xl font-bold tabular-nums" style={{ color: "var(--rust)" }}>
              {s.value}
            </p>
            <p
              className="text-[9px] uppercase tracking-wider"
              style={{ color: "var(--ink-faint)", fontFamily: mono }}
            >
              {s.label}
            </p>
          </div>
        ))}
      </div>

      {/* Toolbar */}
      <div
        className="mb-4 rounded-lg border p-3 flex flex-wrap items-center justify-between gap-3"
        style={{ backgroundColor: "color-mix(in oklch, var(--rust) calc(0.04 * 100%), transparent)", borderColor: "color-mix(in oklch, var(--rust) calc(0.15 * 100%), transparent)" }}
      >
        <div className="flex items-center gap-2 flex-wrap">
          {FILTERS.map((s) => (
            <button
              key={s}
              onClick={() => setFilter(s)}
              className="px-2.5 py-1 text-[10px] uppercase tracking-wider rounded-md transition-colors duration-150"
              style={{
                fontFamily: mono,
                backgroundColor: filter === s ? "color-mix(in oklch, var(--rust) calc(0.1 * 100%), transparent)" : "transparent",
                color: filter === s ? "var(--rust)" : "var(--ink-soft)",
                border: `1px solid ${filter === s ? "color-mix(in oklch, var(--rust) calc(0.2 * 100%), transparent)" : "var(--border)"}`,
              }}
            >
              {s === "all" ? "All" : statusConfig[s].label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={fetchProspects}
            className="flex items-center gap-1.5 px-3 py-1.5 text-[10px] uppercase tracking-wider rounded-md transition-colors duration-150 hover:bg-[var(--border)]"
            style={{ fontFamily: mono, color: "var(--ink-soft)", border: "1px solid var(--border)" }}
            aria-label="Refresh prospects"
          >
            <RefreshCw size={12} /> Refresh
          </button>
          <button
            onClick={exportReport}
            className="flex items-center gap-1.5 px-3 py-1.5 text-[10px] uppercase tracking-wider rounded-md transition-colors duration-150 hover:bg-[color-mix(in oklch, var(--rust) calc(0.15 * 100%), transparent)]"
            style={{ fontFamily: mono, color: "var(--rust)", border: "1px solid color-mix(in oklch, var(--rust) calc(0.2 * 100%), transparent)" }}
          >
            <FileDown size={12} /> Export Report
          </button>
        </div>
      </div>

      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-16 rounded-lg bg-muted/40 animate-pulse" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16" style={{ color: "var(--ink-soft)" }}>
          <Search size={32} className="mx-auto mb-3" />
          <p className="text-sm" style={{ fontFamily: mono }}>
            {prospects.length === 0
              ? "No prospects yet. Run a lead gen job from the Stats tab."
              : "No prospects match the current filter."}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((p) => (
            <ProspectCard
              key={p.id}
              p={p}
              isExpanded={expanded === p.id}
              activeEmail={activeEmail}
              promoting={promotingId === p.id}
              onToggle={() => {
                setExpanded(expanded === p.id ? null : p.id);
                setActiveEmail(0);
              }}
              onPickEmail={setActiveEmail}
              onPromote={() => handlePromote(p.id)}
            />
          ))}
        </div>
      )}
    </PageLayout>
  );
}

function ProspectCard({
  p,
  isExpanded,
  activeEmail,
  promoting,
  onToggle,
  onPickEmail,
  onPromote,
}: {
  p: Prospect;
  isExpanded: boolean;
  activeEmail: number;
  promoting: boolean;
  onToggle: () => void;
  onPickEmail: (i: number) => void;
  onPromote: () => void;
}) {
  const st = statusConfig[p.status];
  const scoreColor = p.score >= 85 ? "#10B981" : p.score >= 60 ? "#F59E0B" : "var(--ink-soft)";

  return (
    <div style={{ animation: "fadeIn 0.3s ease" }}>
      <button
        onClick={onToggle}
        className="w-full text-left p-4 rounded-lg border transition-all duration-300"
        style={{
          backgroundColor: isExpanded ? "color-mix(in oklch, var(--rust) calc(0.04 * 100%), transparent)" : "var(--card)",
          borderColor: isExpanded ? "color-mix(in oklch, var(--rust) calc(0.2 * 100%), transparent)" : "var(--border)",
          borderBottomLeftRadius: isExpanded ? 0 : undefined,
          borderBottomRightRadius: isExpanded ? 0 : undefined,
          cursor: "pointer",
        }}
      >
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-2 min-w-0">
            <ChevronDown
              size={14}
              style={{
                color: "var(--ink-faint)",
                transform: isExpanded ? "rotate(180deg)" : "rotate(0)",
                transition: "transform 0.2s",
                flexShrink: 0,
              }}
            />
            <p className="text-sm font-semibold truncate">{p.company}</p>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <span
              className="flex items-center gap-1 text-[10px]"
              style={{ color: st.color, fontFamily: mono }}
            >
              {st.icon} {st.label}
            </span>
            <span className="text-xs font-bold tabular-nums" style={{ color: scoreColor, fontFamily: mono }}>
              {p.score}
            </span>
          </div>
        </div>
        <p
          className="text-[10px] ml-6 truncate"
          style={{ color: "var(--ink-soft)", fontFamily: mono }}
        >
          {p.contact} · {p.title} · {p.industry} · {p.size} employees
        </p>
      </button>

      {isExpanded && (
        <div
          className="rounded-b-lg border border-t-0 p-5"
          style={{ backgroundColor: "rgba(13,13,13,0.8)", borderColor: "color-mix(in oklch, var(--rust) calc(0.2 * 100%), transparent)" }}
        >
          <div className="flex items-center justify-end mb-4">
            <button
              onClick={(e) => {
                e.stopPropagation();
                onPromote();
              }}
              disabled={promoting}
              className="flex items-center gap-1.5 px-3 py-1.5 text-[10px] uppercase tracking-wider rounded-md transition-colors hover:bg-[color-mix(in oklch, var(--rust) calc(0.15 * 100%), transparent)] disabled:opacity-60 disabled:cursor-not-allowed"
              style={{ fontFamily: mono, color: "var(--rust)", border: "1px solid color-mix(in oklch, var(--rust) calc(0.3 * 100%), transparent)" }}
            >
              <KanbanSquare size={12} />
              {promoting ? "Adding…" : "Add to Pipeline"}
            </button>
          </div>
          <div className="grid md:grid-cols-2 gap-6">
            {/* Left: Contact + Company */}
            <div className="space-y-4">
              <div>
                <p
                  className="text-[10px] uppercase tracking-wider mb-2"
                  style={{ color: "color-mix(in oklch, var(--rust) calc(0.5 * 100%), transparent)", fontFamily: mono }}
                >
                  Contact Information
                </p>
                <p className="text-sm font-semibold">{p.contact}</p>
                <p className="text-xs" style={{ color: "var(--ink-soft)" }}>
                  {p.title}
                </p>
                <div className="mt-2 space-y-1">
                  {p.email && (
                    <p
                      className="flex items-center gap-2 text-xs"
                      style={{ color: "var(--ink-soft)" }}
                    >
                      <Mail size={11} style={{ color: "var(--rust)" }} /> {p.email}
                    </p>
                  )}
                  {p.phone ? (
                    <p
                      className="flex items-center gap-2 text-xs"
                      style={{ color: "var(--ink-soft)" }}
                    >
                      <Phone size={11} style={{ color: "var(--rust)" }} /> {p.phone}
                    </p>
                  ) : (
                    <button
                      onClick={async (e) => {
                        e.stopPropagation();
                        await fetch(`/api/leads/contacts/${p.id}/enrich-phone`, { method: "POST" });
                      }}
                      className="flex items-center gap-2 text-xs hover:underline"
                      style={{ color: "color-mix(in oklch, var(--rust) calc(0.6 * 100%), transparent)" }}
                    >
                      <Sparkles size={11} /> Enrich phone
                    </button>
                  )}
                  {p.linkedin && (
                    <a
                      href={p.linkedin.startsWith("http") ? p.linkedin : `https://${p.linkedin}`}
                      target="_blank"
                      rel="noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="flex items-center gap-2 text-xs hover:underline"
                      style={{ color: "var(--ink-soft)" }}
                    >
                      <ExternalLink size={11} style={{ color: "var(--rust)" }} /> {p.linkedin}
                    </a>
                  )}
                </div>
              </div>

              <div>
                <p
                  className="text-[10px] uppercase tracking-wider mb-2"
                  style={{ color: "color-mix(in oklch, var(--rust) calc(0.5 * 100%), transparent)", fontFamily: mono }}
                >
                  Company Data
                </p>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { label: "Revenue", value: p.enrichment.revenue },
                    { label: "Funding", value: p.enrichment.funding },
                    { label: "Founded", value: p.enrichment.founded },
                    { label: "HQ", value: p.enrichment.hq },
                  ].map((d) => (
                    <div key={d.label}>
                      <p
                        className="text-[9px] uppercase"
                        style={{ color: "var(--ink-faint)", fontFamily: mono }}
                      >
                        {d.label}
                      </p>
                      <p className="text-xs">{d.value}</p>
                    </div>
                  ))}
                </div>
                {p.enrichment.tech.length > 0 && (
                  <div className="mt-2">
                    <p
                      className="text-[9px] uppercase mb-1"
                      style={{ color: "var(--ink-faint)", fontFamily: mono }}
                    >
                      Tech Stack
                    </p>
                    <div className="flex flex-wrap gap-1">
                      {p.enrichment.tech.slice(0, 10).map((t) => (
                        <span
                          key={t}
                          className="text-[9px] px-1.5 py-0.5 rounded"
                          style={{
                            backgroundColor: "color-mix(in oklch, var(--rust) calc(0.06 * 100%), transparent)",
                            color: "color-mix(in oklch, var(--rust) calc(0.7 * 100%), transparent)",
                            fontFamily: mono,
                          }}
                        >
                          {t}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Right: Email sequence */}
            <div>
              <p
                className="text-[10px] uppercase tracking-wider mb-2"
                style={{ color: "color-mix(in oklch, var(--rust) calc(0.5 * 100%), transparent)", fontFamily: mono }}
              >
                AI-Generated Email Sequence
              </p>
              {p.emails.length === 0 ? (
                <div
                  className="rounded-md border p-4 text-xs"
                  style={{ backgroundColor: "var(--card)", borderColor: "var(--border)", color: "var(--ink-soft)" }}
                >
                  No email drafts yet for this contact.
                </div>
              ) : (
                <>
                  <div className="flex gap-1 mb-3 flex-wrap">
                    {p.emails.map((em, i) => (
                      <button
                        key={i}
                        onClick={(e) => {
                          e.stopPropagation();
                          onPickEmail(i);
                        }}
                        className="px-2.5 py-1 text-[10px] rounded-md transition-colors duration-150"
                        style={{
                          fontFamily: mono,
                          backgroundColor: activeEmail === i ? "color-mix(in oklch, var(--rust) calc(0.1 * 100%), transparent)" : "transparent",
                          color: activeEmail === i ? "var(--rust)" : "var(--ink-soft)",
                          border: `1px solid ${activeEmail === i ? "color-mix(in oklch, var(--rust) calc(0.2 * 100%), transparent)" : "var(--border)"}`,
                        }}
                      >
                        {STEP_LABEL[em.type] ?? `Step ${em.step}`}
                      </button>
                    ))}
                  </div>
                  <div
                    className="rounded-md border p-4"
                    style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}
                  >
                    <p
                      className="text-[10px] mb-1"
                      style={{ color: "var(--ink-faint)", fontFamily: mono }}
                    >
                      Subject:
                    </p>
                    <p className="text-xs font-semibold mb-3">
                      {p.emails[activeEmail]?.subject || "(no subject)"}
                    </p>
                    <p
                      className="text-[10px] mb-1"
                      style={{ color: "var(--ink-faint)", fontFamily: mono }}
                    >
                      Body:
                    </p>
                    <pre
                      className="text-xs whitespace-pre-wrap"
                      style={{ color: "rgba(245,245,245,0.65)", lineHeight: 1.7, fontFamily: "inherit" }}
                    >
                      {p.emails[activeEmail]?.body || ""}
                    </pre>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
