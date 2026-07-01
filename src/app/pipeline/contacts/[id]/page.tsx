"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Users as UsersIcon, ExternalLink, Mail, Phone, Pencil, Clock3, Star, Building } from "lucide-react";
import { PageLayout } from "@/components/layout/page-layout";
import { PipelineTabs } from "@/components/pipeline/pipeline-tabs";
import { ActivityTimeline } from "@/components/pipeline/deal-activities";
import { TaskList } from "@/components/pipeline/deal-tasks";
import { NewContactDialog } from "@/components/pipeline/new-contact-dialog";
import { isDealStale } from "@/lib/pipeline/stale";
import { STAGE_LABEL, STAGE_COLOR, type CrmCompany, type CrmContact, type CrmDeal } from "@/types/pipeline";

const mono = "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace";

function formatCurrency(cents: number | null): string {
  if (cents == null) return "—";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(cents / 100);
}

type DealRow = Pick<CrmDeal, "id" | "title" | "stage" | "value_cents" | "close_date_est" | "next_action_at" | "probability" | "primary_contact_id">;

type ContactDetail = CrmContact & {
  company: Pick<CrmCompany, "id" | "name" | "domain" | "website" | "industry" | "hq"> | null;
  deals: { role: string | null; created_at: string; deal: DealRow }[];
};

export default function ContactDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;

  const [contact, setContact] = useState<ContactDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [editOpen, setEditOpen] = useState(false);

  const fetchContact = useCallback(async () => {
    const res = await fetch(`/api/pipeline/contacts/${id}`);
    if (res.status === 404) {
      setNotFound(true);
      setLoading(false);
      return;
    }
    const json = await res.json();
    setContact(json.data ?? null);
    setLoading(false);
  }, [id]);

  useEffect(() => {
    fetchContact();
  }, [fetchContact]);

  if (loading) {
    return (
      <PageLayout title="Contact" maxWidth="lg" loading>
        {null}
      </PageLayout>
    );
  }
  if (notFound || !contact) {
    return (
      <PageLayout title="Contact not found" maxWidth="lg">
        <Link href="/pipeline/clients" className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1">
          <ArrowLeft size={14} /> Back to clients
        </Link>
      </PageLayout>
    );
  }

  return (
    <PageLayout title={contact.full_name} description={contact.title ?? "Contact"} icon={UsersIcon} maxWidth="lg">
      <PipelineTabs />

      <Link href="/pipeline/clients" className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1 mb-3">
        <ArrowLeft size={14} /> Back to clients
      </Link>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Left: header + deals + tasks + activity */}
        <div className="lg:col-span-2 space-y-3">
          <div className="rounded-lg border p-4 space-y-2" style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}>
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-lg font-semibold text-balance">{contact.full_name}</p>
                {contact.title && (
                  <p className="text-[11px] mt-0.5" style={{ color: "var(--ink-soft)" }}>
                    {contact.title}
                  </p>
                )}
                <div className="mt-1.5 space-y-0.5 text-[11px]" style={{ color: "var(--ink-soft)" }}>
                  {contact.email && (
                    <a href={`mailto:${contact.email}`} className="flex items-center gap-1.5 hover:text-foreground w-fit">
                      <Mail size={10} style={{ color: "var(--rust)" }} /> {contact.email}
                    </a>
                  )}
                  {contact.phone && (
                    <a href={`tel:${contact.phone}`} className="flex items-center gap-1.5 hover:text-foreground w-fit">
                      <Phone size={10} style={{ color: "var(--rust)" }} /> {contact.phone}
                    </a>
                  )}
                  {contact.linkedin_url && (
                    <a
                      href={contact.linkedin_url.startsWith("http") ? contact.linkedin_url : `https://${contact.linkedin_url}`}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center gap-1.5 hover:text-foreground w-fit"
                    >
                      <ExternalLink size={10} style={{ color: "var(--rust)" }} /> LinkedIn
                    </a>
                  )}
                  {contact.company && (
                    <Link href={`/pipeline/companies/${contact.company.id}`} className="flex items-center gap-1.5 hover:text-foreground w-fit">
                      <Building size={10} style={{ color: "var(--rust)" }} /> {contact.company.name}
                    </Link>
                  )}
                </div>
              </div>
              <button
                onClick={() => setEditOpen(true)}
                aria-label="Edit contact"
                className="flex items-center gap-1.5 px-2.5 py-1 text-[10px] uppercase tracking-wider rounded-md transition-colors hover:bg-[color-mix(in oklch, var(--rust) calc(0.15 * 100%), transparent)] shrink-0"
                style={{ fontFamily: mono, color: "var(--rust)", border: "1px solid color-mix(in oklch, var(--rust) calc(0.3 * 100%), transparent)" }}
              >
                <Pencil size={11} /> Edit
              </button>
            </div>
            {contact.notes && (
              <p className="text-sm text-pretty pt-1" style={{ color: "var(--ink-soft)" }}>
                {contact.notes}
              </p>
            )}
          </div>

          {/* Deals */}
          <div className="rounded-lg border p-4 space-y-3" style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}>
            <p className="text-[10px] uppercase tracking-wider" style={{ color: "color-mix(in oklch, var(--rust) calc(0.5 * 100%), transparent)", fontFamily: mono }}>
              Deals ({contact.deals.length})
            </p>
            {contact.deals.length === 0 ? (
              <p className="text-[11px]" style={{ color: "var(--ink-soft)", fontFamily: mono }}>
                Not attached to any deals yet.
              </p>
            ) : (
              <ul className="space-y-1.5">
                {contact.deals.map(({ deal }) => {
                  const isPrimary = deal.primary_contact_id === contact.id;
                  return (
                    <li key={deal.id}>
                      <Link
                        href={`/pipeline/deals/${deal.id}`}
                        className="flex items-center justify-between gap-2 rounded-md px-2.5 py-2 transition-colors hover:bg-[var(--paper-sunken)]"
                        style={{ border: "1px solid var(--border)" }}
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5">
                            <p className="text-sm font-medium truncate">{deal.title}</p>
                            {isPrimary && <Star size={11} fill="var(--rust)" style={{ color: "var(--rust)" }} aria-label="Primary contact" />}
                            {isDealStale(deal) && (
                              <span
                                className="flex items-center gap-1 shrink-0 px-1.5 py-0.5 rounded text-[9px] uppercase tracking-wider"
                                style={{ fontFamily: mono, backgroundColor: "rgba(239,68,68,0.12)", color: "#EF4444" }}
                                title="No upcoming next action"
                              >
                                <Clock3 size={9} /> Stale
                              </span>
                            )}
                          </div>
                          <span className="text-[10px] uppercase tracking-wider" style={{ fontFamily: mono, color: STAGE_COLOR[deal.stage] }}>
                            {STAGE_LABEL[deal.stage]}
                          </span>
                        </div>
                        <span className="text-xs tabular-nums font-mono shrink-0" style={{ color: "var(--ink-soft)" }}>
                          {formatCurrency(deal.value_cents)}
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          <TaskList scope={{ contactId: id }} />

          <ActivityTimeline scope={{ contactId: id }} />
        </div>

        {/* Right: company card */}
        <div className="space-y-3">
          <div className="rounded-lg border p-4" style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}>
            <p className="text-[10px] uppercase tracking-wider mb-2" style={{ color: "color-mix(in oklch, var(--rust) calc(0.5 * 100%), transparent)", fontFamily: mono }}>
              Company
            </p>
            {contact.company ? (
              <Link href={`/pipeline/companies/${contact.company.id}`} className="block">
                <p className="text-sm font-semibold hover:underline">{contact.company.name}</p>
                <div className="mt-1 space-y-0.5 text-[11px]" style={{ color: "var(--ink-soft)" }}>
                  {contact.company.industry && <p>{contact.company.industry}</p>}
                  {contact.company.hq && <p>{contact.company.hq}</p>}
                  {contact.company.website && (
                    <span className="flex items-center gap-1">
                      <ExternalLink size={10} style={{ color: "var(--rust)" }} /> {contact.company.domain ?? "Website"}
                    </span>
                  )}
                </div>
              </Link>
            ) : (
              <p className="text-[11px]" style={{ color: "var(--ink-soft)", fontFamily: mono }}>
                No company linked.
              </p>
            )}
          </div>
        </div>
      </div>

      <NewContactDialog
        open={editOpen}
        contact={contact}
        onClose={() => setEditOpen(false)}
        onCreated={() => {
          setEditOpen(false);
          fetchContact();
        }}
      />
    </PageLayout>
  );
}
