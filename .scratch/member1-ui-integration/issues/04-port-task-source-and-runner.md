# 04: Port the task source, fixtures, SVG primitives and the TaskRunner switch

Status: resolved
Blocked by: 02
Spec: `../spec.md` (R1, R2, D1)

## Files

Copy from `assessment_engine/client/src/tasks/` to `frontend/src/features/assessment/tasks/`:

- `taskSource.ts`
- `fixtures.json`
- `svg.tsx`
- `TaskRunner.tsx`

Port their tests too, plus `App`'s `SkipOnError` boundary as `features/assessment/SkipOnError.tsx`.

## Changes

- **Mock flag:** use the frontend's convention, `import.meta.env.VITE_USE_MOCKS !== 'false'` (on by default). Remove `VITE_MOCK_TASKS`.
- **`fetchNextTask(userId, seq, opts?: { schemaType?: TaskSchemaType })`:**
  - In mock mode, return the fixture whose `schema_type === opts.schemaType`, else `fixtures[seq % 8]`.
  - In real mode, ignore `schemaType` (R2) and keep the existing validation.
- **IDs:** keep `getUserId()` (key `aura_uid`) and `newId()`.
- **Types:**
  - Reuse the frontend's `TaskSchemaType` from `types/index.ts`, which has the same 8 literals.
  - Keep our stricter `TaskPayload` locally (`surface_seed: number` required).
- **`TaskRunner`:**
  - Same switch. The `voice` prop is removed (D1).
  - Its cases import the components from tickets 05 and 06. Until they exist, unported cases render the existing "Unsupported" fallback, which keeps its 1.5 s skip.
- **`svg.tsx`:**
  - Colours come from `currentColor` or `var(--…)` tokens. No hex.
  - GlyphView colours come from the payload's CSS colour names. Map them to tokens through a small table: blue→`var(--dim-…)`, …. Unknown names fall back to `var(--color-ink)`. The `aria-label` keeps the colour name.

## Tests

- **Ported tests:** taskSource validation, fixture invariants (tower BFS, n-back truth table, matrix 9 cells, CSS colour names), svg render tests.
- **New:** in mock mode, `fetchNextTask('u', 0, { schemaType: 'tower' })` returns the tower fixture.
- **New:** an unknown colour name in GlyphView renders with the ink token and no hex.

## Done when

From `frontend/`: `npx vitest run src/features/assessment`, typecheck and both lints are clean. Commit with no AI attribution.

## Comments

- 2026-10-31 (TD-03 tracker hygiene): Done in f6179ac..6342784, review clean (member1-ui-integration ledger).
