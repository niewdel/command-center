import { NextResponse } from "next/server";
import { getServiceClient } from "@/lib/leads/db";

// Single aggregate round-trip: one parallel batch using head/count where
// possible, no full-table scans, no SSR cookie handshake. Drops first-load
// time on /leads from a few seconds to ~150ms.

export const dynamic = "force-dynamic";

export async function GET() {
  const sb = getServiceClient();

  const [
    companiesTotal,
    companyStatusRows,
    contactsTotal,
    emailsTotal,
    emailStatusRows,
    verticals,
    pipelineRows,
  ] = await Promise.all([
    sb.from("companies").select("*", { count: "exact", head: true }),
    sb.from("companies").select("status"),
    sb.from("contacts").select("*", { count: "exact", head: true }),
    sb.from("outreach_emails").select("*", { count: "exact", head: true }),
    sb.from("outreach_emails").select("status"),
    sb.from("verticals").select("id, name, is_active").order("name"),
    sb.from("pipeline_log").select("event_type"),
  ]);

  const companyStatuses: Record<string, number> = {};
  for (const c of companyStatusRows.data ?? []) {
    companyStatuses[c.status] = (companyStatuses[c.status] ?? 0) + 1;
  }

  const emailStatuses: Record<string, number> = {};
  for (const e of emailStatusRows.data ?? []) {
    emailStatuses[e.status] = (emailStatuses[e.status] ?? 0) + 1;
  }

  const eventTypes: Record<string, number> = {};
  for (const l of pipelineRows.data ?? []) {
    eventTypes[l.event_type] = (eventTypes[l.event_type] ?? 0) + 1;
  }

  return NextResponse.json({
    companies: { total: companiesTotal.count ?? 0, byStatus: companyStatuses },
    contacts: { total: contactsTotal.count ?? 0 },
    emails: { total: emailsTotal.count ?? 0, byStatus: emailStatuses },
    verticals: verticals.data ?? [],
    events: eventTypes,
  });
}
