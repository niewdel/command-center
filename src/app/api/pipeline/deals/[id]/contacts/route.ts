import { NextRequest, NextResponse } from "next/server";
import { getPipelineClient, getDefaultPipelineWorkspaceId } from "@/lib/pipeline/db";

export const dynamic = "force-dynamic";

/**
 * POST /api/pipeline/deals/[id]/contacts
 * Body: { contact_id: string, role?: string, set_primary?: boolean }
 *
 * Attaches an existing CRM contact to the deal. If set_primary or the
 * deal currently has no primary contact, this contact becomes the
 * primary (mirrors to crm_deals.primary_contact_id).
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: dealId } = await params;
  const sb = getPipelineClient();
  const workspace_id = await getDefaultPipelineWorkspaceId();
  const body = await req.json();
  const contactId = body.contact_id as string | undefined;
  if (!contactId) return NextResponse.json({ error: "contact_id required" }, { status: 400 });

  // Make sure the deal is in this workspace.
  const { data: deal } = await sb
    .from("crm_deals")
    .select("id, primary_contact_id")
    .eq("workspace_id", workspace_id)
    .eq("id", dealId)
    .maybeSingle();
  if (!deal) return NextResponse.json({ error: "Deal not found" }, { status: 404 });

  const { error } = await sb
    .from("crm_deal_contacts")
    .upsert(
      { deal_id: dealId, contact_id: contactId, role: body.role ?? null },
      { onConflict: "deal_id,contact_id" }
    );
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Promote to primary if requested or if the deal has no primary yet.
  if (body.set_primary || !deal.primary_contact_id) {
    await sb.from("crm_deals").update({ primary_contact_id: contactId }).eq("id", dealId);
  }

  return NextResponse.json({ ok: true });
}
