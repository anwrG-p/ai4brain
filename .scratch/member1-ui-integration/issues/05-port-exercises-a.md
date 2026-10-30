# 05: Port exercises A (N-back, Stroop, Matrix, Mental rotation)

Status: ready-for-agent
Blocked by: 04
Spec: `../spec.md` (R6, Constraints)

## Files

Copy from `assessment_engine/client/src/tasks/` to `frontend/src/features/assessment/tasks/`:

- `NBack.tsx`, `Stroop.tsx`, `Matrix.tsx`, `MentalRotation.tsx`
- their tests

Wire their cases into `TaskRunner.tsx`.

## Restyle rules

These apply to every component in tickets 05 and 06:

- **Primitives.** Response buttons use `components/ui/Button` (or `.tactile-btn .focus-ring`). The stimulus area uses a `Card`. Keep `pressProps` behaviour: the pointerdown answer and the keyboard click with `detail === 0`. Spread `pressProps` onto the Button and confirm Button forwards those handlers.
- **Tokens only.** Use Tailwind token classes or `var(--…)`. Never hex, `rgb()` or `hsl()`, and never arbitrary `p-/m-/gap-/text-/rounded-/duration-[…]` values. Size and position can use inline `style` with numbers or `var(--space-n)`.
- **Contrast** must pass axe in **light and dark** themes.
  - **Stroop ink colours:** map payload colour names to a small set of theme-aware token pairs that reach ≥ 4.5:1 on `--color-surface` in both themes. Use `--dim-n` only if it measures ≥ 4.5:1.
  - Add a unit test that the Stroop palette contains no raw colour values.
  - Record the measured contrast ratios in the ticket's Comments.
- **Copy.** Use consumer language. N-back is "Memory Sharpness" in the glossary, so name the screen in plain words. Key hints stay visible (e.g. "Position match (A)").
- **No new mascot.** The page owns the chrome.
- **Accessibility kept:** keyboard paths, text labels (not colour alone), `aria-label`s, and `role="alert"` where present.

## Tests

- Port every test unchanged in meaning: timing, events, repeat-key, modifier keys, visibility abort, and the keyboard-click tests.
- **Ticket 01 additions** must keep passing: Stroop `congruent`, rotation `angle_deg`/`mirrored`.
- **New:** each component renders with no hex or `rgb(` in its `style` attributes. One snapshot-free DOM query per component.

## Done when

From `frontend/`: `npx vitest run src/features/assessment`, typecheck, `lint:tokens` and `lint:copy` are clean. Commit with no AI attribution.

## Comments

**2026-10-30 — Stroop ink palette (implementer).** WCAG 2.1 contrast of each ink token as text on `--color-surface` (light `#FFFFFF`, dark `#1E293B`). Text needs ≥ 4.5:1.

| Payload name | Token | Light value | Light ratio | Dark value | Dark ratio |
|---|---|---|---|---|---|
| red | `--color-danger` | `#DC2626` | 4.83 | `#F87171` | 5.29 |
| green | `--dim-3` | `#008662` | 4.58 | `#2DD4BF` | 7.86 |
| blue | `--dim-1` | `#0072B2` | 5.19 | `#56B4E9` | 6.34 |
| yellow | `--dim-7` | `#7D7300` | 4.86 | `#F0E442` | 11.06 |
| (other) | `--color-ink` | `#111827` | 17.74 | `#FFFFFF` | 14.63 |

Rejected: `--color-success` (green, 3.30 light), `--dim-5` (yellow, 4.29 light; fine for the ≥ 3:1 glyphs in `svg.tsx`), `--color-warning` (3.19 light), `--dim-9` (green alt., 5.47 / 7.61 but reads teal in light). `--dim-3` is the thinnest margin (4.58 light). Light `--dim-7` is a dark olive-yellow; dark `--dim-7` is the Okabe-Ito yellow.

N-back grid (graphics, ≥ 3:1): lit `--dim-1` vs unlit `--color-surface-raised` = 4.64 light / 5.37 dark. The centre symbol is `--color-ink` with an unlit-colour halo (ink on surface-raised 15.88 / 12.39), so it stays readable on a lit centre cell (ink on `--dim-1` alone is 3.42 / 2.31).
