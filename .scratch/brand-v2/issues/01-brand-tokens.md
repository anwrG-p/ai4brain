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
