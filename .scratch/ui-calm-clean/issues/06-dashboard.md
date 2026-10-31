# 06: Dashboard (`/dashboard`)

Status: wontfix
Blocked by: 02
Spec: `../spec.md` (Goal, R1, R2, R5)

## Target layout

Replace the SlideDeck with a single scrolling page. Max width about 1024 px.

1. **Greeting h1:** must match /Good morning|Welcome back/. One line under it, "Next: {dimension} · 2 min", and **one primary CTA**, the link /Start Today's 2-Min Flow/ (keep the name and target).
2. **"Your dimensions":** a responsive grid of small, flat metric tiles (Card default, no nesting). Each tile shows the consumer name, one number, and a small trend arrow with its delta as text, never colour alone. Keep the pinned text "Working Memory" unique on the page.
3. **"Core Balance Insights"** (keep the heading text): one card with the 3 metrics as plain rows, plus the weekly goal bar. Use `font-mono-tabular` for numbers.
4. **Radar:** a `<details>` "How sure is this?" holding UncertaintyRadar. Keep the radar dimension buttons, for example /WM/, reachable by the existing test. Check how `designSystem.test.tsx` queries them before placing them in a closed `<details>`. If a closed drawer hides them from the query, render the radar visibly below the tiles in a single Card.
5. **`data-testid="brian-teacher-slot"`** must stay in the DOM. Render a small Brian (size sm) **only** in the greeting area on the empty state or the celebrate state. Otherwise the slot holds nothing visual: an empty `div` with the test id.

## Remove from the visible layer

- the classroom board, wood frame, podium and plank
- the Teacher Brian scale and translate tuning constants
- the dashed 7-day strip, unless it maps to real data. If it does, it becomes a simple row of 7 dots with text labels.
- the daily tip box, which can move into a drawer
- the frustrated-emotion banner's decorative chrome. Keep the message.

## States

Keep loading, empty, error and extreme behaviour, restyled flat. Empty and error may show the mascot, because those are state signals.

## Copy

This page is not copy-lint exempt. "38 ms Jitter" becomes consumer language ("Consistency"), with the ms value in a drawer.

## Tests

- `designSystem.test.tsx`'s Dashboard test passes unchanged: heading, `brian-teacher-slot`, link, the WM radar button, and the unique texts.
- `e2e/dashboard.spec.ts` passes on Edge: axe light and dark, sizes.
- **New tests:**
  - no `.board-wood-frame` or `.board-canvas` in the DOM
  - exactly one primary CTA outside `details`
  - every trend shows a text delta

## Done when

`qa:checks` is green, the dashboard e2e passes, and the commit has no AI attribution.

## Comments

- 2026-10-31 (TD-03 tracker hygiene): Superseded by `.scratch/brand-v2/` (brand-v2 ticket 08 is the dashboard).
