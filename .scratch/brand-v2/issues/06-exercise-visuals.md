# 06: Exercise visuals (jsPsych-style screens, brand v2, consumer names)

Status: resolved
Blocked by: 01
Spec: `../spec.md` (Brand system, IA exercise names, Anti-slop rules 6, 10, 11). Landing doc: "WORK ON THE VISUALS FOR THE TESTS (take jspsych into consideration)".

## Changes

Add an `ExerciseFrame` wrapper in `features/assessment/`. Every exercise renders inside it, following jsPsych conventions:

1. **Instruction screen**
   - Shows the consumer name and one sentence on what to do.
   - Key hints appear as keycaps (rendered as real `<kbd>` elements).
   - One "Begin" button, which Space and Enter also trigger.
   - Optionally, one still illustration of the stimulus. Never a stock icon grid.
2. **Fixation**
   - A centred "+" for 500 ms before each block.
   - Skipped where the exercise already has its own fixation (UFOV).
3. **Trial area**
   - The stimulus is centred on a calm surface, and nothing else moves.
   - Progress is shown as small dots (n of N).
   - **No characters and no decoration during trials.**
4. **End card**
   - One line ("Nice work").
   - Loti appears small, after the block ends.

**Consumer names**

| Exercise | Name |
|---|---|
| relational | Logic Web |
| n_back | Memory Gauntlet |
| tower | Strategic Blueprint |
| ufov | Perceptual Radar |
| mst | Precision Archive |
| stroop | Color Clash |
| matrix | Pattern Puzzle |
| mental_rotation | Shape Turn |

**Brand v2 tokens.** The 8 exercises move to the new tokens. Their logic, timing and telemetry stay **unchanged**. Re-check contrast and swap a token only if it fails.

## Tests

- `ExerciseFrame` shows the instruction screen with the name and keycaps.
- Space starts the exercise.
- The fixation shows for 500 ms.
- The progress dots advance.
- No telemetry event is sent during the instruction or fixation screens.
- Existing exercise tests stay green and mean the same thing. Add a helper that advances past the instruction and fixation screens, and list which tests changed.

## Done when

`qa:checks` is green, and the commit has no AI attribution.

## Comments

**2026-10-31 — Implemented (implementer, ticket 06).**

- `ExerciseFrame` (`features/assessment/ExerciseFrame.tsx`) wraps every exercise inside `ExerciseHost`: instruction (name, one line, `<kbd>` keycaps, one Begin; Space/Enter start it unless a focused control owns the key) → 500 ms "+" fixation (UFOV skips it) → trials with progress dots → end card ("Nice work", Loti `sm`, Continue). The exercise mounts only when the trials start, so no `recorder.start` and no event happen on the instruction or fixation screens. Exercise timing and telemetry code is untouched.
- Progress dots count finished trials from `tracker.onEvent` for the task's own `task_id` (distinct `trial_index`, so N-back's two events per trial count once). The frame never touches the recorder.
- Consumer names live in `features/assessment/exercises.ts` (`EXERCISE_NAME`) and are also each exercise's region label.

### Stroop red: its own token pair

`--color-danger` (`#A83A4E` / `#F28B9E`) is a crimson-rose; dark reads pink (CIELAB hue 9.9°). Stroop "red" now uses `--color-stroop-red`, a true red (hue 28–29°). It is a stimulus colour, not mood, so the Anti-Red rule does not apply.

| Theme | Hex | On surface | On raised | ΔE00 vs coral fill | ΔE00 vs accent-strong / danger |
|---|---|---|---|---|---|
| light | `#C8102E` | 5.88 | 5.22 | 25.7 (`#F2876B`) | 10.2 (`#B94A2F`) / 10.3 (`#A83A4E`) |
| dark | `#FF5C5C` | 5.39 | 4.65 | 14.7 (`#FF9F86`) | — / 14.3 (`#F28B9E`) |

Tower disc slot 1 keeps `--color-danger` (its id label tells discs apart). Progress dot (brand fill on canvas): 5.08 light, 9.58 dark. New frame text uses ink / ink-muted on canvas and ink on surface keycaps (pairs already audited). No other exercise token changed.

- 2026-10-31 (TD-03 tracker hygiene): Done in 3d2b34b..d6ae10d, review clean (brand-v2 ledger).
