"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Building, ExternalLink, Mail, Phone, Pencil, Clock3 } from "lucide-react";
import { PageLayout } from "@/components/layout/page-layout";
import { PipelineTabs } from "@/components/pipeline/pipeline-tabs";
import { ActivityTimeline } from "@/components/pipeline/deal-activities";
import { TaskList } from "@/components/pipeline/deal-tasks";
import { NewCompanyDialog } from "@/components/pipeline/new-company-dialog";
import { isDealStale } from "@/lib/pipeline/stale";
import {
  STAGE_LABEL,
  STAGE_COLOR,
  type CrmCompany,
  type CrmContact,
  type CrmDeal,
} from "@/types/pipeline";

const mono = "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace";

function formatCurrency(cents: number | null): string {
  if (cents == null) return "—";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(cents / 100);
}

type CompanyDetail = CrmCompany & {
  contacts: Pick<CrmContact, "id" | "full_name" | "title" | "email" | "phone" | "linkedin_url">[];
  deals: Pick<CrmDeal, "id" | "title" | "stage" | "value_cents" | "close_date_est" | "next_action_at" | "probability" | "owner">[];
};

export default function CompanyDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;

  const [company, setCompany] = useState<CompanyDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [editOpen, setEditOpen] = useState(false);

  const fetchCompany = useCallback(async () => {
    const res = await fetch(`/api/pipeline/companies/${id}`);
    if (res.status === 404) {
      setNotFound(true);
      setLoading(false);
      return;
    }
    const json = await res.json();
    setCompany(json.data ?? null);
    setLoading(false);
  }, [id]);

  useEffect(() => {
    fetchCompany();
  }, [fetchCompany]);

  if (loading) {
    return (
      <PageLayout title="Company" maxWidth="lg" loading>
        {null}
      </PageLayout>
    );
  }
  if (notFound || !company) {
    return (
      <PageLayout title="Company not found" maxWidth="lg">
        <Link href="/pipeline/companies" className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1">
          <ArrowLeft size={14} /> Back to companies
        </Link>
      </PageLayout>
    );
  }

  return (
    <PageLayout title={company.name} description={company.industry ?? "Company"} icon={Building} maxWidth="lg">
      <PipelineTabs />

      <Link href="/pipeline/companies" className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1 mb-3">
        <ArrowLeft size={14} /> Back to companies
      </Link>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Left: header + deals + tasks + activity */}
        <div className="lg:col-span-2 space-y-3">
          <div className="rounded-lg border p-4 space-y-2" style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}>
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-lg font-semibold text-balance">{company.name}</p>
                <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px]" style={{ color: "var(--ink-soft)" }}>
                  {company.industry && <span>{company.industry}</span>}
                  {company.hq && <span>{company.hq}</span>}
                  {company.headcount && <span>{company.headcount} employees</span>}
                  {company.owner && <span>Owner: {company.owner}</span>}
                </div>
                {company.website && (
                  <a
                    href={company.website.startsWith("http") ? company.website : `https://${company.website}`}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-1 flex items-center gap-1 text-[11px] hover:text-foreground w-fit"
                    style={{ color: "var(--ink-soft)" }}
                  >
                    <ExternalLink size={10} style={{ color: "var(--rust)" }} /> {company.domain ?? company.website}
                  </a>
                )}
              </div>
              <button
                onClick={() => setEditOpen(true)}
                aria-label="Edit company"
                className="flex items-center gap-1.5 px-2.5 py-1 text-[10px] uppercase tracking-wider rounded-md transition-colors hover:bg-[color-mix(in oklch, var(--rust) calc(0.15 * 100%), transparent)] shrink-0"
                style={{ fontFamily: mono, color: "var(--rust)", border: "1px solid color-mix(in oklch, var(--rust) calc(0.3 * 100%), transparent)" }}
              >
                <Pencil size={11} /> Edit
              </button>
            </div>
            {company.notes && (
              <p className="text-sm text-pretty pt-1" style={{ color: "var(--ink-soft)" }}>
                {company.notes}
              </p>
            )}
          </div>

          {/* Deals */}
          <div className="rounded-lg border p-4 space-y-3" style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}>
            <p className="text-[10px] uppercase tracking-wider" style={{ color: "color-mix(in oklch, var(--rust) calc(0.5 * 100%), transparent)", fontFamily: mono }}>
              Deals ({company.deals.length})
            </p>
            {company.deals.length === 0 ? (
              <p className="text-[11px]" style={{ color: "var(--ink-soft)", fontFamily: mono }}>
                No deals yet for this company.
              </p>
            ) : (
              <ul className="space-y-1.5">
                {company.deals.map((deal) => (
                  <li key={deal.id}>
                    <Link
                      href={`/pipeline/deals/${deal.id}`}
                      className="flex items-center justify-between gap-2 rounded-md px-2.5 py-2 transition-colors hover:bg-[var(--paper-sunken)]"
                      style={{ border: "1px solid var(--border)" }}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <p className="text-sm font-medium truncate">{deal.title}</p>
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
                        <span
                          className="text-[10px] uppercase tracking-wider"
                          style={{ fontFamily: mono, color: STAGE_COLOR[deal.stage] }}
                        >
                          {STAGE_LABEL[deal.stage]}
                        </span>
                      </div>
                      <span className="text-xs tabular-nums font-mono shrink-0" style={{ color: "var(--ink-soft)" }}>
                        {formatCurrency(deal.value_cents)}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <TaskList scope={{ crmCompanyId: id }} />

          <ActivityTimeline scope={{ crmCompanyId: id }} />
        </div>

        {/* Right: contacts */}
        <div className="space-y-3">
          <div className="rounded-lg border p-4 space-y-3" style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}>
            <p className="text-[10px] uppercase tracking-wider" style={{ color: "color-mix(in oklch, var(--rust) calc(0.5 * 100%), transparent)", fontFamily: mono }}>
              Contacts ({company.contacts.length})
            </p>
            {company.contacts.length === 0 ? (
              <p className="text-[11px]" style={{ color: "var(--ink-soft)", fontFamily: mono }}>
                No contacts at this company yet.
              </p>
            ) : (
              <div className="space-y-2">
                {company.contacts.map((c) => (
                  <Link
                    key={c.id}
                    href={`/pipeline/contacts/${c.id}`}
                    className="block rounded-md p-2.5 transition-colors hover:bg-[var(--paper-sunken)]"
                    style={{ backgroundColor: "var(--paper-sunken)", border: "1px solid var(--border)" }}
                  >
                    <p className="text-sm font-semibold truncate">{c.full_name}</p>
                    {c.title && (
                      <p className="text-[11px] truncate" style={{ color: "var(--ink-soft)" }}>
                        {c.title}
                      </p>
                    )}
                    <div className="mt-1 space-y-0.5 text-[11px]" style={{ color: "var(--ink-soft)" }}>
                      {c.email && (
                        <span className="flex items-center gap-1.5">
                          <Mail size={10} style={{ color: "var(--rust)" }} /> {c.email}
                        </span>
                      )}
                      {c.phone && (
                        <span className="flex items-center gap-1.5">
                          <Phone size={10} style={{ color: "var(--rust)" }} /> {c.phone}
                        </span>
                      )}
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <NewCompanyDialog
        open={editOpen}
        company={company}
        onClose={() => setEditOpen(false)}
        onCreated={() => {
          setEditOpen(false);
          fetchCompany();
        }}
      />
    </PageLayout>
  );
}
