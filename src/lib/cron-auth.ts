// Shared authorization gate for cron endpoints.
//
// These routes are public (the middleware lets /api/cron/* through so the
// in-process scheduler can reach them over loopback), so they must verify
// CRON_SECRET themselves. Fail CLOSED: if the secret is unset, reject — the
// scheduler in instrumentation.ts already refuses to start without it, so a
// missing secret only ever means "not configured", never "allow everyone".

import type { NextRequest } from "next/server";
import { secureCompare } from "./secure-compare";

export function isAuthorizedCron(request: NextRequest): boolean {
  const cronSecret = process.env.CRON_SECRET?.trim();
  if (!cronSecret) return false;
  const headerSecret = (
    request.headers.get("x-cron-secret") ||
    request.headers.get("authorization")?.replace("Bearer ", "")
  )?.trim();
  return secureCompare(headerSecret, cronSecret);
}
