# UI Changelog (`docs/ui/CHANGELOG.md`)

> **History.** A record of the UI before brand v2 (BRIAN, the Doodle design, 19 pages, 7 dimensions). Entries are kept as written; later work supersedes them. Current: the [root README](../../README.md), the [glossary](../../docs/GLOSSARY.md) and `docs/design/BRAND-V2.md`.

All notable UI, UX, design system, and documentation changes on `ui/main` follow Conventional Commits.

## [Unreleased] — Aesthetic Upgrade Sprint (2026-10-25)
### Added
- `frontend/src/components/layout/AppShell.tsx`: Redesigned top navigation into a consumer-grade 5-destination navbar (`Welcome`, `Dashboard`, `Assess`, `AI Coach`, `Plan`) paired with a collapsible, floating `⚖️ Judge & DevTools Quick-Bar` dock featuring animated height expansion/collapse (`framer-motion`), 3–10 dimension preset switcher, and organized deep-links to all 19 views.
- `frontend/src/styles/tokens.css` & `frontend/src/components/ui/Card.tsx`: Introduced soft editorial tokens (`--border-card-subtle`, `--shadow-soft`, `--shadow-hero`, `--bg-card-gradient`, `--bg-hero-gradient`, `--radius-xl`), replacing heavy 2px container borders with refined 1px subtle boundaries, layered elevations, 20px border radius, and generous 24px padding.
- `frontend/src/pages/DashboardPage.tsx`: Implemented progressive disclosure view-filter segmented controls (`All (Full View)`, `Overview & Twin Charts`, `7 Cognitive Dimensions`, `Habit Heatmap & Collaboration`) and upfront digestible Priority Coach Recommendation summary card with smooth 5-part reasoning trail drawer (`WhyThisPanel.tsx`).
- `docs/ui/DECISIONS.md`: Logged `DEC-007` (Consumer Visual Hierarchy, Floating Judge Quick-Bar & Progressive Disclosure).

## [ui-v1.0-phase1] — Sprint Day 2 (2026-10-25)
### Added
- `frontend/src/pages/LayerDPage.tsx`, `frontend/e2e/layerD.spec.ts`, and `docs/ui/screenshots/19-layer-d-*.png`: Implemented Page 19 (`Layer D Bonus: Voice Coaching & Scenario Projections`, route `/layer-d`) completing the 4-layer cognitive architecture. Features Conversational Multimodal Voice Coaching Studio with 24-bar animated SVG waveform, voice pace selection (`0.85x`, `1.0x`, `1.25x`), persona switcher, synchronized live captions (WCAG 1.2.2), Counterfactual "What-If" Scenario Simulator with intensity, sleep, and rest day controls, Cognitive Fatigue & Burnout Risk forecast gauge, and accessible Counterfactual Impact Matrix Table (`role="region"` with `tabIndex={0}`) scaling dynamically with active dimension presets (3, 6, 7, 8, 10 dims).
- `docs/ui/pages/19-layer-d.md`: Complete 11-section page specification for Page 19 (`Layer D Bonus: Voice Coaching & Scenario Projections`, route `/layer-d`).
- `frontend/src/pages/MethodologyPage.tsx`, `frontend/e2e/methodology.spec.ts`, and `docs/ui/screenshots/15-methodology-*.png`: Implemented Page 15 (`Methodology, Limits & Ethics`, route `/methodology`) featuring interactive 4-stage cognitive computation pipeline (Active Probes, Staircase IRT, Bayesian Twin, SAT-JEPA Vector Differential), mathematical formulation disclosures, interactive bias & uncertainty simulator modeling hardware latency and circadian dips, 4-pillar ethical charter (Non-Clinical Guarantee, Non-Biometric Hardware Lock, Zero-Guilt Streak Protection, Data Sovereignty), live non-clinical copy guardrail sandbox powered by `lintCopyText`, accessible measurement biases & mitigations reference table, and companion `<Mascot state="thinking" />`.
- `docs/ui/pages/15-methodology.md`: Complete 11-section page specification for Page 15 (`Methodology, Limits & Ethics`, route `/methodology`).
- `frontend/src/pages/SettingsPage.tsx`, `frontend/e2e/settings.spec.ts`, and `docs/ui/screenshots/14-settings-*.png`: Implemented Page 14 (`Settings & Accessibility Controls`, route `/settings`) featuring visual and sensory adaptations (Theme Mode switching, 100%–130% cognitive text scaling, Okabe-Ito geometric glyph contrast markers), motion and vestibular comfort controls, auditory feedback and window blur auto-pause toggles, zero-guilt study window boundaries and protected rest days, cognitive dimension pool selector (3, 6, 7, 8, 10 dimensions), accessible single-key ergonomics reference table (`role="region"` with `tabIndex={0}`), 1-click factory reset, and companion `<Mascot state="idle" />`.
- `docs/ui/pages/14-settings.md`: Complete 11-section page specification for Page 14 (`Settings & Accessibility Controls`, route `/settings`).
- `frontend/src/pages/SystemPage.tsx`, `frontend/src/components/layout/ErrorBoundary.tsx`, `frontend/e2e/system.spec.ts`, and `docs/ui/screenshots/17-system-*.png`: Implemented and merged Page 17 (`System States & Error Boundaries`, route `/system/*`) into `ui/main` (`9754f09`) with Milestone tag `ui-m3-feature-freeze`.
- `frontend/src/pages/JudgeModePage.tsx`, `frontend/src/components/signature/JudgeModeDock.tsx`, `frontend/e2e/judgeMode.spec.ts`, and `docs/ui/screenshots/16-judge-mode-*.png`: Implemented and merged Page 16 (`Competition Demo & Judge Mode`, route `/judge-mode`) into `ui/main` (`256a93d`).
- `frontend/src/components/signature/PrivacyCenter.tsx`, `frontend/src/pages/PrivacyPage.tsx`, `frontend/e2e/privacy.spec.ts`, and `docs/ui/screenshots/13-privacy-*.png`: Implemented Page 13 (`Privacy Center & Audit Log`, route `/privacy`) featuring **Signature #6 `<PrivacyCenter />`**, prominent Non-Biometric Hardware Lock Banner, granular consent controls with single-click EDPB "Reject All Optional" action, live "What the AI Sees" telemetry JSON inspector, cryptographic consent receipt (SHA-256), self-service GDPR Article 20 archive export, 2-step right-to-erasure purge with Deletion Certificate, chronological audit log table, and integrated `<WhyThisPanel />` and companion `<Mascot />`.
- `docs/ui/pages/13-privacy.md`: Complete 11-section page specification for Page 13 (`Privacy Center & Audit Log`, route `/privacy`).
- `frontend/src/components/goals/HabitContractCard.tsx`, `frontend/src/pages/GoalsPage.tsx`, `frontend/e2e/goals.spec.ts`, and `docs/ui/screenshots/11-goals-*.png`: Implemented and merged Page 11 (`Goals & Habit Contracts`, route `/goals`) into `ui/main` (`312f194`).
- `docs/ui/pages/11-goals.md`: Complete 11-section page specification for Page 11 (`Goals & Habit Contracts`, route `/goals`).
- `frontend/src/components/signature/CollaborationScoreCard.tsx`, `frontend/src/pages/CollaborationScorePage.tsx`, `frontend/e2e/collaboration.spec.ts`, and `docs/ui/screenshots/12-collaboration-*.png`: Implemented and merged Page 12 (`AI Collaboration Score Deep-Dive`, route `/collaboration`) into `ui/main` (`8285d49`).
- `docs/ui/pages/12-collaboration.md`: Complete 11-section page specification for Page 12 (`AI Collaboration Score`, route `/collaboration`).
- `frontend/src/pages/PlanPage.tsx`, `frontend/e2e/plan.spec.ts`, and `docs/ui/screenshots/10-plan-*.png`: Implemented and merged Page 10 (`Plan & Adaptive Exercises`, route `/plan`) into `ui/main` (`ea1bd66`).
- `docs/ui/pages/10-plan.md`: Complete 11-section page specification for Page 10 (`Plan & Adaptive Exercises`, route `/plan`).
- `frontend/src/pages/DimensionDetailPage.tsx`, `frontend/src/components/signature/ProjectionFanChart.tsx`, and `frontend/e2e/dimensionDetail.spec.ts`: Implemented and merged Page 07 (`Dimension Detail`, route `/dimensions/:dimId`) into `ui/main` (`d54f2ad`).
- `docs/ui/pages/07-dimension-detail.md`: Complete 11-section page specification for Page 07 (`Dimension Detail`, route `/dimensions/:dimId`).
- `frontend/src/pages/AiCoachPage.tsx`, `frontend/src/utils/copyLinter.ts`, and `frontend/e2e/aiCoach.spec.ts`: Implemented and merged Page 09 (`AI Coach · HERO`, route `/coach`) into `ui/main` (`9cbd702`).
- `docs/ui/pages/09-ai-coach.md`: Complete 11-section page specification for Page 09 (`AI Coach · HERO`, route `/coach`).
- `frontend/src/components/signature/BrainTwinTimeTravel.tsx`, `frontend/src/pages/BrainTwinPage.tsx`, and `frontend/e2e/brainTwin.spec.ts`: Implemented and merged Page 08 (`Brain Twin & Historical Timeline · HERO`, route `/brain-twin`) and Signature #2 `<BrainTwinTimeTravel />` into `ui/main` (`a256024`).
- `docs/ui/pages/08-brain-twin.md`: Complete 11-section page specification for Page 08 (`Brain Twin & Historical Timeline · HERO`, route `/brain-twin`) and Signature #2 `<BrainTwinTimeTravel />`.

## [`ui-m2-core-pages`] — 2026-10-24
### Added
- `frontend/src/pages/TaskRunnerPage.tsx` & `frontend/e2e/taskRunner.spec.ts`: Implemented and merged Page 04 (`Task Runner · HERO`, route `/task/:dimId`) into `ui/main` (`c1413d9`).
- `docs/ui/pages/04-task-runner.md`: Complete 11-section page specification for Page 04 (`Task Runner · HERO`, route `/task/:dimId`).
- `frontend/src/pages/AssessmentHubPage.tsx` & `frontend/e2e/assessmentHub.spec.ts`: Implemented and merged Page 03 (`Assessment Hub`, route `/assessment`) into `ui/main` (`2ab8f50`).
- `docs/ui/pages/03-assessment-hub.md`: Complete 11-section page specification for Page 03 (`Assessment Hub`, route `/assessment`).
- `frontend/src/pages/ProfileRevealPage.tsx`, `frontend/src/components/signature/Mascot.tsx` (Signature #8), and `frontend/e2e/profileReveal.spec.ts`: Implemented and merged Page 05 (`Profile Reveal · HERO`, route `/profile-reveal`) and `<Mascot />` into `ui/main` (`fdb1ff9`).
- `docs/ui/pages/05-profile-reveal.md`: Complete 11-section page specification for Page 05 (`Profile Reveal · HERO`, route `/profile-reveal`) and the Mascot Sprint (`<Mascot />` Signature #8).
- `frontend/src/pages/DashboardPage.tsx`, `frontend/src/components/signature/ProjectionFanChart.tsx` (Signature #4), `frontend/src/components/signature/FatigueHeatmap.tsx`, and `frontend/e2e/dashboard.spec.ts`: Implemented and merged Page 06 (`Dashboard · HERO`, route `/dashboard`) into `ui/main` (`6612867`).
- `docs/ui/pages/06-dashboard.md`: Complete 11-section page specification for Page 06 (`Dashboard · HERO`, route `/dashboard`).
- `frontend/src/pages/OnboardingPage.tsx` & `frontend/e2e/onboarding.spec.ts`: Implemented and merged Page 02 (`Onboarding & Consent`, route `/onboarding`) into `ui/main` (`763968b`).
- `frontend/src/pages/WelcomePage.tsx`: Implemented and merged Page 01 (`Welcome` · HERO) into `ui/main` (`a4c1646`).

### Fixed
- `frontend/src/components/ui/Badge.tsx` & `frontend/src/components/layout/AppShell.tsx`: Added responsive wrapping support (`whitespace-normal max-w-full`) for long dimension badges and mobile header badges at `375px`.
- `frontend/src/styles/tokens.css`: Resolved circular `@theme` CSS variable self-reference in Tailwind CSS v4 and layered base/component rules under `@layer base` and `@layer components`.

## [`ui-m1-design-system`] — 2026-10-24
### Added
- `frontend/`: Complete React 18 + TypeScript (strict) + Tailwind CSS + OKLCH `tokens.css` foundation, `DimensionRegistry` (3/6/7/8/10 dimensions), `<UncertaintyRadar />`, `<WhyThisPanel />`, and automated QA scripts (`lint:tokens`, `lint:copy`, `check:contrast`).
- `frontend/src/pages/DesignSystemPage.tsx` & `docs/ui/screenshots/18-design-system-*.png`: Implemented and verified Page 18 (`/design-system`) across 375, 768, and 1440 px viewports with 0 `axe-core` violations.
- `docs/ui/02-design-system.md`: Locked **Playful Lab** + **Night Lab** OKLCH token specification, computed WCAG 2.1 contrast table, and 3-to-10 dimension Okabe-Ito colorblind-safe palette (`DEC-006`).
- `docs/ui/pages/18-design-system.md`: Complete 11-section page specification for Page 18 (`/design-system`).
- `docs/ui/README.md`, `00-context.md`, `01-ux-strategy.md`, `contracts.md`, `DECISIONS.md`, `direction-sprint.html`, `STATE.md`, `QA-log.md`, `ASSETS.md`, `JUDGES-UI.md`.
