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

// Per-client cap on the number of objects allowed under
// `client-uploads/${clientId}/`. Stops a forwarded/leaked portal link from
// filling storage indefinitely — enforced in the upload route BEFORE we
// buffer/store a new file.
export const MAX_FILES_PER_CLIENT = 100;

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

// Returns true when a client is already at/over MAX_FILES_PER_CLIENT and
// should be blocked from uploading more. Pure so it's trivially testable —
// the route supplies the current count from a storage `list()` call.
export function isOverFileCap(currentFileCount: number): boolean {
  return currentFileCount >= MAX_FILES_PER_CLIENT;
}

// Checks a client-declared Content-Length header against the max allowed
// upload size BEFORE the request body is parsed/buffered. Returns true when
// the request should be rejected outright. A missing/unparseable header is
// NOT rejected here — it falls through to the post-parse validateUpload
// check, since Content-Length can be absent or spoofed either way.
export function exceedsContentLength(
  contentLengthHeader: string | null
): boolean {
  if (!contentLengthHeader) return false;
  const declared = Number(contentLengthHeader);
  if (!Number.isFinite(declared) || declared <= 0) return false;
  return declared > MAX_UPLOAD_BYTES;
}

// Magic-byte signatures for the image types we accept. Multipart form
// fields for `file.type`/`contentType` are entirely client-declared, so we
// verify the actual bytes before trusting/storing them as an image.
const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47];
const JPEG_SIGNATURE = [0xff, 0xd8, 0xff];
const GIF_SIGNATURE = [0x47, 0x49, 0x46, 0x38]; // "GIF8"

function matchesSignature(bytes: Uint8Array, signature: number[]): boolean {
  if (bytes.length < signature.length) return false;
  for (let i = 0; i < signature.length; i++) {
    if (bytes[i] !== signature[i]) return false;
  }
  return true;
}

function isWebp(bytes: Uint8Array): boolean {
  // RIFF....WEBP: bytes 0-3 "RIFF", bytes 8-11 "WEBP".
  if (bytes.length < 12) return false;
  const riff = [0x52, 0x49, 0x46, 0x46]; // "RIFF"
  const webp = [0x57, 0x45, 0x42, 0x50]; // "WEBP"
  for (let i = 0; i < 4; i++) {
    if (bytes[i] !== riff[i]) return false;
  }
  for (let i = 0; i < 4; i++) {
    if (bytes[8 + i] !== webp[i]) return false;
  }
  return true;
}

// Sniffs the true image type from magic bytes, ignoring any client-declared
// content type. Returns the canonical mime type string for a recognized
// image format, or null if the bytes don't match any allowed signature.
export function sniffImageType(bytes: Uint8Array): string | null {
  if (matchesSignature(bytes, PNG_SIGNATURE)) return "image/png";
  if (matchesSignature(bytes, JPEG_SIGNATURE)) return "image/jpeg";
  if (matchesSignature(bytes, GIF_SIGNATURE)) return "image/gif";
  if (isWebp(bytes)) return "image/webp";
  return null;
}
