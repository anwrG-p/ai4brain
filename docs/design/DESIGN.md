# Design system (brand v2)

The full design and route guide is `docs/design/BRAND-V2.md` (on the frontend branch). The binding spec is `.scratch/brand-v2/spec.md`. This page is the summary.

- **The board with blobs.** The page is an off-white margin (`--color-page`). The app sits on the board inside it: a dotted whiteboard in light mode, a green chalkboard in dark mode, with soft sky and coral blobs in its corners. References: [`references/`](references/).
- **Colour.** Sky blue (`--color-brand`) with coral accents (`--color-accent`). No purple. The frustrated mood never uses red.
- **Type.** Quicksand for headings of 20 px and up; Inter for everything else.
- **Shape.** Pill buttons and one soft shadow. Clay depth at most on the primary button.
- **Characters.** Loti (axolotl coach) and Momo (dolphin: mood and celebrations), drawn as flat line art: flat fills, one darker-blue outline, coral accents.
- **Screens.** Need-to-know only: at most 3 blocks above the fold, one primary button plus at most 2 quiet controls.
- **Tokens only.** Every colour, spacing and duration comes from `frontend/src/styles/tokens.css`. `npm run lint:tokens` blocks raw values, and `npm run check:contrast` audits every colour pair in `frontend/src/styles/token-metadata.ts` (WCAG AA).

*Superseded 2026-10-31: this file used to specify the "Doodle (Hand Drawn)" system (Delius and Fredoka type, 2 px ink borders, offset shadows, a 10-dimension palette). DEC-010 replaced it with "Calm & Clean", and brand v2 replaced both. The old text is in git history (`git log -- docs/design/DESIGN.md`).*
