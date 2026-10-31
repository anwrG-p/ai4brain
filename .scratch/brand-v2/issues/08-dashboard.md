# 08: Dashboard (Momo, radar, progress curve, goals, explore heatmap, Loti bubbles)

Status: ready-for-agent
Blocked by: 02, 03, 04
Spec: `../spec.md` (Design intelligence: charts; R5; U5; Anti-slop rules). Source: `docs/Dashboard.docx`.

## Layout (`/dashboard`, max-width about 1040 px, one column on mobile)

1. **Header row**
   - A greeting h1 (Quicksand) and one line of Loti `LotiBubbles` (one bubble, clickable).
   - **Momo** sits beside the greeting. `MomoFromStore` follows the mood.
   - **The page tone follows the mood.** The doc says the "page changes depending on mood". Do it with a subtle canvas tint plus Momo's line, e.g. tired → "Short session today?". No flashing and no red.
2. **One primary action:** "Start today's session". It targets the weakest pillar.
3. **Radar (5 pillars)**
   - Sky fill at 20%, with a full-opacity border.
   - The axes carry plain text labels.
   - Toggle: **Radar / Bars / Table**. The fallback is mandatory.
   - Each pillar shows its score, or "Not measured yet", and an uncertainty band.
   - If the pillar passes the RCI gate, a text badge "Real improvement" appears.
4. **Progress curve**
   - Unified score over time as a solid sky line, with smooth curves.
   - Two dashed projections: "If you keep training" (optimal) and "If you pause" (decay), told apart by style **and** label, each with a 15% band.
   - Goal markers come from the goals store; goal tracking is folded into the curve, as the doc asks.
   - Coral is used only for milestones and breakthroughs.
   - An actual-only toggle.
   - A text summary for screen readers.
   - Empty state: Loti with "Finish one session to see your curve."
5. **"Further explore my training"**
   - A disclosure, closed by default.
   - Inside: a heatmap of historical results (exercise × week), on a sky-to-coral scale (never red), with a numeric legend and values on hover and focus.
   - Below it, short explainability lines ("Why Loti picked this"), in consumer wording.
   - With fewer than 20 cells, show a list instead of a heatmap.

**Remove the old dashboard entirely:** the classroom board, podium, Teacher Brian, SlideDeck, wood and dashed strip. This also resolves the tablet issue where the SlideDeck nav button was hidden under the bottom tab bar.

**Charts** are hand-rolled SVG, or use the d3-scale and d3-shape libraries that are already dependencies. No new chart library. Smooth curves use monotone interpolation.

## Tests

- One primary CTA.
- Momo is present and its mood changes the tint class.
- The radar toggle switches to Bars and to Table, and the table has 5 rows.
- "Not measured yet" shows when a pillar has no data.
- The "Real improvement" badge shows only when RCI ≥ 1.96.
- The projection lines carry distinct `stroke-dasharray` values and labels.
- The heatmap is closed by default; opening it shows the legend.
- No `<img>`, no emoji, no gradient classes.
- e2e `dashboard.spec.ts` is rewritten: axe passes in light and dark at 375, 768 and 1440 px.

## Done when

`qa:checks` is green, the dashboard e2e passes, and the commit has no AI attribution.
