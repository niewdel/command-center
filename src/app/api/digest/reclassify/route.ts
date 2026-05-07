import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { fetchLightMetadata } from "@/lib/digest/metadata";

function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

// Flip a digest between 'digest' and 'inspiration'.
// Promote (inspiration → digest): triggers /api/digest/process if not already completed as digest.
// Demote (digest → inspiration): clears guide/transcript and marks completed.
export async function POST(request: NextRequest) {
  const supabase = getSupabaseAdmin();
  const { digestId, kind } = await request.json();

  if (!digestId || (kind !== "digest" && kind !== "inspiration")) {
    return NextResponse.json({ error: "digestId and kind ('digest'|'inspiration') required" }, { status: 400 });
  }

  const { data: digest, error: fetchErr } = await supabase
    .from("content_digests")
    .select("*")
    .eq("id", digestId)
    .single();

  if (fetchErr || !digest) {
    return NextResponse.json({ error: "Digest not found" }, { status: 404 });
  }

  if (kind === "inspiration") {
    const meta = digest.thumbnail_url
      ? { title: digest.title, thumbnail_url: digest.thumbnail_url }
      : await fetchLightMetadata(digest.url, digest.source).catch(() => ({
          title: digest.title,
          thumbnail_url: null,
        }));

    await supabase
      .from("content_digests")
      .update({
        kind: "inspiration",
        status: "completed",
        guide: null,
        transcript: null,
        tags: [],
        error_message: null,
        title: meta.title || digest.title,
        thumbnail_url: meta.thumbnail_url || digest.thumbnail_url,
        processed_at: digest.processed_at || new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", digestId);

    return NextResponse.json({ success: true });
  }

  // kind === "digest" — promote
  await supabase
    .from("content_digests")
    .update({
      kind: "digest",
      status: "queued",
      error_message: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", digestId);

  const appUrl = process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL;
  if (appUrl) {
    fetch(`${appUrl}/api/digest/process`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.DIGEST_PROCESS_SECRET}`,
      },
      body: JSON.stringify({ digestId }),
    }).catch((err) => console.error("Failed to trigger processing:", err));
  }

  return NextResponse.json({ success: true });
}
