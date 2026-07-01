// src/app/api/portal/[id]/photos/route.ts
//
// Public route (see middleware.ts — /api/portal/* is unauthenticated).
// SECURITY: verifies the view token before touching storage, then lists
// ONLY `client-uploads/${id}/` — the server-verified id, never a
// client-supplied prefix — and returns short-TTL signed URLs scoped to
// that folder.

import { NextRequest, NextResponse } from "next/server";
import { verifyViewToken } from "@/lib/seo/report-print-token";
import { getServiceClient } from "@/lib/seo/db";
import { CLIENT_UPLOADS_BUCKET, pathBelongsToClient } from "@/lib/portal/uploads";

export const dynamic = "force-dynamic";

const SIGNED_URL_TTL_SECONDS = 60 * 10; // 10 minutes

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params;
  const token = req.nextUrl.searchParams.get("token") ?? "";

  if (!verifyViewToken(id, token)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const sb = getServiceClient();
  const { data: files, error } = await sb.storage
    .from(CLIENT_UPLOADS_BUCKET)
    .list(id, { sortBy: { column: "created_at", order: "desc" } });

  if (error) {
    return NextResponse.json(
      { error: "Failed to load photos." },
      { status: 500 }
    );
  }

  const entries = (files ?? []).filter(
    (f) => f.id !== null && f.name && !f.name.endsWith("/")
  );

  const photos = await Promise.all(
    entries.map(async (f) => {
      const path = `${id}/${f.name}`;
      if (!pathBelongsToClient(path, id)) return null;
      const { data: signed } = await sb.storage
        .from(CLIENT_UPLOADS_BUCKET)
        .createSignedUrl(path, SIGNED_URL_TTL_SECONDS);
      if (!signed?.signedUrl) return null;
      return {
        name: f.name,
        path,
        url: signed.signedUrl,
        createdAt: f.created_at ?? null,
        size: f.metadata?.size ?? null,
      };
    })
  );

  return NextResponse.json({ photos: photos.filter((p) => p !== null) });
}
