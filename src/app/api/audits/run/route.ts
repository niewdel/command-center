import { NextRequest, NextResponse } from "next/server";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { requireAgencyAdmin } from "@/lib/tenancy";
import { runAudit } from "@/lib/audit/runner";

// Audits launch Playwright + PSI; on Railway the start-to-finish run takes
// 20–60s. Using the same fire-and-forget pattern as /api/leads/jobs so the
// HTTP request returns immediately and the pipeline updates the audits row
// in the background. The UI subscribes via Supabase realtime.

export const maxDuration = 300;
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

function normalizeUrl(raw: string): string | null {
  let url = raw.trim();
  if (!url) return null;
  if (!url.startsWith("http://") && !url.startsWith("https://")) {
    url = `https://${url}`;
  }
  try {
    new URL(url);
    return url;
  } catch {
    return null;
  }
}

function clampMaxPages(n: unknown): number {
  const parsed = typeof n === "number" ? n : parseInt(String(n ?? "1"), 10);
  if (!Number.isFinite(parsed) || parsed < 1) return 1;
  return Math.min(parsed, 50);
}

export async function POST(req: NextRequest) {
  let body: { url?: string; maxPages?: number; mode?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const url = normalizeUrl(body.url ?? "");
  if (!url) {
    return NextResponse.json({ error: "Valid URL required" }, { status: 400 });
  }
  const mode = body.mode === "main" ? "main" : undefined;
  // "main" mode lets crawlSite/discoverMainPages decide the page cap; an
  // explicit numeric maxPages (10/25/50) always wins over "main".
  const maxPages = mode === "main" && body.maxPages === undefined ? undefined : clampMaxPages(body.maxPages);

  const admin = await requireAgencyAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const userId = admin.userId;

  const sb = getServiceClient();
  const { data: audit, error } = await sb
    .from("audits")
    .insert({
      user_id: userId,
      url,
      status: "pending",
      progress_pct: 0,
      current_stage: "Queued",
    })
    .select()
    .single();

  if (error || !audit) {
    return NextResponse.json(
      { error: `Failed to create audit: ${error?.message}` },
      { status: 500 }
    );
  }

  // Fire-and-forget: pipeline writes progress + result back to the audits row.
  setImmediate(() => {
    runAudit(audit.id, url, { maxPages, mode }).catch(async (err: unknown) => {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[audit ${audit.id}] failed:`, msg);
      try {
        await sb
          .from("audits")
          .update({
            status: "failed",
            error: msg,
            completed_at: new Date().toISOString(),
          })
          .eq("id", audit.id);
      } catch {
        // already logged above
      }
    });
  });

  return NextResponse.json({ id: audit.id });
}
