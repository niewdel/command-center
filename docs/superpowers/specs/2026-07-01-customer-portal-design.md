# Customer Portal — live client reporting + uploads

**Date:** 2026-07-01 · **Status:** Approved (autonomous overnight build) · **Owner:** Niewdel

## Purpose
A client-facing portal where each managed client sees their reporting live and interacts with Niewdel. Retention + upsell driver ("money maker"): clients open a link and watch their results, ad spend, and the work Niewdel is doing, and upload photos for their campaigns.

## What the client sees (requirements)
- **Reporting over 30 / 60 / 90 days** (range tabs).
- **How they're doing** — overall visibility score, traffic, Google rankings, leads.
- **Their ads** — Google Ads performance.
- **Live spend counter** — ad spend this period as a prominent animated counter (counts up on load; "as of <date>"; refreshes on range change). Not a true real-time stream in v1 (data updates on the cron); it's a live-feeling ticker on the current stored spend.
- **Their managed website** — a clear link (and favicon/screenshot) to the site Niewdel manages.
- **Site changes / what we've done** — a changelog from resolved issues ("what we fixed") so they see Niewdel working.
- **Photo upload** — upload photos for marketing campaigns + ads; a gallery of what they've sent. Niewdel accesses these.

**Deferred (later):** Meta ads reporting, per-client logins (multi-tenant), site-change requests workflow.

## Access model
- Route `/portal/[clientId]` — **public, token-gated** (reuse `verifyViewToken(clientId, token)` from `report-print-token.ts`; non-expiring per-client link, frictionless, no signup). Middleware allows `/portal/[id]?token=…` through (mirroring the existing `/seo/clients/[id]/report?view=1&token=…` allowance).
- Operator gets a **"Copy portal link"** action on the client page (`/seo/clients/[id]`) that builds `${APP_URL}/portal/${id}?token=${signViewToken(id)}`.

## Data
- Reuse `getReportData(clientId, range)`. **Add `"60d"` to `ReportRange`/`REPORT_RANGES`/`RANGE_LABEL`** and the window math in `report-data.ts` (30/60/90 day windows; "life" stays for the operator report, not shown in the portal tabs).
- Ads: `data.ads` (Google Ads). Spend counter reads `data.ads.metrics.cost` + period.
- Site changes: `data.issues.resolved` → a "What we've done" list.

## Photo uploads
- Supabase Storage bucket **`client-uploads`** (private). Path `${clientId}/${timestamp}-${filename}`.
- Upload via a server route `POST /api/portal/[clientId]/upload` (token-verified, size/type-limited to images, ≤10MB) that uploads with the service role. Gallery lists the client's folder (signed URLs). Clients only ever touch their own folder (route scopes by the token's clientId).

## Architecture / units
- `src/app/portal/[id]/page.tsx` — server component; verifies token, loads `getReportData`, renders the portal (bare shell, no operator chrome).
- `src/components/portal/*` — `PortalHeader`, `RangeTabs` (30/60/90), `ScoreHero`, `LiveSpendCounter` (client, animated), `TrafficPanel`, `RankingsPanel`, `LeadsPanel`, `AdsPanel`, `WhatWeDid`, `PhotoUploader` (client), `PhotoGallery`.
- `src/app/api/portal/[id]/upload/route.ts` + `.../photos/route.ts` (list) — token-verified.
- `src/middleware.ts` — allow `/portal/[id]` with a valid token as a public route.
- Reuse existing report components where clean (metric cards, delta, charts) but the portal is its own polished client-facing surface, brand v3.

## Error handling
- Invalid/missing token → `notFound()` (like the report). Upload: reject non-images / oversize with structured error. No stack leaks. Empty states everywhere (no ads yet, no photos yet, first report).

## Testing
- Unit: `verifyViewToken` gate; 60d window math; upload validation (type/size, path scoping).
- Component: renders each panel + empty states; spend counter animates to the value.

## Out of scope (v1)
Meta ads, client logins, editing/deleting uploads by the client (they upload only), site-change request forms, notifications.

## File map
| File | Responsibility |
|---|---|
| `src/lib/seo/report-types.ts`, `report-data.ts` | add `60d` range + window |
| `src/app/portal/[id]/page.tsx` | token-gated portal page |
| `src/components/portal/*` | portal panels + uploader/gallery + live counter |
| `src/app/api/portal/[id]/{upload,photos}/route.ts` | token-verified upload + list |
| `src/middleware.ts` | allow `/portal/[id]?token=` public |
| `src/app/seo/clients/[id]/page.tsx` | operator "Copy portal link" action |
| storage bucket `client-uploads` | private per-client photo storage |
