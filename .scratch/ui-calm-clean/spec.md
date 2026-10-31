# Spec: "Calm & Clean" redesign of the SynapseTwin UI

Status: resolved
Owner: Member 1 (Mazen), with team agreement. The PR goes to the UI owner for review (DEC-001).
Date: 2026-10-30
Branch: `feat/ui-calm-clean` (based on `feat/member1-ui-integration`)

## Goal

The team finds the current UI too bulky. The goals are:
- visual clutter: doodles, cursive fonts, offset shadows, heavy borders, dot grids, decorative mascots
- too much text
- too many steps

Move to a **Calm & Clean** style, flat and minimal:
- off-white canvas, white surfaces
- one primary colour and one accent
- one soft elevation
- Lexend type
- generous whitespace
- the mascot only where it signals a state (celebrate, empty, error)

Scope:
1. Rebuild the design system: tokens, base styles and shared components. Every page picks it up.
2. Rework the 4 key flows: Welcome, Onboarding, Assessment hub, Dashboard.

Other pages inherit the new look and are not restructured.

## Evidence and sources

- `docs/research/2026-10-30-ui-simplification-review.md`, §1 and §3:
  - visual complexity hurts first impressions; colour matters little
  - halve the copy and front-load it
  - decorative mascots get ignored
  - drop tutorial decks
  - consent can be short but must be fair
- UI/UX Pro Max design-system output: Flat Design / Swiss Minimalism, WCAG AAA-capable.
  - Typography: **Lexend**, designed for readability. DEC-006 had already chosen it.
  - Rules: one primary CTA per screen; touch targets ≥ 44 px; colour never the only signal; transitions 150–300 ms; respect reduced motion.

## Design system (binding values)

### Typography

- **Lexend for everything:** `--font-display` and `--font-sans`, weights 400, 500, 600 and 700.
- **JetBrains Mono** for tabular numbers.
- Remove the Delius and Delius Swash Caps imports. `@fontsource/lexend` is already a dependency.
- **Type scale:** 12 / 14 / 16 (body) / 18 / 20 / 24 / 32. Body line-height 1.6. Headings weight 600, tracking normal.

### Colour

Exact values. Every text pair must reach ≥ 4.5:1 and every UI or graphic boundary ≥ 3:1. Recompute each pair; the numbers in brackets are expected ratios.

| Token | Light | Dark |
|---|---|---|
| `--color-canvas` | `#F8FAFC` | `#0B1120` |
| `--color-surface` | `#FFFFFF` | `#111827` |
| `--color-surface-raised` | `#F1F5F9` | `#1F2937` |
| `--color-ink` | `#0F172A` | `#F8FAFC` |
| `--color-ink-muted` | `#475569` | `#94A3B8` |
| `--color-border` (dividers, card edges) | `#E2E8F0` | `#334155` |
| `--color-border-strong` (control boundaries, ≥ 3:1) | `#64748B` | `#94A3B8` |
| `--color-brand` (primary) | `#4F46E5` | `#818CF8` |
| `--color-brand-hover` | `#4338CA` | `#A5B4FC` |
| `--color-brand-subtle` | `#EEF2FF` | `#1E1B4B` |
| `--color-brand-ink` (text on brand) | `#FFFFFF` (≈ 6.3) | `#0B1120` |
| `--color-accent` | `#0F766E` (teal) | `#2DD4BF` |
| `--color-accent-ink` | `#FFFFFF` | `#0B1120` |
| `--color-secondary` | `#334155` | `#CBD5E1` |
| `--color-reward` / `-ink` | `#F59E0B` / `#0F172A` | `#FBBF24` / `#0B1120` |
| `--color-success` / `-subtle` | `#15803D` / `#F0FDF4` | `#4ADE80` / `#052E16` |
| `--color-warning` / `-subtle` | `#B45309` / `#FFFBEB` | `#FBBF24` / `#422006` |
| `--color-danger` / `-subtle` | `#B91C1C` / `#FEF2F2` | `#F87171` / `#450A0A` |
| `--color-info` / `-subtle` | = brand / `#EEF2FF` | = brand / `#1E1B4B` |

Other colour rules:
- **`--dim-1..10` (Okabe-Ito dimension colours) are not changed.** The ported exercises' contrast tables depend on them.
- Recompute those tables against the new dark surface `#111827`. It is darker than the old `#1E293B`, so the ratios should rise. Confirm that they do.
- The hard-coded `!important` text colours (`.text-brand`, `.text-warning`, `.text-success`, `.text-danger`, at about tokens.css:802–829) must follow the new palette and still pass contrast on the canvas.
- Emotion overrides stay scoped to EmilyMoodPill and keep the Anti-Red rule. Retint them only if they fail contrast.

### Shape and elevation

| Aspect | Rule |
|---|---|
| Radii | sm 6, md 10, lg 12, xl 16, pill. Cards use xl, buttons md. |
| Elevation | **One soft elevation** for cards and popovers, roughly `0 1px 2px rgb(15 23 42 / .06), 0 2px 8px rgb(15 23 42 / .06)`. Dark theme: a 1 px border only, no shadow. No offset or hard shadows anywhere. Shadow tokens live in `styles/` only. |
| Borders | 1 px `--color-border` on cards. No `border-2` on cards or badges. Controls use `--color-border-strong` where a visible boundary is needed. |
| Hover and press | Colour or background change, 150–200 ms. **No translate movement.** |
| Focus | 2 px brand outline with a 2 px offset, visible in both themes. |
| Background | Plain canvas. Remove the dot grids, dashed scrollbar track, gradients, wood, podium and paper textures. |

### Components

- **Keep the class names and APIs** (`.tactile-card`, `.tactile-btn`, `.editorial-card`, `.hero-card`, `.focus-ring`, and the Button, Card and Badge props). Change only their visuals. Tests, the reduced-motion and timed-trial rules, and DEC-007 depend on them.
- **Button:**
  - minimum height 44 px
  - primary = solid brand
  - secondary = surface with a 1 px `border-strong` border
  - ghost = text only
  - danger = solid danger
  - reward = reward fill with reward-ink
- **Badge:** subtle tinted fill with toned text. No border.
- **DoodleDecorations:** every export renders `null`. Remove the imports later, page by page.
- **Mascots** (BrianMascot, NodiCompanion): drop the pulsing halos and ping badges. Use only for celebrate, empty and error states; key pages remove the purely decorative instances.
- **AppShell:**
  - header height 64 px (`h-16`, as DEC-008 requires) with a 1 px bottom border
  - logo, 5-item nav, theme toggle, Privacy, Settings, EmilyMoodPill
  - **remove the hard-coded "🔥 12d" streak pill** (a fake claim, DEC-008)
  - remove the unused SVG defs
  - `page-progress-badge` stays but becomes small and muted
- **Icons:** Lucide (already a dependency) instead of emoji wherever a page is reworked.

## Rulings

- **R1. Keep every test-pinned selector and name** (DEC-007), even where the copy changes. The full list is in the tickets. If wording must change and a test pins it, keep the pinned string. Example: the h1 "Let's map how your mind works…".
- **R2. Technical content moves into `<details data-technical-drawer>`** (ADR 0001). This covers QUEST+, endpoints, JSON, inspector and persona switchers, and safeguards. E2E `openJudgeMode` opens those drawers, so the pinned controls inside them stay reachable.
- **R3. No new dependencies.** Lexend and Lucide are already installed.
- **R4. Dark theme is designed together with light** and reaches zero axe violations.
- **R5. Truth in claims (DEC-008).** Remove any visible fake number or status you touch, such as the streak pill or decorative "stat tiles", rather than restyling it.
- **R6. Record the direction in a DEC-010 entry** in `docs/ui/DECISIONS.md`, with status "accepted by the team, pending UI owner". It supersedes the Doodle/Delius direction and points to this spec.

## Constraints

- From `frontend/`, `npm run qa:checks` must be green: lint:tokens, lint:copy, check:contrast, tests, build.
  - `check-contrast.mjs` reads only `src/styles/token-metadata.ts`. Update that file to the new values, keep ≥ 20 pairs, and fix the mislabelled pairs (`light-border-canvas`, `light-danger-alert`).
  - `lint-tokens` bans hex values, `rgb()` and bracket spacing classes outside `src/styles/`.
- Axe: zero violations in light and dark on every e2e spec. No horizontal overflow at 375, 768 and 1440 px.
  - Chrome is not installed, so run Playwright through a scratch config with `channel: 'msedge'`. Do not change the repo config.
- Do not add `--shadow-*` tokens to `@theme`. That would revive 102 dead `shadow-doodle*` classes. Sweeping those dead classes is optional cleanup.
- No AI attribution in commits.

## Tickets

| # | Ticket | Blocked by |
|---|---|---|
| 01 | Tokens, base styles, fonts, contrast metadata, DEC-010 | — |
| 02 | Shared components and AppShell | 01 |
| 03 | Welcome page | 02 |
| 04 | Onboarding | 02 |
| 05 | Assessment hub | 02 |
| 06 | Dashboard | 02 |
| 07 | Verify everything, regenerate screenshots, docs | 03–06 |

## Done when

- `qa:checks` is green.
- All e2e specs pass on Edge: axe clean in light and dark, no overflow.
- The 4 key pages each meet the following:
  - one primary CTA per screen
  - about half the previous visible copy
  - no nested cards, no doodles, no decorative mascot
  - technical detail only inside drawers
- Screenshots in `docs/ui/screenshots/` are regenerated.
- DEC-010 is recorded.

## Comments

- 2026-10-31 (TD-03 tracker hygiene): Closed: tickets 01–03 done (886d5f2, 9c6065a, 5c74f79); tickets 04–07 `wontfix`, superseded by `.scratch/brand-v2/spec.md`.
