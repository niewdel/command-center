import { NextRequest, NextResponse } from "next/server";
import { getPipelineClient, getDefaultPipelineWorkspaceId } from "@/lib/pipeline/db";

export const dynamic = "force-dynamic";

/**
 * DELETE /api/pipeline/deals/[id]/contacts/[contactId]
 * Removes a contact from a deal. If the removed contact was the primary,
 * we pick the next attached contact (oldest) as the new primary, else
 * null out primary_contact_id.
 */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; contactId: string }> }
) {
  const { id: dealId, contactId } = await params;
  const sb = getPipelineClient();
  const workspace_id = await getDefaultPipelineWorkspaceId();

  const { data: deal } = await sb
    .from("crm_deals")
    .select("id, primary_contact_id")
    .eq("workspace_id", workspace_id)
    .eq("id", dealId)
    .maybeSingle();
  if (!deal) return NextResponse.json({ error: "Deal not found" }, { status: 404 });

  const { error } = await sb
    .from("crm_deal_contacts")
    .delete()
    .eq("deal_id", dealId)
    .eq("contact_id", contactId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // If we just removed the primary, fall back to the next remaining contact
  // (oldest by created_at), or null.
  if (deal.primary_contact_id === contactId) {
    const { data: next } = await sb
      .from("crm_deal_contacts")
      .select("contact_id")
      .eq("deal_id", dealId)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    await sb
      .from("crm_deals")
      .update({ primary_contact_id: next?.contact_id ?? null })
      .eq("id", dealId);
  }

  return NextResponse.json({ ok: true });
}

/**
 * PATCH /api/pipeline/deals/[id]/contacts/[contactId]
 * Body: { role?: string, set_primary?: boolean }
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; contactId: string }> }
) {
  const { id: dealId, contactId } = await params;
  const sb = getPipelineClient();
  const workspace_id = await getDefaultPipelineWorkspaceId();
  const body = await req.json();

  const { data: deal } = await sb
    .from("crm_deals")
    .select("id")
    .eq("workspace_id", workspace_id)
    .eq("id", dealId)
    .maybeSingle();
  if (!deal) return NextResponse.json({ error: "Deal not found" }, { status: 404 });

  if ("role" in body) {
    const { error } = await sb
      .from("crm_deal_contacts")
      .update({ role: body.role })
      .eq("deal_id", dealId)
      .eq("contact_id", contactId);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (body.set_primary) {
    await sb.from("crm_deals").update({ primary_contact_id: contactId }).eq("id", dealId);
  }

  return NextResponse.json({ ok: true });
}
