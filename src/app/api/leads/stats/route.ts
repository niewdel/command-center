import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";

export async function GET() {
  const sb = await createClient();

  const [companies, contacts, emails, verticals, logs] = await Promise.all([
    sb.from("companies").select("status", { count: "exact" }),
    sb.from("contacts").select("*", { count: "exact", head: true }),
    sb.from("outreach_emails").select("status", { count: "exact" }),
    sb.from("verticals").select("id, name, is_active").order("name"),
    sb.from("pipeline_log").select("event_type"),
  ]);

  const companyStatuses: Record<string, number> = {};
  for (const c of companies.data ?? []) {
    companyStatuses[c.status] = (companyStatuses[c.status] ?? 0) + 1;
  }

  const emailStatuses: Record<string, number> = {};
  for (const e of emails.data ?? []) {
    emailStatuses[e.status] = (emailStatuses[e.status] ?? 0) + 1;
  }

  const eventTypes: Record<string, number> = {};
  for (const l of logs.data ?? []) {
    eventTypes[l.event_type] = (eventTypes[l.event_type] ?? 0) + 1;
  }

  return NextResponse.json({
    companies: { total: companies.count ?? 0, byStatus: companyStatuses },
    contacts: { total: contacts.count ?? 0 },
    emails: { total: emails.count ?? 0, byStatus: emailStatuses },
    verticals: verticals.data ?? [],
    events: eventTypes,
  });
}
