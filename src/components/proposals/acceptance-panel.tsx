"use client";

// Client-side acceptance panel for the public, token-gated proposal view
// (Task P5). Renders option-group selectors + optional add-on toggles,
// recomputes DISPLAYED totals live via the P1 pricing engine for UX only --
// the server is always the authority: POST /api/proposals/[id]/sign
// recomputes and snapshots totals itself from the persisted line items, so
// nothing this component computes is ever trusted as-is.

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { computeTotals, formatCents } from "@/lib/proposals/pricing";
import type { CrmProposalLineItem, ProposalStatus } from "@/types/proposals";

interface AcceptancePanelProps {
  proposalId: string;
  token: string;
  lineItems: CrmProposalLineItem[];
  status: ProposalStatus;
  requiresDualSign: boolean;
  signedAt: string | null;
  signerName: string | null;
}

function groupItems(items: CrmProposalLineItem[]) {
  const groups = new Map<string, CrmProposalLineItem[]>();
  const optionals: CrmProposalLineItem[] = [];

  for (const item of items) {
    if (item.option_group) {
      const bucket = groups.get(item.option_group) ?? [];
      bucket.push(item);
      groups.set(item.option_group, bucket);
    } else if (item.is_optional) {
      optionals.push(item);
    }
  }

  for (const bucket of groups.values()) {
    bucket.sort((a, b) => a.position - b.position);
  }
  optionals.sort((a, b) => a.position - b.position);

  return { groups, optionals };
}

export function AcceptancePanel({
  proposalId,
  token,
  lineItems,
  status,
  requiresDualSign,
  signedAt,
  signerName,
}: AcceptancePanelProps) {
  const [items, setItems] = useState(lineItems);
  const [signerNameInput, setSignerNameInput] = useState("");
  const [signerEmailInput, setSignerEmailInput] = useState("");
  const [consent, setConsent] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ signedAt: string; signerName: string } | null>(null);
  const pinged = useRef(false);

  useEffect(() => {
    if (pinged.current) return;
    pinged.current = true;
    fetch(`/api/proposals/${proposalId}/view`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    }).catch(() => {
      // Best-effort. A failed view ping never blocks the client from
      // reading or signing the proposal.
    });
  }, [proposalId, token]);

  const alreadySigned = status === "signed" || result !== null;
  const unavailable = status === "void" || status === "declined";

  const { groups, optionals } = groupItems(items);
  const totals = computeTotals(items);

  function selectInGroup(groupName: string, selectedId: string) {
    setItems((prev) =>
      prev.map((item) =>
        item.option_group === groupName ? { ...item, is_selected: item.id === selectedId } : item
      )
    );
  }

  function toggleOptional(id: string, selected: boolean) {
    setItems((prev) => prev.map((item) => (item.id === id ? { ...item, is_selected: selected } : item)));
  }

  async function handleSign() {
    setError(null);

    if (!consent) {
      setError("Please check the consent box to continue.");
      return;
    }
    if (!signerNameInput.trim()) {
      setError("Please type your full name.");
      return;
    }

    setSubmitting(true);

    const selectedOptions = items
      .filter((item) => item.option_group || item.is_optional)
      .map((item) => ({ lineItemId: item.id, selected: item.is_selected }));

    try {
      const res = await fetch(`/api/proposals/${proposalId}/sign`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token,
          signerName: signerNameInput.trim(),
          signerEmail: signerEmailInput.trim() || undefined,
          consent: true,
          selectedOptions,
          signatureTyped: signerNameInput.trim(),
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(json.error ?? "Something went wrong. Please try again.");
        setSubmitting(false);
        return;
      }
      setResult({ signedAt: json.data.signed_at as string, signerName: json.data.signer_name as string });
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (unavailable) {
    return (
      <div className="report-card p-6">
        <p className="text-sm text-muted-foreground">This proposal is no longer available for signature.</p>
      </div>
    );
  }

  if (alreadySigned) {
    const displayName = result?.signerName ?? signerName ?? "";
    const displayDate = result?.signedAt ?? signedAt ?? "";
    return (
      <div className="report-card p-6">
        <h2 className="report-eyebrow mb-2">Signed</h2>
        <p className="text-sm text-foreground text-pretty">
          Thanks{displayName ? `, ${displayName}` : ""}. This proposal was signed
          {displayDate ? ` on ${new Date(displayDate).toLocaleString()}` : ""} and is now in effect.
        </p>
        {requiresDualSign && (
          <p className="mt-2 text-xs text-muted-foreground">Niewdel will countersign to finalize this agreement.</p>
        )}
      </div>
    );
  }

  return (
    <div className="report-card p-6 space-y-6">
      <div>
        <h2 className="report-eyebrow mb-1">Review and accept</h2>
        <div className="report-rule mt-2" />
      </div>

      {[...groups.entries()].map(([groupName, groupItemsList]) => (
        <div key={groupName}>
          <p className="report-label mb-3">{groupName}</p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {groupItemsList.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => selectInGroup(groupName, item.id)}
                className={`rounded-lg border p-4 text-left transition-colors ${
                  item.is_selected
                    ? "border-primary bg-primary/5"
                    : "border-border hover:border-primary/50"
                }`}
                aria-pressed={item.is_selected}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-semibold text-foreground">{item.label}</span>
                  <span className="text-sm font-semibold text-foreground font-data tabular-nums">
                    {formatCents(item.amount_cents)}
                  </span>
                </div>
                {item.description && (
                  <p className="mt-1 text-xs text-muted-foreground text-pretty">{item.description}</p>
                )}
              </button>
            ))}
          </div>
        </div>
      ))}

      {optionals.length > 0 && (
        <div>
          <p className="report-label mb-3">Optional add-ons</p>
          <div className="space-y-2">
            {optionals.map((item) => (
              <label key={item.id} className="flex items-start gap-3 rounded-lg border border-border p-3">
                <Checkbox
                  checked={item.is_selected}
                  onCheckedChange={(checked) => toggleOptional(item.id, checked === true)}
                />
                <span className="min-w-0 flex-1">
                  <span className="flex items-center justify-between gap-2">
                    <span className="text-sm font-medium text-foreground">{item.label}</span>
                    <span className="text-sm font-medium text-foreground font-data tabular-nums">
                      {formatCents(item.amount_cents)}
                    </span>
                  </span>
                  {item.description && (
                    <span className="mt-0.5 block text-xs text-muted-foreground text-pretty">{item.description}</span>
                  )}
                </span>
              </label>
            ))}
          </div>
        </div>
      )}

      <dl className="grid grid-cols-1 gap-3 border-t border-border pt-4 sm:grid-cols-3">
        <div>
          <dt className="report-label">One-time</dt>
          <dd className="mt-1 text-base font-semibold text-foreground font-data tabular-nums">
            {formatCents(totals.oneTimeCents)}
          </dd>
        </div>
        <div>
          <dt className="report-label">Monthly</dt>
          <dd className="mt-1 text-base font-semibold text-foreground font-data tabular-nums">
            {formatCents(totals.recurringMonthlyCents)}
          </dd>
        </div>
        <div>
          <dt className="report-label">Deposit due</dt>
          <dd className="mt-1 text-base font-semibold text-foreground font-data tabular-nums">
            {formatCents(totals.depositCents)}
          </dd>
        </div>
      </dl>

      <div className="space-y-4 border-t border-border pt-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="signer-name">Full name</Label>
            <Input
              id="signer-name"
              value={signerNameInput}
              onChange={(e) => setSignerNameInput(e.target.value)}
              placeholder="Jane Smith"
              disabled={submitting}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="signer-email">Email (optional)</Label>
            <Input
              id="signer-email"
              type="email"
              value={signerEmailInput}
              onChange={(e) => setSignerEmailInput(e.target.value)}
              placeholder="jane@company.com"
              disabled={submitting}
            />
          </div>
        </div>

        <label className="flex items-start gap-3">
          <Checkbox checked={consent} onCheckedChange={(checked) => setConsent(checked === true)} disabled={submitting} />
          <span className="text-sm text-foreground text-pretty">I agree to the terms of this proposal.</span>
        </label>

        {signerNameInput.trim() && (
          <p className="text-xs text-muted-foreground">
            Typed signature: <span className="font-semibold text-foreground">{signerNameInput.trim()}</span>
          </p>
        )}

        {requiresDualSign && (
          <p className="text-xs text-muted-foreground">
            Niewdel will countersign after you accept to finalize this agreement.
          </p>
        )}

        {error && (
          <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-400">{error}</div>
        )}

        <Button onClick={handleSign} disabled={submitting} className="w-full sm:w-auto">
          {submitting ? "Signing…" : "Sign and accept"}
        </Button>
      </div>
    </div>
  );
}
