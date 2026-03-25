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

