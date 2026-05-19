import { NextRequest, NextResponse } from "next/server";
import {
  extractDriveFileId,
  getDriveThumbnailUrl,
  fetchDriveFilename,
} from "@/lib/google/drive-preview";

export const dynamic = "force-dynamic";

/**
 * POST /api/integrations/google/drive/preview
 * Body: { url: string }
 *
 * Returns metadata for a Google Drive share link. Works without OAuth
 * because share-link files are public to anyone with the URL.
 */
export async function POST(req: NextRequest) {
  let body: { url?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const url = body.url?.trim();
  if (!url) return NextResponse.json({ error: "url is required" }, { status: 400 });

  const fileId = extractDriveFileId(url);
  if (!fileId) {
    return NextResponse.json({ is_drive: false });
  }

  const filename = await fetchDriveFilename(fileId);

  return NextResponse.json({
    is_drive: true,
    file_id: fileId,
    filename,
    thumbnail_url: getDriveThumbnailUrl(fileId),
    view_url: `https://drive.google.com/file/d/${fileId}/view`,
  });
}
