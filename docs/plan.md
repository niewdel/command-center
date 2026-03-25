# Plan — Command Center

## Execution Phases

---

### Phase 5A: Foundation + Task MVP
**Goal:** Get a working task tracker live that Justin can use immediately.

**Entry conditions:** Architecture approved.

| # | Task | Acceptance Criteria |
|---|------|-------------------|
| 5A.1 | Initialize Next.js project with App Router, Tailwind, shadcn/ui | `npx create-next-app` runs, Tailwind configured, shadcn/ui initialized, app renders on `localhost:3000` |
| 5A.2 | Set up Supabase project + connect | Supabase project created, env vars configured, `@supabase/supabase-js` installed, client helper created, connection verified |
| 5A.3 | Create database schema (workspaces, tasks, tags, taggables) | Tables created via Supabase SQL editor matching architecture.md schema; seed 3 workspaces (Niewdel, i10, Personal) |
| 5A.4 | Set up Supabase Auth (email/password) | Sign-up, sign-in, sign-out working; auth middleware protects all routes; session persists across refreshes |
| 5A.5 | Build app shell — sidebar nav + workspace switcher | Left sidebar with Dashboard, Niewdel, i10, Personal links; active state highlighting; collapses to icons on mobile; workspace context persists in URL |
| 5A.6 | Build Dashboard page — task list view | Dashboard shows all tasks across workspaces; each task shows title, workspace tag, priority, due date; sorted by due date (overdue first); empty state when no tasks |
| 5A.7 | Build task CRUD — create, edit, complete, delete | Quick-add form on dashboard (title, workspace, priority, due date); click task to edit inline or in modal; checkbox to complete; delete with confirmation; changes persist to Supabase |
| 5A.8 | Add task filtering + workspace tags on dashboard | Filter tasks by workspace (all / Niewdel / i10 / Personal); filter by status (active / completed); filter by priority; workspace tag badges visible on each task |
| 5A.9 | Set up PWA manifest + service worker | `manifest.json` configured, apple meta tags added, `@ducanh2912/next-pwa` configured, app installable on iPhone home screen, basic offline shell |
| 5A.10 | Deploy to Railway + GitHub auto-deploy | Railway project created, linked to GitHub repo, `main` branch auto-deploys, app accessible at Railway URL, env vars configured in Railway |
| 5A.11 | Supabase Realtime for task updates | Task changes sync across tabs/devices in real-time; visibility change handler reconnects Realtime on iOS foreground |

**Exit conditions:** Justin can open the app on his phone, add tasks, mark them complete, filter by workspace. Deployed and live.

---

### Phase 5B: Telegram Bot
**Goal:** Frictionless task capture from phone via text or voice.

**Entry conditions:** Phase 5A complete (tasks CRUD working, Supabase schema live).

| # | Task | Acceptance Criteria |
|---|------|-------------------|
| 5B.1 | Create Telegram bot via BotFather | Bot created, token stored in Railway env var, bot responds to `/start` |
| 5B.2 | Set up grammY + webhook endpoint | `/api/telegram/webhook` API route created; grammY handles incoming updates; webhook registered with Telegram; secret token verification working |
| 5B.3 | Text message → task creation | Send a text message to the bot → task created in Supabase with title parsed from message; bot sends confirmation with task details |
| 5B.4 | Voice message → transcription → task | Send voice note → bot downloads audio → Whisper API transcribes → task created; bot confirms with transcribed text |
| 5B.5 | AI auto-categorization | Bot detects workspace (Niewdel/i10/Personal) and client (HD Grading etc.) from message content; keyword fast-path + GPT-4o-mini fallback; bot shows detected category in confirmation |
| 5B.6 | Inline keyboard for task refinement | After task creation, bot shows buttons: set priority (low/med/high), assign project, set due date; tapping a button updates the task |

**Exit conditions:** Justin can text or voice-note a task to the Telegram bot from anywhere; task appears in Command Center dashboard with correct workspace and client tagging.

---

### Phase 5C: Workspace Structure + Client Pages
**Goal:** Separate workspace views with client sub-workspaces for Niewdel.

**Entry conditions:** Phase 5A complete.

| # | Task | Acceptance Criteria |
|---|------|-------------------|
| 5C.1 | Create clients + projects tables (if not in 5A.3) | Schema for clients and projects live; HD Grading seeded as a Niewdel client |
| 5C.2 | Build Niewdel workspace page | Niewdel page shows: client list, internal ops tasks, marketing tasks; only Niewdel data visible |
| 5C.3 | Build client workspace page (HD Grading) | Client page shows: important notes (editable markdown), deadlines section, important links (add/remove/edit), linked projects list |
| 5C.4 | Build lightweight client view | For smaller clients: task list + notes tied to client name; no full project workspace |
| 5C.5 | Build project pages | Project page shows: description, status, linked tasks, notes; tasks can be created directly within a project |
| 5C.6 | Build i10 workspace page | i10 page shows: tasks (including HubSpot-synced), training engagement tracker, notes; only i10 data visible |
| 5C.7 | Build Personal workspace page | Personal page shows: tasks, notes/lists, goals; completely separated from business content |
| 5C.8 | Build Kanban view for tasks | Toggle between list view and Kanban (Backlog / In Progress / Done); drag-and-drop to change status; available on dashboard and workspace pages |

**Exit conditions:** All three workspaces have dedicated pages with appropriate content. HD Grading has a full client workspace. Kleinere clients have lightweight views.

---

### Phase 5D: Notes, Meeting Log + Fathom
**Goal:** Note-taking system with automatic meeting ingestion from Fathom.

**Entry conditions:** Phase 5C complete (workspace structure exists).

| # | Task | Acceptance Criteria |
|---|------|-------------------|
| 5D.1 | Build notes CRUD with markdown editor | Create/edit/delete notes; markdown editor with preview; notes linked to workspace, optionally to client/project |
| 5D.2 | Build meeting log view | Chronological list of meetings; search by title/content; meeting entries show: title, date, attendees, summary |
| 5D.3 | Set up Zapier → Supabase edge function for Fathom | Zapier zap configured: Fathom "New Call Summary" trigger → POST to Supabase edge function; edge function parses and inserts into notes table with `type = 'meeting'` |
| 5D.4 | Auto-generate tasks from Fathom action items | Edge function parses action items from Fathom summary → creates tasks with `source = 'fathom'`; tasks appear on dashboard with "Fathom" source badge |
| 5D.5 | Link meeting notes to clients/projects | Auto-detect client/project from attendees or meeting title; manual override available |

**Exit conditions:** Notes work as a standalone feature. Fathom meetings auto-appear in the meeting log. Action items from meetings auto-generate tasks on the dashboard.

---

### Phase 5E: HubSpot Sync
**Goal:** i10 HubSpot tasks flow into Command Center automatically.

**Entry conditions:** Phase 5A complete (tasks table exists).

| # | Task | Acceptance Criteria |
|---|------|-------------------|
| 5E.1 | Create HubSpot Private App (guided walkthrough with Justin) | Private app created on i10 HubSpot portal with `crm.objects.tasks.read` and `crm.objects.owners.read` scopes; token stored in Railway env var |
| 5E.2 | Build HubSpot sync function | Edge function or cron job: fetch tasks by owner via search endpoint → upsert into `hubspot_tasks` table → create/update corresponding entries in `tasks` table with `source = 'hubspot'` |
| 5E.3 | Schedule 5-min polling | Sync runs automatically every 5 minutes; sync_log entries created for each run; errors logged, don't crash the sync |
| 5E.4 | Display HubSpot tasks on dashboard + i10 page | HubSpot tasks appear with "HubSpot" source badge; status/priority mapped correctly; clicking opens HubSpot task detail |
| 5E.5 | Training engagement tracker | Dedicated view on i10 page showing ongoing training engagements; derived from HubSpot deals or custom objects |

**Exit conditions:** HubSpot tasks for Justin auto-sync into Command Center. i10 page shows all HubSpot tasks + training engagements. Dashboard includes HubSpot tasks in the unified view.

---

### Phase 5F: Goals, Planning & Polish
**Goal:** Morning planning routine, goal tracking, and UX polish.

**Entry conditions:** Phases 5A-5E substantially complete.

| # | Task | Acceptance Criteria |
|---|------|-------------------|
| 5F.1 | Build goals module | Create/edit goals per workspace; business and personal goal types; status tracking (active/completed); target dates |
| 5F.2 | Morning planning mode | On first open of the day: show prompt to set top 3 priorities; show overdue tasks requiring attention; show today's deadlines; dismissible after review |
| 5F.3 | End-of-day review prompt | Evening prompt: show incomplete tasks from today; option to reschedule or mark done; brief summary of completed work |
| 5F.4 | Global search (Cmd+K) | Search across all workspaces — tasks, notes, clients, projects; results grouped by type; keyboard-navigable |
| 5F.5 | Recurring tasks | Tasks can be set as recurring with frequency (daily/weekly/monthly/custom); completed recurring task auto-generates next occurrence |
| 5F.6 | Push notifications (PWA) | Overdue task reminders; deadline approaching alerts; configurable notification preferences |
| 5F.7 | UI polish pass | Consistent spacing, loading states, error states, empty states, transitions; mobile UX audit; accessibility basics |

**Exit conditions:** Command Center is a complete daily-driver productivity system. Morning planning, task capture, workspace management, meeting notes, HubSpot sync, and goal tracking all functional.

---

### Phase 5G: Calendar Integration (Deferred)
**Goal:** Read-only calendar view showing today's meetings alongside tasks.

**Entry conditions:** Justin confirms Outlook Graph API access works OR ICS fallback acceptable. All prior phases complete.

| # | Task | Acceptance Criteria |
|---|------|-------------------|
| 5G.1 | Test Outlook Graph API access against Sandler tenant | Determine if user consent works or if ICS fallback is needed |
| 5G.2 | Build calendar provider (adapter pattern) | GraphCalendarProvider or ICSCalendarProvider implementing shared interface |
| 5G.3 | Display today's calendar on dashboard | Read-only view of today's meetings; time, title, attendees visible |
| 5G.4 | Calendar page with week/month view | Broader calendar view showing meetings + task deadlines + project milestones |

**Exit conditions:** Dashboard shows today's meetings. Calendar page provides broader time-based view.

---

## Parallel Execution Notes

- **5B (Telegram) and 5C (Workspaces) can run in parallel** after 5A is complete
- **5D (Notes/Fathom) depends on 5C** (needs workspace structure)
- **5E (HubSpot) can run in parallel with 5C/5D** — only depends on 5A (tasks table)
- **5F (Goals/Polish) is the final layer** — depends on most prior phases
- **5G (Calendar) is fully independent** and deferred

```
5A (Foundation + Task MVP)
├── 5B (Telegram Bot)      ← parallel
├── 5C (Workspaces)        ← parallel
│   └── 5D (Notes/Fathom)  ← depends on 5C
├── 5E (HubSpot Sync)      ← parallel with 5C/5D
└── 5F (Goals/Polish)      ← after 5A-5E
    └── 5G (Calendar)      ← deferred
```
