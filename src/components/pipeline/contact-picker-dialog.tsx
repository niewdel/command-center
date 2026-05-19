"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { UserPlus, Search } from "lucide-react";
import type { CrmContact } from "@/types/pipeline";
import { NewContactDialog } from "@/components/pipeline/new-contact-dialog";

type ContactListRow = CrmContact & {
  company: { id: string; name: string } | null;
};

export function ContactPickerDialog({
  open,
  onClose,
  excludeContactIds,
  onPick,
}: {
  open: boolean;
  onClose: () => void;
  excludeContactIds: string[];
  /** Called with the picked contact id. Caller is responsible for the POST. */
  onPick: (contactId: string) => Promise<void> | void;
}) {
  const [search, setSearch] = useState("");
  const [contacts, setContacts] = useState<ContactListRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [adding, setAdding] = useState<string | null>(null);
  const [newOpen, setNewOpen] = useState(false);

  const fetchContacts = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/pipeline/contacts");
    const json = await res.json();
    setContacts(json.data ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (open) {
      setSearch("");
      fetchContacts();
    }
  }, [open, fetchContacts]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const available = contacts.filter((c) => !excludeContactIds.includes(c.id));
    if (!q) return available;
    return available.filter(
      (c) =>
        c.full_name.toLowerCase().includes(q) ||
        (c.title ?? "").toLowerCase().includes(q) ||
        (c.email ?? "").toLowerCase().includes(q) ||
        (c.company?.name ?? "").toLowerCase().includes(q)
    );
  }, [contacts, excludeContactIds, search]);

  const handlePick = async (id: string) => {
    setAdding(id);
    try {
      await onPick(id);
      onClose();
    } finally {
      setAdding(null);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onClose}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle>Add Contact to Deal</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                autoFocus
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by name, title, email, company"
                className="pl-9"
              />
            </div>

            <div className="max-h-[320px] overflow-y-auto space-y-1.5 -mx-1 px-1">
              {loading ? (
                <p className="text-xs text-muted-foreground py-4 text-center">Loading…</p>
              ) : filtered.length === 0 ? (
                <p className="text-xs text-muted-foreground py-4 text-center">
                  {contacts.length === 0
                    ? "No clients yet. Create one below."
                    : "No matching clients."}
                </p>
              ) : (
                filtered.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => handlePick(c.id)}
                    disabled={adding === c.id}
                    className="w-full text-left p-2.5 rounded-md border transition-colors hover:border-[rgba(0,180,216,0.3)] hover:bg-[rgba(0,180,216,0.04)] disabled:opacity-50"
                    style={{ borderColor: "rgba(255,255,255,0.06)" }}
                  >
                    <p className="text-sm font-medium truncate">{c.full_name}</p>
                    <p className="text-[11px] text-muted-foreground truncate">
                      {[c.title, c.company?.name].filter(Boolean).join(" · ") || c.email || "—"}
                    </p>
                  </button>
                ))
              )}
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="ghost" onClick={onClose}>Cancel</Button>
            <Button onClick={() => setNewOpen(true)} className="gap-1.5">
              <UserPlus size={14} /> Create new client
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <NewContactDialog
        open={newOpen}
        onClose={() => setNewOpen(false)}
        onCreated={() => {
          setNewOpen(false);
          fetchContacts();
        }}
      />
    </>
  );
}
