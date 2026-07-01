// Constant-time secret comparison.
//
// node:crypto's timingSafeEqual throws when the two buffers differ in length,
// and that length check itself leaks information. Hashing both sides to a
// fixed-width SHA-256 digest first means the comparison is always over equal
// lengths and reveals nothing about the secret's length or contents.
//
// Use this for every shared-secret / bearer-token / webhook-secret check
// instead of `a === b` / `a !== b`.

import { createHash, timingSafeEqual } from "node:crypto";

export function secureCompare(a: string | null | undefined, b: string | null | undefined): boolean {
  // A missing/empty expected secret must never authenticate anything.
  if (!a || !b) return false;
  const ha = createHash("sha256").update(a).digest();
  const hb = createHash("sha256").update(b).digest();
  return timingSafeEqual(ha, hb);
}
