# COMMAND CENTER — Project Instruction Manual

## Project Description
Command Center is a unified operations platform that consolidates CRM data, calendars, email, messaging, and task management into a single interface. Built as a personal tool for a solo operator managing multiple businesses, architected for future SaaS resale. Data lives where it lives — Command Center reads, summarizes, and links it.

**Current owner:** Justin Ledwein / Niewdel, LLC
**Future state:** Multi-tenant SaaS with white-label support
**Every architecture decision should account for both states.**

## Owner Context
- **Justin Ledwein** — Owner of Niewdel (AI & Automation consulting), Head of Client Relations at Sandler by i10 Solutions (Charlotte, NC)
- This is a tool Justin will use daily to run both businesses — it needs to actually work for his workflow, not just look good
- Justin moves fast, prefers 80% plans executed over 100% plans delayed
- Direct communication — skip explanations of things he already knows, challenge assumptions when it matters
- Deep expertise in CRM/workflow automation, HubSpot, conversational intelligence — leverage this, don't over-explain integrations

## Tech Stack
| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 16 (App Router), React 19, TypeScript |
| Styling | Tailwind CSS 4 + shadcn/ui + CSS custom properties |
| Backend | Next.js API routes + Supabase |
| Database | Supabase (Postgres) |
| Auth | Supabase Auth (email/password + future OAuth) |
| Real-time | Supabase Realtime subscriptions |
| Hosting | Railway (auto-deploy from GitHub main) |
| Version Control | GitHub |
| IDE | Cursor with Claude Code |
| Mobile | Progressive Web App (PWA) |

## Core Modules
1. **Task Management** — Kanban + list view, priorities, due dates, recurring tasks
2. **Project Hub** — Project spaces with scope, deliverables, timeline, linked files, roll-up dashboard
3. **Notes & Meeting Log** — Markdown notes, auto-link to clients/projects, follow-ups → tasks
4. **Calendar/Timeline** — Outlook (Graph API) + Google Calendar, task deadlines + milestones
5. **Dashboard (Home Base)** — Today's priorities, overdue items, capacity bar, morning/shutdown rituals
6. **Content Digester** — Slack → YouTube/Instagram → Claude analysis → step-by-step guides

## Day 1 Integrations
Each integration follows: OAuth → initial sync → webhook listener → periodic sync → token refresh

- **HubSpot** — Contacts, companies, deals, activities (OAuth 2.0, webhook-primary + daily full sync)
- **Microsoft Graph** — Outlook Calendar + Email (OAuth 2.0, Graph subscriptions + delta queries)
- **Google Calendar** — Calendar events (OAuth 2.0, push notifications + sync tokens)
- **Gmail** — Email in unified inbox (OAuth 2.0, Pub/Sub push notifications)
- **Slack** — DMs and mentions in unified inbox (OAuth 2.0, Events API)
- **GitHub** — baked into Railway deploy pipeline

## Design System

### Baseline UI Rules (enforced)
- NO gradients — solid colors only
- NO colored/glow shadows — use shadow-sm, shadow-md, shadow-lg from Tailwind defaults
- NO tracking-* (letter-spacing) modifications
- Use `text-balance` on headings, `text-pretty` on body/paragraphs
- Use `h-dvh` not `h-screen`
- Use `size-N` for square elements instead of `h-N w-N`
- Use `rounded-lg` for buttons/containers (not rounded-xl)
- Fixed z-index scale: z-10 (sticky), z-20 (header), z-30 (overlay), z-40 (modal/sheet/dialog)
- Use `transition-colors` where only colors change (not transition-all)
- Add `aria-label` to icon-only buttons
- Primary buttons: `bg-foreground text-background`
- No backdrop-blur on large surfaces

### Color Tokens
Dark mode is the default. Colors are controlled via CSS custom properties for future white-label/tenant theming. See `COMMAND_CENTER_SKILL.md` for the full token spec.

### Typography
- Headings: Inter, weight 600-700, `text-balance`
- Body: Inter, weight 400, `text-pretty`
- Mono: JetBrains Mono / Fira Code
- Use `tabular-nums` for data

### Component Patterns
- Use existing shadcn/ui components first
- Use accessible primitives (Base UI, Radix) for keyboard/focus behavior
- Loading states: skeleton placeholders preferred over full-page spinners
- Empty states: always show a message + suggested action

## Architecture

### Multi-Tenant Prep
- All future tables include `tenant_id` with RLS scoped by tenant
- Every query scoped by tenant via Row Level Security — no exceptions
- Tenant config overrides design tokens at runtime (CSS custom properties)

### API Route Security
Every API route must:
1. Verify the Supabase session token
2. Scope all queries by authenticated user (or tenant)
3. Validate input (Zod schemas recommended)
4. Return structured errors, never leak stack traces

### Webhook Security
Verify signatures for every provider: HubSpot (`X-HubSpot-Signature-v3`), Microsoft Graph (subscription tokens), Google (Pub/Sub source), Slack (`X-Slack-Signature`).

### Token Storage
- OAuth tokens encrypted at rest via Supabase Vault
- Never store tokens in plain text, localStorage, or client-accessible state
- Token refresh runs server-side only

## File Map
| File | Purpose |
|------|---------|
| `CLAUDE.md` | This file — read first every session |
| `COMMAND_CENTER_SKILL.md` | Full design system, architecture, and integration specs |
| `docs/discovery.md` | Scoping Q&A and key insights |
| `docs/research.md` | Domain research with sources |
| `docs/architecture.md` | Key decisions with rationale |
| `docs/plan.md` | Phased task breakdown with acceptance criteria |
| `docs/progress.md` | Status tracker — read first, update last |
| `docs/decisions.md` | Running decision log |

## Session Rules
1. Start every session: read CLAUDE.md → progress.md
2. Before working: confirm task + acceptance criteria
3. After working: update progress.md
4. Significant decisions → log in decisions.md
5. Conflicting info between docs → flag it, don't silently resolve
6. Never reverse a logged decision without Justin's approval
7. Unsure → ask, don't guess
8. End every session: status summary (done, next, blockers)

## Current Phase
**Phase 5: Execution** — Building core modules + baseline UI cleanup
