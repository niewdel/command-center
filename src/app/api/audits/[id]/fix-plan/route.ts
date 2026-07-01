import { NextRequest, NextResponse } from "next/server";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { requireAgencyAdmin } from "@/lib/tenancy";

export const dynamic = "force-dynamic";

let serviceClient: SupabaseClient | null = null;
function getServiceClient(): SupabaseClient {
  if (!serviceClient) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) throw new Error("Missing Supabase env vars");
    serviceClient = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return serviceClient;
}

export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  if (!(await requireAgencyAdmin())) {
    return new NextResponse("Forbidden", { status: 403 });
  }

  const { id } = await ctx.params;
  const sb = getServiceClient();

  const { data: audit, error } = await sb
    .from("audits")
    .select("fix_plan_path")
    .eq("id", id)
    .single();

  if (error || !audit?.fix_plan_path) {
    return new Response("Fix plan not found", { status: 404 });
  }

  const { data: blob, error: dlErr } = await sb.storage
    .from("audit-reports")
    .download(audit.fix_plan_path);

  if (dlErr || !blob) {
    return new Response(`Failed to load fix plan: ${dlErr?.message}`, {
      status: 500,
    });
  }

  return new Response(blob, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "private, max-age=3600",
    },
  });
}
