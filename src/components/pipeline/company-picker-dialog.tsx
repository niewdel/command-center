"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Plus, Search, X as XIcon } from "lucide-react";
import type { CrmCompany } from "@/types/pipeline";
import { NewCompanyDialog } from "@/components/pipeline/new-company-dialog";

export function CompanyPickerDialog({
  open,
  onClose,
  currentCompanyId,
  /** Called with the picked company id, or null to clear it. Caller handles the PATCH. */
  onPick,
}: {
  open: boolean;
  onClose: () => void;
  currentCompanyId: string | null;
  onPick: (companyId: string | null) => Promise<void> | void;
}) {
  const [search, setSearch] = useState("");
  const [companies, setCompanies] = useState<CrmCompany[]>([]);
  const [loading, setLoading] = useState(false);
  const [picking, setPicking] = useState<string | "clear" | null>(null);
  const [newOpen, setNewOpen] = useState(false);

  const fetchCompanies = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/pipeline/companies");
    const json = await res.json();
    setCompanies(json.data ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (open) {
      setSearch("");
      fetchCompanies();
    }
  }, [open, fetchCompanies]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return companies;
    return companies.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        (c.industry ?? "").toLowerCase().includes(q) ||
        (c.hq ?? "").toLowerCase().includes(q) ||
        (c.domain ?? "").toLowerCase().includes(q)
    );
  }, [companies, search]);

  const handlePick = async (id: string | null) => {
    setPicking(id ?? "clear");
    try {
      await onPick(id);
      onClose();
    } finally {
      setPicking(null);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onClose}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle>{currentCompanyId ? "Change Company" : "Set Company"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                autoFocus
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by name, industry, HQ, domain"
                className="pl-9"
              />
            </div>

            <div className="max-h-[320px] overflow-y-auto space-y-1.5 -mx-1 px-1">
              {loading ? (
                <p className="text-xs text-muted-foreground py-4 text-center">Loading…</p>
              ) : filtered.length === 0 ? (
                <p className="text-xs text-muted-foreground py-4 text-center">
                  {companies.length === 0
                    ? "No companies yet. Create one below."
                    : "No matching companies."}
                </p>
              ) : (
                filtered.map((c) => {
                  const isCurrent = c.id === currentCompanyId;
                  return (
                    <button
                      key={c.id}
                      onClick={() => handlePick(c.id)}
                      disabled={picking === c.id || isCurrent}
                      className="w-full text-left p-2.5 rounded-md border transition-colors hover:border-[rgba(0,180,216,0.3)] hover:bg-[rgba(0,180,216,0.04)] disabled:opacity-50 disabled:cursor-not-allowed"
                      style={{ borderColor: isCurrent ? "rgba(0,180,216,0.3)" : "rgba(255,255,255,0.06)" }}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-medium truncate">{c.name}</p>
                        {isCurrent && (
                          <span className="text-[10px] uppercase tracking-wider" style={{ color: "rgba(0,180,216,0.6)" }}>
                            Current
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-muted-foreground truncate">
                        {[c.industry, c.hq, c.domain].filter(Boolean).join(" · ") || "—"}
                      </p>
                    </button>
                  );
                })
              )}
            </div>
          </div>
          <DialogFooter className="gap-2">
            {currentCompanyId && (
              <Button
                variant="ghost"
                onClick={() => handlePick(null)}
                disabled={picking === "clear"}
                className="mr-auto text-muted-foreground hover:text-red-400 gap-1.5"
              >
                <XIcon size={14} /> Remove company
              </Button>
            )}
            <Button variant="ghost" onClick={onClose}>Cancel</Button>
            <Button onClick={() => setNewOpen(true)} className="gap-1.5">
              <Plus size={14} /> Create new
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <NewCompanyDialog
        open={newOpen}
        onClose={() => setNewOpen(false)}
        onCreated={() => {
          setNewOpen(false);
          fetchCompanies();
        }}
      />
    </>
  );
}
