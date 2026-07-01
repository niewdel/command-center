"use client";

// New-proposal dialog (Task P4): picks a ProposalType, POSTs create (which
// seeds the type's preset blocks + line items server-side, Task P2), then
// hands the created proposal back to the caller to route to the editor.

import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PROPOSAL_TYPES, PROPOSAL_TYPE_LABEL, type CrmProposal, type ProposalType } from "@/types/proposals";

export function NewProposalDialog({
  open,
  onClose,
  onCreated,
  dealId,
  crmCompanyId,
  primaryContactId,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: (proposal: CrmProposal) => void;
  dealId?: string | null;
  crmCompanyId?: string | null;
  primaryContactId?: string | null;
}) {
  const [type, setType] = useState<ProposalType>("website_build");
  const [title, setTitle] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    if (!title.trim()) {
      setError("Title is required");
      return;
    }
    setSubmitting(true);
    setError(null);
    const res = await fetch("/api/pipeline/proposals", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type,
        title: title.trim(),
        deal_id: dealId ?? null,
        crm_company_id: crmCompanyId ?? null,
        primary_contact_id: primaryContactId ?? null,
      }),
    });
    setSubmitting(false);
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      setError(j.error ?? "Failed to create proposal");
      return;
    }
    const json = await res.json();
    onCreated(json.data as CrmProposal);
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[440px]">
        <DialogHeader>
          <DialogTitle>New proposal</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div className="space-y-1.5">
            <Label>Title *</Label>
            <Input
              autoFocus
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Acme Corp Website Build"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Type</Label>
            <Select value={type} onValueChange={(v) => v && setType(v as ProposalType)}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PROPOSAL_TYPES.map((t) => (
                  <SelectItem key={t} value={t}>
                    {PROPOSAL_TYPE_LABEL[t]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {error && <p className="text-xs text-red-400">{error}</p>}
        </div>
        <DialogFooter className="gap-2">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={submitting || !title.trim()}>
            {submitting ? "Creating…" : "Create proposal"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
