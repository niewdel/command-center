-- seed-demo-workspace.sql
-- Demo tenant for admin@niewdel.com. Idempotent: deletes + reseeds the demo
-- workspace's CRM rows on each run. Run by the controller via Supabase MCP.
-- All companies/contacts are fictional (.example domains).

-- 1) The workspace. Owned by Justin (owner-based write policies), kind=demo.
INSERT INTO workspaces (name, slug, type, kind, user_id, icon, color, description)
SELECT 'Demo', 'demo', 'business', 'demo', u.id, 'sparkles', 'bg-violet-500',
       'Seeded demo tenant. Fake data only.'
FROM auth.users u WHERE lower(u.email) = 'justin@niewdel.com'
ON CONFLICT (slug) DO UPDATE SET kind = 'demo';

-- 2) admin@ is a member of demo ONLY.
INSERT INTO workspace_members (workspace_id, user_id, role)
SELECT w.id, u.id, 'member'
FROM workspaces w, auth.users u
WHERE w.slug = 'demo' AND lower(u.email) = 'admin@niewdel.com'
ON CONFLICT (workspace_id, user_id) DO UPDATE SET role = 'member';

-- 3) Wipe demo CRM rows (FKs cascade line items / events / deal_contacts).
DELETE FROM crm_proposals  WHERE workspace_id = (SELECT id FROM workspaces WHERE slug = 'demo');
DELETE FROM crm_activities WHERE workspace_id = (SELECT id FROM workspaces WHERE slug = 'demo');
DELETE FROM crm_tasks      WHERE workspace_id = (SELECT id FROM workspaces WHERE slug = 'demo');
DELETE FROM crm_deals      WHERE workspace_id = (SELECT id FROM workspaces WHERE slug = 'demo');
DELETE FROM crm_contacts   WHERE workspace_id = (SELECT id FROM workspaces WHERE slug = 'demo');
DELETE FROM crm_companies  WHERE workspace_id = (SELECT id FROM workspaces WHERE slug = 'demo');

-- 4) Companies (8)
INSERT INTO crm_companies (workspace_id, name, domain, website, industry, headcount, hq, notes)
SELECT w.id, c.name, c.domain, c.website, c.industry, c.headcount, c.hq, c.notes
FROM workspaces w
CROSS JOIN (VALUES
  ('Harbor & Pine Coffee','harborpine.example','https://harborpine.example','Food & Beverage',25,'Charlotte, NC','Three locations, no online ordering yet.'),
  ('Bluefin Logistics','bluefinlog.example','https://bluefinlog.example','Transportation',120,'Atlanta, GA','Referred from chamber event. Dispatch runs on spreadsheets.'),
  ('Crestline Dental Group','crestlinedental.example','https://crestlinedental.example','Healthcare',30,'Rock Hill, SC','Two practices, wants recall automation.'),
  ('Summit Ridge HVAC','summitridgehvac.example','https://summitridgehvac.example','Home Services',20,'Fort Mill, SC','Seasonal demand swings, weak review pipeline.'),
  ('Verde Lawn & Landscape','verdelawn.example','https://verdelawn.example','Home Services',6,'Pineville, NC','Owner-operator, books by text message.'),
  ('Ironvale Fitness','ironvalefit.example','https://ironvalefit.example','Fitness',28,'Charlotte, NC','Two gyms, churn problem, no member app.'),
  ('Copperleaf Realty','copperleafrealty.example','https://copperleafrealty.example','Real Estate',14,'Ballantyne, NC','Team of 12 agents, lead follow-up is manual.'),
  ('Northgate Auto Spa','northgateauto.example','https://northgateauto.example','Automotive',5,'Gastonia, NC','Detail shop, wants memberships like the big chains.')
) AS c(name, domain, website, industry, headcount, hq, notes)
WHERE w.slug = 'demo';

-- 5) Contacts (15)
INSERT INTO crm_contacts (workspace_id, crm_company_id, full_name, first_name, last_name, title, email, phone, notes)
SELECT w.id, co.id, p.full_name, p.first_name, p.last_name, p.title, p.email, p.phone, p.notes
FROM workspaces w
JOIN crm_companies co ON co.workspace_id = w.id
JOIN (VALUES
  ('Harbor & Pine Coffee','Maya Ellison','Maya','Ellison','Owner','maya@harborpine.example','704-555-0181','Decision maker. Prefers early morning calls.'),
  ('Harbor & Pine Coffee','Dre Whitfield','Dre','Whitfield','GM','dre@harborpine.example','704-555-0114','Runs day-to-day, champion for online ordering.'),
  ('Bluefin Logistics','Carl Renner','Carl','Renner','VP Operations','carl.renner@bluefinlog.example','404-555-0133','Skeptical of software, wants ROI numbers.'),
  ('Bluefin Logistics','Tanya Okafor','Tanya','Okafor','Dispatch Lead','tanya@bluefinlog.example','404-555-0177','Day-to-day user of any dispatch tool.'),
  ('Crestline Dental Group','Dr. Priya Nandakumar','Priya','Nandakumar','Practice Owner','priya@crestlinedental.example','803-555-0102','Wants recall + review automation first.'),
  ('Crestline Dental Group','Beth Calloway','Beth','Calloway','Office Manager','beth@crestlinedental.example','803-555-0166','Gatekeeper. Loop in on scheduling.'),
  ('Summit Ridge HVAC','Gus Marino','Gus','Marino','Owner','gus@summitridgehvac.example','803-555-0140','Referral from Verde. Wants the website first.'),
  ('Summit Ridge HVAC','Kelly Tran','Kelly','Tran','Office Admin','kelly@summitridgehvac.example','803-555-0155','Handles invoicing, QuickBooks power user.'),
  ('Verde Lawn & Landscape','Marcus Verde','Marcus','Verde','Owner','marcus@verdelawn.example','980-555-0122','Live client. Monthly retainer.'),
  ('Ironvale Fitness','Jess Kowalski','Jess','Kowalski','Co-owner','jess@ironvalefit.example','704-555-0193','Wants a member app, budget-sensitive.'),
  ('Ironvale Fitness','Sam Ridley','Sam','Ridley','Co-owner','sam@ironvalefit.example','704-555-0148','The numbers person. Send pricing to both.'),
  ('Copperleaf Realty','Angela Copperleaf','Angela','Copperleaf','Broker-in-Charge','angela@copperleafrealty.example','704-555-0170','Team lead, evaluating CRMs.'),
  ('Copperleaf Realty','Devon Hart','Devon','Hart','Ops Coordinator','devon@copperleafrealty.example','704-555-0126','Implements whatever Angela picks.'),
  ('Northgate Auto Spa','Ray Delgado','Ray','Delgado','Owner','ray@northgateauto.example','704-555-0158','Wants membership billing like the chains.'),
  ('Northgate Auto Spa','Lena Park','Lena','Park','Shop Manager','lena@northgateauto.example','704-555-0139','Schedules the bays, very responsive.')
) AS p(company, full_name, first_name, last_name, title, email, phone, notes)
  ON p.company = co.name
WHERE w.slug = 'demo';

-- 6) Deals (10, all 7 stages)
INSERT INTO crm_deals (workspace_id, crm_company_id, primary_contact_id, title, stage, value_cents, close_date_est, notes, owner, probability, next_action_at, position)
SELECT w.id, co.id,
       (SELECT ct.id FROM crm_contacts ct WHERE ct.workspace_id = w.id AND ct.full_name = d.contact),
       d.title, d.stage, d.value_cents, d.close_date, d.notes, 'Justin', d.probability,
       CASE WHEN d.next_days IS NULL THEN NULL ELSE now() + (d.next_days || ' days')::interval END,
       d.position
FROM workspaces w
JOIN crm_companies co ON co.workspace_id = w.id
JOIN (VALUES
  ('Harbor & Pine Coffee','Maya Ellison','Online ordering site + loyalty','proposal',780000,(CURRENT_DATE + 21)::date,'Proposal sent, follow up after tasting-room event.',60,2,1),
  ('Harbor & Pine Coffee','Dre Whitfield','Wholesale portal (phase 2)','discovery',450000,(CURRENT_DATE + 60)::date,'Early convo, depends on phase 1.',20,7,2),
  ('Bluefin Logistics','Carl Renner','Dispatch automation build','scope',2400000,(CURRENT_DATE + 45)::date,'Scoping workshop booked. Bring ROI model.',35,3,1),
  ('Crestline Dental Group','Dr. Priya Nandakumar','Recall + review automation','proposal',960000,(CURRENT_DATE + 14)::date,'Two options in proposal. Beth wants training included.',55,1,2),
  ('Summit Ridge HVAC','Gus Marino','Website rebuild + local SEO','build',520000,(CURRENT_DATE + 10)::date,'Signed. Build underway, launch in 2 weeks.',90,5,1),
  ('Verde Lawn & Landscape','Marcus Verde','Growth retainer','live',150000,NULL,'Live since spring. Monthly retainer, quarterly review.',100,NULL,1),
  ('Ironvale Fitness','Jess Kowalski','Member app + churn dashboards','discovery',1800000,(CURRENT_DATE + 90)::date,'Both owners on next call. Budget unclear.',15,4,3),
  ('Copperleaf Realty','Angela Copperleaf','Agent lead-routing CRM','live',1200000,NULL,'Delivered last month. Support window active.',100,NULL,2),
  ('Northgate Auto Spa','Ray Delgado','Membership billing site','lost',380000,NULL,'Went with a franchise package. Revisit next year.',0,NULL,1),
  ('Copperleaf Realty','Devon Hart','Zapier cleanup mini-project','disqualified',90000,NULL,'Too small, referred to a freelancer.',0,NULL,3)
) AS d(company, contact, title, stage, value_cents, close_date, notes, probability, next_days, position)
  ON d.company = co.name
WHERE w.slug = 'demo';

-- 7) Activities (6)
INSERT INTO crm_activities (workspace_id, deal_id, crm_company_id, contact_id, type, body, occurred_at, created_by)
SELECT w.id, dl.id, dl.crm_company_id, dl.primary_contact_id, a.type, a.body,
       now() - (a.days_ago || ' days')::interval,
       (SELECT id FROM auth.users WHERE lower(email) = 'justin@niewdel.com')
FROM workspaces w
JOIN crm_deals dl ON dl.workspace_id = w.id
JOIN (VALUES
  ('Online ordering site + loyalty','meeting','Tasting-room walkthrough. Maya wants loyalty tied to the POS. Proposal covers both paths.',6),
  ('Online ordering site + loyalty','email','Sent proposal. Flagged the 30-day pricing window.',2),
  ('Dispatch automation build','call','Carl wants hard numbers: hours saved per dispatcher per week. Building the ROI sheet.',4),
  ('Recall + review automation','note','Beth confirmed they lose ~30 recalls/month to manual follow-up. That is the headline stat.',3),
  ('Website rebuild + local SEO','note','Kickoff done. Sitemap approved, copy draft due Friday.',5),
  ('Growth retainer','meeting','Quarterly review. Verde up 22% YoY on booked jobs. Renewal safe.',12)
) AS a(deal_title, type, body, days_ago)
  ON a.deal_title = dl.title
WHERE w.slug = 'demo';

-- 8) Tasks (4: one overdue, two upcoming, one done)
INSERT INTO crm_tasks (workspace_id, deal_id, title, due_date, done, created_by)
SELECT w.id, dl.id, t.title, (CURRENT_DATE + t.due_offset)::date, t.done,
       (SELECT id FROM auth.users WHERE lower(email) = 'justin@niewdel.com')
FROM workspaces w
JOIN crm_deals dl ON dl.workspace_id = w.id
JOIN (VALUES
  ('Online ordering site + loyalty','Follow up on proposal with Maya',2,false),
  ('Dispatch automation build','Send Carl the ROI model',-1,false),
  ('Recall + review automation','Book training session with Beth',5,false),
  ('Website rebuild + local SEO','Approve sitemap',-3,true)
) AS t(deal_title, title, due_offset, done)
  ON t.deal_title = dl.title
WHERE w.slug = 'demo';

-- 9) Proposals (2) + line items
-- 9a) Sent website-build proposal for Harbor & Pine
INSERT INTO crm_proposals (workspace_id, deal_id, crm_company_id, primary_contact_id, type, status, title, theme, content, proposal_date, validity_days, prepared_by, subtotal_cents, recurring_monthly_cents, deposit_cents, sent_at, requires_dual_sign, created_by)
SELECT w.id, dl.id, dl.crm_company_id, dl.primary_contact_id, 'website_build', 'sent',
  'Harbor & Pine — Online Ordering + Loyalty', 'dark',
  $json$[
    {"type":"cover","kicker":"PROPOSAL","headline":"Online ordering that pays for itself","intro":"A fast site with online ordering and a loyalty program tied to your counter POS. Start simple. Built to grow.","preparedFor":"Maya Ellison, Harbor & Pine Coffee","preparedBy":"Justin Ledwein, Niewdel","validityDate":"{{validity_date}}"},
    {"type":"situation","heading":"The situation","body":"Three locations, strong walk-in trade, zero online ordering. Regulars ask for it weekly and the current site cannot take an order. Every missed mobile order is margin handed to the marketplace apps."},
    {"type":"scope","heading":"What you get","rows":[{"capability":"Ordering site","whatYouGet":"Menu, modifiers, pickup windows, POS-synced pricing"},{"capability":"Loyalty","whatYouGet":"Points on every order, counter and online, one balance"},{"capability":"Owner dashboard","whatYouGet":"Orders, top items, repeat-customer rate"}]},
    {"type":"timeline","heading":"Timeline","totalDuration":"4 weeks","phases":[{"label":"Design","duration":"1 week","detail":"Menu structure + brand pass"},{"label":"Build","duration":"2 weeks","detail":"Ordering, loyalty, POS sync"},{"label":"Launch","duration":"1 week","detail":"Staff training + soft launch"}]},
    {"type":"investment","heading":"Investment","note":"One-time build. 50% deposit to schedule, balance at launch. Care plan optional, cancel anytime."},
    {"type":"payment_terms","heading":"Payment terms","body":"50% deposit to lock the start date. Balance due at launch. Care plan bills monthly starting 30 days after launch."},
    {"type":"next_steps","heading":"Next steps","steps":["Review the scope and investment.","Reply with any questions, no obligation.","Sign to lock in the start date.","Kickoff call within 48 hours of signature."],"approvalWindow":"Pricing held for 30 days from proposal date."},
    {"type":"acceptance","heading":"Acceptance","body":"Signing below accepts the scope, timeline, and payment terms above.","dual":false}
  ]$json$::jsonb,
  CURRENT_DATE - 2, 30, 'Justin Ledwein', 780000, 15000, 390000, now() - interval '2 days', false,
  (SELECT id FROM auth.users WHERE lower(email) = 'justin@niewdel.com')
FROM workspaces w
JOIN crm_deals dl ON dl.workspace_id = w.id AND dl.title = 'Online ordering site + loyalty'
WHERE w.slug = 'demo';

INSERT INTO crm_proposal_line_items (workspace_id, proposal_id, kind, label, description, badge, amount_cents, cadence, recurring_months, option_group, is_optional, is_selected, position)
SELECT p.workspace_id, p.id, li.kind, li.label, li.description, li.badge, li.amount_cents, li.cadence, li.recurring_months, li.option_group, li.is_optional, li.is_selected, li.position
FROM crm_proposals p
JOIN (VALUES
  ('one_time','Ordering site build','Design, build, POS sync, launch',NULL,650000,'one_time',NULL,NULL,false,true,1),
  ('one_time','Loyalty program setup','Points engine + counter integration',NULL,130000,'one_time',NULL,NULL,false,true,2),
  ('recurring','Care plan','Hosting, updates, menu changes, support','Recommended',15000,'per_month',12,NULL,true,true,3),
  ('handoff','Own it outright','We hand off hosting + training at launch',NULL,90000,'at_handoff',NULL,'path',true,false,4)
) AS li(kind, label, description, badge, amount_cents, cadence, recurring_months, option_group, is_optional, is_selected, position)
  ON true
WHERE p.title = 'Harbor & Pine — Online Ordering + Loyalty'
  AND p.workspace_id = (SELECT id FROM workspaces WHERE slug = 'demo');

-- 9b) Draft retainer proposal for Crestline (dual-sign)
INSERT INTO crm_proposals (workspace_id, deal_id, crm_company_id, primary_contact_id, type, status, title, theme, content, proposal_date, validity_days, prepared_by, subtotal_cents, recurring_monthly_cents, deposit_cents, requires_dual_sign, created_by)
SELECT w.id, dl.id, dl.crm_company_id, dl.primary_contact_id, 'retainer', 'draft',
  'Crestline Dental — Automation Retainer', 'dark',
  $json$[
    {"type":"cover","kicker":"AGREEMENT","headline":"Recall and reviews on autopilot","intro":"A monthly retainer that keeps recalls, reviews, and reporting running without your front desk chasing anyone.","preparedFor":"Dr. Priya Nandakumar, Crestline Dental Group","preparedBy":"Justin Ledwein, Niewdel","validityDate":"{{validity_date}}"},
    {"type":"situation","heading":"The situation","body":"Roughly 30 recalls a month slip through manual follow-up across two practices. Reviews trail the competition on every map pack. Both are automation problems, not effort problems."},
    {"type":"recurring_plan","heading":"The plan","planName":"Practice Growth Retainer","monthlyCents":250000,"cadenceNote":"Monthly, 6-month initial term, then month to month.","features":["Recall sequences (SMS + email)","Review requests after every visit","Monthly report with recall recovery count","Priority support, 1 business day"]},
    {"type":"payment_terms","heading":"Payment terms","body":"Bills monthly on the 1st. First invoice covers setup month. 6-month initial term, then month to month with 30 days notice."},
    {"type":"liability","heading":"Liability and security","responsible":["Niewdel is responsible for the work described in the scope above.","Niewdel will notify the client within 24 hours of any suspected compromise."],"notResponsible":["Niewdel is not responsible for outcomes outside the agreed scope.","Niewdel is not responsible for third-party platform outages or policy changes."],"liabilityCap":"Liability cap: greater of total fees paid or one month of retainer fees.","clientObligations":["Provide timely access to accounts, content, and approvals.","Notify Niewdel within 24 hours of any suspected compromise."]},
    {"type":"next_steps","heading":"Next steps","steps":["Review the plan and terms.","Reply with any questions, no obligation.","Both parties sign to start the clock.","Setup begins within 3 business days."],"approvalWindow":"Pricing held for 30 days from proposal date."},
    {"type":"acceptance","heading":"Acceptance","body":"This agreement takes effect when signed by both parties.","dual":true}
  ]$json$::jsonb,
  CURRENT_DATE, 30, 'Justin Ledwein', 0, 250000, 0, true,
  (SELECT id FROM auth.users WHERE lower(email) = 'justin@niewdel.com')
FROM workspaces w
JOIN crm_deals dl ON dl.workspace_id = w.id AND dl.title = 'Recall + review automation'
WHERE w.slug = 'demo';

INSERT INTO crm_proposal_line_items (workspace_id, proposal_id, kind, label, description, badge, amount_cents, cadence, recurring_months, option_group, is_optional, is_selected, position)
SELECT p.workspace_id, p.id, li.kind, li.label, li.description, li.badge, li.amount_cents, li.cadence, li.recurring_months, li.option_group, li.is_optional, li.is_selected, li.position
FROM crm_proposals p
JOIN (VALUES
  ('recurring','Practice Growth Retainer','Recall + review automation, reporting, support',NULL,250000,'per_month',6,NULL,false,true,1),
  ('one_time','Onboarding + setup','Sequences, integrations, staff training','Waived',0,'upfront',NULL,NULL,false,true,2)
) AS li(kind, label, description, badge, amount_cents, cadence, recurring_months, option_group, is_optional, is_selected, position)
  ON true
WHERE p.title = 'Crestline Dental — Automation Retainer'
  AND p.workspace_id = (SELECT id FROM workspaces WHERE slug = 'demo');
