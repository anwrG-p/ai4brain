# 01: Brand tokens v2

Status: ready-for-agent
Blocked by: —
Spec: `../spec.md` (Brand system, Design intelligence, Anti-slop rules 1, 2, 6, 9; Constraints)

## Changes

**Fonts**
- Add `@fontsource/quicksand` and `@fontsource/inter`.
- `main.tsx`: import Quicksand 600/700 and Inter 400/500/600.
- `--font-display` is Quicksand and `--font-sans` is Inter, in both places (`@theme` and `:root`).
- Remove the Lexend and Delius imports and any unused font packages.
- Headings ≥ 20 px use the display font. Every smaller UI text uses Inter (set this in the base layer).

**Palette**
- Apply the spec palette in light and dark (in `@theme` and both theme blocks).
- If a value fails contrast, adjust it (darken the fill, or use the text-safe variant) and log the change in Comments.
- **No purple, no gradients** on UI surfaces or buttons.
- Add 5 pillar tokens: `--pillar-focus`, `--pillar-agility`, `--pillar-impulse`, `--pillar-memory`, `--pillar-visual`.
  - Each is ≥ 3:1 on surface, in light and dark.
  - They must stay distinguishable under deuteranopia. Record the ΔE values.
  - No red pillar.

**Shape and elevation**
- Radii: md 14, lg 20, xl 24, pill.
- **One** soft elevation token for real containers: `0 6px 20px rgb(30 111 168 / .08)`. Dark mode uses a 1 px border with no shadow.
- A separate `--clay` token for clay depth: a soft outer shadow plus an inner highlight. It is used **only** by characters, illustrations and at most the primary CTA (rule 9).
- `.tactile-btn` buttons are pills, 44 px tall. `.tactile-card` uses the single elevation.
- No `backdrop-blur` utility anywhere (rule 2).

**Metadata and tests**
- Rewrite `token-metadata.ts` with ≥ 20 pairs, including brand and accent fills with their inks, ink-muted, and the pillars.
- Update `tokens.test.ts` so the drift guard and font assertions pass.
- Add a test that fails if `tokens.css` contains `linear-gradient` or `radial-gradient` outside the character/clay tokens, or contains `backdrop-filter`.
- Re-check the exercise contrast tables against the new surfaces and record them in Comments. Swap a token only if a pair fails.

## Done when

- `npm run qa:checks` is green.
- A visual check on the dev server, on your own port, is described in the report.
- Commit with no AI attribution.

## Comments

**2026-10-31 — Implemented (implementer, ticket 01).** WCAG 2.1 ratios; all 70 pairs in `token-metadata.ts` pass (`check:contrast`).

### Deviations from the spec palette

| Token | Spec | Shipped | Why |
|---|---|---|---|
| `--color-brand` (light) | fill `#2B8FD6`, text-safe `#1E6FA8` | `#1E6FA8` for fill **and** text | White on `#2B8FD6` is 3.50:1 (< 4.5). `#1E6FA8`: white on it 5.39, on canvas 5.08, on raised 4.79, on brand-subtle 4.63. |
| `--color-brand-vivid` (new) | — | `#2B8FD6` light / `#7CC4F2` dark | Keeps the spec's sky for graphics only (chart lines, illustrations): 3.50 on surface, 3.30 on canvas, 3.11 on raised; never text. |
| `--color-accent-strong` (new) | text-safe `#B94A2F` | `#B94A2F` light / `#FF9F86` dark | Coral fill `#F2876B` is 2.48:1 on white, so coral text and milestone marks use this (5.14 surface, 4.84 canvas). The fill keeps `--color-accent-ink` `#0F2233` (6.52). WelcomePage's shield icon moved from `text-accent` to `text-accent-strong`. |
| `--color-reward` | — | = coral (`#F2876B` / `#FF9F86`) with ink `#0F2233` / `#0B1622` | Coral marks milestones (spec); was amber. 6.52 / 9.16. |
| status colours | "calm, desaturated" | success `#2D7650`/`#6FCF97`, warning `#8A5800`/`#F2C063`, danger `#A83A4E`/`#F28B9E`, info = brand | Danger is a crimson-rose so it does not read as coral: CIEDE2000 28.6 vs the coral fill, 15.4 vs coral-strong (light), 14.9 vs the dark coral. |
| `--color-secondary` | — | `#2C4A63` / `#C5D8E8` | Sky-slate replacing slate `#334155` / `#CBD5E1`. |
| `--dim-4`, `--dim-8` | — | `#00747F` teal / `#7FE0EA`, `#80552A` brown / `#E0B48A` | Were plum `#9E4778` and indigo `#4F46E5` (rule 1: no purple). Teal and brown keep the 8 Tower discs distinct (min ΔE00 16.0 light, 13.2 dark). |
| emotion `hesitant`, `fatigued` | — | `#2F7AB0`, `#5A7186` / `#A3BBD0` (+ tints, glows; `emilyTokens.ts` mirrored) | Were periwinkle/indigo/violet `#5A67D8`, `#5C6B9C`, `#B794F4`. |
| uncertainty band | 15% band in the same hue | `rgba(43,143,214,.15)` / `rgba(124,196,242,.15)` | Was indigo. Low-confidence stroke is now ink-muted (was plum). |

Dark `--color-border` `#2A4157` is a divider only (1.55 on surface); control boundaries use `--color-border-strong` (7.19 / 6.19). Light border-strong `#5E7C96` is 4.38 on surface, 4.12 canvas, 3.88 raised.

### Pillar colours (`--pillar-*`)

Light: focus `#2E86C1`, agility `#0A6B57`, impulse `#D2691E`, memory `#34479A`, visual `#6E560C`. Dark: `#8ECDF5`, `#2E9E84`, `#D97A2E`, `#5B7BDC`, `#F2E29A`. No red (impulse is orange), no purple (memory is royal blue, hue ≈ 229° / 225°).

On surface: light 3.97 / 6.45 / 3.63 / 8.35 / 7.00; dark 9.49 / 4.93 / 5.27 / 4.13 / 12.54 (all ≥ 3:1). Lowest elsewhere: light impulse 3.42 canvas, 3.23 raised; dark memory 3.56 raised.

CIEDE2000 between pillars, normal vision and simulated deuteranopia (Machado 2009, severity 1.0):

| Pair | Light | Light deut. | Dark | Dark deut. |
|---|---|---|---|---|
| focus–agility | 31.4 | 26.8 | 30.1 | 25.8 |
| focus–impulse | 47.8 | 53.0 | 47.3 | 48.0 |
| focus–memory | 23.8 | **17.8** | 23.9 | 23.0 |
| focus–visual | 51.6 | 49.4 | 41.9 | 42.2 |
| agility–impulse | 49.1 | 31.6 | 46.7 | 24.6 |
| agility–memory | 36.2 | 26.8 | 37.6 | 27.7 |
| agility–visual | 29.8 | 20.1 | 34.9 | 31.2 |
| impulse–memory | 51.5 | 61.9 | 48.8 | 57.8 |
| impulse–visual | 26.6 | 21.0 | 31.2 | **20.1** |
| memory–visual | 50.7 | 51.6 | 58.9 | 58.7 |

Minimum under deuteranopia: 17.8 light (focus–memory, separated by lightness), 20.1 dark. Charts must still pair each pillar with a shape or text label (spec).

### Exercise contrast re-check

New surfaces: light `#FFFFFF` (unchanged), dark `#122130` (was `#111827`); raised `#E8F3FB` / `#1A2D40`. **Every pair still passes. No exercise token was swapped for contrast** (`--dim-4`/`--dim-8` changed for rule 1 only).

Stroop ink as text on `--color-surface` (≥ 4.5):

| Payload | Token | Light | Ratio | Dark | Ratio |
|---|---|---|---|---|---|
| red | `--color-danger` | `#A83A4E` | 6.21 | `#F28B9E` | 6.97 |
| green | `--dim-3` | `#008662` | 4.58 | `#2DD4BF` | 8.77 |
| blue | `--dim-1` | `#0072B2` | 5.19 | `#56B4E9` | 7.08 |
| yellow | `--dim-7` | `#7D7300` | 4.86 | `#F0E442` | 12.35 |
| (other) | `--color-ink` | `#0F2233` | 16.19 | `#F2F8FC` | 15.25 |

Tower disc label `DISC_INK = --color-surface` on each disc (≥ 4.5):

| Slot | Disc token | Light | Label `#FFFFFF` | Dark | Label `#122130` |
|---|---|---|---|---|---|
| 0 | `--dim-1` | `#0072B2` | 5.19 | `#56B4E9` | 7.08 |
| 1 | `--color-danger` | `#A83A4E` | 6.21 | `#F28B9E` | 6.97 |
| 2 | `--dim-3` | `#008662` | 4.58 | `#2DD4BF` | 8.77 |
| 3 | `--dim-8` | `#80552A` | 6.46 | `#E0B48A` | 8.60 |
| 4 | `--dim-7` | `#7D7300` | 4.86 | `#F0E442` | 12.35 |
| 5 | `--dim-2` | `#C45100` | 4.64 | `#FF8C3B` | 7.05 |
| 6 | `--dim-4` | `#00747F` | 5.52 | `#7FE0EA` | 10.69 |
| 7 | `--color-secondary` | `#2C4A63` | 9.26 | `#C5D8E8` | 11.17 |

Glyphs (`svg.tsx`, graphics ≥ 3:1 on surface): blue `--dim-1` 5.19 / 7.08; red `--color-danger` 6.21 / 6.97; green `--color-success` 5.50 / 8.59; yellow `--dim-5` 4.29 / 10.66.

Graphics (≥ 3:1):

| Element | Pair | Light | Dark |
|---|---|---|---|
| Tower selected peg ring | secondary on surface | 9.26 | 11.17 |
| same, on its raised fill | secondary on surface-raised | 8.23 | 9.62 |
| Tower peg base / N-back grid stroke | border-strong on surface | 4.38 | 7.19 |
| same, on surface-raised | border-strong on surface-raised | 3.88 | 6.19 |
| N-back lit vs unlit cell | `--dim-1` on surface-raised | 4.60 | 6.09 |
| N-back centre symbol | ink on surface-raised | 14.38 | 13.13 |
| Relational inverted-rule border | `--color-warning` on surface | 6.04 | 9.72 |
| UFOV canvas / MST strokes | ink on surface | 16.19 | 15.25 |

Text: Tower hint `.text-danger` on canvas 5.85 light, 7.78 dark. Ink on a lit N-back cell alone is still under 3:1 (3.12 light, 2.15 dark), unchanged in kind: the centre symbol keeps its unlit-colour halo. Thinnest margin is still `--dim-3` 4.58 light.

Note for ticket 06: dark `--color-danger` `#F28B9E` reads rose rather than pure red. It passes, but Stroop "red" may want its own ink when exercises are re-skinned.
