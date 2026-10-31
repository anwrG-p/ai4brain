# 06: Exercise visuals (jsPsych-style screens, brand v2, consumer names)

Status: ready-for-agent
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
