# Ticket F-D: engagement and ethics

**Status:** DONE (after fix round 1; see the end of this file, which overrides the opt-out, Home-picker and "Focused" details below)
**Base:** `929c9bb` (reset as FRONTEND-COMMON says). **Commits:** `e50298e feat(F-D): …`, `5853483 fix(F-D): …`, with no AI attribution.

## What was built

### P1. AI Act Art 50(3) notice and a mood guess the user can correct (ADR 0002, research §5)
- **First-exposure notice:** `components/features/characters/MomoGuess.tsx` (`MomoNotice`, `useMoodNoticeDue`).
  - It is an inline `role="note"` bubble beside Momo, with the exact copy from the brief, one quiet "Got it" (ghost) and one quiet "Settings" link. It is not a modal.
  - It shows only while the mood guess is on and the notice hasn't been acknowledged. "Got it" saves `moodNoticeSeen` per device and moves focus to Momo.
  - On Home, the notice stands in for Loti's line once. This keeps the fold at 3 blocks and 60 words or fewer (unit test) and the shell budget at 75 or fewer (e2e wordBudget passes with the notice showing).
- **A guess the user can correct:** `MomoGuess`.
  - With the guess on, Momo is a button: "Momo guesses you feel X. Change it". It opens a small `group` called "How do you feel?" with 5 `aria-pressed` buttons: Calm, Happy, Focused, Tired, Frustrated.
  - Picking one calls the existing `setManualEmotion` (human lock), which lasts for this visit and lives in memory only. Escape or a tap outside closes the picker, and focus returns to Momo.
- **Settings "Mood guess" switch** (default on):
  - `SettingsPage` gets a new `SwitchRow`.
  - With the switch off, `EmotionListener` doesn't start (the effect is keyed on the pref), the emily store resets to calm, and Momo is a still image named "Momo" with a calm face, not a button. Home's tint and Loti's context mood are both calm.
- **Prefs store:** `state/devicePrefs.ts`, key `synapsetwin_prefs_v1`, holding `{moodGuess, moodNoticeSeen, cvdSafe}`.
  - Delete-my-data resets the two mood fields and the in-memory correction. The colour-blind inks survive, like the theme and reduce motion.
  - Export includes the key. The mood itself is never stored, so it is never exported.
- **Staircase errors are no longer strain:**
  - `consecutiveErrors` is removed from `classifyEmilyEmotion` and `useEmilyStore.updateTelemetry`, so neither can take an error count any more.
  - A strained proposal now needs rage clicks only.
  - The one caller, the judge tool `HumanReviewGate`, drops the argument; its synthetic events already carry rage clicks.
  - The emilyEngine header no longer claims "complies with Art 5(1)(f) zero-biometric" (ADR 0002 forbids that claim).
- **The mood never leaves the device:**
  - `coachAdapter.ts` now has `CoachContext = Omit<LotiContext,'mood'>`, and `ask` strips the mood at run time (`coachContext`).
  - Test `src/tests/moodNeverLeaves.test.ts`:
    - a telemetry event's key set is exactly the contract;
    - the POST body holds no mood word, even with a "frustrated" correction;
    - the coach transport never receives `mood`.

### P2. Consent per purpose (research #6)
- **Tracker API (minimal and backward compatible):**
  - **Purpose 1** ("Save my answers to improve my training") stays on the v1 key `synapsetwin_consent_v1` with the same values and the same `grantConsent`/`denyConsent`, so a stored v1 `granted` means purpose 1 granted.
  - **Purpose 2** ("Let Loti use AI to reply") gets its own key, `synapsetwin_consent_coach_v1`. When the key is absent (every v1 device), purpose 2 is not chosen.
  - New API: `TrackerStatus.coachConsent`, `setCoachConsent(bool)`, `choose({telemetry, coach})` and `ConsentPurpose`.
  - `resetConsent()` forgets both purposes.
  - Changes from other tabs are followed for both keys.
  - Purpose 2 sends nothing.
- **Consent step:** `features/flow/ConsentChoices.tsx`, used by `LoginSheet`.
  - One message, "Your choices", plus the existing one-line sentence and two switches of identical class (R3 equal weight), both off.
  - One primary "Continue" (rule 14). The quiet controls are Close and "How we handle your data".
  - Nothing is decided until Continue. Continue with switch 1 off means denied: nothing is sent and the queue is cleared.
- **Privacy page:**
  - One line per purpose: the existing `consent-line`, plus a new `coach-line`.
  - One "Choose/Change" control opens the same two switches, set to the current values, with "Done".
  - The whole page stays at 60 words or fewer.
- **Coach gate:** `createCoachBrain` takes `consented` (default `false`). The app's `coachBrain` reads `tracker.getStatus().coachConsent === 'granted'`. So even with R14 met, no transport call happens without purpose 2.

### P3. Weekly goal of 3 (research #10)
- `goals.ts` adds `WEEKLY_GOAL = 3`, `WEEKLY_SKIPS = 1`, `weeklyGoal(sessions, now)` (built on the shared `sessionsThisWeek`, so Loti and Home agree) and `weeklyGoalText`.
- The Goals block shows one line, for example "1 of 3 this week". Once 2 or more are done (one skip tolerated), it reads "2 of 3 this week · week kept"; past the goal, "4 this week · week kept".
- Nothing carries across weeks. Monday starts at 0 quietly, with no streak or guilt copy (tests check the words).
- `scriptedBrain.WEEKLY_TARGET` is now `WEEKLY_GOAL` (it was 4), so Loti's weekend nudge stops at the same goal.

### P4. Time-of-day view (FE-14)
- `PastResults.tsx` adds "When you train" below the weekly heatmap or list: 7 weekday rows by Morning (05–12), Afternoon (12–17) and Evening (the rest, night included).
- Each cell prints the average session score (the mean of the session's exercise scores, 0–100) in the same `heat-*` steps.
- It is hidden below `TIME_OF_DAY_MIN_SESSIONS = 6`.
- Accessibility matches the weekly heatmap: one tab stop with a roving tabindex (arrows, Home, End), each cell named once via its `aria-label`, no live region, and an `aria-hidden` echo line.
- It fits 375 px without scrolling.

### P5. Stroop cvd_safe
- Settings gets a "Colour-blind friendly colours" switch (default off) with the hint "Color Clash uses blue, yellow, red and black."
- `Stroop.tsx` adds `CVD_SAFE_INKS` and `toCvdSafe(params)`: a classic block maps green to black in every word, ink and answer, and takes the server's cvd_safe button order. Congruence is unchanged, and any other set (or a malformed one) passes through.
- The existing light plate draws black.
- `taskSource.fetchNextTask` gets an `inks` option, defaulting to the setting:
  - Real mode appends `&inks=cvd_safe`, and converts on the device if a classic Stroop block still comes back.
  - Mock mode converts the fixture. The fixture itself is not mutated.

## Files outside the ownership table (why)
- `features/assessment/tasks/taskSource.ts`: the `inks=cvd_safe` request has to be made where the task is fetched. The change is additive (an option plus the default).
- `features/loti/coachAdapter.ts` (+ test): the brief requires "mood never sent to the coach" with a test, and purpose 2 has to gate the transport.
- `features/loti/scriptedBrain.ts`: one line, so Loti's weekly target matches the new goal of 3.
- `components/dev/HumanReviewGate.tsx`: one call dropped the removed `consecutiveErrors` argument.
- `pages/SettingsPage.tsx`: the two settings the brief asks for.
- `pages/DashboardPage.tsx`: besides the Goals block, the hello block swaps `MomoFromStore` for `MomoGuess` and shows the notice there, because the notice has to sit next to Momo.
- Tests rewritten for the new consent UI: `flow.test.tsx`, `youPages.test.tsx`, `telemetryTracker.integration.test.tsx`, `taskRunnerPage.test.tsx` (the status mock gained `coachConsent`), `appShell.test.tsx`, `dashboardPage.test.tsx`, `emilyEngine.test.ts`.
- e2e: `flow.spec.ts`, `privacy.spec.ts`, `dashboard.spec.ts`, `settings.spec.ts`.

## Tests and checks
- `npm ci && npm run qa:checks` (frontend):
  - `[PASS] lint:tokens`, 0 hardcoded values
  - `[PASS] lint:copy`
  - `[PASS] check:contrast`, all 112 pairs
  - vitest: **65 files, 1305 tests passed**, no act() warnings and no stderr
  - `tsc -b && vite build`: built
- **e2e on Edge**, with a scratch config (channel msedge, port 4291, its own `dist-e2e-fd`), since deleted and never committed: **79/79 passed** (2.5 min). New or changed e2e:
  - notice and picker on Home, with axe and overflow checks in light and dark at 375/768/1440
  - the "When you train" grid and its keys, and the weekly-goal line
  - Privacy switches: axe and no overflow at 375/768/1440, each line follows its choice
  - a v1-only consent device reads "answers saved, AI replies not chosen"
  - export holds 7 keys
  - Settings switches persist
  - Color Clash with cvd on shows blue/yellow/red/black on the light plate, axe clean
- `docs/ui/screenshots` are untouched; every shot went to the scratchpad `shots-F-D\` (for example `08-home-notice-light-375.png`, `08-home-picker-dark-1440.png`, `08-home-6-explore-dark-375.png`).
- **TDD note:** the tests were written next to the implementation within each priority rather than strictly before it. Existing tests that pinned the old single consent failed as expected (14 RED) before they were rewritten.

## Concerns and follow-ups
1. **ADR 0002 says the mood guess is "opt-in in You → Privacy", but the brief asks for a Settings switch that is on by default, plus the first-exposure notice.** I followed the brief. If opt-in is wanted, flip `DEFAULT_PREFS.moodGuess` to false; the notice then shows the first time the user turns the guess on. The ADR or the brief should be reconciled.
2. **The backend still refuses cvd_safe.** `dynamic_cache/generators/stroop.py` has `UNSERVED_PRESETS = {"cvd_safe"}`, and its comments say Stroop.tsx can't draw black. Stroop.tsx now maps black and the plate exists, so the backend owner (BE-04 / F-C) should drop it from `UNSERVED_PRESETS` and accept the `inks` query on `/v1/tasks/next`. Until then, the frontend converts on the device.
3. **The time-of-day cells show average session score (0–100), not raw accuracy.** The session store keeps scored inputs only, and per-trial accuracy isn't stored. The label says "average".
4. **`projection.ts` `SESSIONS_PER_WEEK = 4`** (the "If you keep training" curve) is still 4. It is F-A's area. Research #3.2 suggests 3.
5. **Rule 14 on Home:** Momo itself is now a tap target. The fold test counts it apart from the controls (one primary and up to 2 quiet ones), because the brief requires tap-to-correct. While the notice is showing, "Got it" takes the Loti line's place.
6. **Purpose 2 has no visible effect yet:** the LLM path is off (R14), so "Let Loti use AI to reply" is recorded and enforced in `createCoachBrain` but changes nothing the user sees today.

---

## Fix round 1 (review: Needs fixes, 1 Critical), commit `5853483`

This round supersedes concerns 1, 5 and 6 above.

### Critical (R18, ADR 0002): the mood guess is opt-in
- **Default off:** `DEFAULT_PREFS.moodGuess = false`. `clearMoodPrefs` (the purge) also returns it to off and forgets the notice, so a purge never re-enables it. The `myData.ts` comments are updated.
- **Notice where the user opts in:** the exact notice copy (`MOOD_NOTICE`) is the description of the Settings "Mood guess" switch, both visible and as its `aria-describedby`. Turning the switch on (`setMoodGuess(true)`) also sets `moodNoticeSeen`. Home shows no notice, and `MomoNotice` and `useMoodNoticeDue` are deleted.
- **Defence in depth:** `moodGuessActive = moodGuess && moodNoticeSeen` gates all four mood readers:
  - `EmotionListener`, which doesn't start, and the store stays calm;
  - `MomoFromStore`, which is a still picture named "Momo" with a calm face;
  - Home's tint, `data-mood` and the context it passes to Loti, which carries no `mood` key when inactive;
  - `lotiContext`, which reads no emotion when inactive.
- **Tests:**
  - every test that pinned "on by default" now expects off;
  - a stored `moodGuess` without `moodNoticeSeen` stays inactive;
  - new appShell test: with default prefs, rage-clicking (mousedown, mouseup, click bursts) on /dashboard adds no `pointermove` listener and leaves `currentEmotion` at `calm_flow`, `proposedEmotion` at null and the metrics untouched.

### Important
2. **Rule 14 on Home:** Momo is a picture on Home, not a button.
   - The correction moved to Settings (`MoodCorrection`). While the guess is on, the row shows "Momo's guess today: X" and a quiet "Change" that opens the picker.
   - The Home fold test now counts buttons and links together, at most 3, with no exemptions.
3. **"Focused" is dropped from the picker.** The choices are Calm, Happy, Tired and Frustrated. The picker is a `radiogroup` (item 10): one tab stop, arrows that move, wrap and choose, and Escape to close with focus back on "Change".

### Minor
4. **Import-boundary test** (`moodNeverLeaves.test.ts`):
   - No file under `features/assessment/**`, and not `features/loti/coachAdapter.ts`, imports `useEmilyStore`, `emilyEngine` or `lotiContext`.
   - The assessment sources contain no mood or emotion word, and every `trial_meta` key is a literal there.
   - A runtime check confirms that the `trial_meta` keys of a recorded event never match the mood regex.
5. **`coachContext` is an allow-list:** `now`, `weakestPillar`, `hasGoalsThisYear` and `sessionsThisWeek`. A test passes extra fields and checks they never reach the coach.
6. **Purpose-2 copy:** while `VITE_LOTI_COACH` is off, the switch reads "Let Loti use AI to reply when it's available", and the granted Privacy line reads "Loti may use AI to reply when it's available."
7. **Weekend nudge:** `!weekKept(ctx.sessionsThisWeek)`, the same rule `weeklyGoal().kept` uses.
8. **Shared Switch:** `components/ui/Switch.tsx` is used by `ConsentChoices` and by all three Settings switches.
9. **`devicePrefs` follows other tabs:** a `storage` listener for its key, or for `null` (cleared storage), reloads the prefs. Test added.
11. **`emilyTokens.ts`:** "…protects your streak." is now "Pacing is slowing down. A short rest is fine."
12. **`flow.test.tsx`:** finds "Continue" by role and name, and checks that the sheet's only buttons are Close and Continue and its only link is "How we handle your data".

### Checks
- `npm run qa:checks`: all checks pass:
  - lint:tokens, lint:copy and check:contrast (112 pairs) pass;
  - vitest: **65 files, 1313 tests passed**, 0 act() warnings;
  - the build succeeds.
- **e2e on Edge** (scratch config, deleted afterwards): **80/80 passed**. After a final CSS tweak (the radio group is a 2×2 grid on phones), the settings and dashboard specs were re-run: 12/12 passed.
- New or changed e2e:
  - Home: no notice, Momo not a control, neutral by default; after opting in under Settings and picking Tired, Home's Momo shows tired.
  - Settings: off by default, with the notice as the description.
  - Settings opted in: the radio group, with axe and overflow checks in light and dark at 1440/768/375.
- Screenshots: `shots-F-D\14-settings-*`.

### Still open (not mine)
- **F-B:** `ExerciseDemo` still shows red/green with cvd_safe on.
- **Backend:** `UNSERVED_PRESETS` (concern 2 above).
- **F-A:** `SESSIONS_PER_WEEK` (concern 4 above).
