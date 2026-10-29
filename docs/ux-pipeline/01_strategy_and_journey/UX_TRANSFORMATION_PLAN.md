# UX Transformation Plan: Affective Computing, Journey Flow & Human Approval Protocol

> **SynapseTwin / BRIAN Cognitive Companion** — CISTAC 1.0 (AI4Brain Challenge)  
> **Status**: Complete & Verified Across 19 Screens · **DoD Compliant**

---

## 1. Executive Summary & Epistemic Thesis

Traditional cognitive evaluation platforms suffer from two major UX flaws:
1. **White-Coat Intimidation**: Clinical, sterile layouts cause test anxiety, artificially inflating response times ($+140\text{ ms}$) and error rates.
2. **Deficit-Framed Feedback**: Users are diagnosed with "impairments" or shamed with "lost streaks," leading to early abandonment.

SynapseTwin executes a radical UX transformation: turning cognitive assessment into an empowering, uncertainty-aware **conversational partnership** powered by **EMILY (Emotion-Modulated Interactive Learning Yield)** affective computing, non-clinical doodle aesthetics, and an active **Human UX Approval Protocol**.

---

## 2. Complete 19-Page Journey Architecture

The application is structured into a cohesive 19-screen single-page application (SPA) with a sub-3-minute time-to-first-insight guarantee:

```
[ Page 01: Welcome / Hero ] ───────► [ Page 02: Onboarding & Hardware Consent ]
           │                                          │
           ▼                                          ▼
[ Page 16: Judge Mode Dock ]        [ Page 03: Assessment Hub (2-Min Baseline) ]
(Instant Persona Switching)                           │
           │                                          ▼
           ▼                                [ Page 04: Task Runner ]
[ Page 06: Dashboard / Today ] ◄──── [ Page 05: Profile Reveal (1st Insight < 3 min) ]
     │           │
     ├───────────┼───────────────────────┬───────────────────────┐
     ▼           ▼                       ▼                       ▼
[ Page 07:  [ Page 08:              [ Page 09:              [ Page 10:
  Dimension   Brain Twin              AI Coach &              Adaptive Plan &
  Deep Dive]  Time Travel]            Why-This]               Habit Contracts]
     │           │                       │                       │
     ▼           ▼                       ▼                       ▼
[ Page 11:  [ Page 12:              [ Page 13:              [ Page 14:
  Goals &     Collaboration           Privacy & GDPR          Settings &
  Rest-Days]  Score 0-100]            Vault Deletion]         Ergonomics]
     │           │                       │                       │
     ▼           ▼                       ▼                       ▼
[ Page 15:  [ Page 17:              [ Page 18:              [ Page 19:
  Methodology System Health           Living Design           Layer D Multimodal
  & Limits]   & 500-Queue]            System]                 Voice & What-If]
```

### 2.1 Journey Milestones
- **Step 1 (Minute 0–1)**: User arrives on `Page 01` (Welcome), experiences warm non-clinical copy, and enters `Page 02` (Onboarding) where Non-Biometric Mode is locked ON by default.
- **Step 2 (Minute 1–2)**: User enters `Page 03` (Assessment Hub) and launches the 2-Minute Quick Baseline on `Page 04` (Task Runner), completing 3 core trials per dimension.
- **Step 3 (Minute 2–3)**: User unlocks `Page 05` (Profile Reveal) showing their first living cognitive twin snapshot with visible confidence intervals ($\pm \text{CI}$) and zero diagnostic labels.
- **Step 4 (Ongoing)**: User explores `Page 06` (Dashboard), adjusts habits on `Page 11` (Goals), and inspects explainability trails on `Page 09` (Coach).

---

## 3. EMILY Affective Computing Model

The **EMILY** framework governs emotional regulation and cognitive fatigue modulation during user interactions:

```
    Telemetry Input                EMILY Affective Filter              Adaptive UI Response
┌──────────────────────┐        ┌─────────────────────────┐        ┌─────────────────────────┐
│ • Hesitation Jitter  │───────►│ Fatigue Saturation      │───────►│ • Pacing Rest Inserted  │
│ • RT Variance        │        │ Strain Index > 0.65     │        │ • Neutralizing Tone     │
│ • Error Bursts       │        │ Cognitive Overload Risk │        │ • Mascot: Calm Shrug    │
└──────────────────────┘        └─────────────────────────┘        └─────────────────────────┘
```

### 3.1 Telemetry Strain Indicators
- **Transient Fatigue Dip**: When trial-over-trial hesitation jitter exceeds $180\text{ ms}$ and mean RT climbs $+25\%$, EMILY flags transient cognitive fatigue rather than ability loss.
- **Error Burst De-Escalation**: Consecutive misses ($k \ge 3$) trigger supportive pacing breaks with Nodi offering breathing prompts, preventing frustration spirals.

### 3.2 Mascot Companion State Machine (Nodi / BRIAN)
1. **`idle`**: Gentle ambient breathing; present during quiet reading.
2. **`hello`**: Welcoming wave with hat tip; displayed upon login and onboarding.
3. **`curious`**: Head tilt with magnifying glass; active when inspecting "Why This?" trails.
4. **`thinking`**: Brain spark node pulsing; active while background AI models compute deltas.
5. **`celebrate`**: Joyful jump with confetti; triggers on milestone completion and rest-day adherence.
6. **`rest`**: Curled under a leaf sleeping; displayed on protected rest days and late-night sessions.
7. **`calm-shrug`**: Warm reassuring gesture; displayed when error bursts occur (*"Tricky block! Every miss sharpens calibration"*).

---

## 4. Color Psychology Matrix

| Hue Role | Token / Hex | Valence | Arousal | Psychological Impact & Behavioral Rationale |
| :--- | :---: | :---: | :---: | :--- |
| **Warm Paper Canvas** | `#FFF8EE` | High | Low | Evokes sketchbook warmth; lowers blood pressure and eliminates clinical monitor glare. |
| **Deep Ink** | `#1F1B3B` | Neutral | Moderate | Grounding, high-contrast anchor ($15.61:1$) providing structural security without harsh black. |
| **Focused Teal** | `#0F766E` | Positive | Moderate | Promotes deep focus, intellectual curiosity, and steady flow state. |
| **Reward Gold** | `#FFC83D` | High | High | Signals mastery and milestone achievement without predatory casino dopamine loops. |
| **Empathetic Coral** | `#FF6B6B` | Neutral | Moderate | Soft alerting for pacing rests and calibration gaps without triggering medical alarm. |
| **Calm Violet** | `#9E4778` | High | Low | Low-confidence uncertainty boundary; encourages playful exploration of preliminary traits. |

---

## 5. Human UX Approval Protocol

To prevent autonomous AI agents from making unvetted modifications to user training plans, SynapseTwin enforces a 4-tier **Human UX Approval Protocol**:

```
[ AI Engine Proposes Adaptation ]
                 │
                 ▼
[ Safety & Copy Guardrail Check ]
                 │
                 ▼
[ <HumanReviewGate /> Presented ] ◄── Evaluator / Learner in the Loop
                 │
        ┌────────┴────────┐
        ▼                 ▼
   [ Approved ]      [ Rejected ]
        │                 │
        ▼                 ▼
[ System Applied ]   [ Rollback & Logged ]
```

1. **Gate Presentation (`HumanReviewGate.tsx`)**: Any proposed change to task pacing, difficulty ladders, or schedule rest intervals renders an explicit review card with summary, rationale, and diff.
2. **Granular Consent & Hardware Lock**: Camera and microphone access are never requested; non-biometric mode is permanently hard-locked.
3. **Self-Service GDPR Suite**: One-click JSON data export and instant local purge (`DELETE /v1/user/telemetry`) with verification certificates on `Page 13` (Privacy).
4. **Automated Copy Linting Gate**: All coach suggestions must pass `lintCopyText()` to ensure zero clinical or punitive guilt terms reach the user.

