import { NextRequest, NextResponse } from "next/server";
import { getServiceClient } from "@/lib/leads/db";
import { requireAgencyAdmin } from "@/lib/tenancy";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  if (!(await requireAgencyAdmin())) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const sb = getServiceClient();
  const params = req.nextUrl.searchParams;
  const contactId = params.get("contact_id");
  const status = params.get("status");
  const page = parseInt(params.get("page") ?? "1");
  const limit = parseInt(params.get("limit") ?? "100");
  const offset = (page - 1) * limit;

  let query = sb
    .from("outreach_emails")
    .select(
      "id, step_number, subject, body_plain, status, sent_at, opened_at, replied_at, open_count, created_at, contacts(full_name, title, email, companies(name, domain))",
      { count: "exact" }
    )
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (contactId) query = query.eq("contact_id", contactId);
  if (status) query = query.eq("status", status);

  const { data, count, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ data, total: count ?? 0, page, limit });
}
