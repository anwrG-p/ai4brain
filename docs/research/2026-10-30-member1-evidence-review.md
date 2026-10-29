# Evidence review: Member 1 assessment tasks

*2026-10-30. Deep-research run: 105 agents searched the literature, fetched sources and adversarially checked each claim. A claim was dropped when 2 of 3 checkers refuted it.*

This review checks the **8 exercises** in `assessment_engine/` against the research literature and says what to change.

The run covered three areas:

| Area | Result |
|---|---|
| 1. Task validity | Well covered |
| 2. Browser timing | **No verified results** (see §4) |
| 3. Adaptive difficulty | **No verified results** (see §4) |

---

## 1. Verified findings and what they mean for our code

### 1.1 Stroop: a single session can't support claims about an individual (high confidence)

- Classic conflict-task *difference scores* such as the Stroop cost are a **"reliability paradox"**. The effect is robust across groups, but individuals differ too little relative to noise for the score to rank them reliably.
- Three-week test-retest ICCs:

  | Measure | ICC |
  |---|---|
  | Stroop **RT cost** | .60 / .66 |
  | Stroop **error cost** | .48 / .44 |
  | Plain condition RTs | .67–.77 |

- Sources: Hedge, Powell & Sumner 2018, *Behav Res Methods* ([PMC5990556](https://pmc.ncbi.nlm.nih.gov/articles/PMC5990556)); Kucina et al. 2023, *Nat Commun* ([link](https://www.nature.com/articles/s41467-023-37777-2.pdf)).

**What to do:**
- [ ] **Log congruency.** Add `congruent: boolean` to Stroop `trial_meta`. Today Member 3 sees only correctness and RT, so it **cannot compute the interference cost at all** without re-joining the task payload.
- [ ] **Require congruent trials.** Member 5's Stroop blocks must include both congruent and incongruent trials. Interference cost = mean RT(incongruent) − mean RT(congruent).
- [ ] **Score.** Prefer RT cost over error cost. Show it with an uncertainty band, and pool across sessions before presenting a stable profile value (this fits the dashboard's uncertainty bands).
- [ ] *Optional (medium confidence, single unreplicated study, model-based split-half):* a "double-shot" Simon-Stroop variant reached r ≈ .8 within about 50 trials. On a random third of trials it asks a second question about the irrelevant dimension. Consider it if per-user Stroop precision matters.

### 1.2 N-back: score d′ with the log-linear correction (high confidence)

- A hit or false-alarm rate of 0 or 1 makes z infinite. Apply the **log-linear rule to everyone**, not only to the extreme cases:

  ```
  H  = (hits + 0.5) / (N_signal + 1)
  FA = (FAs  + 0.5) / (N_noise  + 1)
  d' = z(H) − z(FA)
  ```

- It is less biased than the 1/(2N) rule, and its bias always goes toward underestimating d′ (conservative).
- Source: Hautus 1995, *BRMIC* 27:46–51 ([link](https://link.springer.com/content/pdf/10.3758/BF03203619.pdf)).

**What to do:**
- [ ] **Hand off to Member 3:** add this formula to `HANDOVER.md`.
- [ ] **Lure false alarms.** Our events already carry `trial_meta.trial_type`, so n−1/n+1 lure false alarms can be scored as a **separate FA class**. This is a design inference, not a verified claim.

### 1.3 Mnemonic Similarity Task: three choices, LDI scoring, longer blocks (high confidence)

- **Score with LDI** = P("similar" | lure) − P("similar" | novel foil).
- **Keep the three-choice old / similar / new prompt.** Two-choice versions lose validity (r ≈ .49–.56).
- **The optimized MST (oMST) is short.** It runs in a continuous format in about 5 min.

  | | Repeats | Lures | Foils | Trials (study-test / continuous) | r with full MST |
  |---|---|---|---|---|---|
  | oMST | 20 | 44 | 20 | 148 / 128 | .75 / .69 |
  | Full MST | | | | | test-retest .73 |

- Source: Stark, Stark & Stark 2023, *Front Behav Neurosci* ([link](https://www.frontiersin.org/journals/behavioral-neuroscience/articles/10.3389/fnbeh.2023.1080366/pdf)). The developers' own lab; no independent replication.

**What to do:**
- ✅ **Already done:** three choices, plus `kind`, `delta` and `response` logged per trial.
- [ ] **Member 5 / Member 3:** our fixture has 3 study + 5 test items, which is a demo. A real block should follow the oMST mix (≈20 repeats / 44 lures / 20 foils). Member 3 computes LDI.

### 1.4 Mental rotation: report speed reliably, slope only with enough trials (medium confidence)

- **Intercepts are fairly reliable;** they measure overall speed.
- **Angle slopes are reliable only under specific conditions:**

  | Condition | Reliability |
  |---|---|
  | Slopes per stimulus type | split-half ≤ .38 |
  | Pooled, blocked presentation | split-half .79; test-retest r = .68 / .69 (intercept / slope) |
  | Pooled, mixed presentation | split-half ≈ .2; test-retest .51 / .55 |

- About 8 trials per target × angle is probably too few. A second-hand heuristic says ≥ 50 trials per condition.
- Caveat: the source used a laterality task, not 3-D Shepard–Metzler figures ([PMC3806254](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC3806254/)).

**What to do:**
- [ ] **Log the angle.** Add `angle_deg` (and `mirrored`) to rotation `trial_meta`. Without them Member 3 cannot compute a slope at all.
- [ ] **Presentation and scoring:** ask Member 5 for blocked presentation. Treat the intercept as the main score and the slope as secondary (wide uncertainty).

### 1.5 Tower of London: follow the TOL-F protocol (high confidence)

- **TOL-F protocol:**
  - 2 two-move comprehension items and 4 three-move practice items.
  - Then **24 test problems**: 8 each at 4, 5 and 6 minimum moves, in increasing difficulty.
  - **Moves cannot be undone.**
  - **1 min per problem**, 20 min in total.
- **Reliability:** internal consistency .72–.76 (n = 7,703, ages 40–80). Test-retest reported separately; absolute-agreement ICCs only moderate.
- Source: [PMC6669988](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC6669988/).

**What to do:**
- ✅ **Already done:** our Tower has no undo.
- [ ] **Time limit:** it has no per-problem limit; only the 3 × l_min move cap ends a trial. Add a **60 s per-problem limit** (log `solved: false` on timeout). Ask Member 5 to add `time_limit_ms` to the tower contract.
- [ ] **Problem series:** a single problem per task is a demo. A calibration session should be a series graded 4 → 5 → 6 moves, with practice items first.

### 1.6 Transfer claims: product copy must stay modest (high confidence)

- Training reliably improves the **trained task**. Evidence for **near transfer** is weaker, and evidence for **far transfer** (to fluid intelligence or everyday life) is **very weak**.
- Example: working-memory training in children shows near g = 0.46 and far g = 0.12, and the effects shrink as study quality rises. The source is a meta-analysis in children, so applying it to adults is an extrapolation.
- Far-transfer claims for **n-back and SMART/RFT** training are commonly overstated.
- Sources: [APS brain-training review](https://www.psychologicalscience.org/publications/brain-training.html); [Liverpool repository](https://livrepository.liverpool.ac.uk/3006842/).

**What to do:**
- [ ] **UI copy:** only claim **improvement on the trained exercise against the user's own baseline**. When porting into `frontend/`, check its copy for "smarter", "IQ" or "transfer" claims. Its `lint:copy` already bans "IQ".

### 1.7 UFOV and dementia: the ACTIVE result is fragile (high confidence)

- ACTIVE (N = 2,802, 10-year follow-up, 260 cases): speed training gave **HR 0.71 (95% CI 0.50–0.998, p = .049)**.
- Dementia was a **secondary** outcome. Cases were defined by algorithm, **43% from self-report alone**, and the authors call for replication. Source: [Edwards et al. 2017](https://scholarworks.iupui.edu/bitstream/handle/1805/16465/main.pdf.txt).

**What to do:**
- [ ] **Never claim the UFOV exercise reduces dementia risk.** The frontend's `lint:copy` already bans the word "dementia". Keep the "Wide-Angle Focus" framing about speed only.

---

## 2. Summary: actions for the module

| # | Change | Where | Owner |
|---|---|---|---|
| 1 | Add `congruent` to Stroop `trial_meta` | `Stroop.tsx` + README table | Member 1 |
| 2 | Add `angle_deg`, `mirrored` to rotation `trial_meta` | `MentalRotation.tsx` + README | Member 1 |
| 3 | Tower 60 s per-problem limit (`time_limit_ms` in contract) | `Tower.tsx`, contract | Member 1 + 5 |
| 4 | d′ log-linear formula, LDI formula, Stroop RT-cost guidance | `HANDOVER.md` (Member 3 section) | Member 1 → 3 |
| 5 | Block design: Stroop congruent + incongruent; MST oMST mix; rotation blocked, ≥ 50/condition; TOL-F series | Task generator | Member 5 |
| 6 | Copy: trained-task improvement only; no far-transfer or dementia claims | `frontend/` copy | UI + Member 1 |

---

## 3. Commonly overstated (don't put in product copy)

- **Far transfer** from n-back or SMART/RFT to fluid intelligence.
- **UFOV prevents dementia.**
- **A single-session Stroop score as a stable trait.**
- **The original project brief's neurochemical claims.** It describes the 85% rule as triggering noradrenaline and acetylcholine release. Wilson et al. 2019 is a mathematical result about learning algorithms and contains no such claim. This point comes from the earlier review in this project; this run did not verify it.

---

## 4. Not verified in this run: open questions

No claim survived verification in these areas:

- **Browser timing:**
  - rAF frame-locking
  - `performance.now()` clamping
  - 120/144 Hz displays
  - benchmark studies (Bridges et al. 2020; Anwyl-Irvine et al. 2021)
  - `sendBeacon` / `pagehide` reliability
- **Adaptive difficulty:**
  - what Wilson et al. 2019 actually supports for humans
  - Kaernbach weighted up-down convergence
  - QUEST+ trial counts, priors and lapse/guess rates
- **Within area 1:**
  - dual-stream N-back lure density and rule-switch parameters
  - short adaptive matrix-reasoning formats
  - Stroop voice vs keypress
  - Tower counter-intuitive moves

Our current implementation in these areas (frame-locked `shown_ms`, QUEST+ for UFOV, the 85% staircase for Relational, beacon delivery) rests on standard practice, not on evidence verified here. A second, narrower research pass could cover them.

**Also do not cite:** a claim that a standard Stroop/Flanker needs about 520–614 trials for reliability was **refuted (1–2)**.
