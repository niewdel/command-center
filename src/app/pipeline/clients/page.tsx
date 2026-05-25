"use client";

import { useCallback, useEffect, useState } from "react";
import { Mail, Phone, ExternalLink, UserPlus, Users as UsersIcon, Pencil } from "lucide-react";
import { PageLayout } from "@/components/layout/page-layout";
import { PipelineTabs } from "@/components/pipeline/pipeline-tabs";
import { supabase } from "@/lib/supabase";
import { NewContactDialog } from "@/components/pipeline/new-contact-dialog";
import { STAGE_LABEL, STAGE_COLOR, type DealStage, type CrmContact } from "@/types/pipeline";

const mono = "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace";

type ClientRow = CrmContact & {
  company: { id: string; name: string; domain: string | null; industry: string | null } | null;
  deals: { id: string; stage: DealStage; value_cents: number | null }[];
};

export default function ClientsPage() {
  const [contacts, setContacts] = useState<ClientRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [addOpen, setAddOpen] = useState(false);
  const [editing, setEditing] = useState<CrmContact | null>(null);

  const fetchContacts = useCallback(async () => {
    const res = await fetch("/api/pipeline/contacts");
    const json = await res.json();
    setContacts(json.data ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchContacts();
    const ch = supabase
      .channel("crm-contacts-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "crm_contacts" }, () => fetchContacts())
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [fetchContacts]);

  const filtered = search.trim()
    ? contacts.filter((c) => {
        const q = search.toLowerCase();
        return (
          c.full_name.toLowerCase().includes(q) ||
          (c.title ?? "").toLowerCase().includes(q) ||
          (c.email ?? "").toLowerCase().includes(q) ||
          (c.company?.name ?? "").toLowerCase().includes(q)
        );
      })
    : contacts;

  return (
    <PageLayout
      title="Clients"
      eyebrow="Pipeline · People"
      description="People in the Niewdel CRM."
      icon={UsersIcon}
      maxWidth="xl"
      loading={loading}
    >
      <PipelineTabs />

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search name, email, company..."
          className="flex-1 max-w-md px-3 py-2 text-xs rounded-md border bg-transparent outline-none focus:border-[color-mix(in oklch, var(--rust) calc(0.4 * 100%), transparent)] transition-colors"
          style={{ borderColor: "var(--border)", color: "var(--ink)" }}
        />
        <button
          onClick={() => setAddOpen(true)}
          className="flex items-center gap-1.5 px-3 py-2 text-[10px] uppercase tracking-wider rounded-md transition-colors hover:bg-[color-mix(in oklch, var(--rust) calc(0.15 * 100%), transparent)]"
          style={{ fontFamily: mono, color: "var(--rust)", border: "1px solid color-mix(in oklch, var(--rust) calc(0.3 * 100%), transparent)" }}
        >
          <UserPlus size={12} /> Add Client
        </button>
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-12 rounded-lg border" style={{ backgroundColor: "var(--card)", borderColor: "var(--border)", color: "var(--ink-soft)" }}>
          <p className="text-sm" style={{ fontFamily: mono }}>
            {contacts.length === 0 ? "No clients yet. Add one or promote a prospect from /leads/prospects." : "No matches."}
          </p>
        </div>
      ) : (
        <ul className="space-y-2">
          {filtered.map((c) => {
            const activeDeals = c.deals.filter((d) => d.stage !== "lost" && d.stage !== "live");
            const liveDeals = c.deals.filter((d) => d.stage === "live");
            return (
              <li
                key={c.id}
                className="p-3 rounded-lg border group transition-colors hover:border-[color-mix(in oklch, var(--rust) calc(0.25 * 100%), transparent)] cursor-pointer"
                style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}
                onClick={() => setEditing(c)}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-semibold truncate">{c.full_name}</p>
                      {c.title && (
                        <span className="text-[11px]" style={{ color: "var(--ink-soft)" }}>
                          · {c.title}
                        </span>
                      )}
                    </div>
                    {c.company && (
                      <p className="text-[11px] mt-0.5 truncate" style={{ color: "var(--ink-soft)" }}>
                        {c.company.name}
                        {c.company.industry && <span style={{ color: "var(--ink-faint)" }}> · {c.company.industry}</span>}
                      </p>
                    )}
                    <div className="flex flex-wrap items-center gap-3 mt-1.5 text-[11px]" style={{ color: "var(--ink-soft)" }}>
                      {c.email && (
                        <a href={`mailto:${c.email}`} onClick={(e) => e.stopPropagation()} className="flex items-center gap-1 hover:text-foreground">
                          <Mail size={10} style={{ color: "var(--rust)" }} /> {c.email}
                        </a>
                      )}
                      {c.phone && (
                        <a href={`tel:${c.phone}`} onClick={(e) => e.stopPropagation()} className="flex items-center gap-1 hover:text-foreground">
                          <Phone size={10} style={{ color: "var(--rust)" }} /> {c.phone}
                        </a>
                      )}
                      {c.linkedin_url && (
                        <a
                          href={c.linkedin_url.startsWith("http") ? c.linkedin_url : `https://${c.linkedin_url}`}
                          target="_blank"
                          rel="noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="flex items-center gap-1 hover:text-foreground"
                        >
                          <ExternalLink size={10} style={{ color: "var(--rust)" }} /> LinkedIn
                        </a>
                      )}
                    </div>
                  </div>
                  <div className="flex items-start gap-2 shrink-0">
                    <div className="text-right space-y-0.5">
                      {activeDeals.length > 0 && (
                        <p className="text-[10px] uppercase tracking-wider" style={{ color: "var(--rust)", fontFamily: mono }}>
                          {activeDeals.length} active
                        </p>
                      )}
                      {liveDeals.length > 0 && (
                        <p className="text-[10px] uppercase tracking-wider" style={{ color: STAGE_COLOR.live, fontFamily: mono }}>
                          {liveDeals.length} live
                        </p>
                      )}
                    </div>
                    <Pencil
                      size={12}
                      className="opacity-0 group-hover:opacity-60 transition-opacity mt-0.5"
                      style={{ color: "var(--ink-soft)" }}
                      aria-hidden
                    />
                  </div>
                </div>
                {c.deals.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {c.deals.map((d) => (
                      <span
                        key={d.id}
                        className="text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded"
                        style={{ color: STAGE_COLOR[d.stage], backgroundColor: `${STAGE_COLOR[d.stage]}1a`, fontFamily: mono }}
                      >
                        {STAGE_LABEL[d.stage]}
                      </span>
                    ))}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      <NewContactDialog open={addOpen} onClose={() => setAddOpen(false)} onCreated={fetchContacts} />
      <NewContactDialog
        open={!!editing}
        contact={editing}
        onClose={() => setEditing(null)}
        onCreated={fetchContacts}
      />
    </PageLayout>
  );
}
