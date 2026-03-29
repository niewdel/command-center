import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { detectSource } from "@/lib/digest/extract";

// Manual ingest — add a link directly from the Command Center UI
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { url } = await request.json();
    if (!url) {
      return NextResponse.json({ error: "URL is required" }, { status: 400 });
    }

    const { source } = detectSource(url);
    if (source === "unknown") {
      return NextResponse.json(
        { error: "URL must be a YouTube or Instagram video link" },
        { status: 400 }
      );
    }

    // Check for duplicate
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

    // Queue the digest
    const { data: digest, error } = await supabase
      .from("content_digests")
      .insert({
        user_id: user.id,
        url,
        source,
        status: "queued",
      })
      .select("id")
      .single();

    if (error) throw error;

    // Trigger async processing
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
