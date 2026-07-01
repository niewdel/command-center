// src/lib/portal/uploads.ts
//
// Pure, testable validation + path-building logic for the Customer
// Portal's photo uploads (client-uploads storage bucket). Kept free of
// Next.js / Supabase runtime dependencies so it's cheap to unit test.
//
// SECURITY: buildUploadPath always derives the storage prefix from the
// server-verified clientId — callers must never accept a client-supplied
// path/prefix. sanitizeFilename strips anything that could be used to
// escape that prefix (path separators, leading dots).

export const CLIENT_UPLOADS_BUCKET = "client-uploads";

export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024; // 10MB

export const ALLOWED_IMAGE_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
  "image/gif",
]);

const EXT_BY_TYPE: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/heic": "heic",
  "image/heif": "heif",
  "image/gif": "gif",
};

export function isAllowedImageType(contentType: string): boolean {
  return ALLOWED_IMAGE_TYPES.has(contentType.toLowerCase());
}

export interface UploadValidationInput {
  contentType: string;
  size: number;
}

export type UploadValidationResult =
  | { ok: true }
  | { ok: false; error: string };

export function validateUpload(
  input: UploadValidationInput
): UploadValidationResult {
  if (!input.contentType || !isAllowedImageType(input.contentType)) {
    return {
      ok: false,
      error:
        "Unsupported file type. Please upload a JPEG, PNG, WEBP, HEIC, or GIF image.",
    };
  }
  if (!Number.isFinite(input.size) || input.size <= 0) {
    return { ok: false, error: "Empty file." };
  }
  if (input.size > MAX_UPLOAD_BYTES) {
    return { ok: false, error: "File is too large. Max size is 10MB." };
  }
  return { ok: true };
}

// Strips path separators, null bytes, and leading dots so a filename can
// never be used to climb out of the client's storage prefix. Falls back
// to a generic name if nothing sane is left.
export function sanitizeFilename(name: string): string {
  const base = name
    .replace(/\\/g, "/")
    .split("/")
    .pop() ?? "";
  const cleaned = base
    .replace(/\0/g, "")
    .replace(/[^a-zA-Z0-9._-]/g, "-")
    .replace(/^\.+/, "")
    .replace(/-+/g, "-")
    .slice(0, 120);
  return cleaned || "photo";
}

// Builds the storage object path for an upload. `clientId` MUST come from
// a route param already authenticated via verifyViewToken — never from
// client-supplied input — so every upload can only ever land under that
// client's own folder.
export function buildUploadPath(
  clientId: string,
  filename: string,
  contentType: string,
  timestamp: number = Date.now()
): string {
  const safeName = sanitizeFilename(filename);
  const hasExt = /\.[a-zA-Z0-9]+$/.test(safeName);
  const ext = EXT_BY_TYPE[contentType.toLowerCase()];
  const finalName = hasExt || !ext ? safeName : `${safeName}.${ext}`;
  return `${clientId}/${timestamp}-${finalName}`;
}

// Storage list() returns entries scoped to the prefix we query, but this
// helper double-checks a path truly belongs to the given clientId before
// we ever hand back a signed URL for it — belt and suspenders against a
// future refactor that queries a wider prefix by mistake.
export function pathBelongsToClient(path: string, clientId: string): boolean {
  return path === clientId || path.startsWith(`${clientId}/`);
}
