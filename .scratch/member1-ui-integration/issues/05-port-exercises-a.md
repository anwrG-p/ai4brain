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
