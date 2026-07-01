# Niewdel Brand v3.0 — build reference (from Brand Guidelines v3.0, June 2026)

Concrete rules for every surface built this session (CRM, proposals, invoices). Dark-first.

## Color (5 core; blue is the ONLY chromatic accent, emphasis only — never body text)
- **Jet Black `#0D0D0D`** — primary dark background
- **Onyx `#1A1A1A`** — surfaces, cards
- **Niewdel Blue `#3B86DB`** — primary accent, CTAs, links, emphasis
- **Deep Navy `#1B4D8F`** — secondary, gradients, pressed
- **Cloud White `#F5F5F5`** — text on dark
- Blue scale: `#6FA6E6 #4F92E0 #3B86DB #2D6CC0 #1B4D8F #112F5C`
- Signature gradient: `linear-gradient(135deg, #3B86DB, #1B4D8F)`
- System tokens: muted `#9AA3A8` · faint `#5C666D` · hairline `#262B2E` · elevated `#141719` · light page `#F4F6F8` · ink `#14181B` · success `#2E7D5B` · warning `#B8841A` · error `#C0413A`
- Usage: dark-first (Jet base → Onyx → elevated cards). White-on-blue for buttons/large bold only; body text = white on dark (never text on a blue fill). On light surfaces use Deep Navy for accent text/links.
- NOTE: the app's `globals.css` already maps these (var names `--paper`/`--ink`/`--rust`=blue etc.). Build on the existing tokens + the report utilities (`.report-eyebrow`, `.report-card`) where they fit; reuse, don't redefine.

## Typography
- **Montserrat** — structural: headings, nav, CTAs, UI, labels. Weights 400/600/700/800.
- **Inter** — body copy, docs, long-form. Weights 400/500/600.
- Scale: Display 48 · H1 32 · H2 24 · H3 18 · Body 16 · Small 14 · Caption 12.
- Line-height 1.5 body / 1.2 headings. Tracking: headings −0.02em; eyebrow labels +0.2em uppercase in Niewdel Blue.

## Layout & components
- **Primary button** = Niewdel Blue **pill**, white bold Montserrat, optional ` →`. **Secondary** = hairline outline.
- Spacing: 4px base.
- Corner radius: **sm 6px · md 9px · lg 12px · pill 40px**.
- **Cards**: Onyx or elevated fill with a hairline border on dark (white + light hairline on light surfaces). **Blue-dot bullets, not default discs.** Eyebrow-label pattern (uppercase caption in blue) above card titles.

## Voice & tone (direct, anti-corporate, outcome-first — lead with the result)
- DO: short sentences; **bold** for emphasis; contractions fine; use "you own everything," "get found everywhere," "game plan"; challenge weak thinking with reasoning.
- DON'T: **never use em-dashes** (use commas, periods, colons); no AI slop ("I'd be happy to," "Certainly," "Let's dive in"); no buzzwords ("synergy," "world-class," "cutting-edge"); don't over-explain the obvious.
- Voice line: **"Built for how your business runs."** Tagline: "We build what you can't imagine yet."
- Identity: a real software + marketing studio, developers-first, anti-agency, transparent, local, outcome-driven. Premium and modern, technical without being cold. NOT a template farm, not hype, not playful/cutesy, not enterprise-stiff.

## For AI-generated copy (proposals, empty states, microcopy)
Follow the voice rules above verbatim. No em-dashes. Outcome-first. Short. This is client-facing brand copy.
