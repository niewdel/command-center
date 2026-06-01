// One-off smoke: run the monthly SEO report for a single client, route the
// email to the operator instead of the client. Uses the live Supabase data
// in .env.local and the production Resend key.
//
// Usage:
//   npx tsx scripts/smoke-monthly-report.mts <client_id> [recipient]
//
// Default recipient: niewdel@gmail.com. Safe to run repeatedly — the job is
// marked dry-run-equivalent by virtue of overrideEmail (no client email is
// sent regardless of seo_config.contact_email).

import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const ENV_PATH = path.join(ROOT, ".env.local");

function loadEnv() {
  const raw = readFileSync(ENV_PATH, "utf8");
  for (const line of raw.split("\n")) {
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq === -1) continue;
    const k = line.slice(0, eq).trim();
    let v = line.slice(eq + 1);
    v = v.replace(/^"(.*)"$/, "$1").replace(/^'(.*)'$/, "$1");
    if (!(k in process.env)) process.env[k] = v;
  }
}
loadEnv();

const clientId = process.argv[2];
const recipient = process.argv[3] ?? "niewdel@gmail.com";
if (!clientId) {
  console.error("Usage: tsx scripts/smoke-monthly-report.mts <client_id> [recipient]");
  process.exit(1);
}

console.log(`Smoke monthly report`);
console.log(`  client_id = ${clientId}`);
console.log(`  recipient = ${recipient}\n`);

const SUPA = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SVC = process.env.SUPABASE_SERVICE_ROLE_KEY!;

async function sb(method: string, table: string, body?: unknown, query = "") {
  const res = await fetch(`${SUPA}/rest/v1/${table}${query}`, {
    method,
    headers: {
      apikey: SVC,
      Authorization: `Bearer ${SVC}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error(`${method} ${table} ${res.status}: ${await res.text()}`);
  return res.json();
}

// 1. Lookup client + workspace
const clients = await sb("GET", "clients", undefined, `?id=eq.${clientId}&select=id,name,workspace_id,seo_config`);
const client = clients[0];
if (!client) {
  console.error(`Client not found: ${clientId}`);
  process.exit(1);
}
console.log(`  ${client.name} (workspace ${client.workspace_id})`);

// 2. Create a monthly_report job row
const [job] = await sb("POST", "seo_jobs", {
  workspace_id: client.workspace_id,
  client_id: client.id,
  type: "monthly_report",
  status: "queued",
});
console.log(`  job ${job.id}\n`);

// 3. Invoke runMonthlyReport with overrideEmail
process.env.APP_URL ??= "https://app.niewdel.com";
const { runMonthlyReport } = await import("../src/lib/seo/monthly-report.ts");
await runMonthlyReport(job.id, { overrideEmail: recipient });

// 4. Print final job state
const [final] = await sb("GET", "seo_jobs", undefined, `?id=eq.${job.id}&select=status,current_stage,metadata,error_message`);
console.log("\nFinal job state:");
console.log(JSON.stringify(final, null, 2));
