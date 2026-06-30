#!/usr/bin/env node
// Read-only diagnostic: what conversion/attribution data exists for a client
// in GA4 + Google Ads. Pulls GA4 key events, top events, channel breakdown,
// and Google Ads conversion actions + call metrics. No writes.
//
// Usage: node scripts/probe-attribution.mjs

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
for (const line of readFileSync(path.join(ROOT, ".env.local"), "utf8").split("\n")) {
  if (!line || line.startsWith("#")) continue;
  const eq = line.indexOf("="); if (eq === -1) continue;
  const k = line.slice(0, eq).trim();
  let v = line.slice(eq + 1).replace(/^"(.*)"$/, "$1").replace(/^'(.*)'$/, "$1");
  if (!(k in process.env)) process.env[k] = v;
}

const SUPA = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SRK = process.env.SUPABASE_SERVICE_ROLE_KEY;
const DEV = process.env.GOOGLE_ADS_DEVELOPER_TOKEN.trim();
const MCC = process.env.GOOGLE_ADS_LOGIN_CUSTOMER_ID.trim();
const ADS_V = process.env.GOOGLE_ADS_API_VERSION?.trim() || "v24";

const GA4_PROPERTY = "536132259";   // Franky's Detailing
const ADS_CID = "6974976770";       // Franky's Detailing

// ── token ──
const conns = await (await fetch(`${SUPA}/rest/v1/google_oauth_connections?select=refresh_token,scopes`, {
  headers: { apikey: SRK, Authorization: `Bearer ${SRK}` },
})).json();
const conn = conns.find((c) => (c.scopes ?? []).some((s) => s.includes("adwords"))) || conns[0];
const tok = await (await fetch("https://oauth2.googleapis.com/token", {
  method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
  body: new URLSearchParams({
    client_id: process.env.GOOGLE_OAUTH_CLIENT_ID, client_secret: process.env.GOOGLE_OAUTH_CLIENT_SECRET,
    refresh_token: conn.refresh_token, grant_type: "refresh_token",
  }),
})).json();
const AT = tok.access_token;
const authHdr = { Authorization: `Bearer ${AT}` };

const ga4Report = async (body) => {
  const r = await fetch(`https://analyticsdata.googleapis.com/v1beta/properties/${GA4_PROPERTY}:runReport`, {
    method: "POST", headers: { ...authHdr, "Content-Type": "application/json" }, body: JSON.stringify(body),
  });
  return { ok: r.ok, status: r.status, data: await r.json() };
};
const rows = (d) => (d.rows ?? []).map((row) => ({
  dims: (row.dimensionValues ?? []).map((x) => x.value),
  mets: (row.metricValues ?? []).map((x) => x.value),
}));

console.log("\n=== GA4: key events (conversions configured) for property", GA4_PROPERTY, "===");
const ke = await fetch(`https://analyticsadmin.googleapis.com/v1beta/properties/${GA4_PROPERTY}/keyEvents`, { headers: authHdr });
if (ke.ok) {
  const j = await ke.json();
  const list = j.keyEvents ?? [];
  if (!list.length) console.log("  (none configured)");
  for (const k of list) console.log(`  • ${k.eventName}  (countingMethod=${k.countingMethod ?? "?"})`);
} else { console.log("  ERR", ke.status, (await ke.text()).slice(0, 200)); }

console.log("\n=== GA4: top events last 90 days (eventName -> count) ===");
const ev = await ga4Report({
  dateRanges: [{ startDate: "90daysAgo", endDate: "yesterday" }],
  dimensions: [{ name: "eventName" }], metrics: [{ name: "eventCount" }],
  orderBys: [{ metric: { metricName: "eventCount" }, desc: true }], limit: 30,
});
if (ev.ok) for (const r of rows(ev.data)) console.log(`  ${r.dims[0].padEnd(28)} ${r.mets[0]}`);
else console.log("  ERR", ev.status, JSON.stringify(ev.data).slice(0, 200));

console.log("\n=== GA4: sessions + key events by channel (last 90 days) ===");
const ch = await ga4Report({
  dateRanges: [{ startDate: "90daysAgo", endDate: "yesterday" }],
  dimensions: [{ name: "sessionDefaultChannelGroup" }],
  metrics: [{ name: "sessions" }, { name: "keyEvents" }, { name: "totalUsers" }],
  orderBys: [{ metric: { metricName: "sessions" }, desc: true }],
});
if (ch.ok) {
  console.log("  channel              sessions  keyEvents  users");
  for (const r of rows(ch.data)) console.log(`  ${r.dims[0].padEnd(20)} ${String(r.mets[0]).padEnd(9)} ${String(r.mets[1]).padEnd(10)} ${r.mets[2]}`);
} else console.log("  ERR", ch.status, JSON.stringify(ch.data).slice(0, 200));

console.log("\n=== GA4: key events by eventName x channel (last 90 days) ===");
const cross = await ga4Report({
  dateRanges: [{ startDate: "90daysAgo", endDate: "yesterday" }],
  dimensions: [{ name: "eventName" }, { name: "sessionDefaultChannelGroup" }],
  metrics: [{ name: "keyEvents" }],
  orderBys: [{ metric: { metricName: "keyEvents" }, desc: true }], limit: 30,
});
if (cross.ok) {
  const rs = rows(cross.data).filter((r) => Number(r.mets[0]) > 0);
  if (!rs.length) console.log("  (no key events recorded — conversions not tracked)");
  for (const r of rs) console.log(`  ${r.dims[0].padEnd(26)} ${r.dims[1].padEnd(18)} ${r.mets[0]}`);
} else console.log("  ERR", cross.status, JSON.stringify(cross.data).slice(0, 200));

// ── Google Ads ──
const gaql = async (cid, query) => {
  const r = await fetch(`https://googleads.googleapis.com/${ADS_V}/customers/${cid}/googleAds:search`, {
    method: "POST",
    headers: { ...authHdr, "developer-token": DEV, "login-customer-id": MCC, "Content-Type": "application/json" },
    body: JSON.stringify({ query }),
  });
  return { ok: r.ok, status: r.status, data: await r.json() };
};

console.log("\n=== Google Ads: conversion actions configured (cid", ADS_CID, ") ===");
const ca = await gaql(ADS_CID, `SELECT conversion_action.name, conversion_action.type, conversion_action.category, conversion_action.status FROM conversion_action`);
if (ca.ok) {
  const res = ca.data.results ?? [];
  if (!res.length) console.log("  (none)");
  for (const x of res) console.log(`  • ${x.conversionAction.name}  [${x.conversionAction.category}/${x.conversionAction.type}]  ${x.conversionAction.status}`);
} else console.log("  ERR", ca.status, JSON.stringify(ca.data).slice(0, 300));

console.log("\n=== Google Ads: last 30 days — conversions + calls by campaign ===");
const perf = await gaql(ADS_CID, `SELECT campaign.name, metrics.conversions, metrics.all_conversions, metrics.phone_calls, metrics.clicks, metrics.cost_micros FROM campaign WHERE segments.date DURING LAST_30_DAYS`);
if (perf.ok) {
  for (const x of perf.data.results ?? []) {
    const m = x.metrics;
    console.log(`  ${(x.campaign.name||"").padEnd(28)} conv=${m.conversions||0} allConv=${m.allConversions||0} calls=${m.phoneCalls||0} clicks=${m.clicks||0} cost=$${((m.costMicros||0)/1e6).toFixed(2)}`);
  }
} else console.log("  ERR", perf.status, JSON.stringify(perf.data).slice(0, 300));

console.log("\n=== Google Ads: conversions by conversion-action name (last 30 days) ===");
const byAction = await gaql(ADS_CID, `SELECT segments.conversion_action_name, metrics.all_conversions FROM campaign WHERE segments.date DURING LAST_30_DAYS`);
if (byAction.ok) {
  const agg = {};
  for (const x of byAction.data.results ?? []) {
    const name = x.segments?.conversionActionName ?? "(none)";
    agg[name] = (agg[name] || 0) + Number(x.metrics?.allConversions || 0);
  }
  const entries = Object.entries(agg).filter(([, v]) => v > 0);
  if (!entries.length) console.log("  (no conversions recorded in last 30 days)");
  for (const [name, v] of entries.sort((a, b) => b[1] - a[1])) console.log(`  ${name.padEnd(32)} ${v.toFixed(2)}`);
} else console.log("  ERR", byAction.status, JSON.stringify(byAction.data).slice(0, 300));

console.log("");
