import { NextRequest, NextResponse } from "next/server";
import { getUserScopedClient, resolveActiveWorkspace } from "@/lib/tenancy";
import { isTaskOverdue } from "@/lib/pipeline/tasks";
import type { CrmTask } from "@/types/pipeline";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const ws = await resolveActiveWorkspace();
  if (!ws) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const sb = await getUserScopedClient();
  const workspace_id = ws.id;
  const { searchParams } = new URL(req.url);
  const doneParam = searchParams.get("done");
  const overdueParam = searchParams.get("overdue");
  const dealId = searchParams.get("deal_id");
  const companyId = searchParams.get("crm_company_id");
  const contactId = searchParams.get("contact_id");

  let query = sb.from("crm_tasks").select("*").eq("workspace_id", workspace_id);
  if (dealId) query = query.eq("deal_id", dealId);
  if (companyId) query = query.eq("crm_company_id", companyId);
  if (contactId) query = query.eq("contact_id", contactId);
  if (doneParam === "true") query = query.eq("done", true);
  if (doneParam === "false") query = query.eq("done", false);
  query = query.order("due_date", { ascending: true });

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  let tasks = (data ?? []) as CrmTask[];
  if (overdueParam === "true") {
    tasks = tasks.filter((t) => isTaskOverdue(t));
  }

  return NextResponse.json({ data: tasks });
}

export async function POST(req: NextRequest) {
  const ws = await resolveActiveWorkspace();
  if (!ws) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const sb = await getUserScopedClient();
  const workspace_id = ws.id;
  const body = await req.json();

  const title = typeof body.title === "string" ? body.title.trim() : "";
  if (!title) {
    return NextResponse.json({ error: "title is required" }, { status: 400 });
  }

  // Confirm any linked deal/company/contact belongs to this workspace before attaching.
  if (body.deal_id) {
    const { data: deal } = await sb
      .from("crm_deals")
      .select("id")
      .eq("workspace_id", workspace_id)
      .eq("id", body.deal_id)
      .maybeSingle();
    if (!deal) return NextResponse.json({ error: "Deal not found" }, { status: 404 });
  }
  if (body.crm_company_id) {
    const { data: company } = await sb
      .from("crm_companies")
      .select("id")
      .eq("workspace_id", workspace_id)
      .eq("id", body.crm_company_id)
      .maybeSingle();
    if (!company) return NextResponse.json({ error: "Company not found" }, { status: 404 });
  }
  if (body.contact_id) {
    const { data: contact } = await sb
      .from("crm_contacts")
      .select("id")
      .eq("workspace_id", workspace_id)
      .eq("id", body.contact_id)
      .maybeSingle();
    if (!contact) return NextResponse.json({ error: "Contact not found" }, { status: 404 });
  }

  const { data, error } = await sb
    .from("crm_tasks")
    .insert({
      workspace_id,
      deal_id: body.deal_id ?? null,
      crm_company_id: body.crm_company_id ?? null,
      contact_id: body.contact_id ?? null,
      title,
      due_date: body.due_date ?? null,
      done: false,
    })
    .select("*")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data });
}
