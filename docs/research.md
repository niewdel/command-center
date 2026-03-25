# Research — Command Center

## 1. Fathom Integration

**Finding: No public REST API. Zapier/Make is the primary automation pathway.**

- Fathom does not expose a developer API as of early 2026
- Official Zapier integration exists with triggers: `New Meeting Recorded`, `New Call Summary`
- Available data via Zapier: meeting title, date, duration, attendees, summary text, action items, transcript, recording link
- No native outbound webhooks — Zapier acts as the webhook layer
- No bulk/historical export — automation only captures new meetings going forward

**Recommended approach:**
```
Fathom → Zapier ("New Call Summary" trigger) → POST to Supabase Edge Function
→ Parse action items into tasks, link to client by attendee matching
→ Meeting stored in Notes & Meeting Log module
```

**Alternative:** Fathom → HubSpot (native sync) → HubSpot API → Command Center. Avoids Zapier cost but adds an extra hop and HubSpot rate limits.

**Architecture note:** Build the meeting ingestion endpoint to accept a standard payload so the source (Zapier, future API, HubSpot relay) is swappable.

**Cost:** Zapier Free tier allows 100 tasks/month. At ~5 meetings/week (~20/month), free tier works. If each meeting generates multiple Zap steps, may need Starter ($19.99/mo).

---

## 2. Microsoft Graph API — Outlook Calendar

**Finding: Read-only calendar access likely works without Sandler IT admin consent. ICS fallback available.**

### Primary Path: Graph API (Delegated Permissions)

| Scope | Admin Consent Required? |
|-------|------------------------|
| `Calendars.Read` | **No** (user consent sufficient by default) |
| `Calendars.ReadBasic` | **No** |

`Calendars.Read` is classified as low-risk delegated permission. Justin can authorize it himself **unless** Sandler's tenant has explicitly disabled all user consent (Azure AD setting: "Do not allow user consent").

- Authentication: OAuth 2.0 delegated flow via multi-tenant Azure AD app registration
- Supports real-time webhook subscriptions for calendar changes
- Full event data: title, time, attendees, location, body

### Fallback Path: ICS Subscription URL

If Graph API consent is blocked:
- Outlook Web → Settings → Calendar → Shared calendars → Publish → generates ICS URL
- Simple HTTP GET (no auth — secret URL with embedded token)
- Poll every 10-15 minutes
- **Limitations:** 15-30 min publish delay, read-only, no webhooks, full dump each time (must diff), URL is a bearer token (if leaked, anyone can read calendar), some tenants may disable ICS publishing too

### Recommended Architecture
Build with an adapter pattern: `GraphCalendarProvider` and `ICSCalendarProvider` implementing the same interface. Try Graph first, fall back to ICS.

**Action required from Justin:** Try authorizing a test app with `Calendars.Read` against the Sandler tenant to see if user consent works. If blocked, check if ICS publishing is available.

---

## 3. Telegram Bot — Task Capture

**Finding: Fully viable. grammY + webhook on Railway + Whisper for voice.**

### Setup
1. Create bot via @BotFather in Telegram → receive API token
2. Register webhook: Telegram POSTs to `https://your-app.up.railway.app/api/telegram/webhook`
3. Use `secret_token` param for webhook verification

### Recommended Stack
- **Library:** grammY (TypeScript-first, built-in webhook adapter for Next.js API routes, active development)
- **Voice transcription:** OpenAI Whisper API (Telegram voice = OGG/Opus, download via `getFile`, send to Whisper)
- **Architecture:** Shared `createTask()` function used by both web UI and Telegram webhook handler — no HTTP hop, no duplicated logic

### Voice Message Flow
```
User voice note → Telegram bot receives message.voice
→ getFile() → download OGG audio → Whisper API transcription
→ AI parse (detect client/project, priority, due date) → createTask()
→ Bot sends confirmation with inline keyboard (priority, project, due date buttons)
```

### Rich Responses
- Inline keyboards for post-creation actions (set priority, assign project, add due date)
- Confirmation messages with task details
- `/start` command required from user to initiate (bots can't message first)

### Limits
- 30 msg/sec across chats, 1 msg/sec same chat — no issue for personal use
- 20MB file download limit — voice notes are ~100-300KB, no issue
- 4096 char message length

---

## 4. HubSpot Tasks API — i10 Sync

**Finding: Private app with polling. Needs Super Admin for one-time setup.**

### Authentication
- **Private App** is the right choice (no OAuth flow, long-lived bearer token)
- **Requires Super Admin** on the i10 HubSpot portal to create the app
- Token doesn't expire, stored in Railway env var

### Required Scopes
| Scope | Purpose |
|-------|---------|
| `crm.objects.tasks.read` | Read task objects |
| `crm.objects.owners.read` | Resolve assignee/owner data |

### Fetching Tasks by Assignee
```
POST /crm/v3/objects/tasks/search
```
Filter by `hubspot_owner_id` + `hs_task_status != COMPLETED`. Get owner ID via `GET /crm/v3/owners` (find by email).

### Key Task Fields
| Property | Description |
|----------|-------------|
| `hs_task_subject` | Task title |
| `hs_task_body` | Description (may contain HTML — sanitize) |
| `hs_task_status` | `NOT_STARTED`, `IN_PROGRESS`, `WAITING`, `COMPLETED`, `DEFERRED` |
| `hs_task_priority` | `NONE`, `LOW`, `MEDIUM`, `HIGH` |
| `hs_timestamp` | **Due date** (misleading name — NOT creation time) |
| `hubspot_owner_id` | Assigned user |

### Sync Strategy
- Poll every 5 minutes via cron/edge function
- Upsert into Supabase `hubspot_tasks` table keyed on HubSpot task ID
- Dashboard reads from Supabase (zero HubSpot latency on page load)
- Sync completed tasks less frequently (hourly)

### Rate Limits
- Free/Starter: 100 requests per 10 seconds, 250K/day
- Search endpoint: 4 requests/second (stricter)
- At 5-min polling with ~2-5 requests per cycle, nowhere near limits

### Gotchas
- `hs_timestamp` IS the due date (name is misleading)
- Task body can contain HTML — sanitize
- Search is eventually consistent (few seconds delay)
- Token is portal-wide (sees ALL tasks) — filter by owner in queries
- Webhooks only available for public/OAuth apps, not private apps — polling is the right call

---

## 5. PWA on iOS (iPhone/iPad)

**Finding: PWA is a solid choice for Command Center V1.**

### What Works
- Service workers (caching, offline support)
- Web App Manifest (standalone mode, icons, theme)
- **Push notifications** (since iOS 16.4 — home-screen installed PWAs only)
- IndexedDB/localStorage persistence for home-screen apps
- Add to Home Screen with standalone app switcher entry

### What Doesn't Work
- Background sync / background fetch
- Badge count on home screen icon
- No `beforeinstallprompt` — must instruct users manually (Share → Add to Home Screen)
- Aggressive service worker eviction after extended inactivity (not an issue for daily-use app)
- iPad Split View can be inconsistent

### EU Controversy (Resolved)
Apple threatened to remove PWA support in EU (iOS 17.4 beta, Feb 2024) due to DMA. Reversed after backlash in March 2024. PWAs remain fully supported globally.

### Next.js PWA Setup
- Use `@ducanh2912/next-pwa` (maintained fork of next-pwa) for Workbox integration
- Apple-specific meta tags required: `apple-mobile-web-app-capable`, `apple-mobile-web-app-status-bar-style`, `apple-touch-icon`
- Generate splash screens with `pwa-asset-generator`
- Use `viewport-fit=cover` + `env(safe-area-inset-*)` for notch/Dynamic Island

### Supabase Auth in PWA Context
- localStorage token storage (Supabase default) works fine for home-screen PWAs
- `autoRefreshToken` keeps sessions alive
- **Reconnect Supabase Realtime on visibility change** — iOS drops WebSocket connections when backgrounded:
```js
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') {
    supabase.realtime.connect();
  }
});
```
- Stick with email/password auth for V1 — OAuth redirect flows break in standalone PWAs (opens in-app browser, redirect doesn't return to PWA)

### Acceptable Tradeoffs for V1
- No background sync → data syncs on app open (Supabase Realtime catches up fast)
- No badge count → push notifications compensate
- No install prompt → one-time manual instruction

---

## 6. AI Auto-Categorization (Task Parsing)

**Not yet deeply researched. Preliminary approach:**

- For Telegram capture: use OpenAI GPT-4o-mini or Claude Haiku to parse free-text/transcribed voice into structured task data (title, client/project, priority, due date)
- Keyword matching as fast-path: detect "HD Grading", "i10", "Niewdel", "personal" before hitting AI
- AI as fallback for ambiguous input
- For Fathom follow-ups: parse Fathom's structured action items (already semi-structured from Zapier payload)

**Will refine during Architecture phase.**

---

## Conflicting Information Log

| Item | Conflict | Resolution |
|------|----------|------------|
| Fathom API access | Brief assumes direct API pull; research shows no public API exists | **Use Zapier as intermediary.** Fathom may launch an API in the future — architect for swappability. |
| Calendar integration | Brief scopes both Outlook + Apple Calendar; discovery decided Outlook only | **Apple Calendar removed from scope.** Justin switching everything to Microsoft. |
| HubSpot Client Tracker | Brief includes it; Justin said to remove it during discovery | **Removed from scope.** HubSpot integration limited to task sync for i10. |
| Outlook tenant access | Brief assumes Graph API access; may be blocked by Sandler corporate tenant | **Unresolved — needs testing.** Try user consent first; ICS fallback ready. Build with adapter pattern. |
