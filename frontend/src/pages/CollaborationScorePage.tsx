import { useState, useId } from 'react'
import {
  buildCollaborationScoreForPersona,
  COLLABORATION_LONGITUDINAL_HISTORY,
} from '../services/mocks/fixtures'
import { useAppStore, type PersonaId } from '../state/useAppStore'
import { Badge } from '../components/ui/Badge'
import { Button } from '../components/ui/Button'
import { Card } from '../components/ui/Card'
import { DoodleSquiggle } from '../components/ui/DoodleDecorations'
import { CollaborationScoreCard } from '../components/features/collaboration/CollaborationScoreCard'
import { Mascot } from '../components/features/brand/Mascot'

interface PersonaOption {
  id: PersonaId
  name: string
  sublabel: string
  scoreBadge: string
}

const PERSONA_OPTIONS: PersonaOption[] = [
  {
    id: 'steady-improver',
    name: 'Youssef',
    sublabel: 'Steady Analytical Improver',
    scoreBadge: '82 ± 4',
  },
  {
    id: 'noisy-low-confidence',
    name: 'Salma',
    sublabel: 'Developing / Wide CI',
    scoreBadge: '61 ± 9',
  },
  {
    id: 'new-user',
    name: 'Rami',
    sublabel: 'Baseline Orientation',
    scoreBadge: '55 ± 11',
  },
]

export function CollaborationScorePage() {
  const { activePersona, setActivePersona, showMascot } = useAppStore()
  const [isDynamicWeights, setIsDynamicWeights] = useState(false)
  const [simulatedDeltas, setSimulatedDeltas] = useState<Record<string, number>>({})
  const [showLongitudinalTable, setShowLongitudinalTable] = useState(false)

  const historyRegionId = useId()

  const currentPayload = buildCollaborationScoreForPersona(activePersona)

  const handleSimulateAction = (
    key: 'audit' | 'clarify' | 'iterate' | 'autonomy' | 'responsible',
  ) => {
    setSimulatedDeltas((prev) => {
      const copy = { ...prev }
      if (key === 'audit') {
        copy.verification = (copy.verification || 0) + 2
      } else if (key === 'clarify') {
        copy.clarification = (copy.clarification || 0) + 2
      } else if (key === 'iterate') {
        copy.iteration = (copy.iteration || 0) + 2
      } else if (key === 'autonomy') {
        copy.autonomy = (copy.autonomy || 0) + 2
      } else if (key === 'responsible') {
        copy.responsible_use = (copy.responsible_use || 0) + 3
      }
      return copy
    })
  }

  const handleResetSimulation = () => {
    setSimulatedDeltas({})
  }

  const totalSimulatedActions = Object.values(simulatedDeltas).reduce(
    (sum, val) => sum + Math.floor(val / 2),
    0,
  )

  const mascotState =
    (simulatedDeltas.responsible_use || 0) > 0
      ? 'rest'
      : totalSimulatedActions > 2
        ? 'celebrate'
        : (simulatedDeltas.verification || 0) > 0
          ? 'thinking'
          : 'idle'

  return (
    <div className="space-y-8 pb-16">
      {/* Page Header & Meta Bar */}
      <section className="space-y-4" aria-labelledby="collab-page-heading">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2 text-xs font-mono text-ink-muted">
            <span>SynapseTwin</span>
            <span aria-hidden="true">/</span>
            <span>Layer B & C Metacognition</span>
            <span aria-hidden="true">/</span>
            <span className="font-semibold text-brand">AI Collaboration Score</span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Badge tone="warning" glyph="⚠">
              Design proposal, not validated
            </Badge>
            <Badge tone="brand" glyph="✦">
              Human-AI Synergy Framework
            </Badge>
          </div>
        </div>

        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
          <div className="space-y-1">
            <h1
              id="collab-page-heading"
              className="font-display text-3xl sm:text-4xl font-extrabold text-ink tracking-tight"
            >
              AI Collaboration Score Deep-Dive
            </h1>
            <DoodleSquiggle className="max-w-xs mt-1" />
            <p className="text-base text-ink-muted max-w-2xl leading-relaxed">
              Evaluating human-AI synergy through empirical telemetry. Rewards critical inquiry, explainability auditing, and autonomous goal regulation over passive compliance.
            </p>
          </div>

          {/* Example Profile Switcher */}
          <div className="space-y-1.5 self-start lg:self-auto">
            <span className="text-xs font-mono uppercase tracking-wider text-ink-muted block">
              Example Profile:
            </span>
            <div
              role="group"
              aria-label="Profile Preset Switcher"
              className="flex flex-wrap items-center gap-1.5 rounded-pill border-2 border-border-strong bg-surface p-1"
            >
              {PERSONA_OPTIONS.map((p) => {
                const isSelected = activePersona === p.id
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => {
                      setActivePersona(p.id)
                      setSimulatedDeltas({})
                    }}
                    aria-pressed={isSelected}
                    className={`focus-ring min-h-11 px-3 py-1.5 rounded-pill text-xs font-semibold cursor-pointer transition-all ${
                      isSelected
                        ? 'bg-brand text-brand-ink shadow-xs'
                        : 'text-ink hover:bg-surface-raised'
                    }`}
                  >
                    <span>{p.name}</span>
                    <span className="ml-1.5 font-mono text-xs font-semibold">
                      ({p.scoreBadge})
                    </span>
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      </section>

      {/* Main 12-Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left 7 Columns: Signature #5 <CollaborationScoreCard /> */}
        <div className="lg:col-span-7 space-y-6">
          <CollaborationScoreCard
            payload={currentPayload}
            isDynamicWeights={isDynamicWeights}
            onToggleDynamicWeights={setIsDynamicWeights}
            onSimulateAction={handleSimulateAction}
            onResetSimulation={handleResetSimulation}
            simulatedDeltas={simulatedDeltas}
            showWhyThis={true}
          />
        </div>

        {/* Right 5 Columns: Metacognitive Telemetry Simulator & Longitudinal Curve */}
        <div className="lg:col-span-5 space-y-6">
          {/* Interactive Telemetry Action Simulator */}
          <Card
            as="section"
            variant="default"
            className="border-2 border-border-strong space-y-4"
            aria-labelledby="simulator-heading"
          >
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div>
                <h2
                  id="simulator-heading"
                  className="font-display text-xl font-bold text-ink"
                >
                  Interactive Action Simulator
                </h2>
                <p className="text-xs text-ink-muted mt-0.5">
                  Simulate live user events to observe reactive score adjustments.
                </p>
              </div>
              <Badge tone="reward" glyph="⚡">
                Live Simulator
              </Badge>
            </div>

            <div className="space-y-2.5">
              <span className="text-xs font-mono uppercase tracking-wide text-ink-muted block">
                Trigger Collaborative Actions:
              </span>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => handleSimulateAction('audit')}
                  className="justify-between text-xs"
                >
                  <span>🔍 Audit &quot;Why This?&quot; Trail</span>
                  <span className="font-mono text-brand font-bold">+2 Verif</span>
                </Button>

                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => handleSimulateAction('clarify')}
                  className="justify-between text-xs"
                >
                  <span>💬 Ask Model Clarification</span>
                  <span className="font-mono text-brand font-bold">+2 Clarif</span>
                </Button>

                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => handleSimulateAction('iterate')}
                  className="justify-between text-xs"
                >
                  <span>🔄 Refine Pacing Goal</span>
                  <span className="font-mono text-brand font-bold">+2 Iter</span>
                </Button>

                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => handleSimulateAction('autonomy')}
                  className="justify-between text-xs"
                >
                  <span>🎯 Self-Select Practice Drill</span>
                  <span className="font-mono text-brand font-bold">+2 Auton</span>
                </Button>

                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => handleSimulateAction('responsible')}
                  className="justify-between text-xs"
                >
                  <span>🛡️ Honor Rest Day / Non-Bio Lock</span>
                  <span className="font-mono text-brand font-bold">+3 Resp</span>
                </Button>
              </div>

              {totalSimulatedActions > 0 && (
                <div className="pt-2 flex items-center justify-between border-t border-border">
                  <span className="text-xs text-ink-muted">
                    {totalSimulatedActions} simulated action{totalSimulatedActions > 1 ? 's' : ''} applied
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleResetSimulation}
                    className="text-xs text-brand hover:underline"
                  >
                    Reset Simulator
                  </Button>
                </div>
              )}
            </div>
          </Card>

          {/* Longitudinal Collaboration History Card */}
          <Card
            as="section"
            variant="default"
            className="border-2 border-border-strong space-y-4"
            aria-labelledby="history-heading"
          >
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div>
                <h2
                  id="history-heading"
                  className="font-display text-xl font-bold text-ink"
                >
                  Longitudinal Growth (W1 → W6)
                </h2>
                <p className="text-xs text-ink-muted mt-0.5">
                  Epistemic uncertainty narrows as telemetry density increases.
                </p>
              </div>
              <Badge tone="brand" glyph="📈">
                6 Weeks Logged
              </Badge>
            </div>

            {/* Stepper / Timeline Visual */}
            <div className="space-y-2">
              <div className="grid grid-cols-6 gap-1.5 text-center">
                {COLLABORATION_LONGITUDINAL_HISTORY.map((pt, idx) => {
                  const isCurrent = idx === COLLABORATION_LONGITUDINAL_HISTORY.length - 1
                  return (
                    <div
                      key={pt.weekKey}
                      className={`rounded-sm p-2 border transition-all ${
                        isCurrent
                          ? 'bg-brand/15 border-brand text-ink font-bold'
                          : 'bg-surface-raised border-border text-ink'
                      }`}
                    >
                      <span className="block font-mono text-xs text-ink-muted">
                        {pt.weekKey}
                      </span>
                      <span className="block font-display text-base font-extrabold text-ink mt-0.5">
                        {pt.score}
                      </span>
                      <span className="block font-mono text-xs text-ink-muted font-medium">
                        ±{pt.ciUpper - pt.score}
                      </span>
                    </div>
                  )
                })}
              </div>

              <p className="text-xs text-ink-muted leading-relaxed">
                Initial baseline uncertainty (Week 1: <code className="font-mono font-bold text-ink">± 8</code>) progressively narrows to <code className="font-mono font-bold text-ink">± 4</code> by Week 6 as Bayesian QUEST+ accumulates verification telemetry.
              </p>
            </div>

            {/* Accessible Longitudinal Table Toggle */}
            <div className="pt-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setShowLongitudinalTable((prev) => !prev)}
                aria-expanded={showLongitudinalTable}
                aria-controls={historyRegionId}
                className="w-full text-xs justify-center"
              >
                {showLongitudinalTable
                  ? 'Hide Historical Data Table ▲'
                  : 'Inspect Longitudinal Table Region ▼'}
              </Button>
            </div>

            {showLongitudinalTable && (
              <div
                id={historyRegionId}
                tabIndex={0}
                role="region"
                aria-label="Longitudinal Collaboration Score History"
                className="focus-ring overflow-x-auto rounded-md border border-border bg-canvas p-3"
              >
                <table
                  aria-label="Longitudinal Collaboration Score History Table"
                  className="w-full min-w-80 text-start text-xs border-collapse"
                >
                  <thead>
                    <tr className="border-b border-border font-semibold text-ink">
                      <th scope="col" className="p-1.5 text-start">Week</th>
                      <th scope="col" className="p-1.5 text-center">Score</th>
                      <th scope="col" className="p-1.5 text-center">CI Range</th>
                      <th scope="col" className="p-1.5 text-center">Actions Logged</th>
                    </tr>
                  </thead>
                  <tbody>
                    {COLLABORATION_LONGITUDINAL_HISTORY.map((pt) => (
                      <tr key={pt.weekKey} className="border-b border-border/50 text-ink">
                        <th scope="row" className="p-1.5 font-medium text-start">
                          {pt.weekLabel}
                        </th>
                        <td className="p-1.5 text-center font-mono font-bold text-brand">
                          {pt.score}
                        </td>
                        <td className="p-1.5 text-center font-mono text-ink-muted">
                          [{pt.ciLower} – {pt.ciUpper}]
                        </td>
                        <td className="p-1.5 text-center font-mono">
                          {pt.actionsCount}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>

          {/* Metacognitive Principles & Non-Clinical Framing Card */}
          <Card
            as="section"
            variant="default"
            className="border-2 border-border-strong space-y-3 bg-surface-raised"
            aria-labelledby="principles-heading"
          >
            <div className="flex items-center gap-2">
              <span aria-hidden="true" className="text-brand font-bold text-base">
                🛡️
              </span>
              <h2
                id="principles-heading"
                className="font-display text-lg font-bold text-ink"
              >
                Human-AI Agency Principles
              </h2>
            </div>

            <ul className="space-y-2 text-xs text-ink-muted leading-relaxed">
              <li className="flex items-start gap-2">
                <span aria-hidden="true" className="text-brand font-bold shrink-0">
                  •
                </span>
                <span>
                  <strong className="text-ink">Zero Automation Bias:</strong> Users who mechanically accept every AI suggestion without reviewing the reasoning trail receive lower autonomy ratings.
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span aria-hidden="true" className="text-brand font-bold shrink-0">
                  •
                </span>
                <span>
                  <strong className="text-ink">Rest is Non-Punitive:</strong> Honoring recovery days boosts Responsible Use scores and preserves streaks with zero penalty.
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span aria-hidden="true" className="text-brand font-bold shrink-0">
                  •
                </span>
                <span>
                  <strong className="text-ink">Non-Diagnostic Guarantee:</strong> This index measures task interaction habits only; it is never mapped to clinical or cognitive deficits.
                </span>
              </li>
            </ul>
          </Card>

          {/* Companion Mascot Reaction */}
          {showMascot && (
            <div className="flex justify-center pt-2">
              <Mascot
                state={mascotState}
                size="md"
                title="Synapse Companion · Metacognition Guide"
                message={
                  mascotState === 'rest'
                    ? 'Responsible pacing detected! Recovery maintains consolidation.'
                    : mascotState === 'celebrate'
                      ? 'Exceptional human-AI synergy! Critical questions logged.'
                      : mascotState === 'thinking'
                        ? 'Auditing reasoning trail... Epistemic certainty calibrated.'
                        : 'Ready to explore your human-AI collaboration profile!'
                }
              />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default CollaborationScorePage

