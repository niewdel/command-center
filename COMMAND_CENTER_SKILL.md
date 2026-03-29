---
name: command-center
description: Master skill file for the Command Center platform — a modular, multi-tenant productivity and operations hub built on Next.js, Supabase, and Railway. Use this skill for ALL work on the Command Center project including UI development, API routes, database changes, integration work, security hardening, testing, and deployment. This skill enforces design consistency, architecture patterns, security standards, and code quality across every session. Trigger this skill whenever the user mentions "command center", "dashboard app", "integration hub", "ops platform", or references any of the Day 1 integrations (HubSpot, Outlook, Google Calendar, Gmail, Slack) in the context of the Command Center build.
---

# Command Center — Master Skill File

## What This Is

Command Center is a unified operations platform that consolidates CRM data, calendars, email, messaging, and task management into a single interface. Built for a solo operator managing multiple businesses, designed for future SaaS resale.

The app pulls data from external tools (HubSpot, Outlook, Google Calendar, Gmail, Slack) and presents it in one place. It is NOT a replacement for those tools — it is the glue layer that connects them. Data lives where it lives. Command Center reads, summarizes, and links it.

**Current owner:** Single user (Leddy / Niewdel, LLC)
**Future state:** Multi-tenant SaaS with white-label support
**Every architecture decision should account for both states.**

---

## Tech Stack

| Layer            | Tool                                      |
|------------------|-------------------------------------------|
| Frontend         | Next.js 14+ (App Router), React, TypeScript |
| Styling          | Tailwind CSS + CSS custom properties       |
| Backend          | Next.js API routes + Supabase Edge Functions |
| Database         | Supabase (Postgres)                        |
| Auth             | Supabase Auth (email/password + OAuth)     |
| Real-time        | Supabase Realtime subscriptions            |
| File Storage     | Supabase Storage                           |
| Hosting          | Railway (auto-deploy from GitHub main)     |
| Version Control  | GitHub                                     |
| IDE              | Cursor with Claude Code                    |
| Mobile           | Progressive Web App (PWA)                  |

---

## Design System

The design system is neutral and unbranded by default. All visual identity is controlled through CSS custom properties so a future tenant can swap colors, fonts, and logos without touching component code.

### Color Tokens

Dark mode is the default. Light mode is supported via a toggle.

```css
/* --- Base palette (dark mode default) --- */
:root {
  /* Surfaces */
  --surface-base: #0F1117;        /* App background */
  --surface-raised: #161820;      /* Cards, panels, sidebar */
  --surface-overlay: #1C1F2B;     /* Modals, dropdowns, popovers */
  --surface-hover: #242736;       /* Hovered rows, list items */
  --surface-active: #2C3044;      /* Selected/active state */

  /* Borders */
  --border-subtle: #1E2130;       /* Dividers, card edges */
  --border-default: #2A2D3E;      /* Input borders, table lines */
  --border-strong: #3D4155;       /* Focused inputs, emphasized dividers */

  /* Text */
  --text-primary: #F0F1F4;        /* Headings, primary content */
  --text-secondary: #9CA3B4;      /* Labels, descriptions, timestamps */
  --text-muted: #5C6278;          /* Placeholders, disabled text */
  --text-inverse: #0F1117;        /* Text on accent-colored backgrounds */

  /* Accent (primary action color — neutral blue-gray, easy to swap) */
  --accent-default: #6C7AE6;      /* Buttons, links, active indicators */
  --accent-hover: #8490F0;        /* Hovered accent elements */
  --accent-subtle: rgba(108, 122, 230, 0.12);  /* Accent tinted backgrounds */

  /* Status */
  --status-success: #34D399;
  --status-warning: #FBBF24;
  --status-error: #F87171;
  --status-info: #60A5FA;

  /* Shadows */
  --shadow-sm: 0 1px 2px rgba(0,0,0,0.3);
  --shadow-md: 0 4px 12px rgba(0,0,0,0.4);
  --shadow-lg: 0 8px 24px rgba(0,0,0,0.5);
}

/* --- Light mode override --- */
[data-theme="light"] {
  --surface-base: #F8F9FB;
  --surface-raised: #FFFFFF;
  --surface-overlay: #FFFFFF;
  --surface-hover: #F0F1F4;
  --surface-active: #E4E6EB;

  --border-subtle: #E4E6EB;
  --border-default: #D1D5DB;
  --border-strong: #9CA3AF;

  --text-primary: #111827;
  --text-secondary: #6B7280;
  --text-muted: #9CA3AF;
  --text-inverse: #FFFFFF;

  --accent-subtle: rgba(108, 122, 230, 0.08);

  --shadow-sm: 0 1px 2px rgba(0,0,0,0.06);
  --shadow-md: 0 4px 12px rgba(0,0,0,0.08);
  --shadow-lg: 0 8px 24px rgba(0,0,0,0.12);
}
```

### White-Label Token Layer

For future multi-tenant use, a tenant config overrides the base tokens. The app loads tenant-specific CSS variables at runtime from a `tenant_settings` table.

```css
/* Example: tenant override injected at runtime */
:root {
  --tenant-accent: #E2211A;        /* Tenant's brand color */
  --tenant-accent-hover: #FF3D2E;
  --tenant-logo-url: url('/tenants/hd-hauling/logo.svg');
  --tenant-font-heading: 'Industry', sans-serif;
  --tenant-font-body: 'Inter', sans-serif;
}
```

When a tenant config exists, `--accent-default` resolves to `--tenant-accent`. When it does not, the neutral defaults apply.

### Typography

Default fonts (unbranded):
- **Headings:** `'Inter', system-ui, sans-serif` — weight 600 or 700
- **Body:** `'Inter', system-ui, sans-serif` — weight 400
- **Mono/Code:** `'JetBrains Mono', 'Fira Code', monospace`

Scale:
| Token        | Size   | Weight | Use                           |
|--------------|--------|--------|-------------------------------|
| text-xs      | 0.75rem | 400   | Timestamps, badges            |
| text-sm      | 0.875rem| 400   | Secondary labels, table cells |
| text-base    | 1rem   | 400    | Body text, form inputs        |
| text-lg      | 1.125rem| 500   | Card titles, nav items        |
| text-xl      | 1.25rem | 600   | Section headers               |
| text-2xl     | 1.5rem | 700    | Page titles                   |
| text-3xl     | 1.875rem| 700   | Dashboard hero numbers        |

### Spacing

Use a 4px base unit. Standard spacing scale: 4, 8, 12, 16, 20, 24, 32, 40, 48, 64.

- Card padding: 16px (mobile) / 20px (desktop)
- Section gaps: 24px
- Page margins: 16px (mobile) / 32px (desktop)
- Touch targets: minimum 44px height on mobile

### Component Patterns

Every component follows these rules:
1. Use CSS custom properties for ALL colors — never hardcode hex values in components
2. Border radius: `6px` for inputs/buttons, `8px` for cards, `12px` for modals
3. Transitions: `150ms ease` for color/background changes, `200ms ease` for transforms
4. Focus states: `2px solid var(--accent-default)` outline with `2px` offset
5. Loading states: skeleton placeholders, never spinners blocking the full page
6. Empty states: always show a message + suggested action, never a blank area

### Animation Standards

- Page transitions: fade + subtle slide (150ms)
- Card/list item entry: stagger by 30ms per item, fade + translateY(8px)
- Modals: fade overlay (150ms) + scale content from 0.97 (200ms)
- Hover effects: background color shift only (no transforms on data-heavy elements)
- Avoid: parallax, bounce, elastic easing, anything that feels playful on a work tool

### Navigation

- Desktop: persistent left sidebar (240px collapsed to 64px icon-only mode)
- Mobile: bottom tab bar with 5 max items, overflow goes to "More" sheet
- Sidebar sections: Dashboard, Inbox, Clients, Calendar, Settings
- Active state: accent-colored left border (sidebar) or filled icon (mobile)
- Breadcrumbs on detail pages, never on top-level sections

---

## Architecture

### Directory Structure

```
command-center/
├── .github/
│   └── workflows/          # CI/CD (lint, test, deploy)
├── public/
│   ├── manifest.json       # PWA manifest
│   └── icons/              # PWA icons
├── src/
│   ├── app/                # Next.js App Router pages
│   │   ├── (auth)/         # Login, signup, forgot password
│   │   ├── (dashboard)/    # Authenticated app shell
│   │   │   ├── layout.tsx  # Sidebar + header wrapper
│   │   │   ├── page.tsx    # Dashboard home
│   │   │   ├── inbox/
│   │   │   ├── clients/
│   │   │   ├── calendar/
│   │   │   └── settings/
│   │   └── api/            # API routes
│   │       ├── integrations/
│   │       │   ├── hubspot/
│   │       │   ├── google/
│   │       │   ├── microsoft/
│   │       │   └── slack/
│   │       ├── webhooks/
│   │       └── cron/
│   ├── components/
│   │   ├── ui/             # Base components (Button, Input, Card, Modal, etc.)
│   │   ├── layout/         # Sidebar, Header, MobileNav, Breadcrumbs
│   │   ├── dashboard/      # Dashboard-specific widgets
│   │   ├── inbox/          # Unified inbox components
│   │   ├── clients/        # Client 360 components
│   │   └── calendar/       # Calendar view components
│   ├── lib/
│   │   ├── supabase/       # Supabase client, helpers, types
│   │   ├── integrations/   # Integration API wrappers
│   │   │   ├── hubspot.ts
│   │   │   ├── google.ts
│   │   │   ├── microsoft.ts
│   │   │   └── slack.ts
│   │   ├── hooks/          # Custom React hooks
│   │   ├── utils/          # Shared utilities
│   │   └── constants.ts
│   ├── types/              # TypeScript type definitions
│   └── styles/
│       └── tokens.css      # Design token CSS variables
├── supabase/
│   ├── migrations/         # Versioned SQL migrations
│   └── seed.sql            # Dev seed data
├── .env.local              # Local env vars (never committed)
├── .env.example            # Template for required env vars
├── CLAUDE.md               # Claude Code project context
├── tailwind.config.ts
├── next.config.ts
├── tsconfig.json
└── package.json
```

### Database Schema (Core Tables)

All tables include `id` (uuid, PK), `created_at`, `updated_at`, and `tenant_id` (for future multi-tenant). Every query is scoped by tenant via Row Level Security.

```sql
-- Tenants (future multi-tenant support)
tenants (
  id uuid PK,
  name text,
  slug text UNIQUE,        -- subdomain or identifier
  settings jsonb,          -- theme overrides, feature flags
  created_at, updated_at
)

-- Users
users (
  id uuid PK REFERENCES auth.users,
  tenant_id uuid FK tenants,
  email text,
  display_name text,
  role text DEFAULT 'member',  -- 'owner', 'admin', 'member', 'viewer'
  preferences jsonb,           -- UI prefs, notification settings
  created_at, updated_at
)

-- Integration Connections
integration_connections (
  id uuid PK,
  tenant_id uuid FK tenants,
  user_id uuid FK users,
  provider text,               -- 'hubspot', 'google', 'microsoft', 'slack'
  access_token_encrypted text, -- encrypted via Supabase Vault
  refresh_token_encrypted text,
  token_expires_at timestamptz,
  scopes text[],
  status text DEFAULT 'active', -- 'active', 'expired', 'revoked'
  metadata jsonb,              -- provider-specific config
  created_at, updated_at
)

-- Unified Contacts (aggregated from integrations)
contacts (
  id uuid PK,
  tenant_id uuid FK tenants,
  display_name text,
  email text,
  phone text,
  company text,
  source text,                 -- 'hubspot', 'google', 'manual'
  source_id text,              -- external ID from source system
  metadata jsonb,
  created_at, updated_at
)

-- Unified Inbox Items
inbox_items (
  id uuid PK,
  tenant_id uuid FK tenants,
  source text,                 -- 'gmail', 'outlook', 'slack', 'hubspot'
  source_id text,              -- external message/notification ID
  type text,                   -- 'email', 'message', 'notification', 'task'
  title text,
  preview text,
  sender_name text,
  sender_email text,
  is_read boolean DEFAULT false,
  is_starred boolean DEFAULT false,
  priority text DEFAULT 'normal',
  received_at timestamptz,
  metadata jsonb,              -- full payload for source-specific rendering
  created_at, updated_at
)

-- Calendar Events (synced from integrations)
calendar_events (
  id uuid PK,
  tenant_id uuid FK tenants,
  source text,                 -- 'google', 'outlook', 'manual'
  source_id text,
  title text,
  description text,
  start_time timestamptz,
  end_time timestamptz,
  location text,
  attendees jsonb,
  is_all_day boolean DEFAULT false,
  metadata jsonb,
  created_at, updated_at
)

-- Audit Log
audit_log (
  id uuid PK,
  tenant_id uuid FK tenants,
  user_id uuid FK users,
  action text,                 -- 'login', 'integration.connect', 'contact.update', etc.
  resource_type text,
  resource_id uuid,
  details jsonb,
  ip_address inet,
  created_at
)
```

### Row Level Security

Every table with `tenant_id` gets RLS policies. This is non-negotiable.

```sql
-- Example: contacts table
ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can only see contacts in their tenant"
  ON contacts FOR SELECT
  USING (tenant_id = (SELECT tenant_id FROM users WHERE id = auth.uid()));

CREATE POLICY "Users can only insert contacts in their tenant"
  ON contacts FOR INSERT
  WITH CHECK (tenant_id = (SELECT tenant_id FROM users WHERE id = auth.uid()));

CREATE POLICY "Users can only update contacts in their tenant"
  ON contacts FOR UPDATE
  USING (tenant_id = (SELECT tenant_id FROM users WHERE id = auth.uid()));

CREATE POLICY "Users can only delete contacts in their tenant"
  ON contacts FOR DELETE
  USING (tenant_id = (SELECT tenant_id FROM users WHERE id = auth.uid()));
```

Apply this pattern to every table. No exceptions.

---

## Day 1 Integrations

### Integration Architecture

Every integration follows the same pattern:

```
1. OAuth flow → store encrypted tokens in integration_connections
2. Initial sync → pull recent data into local tables
3. Webhook listener → receive real-time updates from the source
4. Periodic sync (cron) → catch anything webhooks missed
5. Token refresh → auto-refresh before expiry
```

Each integration gets its own:
- API wrapper in `src/lib/integrations/{provider}.ts`
- API routes in `src/app/api/integrations/{provider}/`
- Webhook handler in `src/app/api/webhooks/{provider}/`
- Types in `src/types/integrations/{provider}.ts`

### HubSpot

**Purpose:** CRM data — contacts, companies, deals, activities
**Auth:** OAuth 2.0 (HubSpot App)
**Key endpoints:**
- Contacts: `/crm/v3/objects/contacts`
- Companies: `/crm/v3/objects/companies`
- Deals: `/crm/v3/objects/deals`
- Activities: `/crm/v3/objects/engagements`

**Sync strategy:** Webhook-primary with daily full sync as backup. HubSpot webhooks fire on contact/deal create, update, delete. Store the HubSpot object ID in `contacts.source_id` for deduplication.

### Microsoft Graph (Outlook Calendar + Outlook Email)

**Purpose:** Calendar events and email from Outlook/Microsoft 365
**Auth:** OAuth 2.0 (Microsoft Entra / Azure AD app registration)
**Key endpoints:**
- Calendar: `/me/calendarView`
- Email: `/me/messages`
- Subscriptions (webhooks): `/subscriptions`

**Sync strategy:** Graph subscriptions (webhooks) for real-time, delta queries for incremental sync. Calendar events map to `calendar_events` table. Emails map to `inbox_items` with `source = 'outlook'`.

**Important:** Microsoft Graph requires a registered Azure AD app with `Calendars.Read`, `Mail.Read`, and `User.Read` scopes at minimum.

### Google Calendar

**Purpose:** Calendar events from Google Workspace / personal Gmail accounts
**Auth:** OAuth 2.0 (Google Cloud Console project)
**Key endpoints:**
- Events: `/calendars/{calendarId}/events`
- Watch (push notifications): `/calendars/{calendarId}/events/watch`

**Sync strategy:** Push notifications via watch channels + periodic sync token-based polling. Events map to `calendar_events` with `source = 'google'`. Handle overlapping events from multiple calendar sources by showing source badges in the UI.

### Gmail

**Purpose:** Email in the unified inbox
**Auth:** Same OAuth flow as Google Calendar (add `gmail.readonly` scope)
**Key endpoints:**
- Messages: `/gmail/v1/users/me/messages`
- Watch (push): `/gmail/v1/users/me/watch` (Pub/Sub)

**Sync strategy:** Gmail push notifications via Google Cloud Pub/Sub. Messages map to `inbox_items` with `source = 'gmail'`. Only sync inbox and sent — skip spam, trash, promotions unless user opts in.

### Slack

**Purpose:** Messages and notifications in the unified inbox
**Auth:** OAuth 2.0 (Slack App with Bot + User tokens)
**Key endpoints:**
- Messages: `conversations.history`
- Channels: `conversations.list`
- Events API (webhooks): real-time message events

**Sync strategy:** Slack Events API for real-time DMs and mentions. Do NOT sync entire channel history — only messages where the user is mentioned or DMs. Map to `inbox_items` with `source = 'slack'`.

---

## Security

### Authentication

- Supabase Auth handles all auth flows (email/password, magic link, OAuth)
- Session tokens are short-lived JWTs (1 hour) with refresh token rotation
- Refresh tokens stored HTTP-only, Secure, SameSite=Strict cookies
- Failed login attempts: rate limit to 5 per 15 minutes per IP
- Password requirements: minimum 8 characters, no other complexity rules (NIST guidance)

### Token Storage (Integration Credentials)

- All OAuth tokens encrypted at rest using Supabase Vault (`vault.create_secret()`)
- Never store tokens in plain text, localStorage, or client-accessible state
- Token refresh logic runs server-side only (API routes or Edge Functions)
- If a refresh fails, mark the integration as `status = 'expired'` and surface a reconnect prompt in the UI

### API Route Security

Every API route must:
1. Verify the Supabase session token
2. Extract `tenant_id` from the authenticated user
3. Scope all database queries to that `tenant_id`
4. Validate and sanitize all input (use Zod schemas)
5. Return appropriate HTTP status codes (never leak stack traces)

```typescript
// Example: secure API route pattern
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { z } from 'zod';

const inputSchema = z.object({
  contactId: z.string().uuid(),
});

export async function GET(request: Request) {
  const supabase = createRouteHandlerClient({ cookies });
  const { data: { session } } = await supabase.auth.getSession();

  if (!session) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Input validation
  const parsed = inputSchema.safeParse(await request.json());
  if (!parsed.success) {
    return Response.json({ error: 'Invalid input' }, { status: 400 });
  }

  // RLS handles tenant scoping automatically
  const { data, error } = await supabase
    .from('contacts')
    .select('*')
    .eq('id', parsed.data.contactId)
    .single();

  if (error) {
    return Response.json({ error: 'Not found' }, { status: 404 });
  }

  return Response.json(data);
}
```

### Webhook Security

- Verify webhook signatures for every provider:
  - HubSpot: `X-HubSpot-Signature-v3` header
  - Microsoft Graph: validate subscription tokens
  - Google: verify Pub/Sub message source
  - Slack: `X-Slack-Signature` with signing secret
- Reject any webhook that fails signature verification (return 401, log the attempt)
- Webhook endpoints are public-facing — never trust the payload without verification

### CSRF Protection

- Use the `SameSite=Strict` cookie attribute on all auth cookies
- Require `Content-Type: application/json` on all state-changing requests
- Supabase client-side library handles CSRF via the auth token in headers

### Rate Limiting

- Apply rate limiting on all public-facing API routes
- Recommended: 100 requests per minute per user for standard endpoints
- Webhook endpoints: 1000 per minute per provider (higher because they come in bursts)
- Use Upstash Redis or a middleware-based solution (no need for a full Redis instance early on)

### Audit Logging

Log every meaningful action to the `audit_log` table:
- Authentication events (login, logout, failed attempt)
- Integration connections and disconnections
- Data modifications (create, update, delete on any core table)
- Settings changes
- Admin actions (role changes, user invites)

This table is append-only. No UPDATE or DELETE policies. It is a compliance requirement for future enterprise customers.

---

## Testing

### Test Strategy

| Layer          | Tool              | What to Test                              |
|----------------|-------------------|-------------------------------------------|
| Unit           | Vitest            | Utility functions, data transformers, hooks |
| Component      | Vitest + Testing Library | UI components render correctly, handle states |
| API Routes     | Vitest            | Auth checks, input validation, error handling |
| Integration    | Vitest + MSW      | Mock external APIs, test sync logic        |
| E2E            | Playwright        | Critical user flows (login, connect integration, view dashboard) |

### Test Patterns

- Every API route gets at least 3 tests: happy path, unauthorized access, invalid input
- Every integration wrapper gets tests with mocked API responses (use MSW)
- UI components get tests for: default render, loading state, empty state, error state
- Database migrations get tested by running them against a test database, then rolling back

### What to Test First (Priority Order)

1. Auth flows (login, session refresh, logout)
2. RLS policies (confirm tenant isolation actually works)
3. Integration OAuth flows and token refresh
4. API route input validation
5. Dashboard data fetching and error handling

---

## Deployment

### Environment Variables

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# HubSpot
HUBSPOT_CLIENT_ID=
HUBSPOT_CLIENT_SECRET=
HUBSPOT_REDIRECT_URI=

# Microsoft (Outlook Calendar + Email)
MICROSOFT_CLIENT_ID=
MICROSOFT_CLIENT_SECRET=
MICROSOFT_REDIRECT_URI=

# Google (Calendar + Gmail)
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_REDIRECT_URI=

# Slack
SLACK_CLIENT_ID=
SLACK_CLIENT_SECRET=
SLACK_SIGNING_SECRET=
SLACK_REDIRECT_URI=

# App
NEXT_PUBLIC_APP_URL=
ENCRYPTION_KEY=               # For token encryption
```

### CI/CD Pipeline (GitHub Actions)

```yaml
# .github/workflows/deploy.yml
name: Deploy
on:
  push:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '20' }
      - run: npm ci
      - run: npm run lint
      - run: npm run type-check
      - run: npm run test

  deploy:
    needs: test
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: railwayapp/deploy@v1
        with:
          railway-token: ${{ secrets.RAILWAY_TOKEN }}
```

### Railway Configuration

- Auto-deploy from `main` branch
- Health check endpoint: `/api/health`
- Environment variables set in Railway dashboard (never in code)
- Custom domain via Railway + DNS
- Sleep disabled (app should always be warm for webhook delivery)

### Database Migrations

- All schema changes go through Supabase migrations (`supabase/migrations/`)
- Every migration has an `up` and a `down` (rollback)
- Never modify a migration after it has been applied to production
- Run migrations in CI before deploy to catch issues early
- Seed data for development in `supabase/seed.sql`

---

## Debugging

### Built-in Debug Panel (Admin Only)

Build an admin-only debug panel accessible at `/settings/debug` (hidden from non-admin users) that shows:

- **Integration Health:** Status indicator (green/yellow/red) per connected integration. Shows last successful sync timestamp, token expiry countdown, and error count in the last 24 hours.
- **API Call Log:** Searchable table of recent API calls to external services with timestamp, provider, endpoint, status code, and response time. Retain 7 days in the database, paginated.
- **Webhook Log:** Incoming webhook events with provider, event type, signature verification result, and processing status.
- **Sync Status:** Per-integration breakdown showing records synced, last sync time, next scheduled sync, and any sync errors with stack traces.
- **Audit Log Viewer:** Searchable, filterable view of the audit log table.

### Logging

- Use structured JSON logging (Pino recommended for Next.js)
- Every log entry includes: timestamp, level, message, `tenant_id`, `user_id`, `request_id`
- Log levels: `error` (failures), `warn` (degraded), `info` (normal operations), `debug` (verbose, dev only)
- Ship logs to Railway's built-in log viewer for now. Add LogTail or Axiom when scaling.
- Never log sensitive data (tokens, passwords, PII beyond user ID)

### Error Handling

- React Error Boundaries around every major section (dashboard, inbox, calendar, clients)
- One broken widget should never crash the entire app
- API errors return structured JSON: `{ error: string, code: string, details?: object }`
- Integration failures surface as banner notifications in the UI, not silent failures
- Unhandled promise rejections in sync jobs get caught and logged to audit trail

---

## Code Standards

### TypeScript

- Strict mode enabled (`"strict": true` in tsconfig)
- No `any` types — use `unknown` and narrow with type guards
- All API responses typed with Zod schemas (validate at runtime, infer types at compile time)
- Prefer interfaces for object shapes, types for unions and computed types

### React Patterns

- Server Components by default, Client Components only when needed (state, effects, browser APIs)
- Data fetching in Server Components or via React Query (TanStack Query) in Client Components
- No prop drilling beyond 2 levels — use context or composition
- Custom hooks for all reusable logic (prefix with `use`)
- Component files: one component per file, named export matching filename

### Git Conventions

- Branch naming: `feature/`, `fix/`, `chore/` prefixes
- Commit messages: conventional commits (`feat:`, `fix:`, `chore:`, `docs:`)
- PRs require passing CI before merge
- Squash merge to main

---

## Build Order

### Phase 1 — Foundation
Auth, database schema, design tokens, layout shell (sidebar + header), dashboard skeleton, PWA manifest.

### Phase 2 — Core UI
Dashboard widgets (daily brief, upcoming calendar, recent inbox, quick capture), client list view, settings page with integration connection UI.

### Phase 3 — Integrations
HubSpot OAuth + contact sync, Microsoft Graph OAuth + calendar + email sync, Google OAuth + calendar + Gmail sync, Slack OAuth + mentions/DM sync. Build one at a time, fully tested before moving to the next.

### Phase 4 — Unified Views
Unified inbox (aggregated from all email + Slack sources), unified calendar (merged Google + Outlook events), client 360 view (all touchpoints for a contact across all sources).

### Phase 5 — Polish and Resale Prep
Multi-tenant data model finalization, tenant settings UI, role-based access, onboarding wizard, white-label theming, billing integration (Stripe), admin panel.

---

## References

Read these files when working on specific areas:

| Area                | Reference File                                    |
|---------------------|---------------------------------------------------|
| UI components       | `src/components/ui/README.md`                     |
| Integration setup   | `src/lib/integrations/README.md`                  |
| Database migrations | `supabase/README.md`                              |
| Testing patterns    | `src/__tests__/README.md`                         |
| Deployment          | `.github/workflows/README.md`                     |

These reference files will be created as the project progresses. When creating a new component, integration, or migration, update the corresponding README with patterns and examples for future sessions.
