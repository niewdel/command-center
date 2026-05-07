import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { detectSource } from "@/lib/digest/extract";
import { fetchLightMetadata } from "@/lib/digest/metadata";

function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

// Manual ingest — add a link directly from the Command Center UI
export async function POST(request: NextRequest) {
  try {
    const supabase = getSupabaseAdmin();
    const { data: users } = await supabase.auth.admin.listUsers();
    const userId = users?.users?.[0]?.id;

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { url, kind: rawKind } = await request.json();
    if (!url) {
      return NextResponse.json({ error: "URL is required" }, { status: 400 });
    }

    const kind: "digest" | "inspiration" = rawKind === "inspiration" ? "inspiration" : "digest";

    const { source } = detectSource(url);
    if (source === "unknown") {
      return NextResponse.json(
        { error: "URL must be a YouTube, Instagram, or TikTok video link" },
        { status: 400 }
      );
    }

    const { data: existing } = await supabase
      .from("content_digests")
      .select("id")
      .eq("url", url)
      .limit(1);

    if (existing && existing.length > 0) {
      return NextResponse.json(
        { error: "This URL has already been submitted", digestId: existing[0].id },
        { status: 409 }
      );
    }

    if (kind === "inspiration") {
      const meta = await fetchLightMetadata(url, source).catch(() => ({
        title: null,
        thumbnail_url: null,
      }));

      const { data: digest, error } = await supabase
        .from("content_digests")
        .insert({
          user_id: userId,
          url,
          source,
          kind: "inspiration",
          status: "completed",
          title: meta.title,
          thumbnail_url: meta.thumbnail_url,
          processed_at: new Date().toISOString(),
        })
        .select("id")
        .single();

      if (error) throw error;
      return NextResponse.json({ success: true, digestId: digest.id });
    }

    const { data: digest, error } = await supabase
      .from("content_digests")
      .insert({
        user_id: userId,
        url,
        source,
        kind: "digest",
        status: "queued",
      })
      .select("id")
      .single();

    if (error) throw error;

    const processUrl = `${process.env.NEXT_PUBLIC_APP_URL}/api/digest/process`;
    fetch(processUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.DIGEST_PROCESS_SECRET}`,
      },
      body: JSON.stringify({ digestId: digest.id }),
    }).catch((err) => console.error("Failed to trigger processing:", err));

    return NextResponse.json({ success: true, digestId: digest.id });
  } catch (error) {
    console.error("Ingest error:", error);
    return NextResponse.json(
      { error: "Failed to ingest URL" },
      { status: 500 }
    );
  }
}
