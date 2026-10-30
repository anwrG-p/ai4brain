# 02: Shared components and AppShell

Status: ready-for-agent
Blocked by: 01
Spec: `../spec.md` (Components, R1, R3, R5)

## Changes

**Button** (`components/ui/Button.tsx`)
- Variants:
  - primary: solid brand with brand-ink
  - secondary: surface with a 1 px border-strong
  - ghost: text only
  - danger
  - reward
- Sizes sm, md and lg: every size is at least 44 px tall. sm is 44 px minimum height with smaller text.
- Use `font-sans` at weight 600. No translate on hover or press.
- Keep the props API and the `...rest` forwarding, because pressProps depends on it.

**Card** (`components/ui/Card.tsx`)
- Keep the variants. default and raised use the new `.tactile-card`.
- low-confidence: a 1 px dashed border, no hatching.
- danger: danger-subtle fill.
- Default padding is p-5, or p-6 on md screens and up.

**Badge** (`components/ui/Badge.tsx`)
- Remove the `border-2 border-border-strong`.
- Each tone uses a subtle tinted background with toned text, ≥ 4.5:1 in both themes. low-confidence: dashed 1 px.

**DoodleDecorations.tsx**
- Every export renders `null` and keeps its props type, so no import breaks.

**Mascots** (BrianMascot, NodiCompanion)
- Remove the pulsing blur halos, `animate-ping` badges and the framer float/rotate.
- Speech bubbles become a plain 1 px-border surface.
- Keep the APIs, poses and `data-testid`s.

**AppShell** (`components/layout/AppShell.tsx`)
- Header: `h-16`, 1 px bottom border, surface background.
- **Remove the hard-coded streak pill "🔥 12d · Wed Rest".** It is a fake claim (R5).
- Remove the unused SVG `<defs>` (the `hand-ink` filter). The `diagonalHatch` pattern moves to DesignSystemPage, its only user, or is dropped if trivial.
- Nav pill: plain text links with an active indicator (brand text plus a 2 px underline). Mobile bottom tabs: Lucide icons with labels.
- Keep the theme-toggle accessible names "Dark (Night Lab)" and "Light (Playful Lab)" exactly. 18 specs click them.
- `page-progress-badge`: a small muted Badge. Keep its texts per the AppShell test.
- Footer: one muted line with the non-clinical notice, plus HumanReviewGate unchanged.

## Tests

- All existing tests stay green unchanged, including the AppShell and EmilyMoodPill/ReviewGate test ids and the TaskRunner drawer card-class test.
- **New Button test:** every variant renders with no `translate` class, and every size has a min-h-11 or 44 px class.
- **New Badge test:** no `border-2` class.
- **New AppShell test:** no element contains "🔥" or "12d".

## Done when

- `npm run qa:checks` is green.
- Run Playwright on Edge through a scratch config for `welcome`, `taskRunner` and one other spec. Axe must be clean in light and dark.
- Commit with no AI attribution.
