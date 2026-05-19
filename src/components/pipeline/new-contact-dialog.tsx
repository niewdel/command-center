"use client";

import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Trash2 } from "lucide-react";
import type { CrmCompany, CrmContact } from "@/types/pipeline";

export function NewContactDialog({
  open,
  onClose,
  onCreated,
  contact,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
  /** When provided, the dialog acts as an edit form (PATCH) instead of create (POST). */
  contact?: CrmContact | null;
}) {
  const isEdit = !!contact;
  const [fullName, setFullName] = useState("");
  const [title, setTitle] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [linkedinUrl, setLinkedinUrl] = useState("");
  const [companyId, setCompanyId] = useState("");
  const [notes, setNotes] = useState("");
  const [companies, setCompanies] = useState<CrmCompany[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    if (!open) return;
    fetch("/api/pipeline/companies").then((r) => r.json()).then((j) => setCompanies(j.data ?? []));
  }, [open]);

  useEffect(() => {
    if (open) {
      setFullName(contact?.full_name ?? "");
      setTitle(contact?.title ?? "");
      setEmail(contact?.email ?? "");
      setPhone(contact?.phone ?? "");
      setLinkedinUrl(contact?.linkedin_url ?? "");
      setCompanyId(contact?.crm_company_id ?? "");
      setNotes(contact?.notes ?? "");
      setError(null);
      setConfirmDelete(false);
    }
  }, [open, contact]);

  const handleSubmit = async () => {
    if (!fullName.trim()) {
      setError("Name is required");
      return;
    }
    setSubmitting(true);
    setError(null);
    const payload = {
      full_name: fullName.trim(),
      title: title.trim() || null,
      email: email.trim() || null,
      phone: phone.trim() || null,
      linkedin_url: linkedinUrl.trim() || null,
      crm_company_id: companyId || null,
      notes: notes.trim() || null,
    };
    const url = isEdit ? `/api/pipeline/contacts/${contact!.id}` : "/api/pipeline/contacts";
    const method = isEdit ? "PATCH" : "POST";
    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    setSubmitting(false);
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      setError(j.error ?? `Failed to ${isEdit ? "save" : "add"} contact`);
      return;
    }
    onCreated();
    onClose();
  };

  const handleDelete = async () => {
    if (!contact) return;
    const res = await fetch(`/api/pipeline/contacts/${contact.id}`, { method: "DELETE" });
    if (res.ok) {
      onCreated();
      onClose();
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[440px]">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit Client" : "Add Client"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div className="space-y-1.5">
            <Label>Full name *</Label>
            <Input autoFocus value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Jane Doe" />
          </div>
          <div className="space-y-1.5">
            <Label>Title</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="VP Operations" />
          </div>
          <div className="space-y-1.5">
            <Label>Company</Label>
            <select
              value={companyId}
              onChange={(e) => setCompanyId(e.target.value)}
              className="w-full h-9 px-2 text-sm rounded-md border bg-background border-border"
            >
              <option value="">— None —</option>
              {companies.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1.5">
              <Label>Email</Label>
              <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="jane@acme.com" />
            </div>
            <div className="space-y-1.5">
              <Label>Phone</Label>
              <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="(555) 555-1234" />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>LinkedIn URL</Label>
            <Input value={linkedinUrl} onChange={(e) => setLinkedinUrl(e.target.value)} placeholder="linkedin.com/in/janedoe" />
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
          <Button onClick={handleSubmit} disabled={submitting || !fullName.trim()}>
            {submitting ? (isEdit ? "Saving…" : "Adding…") : isEdit ? "Save" : "Add Client"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
