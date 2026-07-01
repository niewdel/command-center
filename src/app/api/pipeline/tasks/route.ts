import { NextRequest, NextResponse } from "next/server";
import { getPipelineClient, getDefaultPipelineWorkspaceId } from "@/lib/pipeline/db";
import { isTaskOverdue } from "@/lib/pipeline/tasks";
import type { CrmTask } from "@/types/pipeline";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const sb = getPipelineClient();
  const workspace_id = await getDefaultPipelineWorkspaceId();
  const { searchParams } = new URL(req.url);
  const doneParam = searchParams.get("done");
  const overdueParam = searchParams.get("overdue");
  const dealId = searchParams.get("deal_id");

  let query = sb.from("crm_tasks").select("*").eq("workspace_id", workspace_id);
  if (dealId) query = query.eq("deal_id", dealId);
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
  const sb = getPipelineClient();
  const workspace_id = await getDefaultPipelineWorkspaceId();
  const body = await req.json();

  const title = typeof body.title === "string" ? body.title.trim() : "";
  if (!title) {
    return NextResponse.json({ error: "title is required" }, { status: 400 });
  }

  // Confirm the linked deal (if any) belongs to this workspace before attaching.
  if (body.deal_id) {
    const { data: deal } = await sb
      .from("crm_deals")
      .select("id")
      .eq("workspace_id", workspace_id)
      .eq("id", body.deal_id)
      .maybeSingle();
    if (!deal) return NextResponse.json({ error: "Deal not found" }, { status: 404 });
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
