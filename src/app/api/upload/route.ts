import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const folder = (formData.get("folder") as string) || "workspace-logos";

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();

    // Ensure bucket exists
    const { data: buckets } = await supabase.storage.listBuckets();
    const bucketExists = buckets?.some((b) => b.id === "workspace-assets");
    if (!bucketExists) {
      await supabase.storage.createBucket("workspace-assets", { public: true });
    }

    const ext = file.name.split(".").pop() || "png";
    const path = `${folder}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

    const buffer = await file.arrayBuffer();

    const { error } = await supabase.storage
      .from("workspace-assets")
      .upload(path, buffer, {
        contentType: file.type,
        upsert: true,
      });

    if (error) {
      return NextResponse.json({ error: `Storage upload: ${error.message}` }, { status: 500 });
    }

    const { data } = supabase.storage.from("workspace-assets").getPublicUrl(path);

    return NextResponse.json({ url: data.publicUrl });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
