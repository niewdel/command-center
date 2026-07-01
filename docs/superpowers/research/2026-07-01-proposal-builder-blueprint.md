# Proposal Builder Blueprint (research)

**Date:** 2026-07-01
**Source:** synthesis of 5 real Niewdel proposals (Franky's retainer, Hyland/Largent websites, LionPA AI-phased, Schneider lead-gen). Feeds the future **Proposals** subsystem spec (built after CRM v1). Render all new content in Niewdel v3 brand.

## Shared skeleton (default block order)
1. **Cover** — kicker (TYPE · SUBTYPE), big outcome headline, 1-para intro, Prepared For / Prepared By / Validity.
2. **Situation / Problem** (narrative) — variable, per-client.
3. **Scope / "What you get"** — 2-col capability table (CAPABILITY / WHAT YOU GET), repeatable rows.
4. **"Not included" callout** — explicit out-of-scope (a signature Niewdel trust move).
5. **Optional add-on / recurring plan card**.
6. **Timeline** — total duration + week/phase breakdown.
7. **Investment** — vertical line-item stack: label + optional pill badge + description + big right-aligned amount + caps cadence (ONE-TIME / PER MONTH / AT HANDOFF).
8. **Payment terms** — 50/50 split, ACH preferred.
9. **"Two paths" comparison** — managed vs own-it, + auto N-month totals table.
10. **Third-party / software costs table** (build-heavy types).
11. **"The bigger roadmap"** — future Phase 2/3/4 cards.
12. **Liability & security** — responsible / not responsible / liability cap / client obligations (highly boilerplate).
13. **Next steps** — numbered 1–4 + approval-window callout.
14. **Acceptance / e-sign** — selection checkboxes + signature (single or dual).

## Niewdel voice (snippet library — tokenize on {{client}}, {{kickoff_date}}, etc.)
- Grow-onto-it: "Start simple. Built to grow." · "You pay to add, never to redo."
- Scope honesty: "Not included (intentionally)."
- No lock-in: "No proprietary lock-in, no Niewdel dependencies after the swap." · "Your data, already yours."
- Forced choice at signature: "Managed by us, or owned by you. Pick one."
- Direct honesty: "It is a tool, not an agent. That distinction matters and I want to address it directly."
- Outcome headlines: "A site that wins the GC's vetting call." · "Replace the assistant. Reclaim the desk." · "The right leads. The right conversation."
- Reassurance: "On call for the first 48 hours after launch."
- Approval window: "Pricing held for 30 days from proposal date."
- Liability structure: responsible / not responsible / "Liability cap: greater of total fees paid or the build deposit" / "notify Niewdel within 24 hours of any suspected compromise."
- Footer: "Niewdel · AI Automation · Fort Mill, SC".

## Pricing model (drives line items + Stripe)
- Line-item types: `one_time`, `recurring` (optional fixed term count), `handoff` (one-time exit).
- **Build fee:** one-time, **50% upfront / 50% at launch** (deposit auto = build × 50%). Franky's offers a 12-mo payment-plan alternative.
- **Recurring:** monthly plans ($150–$950). Two flavors: evergreen (cancel w/ 30d notice) and finite (e.g. $950 ×4, $750 ×5).
- **Ownership/handoff:** one-time exit fee ($999–$1,999), mutually exclusive with the recurring path.
- Builder needs: mutually-exclusive **option groups** ("pick one path"), **optional line items** (badge + toggle) that recompute totals, auto **N-month totals** table.
- Stripe mapping: recurring → subscriptions (evergreen + fixed-count/scheduled-cancel); 50/50 build → deposit + launch invoices; handoff → one-off invoice.
- Terms boilerplate: 30-day validity, ACH preferred, independent contractor, outcomes never guaranteed, liability cap.

## Block library
**Fixed (every type):** Cover, Scope Table, Timeline, Investment, Payment Terms, Next Steps, Acceptance/e-sign.
**Conditional:** Situation, "What I heard you need", Not-Included, Recurring Plan Card, Two-Paths Comparison, Tech Stack Table, Third-Party Costs Table, "What You Own at Handoff", Bigger Roadmap, Liability & Security, Tier/Config Selector.
**Cross-cutting:** theme token (dark "Agreement" vs light "Proposal"), pill/badge, callout box, snippet inserts.

## Proposal types (pre-load blocks + pricing shape)
| Type | Extra blocks | Pricing | Signatures |
|---|---|---|---|
| **Website build** | Not-Included, Recurring Plan Card, Two-Paths, Bigger Roadmap, Liability | one-time build + (recurring OR $999 ownership) | single |
| **Retainer / Managed Services Agreement** | Service Tiers, Add-Ons, Term & Cancellation, Ownership, Disclaimers, governing law | build + monthly tier (no ownership transfer — it's a contract) | **dual** |
| **Lead-gen / tool** | Situation, Tool-vs-Agent, "What I heard", Not-Included, Tech Stack, Third-Party Costs, After-Month-6, Handoff-includes, Config Selector | one-time build (+ optional upgrade) + finite retainer + one-time handoff | single |
| **AI / automation phased** | Situation, multi-phase scope, "What You Own at Handoff", Third-Party Costs (API), Two-Options, add-employee pricing, Bigger Roadmap | multiple one-time builds + finite managed onboarding + ownership transfer + 6-mo total | single |

**Universal variables:** {{client_name}}, {{contact}}, {{city_state}}, {{proposal_date}}, {{validity_date}}, {{kickoff_by_date}}, headline, intro, scope rows, timeline durations, dollar amounts, deposit (= build × 50%).
