import { NextRequest, NextResponse } from "next/server";
import { getServiceClient } from "@/lib/leads/db";
import type { ContactStatus } from "@/types/leads";

export const dynamic = "force-dynamic";

type CompanyShape = {
  id: string;
  name: string;
  domain: string | null;
  industry: string | null;
  revenue_range: string | null;
  headcount: number | null;
  city: string | null;
  state: string | null;
  founded_year: number | null;
  latest_funding_stage: string | null;
  technologies: string[] | null;
  vertical_id: string | null;
};

type ContactRow = {
  id: string;
  full_name: string;
  title: string | null;
  email: string | null;
  email_verified: boolean;
  linkedin_url: string | null;
  phone: string | null;
  role_type: string;
  is_primary: boolean;
  lead_score: number | null;
  status: ContactStatus;
  companies: CompanyShape | null;
};

type EmailRow = {
  contact_id: string;
  step_number: number;
  subject: string | null;
  body_plain: string | null;
  status: string;
  sent_at: string | null;
  opened_at: string | null;
  replied_at: string | null;
};

export type Prospect = {
  id: string;
  company: string;
  contact: string;
  title: string;
  email: string;
  phone: string;
  linkedin: string;
  industry: string;
  size: string;
  score: number;
  status: ContactStatus;
  enrichment: {
    revenue: string;
    tech: string[];
    funding: string;
    founded: string;
    hq: string;
  };
  emails: { subject: string; type: string; body: string; step: number }[];
};

function formatSize(headcount: number | null): string {
  if (!headcount) return "—";
  if (headcount < 10) return "1-10";
  if (headcount < 25) return "10-25";
  if (headcount < 50) return "25-50";
  if (headcount < 100) return "50-100";
  if (headcount < 200) return "100-200";
  if (headcount < 500) return "200-500";
  if (headcount < 1000) return "500-1K";
  return `${Math.round(headcount / 1000)}K+`;
}

function formatHQ(city: string | null, state: string | null): string {
  if (city && state) return `${city}, ${state}`;
  return city ?? state ?? "—";
}

const STEP_TYPE: Record<number, string> = {
  1: "initial",
  2: "follow-up-1",
  3: "follow-up-2",
};

export async function GET(req: NextRequest) {
  const sb = getServiceClient();
  const params = req.nextUrl.searchParams;
  const status = params.get("status");
  const verticalId = params.get("vertical_id");
  const limit = parseInt(params.get("limit") ?? "100");

  // Primary contacts only — one card per company, like the demo.
  let q = sb
    .from("contacts")
    .select(
      "id, full_name, title, email, email_verified, linkedin_url, phone, role_type, is_primary, lead_score, status, companies(id, name, domain, industry, revenue_range, headcount, city, state, founded_year, latest_funding_stage, technologies, vertical_id)"
    )
    .eq("is_primary", true)
    .order("lead_score", { ascending: false, nullsFirst: false })
    .limit(limit);

  if (status) q = q.eq("status", status);
  if (verticalId) q = q.eq("companies.vertical_id", verticalId);

  const { data: contacts, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const rows = (contacts ?? []) as unknown as ContactRow[];
  const contactIds = rows.map((c) => c.id);

  // Pull all email drafts for the matched contacts in one shot.
  const emailsByContact = new Map<string, EmailRow[]>();
  if (contactIds.length) {
    const { data: emails } = await sb
      .from("outreach_emails")
      .select("contact_id, step_number, subject, body_plain, status, sent_at, opened_at, replied_at")
      .in("contact_id", contactIds)
      .order("step_number", { ascending: true });
    for (const e of (emails ?? []) as EmailRow[]) {
      const arr = emailsByContact.get(e.contact_id) ?? [];
      arr.push(e);
      emailsByContact.set(e.contact_id, arr);
    }
  }

  const prospects: Prospect[] = rows
    .filter((c) => c.companies)
    .map((c) => {
      const co = c.companies!;
      const emails = (emailsByContact.get(c.id) ?? []).map((e) => ({
        subject: e.subject ?? "",
        type: STEP_TYPE[e.step_number] ?? `step-${e.step_number}`,
        body: e.body_plain ?? "",
        step: e.step_number,
      }));
      return {
        id: c.id,
        company: co.name,
        contact: c.full_name,
        title: c.title ?? "—",
        email: c.email ?? "",
        phone: c.phone ?? "",
        linkedin: c.linkedin_url ?? "",
        industry: co.industry ?? "—",
        size: formatSize(co.headcount),
        score: c.lead_score ?? 0,
        status: c.status,
        enrichment: {
          revenue: co.revenue_range ?? "—",
          tech: co.technologies ?? [],
          funding: co.latest_funding_stage ?? "—",
          founded: co.founded_year ? String(co.founded_year) : "—",
          hq: formatHQ(co.city, co.state),
        },
        emails,
      };
    });

  return NextResponse.json({ data: prospects, total: prospects.length });
}
