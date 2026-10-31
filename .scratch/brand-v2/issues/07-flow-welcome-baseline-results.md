# 07: Flow: Welcome → Baseline → Results (blur, dolphin, login + consent)

Status: ready-for-agent
Blocked by: 02, 03, 05, 06
Spec: `../spec.md` (IA flow, R3, R4, U1, all Anti-slop rules — esp. 13 need-to-know only: each Results step shows one message + one action). Source: `docs/Landing page.docx`.

## Pages

### `/` Welcome ("VERY SIMPLE UI")

Centred, mobile-first, max-width about 560 px.
- Loti (lg) greets with one entrance motion and one `LotiBubbles` bubble: "Hi, I'm Loti. Want to see how your mind works today? It takes about 5 minutes."
- One primary button, **"Start"**, which goes to `/baseline`.
- One small text link, "I already have an account", which opens the login sheet.
- Nothing else: no feature list, no stats, no footer clutter on this page.
- The old Welcome content and its tests are removed and rewritten (R7).

### `/baseline`

- Runs the 5 exercises in sequence through `ExerciseHost`/`ExerciseFrame`: Logic Web, Memory Gauntlet, Strategic Blueprint, Perceptual Radar, Precision Archive. Mock fixtures are used for now.
- Above the frame, a thin step indicator shows "1 of 5".
- The user can leave at any time with "Exit" (Skip/Back rule).
- Telemetry stays in the consent-`pending` state (ticket 05).
- Each session's task scores are saved through the session store (ticket 04).

### `/results`, in sequence (all skippable)

1. The pillar radar renders **blurred**, with the label "Your results are ready". Blur is the one allowed use (rule 2).
2. The Dolphin swims in once, saying "Good job! You finished all five."
3. Loti asks the user to save their results. A login sheet appears:
   - Google sign-in, **only** if `VITE_GOOGLE_CLIENT_ID` is set (R4); otherwise it is not rendered at all.
   - "Continue as guest".
   - Consent, with equal-weight choices: **"Save my answers"** calls `tracker.grantConsent()`; **"Keep them on this device only"** calls `tracker.denyConsent()`. One sentence explains it: "We record answer timing and accuracy only. No camera, no microphone." A link goes to the Privacy page.
4. The radar un-blurs and shows the real pillar scores from ticket 04. A pillar with no data is shown as "Not measured yet", never as a fake value.
5. One primary button, "Go to my space", which goes to `/dashboard`.

## Tests

- **Welcome:** exactly one primary button, Loti present, and visible word count ≤ 40.
- **Baseline:** completing the mock run leads to `/results`. No POST is made before consent.
- **Results:**
  - The radar is blurred before the choice.
  - The Dolphin appears.
  - "Save my answers" flushes the events, and the POSTs carry the right `user_id`.
  - "Keep on device" sends nothing and clears the buffer.
  - The Google button is absent when no client ID is set.
- **e2e** (Edge scratch config):
  - A new `flow.spec.ts` runs Welcome → baseline (using a test hook or URL flag to fast-forward the trials) → results.
  - Axe passes in light and dark at 375, 768 and 1440 px.

## Done when

`qa:checks` is green, the flow e2e passes, and the commit has no AI attribution.
