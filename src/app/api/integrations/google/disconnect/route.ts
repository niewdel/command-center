import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { deleteConnection } from "@/lib/google/oauth";

export const dynamic = "force-dynamic";

export async function POST(_request: NextRequest) {
  const sb = await createClient();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  await deleteConnection(user.id);
  return NextResponse.json({ ok: true });
}
