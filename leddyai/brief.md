**[PROJECT BRIEF]**

# Leddy AI Content Engine

## What This Is

A content production system for the **Leddy AI** brand on Instagram, TikTok, and YouTube Shorts. Daily short-form video output focused on AI, automation, Claude, Claude Code, MCPs, prompt engineering, and adjacent topics.

**Format:** Face-front, content-back. My face center frame, screen recordings and visual content as the backdrop.

**Primary goal:** Build authority and audience. Monetization (inbound leads to Niewdel) is the downstream byproduct, not the immediate target.

**Posting cadence:** Daily across all three platforms.

**Positioning:** "I run a consulting firm building real AI systems for real businesses. I show you what actually works, not the slop." Anti-slop, builder-focused, direct, no fluff.

## Two-Phase Project Structure

This project has two distinct phases. Both phases are part of THIS project, not separate efforts. Plan for both from day one.

### Phase 1: Build (Claude Code)

We are here. The goal of this phase is to build the system manually with Claude Code in the driver's seat for craft work that requires my judgment, voice, and taste. This phase ends when:

- The system is fully designed and documented
- I have produced 20-30 videos using the system
- I know which parts of the workflow are repetitive enough to automate
- The Cowork handoff is documented and ready to execute

### Phase 2: Automate (Cowork)

Once Phase 1 is complete, we transition the production-line components of the system to Anthropic Cowork running on a schedule. Phase 2 will handle:

- Daily/weekly trend monitoring across AI news, model releases, and creator space
- Recurring competitive analysis (what's working in the AI shorts space)
- Content idea generation pulled from my existing project work
- Performance reporting and iteration recommendations
- Anything else identified during Phase 1 as repetitive enough to delegate

What stays manual in Phase 2: brand voice work, hook crafting, scripting, on-camera performance, editing decisions. These need my judgment and don't get automated.

## Critical Phase 1 Design Constraint

**Build for handoff from day one.** Every component of the system designed in Phase 1 must be evaluated against this question: "Will this eventually be a Cowork job, or does it stay manual?"

Components likely to become Cowork jobs:
- Trend monitoring scripts and prompts
- Competitive analysis workflows
- Idea generation from existing project artifacts
- Performance tracking and reporting

Components that stay manual:
- Hook engineering (taste-driven)
- Script writing (voice-driven)
- On-camera production
- Editing and posting

For Cowork-bound components, design them as standalone, parameterized workflows with clear inputs, outputs, and storage locations. They should be runnable end-to-end without me in the loop. Document each one with:

- What it does
- What inputs it needs (and where they come from)
- What outputs it produces (and where they go)
- The exact prompt or script that runs it
- How often it should run

This documentation lives in `docs/cowork-handoff.md` and gets populated as Phase 1 progresses, NOT at the end. Every time we build something Cowork-bound, document the handoff spec at that moment.

## Why This Project Exists

The AI creator space on short-form is dominated by low-effort content: reused hooks, surface-level tips, generic Claude prompts, and "I built this in 30 minutes" videos that fall apart under scrutiny. There is a real gap for someone who actually builds production systems for clients and can speak to what works at a technical level without losing the casual audience.

I have the operational substance (Niewdel, HD Operations Platform, i10 Solutions Client Dashboard, Command Center, Telegram video digest, custom skills, MCPs, real client implementations). I need a system that turns that substance into daily content without burning my time.

## What Already Exists

- Brand: Leddy AI, accounts created on Instagram and TikTok
- Production setup direction: face-front, screen-recording backdrop, DaVinci Resolve for editing, my own voice (no AI voice)
- Existing content reservoir: HD Operations Platform, Command Center video digest feature, custom Claude Code skills, MCP integrations, sitework estimating reference, sales training content skill, Sandler training builds
- Stack familiarity: Next.js, React, Supabase, Railway, Claude Code, Cursor, Wispr for voice input

## The 4 Content Pillars

Daily output rotates across:

1. **Build breakdowns** (2x per week): Real things I built, how they work, why they're not slop
2. **Slop callouts** (2x per week): Reactions to bad takes in the AI creator space, dissecting what's wrong
3. **Tactical tips** (2x per week): One specific thing per video. A skill, an MCP, a prompt pattern, a workflow trick
4. **Trend reactions** (1x per week, flexible): New model drops, feature releases, news, hot takes

## What This System Needs to Produce (Phase 1 Deliverables)

1. **Content ideation engine**: Repeatable way to generate video ideas across the 4 pillars. Phase 2 candidate.
2. **Hook library**: Tested and untested hook patterns specifically engineered for shorts (not long-form), with cognitive dissonance and pattern interrupts as the core mechanic. Stays manual, taste-driven.
3. **Shorts-specific script framework**: Adapted from PAS (Problem, Agitation, Solution) with rehook every 5-7 seconds for shorts. NOT MrBeast 90-second rehooks. Stays manual.
4. **Production workflow**: Batch recording system, screen capture pipeline, DaVinci Resolve project template, caption workflow. Stays manual.
5. **Posting calendar and tracker**: What's scheduled, what's posted, what performed, what to iterate on. Phase 2 candidate for the tracking and reporting parts.
6. **Competitive intelligence**: Recurring analysis of what's working in the AI creator space. Phase 2 candidate.
7. **Performance feedback loop**: Track which hooks, topics, and formats win, feed insights back. Phase 2 candidate for the data pull and reporting.
8. **Cowork handoff documentation**: Living document in `docs/cowork-handoff.md` capturing every Phase 2 candidate component as it's built.

## Source Material to Integrate

I was given 5 prompts from a creator claiming 15.4M views and $32K revenue from the system. After review:

- **Prompt 2 (Script architecture, PAS + pattern interrupt + cognitive dissonance)**: Keep the core mechanic, adapt for shorts not long-form. Phase 1, manual.
- **Prompt 4 (Click + satisfaction loop, competitive analysis methodology)**: Keep as a recurring system for studying winners and beating them. Phase 2 candidate.
- **Prompt 1 (Niche validation)**: Transform into a real research methodology. Phase 1 manual research, Phase 2 ongoing trend monitoring.
- **Prompt 3 (Production stack)**: Cut. Stack is already decided.
- **Prompt 5 (Full automation via Cowork)**: This IS the Phase 2 architecture. Daily not weekly, local storage not Google Drive.

## What This Project Is NOT

- Not a faceless content channel. I'm on camera.
- Not a long-form YouTube channel (yet). Shorts only at start. Long form is a separate future consideration.
- Not AI voiceover. My voice, my face, my brand.
- Not Pika/Sora-driven b-roll generation. Real screen recordings of real builds.
- Not Google Drive automation. Local-first storage, Command Center integration where it makes sense.
- Not Premiere/CapCut. DaVinci Resolve.
- Not generic Claude prompt content. The differentiator is operational substance from real client work.
- Not Phase 2 yet. Do not start building Cowork jobs until Phase 1 wraps. Document them, design for them, don't build them.

## Phase Transition Criteria

Phase 1 is complete and we transition to Phase 2 setup when ALL of these are true:

- System is documented in full
- Hook library has at least 25 tested patterns
- Script framework is finalized with examples
- At least 20 videos have been produced and posted
- Performance data exists for at least 14 days
- `docs/cowork-handoff.md` is complete with all Phase 2 candidate components specified
- I explicitly approve the transition

When all criteria are met, propose the Phase 2 setup plan and wait for approval before building any Cowork infrastructure.

## Discovery Focus Areas

When you run discovery, prioritize these categories:

1. **Voice and brand** (how I talk, what I refuse to do, what makes me me on camera)
2. **Audience and positioning** (who I'm trying to reach, how I differentiate from the slop crew)
3. **Content sourcing** (how to mine my existing work for video ideas without exposing client confidentiality)
4. **Production workflow** (batch recording cadence, edit time budget, posting workflow)
5. **Performance and iteration** (what does success look like at 30/60/90 days, what metrics matter)
6. **Competitive landscape** (who are the standards in the space, what do they do well, what do they miss)
7. **Phase 2 boundaries** (what I want automated vs what I want to keep my hands on)

Push back where my thinking is loose. I want challenge, not agreement.

## First Deliverable Target

A complete script and production plan for the kickoff video: the Telegram video digest setup with the slop-bait-and-switch hook. This becomes the proof of concept for the full system.
