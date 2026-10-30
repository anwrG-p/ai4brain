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

## Comments

**2026-10-30 — Tower disc palette (implementer).** White label text fails on every `--dim-n` in the dark theme (the dark dims are light: 1.32–2.98:1), so the disc label is painted in `--color-surface` instead: white in light, slate `#1E293B` in dark. WCAG 2.1 contrast of that label on each disc token (text needs ≥ 4.5:1):

| Slot | Disc token | Light value | Label `#FFFFFF` | Dark value | Label `#1E293B` | (white on dark, rejected) |
|---|---|---|---|---|---|---|
| 0 | `--dim-1` | `#0072B2` | 5.19 | `#56B4E9` | 6.34 | 2.31 |
| 1 | `--color-danger` | `#DC2626` | 4.83 | `#F87171` | 5.29 | 2.77 |
| 2 | `--dim-3` | `#008662` | 4.58 | `#2DD4BF` | 7.86 | 1.86 |
| 3 | `--dim-8` | `#4F46E5` | 6.29 | `#818CF8` | 4.90 | 2.98 |
| 4 | `--dim-7` | `#7D7300` | 4.86 | `#F0E442` | 11.06 | 1.32 |
| 5 | `--dim-2` | `#C45100` | 4.64 | `#FF8C3B` | 6.32 | 2.32 |
| 6 | `--dim-4` | `#9E4778` | 5.79 | `#E899C8` | 6.84 | 2.14 |
| 7 | `--color-secondary` | `#263D5B` | 11.05 | `#E7DFD8` | 11.11 | 1.32 |

Hue order mirrors the old hex palette (blue, red, green, purple, yellow, then orange for teal, pink, slate). Rejected: `--dim-5` (4.29 light), `--dim-6` / `--dim-9` (pass, but near-duplicates of `--dim-1` / `--dim-3`), `--dim-10` (passes, near-duplicate of `--dim-4`). Thinnest margins: `--dim-3` 4.58 light, `--dim-8` 4.90 dark.

Other graphics (≥ 3:1): Tower selected peg `ring-brand` over the Card surface 3.21 light / 6.37 dark (plus `aria-pressed` and a `bg-surface-raised` fill); peg base `--color-border-strong` on surface 11.05 / 6.37. Relational inverted-rule border `--color-warning` on surface 3.19 / 8.76 (the "Rule inverted" text carries the meaning). UFOV canvas: `--color-ink` on `--color-surface` 17.74 / 14.63. MST strokes are `currentColor` = `--color-ink` on the Card surface (same ratios). Tower hint uses `.text-danger` (`#B91C1C` override) 6.02 on canvas light, 6.20 dark.
