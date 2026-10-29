# Cognitive Tasks, Dimension Registry & Measurement Bias Mitigations

> **CISTAC 1.0 (AI4Brain Challenge)** — Layer A Assessment Engine & Psychometric Specifications  
> **Source of Truth**: `frontend/src/config/dimensions.ts` · `frontend/src/types/index.ts` · `assessment_engine/`

---

## 1. The 6 Canonical Cognitive Skills & Task Specifications

To deliver continuous, non-clinical cognitive evaluation without user exhaustion, the platform implements 6 core cognitive tasks, adapting difficulty via client-side psychometric staircases:

```
┌──────────────────────────────────────────────────────────────────────────────────┐
│                             6 CORE COGNITIVE SKILLS                              │
├────────────────────┬────────────────────┬───────────────────┬────────────────────┤
│ 1. Working Memory  │ 2. Inhibition &    │ 3. Pattern &      │ 4. Visuospatial    │
│    (Dual N-Back)   │    Flexibility     │    Relational     │    Planning        │
│                    │    (Stroop)        │    (Matrix & Hop) │    (Tower)         │
├────────────────────┴────────────────────┼───────────────────┴────────────────────┤
│ 5. Perceptual Speed & Divided Attention │ 6. Episodic Pattern Separation         │
│    (UFOV with QUEST+)                   │    (Mnemonic Similarity / MST)         │
└─────────────────────────────────────────┴────────────────────────────────────────┘
```

### Cognitive Tasks & Measurement Matrix

| # | Consumer Skill Name (Internal ID) | Everyday Construct Definition | Interactive Browser Task & Difficulty Levers | Captured Signals (tracker.ts + EMILY) | Scoring & Clarity Method | Documented Biases & Technical Mitigations |
| :-: | :--- | :--- | :--- | :--- | :--- | :--- |
| 1 | **Working Memory** (`working_memory`) | Holding and updating visual patterns in active focus over short intervals. | **Spatial Grid Recall ($N$-Back)**: Track glowing tokens on a $3 \times 3$ grid across $N \in \{1, 2, 3\}$ steps back; presentation window scales from $2500\text{ ms}$ to $1200\text{ ms}$. | Hit accuracy, false-alarm rate, `rt_ms`, hover hesitation ($\tau_{\text{hover}}$), click dwell ($\tau_{\text{click}}$). | Bayesian state update mapped to $0\text{–}100\%$ with $\pm 95\%$ Clarity Range halo. | **Memorization bias**: Procedural seed shuffling rotates grid patterns every session. |
| 2 | **Pattern Discovery** (`pattern_induction`) | Spotting underlying visual rules and completing sequences without words. | **Visual Matrix Flow**: Complete a $3 \times 3$ geometric grid by identifying $1\text{–}3$ interacting visual rules (rotation, shape, fill). | Solution accuracy, deliberation time (`rt_ms`), direction flips ($N_{\text{flip}}$) across options. | Item-difficulty weighted mastery score + clarity band. | **Language/education bias**: 100% non-verbal geometric shapes requiring zero reading or math. |
| 3 | **Focus & Rule-Switching** (`executive_function`) | Resisting visual distractions and smoothly shifting between changing rules. | **Colorblind-Safe Shape Switch**: Match cards by Shape or Pattern as cues switch; distractor congruence scales dynamically. | Rule-switch latency cost ($\Delta\text{RT}$), error bursts, rage-click count ($R_{\text{click}}$), cursor jerk ($j$). | Composite of switch accuracy ($65\%$) and pacing stability ($35\%$). | **Color vision & hardware lag**: Uses Okabe-Ito shapes/patterns + subtracts baseline device tap lag. |
| 4 | **Spatial Orientation** (`spatial_orientation`) | Mentally rotating shapes and tracking perspectives in 2D/3D space. | **Mental Perspective Match**: Identify which rotated geometric figure matches the target reference under varying angles ($30^\circ\text{–}150^\circ$). | Angular accuracy slope, `rt_ms`, path directness ($R_{\text{path}} = 1/\kappa$). | Confidence-weighted percentage score with decay on long idle pauses. | **Motor speed bias**: Separates deliberation movement onset from click execution time. |
| 5 | **Visual Memory Clarity** (`episodic_pattern`) | Distinguishing familiar visual items from very similar look-alikes. | **Old / Similar / New Flow**: Classify illustrated tokens as Old, Similar, or New as visual lure similarity increases. | Lure discrimination index, response consistency, hesitation pauses ($\tau_{\text{hover}}$). | Bayesian precision update; hatched clarity band shown until $\ge 6$ lure trials logged. | **Fatigue bias**: Capped at 4 rapid trials per micro-block with streak-protected rest mode. |
| 6 | **Processing Rhythm** (`processing_speed`) | Steady, calm perceptual encoding speed without rushing into errors. | **Symbol-Key Pairing**: Match 6 abstract glyphs to keys 1–6 using a randomized key legend each round. | Rate-correct score (correct matches per $30\text{ s}$), velocity variance ($v$), pacing drift. | Sigmoid-normalized rate-correct percentage $\pm$ variance halo. | **Keyboard vs. touch bias**: Normalizes against the user's own device class and initial warm-up. |

### 1.1 Working Memory: Dual-Stream Spatial & Symbolic N-Back
- **Scientific Foundation**: Assesses updating and maintenance in transient memory while resisting proactive interference.
- **Task Dynamics**: $3 \times 3$ grid with simultaneous spatial positions and symbolic glyphs. Employs rule-switching cues (`position` vs `symbol` vs `parity`) and targeted lure trials ($N-1$, $N+1$).
- **Scoring & Adaptation**: Weighted staircase targeting 85% accuracy. Computes $d'$ sensitivity index across lure false-alarm rates.
- **Backend Key**: `working_memory` · Schema: `n_back`.

### 1.2 Inhibition Control & Cognitive Flexibility: Stroop & Rule-Switch
- **Scientific Foundation**: Assesses voluntary suppression of prepotent automatic responses and swift mental set-shifting.
- **Task Dynamics**: Congruent, incongruent, and neutral color-word stimuli. Fast-paced blocks with dynamic stimulus-onset asynchrony (SOA).
- **Scoring & Adaptation**: Interference cost calculated as $\Delta\text{RT} = \text{RT}_{\text{incongruent}} - \text{RT}_{\text{congruent}}$ and error burst frequency.
- **Backend Key**: `executive_function` · Schema: `stroop`.

### 1.3 Pattern Induction & Relational Reasoning: Progressive Matrix & Multi-Hop
- **Scientific Foundation**: Evaluates fluid intelligence ($G_f$), inductive pattern extraction, and transitive relational inference without verbal requirements.
- **Task Dynamics**: 9-cell abstract geometric grids with rotational, numerosity, and shape progression rules; multi-hop premise verification ($A > B, B > C \implies A > C$).
- **Scoring & Adaptation**: Accuracy norm $\in [0, 1]$, latency-to-first-click, and counter-intuitive premise validation.
- **Backend Key**: `pattern_induction` · Schemas: `matrix`, `relational`.

### 1.4 Visuospatial Planning & Mental Rotation: Tower of London & Rotated Polygons
- **Scientific Foundation**: Measures look-ahead problem solving, sub-goal generation, and mental coordinate manipulation.
- **Task Dynamics**: Constrained peg movement puzzles with minimum move paths ($l_{\text{min}}$) and 2D/3D polygon angle matching ($0^\circ\text{–}180^\circ$).
- **Scoring & Adaptation**: Optimality ratio $\text{Score} = \min(1, l_{\text{min}} / l_{\text{user}})$, pre-movement planning latency, and conflict latency before counter-intuitive moves.
- **Backend Key**: `spatial_orientation` · Schemas: `tower`, `mental_rotation`.

### 1.5 Divided Attention & Perceptual Speed: Useful Field of View (UFOV)
- **Scientific Foundation**: Quantifies the visual field area over which information can be extracted in a single brief tachistoscopic glance.
- **Task Dynamics**: Central vehicle identification paired with simultaneous peripheral target localization ($0^\circ\text{–}315^\circ$ across 8 radial coordinates) amidst distractor clutter.
- **Scoring & Adaptation**: **QUEST+ Bayesian Staircase** directly estimates display duration thresholds ($\text{ms}$) rather than holding accuracy at 85%. Logs whole-frame-measured `shown_ms`.
- **Backend Key**: `processing_speed` · Schema: `ufov`.

### 1.6 Episodic Pattern Separation: Mnemonic Similarity Task (MST)
- **Scientific Foundation**: Assesses hippocampal dentate gyrus pattern separation by measuring the ability to distinguish exact repeats from visually similar lure items.
- **Task Dynamics**: Rapid encoding phase of complex irregular polygons followed by surprise discrimination testing: `old`, `similar` (perturbed polygon vertex $\Delta$), or `new`.
- **Scoring & Adaptation**: Lure Discrimination Index ($\text{LDI} = P(\text{"Similar"} \mid \text{Lure}) - P(\text{"Similar"} \mid \text{New})$).
- **Backend Key**: `episodic_memory` · Schema: `mst`.

---

## 2. Config-Driven Dimension Registry (`DimensionRegistry`)

To prove **Generalisation (10% evaluation rubric)**, SynapseTwin decouples UI rendering from hardcoded dimension counts. The active system can be switched in real time across 5 architectural presets:

| Preset Key | Dimension Count | Intended Rubric Verification | Primary Slot Mappings |
| :--- | :---: | :--- | :--- |
| **`3-minimal`** | 3 | Stress-test minimal polygon rendering on Uncertainty Radar | Memory, Inhibition, Speed |
| **`6-intake`** | 6 | 1:1 match with Member 1 Backend & Intake specification | WM, IC, CF, AN, PS, Reason |
| **`7-team-default`** | 7 | Canonical Section 3 Team Plan default architecture | WM, IC, CF, AN, PS, EP, VP |
| **`8-extended`** | 8 | Generalization test with extra dashed geometry cross | 7 Dims + Metacognitive Auditing |
| **`10-full-generalisation`** | 10 | Evaluator stress-test for Phase 2 surprise requirements | 7 Dims + Surprise Slots 8, 9, 10 |

---

## 3. Comprehensive Measurement Bias Mitigations

Every cognitive psychometric measurement is vulnerable to systematic real-world distortions. SynapseTwin deploys active algorithmic and UI countermeasures for each known bias:

| Measurement Bias | Real-World Distortion Mechanism | Algorithmic & UX Mitigation Countermeasure |
| :--- | :--- | :--- |
| **Circadian Alertness Bias** | Late-night sessions exhibit $+180\text{ ms}$ reaction time lag and higher jitter, misdiagnosed as cognitive decline. | **Session Fatigue Heatmap & Normalization**: Telemetry is weighted by time-of-day baseline; late sessions trigger rest pacing advice rather than score downgrades. |
| **Hardware Input Latency Bias** | Bluetooth keyboards add $80\text{–}150\text{ ms}$ latency vs wired gaming keyboards ($5\text{ ms}$). | **Latency Calibration Baseline**: Measures initial keydown vs pointer down; subtracts calibrated baseline hardware offset from raw response times. |
| **Speed-Accuracy Trade-Off (SAT)** | Impulsive learners click rapidly with low accuracy; perfectionists click slowly with 100% accuracy. | **Drift-Diffusion Modeling (DDM)**: Balances drift rate ($v$) and boundary separation ($a$) so fast guesses and deliberate pauses are normalized fairly. |
| **Cultural & Linguistic Bias** | Standard tests rely on English vocabulary or culturally specific idioms. | **Language-Free Abstract Stimuli**: All tasks use geometric polygons, Okabe-Ito colors, and non-representational glyphs with zero cultural prerequisites. |
| **Evaluator & Test Anxiety Bias** | White-coat syndrome artificially elevates heart rate and freezes working memory. | **Non-Clinical Doodle Framing**: Warm paper canvas, cheerful axolotl companion, zero fail states, and rest-protected streaks eliminate testing pressure. |
| **Display Refresh Rate Variance** | 60 Hz monitors refresh every $16.7\text{ ms}$, while 144 Hz monitors refresh every $6.9\text{ ms}$, skewing tachistoscopic displays. | **Frame-Measured Duration Logging**: UFOV renderer synchronizes with `requestAnimationFrame`, records actual rendered `shown_ms`, and passes true frame counts to QUEST+. |

---

## 4. Telemetry Contract Summary (`POST /v1/telemetry/event`)

Every completed trial emits a non-biometric event conforming to the root schema:

```json
{
  "user_id": "usr_nour_01",
  "session_id": "sess_20261029_01",
  "task_id": "nback_wm_03",
  "trial_index": 4,
  "dimension": "working_memory",
  "score_norm": 1.0,
  "response_time_ms": 482.5,
  "error_flag": false,
  "error_burst": 0,
  "hesitation_jitter": 24.2,
  "keystroke_latency_ms": 210.0,
  "voice_opt_in": false,
  "client_ts": 1793260800000
}
```

