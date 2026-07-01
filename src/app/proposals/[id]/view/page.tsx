// src/app/proposals/[id]/view/page.tsx
//
// PUBLIC, token-gated client view of a proposal (Task P5). Reachable
// without a Supabase session -- middleware.ts allows this exact path
// through unauthenticated only when a `token` query param is present, and
// sets x-cc-bare-shell so the root layout strips all operator chrome.
//
// This is the one place in the app where an unauthenticated request reads
// real CRM data, so the token check happens FIRST, before any query, and a
// failure renders a neutral message with NO proposal data and no signal
// about whether the id even exists.

import { getPipelineClient, getDefaultPipelineWorkspaceId } from "@/lib/pipeline/db";
import { verifyProposalToken } from "@/lib/proposals/token";
import { ProposalDocument } from "@/components/proposals/proposal-document";
import { AcceptancePanel } from "@/components/proposals/acceptance-panel";
import type { CrmProposal, CrmProposalLineItem } from "@/types/proposals";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

function InvalidLinkPage() {
  return (
    <main className="min-h-dvh flex items-center justify-center bg-background px-6">
      <div className="max-w-sm text-center">
        <p className="report-label mb-3">Niewdel</p>
        <h1 className="text-xl font-semibold text-balance mb-2 text-foreground">
          This link is not valid or has expired
        </h1>
        <p className="text-sm text-muted-foreground text-pretty">
          Check the link sent to you by Niewdel, or reach out to your contact and we will resend it.
        </p>
      </div>
    </main>
  );
}

export default async function ProposalViewPage({ params, searchParams }: PageProps) {
  const { id } = await params;
  const sp = await searchParams;
  const token = typeof sp.token === "string" ? sp.token : "";

  let tokenValid: boolean;
  try {
    tokenValid = verifyProposalToken(id, token);
  } catch {
    // Missing signing secret or any other verification failure. Fail
    // closed, never leak data.
    tokenValid = false;
  }

  if (!tokenValid) {
    return <InvalidLinkPage />;
  }

  const sb = getPipelineClient();
  const workspace_id = await getDefaultPipelineWorkspaceId();

  const { data: proposalRow } = await sb
    .from("crm_proposals")
    .select("*")
    .eq("workspace_id", workspace_id)
    .eq("id", id)
    .maybeSingle();

  if (!proposalRow) {
    // Token verified but no matching proposal in this workspace (deleted,
    // wrong id, etc). Same neutral message. Never confirm or deny whether
    // the id exists.
    return <InvalidLinkPage />;
  }

  const proposal = proposalRow as CrmProposal;

  const { data: lineItemsData } = await sb
    .from("crm_proposal_line_items")
    .select("*")
    .eq("workspace_id", workspace_id)
    .eq("proposal_id", id)
    .order("position", { ascending: true });

  const lineItems = (lineItemsData ?? []) as CrmProposalLineItem[];

  return (
    <main className="min-h-dvh bg-background px-6 py-10 md:px-10">
      <div className="mx-auto max-w-3xl space-y-8">
        <ProposalDocument
          proposal={proposal}
          content={proposal.content}
          lineItems={lineItems}
          theme={proposal.theme}
          mode="client"
        />
        <AcceptancePanel
          proposalId={id}
          token={token}
          lineItems={lineItems}
          status={proposal.status}
          requiresDualSign={proposal.requires_dual_sign}
          signedAt={proposal.signed_at}
          signerName={proposal.signer_name}
        />
      </div>
    </main>
  );
}
