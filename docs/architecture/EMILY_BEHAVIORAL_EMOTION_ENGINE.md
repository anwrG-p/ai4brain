# EMILY: the on-device mood guess behind Momo

> **Code:** `frontend/src/utils/emilyEngine.ts` (rules), `frontend/src/state/useEmilyStore.ts` (state and approval), `frontend/src/components/layout/EmotionListener.tsx` (listener), `frontend/src/components/features/characters/Momo.tsx` (display).
> **Binding decision:** [ADR 0002: no server-side emotion inference](../adr/0002-no-server-side-emotion-inference.md).

---

## 1. Legal and evidence position (corrected 2026-10-31)

An earlier version of this doc said EMILY was "100% compliant with EU AI Act Article 5(1)(f)" and "non-biometric". **That was wrong.** The accurate position ([research §5](../research/2026-10-31-improvement-opportunities.md#5-emotion-inference-ai-act-and-gdpr)):

- **It is probably emotion recognition.** The AI Act counts *behavioural* characteristics as biometric data (Art 3(34), Recital 14). Pointer and key timing are behavioural, and "frustrated" or "hesitant" are emotions (Art 3(39)). "Tired" is a physical state and is excluded (Recital 18).
- **It is not banned.** Art 5(1)(f) covers only workplaces and education, and SynapseTwin is a consumer app.
- **It is not an "AI system" while its rules stay hand-written** (Recital 12). A trained affect model would be high-risk under Annex III 1(c). So EMILY stays rule-based, runs on the device, and the server never infers emotion (ADR 0002).
- **It owes a notice at first exposure** (Art 50(3), from 2 Aug 2026): Momo's mood is a guess from how you tap, and you can change it.

**Evidence limits.** Treat every output as a guess, never as a reading:
- In the best field study, cursor speed and distance explained about **17% of the variance** in self-reported negative emotion (out-of-sample R² .17, n = 80; Hibbeln et al. 2017).
- The direction **contradicts** the rules below. Negative emotion made cursors **slower and longer-pathed**, not faster or jerkier.
- High accuracies in the keystroke and mouse literature come mostly from lab, in-sample and per-user models.
- Our own adaptive staircase aims at about 85% accuracy, so it causes errors on purpose. The store proposes "frustrated" after two consecutive errors, so normal play can trigger it wherever errors are reported.

Earlier claims about colours (that they "reduce cortisol", create "parasympathetic balance" or give "dopamine reinforcement") have no support and are withdrawn.

---

## 2. What EMILY measures (on the device only)

EMILY listens passively to `pointermove`, `mousedown`, `mouseup`, `click`, `keydown` and `wheel`. Every 3 seconds it looks at a sliding buffer of 5–15 seconds. Nothing in the buffer, and no mood label, is sent anywhere.

| # | Metric | Rule input |
| :--- | :--- | :--- |
| 1 | Cursor velocity $v$ | Very low speed (< 0.15 px/ms) counts toward "fatigued". |
| 2 | Jerk $j$ (change in acceleration) | High jerk (> 0.8) counts toward "frustrated". |
| 3 | Path directness $R_{\text{path}}$ | Straight paths (≥ 0.78) count toward "calm"; wandering ones (< 0.45) toward "hesitant". |
| 4 | Click dwell $\tau_{\text{click}}$ | Very short (< 35 ms) or very long (> 450 ms) presses. |
| 5 | Rage clicks | 3 or more clicks within 400 ms inside a 30 px radius. |
| 6 | Hover hesitation | Hovering over 2 s without clicking, or repeated enter/leave. |
| 7 | Direction flips and pauses | Reversals of direction; pauses over 6 s. |

The thresholds are design choices, not validated cut-offs.

---

## 3. From rules to Momo

`classifyEmilyEmotion` returns one of five states. Momo shows them as moods:

| EMILY state | Momo mood | What happens |
| :--- | :--- | :--- |
| `calm_flow` | calm | Nothing. |
| `energized` | happy | Nothing. |
| `frustrated` | frustrated | **Proposed only.** The user approves it or keeps the current mood. |
| `hesitant` | focused | Proposed only. |
| `fatigued` | tired | Proposed only. |

- **The user owns the mood.** A strained state is only *proposed* on task strain: a rage-click burst, or 2 or more consecutive errors when a caller reports them. It is never proposed from reading pauses alone. A manual choice locks the mood until the user unlocks it. `autoAdapt` is off.
- **No red.** The frustrated mood never uses red. Moods change Momo's tint, ears and cheeks, plus a soft ambient tint through `<html data-emotion>`. Text contrast stays within WCAG AA. The layout never changes.

---

## 4. Guardrails

- **No camera or microphone.** Pointer and key events only.
- **On the device only.** No mood label, buffer or metric leaves the browser. The server receives `hesitation_jitter` and `keystroke_latency_ms` for task scoring only, and must not infer emotion from them (ADR 0002).
- **No trained model.** Any change to a learned affect model needs a new ADR, a DPIA and the Annex III obligations.
- **Copy.** Say "Momo guesses, and you can correct it". Never "Momo knows how you feel", "we detect your emotions", "100% non-biometric" or "no emotion recognition".
- **Planned work (ticket F-D).** The Art 50(3) first-exposure notice, an opt-in in You → Privacy, and not counting errors inside adaptive blocks as strain.
