---
description: LettyAI daily trend pull — find top AI/Claude/automation shorts from the last 24h and recommend an action per video
---

# /leddy-trends — Daily Niche Trend Pull (Phase 1 manual analog)

You are pulling the daily trend signal for the **LettyAI** content engine. This is the Phase 1 manual analog of the Cowork-bound Trend Scraper documented in `leddyai/cowork-handoff.md`. When this is automated in Phase 2, the same prompt will run on a schedule and write directly to the `content_digests` table.

## Niche

LettyAI publishes daily short-form on TikTok, Instagram Reels, and YouTube Shorts under handle **LettyAI** (brand spelled "Leddy AI"). Niche keywords:

- AI tools / AI agents
- Anthropic / Claude / Claude Code / Claude memes
- MCP servers (Model Context Protocol)
- Prompt engineering
- AI automation / workflow automation
- Cursor, AI IDEs
- "I built X with Claude" content
- Slop callouts in the AI creator space

Reference `leddyai/brief.md` for full positioning and the 4 content pillars.

## What to do

1. Use **WebSearch** to find the top short-form videos posted in the **last 24 hours** across the niche keywords above. Aim for ~15 candidates total — a mix of YouTube Shorts, TikToks, and Instagram Reels.
2. For each candidate, look up:
   - URL (full link, not shortened)
   - Source platform (`youtube` / `tiktok` / `instagram`)
   - Approximate view count (or engagement signal — likes, comments) if visible
   - Posted-at date/time (must be within last 48h, ideally last 24h)
   - Creator handle
3. Filter aggressively:
   - **Skip** anything older than 48h
   - **Skip** generic Claude prompt list videos with no production substance
   - **Skip** anything from creators with <5k followers unless the engagement is unusually high
   - **Skip** content that only references closed-source / OpenAI tooling unless it's directly comparable to Claude

## Output format

Return a markdown table with columns: **#** | **Platform** | **Hook (one sentence)** | **Pillar fit** | **Action** | **URL**

Pillar fit options (from `leddyai/brief.md`):
- `build_breakdown`
- `slop_callout`
- `tactical_tip`
- `trend_reaction`

Action options:
- `replicate` — same hook + same payload, on Justin's stack
- `innovate` — same hook structure, different angle (better, more substantive, anti-slop)
- `steal-and-credit` — repost with a clear credit / duet, used sparingly
- `skip` — listed for awareness, don't act on

Then below the table, write 2-3 sentences on the **trend of the day** — what pattern shows up across multiple candidates? Hooks that repeat, formats that repeat, topics that are spiking.

End with: *"Justin — send the URLs you want to keep to the Telegram bot and pick 💡 Inspiration. Promote them to 📚 Digest if you want a full transcript+verdict."*

## Constraints

- Do not invent URLs. If WebSearch can't find direct video URLs (TikTok in particular is hard to search), say so explicitly and offer to search for the creator's profile so Justin can browse manually.
- Do not pad the list. If you only find 6 strong candidates, return 6.
- No commentary about what Justin "should" do beyond the per-row Action column. The whole point of Phase 1 is that Justin's judgment is the differentiator.
- Push back if the day's pull is mostly slop — say so directly. The brief explicitly asks for challenge, not agreement.
