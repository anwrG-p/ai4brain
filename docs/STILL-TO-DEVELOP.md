# Still to develop (status: 2026-11-01)

This file replaces section 2 of `docs/HANDOVER-2026-11-01.md`. Every agent is stopped. The branch `feat/ui-calm-clean` holds every part that passed review.

## 1. On the branch (reviewed and merged)
- Brand v2 frontend, plus F-D: opt-in mood guess with the AI Act notice, consent per purpose, weekly goal, time-of-day view, colour-blind-safe setting.
- **F-B:** Stop Light, Pair Finder and Arrow Focus.
- Backend modules:
  - BE-04: task pools;
  - BE-05/06: coach safety, Gemini, collaboration score;
  - BE-07: features;
  - BE-09: clustering;
  - BE-10: brain twin in shadow mode;
  - BE-11: state bus, `GET /v1/dashboard/profile`, `POST /v1/clustering/evaluate`, WhyThisTrail, model bootstrap;
  - BE-13: Gemini variant worker and slur blocklist.
- **Frontend checks:** `npm run qa:checks` passes: 69 files, 1414 tests, build.

### Tests: all green
- Backend: `pytest -q -m "not benchmark"` passes (1658 + 4 xfailed).
- Frontend: `qa:checks` passes (1446 tests, build).
- Flaky under load: `src/tests/designSystem.test.tsx` "renders Page 01 Welcome". It passes on a re-run; worth a look.

## 2. Merged without an independent review (review recommended)

| Branch on GitHub | What | State | Next step |
|---|---|---|---|
| `wip/srv-1-server-catchup` | See the SRV-1 list below | **MERGED at the owner's request.** At merge, the pool key gained inks, so BE-13's `offer`/`pool_stock` now target the default-inks pools only (cvd_safe Stroop stays procedural; `ponytail:` note) and `ARCHETYPE_OPTIONS` was restored. Tests were updated to F-B's `Object.keys` schema list. | An independent review is still recommended. |
| `wip/art-1-brand-references` | See the ART-1 list below | **MERGED at the owner's request** (qa:checks on the merged branch: 69 files, 1446 tests, 128 contrast pairs, build green) | An independent review is still recommended. Regenerate `docs/ui/screenshots/`. |

**SRV-1 contains:**
- the Python port of the Stop Light, Pair Finder and Arrow Focus scorers (golden from F-B `700af3c`);
- generators and solvers for the 3 new schemas;
- all 11 schemas served;
- the `inks=cvd_safe` query, with pools keyed on inks;
- synthetic n-back following R16, plus the 3 new exercises;
- clustering refitted on BE-07 features (the stand-in adapter is gone).

**ART-1 contains** the owner's references (`docs/design/references/`):
- flat line-art Loti with poses idle, talk, think, happy (thriving), wave and a new `low`;
- **Momo is the dolphin**: Dolphin is merged into Momo, the pebble is gone, and a `celebrate` mode is added;
- the Loti-in-an-arc logo with the "SynapseTwin" lockup, and the favicon;
- the board with blue and coral blobs, with the wood frame dropped;
- the BRIAN logo and assets deleted;
- docs updated.

ART-1 has 3 known gaps:
- the blobs are paler than the reference, so text keeps AA contrast;
- the characters are simplified SVGs, close to the reference but not identical;
- `docs/ui/screenshots/` is stale and needs regenerating.

Screenshots are in the agent's scratchpad, `art1/`.

## 3. Not started

| Ticket | Scope | Estimate |
|---|---|---|
| **F-A: insights quality** | practice-adjusted RCI; "Building your profile" state; low-effort flags; EZ-diffusion (`DDM_Caution`); `SESSIONS_PER_WEEK` 4 → 3; Tower limits in how-to-play; ExerciseDemo colours under cvd_safe | ~1 day |
| **F-C: real-server wiring** | dashboard on the BE-11 profile contract (`docs/ui/contracts.md`); no forecast drawn while `validated` is false; coach chat behind consent purpose 2; send `schema_type`/`session_id`/`seq`/`inks`; handle 413/422/429/501/503; shared Loti script file; drop the old `estimates`/`snapshots`/`latent_vector` keys | ~1–1.5 days |
| **TD-05: cleanup** | unused deps; stale docs; a real `docker build` (needs Docker Desktop running; the bootstrap step takes ~3 min); regenerate `docs/ui/screenshots/` | ~0.5 day |
| **FE-10 orienting** | cue conditions for `ANT_Orienting` in Arrow Focus. Today it is still taken from Perceptual Radar. | ~0.5 day |
| **Snapshots + fatigue grid** | REQ-BE-03/04, server side. They were not in BE-11's scope. | ~0.5 day |
| **Docs** | R17 shadow-mode note; `docs/architecture/SEQUENCE_DIAGRAMS.md` line 3 status | ~1 h |
| **Final review** | whole-system review against the README architecture table, then the PR into `main` (the owner merges) | ~0.5 day |

## 4. Accepted minors (no action unless they matter)
- Sessions stored before F-B show Color Clash ANT_Conflict as "Arrow Focus" in the heatmap. This is pre-release, device-local data.
- F-B test gaps: measured vs scheduled SSD; a hide while not live in callers with no fixation.
- BE-11: the striped per-user lock (1/64 of users share a stripe). The upgrade is a per-key lock map.
- BE-13: the budget file can lose updates across processes (deployment is single-process). A Windows read error marks the day as spent, which fails safe.
- Arrow Focus sits under Mental Agility because of the `pillars.ts` weights.
