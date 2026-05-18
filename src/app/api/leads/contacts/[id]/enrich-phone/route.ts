import { NextRequest, NextResponse } from "next/server";
import { getServiceClient } from "@/lib/leads/db";
import { matchPerson } from "@/lib/leads/apollo";

export const dynamic = "force-dynamic";

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const sb = getServiceClient();

  const { data: contact, error } = await sb
    .from("contacts")
    .select("id, first_name, last_name, email, companies(domain)")
    .eq("id", id)
    .single();
  if (error || !contact) {
    return NextResponse.json({ error: "Contact not found" }, { status: 404 });
  }

  const company = contact.companies as unknown as { domain: string | null } | null;
  const domain = company?.domain;
  if (!domain) {
    return NextResponse.json({ error: "Contact has no company domain" }, { status: 400 });
  }

  try {
    const { phone } = await matchPerson({
      domain,
      first_name: contact.first_name,
      last_name: contact.last_name,
      email: contact.email,
    });

    if (!phone) {
      return NextResponse.json({ phone: null, found: false });
    }

    await sb.from("contacts").update({ phone }).eq("id", id);
    return NextResponse.json({ phone, found: true });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
