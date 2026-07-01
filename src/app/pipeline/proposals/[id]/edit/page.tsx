"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Check, Copy, Send } from "lucide-react";
import { PageLayout } from "@/components/layout/page-layout";
import { PipelineTabs } from "@/components/pipeline/pipeline-tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { BlockEditor } from "@/components/proposals/builder/block-editor";
import { LineItemEditor, type EditableLineItem } from "@/components/proposals/builder/line-item-editor";
import { TotalsSidebar } from "@/components/proposals/builder/totals-sidebar";
import { ProposalDocument } from "@/components/proposals/proposal-document";
import {
  PROPOSAL_STATUS_COLOR,
  PROPOSAL_STATUS_LABEL,
  type CrmProposal,
  type CrmProposalEvent,
  type CrmProposalLineItem,
  type ProposalContent,
  type ProposalTheme,
} from "@/types/proposals";

const mono = "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace";

type ProposalDetail = CrmProposal & {
  lineItems: CrmProposalLineItem[];
  events: CrmProposalEvent[];
  company: { id: string; name: string } | null;
};

function toEditable(items: CrmProposalLineItem[]): EditableLineItem[] {
  return items.map((item) => ({
    _key: item.id,
    kind: item.kind,
    label: item.label,
    description: item.description,
    badge: item.badge,
    amount_cents: item.amount_cents,
    cadence: item.cadence,
    recurring_months: item.recurring_months,
    option_group: item.option_group,
    is_optional: item.is_optional,
    is_selected: item.is_selected,
    position: item.position,
  }));
}

/** Editable rows carry no id/workspace_id/proposal_id/created_at yet, but the
 *  pricing engine only reads kind/amount_cents/option_group/is_optional/
 *  is_selected/position, so placeholder values here are never read. */
function toPricingRows(items: EditableLineItem[]): CrmProposalLineItem[] {
  return items.map((item) => ({
    ...item,
    id: item._key,
    workspace_id: "",
    proposal_id: "",
    created_at: "",
  }));
}

export default function ProposalEditPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;

  const [proposal, setProposal] = useState<ProposalDetail | null>(null);
  const [content, setContent] = useState<ProposalContent>([]);
  const [lineItems, setLineItems] = useState<EditableLineItem[]>([]);
  const [title, setTitle] = useState("");
  const [theme, setTheme] = useState<ProposalTheme>("dark");
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [saving, setSaving] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [clientLink, setClientLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const fetchProposal = useCallback(async () => {
    const res = await fetch(`/api/pipeline/proposals/${id}`);
    if (res.status === 404) {
      setNotFound(true);
      setLoading(false);
      return;
    }
    const json = await res.json();
    const data = json.data as ProposalDetail;
    setProposal(data);
    setContent(data.content);
    setLineItems(toEditable(data.lineItems));
    setTitle(data.title);
    setTheme(data.theme);
    setLoading(false);
  }, [id]);

  useEffect(() => {
    fetchProposal();
  }, [fetchProposal]);

  const readOnly = proposal ? proposal.status === "signed" || proposal.status === "void" : false;
  const pricingRows = useMemo(() => toPricingRows(lineItems), [lineItems]);

  const handleSave = async () => {
    if (!proposal) return;
    setSaving(true);
    setError(null);

    const patchRes = await fetch(`/api/pipeline/proposals/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, theme, content }),
    });
    if (!patchRes.ok) {
      const j = await patchRes.json().catch(() => ({}));
      setError(j.error ?? "Failed to save");
      setSaving(false);
      return;
    }

    const lineItemsRes = await fetch(`/api/pipeline/proposals/${id}/line-items`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ lineItems }),
    });
    if (!lineItemsRes.ok) {
      const j = await lineItemsRes.json().catch(() => ({}));
      setError(j.error ?? "Failed to save line items");
      setSaving(false);
      return;
    }

    setSaving(false);
    await fetchProposal();
  };

  const handleSend = async () => {
    if (!proposal) return;
    setSending(true);
    setError(null);

    // Save first so the sent snapshot reflects whatever is on screen.
    await handleSave();

    const patchRes = await fetch(`/api/pipeline/proposals/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "sent" }),
    });
    if (!patchRes.ok) {
      const j = await patchRes.json().catch(() => ({}));
      setError(j.error ?? "Failed to send");
      setSending(false);
      return;
    }

    const linkRes = await fetch(`/api/pipeline/proposals/${id}/link`);
    if (linkRes.ok) {
      const linkJson = await linkRes.json();
      setClientLink(linkJson.url as string);
    }

    setSending(false);
    await fetchProposal();
  };

  const handleCopyLink = async () => {
    if (!clientLink) return;
    await navigator.clipboard.writeText(clientLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (loading) {
    return (
      <PageLayout title="Proposal" maxWidth="2xl" loading>
        {null}
      </PageLayout>
    );
  }

  if (notFound || !proposal) {
    return (
      <PageLayout title="Proposal not found" maxWidth="lg">
        <PipelineTabs />
        <p className="text-sm text-muted-foreground">
          This proposal does not exist. <Link href="/pipeline/proposals" className="underline">Back to proposals</Link>.
        </p>
      </PageLayout>
    );
  }

  return (
    <PageLayout
      title={proposal.title}
      eyebrow="Pipeline · Proposals"
      maxWidth="2xl"
      actions={
        <div className="flex items-center gap-2">
          <span
            className="text-[10px] uppercase tracking-wider px-2 py-1 rounded-full"
            style={{
              fontFamily: mono,
              color: PROPOSAL_STATUS_COLOR[proposal.status],
              border: `1px solid color-mix(in oklch, ${PROPOSAL_STATUS_COLOR[proposal.status]} calc(0.4 * 100%), transparent)`,
            }}
          >
            {PROPOSAL_STATUS_LABEL[proposal.status]}
          </span>
          {!readOnly && (
            <>
              <Button variant="outline" onClick={handleSave} disabled={saving || sending}>
                {saving ? "Saving…" : "Save"}
              </Button>
              {proposal.status === "draft" && (
                <Button onClick={handleSend} disabled={saving || sending} className="gap-1.5">
                  <Send className="size-3.5" />
                  {sending ? "Sending…" : "Send"}
                </Button>
              )}
            </>
          )}
        </div>
      }
    >
      <PipelineTabs />
      <div className="mb-2">
        <Link href="/pipeline/proposals" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
          <ArrowLeft className="size-3" /> Back to proposals
        </Link>
      </div>

      {error && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-400 mb-4">{error}</div>
      )}

      {clientLink && (
        <div className="rounded-lg border border-border p-3 mb-4 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Client link</p>
            <p className="text-xs truncate font-mono">{clientLink}</p>
          </div>
          <Button variant="outline" size="sm" onClick={handleCopyLink} className="gap-1.5 shrink-0">
            {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
            {copied ? "Copied" : "Copy link"}
          </Button>
        </div>
      )}

      {readOnly && (
        <div className="rounded-lg border border-border p-3 mb-4">
          <p className="text-xs text-muted-foreground">
            This proposal is {PROPOSAL_STATUS_LABEL[proposal.status].toLowerCase()} and is now read-only.
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-6">
        <div className="space-y-6 min-w-0">
          <section className="space-y-3">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Details</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Title</Label>
                <Input disabled={readOnly} value={title} onChange={(e) => setTitle(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Theme</Label>
                <div className="flex gap-2">
                  {(["dark", "light"] as const).map((t) => (
                    <button
                      key={t}
                      type="button"
                      disabled={readOnly}
                      onClick={() => setTheme(t)}
                      className={`rounded-md border px-3 py-1.5 text-xs capitalize transition-colors disabled:opacity-50 ${
                        theme === t ? "border-foreground text-foreground" : "border-border text-muted-foreground"
                      }`}
                    >
                      {t === "dark" ? "Dark (Agreement)" : "Light (Proposal)"}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </section>

          <section className="space-y-3">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Content blocks</p>
            <BlockEditor content={content} onChange={setContent} readOnly={readOnly} />
          </section>

          <section className="space-y-3">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Line items</p>
            <LineItemEditor items={lineItems} onChange={setLineItems} readOnly={readOnly} />
          </section>

          {readOnly && proposal.events.length > 0 && (
            <section className="space-y-3">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Audit trail</p>
              <ul className="space-y-1.5">
                {proposal.events.map((event) => (
                    <li key={event.id} className="flex items-center justify-between rounded-md border border-border px-3 py-2 text-xs">
                      <span className="capitalize">{event.type}</span>
                      <span className="text-muted-foreground">{new Date(event.occurred_at).toLocaleString()}</span>
                    </li>
                  ))}
              </ul>
            </section>
          )}

          <section className="space-y-3">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Live preview</p>
            <div className="rounded-lg border border-border p-6 overflow-x-auto">
              <ProposalDocument
                proposal={{ title, status: proposal.status }}
                content={content}
                lineItems={pricingRows}
                theme={theme}
                mode="preview"
              />
            </div>
          </section>
        </div>

        <div className="space-y-4">
          <TotalsSidebar items={pricingRows} />
        </div>
      </div>
    </PageLayout>
  );
}
