# COMMAND CENTER — Project Instruction Manual

## Project Description
Command Center is a modular, full-stack productivity platform replacing Notion. Consolidates task management, project management, meeting notes (Fathom), and calendar integration into a single owned system. Built as a personal tool today, architected for future SaaS resale.

## Owner Context
- **Justin Ledwein** — Owner of Niewdel (AI & Automation consulting), Head of Client Relations at Sandler by i10 Solutions (Charlotte, NC)
- This is a tool Justin will use daily to run both businesses — it needs to actually work for his workflow, not just look good
- Justin moves fast, prefers 80% plans executed over 100% plans delayed
- Direct communication — skip explanations of things he already knows, challenge assumptions when it matters
- Deep expertise in CRM/workflow automation, HubSpot, conversational intelligence — leverage this, don't over-explain integrations

## Tech Stack
| Layer | Technology |
|-------|-----------|
| Frontend | React (Next.js) — responsive/PWA |
| Backend/DB | Supabase (Postgres, Auth, Realtime, Storage) |
| Hosting | Railway (auto-deploy from GitHub main) |
| Auth | Supabase Auth (email/password + future OAuth) |
| Version Control | GitHub |
| IDE | Cursor with Claude Code |

## Core Modules
1. **Task Management** — Kanban + list view, priorities, due dates, recurring tasks
2. **Project Hub** — Project spaces with scope, deliverables, timeline, linked files, roll-up dashboard
3. **Notes & Meeting Log** — Markdown notes, auto-link to clients/projects, follow-ups → tasks
4. **Calendar/Timeline** — Outlook (Graph API) + Apple Calendar (CalDAV), task deadlines + milestones
5. **Dashboard (Home Base)** — Today's priorities, overdue items, deadlines, activity feed, quick-add

## Integrations
- HubSpot API (contacts, deals, companies → Client Tracker, optional two-way sync)
- Outlook Calendar (Microsoft Graph API — read/write events → Meeting Log)
- Apple Calendar (CalDAV / .ics — most complex, scope early)
- GitHub (baked into Railway deploy pipeline)

## Design Principles
- Modular (each module standalone or together)
- Markdown-based notes for portability
- Universal tagging across all modules
- Global search across everything
- Clean, minimal UI — no clutter
- Role-based access for future team/resale
- Mobile-first responsive via PWA

## File Map
| File | Purpose |
|------|---------|
| `CLAUDE.md` | This file — read first every session |
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
**Phase 1: Discovery** — In Progress
