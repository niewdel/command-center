"use client";

import { useCallback, useEffect, useState } from "react";
import { DollarSign } from "lucide-react";
import { PageLayout } from "@/components/layout/page-layout";
import { PipelineTabs } from "@/components/pipeline/pipeline-tabs";
import { formatCents } from "@/lib/proposals/pricing";

const mono = "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace";

type CompanyMrr = { companyId: string; companyName: string; mrrCents: number };

type RevenueData = {
  mrrCents: number;
  arrCents: number;
  activeContracts: number;
  evergreenCents: number;
  finiteCents: number;
  newMrrThisMonthCents: number;
  byCompany: CompanyMrr[];
};

export default function PipelineRevenuePage() {
  const [data, setData] = useState<RevenueData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchRevenue = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/pipeline/revenue");
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed to load revenue");
      setData(json.data as RevenueData);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load revenue");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRevenue();
  }, [fetchRevenue]);

  const hasMrr = (data?.mrrCents ?? 0) > 0;

  return (
    <PageLayout
      title="Revenue"
      eyebrow="Sales · Niewdel"
      description="MRR and ARR from signed proposals with recurring line items. No Stripe yet, this is the ground truth from the proposal builder."
      icon={DollarSign}
      maxWidth="2xl"
      loading={loading}
    >
      <PipelineTabs />

      {error && (
        <p className="text-sm rounded-lg border p-3" style={{ borderColor: "#8F3623", color: "#8F3623" }}>
          {error}
        </p>
      )}

      {!loading && !error && !hasMrr && (
        <EmptyState message="No recurring revenue yet. Sign a proposal with a monthly plan to see MRR here." />
      )}

      {!loading && !error && hasMrr && data && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-end gap-x-10 gap-y-4 pb-2">
            <Stat label="MRR" value={formatCents(data.mrrCents)} />
            <Stat label="ARR" value={formatCents(data.arrCents)} hint="MRR x 12" />
            <Stat label="Active contracts" value={`${data.activeContracts}`} />
            <Stat label="New MRR this month" value={formatCents(data.newMrrThisMonthCents)} />
          </div>

          <Section title="Evergreen vs finite term">
            <div className="flex flex-wrap gap-3">
              <SplitCard label="Evergreen" value={formatCents(data.evergreenCents)} hint="No end date" />
              <SplitCard label="Finite term" value={formatCents(data.finiteCents)} hint="Fixed number of months" />
            </div>
          </Section>

          <Section title="MRR by company">
            {data.byCompany.length === 0 ? (
              <EmptyState message="No company-linked recurring revenue yet." />
            ) : (
              <div className="space-y-2">
                {data.byCompany.map((c) => (
                  <div key={c.companyId} className="flex items-center justify-between rounded-lg border px-4 py-2.5" style={{ borderColor: "var(--border)" }}>
                    <span className="text-sm font-medium">{c.companyName}</span>
                    <span className="text-sm tabular-nums" style={{ fontFamily: mono }}>
                      {formatCents(c.mrrCents)}/mo
                    </span>
                  </div>
                ))}
              </div>
            )}
          </Section>
        </div>
      )}
    </PageLayout>
  );
}

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="mono-tag-muted" title={hint}>
        {label}
      </span>
      <span className="text-2xl font-bold tabular-nums tracking-tight text-foreground">{value}</span>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border p-4 space-y-3" style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}>
      <h2 className="text-sm font-semibold">{title}</h2>
      {children}
    </div>
  );
}

function SplitCard({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div className="flex-1 min-w-48 rounded-lg border p-4" style={{ backgroundColor: "var(--paper-sunken)", borderColor: "var(--border)" }}>
      <p className="text-lg font-bold tabular-nums">{value}</p>
      <p className="text-[11px]" style={{ color: "var(--ink-soft)", fontFamily: mono }}>
        {label} · {hint}
      </p>
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <p className="text-[11px] py-6 text-center" style={{ color: "var(--ink-faint)", fontFamily: mono }}>
      {message}
    </p>
  );
}
