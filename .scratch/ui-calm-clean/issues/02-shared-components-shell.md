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

## Comments

**2026-10-30 — Amended palette deltas (implementer, ticket 02).** Applied light `--color-danger` `#B91C1C` (`@theme` and the light block) and dark `--color-border` `#334155`. WCAG 2.1 ratios; ticket 01 values in brackets. Everything still passes; no exercise token was swapped.

| Use | Pair | Light | Dark (unchanged) |
|---|---|---|---|
| Stroop red ink | `--color-danger` text on surface | 6.47 (4.83) | 6.41 |
| Tower disc slot 1 | white label on `#B91C1C` (dark: `#111827` on `#F87171`) | 6.47 (4.83) | 6.41 |
| Danger Button text | `text-surface` on `bg-danger` | 6.47 (4.83) | 6.41 |
| `.text-danger` on canvas | danger on `#F8FAFC` / `#0B1120` | 6.18 (6.18, was the `#B91C1C` override) | 6.81 |
| `.text-danger` on surface-raised | danger on `#F1F5F9` / `#1F2937` | 5.91 (4.41 for the old token) | 5.31 |
| Danger Badge / Card | danger on danger-subtle | 5.91 | 5.84 |

`.text-danger` no longer needs its light `#B91C1C` override; it is now `var(--color-danger)` in both themes. The `token-metadata.ts` pairs `light-danger-alert` and `light-danger-text-subtle` now name `--color-danger #B91C1C`.

Dark `--color-border` `#334155` is a divider/card edge only: 1.71 on surface, 1.82 on canvas, 1.42 on surface-raised. That's acceptable because it marks no control boundary (the 3:1 control boundary is `--color-border-strong`, 6.92 / 5.72). So it has no metadata pair; the new drift guard in `tokens.test.ts` checks each `--color-*` hex that `token-metadata.ts` audits against the CSS block for its theme.

Badge tones (subtle tinted fill, toned text, no border):

| Tone | Classes | Light | Dark |
|---|---|---|---|
| brand / info | brand on brand-subtle | 5.62 | 5.36 |
| success | success on success-subtle | 4.79 | 8.55 |
| warning | warning on warning-subtle | 4.84 | 8.73 |
| danger | danger on danger-subtle | 5.91 | 5.84 |
| reward | ink on `reward/20` (over surface) | 15.36 | 10.96 |
| neutral | ink-muted on surface-raised | 6.92 | 5.72 |
| low-confidence | ink-muted on surface, dashed 1 px border-strong | 7.58 | 6.92 |

Header: logo is `BrianLogo` (currentColor = `--color-ink`): 17.85 light, 16.96 dark on surface. Active nav = brand text + 2 px brand underline (6.29 / 5.95); inactive = ink-muted (7.58 / 6.92).
