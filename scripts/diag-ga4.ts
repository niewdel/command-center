// One-shot GA4 diagnostic. Lists every property the connected Google
// account can see and queries lifetime sessions on each. Tells us
// whether configured property IDs match real-trafficked properties.
//
// Run with: npx tsx --env-file=.env.local scripts/diag-ga4.ts

import { createClient } from "@supabase/supabase-js";
import { listProperties } from "../src/lib/google/ga4";
import { getValidAccessToken } from "../src/lib/google/oauth";

const DATA_BASE = "https://analyticsdata.googleapis.com/v1beta";

async function lifetimeSessions(token: string, propertyId: string): Promise<{ sessions: number; users: number; error?: string }> {
  const res = await fetch(`${DATA_BASE}/properties/${propertyId}:runReport`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      // Broadest possible date range. GA4 supports up to ~14 months back
      // on standard properties; 400daysAgo covers anything plausible.
      dateRanges: [{ startDate: "400daysAgo", endDate: "today" }],
      metrics: [{ name: "sessions" }, { name: "totalUsers" }],
    }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    return { sessions: 0, users: 0, error: `${res.status}: ${text.slice(0, 120)}` };
  }
  const data = (await res.json()) as {
    rows?: Array<{ metricValues?: Array<{ value?: string }> }>;
  };
  const row = data.rows?.[0];
  return {
    sessions: Number(row?.metricValues?.[0]?.value ?? "0"),
    users: Number(row?.metricValues?.[1]?.value ?? "0"),
  };
}

(async () => {
  const sb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );

  const { data: conn } = await sb
    .from("google_oauth_connections")
    .select("user_id, google_email")
    .limit(1)
    .single();
  if (!conn) {
    console.error("No google_oauth_connections row.");
    process.exit(1);
  }
  console.log(`Connected as: ${conn.google_email}\n`);

  const props = await listProperties(conn.user_id);
  console.log(`${props.length} accessible GA4 properties:\n`);

  const token = await getValidAccessToken(conn.user_id);

  const { data: clients } = await sb
    .from("clients")
    .select("name, seo_config")
    .not("seo_config", "is", null);
  const configured = new Map<string, string>();
  for (const c of clients ?? []) {
    const pid = (c.seo_config as { ga4_property_id?: string } | null)?.ga4_property_id;
    if (pid) configured.set(pid, c.name as string);
  }

  for (const p of props) {
    const stats = await lifetimeSessions(token, p.property_id);
    const inUse = configured.get(p.property_id);
    const tag = inUse ? `← USED BY ${inUse}` : "";
    if (stats.error) {
      console.log(`  [${p.property_id}] ${p.account_name} / ${p.property_name}: ERROR ${stats.error} ${tag}`);
    } else {
      console.log(`  [${p.property_id}] ${p.account_name} / ${p.property_name}: ${stats.sessions.toLocaleString()} sessions, ${stats.users.toLocaleString()} users (lifetime) ${tag}`);
    }
  }

  console.log("\nConfigured property IDs:");
  for (const [pid, name] of configured) {
    const visible = props.find((p) => p.property_id === pid);
    if (!visible) {
      console.log(`  [${pid}] ${name} — NOT in accessible list (wrong account or no read access)`);
    }
  }
})();
