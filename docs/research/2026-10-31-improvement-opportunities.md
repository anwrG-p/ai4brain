# Improvement opportunities: evidence review

*2026-10-31. Builds on `2026-10-30-member1-evidence-review.md` (task validity, d′, LDI, TOL-F, transfer, ACTIVE) and `2026-10-30-ui-simplification-review.md`. Those findings are not repeated here.*

**Owner labels** are modules: `frontend`, `assessment_engine`, `ai_coach`, `clustering_engine`, `brain_twin_jepa`, `dynamic_cache`, `data`, plus `docs`. Mazen owns all of them.

**Evidence strength:**
- **H**: a primary source, a meta-analysis or the text of a regulation.
- **M**: a single study, an abstract only, or a law-firm summary of a primary text.
- **J**: design judgement.

⚠ marks a source cited from memory and not re-fetched in this run.

---

## Executive summary

- **Momo is probably emotion recognition under the EU AI Act.** The Act defines biometric data to include *behavioural* characteristics and drops GDPR's identification test. Momo's "frustrated" state is an emotion; "tired" is a physical state and is excluded. Momo is **not prohibited**: Art 5(1)(f) covers only workplaces and education. Two duties follow:
  - **Art 50(3) notice:** tell people at first exposure. This duty applies from 2 Aug 2026.
  - **Keep it rule-based:** hand-written rules sit outside the "AI system" definition. A learned model would land in **Annex III 1(c) high-risk**.
  - The EMILY doc's "100% compliant, non-biometric" claim is wrong and should be corrected.
- **Behaviour-based mood inference is weak.** The best field result explains 17% of the variance (out-of-sample R² .17). It also *contradicts* EMILY: negative emotion made cursors **slower**, not jerkier. Our adaptive staircase *deliberately causes* errors, and two errors are enough to trigger a "frustrated" proposal. Momo should therefore present its mood as a guess the user can correct, and never as a reading.
- **The RCI gate is uncalibrated.** It uses rxx = .8 and sd = 10 for every pillar, with no practice correction:
  - The real Stroop-cost reliability is ≈ .6.
  - Retest gains are real and plateau after about the 3rd session.
  - Result: early "real improvement" badges will often be practice effects, not real change.
- **The baseline is far too short to score individuals.** Fixtures have 4 Stroop trials, 1 matrix item, 3 rotations and 5 MST tests. Every pillar from a first session is mostly noise. Either lengthen the blocks or show "not enough data yet".
- **The projection curve over-promises.**
  - Its α, Tmax and λ are assumptions, and the curve fits a practice effect on the trained exercises.
  - The "decay if idle" line has no evidence behind it, and it frames stopping as a loss. The EU's coming Digital Fairness Act targets exactly that kind of "penalty for disengagement".
  - Fix: drop the decay line and show the projection only from session 3.
- **Claims must stay at "practice improves these exercises".**
  - Far transfer is null in recent meta-analyses.
  - The FTC fined Lumosity ($2M, with a $50M suspended judgment) and LearningRx over exactly these claims.
  - The ACTIVE 20-year dementia signal (2026) is claims-based and limited to the speed arm. It must not appear in our copy.
- **Show uncertainty as a number range in text.** Rule 13 currently hides all uncertainty. A figure with its numeric range ("62, likely 55–69") did not reduce trust in a 5,780-person trial; verbal hedges did. Change rule 13 accordingly.
- **Loti's LLM mode needs a crisis layer before launch.**
  - Current guardrails *rewrite* "dementia" to "cognitive endurance challenge" and "disability" to "distinct cognitive modality", which hides health concerns instead of signposting help.
  - LLMs answer intermediate-risk suicide queries inconsistently.
  - If Loti counts as a companion chatbot, California SB 243 (in force 1 Jan 2026) requires a crisis protocol.
- **Engagement:** use weekly goals that can be repaired after a miss, not fragile daily streaks. Broken streaks lead people to abandon the activity. Cap and personalise notifications. Use **≤ 3 sessions/week** rather than our 4, because > 3/week showed no added benefit in a meta-analysis of older adults.
- **Accessibility:** the WCAG "essential" exception covers speeded trials, but we still owe:
  - untimed practice and a pause between trials
  - an extended-time mode, flagged in the data
  - ≥ 24 px targets
  - a three-flash check on UFOV
  - a Stroop ink set that avoids the red/green confusion

---

## 1. Measurement quality on the web

### Findings
- **Reliability is task-specific and often modest online.**
  - Online n-back (169 home participants): overall accuracy and RT indices were acceptably reliable. Per-n-level accuracy and response-bias indices were not. [Kulikowski & Potasz-Kulikowska](https://journals.pan.pl//Content/99915/PDF/06.pdf) (M)
  - Computerised Tower of London: 8-week retest coefficients were ambiguous, with strong practice effects on planning time (n = 20). [Brain Sciences 2021](https://doaj.org/article/ea9e0cd652c44b2a8f677f41461207f8) (M)
  - Difference scores (Stroop cost) reach ICC ≈ .6 (Hedge 2018, prior review).
- **Report reliability from our own data.** The standard practice is to compute split-half or retest reliability per sample rather than borrow published values. [Parsons, Kruijt & Fox 2019](https://journals.sagepub.com/doi/10.1177/2515245919879695) ⚠ (H)
- **Ways to raise reliability:**
  - more trials
  - fewer difference scores
  - hierarchical models, which shrink noisy individual estimates toward the group
  - Sources: [Zorowitz & Niv 2023](https://collaborate.princeton.edu/en/publications/improving-the-reliability-of-cognitive-task-measures-a-narrative-/) (H, abstract); hierarchical shrinkage per [Zorowitz, Karni et al. 2025](https://nivlab.princeton.edu/wp-content/uploads/sites/938/2026/01/ZorowitzKarniEtAl2025.pdf) (M)
- **Practice effects.** A meta-analysis of 122 studies (N = 153k) found significant retest gains, **with no further gain after the 3rd administration**. Gains are smaller with alternate forms and depend on the retest interval. [Scharfen et al. 2018](https://doi.org/10.1016/j.intell.2018.01.003) (H)
  - Use practice-adjusted RCI (Chelune 1993) or standardized regression-based change, not plain Jacobson-Truax. [Duff 2012](https://doi.org/10.1093/arclin/acr120) (H, abstract)
- **Browser timing:**
  - **Precision is fine** (SD under 10 ms for most platforms).
  - **Lag is larger and varies by machine,** up to about 80–100 ms. [Bridges 2020](https://peerj.com/articles/9414/); [Anwyl-Irvine 2021](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC8367876/) (H; the second has a Gorilla COI)
  - **Touchscreens and keyboards consistently overestimate RT.** [Pronk 2020](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC7280355/) (H)
  - **So:** within-device comparisons and within-task differences are safe. Comparing absolute RTs across devices is not.
- **Low effort.** Screening on task performance alone (chance-level accuracy) flagged only about 7% of participants and missed careless responders. Combining several signals works better. [Zorowitz et al. 2023, *Nat Hum Behav*](https://pmc.ncbi.nlm.nih.gov/articles/PMC11170515) (H)

### For SynapseTwin
- **The RCI is fixed for every pillar.** `rci()` in `frontend/src/features/insights/projection.ts` uses rxx = .8 and sd = 10 for all of them.
  - With those values the gate is 12.4 points.
  - At rxx = .6 it would be 17.5 points.
- **The baseline blocks are demos.** The fixtures (`frontend/src/features/assessment/tasks/fixtures.json`) are far below any stable trial count.
- **Device and input are not logged.** `TrialRecorder` (`telemetry/tracker.ts`) records neither the input device nor the browser class.
- **Stimulus onset is not frame-aligned.** In `useTimedTrials.ts`, `recorder.start()` runs in `useEffect`; UFOV already uses frame-locked `shown_ms`.

### Improvements (impact / effort)
1. **Per-input change model** (High / M). `projection.ts`, `pillars.ts`, `data`.
   - Collect retest pairs per input to estimate rxx, sd and the mean practice gain.
   - Replace the fixed defaults with a per-input table and use Chelune's practice-adjusted RCI.
   - Until that data exists: no "real improvement" before session 3, and rxx ≤ .6 for difference-score inputs.
   - Owners: `frontend` (math), `data` and `clustering_engine` (estimates).
2. **Minimum trials per input** (High / M).
   - Add `MIN_TRIALS` per input in `pillars.ts`. Below it, the input is "not enough data", not a score.
   - Lengthen blocks in the task generator. Owner: `dynamic_cache` (Member 5 payloads) and `frontend`'s `fixtures.json`.
3. **Session validity flags** (High / L). `taskScores.ts`, `useTimedTrials.ts`. Owners: `frontend`, `assessment_engine`.
   - Flag a block when any of these hold:
     - share of implausibly fast RTs (threshold J, e.g. < 150 ms)
     - accuracy at or below chance
     - runs of timeouts
     - repeated same-key responses
     - tab hidden mid-block
   - Flagged blocks are excluded from RCI and projection, and Loti suggests a retry.
4. **Log device context** (Med / L). Owners: `frontend`, `assessment_engine`.
   - Add to `trial_meta`, which needs no contract change:
     - `input_kind` (touch / mouse / key)
     - a coarse browser and OS class
     - estimated refresh rate
   - Compare a user only against sessions on the same device class.
5. **Frame-align onset** (Med / L). Start the RT clock in the first rAF after the stimulus paints, mirroring UFOV's `frames.ts`. Owner: `frontend` (`useTimedTrials.ts`).
6. **Hierarchical scoring server-side** (Med / H). Shrink individual estimates toward the population, then send them back as the pillar source (spec R5 "Member 3 can replace"). Owner: `clustering_engine` / `brain_twin_jepa`.

---

## 2. Communicating scores to laypeople

### Findings
- **Numeric ranges keep trust; verbal hedges cost it.**
  - In 5 experiments (N = 5,780, including a BBC field test), showing a number as an estimate with its numerical range barely reduced trust.
  - Verbal uncertainty reduced trust more.
  - Source: [van der Bles et al. 2020, PNAS](https://doi.org/10.1073/pnas.1913678117) (H)
  - Frequency displays such as quantile dotplots also help lay users judge uncertainty. [Kay et al. CHI 2016](https://doi.org/10.1145/2858036.2858558) ⚠ (M)
- **FTC precedent:**
  - **Lumos Labs (2016):** claims of better performance at work and school, and of delaying age-related decline, were unsubstantiated. $2M paid, $50M judgment suspended, and future claims need "competent and reliable scientific evidence". [FTC](https://www.ftc.gov/news-events/news/press-releases/2016/01/lumosity-pay-2-million-settle-ftc-deceptive-advertising-charges-its-brain-training-program) (H)
  - **LearningRx (2016):** claims about ADHD, autism, dementia, stroke and TBI. $200k paid, and RCTs are required for future claims. [FTC](https://www.ftc.gov/news-events/news/press-releases/2016/05/marketers-one-one-brain-training-programs-settle-ftc-charges) (H)
  - **FTC Health Products Compliance Guidance (2022):** covers apps. RCTs are expected for health benefit claims, and anecdotes or observational data do not suffice. [FTC](https://www.ftc.gov/business-guidance/resources/health-products-compliance-guidance) (H; summaries read)
- **FDA (Jan 2026):** the general wellness policy keeps its two-factor test: wellness-only intent and low risk. Any diagnostic or clinical claim exits the policy. [FDA guidance](https://www.fda.gov/media/90652/download) (M, via law-firm summaries)
- **Norms:** we have no representative norm sample, so any "better than X% of people" figure would be invented (J). It would also break anti-slop rule 12.

### For SynapseTwin
- Rule 13 hides all uncertainty by default. That conflicts with the best evidence, which is a short numeric range.
- `pillarScores()` already computes `uncertainty`.

### Improvements
1. **Show the range in text** (Med / L).
   - Show the pillar as "62 · likely 55–69": one line, no band graphics by default.
   - For n < `MIN_TRIALS`, show "Building your profile" instead of a number.
   - Code: `frontend/src/features/insights/PillarRadar.tsx`, `pages/ResultsPage.tsx`, `pages/DashboardPage.tsx`.
   - Spec: amend `.scratch/brand-v2/spec.md` rule 13. Owner: `frontend`.
2. **Self-comparison only** (High / L).
   - No percentiles and no "vs others".
   - Legacy pages (`DimensionDetailPage`, `ProfileRevealPage`, `AiCoachPage`, `LayerDPage`) still carry "+12% Percentile" and "Weekly Progress Boost" copy, which fails rule 12. They are already in ticket 09's cleanup scope.
   - Owner: `frontend`.
3. **Extend the copy lint** (High / L). `frontend/src/utils/copyLinter.ts`. Owner: `frontend`.
   - Ban: "percentile", "smarter", "IQ", "boost", "younger brain", "neuroplastic", "prevent", "delay decline", "clinically", "proven".
   - Also ban "better than … %" patterns.

---

## 3. Training efficacy: what copy and the curve may promise

### Findings
- **Far transfer is null.** Recent meta-analyses give a "crystal-clear" conclusion that far transfer is null once study quality and artefacts are accounted for. [Gobet & Sala 2023](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC9903001/) (H)
- **Only the practised tasks improve.** People improve on practised tasks, but broad real-world benefit is "premature at best". [Simons et al. 2016, PSPI](https://doi.org/10.1177/1529100616661983) (H)
- **The older-adult meta-analysis (healthy older adults only):** [Lampit et al. 2014](https://journals.plos.org/plosmedicine/article?id=10.1371/journal.pmed.1001756) (H)
  - Small effect on untrained tests, g = 0.22.
  - **Home-based training was not effective; supervised group training was.**
  - **> 3 sessions/week was not effective.**
  - No evidence for working-memory training.
- **ACTIVE at 20 years (2026):**
  - Speed training with boosters was linked to fewer **claims-based** dementia diagnoses (40% vs 49%).
  - Memory and reasoning arms showed nothing.
  - Medicare Advantage enrolees were excluded.
  - Source: [Coe et al. 2026](https://doi.org/10.1002/trc2.70197) (M, read via news and a PDF summary)
  - This is a signal, not a consumer claim. LearningRx shows how such claims draw enforcement.

### For SynapseTwin
- **The projection measures practice.** It is an asymptotic fit to scores on the same exercises, so it measures practice on those exercises, not cognition.
- **Session targets exceed the evidence.**
  - `SESSIONS_PER_WEEK = 4` (`projection.ts`) and `WEEKLY_TARGET = 4` (`loti/scriptedBrain.ts`) both exceed Lampit's effective range.
  - We are home-based, the weakest delivery mode.
- **The decay line has no basis.** `lambda = 0.1/day` comes from no source. Showing a loss curve is both a claim and a disengagement penalty (§4).

### Improvements
1. **Drop the decay series from the UI** (High / L).
   - Keep `decay` in code only if a source for it is found.
   - Show the optimal projection only from session 3, where `fitAlpha` stops using its fallback.
   - Label it "If you keep practising, your scores on these exercises may reach about …".
   - Code: `projection.ts`, `DashboardPage.tsx`. Owner: `frontend`.
2. **Set the weekly target to 3** (Med / L). Change `SESSIONS_PER_WEEK` and `WEEKLY_TARGET` to 3. Owner: `frontend`.
3. **Fix the forecast ribbons and the coach disclaimer** (High / L).
   - Any `brain_twin_jepa` "Predictive Trajectory Ribbons" carry the same constraint: exercise scores only, shown with a range.
   - `ai_coach/safety_guardrails.py` `DISCLAIMER_TEXT` invokes "neuroplasticity principles". Cut it.
   - Owners: `brain_twin_jepa`, `ai_coach`.

---

## 4. Engagement without dark patterns

### Findings
- **Streaks:**
  - Showing an unbroken streak raises engagement.
  - **A broken streak drives abandonment;** language learners switched languages rather than restart.
  - The effect is weaker when the streak can be repaired.
  - Messages that highlight a failure "typically don't work".
  - Source: [Silverman & Barasch 2023, JCR](https://doi.org/10.1093/jcr/ucac029) (H, abstract)
- **Gamification and SDT:**
  - Small effect on intrinsic motivation (g ≈ 0.26).
  - It helps autonomy and relatedness but barely helps competence.
  - Source: [2024 meta-analysis, ETR&D](https://link.springer.com/article/10.1007/s11423-023-10337-7) (M)
- **Notifications:**
  - Duolingo's reminder bandit adds a **recency penalty** because novelty inflates short-term response.
  - The reward is a lesson completed within 2 hours, not opens.
  - Source: [Yancey & Settles, KDD 2020](https://research.duolingo.com/papers/yancey.kdd20.pdf) (H)
- **Characters:**
  - Pedagogical agents have a small positive effect on learning, larger with on-screen text than narration. [Schroeder et al. 2013](https://doi.org/10.2190/EC.49.1.a) (M)
  - Companion apps used manipulative farewells (FOMO, guilt) in roughly 37–43% of goodbyes. A wellness-focused app used none. [De Freitas et al. 2025](https://arxiv.org/abs/2508.19258) (M)
- **Regulation:**
  - The EU Digital Fairness Act consultation names "penalties for disengagement" as addictive design. A proposal is expected in Q3/Q4 2026.
  - DSA Art 25 already bans dark patterns on online platforms.
  - Source: [Sidley summary](https://datamatters.sidley.com/2025/08/01/eu-consults-on-digital-fairness-act-big-changes-ahead-for-consumer-facing-platforms/) (M)

### Improvements
1. **Weekly goals that can be repaired** (Med / L).
   - Use "3 this week" with one built-in skip.
   - No daily streak counter and no "you broke your streak" copy.
   - Code: `components/features/goals/HabitContractCard.tsx`, `DashboardPage.tsx` streak header. Owner: `frontend`.
2. **Loti leave-taking rule** (High / L).
   - When the user dismisses Loti, there is no follow-up guilt, FOMO or "wait" bubble.
   - Encode this as a test in `features/loti/scriptedBrain.test.ts`, and as a system-prompt rule for the LLM.
   - Owners: `frontend`, `ai_coach`.
3. **Notifications, when built** (Med / M).
   - Opt-in after the first completed session, never on first visit.
   - At most 1 per day with a recency penalty.
   - Success measure: a session completed within 2 hours.
   - Copy is never guilt-based.
   - Owners: `frontend`, `ai_coach`.
4. **Keep characters event-driven** (Low / L). This is already rules R8 and 10; no change needed.

---

## 5. Emotion inference, AI Act and GDPR

### Findings
- **Validity is limited:**
  - Cursor distance and speed predicted self-reported negative emotion with **out-of-sample R² = .17** (n = 80 field study).
  - **Negative emotion made cursors slower and longer-pathed.** Source: [Hibbeln et al. 2017, MISQ](https://doi.org/10.25300/MISQ/2017/41.1.01) (H, abstract)
  - Reviews of keystroke and mouse affect detection report high accuracy mostly from lab and in-sample data. Per-user models beat universal ones. [Yang & Qin 2021, IEEE Access](https://doaj.org/article/89b0c57f14a448028f90df1d066a692d) (M)
  - The broader caution: behaviour does not map one-to-one onto emotion. [Barrett et al. 2019, PSPI](https://doi.org/10.1177/1529100619832930) (H)
  - "Anti-red lowers cortisol" in the EMILY doc has no support. Colour-psychology effects are largely unreplicated. [Elliot 2015](https://doi.org/10.3389/fpsyg.2015.00368) ⚠ (M)
- **The EU AI Act** ([Regulation 2024/1689](https://eur-lex.europa.eu/eli/reg/2024/1689/oj)) (H):
  - **Art 3(34), Recital 14:** biometric data covers "physical, physiological or *behavioural* characteristics". Identification is one possible use, not a condition of the definition. [Recital 14](https://artificialintelligenceact.eu/recital/14/)
  - **Art 3(39), Recital 18:** emotion recognition means inferring emotions from biometric data, and it **excludes physical states such as pain or fatigue**. [Recital 18](https://artificialintelligenceact.eu/recital/18/)
  - **Art 5(1)(f):** the ban covers workplace and education only, except for medical or safety uses. A general wellbeing purpose is not exempt. [Commission guidelines, Feb 2025](https://digital-strategy.ec.europa.eu/en/library/commission-publishes-guidelines-prohibited-artificial-intelligence-ai-practices-defined-ai-act)
  - **Art 50(3):** deployers of emotion recognition must inform the people exposed, at the latest at first exposure. It applies from **2 Aug 2026**. [Art 50](https://artificialintelligenceact.eu/article/50/)
  - **Annex III 1(c):** "AI systems intended to be used for emotion recognition" are **high-risk**. [Annex III](https://artificialintelligenceact.eu/annex/3/)
    - The Digital Omnibus moves Annex III obligations to **2 Dec 2027**. [DLA Piper](https://knowledge.dlapiper.com/dlapiperknowledge/globalemploymentlatestdevelopments/2026/The-Digital-AI-Omnibus-Proposed-deferral-of-high-risk-AI-obligations-under-the-AI-Act) (M)
  - **Recital 12:** systems "based on the rules defined solely by natural persons" are not AI systems. [Recital 12](https://artificialintelligenceact.eu/recital/12/)
- **GDPR and ePrivacy:**
  - Health data is special-category data (Art 9) and needs **explicit** consent ([GDPR](https://eur-lex.europa.eu/eli/reg/2016/679/oj)). Withdrawing consent must be as easy as giving it (Art 7(3)).
  - The ICO treats *inferences* used to treat people differently as special-category data. [ICO](https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/lawful-basis/special-category-data/what-is-special-category-data) (H)
  - The CJEU reads "health data" broadly (C-21/23, Lindenapotheke, 2024) ⚠.
  - Processing that stays entirely on the device, with nothing leaving it, falls outside ePrivacy Art 5(3). [EDPB Guidelines 2/2023](https://www.edpb.europa.eu/documents/guideline/guidelines-22023-on-technical-scope-of-art-53-of-eprivacy-directive_en) (M, via summary)

### For SynapseTwin
- **Momo is likely emotion recognition, not banned:**
  - `useEmilyStore` / `utils/emilyEngine.ts` infer *frustrated* and *hesitant* (emotions) from pointer kinematics (behavioural data).
  - So Momo is likely an emotion recognition *function*.
  - It is **not banned**: consumer use, not workplace or education.
  - It is **not an "AI system" while its rules stay hand-written** (Recital 12).
  - The Art 50(3) notice is cheap insurance either way.
- **The risk sits on the server.** `hesitation_jitter` and `keystroke_latency_ms` *are sent* to the server in telemetry. If `brain_twin_jepa` learns affect from them, that is ML-based emotion recognition: Annex III high-risk, and special-category data.
- **Our own tasks trigger the "frustrated" flag.** The strain trigger `consecutiveErrors >= 2` fires in normal play under an 85%-accuracy staircase.

### Improvements
1. **Momo is a guess the user owns** (High / L).
   - Explain it on first show: "Momo guesses your mood from how you tap. Tap to change it." This is the Art 50(3) notice.
   - Inference is opt-in in You → Privacy, runs on the device only, and labels are never sent.
   - Momo only *proposes* "frustrated"; the existing approval flow covers this.
   - Remove `autoAdapt`, or default it off forever.
   - Code: `components/features/characters/Momo.tsx`, `components/common/EmilyMoodPill.tsx`, `state/useEmilyStore.ts`, `pages/PrivacyPage.tsx`. Owner: `frontend`.
2. **Do not count staircase errors as strain** (Med / L). Either raise the error threshold or ignore errors inside adaptive blocks. `useEmilyStore.ts`. Owner: `frontend`.
3. **No affect models on telemetry** (High / L, a policy). Write it down as an ADR in `docs/adr/`: `brain_twin_jepa` and `clustering_engine` must not infer emotion from `hesitation_jitter` or keystroke data. Owners: `brain_twin_jepa`, `docs`.
4. **Fix the EMILY doc** (Med / L). Remove "100% compliant with Art 5(1)(f) non-biometric" and the cortisol and "parasympathetic" claims. State the legal position above. `docs/architecture/EMILY_BEHAVIORAL_EMOTION_ENGINE.md`. Owner: `docs`.
5. **Explicit, separate consent plus a DPIA** (High / M).
   - At login (R3), use separate toggles with equal weight:
     - "Save my results to my account" (scores, possibly health data, so explicit)
     - "Help improve the exercises" (telemetry)
   - Keep the existing Withdraw on the Privacy page.
   - Write a DPIA and a retention period for `data/raw/telemetry/*.jsonl`.
   - Code: `features/flow/LoginSheet.tsx`, `telemetry/tracker.ts` (per-purpose consent), `assessment_engine/api/routes/telemetry.py` (retention).
   - Owners: `frontend`, `assessment_engine`, `data`.

---

## 6. Accessibility of timed tasks

### Findings
- **Timing (SC 2.2.1).** It allows time limits only under the Real-time, **Essential** ("extending it would invalidate the activity") or 20-hour exceptions. The Understanding doc does not single out tests. [W3C](https://www.w3.org/WAI/WCAG22/Understanding/timing-adjustable.html) (H)
  - **Speeded trials fit the essential exception.** Instructions, practice and end cards do not.
- **Other WCAG criteria:**
  - **Three flashes (SC 2.3.1):** nothing may flash more than 3 times per second above threshold. [W3C](https://www.w3.org/WAI/WCAG22/Understanding/three-flashes-or-below-threshold.html) ⚠ (H)
  - **Target size (SC 2.5.8):** targets ≥ 24 × 24 CSS px. [W3C](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html) ⚠ (H)
  - **Use of colour (SC 1.4.1):** never colour alone. [W3C](https://www.w3.org/WAI/WCAG22/Understanding/use-of-color.html) ⚠ (H)
  - **Animation from interactions (SC 2.3.3):** motion triggered by interaction can be disabled. [W3C](https://www.w3.org/WAI/WCAG22/Understanding/animation-from-interactions.html) ⚠ (H)
- **Stroop and colour vision.** In 821 adults aged ≥ 53, red/green colour weakness slowed **colour naming** but not the word or interference cards. The authors advise considering visual status when reading Stroop scores. [Maastricht study](https://cris.maastrichtuniversity.nl/en/publications/visual-determinants-of-reduced-performance-on-the-stroop-color-wo/) (M)

### For SynapseTwin
- **Stroop inks:** `Stroop.tsx` uses red, green, blue and yellow, and red/green is the CVD-confusable pair. Button labels already name the colour, which satisfies 1.4.1 for the *controls* but not for the stimulus.
- **Already done:** reduced motion (`styles/*.css`) and keyboard keys 1–n.

### Improvements
1. **CVD-safe ink set** (Med / L).
   - Use blue, yellow/orange, red and black/ink. These differ in luminance, and there is no red/green pair.
   - Ask a one-tap "Can you tell these apart?" before the first Stroop. If not, offer a word-free variant or skip Stroop; it is not in the baseline.
   - Code: `Stroop.tsx` `INK`, `dynamic_cache` colour list, `token-metadata.ts` contrast pairs. Owners: `frontend`, `dynamic_cache`.
2. **Accessible timing** (Med / M). Owners: `frontend`, `assessment_engine`.
   - Untimed practice items and a self-paced "Ready" between blocks.
   - An **"Extra time" mode** that multiplies limits by 1.5–2×. It is logged as `trial_meta.accommodation`, and scores are compared only within the same mode.
   - Code: `ExerciseFrame.tsx`, `useTimedTrials.ts`, `Tower.tsx`.
3. **Flash audit** (Med / L). Check the UFOV mask, n-back and MST with a PEAT-style check, and cap full-field luminance flips. Code: `Ufov.tsx`, `NBack.tsx`. Owner: `frontend`.
4. **Target sizes** (Low / L). Assert ≥ 24 px on all answer controls in the e2e axe and overflow suite (spec "Constraints"). Owner: `frontend`.

---

## 7. LLM coach safety (Loti)

### Findings
- **APA health advisory (Nov 2025):** chatbots and wellness apps must not replace treatment. Their ability to guide someone in crisis is "limited and unpredictable". [APA](https://www.apa.org/topics/artificial-intelligence-machine-learning/health-advisory-chatbots-wellness-apps) (H)
- **LLM handling of suicide queries:** handled well at the very-low and very-high risk extremes, **inconsistently at intermediate risk**, and some answered lethality questions. [McBain et al. 2025, *Psychiatric Services*](https://alert.psychnews.org/2025/08/chatbots-offer-inconsistent-answers-to.html) (M; 2024 model versions)
- **California SB 243** (in force 1 Jan 2026):
  - Companion chatbots must keep a suicide and self-harm protocol with crisis referrals, publish it, and disclose AI.
  - Annual reports start in 2027.
  - It includes a private right of action.
  - Source: [Skadden](https://www.skadden.com/insights/publications/2025/10/new-california-companion-chatbot-law) (M)
  - A chat that asks "How was your day?" and builds a relationship may fall in scope once it is LLM-backed.
- **EU AI Act Art 50(1):** people must be told they are interacting with an AI. [Art 50](https://artificialintelligenceact.eu/article/50/) (H)
- **FTC 6(b) study (Sep 2025):** the FTC ordered 7 companion-bot firms to report how they test for harms and protect minors. [DLA Piper](https://www.dlapiper.com/en/insights/publications/2025/09/ftc-ai-chatbots) (M)
- **NIST AI 600-1** lists **confabulation** among 12 generative-AI risks, with Measure and Manage actions. [NIST](https://doi.org/10.6028/NIST.AI.600-1) (H)

### For SynapseTwin
- **The guardrails euphemise instead of escalating.** `ai_coach/safety_guardrails.py` silently *rewrites* clinical words:
  - "dementia" → "cognitive endurance challenge"
  - "disability" → "distinct cognitive modality"
  - "brain injury" → "adaptive neural restructuring"
  - A user asking about real symptoms gets euphemism instead of "talk to a doctor".
- **There is no crisis detection anywhere,** in either `ai_coach/` or `features/loti/`.
- **Fallback is silent.** `ai_coach/agent.py` swallows LLM exceptions (`except Exception: pass`).

### Improvements
1. **Crisis layer before any LLM call** (High / M). Owners: `ai_coach`, `frontend`.
   - A deterministic classifier, with a small LLM classifier as backup, runs on every user message.
   - On a hit, a **fixed, scripted** reply goes out with locale hotlines (e.g. 988 US, 3114 FR, 116 123 EU), and the LLM is never consulted.
   - The same scripted node goes in `features/loti/scriptedBrain.ts` for free-text input.
2. **Signpost, don't euphemise** (High / L).
   - Replace the rewrite map with:
     - **(a)** never *generate* diagnostic labels
     - **(b)** if the *user* raises symptoms or a diagnosis, reply "I can't assess health. A doctor can.", plus a link
   - Code: `ai_coach/safety_guardrails.py`. Owner: `ai_coach`.
3. **Constrained generation** (High / M). Owners: `ai_coach`, `frontend`.
   - The LLM only rephrases or chooses among scripted intents and data the user has seen (already the rule in `coachAdapter.ts`).
   - Numbers come only from `pillarScores()`. Reject any output containing a number not present in the context.
   - The 14-word cap and banned-term lint apply to its output too.
4. **Evaluation before launch** (High / M). A versioned red-team set in `ai_coach/tests/` covers:
   - suicide queries graded by risk level, including intermediate
   - medical and diagnostic questions
   - requests for supplements or medication
   - manipulation on goodbye (§4)
   - hallucinated scores
   - minors
   - Gate: 100% correct crisis routing, 0 diagnostic labels, 0 invented numbers. Re-run on every model or prompt change.
   - Owner: `ai_coach`.
5. **Disclosure** (Med / L). Show "Loti is an AI guide, not a person or clinician" on first LLM use, and publish the crisis protocol on the "How we calculate this" / You page. Owner: `frontend`.
6. **Log fallbacks** (Low / L). Log every swallowed LLM failure and count it. Code: `ai_coach/agent.py`. Owner: `ai_coach`.

---

## Top-10 backlog

| # | Change | Where | Module | Impact | Effort | Evidence |
|---|---|---|---|---|---|---|
| 1 | Crisis layer, plus signposting instead of euphemism, before any LLM Loti | `ai_coach/safety_guardrails.py`, `agent.py`, `features/loti/scriptedBrain.ts` | ai_coach, frontend | High | M | H (APA, SB 243), M (McBain) |
| 2 | Calibrated, practice-adjusted RCI; no "real improvement" before session 3 | `features/insights/projection.ts`, `pillars.ts`; retest estimates | frontend, data, clustering_engine | High | M | H (Scharfen, Duff, Hedge) |
| 3 | Minimum trials per input, longer baseline blocks, "Building your profile" below the minimum | `pillars.ts`, `tasks/fixtures.json`, task generator | frontend, dynamic_cache | High | M | H (Hedge, Zorowitz & Niv) |
| 4 | Drop the decay line; projection only from session 3, worded as "on these exercises" | `projection.ts`, `pages/DashboardPage.tsx` | frontend | High | L | H (Gobet & Sala, Simons), M (DFA) |
| 5 | Momo as a correctable guess: Art 50(3) notice, opt-in, on-device only, `autoAdapt` off | `Momo.tsx`, `useEmilyStore.ts`, `PrivacyPage.tsx` | frontend | High | L | H (AI Act text), H (Hibbeln) |
| 6 | Explicit per-purpose consent, DPIA, telemetry retention | `flow/LoginSheet.tsx`, `telemetry/tracker.ts`, `api/routes/telemetry.py`, `data/raw` | frontend, assessment_engine, data | High | M | H (GDPR, ICO) |
| 7 | Session validity flags (fast RTs, chance, timeouts, hidden tab) plus device and input logging | `taskScores.ts`, `useTimedTrials.ts`, `tracker.ts` | frontend, assessment_engine | High | L | H (Zorowitz 2023, Pronk, Bridges) |
| 8 | ADR: no emotion inference from telemetry server-side; fix the EMILY doc | `docs/adr/`, `docs/architecture/EMILY_…md` | brain_twin_jepa, docs | High | L | H (Annex III, Art 3(34)) |
| 9 | Numeric range in text ("62 · likely 55–69"); amend rule 13; no percentiles; extend the copy lint | `PillarRadar.tsx`, `ResultsPage.tsx`, `utils/copyLinter.ts`, spec | frontend | Med | L | H (van der Bles, FTC) |
| 10 | Repairable weekly goal of 3 instead of streaks; no-guilt leave-taking; CVD-safe Stroop inks | `HabitContractCard.tsx`, `scriptedBrain.ts`, `projection.ts`, `Stroop.tsx` | frontend, dynamic_cache | Med | L | H (Silverman & Barasch, Lampit), M (CVD) |

Next in line:
- frame-aligned onset
- extra-time mode
- flash audit
- LLM eval suite gate
- hierarchical server scoring

---

## Copy and claims we must NOT make

- **No transfer claims.** Never claim improvement *outside the exercises*: work, school, everyday memory, IQ, "smarter", "sharper mind". (Simons 2016; Gobet & Sala 2023; FTC v. Lumos)
- **No disease claims.** Nothing about preventing, delaying or reducing the risk of dementia, Alzheimer's or "cognitive decline", including citing ACTIVE. (FTC v. LearningRx; Coe 2026 is claims-based)
- **No clinical language.** Nothing that treats, helps or screens for ADHD, autism, depression, anxiety, stroke or concussion. No "clinically proven", "scientifically proven" or "doctor-approved".
- **No overstated measurement.** No "your brain age", "neuroplastic gain", "rewire" or "neurochemical". No regions or chemicals (U5).
- **No social comparison.** No percentiles, "better than X% of people", or "above average": we have no norm sample.
- **No unearned improvement claims.** No "real improvement" or "verified progress" before the calibrated RCI gate (#2) and at least 3 sessions.
- **No promises from the curve.** No forecasts like "you'll reach 85 in 30 days". Say "may reach about … on these exercises if you keep practising".
- **No penalty framing.** No decay or loss threats: "you'll lose your progress", "your streak is about to die", guilt or FOMO from Loti or notifications.
- **No false certainty about mood or privacy.** Never "Momo knows how you feel" or "we detect your emotions"; say "Momo guesses, and you can correct it". Never "100% non-biometric" or "no emotion recognition".
- **No calming claims.** No "lowers cortisol", "calms your nervous system" or "reduces stress" for colours or features.
- **No human or professional coach.** Never present Loti as a therapist, coach credentialed in health, or a human.
