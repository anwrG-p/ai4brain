# 08: Dashboard (Momo, radar, progress curve, goals, explore heatmap, Loti bubbles)

Status: ready-for-agent
Blocked by: 02, 03, 04
Spec: `../spec.md` (Design intelligence: charts; R5; U5; Anti-slop rules). Source: `docs/Dashboard.docx`.

## Layout (`/dashboard`, max-width about 960 px, one column on mobile)

**Anti-slop rule 13 is binding: need-to-know only.** Above the fold there are exactly 3 blocks, and anything not listed below stays hidden.

**Above the fold:**
1. **Hello.**
   - A short greeting h1 ("Hi, Mazen").
   - **Momo** beside it. `MomoFromStore` follows the mood.
   - **One** Loti bubble line from `LotiBubbles`, which is clickable.
   - The page tone follows the mood through a subtle canvas tint only. No banner and no red.
2. **One primary action:** "Start today's session". It targets the weakest pillar.
3. **Radar (5 pillars).**
   - Sky fill at 20% with a full-opacity border.
   - Plain axis labels, each with its score number or "—" when the pillar has no data yet.
   - A small coral text tag "Real improvement" appears only on a pillar that passes RCI ≥ 1.96.
   - One small "View as table" text link (the accessibility fallback; the table has 5 rows).
   - **No** uncertainty bands, legend, or Radar/Bars toggle on the default view.

**Below the fold:**

4. **Progress curve.**
   - The unified score as a smooth, solid sky line.
   - One dashed line "If you keep training" and one dotted line "If you pause". This is the doc's dual curve.
   - The legend has exactly those 2 items, labelled by style and text.
   - A goal shows as one thin horizontal marker, using the goals store.
   - Coral marks milestones only.
   - **No** confidence bands and **no** toggles by default.
   - A visually hidden summary for screen readers.
   - Empty state: Loti saying "Finish one session to see your curve."
5. **"Further explore my training".** One quiet disclosure, closed by default. **Everything else lives here:**
   - uncertainty ranges per pillar
   - the projection bands
   - the heatmap of past results (exercise × week, sky → coral, never red, numeric legend, values on hover and focus; a list when there are fewer than 20 cells)
   - short "Why Loti picked this" lines

**Remove the old dashboard entirely:** the classroom board, podium, Teacher Brian, SlideDeck, wood and dashed strip. This also resolves the tablet issue where the SlideDeck nav button was hidden under the bottom tab bar.

**Charts** are hand-rolled SVG, or use the d3-scale and d3-shape libraries that are already dependencies. No new chart library. Smooth curves use monotone interpolation.

## Tests

- One primary CTA.
- Momo is present and its mood changes the tint class.
- At most 3 top-level blocks before the progress curve.
- The default view has no uncertainty-band element and no legend with more than 2 items.
- The "View as table" link reveals a 5-row table.
- "Not measured yet" shows when a pillar has no data.
- The "Real improvement" badge shows only when RCI ≥ 1.96.
- The projection lines carry distinct `stroke-dasharray` values and labels.
- The heatmap is closed by default; opening it shows the legend.
- No `<img>`, no emoji, no gradient classes.
- e2e `dashboard.spec.ts` is rewritten: axe passes in light and dark at 375, 768 and 1440 px.

## Done when

`qa:checks` is green, the dashboard e2e passes, and the commit has no AI attribution.
