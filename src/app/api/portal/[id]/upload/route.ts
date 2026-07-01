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
  MAX_FILES_PER_CLIENT,
  buildUploadPath,
  exceedsContentLength,
  isOverFileCap,
  sniffImageType,
  validateUpload,
} from "@/lib/portal/uploads";

export const dynamic = "force-dynamic";

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params;

  // Reject oversized uploads BEFORE ever calling req.formData(), which
  // buffers the whole body into memory. Content-Length can be spoofed or
  // absent, so this is a fast-path guard, not a substitute for the
  // post-parse validateUpload size check below.
  if (exceedsContentLength(req.headers.get("content-length"))) {
    return NextResponse.json({ error: "File too large" }, { status: 413 });
  }

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

  const sb = getServiceClient();

  // Per-client file cap — stops a forwarded/leaked portal link from filling
  // storage. Listed AFTER token verification so an unauthenticated caller
  // never gets to trigger a storage list() call.
  const { data: existing, error: listError } = await sb.storage
    .from(CLIENT_UPLOADS_BUCKET)
    .list(id, { limit: MAX_FILES_PER_CLIENT + 1 });
  if (listError) {
    return NextResponse.json(
      { error: "Upload failed. Please try again." },
      { status: 500 }
    );
  }
  if (isOverFileCap(existing?.length ?? 0)) {
    return NextResponse.json(
      { error: "Upload limit reached for this client." },
      { status: 429 }
    );
  }

  // Verify the actual file bytes against magic-byte signatures — the
  // client-declared `file.type` is never trusted for storage. Rejects
  // non-image bytes masquerading as an allowed image content type.
  const buffer = await file.arrayBuffer();
  const sniffedType = sniffImageType(new Uint8Array(buffer));
  if (!sniffedType) {
    return NextResponse.json(
      { error: "Unsupported file content" },
      { status: 415 }
    );
  }

  // Path is always built from the verified `id`, never from client input.
  const path = buildUploadPath(id, file.name, sniffedType);

  const { error } = await sb.storage
    .from(CLIENT_UPLOADS_BUCKET)
    .upload(path, buffer, {
      contentType: sniffedType,
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
    contentType: sniffedType,
  });
}
