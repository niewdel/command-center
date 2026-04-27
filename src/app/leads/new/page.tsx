"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Sparkles, ArrowLeft } from "lucide-react";
import Link from "next/link";
import { PageLayout } from "@/components/layout/page-layout";
import { LeadsTabs } from "@/components/leads/leads-tabs";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";

const REVENUE_RANGES = [
  { label: "<$1M", value: "0,1000000" },
  { label: "$1–5M", value: "1000000,5000000" },
  { label: "$5–10M", value: "5000000,10000000" },
  { label: "$10–25M", value: "10000000,25000000" },
  { label: "$25–50M", value: "25000000,50000000" },
  { label: "$50–100M", value: "50000000,100000000" },
  { label: "$100M+", value: "100000000,1000000000" },
];

const EMPLOYEE_RANGES = [
  { label: "1–10", value: "1,10" },
  { label: "11–50", value: "11,50" },
  { label: "51–200", value: "51,200" },
  { label: "201–500", value: "201,500" },
  { label: "501–1000", value: "501,1000" },
  { label: "1001+", value: "1001,10000" },
];

export default function NewLeadJobPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [industries, setIndustries] = useState("");
  const [geo, setGeo] = useState("");
  const [locations, setLocations] = useState("");
  const [revenueRanges, setRevenueRanges] = useState<string[]>([]);
  const [employeeRanges, setEmployeeRanges] = useState<string[]>([]);
  const [icp, setIcp] = useState("");
  const [target, setTarget] = useState(25);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggleSet = (
    arr: string[],
    setter: (v: string[]) => void,
    val: string
  ) => {
    setter(arr.includes(val) ? arr.filter((x) => x !== val) : [...arr, val]);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !industries.trim()) {
      setError("Vertical name and industry keywords are required.");
      return;
    }
    setSubmitting(true);
    setError(null);

    const body = {
      vertical_name: name.trim(),
      industries: industries.split(",").map((s) => s.trim()).filter(Boolean),
      geo: geo
        ? geo.split(",").map((s) => s.trim()).filter(Boolean)
        : undefined,
      locations: locations
        ? locations.split(",").map((s) => s.trim()).filter(Boolean)
        : undefined,
      revenue_ranges: revenueRanges.length ? revenueRanges : undefined,
      employee_ranges: employeeRanges.length ? employeeRanges : undefined,
      icp_description: icp.trim() || undefined,
      target_count: target,
    };

    try {
      const res = await fetch("/api/leads/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? "Failed to start job");
        setSubmitting(false);
        return;
      }
      router.push(`/leads?job=${json.id}`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
      setSubmitting(false);
    }
  };

  return (
    <PageLayout
      title="Generate Leads"
      description="Run the Apollo \u2192 Hunter \u2192 Claude pipeline against fresh criteria"
      icon={Sparkles}
      maxWidth="lg"
      breadcrumbs={[{ label: "Leads", href: "/leads" }, { label: "New" }]}
    >
      <LeadsTabs />

      <Link
        href="/leads"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-2"
      >
        <ArrowLeft className="size-3.5" /> Back to Leads
      </Link>

      <form onSubmit={handleSubmit} className="space-y-4">
        <Card className="p-5 space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="name">
              Vertical name <span className="text-destructive">*</span>
            </Label>
            <Input
              id="name"
              placeholder="e.g., Charlotte HVAC contractors"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
            <p className="text-xs text-muted-foreground">
              A label so you can recognize this batch later.
            </p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="industries">
              Industry keywords <span className="text-destructive">*</span>
            </Label>
            <Input
              id="industries"
              placeholder="hvac, mechanical contractor, plumbing"
              value={industries}
              onChange={(e) => setIndustries(e.target.value)}
              required
            />
            <p className="text-xs text-muted-foreground">
              Comma-separated. Apollo searches by these tags; we also
              client-side filter to ensure relevance.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="geo">Target states (optional)</Label>
              <Input
                id="geo"
                placeholder="NC, SC, GA"
                value={geo}
                onChange={(e) => setGeo(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Used for client-side filtering of Apollo results.
              </p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="locations">Apollo locations (optional)</Label>
              <Input
                id="locations"
                placeholder="Charlotte, NC; Raleigh, NC"
                value={locations}
                onChange={(e) => setLocations(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Comma-separated city/region strings sent to Apollo directly.
              </p>
            </div>
          </div>
        </Card>

        <Card className="p-5 space-y-4">
          <div className="space-y-2">
            <Label>Revenue ranges (optional)</Label>
            <div className="flex flex-wrap gap-2">
              {REVENUE_RANGES.map((r) => {
                const active = revenueRanges.includes(r.value);
                return (
                  <button
                    type="button"
                    key={r.value}
                    onClick={() =>
                      toggleSet(revenueRanges, setRevenueRanges, r.value)
                    }
                    className={cn(
                      "px-3 h-8 text-xs rounded-md border transition-colors",
                      active
                        ? "bg-foreground text-background border-foreground"
                        : "bg-background border-border hover:bg-muted"
                    )}
                  >
                    {r.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="space-y-2">
            <Label>Employee count (optional)</Label>
            <div className="flex flex-wrap gap-2">
              {EMPLOYEE_RANGES.map((r) => {
                const active = employeeRanges.includes(r.value);
                return (
                  <button
                    type="button"
                    key={r.value}
                    onClick={() =>
                      toggleSet(employeeRanges, setEmployeeRanges, r.value)
                    }
                    className={cn(
                      "px-3 h-8 text-xs rounded-md border transition-colors",
                      active
                        ? "bg-foreground text-background border-foreground"
                        : "bg-background border-border hover:bg-muted"
                    )}
                  >
                    {r.label}
                  </button>
                );
              })}
            </div>
          </div>
        </Card>

        <Card className="p-5 space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="icp">ICP description (optional)</Label>
            <Textarea
              id="icp"
              placeholder="What kind of company is the perfect fit? Any operational pains you'd want highlighted in the research?"
              value={icp}
              onChange={(e) => setIcp(e.target.value)}
              rows={4}
            />
            <p className="text-xs text-muted-foreground">
              Influences the Claude research prompt and email tone.
            </p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="target">Target lead count</Label>
            <div className="flex items-center gap-3">
              <Input
                id="target"
                type="number"
                min={1}
                max={100}
                value={target}
                onChange={(e) => setTarget(parseInt(e.target.value) || 25)}
                className="w-24"
              />
              <span className="text-sm text-muted-foreground">
                companies (max 100). Hunter quota is the real limit; check your
                plan.
              </span>
            </div>
          </div>
        </Card>

        {error && (
          <p className="text-sm text-destructive" role="alert">
            {error}
          </p>
        )}

        <div className="flex items-center gap-2">
          <Button type="submit" disabled={submitting} size="lg">
            {submitting ? "Starting…" : "Generate Leads"}
          </Button>
          <Link
            href="/leads"
            className="text-sm text-muted-foreground hover:text-foreground px-3"
          >
            Cancel
          </Link>
        </div>
      </form>
    </PageLayout>
  );
}
