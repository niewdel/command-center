import { NextRequest, NextResponse } from "next/server";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { requireAgencyAdmin } from "@/lib/tenancy";

// Supabase Storage's public CDN serves all our audit HTML files with
// content-type: text/plain + x-content-type-options: nosniff, which makes
// browsers render them as source code. This route fetches the bytes from
// storage with the service role and re-serves them as text/html so the
// report renders properly in the browser.

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
    .select("report_path")
    .eq("id", id)
    .single();

  if (error || !audit?.report_path) {
    return new Response("Report not found", { status: 404 });
  }

  const { data: blob, error: dlErr } = await sb.storage
    .from("audit-reports")
    .download(audit.report_path);

  if (dlErr || !blob) {
    return new Response(`Failed to load report: ${dlErr?.message}`, {
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
