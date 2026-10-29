# 06: Port exercises B (Relational, Tower, UFOV, MST)

Status: ready-for-agent
Blocked by: 04
Spec: `../spec.md` (R6, Constraints). Restyle rules: see `05-port-exercises-a.md`.

## Files

Copy from `assessment_engine/client/src/tasks/` to `frontend/src/features/assessment/tasks/`:

- `Relational.tsx`, `Tower.tsx`, `Ufov.tsx`, `Mst.tsx`
- their tests

Wire their cases into `TaskRunner.tsx`.

## Component-specific notes

- **Tower:** the disc `PALETTE` hex values become tokens. Use `var(--dim-1..8)` only where white text on that colour is ≥ 4.5:1 in both themes; otherwise use dark text on a light token. Keep the rule that payload IDs never reach CSS (the existing test). Keep the 60 s limit from ticket 01.
- **UFOV (canvas):**
  - Read colours once per trial with `getComputedStyle(canvas).getPropertyValue('--color-ink' | '--color-surface' | …)`. No literal colours.
  - Keep frame-locked timing exactly: the stimulus and `recorder.start` happen in the same rAF callback, and the mask is drawn on callback n.
  - The jsdom guard for `getContext` returning null stays.
- **Relational:** the sr-only text uses the frontend's `sr-only` utility class instead of the inline style.
- **MST:** the encoding phase must pass axe. The e2e runs axe on `/task/episodic_pattern_separation` right after load, during encoding.

## Tests

- Port all tests unchanged in meaning. In particular:
  - UFOV's 120 Hz frame test and `shown_ms` → QUEST update
  - Tower's input-capture latency/jitter test and the payload-never-in-CSS test
  - Relational's staircase and empty-levels tests
  - MST's encoding-pause and timeout tests
  - the Tower 60 s limit from ticket 01
- **New:** UFOV reads its canvas colours from CSS variables (stub `getComputedStyle`, assert it is called with token names).

## Done when

From `frontend/`: `npx vitest run src/features/assessment`, typecheck and both lints are clean. Commit with no AI attribution.
