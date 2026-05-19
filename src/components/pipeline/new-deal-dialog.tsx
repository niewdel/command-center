"use client";

import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import type { CrmCompany, CrmContact, DealWithLinks } from "@/types/pipeline";

export function NewDealDialog({
  open,
  onClose,
  onCreated,
  defaultCompanyId,
  defaultContactId,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: (deal: DealWithLinks) => void;
  defaultCompanyId?: string;
  defaultContactId?: string;
}) {
  const [title, setTitle] = useState("");
  const [valueDollars, setValueDollars] = useState("");
  const [closeDate, setCloseDate] = useState("");
  const [notes, setNotes] = useState("");
  const [companyId, setCompanyId] = useState<string>(defaultCompanyId ?? "");
  const [contactId, setContactId] = useState<string>(defaultContactId ?? "");
  const [companies, setCompanies] = useState<CrmCompany[]>([]);
  const [contacts, setContacts] = useState<CrmContact[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    fetch("/api/pipeline/companies").then((r) => r.json()).then((j) => setCompanies(j.data ?? []));
    fetch("/api/pipeline/contacts").then((r) => r.json()).then((j) => setContacts(j.data ?? []));
  }, [open]);

  useEffect(() => {
    if (open) {
      setCompanyId(defaultCompanyId ?? "");
      setContactId(defaultContactId ?? "");
    }
  }, [open, defaultCompanyId, defaultContactId]);

  const filteredContacts = companyId ? contacts.filter((c) => c.crm_company_id === companyId) : contacts;

  const handleSubmit = async () => {
    if (!title.trim()) {
      setError("Title is required");
      return;
    }
    setSubmitting(true);
    setError(null);
    const value_cents = valueDollars ? Math.round(parseFloat(valueDollars) * 100) : null;
    const res = await fetch("/api/pipeline/deals", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: title.trim(),
        crm_company_id: companyId || null,
        primary_contact_id: contactId || null,
        value_cents,
        close_date_est: closeDate || null,
        notes: notes.trim() || null,
      }),
    });
    const json = await res.json();
    setSubmitting(false);
    if (!res.ok) {
      setError(json.error ?? "Failed to create deal");
      return;
    }
    // Reset
    setTitle(""); setValueDollars(""); setCloseDate(""); setNotes("");
    setCompanyId(""); setContactId("");
    onCreated(json.data);
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>New Deal</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div className="space-y-1.5">
            <Label>Deal title *</Label>
            <Input autoFocus value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Atlas Construction — quoting tool" />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1.5">
              <Label>Company</Label>
              <select
                value={companyId}
                onChange={(e) => { setCompanyId(e.target.value); setContactId(""); }}
                className="w-full h-9 px-2 text-sm rounded-md border bg-background border-border"
              >
                <option value="">— None —</option>
                {companies.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label>Primary contact</Label>
              <select
                value={contactId}
                onChange={(e) => setContactId(e.target.value)}
                className="w-full h-9 px-2 text-sm rounded-md border bg-background border-border"
              >
                <option value="">— None —</option>
                {filteredContacts.map((c) => (
                  <option key={c.id} value={c.id}>{c.full_name}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1.5">
              <Label>Value ($)</Label>
              <Input type="number" inputMode="decimal" value={valueDollars} onChange={(e) => setValueDollars(e.target.value)} placeholder="5000" />
            </div>
            <div className="space-y-1.5">
              <Label>Est. close date</Label>
              <Input type="date" value={closeDate} onChange={(e) => setCloseDate(e.target.value)} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Notes</Label>
            <Textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional context" />
          </div>
          {error && <p className="text-xs text-red-400">{error}</p>}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={submitting || !title.trim()}>
            {submitting ? "Creating…" : "Create Deal"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
