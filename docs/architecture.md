---
tags: [niewdel, command-center, architecture]
---

# Architecture — Command Center

## Entity & Workspace Structure

Command Center has three top-level **workspaces** plus a unified **Dashboard**:

```
Dashboard (Home Base)
├── Today's meetings (future — calendar deferred)
├── All tasks across all workspaces (filtered by tags)
├── Pressing deadlines
├── Morning planning prompt
└── Quick-add (task, note)

Niewdel (Business Ops Hub)
├── Pipeline / revenue tracking
├── Marketing tasks
├── Internal ops
├── Clients (sub-workspaces)
│   ├── HD Grading (full client workspace)
│   │   ├── Important notes
│   │   ├── Deadlines
│   │   ├── Important links
│   │   └── Projects (quoting tool, handbook, etc.)
│   └── [Other clients] (lightweight — task list + notes)
└── Goals (business)

i10 Solutions
├── HubSpot tasks (synced)
├── Training engagement tracker
├── Notes
└── Goals (business)

Personal
├── Tasks
├── Notes / lists
└── Goals (personal)
```

---

## Frontend Architecture

| Decision | Rationale |
|----------|-----------|
| Next.js App Router (not Pages Router) | App Router is the standard for new Next.js projects; better layouts, server components, streaming |
| Server components by default, client components where needed | Minimizes JS bundle; use client components for interactive elements (kanban drag, inline edit) |
| Tailwind CSS for styling | Fast iteration, no context-switching to CSS files, works well with component-based architecture |
| shadcn/ui as component library | Not a dependency — copies components into your codebase; high quality, fully customizable, Tailwind-based |
| PWA via @ducanh2912/next-pwa | Maintained fork with Workbox integration; handles SW registration, precaching, offline support |
| Mobile-first responsive design | Primary use on iPhone/iPad; desktop is secondary but must work well on MacBook |
| Sidebar navigation with workspace switching | Clean pattern for multi-workspace apps; sidebar shows workspaces + modules, collapses on mobile |

---

## Backend & Database

| Decision | Rationale |
|----------|-----------|
| Supabase (Postgres) as sole database | Auth, realtime, storage, and DB in one; eliminates multiple service integrations |
| Supabase Edge Functions for background jobs | Fathom webhook handler, HubSpot polling, Telegram webhook — all run as edge functions or Next.js API routes |
| Row-Level Security (RLS) disabled for V1 | Single-user app; RLS adds complexity with no security benefit when there's one user. Enable when/if multi-user |
| Supabase Realtime for live updates | Task changes reflect immediately across tabs/devices without polling |
| Service role key for server-side operations | Used by API routes and edge functions; never exposed client-side |

---

## Authentication & Authorization

| Decision | Rationale |
|----------|-----------|
| Supabase Auth with email/password only | Simplest path; no OAuth redirect issues in PWA; single user |
| No RBAC / roles for V1 | Single user; no access control needed |
| Session token in localStorage | Supabase default; persistent for home-screen PWAs on iOS |
| Reconnect Realtime on visibility change | iOS drops WebSocket when backgrounded; reconnect when app returns to foreground |

---

## Data Model

### Core Tables

```sql
-- Workspaces (Niewdel, i10, Personal)
workspaces (
  id uuid PK,
  name text NOT NULL,          -- "Niewdel", "i10 Solutions", "Personal"
  slug text UNIQUE NOT NULL,   -- "niewdel", "i10", "personal"
  type text NOT NULL,          -- "business" | "personal"
  created_at timestamptz
)

-- Clients (belong to a workspace, primarily Niewdel)
clients (
  id uuid PK,
  workspace_id uuid FK → workspaces,
  name text NOT NULL,          -- "HD Grading"
  type text NOT NULL,          -- "full" | "lightweight"
  notes text,                  -- important notes (markdown)
  links jsonb,                 -- array of {label, url}
  created_at timestamptz
)

-- Projects (belong to a client or directly to a workspace)
projects (
  id uuid PK,
  workspace_id uuid FK → workspaces,
  client_id uuid FK → clients (nullable),
  name text NOT NULL,
  description text,
  status text DEFAULT 'active', -- "active" | "completed" | "on_hold"
  created_at timestamptz
)

-- Tasks (the core entity — unified across all workspaces)
tasks (
  id uuid PK,
  workspace_id uuid FK → workspaces,
  project_id uuid FK → projects (nullable),
  client_id uuid FK → clients (nullable),
  title text NOT NULL,
  description text,
  status text DEFAULT 'todo',   -- "todo" | "in_progress" | "done"
  priority text DEFAULT 'none', -- "none" | "low" | "medium" | "high"
  due_date date,
  is_recurring boolean DEFAULT false,
  recurrence_rule text,         -- iCal RRULE format if recurring
  source text DEFAULT 'manual', -- "manual" | "telegram" | "fathom" | "hubspot"
  source_id text,               -- external ID for synced tasks
  completed_at timestamptz,
  created_at timestamptz
)

-- Tags (universal across all entities)
tags (
  id uuid PK,
  name text UNIQUE NOT NULL,
  color text
)

-- Tag assignments (polymorphic — links tags to any entity)
taggables (
  id uuid PK,
  tag_id uuid FK → tags,
  taggable_type text NOT NULL,  -- "task" | "project" | "note" | "client"
  taggable_id uuid NOT NULL
)

-- Notes & Meeting Log
notes (
  id uuid PK,
  workspace_id uuid FK → workspaces,
  client_id uuid FK → clients (nullable),
  project_id uuid FK → projects (nullable),
  title text NOT NULL,
  content text,                 -- markdown
  type text DEFAULT 'note',     -- "note" | "meeting"
  source text DEFAULT 'manual', -- "manual" | "fathom"
  source_id text,               -- Fathom meeting ID if applicable
  meeting_date timestamptz,     -- for meeting notes
  attendees jsonb,              -- for meeting notes
  created_at timestamptz
)

-- Goals
goals (
  id uuid PK,
  workspace_id uuid FK → workspaces,
  title text NOT NULL,
  description text,
  type text NOT NULL,           -- "business" | "personal"
  status text DEFAULT 'active', -- "active" | "completed" | "abandoned"
  target_date date,
  created_at timestamptz
)

-- HubSpot synced tasks (mirror table — keeps HubSpot data separate)
hubspot_tasks (
  id uuid PK,
  hubspot_id text UNIQUE NOT NULL,
  subject text,
  body text,
  status text,
  priority text,
  due_date timestamptz,
  owner_id text,
  last_synced_at timestamptz,
  raw_data jsonb                -- full HubSpot response for debugging
)

-- Sync log (for debugging integration issues)
sync_log (
  id uuid PK,
  source text NOT NULL,         -- "hubspot" | "fathom"
  status text NOT NULL,         -- "success" | "error"
  message text,
  created_at timestamptz
)
```

### Key Relationships
- Tasks are the **central entity** — they link to workspaces, optionally to projects and clients
- Dashboard queries ALL tasks across workspaces, filters by workspace tag
- Workspace pages query only their own tasks/projects/notes
- HubSpot tasks live in a separate mirror table; a sync process creates/updates corresponding entries in the main `tasks` table with `source = 'hubspot'`
- Fathom meetings land in `notes` with `type = 'meeting'` and auto-generate entries in `tasks` with `source = 'fathom'`

---

## Integrations

| Decision | Rationale |
|----------|-----------|
| Telegram bot via grammY + webhook on Railway | Task capture with voice support; shares createTask() logic with web app |
| Voice transcription via OpenAI Whisper API | Best accuracy for short-form voice notes; ~$0.006/min cost is negligible |
| Fathom via Zapier → Supabase Edge Function | No Fathom API; Zapier is the official integration path |
| HubSpot via Private App + 5-min polling | Simpler than OAuth; polling is sufficient for personal dashboard |
| AI task parsing via OpenAI GPT-4o-mini | Parse free-text/voice into structured task data; keyword fast-path for known clients |
| Calendar integration deferred post-V1 | Sandler tenant access uncertain; not critical for task tracking MVP |

---

## Deployment & Infrastructure

| Decision | Rationale |
|----------|-----------|
| Railway for hosting (auto-deploy from GitHub main) | Simple, fast deploys; good Next.js support; already chosen in brief |
| Supabase hosted (not self-hosted) | Managed service; no infrastructure overhead for a single-user app |
| Environment variables in Railway for all secrets | Bot tokens, API keys, Supabase service key — never in code |
| GitHub main branch = production | Push to main → auto-deploy; feature branches for larger changes |

---

## UX & Navigation Structure

| Decision | Rationale |
|----------|-----------|
| Left sidebar with workspace switcher | Standard pattern; workspaces in sidebar, content in main area |
| Dashboard as default/home view | First thing Justin sees — today's meetings, tasks, deadlines |
| Morning planning mode (opinionated) | On first open of the day: prompt to set top 3 priorities, review overdue |
| Quick-add floating button (mobile) | Fastest capture from any screen — tap, type, submit |
| Kanban + list toggle for tasks | Kanban for visual status; list for rapid execution mode |
| Workspace-scoped views | Niewdel page only shows Niewdel data; i10 only i10; Personal only personal |
| Unified search (Ctrl/Cmd+K) | Search across all workspaces — tasks, notes, clients, projects |

---

## Module Priority (Build Order)

Based on discovery: V1 needs task tracking in days, everything else layers on.

| Priority | Module | Why |
|----------|--------|-----|
| 1 | **Task Management + Dashboard** | Core value; Justin needs this immediately |
| 2 | **Telegram Bot** | Closes the capture gap — highest ROI after basic tasks |
| 3 | **Workspace Structure** | Niewdel/i10/Personal separation with client sub-workspaces |
| 4 | **Notes & Meeting Log** | Place to dump info; Fathom integration adds auto-follow-ups |
| 5 | **HubSpot Sync** | Pulls i10 tasks into unified dashboard |
| 6 | **Goals & Planning** | Morning routine, goal tracking — quality-of-life layer |
| 7 | **Calendar** (deferred) | Read-only view; add back when Outlook access is confirmed |
