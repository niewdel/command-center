# Proposal Builder + Internal E-Sign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development to implement task-by-task. Steps use `- [ ]` tracking.

**Goal:** A branded proposal builder on top of the existing `/pipeline` CRM: compose a proposal from reusable blocks + line items, send a token-gated client link, and capture a legally-sound internal e-signature (no DocuSign).

**Architecture:** Extends the existing `/pipeline` CRM (`crm_deals`/`crm_companies`/`crm_contacts`). New `crm_proposals` + `crm_proposal_line_items` + `crm_proposal_events` tables (single DB, workspace-scoped, matching the existing permissive-RLS + service-role + hardcoded "niewdel" workspace convention). Proposal document body is a typed discriminated-union block array in `crm_proposals.content` (jsonb); line items live relationally because they drive totals and future Stripe. Public client view + sign use the same HMAC token pattern as the SEO report/portal (`report-print-token.ts`), gated in `middleware.ts`.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript strict (NO `any`), Tailwind + shadcn/ui, Supabase (service-role via `getPipelineClient()`), Vitest. Brand v3.

**Scope boundary:** This plan is the proposal builder + e-sign ONLY. Stripe/MRR invoicing is a SEPARATE follow-up plan (`2026-07-02-stripe-invoicing.md`) because it needs the user's live Stripe keys. The line-item model here (`kind`, `recurring_months`, `deposit_cents`) is designed to map cleanly to Stripe subscriptions/invoices later — do not build Stripe here.

## Global Constraints
- TypeScript strict. NO `any`. Match existing `src/types/pipeline.ts` typing style.
- API routes: `export const dynamic = "force-dynamic"`; use `getPipelineClient()` + `getDefaultPipelineWorkspaceId()` from `src/lib/pipeline/db.ts`; manual input validation; structured `NextResponse.json({ error }, { status })` — never leak stack traces. Follow `src/app/api/pipeline/deals/route.ts` exactly.
- Public (unauthenticated) proposal routes are gated ONLY by a valid HMAC token, same as the portal. Every public API handler MUST call `verifyProposalToken(id, token)` before doing anything, and MUST scope every query to that proposal id + workspace.
- Money is integer cents (`bigint` in SQL, `number` in TS), never floats. Deposit = build one-time subtotal × 50%, rounded to the nearest cent.
- Brand v3: Jet #0D0D0D, Onyx #1A1A1A, Niewdel Blue #3B86DB (accent only), Cloud White #F5F5F5; Montserrat headings / Inter body; pill CTAs; blue-dot bullets; radii sm6/md9/lg12/pill40. Voice: outcome-first, NO em-dashes, no AI slop. Footer "Niewdel · AI Automation · Fort Mill, SC".
- Keep GREEN after every task: `npx tsc --noEmit`, `npm test`, `npm run build`. Conventional commits. Do NOT deploy.
- Reference: `docs/superpowers/research/2026-07-01-proposal-builder-blueprint.md` (block library, voice snippets, pricing model, proposal types) and `docs/superpowers/research/2026-07-01-brand-v3-reference.md`.

---

## Task P0: Migration + types + token helper + middleware

**Files:**
- Create: `supabase/migration-038-proposals.sql` (controller applies via Supabase MCP)
- Create: `src/types/proposals.ts`
- Create: `src/lib/proposals/token.ts`
- Modify: `src/middleware.ts` (allow public proposal view + sign)

**Migration (`migration-038-proposals.sql`)** — follow migration-037's `IF NOT EXISTS` / `DO $$ ... pg_policies` guard style:
- `crm_proposals`: `id uuid PK default gen_random_uuid()`, `workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE`, `deal_id uuid REFERENCES crm_deals(id) ON DELETE SET NULL`, `crm_company_id uuid REFERENCES crm_companies(id) ON DELETE SET NULL`, `primary_contact_id uuid REFERENCES crm_contacts(id) ON DELETE SET NULL`, `type text NOT NULL CHECK (type IN ('website_build','retainer','lead_gen','ai_phased','custom'))`, `status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','sent','viewed','signed','declined','void'))`, `title text NOT NULL`, `theme text NOT NULL DEFAULT 'dark' CHECK (theme IN ('dark','light'))`, `content jsonb NOT NULL DEFAULT '[]'::jsonb`, `proposal_date date`, `validity_days int NOT NULL DEFAULT 30`, `prepared_by text`, `subtotal_cents bigint`, `recurring_monthly_cents bigint`, `deposit_cents bigint`, `sent_at timestamptz`, `viewed_at timestamptz`, `signed_at timestamptz`, `declined_at timestamptz`, `signer_name text`, `signer_email text`, `signer_ip inet`, `signature_typed text`, `signer_consent boolean`, `countersigner_name text`, `countersigned_at timestamptz`, `requires_dual_sign boolean NOT NULL DEFAULT false`, `created_by uuid`, `created_at timestamptz NOT NULL DEFAULT now()`, `updated_at timestamptz NOT NULL DEFAULT now()`. Trigger `BEFORE UPDATE EXECUTE FUNCTION touch_updated_at()` (function exists from migration-037). Indexes on `workspace_id`, `deal_id`, `status`.
- `crm_proposal_line_items`: `id`, `workspace_id NOT NULL REFERENCES workspaces ON DELETE CASCADE`, `proposal_id uuid NOT NULL REFERENCES crm_proposals(id) ON DELETE CASCADE`, `kind text NOT NULL CHECK (kind IN ('one_time','recurring','handoff'))`, `label text NOT NULL`, `description text`, `badge text`, `amount_cents bigint NOT NULL DEFAULT 0`, `cadence text NOT NULL CHECK (cadence IN ('one_time','per_month','at_handoff','at_launch','upfront')) DEFAULT 'one_time'`, `recurring_months int` (null = evergreen), `option_group text` (null = always included; non-null = mutually-exclusive pick-one group), `is_optional boolean NOT NULL DEFAULT false`, `is_selected boolean NOT NULL DEFAULT true`, `position int NOT NULL DEFAULT 0`, `created_at timestamptz NOT NULL DEFAULT now()`. Index on `proposal_id`.
- `crm_proposal_events` (append-only e-sign audit trail): `id`, `workspace_id NOT NULL REFERENCES workspaces ON DELETE CASCADE`, `proposal_id uuid NOT NULL REFERENCES crm_proposals(id) ON DELETE CASCADE`, `type text NOT NULL CHECK (type IN ('created','sent','viewed','signed','countersigned','declined','downloaded'))`, `actor text`, `ip inet`, `user_agent text`, `meta jsonb NOT NULL DEFAULT '{}'::jsonb`, `occurred_at timestamptz NOT NULL DEFAULT now()`. Index on `proposal_id, occurred_at`.
- All three: `ENABLE ROW LEVEL SECURITY` + a permissive `FOR ALL USING (true) WITH CHECK (true)` policy (matches existing crm_activities/crm_tasks baseline — the wall is the service-role key + token, consistent with the current CRM). Add all three to `supabase_realtime` publication with the same guard block used in migration-037.

**Types (`src/types/proposals.ts`):** `ProposalType`, `ProposalStatus`, `ProposalTheme`, `LineItemKind`, `LineItemCadence` string-literal unions + label maps. `CrmProposal`, `CrmProposalLineItem`, `CrmProposalEvent` row types. A discriminated-union `ProposalBlock` (field `type`) covering every block below, each with typed fields:
- `cover` {kicker, headline, intro, preparedFor, preparedBy, validityDate}
- `situation` {heading, body}
- `scope` {heading, rows: {capability, whatYouGet}[]}
- `not_included` {heading, items: string[]}
- `recurring_plan` {heading, planName, monthlyCents, cadenceNote, features: string[]}
- `timeline` {heading, totalDuration, phases: {label, duration, detail}[]}
- `investment` {heading, note} (renders from the relational line items, not inline)
- `payment_terms` {heading, body}
- `two_paths` {heading, managedLabel, managedBody, ownItLabel, ownItBody, months, managedMonthlyCents, ownItOneTimeCents}
- `tech_stack` {heading, rows: {tool, purpose, costNote}[]}
- `third_party_costs` {heading, rows: {item, cadence, amountCents}[]}
- `roadmap` {heading, phases: {label, body}[]}
- `liability` {heading, responsible: string[], notResponsible: string[], liabilityCap, clientObligations: string[]}
- `next_steps` {heading, steps: string[], approvalWindow}
- `acceptance` {heading, body, dual: boolean}
- `callout` {tone: 'info'|'warn'|'trust', body}
Export `ProposalContent = ProposalBlock[]`.

**Token (`src/lib/proposals/token.ts`):** mirror `signViewToken`/`verifyViewToken` in `report-print-token.ts` but payload `${proposalId}|proposal`, env key `PROPOSAL_VIEW_SECRET` (fall back to `SEO_REPORT_PRINT_SECRET` if `PROPOSAL_VIEW_SECRET` unset, so it works in prod today — document this). `signProposalToken(id)`, `verifyProposalToken(id, token)` with the same length-64 + `timingSafeEqual` guards.

**Middleware:** allow unauthenticated GET of `/proposals/:id/view` when a `token` query param is present, and all `/api/proposals/*` (they self-verify the token), mirroring the existing `/portal/[id]` + `/api/portal/` allowlist. Do not otherwise change auth.

- [ ] Write migration, types, token helper, middleware edit.
- [ ] Add a unit test `src/lib/proposals/__tests__/token.test.ts`: sign→verify round-trips true; wrong id / tampered token / wrong-length → false. Mock `PROPOSAL_VIEW_SECRET` via `vi.stubEnv`.
- [ ] `npx tsc --noEmit` clean; `npm test` green.
- [ ] Commit `feat(proposals): schema, types, view token, middleware (P0)`. Controller applies migration-038 via Supabase MCP and confirms before P2.

## Task P1: Pricing engine (pure, TDD)

**Files:** Create `src/lib/proposals/pricing.ts` + `src/lib/proposals/__tests__/pricing.test.ts`.

**Interfaces — Produces:**
- `resolveSelectedItems(items: CrmProposalLineItem[]): CrmProposalLineItem[]` — drops unselected optional items; for each `option_group`, keeps only the one selected item (if none selected in a group, keep the first by position and treat as selected).
- `computeTotals(items: CrmProposalLineItem[]): { oneTimeCents: number; recurringMonthlyCents: number; handoffCents: number; depositCents: number }` — sum by kind over resolved-selected items; `depositCents = round(oneTimeCents * 0.5)`.
- `nMonthTotal(items, months: number): number` — oneTime + handoff + recurringMonthly×months over resolved items.
- `formatCents(cents: number): string` — `$1,234` (no cents when whole dollars, else `$1,234.56`), for display.

Write tests first (mixed one_time/recurring/handoff, an option_group with two options, an optional toggled off, evergreen vs finite recurring, deposit rounding on odd cents). Implement to pass. NO `any`; accept a minimal structural subset of `CrmProposalLineItem` if convenient but keep it typed.

- [ ] Tests fail → implement → tests pass. `npx tsc --noEmit` clean; `npm test` green.
- [ ] Commit `feat(proposals): pricing + option-group resolution engine (P1)`.

## Task P2: Proposal CRUD API + type presets

**Files:**
- Create `src/app/api/pipeline/proposals/route.ts` (GET list, POST create)
- Create `src/app/api/pipeline/proposals/[id]/route.ts` (GET one w/ line items + events, PATCH, DELETE)
- Create `src/app/api/pipeline/proposals/[id]/line-items/route.ts` (PUT — replace the full line-item set for a proposal, transactional-ish: delete-then-insert scoped to proposal_id)
- Create `src/lib/proposals/presets.ts` — `presetFor(type: ProposalType): { blocks: ProposalContent; lineItems: Omit<CrmProposalLineItem,'id'|'workspace_id'|'proposal_id'|'created_at'>[]; requiresDualSign: boolean }` seeding default blocks + starter line items + voice snippets per the blueprint's per-type table (website_build, retainer[dual], lead_gen, ai_phased, custom=minimal).
- Test: `src/app/api/pipeline/proposals/__tests__/proposals.test.ts` + `presets.test.ts`.

**Rules:** All service-role + workspace-scoped. POST create accepts `{ type, title, deal_id?, crm_company_id?, primary_contact_id? }`; seeds `content` + line items from `presetFor(type)`; if `deal_id` given, denormalize company/contact from the deal. PATCH guards: reject edits (400) when `status IN ('signed','void')` except status transition to `void`. On PATCH that recomputes, snapshot `subtotal_cents`/`recurring_monthly_cents`/`deposit_cents` from `computeTotals`. Validate `type`/`status`/`theme` against the unions. Return structured errors.

- [ ] Tests (create seeds preset; PATCH on signed → 400; delete cascades) → implement → green. `npx tsc --noEmit`; `npm test`; note: these tests mock `getPipelineClient` like existing pipeline API tests do — read `src/app/api/pipeline/tasks/__tests__/tasks.test.ts` for the mock pattern.
- [ ] Commit `feat(proposals): CRUD API + per-type presets (P2)`.

## Task P3: Block renderer components

**Files:** Create `src/components/proposals/blocks/` — one component per block type in the P0 union, plus `src/components/proposals/proposal-document.tsx` (`<ProposalDocument proposal content lineItems theme mode="preview"|"client" />` mapping `content` → block components, injecting the resolved line items into the `investment` block via the P1 engine, applying the theme). Pure presentational, brand v3, no data fetching. Add `src/components/proposals/__tests__/proposal-document.test.ts` asserting it renders each block type without throwing given preset content (use a lightweight render — follow whatever the repo's onboarding tests did for client components; if no DOM test infra, test a pure `blocksToPlainText(content)` helper instead and keep components visually verified via build).

**Rules:** Themeable via CSS vars already in `globals.css`. Dark theme = "Agreement", light = "Proposal". Blue-dot bullets, pill CTAs, Montserrat headings. `investment` block renders the vertical line-item stack (label + optional pill badge + description + right-aligned `formatCents(amount)` + caps cadence). `two_paths` renders the auto N-month totals table via `nMonthTotal`. NO em-dashes in any static copy.

- [ ] Implement blocks + document + test. `npx tsc --noEmit`; `npm test`; `npm run build` (catches SSR issues).
- [ ] Commit `feat(proposals): brand-v3 block renderer + document (P3)`.

## Task P4: Internal builder UI

**Files:**
- Create `src/app/pipeline/proposals/page.tsx` (list: title, company, type, status pill, subtotal, updated; "New proposal" → type picker)
- Create `src/app/pipeline/proposals/[id]/edit/page.tsx` + `src/components/proposals/builder/*` — block editor: add/remove/reorder blocks (up/down buttons, no dnd dep needed), edit each block's fields via typed forms, a line-item editor (add/remove rows; set kind/label/description/badge/amount/cadence/recurring_months/option_group/is_optional), live totals sidebar via P1 engine, theme toggle, live `<ProposalDocument mode="preview">`. A snippet inserter drawing from the blueprint's voice library (`src/lib/proposals/snippets.ts` — create it with the tokenized snippets). "Send" action → PATCH status='sent', set `sent_at`, write a `sent` event, and reveal the client link `/proposals/[id]/view?token=<signProposalToken(id)>` with a copy button.
- Reuse existing shadcn/ui primitives; match `/pipeline/*` page chrome.

**Rules:** Client components fetch via the P2 API. Saving persists blocks (PATCH `content`) and line items (PUT line-items) then re-snapshots totals. Disable editing when status signed/void (show read-only + the audit trail from events).

- [ ] Implement. `npx tsc --noEmit`; `npm test`; `npm run build`.
- [ ] Commit `feat(proposals): internal builder UI (P4)`.

## Task P5: Token-gated client view + internal e-sign

**Files:**
- Create `src/app/proposals/[id]/view/page.tsx` — public, server component. Reads `token` from searchParams, `verifyProposalToken(id, token)`; on fail render a neutral "This link is not valid" page (no data leak). On success load the proposal + line items (service-role), render `<ProposalDocument mode="client" theme={proposal.theme}>` read-only, and mount a client `<AcceptancePanel>`.
- Create `src/app/api/proposals/[id]/view/route.ts` (POST: verify token, idempotently log a `viewed` event + set `viewed_at`/status='viewed' if currently 'sent'; called on mount).
- Create `src/app/api/proposals/[id]/sign/route.ts` (POST: verify token; body `{ signerName, signerEmail, consent: true, selectedOptions: {lineItemId, selected}[] , signatureTyped }`; require `consent===true` and non-empty `signerName` else 400; persist selected line items, recompute + snapshot totals, set `status='signed'`, `signed_at=now()`, `signer_name/email/ip (from x-forwarded-for)/signature_typed/signer_consent`, write a `signed` event with ip + user-agent; if `requires_dual_sign` leave a `countersign` affordance for internal). Reject if already signed/void.
- Create `src/components/proposals/acceptance-panel.tsx` — client: option-group selectors + optional toggles (recompute displayed totals live via P1), a consent checkbox ("I agree to the terms of this proposal"), typed-name signature field, "Sign & accept" → sign API; success state shows signed confirmation + timestamp.
- Create `src/app/api/proposals/[id]/countersign/route.ts` (authenticated internal, for dual-sign retainers: set `countersigner_name`, `countersigned_at`, write `countersigned` event).
- Test: `src/app/api/proposals/__tests__/sign.test.ts` — invalid token → 401; missing consent → 400; happy path sets signed + writes event + snapshots; double-sign → 409.

**Rules:** Legally-sound internal e-sign = explicit consent checkbox + typed name + captured IP + user-agent + server timestamp + append-only event trail. This satisfies ESIGN/UETA intent-to-sign; document that in a code comment. Never trust client-supplied totals — always recompute server-side from the persisted line items.

- [ ] Implement. `npx tsc --noEmit`; `npm test`; `npm run build`.
- [ ] Commit `feat(proposals): client view + internal e-sign with audit trail (P5)`.

## Task P6: Deal integration + end-to-end verify

**Files:**
- Modify the deal detail page/components (`src/app/pipeline/deals/[id]/*`) to add a "Proposals" section: list this deal's proposals (status pill + amount + link to edit/view), "New proposal" prefilled from the deal.
- On proposal `sent` and `signed`, write a `crm_activities` row against the deal (reuse the existing activities API/helper) so it shows on the deal timeline. On `signed`, offer/auto a deal-stage nudge toward `build`.
- Update `src/types/pipeline.ts` STAGE flow only if needed (do not change existing stages).

- [ ] Implement. Full green: `npx tsc --noEmit`, `npm test`, `npm run build`.
- [ ] Commit `feat(proposals): surface proposals on the deal + activity logging (P6)`.
- [ ] Open PR against main for morning review. Do NOT deploy.

## Deferred to follow-up plan (`2026-07-02-stripe-invoicing.md`)
Stripe customer/product/price creation, 50/50 build deposit+launch invoices, recurring subscriptions (evergreen + fixed-count scheduled-cancel), handoff one-off invoice, MRR tracking dashboard, webhook signature verification. Needs the user's live Stripe secret + webhook signing secret (leave a documented env paste-in point: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`). The line-item `kind`/`cadence`/`recurring_months`/`deposit_cents` model above is the Stripe mapping surface.

## Self-review notes
- Money integer-cents everywhere; deposit rounding tested.
- Public routes verify token before any query; totals always recomputed server-side.
- Presets + snippets come straight from the blueprint; no invented pricing.
- Single DB, workspace-scoped, matches existing CRM RLS baseline (documented as intentional, consistent with current `/pipeline`).
