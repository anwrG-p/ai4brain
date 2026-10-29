import { useState, useId } from 'react'
import type { CollaborationScorePayload, CollaborationSubScore } from '../../../types'
import { Badge } from '../../ui/Badge'
import { Button } from '../../ui/Button'
import { Card } from '../../ui/Card'
import { WhyThisPanel } from '../coach/WhyThisPanel'

export interface CollaborationScoreCardProps {
  payload: CollaborationScorePayload
  isDynamicWeights?: boolean
  onToggleDynamicWeights?: (dynamic: boolean) => void
  onSimulateAction?: (actionKey: 'audit' | 'clarify' | 'iterate' | 'autonomy' | 'responsible') => void
  onResetSimulation?: () => void
  simulatedDeltas?: Record<string, number>
  showWhyThis?: boolean
  className?: string
}

const SUB_SCORE_META: Record<
  CollaborationSubScore['key'],
  { glyph: string; description: string; colorClass: string; barBgClass: string }
> = {
  verification: {
    glyph: '🔍',
    description: 'Auditing reasoning trails, questioning counterfactuals, and cross-checking raw trial metrics rather than blindly trusting AI outputs.',
    colorClass: 'text-brand-ink dark:text-cyan-400',
    barBgClass: 'bg-brand dark:bg-cyan-400',
  },
  clarification: {
    glyph: '💬',
    description: 'Asking targeted questions when confidence intervals widen or task paradigms change to guide model calibration.',
    colorClass: 'text-brand-ink dark:text-teal-400',
    barBgClass: 'bg-brand-teal dark:bg-teal-400',
  },
  iteration: {
    glyph: '🔄',
    description: 'Refining weekly goals, pacing parameters, and difficulty staircases after reviewing post-session fatigue and accuracy data.',
    colorClass: 'text-brand-ink dark:text-amber-400',
    barBgClass: 'bg-brand-gold dark:bg-amber-400',
  },
  autonomy: {
    glyph: '🎯',
    description: 'Initiating self-directed practice and unprompted dimension drills without passive reliance on automated nudges.',
    colorClass: 'text-brand-ink dark:text-lime-400',
    barBgClass: 'bg-success dark:bg-lime-400',
  },
  responsible_use: {
    glyph: '🛡️',
    description: 'Honoring rest days, maintaining hardware-locked non-biometric telemetry, and respecting fatigue caps to prevent cognitive burnout.',
    colorClass: 'text-brand-ink dark:text-sky-400',
    barBgClass: 'bg-info dark:bg-sky-400',
  },
}

export function CollaborationScoreCard({
  payload,
  isDynamicWeights = false,
  onToggleDynamicWeights,
  onSimulateAction,
  onResetSimulation,
  simulatedDeltas = {},
  showWhyThis = true,
  className = '',
}: CollaborationScoreCardProps) {
  const [showFormulaDetails, setShowFormulaDetails] = useState(false)
  const [showTableRegion, setShowTableRegion] = useState(false)
  const [expandedSubScores, setExpandedSubScores] = useState<Record<string, boolean>>({
    verification: true,
    clarification: false,
    iteration: false,
    autonomy: false,
    responsible_use: false,
  })

  const formulaRegionId = useId()
  const tableRegionId = useId()

  // Calculate live effective sub-scores including simulated deltas
  const effectiveSubScores = payload.subScores.map((sub) => {
    let delta = 0
    if (sub.key === 'verification') delta = simulatedDeltas.verification || 0
    if (sub.key === 'clarification') delta = simulatedDeltas.clarification || 0
    if (sub.key === 'iteration') delta = simulatedDeltas.iteration || 0
    if (sub.key === 'autonomy') delta = simulatedDeltas.autonomy || 0
    if (sub.key === 'responsible_use') delta = simulatedDeltas.responsible_use || 0

    const adjustedScore = Math.min(100, Math.max(0, sub.score + delta))
    const evidenceDelta = Math.floor(delta / 2)
    return {
      ...sub,
      score: adjustedScore,
      evidenceCount: sub.evidenceCount + evidenceDelta,
    }
  })

  // Compute composite score: S_collab = sum( w_i * V_i )
  let weightedSum = 0
  effectiveSubScores.forEach((sub) => {
    const weight = isDynamicWeights ? sub.activeDynamicWeightPct : sub.defaultWeightPct
    weightedSum += (weight / 100) * sub.score
  })

  const effectiveTotalScore = Math.round(weightedSum)
  const ciHalfWidth = payload.ciRange[1] - payload.totalScore
  const effectiveCiLower = Math.max(0, effectiveTotalScore - ciHalfWidth)
  const effectiveCiUpper = Math.min(100, effectiveTotalScore + ciHalfWidth)

  const toggleSubScoreExpanded = (key: string) => {
    setExpandedSubScores((prev) => ({
      ...prev,
      [key]: !prev[key],
    }))
  }

  const hasSimulations = Object.values(simulatedDeltas).some((v) => v > 0)

  return (
    <Card
      as="section"
      variant="default"
      className={`border-2 border-border-strong space-y-6 shadow-doodle ${className}`}
      aria-labelledby="collab-score-title"
    >
      {/* Top Banner & Mandatory Non-Validated Badge */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b-2 border-border pb-4">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h2
              id="collab-score-title"
              className="font-display text-2xl font-bold text-ink"
            >
              Co-Pilot Synergy with Brian (0–100) · Signature #5: AI Collaboration Score
            </h2>
            <Badge tone="warning" glyph="⚠">
              {payload.statusBadge}
            </Badge>
          </div>
          <p className="text-sm text-ink-muted mt-1">
            Quantifying metacognitive synergy, critical verification, and self-directed practice.
          </p>
        </div>

        {/* Dynamic Weight Mode Switcher */}
        {onToggleDynamicWeights && (
          <div
            role="group"
            aria-label="Weighting Mode Switcher"
            className="flex items-center gap-1 rounded-pill border-2 border-border-strong bg-surface-raised p-1 self-start sm:self-auto"
          >
            <button
              type="button"
              onClick={() => onToggleDynamicWeights(false)}
              aria-pressed={!isDynamicWeights}
              className={`focus-ring min-h-11 px-3 py-1.5 rounded-pill text-xs font-semibold cursor-pointer transition-colors ${!isDynamicWeights
                  ? 'bg-brand text-brand-ink'
                  : 'text-ink hover:bg-canvas'
                }`}
            >
              Baseline Weights
            </button>
            <button
              type="button"
              onClick={() => onToggleDynamicWeights(true)}
              aria-pressed={isDynamicWeights}
              className={`focus-ring min-h-11 px-3 py-1.5 rounded-pill text-xs font-semibold cursor-pointer transition-colors ${isDynamicWeights
                  ? 'bg-brand text-brand-ink'
                  : 'text-ink hover:bg-canvas'
                }`}
            >
              Dynamic Archetype Weights
            </button>
          </div>
        )}
      </div>

      {/* Hero Composite Score Block */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-center rounded-md border-2 border-border-strong bg-surface-raised p-5">
        <div className="md:col-span-5 text-center md:text-start space-y-2">
          <span className="text-xs font-mono uppercase tracking-wider text-ink-muted">
            Composite Collaboration Metric
          </span>
          <div className="flex items-baseline justify-center md:justify-start gap-2">
            <span className="font-display text-5xl font-black text-ink">
              {effectiveTotalScore}
            </span>
            <span className="font-mono text-xl font-bold text-ink-muted">
              ± {ciHalfWidth}
            </span>
            <span className="font-mono text-sm text-ink-faint">/ 100</span>
          </div>

          <div className="flex flex-wrap items-center justify-center md:justify-start gap-2 pt-1">
            <Badge tone="brand" glyph="●">
              CI: [{effectiveCiLower} – {effectiveCiUpper}]
            </Badge>
            <Badge tone={isDynamicWeights ? 'reward' : 'neutral'} glyph="⚖">
              {isDynamicWeights ? 'Dynamic w_i(s_t)' : 'Fixed Baseline w_i'}
            </Badge>
            {hasSimulations && (
              <Badge tone="success" glyph="⚡">
                Simulated Action Active
              </Badge>
            )}
          </div>
        </div>

        <div className="md:col-span-7 space-y-3">
          <div className="flex items-center justify-between text-xs font-medium text-ink-muted">
            <span>Metacognitive Agency Level</span>
            <span className="font-semibold text-ink">
              {effectiveTotalScore >= 80
                ? 'High Autonomy & Critical Inquiry'
                : effectiveTotalScore >= 60
                  ? 'Emerging Autonomous Verification'
                  : 'High Passive Reliance Risk'}
            </span>
          </div>

          {/* Meter Bar with CI Bracket Indicator */}
          <div className="space-y-1.5">
            <div
              className="relative h-4 w-full rounded-pill bg-canvas border border-border-strong overflow-hidden"
              role="progressbar"
              aria-valuenow={effectiveTotalScore}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label="Collaboration Score Progress"
            >
              {/* Uncertainty CI Range Shading */}
              <div
                className="absolute top-0 bottom-0 bg-brand/20 border-x border-brand-ink/40"
                style={{
                  left: `${effectiveCiLower}%`,
                  width: `${effectiveCiUpper - effectiveCiLower}%`,
                }}
                aria-hidden="true"
              />
              {/* Filled Score Meter */}
              <div
                className="h-full rounded-pill bg-brand transition-all duration-300"
                style={{ width: `${effectiveTotalScore}%` }}
              />
            </div>

            <div className="flex justify-between text-xs font-mono text-ink-faint px-0.5">
              <span>0 (Passive Bias)</span>
              <span>50 (Developing)</span>
              <span>100 (Autonomous Synergy)</span>
            </div>
          </div>

          {/* Quick Rationale / Explainer */}
          <p className="text-xs text-ink-muted leading-relaxed">
            This metric rewards actively verifying AI coach assertions, inquiring into reasoning counterfactuals, and preserving rest days. It penalizes blind automatic acceptance.
          </p>
        </div>
      </div>

      {/* Mathematical Formula Accordion */}
      <div className="rounded-md border border-border-strong bg-canvas p-4 space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs font-bold text-ink">
              FORMULA: S_collab = ∑ w_i(s_t) · V_i
            </span>
          </div>
          <button
            type="button"
            onClick={() => setShowFormulaDetails((prev) => !prev)}
            aria-expanded={showFormulaDetails}
            aria-controls={formulaRegionId}
            className="focus-ring min-h-11 px-3 py-1.5 rounded-sm border border-border text-xs font-semibold text-ink hover:bg-surface cursor-pointer"
          >
            {showFormulaDetails ? 'Hide Weights Breakdown ▲' : 'Show Weights Breakdown ▼'}
          </button>
        </div>

        {showFormulaDetails && (
          <div id={formulaRegionId} className="pt-3 border-t border-border space-y-3">
            <p className="text-xs text-ink-muted">
              {isDynamicWeights
                ? 'Dynamic weights adjust according to the user\'s current cognitive cluster s_t to emphasize underdeveloped metacognitive channels while maintaining a strict 100% total sum.'
                : 'Canonical baseline weights apply fixed proportions across all five collaborative dimensions.'}
            </p>
            <div className="p-3 rounded-sm bg-surface font-mono text-xs text-ink border border-border overflow-x-auto">
              <code>
                S_collab = {effectiveSubScores.map((s, idx) => {
                  const wt = isDynamicWeights ? s.activeDynamicWeightPct : s.defaultWeightPct
                  return `${(wt / 100).toFixed(2)}·${s.score}${idx < effectiveSubScores.length - 1 ? ' + ' : ''}`
                }).join('')} = <strong className="font-bold text-ink">{effectiveTotalScore}</strong>
              </code>
            </div>
          </div>
        )}
      </div>

      {/* 5 Sub-Dimension Cards Breakdown */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-display text-lg font-bold text-ink">
            Sub-Dimension Breakdown (5 Evaluated Axes)
          </h3>
          <span className="text-xs font-mono text-ink-muted">
            All axes normalized [0 – 100]
          </span>
        </div>

        <div className="grid grid-cols-1 gap-3">
          {effectiveSubScores.map((sub) => {
            const meta = SUB_SCORE_META[sub.key]
            const isExpanded = Boolean(expandedSubScores[sub.key])
            const activeWeight = isDynamicWeights
              ? sub.activeDynamicWeightPct
              : sub.defaultWeightPct

            return (
              <div
                key={sub.key}
                className="rounded-md border-2 border-border-strong bg-surface p-4 transition-all"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <span
                      aria-hidden="true"
                      className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-border-strong bg-surface-raised text-base font-bold shadow-xs"
                    >
                      {meta.glyph}
                    </span>
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h4 className="font-display text-base font-bold text-ink">
                          {sub.label}
                        </h4>
                        <Badge tone="neutral">
                          Weight: {activeWeight}%
                          {isDynamicWeights && activeWeight !== sub.defaultWeightPct && (
                            <span className="text-brand-ink ml-1 font-bold">
                              ({activeWeight > sub.defaultWeightPct ? '+' : ''}
                              {activeWeight - sub.defaultWeightPct}%)
                            </span>
                          )}
                        </Badge>
                        <Badge tone="brand">
                          {sub.evidenceCount} Actions Logged
                        </Badge>
                      </div>
                      <p className="text-xs text-ink-muted mt-0.5 max-w-xl">
                        {meta.description}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
                    <div className="text-end">
                      <span className="font-display text-2xl font-black text-ink">
                        {sub.score}
                      </span>
                      <span className="font-mono text-xs text-ink-muted"> / 100</span>
                    </div>

                    {onSimulateAction && (
                      <button
                        type="button"
                        onClick={() => {
                          const actionMap: Record<
                            CollaborationSubScore['key'],
                            'audit' | 'clarify' | 'iterate' | 'autonomy' | 'responsible'
                          > = {
                            verification: 'audit',
                            clarification: 'clarify',
                            iteration: 'iterate',
                            autonomy: 'autonomy',
                            responsible_use: 'responsible',
                          }
                          const mapped = actionMap[sub.key]
                          if (mapped) {
                            onSimulateAction(mapped)
                          }
                        }}
                        aria-label={`+ Action: Simulate event for ${sub.label}`}
                        className="focus-ring min-h-11 px-2.5 py-1.5 rounded-sm border border-border bg-surface text-xs font-semibold text-ink cursor-pointer hover:bg-canvas"
                      >
                        + Action
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => toggleSubScoreExpanded(sub.key)}
                      aria-expanded={isExpanded}
                      className="focus-ring min-h-11 min-w-11 px-2.5 py-1.5 rounded-sm border border-border-strong bg-surface-raised text-xs font-semibold text-ink cursor-pointer hover:bg-canvas"
                    >
                      {isExpanded ? 'Hide Evidence ▲' : 'Show Evidence ▼'}
                    </button>
                  </div>
                </div>

                {/* Sub-Score Progress Bar */}
                <div className="mt-3">
                  <div
                    className="h-2 w-full rounded-pill bg-canvas border border-border overflow-hidden"
                    role="progressbar"
                    aria-valuenow={sub.score}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-label={`${sub.label} Score`}
                  >
                    <div
                      className={`h-full rounded-pill ${meta.barBgClass} transition-all duration-300`}
                      style={{ width: `${sub.score}%` }}
                    />
                  </div>
                </div>

                {/* Expandable Evidence Trail & Improvement Tip */}
                {isExpanded && (
                  <div className="mt-4 pt-3 border-t border-border space-y-3">
                    <div className="space-y-1.5">
                      <span className="text-xs font-mono uppercase tracking-wide text-ink-muted">
                        Recent Telemetry Evidence Trail:
                      </span>
                      <ul className="space-y-1 text-xs text-ink">
                        {sub.recentEvents.map((evt, idx) => (
                          <li
                            key={idx}
                            className="flex items-start gap-2 rounded-sm bg-surface-raised p-2 border border-border"
                          >
                            <span aria-hidden="true" className="text-brand shrink-0">
                              ✓
                            </span>
                            <span>{evt}</span>
                          </li>
                        ))}
                      </ul>
                    </div>

                    <div className="flex items-start gap-2 rounded-sm bg-brand/10 p-2.5 border border-brand/20">
                      <span aria-hidden="true" className="text-brand font-bold shrink-0">
                        💡
                      </span>
                      <div className="text-xs text-ink">
                        <strong className="font-semibold">How to Improve: </strong>
                        {sub.howToImprove}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Accessible Table Toggle Button */}
      <div className="flex items-center justify-between pt-2">
        <Button
          variant="secondary"
          size="sm"
          onClick={() => setShowTableRegion((prev) => !prev)}
          aria-expanded={showTableRegion}
          aria-controls={tableRegionId}
        >
          {showTableRegion
            ? 'Hide Accessible Score Table ▲'
            : 'Show Accessible Score Table (Screen Reader Region) ▼'}
        </Button>

        {hasResetButton(hasSimulations, onResetSimulation)}
      </div>

      {/* Accessible Screen-Reader & Keyboard Scrollable Table Region */}
      {showTableRegion && (
        <div
          id={tableRegionId}
          tabIndex={0}
          role="region"
          aria-label="Collaboration Score Sub-dimension Breakdown"
          className="focus-ring overflow-x-auto rounded-md border-2 border-border-strong bg-surface p-4"
        >
          <table
            aria-label="Collaboration Score Sub-dimension Breakdown Table"
            className="w-full min-w-160 text-start text-xs border-collapse"
          >
            <thead>
              <tr className="border-b-2 border-border-strong text-ink font-semibold">
                <th scope="col" className="p-2 text-start">Dimension</th>
                <th scope="col" className="p-2 text-center">Score / 100</th>
                <th scope="col" className="p-2 text-center">Default Weight</th>
                <th scope="col" className="p-2 text-center">Dynamic Weight</th>
                <th scope="col" className="p-2 text-center">Active Weight</th>
                <th scope="col" className="p-2 text-center">Actions Logged</th>
                <th scope="col" className="p-2 text-start">Latest Evidence Event</th>
              </tr>
            </thead>
            <tbody>
              {effectiveSubScores.map((sub) => (
                <tr key={sub.key} className="border-b border-border text-ink hover:bg-canvas">
                  <th scope="row" className="p-2 font-medium text-start">
                    {sub.label}
                  </th>
                  <td className="p-2 text-center font-mono font-bold">
                    {sub.score}
                  </td>
                  <td className="p-2 text-center font-mono">
                    {sub.defaultWeightPct}%
                  </td>
                  <td className="p-2 text-center font-mono">
                    {sub.activeDynamicWeightPct}%
                  </td>
                  <td className="p-2 text-center font-mono font-semibold text-brand">
                    {isDynamicWeights ? sub.activeDynamicWeightPct : sub.defaultWeightPct}%
                  </td>
                  <td className="p-2 text-center font-mono">
                    {sub.evidenceCount}
                  </td>
                  <td className="p-2 text-ink-muted">
                    {sub.recentEvents[0] || '—'}
                  </td>
                </tr>
              ))}
              <tr className="border-t-2 border-border-strong bg-surface-raised font-bold text-ink">
                <th scope="row" className="p-2 text-start">
                  Composite Score (S_collab)
                </th>
                <td className="p-2 text-center font-mono text-base font-black text-brand">
                  {effectiveTotalScore} ± {ciHalfWidth}
                </td>
                <td className="p-2 text-center font-mono">100%</td>
                <td className="p-2 text-center font-mono">100%</td>
                <td className="p-2 text-center font-mono">100%</td>
                <td className="p-2 text-center font-mono">
                  {effectiveSubScores.reduce((acc, curr) => acc + curr.evidenceCount, 0)}
                </td>
                <td className="p-2 text-ink-muted font-normal italic">
                  Confidence interval: [{effectiveCiLower} – {effectiveCiUpper}]
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      )}

      {/* Embedded Signature #3 Explainability Panel */}
      {showWhyThis && payload.whyThis && (
        <div className="pt-2">
          <WhyThisPanel
            trail={payload.whyThis}
            title="Why this collaboration assessment?"
          />
        </div>
      )}
    </Card>
  )
}

function hasResetButton(
  hasSimulations: boolean,
  onResetSimulation?: () => void,
) {
  if (!hasSimulations || !onResetSimulation) return null

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={onResetSimulation}
      className="text-xs text-ink-muted hover:text-ink"
    >
      ↺ Reset Simulation
    </Button>
  )
}
