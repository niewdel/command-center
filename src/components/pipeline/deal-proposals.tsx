"use client";

// Proposals section on the deal detail page (Task P6): lists proposals
// attached to this deal and lets the user spin up a new one prefilled from
// the deal (company + primary contact denormalized server-side in the
// create route). Mirrors the styling of TaskList / ActivityTimeline on the
// same page.

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { FileText, Plus, ExternalLink } from "lucide-react";
import { NewProposalDialog } from "@/components/proposals/new-proposal-dialog";
import { formatCents } from "@/lib/proposals/pricing";
import {
  PROPOSAL_STATUS_COLOR,
  PROPOSAL_STATUS_LABEL,
  PROPOSAL_TYPE_LABEL,
  type CrmProposal,
} from "@/types/proposals";

const mono = "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace";

const CLIENT_LINK_STATUSES = new Set(["sent", "viewed", "signed"]);

export function DealProposals({
  dealId,
  crmCompanyId,
  primaryContactId,
}: {
  dealId: string;
  crmCompanyId: string | null;
  primaryContactId: string | null;
}) {
  const router = useRouter();
  const [proposals, setProposals] = useState<CrmProposal[]>([]);
  const [loading, setLoading] = useState(true);
  const [newOpen, setNewOpen] = useState(false);
  const [openingLinkId, setOpeningLinkId] = useState<string | null>(null);

  const fetchProposals = useCallback(async () => {
    const res = await fetch(`/api/pipeline/proposals?deal_id=${dealId}`);
    const json = await res.json();
    setProposals(json.data ?? []);
    setLoading(false);
  }, [dealId]);

  useEffect(() => {
    fetchProposals();
  }, [fetchProposals]);

  const handleCreated = (proposal: CrmProposal) => {
    setNewOpen(false);
    router.push(`/pipeline/proposals/${proposal.id}/edit`);
  };

  const handleOpenClientLink = async (proposalId: string) => {
    setOpeningLinkId(proposalId);
    try {
      const res = await fetch(`/api/pipeline/proposals/${proposalId}/link`);
      const json = await res.json();
      if (json.url) window.open(json.url, "_blank", "noreferrer");
    } finally {
      setOpeningLinkId(null);
    }
  };

  return (
    <div
      className="rounded-lg border p-4 space-y-3"
      style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}
    >
      <div className="flex items-center justify-between">
        <p
          className="text-[10px] uppercase tracking-wider flex items-center gap-1.5"
          style={{ color: "color-mix(in oklch, var(--rust) calc(0.5 * 100%), transparent)", fontFamily: mono }}
        >
          <FileText size={11} /> Proposals ({proposals.length})
        </p>
        <button
          onClick={() => setNewOpen(true)}
          className="flex items-center gap-1.5 px-2.5 py-1 text-[10px] uppercase tracking-wider rounded-md transition-colors hover:bg-[color-mix(in oklch, var(--rust) calc(0.15 * 100%), transparent)]"
          style={{ fontFamily: mono, color: "var(--rust)", border: "1px solid color-mix(in oklch, var(--rust) calc(0.3 * 100%), transparent)" }}
        >
          <Plus size={11} /> New proposal
        </button>
      </div>

      {loading ? null : proposals.length === 0 ? (
        <p className="text-[11px]" style={{ color: "var(--ink-soft)", fontFamily: mono }}>
          No proposals yet. Click New proposal to draft one for this deal.
        </p>
      ) : (
        <div className="space-y-2">
          {proposals.map((p) => (
            <div
              key={p.id}
              className="rounded-md border p-2.5"
              style={{ backgroundColor: "var(--paper-sunken)", borderColor: "var(--border)" }}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <Link href={`/pipeline/proposals/${p.id}/edit`} className="text-sm font-semibold truncate hover:underline block">
                    {p.title}
                  </Link>
                  <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 mt-0.5 text-[11px]" style={{ color: "var(--ink-soft)" }}>
                    <span>{PROPOSAL_TYPE_LABEL[p.type]}</span>
                    <span>·</span>
                    <span className="tabular-nums">{formatCents(p.subtotal_cents ?? 0)}</span>
                  </div>
                </div>
                <span
                  className="text-[10px] uppercase tracking-wider px-2 py-1 rounded-full shrink-0"
                  style={{
                    fontFamily: mono,
                    color: PROPOSAL_STATUS_COLOR[p.status],
                    border: `1px solid color-mix(in oklch, ${PROPOSAL_STATUS_COLOR[p.status]} calc(0.4 * 100%), transparent)`,
                  }}
                >
                  {PROPOSAL_STATUS_LABEL[p.status]}
                </span>
              </div>
              {CLIENT_LINK_STATUSES.has(p.status) && (
                <button
                  onClick={() => handleOpenClientLink(p.id)}
                  disabled={openingLinkId === p.id}
                  className="mt-1.5 flex items-center gap-1 text-[10px] uppercase tracking-wider hover:underline disabled:opacity-50"
                  style={{ fontFamily: mono, color: "var(--rust)" }}
                >
                  <ExternalLink size={10} /> {openingLinkId === p.id ? "Opening…" : "Client link"}
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      <NewProposalDialog
        open={newOpen}
        onClose={() => setNewOpen(false)}
        onCreated={handleCreated}
        dealId={dealId}
        crmCompanyId={crmCompanyId}
        primaryContactId={primaryContactId}
      />
    </div>
  );
}
