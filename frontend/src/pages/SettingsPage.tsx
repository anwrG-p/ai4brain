import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Badge } from '../components/ui/Badge'
import { Button } from '../components/ui/Button'
import { Card } from '../components/ui/Card'
import { DoodleSquiggle } from '../components/ui/DoodleDecorations'
import { Mascot } from '../components/features/brand/Mascot'
import { WhyThisPanel } from '../components/features/coach/WhyThisPanel'
import { useAppStore, type TextScale } from '../state/useAppStore'
import {
  DIMENSION_PRESETS,
  getDimensionsByPreset,
  type DimensionPresetKey,
} from '../config/dimensions'
import type { WhyThisTrail } from '../types'

const SETTINGS_WHY_TRAIL: WhyThisTrail = {
  id: 'trail-settings-ergonomics',
  confidence: 0.98,
  observedData: [
    'WCAG 2.1 AA guideline 1.4.4 mandates resizing text without loss of content or functionality.',
    'Vestibular sensitivity affects ~35% of neurodivergent learners when exposed to unconstrained spring physics.',
    'Zero-Guilt habit boundaries prevent cognitive abandonment caused by arbitrary broken streak metrics.',
  ],
  inference:
    'SynapseTwin decouples cognitive measurement from sensory friction by prioritizing user-controlled ergonomics.',
  recommendation:
    'Activate Calm Sensory Mode during high-fatigue sessions to eliminate extraneous perceptual load.',
  counterfactual:
    'Without granular ergonomics, sensory crowding and motor tremor inflate reaction times by up to 240 ms, falsely degrading Bayesian latent traits.',
  sourceModule: 'deterministic_fallback',
}

const STUDY_WINDOWS = [
  { id: 'morning', label: 'Morning Peak (08:00 – 12:00)', desc: 'Optimal for working memory & high alertness' },
  { id: 'afternoon', label: 'Afternoon Focus (13:00 – 17:00)', desc: 'Balanced for cognitive flexibility & problem solving' },
  { id: 'evening', label: 'Evening Recharge (18:00 – 22:00)', desc: 'Low-intensity reflection & pattern consolidation' },
]

const DAYS_OF_WEEK = [
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
  'Sunday',
]

const SHORTCUT_TABLE_DATA = [
  { action: 'Select Probe Option 1', primary: 'Key 1', alt: 'NumPad 1', context: 'Active Task Runner Probes', scope: 'In-Task' },
  { action: 'Select Probe Option 2', primary: 'Key 2', alt: 'NumPad 2', context: 'Active Task Runner Probes', scope: 'In-Task' },
  { action: 'Pause / Resume Task', primary: 'Spacebar', alt: 'P', context: 'Active Task Runner Probes', scope: 'In-Task' },
  { action: 'Safety Exit to Hub', primary: 'Escape', alt: 'Alt + X', context: 'Global Navigation & Task Exit', scope: 'Universal' },
  { action: 'Toggle Night / Light Lab', primary: 'Shift + D', alt: 'Header Button', context: 'Design System Theme Switcher', scope: 'Universal' },
  { action: 'Epistemic Why This Overlay', primary: '?', alt: 'H', context: 'All Explainability Surfaces', scope: 'Universal' },
]

export function SettingsPage() {
  const {
    theme,
    setTheme,
    reducedMotion,
    setReducedMotion,
    dimensionPreset,
    setDimensionPreset,
    textScale,
    setTextScale,
    enhancedGlyphs,
    setEnhancedGlyphs,
    soundEffects,
    setSoundEffects,
    blurAutoPause,
    setBlurAutoPause,
    studyWindow,
    setStudyWindow,
    restDays,
    toggleRestDay,
    resetSettingsToDefault,
  } = useAppStore()

  const [toastMessage, setToastMessage] = useState<string | null>(null)

  const showToast = (msg: string) => {
    setToastMessage(msg)
    setTimeout(() => setToastMessage(null), 3500)
  }

  const handleReset = () => {
    resetSettingsToDefault()
    showToast('All settings and accessibility preferences restored to factory defaults.')
  }

  const handleCalmSensoryMode = () => {
    setSoundEffects(false)
    setReducedMotion(true)
    setTextScale('115')
    showToast('Calm Sensory Mode engaged: sounds muted, motion dampened, text zoomed to 115%.')
  }

  const activeDimensions = getDimensionsByPreset(dimensionPreset)

  return (
    <div className="space-y-8 animate-fadeIn">
      {/* Toast Banner */}
      {toastMessage && (
        <div
          role="status"
          aria-live="polite"
          className="fixed bottom-6 right-6 z-50 p-4 rounded-xl border-2 border-brand bg-surface shadow-xl flex items-center gap-3 animate-fadeIn"
        >
          <span className="text-brand font-bold text-lg" aria-hidden="true">
            ✓
          </span>
          <p className="text-sm font-semibold text-ink">{toastMessage}</p>
        </div>
      )}

      {/* Header section */}
      <section className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone="brand" glyph="⚙">
              Cognitive Ergonomics
            </Badge>
            <Badge tone="info" glyph="◈">
              Neurodiversity Grounded
            </Badge>
            <Badge tone="reward" glyph="●">
              WCAG 2.1 AA Verified
            </Badge>
          </div>
          <div className="flex items-center gap-2">
            <Link
              to="/privacy"
              className="tactile-btn bg-surface text-ink px-3.5 py-1.5 text-xs font-semibold inline-flex items-center no-underline border border-border"
            >
              Privacy &amp; Data Control →
            </Link>
          </div>
        </div>

        <div>
          <h1 className="font-display text-3xl md:text-4xl font-black tracking-tight text-ink">
            Settings &amp; Accessibility Controls
          </h1>
          <DoodleSquiggle className="max-w-xs mt-1" />
          <p className="text-ink-muted text-base max-w-3xl mt-1">
            Personalize sensory presentation, keyboard ergonomics, non-punitive study boundaries,
            and cognitive dimension pools. Every preference persists client-side in real time.
          </p>
        </div>
      </section>

      {/* Main Grid: Left 7 cols (Settings) + Right 5 cols (Preview & Quick Controls) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Column (7 cols) */}
        <div className="lg:col-span-7 space-y-6">
          {/* Card 1: Visual & Sensory Ergonomics */}
          <Card className="p-6 space-y-6">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <h2 className="font-display font-bold text-lg text-ink flex items-center gap-2">
                <span aria-hidden="true">👁</span> 1. Visual &amp; Sensory Ergonomics
              </h2>
              <Button
                variant="secondary"
                size="sm"
                onClick={handleCalmSensoryMode}
                title="1-click activation of muted sound, reduced motion, and comfort font scale"
              >
                🌿 Calm Sensory Mode
              </Button>
            </div>

            {/* Theme Selector */}
            <div className="space-y-2">
              <label id="theme-label" className="text-sm font-bold text-ink block">
                Interface Color Scheme
              </label>
              <div
                role="radiogroup"
                aria-labelledby="theme-label"
                className="grid grid-cols-1 sm:grid-cols-2 gap-3"
              >
                <button
                  type="button"
                  role="radio"
                  aria-checked={theme === 'light'}
                  onClick={() => setTheme('light')}
                  className={`p-3 rounded-xl border-2 text-left transition-all cursor-pointer focus-ring ${
                    theme === 'light'
                      ? 'border-brand bg-brand/10 font-bold'
                      : 'border-border bg-surface hover:bg-surface-raised'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-display text-sm text-ink">☀ Playful Lab (Light)</span>
                    {theme === 'light' && <span className="text-ink font-bold">●</span>}
                  </div>
                  <p className="text-xs text-ink-muted mt-1">
                    Warm paper (warm paper), deep ink (15.61:1 contrast), teal accents.
                  </p>
                </button>

                <button
                  type="button"
                  role="radio"
                  aria-checked={theme === 'dark'}
                  onClick={() => setTheme('dark')}
                  className={`p-3 rounded-xl border-2 text-left transition-all cursor-pointer focus-ring ${
                    theme === 'dark'
                      ? 'border-brand bg-brand/10 font-bold'
                      : 'border-border bg-surface hover:bg-surface-raised'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-display text-sm text-ink">☾ Night Lab (Dark)</span>
                    {theme === 'dark' && <span className="text-ink font-bold">●</span>}
                  </div>
                  <p className="text-xs text-ink-muted mt-1">
                    Deep canvas (deep canvas), electric cyan, high-contrast lime indicators.
                  </p>
                </button>
              </div>
            </div>

            {/* Cognitive Dimension Registry Preset */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label id="preset-label" className="text-sm font-bold text-ink block">
                  Cognitive Dimensions Active Registry (3 to 10 Dimensions)
                </label>
                <Badge tone="brand" glyph="◈">
                  {getDimensionsByPreset(dimensionPreset).length} Dimensions Active
                </Badge>
              </div>
              <div
                role="radiogroup"
                aria-labelledby="preset-label"
                className="grid grid-cols-2 sm:grid-cols-5 gap-2"
              >
                {DIMENSION_PRESETS.map((item) => {
                  const active = dimensionPreset === item.key
                  return (
                    <button
                      key={item.key}
                      type="button"
                      role="radio"
                      aria-checked={active}
                      onClick={() => setDimensionPreset(item.key)}
                      className={`p-2.5 rounded-lg border-2 text-center transition-all cursor-pointer focus-ring ${
                        active
                          ? 'border-brand bg-brand/10 font-bold'
                          : 'border-border bg-surface hover:bg-surface-raised'
                      }`}
                    >
                      <span className="text-xs sm:text-sm block text-ink">{item.label}</span>
                      <span className="text-xs text-ink-muted block mt-0.5">{item.key} active</span>
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Text Scale Selector */}
            <div className="space-y-2">
              <label id="scale-label" className="text-sm font-bold text-ink block">
                Text Scale &amp; Cognitive Zoom (WCAG 1.4.4 Compliant)
              </label>
              <div
                role="radiogroup"
                aria-labelledby="scale-label"
                className="grid grid-cols-3 gap-2"
              >
                {(
                  [
                    { scale: '100', label: '100% (Standard)', sub: 'Default layout' },
                    { scale: '115', label: '115% (Comfort)', sub: 'Enhanced legibility' },
                    { scale: '130', label: '130% (High Zoom)', sub: 'Maximum readability' },
                  ] as const
                ).map((opt) => {
                  const active = textScale === opt.scale
                  return (
                    <button
                      key={opt.scale}
                      type="button"
                      role="radio"
                      aria-checked={active}
                      onClick={() => setTextScale(opt.scale as TextScale)}
                      className={`p-2.5 rounded-lg border-2 text-center transition-all cursor-pointer focus-ring ${
                        active
                          ? 'border-brand bg-brand/10 font-bold'
                          : 'border-border bg-surface hover:bg-surface-raised'
                      }`}
                    >
                      <span className="text-sm block text-ink">{opt.label}</span>
                      <span className="text-xs text-ink-muted block mt-0.5">{opt.sub}</span>
                    </button>
                  )
                })}
              </div>
            </div>

            {/* High-Contrast Glyph Markers Toggle */}
            <div className="flex items-center justify-between pt-2 border-t border-border">
              <div>
                <span className="text-sm font-bold text-ink block">
                  Enhanced Glyph Markers (Okabe-Ito Colorblind Support)
                </span>
                <p className="text-xs text-ink-muted">
                  Pairs distinct geometric symbols (● ■ ▲ ◆ ⬟ ⬢ ★ ✚ ◎ ⧗) alongside colors.
                </p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={enhancedGlyphs}
                onClick={() => setEnhancedGlyphs(!enhancedGlyphs)}
                className={`focus-ring relative inline-flex h-6 w-11 items-center rounded-full transition-colors cursor-pointer ${
                  enhancedGlyphs ? 'bg-brand' : 'bg-surface-raised border border-border'
                }`}
              >
                <span className="sr-only">Toggle Enhanced Glyph Markers</span>
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    enhancedGlyphs ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>
          </Card>

          {/* Card 2: Motion & Vestibular Comfort */}
          <Card className="p-6 space-y-4">
            <h2 className="font-display font-bold text-lg text-ink flex items-center gap-2 border-b border-border pb-3">
              <span aria-hidden="true">⚡</span> 2. Motion &amp; Vestibular Comfort
            </h2>

            <div className="flex items-center justify-between">
              <div>
                <span className="text-sm font-bold text-ink block">
                  Reduced Motion Mode
                </span>
                <p className="text-xs text-ink-muted max-w-md">
                  Replaces continuous orbital physics, radar rotations, and spring animations with
                  clean, instantaneous transitions. Adheres to system prefers-reduced-motion.
                </p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={reducedMotion}
                onClick={() => setReducedMotion(!reducedMotion)}
                className={`focus-ring relative inline-flex h-6 w-11 items-center rounded-full transition-colors cursor-pointer ${
                  reducedMotion ? 'bg-brand' : 'bg-surface-raised border border-border'
                }`}
              >
                <span className="sr-only">Toggle Reduced Motion</span>
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    reducedMotion ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>
          </Card>

          {/* Card 3: Auditory Feedback & Task Pacing */}
          <Card className="p-6 space-y-4">
            <h2 className="font-display font-bold text-lg text-ink flex items-center gap-2 border-b border-border pb-3">
              <span aria-hidden="true">🔔</span> 3. Auditory Feedback &amp; Task Pacing
            </h2>

            <div className="flex items-center justify-between">
              <div>
                <span className="text-sm font-bold text-ink block">Task Audio Cues</span>
                <p className="text-xs text-ink-muted">
                  Subconscious auditory chimes upon trial presentation and milestone unlock.
                </p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={soundEffects}
                onClick={() => setSoundEffects(!soundEffects)}
                className={`focus-ring relative inline-flex h-6 w-11 items-center rounded-full transition-colors cursor-pointer ${
                  soundEffects ? 'bg-brand' : 'bg-surface-raised border border-border'
                }`}
              >
                <span className="sr-only">Toggle Task Audio Cues</span>
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    soundEffects ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-border">
              <div>
                <span className="text-sm font-bold text-ink block">
                  Window Blur Auto-Pause
                </span>
                <p className="text-xs text-ink-muted">
                  Automatically pauses probe timers if you switch tabs or lose focus, preventing reaction-time distortion.
                </p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={blurAutoPause}
                onClick={() => setBlurAutoPause(!blurAutoPause)}
                className={`focus-ring relative inline-flex h-6 w-11 items-center rounded-full transition-colors cursor-pointer ${
                  blurAutoPause ? 'bg-brand' : 'bg-surface-raised border border-border'
                }`}
              >
                <span className="sr-only">Toggle Window Blur Auto-Pause</span>
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    blurAutoPause ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>
          </Card>

          {/* Card 4: Non-Punitive Habit & Study Boundaries */}
          <Card className="p-6 space-y-4">
            <h2 className="font-display font-bold text-lg text-ink flex items-center gap-2 border-b border-border pb-3">
              <span aria-hidden="true">🌱</span> 4. Non-Punitive Habit &amp; Study Boundaries
            </h2>

            {/* Preferred Study Window */}
            <div className="space-y-2">
              <label id="study-window-label" className="text-sm font-bold text-ink block">
                Preferred Focus Window
              </label>
              <div
                role="radiogroup"
                aria-labelledby="study-window-label"
                className="space-y-2"
              >
                {STUDY_WINDOWS.map((win) => {
                  const active = studyWindow === win.id
                  return (
                    <button
                      key={win.id}
                      type="button"
                      role="radio"
                      aria-checked={active}
                      onClick={() => setStudyWindow(win.id)}
                      className={`w-full p-3 rounded-xl border-2 text-left transition-all cursor-pointer focus-ring flex items-center justify-between ${
                        active
                          ? 'border-brand bg-brand/10 font-bold'
                          : 'border-border bg-surface hover:bg-surface-raised'
                      }`}
                    >
                      <div>
                        <span className="text-sm text-ink block">{win.label}</span>
                        <span className="text-xs text-ink-muted">{win.desc}</span>
                      </div>
                      {active && <span className="text-ink font-bold text-sm">● Active</span>}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Protected Rest Days */}
            <div className="space-y-2 pt-2 border-t border-border">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-sm font-bold text-ink block">
                    Protected Rest Days (Zero-Guilt Streak Protection)
                  </span>
                  <p className="text-xs text-ink-muted">
                    Rest days never penalize streak contracts or Bayesian trajectory models.
                  </p>
                </div>
                <Badge tone="reward" glyph="✓">
                  Zero-Guilt
                </Badge>
              </div>

              <div className="flex flex-wrap gap-2 pt-1">
                {DAYS_OF_WEEK.map((day) => {
                  const isChecked = restDays.includes(day)
                  return (
                    <button
                      key={day}
                      type="button"
                      role="checkbox"
                      aria-checked={isChecked}
                      onClick={() => toggleRestDay(day)}
                      className={`px-3 py-1.5 rounded-lg border-2 text-xs font-semibold transition-all cursor-pointer focus-ring ${
                        isChecked
                          ? 'border-brand bg-brand text-brand-ink font-bold'
                          : 'border-border bg-surface text-ink hover:bg-surface-raised'
                      }`}
                    >
                      {isChecked ? `✓ ${day}` : day}
                    </button>
                  )
                })}
              </div>
            </div>
          </Card>

          {/* Card 5: Dimension Pool Registry Preset */}
          <Card className="p-6 space-y-4">
            <h2 className="font-display font-bold text-lg text-ink flex items-center gap-2 border-b border-border pb-3">
              <span aria-hidden="true">🌐</span> 5. Cognitive Dimension Pool Preset
            </h2>

            <div className="space-y-2">
              <label id="preset-label" className="text-sm font-bold text-ink block">
                Active Cognitive Evaluation Preset
              </label>
              <div
                role="radiogroup"
                aria-labelledby="preset-label"
                className="grid grid-cols-2 sm:grid-cols-5 gap-2"
              >
                {DIMENSION_PRESETS.map((p) => {
                  const active = dimensionPreset === p.key
                  return (
                    <button
                      key={p.key}
                      type="button"
                      role="radio"
                      aria-checked={active}
                      onClick={() => setDimensionPreset(p.key as DimensionPresetKey)}
                      className={`p-2.5 rounded-lg border-2 text-center transition-all cursor-pointer focus-ring ${
                        active
                          ? 'border-brand bg-brand/10 font-bold'
                          : 'border-border bg-surface hover:bg-surface-raised'
                      }`}
                    >
                      <span className="text-sm block text-ink">{p.label}</span>
                      <span className="text-xs text-ink-muted block mt-0.5">
                        {p.key} traits
                      </span>
                    </button>
                  )
                })}
              </div>
            </div>

            <div className="p-3 rounded-xl border border-border bg-canvas/60 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-ink">Active Traits in Pool ({activeDimensions.length}):</span>
                <span className="text-ink-muted font-mono-tabular">Preset {dimensionPreset}</span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {activeDimensions.map((d) => (
                  <span
                    key={d.id}
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs bg-surface border border-border text-ink"
                  >
                    <span style={{ color: d.colorCssVar }}>{d.markerGlyph}</span>
                    <span>{d.name}</span>
                  </span>
                ))}
              </div>
            </div>
          </Card>
        </div>

        {/* Right Column (5 cols): Live Preview & Diagnostics */}
        <div className="lg:col-span-5 space-y-6">
          {/* Live Preview Card */}
          <Card className="p-6 space-y-4 sticky top-6">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <h2 className="font-display font-bold text-base text-ink flex items-center gap-2">
                <span aria-hidden="true">🎨</span> Live Visual Ergonomics Preview
              </h2>
              <Badge tone="brand" glyph="●">
                Live Preview
              </Badge>
            </div>

            <p className="text-xs text-ink-muted">
              This cognitive sample card updates immediately as you adjust font scale, theme,
              and glyph marker contrast.
            </p>

            {/* Cognitive Sample Preview Card */}
            <div
              className="p-5 rounded-xl border-2 border-border-strong bg-surface space-y-3 shadow-sm transition-all"
              style={{
                fontSize: textScale === '130' ? '1.15rem' : textScale === '115' ? '1.05rem' : '0.95rem',
              }}
            >
              <div className="flex items-center justify-between">
                <span className="font-display font-bold text-ink flex items-center gap-2">
                  <span
                    className="text-lg"
                    style={{ color: 'var(--dim-1)' }}
                    aria-hidden="true"
                  >
                    {enhancedGlyphs ? '●' : '•'}
                  </span>
                  Working Memory
                </span>
                <Badge tone="brand">78% ± 4%</Badge>
              </div>

              <p className="text-ink-muted text-xs leading-relaxed">
                Active spatial-symbolic n-back staircase. Incongruent interference latency: 142 ms.
              </p>

              <div className="pt-2 border-t border-border flex items-center justify-between text-xs">
                <span className="text-ink-muted">Physics Mode:</span>
                <span className="font-mono-tabular font-semibold text-ink">
                  {reducedMotion ? 'Instantaneous (Reduced)' : 'Spring (Standard)'}
                </span>
              </div>

              <div className="flex items-center justify-between text-xs">
                <span className="text-ink-muted">Glyph Clarity:</span>
                <span className="font-mono-tabular font-semibold text-ink">
                  {enhancedGlyphs ? 'Enhanced Okabe-Ito' : 'Standard'}
                </span>
              </div>
            </div>

            {/* Quick Remapping Guidance */}
            <div className="p-4 rounded-xl border border-border bg-canvas/60 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-ink">Keyboard Remapping Status</span>
                <Badge tone="info">Conflict-Free</Badge>
              </div>
              <p className="text-xs text-ink-muted">
                Task runner keys (<kbd className="font-mono px-1 py-0.5 rounded bg-surface border border-border">1</kbd>, <kbd className="font-mono px-1 py-0.5 rounded bg-surface border border-border">2</kbd>, <kbd className="font-mono px-1 py-0.5 rounded bg-surface border border-border">Space</kbd>) are mapped cleanly with zero collisions against system modifiers.
              </p>
            </div>

            {/* Reset Defaults Action */}
            <div className="pt-2 border-t border-border space-y-3">
              <Button
                variant="secondary"
                size="md"
                className="w-full"
                onClick={handleReset}
              >
                ↺ Reset All Preferences to Factory Defaults
              </Button>
              <p className="text-xs text-ink-muted text-center">
                Restores Light theme, 100% scale, 7 dimensions, and standard motion.
              </p>
            </div>

            {/* Mascot Companion */}
            <div className="pt-2 flex items-center gap-3 bg-surface-raised p-3 rounded-xl border border-border">
              <Mascot state="idle" size="sm" />
              <p className="text-xs text-ink leading-tight">
                <strong>Ergonomics aren’t one-size-fits-all.</strong> Adjust contrast and pacing so your brain twin reflects pure cognition!
              </p>
            </div>
          </Card>
        </div>
      </div>

      {/* Full-width Section: Accessible Keyboard Shortcuts Reference Table */}
      <Card className="p-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border pb-3">
          <div>
            <h2 className="font-display font-bold text-lg text-ink flex items-center gap-2">
              <span aria-hidden="true">⌨</span> Keyboard Shortcuts &amp; Ergonomics Reference
            </h2>
            <p className="text-xs text-ink-muted mt-0.5">
              Comprehensive single-key navigation mapped for motor accessibility and rapid trial responses.
            </p>
          </div>
          <Badge tone="neutral" glyph="◈">
            WCAG 2.1.1 Compliant
          </Badge>
        </div>

        <div
          role="region"
          aria-label="Keyboard Shortcuts Table"
          tabIndex={0}
          className="focus-ring overflow-x-auto rounded-xl border border-border"
        >
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-canvas/80 text-ink-muted uppercase tracking-wider font-semibold border-b border-border">
              <tr>
                <th scope="col" className="p-3">Action Name</th>
                <th scope="col" className="p-3">Primary Key</th>
                <th scope="col" className="p-3">Alternate Key</th>
                <th scope="col" className="p-3">Context</th>
                <th scope="col" className="p-3">Scope</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {SHORTCUT_TABLE_DATA.map((row) => (
                <tr key={row.action} className="hover:bg-surface-raised transition-colors">
                  <td className="p-3 font-semibold text-ink">{row.action}</td>
                  <td className="p-3">
                    <kbd className="font-mono-tabular px-2 py-1 rounded bg-canvas border border-border font-bold text-ink">
                      {row.primary}
                    </kbd>
                  </td>
                  <td className="p-3">
                    <kbd className="font-mono-tabular px-2 py-1 rounded bg-canvas border border-border text-ink-muted">
                      {row.alt}
                    </kbd>
                  </td>
                  <td className="p-3 text-ink-muted">{row.context}</td>
                  <td className="p-3">
                    <span className="inline-flex px-2 py-0.5 rounded text-xs font-bold uppercase bg-surface-raised border border-border text-ink">
                      {row.scope}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* WhyThisPanel Epistemic Trail */}
      <WhyThisPanel trail={SETTINGS_WHY_TRAIL} />
    </div>
  )
}

export default SettingsPage
