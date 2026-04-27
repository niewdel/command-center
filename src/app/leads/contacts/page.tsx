"use client";

import { useEffect, useMemo, useState } from "react";
import { Contact as ContactIcon, CheckCircle2, ExternalLink } from "lucide-react";
import { PageLayout } from "@/components/layout/page-layout";
import { LeadsTabs } from "@/components/leads/leads-tabs";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import type { RoleType } from "@/types/leads";

type ContactRow = {
  id: string;
  full_name: string;
  title: string | null;
  email: string | null;
  email_verified: boolean;
  linkedin_url: string | null;
  role_type: RoleType;
  is_primary: boolean;
  companies: {
    id: string;
    name: string;
    domain: string | null;
    industry: string | null;
    city: string | null;
    state: string | null;
  } | null;
};

const ROLES: Array<"" | RoleType> = ["", "decision_maker", "influencer", "unknown"];

const ROLE_BADGE: Record<string, string> = {
  decision_maker: "bg-emerald-500/15 text-emerald-400",
  influencer: "bg-blue-500/15 text-blue-400",
  champion: "bg-purple-500/15 text-purple-400",
  end_user: "bg-amber-500/15 text-amber-400",
  unknown: "bg-muted text-muted-foreground",
};

export default function ContactsPage() {
  const [contacts, setContacts] = useState<ContactRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [roleFilter, setRoleFilter] = useState<"" | RoleType>("");
  const [verifiedOnly, setVerifiedOnly] = useState(false);
  const [search, setSearch] = useState("");

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams({ limit: "200" });
    if (roleFilter) params.set("role_type", roleFilter);
    if (verifiedOnly) params.set("verified", "true");
    fetch(`/api/leads/contacts?${params.toString()}`)
      .then((r) => r.json())
      .then((res) => {
        setContacts(res.data ?? []);
        setTotal(res.total ?? 0);
      })
      .finally(() => setLoading(false));
  }, [roleFilter, verifiedOnly]);

  const filtered = useMemo(() => {
    if (!search.trim()) return contacts;
    const q = search.toLowerCase();
    return contacts.filter(
      (c) =>
        c.full_name.toLowerCase().includes(q) ||
        (c.email ?? "").toLowerCase().includes(q) ||
        (c.title ?? "").toLowerCase().includes(q) ||
        (c.companies?.name ?? "").toLowerCase().includes(q)
    );
  }, [contacts, search]);

  return (
    <PageLayout
      title="Contacts"
      description={`${total} total`}
      icon={ContactIcon}
      maxWidth="xl"
    >
      <LeadsTabs />

      <div className="flex flex-col sm:flex-row gap-2 mb-3">
        <Input
          placeholder="Search by name, email, title, or company"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="sm:max-w-xs"
        />
        <div className="flex flex-wrap gap-1 items-center">
          {ROLES.map((r) => (
            <Button
              key={r || "all"}
              size="sm"
              variant={roleFilter === r ? "default" : "outline"}
              onClick={() => setRoleFilter(r)}
              className="text-xs h-7 capitalize"
            >
              {r ? r.replace(/_/g, " ") : "All"}
            </Button>
          ))}
          <label className="flex items-center gap-2 text-xs text-muted-foreground ml-2">
            <Checkbox
              checked={verifiedOnly}
              onCheckedChange={(v) => setVerifiedOnly(v === true)}
            />
            Verified only
          </label>
        </div>
      </div>

      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div
              key={i}
              className="h-14 rounded-lg bg-muted/40 animate-pulse"
            />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <Card className="p-6 text-sm text-muted-foreground">
          No contacts match the current filter.
        </Card>
      ) : (
        <ul className="space-y-2">
          {filtered.map((c) => (
            <li key={c.id}>
              <Card className="px-4 py-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-medium truncate">{c.full_name}</p>
                      {c.is_primary && (
                        <Badge variant="outline" className="text-[10px] h-5">
                          Primary
                        </Badge>
                      )}
                      <Badge
                        variant="secondary"
                        className={cn(
                          "text-[10px] h-5 capitalize",
                          ROLE_BADGE[c.role_type] ?? ROLE_BADGE.unknown
                        )}
                      >
                        {c.role_type.replace(/_/g, " ")}
                      </Badge>
                    </div>
                    {c.title && (
                      <p className="text-sm text-muted-foreground truncate">
                        {c.title}
                        {c.companies && ` \u00b7 ${c.companies.name}`}
                      </p>
                    )}
                    {c.email && (
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span className="truncate">{c.email}</span>
                        {c.email_verified && (
                          <CheckCircle2 className="size-3.5 text-emerald-400 shrink-0" />
                        )}
                      </div>
                    )}
                  </div>
                  {c.linkedin_url && (
                    <a
                      href={c.linkedin_url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1 shrink-0"
                      aria-label={`Open ${c.full_name} on LinkedIn`}
                    >
                      LinkedIn <ExternalLink className="size-3" />
                    </a>
                  )}
                </div>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </PageLayout>
  );
}
