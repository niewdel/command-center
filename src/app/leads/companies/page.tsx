"use client";

import { useEffect, useState } from "react";
import { Building2, ChevronDown } from "lucide-react";
import { PageLayout } from "@/components/layout/page-layout";
import { LeadsTabs } from "@/components/leads/leads-tabs";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { CompanyStatus } from "@/types/leads";

type CompanyRow = {
  id: string;
  name: string;
  domain: string | null;
  industry: string | null;
  revenue_range: string | null;
  headcount: number | null;
  city: string | null;
  state: string | null;
  status: CompanyStatus;
  research_summary: string | null;
  researched_at: string | null;
  verticals: { id: string; name: string } | null;
};

const STATUSES: Array<"" | CompanyStatus> = [
  "",
  "new",
  "researched",
  "outreach_ready",
  "in_sequence",
  "replied",
  "qualified",
];

const STATUS_BADGE: Record<string, string> = {
  new: "bg-muted text-muted-foreground",
  researched: "bg-foreground/8 text-foreground",
  outreach_ready: "bg-emerald-500/15 text-emerald-400",
  in_sequence: "bg-amber-500/15 text-amber-400",
  replied: "bg-purple-500/15 text-purple-400",
  qualified: "bg-green-500/15 text-green-400",
  disqualified: "bg-red-500/15 text-red-400",
};

export default function CompaniesPage() {
  const [companies, setCompanies] = useState<CompanyRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<"" | CompanyStatus>("");
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams({ limit: "100" });
    if (statusFilter) params.set("status", statusFilter);
    fetch(`/api/leads/companies?${params.toString()}`)
      .then((r) => r.json())
      .then((res) => {
        setCompanies(res.data ?? []);
        setTotal(res.total ?? 0);
      })
      .finally(() => setLoading(false));
  }, [statusFilter]);

  return (
    <PageLayout
      title="Companies"
      eyebrow="Lead Gen · Accounts"
      description={`${total} total`}
      icon={Building2}
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
            {s ? s.replace(/_/g, " ") : "All"}
          </Button>
        ))}
      </div>

      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3, 4, 5].map((i) => (
            <div
              key={i}
              className="h-16 rounded-lg bg-muted/40 animate-pulse"
            />
          ))}
        </div>
      ) : companies.length === 0 ? (
        <Card className="p-6 text-sm text-muted-foreground">
          No companies match this filter. Run the lead-gen CLI engine to scrape
          new leads.
        </Card>
      ) : (
        <ul className="space-y-2">
          {companies.map((c) => {
            const isOpen = expanded === c.id;
            return (
              <li key={c.id}>
                <Card className="overflow-hidden">
                  <button
                    type="button"
                    onClick={() => setExpanded(isOpen ? null : c.id)}
                    className="w-full px-4 py-3 flex items-center justify-between gap-3 text-left hover:bg-muted/40 transition-colors"
                    aria-expanded={isOpen}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <Badge
                        className={cn(
                          "text-xs capitalize whitespace-nowrap",
                          STATUS_BADGE[c.status] ?? "bg-muted text-muted-foreground"
                        )}
                        variant="secondary"
                      >
                        {c.status.replace(/_/g, " ")}
                      </Badge>
                      <div className="min-w-0">
                        <p className="font-medium truncate">{c.name}</p>
                        <p className="text-xs text-muted-foreground truncate">
                          {[c.domain, [c.city, c.state].filter(Boolean).join(", "), c.industry]
                            .filter(Boolean)
                            .join(" · ")}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <div className="hidden sm:block text-right text-xs text-muted-foreground">
                        {c.revenue_range && <p>{c.revenue_range}</p>}
                        {c.headcount && <p>{c.headcount} employees</p>}
                      </div>
                      <span className="hidden md:inline text-xs text-muted-foreground/70">
                        {c.verticals?.name}
                      </span>
                      <ChevronDown
                        className={cn(
                          "size-4 text-muted-foreground transition-transform",
                          isOpen && "rotate-180"
                        )}
                      />
                    </div>
                  </button>

                  {isOpen && (
                    <div className="px-4 py-3 border-t border-border space-y-2">
                      <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                        Research summary
                      </h4>
                      {c.research_summary ? (
                        <p className="text-sm leading-relaxed whitespace-pre-wrap text-pretty">
                          {c.research_summary}
                        </p>
                      ) : (
                        <p className="text-sm italic text-muted-foreground">
                          Not yet researched.
                        </p>
                      )}
                      {c.researched_at && (
                        <p className="text-xs text-muted-foreground/80">
                          Researched {new Date(c.researched_at).toLocaleDateString()}
                        </p>
                      )}
                    </div>
                  )}
                </Card>
              </li>
            );
          })}
        </ul>
      )}
    </PageLayout>
  );
}
