# Spec: Brand v2: Loti, sky blue and coral, simple flow, new dashboard

Status: ready-for-agent
Owner: Mazen, who is responsible for the frontend and is the only reviewer and approver (DEC-001 ownership is resolved: there is no separate UI owner to wait for).
Date: 2026-10-31
Branch: `feat/ui-calm-clean` (continues it)
Sources: `docs/Doc visual identity.docx`, `docs/Landing page.docx`, `docs/Dashboard.docx`, `docs/Loti interface.docx`, `docs/doc na9chet.docx`, `docs/Rou7 zebda cognitive intelligence.docx`. Extracted text is quoted where it binds.

**Supersedes** `.scratch/ui-calm-clean/spec.md` tickets 04–07. Its tickets 01–03 stay as the structural base: flat components, a clean Welcome, Lexend tokens. They are re-skinned by this spec.

## User decisions (2026-10-31)

| # | Decision | Meaning |
|---|---|---|
| U1 | Forget the previous design's content | The technical panels go **out of the UI entirely**, not into drawers. Examples: the live JSON ("What BRIAN Sees"), bound backend contracts, the never-collected list, the evaluator and inspector panels, QUEST+ and persona switchers. |
| U2 | Characters are built by us, like the original design's | Drawn, SVG/React. |
| U3 | Scope: everything | Includes the Loti chat. |
| U4 | Consent at login | The tests run first. Answers stay on the device until the user accepts at the login step. |
| U5 | Consumer wording | No brain-region names, no chemical claims, no "Verified Neuroplastic Gain" in the UI. The formulas and regions live only on the "How we calculate this" page. |

## Rulings

Each ruling ends with what it costs if it turns out to be wrong.

- **R1. Characters**, one component each, with a pose/mood prop. Gentle CSS motion that respects reduced motion. Swapping in real art is a one-file change.
  - **Loti** (`Loti.tsx`): the guide who governs the UX. A soft clay-like sky-blue orb with a warm coral core and a simple friendly face. Poses: idle, talk, think, happy, wave. *(If wrong: one SVG swap.)*
  - **Dolphin** (`Dolphin.tsx`): emotional wisdom; the celebration character that "swims out to say good job". Poses: swim-in, cheer.
  - **Momo** (`Momo.tsx`): the small mood companion. It signals mood changes and reads the existing emotion store (`useEmilyStore` / EmilyMoodPill). Moods: calm, happy, tired, frustrated (Anti-Red: no red), focused.
- **R2. Loti chat** is short bubbles with clickable choice chips. The user can dismiss ("cut off") a bubble and continue later.
  - A `LotiBrain` interface with a **scripted** implementation built from the doc's examples:
    - "behind on X skill → want to improve? Yes → training"
    - yearly goals → discussion that shifts the dashboard goals
    - "How was your day? great → let's train?"
    - weekend night
    - sunshine / time of day
  - An adapter stub for Member 2's coach (Gemini; "only fed what the user read") that makes **no network calls yet**.
  - Voice/3D mode is out of scope. It is marked optional in the doc and conflicts with the "no microphone" promise.
  - *(If wrong: an LLM adapter later.)*
- **R3. Consent at login (U4).**
  - The Tracker gets a consent gate:
    - Before consent, events are buffered and persisted locally but **never sent**.
    - Accept releases and flushes them.
    - Decline clears them. Results are still shown on the device.
  - The beacon and flush paths respect the gate.
  - *(If wrong: a small tracker change.)*
- **R4. Google login.**
  - Shown only when `VITE_GOOGLE_CLIENT_ID` is set, using Google Identity Services.
  - Otherwise there is only "Continue as guest". No fake Google button (DEC-008).
  - *(If wrong: config.)*
- **R5. Dashboard data is real and local.**
  - Each completed session's per-exercise scores are stored on the device. The store is versioned and cleared by the privacy purge.
  - Pillar scores, the progress curve and projections are computed client-side by pure, tested functions using the doc's model:
    - weights per pillar
    - asymptotic projection
    - decay penalty
    - RCI ≥ 1.96 gate
  - Missing inputs renormalise the weights over the available ones, and the uncertainty widens.
  - Member 3's server profile can replace the source later.
  - *(If wrong: swap the data source.)*
- **R6. Evaluator and judge tools** survive only behind `?judge=1`, never visible otherwise. This keeps the CISTAC demo controls without cluttering real users' screens. *(If wrong: delete them.)*
- **R7. Tests that pinned the old design's content are rewritten** for the new pages (team-approved redesign). DEC-007's "keep selectors" is superseded by DEC-011 for the redesigned pages. Theme-toggle names and the e2e axe/overflow checks stay.
- **R8 (user, 2026-10-31): Welcome and exercises should feel more dynamic.** Characters may have a nearly-imperceptible idle (breathing, blink); event motion is richer. Trial stimuli and timing stay untouched — motion lives in transitions, instruction demos, presses and end cards. *(If wrong: delete the `anim-*` classes; every one is off under reduced motion already.)*
- **R9 (controller, 2026-10-31): the block fixation '+' appears instantly (jsPsych convention).** No fade or scale: it holds its 500 ms at full contrast.
- **R10 (user, 2026-10-31): the baseline is 6 exercises, with Color Clash 3rd.** The order is Logic Web, Memory Gauntlet, Color Clash, Strategic Blueprint, Perceptual Radar, Precision Archive (`relational, n_back, stroop, tower, ufov, mst`), which keeps Color Clash apart from Perceptual Radar. Welcome's duration copy is computed from the real trial counts and timings. *(If wrong: edit `BASELINE_SCHEMAS`.)*
- **R11 (user, 2026-10-31): no "If you pause" line and no idle decay.** The doc's λ · idle-days term is dropped: there is no evidence for the rate, and it reads as a guilt penalty. The progress curve shows the real sessions plus one dashed "If you keep training" line, and the projection appears only from the 3rd session. "How we calculate this" says the same. *(If wrong: restore the decay term in `projection.ts` and a second line.)*
- **R12 (user, 2026-10-31): score ranges only in "View as table".** The table reads "62 · likely 55–69"; the radar and the curve show one number per point, with no uncertainty or projection bands. *(If wrong: draw the bands behind a Details control, rule 13.)*
- **R13 (user, 2026-10-31): stay anonymous; no real accounts.** The user is an anonymous device id; there is no account backend (BE-14 dropped), and the Google button stays gated off (R4). *(If wrong: an account backend and sign-in, a large change.)*
- **R14 (controller, 2026-10-31): no user-facing LLM until a backup crisis classifier exists.** The keyword crisis gate is a floor, not a guarantee. No LLM path (the coach adapter, `VITE_LOTI_COACH`) may be enabled for users until an LLM-based backup crisis classifier runs on every message. Until then Loti stays scripted (R2). *(If wrong: enabling the LLM without the backup classifier risks missing a user in crisis.)*

## Brand system (binding)

### Colour: sky blue + salmon/coral

Every text pair must reach ≥ 4.5:1 and every boundary or graphic ≥ 3:1. Recompute them all.

| Token | Light | Dark |
|---|---|---|
| canvas | `#F3F9FD` (airy sky) | `#0B1622` |
| surface | `#FFFFFF` | `#122130` |
| surface-raised | `#E8F3FB` | `#1A2D40` |
| ink | `#0F2233` | `#F2F8FC` |
| ink-muted | `#46617A` | `#A9C1D6` |
| border | `#D6E7F3` | `#2A4157` |
| border-strong | `#5E7C96` | `#8FB0CC` |
| brand (sky blue) | `#2B8FD6` as fill; text-safe `#1E6FA8` | `#7CC4F2` |
| brand-ink (on brand fill) | `#FFFFFF` (check ≥ 4.5 on the fill; darken the fill if needed) | `#0B1622` |
| accent (salmon/coral) | `#F2876B` as fill; text-safe `#B94A2F` | `#FF9F86` |
| accent-ink | `#0F2233` on the fill | `#0B1622` |
| success / warning / danger / info | calm, desaturated, each ≥ 4.5 as text; danger must not read as the coral accent | |

Rules:
- Brand = calm and baseline. Coral = breakthroughs, human touchpoints, milestones, the active state of a chart.
- `--dim-*` dimension colours are replaced by **5 pillar colours**. They must stay distinct for colour-blind users, so use shape or text redundancy as well.
- Exercise contrast tables must be re-checked.

### Type

- Headlines: **Quicksand** (600/700).
- Body and UI: **Inter** (400/500/600).
- Both self-hosted via `@fontsource/quicksand` and `@fontsource/inter`. These are the two new dependencies allowed.
- Numbers use Inter with tabular numerals.

### Shape and imagery

- Soft "clay": radii 20–28 px on cards, pill buttons.
- Soft, diffuse elevation: a large blur, low alpha, plus a subtle inner highlight on primary surfaces. No hard or offset shadows.
- Icons: Lucide with round caps and joins (`strokeLinecap="round"`).
- Charts: smooth curves (monotone/cardinal), no jagged lines. The progress line is sky blue and turns coral at milestones or breakthroughs.
- No dot grids, doodles or emoji icons.
- Generous whitespace; one primary action per screen.

## Design intelligence (UI/UX Pro Max, 2026-10-31)

**Style.** The skill's design system picked **Claymorphism**, which fits the brand doc's "Abstract 3D & Claymorphism" imagery, and agreed on a **sky-blue** base. Its default clay *recipe* is a purple gradient, drifting background blobs and glass cards. That recipe is generic AI-slop styling, so it is **rejected** (see the anti-slop rules). The decision:
- **Clay depth belongs to characters and illustrations** (Loti, the Dolphin, Momo, the brain orbs). It may also appear on **at most the primary CTA**.
- The UI chrome stays restrained: flat surfaces, soft elevation, hierarchy carried by type and space.

The skill's "App Store landing" pattern (ratings, stars, device mockups) is also **rejected**: it would mean fake reviews (DEC-008).

**Charts** (skill `chart` domain):

| Chart | Requirements |
|---|---|
| Radar (5 pillars) | Within the 5–8 axes limit; single dataset with about 20% fill; full-opacity border. **Mandatory accessible fallback:** a bar view plus a data table, reachable with one toggle. Pillar labels are plain text on the axes. |
| Progress curve | A solid sky line for actual values. The projection is **dashed**, with a 15% band in the same hue. The decay projection is a second dashed line, distinguished by style and label, not only by colour. The legend names the line styles. The forecast horizon is ≤ 30% of the visible x-range. There is an actual-only toggle. Smooth curves. Coral marks milestones only. |
| Heatmap (behind "Further explore my training") | A numeric legend with scale ticks; the value on hover **and** on focus; a pattern or text fallback; only used when there are ≥ 20 cells, otherwise show a list. The palette runs from sky to coral, **not blue to red**: red reads as alarm and breaks the Anti-Red rule. |

**UX** (skill `ux` domain):
- Every flow has Skip and Back. No forced, unskippable tours.
- Continuous animation is for loading only, with one exception: the short looping demo on an exercise's instruction screen (R8), which stops once Begin is pressed. Characters are **still when idle** (R8 allows a nearly imperceptible breathing and blink) and animate on events: greeting, a celebration, a mood change.
- Use ease-out on enter and ease-in on exit, never linear. Respect reduced motion.

**Typography.** Quicksand (headings) with Inter (body and UI), per the brand doc. The skill's alternative was Nunito + DM Sans; the brand doc wins. Quicksand is a rounded display face, so use it only for headings of 20 px and up. All small UI text is Inter.

## Anti-slop rules (binding; every review checks these)

1. **No gradient buttons, gradient text, or purple/violet anything.** Use solid sky or coral fills.
2. **No decorative background blobs, floating orbs, particles, or drifting shapes.** One exception: the one-shot sparkle burst on an exercise's end card (R8), which plays once as a celebration and then is gone. No glassmorphism or `backdrop-blur` cards. Blur is allowed **only** for the results blur, because it carries meaning.
3. **No fake social proof:** no ratings, stars, testimonials, user counts, "trusted by", or fake stats.
4. **No hype copy.** Banned: "unlock", "supercharge", "revolutionize", "AI-powered", "magic", "seamless", "next-level", "elevate", "empower", ✨. Write plain, specific copy in Loti's voice, at most about 12 words per line of UI text.
5. **No icon-in-a-circle feature-card grids** (the 3-column "icon + title + 2 lines" cliché). Explain with characters, real UI or a single sentence.
6. **No identical rounded card with the same shadow everywhere.** One elevation level, used only where something is a real container. Group with whitespace instead of more boxes.
7. **No all-caps eyebrow labels** above every heading, and no badge piles.
8. **No emoji as icons.** Use one icon family: Lucide, round caps, 1.75 px stroke, sizes 16, 20 or 24.
9. **Clay or 3D depth only on characters and illustrations, plus at most the primary CTA.**
10. **Motion only with meaning:** an entrance, a celebration, a state change, a press, or a short demo of what an exercise asks (R8). Idle loops are none or nearly imperceptible: a character's breathing and blink at most (R8). Nothing near a trial stimulus moves while a trial runs, except the progress dots.
11. **One primary action per screen.** Layout follows a 4/8 spacing rhythm and a max-width; no edge-to-edge text.
12. **Real content only.** Any number on screen comes from data or is clearly labelled as an example. No placeholder lorem, no fake progress.
13. **Need-to-know only (user, 2026-10-31: "many infos make the site bulky and the user don't need them").** The default view shows only what helps the user act right now. Everything else is behind one quiet "More" or "Details" control, or removed.
    - **Visible by default:**
      - one primary action
      - one line of Loti
      - the main visual (radar or curve), with plain labels
      - plain numbers
    - **Hidden by default:**
      - uncertainty bands and confidence ranges
      - RCI values and statistics
      - legends beyond 2 items
      - chart toggles other than a single small "View as table" link
      - explanations and methodology
      - history tables and heatmaps
      - per-exercise breakdowns
    - **Limits:**
      - No more than **3 content blocks** above the fold on any page.
      - No paragraph longer than 2 lines.
      - When in doubt, leave it out.
    - **Accessibility features stay** (the table view, labels, screen-reader summaries), but they are compact or visually hidden. They do not add visible bulk.
14. **Few buttons (user, 2026-10-31: "we don't need many buttons as it was").**
    - Each screen has **one primary button**, and at most **two other visible controls**, rendered as quiet text links or ghost buttons.
    - Other actions go behind one "More" menu or disclosure, or are removed.
    - No button rows, no duplicate CTAs, no "Back to X" button when the nav already covers it.
    - Inside an exercise, the only buttons are the answer controls the task needs, plus Pause or Exit.
    - Judge and evaluator controls exist only with `?judge=1` (R6).

## Information architecture

- **Nav:** 4 items. Home (dashboard), Train, Loti, You (profile/privacy/settings).
- Other existing routes stay reachable but are not in the nav.

**Flow (new users):**
1. `/` **Welcome**: Loti greets with one bubble and one button, "Start".
2. `/baseline` **Baseline**: the 5 exercises in sequence, each with a jsPsych-style instruction screen, a fixation point and progress dots: Logic Web, Memory Gauntlet, Strategic Blueprint, Perceptual Radar, Precision Archive.
3. `/results`, in order:
   1. blurred pillar radar
   2. the dolphin swims in, "Good job!"
   3. Loti asks for login (Google per R4, or guest) with **equal Accept / Decline** consent (R3)
   4. results un-blur
   5. → Home

**Exercise names (consumer)**, mapped to schema types:

| Name | Schema type |
|---|---|
| Logic Web | `relational` |
| Memory Gauntlet | `n_back` |
| Strategic Blueprint | `tower` |
| Perceptual Radar | `ufov` |
| Precision Archive | `mst` |

Stroop, Matrix and Rotation stay available in Train.

**Five pillars** (consumer names; doc weights apply in the math only):
- Focus & Strategy
- Mental Agility
- Impulse Control
- Deep Memory
- Visual Radar

## Constraints

- From `frontend/`, `npm run qa:checks` must be green. Update `token-metadata.ts` (≥ 20 pairs), the copy lint (consumer wording; region names banned in pages), the tokens test and the drift guard.
- Axe: zero violations in light and dark. No overflow at 375, 768 and 1440 px. Playwright runs on Edge through a scratch config.
- Telemetry contract with the server is unchanged.
- No AI attribution in commits. Record the direction as DEC-011, which supersedes DEC-010 and DEC-007 for the redesigned pages.

## Tickets

| # | Ticket | Blocked by |
|---|---|---|
| 01 | Brand tokens v2 (palette, Quicksand + Inter, clay shape, pillar colours, metadata) | — |
| 02 | Characters: Loti, Dolphin, Momo | 01 |
| 03 | Loti chat: bubble UI, scripted brain, coach adapter stub | 02 |
| 04 | Pillar math: weights, projection, RCI, local session store (pure + tested) | — |
| 05 | Tracker consent gate (hold until accept) | — |
| 06 | Exercise visuals (jsPsych-style screens, brand v2, consumer names) | 01 |
| 07 | Flow: Welcome → Baseline → Results (blur, dolphin, login + consent) | 02, 03, 05, 06 |
| 08 | Dashboard: Momo, radar, progress curve + projection + goals, explore → heatmap, Loti bubbles | 02, 03, 04 |
| 09 | App shell and cleanup: 4-item nav, remove technical panels app-wide, judge tools behind `?judge=1`, Loti page, "How we calculate this", restyle remaining pages | 02, 03 |
| 10 | Verify, rewrite tests, e2e, screenshots, DEC-011, docs | all |
