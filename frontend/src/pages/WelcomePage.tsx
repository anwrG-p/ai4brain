import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { getDimensionsByPreset } from '../config/dimensions'
import {
  buildEstimatesForDimensions,
  SAMPLE_WHY_THIS_TRAIL,
} from '../services/mocks/fixtures'
import { useAppStore, type PersonaId } from '../store/useAppStore'
import { UncertaintyRadar } from '../components/signature/UncertaintyRadar'
import { WhyThisPanel } from '../components/signature/WhyThisPanel'
import { Badge } from '../components/ui/Badge'
import { Button } from '../components/ui/Button'
import { Card } from '../components/ui/Card'
import { DoodleSquiggle, DoodleArrow } from '../components/ui/DoodleDecorations'
import brianWavingImg from '../assets/mascot/brian-waving.png'
import brianWavingDarkModeImg from '../assets/mascot/brian-waving-darkmode.png'

type HeroPreviewState =
  | 'calibrated'
  | 'low-confidence'
  | 'partial'
  | 'loading'
  | 'empty'
  | 'error'
  | 'extreme-text'

interface PersonaLauncherCardSpec {
  id: PersonaId
  name: string
  roleLabel: string
  badgeLabel: string
  badgeTone: 'brand' | 'low-confidence' | 'reward'
  badgeGlyph: string
  summary: string
  metricsLine: string
  ctaLabel: string
  previewTargetState: HeroPreviewState
}

const PERSONA_CARDS: readonly PersonaLauncherCardSpec[] = [
  {
    id: 'steady-improver',
    name: 'Youssef · Steady Improver',
    roleLabel: '6 Weeks History · 14 Snapshots',
    badgeLabel: 'Calibrated (84% Conf)',
    badgeTone: 'brand',
    badgeGlyph: '●',
    summary:
      'Consistent 2-minute blocks across 6 weeks with narrowing confidence intervals, active SAT-JEPA cluster progression, and high AI collaboration.',
    metricsLine: 'Collab Score: 82 ± 4 · Mean RT: 585 ms · 0 Error Bursts',
    ctaLabel: 'Load Youssef (Calibrated Twin)',
    previewTargetState: 'calibrated',
  },
  {
    id: 'noisy-low-confidence',
    name: 'Salma · Irregular Schedule',
    roleLabel: 'High RT Variance · Late-Night Blocks',
    badgeLabel: 'Hatched Low-Conf (<60%)',
    badgeTone: 'low-confidence',
    badgeGlyph: '▨',
    summary:
      'Demonstrates how SynapseTwin handles noisy response times and small sample sizes with honest diagonal hatching and rest-first coaching.',
    metricsLine: '4 Hatched Dimensions · Jitter: 195 ms · Preliminary Range',
    ctaLabel: 'Load Salma (Hatched Twin)',
    previewTargetState: 'low-confidence',
  },
  {
    id: 'new-user',
    name: 'Nour · First-Time Learner',
    roleLabel: '0 Prior Sessions · Fresh Start',
    badgeLabel: 'Ready for 2-Min Baseline',
    badgeTone: 'reward',
    badgeGlyph: '★',
    summary:
      'Experience the zero-data entry flow: granular consent, mandatory non-biometric lock, and the 2-minute Quick Baseline assessment.',
    metricsLine: '0 Trials Logged · Non-Biometric Default ON · Est. 2 min',
    ctaLabel: 'Load Nour (New Baseline)',
    previewTargetState: 'empty',
  },
]

const THREE_STEPS = [
  {
    number: '01',
    stepLabel: '01 · Gamified Diagnostics',
    title: '2-Minute Micro-Games',
    badge: 'Layer A Psychometrics',
    badgeTone: 'brand' as const,
    glyph: '●',
    iconText: '🎮',
    description:
      'Visual recall, reaction pacing, and pattern flow puzzles disguised as pleasant micro-interactions. Zero test stress, zero trick questions.',
    meta: 'Adaptive Difficulty · 3 Games',
  },
  {
    number: '02',
    stepLabel: '02 · Digital Shadow',
    title: 'Your Living Brain Twin',
    badge: '95% ±CI & Hatched States',
    badgeTone: 'info' as const,
    glyph: '◆',
    iconText: '🧠',
    description:
      'Maps core cognitive dimensions with honest confidence halos. As your rhythm fluctuates with sleep, caffeine, or stress, your twin recalibrates.',
    meta: 'Dynamic Calibration · ±4% Halo',
  },
  {
    number: '03',
    stepLabel: '03 · Humane Pacing',
    title: 'Zero-Guilt Growth',
    badge: 'Automatic Rest-Protection',
    badgeTone: 'reward' as const,
    glyph: '★',
    iconText: '🌿',
    description:
      'Workouts tailored to your biological energy peak. Automatic streak-freezes on rest days so you never feel penalized for resting.',
    meta: 'Rest-Protected · 100% Safe',
  },
]

export default function WelcomePage() {
  const navigate = useNavigate()
  const {
    dimensionPreset,
    activePersona,
    setActivePersona,
    theme,
  } = useAppStore()

  const [previewState, setPreviewState] = useState<HeroPreviewState>('calibrated')
  const [selectedNotice, setSelectedNotice] = useState<string | null>(null)

  const effectivePersona: PersonaId =
    previewState === 'low-confidence'
      ? 'noisy-low-confidence'
      : previewState === 'partial'
        ? 'edge-missing-dim'
        : previewState === 'empty'
          ? 'new-user'
          : 'steady-improver'

  const activeDimensions = useMemo(
    () => getDimensionsByPreset(dimensionPreset),
    [dimensionPreset],
  )

  const estimates = useMemo(
    () => buildEstimatesForDimensions(activeDimensions, effectivePersona),
    [activeDimensions, effectivePersona],
  )

  const handleSelectPersona = (card: PersonaLauncherCardSpec) => {
    setActivePersona(card.id)
    setPreviewState(card.previewTargetState)
    setSelectedNotice(
      `Active persona switched to ${card.name} (${activeDimensions.length} cognitive dimensions active).`,
    )
  }

  const handleStartBaseline = () => {
    setActivePersona('new-user')
    navigate('/onboarding')
  }

  return (
    <div className="space-y-12 pb-12">
      {/* Live Feedback Toast / Status Banner when Persona or Baseline is triggered */}
      {selectedNotice && (
        <div
          role="status"
          aria-live="polite"
          className="tactile-card bg-brand-subtle p-4 flex flex-wrap items-center justify-between gap-3 border-2 border-border-strong shadow-doodle"
        >
          <div className="flex items-center gap-2.5">
            <Badge tone="brand" glyph="✓">
              Persona Active
            </Badge>
            <span className="text-sm font-semibold text-ink">
              {selectedNotice}
            </span>
          </div>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setSelectedNotice(null)}
          >
            Dismiss
          </Button>
        </div>
      )}

      {/* =========================================================================
          HERO STAGE: 2-COLUMN SPLIT (Matches Stitch Screen 10 Welcome & Baseline)
          ========================================================================= */}
      <section
        aria-labelledby="welcome-hero-heading"
        className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center pt-2 pb-6"
      >
        {/* Left Column: Narrative, Value Proposition & Primary CTA */}
        <div className="lg:col-span-6 flex flex-col items-start gap-6 pt-10 sm:pt-12 lg:pt-14">
          {/* Headline & Subtitle */}
          <div className="flex flex-col gap-3">
            <h1
              id="welcome-hero-heading"
              className="font-display text-3xl sm:text-4xl lg:text-5xl font-extrabold text-ink tracking-tight leading-tight"
            >
              Let's map how your mind works in 2 minutes.
            </h1>
            <div className="max-w-xs">
              <DoodleSquiggle className="text-brand" />
            </div>
            <p className="text-base sm:text-lg text-ink-muted max-w-xl leading-relaxed">
              No labels. No scores to fail. Just your living cognitive twin adapting seamlessly to your natural daily rhythm.
            </p>
          </div>

          {/* Tactile Action Stack */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4 w-full pt-1">
            <div className="relative inline-flex items-center">
              <div className="hidden sm:block absolute -left-14 top-2 pointer-events-none">
                <DoodleArrow />
              </div>
              <button
                type="button"
                id="start-baseline-btn"
                onClick={handleStartBaseline}
                className="group relative inline-flex items-center justify-center gap-3 px-8 py-4 rounded-pill bg-brand text-brand-ink font-display text-lg font-bold border-2 border-border-strong shadow-doodle hover:shadow-doodle-lg active:translate-x-0.5 active:translate-y-0.5 active:shadow-tactile-active transition-all cursor-pointer"
              >
                <span>Start my 2-minute baseline</span>
                <span className="transition-transform duration-200 group-hover:translate-x-1" aria-hidden="true">→</span>
              </button>
            </div>

            <div className="flex items-center gap-2 px-3 py-2 text-ink-muted font-mono text-xs">
              <span className="text-success font-bold" aria-hidden="true">⏱️</span>
              <span>Est. 120 secs · Pausable</span>
            </div>
          </div>


          {/* Micro Stats Ticker */}
          <div className="w-full grid grid-cols-3 gap-2.5 pt-4">
            <div className="p-3 bg-surface-raised rounded-xl border-2 border-border-strong shadow-doodle-sm">
              <div className="font-mono text-xl sm:text-2xl font-bold text-ink">6</div>
              <div className="font-mono text-xs text-ink-muted">Flow Facets</div>
            </div>
            <div className="p-3 bg-surface-raised rounded-xl border-2 border-border-strong shadow-doodle-sm">
              <div className="font-mono text-xl sm:text-2xl font-bold text-ink">0</div>
              <div className="font-mono text-xs text-ink-muted">Clinical Labels</div>
            </div>
            <div className="p-3 bg-surface-raised rounded-xl border-2 border-border-strong shadow-doodle-sm">
              <div className="font-mono text-xl sm:text-2xl font-bold text-ink">±4%</div>
              <div className="font-mono text-xs text-ink-muted">Confidence Band</div>
            </div>
          </div>
        </div>

        {/* Right Column: Brian Mascot Direct Display (Frameless, Scaled-Up, Aesthetic Speech Bubble) */}
        <div className="lg:col-span-6 relative flex flex-col items-center justify-center pt-2">
          <div className="relative w-full max-w-lg mx-auto flex flex-col items-center">
            {/* Brian's Aesthetic Speech Bubble */}
            <div className="relative mb-3 sm:mb-4 max-w-md w-full bg-surface-raised p-4 sm:p-5 rounded-3xl border-2 border-border-strong shadow-doodle transition-all hover:-translate-y-0.5" style={{ transform: 'translate(60px, 20px)' }}>
              <p className="font-sans text-base sm:text-lg text-ink font-semibold leading-snug">
                "Hey there! I'm Brian, your personal friendly Axolotl. Ready to map how your mind works ?"
              </p>
              <div className="mt-3 flex items-center justify-between font-mono text-xs text-ink-muted pt-2 border-t border-border-strong/20">
                <span className="flex items-center gap-1.5 font-semibold text-ink">
                  <span className="w-2.5 h-2.5 rounded-pill bg-success animate-pulse" />
                  Brian · Personal Cognitive Twin
                </span>

              </div>
              {/* Tactical Speech Pointer pointing down towards Brian */}
              <div
                className="absolute -bottom-2.5 left-1/2 -translate-x-1/2 w-0 h-0 border-l-8 border-l-transparent border-r-8 border-r-transparent border-t-8 border-t-border-strong"
                aria-hidden="true"
              />
            </div>

            {/* Direct Scaled-Up Mascot without Frame */}
            <div className="relative flex flex-col items-center justify-center w-full">
              {/* Soft Confidence Glow Halo */}
              <div
                className="absolute w-72 h-72 sm:w-96 sm:h-96 rounded-full bg-brand/15 blur-3xl pointer-events-none -z-10 animate-pulse"
                aria-hidden="true"
              />

              {/* Scaled-Up Mascot directly on canvas */}
              <img
                src={theme === 'dark' ? brianWavingDarkModeImg : brianWavingImg}
                alt="Brian the Axolotl mascot waving cheerfully"
                style={{ transform: 'translate(100px, 25px)' }}
                className="w-full max-w-[360px] sm:max-w-[420px] lg:max-w-[480px] h-auto object-contain drop-shadow-xl select-none transition-transform duration-300 hover:scale-105"
              />

              {/* Subtle grounding contact shadow */}
              <div
                className="w-48 sm:w-60 h-3 bg-ink/10 rounded-pill blur-sm -mt-2 pointer-events-none select-none"
                aria-hidden="true"
              />
            </div>
          </div>
        </div>
      </section>

      {/* Visual Divider: Sketched Line with Stamp ("The Brian Protocol") */}
      <div className="w-full flex items-center justify-center my-4">
        <div className="w-full border-b-2 border-dotted border-border-strong/40" />
        <div className="px-4 bg-surface text-ink font-mono text-xs uppercase tracking-widest whitespace-nowrap border-2 border-border-strong rounded-pill shadow-doodle-sm py-1">
          The Brian Protocol
        </div>
        <div className="w-full border-b-2 border-dotted border-border-strong/40" />
      </div>

      {/* =========================================================================
          BELOW THE FOLD: 3 MINIMALIST SKETCH CARDS (Matches Stitch Screen 10)
          ========================================================================= */}
      <section
        id="how-it-works"
        aria-labelledby="how-it-works-heading"
        className="space-y-6"
      >
        <div className="text-center max-w-2xl mx-auto space-y-2">
          <span className="font-mono text-xs font-bold uppercase tracking-wider text-ink-muted">
            Humane Cognitive Architecture
          </span>
          <h2
            id="how-it-works-heading"
            className="font-display text-2xl sm:text-3xl font-bold text-ink"
          >
            How SynapseTwin Works
          </h2>
          <p className="text-sm sm:text-base text-ink-muted leading-relaxed">
            A continuous calibration loop designed with scientific precision,
            transparent uncertainty bands, and zero camera or microphone requirements.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {THREE_STEPS.map((step) => (
            <Card
              key={step.number}
              as="article"
              className="p-6 sm:p-7 flex flex-col justify-between gap-5 relative border-2 border-border-strong shadow-doodle hover:shadow-doodle-lg transition-all"
            >
              <div className="doodle-tape" />
              <div className="space-y-3 pt-1">
                <div className="flex items-center justify-between gap-2">
                  <div className="w-10 h-10 rounded-xl bg-brand-subtle border-2 border-border-strong flex items-center justify-center text-lg shadow-doodle-sm">
                    {step.iconText}
                  </div>
                  <Badge tone={step.badgeTone} glyph={step.glyph}>
                    {step.badge}
                  </Badge>
                </div>

                <div>
                  <span className="font-mono text-xs font-bold uppercase text-ink-muted tracking-wider block">
                    {step.stepLabel}
                  </span>
                  <h3 className="font-display text-xl font-bold text-ink mt-0.5">
                    {step.title}
                  </h3>
                </div>

                <p className="text-xs sm:text-sm text-ink-muted leading-relaxed">
                  {step.description}
                </p>
              </div>

              <div className="pt-3 border-t-2 border-dashed border-border-strong/30 flex items-center justify-between text-xs text-ink-muted font-mono">
                <span>Phase {step.number}</span>
                <span className="text-ink font-semibold">{step.meta}</span>
              </div>
            </Card>
          ))}
        </div>
      </section>

      {/* =========================================================================
          INTERACTIVE RADAR PREVIEW & PERSONA LAUNCHERS (Evaluation Suite)
          ========================================================================= */}
      <section
        id="radar-preview"
        aria-labelledby="radar-preview-heading"
        className="pt-6 space-y-6"
      >
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <span className="font-mono text-xs font-bold uppercase tracking-wider text-ink-muted">
              Interactive Epistemic Visualization
            </span>
            <h2
              id="radar-preview-heading"
              className="font-display text-2xl sm:text-3xl font-bold text-ink"
            >
              Meet your evolving cognitive twin—Live Radar Preview
            </h2>
            <p className="text-sm text-ink-muted mt-1">
              Inspect how confidence intervals (<code className="font-mono">±CI</code>) and hatched low-confidence states render live:
            </p>
          </div>
          <Badge tone="brand" glyph="◈">
            Active Persona: {activePersona}
          </Badge>
        </div>

        {/* Interactive Preview State Switcher Buttons */}
        <div
          role="group"
          aria-label="Hero Brain Twin preview state switcher"
          className="flex flex-wrap gap-2"
        >
          {(
            [
              { id: 'calibrated', label: 'Calibrated (84%)' },
              { id: 'low-confidence', label: 'Low-Conf (Hatched)' },
              { id: 'partial', label: 'Partial (1 Missing)' },
              { id: 'loading', label: 'Loading' },
              { id: 'empty', label: 'Empty (New)' },
              { id: 'error', label: 'Error' },
              { id: 'extreme-text', label: 'Extreme Values' },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              type="button"
              aria-pressed={previewState === tab.id}
              onClick={() => setPreviewState(tab.id)}
              className={`focus-ring min-h-10 px-3.5 py-1.5 rounded-pill border-2 border-border-strong text-xs font-bold cursor-pointer transition-colors shadow-doodle-sm ${previewState === tab.id
                ? 'bg-brand text-brand-ink'
                : 'bg-surface-raised text-ink hover:bg-brand-subtle'
                }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Live Interactive Radar View */}
        <div className="w-full max-w-xl mx-auto p-4 sm:p-6 bg-surface rounded-2xl border-2 border-border-strong shadow-doodle-lg">
          <UncertaintyRadar
            dimensions={activeDimensions}
            estimates={estimates}
            title="Preview Radar"
          />
        </div>

        {/* Evaluator Persona Launchers Grid */}
        <div className="space-y-3 pt-2">
          <div className="flex items-center justify-between">
            <h3 className="font-display text-lg font-bold text-ink">
              Evaluator Persona Switcher (Demonstration Data)
            </h3>
            <span className="text-xs text-ink-muted font-mono">
              Test &amp; Verify Archetypes
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {PERSONA_CARDS.map((card) => {
              const isCurrent = activePersona === card.id
              return (
                <Card
                  key={card.id}
                  className={`p-5 flex flex-col justify-between gap-4 border-2 border-border-strong shadow-doodle transition-all ${isCurrent ? 'bg-brand-subtle/50 ring-2 ring-brand' : ''
                    }`}
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono text-xs font-bold text-ink">
                        {card.roleLabel}
                      </span>
                      <Badge tone={card.badgeTone} glyph={card.badgeGlyph}>
                        {card.badgeLabel}
                      </Badge>
                    </div>
                    <h4 className="font-display text-base font-bold text-ink">
                      {card.name}
                    </h4>
                    <p className="text-xs text-ink-muted leading-relaxed">
                      {card.summary}
                    </p>
                  </div>

                  <div className="space-y-2 pt-2 border-t-2 border-dashed border-border-strong/30">
                    <p className="font-mono text-xs text-ink-muted">
                      {card.metricsLine}
                    </p>
                    <Button
                      variant={isCurrent ? 'primary' : 'secondary'}
                      size="sm"
                      className="w-full text-xs font-bold"
                      onClick={() => handleSelectPersona(card)}
                    >
                      {card.ctaLabel}
                    </Button>
                  </div>
                </Card>
              )
            })}
          </div>
        </div>

        {/* WhyThis Pedagogical Transparency Panel */}
        <div className="pt-4">
          <WhyThisPanel
            trail={SAMPLE_WHY_THIS_TRAIL}
            title="Pedagogical Transparency: Why This Next Step?"
            defaultExpanded={false}
          />
        </div>
      </section>

      {/* Bottom Reassurance Dock */}
      <div className="bg-surface-raised rounded-2xl p-6 sm:p-8 flex flex-col md:flex-row items-center justify-between gap-6 border-2 border-border-strong shadow-doodle-lg">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-pill bg-surface border-2 border-border-strong flex items-center justify-center text-brand text-2xl shadow-doodle-sm shrink-0">
            🛡️
          </div>
          <div>
            <h4 className="font-display text-lg font-bold text-ink">
              Private by Architecture, Not Just by Policy
            </h4>
            <p className="text-xs sm:text-sm text-ink-muted">
              No tracking beacons. No ad brokerage. Data stays in your browser's encrypted sandbox.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3 w-full md:w-auto">
          <Link
            to="/privacy"
            className="w-full md:w-auto px-5 py-2.5 rounded-pill bg-surface text-ink font-mono text-xs font-bold hover:bg-brand-subtle transition-colors border-2 border-border-strong shadow-doodle-sm text-center no-underline"
          >
            Explore Protocol Spec
          </Link>
          <Link
            to="/assessment"
            className="w-full md:w-auto px-5 py-2.5 rounded-pill bg-brand text-brand-ink font-mono text-xs font-bold hover:opacity-90 transition-opacity border-2 border-border-strong shadow-doodle-sm text-center no-underline"
          >
            Begin Assessment →
          </Link>
        </div>
      </div>
    </div>
  )
}
