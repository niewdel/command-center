# Discovery — Command Center

## Discovery Session Instructions
1. Minimum 15 questions across logical categories
2. Ask 3–5 questions per category, wait for answers before proceeding
3. Adapt follow-ups based on responses
4. Challenge assumptions — push back on vague goals, unrealistic timelines, undefined scope
5. After all questions: summarize key insights, tensions, and tradeoffs
6. Get explicit approval on summary before moving to Research phase

---

## Q&A Transcript

### Category 1: Workflow & Daily Usage

**Q: Walk me through a typical day. What's the first thing you check?**
A: Days are random and scattered. Starts with a todo list and knocks out what needs to be done. Lots of things falling through the cracks. Needs help designing a structured way to wake up, start working, and plan days properly.

**Q: How do you separate Niewdel vs. i10 work?**
A: Wants Command Center to treat Niewdel and i10 as two completely separate entities. Work is completely separate.

**Q: What's your current Notion setup?**
A: Notion has separate pages for Niewdel, i10 Solutions, and HD Grading (a major Niewdel client). HD Grading lives under Niewdel. Doesn't want to replicate Notion — wants to design a workspace that actually makes sense from scratch.

**Q: Where do things fall through the cracks?**
A: Follow-ups after meetings, tasks that don't get done, deadlines forgotten. Root cause: doesn't always write things down immediately, then forgets.

**Q: How do you capture things on the go?**
A: Notes app on phone, or just tries to remember. Wants a Telegram bot to text/voice tasks directly into Command Center. Also needs to use HubSpot more actively for i10.

### Category 2: Capture & Input Methods

**Q: Telegram vs. other capture channels?**
A: Uses Telegram frequently. Open to SMS bot too depending on cost. *Resolution: Recommended Telegram first — free, richer, voice built-in, already uses it daily. SMS can be added later.*

**Q: How much context do you have when capturing?**
A: Usually has all the context needed when capturing something.

**Q: Auto-categorize or manual?**
A: Auto-categorize. Wants the system to detect clients/projects and link automatically.

**Q: Is the problem capture or review?**
A: Both. Tasks aren't getting captured AND aren't reviewed when they are. Wants task list on the main dashboard with company tags. Company pages themselves stay separate.

**Q: Will there be more clients like HD Grading?**
A: Will have more clients in the future. Currently HD Grading + a couple random one-off clients for small automation/AI packages (usually $2-5k one-time).

### Category 3: Project & Client Structure

**Q: Confirm the dashboard/company page model?**
A: Yes — company pages are separate, dashboard is unified with tags across all entities.

**Q: What does a client workspace need for HD Grading?**
A: Important notes section, deadline section, important links section. Documents stored in iCloud Drive — would love embedded iCloud folders but doesn't want to duplicate storage.

**Q: Do smaller clients need full project spaces?**
A: No. Lightweight tracker — task list + notes tied to a client name is enough.

**Q: Multiple projects per client?**
A: Yes, HD Grading has multiple concurrent projects (quoting tool, company handbook, OSHA stuff). Wants them separated. Also needs a place to store/dump key info per client.

**Q: What is the Niewdel page?**
A: Not a client list — it's a business operations hub. Pipeline, revenue tracking, marketing tasks, internal ops. Niewdel is just getting started. Uses Wave app for expensing (potential future integration, not scoped now).

### Category 4: Meetings, Notes & Follow-ups

**Q: Fathom usage?**
A: Actively using Fathom for meetings/transcripts. Not doing anything with follow-ups currently. Fathom summaries are sufficient. Wants Fathom data pulled in automatically with a dedicated section on the hub.

**Q: Notes for unrecorded meetings?**
A: Doesn't typically take notes for quick/in-person meetings. Fathom is launching an in-person note taker soon. Not a current priority.

**Q: How smart should auto-follow-ups be?**
A: Fully automatic. AI detects action items from meeting notes and creates tasks without input. Follow-ups are a major weakness.

**Q: Meeting volume?**
A: ~5 per week or fewer. Low volume but high impact per meeting.

**Q: Meeting log structure?**
A: Chronological meeting log with search is sufficient. No need to link meetings to specific clients/projects.

### Category 5: Calendar & Time Management

**Q: Primary calendar?**
A: Apple Calendar is primary, but has sync issues with Outlook meetings not showing up. Uses both.

**Q: Calendar management inside Command Center?**
A: No. Read-only view only. Wants to unify both calendars in one view.

**Q: Bandwidth planning?**
A: Just wants to see meeting load to know when heavy project work is feasible. No time-blocking or hour estimation.

**Q: Scheduling method?**
A: No time-blocking or scheduling method. Days are reactive.

**Q: Apple Calendar vs. Outlook?**
A: Decided to skip Apple Calendar integration. Switching everything to Microsoft/Outlook. **BLOCKER: Calendar is on a Sandler corporate account (franchise). May not be able to get admin access for Microsoft Graph API auth.** Needs research.

### Category 6: HubSpot & CRM

**Q: What's in HubSpot?**
A: Fully built out with pipeline and full contact list. Shared i10 instance.

**Q: What does "using HubSpot better" mean?**
A: Mainly pulling i10 tasks into the unified Command Center dashboard so nothing gets missed. Also wants visibility into ongoing training engagements.

**Q: Client Tracker from brief?**
A: Remove it — was meant to be taken out of the brief. Not needed.

**Q: i10 sales process?**
A: Relationship-based with a discovery pipeline. Managing ongoing training engagements is tough — wants a way to stay on top of those.

### Category 7: SaaS & Future-Proofing

**Q: How real is SaaS?**
A: Not very. "If we build something cool and I show it off, I want to replicate and sell it." Not an active business plan.

**Q: Target buyer?**
A: Not sure. Probably smaller businesses under $10M.

**Q: Role-based access needed for V1?**
A: No. 100% single-user, personal tool. If multi-user is needed later, will move code to a different system. Also wants a personal section.

**Q: Timeline?**
A: Basic task tracking live within the next couple days. Full product ~1 month. Will actively use beta versions to test and tweak.

### Category 8: Personal & Lifestyle

**Q: What does "personal section" mean?**
A: Personal tasks and goals. Doesn't need to be heavily separated, but personal notes/lists should NOT mix with business content. Task tracking can be unified (with tags). Wants personal goals AND business goals sections.

**Q: Ideal dashboard morning view?**
A: Meetings for the day at a glance. Pressing tasks and deadlines that need to be met that day.

**Q: Open to opinionated system?**
A: Yes. Open to morning prompts ("top 3 priorities"), end-of-day reviews, structured planning assistance.

**Q: Devices?**
A: MacBook, iPhone, iPad.

---

## Key Insights Summary

### Core Product Vision
Command Center is a **single-user personal productivity hub** that unifies tasks, meetings, notes, and calendar across three domains: Niewdel (business ops), i10 Solutions (sales/training), and Personal. Not a Notion clone — a purpose-built system designed around Justin's actual workflow gaps.

### Critical Insights

1. **The #1 problem is capture, not organization.** Things fall through the cracks because they never enter the system. The Telegram bot is arguably the highest-ROI feature after basic task tracking.

2. **Two separate failure modes:** tasks don't get captured AND they don't get reviewed. The system needs to solve both — frictionless input (Telegram) + structured daily review (opinionated dashboard).

3. **Three entities, unified task view.** Niewdel, i10, and Personal are separate workspaces, but the dashboard aggregates everything with tags/filters. This is the core UX pattern.

4. **Niewdel ≠ client list.** Niewdel page is a business operations hub (pipeline, marketing, internal ops). Clients like HD Grading get their own sub-workspaces.

5. **Client workspaces are lightweight.** Notes, deadlines, links, linked projects. No heavy CRM features. Smaller one-off clients get even lighter treatment (task list + notes).

6. **Fathom integration with auto-follow-ups is high value.** Low meeting volume (~5/week) but follow-ups are the biggest drop-off point. Auto-parsing Fathom summaries into tasks closes a real gap.

7. **Calendar is read-only.** No calendar management inside Command Center. Just a unified view of the day's meetings alongside tasks/deadlines.

8. **HubSpot integration is about task sync, not CRM visibility.** Pull i10 tasks into the unified dashboard. Client Tracker feature removed from scope.

9. **V1 in days, full product in ~1 month.** Basic task tracking is the immediate priority. Everything else layers on top.

10. **Single-user, no RBAC.** SaaS is a distant maybe. Build for one user, keep code clean enough to extend later.

### Tensions & Tradeoffs

| Tension | Tradeoff |
|---------|----------|
| **Outlook calendar on Sandler corporate tenant** | May not be able to get Graph API auth. Needs research — fallback options: ICS subscription (read-only, delayed), or manual calendar entry. This could block the calendar feature entirely. |
| **Auto-categorization of captured tasks** | Requires NLP/AI parsing of free-text input. Adds complexity. Tradeoff: start with simple keyword matching (detect "HD Grading", "i10", etc.) and upgrade to smarter parsing later. |
| **Fathom API access** | Fathom may not have a public API. May need Zapier/webhook workaround or manual paste workflow. Needs research. |
| **iCloud Drive embedding** | Apple doesn't expose iCloud Drive for web embedding. Likely limited to storing links to iCloud folders rather than true embedding. |
| **Opinionated daily planning vs. flexibility** | Justin wants structure but days are reactive. System should suggest structure (morning priorities, EOD review) without being rigid or annoying. |
| **Speed to V1 vs. architecture quality** | Wants task tracking in days. Need to ship fast without cutting corners that make the 1-month full build harder. Solution: task module first as a standalone, then layer modules on. |

### Items Requiring Resolution Before Architecture

1. **Outlook/Graph API access** — Can Justin get admin consent from Sandler IT, or do we need a workaround?
2. **Fathom integration method** — API, Zapier, webhook, or manual? Needs research.
3. **Telegram Bot setup** — Confirm Justin has/can create a Telegram bot token.

### Scope Removed from Brief
- Client Tracker (HubSpot → CRM view) — removed per Justin's instruction
- Apple Calendar integration — removed, switching to Outlook only
- Wave app integration — flagged as future nice-to-have, not in scope
- Multi-user / RBAC — not needed for V1
- SMS capture bot — future addition, Telegram first
