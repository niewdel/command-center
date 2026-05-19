"use client";

import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Trash2 } from "lucide-react";
import type { CrmCompany } from "@/types/pipeline";

/**
 * Parse the registrable domain ("acme.com") from anything the user might
 * paste — bare domain, full URL, or URL with a path. Returns null if we
 * can't make sense of it. Both fields in the DB exist for lead-gen
 * compatibility (Apollo returns them separately), but for manual entry
 * we only ask for one input and derive the domain.
 */
function parseWebsiteAndDomain(input: string): { website: string | null; domain: string | null } {
  const trimmed = input.trim();
  if (!trimmed) return { website: null, domain: null };
  const withScheme = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  try {
    const u = new URL(withScheme);
    const domain = u.hostname.replace(/^www\./i, "").toLowerCase();
    return { website: withScheme, domain };
  } catch {
    return { website: trimmed, domain: null };
  }
}

export function NewCompanyDialog({
  open,
  onClose,
  onCreated,
  company,
}: {
  open: boolean;
  onClose: () => void;
  /** Called after a successful create/update. Receives the new record on create
   *  so callers can chain (e.g. auto-attach to a deal). */
  onCreated: (saved?: CrmCompany) => void;
  /** When provided, the dialog acts as an edit form (PATCH) instead of create (POST). */
  company?: CrmCompany | null;
}) {
  const isEdit = !!company;
  const [name, setName] = useState("");
  const [website, setWebsite] = useState("");
  const [industry, setIndustry] = useState("");
  const [headcount, setHeadcount] = useState("");
  const [hq, setHq] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    if (open) {
      setName(company?.name ?? "");
      // Pre-fill the single "Website" field from whichever is most useful:
      // existing website URL preferred (it's the linkable form), falling
      // back to the bare domain.
      setWebsite(company?.website ?? company?.domain ?? "");
      setIndustry(company?.industry ?? "");
      setHeadcount(company?.headcount ? String(company.headcount) : "");
      setHq(company?.hq ?? "");
      setNotes(company?.notes ?? "");
      setError(null);
      setConfirmDelete(false);
    }
  }, [open, company]);

  const { domain: previewDomain } = parseWebsiteAndDomain(website);

  const handleSubmit = async () => {
    if (!name.trim()) {
      setError("Name is required");
      return;
    }
    setSubmitting(true);
    setError(null);
    const { website: parsedWebsite, domain: parsedDomain } = parseWebsiteAndDomain(website);
    const payload = {
      name: name.trim(),
      domain: parsedDomain,
      website: parsedWebsite,
      industry: industry.trim() || null,
      headcount: headcount ? parseInt(headcount) : null,
      hq: hq.trim() || null,
      notes: notes.trim() || null,
    };
    const url = isEdit ? `/api/pipeline/companies/${company!.id}` : "/api/pipeline/companies";
    const method = isEdit ? "PATCH" : "POST";
    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    setSubmitting(false);
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      setError(j.error ?? `Failed to ${isEdit ? "save" : "add"} company`);
      return;
    }
    onCreated();
    onClose();
  };

  const handleDelete = async () => {
    if (!company) return;
    const res = await fetch(`/api/pipeline/companies/${company.id}`, { method: "DELETE" });
    if (res.ok) {
      onCreated();
      onClose();
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[440px]">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit Company" : "Add Company"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div className="space-y-1.5">
            <Label>Name *</Label>
            <Input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="Acme Corp" />
          </div>
          <div className="space-y-1.5">
            <Label>Website</Label>
            <Input
              value={website}
              onChange={(e) => setWebsite(e.target.value)}
              placeholder="acme.com or https://acme.com"
            />
            {previewDomain && previewDomain !== website.trim() && (
              <p className="text-[11px] text-muted-foreground">
                Domain: <span className="font-mono">{previewDomain}</span>
              </p>
            )}
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1.5">
              <Label>Industry</Label>
              <Input value={industry} onChange={(e) => setIndustry(e.target.value)} placeholder="SaaS" />
            </div>
            <div className="space-y-1.5">
              <Label>Headcount</Label>
              <Input type="number" value={headcount} onChange={(e) => setHeadcount(e.target.value)} placeholder="50" />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>HQ</Label>
            <Input value={hq} onChange={(e) => setHq(e.target.value)} placeholder="Charlotte, NC" />
          </div>
          <div className="space-y-1.5">
            <Label>Notes</Label>
            <Textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
          {error && <p className="text-xs text-red-400">{error}</p>}
        </div>
        <DialogFooter className="gap-2">
          {isEdit && (
            <div className="mr-auto">
              {confirmDelete ? (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-red-400">Delete?</span>
                  <Button variant="ghost" size="sm" onClick={() => setConfirmDelete(false)} className="h-7 text-xs">
                    Cancel
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleDelete}
                    className="h-7 text-xs text-red-400 hover:text-red-300 hover:bg-red-500/10"
                  >
                    Confirm
                  </Button>
                </div>
              ) : (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setConfirmDelete(true)}
                  className="h-7 text-xs text-muted-foreground hover:text-red-400 gap-1"
                >
                  <Trash2 className="size-3" />
                  Delete
                </Button>
              )}
            </div>
          )}
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={submitting || !name.trim()}>
            {submitting ? (isEdit ? "Saving…" : "Adding…") : isEdit ? "Save" : "Add Company"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
