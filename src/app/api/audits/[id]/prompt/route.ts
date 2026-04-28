import { NextRequest } from "next/server";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { generateFixPlan } from "@/lib/audit/fix-plan";
import { generateClaudePrompt } from "@/lib/audit/claude-prompt";
import type { AuditResult } from "@/lib/audit/types";

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
  const { id } = await ctx.params;
  const sb = getServiceClient();

  const { data: audit, error } = await sb
    .from("audits")
    .select("result")
    .eq("id", id)
    .single();

  if (error || !audit?.result) {
    return new Response("Audit result not found", { status: 404 });
  }

  const fixPlan = generateFixPlan(audit.result as AuditResult);
  const prompt = generateClaudePrompt(fixPlan);

  return new Response(prompt, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "private, max-age=3600",
    },
  });
}
