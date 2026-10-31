# 01: Tokens, base styles, fonts, contrast metadata, DEC-010

Status: resolved
Blocked by: —
Spec: `../spec.md` (Design system, R4, R6, Constraints)

## Changes

**Fonts**
- `frontend/src/main.tsx`: import `@fontsource/lexend` weights 400/500/600/700. Keep JetBrains Mono. Remove the Delius imports.
- `tokens.css`: point `--font-display` and `--font-sans` at `'Lexend', system-ui, sans-serif` in both places (`@theme` and `:root`).

**Colour**
- `tokens.css`: put the spec's colour table into `@theme` and into the matching `:root, [data-theme=light]` and `[data-theme=dark]` blocks. Every colour is defined in two places today; keep the two in sync.
- Keep `--dim-1..10` unchanged.
- Update the `!important` text colour overrides (about lines 802–829) so each passes ≥ 4.5:1 on the canvas in both themes.

**Elevation and shape**
- Replace every `--shadow-*` value (light and dark) with the single soft elevation. In dark, use `none`.
- Apply the spec's radii.

**Base**
- Delete the dot grids on `html`, `body` and `.board-canvas`.
- Delete the dashed scrollbar track and the hero, card, wood and podium gradients.
- The canvas is plain `--color-canvas`.
- h1–h4 use Lexend at weight 600.

**Component classes**
- `.tactile-card` and `.editorial-card`: 1 px `--color-border`, radius xl, the soft elevation, no hover or active translate.
- `.hero-card`: a slightly larger padding only.
- `.tactile-btn`: 1 px border, no offset shadow, no press translate, `min-height: 44px`, 150–200 ms colour transition.
- `.focus-ring`: 2 px brand outline with a 2 px offset.
- `.doodle-tape`: neutralize (no rotation, no dash).
- Delete the unused classes: `.glass-dock`, `.doodle-highlight`, `.doodle-wobble-border`, `animate-brian-float`.
- Keep the reduced-motion and timed-trial rules working.

**Board and podium**
- `.board-wood-frame`, `.board-canvas` and the podium/plank classes become plain flat surfaces: canvas or surface with a 1 px border. Ticket 06 removes their usage.

**Contrast metadata**
- `src/styles/token-metadata.ts`: rewrite the pairs to the new values. Keep ≥ 20 pairs.
- Fix the mislabelled pairs: `light-border-canvas` must use border-strong and be labelled so; `light-danger-alert` gets a correct label.
- Add dark pairs for muted, brand and border-strong.

**Exercise contrast tables**
- Recompute the Stroop ink and Tower disc tables (from `.scratch/member1-ui-integration/issues/05` and `06` Comments) against the new dark surface `#111827`. Also recompute the light border-strong and secondary values used by the Tower selected ring.
- Append the new table to this ticket's Comments.
- If any value now fails, swap the token in that exercise file and say which.

**Docs**
- `docs/ui/DECISIONS.md`: add DEC-010 per R6.

## Tests

- **Contrast unit test:** `designSystem.test.tsx` uses `token-metadata`. It keeps passing with ≥ 20 pairs.
- **New `src/styles/tokens.test.ts`:**
  - parse `tokens.css` as text
  - assert `--color-canvas`, `--color-surface`, `--color-ink` and `--color-brand` in the light block equal the `token-metadata` values
  - assert no `Delius` remains in `tokens.css` or `main.tsx`
  - this keeps metadata and CSS from drifting apart, since the contrast script never reads the CSS

## Done when

- `npm run qa:checks` is green.
- A quick visual check: the dev server shows Lexend text, a flat background and no offset shadows. Describe it in the report.
- Commit with no AI attribution.

## Comments

**2026-10-30 — Exercise contrast tables recomputed (implementer, ticket 01).** WCAG 2.1 ratios against the new tokens: light surface `#FFFFFF` (unchanged), dark surface `#111827` (was `#1E293B`), dark ink `#F8FAFC`. Old values from `.scratch/member1-ui-integration/issues/05` and `06` Comments in brackets. **Every value still passes; no exercise token was swapped.** Every dark ratio rose. The only drops are in light, where `--color-secondary` and `--color-border-strong` changed from navy `#263D5B` to slate.

Stroop ink as text on `--color-surface` (≥ 4.5:1):

| Payload | Token | Light | Light ratio | Dark | Dark ratio |
|---|---|---|---|---|---|
| red | `--color-danger` | `#DC2626` | 4.83 (4.83) | `#F87171` | 6.41 (5.29) |
| green | `--dim-3` | `#008662` | 4.58 (4.58) | `#2DD4BF` | 9.53 (7.86) |
| blue | `--dim-1` | `#0072B2` | 5.19 (5.19) | `#56B4E9` | 7.69 (6.34) |
| yellow | `--dim-7` | `#7D7300` | 4.86 (4.86) | `#F0E442` | 13.42 (11.06) |
| (other) | `--color-ink` | `#0F172A` | 17.85 (17.74) | `#F8FAFC` | 16.96 (14.63) |

Tower disc label `DISC_INK = --color-surface` (white light, `#111827` dark) on each disc (≥ 4.5:1):

| Slot | Disc token | Light value | Label `#FFFFFF` | Dark value | Label `#111827` |
|---|---|---|---|---|---|
| 0 | `--dim-1` | `#0072B2` | 5.19 (5.19) | `#56B4E9` | 7.69 (6.34) |
| 1 | `--color-danger` | `#DC2626` | 4.83 (4.83) | `#F87171` | 6.41 (5.29) |
| 2 | `--dim-3` | `#008662` | 4.58 (4.58) | `#2DD4BF` | 9.53 (7.86) |
| 3 | `--dim-8` | `#4F46E5` | 6.29 (6.29) | `#818CF8` | 5.95 (4.90) |
| 4 | `--dim-7` | `#7D7300` | 4.86 (4.86) | `#F0E442` | 13.42 (11.06) |
| 5 | `--dim-2` | `#C45100` | 4.64 (4.64) | `#FF8C3B` | 7.66 (6.32) |
| 6 | `--dim-4` | `#9E4778` | 5.79 (5.79) | `#E899C8` | 8.30 (6.84) |
| 7 | `--color-secondary` | `#334155` (was `#263D5B`) | 10.35 (11.05) | `#CBD5E1` (was `#E7DFD8`) | 11.95 (11.11) |

Graphics (≥ 3:1):

| Element | Pair | Light | Dark |
|---|---|---|---|
| Tower selected peg ring (`ring-secondary`) | secondary on surface | 10.35 | 11.95 |
| same, against its `bg-surface-raised` fill | secondary on surface-raised | 9.45 | 9.89 |
| Tower peg base / N-back grid stroke | `--color-border-strong` on surface | 4.76 (11.05) | 6.92 (6.37) |
| same, on surface-raised | border-strong on surface-raised | 4.34 | 5.72 |
| N-back lit vs unlit cell | `--dim-1` on `--color-surface-raised` | 4.73 (4.64) | 6.36 (5.37) |
| N-back centre symbol | ink on surface-raised | 16.30 (15.88) | 14.03 (12.39) |
| Relational inverted-rule border | `--color-warning` on surface | 5.02 (3.19) | 10.63 (8.76) |
| UFOV canvas / MST strokes | ink on surface | 17.85 (17.74) | 16.96 (14.63) |

Text: Tower hint `.text-danger` (light override `#B91C1C`, dark `--color-danger`) on canvas 6.18 light (`#F8FAFC`), 6.81 dark (`#0B1120`).

Notes: the light disc label never changed (white), so the light disc column is identical; the thinnest margins are still `--dim-3` 4.58 light (Stroop green and Tower slot 2). Light border-strong dropped from 11.05 to 4.76 on surface but stays well above 3:1. Ink on a lit N-back cell alone is still under 3:1 (3.44 light, 2.21 dark), which is why the centre symbol keeps its unlit-colour halo.

- 2026-10-31 (TD-03 tracker hygiene): Done in 886d5f2, review clean (ui-calm-clean ledger).
