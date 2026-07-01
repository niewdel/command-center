# Customer Portal Implementation Plan

> Execute task-by-task on `feat/customer-portal`. Keep GREEN (`tsc` + `npm test` + `npm run build`). Do NOT deploy. Brand v3 (`docs/superpowers/research/2026-07-01-brand-v3-reference.md`), voice: no em-dashes, outcome-first.

**Goal:** A token-gated client portal at `/portal/[id]` showing live 30/60/90 reporting (score, traffic, rankings, leads, ads with a live spend counter), the managed site link, "what we've done," and client photo uploads.

## Global Constraints
- Token-gated public route (reuse `verifyViewToken`). No operator chrome. Client-facing polish, brand v3.
- Uploads: images only, ≤10MB, scoped to the client's own storage folder by the token. Structured errors, no stack leaks.
- TS strict, no `any`. Session/token verified on every API route. Research (context7/docs), don't guess.

## Task 1: 60d range + storage bucket
- `report-types.ts`: `ReportRange` add `"60d"`; `REPORT_RANGES`; `RANGE_LABEL["60d"]="Last 60 days"`.
- `report-data.ts`: handle 60-day window wherever range→days is computed (30/60/90; keep "life").
- Controller creates private Storage bucket `client-uploads` (via Supabase MCP).
- vitest: 60d window math. tsc+test clean. Commit.

## Task 2: Route access + operator link
- `middleware.ts`: allow `/portal/[id]` when `token` present + valid (mirror the report `view` allowance; set bare-shell header).
- `src/app/seo/clients/[id]/page.tsx`: add "Copy portal link" action → `${APP_URL}/portal/${id}?token=${signViewToken(id)}`.
- tsc+build clean. Commit.

## Task 3: Portal page + header + range tabs
- `src/app/portal/[id]/page.tsx` (server): verify token (else notFound), `getReportData(id, range from ?range=)`, render bare shell.
- `src/components/portal/{PortalHeader,RangeTabs}.tsx`: client name/logo, managed-site link (favicon + external link), 30/60/90 tabs (client-side range switch).
- Empty/first-report states. Commit.

## Task 4: Reporting panels
- `src/components/portal/{ScoreHero,TrafficPanel,RankingsPanel,LeadsPanel,AdsPanel,WhatWeDid}.tsx` from `ReportData`. Reuse existing report primitives (MetricCard/Delta/charts) where clean; brand v3. WhatWeDid from `data.issues.resolved`. Component tests + empty states. Commit.

## Task 5: Live spend counter
- `src/components/portal/LiveSpendCounter.tsx` (client): animated count-up to `data.ads.metrics.cost` on mount + on range change; "as of <period_end>"; graceful when ads not configured. Test the target value renders. Commit.

## Task 6: Photo upload + gallery
- `src/app/api/portal/[id]/upload/route.ts` (POST, token-verified, image + ≤10MB, upload to `client-uploads/${id}/…` via service role) and `.../photos/route.ts` (GET list → signed URLs).
- `src/components/portal/{PhotoUploader,PhotoGallery}.tsx` (client): drag/drop or picker, progress, gallery grid, empty state. Tests for validation + path scoping. Commit.

## Task 7: Verify end-to-end
- `npm run build` green; render `/portal/[id]` for a real client via a throwaway tsx/route smoke; confirm token gate, panels, counter, upload validation. Full suite green. Commit. Leave PR-ready.
