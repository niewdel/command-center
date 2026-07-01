"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { FileText, Plus } from "lucide-react";
import { PageLayout } from "@/components/layout/page-layout";
import { PipelineTabs } from "@/components/pipeline/pipeline-tabs";
import { NewProposalDialog } from "@/components/proposals/new-proposal-dialog";
import { formatCents } from "@/lib/proposals/pricing";
import {
  PROPOSAL_STATUS_COLOR,
  PROPOSAL_STATUS_LABEL,
  PROPOSAL_TYPE_LABEL,
  type CrmProposal,
} from "@/types/proposals";

const mono = "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace";

type ProposalRow = CrmProposal & {
  company: { id: string; name: string } | null;
};

function formatUpdatedAt(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export default function ProposalsListPage() {
  const router = useRouter();
  const [proposals, setProposals] = useState<ProposalRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [newOpen, setNewOpen] = useState(false);

  const fetchProposals = useCallback(async () => {
    const res = await fetch("/api/pipeline/proposals");
    const json = await res.json();
    setProposals(json.data ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchProposals();
  }, [fetchProposals]);

  return (
    <PageLayout
      title="Proposals"
      eyebrow="Pipeline · Proposals"
      description="Compose, send, and track client proposals and e-signed agreements."
      icon={FileText}
      maxWidth="xl"
      loading={loading}
      actions={
        <button
          onClick={() => setNewOpen(true)}
          className="flex items-center gap-1.5 px-3 py-2 text-[10px] uppercase tracking-wider rounded-md transition-colors hover:bg-[color-mix(in oklch, var(--rust) calc(0.15 * 100%), transparent)]"
          style={{ fontFamily: mono, color: "var(--rust)", border: "1px solid color-mix(in oklch, var(--rust) calc(0.3 * 100%), transparent)" }}
        >
          <Plus size={12} /> New proposal
        </button>
      }
    >
      <PipelineTabs />

      {proposals.length === 0 ? (
        <div
          className="text-center py-12 rounded-lg border"
          style={{ backgroundColor: "var(--card)", borderColor: "var(--border)", color: "var(--ink-soft)" }}
        >
          <p className="text-sm" style={{ fontFamily: mono }}>
            No proposals yet. Create one to get started.
          </p>
        </div>
      ) : (
        <ul className="space-y-2">
          {proposals.map((p) => (
            <li key={p.id}>
              <Link
                href={`/pipeline/proposals/${p.id}/edit`}
                className="flex items-center justify-between gap-3 p-3 rounded-lg border transition-colors hover:border-[color-mix(in oklch, var(--rust) calc(0.25 * 100%), transparent)]"
                style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold truncate">{p.title}</p>
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-0.5 text-[11px]" style={{ color: "var(--ink-soft)" }}>
                    <span>{p.company?.name ?? "No company"}</span>
                    <span>·</span>
                    <span>{PROPOSAL_TYPE_LABEL[p.type]}</span>
                    <span>·</span>
                    <span>Updated {formatUpdatedAt(p.updated_at)}</span>
                  </div>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <span className="text-sm font-semibold tabular-nums">{formatCents(p.subtotal_cents ?? 0)}</span>
                  <span
                    className="text-[10px] uppercase tracking-wider px-2 py-1 rounded-full"
                    style={{
                      fontFamily: mono,
                      color: PROPOSAL_STATUS_COLOR[p.status],
                      border: `1px solid color-mix(in oklch, ${PROPOSAL_STATUS_COLOR[p.status]} calc(0.4 * 100%), transparent)`,
                    }}
                  >
                    {PROPOSAL_STATUS_LABEL[p.status]}
                  </span>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}

      <NewProposalDialog
        open={newOpen}
        onClose={() => setNewOpen(false)}
        onCreated={(proposal) => {
          setNewOpen(false);
          router.push(`/pipeline/proposals/${proposal.id}/edit`);
        }}
      />
    </PageLayout>
  );
}
