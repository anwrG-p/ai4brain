"""Dynamic UX Sandbox Renderer.

Generates self-contained, CSP-compliant HTML5/Canvas/SVG execution runtimes
for isomorphic cognitive exercises adhering to the Doodle (Hand Drawn) Design System
from ai4brain-main. Binds millisecond-accurate performance.now() event telemetry
listeners and communicates bi-directionally with parent via postMessage.
"""

from typing import Dict, Any, Optional
import json

from app.models.task_schema import TaskConfigPayload, TaskType


class UXSandboxRenderer:
    """Produces isolated iframe HTML payloads adhering to the Doodle (Hand Drawn) Design System."""

    @classmethod
    def render_sandboxed_runtime_html(cls, task_payload: TaskConfigPayload) -> str:
        """Renders complete self-contained HTML runtime document to be embedded in an iframe."""
        task_json = task_payload.model_dump_json()

        html_content = f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy" content="default-src 'self' 'unsafe-inline' data: https://fonts.googleapis.com https://fonts.gstatic.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' data: https://fonts.gstatic.com; connect-src *;">
  <title>AI4Brain Cognitive Sandbox - {task_payload.task_type.value}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Delius&family=Delius+Swash+Caps&family=JetBrains+Mono:wght@400;600;700&display=swap" rel="stylesheet">
  <style>
    :root {{
      /* Doodle (Hand Drawn) Design System Tokens */
      --color-canvas: #FFF5EE;
      --color-surface: #FFFFFF;
      --color-surface-raised: #FDF0E7;
      --color-ink: #111827;
      --color-ink-muted: #4B5E78;
      --color-border: #E7DFD8;
      --color-border-strong: #263D5B;
      --color-brand: #E86A33;
      --color-brand-hover: #D55823;
      --color-brand-subtle: #FDF2EB;
      --color-brand-ink: #111827;
      --color-secondary: #263D5B;
      --color-reward: #FFC83D;
      --color-warning: #D97706;
      --color-warning-subtle: #FFFBEB;
      --color-danger: #DC2626;

      --shadow-doodle: 3px 3px 0 #263D5B;
      --shadow-doodle-lg: 4px 4px 0 #263D5B;
      --shadow-tactile: 3px 3px 0 #263D5B;
      --shadow-tactile-active: 1px 1px 0 #263D5B;

      --font-display: 'Delius Swash Caps', 'Delius', cursive, sans-serif;
      --font-sans: 'Delius', cursive, sans-serif;
      --font-mono: 'JetBrains Mono', ui-monospace, monospace;

      --ease-snappy: cubic-bezier(0.16, 1, 0.3, 1);
    }}

    [data-theme="dark"] {{
      --color-canvas: #131B2E;
      --color-surface: #1E293B;
      --color-surface-raised: #27354A;
      --color-ink: #FFFFFF;
      --color-ink-muted: #CBD5E1;
      --color-border: #3B4D68;
      --color-border-strong: #FF8C5A;
      --color-brand: #FF8C5A;
      --color-brand-hover: #FFA47A;
      --color-brand-subtle: #2D1A14;
      --color-brand-ink: #131B2E;
      --color-secondary: #E7DFD8;
      --color-reward: #FFC83D;
      --shadow-doodle: 3px 3px 0 #FF8C5A;
      --shadow-doodle-lg: 4px 4px 0 #FF8C5A;
      --shadow-tactile: 3px 3px 0 #FF8C5A;
      --shadow-tactile-active: 1px 1px 0 #FF8C5A;
    }}

    * {{
      box-sizing: border-box;
      margin: 0;
      padding: 0;
      user-select: none;
      -webkit-user-select: none;
    }}

    body {{
      background-color: var(--color-canvas);
      background-image: radial-gradient(rgba(38, 61, 91, 0.09) 0.8px, transparent 0.8px);
      background-size: 24px 24px;
      color: var(--color-ink);
      font-family: var(--font-sans);
      overflow: hidden;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      width: 100vw;
    }}

    .trial-progress-track {{
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 4px;
      background: var(--color-border);
      border-bottom: 1px solid var(--color-border-strong);
      z-index: 100;
    }}

    .trial-progress-bar {{
      height: 100%;
      background: var(--color-brand);
      width: 0%;
      transition: width 150ms var(--ease-snappy);
    }}

    .arena-container {{
      width: 90%;
      max-width: 680px;
      min-height: 480px;
      background-color: var(--color-surface);
      border: 2px solid var(--color-border-strong);
      border-radius: 16px;
      box-shadow: 5px 5px 0 var(--color-border-strong);
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      position: relative;
      padding: 32px 24px;
    }}

    .doodle-badge {{
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 4px 12px;
      border-radius: 9999px;
      border: 2px solid var(--color-border-strong);
      background: var(--color-surface-raised);
      font-size: 11px;
      font-family: var(--font-mono);
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      margin-bottom: 12px;
    }}

    .fixation-cross {{
      font-size: 46px;
      color: var(--color-border-strong);
      font-family: var(--font-mono);
      font-weight: 700;
      transition: opacity 100ms ease;
    }}

    .stimulus-card {{
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 20px;
      animation: doodlePop 140ms var(--ease-snappy);
    }}

    .symbol-token {{
      font-size: 48px;
      font-family: var(--font-display);
      font-weight: 700;
      color: var(--color-ink);
      background: var(--color-surface);
      border: 2.5px solid var(--color-border-strong);
      border-radius: 16px;
      padding: 24px 52px;
      box-shadow: var(--shadow-doodle);
    }}

    .relational-display {{
      font-size: 28px;
      font-family: var(--font-sans);
      font-weight: 700;
      display: flex;
      align-items: center;
      gap: 16px;
    }}

    .relational-token {{
      background: var(--color-surface-raised);
      color: var(--color-ink);
      border: 2px solid var(--color-border-strong);
      border-radius: 12px;
      padding: 12px 28px;
      box-shadow: var(--shadow-doodle);
    }}

    .relational-operator {{
      color: var(--color-brand);
      font-size: 38px;
      font-weight: 700;
    }}

    .relational-badge {{
      font-family: var(--font-mono);
      font-size: 12px;
      font-weight: 600;
      padding: 6px 14px;
      border-radius: 9999px;
      border: 2px solid var(--color-border-strong);
      color: var(--color-brand);
      background: var(--color-brand-subtle);
      box-shadow: 2px 2px 0 var(--color-border-strong);
      letter-spacing: 0.04em;
    }}

    .rule-inversion-badge {{
      border-color: var(--color-warning);
      color: #92400E;
      background: var(--color-warning-subtle);
    }}

    .instruction-overlay {{
      text-align: center;
      max-width: 500px;
      display: flex;
      flex-direction: column;
      align-items: center;
    }}

    .instruction-overlay h2 {{
      font-family: var(--font-display);
      font-size: 24px;
      font-weight: 700;
      color: var(--color-ink);
      margin-bottom: 12px;
      letter-spacing: -0.01em;
    }}

    .instruction-overlay p {{
      font-size: 15px;
      line-height: 1.6;
      color: var(--color-ink-muted);
      margin-bottom: 24px;
    }}

    .tactile-btn {{
      background: var(--color-brand);
      border: 2px solid var(--color-border-strong);
      color: var(--color-brand-ink);
      border-radius: 8px;
      padding: 12px 28px;
      font-family: var(--font-display);
      font-size: 15px;
      font-weight: 700;
      cursor: pointer;
      box-shadow: var(--shadow-tactile);
      transition: transform 120ms ease, box-shadow 120ms ease, background-color 120ms ease;
      letter-spacing: 0.02em;
    }}

    .tactile-btn:hover {{
      transform: translate(-1px, -1px);
      box-shadow: var(--shadow-doodle-lg);
      background: var(--color-brand-hover);
    }}

    .tactile-btn:active {{
      transform: translate(2px, 2px);
      box-shadow: var(--shadow-tactile-active);
    }}

    .tactile-btn-secondary {{
      background: var(--color-surface);
      color: var(--color-ink);
    }}

    .tactile-btn-secondary:hover {{
      background: var(--color-surface-raised);
    }}

    .response-controls {{
      position: absolute;
      bottom: 24px;
      display: flex;
      gap: 20px;
    }}

    .key-badge {{
      font-family: var(--font-mono);
      font-size: 11px;
      color: var(--color-ink-muted);
      margin-top: 6px;
      text-align: center;
      font-weight: 500;
    }}

    .tabular-nums {{
      font-family: var(--font-mono);
      font-variant-numeric: tabular-nums;
    }}

    .mascot-icon {{
      width: 48px;
      height: 48px;
      margin-bottom: 12px;
    }}

    @keyframes doodlePop {{
      0% {{ opacity: 0; transform: scale(0.94); }}
      100% {{ opacity: 1; transform: scale(1.0); }}
    }}
  </style>
</head>
<body>
  <div class="trial-progress-track">
    <div class="trial-progress-bar" id="progressBar"></div>
  </div>

  <div class="arena-container" id="arena">
    <div id="introScreen" class="instruction-overlay">
      <!-- Brian Mascot SVG Emblem -->
      <svg class="mascot-icon" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M24 6C16 6 10 12 10 20C10 25 13 29 17 32V38C17 39.1 17.9 40 19 40H29C30.1 40 31 39.1 31 38V32C35 29 38 25 38 20C38 12 32 6 24 6Z" fill="#FDF0E7" stroke="#263D5B" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
        <circle cx="19" cy="20" r="2.5" fill="#263D5B"/>
        <circle cx="29" cy="20" r="2.5" fill="#263D5B"/>
        <path d="M21 26C22.5 27.5 25.5 27.5 27 26" stroke="#263D5B" stroke-width="2" stroke-linecap="round"/>
        <path d="M19 43H29" stroke="#E86A33" stroke-width="2.5" stroke-linecap="round"/>
      </svg>
      <div class="doodle-badge">Cognitive Assessment &amp; Training</div>
      <h2 id="taskTitle">{task_payload.task_type.value}</h2>
      <p id="taskInstructions">{task_payload.instructions[0] if task_payload.instructions else "Focus on the stimulus and respond accurately."}</p>
      <button class="tactile-btn" id="startBtn" onclick="startTask()">START TEST BLOCK (SPACE)</button>
    </div>

    <div id="trialScreen" style="display: none; width: 100%; height: 100%; display: flex; flex-direction: column; align-items: center; justify-content: center;">
      <div id="fixationCross" class="fixation-cross">+</div>
      <div id="stimulusBox" class="stimulus-card" style="display: none;"></div>
      
      <div class="response-controls" id="responseControls" style="display: none;">
        <div>
          <button class="tactile-btn" id="btnLeft" onclick="handleManualResponse(0)">MATCH [A]</button>
          <div class="key-badge">KEY: 'A' or &larr;</div>
        </div>
        <div>
          <button class="tactile-btn tactile-btn-secondary" id="btnRight" onclick="handleManualResponse(1)">NO MATCH [L]</button>
          <div class="key-badge">KEY: 'L' or &rarr;</div>
        </div>
      </div>
    </div>
  </div>

  <script>
    const TASK_DATA = {task_json};
    let currentTrialIdx = 0;
    let stimulusPresentedAt = 0;
    let trialActive = false;
    let collectedTrials = [];
    let frameDrops = 0;
    let blurEvents = 0;
    let animationFrameId = null;
    let lastFrameTime = performance.now();

    window.addEventListener('blur', () => {{ blurEvents++; }});

    // Frame drop telemetry tracker
    function monitorFrameRate(now) {{
      const delta = now - lastFrameTime;
      if (delta > 34) {{ // Dropped 60fps frame threshold (>33.3ms)
        frameDrops++;
      }}
      lastFrameTime = now;
      if (trialActive) {{
        animationFrameId = requestAnimationFrame(monitorFrameRate);
      }}
    }}

    function startTask() {{
      document.getElementById('introScreen').style.display = 'none';
      document.getElementById('trialScreen').style.display = 'flex';
      currentTrialIdx = 0;
      collectedTrials = [];
      runNextTrial();
    }}

    function updateProgressBar() {{
      const pct = (currentTrialIdx / TASK_DATA.trials.length) * 100;
      document.getElementById('progressBar').style.width = pct + '%';
    }}

    function runNextTrial() {{
      if (currentTrialIdx >= TASK_DATA.trials.length) {{
        finishSession();
        return;
      }}

      updateProgressBar();
      const trial = TASK_DATA.trials[currentTrialIdx];
      const fixationEl = document.getElementById('fixationCross');
      const stimBox = document.getElementById('stimulusBox');
      const controls = document.getElementById('responseControls');

      // 1. Fixation cross
      fixationEl.style.display = 'block';
      stimBox.style.display = 'none';
      controls.style.display = 'none';
      trialActive = false;

      setTimeout(() => {{
        // 2. Stimulus Presentation
        fixationEl.style.display = 'none';
        stimBox.style.display = 'flex';
        controls.style.display = 'flex';

        renderStimulus(trial, stimBox);
        stimulusPresentedAt = performance.now();
        trialActive = true;
        lastFrameTime = performance.now();
        animationFrameId = requestAnimationFrame(monitorFrameRate);

        // Bind timeout deadline
        const deadline = TASK_DATA.timing_rules.response_deadline_ms || 2500;
        trial.timer = setTimeout(() => {{
          if (trialActive) {{
            recordResponse(null, deadline, false);
          }}
        }}, deadline);

      }}, TASK_DATA.timing_rules.fixation_ms || 450);
    }}

    function renderStimulus(trial, container) {{
      container.innerHTML = '';
      if (TASK_DATA.task_type === 'RELATIONAL_RESPONDING_RFT') {{
        const d = trial.stimulus_display;
        const isSwitched = d.rule_modifier === 'INVERTED_LOGIC';
        container.innerHTML = `
          <div class="relational-badge ${{isSwitched ? 'rule-inversion-badge' : ''}}">
            ${{d.rule_modifier}} (DEPTH ${{d.transitive_distance}})
          </div>
          <div class="relational-display">
            <span class="relational-token">${{d.first_token}}</span>
            <span class="relational-operator">${{d.relation_query === 'GREATER_THAN' ? '&gt;' : '&lt;'}}</span>
            <span class="relational-token">${{d.second_token}}</span>
          </div>
        `;
        document.getElementById('btnLeft').innerText = "TRUE [A]";
        document.getElementById('btnRight').innerText = "FALSE [L]";
      }} else {{
        // N-Back
        const d = trial.stimulus_display;
        container.innerHTML = `
          <div class="symbol-token">${{d.token}}</div>
          <div class="tabular-nums" style="font-size: 13px; color: var(--color-ink-muted);">
            GRID POS: ${{d.spatial_pos}} | ${{d.n_back_order}}-BACK
          </div>
        `;
        document.getElementById('btnLeft').innerText = "MATCH [A]";
        document.getElementById('btnRight').innerText = "NO MATCH [L]";
      }}
    }}

    function recordResponse(responseKey, rtMs, isCorrect) {{
      if (!trialActive) return;
      trialActive = false;
      cancelAnimationFrame(animationFrameId);

      const trial = TASK_DATA.trials[currentTrialIdx];
      clearTimeout(trial.timer);

      const isTarget = trial.target_present;
      const userRespBool = (responseKey === 'MATCH' || responseKey === 'TRUE');
      const correct = (responseKey === trial.correct_key);

      const eventPayload = {{
        trial_index: currentTrialIdx,
        stimulus_id: trial.stimulus_id,
        stimulus_features: {{
          spatial_pos: trial.stimulus_display.spatial_pos || null,
          is_lure: trial.is_lure || false,
          lure_offset: trial.lure_type === 'N-1' ? -1 : (trial.lure_type === 'N+1' ? 1 : null),
          relation_type: trial.stimulus_display.relation_query || null,
          node_depth: trial.stimulus_display.transitive_distance || null,
          rule_switched: trial.stimulus_display.rule_modifier === 'INVERTED_LOGIC',
        }},
        target_present: isTarget,
        user_response: userRespBool,
        is_correct: correct,
        reaction_time_ms: Math.round(rtMs * 100) / 100,
        non_decision_time_est_ms: 140.0,
        device_telemetry: {{
          input_type: responseKey ? "keyboard" : "timeout",
          frame_drops: frameDrops,
          blur_events: blurEvents
        }}
      }};

      collectedTrials.push(eventPayload);

      // Post trial-level event to parent frame
      window.parent.postMessage({{
        type: 'TRIAL_TELEMETRY',
        data: eventPayload
      }}, '*');

      currentTrialIdx++;
      setTimeout(runNextTrial, TASK_DATA.timing_rules.inter_stimulus_interval_ms || 400);
    }}

    function handleManualResponse(choiceIdx) {{
      if (!trialActive) return;
      const rt = performance.now() - stimulusPresentedAt;
      let key = null;
      if (TASK_DATA.task_type === 'RELATIONAL_RESPONDING_RFT') {{
        key = choiceIdx === 0 ? 'TRUE' : 'FALSE';
      }} else {{
        key = choiceIdx === 0 ? 'MATCH' : 'NO_MATCH';
      }}
      recordResponse(key, rt, false);
    }}

    // Bind physical keyboard listeners
    window.addEventListener('keydown', (e) => {{
      if (!trialActive && e.code === 'Space') {{
        const btn = document.getElementById('startBtn');
        if (btn && btn.offsetParent !== null) startTask();
        return;
      }}
      if (!trialActive) return;
      if (e.key === 'a' || e.key === 'A' || e.key === 'ArrowLeft') {{
        handleManualResponse(0);
      }} else if (e.key === 'l' || e.key === 'L' || e.key === 'ArrowRight') {{
        handleManualResponse(1);
      }}
    }});

    function finishSession() {{
      document.getElementById('trialScreen').style.display = 'none';
      document.getElementById('arena').innerHTML = `
        <div class="instruction-overlay">
          <!-- Brian Mascot Celebrating -->
          <svg class="mascot-icon" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M24 6C16 6 10 12 10 20C10 25 13 29 17 32V38C17 39.1 17.9 40 19 40H29C30.1 40 31 39.1 31 38V32C35 29 38 25 38 20C38 12 32 6 24 6Z" fill="#FDF2EB" stroke="#263D5B" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
            <path d="M12 24L6 18M36 24L42 18" stroke="#E86A33" stroke-width="2.5" stroke-linecap="round"/>
            <circle cx="19" cy="20" r="2.5" fill="#263D5B"/>
            <circle cx="29" cy="20" r="2.5" fill="#263D5B"/>
            <path d="M20 26C21.5 28.5 26.5 28.5 28 26" stroke="#263D5B" stroke-width="2.5" stroke-linecap="round"/>
            <path d="M19 43H29" stroke="#FFC83D" stroke-width="2.5" stroke-linecap="round"/>
          </svg>
          <div class="doodle-badge" style="color: var(--color-brand)">Great Effort!</div>
          <h2>Session Block Complete</h2>
          <p>Sub-second telemetry has been securely ingested for computational psychometrics and brain state adaptation.</p>
          <div class="tabular-nums" style="font-size: 13px; color: var(--color-ink-muted); margin-top: 8px;">
            TOTAL TRIALS: ${{collectedTrials.length}} &bull; FRAME DROPS: ${{frameDrops}}
          </div>
        </div>
      `;

      // Dispatch full session telemetry to parent orchestrator
      window.parent.postMessage({{
        type: 'SESSION_COMPLETE',
        data: {{
          task_id: TASK_DATA.task_id,
          task_type: TASK_DATA.task_type,
          trials: collectedTrials
        }}
      }}, '*');
    }}
  </script>
</body>
</html>
"""
        return html_content
