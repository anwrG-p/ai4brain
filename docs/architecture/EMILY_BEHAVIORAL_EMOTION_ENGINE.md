# Unified Research — EMILY Behavioral Emotion Engine & Color Psychology

> **Architecture Specification & Design Reference**  
> **Source of Truth**: `docs/architecture/EMILY_BEHAVIORAL_EMOTION_ENGINE.md`  
> **Scope**: Emotion & Micro-Interaction Listener for You (EMILY) — Non-biometric affective computing, pointer kinematics, and anti-red counter-regulatory color tokens.

---

## 1.1 Theoretical Foundation: The Circumplex Model of Affect (Zero Biometrics)

In Human-Computer Interaction (HCI) and affective computing (Picard, 1997; Jenkins et al., 2016; Sun et al., 2014), mouse kinematics and keystroke dynamics mirror neuromuscular tension and cognitive load without requiring a webcam, microphone, or biometric sensor. This keeps the platform **100% compliant with EU AI Act Article 5(1)(f)** non-biometric regulations.

EMILY (Emotion & Micro-Interaction Listener for You) maps pointer and keyboard behavior onto James Russell’s **2D Circumplex Model of Affect**:

- **Valence (Horizontal Axis)**: Negative (*Frustrated, Hesitant/Confused*) ↔ Positive (*Calm Flow, Energized/Confident*).
- **Arousal (Vertical Axis)**: Low Neurophysiological Energy (*Fatigued/Sluggish*) ↔ High Neurophysiological Energy (*Frustrated/Agitated* or *Energized/Spark*).

```
                        HIGH AROUSAL
                             ▲
               Frustrated    │    Energized / Confident Spark
          (Rage Clicks/Jerk) │    (Brisk, Direct, Low Dwell)
                             │
  NEGATIVE ──────────────────┼──────────────────► POSITIVE
  VALENCE                    │                    VALENCE
         Hesitant / Confused │    Calm Flow
         (Wandering/Flips)   │    (Smooth Arcs, Steady Rhythm)
                             │
                             ▼
                        LOW AROUSAL
                    (Fatigued / Sluggish)
```

---

## 1.2 The 7 Client-Side Kinematic & Interaction Features

EMILY samples DOM events (`pointermove`, `mousedown`, `mouseup`, `click`, `keydown`, `wheel`) passively inside a `requestAnimationFrame`-throttled (~50ms) rolling window, evaluating every 3 seconds over a 5–15 second sliding buffer:

| # | Metric (`emilyEngine.ts`) | Mathematical Formulation | Behavioral & Emotional Signal |
| :--- | :--- | :--- | :--- |
| **1** | **Cursor Velocity ($v$)** | $$v = \frac{\sqrt{\Delta x^2 + \Delta y^2}}{\Delta t}$$ | Optimal steady speed = Flow; abnormally low ($<0.15\text{ px/ms}$) = Fatigue; sudden spikes = Irritation. |
| **2** | **Jerk / Tremor ($j$)** | $$j = \frac{\Delta a}{\Delta t} \quad \text{where } a = \frac{\Delta v}{\Delta t}$$ | High acceleration derivative ($j > 0.8$) reflects physical cursor tremor, agitation, or acute stress. |
| **3** | **Path Directness ($R_{\text{path}}$) & Curvature ($\kappa$)** | $$R_{\text{path}} = \frac{D_{\text{euclidean}}}{L_{\text{actual}}} = \frac{1}{\kappa} \in (0,1]$$ | $R_{\text{path}} \ge 0.78$ ($\kappa \le 1.28$) = Confident, decisive movement; $R_{\text{path}} < 0.45$ ($\kappa > 2.2$) = Wandering, lost, or confused. |
| **4** | **Click Dwell Time ($\tau_{\text{click}}$)** | $$\tau_{\text{click}} = t_{\text{mouseup}} - t_{\text{mousedown}}$$ | Normal: 70–120ms; $<35\text{ms}$ rapid taps or $>450\text{ms}$ heavy forceful presses signal frustration or tension. |
| **5** | **Rage-Click Bursts ($R_{\text{click}}$)** | $\ge 3\text{ clicks}$ within $<400\text{ms}$ inside a $30\text{px}$ radius | Acute frustration, impatience, or an unintuitive UI affordance. |
| **6** | **Hover Hesitation & Idle Dwell ($\tau_{\text{hover}}$)** | Repeated button enter/leave or hover $>2000\text{ms}$ without clicking | Uncertainty, caution, or cognitive overload on an interactive choice. |
| **7** | **Direction Flips ($N_{\text{flip}}$) & Pacing Drift ($\Delta\text{RT}$)** | Sign inversions in $\text{sign}(\Delta x), \text{sign}(\Delta y) + \text{pauses} > 6000\text{ms}$ | High trajectory inversions = second-guessing; lengthening response pauses = mental fatigue. |

---

## 1.3 Unified Emotional Color Psychology & Doodle Token Matrix

### Foundational Law: Affective Counter-Regulation & Anti-Red Policy
When a user is frustrated, anxious, or overwhelmed, the UI must **never turn red (`#DC2626`)**, which elevates cortisol, task anxiety, and visual tension. Instead:
- **Positive states** are reinforced with focused, energizing tones.
- **Stressed / fatigued states** counter-regulate with calming, low-arousal restorative hues.

To preserve **WCAG 2.2 AA accessibility** ($\ge 4.5:1$ contrast) and the Doodle Design System (`#111827` primary text, `#263D5B` secondary navy, `#49B6E5` sky blue, *Delius Swash Caps* & *JetBrains Mono*), emotional color shifts apply strictly to ambient card tints, hand-drawn sketch borders, offset doodle shadows, and status badges:

| Canonical EMILY State (`EmilyEmotion`) | Trigger Thresholds | Color Psychology & Physiological Effect | Light Mode Tokens (`#FAF8F5` / `#FFFFFF`) | Night Mode Tokens (`#131b2e`) | BRIAN Mascot & Adaptive UI Behavior |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **1. Calm Flow (`calm_flow`)** | Smooth arcs ($R_{\text{path}} \ge 0.78$), moderate velocity, 0 rage clicks. | **Deep Teal / Sage Green**: Parasympathetic balance, mental clarity, sustained focus without eye strain. | **Accent**: `#0D9488` / `#2A7B76`<br/>**Tint**: `#F2F9F8` | **Accent**: `#4FD1C5`<br/>**Glow**: `rgba(79, 209, 197, 0.14)` | BRIAN has a calm smile; minimalist layout, steady sketch borders, zero interruptions. |
| **2. Curious / Confident Spark (`energized`)** | High directness ($R_{\text{path}} \ge 0.82$), brisk velocity ($>0.6\text{ px/ms}$), prompt clicks. | **Warm Terracotta Amber & Doodle Sky**: Optimism, dopamine reinforcement, high self-efficacy, momentum. | **Accent**: `#D96B43` (Pair w/ `#263D5B` navy)<br/>**Tint**: `#FDF6F0` | **Accent**: `#F5A65B`<br/>**Glow**: `rgba(245, 166, 91, 0.15)` | BRIAN perks up with glowing gill tips; tactile doodle confetti on streak milestones. |
| **3. Gentle De-Escalation (`frustrated`)** | Rage clicks ($R_{\text{click}} \ge 1$), high jerk ($j > 0.8$), or rapid error bursts. | **Tranquil Eucalyptus Sage & Soft Slate (Anti-Red Policy)**: Lowers visual tension, reduces cortisol, signals safety. | **Accent**: `#4D9078` / `#64748B`<br/>**Tint**: `#F1F7F4` | **Accent**: `#68D391`<br/>**Glow**: `rgba(104, 211, 145, 0.14)` | Suppresses secondary charts; BRIAN offers a 1-click *"Slow down pace / Take a 60s breather"* prompt. |
| **4. Reassuring Guidance (`hesitant`)** | High curvature ($\kappa > 2.2$), high direction flips ($N_{\text{flip}}$), hover dwell $>2.2\text{s}$. | **Patient Periwinkle / Warm Honey Accent**: Non-judgmental clarity, cognitive grounding, reassurance. | **Accent**: `#5A67D8`<br/>**Badge**: `#D97706`<br/>**Tint**: `#F4F5FC` | **Accent**: `#90CDF4`<br/>**Glow**: `rgba(144, 205, 244, 0.14)` | BRIAN holds a lantern (*"Take your time—no wrong answers"*); highlights the single next logical CTA. |
| **5. Restorative Wind-Down (`fatigued`)** | Low velocity ($v < 0.15\text{ px/ms}$), pauses $>6\text{s}$, sluggish cadence. | **Twilight Indigo & Revitalizing Mint**: Circadian rest, reduced eye strain, guilt-free recovery. | **Accent**: `#5C6B9C` / `#10B981`<br/>**Tint**: `#F3F4F8` | **Accent**: `#B794F4`<br/>**Glow**: `rgba(183, 148, 244, 0.14)` | BRIAN wears his nightcap; enlarges click targets (`min-h-12`) and highlights streak-protected rest mode. |

---

## 1.4 Architectural Integration Guardrails

- **Zero Camera / Microphone Tracking**: Strict adherence to client-side DOM pointer kinematics only.
- **Counter-Regulation Priority**: Negative emotions never inject high-stress alert tones (such as red warning borders or alarm banners).
- **Subtle Layering**: Emotional shifts modulate background tints and border tones rather than violently rearranging layout geometry, ensuring accessibility and cognitive calm.

