"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Mail, Phone, ExternalLink, Trash2, Upload, FileText, Video, X as XIcon, Star, UserPlus, Building, Repeat, Check, Loader2 } from "lucide-react";
import { PageLayout } from "@/components/layout/page-layout";
import { PipelineTabs } from "@/components/pipeline/pipeline-tabs";
import { supabase } from "@/lib/supabase";
import { DEAL_STAGES, STAGE_LABEL, STAGE_COLOR, type DealStage, type CrmDeal, type CrmCompany, type CrmContact } from "@/types/pipeline";
import { extractDriveFileId, getDriveThumbnailUrl } from "@/lib/google/drive-preview";
import { ContactPickerDialog } from "@/components/pipeline/contact-picker-dialog";
import { CompanyPickerDialog } from "@/components/pipeline/company-picker-dialog";
import { NewContactDialog } from "@/components/pipeline/new-contact-dialog";

const mono = "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace";

type DealContactRow = {
  role: string | null;
  created_at: string;
  contact: {
    id: string;
    full_name: string;
    title: string | null;
    email: string | null;
    phone: string | null;
    linkedin_url: string | null;
    company: { id: string; name: string } | null;
  };
};

type DealDetail = CrmDeal & {
  company: Pick<CrmCompany, "id" | "name" | "domain" | "website" | "industry" | "headcount" | "hq" | "notes"> | null;
  contacts: DealContactRow[];
};

export default function DealDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const id = params.id;

  const [deal, setDeal] = useState<DealDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [confirmDelete, setConfirmDelete] = useState(false);

  // Auto-save state. saving = a PATCH is in flight; savedAt = last completed save
  // timestamp (drives the "Saved 3s ago" indicator).
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const dirtyRef = useRef<Record<string, unknown>>({});
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Editable fields
  const [title, setTitle] = useState("");
  const [stage, setStage] = useState<DealStage>("discovery");
  const [valueDollars, setValueDollars] = useState("");
  const [closeDate, setCloseDate] = useState("");
  const [notes, setNotes] = useState("");
  const [owner, setOwner] = useState("");
  const [lostReason, setLostReason] = useState("");

  // Attachments
  const [proposalUrl, setProposalUrl] = useState("");
  const [proposalFilename, setProposalFilename] = useState("");
  const [proposalDraftUrl, setProposalDraftUrl] = useState("");
  const [fathomUrl, setFathomUrl] = useState("");
  const [uploadingProposal, setUploadingProposal] = useState(false);

  // Contact picker / company picker / inline contact edit
  const [pickerOpen, setPickerOpen] = useState(false);
  const [companyPickerOpen, setCompanyPickerOpen] = useState(false);
  const [editingContact, setEditingContact] = useState<CrmContact | null>(null);

  const fetchDeal = useCallback(async () => {
    const res = await fetch(`/api/pipeline/deals/${id}`);
    const json = await res.json();
    if (json.data) {
      const d = json.data as DealDetail;
      setDeal(d);
      setTitle(d.title);
      setStage(d.stage);
      setValueDollars(d.value_cents ? String(d.value_cents / 100) : "");
      setCloseDate(d.close_date_est ?? "");
      setNotes(d.notes ?? "");
      setOwner(d.owner ?? "");
      setLostReason(d.lost_reason ?? "");
      setProposalUrl(d.proposal_url ?? "");
      setProposalFilename(d.proposal_filename ?? "");
      setFathomUrl(d.fathom_url ?? "");
    }
    setLoading(false);
  }, [id]);

  const flushSave = useCallback(async () => {
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }
    const patch = dirtyRef.current;
    if (Object.keys(patch).length === 0) return;
    dirtyRef.current = {};
    setSaving(true);
    try {
      await fetch(`/api/pipeline/deals/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      setSavedAt(Date.now());
    } finally {
      setSaving(false);
    }
  }, [id]);

  const queueSave = useCallback(
    (patch: Record<string, unknown>, opts?: { immediate?: boolean }) => {
      Object.assign(dirtyRef.current, patch);
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      const delay = opts?.immediate ? 0 : 600;
      saveTimerRef.current = setTimeout(() => {
        void flushSave();
      }, delay);
    },
    [flushSave]
  );

  // Flush pending save on unmount so navigating away doesn't drop edits.
  useEffect(() => {
    return () => {
      void flushSave();
    };
  }, [flushSave]);

  const persistAttachments = useCallback(
    async (patch: Partial<Pick<CrmDeal, "proposal_url" | "proposal_filename" | "fathom_url">>) => {
      await fetch(`/api/pipeline/deals/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      await fetchDeal();
    },
    [id, fetchDeal]
  );

  const handleProposalUpload = async (file: File) => {
    setUploadingProposal(true);
    const fd = new FormData();
    fd.append("file", file);
    fd.append("folder", `pipeline-proposals/${id}`);
    const res = await fetch("/api/upload", { method: "POST", body: fd });
    const json = await res.json();
    setUploadingProposal(false);
    if (res.ok && json.url) {
      await persistAttachments({ proposal_url: json.url, proposal_filename: file.name });
    }
  };

  const handleProposalLink = async () => {
    const url = proposalDraftUrl.trim();
    if (!url) return;

    // If this looks like a Google Drive share link, try to resolve the real
    // filename via the public preview page. Falls back gracefully.
    let filename = url.split("/").pop()?.split("?")[0] || "Proposal";
    if (extractDriveFileId(url)) {
      try {
        const res = await fetch("/api/integrations/google/drive/preview", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url }),
        });
        const json = await res.json();
        if (json?.filename) filename = json.filename;
      } catch {
        // Network/parse error — keep the URL-derived fallback.
      }
    }

    await persistAttachments({ proposal_url: url, proposal_filename: filename });
    setProposalDraftUrl("");
  };

  const handleClearProposal = async () => {
    await persistAttachments({ proposal_url: null, proposal_filename: null });
  };

  const handleFathomSave = async () => {
    await persistAttachments({ fathom_url: fathomUrl.trim() || null });
  };

  const handleClearFathom = async () => {
    setFathomUrl("");
    await persistAttachments({ fathom_url: null });
  };

  useEffect(() => {
    fetchDeal();
    const ch = supabase
      .channel(`deal-${id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "crm_deals", filter: `id=eq.${id}` }, () => fetchDeal())
      .on("postgres_changes", { event: "*", schema: "public", table: "crm_deal_contacts", filter: `deal_id=eq.${id}` }, () => fetchDeal())
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [id, fetchDeal]);

  const handleAddContact = useCallback(
    async (contactId: string) => {
      await fetch(`/api/pipeline/deals/${id}/contacts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contact_id: contactId }),
      });
      await fetchDeal();
    },
    [id, fetchDeal]
  );

  const handleRemoveContact = useCallback(
    async (contactId: string) => {
      await fetch(`/api/pipeline/deals/${id}/contacts/${contactId}`, { method: "DELETE" });
      await fetchDeal();
    },
    [id, fetchDeal]
  );

  const handleSetPrimary = useCallback(
    async (contactId: string) => {
      await fetch(`/api/pipeline/deals/${id}/contacts/${contactId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ set_primary: true }),
      });
      await fetchDeal();
    },
    [id, fetchDeal]
  );

  const handleChangeCompany = useCallback(
    async (companyId: string | null) => {
      await fetch(`/api/pipeline/deals/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ crm_company_id: companyId }),
      });
      await fetchDeal();
    },
    [id, fetchDeal]
  );

  const handleDelete = async () => {
    // Cancel any pending save so it doesn't fire after the row is gone.
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }
    dirtyRef.current = {};
    await fetch(`/api/pipeline/deals/${id}`, { method: "DELETE" });
    router.push("/pipeline");
  };

  if (loading) {
    return (
      <PageLayout title="Deal" maxWidth="lg" loading>
        {null}
      </PageLayout>
    );
  }
  if (!deal) {
    return (
      <PageLayout title="Deal not found" maxWidth="lg">
        <Link href="/pipeline" className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1">
          <ArrowLeft size={14} /> Back to pipeline
        </Link>
      </PageLayout>
    );
  }

  return (
    <PageLayout title={deal.title} description={deal.company?.name ?? "—"} maxWidth="lg">
      <PipelineTabs />

      <Link href="/pipeline" className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1 mb-3">
        <ArrowLeft size={14} /> Back to pipeline
      </Link>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Left: editable deal */}
        <div className="lg:col-span-2 space-y-3">
          <div
            className="rounded-lg border p-4 space-y-3"
            style={{ backgroundColor: "rgba(26,26,26,0.5)", borderColor: "rgba(255,255,255,0.06)" }}
          >
            <div className="space-y-1.5">
              <p className="text-[10px] uppercase tracking-wider" style={{ color: "rgba(245,245,245,0.4)", fontFamily: mono }}>
                Title
              </p>
              <input
                type="text"
                value={title}
                onChange={(e) => {
                  setTitle(e.target.value);
                  queueSave({ title: e.target.value.trim() });
                }}
                className="w-full bg-transparent text-sm font-semibold outline-none border-b border-transparent focus:border-[rgba(0,180,216,0.4)] transition-colors"
              />
            </div>

            <div>
              <p className="text-[10px] uppercase tracking-wider mb-2" style={{ color: "rgba(245,245,245,0.4)", fontFamily: mono }}>
                Stage
              </p>
              <div className="flex flex-wrap gap-1.5">
                {DEAL_STAGES.map((s) => (
                  <button
                    key={s}
                    onClick={() => {
                      setStage(s);
                      queueSave({ stage: s, lost_reason: s === "lost" ? lostReason.trim() || null : null }, { immediate: true });
                    }}
                    className="px-2.5 py-1 text-[10px] uppercase tracking-wider rounded-md transition-colors"
                    style={{
                      fontFamily: mono,
                      backgroundColor: stage === s ? `${STAGE_COLOR[s]}1f` : "transparent",
                      color: stage === s ? STAGE_COLOR[s] : "rgba(245,245,245,0.4)",
                      border: `1px solid ${stage === s ? STAGE_COLOR[s] : "rgba(255,255,255,0.06)"}`,
                    }}
                  >
                    {STAGE_LABEL[s]}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <div className="space-y-1.5">
                <p className="text-[10px] uppercase tracking-wider" style={{ color: "rgba(245,245,245,0.4)", fontFamily: mono }}>
                  Value ($)
                </p>
                <input
                  type="number"
                  value={valueDollars}
                  onChange={(e) => {
                    setValueDollars(e.target.value);
                    queueSave({
                      value_cents: e.target.value ? Math.round(parseFloat(e.target.value) * 100) : null,
                    });
                  }}
                  placeholder="5000"
                  className="w-full text-sm bg-transparent outline-none border rounded-md px-2 py-1.5"
                  style={{ borderColor: "rgba(255,255,255,0.08)" }}
                />
              </div>
              <div className="space-y-1.5">
                <p className="text-[10px] uppercase tracking-wider" style={{ color: "rgba(245,245,245,0.4)", fontFamily: mono }}>
                  Est. close
                </p>
                <input
                  type="date"
                  value={closeDate}
                  onChange={(e) => {
                    setCloseDate(e.target.value);
                    queueSave({ close_date_est: e.target.value || null }, { immediate: true });
                  }}
                  className="w-full text-sm bg-transparent outline-none border rounded-md px-2 py-1.5"
                  style={{ borderColor: "rgba(255,255,255,0.08)" }}
                />
              </div>
              <div className="space-y-1.5">
                <p className="text-[10px] uppercase tracking-wider" style={{ color: "rgba(245,245,245,0.4)", fontFamily: mono }}>
                  Owner
                </p>
                <input
                  type="text"
                  value={owner}
                  onChange={(e) => {
                    setOwner(e.target.value);
                    queueSave({ owner: e.target.value.trim() || null });
                  }}
                  placeholder="Justin"
                  className="w-full text-sm bg-transparent outline-none border rounded-md px-2 py-1.5"
                  style={{ borderColor: "rgba(255,255,255,0.08)" }}
                />
              </div>
            </div>

            {stage === "lost" && (
              <div className="space-y-1.5">
                <p className="text-[10px] uppercase tracking-wider" style={{ color: "#EF4444", fontFamily: mono }}>
                  Lost reason
                </p>
                <input
                  type="text"
                  value={lostReason}
                  onChange={(e) => {
                    setLostReason(e.target.value);
                    queueSave({ lost_reason: e.target.value.trim() || null });
                  }}
                  placeholder="Budget, timing, competitor..."
                  className="w-full text-sm bg-transparent outline-none border rounded-md px-2 py-1.5"
                  style={{ borderColor: "rgba(239,68,68,0.2)" }}
                />
              </div>
            )}

            <div className="space-y-1.5">
              <p className="text-[10px] uppercase tracking-wider" style={{ color: "rgba(245,245,245,0.4)", fontFamily: mono }}>
                Notes
              </p>
              <textarea
                value={notes}
                onChange={(e) => {
                  setNotes(e.target.value);
                  queueSave({ notes: e.target.value.trim() || null });
                }}
                rows={6}
                placeholder="Deal context, next steps, decisions made..."
                className="w-full text-sm bg-transparent outline-none border rounded-md px-2 py-1.5 resize-vertical"
                style={{ borderColor: "rgba(255,255,255,0.08)", color: "rgba(245,245,245,0.85)" }}
              />
            </div>

            <div className="flex items-center justify-between pt-2">
              <button
                onClick={() => (confirmDelete ? handleDelete() : setConfirmDelete(true))}
                className="flex items-center gap-1.5 px-2.5 py-1.5 text-[10px] uppercase tracking-wider rounded-md transition-colors hover:bg-[rgba(239,68,68,0.1)]"
                style={{ fontFamily: mono, color: confirmDelete ? "#EF4444" : "rgba(245,245,245,0.4)", border: "1px solid rgba(255,255,255,0.06)" }}
              >
                <Trash2 size={12} /> {confirmDelete ? "Confirm Delete" : "Delete Deal"}
              </button>
              <SaveStatus saving={saving} savedAt={savedAt} />
            </div>
          </div>

          {/* Attachments */}
          <div
            className="rounded-lg border p-4 space-y-4"
            style={{ backgroundColor: "rgba(26,26,26,0.5)", borderColor: "rgba(255,255,255,0.06)" }}
          >
            <p className="text-[10px] uppercase tracking-wider" style={{ color: "rgba(0,180,216,0.5)", fontFamily: mono }}>
              Attachments
            </p>

            {/* Proposal */}
            <div className="space-y-2">
              <p className="text-[10px] uppercase tracking-wider flex items-center gap-1.5" style={{ color: "rgba(245,245,245,0.45)", fontFamily: mono }}>
                <FileText size={11} /> Proposal
              </p>
              {proposalUrl ? (
                (() => {
                  const driveId = extractDriveFileId(proposalUrl);
                  if (driveId) {
                    return (
                      <div
                        className="rounded-md overflow-hidden"
                        style={{ backgroundColor: "rgba(0,180,216,0.04)", border: "1px solid rgba(0,180,216,0.15)" }}
                      >
                        <a
                          href={proposalUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="block"
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={getDriveThumbnailUrl(driveId, 800)}
                            alt={proposalFilename || "Proposal preview"}
                            className="w-full h-auto block"
                            style={{ maxHeight: 280, objectFit: "cover", objectPosition: "top", backgroundColor: "rgba(13,13,13,0.6)" }}
                          />
                        </a>
                        <div className="flex items-center justify-between gap-2 px-3 py-2">
                          <a
                            href={proposalUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="flex items-center gap-2 text-xs min-w-0 hover:underline"
                            style={{ color: "#00B4D8" }}
                          >
                            <ExternalLink size={11} className="shrink-0" />
                            <span className="truncate">{proposalFilename || "Google Drive"}</span>
                          </a>
                          <button
                            onClick={handleClearProposal}
                            className="px-1.5 py-1 rounded hover:bg-[rgba(239,68,68,0.1)] transition-colors"
                            style={{ color: "rgba(245,245,245,0.4)" }}
                            aria-label="Remove proposal"
                          >
                            <XIcon size={11} />
                          </button>
                        </div>
                      </div>
                    );
                  }
                  return (
                    <div
                      className="flex items-center justify-between gap-2 rounded-md px-3 py-2"
                      style={{ backgroundColor: "rgba(0,180,216,0.06)", border: "1px solid rgba(0,180,216,0.15)" }}
                    >
                      <a
                        href={proposalUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center gap-2 text-xs min-w-0 hover:underline"
                        style={{ color: "#00B4D8" }}
                      >
                        <ExternalLink size={11} className="shrink-0" />
                        <span className="truncate">{proposalFilename || proposalUrl}</span>
                      </a>
                      <button
                        onClick={handleClearProposal}
                        className="text-[10px] uppercase tracking-wider px-1.5 py-1 rounded hover:bg-[rgba(239,68,68,0.1)] transition-colors"
                        style={{ color: "rgba(245,245,245,0.4)", fontFamily: mono }}
                        aria-label="Remove proposal"
                      >
                        <XIcon size={11} />
                      </button>
                    </div>
                  );
                })()
              ) : (
                <div className="space-y-2">
                  <label
                    className="flex items-center justify-center gap-2 py-2.5 rounded-md cursor-pointer transition-colors hover:bg-[rgba(0,180,216,0.08)]"
                    style={{ border: "1px dashed rgba(0,180,216,0.25)", color: "#00B4D8", fontFamily: mono, fontSize: 10, textTransform: "uppercase", letterSpacing: "0.05em" }}
                  >
                    <Upload size={12} />
                    {uploadingProposal ? "Uploading…" : "Upload PDF"}
                    <input
                      type="file"
                      accept="application/pdf,.pdf"
                      className="hidden"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) handleProposalUpload(f);
                      }}
                    />
                  </label>
                  <div className="flex items-center gap-1 text-[10px]" style={{ color: "rgba(245,245,245,0.3)", fontFamily: mono }}>
                    <span className="h-px flex-1" style={{ backgroundColor: "rgba(255,255,255,0.06)" }} />
                    OR PASTE LINK
                    <span className="h-px flex-1" style={{ backgroundColor: "rgba(255,255,255,0.06)" }} />
                  </div>
                  <div className="flex gap-2">
                    <input
                      type="url"
                      value={proposalDraftUrl}
                      onChange={(e) => setProposalDraftUrl(e.target.value)}
                      placeholder="https://drive.google.com/..."
                      className="flex-1 text-xs bg-transparent outline-none border rounded-md px-2 py-1.5"
                      style={{ borderColor: "rgba(255,255,255,0.08)" }}
                    />
                    <button
                      onClick={handleProposalLink}
                      disabled={!proposalDraftUrl.trim()}
                      className="px-3 py-1.5 text-[10px] uppercase tracking-wider rounded-md transition-colors hover:bg-[rgba(0,180,216,0.15)] disabled:opacity-50 disabled:cursor-not-allowed"
                      style={{ fontFamily: mono, color: "#00B4D8", border: "1px solid rgba(0,180,216,0.3)" }}
                    >
                      Attach
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Fathom */}
            <div className="space-y-2">
              <p className="text-[10px] uppercase tracking-wider flex items-center gap-1.5" style={{ color: "rgba(245,245,245,0.45)", fontFamily: mono }}>
                <Video size={11} /> Fathom recording
              </p>
              {deal.fathom_url ? (
                <div
                  className="flex items-center justify-between gap-2 rounded-md px-3 py-2"
                  style={{ backgroundColor: "rgba(0,180,216,0.06)", border: "1px solid rgba(0,180,216,0.15)" }}
                >
                  <a
                    href={deal.fathom_url}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-2 text-xs min-w-0 hover:underline"
                    style={{ color: "#00B4D8" }}
                  >
                    <ExternalLink size={11} className="shrink-0" />
                    <span className="truncate">{deal.fathom_url}</span>
                  </a>
                  <button
                    onClick={handleClearFathom}
                    className="text-[10px] uppercase tracking-wider px-1.5 py-1 rounded hover:bg-[rgba(239,68,68,0.1)] transition-colors"
                    style={{ color: "rgba(245,245,245,0.4)", fontFamily: mono }}
                    aria-label="Remove Fathom link"
                  >
                    <XIcon size={11} />
                  </button>
                </div>
              ) : (
                <div className="flex gap-2">
                  <input
                    type="url"
                    value={fathomUrl}
                    onChange={(e) => setFathomUrl(e.target.value)}
                    placeholder="https://fathom.video/calls/..."
                    className="flex-1 text-xs bg-transparent outline-none border rounded-md px-2 py-1.5"
                    style={{ borderColor: "rgba(255,255,255,0.08)" }}
                  />
                  <button
                    onClick={handleFathomSave}
                    disabled={!fathomUrl.trim()}
                    className="px-3 py-1.5 text-[10px] uppercase tracking-wider rounded-md transition-colors hover:bg-[rgba(0,180,216,0.15)] disabled:opacity-50 disabled:cursor-not-allowed"
                    style={{ fontFamily: mono, color: "#00B4D8", border: "1px solid rgba(0,180,216,0.3)" }}
                  >
                    Attach
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right: linked entities */}
        <div className="space-y-3">
          <div
            className="rounded-lg border p-4 space-y-3"
            style={{ backgroundColor: "rgba(26,26,26,0.5)", borderColor: "rgba(255,255,255,0.06)" }}
          >
            <div className="flex items-center justify-between">
              <p className="text-[10px] uppercase tracking-wider" style={{ color: "rgba(0,180,216,0.5)", fontFamily: mono }}>
                Contacts ({deal.contacts.length})
              </p>
              <button
                onClick={() => setPickerOpen(true)}
                className="flex items-center gap-1.5 px-2.5 py-1 text-[10px] uppercase tracking-wider rounded-md transition-colors hover:bg-[rgba(0,180,216,0.15)]"
                style={{ fontFamily: mono, color: "#00B4D8", border: "1px solid rgba(0,180,216,0.3)" }}
              >
                <UserPlus size={11} /> Add
              </button>
            </div>

            {deal.contacts.length === 0 ? (
              <p className="text-[11px]" style={{ color: "rgba(245,245,245,0.4)", fontFamily: mono }}>
                No contacts attached. Click Add to link a client to this deal.
              </p>
            ) : (
              <div className="space-y-2">
                {deal.contacts.map((dc) => {
                  const c = dc.contact;
                  const isPrimary = deal.primary_contact_id === c.id;
                  return (
                    <div
                      key={c.id}
                      className="rounded-md border p-2.5 group cursor-pointer transition-colors"
                      style={{
                        backgroundColor: isPrimary ? "rgba(0,180,216,0.04)" : "rgba(13,13,13,0.5)",
                        borderColor: isPrimary ? "rgba(0,180,216,0.2)" : "rgba(255,255,255,0.06)",
                      }}
                      onClick={() => {
                        // Fetch fresh contact details (so edit dialog has notes,
                        // first_name, etc. not just the trimmed embed shape).
                        fetch("/api/pipeline/contacts")
                          .then((r) => r.json())
                          .then((j) => {
                            const full = (j.data ?? []).find((row: CrmContact) => row.id === c.id);
                            if (full) setEditingContact(full);
                          });
                      }}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5">
                            <p className="text-sm font-semibold truncate">{c.full_name}</p>
                            {isPrimary && (
                              <Star size={11} fill="#00B4D8" style={{ color: "#00B4D8" }} aria-label="Primary contact" />
                            )}
                          </div>
                          <p className="text-[11px] truncate" style={{ color: "rgba(245,245,245,0.5)" }}>
                            {[c.title, c.company?.name].filter(Boolean).join(" · ") || "—"}
                          </p>
                        </div>
                        <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                          {!isPrimary && (
                            <button
                              onClick={(e) => { e.stopPropagation(); handleSetPrimary(c.id); }}
                              className="p-1 rounded hover:bg-[rgba(0,180,216,0.1)] transition-colors"
                              title="Set as primary"
                              aria-label="Set as primary contact"
                            >
                              <Star size={11} style={{ color: "rgba(0,180,216,0.7)" }} />
                            </button>
                          )}
                          <button
                            onClick={(e) => { e.stopPropagation(); handleRemoveContact(c.id); }}
                            className="p-1 rounded hover:bg-[rgba(239,68,68,0.1)] transition-colors"
                            title="Remove from deal"
                            aria-label="Remove contact from deal"
                          >
                            <XIcon size={11} style={{ color: "rgba(245,245,245,0.5)" }} />
                          </button>
                        </div>
                      </div>
                      <div className="mt-1.5 space-y-0.5 text-[11px]" style={{ color: "rgba(245,245,245,0.55)" }}>
                        {c.email && (
                          <a href={`mailto:${c.email}`} onClick={(e) => e.stopPropagation()} className="flex items-center gap-1.5 hover:text-foreground">
                            <Mail size={10} style={{ color: "#00B4D8" }} /> {c.email}
                          </a>
                        )}
                        {c.phone && (
                          <a href={`tel:${c.phone}`} onClick={(e) => e.stopPropagation()} className="flex items-center gap-1.5 hover:text-foreground">
                            <Phone size={10} style={{ color: "#00B4D8" }} /> {c.phone}
                          </a>
                        )}
                        {c.linkedin_url && (
                          <a
                            href={c.linkedin_url.startsWith("http") ? c.linkedin_url : `https://${c.linkedin_url}`}
                            target="_blank"
                            rel="noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="flex items-center gap-1.5 hover:text-foreground"
                          >
                            <ExternalLink size={10} style={{ color: "#00B4D8" }} /> LinkedIn
                          </a>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div
            className="rounded-lg border p-4"
            style={{ backgroundColor: "rgba(26,26,26,0.5)", borderColor: "rgba(255,255,255,0.06)" }}
          >
            <div className="flex items-center justify-between mb-2">
              <p className="text-[10px] uppercase tracking-wider" style={{ color: "rgba(0,180,216,0.5)", fontFamily: mono }}>
                Company
              </p>
              <button
                onClick={() => setCompanyPickerOpen(true)}
                className="flex items-center gap-1.5 px-2.5 py-1 text-[10px] uppercase tracking-wider rounded-md transition-colors hover:bg-[rgba(0,180,216,0.15)]"
                style={{ fontFamily: mono, color: "#00B4D8", border: "1px solid rgba(0,180,216,0.3)" }}
              >
                {deal.company ? <><Repeat size={11} /> Change</> : <><Building size={11} /> Set</>}
              </button>
            </div>
            {deal.company ? (
              <>
                <p className="text-sm font-semibold">{deal.company.name}</p>
                <div className="mt-1 space-y-0.5 text-[11px]" style={{ color: "rgba(245,245,245,0.5)" }}>
                  {deal.company.industry && <p>{deal.company.industry}</p>}
                  {deal.company.hq && <p>{deal.company.hq}</p>}
                  {deal.company.headcount && <p>{deal.company.headcount} employees</p>}
                  {deal.company.website && (
                    <a
                      href={deal.company.website.startsWith("http") ? deal.company.website : `https://${deal.company.website}`}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center gap-1 hover:text-foreground"
                    >
                      <ExternalLink size={10} style={{ color: "#00B4D8" }} /> {deal.company.domain ?? "Website"}
                    </a>
                  )}
                </div>
              </>
            ) : (
              <p className="text-[11px]" style={{ color: "rgba(245,245,245,0.4)", fontFamily: mono }}>
                No company linked. Click Set to attach one.
              </p>
            )}
          </div>
        </div>
      </div>

      <ContactPickerDialog
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        excludeContactIds={deal.contacts.map((dc) => dc.contact.id)}
        onPick={handleAddContact}
      />

      <CompanyPickerDialog
        open={companyPickerOpen}
        onClose={() => setCompanyPickerOpen(false)}
        currentCompanyId={deal.crm_company_id}
        onPick={handleChangeCompany}
      />

      <NewContactDialog
        open={!!editingContact}
        contact={editingContact}
        onClose={() => setEditingContact(null)}
        onCreated={fetchDeal}
      />
    </PageLayout>
  );
}

function SaveStatus({ saving, savedAt }: { saving: boolean; savedAt: number | null }) {
  const [tick, setTick] = useState(0);
  // Re-render every 15s so "Saved Ns ago" stays fresh.
  useEffect(() => {
    if (!savedAt) return;
    const t = setInterval(() => setTick((n) => n + 1), 15_000);
    return () => clearInterval(t);
  }, [savedAt, tick]);

  if (saving) {
    return (
      <span className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider" style={{ color: "#00B4D8", fontFamily: mono }}>
        <Loader2 size={11} className="animate-spin" /> Saving…
      </span>
    );
  }
  if (!savedAt) {
    return (
      <span className="text-[10px] uppercase tracking-wider" style={{ color: "rgba(245,245,245,0.35)", fontFamily: mono }}>
        Auto-saved
      </span>
    );
  }
  const seconds = Math.max(1, Math.round((Date.now() - savedAt) / 1000));
  const label = seconds < 60
    ? `Saved ${seconds}s ago`
    : seconds < 3600
      ? `Saved ${Math.round(seconds / 60)}m ago`
      : "Saved";
  return (
    <span className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider" style={{ color: "rgba(16,185,129,0.7)", fontFamily: mono }}>
      <Check size={11} /> {label}
    </span>
  );
}
