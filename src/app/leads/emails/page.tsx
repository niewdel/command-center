"use client";

import { useEffect, useMemo, useState } from "react";
import { Mail, ChevronDown } from "lucide-react";
import { PageLayout } from "@/components/layout/page-layout";
import { LeadsTabs } from "@/components/leads/leads-tabs";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { EmailStatus } from "@/types/leads";

type EmailRow = {
  id: string;
  step_number: number;
  subject: string | null;
  body_plain: string | null;
  status: EmailStatus;
  sent_at: string | null;
  opened_at: string | null;
  replied_at: string | null;
  open_count: number;
  created_at: string;
  contacts: {
    full_name: string;
    title: string | null;
    email: string | null;
    companies: { name: string; domain: string | null } | null;
  } | null;
};

const STATUSES: Array<"" | EmailStatus> = [
  "",
  "draft",
  "approved",
  "scheduled",
  "sent",
  "bounced",
];

const STATUS_BADGE: Record<string, string> = {
  draft: "bg-muted text-muted-foreground",
  approved: "bg-foreground/8 text-foreground",
  scheduled: "bg-amber-500/15 text-amber-400",
  sent: "bg-emerald-500/15 text-emerald-400",
  bounced: "bg-red-500/15 text-red-400",
  failed: "bg-red-500/15 text-red-400",
};

export default function EmailsPage() {
  const [emails, setEmails] = useState<EmailRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<"" | EmailStatus>("");
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams({ limit: "100" });
    if (statusFilter) params.set("status", statusFilter);
    fetch(`/api/leads/emails?${params.toString()}`)
      .then((r) => r.json())
      .then((res) => {
        setEmails(res.data ?? []);
        setTotal(res.total ?? 0);
      })
      .finally(() => setLoading(false));
  }, [statusFilter]);

  const grouped = useMemo(() => {
    const map = new Map<string, EmailRow[]>();
    for (const e of emails) {
      const contact = e.contacts;
      const key = contact
        ? `${contact.full_name}|${contact.companies?.name ?? "Unknown"}`
        : "Unassigned";
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(e);
    }
    return Array.from(map.entries());
  }, [emails]);

  return (
    <PageLayout
      title="Email Drafts"
      eyebrow="Lead Gen · Outreach"
      description={`${total} total`}
      icon={Mail}
      maxWidth="xl"
    >
      <LeadsTabs />

      <div className="flex flex-wrap gap-1 mb-3">
        {STATUSES.map((s) => (
          <Button
            key={s || "all"}
            size="sm"
            variant={statusFilter === s ? "default" : "outline"}
            onClick={() => setStatusFilter(s)}
            className="text-xs h-7 capitalize"
          >
            {s || "All"}
          </Button>
        ))}
      </div>

      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="h-24 rounded-lg bg-muted/40 animate-pulse"
            />
          ))}
        </div>
      ) : grouped.length === 0 ? (
        <Card className="p-6 text-sm text-muted-foreground">
          No emails yet. The lead-gen CLI engine drafts these via Claude.
        </Card>
      ) : (
        <ul className="space-y-3">
          {grouped.map(([key, items]) => {
            const [contactName, companyName] = key.split("|");
            const first = items[0];
            return (
              <li key={key}>
                <Card>
                  <div className="px-4 py-2.5 border-b border-border">
                    <p className="text-sm font-medium truncate">
                      {contactName}
                      {first?.contacts?.title && (
                        <span className="text-muted-foreground font-normal">
                          {" "}
                          · {first.contacts.title}
                        </span>
                      )}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">
                      {companyName}
                      {first?.contacts?.email && ` · ${first.contacts.email}`}
                    </p>
                  </div>
                  <ul className="divide-y divide-border">
                    {items
                      .sort((a, b) => a.step_number - b.step_number)
                      .map((e) => {
                        const isOpen = expanded === e.id;
                        return (
                          <li key={e.id}>
                            <button
                              type="button"
                              onClick={() =>
                                setExpanded(isOpen ? null : e.id)
                              }
                              className="w-full px-4 py-2.5 flex items-center justify-between gap-3 text-left hover:bg-muted/40 transition-colors"
                              aria-expanded={isOpen}
                            >
                              <div className="flex items-center gap-3 min-w-0">
                                <Badge
                                  variant="outline"
                                  className="text-[10px] h-5 shrink-0"
                                >
                                  Step {e.step_number}
                                </Badge>
                                <Badge
                                  variant="secondary"
                                  className={cn(
                                    "text-[10px] h-5 capitalize shrink-0",
                                    STATUS_BADGE[e.status] ?? STATUS_BADGE.draft
                                  )}
                                >
                                  {e.status}
                                </Badge>
                                <p className="text-sm font-medium truncate">
                                  {e.subject || "(no subject)"}
                                </p>
                              </div>
                              <ChevronDown
                                className={cn(
                                  "size-4 text-muted-foreground transition-transform shrink-0",
                                  isOpen && "rotate-180"
                                )}
                              />
                            </button>
                            {isOpen && (
                              <div className="px-4 pb-3">
                                <pre className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-pretty font-sans bg-muted/30 rounded-md p-3 border border-border">
                                  {e.body_plain || "(no body)"}
                                </pre>
                                <p className="mt-2 text-xs text-muted-foreground">
                                  {e.sent_at && `Sent ${new Date(e.sent_at).toLocaleString()}`}
                                  {e.opened_at &&
                                    ` · Opened ${new Date(e.opened_at).toLocaleString()} (${e.open_count}x)`}
                                  {e.replied_at &&
                                    ` · Replied ${new Date(e.replied_at).toLocaleString()}`}
                                </p>
                              </div>
                            )}
                          </li>
                        );
                      })}
                  </ul>
                </Card>
              </li>
            );
          })}
        </ul>
      )}
    </PageLayout>
  );
}
