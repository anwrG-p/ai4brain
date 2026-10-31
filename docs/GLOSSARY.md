# Glossary: consumer words and copy rules

> **Enforced by:** `frontend/src/utils/copyLinter.ts` and `frontend/scripts/lint-copy.mjs` (`npm run lint:copy`).
> **Product:** SynapseTwin, a calm cognitive-training app. For training and self-reflection. Not a medical tool.

---

## 1. Tone

1. **Practice, not diagnosis.** Scores describe how you did on these exercises. Claims stay at "practice improves these exercises": nothing about life outside them, and nothing about health.
2. **Honest numbers.** Scores come only from your own sessions. Missing data shows "Not measured yet", never a made-up value. Ranges appear only in "View as table" ("62 · likely 55–69").
3. **No guilt.** No streaks to lose, no decay lines and no "you'll lose your progress".
4. **Guesses are labelled as guesses.** Momo's mood is a guess the user can correct ([ADR 0002](adr/0002-no-server-side-emotion-inference.md)).

---

## 2. Words we use

### Characters
| Term | Meaning | Where |
| :--- | :--- | :--- |
| **Loti** | The guide: an axolotl coach who talks in short bubbles with answer chips. Scripted today; an AI mode only behind the crisis checks (R14). | Welcome, Home, the Loti tab, system pages |
| **Dolphin** | The celebration character. It swims in to say "Good job!". | Results, milestones |
| **Momo** | The mood companion. It shows an on-device *guess* of your mood (calm, happy, focused, tired, frustrated), which you can change. | Home |

### Skills (the 5 pillars)
The UI says **skills**; code and docs say **pillars** (`frontend/src/features/insights/pillars.ts`).

| Skill | Exercises (consumer name, `schema_type`) |
| :--- | :--- |
| **Focus & Strategy** | Logic Web (`relational`), Strategic Blueprint (`tower`), Pattern Puzzle (`matrix`) |
| **Mental Agility** | Memory Gauntlet (`n_back`), Shape Turn (`mental_rotation`) |
| **Impulse Control** | Color Clash (`stroop`) |
| **Deep Memory** | Precision Archive (`mst`) |
| **Visual Radar** | Perceptual Radar (`ufov`) |

The **baseline** is 6 exercises in this order: Logic Web, Memory Gauntlet, Color Clash, Strategic Blueprint, Perceptual Radar, Precision Archive (R10).

### Screens and actions
| Term | Meaning |
| :--- | :--- |
| **Home · Train · Loti · You** | The four tabs. |
| **Welcome → Baseline → Results** | The first visit. A returning device goes straight to Home. |
| **Save my answers / Keep them on this device only** | The consent choice on Results, with equal weight. Nothing is sent without "Save my answers". |
| **Export my data / Delete my data** | On Privacy. Delete clears this device ("Deleted from this device."). The server's `DELETE /v1/user/telemetry` returns the counts it removed; once the screen calls it (ticket F-C), the message states those counts, or "this device only". |
| **How we calculate this** | `/methodology`, the only place formulas appear. |
| **Why Loti picked this** | The short reason behind today's suggestion, on Home under "Further explore". |
| **Not measured yet** | Shown instead of a score when there is not enough data. |

---

## 2.1 Words we no longer use

| Old term | Use instead | Why |
| :--- | :--- | :--- |
| BRIAN, Nodi (mascots) | **Loti** | Brand v2 replaced them. |
| EMILY (in the UI) | **Momo** | EMILY is the code name of the mood rules, not a UI word. |
| Doodle, Calm & Clean (design systems) | **the classroom board** | Wood frame, dotted whiteboard (light) or green chalkboard (dark). |
| 7 (or 6, 10) dimensions; "dimension" in the UI | **5 skills** | Dimension ids stay in telemetry and code. |
| ✨ Why Brian Suggests This | **Why Loti picked this** | |
| Co-Pilot Synergy with Brian | **Collaboration Score** | Shown only in "Further explore", and only with enough chat data. |
| Weekly Progress Boost (+12%) | nothing | No improvement claims or percentages before a calibrated reliable-change check. |
| Clarity Range (±%), Calibration Confidence (92%) | a range in "View as table" | R12. |
| Rest-Protected Streak | a weekly goal that tolerates a miss | Streaks frame stopping as a loss. |
| Privacy certificate, purge certificate, SHA receipt, "permanently purged" | **Delete my data** with honest counts | We certify nothing we did not do. |
| "never collected", "non-biometric", "no emotion recognition" | say what we record, in one sentence | These claims were false or unprovable. |
| Brain regions, chemicals, "brain age", "rewire" | nothing | We don't measure your brain (U5). |
| Personal Cognitive Twin, Your Thinking Style | nothing in the UI yet | Archetypes exist on the server (clustering) but have no screen. |

---

## 3. Forbidden Academic & Clinical Jargon Table

The terms below are **strictly prohibited** in all learner-facing copy. They are actively monitored by the AST copy linter (`npm run lint:copy` / `copyLinter.ts`). Any PR containing an unexempted violation fails CI automatically.

The replacements below are for UI copy. When a user raises a health concern in the Loti chat, Loti signposts help instead of rewriting their words (research §7, `ai_coach/safety_guardrails.py`).

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
- **Test fixtures**: the copy linter's own tests may hold banned strings to prove they are caught.

