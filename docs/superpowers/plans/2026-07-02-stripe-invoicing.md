# Stripe Invoicing + MRR Implementation Plan (follow-up)

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development. Steps use `- [ ]` tracking.

**Goal:** Custom invoicing on signed proposals — 50/50 build deposits, recurring monthly subscriptions, one-time handoff invoices — with MRR/ARR tracking. Replaces Wave.

**Architecture:** Signed `crm_proposals` + their `crm_proposal_line_items` are the source of truth for what to bill. A thin local mirror (`crm_invoices`, `crm_subscriptions`) tracks Stripe state so the app never has to call Stripe to render a dashboard. Stripe is the money rail; the DB is the reporting layer. MRR is computed from local subscription rows (and, before Stripe is wired, from signed-proposal recurring line items — see the S0 verifiable slice, already built on branch `feat/mrr`).

**Tech Stack:** Next.js 16, Supabase, `stripe` Node SDK. Brand v3.

## BLOCKED ON: live Stripe credentials
This plan cannot be verified end-to-end until Justin provides:
- `STRIPE_SECRET_KEY` (test mode first: `sk_test_...`)
- `STRIPE_WEBHOOK_SECRET` (`whsec_...` from the endpoint config)
- `STRIPE_PUBLISHABLE_KEY` (if any client-side Checkout is used)
Set these in Railway (watch for the trailing-whitespace gotcha). Until then, build the SDK-touching tasks behind an env guard and DO NOT claim them verified — they need a test-mode smoke run against real Stripe.

## Global Constraints
- Money in integer cents. Reuse `formatCents` from `src/lib/proposals/pricing.ts`.
- Every API route: `force-dynamic`, service-role via `getPipelineClient()`, workspace-scoped, manual validation, structured errors.
- Webhook route MUST verify the Stripe signature (`stripe.webhooks.constructEvent`) before trusting the body — this is the money-security boundary, same discipline as the HubSpot/Slack webhook rules in CLAUDE.md.
- The Stripe client is server-only. Never ship the secret key to the browser. Init lazily and throw a clear error if the key is missing.
- Keep GREEN. Do NOT deploy. Idempotency keys on every create call.

---

## Task S0 (DONE, verifiable — on branch `feat/mrr`)
Pure MRR from signed proposals, no Stripe. `src/lib/proposals/mrr.ts` + a revenue panel. See that branch/PR. This plan's S1+ layer Stripe on top.

## Task S1: Stripe client + local mirror schema
- `src/lib/stripe/client.ts` — lazy `getStripe()` returning a configured `Stripe` instance, throwing if `STRIPE_SECRET_KEY` unset. Pin an API version.
- `supabase/migration-039-invoicing.sql`: `crm_invoices` (id, workspace_id, proposal_id?, crm_company_id?, stripe_invoice_id, kind[deposit/launch/recurring/handoff/manual], amount_cents, currency, status[draft/open/paid/void/uncollectible], due_date, hosted_invoice_url, pdf_url, issued_at, paid_at, created_at) + `crm_subscriptions` (id, workspace_id, proposal_id?, crm_company_id?, stripe_subscription_id, stripe_customer_id, monthly_cents, status[active/past_due/canceled/trialing], term_months?, current_period_end, canceled_at, created_at) + `crm_companies.stripe_customer_id` (nullable). RLS + realtime, matching migration-037/038 idioms. Controller applies.
- Types in `src/types/invoicing.ts`.

## Task S2: Customer + invoice/subscription creation from a signed proposal
- `POST /api/pipeline/proposals/[id]/bill` — for a signed proposal: ensure a Stripe customer for the company (create + store `stripe_customer_id` if absent). Then, from the proposal's selected line items: create a 50/50 deposit invoice + a launch invoice for the `one_time` build (deposit = build×50%); create a subscription for `recurring` items (evergreen = no end; finite = `recurring_months` via a scheduled cancel or a subscription schedule); create a one-off invoice for `handoff`. Mirror each into `crm_invoices`/`crm_subscriptions`. Idempotency keys derived from proposal id + line-item id. Guard behind key presence.
- Read-side: `GET /api/pipeline/invoices`, `GET /api/pipeline/subscriptions` (workspace-scoped, from local mirror).

## Task S3: Stripe webhook → local mirror sync
- `POST /api/webhooks/stripe` — verify signature, then handle `invoice.paid`, `invoice.payment_failed`, `invoice.finalized`, `customer.subscription.updated/deleted`. Update the local mirror rows (status, paid_at, current_period_end, canceled_at). Idempotent on Stripe event id. NO auth middleware (public webhook), signature IS the auth.

## Task S4: Invoicing + MRR dashboard
- `/pipeline/revenue` (or extend `/pipeline/dashboard`): MRR/ARR from active `crm_subscriptions` (supersedes S0's proposal-derived estimate once Stripe is live), outstanding invoices, paid-this-month, churn. Invoice list with hosted-invoice links. Reuse the S0 MRR components.

## Task S5: Verify (needs test-mode keys)
- With `sk_test_...`: sign a test proposal → bill → confirm customer/invoices/subscription created in Stripe test dashboard + mirrored locally. Trigger a test webhook (`stripe trigger invoice.paid`) → confirm the mirror updates. Only after this passes is S2/S3 "verified."

## Notes
- Prefer Stripe Invoices + Subscriptions over Checkout for a B2B/ACH flow (ACH preferred per the proposal terms). Enable ACH debit + card on the invoice.
- The proposal line-item model (`kind`/`cadence`/`recurring_months`) maps 1:1 here — no remodeling needed.
