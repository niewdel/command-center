"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Mail, Phone, ExternalLink, Trash2, Save } from "lucide-react";
import { PageLayout } from "@/components/layout/page-layout";
import { PipelineTabs } from "@/components/pipeline/pipeline-tabs";
import { supabase } from "@/lib/supabase";
import { DEAL_STAGES, STAGE_LABEL, STAGE_COLOR, type DealStage, type CrmDeal, type CrmCompany, type CrmContact } from "@/types/pipeline";

const mono = "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace";

type DealDetail = CrmDeal & {
  company: Pick<CrmCompany, "id" | "name" | "domain" | "website" | "industry" | "headcount" | "hq" | "notes"> | null;
  contact: Pick<CrmContact, "id" | "full_name" | "title" | "email" | "phone" | "linkedin_url" | "notes"> | null;
};

export default function DealDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const id = params.id;

  const [deal, setDeal] = useState<DealDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  // Editable fields
  const [title, setTitle] = useState("");
  const [stage, setStage] = useState<DealStage>("discovery");
  const [valueDollars, setValueDollars] = useState("");
  const [closeDate, setCloseDate] = useState("");
  const [notes, setNotes] = useState("");
  const [owner, setOwner] = useState("");
  const [lostReason, setLostReason] = useState("");

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
    }
    setLoading(false);
  }, [id]);

  useEffect(() => {
    fetchDeal();
    const ch = supabase
      .channel(`deal-${id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "crm_deals", filter: `id=eq.${id}` }, () => fetchDeal())
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [id, fetchDeal]);

  const handleSave = async () => {
    setSaving(true);
    const value_cents = valueDollars ? Math.round(parseFloat(valueDollars) * 100) : null;
    await fetch(`/api/pipeline/deals/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: title.trim(),
        stage,
        value_cents,
        close_date_est: closeDate || null,
        notes: notes.trim() || null,
        owner: owner.trim() || null,
        lost_reason: stage === "lost" ? (lostReason.trim() || null) : null,
      }),
    });
    setSaving(false);
    await fetchDeal();
  };

  const handleDelete = async () => {
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
                onChange={(e) => setTitle(e.target.value)}
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
                    onClick={() => setStage(s)}
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
                  onChange={(e) => setValueDollars(e.target.value)}
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
                  onChange={(e) => setCloseDate(e.target.value)}
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
                  onChange={(e) => setOwner(e.target.value)}
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
                  onChange={(e) => setLostReason(e.target.value)}
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
                onChange={(e) => setNotes(e.target.value)}
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
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex items-center gap-1.5 px-3 py-1.5 text-[10px] uppercase tracking-wider rounded-md transition-colors hover:bg-[rgba(0,180,216,0.15)] disabled:opacity-50"
                style={{ fontFamily: mono, color: "#00B4D8", border: "1px solid rgba(0,180,216,0.3)" }}
              >
                <Save size={12} /> {saving ? "Saving…" : "Save"}
              </button>
            </div>
          </div>
        </div>

        {/* Right: linked entities */}
        <div className="space-y-3">
          {deal.contact && (
            <div
              className="rounded-lg border p-4"
              style={{ backgroundColor: "rgba(26,26,26,0.5)", borderColor: "rgba(255,255,255,0.06)" }}
            >
              <p className="text-[10px] uppercase tracking-wider mb-2" style={{ color: "rgba(0,180,216,0.5)", fontFamily: mono }}>
                Primary Contact
              </p>
              <p className="text-sm font-semibold">{deal.contact.full_name}</p>
              {deal.contact.title && (
                <p className="text-[11px]" style={{ color: "rgba(245,245,245,0.5)" }}>{deal.contact.title}</p>
              )}
              <div className="mt-2 space-y-1 text-[11px]" style={{ color: "rgba(245,245,245,0.6)" }}>
                {deal.contact.email && (
                  <a href={`mailto:${deal.contact.email}`} className="flex items-center gap-2 hover:text-foreground">
                    <Mail size={11} style={{ color: "#00B4D8" }} /> {deal.contact.email}
                  </a>
                )}
                {deal.contact.phone && (
                  <a href={`tel:${deal.contact.phone}`} className="flex items-center gap-2 hover:text-foreground">
                    <Phone size={11} style={{ color: "#00B4D8" }} /> {deal.contact.phone}
                  </a>
                )}
                {deal.contact.linkedin_url && (
                  <a
                    href={deal.contact.linkedin_url.startsWith("http") ? deal.contact.linkedin_url : `https://${deal.contact.linkedin_url}`}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-2 hover:text-foreground"
                  >
                    <ExternalLink size={11} style={{ color: "#00B4D8" }} /> LinkedIn
                  </a>
                )}
              </div>
            </div>
          )}

          {deal.company && (
            <div
              className="rounded-lg border p-4"
              style={{ backgroundColor: "rgba(26,26,26,0.5)", borderColor: "rgba(255,255,255,0.06)" }}
            >
              <p className="text-[10px] uppercase tracking-wider mb-2" style={{ color: "rgba(0,180,216,0.5)", fontFamily: mono }}>
                Company
              </p>
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
            </div>
          )}
        </div>
      </div>
    </PageLayout>
  );
}
