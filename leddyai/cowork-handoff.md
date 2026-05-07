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

### (Add new components here as we build them.)
