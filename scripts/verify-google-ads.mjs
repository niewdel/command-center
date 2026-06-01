#!/usr/bin/env node
// One-shot sanity check for the Google Ads API connection. Runs through:
//   1. Env vars present (developer token, MCC ID, OAuth client)
//   2. A google_oauth_connections row exists with the adwords scope
//   3. Refresh the access token successfully
//   4. Pull a list of accessible customers
//   5. For each SEO client with seo_config.google_ads.customer_id set, run a
//      30-day campaign GAQL against v20 and report the verdict
//
// Usage: node scripts/verify-google-ads.mjs
// Reads from .env.local. Safe to run repeatedly — no writes.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const ENV_PATH = path.join(ROOT, ".env.local");

// Tiny .env loader so we don't pull in dotenv.
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

const {
  GOOGLE_ADS_DEVELOPER_TOKEN,
  GOOGLE_ADS_LOGIN_CUSTOMER_ID,
  GOOGLE_OAUTH_CLIENT_ID,
  GOOGLE_OAUTH_CLIENT_SECRET,
  NEXT_PUBLIC_SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY,
} = process.env;

function required(name, val) {
  if (!val) {
    console.error(`  MISSING  ${name}`);
    process.exit(1);
  }
  return val.trim();
}

console.log("Google Ads API verification");
console.log("===========================\n");

console.log("Step 1. Env vars");
const devToken = required("GOOGLE_ADS_DEVELOPER_TOKEN", GOOGLE_ADS_DEVELOPER_TOKEN);
const loginCid = required("GOOGLE_ADS_LOGIN_CUSTOMER_ID", GOOGLE_ADS_LOGIN_CUSTOMER_ID);
required("GOOGLE_OAUTH_CLIENT_ID", GOOGLE_OAUTH_CLIENT_ID);
required("GOOGLE_OAUTH_CLIENT_SECRET", GOOGLE_OAUTH_CLIENT_SECRET);
required("NEXT_PUBLIC_SUPABASE_URL", NEXT_PUBLIC_SUPABASE_URL);
required("SUPABASE_SERVICE_ROLE_KEY", SUPABASE_SERVICE_ROLE_KEY);
console.log(`  developer token  ${devToken.slice(0, 4)}…${devToken.slice(-4)} (${devToken.length} chars)`);
console.log(`  MCC login cid    ${loginCid}`);
console.log(`  oauth client id  set`);
console.log(`  supabase service set\n`);

// ── Supabase: find the Google connection ────────────────────────────────────
console.log("Step 2. Locate Google connection (adwords scope)");
async function sb(table, query = "") {
  const url = `${NEXT_PUBLIC_SUPABASE_URL}/rest/v1/${table}${query}`;
  const res = await fetch(url, {
    headers: {
      apikey: SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
    },
  });
  if (!res.ok) {
    throw new Error(`Supabase ${table} ${res.status}: ${await res.text()}`);
  }
  return res.json();
}

const conns = await sb(
  "google_oauth_connections",
  "?select=user_id,google_email,scopes,refresh_token,expires_at"
);
if (!conns.length) {
  console.error("  FAIL: no google_oauth_connections rows found");
  process.exit(1);
}
const withAdwords = conns.filter((c) => (c.scopes ?? []).includes("https://www.googleapis.com/auth/adwords"));
if (!withAdwords.length) {
  console.error("  FAIL: no connection has the 'adwords' scope. Operator needs to reconnect Google.");
  for (const c of conns) console.error(`         ${c.google_email}  scopes=${(c.scopes ?? []).length}`);
  process.exit(1);
}
const conn = withAdwords[0];
console.log(`  user_id          ${conn.user_id}`);
console.log(`  google_email     ${conn.google_email}`);
console.log(`  scope present    yes\n`);

// ── Refresh the access token ────────────────────────────────────────────────
console.log("Step 3. Refresh access token");
const tokRes = await fetch("https://oauth2.googleapis.com/token", {
  method: "POST",
  headers: { "Content-Type": "application/x-www-form-urlencoded" },
  body: new URLSearchParams({
    client_id: GOOGLE_OAUTH_CLIENT_ID,
    client_secret: GOOGLE_OAUTH_CLIENT_SECRET,
    refresh_token: conn.refresh_token,
    grant_type: "refresh_token",
  }),
});
if (!tokRes.ok) {
  console.error(`  FAIL: token refresh ${tokRes.status}: ${await tokRes.text()}`);
  process.exit(1);
}
const tok = await tokRes.json();
console.log(`  expires_in       ${tok.expires_in}s`);
console.log(`  scope on token   ${tok.scope.includes("adwords") ? "includes adwords" : "MISSING adwords"}\n`);

// ── List accessible Google Ads customers ───────────────────────────────────
console.log("Step 4. listAccessibleCustomers (sanity: token + dev token both work)");
const lacRes = await fetch("https://googleads.googleapis.com/v20/customers:listAccessibleCustomers", {
  headers: {
    Authorization: `Bearer ${tok.access_token}`,
    "developer-token": devToken,
  },
});
if (!lacRes.ok) {
  const body = await lacRes.text();
  console.error(`  FAIL ${lacRes.status}: ${body.slice(0, 600)}`);
  if (body.includes("DEVELOPER_TOKEN_NOT_APPROVED")) {
    console.error("  → developer token is still in test mode. Check MCC > Admin > API Center.");
  }
  process.exit(1);
}
const lac = await lacRes.json();
const resourceNames = lac.resourceNames ?? [];
console.log(`  accessible cids  ${resourceNames.length}`);
for (const rn of resourceNames.slice(0, 10)) console.log(`                    ${rn}`);
if (resourceNames.length > 10) console.log(`                    … and ${resourceNames.length - 10} more`);
console.log();

// ── Find SEO clients with google_ads configured ────────────────────────────
console.log("Step 5. SEO clients with seo_config.google_ads.customer_id set");
const clients = await sb(
  "clients",
  "?select=id,name,seo_config&seo_config->google_ads->>customer_id=not.is.null"
);
console.log(`  configured       ${clients.length} client(s)`);
if (!clients.length) {
  console.log("  (no SEO clients have google_ads.customer_id yet — wire one up to test deeper)");
  console.log("\nAll preflight checks passed.");
  process.exit(0);
}

// ── For each configured client, run a real 30-day GAQL ─────────────────────
console.log("\nStep 6. Live GAQL per configured client (last 30 days)");
const now = new Date();
const end = now.toISOString().slice(0, 10);
const start = new Date(now.getTime() - 30 * 86400000).toISOString().slice(0, 10);

let allOk = true;
for (const c of clients) {
  const ga = c.seo_config?.google_ads;
  const cid = (ga?.customer_id || "").replace(/-/g, "");
  if (!cid) continue;
  const enabled = ga?.enabled !== false;
  process.stdout.write(`  ${c.name.padEnd(30)} cid=${cid}  enabled=${enabled ? "yes" : "no "}  → `);

  try {
    const res = await fetch(
      `https://googleads.googleapis.com/v20/customers/${cid}/googleAds:search`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${tok.access_token}`,
          "developer-token": devToken,
          "login-customer-id": loginCid,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          query: `SELECT campaign.name, metrics.clicks, metrics.cost_micros FROM campaign WHERE segments.date BETWEEN '${start}' AND '${end}'`,
        }),
      }
    );
    if (!res.ok) {
      allOk = false;
      const body = await res.text();
      let verdict = `FAIL ${res.status}`;
      if (body.includes("DEVELOPER_TOKEN_NOT_APPROVED")) verdict = "PENDING (dev token in test mode)";
      else if (body.includes("USER_PERMISSION_DENIED")) verdict = "PENDING (token not approved OR sub-account not linked to MCC)";
      else if (body.includes("CUSTOMER_NOT_FOUND")) verdict = "CUSTOMER_NOT_FOUND (cid wrong)";
      else if (body.includes("invalid_scope") || res.status === 401) verdict = "RECONNECT NEEDED (missing adwords scope)";
      console.log(verdict);
      console.log(`    body: ${body.slice(0, 1500).replace(/\s+/g, " ")}`);
      continue;
    }
    const data = await res.json();
    const rows = data.results ?? [];
    let cost = 0;
    let clicks = 0;
    const names = new Set();
    for (const r of rows) {
      cost += Number(r.metrics?.costMicros ?? 0) / 1_000_000;
      clicks += Number(r.metrics?.clicks ?? 0);
      if (r.campaign?.name) names.add(r.campaign.name);
    }
    console.log(
      `OK  ${rows.length} rows, ${names.size} campaign(s), $${cost.toFixed(2)} spend, ${clicks} clicks`
    );
  } catch (err) {
    allOk = false;
    console.log(`ERROR ${err.message ?? err}`);
  }
}

console.log();
if (allOk) {
  console.log("Verdict: Google Ads API is fully wired up. Basic Access approval is live.");
  process.exit(0);
} else {
  console.log("Verdict: at least one client failed. See per-client output above.");
  process.exit(1);
}
