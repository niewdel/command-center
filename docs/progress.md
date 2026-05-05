---
tags: [niewdel, command-center, progress]
---

# Progress — Command Center

## Progress Tracking Instructions
- Every task from plan.md gets a status: `NOT STARTED` | `IN PROGRESS` | `BLOCKED` | `COMPLETE`
- Completed tasks include brief notes on what was done
- Blocked tasks state what's blocking them
- Update this file at the end of every session

---

## Project Phases

### Phase 1: Discovery — `IN PROGRESS`
- [x] Create 7-file project structure — `COMPLETE` — All skeleton files created with appropriate headers and structure
- [x] Discovery Q&A session — `COMPLETE` — 37 questions across 8 categories, all answered
- [x] Discovery summary & approval — `COMPLETE` — Approved 2026-03-25

### Phase 2: Research — `IN PROGRESS`
- [x] Fathom API/integration research — `COMPLETE` — No public API; Zapier is the path
- [x] Microsoft Graph API + Sandler tenant constraints — `COMPLETE` — User consent likely works; ICS fallback available
- [x] Telegram Bot API for task capture — `COMPLETE` — grammY + webhook + Whisper for voice
- [x] HubSpot Tasks API for i10 sync — `COMPLETE` — Private app + polling; needs Super Admin setup
- [ ] Supabase + Next.js + Railway stack validation — `DEFERRED` — Stack is proven; will validate during execution
- [x] PWA capabilities for iPhone/iPad — `COMPLETE` — Solid for V1; push notifications work
- [ ] AI auto-categorization approaches — `COMPLETE` — Preliminary approach defined; will refine in architecture
- [x] Research summary & approval — `COMPLETE` — Approved 2026-03-25. Calendar deferred to post-V1.

### Phase 3: Architecture — `COMPLETE`
- [x] Define entity/workspace structure — `COMPLETE` — Dashboard + 3 workspaces (Niewdel, i10, Personal)
- [x] Define data model (Supabase schema) — `COMPLETE` — 10 tables, tasks as central entity
- [x] Define module architecture — `COMPLETE` — 7-module priority build order
- [x] Define integration architecture — `COMPLETE` — Telegram/Fathom/HubSpot patterns defined
- [x] Define UI/navigation structure — `COMPLETE` — Sidebar + workspace switcher + shadcn/ui
- [x] Architecture summary & approval — `COMPLETE` — Approved 2026-03-25

### Phase 4: Planning — `COMPLETE`
- [x] Define phased task breakdown with acceptance criteria — `COMPLETE` — 7 execution sub-phases, 40+ tasks with acceptance criteria
- [x] Planning approval — `COMPLETE` — Approved 2026-03-25

### Phase 5: Execution — `IN PROGRESS`

#### Phase 5A: Foundation + Task MVP — `SUBSTANTIALLY COMPLETE`
- [x] 5A.1-5A.10 — Built in prior sessions (auth, schema, shell, dashboard, task CRUD, PWA, deploy)
- [x] 5A.11 Supabase Realtime — `COMPLETE` — Realtime on tasks (dashboard, workspace), calendar events, goals, notes

#### Framework Gap Fill (2026-03-27) — `COMPLETE`
- [x] Realtime on Goals + Notes pages — `COMPLETE` — Added channel subscriptions matching dashboard pattern
- [x] AI command execution — `COMPLETE` — Cancel (soft-delete), query_schedule (returns events+tasks), find_free_time (computes available slots), command palette renders all results
- [x] Recurring tasks — `COMPLETE` — Recurrence utility (daily/weekly/monthly), shared use-task-actions hook, recurrence UI in edit-task-dialog, auto-generates next occurrence on completion
- [x] Workspace views — `COMPLETE` — Client + Project types, client-list/project-list components with CRUD dialogs, workspace page with tabs (Tasks/Clients/Projects), priority-sorted tasks, realtime on clients+projects
- [x] Kanban view — `COMPLETE` — dnd-kit drag-and-drop, 3-column board (Backlog/In Progress/Done), view toggle (list/kanban), integrated in dashboard + workspace pages

#### Framework Polish (2026-03-28) — `COMPLETE`
- [x] Client detail pages — `COMPLETE` — /workspace/[slug]/client/[clientId] with editable notes, links, linked projects, tasks, meeting notes. Client cards in workspace clickable.
- [x] Project detail pages — `COMPLETE` — /workspace/[slug]/project/[projectId] with editable description, status selector, linked notes, tasks. Project cards clickable.
- [x] Dashboard task filtering — `COMPLETE` — Filter by workspace + priority, applied to all task categories (planned, overdue, backlog, completed, kanban)
- [x] Global search navigation — `COMPLETE` — Search results navigate properly: tasks → /dashboard?task=id (opens edit dialog), notes → /notes, goals → /goals, events → /calendar
- [x] PWA notifications — `COMPLETE` — Browser Notification API for overdue + due-today reminders, 15-min check interval + foreground check, permission request in settings, hook in app shell
- [x] Toast system — `COMPLETE` — ToastProvider with success/error/info types, auto-dismiss, slide-in animation
- [x] Realtime on upcoming page — `COMPLETE` — Added channel subscription
- [x] Suspense boundary on dashboard — `COMPLETE` — Wraps useSearchParams for static build compatibility

#### Content Digester Module (2026-03-28) — `COMPLETE`
- [x] Supabase migration for content_digests table — `COMPLETE` — migration-003, RLS, indexes
- [x] TypeScript types — `COMPLETE` — ContentDigest type added to database.ts
- [x] Transcript extraction (YouTube + Instagram) — `COMPLETE` — YouTube captions + Instagram via Whisper
- [x] Claude analysis pipeline — `COMPLETE` — Personalized how-to guide generation with system prompt
- [x] Slack webhook endpoint — `COMPLETE` — /api/digest/slack, handles URL verification + message events
- [x] Processing pipeline — `COMPLETE` — /api/digest/process, async transcript → analysis → Supabase
- [x] Manual ingest endpoint — `COMPLETE` — /api/digest/ingest, add links from UI without Slack
- [x] Digests UI page — `COMPLETE` — /digests with cards, search, tag/status filters, guide viewer dialog, add link dialog
- [x] Sidebar navigation — `COMPLETE` — Digests link added to Planning section
- [ ] Slack app setup — `PENDING` — Requires Justin to create Slack app + configure env vars

#### Content Digester V2 Upgrade (2026-04-01) — `COMPLETE`
- [x] YouTube transcript extraction — `COMPLETE` — Replaced fragile HTML scraping with youtube-transcript library
- [x] Claude analysis pipeline rewrite — `COMPLETE` — Opus model, 8192 tokens, deeply personalized prompt with Verdict ratings, Tools & Downloads, Action Items, Commands to Run sections
- [x] User context injection — `COMPLETE` — digest_context field in user_settings, fetched at processing time, injected into Claude prompt
- [x] Digest Profile in Settings — `COMPLETE` — Textarea where user describes their projects/stack for personalized guides
- [x] Slack HMAC signature verification — `COMPLETE` — Replaced deprecated verification token with HMAC-SHA256 signing secret
- [x] Process route upgrade — `COMPLETE` — Fetches user context, passes to analysis, includes verdict excerpt in Slack reply
- [x] Digest UI overhaul — `COMPLETE` — Proper markdown parser (no dangerouslySetInnerHTML), code block copy buttons, verdict badges (MUST-ACT/WORTH EXPLORING/REFERENCE ONLY/SKIP), inline link/bold/code rendering, blockquote + checkbox support
- [x] Migration-007 — `COMPLETE` — ALTER TABLE user_settings ADD digest_context text
- [ ] Slack app setup — `PENDING` — Requires Justin to create Slack app + configure env vars
- [x] Anthropic API key — `COMPLETE` — Used by digest/process, tasks/dump, ai/parse
- [ ] Run migration-007 — `PENDING` — Run in Supabase SQL Editor

#### Design System + UI Rework (2026-03-29) — `COMPLETE`
- [x] Geist Sans typography — `COMPLETE` — font-heading for headings, Inter for body
- [x] Color token refinement — `COMPLETE` — Tighter contrast, inbox semantic colors
- [x] Skeleton loading components — `COMPLETE` — Skeleton, SkeletonCard, SkeletonListItem, SkeletonPage
- [x] PageLayout template — `COMPLETE` — Consistent header/spacing/breadcrumbs across all pages
- [x] Mobile bottom navigation — `COMPLETE` — 5 tabs (Today, Inbox, Calendar, Spaces, More)
- [x] Breadcrumb component — `COMPLETE` — Used on client/project detail pages
- [x] Baseline UI cleanup — `COMPLETE` — No gradients, no colored shadows, consistent design rules
- [x] Dynamic workspaces — `COMPLETE` — CRUD from sidebar, color/icon/logo customization
- [x] All 11 pages reworked — `COMPLETE` — PageLayout, skeleton loading, font-heading, better empty states

#### Unified Inbox Module (2026-03-29) — `COMPLETE`
- [x] Database schema — `COMPLETE` — migration-006: email_connections + inbox_items tables
- [x] TypeScript types — `COMPLETE` — EmailConnection, InboxItem types
- [x] Google OAuth (Gmail) — `COMPLETE` — authorize/callback routes, gmail.readonly scope
- [x] Microsoft OAuth (Outlook) — `COMPLETE` — authorize/callback routes, Mail.Read scope
- [x] Token refresh — `COMPLETE` — Auto-refresh with deactivation on failure
- [x] Email sync pipeline — `COMPLETE` — Gmail messages + history, Outlook messages + delta
- [x] AI classification — `COMPLETE` — Claude Haiku: action_required, needs_response, informational, promotional, trash
- [x] Inbox UI page — `COMPLETE` — Filter tabs, date-grouped list, detail sheet, create task from email
- [x] Settings email UI — `COMPLETE` — Connect/disconnect/sync buttons for Gmail + Outlook
- [x] Cron sync endpoint — `COMPLETE` — /api/cron/sync-inbox for periodic background sync
- [x] Google OAuth credentials — `COMPLETE` — Google Cloud Console app registered 2026-03-29
- [x] Migration-006 run — `COMPLETE` — Tables created in Supabase 2026-03-29
- [ ] Microsoft OAuth credentials — `PENDING` — Azure AD app registration needed
- [x] CRON_SECRET env var — `COMPLETE` — Set in Railway; in-process scheduler registers via src/instrumentation.ts on boot (2026-05-01)
- [x] Anthropic API key — `COMPLETE` — Already configured
- [ ] OpenAI API key — `PENDING` — Needed for Instagram Whisper transcription
- [ ] Slack app setup — `PENDING` — Content digester Slack channel integration
- [x] Periodic sync trigger — `COMPLETE` — In-process croner scheduler in src/instrumentation.ts: sweep-lead-jobs (5m), sync-calendars (15m), refresh-news (1h)

---

## Blockers
*(None currently)*

#### SEO Agent — Phase 1 (2026-05-03) — `COMPLETE`
- [x] Migration 022 — seo_jobs, seo_checks, seo_issues + clients.seo_config jsonb. RLS via auth.uid() per migration-016 hardened pattern.
- [x] Migration 023 — `ai_search` issue category (applied via MCP only, no file shipped — folded into 024)
- [x] Pipeline — Playwright crawl + PSI mobile + per-page snapshots, fingerprint-based idempotent issue upsert, diff vs previous, Claude AI summary
- [x] Site checks — robots.txt parser (catches AI bot blocks: GPTBot, PerplexityBot, ClaudeBot, Google-Extended, etc.), /llms.txt, /pricing.md
- [x] Per-page checks — title/meta length, missing H1, alt text, canonical-self validation, schema/JSON-LD presence; cross-page duplicate-title detection
- [x] Cron — weekly-check Mon 9am ET (DST-aware via croner), sweep every 15min for stuck jobs
- [x] UI — `/seo` overview, `/seo/clients/[id]` detail with grouped issues + per-page snapshot data + score deltas; settings drawer for keywords, competitors, contact email, dry_run flag
- [x] Fix-plan generator — markdown brief (Copy / Download from UI), Claude Code prompt format
- Smoke test confirmed working 2026-05-04
- Task 18 smoke test (URL-driven Playwright PDF pipeline) confirmed working 2026-05-05: job complete, PDF 9.3MB, 3 pages, PDF v1.4, letter size, Chromium m147

#### SEO Agent — Phases 2/3/4 (2026-05-04) — `COMPLETE`
**Phase 2 — Trends & Reports:**
- [x] Desktop Lighthouse — `runPerformanceAudit` extended with strategy param; pipeline runs mobile+desktop in parallel
- [x] Freshness scoring — `freshness.ts` derives median days-since-change from sitemap `<lastmod>` + content_hash diff vs prior check
- [x] Score history chart — inline SVG sparkline component (no Recharts dep) on `/seo/clients/[id]`, 4-line tooltip on hover
- [x] Monthly PDF report — Playwright print-to-PDF via reused chromium binary; branded HTML template w/ exec summary, sparklines, top issues, resolved
- [x] Monthly cron — 1st of month 9am ET, fire-and-forget setImmediate; manual "Monthly report" button on client detail page

**Phase 3 — Paid Checks (gated on `DATAFORSEO_LOGIN`/`PASSWORD`):**
- [x] DataForSEO client — `dataforseo.ts` calls `/v3/serp/google/organic/live/advanced` + `/v3/dataforseo_labs/google/ranked_keywords/live` via fetch + Basic auth (no SDK)
- [x] `paid_keyword` executor — per target_keyword: live SERP, find rank, store snapshot in `seo_keyword_ranks`, compute WoW delta
- [x] `paid_competitor` executor — pulls competitor ranked_keywords, diffs against client's, stores top 50/competitor in `seo_competitor_gaps` (replace-on-run)
- [x] Crons — paid_keyword Tue 9am ET, paid_competitor 1st of month 9:30am ET; both gated on `paid_tracking_enabled` flag
- [x] UI — Keyword ranks + Competitor gaps sections on `/seo/clients/[id]`, manual run buttons, realtime-subbed

**Phase 4 — Close the Loop:**
- [x] Auto-create tasks — pipeline creates a `tasks` row for each NEW critical/high issue when `dry_run !== true`; links via `seo_issues.task_id`; uses new `tasks.source = 'seo'`; idempotent on re-run
- [x] Weekly digest email — Resend integration (REST, no SDK); fires on new criticals/highs OR ≥5pt regression; suppressed on dry_run
- [x] Mark Fixed / Ignore — PATCH `/api/seo/issues/[id]`, buttons on each issue, refreshes via realtime channel

**Migration 024 — APPLIED via MCP 2026-05-04:**
- Extended `seo_issues.category` to allow `ai_search` (folds in 023)
- Extended `tasks.source` to allow `seo` (kept `ai` which was in production but missing from schema.sql)
- Created `seo_keyword_ranks` (workspace-scoped RLS, idx on client+keyword+captured_at desc)
- Created `seo_competitor_gaps` (workspace-scoped RLS, idx on search_volume desc)
- Both new tables added to `supabase_realtime` publication

**Pending env vars (none blocking — features no-op gracefully until set):**
- [ ] `RESEND_API_KEY` + `SEO_DIGEST_FROM` — email digest + monthly PDF delivery (Justin to swap to `admin@niewdel.com` once Workspace MX resolves)
- [ ] `DATAFORSEO_LOGIN` + `DATAFORSEO_PASSWORD` — Phase 3 paid checks (Justin creating account)
- [ ] `NEXT_PUBLIC_APP_URL` — used in digest email to deep-link back to dashboard

**Phase 5 (white-label / multi-tenant) — `SKIPPED`** — internal-only deployment; revisit if/when SaaS launch.

Notes: Single migration covers all schema deltas to avoid migration-023-style drift. Full build + typecheck clean; only pre-existing lint warnings remain.

#### RLS recovery + Supabase Auth (2026-04-24) — `PARTIALLY COMPLETE`
- [x] Diagnose blank-data issue — `COMPLETE` — 2026-04-22 `harden_rls_across_public_schema` migration replaced permissive PIN-auth policies with `{authenticated}` + `auth.uid()` policies; app has no Supabase Auth session so every query returned `[]`
- [x] Migration 015 restore-pin-auth-rls — `COMPLETE` — Applied 2026-04-24; permissive `USING(true) WITH CHECK(true)` policies restored on all 23 public tables; data visible again
- [x] PIN route Supabase sign-in — `COMPLETE` — `/api/auth/pin` now calls `signInWithPassword` using `SUPABASE_USER_EMAIL`/`SUPABASE_USER_PASSWORD` env vars, sets `sb-*` cookies alongside `cc-auth`
- [x] Middleware session refresh + auto-recovery — `COMPLETE` — Standard `@supabase/ssr` refresh pattern; silently re-signs-in if PIN is valid but Supabase session missing
- [x] Migration 016 re-harden-rls SQL file — `COMPLETE` — Staged in `supabase/migration-016-re-harden-rls.sql`, not yet applied
- [ ] Set Supabase user password — `PENDING` — Justin sets password on `niewdel@gmail.com` via Supabase dashboard
- [ ] Add Railway env vars — `PENDING` — `SUPABASE_USER_EMAIL` + `SUPABASE_USER_PASSWORD` in Railway + local `.env.local`
- [ ] Deploy code changes — `PENDING` — Push + Railway auto-deploy
- [ ] Apply migration 016 — `PENDING` — Run via MCP once deploy is live and PIN login verified

#### Lead-generator merge (2026-04-27) — `PHASE 1 COMPLETE`
- [x] Survey lead-generator codebase — `COMPLETE` — Same stack (Next.js 16 + React 19), no native deps; ~840 LOC dashboard, separate Supabase project
- [x] Migration 017 leads schema — `COMPLETE` — 7 tables (organizations, verticals, companies, contacts, sequences, outreach_emails, pipeline_log) with permissive PIN-auth RLS; "Niewdel" org seeded for Justin's user_id
- [x] Skip data migration — `COMPLETE` — Old lead-gen Supabase project (iubbppdaprqmkfuyjcbd) was decommissioned by Supabase due to inactivity (NXDOMAIN). Starting fresh; CLI engine will repopulate.
- [x] Port dashboard pages + API routes — `COMPLETE` — `/leads`, `/leads/companies`, `/leads/contacts`, `/leads/emails` + matching `/api/leads/*` routes, all using shadcn components and PageLayout
- [x] LeadsTabs sub-nav component — `COMPLETE` — `src/components/leads/leads-tabs.tsx`
- [x] Sidebar + mobile bottom-nav entries — `COMPLETE` — "Leads" with Users icon
- [x] Update migration-016 to harden lead tables — `COMPLETE` — auth.uid() join through organizations.user_id

#### Site-audit merge (2026-04-27) — `PHASE 2 SUBSTANTIALLY COMPLETE`
- [x] Add railpack.json for Chromium install on Railway — `COMPLETE` — Started with nixpacks.toml then a Dockerfile (failed: Dockerfile build couldn't see NEXT_PUBLIC_SUPABASE_* env vars during /audits prerender) and finally landed on railpack.json with `deploy.aptPackages` (correct schema after a typo at `deployAptPackages`). Verified chromium 147.0.7727.116 in runtime container via `railway ssh`. nixpacks.toml + Dockerfile removed.
- [x] Port audit engine from site-audit/src/lib/ → src/lib/audit/ — `COMPLETE` — types, crawl, performance, fix-plan, report-html, report-fix-html + scoring/* (8 categories + narratives + index)
- [x] Single-page mode in crawler.ts — `COMPLETE` — Added CrawlOptions { maxPages, skipDiscovery }; maxPages=1 auto-skips robots.txt + sitemap discovery
- [x] Migration 019 audits table + Supabase Storage bucket — `COMPLETE` — audits table (status, scores, JSON result, report_path, fix_plan_path), audit-reports bucket with public read
- [x] /audits page (URL paste + history) — `COMPLETE` — URL paste form, realtime job-table progress, score badges, links to public report HTML + fix plan HTML
- [x] /api/audits/run + /api/audits/list routes — `COMPLETE` — Run uses fire-and-forget setImmediate pattern matching /api/leads/jobs; list returns latest 50 sorted by created_at
- [x] Sidebar + mobile bottom-nav entries for "Audits" — `COMPLETE` — Gauge icon, alongside Leads
- [x] Update migration-016 to harden audits table — `COMPLETE` — Drops permissive policy, adds auth.uid() = user_id policy
- [ ] Apply migration 019 — `PENDING` — Run via Supabase MCP (or SQL editor) before first audit
- [x] Verify Playwright launches on deployed Railway container — `COMPLETE` — Chromium binary present at /usr/bin/chromium; PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH set in container env. End-to-end audit run not yet exercised — first manual run in /audits will be the final smoke test.
- Notes: Switched from SSE to fire-and-forget + Supabase realtime to match the lead-jobs pattern already in production. Same UX (live progress) without long-lived HTTP connections.

## General Notes
- Project kicked off 2026-03-25
- Framework gap fill session 2026-03-27: 6 new files, 10 modified files, clean TypeScript + build
- Framework polish session 2026-03-28: 4 new files (2 pages, toast, notifications), 8+ modified files, clean build
- Content digester session 2026-03-28: 8 new files (migration, 2 lib modules, 3 API routes, 1 page), 2 modified files (sidebar, types), clean TypeScript
- Design + Inbox session 2026-03-29: 19 new files, 11 modified files. Full UI rework (Phase A+B) + complete inbox module (Phase C). Clean build.
- Repo relocated 2026-04-30: moved from iCloud-backed `~/Documents/claude-projects/Niewdel/command-center` to local `~/Developer/command-center`. Faster localhost, no iCloud sync churn. Old folder pending deletion after verification.
