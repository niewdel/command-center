// Client-safe constants shared between server-only tenancy helpers
// (src/lib/tenancy/index.ts, which imports next/headers) and client
// components (e.g. workspace-switcher.tsx) that need the cookie name
// without pulling in server-only code.
export const ACTIVE_WORKSPACE_COOKIE = "active_workspace";
