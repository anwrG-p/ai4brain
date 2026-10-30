# 01: Tokens, base styles, fonts, contrast metadata, DEC-010

Status: ready-for-agent
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
