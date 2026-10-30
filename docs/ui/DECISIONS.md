# UI & UX Architecture Decisions (`DECISIONS.md`)

Every non-trivial frontend, UX, design-system, and contract decision is recorded here in chronological order.

---

## DEC-001: Repository Directory Boundary (`frontend/` + `docs/ui/`) vs Existing Repo Folders
- **Date**: 2026-10-24
- **Context**: On cloning `https://github.com/anwrG-p/ai4brain`, we found `README.md` describing a 5-member layout (`assessment_engine/client/` already populated by Member 1, and an empty `dashboard_ui/` folder with `.gitkeep`). However, Section 4 of our working agreement strictly mandates: *"Touch only `frontend/**` and `docs/ui/`."*
- **Options**:
  1. Build inside `frontend/` and `docs/ui/` as mandated by Section 4, while making `frontend/src/contracts/` 100% compatible with `assessment_engine/` (`POST /v1/telemetry/event`, `GET /v1/tasks/next`, `GET /v1/dashboard/profile`, `DELETE /v1/user/telemetry`).
  2. Build inside `dashboard_ui/` instead of `frontend/`.
- **Choice**: **Option 1 (`frontend/` + `docs/ui/`)**, while flagging `[VERIFY]` for the team on whether `frontend/` stays at `/frontend` or gets symlinked/aliased to `dashboard_ui/` at integration checkpoint #1 (26/10).
- **Why**: Honors the hard Section 4 file-boundary rule without touching teammates' directories, and allows us to wrap and unify Member 1's assessment schemas (`n_back`, `stroop`, `matrix`, `mental_rotation`, `relational`, `tower`, `ufov`, `mst`), Member 2's AI Coach + Collaboration Score, Member 3's SAT-JEPA Brain Twin + 9 GMM archetypes, and Member 4's Dashboard + Privacy Center into one cohesive, single-origin SPA experience for the jury.

---

## DEC-002: Dimension Registry Bridging (7 Cognitive Dimensions vs Member 1's 6 Backend Keys)
- **Date**: 2026-10-24
- **Context**: The official challenge brief omits Section 3's dimension list. Our Section 3 team plan specifies 7 dimensions (*Working Memory, Inhibition Control, Cognitive Flexibility [Set-Shifting], Attention Networks, Divided Perceptual Speed, Episodic Pattern Separation, Visuospatial Planning & Gf*), our intake note adds a 6-dimension preset (*Attention, Working Memory, Processing Speed, Cognitive Flexibility, Inhibitory Control, Reasoning*), and Member 1's `assessment_engine/api/routes/telemetry.py` currently validates 6 snake_case literals (`working_memory`, `pattern_induction`, `executive_function`, `spatial_orientation`, `processing_speed`, `episodic_memory`) across 8 cognitive task schemas (`n_back`, `stroop`, `matrix`, `mental_rotation`, `relational`, `tower`, `ufov`, `mst`).
- **Options**:
  1. Hardcode one list and risk breaking either the UI plan or Member 1's FastAPI Pydantic validator.
  2. Build a config-driven `DimensionRegistry` in `frontend/src/config/dimensions.ts` that defaults to our 7 dimensions, maps each dimension to Member 1's `backendDimensionKey` and `SchemaType` (`n_back`, `stroop`, `ufov`, `mst`, `tower`, `matrix`, `relational`, `mental_rotation`), and provides 1-click presets in Judge Mode for **6 dimensions (Backend/Intake preset)**, **7 dimensions (Team Plan default)**, **3 dimensions (Minimal stress test)**, and **10 dimensions (Surprise generalization test)**.
- **Choice**: **Option 2 (Bridged Config Registry with 3/6/7/10 presets)**. `[VERIFY: pending final team confirmation of canonical display labels]`.
- **Why**: Satisfies Generalisation (10% of final score), guarantees zero 422 errors when posting telemetry to Member 1's `POST /v1/telemetry/event`, and prepares us for the Phase 2 surprise element.

---

## DEC-003: Temporary Product Brand Token
- **Date**: 2026-10-24
- **Context**: The team has not finalized the product name yet.
- **Options**: Hardcode "AI4Brain" everywhere vs. centralize a single `PRODUCT_NAME` token in `frontend/src/config/brand.ts`.
- **Choice**: Centralize `PRODUCT_NAME = "SynapseTwin"` `[ASSUMPTION]` in `frontend/src/config/brand.ts` with subtitle `"AI4Brain Cognitive Growth Agent"`.
- **Why**: Updating one string in `brand.ts` updates all 19 pages, page titles, privacy exports, and headers in 2 seconds once the team decides.

---

## DEC-004: Package Manager & Node Version
- **Date**: 2026-10-24
- **Context**: Section 4 requires one package manager, `.nvmrc`, and a committed lockfile. Member 1's `assessment_engine/client/` already uses `npm` (`package-lock.json`).
- **Options**: `npm` vs `pnpm` vs `yarn`.
- **Choice**: **`npm` (`package-lock.json`)** + `frontend/.nvmrc` set to `24` (compatible with Node 20+ and matching local Node `v24.15.0`).
- **Why**: Consistent with the existing repository conventions in `assessment_engine/client/` and works natively inside the local environment.

---

## DEC-005: Localization & Layer D Sequencing
- **Date**: 2026-10-24
- **Context**: Balancing Phase 1 `Must` pages against bonus features (Layer D voice/projections and secondary locales).
- **Options**: Build i18n previews and Layer D early vs. gate them strictly behind `ui-m3-feature-freeze`.
- **Choice**: **English-only UI copy** until all `Must` pages pass the 13-point Definition of Done, using **CSS logical properties** (`ms-*`, `me-*`, `ps-*`, `pe-*`, `text-start`, `border-inline-start`) from Day 1 so RTL (Arabic) requires zero layout rewrites later. Layer D screens (`Page 19`) are built only after all `Must` pages pass DoD.
- **Why**: Protects the 6 Hero pages and mandatory rubric proofs first.

---

## DEC-006: Design Direction & Typography Lock (Playful Lab + Fredoka/Lexend/JetBrains Mono)
- **Date**: 2026-10-24
- **Context**: Following the 3-tile Design Direction Sprint (`docs/ui/direction-sprint.html`), we needed to lock the primary visual identity and self-hosted open-license typography pairing.
- **Options**:
  1. **Tile A (Playful Lab)** Light default + **Tile C (Night Lab)** Dark theme, paired with **Pairing 1 (`Fredoka` display + `Lexend` UI body + `JetBrains Mono` metrics)**.
  2. Tile B (Calm Clarity) + Pairing 2 (`Baloo 2` + `Atkinson Hyperlegible`).
  3. Tile C (Night Lab dark-first) + Pairing 3 (`Sora` + `Lexend`).
- **Choice**: **Option 1 (Playful Lab Light + Night Lab Dark + Fredoka / Lexend / JetBrains Mono)**.
- **Why**: Warm paper (`#FFF8EE`) with crisp `#1F1B3B` (`15.61:1`) tactile borders avoids clinical anxiety while keeping charts rigorous; `Lexend` is empirically designed to reduce visual crowding and improve reading speed, giving us a strong accessibility narrative for the jury pitch.


---

## DEC-007: Consumer Visual Hierarchy, Floating Judge Quick-Bar & Progressive Disclosure
- **Date**: 2026-10-25
- **Context**: Transitioning SynapseTwin from a feature-complete engineering build to an Apple Design Award / Brilliant.org consumer product while keeping 100% test compatibility.
- **Options**:
  1. Keep the 23-button header wall and flat heavy 2px borders everywhere.
  2. Redesign the top navigation into a 5-destination consumer bar (`Welcome`, `Dashboard`, `Assess`, `AI Coach`, `Plan`) paired with a collapsible floating `⚖️ Judge & DevTools Quick-Bar`, soft editorial tokens (`1px` subtle borders, layered `shadow-soft`, warm hero gradients, 20px radii), and progressive disclosure tabs on the dashboard (`All`, `Overview`, `7 Dimensions`, `Habits`), powered by `framer-motion`.
- **Choice**: **Option 2**.
- **Why**: Eliminates cognitive clutter and visual fatigue for end users and judges; preserves 100% of DOM selectors, `data-testid` attributes, and accessibility landmarks so all 22 unit tests and all Playwright visual QA specs pass without breakage.


---

## DEC-008: Dual-Persona Product Shell, Nodi Seedling Companion, Self-Hosted Fonts & Truth-in-Claims
- **Date**: 2026-10-27
- **Context**: Implementing the comprehensive "AI4Brain Frontend: Evaluation and Redesign" roadmap to elevate SynapseTwin frontend readiness from ~72/100 to ~84/100 for the CISTAC 1.0 competition.
- **Problem**:
  1. Header was overloaded with 28 evaluator controls, pushing page content down to 232px on laptop and 577px on mobile.
  2. Google Fonts loaded from third-party servers at runtime, contradicting offline privacy guarantees.
  3. Four copy claims did not match code behavior (IndexedDB keyring, 14-snapshot cached chain, unbuffered offline banner, simulated deletion count).
  4. The companion was a static 64px visor robot that felt mechanical rather than an empathetic learning guide.
- **Options**:
  1. Keep the single monolithic toolbar with inline tooltips.
  2. Implement a Dual-Persona Architecture:
     - Layer 1 (Product Navigation): Clean 64px top bar (`h-16`) on desktop and bottom tab bar on mobile with 5 consumer destinations (`Today`, `Practice`, `Coach`, `Progress`, `You`). Content starts $\le 80\text{px}$ on desktop and $\le 130\text{px}$ on mobile.
     - Layer 2 (Judge Mode): Opt-in right-docked drawer (Shift+J / `?judge=1` / header pill), collapsed by default, containing persona switching, 3-to-10 dimension presets, fault injections, and all 19 deep-links.
     - Self-host `@fontsource/fredoka`, `@fontsource/lexend`, and `@fontsource/jetbrains-mono` with zero runtime external calls.
     - Implement real 500-event offline `telemetryQueue.ts` with exponential backoff and browser online/offline synchronization. *(Superseded 2026-10-30: `telemetryQueue.ts` was deleted; Member 1's Tracker is now the single telemetry sink. See DEC-009, proposed.)*
     - Design "Nodi", an animated seedling neuron with dendrite leaves for calibrated dimensions and pulsing buds for low-confidence dimensions.
     - Build GitHub Actions CI workflow (`.github/workflows/ui-ci.yml`) to enforce all quality gates.
- **Choice**: **Option 2**.
- **Why**: Eliminates cognitive overload, respects learner focus, guarantees 100% offline self-containment, establishes truth-in-claims, and makes dimension generalisation immediately visible on the companion character. All 22 Vitest unit tests and all 19 Playwright E2E specs pass with 0 axe-core accessibility violations.

---

## DEC-009: Member 1's Exercises and Tracker Inside the Task Runner (`features/assessment/`)
- **Date**: 2026-10-30
- **Status**: **Proposed** by Member 1. The UI owner accepts or amends it (DEC-001: the UI team owns `frontend/**`).
- **Context**: `/task/:dimId` showed a scripted mock, and the UI's `telemetryQueue.ts` sent an event shape that `POST /v1/telemetry/event` rejects with 422 (against DEC-002). Member 1's real exercises lived in a separate app, `assessment_engine/client/`. Spec: `.scratch/member1-ui-integration/spec.md`.
- **Choice** (decided with the user, 2026-10-30):
  - **D1. No voice in the UI.** The voice toggle and probe are not ported. `voice_opt_in` is always `false`, so the "microphone permanently blocked" copy (DEC-008) stays true. Voice opt-in remains only in the frozen `assessment_engine/client/`.
  - **D2. The code moves to `frontend/src/features/assessment/`.** Member 1 owns that folder inside the UI app. `assessment_engine/client/` becomes a frozen reference whose README points here. `assessment_engine/api/` stays where it is.
  - **D3. Member 1's `Tracker` is the single telemetry sink.** It gained the old queue's extras: `localStorage` persistence (`synapsetwin_telemetry_queue_v2`), `subscribe`/`getStatus` for the offline banner's real pending count, and `clear()` for the Privacy purge. `services/telemetry/telemetryQueue.ts` is deleted (DEC-008's queue bullet is superseded).
  - **R3. Pause unmounts.** Any pause (Escape, the pause button, a real or simulated tab blur) unmounts the exercise. Resume starts a fresh task with a new `task_id`. Events already sent stay valid, the interrupted trial is never sent, and `item_id`s never repeat.
- **Changes outside `features/assessment/`**: `TaskRunnerPage` (mounts `ExerciseHost`; `?schema=` and one "Exercise: …" evaluator button per schema type; real tracker status replaces the hard-coded "202 Accepted" claim), `AppShell` (offline banner reads the Tracker), `PrivacyPage` (purge calls `tracker.clear()` and shows the real count), and the deleted `telemetryQueue.ts`. All DEC-007 selectors are kept.
- **Why**: Every trial now reaches the server in the contract's shape (end-to-end smoke: all 8 schema types, 0 × 422). One sink means one offline count and one purge path. `qa:checks` and the Playwright task-runner spec (axe, light and dark; no overflow at 375/768 px) stay green.
- **Open items for the UI owner** (found during the integration; not changed, because they are outside Member 1's folder or locked by DEC-007):
  1. The DEC-007-locked heading "✓ … confidence interval narrowed!" is shown on every completed screen, even with 0 answers. Nothing backs it, which conflicts with DEC-008 truth-in-claims. Suggestion: render it only when answers were recorded, and relax the DEC-007 selector.
  2. The Privacy purge certificate lists server artifacts (`data/raw/telemetry/*.jsonl`, snapshots, logs, caches) as `CONFIRMED_PERMANENT`, but the purge only clears the events still pending on this device. Server deletion is Member 4's `DELETE /v1/user/telemetry`.
  3. The baseline completed screen always says "Your Initial Brain Twin Is Calibrated!", whatever was recorded.
  4. The task runner's `briefing` stage is unreachable (the page starts in `running`), and its "Keys: shown on each button" line is untrue for Tower, which uses a number field and peg buttons.
  5. AppShell's absolute "Progress: Pending" team-status badge also shows on the running task screen (the runner adds `pt-8` to keep the pause control clear of it).
  6. Matrix glyph colours red and green are hard to tell apart with colour-vision deficiency (dark theme ΔE ≈ 9.2). A distractor that differs only by colour needs a second cue (shape or pattern).
  7. `services/api/apiClient.ts` still has `postTelemetryEvent` and `getNextTask`. Nothing calls them; the Tracker and `features/assessment/tasks/taskSource.ts` replace them. They can be deleted.
  8. `playwright.config.ts` uses `channel: 'chrome'` outside CI, so `npm run qa:e2e` needs Google Chrome installed. Ticket 08 ran the spec with installed Edge via a scratch config that only changed the channel.
