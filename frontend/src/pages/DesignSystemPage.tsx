import { useMemo, useState } from 'react'
import { getDimensionsByPreset, type DimensionPresetKey } from '../config/dimensions'
import {
  buildEstimatesForDimensions,
  SAMPLE_WHY_THIS_TRAIL,
} from '../services/mocks/fixtures'
import { useAppStore } from '../state/useAppStore'
import { evaluateDesignSystemContrast } from '../utils/contrast'
import { lintCopyText } from '../utils/copyLinter'
import { UncertaintyRadar } from '../components/features/radar/UncertaintyRadar'
import { WhyThisPanel } from '../components/features/coach/WhyThisPanel'
import { Mascot } from '../components/features/brand/Mascot'
import { BrianMascot } from '../components/features/brand/BrianMascot'
import { Badge } from '../components/ui/Badge'
import { Button } from '../components/ui/Button'
import { Card } from '../components/ui/Card'

type ShowcaseStateMode =
  | 'ready'
  | 'loading'
  | 'empty'
  | 'partial'
  | 'error'
  | 'low-confidence'
  | 'extreme-text'

const SAMPLE_LINTER_PRESETS: readonly { label: string; text: string }[] = [
  {
    label: '✓ Clean Non-Clinical Copy',
    text: 'Your Working Memory estimate is 76% ± 5%. Two more 2-back blocks will narrow your uncertainty range.',
  },
  {
    label: '✕ Clinical Terms Test (Flagged)',
    text: 'Patient shows signs of an ADHD attention deficit disorder and cognitive impairment on late trials.',
  },
  {
    label: '✕ Punitive Guilt Test (Flagged)',
    text: 'You broke your 5-day streak and you failed the speed block.',
  },
]

export default function DesignSystemPage() {
  const {
    theme,
    dimensionPreset,
    setDimensionPreset,
    simulateOffline,
    setSimulateOffline,
    simulateLlmDown,
    setSimulateLlmDown,
  } = useAppStore()

  const [tokenFilter, setTokenFilter] = useState('')
  const [stateMode, setStateMode] = useState<ShowcaseStateMode>('ready')
  const [selectedBattery, setSelectedBattery] = useState<'sharp' | 'steady' | 'winding'>('sharp')
  const [linterInput, setLinterInput] = useState(
    SAMPLE_LINTER_PRESETS[0]?.text ?? '',
  )

  const contrastReports = useMemo(() => evaluateDesignSystemContrast(), [])
  const filteredContrast = useMemo(() => {
    const q = tokenFilter.trim().toLowerCase()
    if (!q) return contrastReports
    return contrastReports.filter(
      (r) =>
        r.role.toLowerCase().includes(q) ||
        r.fgName.toLowerCase().includes(q) ||
        r.bgName.toLowerCase().includes(q),
    )
  }, [contrastReports, tokenFilter])

  const activeDimensions = useMemo(
    () => getDimensionsByPreset(dimensionPreset),
    [dimensionPreset],
  )

  const activePersonaForState =
    stateMode === 'partial'
      ? 'edge-missing-dim'
      : stateMode === 'low-confidence'
        ? 'noisy-low-confidence'
        : 'steady-improver'

  const activeEstimates = useMemo(
    () => buildEstimatesForDimensions(activeDimensions, activePersonaForState),
    [activeDimensions, activePersonaForState],
  )

  const lintResult = useMemo(() => lintCopyText(linterInput), [linterInput])

  return (
    <div className="space-y-8">
      {/* Page Hero Banner */}
      <Card as="section" aria-labelledby="ds-hero-heading" className="p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-3xl space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone="reward" glyph="★">
                Page 18 · Living Style Guide
              </Badge>
              <Badge tone="brand" glyph="✓">
                100% Token-Driven
              </Badge>
              <Badge tone="success" glyph="●">
                WCAG 2.1 AA/AAA Computed
              </Badge>
            </div>
            <h1
              id="ds-hero-heading"
              className="font-display text-3xl font-bold text-ink"
            >
              SynapseTwin Living Design System · Doodle (Hand Drawn)
            </h1>
            <p className="text-base text-ink-muted">
              Token-first architecture combining{' '}
              <strong>Doodle (Hand Drawn)</strong> sketch warmth with epistemic and
              accessibility rigor. Every color ratio is computed via WCAG 2.1
              relative luminance, and every chart adapts from 3 to 10 cognitive
              dimensions.
            </p>
          </div>

          <div className="flex flex-col gap-2">
            <span className="font-mono-tabular text-xs font-semibold uppercase text-ink-muted">
              Global Banner Simulators
            </span>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="secondary"
                size="sm"
                aria-pressed={simulateOffline}
                onClick={() => setSimulateOffline(!simulateOffline)}
              >
                {simulateOffline ? 'Hide Offline Banner' : 'Test Offline Banner'}
              </Button>
              <Button
                variant="secondary"
                size="sm"
                aria-pressed={simulateLlmDown}
                onClick={() => setSimulateLlmDown(!simulateLlmDown)}
              >
                {simulateLlmDown ? 'Hide LLM-Down Banner' : 'Test LLM-Down Banner'}
              </Button>
            </div>
          </div>
        </div>

        {/* Section Jump Pills */}
        <nav
          aria-label="Design system sections"
          className="mt-5 flex flex-wrap gap-2 border-t border-border pt-4"
        >
          {[
            { href: '#sec-mascot', label: '00 · Axolotl Companion Sheet (5 States)' },
            { href: '#sec-colors', label: '01 · Colors & Contrast' },
            { href: '#sec-dimensions', label: '02 · Dimension Scale (3–10)' },
            { href: '#sec-typography', label: '03 · Typography' },
            { href: '#sec-primitives', label: '04 · Tactile Primitives' },
            { href: '#sec-states', label: '05 · All 7 States & Radar' },
            { href: '#sec-linter', label: '06 · Copy Linter Sandbox' },
            { href: '#sec-dodont', label: '07 · Do & Don’t' },
          ].map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="focus-ring min-h-11 inline-flex items-center px-3 py-1.5 rounded-sm border border-border-strong bg-surface-raised text-xs font-semibold text-ink no-underline hover:bg-brand hover:text-brand-ink"
            >
              {link.label}
            </a>
          ))}
        </nav>
      </Card>

      {/* SECTION 00: Brian The Axolotl — Companion Component Sheet (Stitch Screen 2) */}
      <Card as="section" id="sec-mascot" aria-labelledby="heading-mascot" className="p-6 space-y-8">
        <div className="border-b border-border pb-5 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone="reward" glyph="★">
              Axolotl Character v2.0
            </Badge>
            <Badge tone="brand" glyph="●">
              5 Emotional States
            </Badge>
            <Badge tone="success" glyph="✓">
              Non-Clinical Guidance
            </Badge>
          </div>
          <h2
            id="heading-mascot"
            className="font-display text-2xl sm:text-3xl font-bold text-ink"
          >
            BRIAN The Axolotl — Companion Component Sheet
          </h2>
          <p className="text-base text-ink-muted max-w-4xl">
            Translating cognitive neuroscience into warm, zero-guilt micro-interactions with an expressive axolotl guide. Designed to balance artisanal sketchbook tactility with rigorous behavioral telemetry.
          </p>

          {/* Quick Spec Rules Bar */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-3">
            <div className="p-4 rounded-xl border-2 border-border-strong bg-surface-raised space-y-1">
              <span className="font-display text-sm font-bold text-ink flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-brand border border-border-strong" />
                Mascot Scale Rules
              </span>
              <p className="text-xs text-ink-muted">
                Hero cards: 180px–200px. Inline telemetry cards &amp; modals: 140px–150px. Preserves silhouette clarity.
              </p>
            </div>
            <div className="p-4 rounded-xl border-2 border-border-strong bg-surface-raised space-y-1">
              <span className="font-display text-sm font-bold text-ink flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-reward border border-border-strong" />
                Doodle Speech Tail
              </span>
              <p className="text-xs text-ink-muted">
                Directional hand-drawn speech beak points directly to Brian's head fin center at tactile elevation offset.
              </p>
            </div>
            <div className="p-4 rounded-xl border-2 border-border-strong bg-surface-raised space-y-1">
              <span className="font-display text-sm font-bold text-ink flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-accent border border-border-strong" />
                Zero-Guilt Tone
              </span>
              <p className="text-xs text-ink-muted">
                Fatigue is framed as adaptive protection, calibration as co-exploration, and latency drift as natural bio-rhythm.
              </p>
            </div>
          </div>
        </div>

        {/* 5 Emotional Moments Showcase Stream */}
        <div className="space-y-8">
          {/* MOMENT 1: MORNING READINESS FLOW */}
          <div className="rounded-2xl border-2 border-border-strong bg-surface p-6 shadow-doodle space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border pb-3">
              <span className="font-mono-tabular text-xs font-bold uppercase tracking-wider text-ink-muted">
                01 / Morning Readiness Flow
              </span>
              <Badge tone="brand" glyph="●">
                Scale: Large Hero (190px)
              </Badge>
            </div>
            <div className="flex flex-col lg:flex-row items-center gap-6">
              <BrianMascot
                pose="waving"
                scale="hero"
                showHalo
                haloColor="brand"
                statusPip="active"
              />
              <div className="flex-1 space-y-4 w-full">
                <div className="relative rounded-2xl border-2 border-border-strong bg-surface-raised p-4 shadow-doodle-sm">
                  <span className="text-xs font-mono-tabular font-bold text-ink-muted uppercase block mb-1">
                    ☀ Morning Synchronization
                  </span>
                  <p className="font-display text-lg font-bold text-ink">
                    “Good morning, Youssef! Your Working Memory clarity tightened to ±5% this week—today is prime for high-focus strategy.”
                  </p>
                </div>

                <div className="space-y-1.5">
                  <span className="text-xs font-mono-tabular font-bold text-ink-muted uppercase tracking-wider block">
                    Current Cognitive Charge
                  </span>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => setSelectedBattery('sharp')}
                      className={`px-4 py-2 rounded-xl border-2 border-border-strong text-sm font-bold transition-all shadow-doodle-sm cursor-pointer ${
                        selectedBattery === 'sharp'
                          ? 'bg-brand text-brand-ink'
                          : 'bg-surface-raised text-ink hover:bg-surface'
                      }`}
                    >
                      ⚡ Sharp
                    </button>
                    <button
                      type="button"
                      onClick={() => setSelectedBattery('steady')}
                      className={`px-4 py-2 rounded-xl border-2 border-border-strong text-sm font-bold transition-all shadow-doodle-sm cursor-pointer ${
                        selectedBattery === 'steady'
                          ? 'bg-brand text-brand-ink'
                          : 'bg-surface-raised text-ink hover:bg-surface'
                      }`}
                    >
                      🌤️ Steady
                    </button>
                    <button
                      type="button"
                      onClick={() => setSelectedBattery('winding')}
                      className={`px-4 py-2 rounded-xl border-2 border-border-strong text-sm font-bold transition-all shadow-doodle-sm cursor-pointer ${
                        selectedBattery === 'winding'
                          ? 'bg-brand text-brand-ink'
                          : 'bg-surface-raised text-ink hover:bg-surface'
                      }`}
                    >
                      🌙 Winding Down
                    </button>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-3 pt-2">
                  <Button variant="primary" size="md">
                    Start 2-Min Flow →
                  </Button>
                  <span className="text-xs font-mono-tabular text-ink-muted flex items-center gap-1.5">
                    ⏱ 120s • Zen Focus Session
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* MOMENT 2: STILL CALIBRATING (LOW CONFIDENCE) */}
          <div className="rounded-2xl border-2 border-border-strong bg-surface p-6 shadow-doodle space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border pb-3">
              <span className="font-mono-tabular text-xs font-bold uppercase tracking-wider text-ink-muted">
                02 / Co-Exploration In-Progress State
              </span>
              <Badge tone="warning" glyph="⚡">
                Scale: Mid-Telemetry (150px)
              </Badge>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-center">
              <div className="md:col-span-4 flex flex-col items-center">
                <BrianMascot
                  pose="explorer"
                  scale="telemetry"
                  showHalo
                  haloColor="calm"
                  statusPip="calibrating"
                />
                <span className="mt-2 text-xs font-mono-tabular px-2.5 py-0.5 rounded-full border border-border-strong bg-surface-raised text-ink font-semibold">
                  Mode: Curious Explorer
                </span>
              </div>
              <div className="md:col-span-8 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="font-display text-xl font-bold text-ink">
                    Spatial Recall: Still Calibrating
                  </h3>
                  <Badge tone="neutral" glyph="ℹ">
                    4 / 8 calibration trials complete
                  </Badge>
                </div>

                {/* Hatched uncertainty progress band */}
                <div className="space-y-1.5">
                  <div className="flex justify-between items-center text-xs font-mono-tabular text-ink-muted">
                    <span>Confidence Halo Bandwidth</span>
                    <span className="text-ink font-bold">±16% Range Variance</span>
                  </div>
                  <div className="w-full h-8 bg-surface-raised border-2 border-border-strong rounded-xl overflow-hidden relative flex items-center p-1">
                    <div className="h-full bg-brand rounded-lg w-[45%] flex items-center px-2">
                      <span className="text-xs font-mono-tabular text-brand-ink font-bold">Solid 45%</span>
                    </div>
                    <div className="h-full w-[35%] bg-warning-subtle rounded-lg ml-1 relative overflow-hidden flex items-center justify-center border border-border-strong">
                      <svg className="absolute inset-0 w-full h-full opacity-35" aria-hidden="true">
                        <rect width="100%" height="100%" fill="url(#diagonalHatch)" />
                      </svg>
                      <span className="text-xs font-mono-tabular text-ink font-bold relative z-10">±16% Float Area</span>
                    </div>
                    <div className="flex-1 text-end pe-2 text-xs font-mono-tabular text-ink-muted">Target ±4%</div>
                  </div>
                </div>

                <div className="rounded-xl border border-border-strong bg-surface-raised p-3 text-sm text-ink">
                  “We only have 4 trials here so far—let’s play a quick 90-second round to narrow your range!”
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  <Button variant="secondary" size="sm">
                    Sharpen Range (90s)
                  </Button>
                  <span className="text-xs font-mono-tabular text-ink-muted">
                    No impact on streak score if skipped.
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* MOMENT 3: COACH "WHY THIS?" X-RAY */}
          <div className="rounded-2xl border-2 border-border-strong bg-surface p-6 shadow-doodle space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border pb-3">
              <span className="font-mono-tabular text-xs font-bold uppercase tracking-wider text-ink-muted">
                03 / Transparent Pedagogical X-Ray
              </span>
              <Badge tone="success" glyph="✓">
                Scale: Mentor Inline (145px)
              </Badge>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="font-display text-xl font-bold text-ink">
                Why Brian Suggests This
              </h3>
              <Badge tone="success" glyph="★">
                86% Model Confidence
              </Badge>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
              <div className="lg:col-span-3 flex flex-col items-center">
                <BrianMascot
                  pose="mentor"
                  scale="telemetry"
                  showHalo
                  haloColor="reward"
                  statusPip="syncing"
                />
                <span className="mt-2 text-xs font-mono-tabular px-2.5 py-0.5 rounded-full border border-border-strong bg-surface-raised text-ink font-semibold">
                  Role: Cognitive Coach
                </span>
              </div>
              <div className="lg:col-span-9 space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="p-3 rounded-xl border border-border-strong bg-surface-raised space-y-1">
                    <span className="font-mono-tabular text-xs font-bold text-ink-muted uppercase">Step 01</span>
                    <h4 className="font-display text-sm font-bold text-ink">Your Pacing</h4>
                    <span className="font-mono-tabular text-sm font-bold text-ink block">585ms rhythm</span>
                    <p className="text-xs text-ink-muted">88% baseline response accuracy recorded across 14 trials.</p>
                  </div>
                  <div className="p-3 rounded-xl border border-border-strong bg-surface-raised space-y-1">
                    <span className="font-mono-tabular text-xs font-bold text-ink-muted uppercase">Step 02</span>
                    <h4 className="font-display text-sm font-bold text-ink">Twin Shift</h4>
                    <span className="font-mono-tabular text-sm font-bold text-ink block">+18% Stability Halo</span>
                    <p className="text-xs text-ink-muted">Working memory boundary narrowed from ±14% down to ±5%.</p>
                  </div>
                  <div className="p-3 rounded-xl border border-border-strong bg-surface-raised space-y-1">
                    <span className="font-mono-tabular text-xs font-bold text-ink-muted uppercase">Step 03</span>
                    <h4 className="font-display text-sm font-bold text-ink">Next Step</h4>
                    <span className="font-mono-tabular text-sm font-bold text-ink block">90s Visual Flow</span>
                    <p className="text-xs text-ink-muted">Queued for Thursday afternoon peak alertness interval.</p>
                  </div>
                </div>

                <div className="p-4 rounded-xl border-2 border-border-strong bg-surface-raised flex items-start gap-3">
                  <span className="text-lg">💡</span>
                  <p className="text-sm text-ink">
                    <strong>Brian's Mentor Note:</strong> “Because your spatial band is wider than your memory reserve, gentle pattern exposure yields maximum consolidation without cognitive exhaustion.”
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* MOMENT 4: CIRCADIAN COMPASSION & REST */}
          <div className="rounded-2xl border-2 border-border-strong bg-surface p-6 shadow-doodle space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border pb-3">
              <span className="font-mono-tabular text-xs font-bold uppercase tracking-wider text-ink-muted">
                04 / Circadian Compassion &amp; Rest
              </span>
              <Badge tone="neutral" glyph="🌙">
                Scale: Inline Snooze (140px)
              </Badge>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-center">
              <div className="md:col-span-4 flex flex-col items-center">
                <BrianMascot
                  pose="sleepy"
                  scale="telemetry"
                  showHalo
                  haloColor="calm"
                  statusPip="resting"
                />
                <span className="mt-2 text-xs font-mono-tabular px-2.5 py-0.5 rounded-full border border-border-strong bg-surface-raised text-ink font-semibold">
                  Mode: Recharge &amp; Rest
                </span>
              </div>
              <div className="md:col-span-8 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <span className="font-mono-tabular text-xs uppercase tracking-wider text-ink-muted block">
                      Circadian Bio-Rhythm Guard
                    </span>
                    <h3 className="font-display text-xl font-bold text-ink">
                      Evening Latency Drift Detected
                    </h3>
                  </div>
                  <Badge tone="warning" glyph="📉">
                    +140ms Reaction Delay
                  </Badge>
                </div>

                {/* Mini Evening Heatmap Visual */}
                <div className="p-3 rounded-xl border border-border-strong bg-surface-raised space-y-2">
                  <div className="flex items-center justify-between text-xs font-mono-tabular text-ink-muted">
                    <span>Evening Heatmap (8 PM – 11 PM)</span>
                    <span className="text-ink font-bold">Optimal Window Passed</span>
                  </div>
                  <div className="grid grid-cols-7 gap-1">
                    {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((day, idx) => (
                      <div
                        key={idx}
                        className={`h-7 rounded-lg border border-border-strong flex items-center justify-center font-mono-tabular text-xs font-bold ${
                          idx === 4
                            ? 'bg-warning-subtle text-ink font-bold'
                            : idx < 2
                              ? 'bg-brand text-brand-ink'
                              : 'bg-surface text-ink-muted'
                        }`}
                      >
                        {idx === 4 ? 'F · Tonight' : day}
                      </div>
                    ))}
                  </div>
                </div>

                <div className="p-3 rounded-xl border border-border-strong bg-surface-raised text-sm text-ink">
                  “Your reaction pacing slows down after 8 PM. Skip practice tonight and recharge! Scheduled rest protects your 12-day streak without friction.”
                </div>

                <div className="flex flex-wrap gap-2">
                  <Button variant="secondary" size="sm">
                    Activate Recovery Mode (Protected)
                  </Button>
                  <Button variant="secondary" size="sm">
                    Review Tomorrow’s Peak
                  </Button>
                </div>
              </div>
            </div>
          </div>

          {/* MOMENT 5: MILESTONE CELEBRATION MODAL */}
          <div className="rounded-2xl border-2 border-border-strong bg-surface p-6 shadow-doodle space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border pb-3">
              <span className="font-mono-tabular text-xs font-bold uppercase tracking-wider text-ink-muted">
                05 / Milestone Graduation Dialog Pattern
              </span>
              <Badge tone="reward" glyph="🎉">
                Scale: Joyful Celebration (170px)
              </Badge>
            </div>

            <div className="rounded-2xl border-2 border-border-strong bg-surface-raised p-6 shadow-doodle-lg flex flex-col items-center text-center space-y-4">
              <Badge tone="reward" glyph="★">
                🎉 Skill Graduated to High Clarity!
              </Badge>
              <BrianMascot
                pose="celebrating"
                scale="hero"
                showHalo
                haloColor="reward"
                statusPip="active"
              />
              <div className="max-w-md p-4 rounded-xl border border-border-strong bg-surface shadow-doodle-sm">
                <p className="font-display text-base font-bold text-ink">
                  “Woohoo! We've collected enough data to lock in your spatial navigation baseline. Your cognitive twin is now 96% synced!”
                </p>
              </div>

              {/* Before vs After Benchmark */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full max-w-lg text-start">
                <div className="p-3 rounded-xl border border-border-strong bg-surface space-y-1">
                  <span className="text-xs font-mono-tabular uppercase tracking-wider text-ink-muted block">
                    Before Calibration
                  </span>
                  <strong className="text-sm text-ink block">Spatial Recall ±16%</strong>
                  <div className="w-full h-2.5 bg-surface-raised border border-border-strong rounded-full overflow-hidden">
                    <div className="h-full w-3/4 bg-ink-muted rounded-full opacity-60" />
                  </div>
                  <span className="text-xs font-mono-tabular text-ink-muted">Loose exploratory bounds</span>
                </div>
                <div className="p-3 rounded-xl border-2 border-border-strong bg-brand text-brand-ink space-y-1">
                  <span className="text-xs font-mono-tabular uppercase tracking-wider text-brand-ink block font-bold">
                    After Calibration (Now)
                  </span>
                  <strong className="text-sm block">Spatial Recall ±4% Confirmed</strong>
                  <div className="w-full h-2.5 bg-brand-container border border-border-strong rounded-full overflow-hidden">
                    <div className="h-full w-[94%] bg-reward rounded-full" />
                  </div>
                  <span className="text-xs font-mono-tabular opacity-90">96% confidence baseline active</span>
                </div>
              </div>

              <div className="flex flex-wrap justify-center gap-3 pt-2">
                <Button variant="primary" size="md">
                  View Updated Brain Twin →
                </Button>
                <Button variant="secondary" size="md">
                  Dismiss
                </Button>
              </div>
            </div>
          </div>

          {/* Component Anatomy & Token Guide */}
          <div className="rounded-xl border-2 border-border-strong bg-surface-raised p-5 space-y-4">
            <h3 className="font-display text-lg font-bold text-ink">
              Mascot Integration Rules &amp; Token Guide
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
              <div className="p-3 rounded-lg border border-border-strong bg-surface space-y-1">
                <span className="font-bold text-ink-muted uppercase block">Scale &amp; Optical Sizing</span>
                <p className="text-ink-muted">
                  Brian is vector-aligned with a distinct outer die-cut border. Always isolate him on his dedicated background aura: Hero views (180–200px), Telemetry (140–150px), Badges (32–40px).
                </p>
              </div>
              <div className="p-3 rounded-lg border border-border-strong bg-surface space-y-1">
                <span className="font-bold text-ink-muted uppercase block">Color Harmonization</span>
                <p className="text-ink-muted">
                  Body tones match terracotta (<code className="font-mono-tabular">--color-brand</code>), ink contours match navy (<code className="font-mono-tabular">--color-border-strong</code>), and halos use brand and reward tints.
                </p>
              </div>
              <div className="p-3 rounded-lg border border-border-strong bg-surface space-y-1">
                <span className="font-bold text-ink-muted uppercase block">Neuroscience Copy Guardrails</span>
                <p className="text-ink-muted">
                  Brian never communicates shame, failure, or clinical certainty. Replace "Score Dropped" with "Latency Drift / Rest Protected".
                </p>
              </div>
            </div>
          </div>
        </div>
      </Card>

      {/* SECTION 01: Semantic Color Tokens & Computed Contrast Table */}
      <Card as="section" id="sec-colors" aria-labelledby="heading-colors">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border pb-4">
          <div>
            <h2
              id="heading-colors"
              className="font-display text-2xl font-bold text-ink"
            >
              01 · Semantic Color Tokens & Computed Contrast
            </h2>
            <p className="text-sm text-ink-muted">
              Active theme: <strong>{theme}</strong>. Body text requires ≥ 4.5:1;
              UI boundaries and graphical dimension marks require ≥ 3.0:1.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <label
              htmlFor="token-filter-input"
              className="text-xs font-semibold text-ink-muted"
            >
              Filter tokens:
            </label>
            <input
              id="token-filter-input"
              type="search"
              value={tokenFilter}
              onChange={(e) => setTokenFilter(e.target.value)}
              placeholder="e.g. brand, dim, dark..."
              className="focus-ring min-h-11 px-3 py-1.5 rounded-sm border-2 border-border-strong bg-surface text-sm text-ink"
            />
          </div>
        </div>

        {/* Semantic Swatch Grid */}
        <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="rounded-md border-2 border-border-strong bg-canvas p-4 text-ink">
            <span className="font-mono-tabular text-xs font-semibold">
              --color-canvas / --color-ink
            </span>
            <p className="font-display text-lg font-bold mt-1">
              Seashell Sketch Canvas
            </p>
            <p className="text-xs text-ink-muted mt-1">
              16.51:1 (Light AAA) · 17.16:1 (Dark AAA)
            </p>
          </div>

          <div className="rounded-md border-2 border-border-strong bg-brand p-4 text-brand-ink">
            <span className="font-mono-tabular text-xs font-semibold">
              --color-brand / --color-brand-ink
            </span>
            <p className="font-display text-lg font-bold mt-1">
              Warm Terracotta / Synaptic Amber
            </p>
            <p className="text-xs opacity-90 mt-1">
              5.37:1 (Light AA) · 7.48:1 (Dark AAA)
            </p>
          </div>

          <div className="rounded-md border-2 border-border-strong bg-reward p-4 text-reward-ink">
            <span className="font-mono-tabular text-xs font-semibold">
              --color-reward / --color-reward-ink
            </span>
            <p className="font-display text-lg font-bold mt-1">
              Warm Golden Amber
            </p>
            <p className="text-xs opacity-90 mt-1">
              11.47:1 (Light AAA) · 11.10:1 (Dark AAA)
            </p>
          </div>

          <div className="rounded-md border-2 border-border-strong bg-accent p-4 text-accent-ink">
            <span className="font-mono-tabular text-xs font-semibold">
              --color-accent (Fill Only)
            </span>
            <p className="font-display text-lg font-bold mt-1">
              Terracotta Marker Accent
            </p>
            <p className="text-xs opacity-90 mt-1">
              5.37:1 with Ink text · Never used as lone text
            </p>
          </div>
        </div>

        {/* Computed Contrast Table or Empty Filter State */}
        {filteredContrast.length === 0 ? (
          <div className="mt-4 rounded-md border-2 border-dashed border-border-strong p-6 text-center">
            <p className="font-display text-lg font-semibold text-ink">
              No contrast pairs match “{tokenFilter}”
            </p>
            <p className="text-sm text-ink-muted mt-1">
              Try searching for “brand”, “canvas”, or “dim”.
            </p>
            <Button
              variant="secondary"
              size="sm"
              className="mt-3"
              onClick={() => setTokenFilter('')}
            >
              Reset token filter
            </Button>
          </div>
        ) : (
          <div className="mt-4">
            {/* Mobile-first stacked contrast cards for 375px freeze-frame clarity */}
            <div className="grid grid-cols-1 gap-2 sm:hidden">
              {filteredContrast.map((row) => (
                <div
                  key={row.id}
                  className="rounded-sm border border-border bg-surface-raised p-3 text-xs space-y-1"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold text-ink">{row.role}</span>
                    <Badge
                      tone={row.passes ? 'success' : 'danger'}
                      glyph={row.passes ? '✓' : '✕'}
                    >
                      {row.ratio.toFixed(2)}:1 · {row.level}
                    </Badge>
                  </div>
                  <div className="font-mono-tabular text-ink-muted">
                    {row.theme.toUpperCase()} · {row.fgName} on {row.bgName}
                  </div>
                </div>
              ))}
            </div>

            {/* Desktop & Tablet full specification table */}
            <div className="hidden sm:block overflow-x-auto">
              <table
                className="w-full border-collapse text-sm"
                aria-label="Computed WCAG 2.1 contrast verification table"
              >
                <thead>
                  <tr className="border-b-2 border-border-strong text-start">
                    <th scope="col" className="py-2 pe-3 text-start">
                      Semantic Role
                    </th>
                    <th scope="col" className="py-2 px-3 text-start">
                      Theme
                    </th>
                    <th scope="col" className="py-2 px-3 text-start">
                      Foreground Token
                    </th>
                    <th scope="col" className="py-2 px-3 text-start">
                      Background Token
                    </th>
                    <th scope="col" className="py-2 px-3 text-start">
                      Computed Ratio
                    </th>
                    <th scope="col" className="py-2 ps-3 text-start">
                      WCAG Status
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filteredContrast.map((row) => (
                    <tr key={row.id} className="border-b border-border">
                      <td className="py-2 pe-3 font-medium">{row.role}</td>
                      <td className="py-2 px-3 uppercase font-mono-tabular text-xs">
                        {row.theme}
                      </td>
                      <td className="py-2 px-3 font-mono-tabular text-xs">
                        {row.fgName} ({row.fgHex})
                      </td>
                      <td className="py-2 px-3 font-mono-tabular text-xs">
                        {row.bgName} ({row.bgHex})
                      </td>
                      <td className="py-2 px-3 font-mono-tabular font-bold">
                        {row.ratio.toFixed(2)} : 1
                      </td>
                      <td className="py-2 ps-3">
                        <Badge
                          tone={row.passes ? 'success' : 'danger'}
                          glyph={row.passes ? '✓' : '✕'}
                        >
                          {row.level} (≥{row.minRequired}:1)
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </Card>

      {/* SECTION 02: Okabe-Ito Dimension Scale (3 to 10 Dimensions) */}
      <Card
        as="section"
        id="sec-dimensions"
        aria-labelledby="heading-dimensions"
      >
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border pb-4">
          <div>
            <h2
              id="heading-dimensions"
              className="font-display text-2xl font-bold text-ink"
            >
              02 · Okabe-Ito Dimension Scale ({activeDimensions.length}{' '}
              Dimensions Active)
            </h2>
            <p className="text-sm text-ink-muted">
              Every dimension combines a WCAG ≥ 3:1 color token with a unique
              geometric vertex marker so color never carries meaning alone.
            </p>
          </div>
          <div
            role="group"
            aria-label="Test dimension count scalability"
            className="flex flex-wrap gap-2"
          >
            {(['3', '6', '7', '8', '10'] as DimensionPresetKey[]).map((key) => (
              <Button
                key={key}
                variant={dimensionPreset === key ? 'primary' : 'secondary'}
                size="sm"
                aria-pressed={dimensionPreset === key}
                onClick={() => setDimensionPreset(key)}
              >
                {key} Dimensions
              </Button>
            ))}
          </div>
        </div>

        <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {activeDimensions.map((dim) => (
            <div
              key={dim.id}
              className="rounded-md border-2 border-border-strong bg-surface p-4 flex flex-col justify-between gap-2"
            >
              <div>
                <div className="flex items-center justify-between gap-2">
                  <span
                    className="inline-flex items-center gap-2 font-display text-base font-bold text-ink"
                  >
                    <span
                      aria-hidden="true"
                      className="inline-flex h-7 w-7 items-center justify-center rounded-sm border border-border-strong text-brand-ink"
                      style={{ backgroundColor: dim.colorCssVar }}
                    >
                      {dim.markerGlyph}
                    </span>
                    <span>
                      {dim.slotIndex}. {dim.name}
                    </span>
                  </span>
                  <span className="font-mono-tabular text-xs font-semibold text-ink-muted">
                    {dim.code}
                  </span>
                </div>
                <p className="mt-2 text-xs text-ink-muted">
                  {dim.shortDescription}
                </p>
              </div>
              <div className="pt-2 border-t border-border flex flex-wrap items-center justify-between gap-1 text-xs font-mono-tabular text-ink-muted">
                <span>Task: {dim.schemaTypes.join(', ')}</span>
                <span>Shape: {dim.markerShape}</span>
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* SECTION 03: Typography & 4px Grid */}
      <Card
        as="section"
        id="sec-typography"
        aria-labelledby="heading-typography"
      >
        <h2
          id="heading-typography"
          className="font-display text-2xl font-bold text-ink border-b border-border pb-3"
        >
          03 · Typography Pairing & 4 px Baseline Scale
        </h2>
        <div className="mt-4 grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="rounded-md border-2 border-border-strong bg-surface-raised p-4">
            <span className="font-mono-tabular text-xs font-semibold uppercase text-ink-muted">
              --font-display · Delius Swash Caps (SIL OFL)
            </span>
            <p className="font-display text-2xl font-bold mt-2">
              Hand-Drawn Headings with Swash Capitals
            </p>
            <p className="text-xs text-ink-muted mt-2">
              Used for page titles, celebration milestones, and mascot voice
              callouts.
            </p>
          </div>

          <div className="rounded-md border-2 border-border-strong bg-surface-raised p-4">
            <span className="font-mono-tabular text-xs font-semibold uppercase text-ink-muted">
              --font-sans · Delius (SIL OFL)
            </span>
            <p className="text-base font-medium mt-2">
              Handwritten body text bringing sketch warmth to instructions
              during cognitive task instructions and explainability panels.
            </p>
            <p className="text-xs text-ink-muted mt-2">
              16 px base size (`1rem`) with `1.5` line-height (`24 px`).
            </p>
          </div>

          <div className="rounded-md border-2 border-border-strong bg-surface-raised p-4">
            <span className="font-mono-tabular text-xs font-semibold uppercase text-ink-muted">
              --font-mono · JetBrains Mono (SIL OFL)
            </span>
            <p className="font-mono-tabular text-xl font-bold mt-2">
              76% ± 5% · RT: 612 ms · w_i = 0.25
            </p>
            <p className="text-xs text-ink-muted mt-2">
              Enforces `tabular-nums` so confidence intervals and millisecond
              timers never jitter horizontally.
            </p>
          </div>
        </div>
      </Card>

      {/* SECTION 04: Tactile Interactive Primitives & All 7 States */}
      <Card
        as="section"
        id="sec-primitives"
        aria-labelledby="heading-primitives"
      >
        <h2
          id="heading-primitives"
          className="font-display text-2xl font-bold text-ink border-b border-border pb-3"
        >
          04 · Tactile Button & Badge Anatomy (≥ 44 px Touch Targets)
        </h2>
        <div className="mt-4 space-y-4">
          <div>
            <h3 className="text-sm font-semibold text-ink-muted mb-2">
              Button Variants & Interactive States (Default, Hover, Focus-Visible,
              Active Press, Loading, Disabled)
            </h3>
            <div className="flex flex-wrap items-center gap-3">
              <Button variant="primary">Primary Action</Button>
              <Button variant="secondary">Secondary Action</Button>
              <Button variant="reward">★ Milestone Reward</Button>
              <Button variant="danger">Delete My Data</Button>
              <Button variant="ghost">Ghost Action</Button>
              <Button variant="primary" isLoading>
                Calibrating...
              </Button>
              <Button variant="secondary" disabled>
                Disabled State
              </Button>
            </div>
          </div>

          <div className="pt-3 border-t border-border">
            <h3 className="text-sm font-semibold text-ink-muted mb-2">
              Non-Color-Alone Status & Confidence Badges
            </h3>
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone="brand" glyph="●">
                High Confidence (86%)
              </Badge>
              <Badge tone="low-confidence" glyph="▨">
                Low Confidence (48% · Hatched)
              </Badge>
              <Badge tone="reward" glyph="★">
                Scenario, Not Prediction
              </Badge>
              <Badge tone="neutral" glyph="◈">
                Design Proposal, Not Validated
              </Badge>
              <Badge tone="success" glyph="✓">
                Non-Biometric Lock ON
              </Badge>
              <Badge tone="warning" glyph="▲">
                Tab Blur Paused
              </Badge>
              <Badge tone="danger" glyph="✕">
                Telemetry Error
              </Badge>
            </div>
          </div>

          <div className="pt-3 border-t border-border grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="rounded-sm border border-border bg-surface-raised p-3">
              <span className="font-mono-tabular text-xs font-semibold uppercase text-ink-muted block mb-1">
                Teammate Usage Snippet (Primitives &amp; Radar)
              </span>
              <pre className="font-mono-tabular text-xs overflow-x-auto text-ink">
                {`<Button variant="primary" size="md" isLoading={saving}>
  Start 2-Min Baseline
</Button>
<Badge tone="low-confidence" glyph="▨">
  Confidence < 60%
</Badge>
<UncertaintyRadar
  dimensions={activeDimensions}
  estimates={activeEstimates}
/>`}
              </pre>
            </div>
            <div className="rounded-sm border border-border bg-surface-raised p-3 text-xs space-y-1.5 text-ink">
              <span className="font-mono-tabular font-semibold uppercase text-ink-muted block">
                Accessibility &amp; Reuse Contract
              </span>
              <p>
                • <strong>Touch &amp; Pointer:</strong> All{' '}
                <code className="font-mono-tabular">&lt;Button /&gt;</code> sizes
                enforce <code className="font-mono-tabular">min-h-11</code> (
                <code className="font-mono-tabular">44px</code>) and{' '}
                <code className="font-mono-tabular">3px</code>{' '}
                <code className="font-mono-tabular">--color-brand</code>{' '}
                focus-visible rings.
              </p>
              <p>
                • <strong>Non-Color Alone:</strong> Always pass the{' '}
                <code className="font-mono-tabular">glyph</code> prop to{' '}
                <code className="font-mono-tabular">&lt;Badge /&gt;</code> (
                <code className="font-mono-tabular">● ▨ ★ ✓ ▲ ✕</code>) so
                meaning survives monochrome and colorblind displays.
              </p>
              <p>
                • <strong>Logical RTL-Ready CSS:</strong> Use{' '}
                <code className="font-mono-tabular">ms-*</code>,{' '}
                <code className="font-mono-tabular">me-*</code>,{' '}
                <code className="font-mono-tabular">ps-*</code>,{' '}
                <code className="font-mono-tabular">pe-*</code>, and{' '}
                <code className="font-mono-tabular">text-start</code>{' '}
                exclusively.
              </p>
            </div>
          </div>
        </div>
      </Card>

      {/* SECTION 05: All Page States + Signature Radar & Why-This Preview */}
      <Card as="section" id="sec-states" aria-labelledby="heading-states">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-4">
          <div>
            <h2
              id="heading-states"
              className="font-display text-2xl font-bold text-ink"
            >
              05 · Signature Components & All UI States Explorer
            </h2>
            <p className="text-sm text-ink-muted">
              Switch between Ready, Loading Skeleton, Empty, Partial Profile,
              Low Confidence, Error, and Extreme Text/Number states.
            </p>
          </div>
          <div
            role="group"
            aria-label="Component state switcher"
            className="flex flex-wrap gap-2"
          >
            {(
              [
                { id: 'ready', label: 'Ready (Calibrated)' },
                { id: 'low-confidence', label: 'Low Confidence (Hatched)' },
                { id: 'partial', label: 'Partial (1 Missing)' },
                { id: 'loading', label: 'Loading Skeleton' },
                { id: 'empty', label: 'Empty State' },
                { id: 'error', label: 'Error State' },
                { id: 'extreme-text', label: 'Long Text & Huge Numbers' },
              ] as const
            ).map((item) => (
              <Button
                key={item.id}
                variant={stateMode === item.id ? 'primary' : 'secondary'}
                size="sm"
                aria-pressed={stateMode === item.id}
                onClick={() => setStateMode(item.id)}
              >
                {item.label}
              </Button>
            ))}
          </div>
        </div>

        <div className="mt-5">
          {stateMode === 'loading' && (
            <div
              role="status"
              aria-label="Loading Brain Twin components"
              className="grid grid-cols-1 lg:grid-cols-2 gap-6"
            >
              <div className="rounded-md border-2 border-border bg-surface-raised p-6 h-80 flex flex-col justify-between">
                <div className="h-6 w-48 rounded-sm bg-canvas" />
                <div className="h-48 w-48 mx-auto rounded-pill border-4 border-border" />
                <div className="h-4 w-64 rounded-sm bg-canvas" />
              </div>
              <div className="rounded-md border-2 border-border bg-surface-raised p-6 h-80 space-y-4">
                <div className="h-6 w-56 rounded-sm bg-canvas" />
                <div className="h-20 w-full rounded-sm bg-canvas" />
                <div className="h-20 w-full rounded-sm bg-canvas" />
              </div>
            </div>
          )}

          {stateMode === 'empty' && (
            <div className="rounded-md border-2 border-dashed border-border-strong bg-surface-raised p-8 text-center space-y-3">
              <Badge tone="neutral" glyph="◌">
                0 Sessions Recorded
              </Badge>
              <h3 className="font-display text-xl font-bold text-ink">
                Your Brain Twin is ready for its first 2-minute baseline
              </h3>
              <p className="text-sm text-ink-muted max-w-xl mx-auto">
                Complete 3 quick non-biometric trials per dimension to unlock
                your uncertainty radar and personalized coaching trail.
              </p>
              <Button
                variant="primary"
                onClick={() => setStateMode('ready')}
              >
                Restore Calibrated Preview
              </Button>
            </div>
          )}

          {stateMode === 'error' && (
            <Card variant="danger" role="alert" className="space-y-3">
              <div className="flex items-center justify-between gap-2">
                <h3 className="font-display text-xl font-bold text-ink">
                  ✕ Unable to load Brain Twin snapshot
                </h3>
                <Badge tone="danger" glyph="!">
                  HTTP 503 · Simulated Fault
                </Badge>
              </div>
              <p className="text-sm text-ink">
                The profile service timed out while computing SAT-JEPA
                uncertainty intervals. Your buffered trial events remain safe in
                local storage.
              </p>
              <Button variant="primary" onClick={() => setStateMode('ready')}>
                Retry Snapshot Load
              </Button>
            </Card>
          )}

          {stateMode === 'extreme-text' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card className="min-w-0">
                <span className="font-mono-tabular text-xs text-ink-muted">
                  Stress Test · 90-Character Dimension Name &amp; 200% Zoom Survival
                </span>
                <h3 className="font-display text-lg font-bold text-ink break-words mt-1">
                  Multimodal Visuospatial Relational Induction &amp; Cross-Modal
                  Executive Set-Shifting Under High Interference
                </h3>
                <p className="font-mono-tabular text-2xl font-bold text-ink mt-2">
                  99.9% ± 0.1% · 1,248,920 trials · RT: 14,892 ms
                </p>
              </Card>
              <WhyThisPanel trail={SAMPLE_WHY_THIS_TRAIL} defaultExpanded />
            </div>
          )}

          {(stateMode === 'ready' ||
            stateMode === 'low-confidence' ||
            stateMode === 'partial') && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
              <UncertaintyRadar
                dimensions={activeDimensions}
                estimates={activeEstimates}
              />
              <div className="space-y-4">
                <WhyThisPanel trail={SAMPLE_WHY_THIS_TRAIL} defaultExpanded />
                <div className="rounded-md border-2 border-border-strong bg-surface p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-display font-bold text-base">
                      Active State Summary
                    </span>
                    <Badge tone="info" glyph="◈">
                      {activeDimensions.length} Dimensions
                    </Badge>
                  </div>
                  <p className="text-xs text-ink-muted">
                    Use the buttons above to verify how the Uncertainty Radar
                    handles 3, 6, 7, 8, or 10 dimensions, missing partial
                    dimensions, and hatched low-confidence bands.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </Card>

      {/* SECTION 06: Interactive Non-Clinical Copy Linter Sandbox */}
      <Card as="section" id="sec-linter" aria-labelledby="heading-linter">
        <div className="border-b border-border pb-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2
              id="heading-linter"
              className="font-display text-2xl font-bold text-ink"
            >
              06 · Live Non-Clinical &amp; Zero-Guilt Copy Linter
            </h2>
            <Badge
              tone={lintResult.isClean ? 'success' : 'danger'}
              glyph={lintResult.isClean ? '✓' : '✕'}
            >
              {lintResult.isClean
                ? 'PASS · Non-Clinical & Kind'
                : `${lintResult.violations.length} Safety Violation(s) Flagged`}
            </Badge>
          </div>
          <p className="text-sm text-ink-muted mt-1">
            Enforces Safety (6%): bans medical/diagnostic terms and streak-guilt
            phrasing in both static UI copy and AI Coach outputs.
          </p>
        </div>

        <div className="mt-4 space-y-3">
          <div className="flex flex-wrap gap-2">
            {SAMPLE_LINTER_PRESETS.map((preset) => (
              <Button
                key={preset.label}
                variant="secondary"
                size="sm"
                onClick={() => setLinterInput(preset.text)}
              >
                {preset.label}
              </Button>
            ))}
          </div>

          <div>
            <label
              htmlFor="copy-linter-textarea"
              className="block text-xs font-semibold uppercase font-mono-tabular text-ink-muted mb-1"
            >
              Test any UI string or AI Coach message:
            </label>
            <textarea
              id="copy-linter-textarea"
              rows={3}
              value={linterInput}
              onChange={(e) => setLinterInput(e.target.value)}
              className="focus-ring w-full rounded-md border-2 border-border-strong bg-surface p-3 text-sm text-ink"
            />
          </div>

          {!lintResult.isClean && (
            <div
              role="alert"
              className="rounded-md border-2 border-danger bg-danger-subtle p-4 space-y-2 text-sm"
            >
              <p className="font-bold text-ink">
                Flagged terms detected — automatic growth-mindset rewrite:
              </p>
              <ul className="list-disc ps-5 space-y-1 text-ink">
                {lintResult.violations.map((v, i) => (
                  <li key={i}>
                    <strong>“{v.term}”</strong> ({v.category}) → Replace with:{' '}
                    <em>“{v.replacementSuggestion}”</em>
                  </li>
                ))}
              </ul>
              <p className="pt-2 border-t border-border font-mono-tabular text-xs text-ink">
                <strong>Sanitized Output:</strong> {lintResult.sanitizedPreview}
              </p>
            </div>
          )}
        </div>
      </Card>

      {/* SECTION 06B: Signature #8 Mascot 5-State Companion Showcase */}
      <Card as="section" id="sec-mascot-showcase" aria-labelledby="heading-mascot-showcase">
        <h2
          id="heading-mascot-showcase"
          className="font-display text-2xl font-bold text-ink border-b border-border pb-3"
        >
          06B · Signature #8: 5-State Non-Clinical Mascot Companion
        </h2>
        <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          {(['idle', 'hello', 'thinking', 'celebrate', 'rest'] as const).map(
            (st) => (
              <div
                key={st}
                className="rounded-md border-2 border-border bg-surface-raised p-3 flex flex-col items-center text-center gap-2"
              >
                <Mascot state={st} size="md" />
                <Badge tone="neutral" glyph="✦">
                  {st}
                </Badge>
              </div>
            ),
          )}
        </div>
      </Card>

      {/* SECTION 07: Do & Don't Rules */}
      <Card as="section" id="sec-dodont" aria-labelledby="heading-dodont">
        <h2
          id="heading-dodont"
          className="font-display text-2xl font-bold text-ink border-b border-border pb-3"
        >
          07 · Design System Governance: Do &amp; Don’t
        </h2>
        <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="rounded-md border-2 border-border-strong bg-success-subtle p-4 space-y-2">
            <Badge tone="success" glyph="✓">
              DO — Required Practice
            </Badge>
            <ul className="list-disc ps-5 text-sm text-ink space-y-1.5">
              <li>
                Always pair percentage scores with confidence intervals (e.g.,{' '}
                <code className="font-mono-tabular">76% ± 5%</code>) and render
                diagonal hatching when confidence is below 60%.
              </li>
              <li>
                Provide a 1-click <strong>“View as Table”</strong> toggle on
                every data visualization.
              </li>
              <li>
                Keep timed cognitive trials (`Page 04`) 100% free of mascot
                animations or decorative motion.
              </li>
            </ul>
          </div>

          <div className="rounded-md border-2 border-border-strong bg-danger-subtle p-4 space-y-2">
            <Badge tone="danger" glyph="✕">
              DON’T — Banned Patterns
            </Badge>
            <ul className="list-disc ps-5 text-sm text-ink space-y-1.5">
              <li>
                Never use clinical terms, diagnostic claims, or streak-shaming
                microcopy anywhere in the app.
              </li>
              <li>
                Never use Coral (`--color-accent`) as text on paper or as a sole
                border boundary (2.6:1 on paper; fill-only with `--color-ink`).
              </li>
              <li>
                Never hardcode hex colors, pixel spacings, or fixed 7-dimension
                assumptions in components.
              </li>
            </ul>
          </div>
        </div>
      </Card>
    </div>
  )
}
