"use client";

import { useCallback, useEffect, useState } from "react";
import { StickyNote, Phone, Mail, Users, ArrowRightLeft, Loader2 } from "lucide-react";
import { ACTIVITY_TYPES, ACTIVITY_TYPE_LABEL, type ActivityType, type CrmActivity } from "@/types/pipeline";

const mono = "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace";

/** Types a user can log by hand. `stage_change` is server-generated only. */
const LOGGABLE_TYPES: ActivityType[] = ACTIVITY_TYPES.filter((t) => t !== "stage_change");

const ACTIVITY_ICON: Record<ActivityType, typeof StickyNote> = {
  note: StickyNote,
  call: Phone,
  email: Mail,
  meeting: Users,
  stage_change: ArrowRightLeft,
};

function formatRelativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  const now = Date.now();
  const diffSec = Math.round((now - then) / 1000);
  if (diffSec < 60) return "just now";
  const diffMin = Math.round(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.round(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.round(diffHr / 24);
  if (diffDay < 30) return `${diffDay}d ago`;
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

/** Which entity this activity timeline is scoped to. Exactly one key is set. */
export type ActivityScope = { dealId: string } | { crmCompanyId: string } | { contactId: string };

function scopeToQuery(scope: ActivityScope): string {
  if ("dealId" in scope) return `deal_id=${scope.dealId}`;
  if ("crmCompanyId" in scope) return `crm_company_id=${scope.crmCompanyId}`;
  return `contact_id=${scope.contactId}`;
}

function scopeToBody(scope: ActivityScope): Record<string, string> {
  if ("dealId" in scope) return { deal_id: scope.dealId };
  if ("crmCompanyId" in scope) return { crm_company_id: scope.crmCompanyId };
  return { contact_id: scope.contactId };
}

function scopeToFields(scope: ActivityScope): Pick<CrmActivity, "deal_id" | "crm_company_id" | "contact_id"> {
  return {
    deal_id: "dealId" in scope ? scope.dealId : null,
    crm_company_id: "crmCompanyId" in scope ? scope.crmCompanyId : null,
    contact_id: "contactId" in scope ? scope.contactId : null,
  };
}

/** Activity timeline + quick-log composer, scoped to a deal, company, or contact. */
export function ActivityTimeline({ scope }: { scope: ActivityScope }) {
  const query = scopeToQuery(scope);
  const bodyFields = scopeToBody(scope);
  const activityFields = scopeToFields(scope);

  const [activities, setActivities] = useState<CrmActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const [type, setType] = useState<ActivityType>("note");
  const [text, setText] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const fetchActivities = useCallback(async () => {
    const res = await fetch(`/api/pipeline/activities?${query}`);
    const json = await res.json();
    setActivities(json.data ?? []);
    setLoading(false);
  }, [query]);

  useEffect(() => {
    fetchActivities();
  }, [fetchActivities]);

  const handleSubmit = async () => {
    const body = text.trim();
    if (!body || submitting) return;
    setSubmitting(true);

    // Optimistic append — a temp id keeps the list stable until the real
    // row (or a rollback on failure) comes back.
    const optimistic: CrmActivity = {
      id: `temp-${Date.now()}`,
      workspace_id: "",
      ...activityFields,
      type,
      body,
      occurred_at: new Date().toISOString(),
      created_by: null,
      created_at: new Date().toISOString(),
    };
    setActivities((prev) => [optimistic, ...prev]);
    setText("");

    try {
      const res = await fetch("/api/pipeline/activities", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, body, ...bodyFields }),
      });
      if (res.ok) {
        const json = await res.json();
        setActivities((prev) => prev.map((a) => (a.id === optimistic.id ? json.data : a)));
      } else {
        setActivities((prev) => prev.filter((a) => a.id !== optimistic.id));
      }
    } catch {
      setActivities((prev) => prev.filter((a) => a.id !== optimistic.id));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="rounded-lg border p-4 space-y-4"
      style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}
    >
      <p
        className="text-[10px] uppercase tracking-wider"
        style={{ color: "color-mix(in oklch, var(--rust) calc(0.5 * 100%), transparent)", fontFamily: mono }}
      >
        Activity
      </p>

      {/* Quick-log composer */}
      <div className="space-y-2">
        <div className="flex flex-wrap gap-1.5">
          {LOGGABLE_TYPES.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setType(t)}
              className="px-2.5 py-1 text-[10px] uppercase tracking-wider rounded-md transition-colors"
              style={{
                fontFamily: mono,
                backgroundColor: type === t ? "color-mix(in oklch, var(--rust) calc(0.12 * 100%), transparent)" : "transparent",
                color: type === t ? "var(--rust)" : "var(--ink-soft)",
                border: `1px solid ${type === t ? "var(--rust)" : "var(--border)"}`,
              }}
            >
              {ACTIVITY_TYPE_LABEL[t]}
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                handleSubmit();
              }
            }}
            rows={2}
            placeholder={`Log a ${ACTIVITY_TYPE_LABEL[type].toLowerCase()}…`}
            className="flex-1 text-sm bg-transparent outline-none border rounded-md px-2 py-1.5 resize-vertical"
            style={{ borderColor: "var(--border)" }}
          />
        </div>
        <div className="flex justify-end">
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!text.trim() || submitting}
            className="px-3 py-1.5 text-[10px] uppercase tracking-wider rounded-md transition-colors hover:bg-[color-mix(in oklch, var(--rust) calc(0.15 * 100%), transparent)] disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ fontFamily: mono, color: "var(--rust)", border: "1px solid color-mix(in oklch, var(--rust) calc(0.3 * 100%), transparent)" }}
          >
            {submitting ? "Logging…" : "Log activity"}
          </button>
        </div>
      </div>

      {/* Timeline */}
      {loading ? (
        <div className="flex items-center gap-2 text-[11px]" style={{ color: "var(--ink-soft)", fontFamily: mono }}>
          <Loader2 size={12} className="animate-spin" /> Loading…
        </div>
      ) : activities.length === 0 ? (
        <p className="text-[11px]" style={{ color: "var(--ink-soft)", fontFamily: mono }}>
          No activity yet. Log a note, call, email, or meeting above.
        </p>
      ) : (
        <ul className="space-y-3">
          {activities.map((a) => {
            const Icon = ACTIVITY_ICON[a.type];
            return (
              <li key={a.id} className="flex gap-2.5">
                <span
                  className="flex items-center justify-center shrink-0 size-6 rounded-full mt-0.5"
                  style={{ backgroundColor: "color-mix(in oklch, var(--rust) calc(0.1 * 100%), transparent)", color: "var(--rust)" }}
                >
                  <Icon size={12} />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="text-[10px] uppercase tracking-wider" style={{ color: "var(--ink-soft)", fontFamily: mono }}>
                      {ACTIVITY_TYPE_LABEL[a.type]}
                    </span>
                    <span className="text-[10px] shrink-0" style={{ color: "var(--ink-faint)", fontFamily: mono }}>
                      {formatRelativeTime(a.occurred_at)}
                    </span>
                  </div>
                  {a.body && <p className="text-sm mt-0.5 text-pretty">{a.body}</p>}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
