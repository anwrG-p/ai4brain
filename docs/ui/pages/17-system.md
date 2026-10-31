# Page 17 Specification: System States & Error Boundaries (`/system/*`)

> **Superseded (history).** This spec describes the page before brand v2. Now: `/offline`, `/system-error` and `*`: Loti, one line, one way home. Current route map: `docs/design/BRAND-V2.md`. Kept as a record; not maintained.

- **Page Name & Route**: System States & Error Boundaries (`/system`, `/system/404`, `/system/offline`, `/system/error`, and catch-all `*`)
- **Primary Users**: Competition Judges, Technical Evaluators, Students, and Knowledge Workers encountering runtime faults or connectivity losses.
- **Challenge Goals**:
  1. **Zero White-Screen of Death (WSOD)**: Gracefully intercept unhandled JavaScript errors at the top level and component boundaries with informative, non-cryptic recovery cards.
  2. **Non-Punitive 404 Route Recovery**: Replace generic 404 errors with an intelligent, synaptic wayfinder offering suggested routes, search jumps, and direct return to safety.
  3. **Offline Telemetry Buffer Visualization**: Provide visual verification that offline operations preserve up to 500 trial telemetry events locally without losing assessment progress.
  4. **Juror Robustness Simulator**: Offer a live test bench where judges can intentionally trigger client-side runtime errors, simulate network outages, and inspect diagnostic payloads in real time.
- **Rubric Criteria Mapping**:
  - **Robustness (Phase 2, 10% final)** — Intercepts unhandled exceptions, provides seamless offline buffering, and deterministic fallback.
  - **Quality (Phase 1, 12% final)** — Complete aesthetic harmony with Playful Lab and Night Lab design tokens; zero unhandled crashes or unstyled fallback elements.
  - **Safety (Phase 1, 6% final)** — Sanitized error diagnostics that protect user privacy while offering exportable bug reports for technical audit.
  - **UX (Phase 1, 9% final)** — Fast one-click recovery paths (`← Return to Safety`, `Retry Connection`, `Download Diagnostics JSON`).

---

## 1. Cognitive & Product Purpose

In cognitive assessment and AI-assisted metacognition, unexpected software failures or connectivity drops can cause severe user frustration, task abandonment, and distorted psychometric measurements. If a cognitive task crashes halfway through an episodic recall trial, naive error handling can discard trial latency data or penalize user accuracy scores.

Page 17 establishes **SynapseTwin's Self-Healing System Architecture**:
1. **Intelligent 404 Wayfinder (`/system/404`)**:
   - When a user enters an invalid URL or encounters a deprecated link, rather than displaying an intimidating HTTP code, SynapseTwin presents an inviting "Synaptic Path Not Found" guide featuring the geometric mascot in `rest` state and 1-click jumps to Core Flow hubs.
2. **Offline Resilience & Queue Hub (`/system/offline`)**:
   - Explains how SynapseTwin operates completely offline: cognitive assessment tasks, local scoring heuristics, and Bayesian prior updates continue unimpeded. Displays live metrics for queued telemetry events (buffered in local storage up to 500 events) and automatic background synchronization.
3. **Resilient React Error Boundary (`/system/error`)**:
   - A dedicated component-level and page-level Error Boundary fallback that isolates crashes, preserves unsaved trial telemetry in indexed cache, displays sanitized human-readable explanations, and provides a 1-click "Copy Diagnostic JSON" button for bug reproduction.
4. **Interactive Robustness Simulator Hub (`/system`)**:
   - A dedicated evaluator workbench where judges can trigger simulated errors (Component Crash, Asynchronous API Timeout, State Hydration Failure, Network Disconnect) to evaluate resilience and recovery behaviors in seconds.

---

## 2. Information Architecture & Wireframes

### Desktop Viewport (`1440 px`)

```text
+----------------------------------------------------------------------------------------------------+
|  [ST] SynapseTwin CISTAC 1.0       Active: 7 Dims · Night Lab Switch · Offline Banner              |
+----------------------------------------------------------------------------------------------------+
|  [🛡 Robustness Defense Center] [100% Graceful Fallback] [Zero White-Screen Guarantee ●]          |
|                                                                                                    |
|  System States & Error Boundaries                                    [ ⚖ Jump to Judge Mode → ]    |
|  Comprehensive fault containment, offline telemetry queueing, and self-healing diagnostic recovery. |
+----------------------------------------------------------------------------------------------------+
|  LIVE SYSTEM SIMULATOR SELECTOR                                                                    |
|  [● 404 Route Not Found]    [○ Offline Resilience Hub]    [○ Error Boundary Catch]                 |
+----------------------------------------------------------------------------------------------------+
|                                                                                                    |
|  +------------------------------------------------------+  +-------------------------------------+ |
|  | LEFT 7 COLUMNS: ACTIVE SYSTEM STATE VIEW             |  | RIGHT 5 COLUMNS: RECOVERY & METRICS | |
|  |                                                      |  |                                     | |
|  | [Mascot in Rest / Thinking State]                    |  | Telemetry Queue Status:             | |
|  |                                                      |  | ◈ Buffer Size: 14 / 500 Events      | |
|  | 404: "Synaptic Path Not Found"                       |  | ◈ Sync Engine: Ready (Auto-Resume)  | |
|  | The route '/unknown' doesn't match known manifolds.  |  | ◈ Offline Integrity: 100% Grounded   | |
|  |                                                      |  |                                     | |
|  | Recommended Jump Destinations:                       |  | Fault Injection Test Bench:         | |
|  | -> Welcome & Persona Launcher (/)                    |  | [Trigger Test Component Crash]      | |
|  | -> Active Cognitive Dashboard (/dashboard)           |  | [Simulate Network Disconnection]    | |
|  | -> Adaptive Weekly Plan (/plan)                      |  | [Simulate LLM Service Outage]       | |
|  | -> AI Coach (/coach)                                 |  |                                     | |
|  |                                                      |  | Diagnostics & Bug Reporting:        | |
|  | Primary Action Buttons:                              |  | [ Download Diagnostic JSON (GDPR) ] | |
|  | [ ← Return to Dashboard ]  [ Reset Application State ] |  | [ Copy System State to Clipboard ]  | |
|  +------------------------------------------------------+  +-------------------------------------+ |
|                                                                                                    |
+----------------------------------------------------------------------------------------------------+
|  ACCESSIBLE CRASH & DIAGNOSTIC LOG TABLE (Keyboard-Scrollable Region)                              |
|  Timestamp           | Error Category      | Affected Layer   | Recovery Strategy    | Action     |
|  2026-10-25 09:12:04 | Unhandled Route     | Client Routing   | Suggested Navigation | [Inspect]  |
|  2026-10-25 09:15:22 | Network Loss (503)  | Telemetry Sync   | Local Buffer (500)   | [View Q]   |
|  2026-10-25 09:20:10 | Simulated Error     | React Subtree    | Component Boundary   | [Recover]  |
+----------------------------------------------------------------------------------------------------+
|  [Why this resilience and fault-tolerant architecture? Expandable Epistemic Trail]                 |
+----------------------------------------------------------------------------------------------------+
```

### Mobile Viewport (`375 px`)

```text
+-----------------------------------+
| [ST] SynapseTwin       [Menu ☰]   |
+-----------------------------------+
| [🛡 Robustness Center] [● 100%]   |
| System States & Recovery          |
+-----------------------------------+
| State Switcher (Horizontal Strip) |
| [404]  [Offline]  [Error Boundary]|
+-----------------------------------+
| [Mascot in Rest State]            |
| "Synaptic Path Not Found"         |
| Route '/unknown' is uncalibrated. |
|                                   |
| Quick Navigation Options:         |
| [ ← Return to Dashboard ]         |
| [ Go to Assessment Hub ]          |
| [ Jump to AI Coach ]              |
+-----------------------------------+
| Telemetry Buffer Status:          |
| ◈ 14 / 500 Events Buffered        |
| ◈ Auto-Sync on Reconnect          |
+-----------------------------------+
| Diagnostics:                      |
| [ Copy Error Report JSON ]        |
+-----------------------------------+
```

---

## 3. Core Capabilities & Sub-Views

Page 17 provides 3 dedicated system views accessible via tabs or URL params:

### View A: 404 Route Not Found (`/system/404` and catch-all `*`)
- **Visuals**: Mascot in `state="rest"` or `state="thinking"` with orbiting neutral particles.
- **Copy**: Non-punitive, synaptic framing ("This cognitive pathway hasn't been mapped yet").
- **Smart Recommendations**: 4 direct navigation cards:
  - Welcome & Quick Baseline (`/`)
  - Cognitive Twin Dashboard (`/dashboard`)
  - AI Coach Deep-Dive (`/coach`)
  - Evaluation & Judge Defense Mode (`/judge-mode`)
- **Search / Jump Input**: Direct keyword filtering to quickly navigate to any registered screen.

### View B: Offline Resilience & Telemetry Queue (`/system/offline`)
- **Visuals**: Tactile card with status badges indicating `Offline Buffer Active` and `Local Mode`.
- **Live Queue Counter**: Interactive visualization showing buffered trial telemetry items (e.g. 14 / 500 events).
- **Offline Capabilities Checklist**:
  - Full psychometric task execution (N-Back, Stroop, Rule-Switching) runs entirely client-side.
  - Deterministic heuristics calculate Bayesian trait estimations ($\hat{\theta}_i$) without server calls.
  - AI Coach switches to deterministic rule-based advice templates.
- **Actions**:
  - `Simulate Reconnect & Flush Queue` (demonstrates how cached events sync smoothly upon re-establishing connection).
  - `Export Buffered Telemetry (JSON)` for audit verification.

### View C: React Error Boundary Fallback (`/system/error`)
- **Visuals**: High-contrast error container with `border-danger/30` and `bg-danger/10` tint.
- **Human-Readable Explanation**: Explains what happened in plain terms without intimidating technical jargon.
- **Sanitized Technical Diagnostics (Collapsible)**:
  - Component Stack trace (anonymized, no private credentials or cookies).
  - System Snapshot (active theme, dimension preset, active persona, memory heap estimate).
- **Actionable Self-Healing**:
  - `Try Re-rendering Component`: Clears boundary state and re-attempts component mount.
  - `Reset Local Demo State`: Calls `resetDemoState()` to recover from corrupted state fixtures.
  - `Copy Bug Report JSON`: Generates a reproducible error payload for debugging.

---

## 4. Component Inventory & Design Tokens

- **Card Container**: `tactile-card p-6 bg-surface border-2 border-border-strong rounded-2xl space-y-6 shadow-sm`
- **Error Banner**: `p-4 rounded-xl border border-danger/40 bg-danger/10 text-ink`
- **Offline Banner**: `p-4 rounded-xl border border-warning/40 bg-warning/10 text-ink`
- **Navigation Buttons**:
  - Primary Return: `Button variant="primary"` (`bg-brand text-brand-ink font-semibold`)
  - Secondary Reset: `Button variant="secondary"` (`bg-surface text-ink border-2 border-border-strong hover:bg-surface-raised`)
  - Destructive State Wipe: `Button variant="danger"`
- **Badge Tones**:
  - Robustness: `tone="reward"` (`#FFC83D` gold)
  - Safe State: `tone="success"` (`#0F766E` teal / `#10B981` green)
  - Warning / Buffer: `tone="warning"` (`#F59E0B` amber)
  - Critical Crash: `tone="danger"` (`#C62828` red)
- **Mascot**: Layered SVG `<Mascot state="rest" size="lg" />` with zero-distraction framing.

---

## 5. User Interactions & State Transitions

1. **State Selector Switcher**:
   - Evaluators can toggle between `404 Not Found`, `Offline Resilience`, and `Error Boundary Catch` using an accessible segmented button group (`role="tablist"`).
2. **Interactive Component Crash Trigger**:
   - In the Error Boundary tab, evaluators can click `"Trigger Simulated Component Crash"` to intentionally throw a React render error and observe the Error Boundary catch it in real time.
3. **Queue Simulation & Flush**:
   - In the Offline tab, clicking `"Add Mock Telemetry Event"` increments the buffered events counter, while `"Flush Queue & Reconnect"` animates queue clearance and displays sync confirmation.
4. **1-Click State Recovery**:
   - `"Reset Application State"` safely resets local storage and store preferences, returning the user to a clean baseline.
5. **Catch-All Routing**:
   - Visiting any unregistered URL (e.g., `/unknown-route`, `/foo/bar`) automatically routes to the 404 view inside `AppShell` with full navigation parity.

---

## 6. Responsive Breakpoints & Adaptations

- **Desktop (`1440 px`)**: 12-column grid. Active system state view in left 7 columns; telemetry queue metrics, fault injection workbench, and diagnostic export actions in right 5 columns. Full-width crash & diagnostic log table below.
- **Tablet (`768 px`)**: Single-column vertical stacking. Tab selector at top. Diagnostic table wrapped in keyboard-scrollable `role="region"` with `tabIndex={0}`.
- **Mobile (`375 px`)**: Compact 1-column layout. Tab switcher displays as a horizontal touch-friendly pill bar. All buttons maintain $\ge 44 \times 44\text{ px}$ touch targets. Zero horizontal scroll.

---

## 7. Accessibility & WCAG 2.1 AA Checklist

- [x] **Contrast AA/AAA**: All warning (`#F59E0B`) and danger (`#C62828`) text tokens achieve $\ge 4.5:1$ contrast against their respective tinted backgrounds.
- [x] **WCAG 2.5.3 (Label in Name)**: Button accessible names strictly match visible text (no divergent `aria-label`).
- [x] **WCAG 2.4.7 (Focus Visible)**: Clear focus rings (`focus-ring`) on all buttons, tabs, and interactive accordions.
- [x] **Keyboard Navigation**: Full tab order through state tabs, action buttons, diagnostic accordions, and table regions.
- [x] **Screen Reader Alerts**: Dynamic state changes and crash notices announced via `role="status"` and `role="alert"` with `aria-live="polite"`.

---

## 8. Edge Cases, Fault Injection & Offline Recovery

- **Corrupted Local Storage**: Error boundary catches parsing failures and offers safe fallback defaults.
- **Simultaneous Offline + Error**: Handles simultaneous network loss and component crash with tiered fallback notices.
- **Full Offline Routing**: All 404, offline, and error screens are statically bundled in the client and require zero external network calls.

---

## 9. Data Contracts & Store Slices

- **`SystemDiagnosticPayload`**:
  ```ts
  export interface SystemDiagnosticPayload {
    timestamp: string
    route: string
    theme: string
    dimensionPreset: string
    activePersona: string
    offlineBufferedEvents: number
    userAgent: string
    errorMessage?: string
    componentStack?: string
  }
  ```
- **`AppState`** (from `frontend/src/store/useAppStore.ts`):
  - `simulateOffline: boolean`
  - `simulateLlmDown: boolean`
  - `resetDemoState: () => void`

---

## 10. Definition of Done Checklist (10 Items)

- [x] **DoD 01**: Author `frontend/src/components/layout/ErrorBoundary.tsx` to catch unhandled React rendering errors.
- [x] **DoD 02**: Author `frontend/src/pages/SystemPage.tsx` supporting 404, Offline, and Error Boundary sub-views.
- [x] **DoD 03**: Wire `/system`, `/system/404`, `/system/offline`, `/system/error`, and catch-all `*` in `frontend/src/App.tsx`.
- [x] **DoD 04**: Implement interactive 404 wayfinder with quick-jump navigation cards and companion Mascot.
- [x] **DoD 05**: Implement live Offline Resilience hub with telemetry queue counter, simulation controls, and sync animation.
- [x] **DoD 06**: Implement Error Boundary test bench with interactive simulated crash trigger and copy diagnostic JSON action.
- [x] **DoD 07**: Render keyboard-scrollable Diagnostic & Recovery Log Table (`role="region"` with `tabIndex={0}`).
- [x] **DoD 08**: Add unit test in `designSystem.test.tsx` verifying 404 navigation, offline queue simulation, and error boundary recovery.
- [x] **DoD 09**: Author Playwright E2E suite `frontend/e2e/system.spec.ts` verifying all 3 viewports (375, 768, 1440 px), dark mode, and 0 `axe-core` violations.
- [x] **DoD 10**: Pass all QA checks (`npm run qa:checks`) with 0 errors, 0 overflow, and save 5 verification screenshots to `docs/ui/screenshots/17-system-*.png`.

---

## 11. Design Critique Self-Review (Rounds 1 & 2)

### Round 1 (Picky Designer)
- **Empathetic & Reassuring Visuals**: Eliminated harsh default red-box alerts in favor of gentle Playful Lab card elevation, warm ink typography, and the friendly geometric mascot in calm resting posture (`state="rest"`).
- **Token Consistency**: All error and warning tints utilize semantic design tokens (`border-danger/30`, `bg-danger/10`, `bg-warning/10`, `bg-brand`) with zero hardcoded arbitrary pixel brackets.
- **Accessible Typography**: Tabular diagnostic identifiers and event timestamps utilize `font-mono`, page titles use `font-display` (Fredoka), and narrative explanations use `font-sans` (Lexend).
- **Collapsible Diagnostics**: Complex sanitized technical stack traces are neatly tucked inside an accessible `<details>` accordion so technical evaluators have full audit access without cluttering standard user guidance.

### Round 2 (Hostile Juror)
- **Zero White-Screen Guarantee**: Verified via interactive component crash simulation that throwing an unhandled exception inside a component subtree isolates the failure cleanly inside the `<ErrorBoundary />` while keeping the primary `AppShell` header, navigation, and theme switches 100% operational.
- **Observable Telemetry Queueing**: Evaluators can observe the live buffer counter advance from `14/500` to `15/500` and flush to `0/500` in real time, proving that in-flight trial observations are preserved without network connectivity.
- **Catch-All 404 Routing**: Navigating to any unregistered route automatically presents the intelligent 404 Wayfinder with 4 prominent return paths (`/`, `/dashboard`, `/coach`, `/judge-mode`), preventing broken navigation traps.

---

## 12. Verification & Screenshots
- **1440px Desktop (Playful Lab — 404 Wayfinder)**: [`17-system-1440.png`](../screenshots/17-system-1440.png)
- **Offline Resilience Hub & Telemetry Queue**: [`17-system-offline.png`](../screenshots/17-system-offline.png)
- **Error Boundary Intercepted & Self-Healing**: [`17-system-error.png`](../screenshots/17-system-error.png)
- **1440px Dark Mode (Night Lab)**: [`17-system-dark.png`](../screenshots/17-system-dark.png)
- **768px Tablet Viewport**: [`17-system-768.png`](../screenshots/17-system-768.png)
- **375px Mobile Viewport**: [`17-system-375.png`](../screenshots/17-system-375.png)
