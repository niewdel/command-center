---
tags: [niewdel, command-center, decisions]
---

# Decisions — Command Center

## Decision Log

| # | Date | Decision | Alternatives Considered | Reasoning |
|---|------|----------|------------------------|-----------|
| 1 | 2026-03-25 | Use 7-file project management system | Ad-hoc planning, single doc | Structured approach ensures persistent context across sessions and prevents decision drift |
| 2 | 2026-03-25 | Telegram bot for task capture (not SMS) | Twilio SMS, PWA quick-add only | Free, richer (buttons, voice), Justin already uses Telegram daily |
| 3 | 2026-03-25 | Skip Apple Calendar — Outlook only | Support both, Apple Calendar via CalDAV | Justin switching to Microsoft; CalDAV is complex; reduces scope |
| 4 | 2026-03-25 | Skip calendar integration entirely for V1 | Build with Graph API or ICS fallback | Sandler tenant access uncertain; calendar is not critical path for task tracking MVP; add back later |
| 5 | 2026-03-25 | Single-user, no RBAC for V1 | Build multi-tenant from start | SaaS is a distant maybe; single-user removes massive complexity from every feature |
| 6 | 2026-03-25 | Remove Client Tracker from scope | Build HubSpot → CRM view | Justin doesn't need it; HubSpot integration limited to task sync |
| 7 | 2026-03-25 | Fathom integration via Zapier (not direct API) | Direct API, HubSpot relay, manual paste | No public Fathom API exists; Zapier has official integration with meeting triggers |
| 8 | 2026-03-25 | HubSpot Private App + polling (not webhooks) | OAuth app with webhooks | Private app is simpler; polling every 5 min is fine for personal dashboard; webhooks require OAuth app |
| 9 | 2026-03-25 | grammY for Telegram bot (not Telegraf) | Telegraf, node-telegram-bot-api | TypeScript-first, active development, built-in Next.js webhook adapter |
| 10 | 2026-04-24 | PIN login ALSO signs into Supabase Auth; restore hardened RLS after | Keep permissive RLS forever; route everything through service role | 2026-04-22 "harden_rls" migration (applied via MCP) broke PIN-only app because policies require `auth.uid()`. Migration 015 restored permissive RLS as a stopgap. Migration 016 re-hardens RLS once PIN route calls `signInWithPassword` server-side, giving every device a real Supabase session and a valid `auth.uid()`. |
| 11 | 2026-04-27 | Merge lead-generator + site-audit into command-center as new tabs (not separate Railway services) | Iframe linked deploys; multi-service Railway project; monorepo refactor | Justin wants one platform with paste-URL → audit results inline, no second deploy, no local CLI. Lead-gen is same stack (clean port). Site-audit needs Chromium on Railway via nixpacks.toml (Hobby plan has plenty of RAM). Lead-gen Phase 1 ships first; site-audit Phase 2 next session. |
| 12 | 2026-04-27 | Lead-gen schema preserved as-is (org_id-scoped) with permissive RLS for now | Refactor to user_id directly; merge with workspaces | Keeping the org_id structure means the existing lead-gen CLI engine in ~/lead-generator/ works unchanged after pointing its SUPABASE_URL at command-center's project. Migration 016 re-harden was extended to scope lead tables via organizations.user_id when it eventually runs. |
| 13 | 2026-04-27 | Old lead-gen Supabase project decommissioned (NXDOMAIN); start fresh | Recover data via support; dump from any cached backup | Free-tier Supabase projects are paused after a week of inactivity then deleted. iubbppdaprqmkfuyjcbd.supabase.co no longer resolves. Justin will rerun the CLI engine to repopulate when ready. |

