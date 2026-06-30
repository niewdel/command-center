#!/usr/bin/env node
// Narrow probe: is the dev token approved, or is Franky's sub-account not
// linked under the MCC? Three calls, same query:
//   A. Query MCC itself, login-customer-id = MCC      (proves token + MCC access)
//   B. Query Franky's,  login-customer-id = MCC       (proves MCC->Franky link)
//   C. Query Franky's,  NO login-customer-id header   (proves direct user access)

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
for (const line of readFileSync(path.join(ROOT, ".env.local"), "utf8").split("\n")) {
  const eq = line.indexOf("=");
  if (eq < 0 || line.startsWith("#")) continue;
  const k = line.slice(0, eq).trim();
  let v = line.slice(eq + 1).replace(/^"(.*)"$/, "$1");
  if (!(k in process.env)) process.env[k] = v;
}

const API_VERSION = process.env.GOOGLE_ADS_API_VERSION?.trim() || "v24";
const MCC = process.env.GOOGLE_ADS_LOGIN_CUSTOMER_ID.trim();
const FRANKY = "6974976770";
const DEV = process.env.GOOGLE_ADS_DEVELOPER_TOKEN.trim();

// Get an access token via refresh.
async function sbFetch(table, qs = "") {
  const res = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/${table}${qs}`, {
    headers: {
      apikey: process.env.SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
    },
  });
  return res.json();
}
const conns = await sbFetch("google_oauth_connections", "?select=refresh_token,scopes");
const conn = conns.find((c) => (c.scopes ?? []).includes("https://www.googleapis.com/auth/adwords"));
const tokRes = await fetch("https://oauth2.googleapis.com/token", {
  method: "POST",
  headers: { "Content-Type": "application/x-www-form-urlencoded" },
  body: new URLSearchParams({
    client_id: process.env.GOOGLE_OAUTH_CLIENT_ID,
    client_secret: process.env.GOOGLE_OAUTH_CLIENT_SECRET,
    refresh_token: conn.refresh_token,
    grant_type: "refresh_token",
  }),
});
const tok = await tokRes.json();
const AT = tok.access_token;

const Q = "SELECT customer.id, customer.descriptive_name FROM customer LIMIT 1";

async function probe(label, cid, useLoginHeader) {
  const headers = {
    Authorization: `Bearer ${AT}`,
    "developer-token": DEV,
    "Content-Type": "application/json",
  };
  if (useLoginHeader) headers["login-customer-id"] = MCC;
  const res = await fetch(
    `https://googleads.googleapis.com/${API_VERSION}/customers/${cid}/googleAds:search`,
    { method: "POST", headers, body: JSON.stringify({ query: Q }) }
  );
  const body = await res.text();
  let summary = res.ok ? "OK" : `${res.status}`;
  if (!res.ok) {
    if (body.includes("DEVELOPER_TOKEN_NOT_APPROVED")) summary += " DEVELOPER_TOKEN_NOT_APPROVED";
    else if (body.includes("USER_PERMISSION_DENIED")) summary += " USER_PERMISSION_DENIED";
    else if (body.includes("CUSTOMER_NOT_ENABLED")) summary += " CUSTOMER_NOT_ENABLED";
    else if (body.includes("CUSTOMER_NOT_FOUND")) summary += " CUSTOMER_NOT_FOUND";
  } else {
    try {
      const j = JSON.parse(body);
      const r = j.results?.[0];
      if (r) summary += `  → customer.id=${r.customer.id} name="${r.customer.descriptiveName}"`;
    } catch {}
  }
  console.log(`  ${label.padEnd(48)} ${summary}`);
  if (!res.ok) console.log(`    body: ${body.replace(/\s+/g, " ").slice(0, 300)}`);
}

console.log("Google Ads probe matrix\n");
await probe(`A. query MCC ${MCC}, login=${MCC}`, MCC, true);
await probe(`B. query FRANKY ${FRANKY}, login=${MCC}`, FRANKY, true);
await probe(`C. query FRANKY ${FRANKY}, login=(none)`, FRANKY, false);
