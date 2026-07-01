// src/app/api/portal/[id]/upload/route.ts
//
// Public route (see middleware.ts — /api/portal/* is unauthenticated).
// SECURITY: this route is the only gate standing between the internet and
// a client's photo folder, so it re-verifies the view token itself on
// every request and derives the storage path exclusively from the
// server-verified `id` route param. It never trusts a client-supplied
// path/prefix.
//
// Accepts multipart/form-data: `file` (image), `token` (view token).

import { NextRequest, NextResponse } from "next/server";
import { verifyViewToken } from "@/lib/seo/report-print-token";
import { getServiceClient } from "@/lib/seo/db";
import {
  CLIENT_UPLOADS_BUCKET,
  buildUploadPath,
  validateUpload,
} from "@/lib/portal/uploads";

export const dynamic = "force-dynamic";

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params;

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json(
      { error: "Expected multipart/form-data." },
      { status: 400 }
    );
  }

  const token = formData.get("token");
  if (typeof token !== "string" || !verifyViewToken(id, token)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const file = formData.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No file provided." }, { status: 400 });
  }

  const validation = validateUpload({
    contentType: file.type,
    size: file.size,
  });
  if (!validation.ok) {
    return NextResponse.json({ error: validation.error }, { status: 400 });
  }

  // Path is always built from the verified `id`, never from client input.
  const path = buildUploadPath(id, file.name, file.type);

  const sb = getServiceClient();
  const buffer = await file.arrayBuffer();
  const { error } = await sb.storage
    .from(CLIENT_UPLOADS_BUCKET)
    .upload(path, buffer, {
      contentType: file.type,
      upsert: false,
    });

  if (error) {
    return NextResponse.json(
      { error: "Upload failed. Please try again." },
      { status: 500 }
    );
  }

  return NextResponse.json({
    path,
    name: file.name,
    size: file.size,
    contentType: file.type,
  });
}
