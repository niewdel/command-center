# LettyAI — Cowork Handoff Log

**Purpose:** every Phase 2 candidate component gets a spec written here at the moment we build / sketch it in Phase 1, so the handoff to Anthropic Cowork at the end of Phase 1 is mechanical, not retrospective.

**Hard rule from `brief.md`:** Document handoff specs at the moment we build something Cowork-bound, not at the end.

**Spec template per component:**
- **What it does** — one sentence.
- **Inputs** — where they come from.
- **Outputs** — where they go.
- **Prompt / script** — exact text or path.
- **Cadence** — how often it runs.
- **Phase 1 manual analog** — how Justin does it today by hand.

---

## Components

### 1. Inspiration Feed (Phase 2 candidate — auto-tagging)

- **What it does (Phase 2):** Auto-tag each new inspiration save by hook type, visual style, and content-pillar fit so the inspiration grid is browsable by category.
- **Inputs:** `content_digests` rows where `kind = 'inspiration'` and `tags = '{}'` (un-tagged).
- **Outputs:** Updates `tags` array on the same row.
- **Prompt:** TBD — needs a vision-capable model run on the thumbnail + URL metadata; possibly also pull TikTok / IG caption via API.
- **Cadence:** Every 30 min, batch up to 20 rows per run.
- **Phase 1 manual analog:** Justin tags inspirations by hand (or doesn't — Phase 1 inspirations are an unsorted dump by design).

### 2. Trend Scraper / Daily Niche Pull (Phase 2 candidate)

- **What it does (Phase 2):** Once per day, find the top short-form videos posted in the last 24h across the LettyAI niches (AI tools, Claude, Claude Code, MCP servers, AI agents, prompt engineering, AI automation, "Claude memes"). Rank by engagement, classify by content pillar, recommend an action (replicate / innovate-on / steal-and-credit / skip), and dump the survivors into the `content_digests` table as `kind = 'inspiration'`.
- **Inputs:**
  - YouTube Data API v3 (search by relevance + viewCount, last 24h, niche keyword list)
  - TikTok scraping API (RapidAPI / TikAPI) — keyword search, sort by views, last 24h
  - Instagram scraping API (RapidAPI Instagram Scraper Pro — already wired for digest path) — keyword/hashtag search
  - Niche keyword list (lives at `leddyai/niche-keywords.md`, editable by Justin)
- **Outputs:**
  - New rows in `content_digests` with `kind = 'inspiration'`, `source_pull = 'trend_scrape'` (new column TBD), `tags` populated with pillar guess + action recommendation.
  - Telegram digest summary: top 10 of the day with one-line pitches, sent as a single message.
- **Prompt / script:** See `.claude/commands/leddy-trends.md` — the Phase 1 manual analog. The Cowork job runs the same prompt with the same tool calls, plus database insertion at the end. Promote that file's body verbatim into the Cowork job spec when transitioning.
- **Cadence:** Once per day, 6 AM ET (before Justin's morning planning ritual).
- **Phase 1 manual analog:** Justin runs `/leddy-trends` in Claude Code when he wants a trend pull. Same prompt, no database write — output is a list, Justin sends the keepers to the Telegram bot manually as inspirations. **This is the path until Phase 1 exits.**

### (Add new components here as we build them.)
