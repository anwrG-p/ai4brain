# Canonical Consumer Glossary & Non-Clinical Copy Standards

> **CISTAC 1.0 (AI4Brain Challenge)** — Continuous, Non-Clinical Cognitive Assessment & Adaptive Growth  
> **Source of Truth**: `frontend/src/utils/copyLinter.ts` · `frontend/scripts/lint-copy.mjs`

---

## 1. Epistemic Principles & Tone Foundations

SynapseTwin is an **empathetic personal cognitive twin**, not a medical diagnostic apparatus. Every phrase in the user interface, conversational coach agent, and telemetry summary must adhere to three foundational communication pillars:

1. **Growth-Mindset Neuroplasticity**: Cognitive capacities fluctuate dynamically based on sleep, circadian rhythms, physical movement, and practice. We measure transient performance states, not fixed traits.
2. **Epistemic Honesty & Uncertainty Awareness**: No estimate is presented as an absolute verdict. We openly display confidence intervals ($\pm \text{CI}$) and diagonal hatching when samples are insufficient.
3. **Zero-Guilt Rest Protection**: Recovery is an active biological phase of learning. Users are never penalized, guilted, or reprimanded for scheduled rest days or taking breaks.

---

## 2. Canonical Consumer Vocabulary (Approved Lexicon)

Use these preferred consumer terms across all pages, UI copy, and coach interactions:

| Canonical Consumer Term | Conceptual Definition | Context / UI Placement |
| :--- | :--- | :--- |
| **Personal Cognitive Twin** | A living mathematical twin that mirrors and anticipates cognitive rhythms. | AppShell header, Welcome hero, Profile reveal |
| **Your Thinking Style** | A qualitative persona cluster (e.g. *Steady Strategist*, *Agile Explorer*) reflecting natural attentional pacing and cognitive strategy. | `/reveal`, `/dashboard`, Profile cards |
| **Weekly Progress Boost** | The measured rate of positive adaptive growth in speed, endurance, or accuracy across weekly micro-sessions. | Trend badges, Progress summaries |
| **Clarity Range (±%) / Calibration Confidence** | The honest statistical interval and sync percentage reflecting baseline certainty. | Uncertainty Radar, Skill cards, Status pills |
| **Auto-Paced to Your Flow Zone** | Dynamic difficulty calibration maintaining an optimal 85% accuracy state without cognitive fatigue. | Practice arena, Briefings |
| **✨ Why Brian Suggests This** | A concise, 3-bullet explainability card (*What You Did*, *How Your Profile Shifted*, *When We'll Adjust Pace*). | AI Coach drawer, Assessment recommendations |
| **Co-Pilot Synergy with Brian (0–100)** | An exploratory index measuring how effectively a learner audits and steers AI assistants (keeps small *Experimental Model* badge). | `/coach` synergy panel, Collaboration score |
| **Visual Memory Clarity** | High-fidelity recognition distinguishing subtle visual variations from lures without false alarms. | Task cards, Skill arena (`episodic_pattern_separation`) |
| **Wide-Angle Focus** | Simultaneous central and peripheral target discrimination under rapid presentation. | Task cards, Skill arena (`divided_perceptual_speed` / UFOV) |
| **Distraction Shield** | Goal-directed stimulus selection while suppressing high-conflict surrounding clutter. | Task cards, Skill arena (`inhibition_control` / Flanker) |
| **Daily Energy & Focus Rhythm** | The natural cyclical variance in alertness, focus, and executive endurance across the day. | `/brain-twin` rhythm tab, Dashboard overview, Settings |
| **Rest-Protected Streak (Zero-Guilt Continuity Strip)** | A continuous habit counter that automatically pauses during rest days without resetting. | Dashboard Section 3, Goals page, Habit contract cards |
| **Calibration Session (Today's 2-Min Flow)** | A gamified, low-stakes micro-puzzle block designed to estimate current cognitive parameters. | Assessment Hub, Task Runner, Briefing modals |
| **Developing Range** | An exploratory ability range that has ample headroom for expansion through progressive practice. | Dimension Detail, Score Cards, Coach Feedback |
| **BRIAN** | The friendly axolotl companion embodying adaptive guidance, celebration, and neuroplasticity encouragement. | Mascot widgets, Auth page, Error boundary fallbacks |
| **EMILY** | The ambient mood and pointer rhythm calibrator that quietly measures baseline pointer pacing and atmosphere. | Dashboard Atmosphere Pill, Task runner background |

---

## 2.1 Master Jargon-to-Human Translation Table

| Forbidden Academic / ML Jargon (_Avoid_ in UI) | Approved Consumer-Friendly Copy (Canonical Term) | Where Technical Details Live |
| :--- | :--- | :--- |
| **SAT-JEPA Latent Twin State & Hysteresis / GMM Archetype Cluster (k=0..8)** | **Your Thinking Style** (e.g., *Steady Strategist*, *Agile Explorer*) | Collapsible `<details>` drawer ("Explore How This Is Calculated") |
| **Differential Vector Δc (+0.18)** | **Weekly Progress Boost** (e.g., +12% Memory Speed this week) | Tooltip on trend badge |
| **Epistemic Uncertainty (±1.96σ CI) / Uncertainty Polygon Error Bands** | **Clarity Range (±5%) / Calibration Confidence (92% Calibrated)** | Subtext: *"Still getting to know you (2 quick games left)"* & deep telemetry drawer |
| **QUEST+ / Elo Psychometric Staircase Target** | **Auto-Paced to Your Flow Zone** | Hidden from user (internal adaptive engine parameter) |
| **5-Part Reasoning Trail (Telemetry -> Inference -> Counterfactual)** | **✨ Why Brian Suggests This** (3 friendly bullets: *What You Did*, *How Your Profile Shifted*, *When We'll Adjust Pace*) | Expandable drawer on Coach card |
| **0–100 AI Collaboration Score** | **Co-Pilot Synergy with Brian (0–100)** | `/coach` synergy panel (keeps small *"Experimental Model (Design proposal, not validated)"* tag for rubric compliance) |
| **Episodic Pattern Separation / UFOV / Inhibitory Flanker** | **Visual Memory Clarity · Wide-Angle Focus · Distraction Shield** | Skill cards & practice arena details |
| **Continuous Saccadic Drift / Fatigue Heatmap** | **Daily Energy & Focus Rhythm** | `/brain-twin` rhythm tab & collapsible deep telemetry drawer |

---

## 3. Forbidden Academic & Clinical Jargon Table

The terms below are **strictly prohibited** in all learner-facing copy. They are actively monitored by the AST copy linter (`npm run lint:copy` / `copyLinter.ts`). Any PR containing an unexempted violation fails CI automatically.

### 3.1 Clinical & Diagnostic Banned Terms

| Banned Term | Regex Pattern | Harm & Stigma Rationale | Mandatory Consumer Replacement |
| :--- | :--- | :--- | :--- |
| **ADHD** | `\badhd\b` | Pathologizes natural attentional switching styles into a psychiatric deficit. | *Attentional variability* or *fast-switching style* |
| **Dementia** | `\bdementia\b` | Evokes terminal neurodegenerative panic; inappropriate for consumer wellness. | *Memory recall variability* |
| **Autism** | `\bautism\b` | Medicalizes cognitive diversity without clinical diagnostic authorization. | *Individual processing profile* |
| **Diagnosis / Diagnostic** | `(?<!(?:not a\|no\|not\|non-)\s*)\bdiagnos(?:is\|e\|ed\|tic)\b` | Implies medical authority and diagnostic certitude. | *Non-clinical profile estimate* or *calibration* |
| **Disorder** | `(?<!(?:not\|no\|never\|zero)\s+)\bdisorder(?:s)?\b` | Frames atypical cognitive profiles as broken or diseased. | *Cognitive pattern* or *processing style* |
| **Deficit** | `(?<!(?:not\|no\|never\|zero)\s+(?:clinical\|cognitive)?\s*)\bdeficit(?:s)?\b` | Deficit-framing causes stereotype threat and task anxiety. | *Growth opportunity* or *developing range* |
| **Impairment / Impaired** | `\bimpair(?:ment\|ed)\b` | Conveys permanent biological damage rather than transient variance. | *Lower-confidence range* or *temporary fatigue* |
| **Pathology / Pathological** | `\bpatholog(?:y\|ical)\b` | Severe clinical term with zero educational validity. | *Response pattern* or *telemetry signature* |
| **Symptom** | `\bsymptom(?:s)?\b` | Medicalizes benign behavioral metrics (e.g., reaction time variance). | *Session telemetry signal* or *focus indicator* |
| **Patient** | `\bpatient(?:s)?\b` | Strips user agency; frames learners as clinical subjects. | *Learner*, *user*, or *explorer* |
| **IQ** | `(?<!(?:not\|no\|never\|zero)\s+)\biq(?:\s+score\|\s+label)?\b` | Antiquated, pseudoscientific single-number intelligence myth. | *Dimension percentage estimate* |
| **Anxiety** | `\banxiety\b` | Medical mental health diagnosis. | *Temporary tension* or *pacing friction* |
| **Depression** | `\bdepression\b` | Psychiatric condition requiring licensed medical care. | *Low energy* or *cognitive fatigue* |
| **Dyslexia** | `\bdyslexia\b` | Clinical learning disability diagnosis. | *Reading / visual pace variation* |
| **Alzheimer's** | `\balzheimer(?:'s)?\b` | Clinical degenerative pathology term. | *Memory recall variation* |
| **Cognitive Decline** | `\bcognitive decline\b` | Triggers existential fear; conflates fatigue with permanent loss. | *Temporary variance* or *fatigue dip* |
| **Abnormal** | `\babnormal\b` | Othering, stigmatizing language. | *Atypical pattern* or *unique processing profile* |
| **Below Average** | `\bbelow average\b` | Normative comparison that damages learning self-efficacy. | *Developing range* or *early-stage baseline* |

### 3.2 Punitive Guilt & Shame Banned Terms

| Banned Term | Regex Pattern | Harm & Stigma Rationale | Mandatory Consumer Replacement |
| :--- | :--- | :--- | :--- |
| **Lazy** | `\b(?:you are\|too\|feeling)\s+lazy\b` | Attaches moral blame to natural circadian down-times. | *Needs recovery / rest interval* |
| **Weak** | `\b(?:you are\|too)\s+weak\b` | Fixed-mindset insult that discourages resilience. | *Early-stage skill* or *fresh challenge* |
| **Behind** | `\b(?:you are\|falling)\s+behind\b` | Imposes arbitrary rat-race pressure on personalized pacing. | *Progressing at your natural rhythm* |
| **Broke your streak** | `\bbroke your (?:[\w-]+\s+)?streak\b` | Punitive dark pattern that induces demotivation after missed days. | *Welcome back—pick up right where you left off* |
| **Lost your streak** | `\blost your streak\b` | Punitive framing that invalidates prior sustained effort. | *Ready for a fresh check-in whenever you are* |
| **You failed** | `\byou failed\b` | Replaces informative telemetry calibration with emotional defeat. | *Tricky block—every miss sharpens your range* |

---

## 4. Syntactic Exceptions & Permitted Usages

The copy linter recognizes valid technical contexts and explicit disclaimers:
- **Negated Disclaimers**: Phrases like `"not a medical or clinical diagnostic tool"` or `"zero clinical diagnostic claims"` are explicitly permitted.
- **Technical System Diagnostics**: Developer infrastructure, error boundaries, and system logs (`ErrorBoundary diagnostic JSON`, `System Faults`) are exempt from copy linting.
- **Interactive Sandbox Fixtures**: The copy linter demo sandbox on `/design-system` and `/methodology` may render isolated strings inside inspection panels to demonstrate active regex interception.

