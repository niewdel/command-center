"use client";

import { useEffect, useState } from "react";
import { Users } from "lucide-react";
import { PageLayout } from "@/components/layout/page-layout";
import { LeadsTabs } from "@/components/leads/leads-tabs";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { LeadStats } from "@/types/leads";

const STATUS_DOT: Record<string, string> = {
  new: "bg-zinc-500",
  researched: "bg-blue-400",
  outreach_ready: "bg-emerald-400",
  in_sequence: "bg-amber-400",
  replied: "bg-purple-400",
  qualified: "bg-green-400",
  disqualified: "bg-red-400",
};

export default function LeadsStatsPage() {
  const [stats, setStats] = useState<LeadStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/leads/stats")
      .then((r) => r.json())
      .then((data) => setStats(data))
      .finally(() => setLoading(false));
  }, []);

  return (
    <PageLayout
      title="Leads"
      description="Pipeline overview across all verticals"
      icon={Users}
      maxWidth="xl"
      loading={loading}
    >
      <LeadsTabs />

      {!stats ? (
        <p className="text-sm text-muted-foreground">No data yet.</p>
      ) : (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <StatCard
              label="Companies"
              value={stats.companies.total}
              sub={`${stats.companies.byStatus.outreach_ready ?? 0} outreach ready`}
            />
            <StatCard
              label="Contacts"
              value={stats.contacts.total}
              sub="with verified emails"
            />
            <StatCard
              label="Emails Drafted"
              value={stats.emails.total}
              sub={`${stats.emails.byStatus.draft ?? 0} drafts`}
            />
            <StatCard
              label="Pipeline Events"
              value={Object.values(stats.events).reduce((a, b) => a + b, 0)}
              sub={`${stats.events.scraped ?? 0} scraped \u00b7 ${stats.events.researched ?? 0} researched`}
            />
          </div>

          <section className="space-y-3">
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
              Verticals
            </h2>
            {stats.verticals.length === 0 ? (
              <Card className="p-4 text-sm text-muted-foreground">
                No verticals yet. Run the lead-gen CLI to seed one.
              </Card>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {stats.verticals.map((v) => (
                  <Card
                    key={v.id}
                    className="px-4 py-3 flex items-center justify-between"
                  >
                    <div className="min-w-0">
                      <p className="font-medium truncate">{v.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {v.is_active ? "Active" : "Inactive"}
                      </p>
                    </div>
                    <span
                      className={cn(
                        "size-2 rounded-full shrink-0",
                        v.is_active ? "bg-emerald-400" : "bg-muted-foreground/40"
                      )}
                      aria-hidden
                    />
                  </Card>
                ))}
              </div>
            )}
          </section>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card className="p-4">
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                Company Pipeline
              </h3>
              {Object.keys(stats.companies.byStatus).length === 0 ? (
                <p className="text-sm text-muted-foreground">No companies yet.</p>
              ) : (
                <ul className="space-y-2">
                  {Object.entries(stats.companies.byStatus).map(([status, count]) => (
                    <li
                      key={status}
                      className="flex items-center justify-between text-sm"
                    >
                      <div className="flex items-center gap-2">
                        <span
                          className={cn(
                            "size-2 rounded-full",
                            STATUS_DOT[status] ?? "bg-muted-foreground/40"
                          )}
                          aria-hidden
                        />
                        <span className="capitalize">
                          {status.replace(/_/g, " ")}
                        </span>
                      </div>
                      <span className="font-mono tabular-nums text-muted-foreground">
                        {count}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </Card>

            <Card className="p-4">
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                Pipeline Events
              </h3>
              {Object.keys(stats.events).length === 0 ? (
                <p className="text-sm text-muted-foreground">No events yet.</p>
              ) : (
                <ul className="space-y-2">
                  {Object.entries(stats.events).map(([type, count]) => (
                    <li
                      key={type}
                      className="flex items-center justify-between text-sm"
                    >
                      <span className="capitalize">
                        {type.replace(/_/g, " ")}
                      </span>
                      <span className="font-mono tabular-nums text-muted-foreground">
                        {count}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </div>
        </div>
      )}
    </PageLayout>
  );
}

function StatCard({
  label,
  value,
  sub,
}: {
  label: string;
  value: number;
  sub: string;
}) {
  return (
    <Card className="px-4 py-3">
      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
        {label}
      </p>
      <p className="text-2xl font-semibold mt-1 tabular-nums">{value}</p>
      <p className="text-xs text-muted-foreground mt-1">{sub}</p>
    </Card>
  );
}
