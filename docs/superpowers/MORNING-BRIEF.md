
## CRITICAL: CRM already exists — do NOT rebuild it
- The app has a mature, in-use CRM at `/pipeline` (kanban): `crm_companies`, `crm_contacts`, `crm_deals` (stages: discovery→scope→proposal→build→live/lost/disqualified), `crm_deal_contacts`, full API + UI + realtime, promote-from-leads. Proposals already attach to deals (`crm_deals.proposal_url/proposal_filename`).
- My `feat/crm-v1` branch + migration-036 was a DUPLICATE built before I found this. It failed to apply (collided with existing `contacts` table) and rolled back — NO DB damage. **Do not merge feat/crm-v1.** I'll delete migration-036.
- RIGHT next steps for the "CRM" ask (not a rebuild): (1) add an activity timeline + tasks to the existing `/pipeline` deal/company detail; (2) build the **proposal builder** attached to `crm_deals` (using the blueprint in research/2026-07-01-proposal-builder-blueprint.md + brand v3). The Stripe invoicing then hangs off won deals.
- The generic/multi-tenant/demo vision applies to this EXISTING CRM later, not a new one.

## Tonight's focus (per your last message): CUSTOMER PORTAL
- Branch feat/customer-portal. Token-gated `/portal/[id]` live client reporting (30/60/90, ads, live spend counter, managed-site link, "what we've done", photo uploads). Storage bucket `client-uploads` created (private, images ≤10MB). Building now.
