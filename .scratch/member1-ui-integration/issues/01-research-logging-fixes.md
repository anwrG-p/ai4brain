# 01: Research logging fixes (in `assessment_engine/`)

Status: resolved
Blocked by: —
Spec: `../spec.md` (D4). Evidence: `docs/research/2026-10-30-member1-evidence-review.md` §1.1, §1.2, §1.3, §1.4, §1.5

## Why

Member 3 cannot compute the Stroop interference cost or the mental-rotation angle slope from today's events, because the needed variables aren't logged. The Tower has no per-problem time limit, while the TOL-F protocol uses 60 s.

## Changes

Work in `assessment_engine/client` and the module docs.

1. **Stroop** (`src/tasks/Stroop.tsx`): `trial_meta.congruent = trial.word.toLowerCase() === trial.ink.toLowerCase()`.
2. **Mental rotation** (`src/tasks/MentalRotation.tsx`): `trial_meta.angle_deg = trial.angle_deg` (number) and `trial_meta.mirrored = trial.mirrored` (boolean).
3. **Tower:**
   - Contract: `TowerParams` gets an optional `time_limit_ms?: number`.
   - Behaviour: the limit is `params.time_limit_ms ?? 60000`, counted from the prediction submit (planning time has its own phase). On expiry, `finish({correct:false, score:0, windowMs: elapsed since start, meta:{…, solved:false}})`, then `onDone`.
   - Fixture: add `"time_limit_ms": 60000` to the tower fixture.
   - Add a `ponytail:` comment if useful.
4. **Docs:**
   - `README.md`: add the new keys to the trial_meta table (`stroop: congruent`; `mental_rotation: angle_deg, mirrored`) and `time_limit_ms` to the tower contract row.
   - `HANDOVER.md`, Member 3 section, add:
     - d′ with the log-linear correction: `H=(hits+0.5)/(N_signal+1)`, `FA=(FAs+0.5)/(N_noise+1)`, `d′=z(H)−z(FA)`, applied to every user (Hautus 1995). Score lure FAs as a separate class.
     - MST: `LDI = P("similar"|lure) − P("similar"|foil)`.
     - Stroop: interference = mean RT(incongruent) − mean RT(congruent), correct trials only. Prefer the RT cost over the error cost, pool across sessions, and show uncertainty, because single-session reliability is only ICC ≈ .6 (Hedge 2018).
     - Rotation: the intercept is the main score. The slope needs blocked presentation and about 50 trials per condition.
   - `HANDOVER.md`, Member 5 section: add the block-design asks from the evidence review §2, row 5.

## Tests (TDD: write first, see red)

- `Stroop.test.tsx`: an incongruent trial (`RED`/blue) gives `trial_meta.congruent === false`; a congruent trial (`BLUE`/blue) gives `true`.
- `MentalRotation.test.tsx`: the event's `trial_meta` includes `angle_deg` equal to the trial's angle and `mirrored` equal to the trial's flag.
- `Tower.test.tsx`: after a valid prediction, advancing fake timers by 60 000 ms gives one event with `score_norm 0`, `trial_meta.solved false`, and `onDone` called once. A custom `time_limit_ms: 5000` times out at 5000.
- The `trial_meta` key count stays ≤ 16. Check the Tower meta count.

## Done when

`npx vitest run`, `npm run build` and `npx oxlint` are all clean in `assessment_engine/client`. Commit with no AI attribution.

## Comments

- 2026-10-31 (TD-03 tracker hygiene): Done in a42bbbf..c8d5150, review clean (member1-ui-integration ledger).
