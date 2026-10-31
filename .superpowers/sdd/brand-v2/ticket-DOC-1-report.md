# Ticket DOC-1 report

**Branch:** `worktree-agent-a34e3af6cb05c3080`, from base `ae67522` (BE-PORT tip). Docs and one docs test only; no code, no `frontend/`.

## Commits (ae67522..HEAD)
| Commit | What |
|---|---|
| `6ea8c6a` | Test: fail on any `file:///` link under `docs/`; replace the 43 machine-local links (7 files) with repo paths |
| `03ceff6` | ADR 0002; EMILY doc corrected; research doc added to the branch |
| `ea216a8` | Short README; glossary rewrite; challenge plan moved to `TEAM_PLAN.md`; history banners |
| `f3a367c` | `DESIGN.md` summary, docs and UI indexes, judges matrix, contracts |
| `fbab42b` | Test: match `file:///` followed by a path, so prose that names the scheme passes |
| `10fc956` | `TASKS_AND_DIMENSIONS.md` rewrite; coach handover current state |
| `05ff255` | Sequence diagrams: 3 consumer flows rewritten, stale renders removed |

## Tests
- `pytest -q` from the repo root: **862 passed, 1 xfailed, 0 warnings** (the xfail is BE-05's strict held-out crisis-recall record).
- `tests/test_docs_links.py`:
  - **Was:** a `Users/Smida` check over 4 files.
  - **Now:** fails on `file:///` followed by a path in any text file under `docs/` (`.md`, `.html`, `.svg`, `.txt`, `.json`, `.py`), plus the root `README.md` and `GLOSSARY.md`.
  - `test_file_url_pattern` pins the regex: it catches the Smida and hamza forms, and allows a prose mention of the scheme.
  - Checked failing first: 36 offending lines before the fix.

## Acceptance criteria
| Ask | Done |
|---|---|
| 1. ADR "no server-side emotion inference" | `docs/adr/0002-no-server-side-emotion-inference.md`. It covers: a guess made on the device by hand-written rules that the user can correct; the server never infers emotion (it names `brain_twin_jepa`, `clustering_engine`, `ai_coach`, `dynamic_cache`, and the fields `hesitation_jitter`/`keystroke_latency_ms`); not a trained model, since one would be Annex III 1(c) high-risk; Recital 12; the Art 50(3) first-exposure notice; the mood never goes into telemetry or `POST /v1/coach/chat`. It cites research §5 and items 5 and 8. |
| 2. EMILY doc | "100% compliant … non-biometric" removed and replaced by the accurate position (probably emotion recognition, not banned, not an AI system while rule-based, Art 50(3)), with a link to the ADR. Evidence limits: R² .17 (about 17% variance), cursors slower rather than jerkier (contradicts the rules), staircase errors. The cortisol, parasympathetic and dopamine claims are withdrawn. BRIAN and Doodle are gone; the mapping to Momo's moods is added. |
| 3. Stale docs | See the file list. Current docs were rewritten; history docs got a banner at the top. |
| 4. Root README | Product, 5 skills with their exercises, how to run the frontend and backend, the docs index, and the module map. 47 lines. The old work breakdown moved, unchanged apart from a history note, to `docs/architecture/TEAM_PLAN.md`. |
| 5. `file:///` test + fixes | Done (see Tests). There are 0 hits under `docs/`. |

## Files changed and why

**New**
- `docs/adr/0002-no-server-side-emotion-inference.md`: the ADR (item 1).
- `docs/research/2026-10-31-improvement-opportunities.md`: a byte-identical copy of the untracked file in the main checkout. The ADR, EMILY doc and TASKS doc link to it, and the link test needs it to exist. If the controller commits the same file elsewhere, the identical add merges cleanly.
- `docs/architecture/TEAM_PLAN.md`: the old root README (a `git mv`), with a history note on top (Layer A/B/C, `src/` paths never created, dimensions → skills).

**Rewritten (current docs)**
- `README.md`: item 4.
- `docs/GLOSSARY.md`:
  - **Sections 1–2 rewritten:** tone, Loti, Dolphin, Momo, the 5 skills with their exercises, the 6-exercise baseline, tabs and actions.
  - **New "words we no longer use" table:** BRIAN/Nodi, EMILY in the UI, Doodle, 7 dimensions, "Why Brian Suggests This", Co-Pilot Synergy, Weekly Progress Boost (+%), Clarity Range, Rest-Protected Streak, certificates and SHA receipts, "never collected" and "non-biometric", brain regions.
  - **Sections 3–4 kept:** they mirror the copy lint. Added a note that the coach signposts instead of euphemising, and replaced the stale `/design-system` sandbox exemption.
- `docs/adr/0001-…md`: same decision, examples moved to brand v2 words, with a dated note.
- `docs/architecture/EMILY_BEHAVIORAL_EMOTION_ENGINE.md`: item 2.
- `docs/architecture/TASKS_AND_DIMENSIONS.md`:
  - Exercise → telemetry dimension → scoring inputs → skill, taken from `fixtures.json`, `taskScores.ts` and `pillars.ts` on `wave-integration`.
  - The dimension presets are now described as a judge-only tool.
  - Bias table with honest status (done / partly / planned).
  - Telemetry example uses an ISO `client_ts`.
  - Removed: invented tasks (Symbol-Key Pairing, Shape Switch), time-of-day weighting and latency subtraction claims (not implemented), and the Doodle framing.
- `docs/architecture/MEMBER2_HANDOVER.md`:
  - Added a current-state block: no word rewrites, `crisis_check` and `health_signpost`, R14 plus 501 until BE-06, exercise-level wording, no mood input.
  - Fixes: "Layer B" dropped; the "improved by 20%" example replaced; the "+20% improvement" comment fixed; the README line reference now points to `TEAM_PLAN.md`; the "Deficit Language Sanitization" edge case updated to withhold-whole-reply.
- `docs/architecture/SEQUENCE_DIAGRAMS.md`:
  - **Rewritten diagrams:** 1 (first visit: Welcome → 6-exercise baseline → Results consent → Home), 2 (Momo's on-device guess, nothing sent) and 4 (Loti: scripted by default; AI mode only behind keyword gate → backup classifier → health signpost → output guardrail).
  - **Diagram 3:** "Layer A Client" became "Client tracker".
  - **Header:** the viewer note was updated.
- `docs/architecture/sequence_diagrams_viewer.html`: dropped the 3 stale consumer diagrams from the embedded list (8 remain) and relabelled diagram 09.
- `docs/architecture/diagrams/09-telemetry-jepa-cache.svg`: the same relabel.
- **Deleted** `docs/architecture/diagrams/{07-consumer-ux-flow,08-emily-emotion-color-adaptation,10-ai-coach-guardrails-collab}.{svg,png}`: stale BRIAN and colour-therapy renders. No mermaid-cli was available to re-render, so the rewritten diagrams render from Mermaid source (GitHub draws them inline).
- `docs/design/DESIGN.md`: replaced the Doodle spec with a short brand v2 summary (the classroom board, sky and coral, Quicksand/Inter, tokens and checks). It points to `docs/design/BRAND-V2.md` and to git history.
- `docs/README.md`: new short index, split into current and history.
- `docs/ui/README.md`: new index, split into current and history.
- `docs/ui/JUDGES-UI.md`: the 11 criteria remapped to the brand v2 screens and `?judge=1`. File paths were checked against `wave-integration`.
- `docs/ui/contracts.md`:
  - Now points at `features/assessment/telemetry/types.ts` and `types/index.ts`.
  - The endpoint table shows real status at `ae67522`: telemetry, delete (with `deleted_events`/`deleted_files` counts, no certificate) and export are live; tasks/coach/collab/clustering return 501, with the ticket that lands each; profile returns `not_enough_data`.
  - New "dimensions vs skills" section; the 7-dimension registry was removed.
- `docs/ux-pipeline/README.md`: removed "updated in TD-04"; history labels on the BRIAN/Doodle links; the EMILY link now also points to ADR 0002.
- `AGENTS.md`: the Project, Frontend Stack and Docs lines no longer say BRIAN or Doodle. Added a rule against `file:///` links.

**History banner only** (a `> **History.**` or `> **Superseded (history).**` line under the H1, body untouched apart from the `file:///` fixes):
- `docs/ui/{00-context,01-ux-strategy,02-design-system,ASSETS,STATE,AGENT-EVALUATION-HANDOFF,CHANGELOG,QA-log,DECISIONS}.md`
- `docs/design/UX_TRANSFORMATION_PLAN.md`
- `docs/ui/pages/01…19`: each banner says where that route goes now, from the redirect list in BRAND-V2.
- The DECISIONS note sits at the top only, so ticket 10's DEC-011 append should not conflict.

**`file:///` → repo path in a code span** (43 links):
- `docs/ui/AGENT-EVALUATION-HANDOFF.md`
- `docs/ui/pages/{13,14,15,16,17,19}-*.md`

## Left as is, on purpose
- `docs/research/2026-10-30-*.md`: dated research records. They mention BRIAN, Doodle and the certificate as the state at the time.
- `docs/branding/*`: early BRIAN logo concept art and its generator scripts. They are labelled as history in `docs/README.md`.
- Mentions of retired words inside the new docs: the glossary's retired-words table, and dated "superseded" notes.

## Requests and follow-ups
- **BRAND-V2.md links:** `docs/design/BRAND-V2.md` lives on `wave-integration`, so the new docs name it in code spans, not links. That keeps the link test green on this branch. After both merge, these can become relative links (`DESIGN.md`, `docs/README.md`, `ui/README.md`, `ui/JUDGES-UI.md`, the banners).
- **Diagram scripts:** `scripts/{build_html_viewer,parse_and_render_diagrams,update_sequence_diagrams_md}.mjs` still list diagrams 07, 08 and 10 (code, out of scope). Re-running them with mermaid-cli would re-render the new Mermaid sources. Otherwise drop those entries (TD-05).
- **Stale PNG:** `09-telemetry-jepa-cache.png` still says "Layer A Client". Only the SVG and the viewer were relabelled.
- **Old UI docs:** `docs/ui/pages/` and `docs/ui/screenshots/` are now bannered history. TD-05 ("remaining docs/ui stale pages") may delete them.
- **ADR 0002 consequences for F-D/F-C:**
  - the Art 50(3) notice and opt-in;
  - staircase errors must not count as strain (note that `EmotionListener` does not pass `consecutiveErrors` today);
  - the FE-05 coach transport must not send the mood.
