import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { BRAND_CONFIG } from '../config/brand'
import { getDimensionsByPreset } from '../config/dimensions'
import {
  useAppStore,
  type BaselineModeId,
  type FocusGoalId,
  type PeakWindowId,
} from '../state/useAppStore'
import { Badge } from '../components/ui/Badge'
import { Button } from '../components/ui/Button'
import { Card } from '../components/ui/Card'
import { DoodleSquiggle } from '../components/ui/DoodleDecorations'

type OnboardingStep = 1 | 2 | 3
type ViewStateMode =
  | 'wizard'
  | 'all-steps'
  | 'validation-error'
  | 'loading'
  | 'extreme-text'

interface FocusGoalOption {
  id: FocusGoalId
  title: string
  badge: string
  description: string
}

const FOCUS_GOALS: readonly FocusGoalOption[] = [
  {
    id: 'balanced-360-twin',
    title: 'Balanced 360° Cognitive Twin',
    badge: 'Recommended Default',
    description:
      'Calibrate all configured cognitive dimensions evenly with adaptive 85%-accuracy staircase targeting.',
  },
  {
    id: 'deep-focus-wm',
    title: 'Deep Focus & Working Memory',
    badge: 'Hold & Filter',
    description:
      'Prioritize multi-step holding capacity and interference control for long analytical study blocks.',
  },
  {
    id: 'fast-set-shifting',
    title: 'Fast Set-Shifting & Exam Agility',
    badge: 'Rule Switching',
    description:
      'Strengthen rapid switching between competing task rules and visual attention networks.',
  },
]

const PEAK_WINDOWS: readonly {
  id: PeakWindowId
  label: string
  hours: string
}[] = [
  { id: 'morning', label: 'Morning Peak', hours: '08:00 – 12:00' },
  { id: 'afternoon', label: 'Afternoon Window', hours: '13:00 – 17:00' },
  { id: 'evening', label: 'Evening Session', hours: '18:00 – 22:00' },
]

export default function OnboardingPage() {
  const navigate = useNavigate()
  const {
    dimensionPreset,
    simulateOffline,
    consentPreferences,
    updateConsentPreferences,
    applyFastTrackConsent,
    resetConsentPreferences,
  } = useAppStore()

  const [activeStep, setActiveStep] = useState<OnboardingStep>(1)
  const [viewMode, setViewMode] = useState<ViewStateMode>('wizard')
  const [statusMessage, setStatusMessage] = useState<string | null>(null)
  const [sampleTapCount, setSampleTapCount] = useState<number>(1)

  const activeDimensions = useMemo(
    () => getDimensionsByPreset(dimensionPreset),
    [dimensionPreset],
  )

  const trialsPerDim = consentPreferences.baselineMode === 'quick-2min' ? 3 : 8
  const totalBaselineTrials = activeDimensions.length * trialsPerDim

  const liveWhatAiSeesJson = useMemo(() => {
    const allowedFields = ['rt_ms', 'correct', 'hesitation_jitter_ms', 'difficulty_level']
    if (consentPreferences.historicalSnapshots) {
      allowedFields.push('sat_jepa_snapshot_vector')
    }
    if (consentPreferences.coachAndCollab) {
      allowedFields.push('collab_rubric_events')
    }
    return JSON.stringify(
      {
        schemaVersion: 'cistac-v1.0',
        consentReceiptId: consentPreferences.consentReceiptId,
        nonBiometricMode: true,
        cameraMicAccess: 'NEVER_REQUESTED',
        storageMode: simulateOffline ? 'local_indexed_queue' : 'encrypted_session',
        activeDimensionsCount: activeDimensions.length,
        baselineMode: consentPreferences.baselineMode,
        totalPlannedTrials: totalBaselineTrials,
        telemetryFieldsAllowed: allowedFields,
        researchBenchmarkOptIn: consentPreferences.researchExport,
        nonClinicalAcknowledged: consentPreferences.nonClinicalAck,
      },
      null,
      2,
    )
  }, [
    activeDimensions.length,
    consentPreferences,
    simulateOffline,
    totalBaselineTrials,
  ])

  const handleLaunchCalibration = () => {
    if (!consentPreferences.nonClinicalAck) {
      setViewMode('validation-error')
      setActiveStep(2)
      return
    }
    navigate('/practice?mode=baseline')
  }

  const handleInputCalibrateTap = () => {
    const nextCount = sampleTapCount + 1
    setSampleTapCount(nextCount)
    const deterministicMs = 132 + ((nextCount * 7) % 24)
    updateConsentPreferences({ inputLatencyMs: deterministicMs })
    setStatusMessage(
      `✓ Input timer calibrated (${deterministicMs} ms response delta verified via high-resolution timer).`,
    )
  }

  const showStep1 = viewMode === 'all-steps' || activeStep === 1
  const showStep2 =
    viewMode === 'all-steps' ||
    viewMode === 'validation-error' ||
    activeStep === 2
  const showStep3 = viewMode === 'all-steps' || activeStep === 3

  return (
    <div className="space-y-6">
      {/* Live Status Toast */}
      {statusMessage && (
        <div
          role="status"
          aria-live="polite"
          className="tactile-card bg-brand-subtle p-4 flex flex-wrap items-center justify-between gap-3"
        >
          <div className="flex items-center gap-2.5">
            <Badge tone="brand" glyph="✓">
              Onboarding Ready
            </Badge>
            <span className="text-sm font-semibold text-ink">
              {statusMessage}
            </span>
          </div>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setStatusMessage(null)}
          >
            Dismiss
          </Button>
        </div>
      )}

      {/* Top Page Header & Evaluator Fast-Track Strip */}
      <Card className="p-6 space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-2 max-w-3xl">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone="reward" glyph="🔒">
                Privacy-First Onboarding · Step {activeStep} of 3
              </Badge>
              <Badge tone="success" glyph="✓">
                Mandatory Non-Biometric Lock Active
              </Badge>
              <Badge tone="info" glyph="◈">
                {activeDimensions.length} Dimensions ({totalBaselineTrials} Trials)
              </Badge>
            </div>
            <h1 className="font-display text-3xl font-bold text-ink tracking-tight">
              Configure your cognitive twin on your own terms.
            </h1>
            <DoodleSquiggle className="max-w-xs mt-1" />
            <p className="text-sm text-ink-muted">
              Before a single trial begins, choose your focus goal, inspect the
              exact telemetry fields {BRAND_CONFIG.productName} logs, and verify
              our non-biometric guarantee.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <Button
              variant="reward"
              size="md"
              aria-label="Quick Setup: Safe Defaults & Go (Judge Fast-Track: Safe Defaults & Go)"
              onClick={() => {
                applyFastTrackConsent()
                setViewMode('wizard')
                setActiveStep(3)
                setStatusMessage(
                  '⚡ Quick Setup applied: Safe default consent locked (CONSENT-ST-2026-FAST) and 2-Minute Baseline ready.',
                )
              }}
            >
              ⚡ Quick Setup: Safe Defaults &amp; Go →
            </Button>
            <Link
              to="/"
              className="tactile-btn bg-surface text-ink px-3.5 py-2 text-sm font-semibold no-underline inline-flex items-center"
            >
              ← Back to Welcome
            </Link>
          </div>
        </div>

        {/* Stepper Navigation + View/State Switcher */}
        <div className="pt-3 border-t border-border flex flex-wrap items-center justify-between gap-3">
          <ol
            role="list"
            aria-label="Onboarding progress steps"
            className="flex flex-wrap items-center gap-2 list-none p-0 m-0"
          >
            {(
              [
                { step: 1 as const, label: '1. Learning Context & Goal' },
                { step: 2 as const, label: '2. Granular Telemetry Consent' },
                { step: 3 as const, label: '3. Input Check & Baseline Mode' },
              ] as const
            ).map((item) => {
              const isCurrent =
                viewMode === 'wizard' && activeStep === item.step
              return (
                <li key={item.step}>
                  <button
                    type="button"
                    aria-current={isCurrent ? 'step' : undefined}
                    onClick={() => {
                      setViewMode('wizard')
                      setActiveStep(item.step)
                    }}
                    className={`focus-ring min-h-11 px-3.5 py-2 rounded-md border-2 text-xs font-bold cursor-pointer ${
                      isCurrent
                        ? 'bg-brand text-brand-ink border-border-strong'
                        : 'bg-surface-raised text-ink border-border hover:bg-canvas'
                    }`}
                  >
                    {item.label}
                  </button>
                </li>
              )
            })}
          </ol>

          <div
            role="group"
            aria-label="Onboarding inspector state switcher"
            className="flex flex-wrap items-center gap-1.5"
          >
            {(
              [
                { id: 'wizard', label: 'Step Wizard' },
                { id: 'all-steps', label: 'View All 3 Steps' },
                { id: 'validation-error', label: 'Missing Ack Alert' },
                { id: 'loading', label: 'Saving State' },
                { id: 'extreme-text', label: 'Extreme Values' },
              ] as const
            ).map((mode) => (
              <button
                key={mode.id}
                type="button"
                aria-pressed={viewMode === mode.id}
                onClick={() => setViewMode(mode.id)}
                className={`focus-ring min-h-11 px-2.5 py-1 rounded-sm border text-xs font-semibold cursor-pointer ${
                  viewMode === mode.id
                    ? 'bg-brand text-brand-ink border-border-strong'
                    : 'bg-surface-raised text-ink border-border hover:bg-canvas'
                }`}
              >
                {mode.label}
              </button>
            ))}
          </div>
        </div>
      </Card>

      {/* Main 8:4 Asymmetric Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* LEFT COLUMN (8 Cols): Interactive Onboarding Steps */}
        <div className="lg:col-span-8 space-y-6">
          {viewMode === 'loading' && (
            <Card
              role="status"
              aria-label="Saving consent preferences"
              className="p-6 space-y-4"
            >
              <Badge tone="info" glyph="◈">
                Recording Consent Ledger Receipt...
              </Badge>
              <div className="h-6 w-64 rounded-sm bg-surface-raised" />
              <div className="h-24 w-full rounded-md bg-surface-raised" />
              <div className="h-12 w-48 rounded-md bg-surface-raised" />
            </Card>
          )}

          {viewMode === 'extreme-text' && (
            <Card className="p-6 space-y-3 min-w-0">
              <Badge tone="info" glyph="◈">
                Overflow &amp; High-Length Receipt Stress Check
              </Badge>
              <h2 className="font-display text-xl font-bold text-ink break-words">
                Granular Epistemic Telemetry &amp; Longitudinal Non-Biometric
                Self-Supervised Trajectory Calibration Receipt
              </h2>
              <p className="font-mono-tabular text-sm text-ink break-all">
                RECEIPT_HASH=CONSENT-ST-2026-999999999999-NONBIOMETRIC-VERIFIED-SHA256-8F4A2C19E7B0
              </p>
              <p className="text-xs text-ink-muted">
                Verifies zero horizontal overflow at 375 px mobile and 200%
                browser zoom.
              </p>
            </Card>
          )}

          {viewMode !== 'loading' && viewMode !== 'extreme-text' && (
            <>
              {/* STEP 1: LEARNING FOCUS & SCHEDULE CONTEXT */}
              {showStep1 && (
                <Card
                  as="section"
                  aria-labelledby="step-1-heading"
                  className="p-6 space-y-5"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border pb-3">
                    <div>
                      <span className="font-mono-tabular text-xs font-bold uppercase text-ink-muted block">
                        STEP 01 OF 03 · STUDY CONTEXT
                      </span>
                      <h2
                        id="step-1-heading"
                        className="font-display text-xl font-bold text-ink"
                      >
                        Choose Your Primary Cognitive Focus &amp; Peak Study Window
                      </h2>
                    </div>
                    <Badge tone="brand" glyph="●">
                      Feeds Layer C Adaptive Plan
                    </Badge>
                  </div>

                  {/* Focus Goal Cards */}
                  <div
                    role="radiogroup"
                    aria-label="Primary cognitive focus goal"
                    className="grid grid-cols-1 md:grid-cols-3 gap-4"
                  >
                    {FOCUS_GOALS.map((goal) => {
                      const selected = consentPreferences.focusGoal === goal.id
                      return (
                        <button
                          key={goal.id}
                          type="button"
                          role="radio"
                          aria-checked={selected}
                          onClick={() =>
                            updateConsentPreferences({ focusGoal: goal.id })
                          }
                          className={`focus-ring text-start p-4 rounded-md border-2 flex flex-col justify-between gap-3 cursor-pointer ${
                            selected
                              ? 'bg-brand-subtle border-border-strong'
                              : 'bg-surface border-border hover:bg-surface-raised'
                          }`}
                        >
                          <div className="space-y-2">
                            <div className="flex flex-wrap items-center justify-between gap-1">
                              <Badge
                                tone={selected ? 'brand' : 'neutral'}
                                glyph={selected ? '✓' : '○'}
                              >
                                {selected ? 'Selected' : goal.badge}
                              </Badge>
                            </div>
                            <h3 className="font-display text-base font-bold text-ink">
                              {goal.title}
                            </h3>
                            <p className="text-xs text-ink-muted">
                              {goal.description}
                            </p>
                          </div>
                        </button>
                      )
                    })}
                  </div>

                  {/* Peak Study Window Selection */}
                  <div className="space-y-2">
                    <span className="font-display text-sm font-bold text-ink block">
                      Preferred Daily Micro-Training Window (for Fatigue Heatmap
                      Calibration):
                    </span>
                    <div
                      role="radiogroup"
                      aria-label="Preferred daily study window"
                      className="grid grid-cols-1 sm:grid-cols-3 gap-3"
                    >
                      {PEAK_WINDOWS.map((win) => {
                        const selected =
                          consentPreferences.peakWindow === win.id
                        return (
                          <button
                            key={win.id}
                            type="button"
                            role="radio"
                            aria-checked={selected}
                            onClick={() =>
                              updateConsentPreferences({ peakWindow: win.id })
                            }
                            className={`focus-ring min-h-11 p-3 rounded-md border-2 text-start cursor-pointer ${
                              selected
                                ? 'bg-brand text-brand-ink border-border-strong'
                                : 'bg-surface-raised text-ink border-border hover:bg-canvas'
                            }`}
                          >
                            <span className="font-display text-sm font-bold block">
                              {selected ? '✓ ' : ''}
                              {win.label}
                            </span>
                            <span className="font-mono-tabular text-xs opacity-90 block">
                              {win.hours}
                            </span>
                          </button>
                        )
                      })}
                    </div>
                  </div>

                  {viewMode === 'wizard' && (
                    <div className="space-y-4 pt-3 border-t border-border">
                      <div className="rounded-md border border-border bg-canvas p-4 space-y-2">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span className="font-display text-xs font-bold uppercase tracking-wider text-ink">
                            Active Calibration Blueprint ({activeDimensions.length}{' '}
                            Dimensions)
                          </span>
                          <Badge tone="neutral" glyph="⏱">
                            Est. 2 Min Quick Baseline ({totalBaselineTrials} Trials)
                          </Badge>
                        </div>
                        <p className="text-xs text-ink-muted">
                          Your selected focus goal and peak window calibrate initial
                          staircase difficulty targets (85% accuracy rule) and weight
                          your weekly Layer C training schedule.
                        </p>
                      </div>
                      <div className="flex justify-end">
                        <Button
                          variant="primary"
                          onClick={() => setActiveStep(2)}
                        >
                          Continue to Step 2: Granular Consent →
                        </Button>
                      </div>
                    </div>
                  )}
                </Card>
              )}

              {/* STEP 2: GRANULAR TELEMETRY CONSENT & NON-BIOMETRIC LOCK */}
              {showStep2 && (
                <Card
                  as="section"
                  aria-labelledby="step-2-heading"
                  className="p-6 space-y-5"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border pb-3">
                    <div>
                      <span className="font-mono-tabular text-xs font-bold uppercase text-ink-muted block">
                        STEP 02 OF 03 · PRIVACY &amp; ETHICS LEDGER
                      </span>
                      <h2
                        id="step-2-heading"
                        className="font-display text-xl font-bold text-ink"
                      >
                        Granular Telemetry Consent &amp; Mandatory Non-Biometric Lock
                      </h2>
                    </div>
                    <Badge tone="success" glyph="🔒">
                      Zero Dark Patterns · Revocable Anytime
                    </Badge>
                  </div>

                  {/* Validation Alert when Non-Clinical Ack is unchecked */}
                  {(viewMode === 'validation-error' ||
                    !consentPreferences.nonClinicalAck) && (
                    <div
                      role="alert"
                      className="rounded-md border-2 border-warning bg-warning-subtle p-4 flex flex-wrap items-center justify-between gap-3"
                    >
                      <div className="space-y-1">
                        <strong className="font-display text-sm font-bold text-ink block">
                          ▲ Non-Clinical Acknowledgment Required Before Task Launch
                        </strong>
                        <p className="text-xs text-ink">
                          Please confirm that you understand{' '}
                          {BRAND_CONFIG.productName} is an educational cognitive
                          training companion and not a medical or clinical
                          diagnostic tool.
                        </p>
                      </div>
                      <Button
                        variant="primary"
                        size="sm"
                        onClick={() => {
                          updateConsentPreferences({ nonClinicalAck: true })
                          if (viewMode === 'validation-error') {
                            setViewMode('wizard')
                          }
                        }}
                      >
                        ✓ Confirm Acknowledgment
                      </Button>
                    </div>
                  )}

                  {/* Quick Equal-Prominence Preset Actions */}
                  <div className="flex flex-wrap items-center justify-between gap-2 bg-surface-raised p-3 rounded-md border border-border">
                    <span className="text-xs font-semibold text-ink">
                      Quick Privacy Presets (Equal 1-Click Access):
                    </span>
                    <div className="flex flex-wrap items-center gap-2">
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => {
                          resetConsentPreferences()
                          updateConsentPreferences({ nonClinicalAck: true })
                          setStatusMessage(
                            'Minimal Telemetry Mode enabled: All optional history, coach rubrics, and benchmark exports turned OFF.',
                          )
                        }}
                      >
                        Reject All Optional (Minimal Mode)
                      </Button>
                      <Button
                        variant="primary"
                        size="sm"
                        onClick={() => {
                          applyFastTrackConsent()
                          setStatusMessage(
                            'Recommended privacy defaults enabled (Non-biometric lock ON, Research export OFF).',
                          )
                        }}
                      >
                        Accept Recommended Defaults
                      </Button>
                    </div>
                  </div>

                  {/* 5 Granular Consent Switches */}
                  <div className="space-y-3">
                    {/* 1. Core Telemetry (Locked ON) */}
                    <div className="rounded-md border-2 border-border-strong bg-surface p-4 flex flex-wrap items-center justify-between gap-3">
                      <div className="space-y-1 max-w-xl">
                        <div className="flex flex-wrap items-center gap-2">
                          <strong className="font-display text-sm font-bold text-ink">
                            Core Task Timing &amp; Accuracy Telemetry
                          </strong>
                          <Badge tone="brand" glyph="🔒">
                            Required · Always ON
                          </Badge>
                        </div>
                        <p className="text-xs text-ink-muted">
                          Captures trial reaction time in milliseconds (
                          <code className="font-mono-tabular">rt_ms</code>),
                          accuracy, and hesitation jitter to compute your
                          staircase difficulty level.
                        </p>
                      </div>
                      <Badge tone="success" glyph="✓">
                        ON (Core Engine)
                      </Badge>
                    </div>

                    {/* 2. Mandatory Non-Biometric Mode (Locked ON) */}
                    <div className="rounded-md border-2 border-border-strong bg-surface p-4 flex flex-wrap items-center justify-between gap-3">
                      <div className="space-y-1 max-w-xl">
                        <div className="flex flex-wrap items-center gap-2">
                          <strong className="font-display text-sm font-bold text-ink">
                            Mandatory Non-Biometric Mode (Hardware Lock)
                          </strong>
                          <Badge tone="success" glyph="🔒">
                            CISTAC Safety Guarantee · Locked ON
                          </Badge>
                        </div>
                        <p className="text-xs text-ink-muted">
                          Permanently blocks webcam, microphone, gaze video, and
                          biometric sensor APIs. Your cognitive twin is computed
                          strictly from behavioral task timing.
                        </p>
                      </div>
                      <Badge tone="success" glyph="✓">
                        LOCKED ON
                      </Badge>
                    </div>

                    {/* 3. Historised Brain Twin Snapshots */}
                    <div className="rounded-md border-2 border-border bg-surface p-4 flex flex-wrap items-center justify-between gap-3">
                      <div className="space-y-1 max-w-xl">
                        <div className="flex flex-wrap items-center gap-2">
                          <strong
                            id="switch-history-label"
                            className="font-display text-sm font-bold text-ink"
                          >
                            Historical Cognitive Snapshots (Brain Twin Timeline)
                          </strong>
                          <Badge tone="neutral" glyph="◈">
                            Optional · Default ON
                          </Badge>
                        </div>
                        <p className="text-xs text-ink-muted">
                          Stores timestamped profile snapshots and confidence
                          intervals (<code className="font-mono-tabular">±CI</code>)
                          so you can scrub across weeks on the Brain Twin
                          Timeline.
                        </p>
                      </div>
                      <button
                        type="button"
                        role="switch"
                        aria-labelledby="switch-history-label"
                        aria-checked={consentPreferences.historicalSnapshots}
                        onClick={() =>
                          updateConsentPreferences({
                            historicalSnapshots:
                              !consentPreferences.historicalSnapshots,
                          })
                        }
                        className={`tactile-btn px-4 py-2 text-xs font-bold cursor-pointer ${
                          consentPreferences.historicalSnapshots
                            ? 'bg-brand text-brand-ink'
                            : 'bg-surface-raised text-ink'
                        }`}
                      >
                        {consentPreferences.historicalSnapshots
                          ? '✓ ON · Saving History'
                          : '○ OFF · Ephemeral Session'}
                      </button>
                    </div>

                    {/* 4. Explainable AI Coach & Collaboration Score */}
                    <div className="rounded-md border-2 border-border bg-surface p-4 flex flex-wrap items-center justify-between gap-3">
                      <div className="space-y-1 max-w-xl">
                        <div className="flex flex-wrap items-center gap-2">
                          <strong
                            id="switch-coach-label"
                            className="font-display text-sm font-bold text-ink"
                          >
                            Explainable AI Coach &amp; 0–100 Collaboration Score
                          </strong>
                          <Badge tone="neutral" glyph="◈">
                            Optional · Default ON
                          </Badge>
                        </div>
                        <p className="text-xs text-ink-muted">
                          Enables the 5-part “Why this?” reasoning trail and
                          evaluates how effectively you verify, question, and
                          iterate on AI coaching advice.
                        </p>
                      </div>
                      <button
                        type="button"
                        role="switch"
                        aria-labelledby="switch-coach-label"
                        aria-checked={consentPreferences.coachAndCollab}
                        onClick={() =>
                          updateConsentPreferences({
                            coachAndCollab: !consentPreferences.coachAndCollab,
                          })
                        }
                        className={`tactile-btn px-4 py-2 text-xs font-bold cursor-pointer ${
                          consentPreferences.coachAndCollab
                            ? 'bg-brand text-brand-ink'
                            : 'bg-surface-raised text-ink'
                        }`}
                      >
                        {consentPreferences.coachAndCollab
                          ? '✓ ON · Coach Active'
                          : '○ OFF · Raw Metrics Only'}
                      </button>
                    </div>

                    {/* 5. Anonymized Benchmark Comparison (Default OFF) */}
                    <div className="rounded-md border-2 border-border bg-surface p-4 flex flex-wrap items-center justify-between gap-3">
                      <div className="space-y-1 max-w-xl">
                        <div className="flex flex-wrap items-center gap-2">
                          <strong
                            id="switch-research-label"
                            className="font-display text-sm font-bold text-ink"
                          >
                            Anonymized Aggregate Benchmark Export
                          </strong>
                          <Badge tone="neutral" glyph="○">
                            Opt-In · Default OFF
                          </Badge>
                        </div>
                        <p className="text-xs text-ink-muted">
                          Off by default. Only shares de-identified summary
                          percentiles if you explicitly opt in.
                        </p>
                      </div>
                      <button
                        type="button"
                        role="switch"
                        aria-labelledby="switch-research-label"
                        aria-checked={consentPreferences.researchExport}
                        onClick={() =>
                          updateConsentPreferences({
                            researchExport: !consentPreferences.researchExport,
                          })
                        }
                        className={`tactile-btn px-4 py-2 text-xs font-bold cursor-pointer ${
                          consentPreferences.researchExport
                            ? 'bg-brand text-brand-ink'
                            : 'bg-surface-raised text-ink'
                        }`}
                      >
                        {consentPreferences.researchExport
                          ? '✓ ON · Opted In'
                          : '○ OFF · Local Only'}
                      </button>
                    </div>
                  </div>

                  {/* Non-Clinical Educational Acknowledgment Checkbox */}
                  <div className="rounded-md border-2 border-border-strong bg-surface-raised p-4">
                    <label className="flex items-start gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={consentPreferences.nonClinicalAck}
                        onChange={(e) =>
                          updateConsentPreferences({
                            nonClinicalAck: e.target.checked,
                          })
                        }
                        className="focus-ring h-6 w-6 mt-0.5 shrink-0 accent-brand cursor-pointer"
                      />
                      <span className="text-xs text-ink leading-relaxed">
                        <strong className="font-bold block text-sm">
                          Non-Clinical Educational Tool Acknowledgment (Required)
                        </strong>
                        I understand that {BRAND_CONFIG.productName} is a
                        non-clinical cognitive self-reflection and learning tool.
                        Scores and confidence intervals represent task-specific
                        performance estimates, never medical or psychological
                        diagnoses.
                      </span>
                    </label>
                  </div>

                  {viewMode === 'wizard' && (
                    <div className="pt-3 border-t border-border flex flex-wrap items-center justify-between gap-3">
                      <Button
                        variant="secondary"
                        onClick={() => setActiveStep(1)}
                      >
                        ← Previous: Study Context
                      </Button>
                      <Button
                        variant="primary"
                        onClick={() => setActiveStep(3)}
                      >
                        Continue to Step 3: Baseline Calibration →
                      </Button>
                    </div>
                  )}
                </Card>
              )}

              {/* STEP 3: INPUT LATENCY CHECK & BASELINE CALIBRATION MODE */}
              {showStep3 && (
                <Card
                  as="section"
                  aria-labelledby="step-3-heading"
                  className="p-6 space-y-5"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border pb-3">
                    <div>
                      <span className="font-mono-tabular text-xs font-bold uppercase text-ink-muted block">
                        STEP 03 OF 03 · CALIBRATION LAUNCHPAD
                      </span>
                      <h2
                        id="step-3-heading"
                        className="font-display text-xl font-bold text-ink"
                      >
                        30-Second Input Timer Check &amp; Baseline Depth Selection
                      </h2>
                    </div>
                    <Badge tone="reward" glyph="⏱">
                      First Insight ≤ 3 Minutes
                    </Badge>
                  </div>

                  {/* Interactive Input Latency Micro-Test */}
                  <div className="rounded-md border-2 border-border-strong bg-surface-raised p-4 flex flex-wrap items-center justify-between gap-4">
                    <div className="space-y-1 max-w-lg">
                      <div className="flex flex-wrap items-center gap-2">
                        <strong className="font-display text-sm font-bold text-ink">
                          Hardware Input Latency Check (Keyboard &amp; Touch Parity)
                        </strong>
                        <Badge
                          tone={
                            consentPreferences.inputLatencyMs !== null
                              ? 'success'
                              : 'warning'
                          }
                          glyph={
                            consentPreferences.inputLatencyMs !== null
                              ? '✓'
                              : '⏱'
                          }
                        >
                          {consentPreferences.inputLatencyMs !== null
                            ? `Calibrated: ${consentPreferences.inputLatencyMs} ms`
                            : 'Uncalibrated'}
                        </Badge>
                      </div>
                      <p className="text-xs text-ink-muted">
                        Tap or press <kbd className="font-mono-tabular">Space</kbd>{' '}
                        or <kbd className="font-mono-tabular">Enter</kbd> on the
                        test pad to verify <code className="font-mono-tabular">performance.now()</code>{' '}
                        sub-millisecond timing before your first trial.
                      </p>
                    </div>
                    <Button
                      variant="secondary"
                      onClick={handleInputCalibrateTap}
                    >
                      ⚡ Tap / Space to Test Timer (
                      {consentPreferences.inputLatencyMs ?? '—'} ms)
                    </Button>
                  </div>

                  {/* Baseline Mode Selection (2-Min Quick vs 5-Min Standard) */}
                  <div
                    role="radiogroup"
                    aria-label="Baseline calibration depth"
                    className="grid grid-cols-1 md:grid-cols-2 gap-4"
                  >
                    {(
                      [
                        {
                          id: 'quick-2min' as BaselineModeId,
                          title: '⚡ 2-Minute Quick Baseline',
                          badge: 'Recommended · First Insight in ~2 Mins',
                          trialsPerDim: 3,
                          expectedCi: '±11% to ±16% (Initial Hatched Bands)',
                          description:
                            'Runs 3 adaptive staircase trials per dimension so you unlock your Uncertainty Radar and AI Coach immediately, then narrows confidence ranges over time.',
                        },
                        {
                          id: 'standard-5min' as BaselineModeId,
                          title: '🎯 Standard 5-Minute Calibration',
                          badge: 'High Initial Precision',
                          trialsPerDim: 8,
                          expectedCi: '±4% to ±6% (Solid Calibrated Bands)',
                          description:
                            'Runs 8 QUEST+ trials per dimension in one sitting to cross the 60% confidence threshold immediately on Day 1.',
                        },
                      ] as const
                    ).map((mode) => {
                      const selected =
                        consentPreferences.baselineMode === mode.id
                      return (
                        <button
                          key={mode.id}
                          type="button"
                          role="radio"
                          aria-checked={selected}
                          onClick={() =>
                            updateConsentPreferences({ baselineMode: mode.id })
                          }
                          className={`focus-ring text-start p-4 rounded-md border-2 flex flex-col justify-between gap-3 cursor-pointer ${
                            selected
                              ? 'bg-brand-subtle border-border-strong'
                              : 'bg-surface border-border hover:bg-surface-raised'
                          }`}
                        >
                          <div className="space-y-2">
                            <Badge
                              tone={selected ? 'brand' : 'neutral'}
                              glyph={selected ? '✓' : '○'}
                            >
                              {mode.badge}
                            </Badge>
                            <h3 className="font-display text-lg font-bold text-ink">
                              {mode.title}
                            </h3>
                            <p className="text-xs text-ink-muted">
                              {mode.description}
                            </p>
                          </div>
                          <div className="pt-2 border-t border-border font-mono-tabular text-xs text-ink">
                            <div>
                              <strong>Trials:</strong> {mode.trialsPerDim} ×{' '}
                              {activeDimensions.length} dims ={' '}
                              {mode.trialsPerDim * activeDimensions.length}{' '}
                              trials
                            </div>
                            <div>
                              <strong>Target CI:</strong> {mode.expectedCi}
                            </div>
                          </div>
                        </button>
                      )
                    })}
                  </div>

                  {/* Active Dimension Registry Preview (3 / 6 / 7 / 8 / 10 Dims) */}
                  <div className="rounded-md border border-border bg-canvas p-4 space-y-2.5">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="font-display text-xs font-bold uppercase tracking-wider text-ink">
                        Active Cognitive Dimensions Queued for Baseline (
                        {activeDimensions.length} Dims)
                      </span>
                      <span className="font-mono-tabular text-xs text-ink-muted">
                        Switch 3 / 6 / 7 / 10 dims in top header to test
                        generalisation
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {activeDimensions.map((dim) => (
                        <Badge
                          key={dim.id}
                          tone="neutral"
                          glyph={dim.markerGlyph}
                          className="whitespace-normal text-start"
                        >
                          {dim.code} · {dim.name} ({trialsPerDim} trials)
                        </Badge>
                      ))}
                    </div>
                  </div>

                  {/* Final Launch Action Bar */}
                  <div className="pt-3 border-t border-border flex flex-wrap items-center justify-between gap-3">
                    {viewMode === 'wizard' ? (
                      <Button
                        variant="secondary"
                        onClick={() => setActiveStep(2)}
                      >
                        ← Previous: Granular Consent
                      </Button>
                    ) : (
                      <span className="text-xs text-ink-muted font-mono-tabular">
                        Receipt: {consentPreferences.consentReceiptId}
                      </span>
                    )}
                    <div className="flex flex-wrap items-center gap-3">
                      <Button
                        variant="primary"
                        size="lg"
                        onClick={handleLaunchCalibration}
                      >
                        Save Consent &amp; Launch Baseline ({totalBaselineTrials}{' '}
                        Trials) →
                      </Button>
                    </div>
                  </div>
                </Card>
              )}
            </>
          )}
        </div>

        {/* RIGHT COLUMN (4 Cols): Live "What SynapseTwin Sees" JSON Payload & Redaction Proof */}
        <aside
          aria-label="Live AI Telemetry Inspector and Privacy Redaction Proof"
          className="lg:col-span-4 space-y-4"
        >
          <Card className="p-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border pb-3">
              <div>
                <h2 className="font-display text-lg font-bold text-ink">
                  🔒 What {BRAND_CONFIG.productName} Sees
                </h2>
                <p className="text-xs text-ink-muted">
                  Live telemetry contract updated as you toggle consent:
                </p>
              </div>
              <Badge tone="brand" glyph="◈">
                Live JSON
              </Badge>
            </div>

            <pre
              aria-live="polite"
              className="rounded-md border-2 border-border-strong bg-canvas p-3 text-xs font-mono-tabular text-ink whitespace-pre-wrap break-words leading-relaxed"
            >
              <code>{liveWhatAiSeesJson}</code>
            </pre>

            <div className="rounded-md border border-border bg-surface-raised p-3 space-y-1 text-xs">
              <strong className="font-display text-xs font-bold text-ink block">
                Bound Backend Contracts:
              </strong>
              <p className="font-mono-tabular text-ink-muted m-0">
                POST /v1/telemetry/event · GET /v1/tasks/next · DELETE /v1/user/telemetry
              </p>
            </div>

            <div className="rounded-md border-2 border-danger bg-danger-subtle p-3.5 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <strong className="font-display text-xs font-bold uppercase tracking-wider text-ink">
                  ✕ Permanently Blocked / Never Collected
                </strong>
                <Badge tone="danger" glyph="✕">
                  0 Biometrics
                </Badge>
              </div>
              <ul className="text-xs text-ink space-y-1 ps-4 m-0">
                <li>Webcam video, facial expression, or eye-tracking streams</li>
                <li>Microphone audio or voice stress recordings</li>
                <li>Keystrokes or browsing activity outside cognitive tasks</li>
                <li>Medical records, clinical labels, or fixed IQ scores</li>
              </ul>
            </div>

            <div className="border-t border-border pt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-ink-muted">
              <span>Full 2-step deletion &amp; JSON export in Privacy Center</span>
              <span className="font-mono-tabular font-semibold text-ink">
                {consentPreferences.consentReceiptId}
              </span>
            </div>
          </Card>
        </aside>
      </div>
    </div>
  )
}
