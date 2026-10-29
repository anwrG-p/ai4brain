import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Mascot, type MascotState } from '../components/features/brand/Mascot'
import { WhyThisPanel } from '../components/features/coach/WhyThisPanel'
import { Badge } from '../components/ui/Badge'
import { Button } from '../components/ui/Button'
import { Card } from '../components/ui/Card'
import { DoodleSquiggle } from '../components/ui/DoodleDecorations'
import { getDimensionsByPreset } from '../config/dimensions'
import type { DimensionConfig, WhyThisTrail } from '../types'
import { buildEstimatesForDimensions } from '../services/mocks/fixtures'
import { useAppStore, type PersonaId } from '../state/useAppStore'
import {
  lintCopyText,
  SAMPLE_GUARDRAIL_INTERCEPTION_INPUT,
} from '../utils/copyLinter'

type CoachPreviewState =
  | 'live'
  | 'fallback-mode'
  | 'rest-pacing'
  | 'loading'
  | 'empty'
  | 'error'
  | 'extreme-text'

interface CoachTurnSpec {
  id: string
  topicChipLabel: string
  userPrompt: string
  dimensionCode: string
  dimensionId: string
  headline: string
  coachingBody: string
  actionLabel: string
  actionRoute: string
  mascotState: MascotState
  whyThis: WhyThisTrail
}

const PERSONA_OPTIONS: { id: PersonaId; label: string }[] = [
  { id: 'steady-improver', label: 'Youssef (Balanced)' },
  { id: 'new-user', label: 'Salma (First Session)' },
  { id: 'noisy-low-confidence', label: 'Rami (High Fatigue)' },
  { id: 'edge-missing-dim', label: 'Partial (Missing Dim)' },
  { id: 'edge-10-dimensions', label: '10-Dim Stress' },
]

const SEEDED_COACH_TURNS: CoachTurnSpec[] = [
  {
    id: 'turn-hatched-ep',
    topicChipLabel: '1 · Why Hatched? (EP <60%)',
    userPrompt: 'Why is my Episodic Pattern Separation band hatched (<60%)?',
    dimensionCode: 'EP',
    dimensionId: 'episodic_pattern_separation',
    headline:
      'Narrow Episodic Pattern Separation (±16% → ±6% CI) with 4 Lure-Discrimination Trials',
    coachingBody:
      'Your Episodic Pattern Separation axis is currently shown with diagonal SVG hatching because only 4 lure-discrimination trials have been logged so far (48% confidence). Running one 90-second Mnemonic Similarity micro-block will reduce QUEST+ posterior entropy and graduate your band to a solid fill.',
    actionLabel: 'Launch 90s EP Calibration Block →',
    actionRoute: '/task/episodic_pattern_separation',
    mascotState: 'thinking',
    whyThis: {
      id: 'why-coach-ep',
      observedData: [
        'Episodic Pattern Separation sample size is n = 4 trials (48% epistemic confidence, ±16% CI band).',
        'Old vs Similar Lure discrimination accuracy is 75% with 540 ms normalized reaction time.',
        'Working Memory (WM) and Attention Networks (AN) are already above 80% confidence.',
      ],
      inference:
        'SAT-JEPA differential vector (Δc) identifies Episodic Pattern Separation as the highest-information-gain probe to stabilize your Focused Builder cluster.',
      recommendation:
        'Schedule a 90-second Mnemonic Similarity Task (Old / Similar Lure / New) at Staircase Level 3 before increasing dual-stream N-Back load.',
      confidence: 0.86,
      counterfactual:
        'If 2+ consecutive lure false-alarms occur or hesitation jitter exceeds 160 ms, the staircase will step back to Level 2 high-salience anchors automatically.',
      sourceModule: 'sat_jepa_delta_c',
    },
  },
  {
    id: 'turn-peak-window',
    topicChipLabel: '2 · Peak Focus Window',
    userPrompt: 'Optimize my study window based on my Fatigue Heatmap',
    dimensionCode: 'AN',
    dimensionId: 'attention_networks',
    headline:
      'Schedule High-Load Set-Shifting in Your 09:00–11:30 Morning Peak Window',
    coachingBody:
      'Across your last 14 sessions, morning check-ins show a 91% alertness index (mean normalized RT: 512 ms, jitter: 38 ms), compared to 68% after 19:30. Pairing complex rule-switching or synthesis work with your morning window maximizes transfer while keeping evening sessions light.',
    actionLabel: 'Inspect Adaptive Weekly Plan →',
    actionRoute: '/plan',
    mascotState: 'celebrate',
    whyThis: {
      id: 'why-coach-window',
      observedData: [
        'Morning window (08:00–12:00) readiness index averages 91% across Mon–Thu.',
        'Evening window (18:00–22:00) shows +94 ms reaction-time drift and +42 ms hesitation jitter.',
      ],
      inference:
        'Circadian telemetry indicates executive inhibition and set-shifting efficiency peak during the first 4 hours of your waking schedule.',
      recommendation:
        'Reserve Level 4 Cognitive Flexibility blocks for 09:00–11:30 and use 60-second maintenance check-ins in the evening.',
      confidence: 0.89,
      counterfactual:
        'If 3 consecutive evening blocks log normalized RT within 5% of your morning baseline, the peak window recommendation will expand to dual-window.',
      sourceModule: 'quest_staircase',
    },
  },
  {
    id: 'turn-collab-verify',
    topicChipLabel: '3 · Verification Habits',
    userPrompt: 'How can I raise my AI Collaboration Verification sub-score?',
    dimensionCode: 'IC',
    dimensionId: 'inhibition_control',
    headline:
      'Strengthen Your Verification Habits with Counter-Example Checks',
    coachingBody:
      'In your Human-AI Collaboration index, Verification carries high importance (25%) and dynamically scales to 28% when Inhibition Control is active. Before accepting an AI-generated synthesis or code block, run one explicit boundary-case check or ask for a disconfirming test case.',
    actionLabel: 'Explore Collaboration Metrics →',
    actionRoute: '/collaboration',
    mascotState: 'hello',
    whyThis: {
      id: 'why-coach-collab',
      observedData: [
        'Verification sub-score is 82/100 (weight: 25% base, 28% dynamic w_i(s_t)).',
        'Inhibition Control Stroop suppression accuracy is 88% with low impulsive-error rate (6%).',
      ],
      inference:
        'Strong prepotent impulse suppression transfers directly to catching plausible-sounding AI hallucinations during rapid iteration.',
      recommendation:
        'Add a 1-step assertion or source-check prompt after every complex AI output to raise Verification from 82 to 90+.',
      confidence: 0.81,
      counterfactual:
        'If unverified acceptances exceed 30% of interactions in a session, the coach will suggest a 60-second verification checklist.',
      sourceModule: 'collab_scorer',
    },
  },
  {
    id: 'turn-rest-pacing',
    topicChipLabel: '4 · Rest-First Pacing',
    userPrompt: 'High hesitation jitter (>110 ms) — switch to Rest-First Pacing',
    dimensionCode: 'WM',
    dimensionId: 'working_memory',
    headline:
      'Rest-First Pacing Engaged — Pausing Staircase Escalation Is Smart Calibration',
    coachingBody:
      'High hesitation jitter detected—pausing difficulty progression is a smart calibration choice, never a penalty. When response-time variance rises above 110 ms, stepping back for a 5-minute eyes-off-screen reset protects your 95% confidence bands from fatigue noise.',
    actionLabel: 'Review Dashboard Fatigue Heatmap →',
    actionRoute: '/dashboard',
    mascotState: 'rest',
    whyThis: {
      id: 'why-coach-rest',
      observedData: [
        'Last micro-block recorded hesitation jitter of 124 ms (baseline: 44 ms).',
        'Error-burst recovery remained intact (0 consecutive bursts), indicating temporary fatigue rather than skill drift.',
      ],
      inference:
        'Continuing high-load trials during elevated jitter widens ±CI bands without adding signal to your SAT-JEPA latent state.',
      recommendation:
        'Take a 5-minute screen break now; your next block will resume at a comfortable Level 2 maintenance pace.',
      confidence: 0.92,
      counterfactual:
        'Once hesitation jitter returns below 65 ms on a 3-trial warm-up, Level 3 adaptive progression re-engages automatically.',
      sourceModule: 'quest_staircase',
    },
  },
]

function buildDimensionCoachTurn(
  dim: DimensionConfig,
  scorePct: number,
  halfCi: number,
  confidencePct: number,
): CoachTurnSpec {
  const isHatched = confidencePct < 60
  return {
    id: `turn-dim-${dim.id}`,
    topicChipLabel: `${dim.code} · ${dim.name}`,
    userPrompt: `How should I calibrate and apply my ${dim.name} (${dim.code}) estimate?`,
    dimensionCode: dim.code,
    dimensionId: dim.id,
    headline: isHatched
      ? `Calibrate ${dim.name} (${scorePct}% ± ${halfCi}%) to Graduate from Hatched to Solid`
      : `Leverage Your Solid ${dim.name} (${scorePct}% ± ${halfCi}%) in Deep Focus Blocks`,
    coachingBody: `${dim.scientificDefinition} Your current estimate is ${scorePct}% ± ${halfCi}% (${confidencePct}% epistemic confidence). ${
      isHatched
        ? `Because confidence is below 60%, this axis uses diagonal hatching. Completing one 90-second ${dim.taskName} block will narrow your ±CI band fastest.`
        : `With solid confidence (${confidencePct}%), your QUEST+ staircase is ready for steady 85%-accuracy maintenance on ${dim.taskName}.`
    }`,
    actionLabel: `Run ${dim.code} Micro-Block (${dim.taskName}) →`,
    actionRoute: `/task/${dim.id}`,
    mascotState: isHatched ? 'thinking' : 'celebrate',
    whyThis: {
      id: `why-dim-${dim.id}`,
      observedData: [
        `${dim.name} (${dim.code}) current estimate: ${scorePct}% ± ${halfCi}% (${confidencePct}% confidence).`,
        `Primary assessment task: ${dim.taskName} (${dim.scoringMethod}).`,
        `Known measurement consideration: ${dim.knownBiases[0] ?? 'Normalized for device input latency.'}`,
      ],
      inference: `SAT-JEPA differential vector (Δc) maps ${dim.name} to your active cognitive cluster with ${
        isHatched ? 'high exploration priority' : 'high stability weight'
      }.`,
      recommendation: isHatched
        ? `Complete 4 adaptive trials of ${dim.taskName} to reduce uncertainty below ±8%.`
        : `Pair ${dim.name} strengths with structured verification habits during complex problem solving.`,
      confidence: Number((confidencePct / 100).toFixed(2)),
      counterfactual:
        'If reaction-time jitter rises above 120 ms, the scheduler will automatically insert a rest-first pacing checkpoint.',
      sourceModule: 'sat_jepa_delta_c',
    },
  }
}

export default function AiCoachPage() {
  const {
    dimensionPreset,
    setDimensionPreset,
    activePersona,
    setActivePersona,
    showMascot,
    simulateLlmDown,
    setSimulateLlmDown,
  } = useAppStore()

  const [previewState, setPreviewState] = useState<CoachPreviewState>('live')
  const [activeTurn, setActiveTurn] = useState<CoachTurnSpec>(
    SEEDED_COACH_TURNS[0]!,
  )
  const [customPrompt, setCustomPrompt] = useState<string>('')
  const [showCoachTable, setShowCoachTable] = useState<boolean>(false)
  const [testInterceptionMode, setTestInterceptionMode] =
    useState<boolean>(false)

  const activeDimensions = useMemo(
    () => getDimensionsByPreset(dimensionPreset),
    [dimensionPreset],
  )

  const estimates = useMemo(
    () => buildEstimatesForDimensions(activeDimensions, activePersona),
    [activeDimensions, activePersona],
  )

  // Effective trail dynamically switches sourceModule when simulateLlmDown is true
  const effectiveWhyThis: WhyThisTrail = useMemo(() => {
    if (simulateLlmDown || previewState === 'fallback-mode') {
      return {
        ...activeTurn.whyThis,
        sourceModule: 'deterministic_fallback',
        inference: `[Deterministic Rule Engine Fallback] ${activeTurn.whyThis.inference}`,
      }
    }
    return activeTurn.whyThis
  }, [activeTurn, simulateLlmDown, previewState])

  // Live guardrail check on either the active coach body or the interception test string
  const guardrailReport = useMemo(() => {
    if (testInterceptionMode) {
      return lintCopyText(SAMPLE_GUARDRAIL_INTERCEPTION_INPUT)
    }
    return lintCopyText(
      `${activeTurn.headline} ${activeTurn.coachingBody} ${effectiveWhyThis.recommendation}`,
    )
  }, [activeTurn, effectiveWhyThis, testInterceptionMode])

  const handleCustomPromptSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const trimmed = customPrompt.trim()
    if (!trimmed) return

    const matchedDim =
      activeDimensions.find(
        (d) =>
          trimmed.toLowerCase().includes(d.name.toLowerCase()) ||
          trimmed.toLowerCase().includes(d.code.toLowerCase()),
      ) ?? activeDimensions[0]!

    const est = estimates.find((x) => x.dimensionId === matchedDim.id)
    const scorePct = est?.scorePct ?? 76
    const halfCi = est
      ? Math.max(4, Math.round((est.ciUpperPct - est.ciLowerPct) / 2))
      : 7
    const confPct = Math.round((est?.confidence ?? 0.78) * 100)

    const generated = buildDimensionCoachTurn(
      matchedDim,
      scorePct,
      halfCi,
      confPct,
    )
    setActiveTurn({
      ...generated,
      userPrompt: trimmed,
    })
    setCustomPrompt('')
  }

  return (
    <div className="space-y-8 min-w-0">
      {/* 1. HERO HEADER & ENGINE / STATE SWITCHER */}
      <Card
        as="section"
        aria-labelledby="ai-coach-heading"
        className="p-6 space-y-5 min-w-0"
      >
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-2 max-w-3xl min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone="reward" glyph="★">
                Layer B Explainable AI Coach · Non-Clinical Guardrail Active
              </Badge>
              <Badge
                tone={
                  simulateLlmDown || previewState === 'fallback-mode'
                    ? 'info'
                    : 'brand'
                }
                glyph={
                  simulateLlmDown || previewState === 'fallback-mode'
                    ? '⚙'
                    : '●'
                }
              >
                {simulateLlmDown || previewState === 'fallback-mode'
                  ? 'Engine: Deterministic Rule Fallback'
                  : 'Engine: SAT-JEPA + LLM Grounded'}
              </Badge>
              <Badge tone="success" glyph="✓">
                Copy Linter: 0 Violations
              </Badge>
            </div>
            <h1
              id="ai-coach-heading"
              className="font-display text-3xl sm:text-4xl font-bold text-ink tracking-tight break-words"
            >
              Explainable AI Coach &amp; Cognitive Strategy Studio
            </h1>
            <DoodleSquiggle className="max-w-xs mt-1" />
            <p className="text-base text-ink-muted">
              Every recommendation is grounded in your SAT-JEPA differential
              vector (<code className="font-mono-tabular">Δc</code>) and QUEST+
              confidence bands—with a 5-part reasoning trail and deterministic
              rule fallback.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant={simulateLlmDown ? 'reward' : 'secondary'}
              size="sm"
              aria-pressed={simulateLlmDown}
              onClick={() => setSimulateLlmDown(!simulateLlmDown)}
            >
              {simulateLlmDown
                ? '⚙ Deterministic Fallback: ON'
                : '⚙ Simulate LLM Down (Fallback)'}
            </Button>
            <Link
              to="/plan"
              className="tactile-btn bg-brand text-brand-ink px-4 py-2.5 text-sm font-semibold no-underline inline-flex items-center"
            >
              Open Adaptive Plan →
            </Link>
          </div>
        </div>

        {/* Persona + Preview State Bar */}
        <div className="pt-3 border-t border-border flex flex-wrap items-center justify-between gap-3">
          <div
            role="group"
            aria-label="Select coaching persona context"
            className="flex flex-wrap items-center gap-1.5"
          >
            <span className="font-mono-tabular text-xs font-semibold text-ink-muted me-1">
              Persona:
            </span>
            {PERSONA_OPTIONS.map((p) => {
              const isSelected = activePersona === p.id
              return (
                <Button
                  key={p.id}
                  size="sm"
                  variant={isSelected ? 'primary' : 'secondary'}
                  aria-pressed={isSelected}
                  onClick={() => {
                    setActivePersona(p.id)
                    if (p.id === 'edge-10-dimensions') {
                      setDimensionPreset('10')
                    }
                  }}
                >
                  {p.label}
                </Button>
              )
            })}
          </div>

          <div
            role="group"
            aria-label="AI Coach preview state switcher"
            className="flex flex-wrap items-center gap-1.5"
          >
            {(
              [
                { id: 'live', label: '1 · Live Grounded' },
                { id: 'fallback-mode', label: '2 · ⚙ Rule Fallback' },
                { id: 'rest-pacing', label: '3 · ☾ Rest-First Pacing' },
                { id: 'loading', label: 'Loading' },
                { id: 'empty', label: 'Empty' },
                { id: 'error', label: 'Error' },
                { id: 'extreme-text', label: 'Extreme' },
              ] as const
            ).map((st) => (
              <Button
                key={st.id}
                size="sm"
                variant={previewState === st.id ? 'reward' : 'secondary'}
                aria-pressed={previewState === st.id}
                onClick={() => {
                  setPreviewState(st.id)
                  if (st.id === 'fallback-mode') {
                    setSimulateLlmDown(true)
                  } else if (st.id === 'live') {
                    setSimulateLlmDown(false)
                    setActiveTurn(SEEDED_COACH_TURNS[0]!)
                  } else if (st.id === 'rest-pacing') {
                    setSimulateLlmDown(false)
                    setActiveTurn(SEEDED_COACH_TURNS[3]!)
                  }
                }}
              >
                {st.label}
              </Button>
            ))}
          </div>
        </div>
      </Card>

      {/* STATE: LOADING SKELETON */}
      {previewState === 'loading' && (
        <Card
          role="status"
          aria-label="Synthesizing explainable coaching strategy"
          className="p-6 space-y-4"
        >
          <div className="flex items-center justify-between">
            <span className="font-display text-lg font-bold text-ink">
              Synthesizing SAT-JEPA Differential Vector (
              <code className="font-mono-tabular">Δc</code>) &amp; Running Copy
              Guardrail…
            </span>
            <Badge tone="info" glyph="◌">
              Verifying Trail
            </Badge>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
            <div className="lg:col-span-7 h-72 rounded-md border-2 border-border bg-surface-raised" />
            <div className="lg:col-span-5 h-72 rounded-md border-2 border-border bg-surface-raised" />
          </div>
        </Card>
      )}

      {/* STATE: EMPTY (COLD-START STARTER PROMPTS) */}
      {previewState === 'empty' && (
        <Card className="p-6 space-y-4">
          <Badge tone="info" glyph="◌">
            First Coaching Check-In · Ready for Questions
          </Badge>
          <h2 className="font-display text-2xl font-bold text-ink">
            Ask Your Cognitive Twin Coach Anything About Pacing or Uncertainty
          </h2>
          <p className="text-sm text-ink-muted max-w-2xl">
            Select any of the 4 grounded scenarios or click a dimension in the
            right rail to generate a non-clinical strategy backed by a 5-part{' '}
            <code className="font-mono-tabular">WhyThisPanel</code> trail.
          </p>
          <Button variant="primary" onClick={() => setPreviewState('live')}>
            Load Default Grounded Recommendation →
          </Button>
        </Card>
      )}

      {/* STATE: ERROR RECOVERY */}
      {previewState === 'error' && (
        <Card
          role="alert"
          className="p-6 border-2 border-danger bg-danger-subtle space-y-3"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-display text-xl font-bold text-ink">
              ✕ Remote LLM Synthesis Endpoint Unreachable (HTTP 502)
            </h2>
            <Badge tone="info" glyph="⚙">
              Auto-Switched to Deterministic Rule Engine
            </Badge>
          </div>
          <p className="text-sm text-ink">
            SynapseTwin automatically failed over to the deterministic SAT-JEPA
            rule engine so your coaching recommendations and 5-part reasoning
            trails remain 100% available.
          </p>
          <Button
            variant="primary"
            onClick={() => {
              setSimulateLlmDown(true)
              setPreviewState('fallback-mode')
            }}
          >
            Continue with Deterministic Rule Engine →
          </Button>
        </Card>
      )}

      {/* STATE: EXTREME-TEXT STRESS TEST */}
      {previewState === 'extreme-text' && (
        <Card className="p-6 space-y-3 min-w-0">
          <Badge tone="info" glyph="◈">
            Multi-Clause Explainability &amp; 10-Dimension Grounding Stress Test
          </Badge>
          <h2 className="font-display text-xl font-bold text-ink break-words">
            Cross-Modal Dual-Stream N-Back &amp; Orthogonal Lure Discrimination
            Pacing Under Circadian Alertness Drift
          </h2>
          <p className="font-mono-tabular text-sm font-bold text-ink break-words">
            Rule ID: DET-SAT-JEPA-2026-09 · Δc Priority: +14.8% ± 2.1% ·
            Guardrail Status: CLEAN (0/14 patterns triggered)
          </p>
        </Card>
      )}

      {/* MAIN STUDIO GRID: 7 Cols Interactive Coach Studio + 5 Cols Grounding & Safety Rail */}
      {(previewState === 'live' ||
        previewState === 'fallback-mode' ||
        previewState === 'rest-pacing' ||
        previewState === 'extreme-text') && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
          {/* LEFT 7 COLUMNS: Interactive Coaching Studio + <WhyThisPanel /> + Composer */}
          <div className="lg:col-span-7 min-w-0 flex flex-col justify-between gap-6">
            <Card
              as="section"
              aria-labelledby="active-coach-turn-heading"
              className="p-6 space-y-5 min-w-0"
            >
              {/* Companion Header */}
              {showMascot && (
                <Mascot
                  state={
                    simulateLlmDown || previewState === 'fallback-mode'
                      ? 'thinking'
                      : activeTurn.mascotState
                  }
                  size="md"
                  title={
                    simulateLlmDown || previewState === 'fallback-mode'
                      ? 'Synapse Companion · Deterministic Rule Engine Active'
                      : 'Synapse Companion · Non-Clinical Strategy Brief'
                  }
                  badgeLabel={`Focus: ${activeTurn.dimensionCode}`}
                  message={`“Prompt: ${activeTurn.userPrompt}”`}
                />
              )}

              {/* Quick-Prompt Scenario Chips */}
              <div className="space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-mono-tabular text-xs font-semibold uppercase text-ink-muted">
                    Grounded Coaching Scenarios (1-Click):
                  </span>
                  <Button
                    size="sm"
                    variant="secondary"
                    aria-pressed={showCoachTable}
                    onClick={() => setShowCoachTable((prev) => !prev)}
                  >
                    {showCoachTable
                      ? 'View Interactive Turn'
                      : 'View Coach Log as Table'}
                  </Button>
                </div>

                <div
                  role="group"
                  aria-label="Grounded coaching scenario chips"
                  className="flex flex-wrap items-center gap-2"
                >
                  {SEEDED_COACH_TURNS.map((turn) => {
                    const isCurrent = activeTurn.id === turn.id
                    return (
                      <Button
                        key={turn.id}
                        size="sm"
                        variant={isCurrent ? 'primary' : 'secondary'}
                        aria-pressed={isCurrent}
                        onClick={() => setActiveTurn(turn)}
                      >
                        {turn.topicChipLabel}
                      </Button>
                    )
                  })}
                </div>
              </div>

              {/* Accessible Coach Log Table OR Active Turn Details */}
              {showCoachTable ? (
                <div className="overflow-x-auto">
                  <table
                    aria-label="AI Coach recommendations and reasoning log table"
                    className="w-full text-start border-collapse text-xs font-mono-tabular"
                  >
                    <thead>
                      <tr className="border-b-2 border-border-strong text-ink-muted uppercase">
                        <th scope="col" className="py-2 pe-3 text-start">
                          Scenario
                        </th>
                        <th scope="col" className="py-2 px-3 text-start">
                          Dim
                        </th>
                        <th scope="col" className="py-2 px-3 text-start">
                          Recommended Action
                        </th>
                        <th scope="col" className="py-2 ps-3 text-start">
                          Conf / Source
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {SEEDED_COACH_TURNS.map((t) => (
                        <tr key={t.id}>
                          <td className="py-2.5 pe-3 font-bold text-ink">
                            {t.topicChipLabel}
                          </td>
                          <td className="py-2.5 px-3 text-ink">
                            {t.dimensionCode}
                          </td>
                          <td className="py-2.5 px-3 text-ink-muted">
                            {t.headline}
                          </td>
                          <td className="py-2.5 ps-3 text-ink">
                            {Math.round(t.whyThis.confidence * 100)}% (
                            {simulateLlmDown
                              ? 'deterministic_fallback'
                              : t.whyThis.sourceModule}
                            )
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="rounded-md border-2 border-border-strong bg-canvas p-5 space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <Badge tone="brand" glyph="◆">
                      Target Axis: {activeTurn.dimensionCode}
                    </Badge>
                    <Badge
                      tone={
                        simulateLlmDown || previewState === 'fallback-mode'
                          ? 'info'
                          : 'success'
                      }
                      glyph={
                        simulateLlmDown || previewState === 'fallback-mode'
                          ? '⚙'
                          : '✓'
                      }
                    >
                      Source: {effectiveWhyThis.sourceModule}
                    </Badge>
                  </div>

                  <h2
                    id="active-coach-turn-heading"
                    className="font-display text-xl sm:text-2xl font-bold text-ink break-words"
                  >
                    {activeTurn.headline}
                  </h2>

                  <p className="text-sm sm:text-base text-ink leading-relaxed">
                    {activeTurn.coachingBody}
                  </p>

                  <div className="flex flex-wrap items-center gap-3 pt-1">
                    <Link
                      to={activeTurn.actionRoute}
                      className="tactile-btn bg-brand text-brand-ink px-4 py-2.5 text-sm font-semibold no-underline inline-flex items-center"
                    >
                      {activeTurn.actionLabel}
                    </Link>
                    <Link
                      to={`/dimensions/${activeTurn.dimensionId}`}
                      className="tactile-btn bg-surface text-ink hover:bg-surface-raised px-3.5 py-2.5 text-xs font-semibold no-underline inline-flex items-center"
                    >
                      Inspect {activeTurn.dimensionCode} Dimension Detail →
                    </Link>
                  </div>
                </div>
              )}

              {/* Embedded Signature #3 <WhyThisPanel /> */}
              <WhyThisPanel
                trail={effectiveWhyThis}
                title={`5-Part Reasoning Trail · ${activeTurn.dimensionCode} Strategy`}
                defaultExpanded
              />

              {/* Custom Question Composer */}
              <form
                onSubmit={handleCustomPromptSubmit}
                className="pt-2 border-t border-border space-y-2"
              >
                <label
                  htmlFor="coach-prompt-input"
                  className="block font-display text-sm font-bold text-ink"
                >
                  Ask the Coach About Any Cognitive Dimension or Study Habit
                </label>
                <div className="flex flex-col sm:flex-row gap-2.5">
                  <input
                    id="coach-prompt-input"
                    type="text"
                    value={customPrompt}
                    onChange={(e) => setCustomPrompt(e.target.value)}
                    placeholder="e.g., How do I calibrate Working Memory or Cognitive Flexibility?"
                    className="focus-ring flex-1 min-h-11 rounded-md border-2 border-border-strong bg-canvas px-3.5 py-2 text-sm text-ink"
                  />
                  <Button type="submit" variant="primary">
                    Synthesize Strategy →
                  </Button>
                </div>
              </form>
            </Card>

            {/* Card L2: Deterministic Rule Engine & Safety Guarantees */}
            <Card
              as="section"
              aria-labelledby="deterministic-guarantees-heading"
              className="p-5 space-y-3 min-w-0"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h2
                    id="deterministic-guarantees-heading"
                    className="font-display text-base font-bold text-ink"
                  >
                    Deterministic Rule Engine &amp; Explainability Guarantees
                  </h2>
                  <p className="text-xs text-ink-muted">
                    Coaching remains 100% functional even when remote LLM
                    synthesis is unreachable or disabled.
                  </p>
                </div>
                <Badge
                  tone={simulateLlmDown ? 'info' : 'success'}
                  glyph={simulateLlmDown ? '⚙' : '✓'}
                >
                  {simulateLlmDown
                    ? 'Active: Rule Engine v2.4'
                    : 'Standby Failover Ready'}
                </Badge>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs">
                <div className="rounded-sm border border-border bg-canvas p-2.5 space-y-1">
                  <span className="font-mono-tabular font-bold uppercase text-ink-muted block">
                    1 · Vector Grounding
                  </span>
                  <p className="text-ink font-medium">
                    Every prompt maps to SAT-JEPA differential vector{' '}
                    <code className="font-mono-tabular">Δc</code> across{' '}
                    {activeDimensions.length} axes.
                  </p>
                </div>
                <div className="rounded-sm border border-border bg-canvas p-2.5 space-y-1">
                  <span className="font-mono-tabular font-bold uppercase text-ink-muted block">
                    2 · 5-Part Audit Trail
                  </span>
                  <p className="text-ink font-medium">
                    Embedded <code className="font-mono-tabular">WhyThisPanel</code>{' '}
                    cites trigger, telemetry, confidence, and source.
                  </p>
                </div>
                <div className="rounded-sm border border-border bg-canvas p-2.5 space-y-1">
                  <span className="font-mono-tabular font-bold uppercase text-ink-muted block">
                    3 · Non-Clinical Copy
                  </span>
                  <p className="text-ink font-medium">
                    Zero medical diagnosis, zero IQ labels, and zero guilt-based
                    streak framing.
                  </p>
                </div>
              </div>
            </Card>
          </div>

          {/* RIGHT 5 COLUMNS: SAT-JEPA Delta-c Dimension Grounding + Live Copy Guardrail Inspector */}
          <div className="lg:col-span-5 min-w-0 flex flex-col justify-between gap-6">
            {/* Card A: Dynamic 3/6/7/8/10 Dimension Grounding List */}
            <Card
              as="section"
              aria-labelledby="dimension-grounding-heading"
              className="p-5 space-y-4 min-w-0"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h2
                    id="dimension-grounding-heading"
                    className="font-display text-lg font-bold text-ink"
                  >
                    SAT-JEPA Δc Dimension Grounding ({activeDimensions.length}{' '}
                    Axes)
                  </h2>
                  <p className="text-xs text-ink-muted">
                    Click any dimension to synthesize a tailored coaching turn
                    and 5-part trail.
                  </p>
                </div>
                <Badge tone="brand" glyph="●">
                  {activeDimensions.length} Active
                </Badge>
              </div>

              <div className="space-y-2.5">
                {activeDimensions.map((dim) => {
                  const est = estimates.find((e) => e.dimensionId === dim.id)
                  const scorePct = est?.scorePct ?? 74
                  const halfCi = est
                    ? Math.max(
                        4,
                        Math.round((est.ciUpperPct - est.ciLowerPct) / 2),
                      )
                    : 7
                  const confPct = Math.round((est?.confidence ?? 0.78) * 100)
                  const isHatched = confPct < 60
                  const isCurrent = activeTurn.dimensionId === dim.id

                  return (
                    <div
                      key={dim.id}
                      className={`rounded-md border-2 p-3 flex flex-wrap sm:flex-nowrap items-center justify-between gap-2 ${
                        isCurrent
                          ? 'border-border-strong bg-brand-subtle'
                          : 'border-border bg-canvas'
                      }`}
                    >
                      <div className="space-y-0.5 min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="font-display text-sm font-bold text-ink">
                            <span aria-hidden="true" className="me-1">
                              {dim.markerGlyph}
                            </span>
                            {dim.code} · {dim.name}
                          </span>
                          <Badge
                            tone={isHatched ? 'warning' : 'success'}
                            glyph={isHatched ? '⚡' : '●'}
                          >
                            {scorePct}% ±{halfCi}%
                          </Badge>
                        </div>
                        <span className="font-mono-tabular text-xs text-ink-muted block">
                          Confidence: {confPct}% (
                          {isHatched ? 'Hatched <60%' : 'Solid Band'})
                        </span>
                      </div>

                      <Button
                        size="sm"
                        variant={isCurrent ? 'primary' : 'secondary'}
                        className="shrink-0"
                        onClick={() =>
                          setActiveTurn(
                            buildDimensionCoachTurn(
                              dim,
                              scorePct,
                              halfCi,
                              confPct,
                            ),
                          )
                        }
                      >
                        Ask Coach
                      </Button>
                    </div>
                  )
                })}
              </div>
            </Card>

            {/* Card B: Live Non-Clinical & Zero-Guilt Copy Guardrail Inspector */}
            <Card
              as="section"
              aria-labelledby="copy-guardrail-heading"
              className="p-5 space-y-3.5 min-w-0"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h2
                    id="copy-guardrail-heading"
                    className="font-display text-base font-bold text-ink"
                  >
                    Live Non-Clinical &amp; Zero-Guilt Copy Guardrail
                  </h2>
                  <p className="text-xs text-ink-muted">
                    Every coach message is verified by{' '}
                    <code className="font-mono-tabular">lintCopyText()</code>{' '}
                    before display.
                  </p>
                </div>
                <Badge
                  tone={guardrailReport.isClean ? 'success' : 'warning'}
                  glyph={guardrailReport.isClean ? '✓' : '⚡'}
                >
                  {guardrailReport.isClean
                    ? 'PASS · 0 Violations'
                    : `Intercepted (${guardrailReport.violations.length} Rules)`}
                </Badge>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <Button
                  size="sm"
                  variant={testInterceptionMode ? 'reward' : 'secondary'}
                  aria-pressed={testInterceptionMode}
                  onClick={() => setTestInterceptionMode((prev) => !prev)}
                >
                  {testInterceptionMode
                    ? '✓ Showing Guardrail Interception Demo'
                    : 'Test Guardrail Interception'}
                </Button>
                <Link
                  to="/privacy"
                  className="text-xs font-semibold text-brand hover:underline"
                >
                  Ethics &amp; Safety Charter →
                </Link>
              </div>

              <pre
                tabIndex={0}
                role="region"
                aria-label="Live copy guardrail verification JSON report"
                className="focus-ring rounded-sm border border-border bg-canvas p-3 text-xs font-mono-tabular text-ink overflow-x-auto whitespace-pre-wrap break-words max-h-48"
              >
                <code>
                  {JSON.stringify(
                    {
                      guardrail_engine: 'lintCopyText_v1.4',
                      is_clean: guardrailReport.isClean,
                      violations_caught: guardrailReport.violations.length,
                      sanitized_output: guardrailReport.sanitizedPreview,
                    },
                    null,
                    2,
                  )}
                </code>
              </pre>
            </Card>
          </div>
        </div>
      )}
    </div>
  )
}
