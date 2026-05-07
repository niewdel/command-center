---
name: leddy-ai
description: Use when working on the Leddy AI / LettyAI content engine — short-form video production for TikTok / Instagram / YouTube Shorts. Triggers on hook crafting, scripting, content pillar planning, batch shoot planning, posting calendar, performance review, competitive analysis in the AI creator space, or anything in the leddyai/ folder. Loads voice, audience, anti-slop positioning, and the Phase 1 / Phase 2 (Cowork) handoff boundary. Do NOT trigger for unrelated Command Center work — this skill is content-engine scoped.
---

# Leddy AI — Content Engine Skill

## What This Is

Daily short-form content for the **Leddy AI** brand (handle: LettyAI on TikTok, Instagram, YouTube Shorts). Face-front, screen-recording-back format. Anti-slop, builder-focused. Authority-first — monetization (inbound to Niewdel) is the downstream effect, not the immediate target.

Source-of-truth project brief: `leddyai/brief.md`. Cowork handoff log: `leddyai/cowork-handoff.md`.

## When to Use This Skill

- Writing hooks, scripts, captions, or video outlines for LettyAI
- Planning the batch shoot calendar or posting cadence
- Reviewing performance data and iterating on what works
- Competitive analysis / studying what's winning in the AI shorts space
- Mining Justin's existing project work (Niewdel, HD Operations Platform, i10 Solutions Client Dashboard, Command Center, custom skills, MCPs) for video ideas
- Anytime Justin opens a file under `leddyai/`

## When NOT to Use This Skill

- General Command Center engineering (use `command-center` skill)
- Other Niewdel client work that isn't content
- Sandler / i10 work

## The Phase Boundary (Critical)

There are two phases. We are in **Phase 1**.

**Phase 1 (now):** Manual build with Claude Code in the driver's seat for craft work. Goal: ship 20-30 videos, prove the system, document everything Cowork-bound.

**Phase 2 (later):** Hand the production-line components to Anthropic Cowork on a schedule. Brand voice, hooks, scripts, on-camera, editing decisions stay manual forever.

**Hard rule:** every component built in Phase 1 must be evaluated against "is this eventually a Cowork job?" If yes, document the handoff spec at the moment we build it — not at the end. Update `leddyai/cowork-handoff.md` in the same session.

Cowork-bound (document handoff specs as we build):
- Trend monitoring and news pulls
- Competitive analysis runs
- Content idea generation from existing project artifacts
- Performance reporting

Stays manual:
- Hook engineering (taste-driven)
- Script writing (voice-driven)
- On-camera production
- Editing in CapCut (iPad)
- Final posting

## Voice Rules (do not violate)

- Direct, specific, technical without losing the casual audience.
- No "I built this in 30 minutes" framing. Specific time estimates only when accurate.
- No generic Claude prompt tips. The differentiator is **operational substance from real client work**.
- No AI voiceover. Justin's voice, Justin's face.
- No Pika/Sora b-roll. Real screen recordings of real builds.
- Anti-slop is the through-line. If a script could be written by anyone with a Claude subscription, kill it.
- Push back on loose thinking. Justin wants challenge, not agreement.

## The 4 Content Pillars (rotation)

1. **Build breakdowns** (2x/week) — real things Justin built, how they work, why they're not slop.
2. **Slop callouts** (2x/week) — reactions to bad takes in the AI creator space.
3. **Tactical tips** (2x/week) — one specific thing per video. A skill, an MCP, a prompt pattern, a workflow trick.
4. **Trend reactions** (1x/week, flexible) — model drops, feature releases, news, hot takes.

## Script Framework

Adapted PAS (Problem → Agitation → Solution) with **rehook every 5-7 seconds**. Not MrBeast 90-second rehook cycles — short-form needs much faster pattern interrupts. Cognitive dissonance and pattern-interrupts are the core mechanic.

Hook library lives at `leddyai/hooks.md` (build it as we ship videos — start with 0, target 25 tested patterns by end of Phase 1).

## Inspiration Pipeline

Justin sends videos to the Telegram bot. Bot replies with an inline keyboard:
- 📚 **Digest** — full Claude analysis with verdict (MUST-ACT / WORTH EXPLORING / REFERENCE ONLY / SKIP). Used for educational content where Justin wants the actionable steps.
- 💡 **Inspiration** — saved with thumbnail only, no analysis. Used for visual format reference, hook patterns to study, trend tracking.

Both kinds appear at `/videos` in Command Center, in separate tabs. Inspirations can be promoted to digest later if Justin decides one is worth the deeper read.

When working on a script, default to checking Inspirations first for visual/format reference; check Digests for substance and source material to build on.

## Phase Transition Criteria

We propose moving to Phase 2 only when ALL are true:
- System fully documented
- Hook library has ≥25 tested patterns
- Script framework finalized with examples
- ≥20 videos posted
- ≥14 days of performance data
- `leddyai/cowork-handoff.md` complete with all Phase 2 candidates spec'd
- Justin explicitly approves the transition

Do not start building Cowork jobs until Phase 1 wraps. Document them, design for them, don't build them.

## What This Project Is NOT

- Not a faceless channel.
- Not long-form YouTube (yet).
- Not AI voiceover.
- Not generic Claude prompt content.
- Not Premiere or DaVinci. CapCut on iPad.
- Not Google Drive automation. Local-first, Command Center where it makes sense.

## Operating Notes for Claude

- Read `leddyai/brief.md` whenever this skill loads — that's the canonical source.
- When you produce a script, **always** include: hook, beat-by-beat shot list with rehook timestamps, on-screen text suggestions, and a 30/60/90-day performance hypothesis.
- Push back on weak hooks. If the hook doesn't pass cognitive-dissonance + pattern-interrupt tests in <5 seconds, say so and propose three alternatives.
- When ideating, mine the existing reservoir before reaching for trend topics: HD Operations Platform, Command Center, custom Claude Code skills, MCP integrations, sitework estimating reference, Sandler training builds, real client implementations.
- Update `leddyai/cowork-handoff.md` whenever we touch a Phase 2 candidate.
