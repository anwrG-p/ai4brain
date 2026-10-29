import { useState, useId } from 'react'
import {
  SAMPLE_HABIT_CONTRACTS,
  calculateBayesianEta,
} from '../services/mocks/fixtures'
import type { HabitContract, GoalObjectiveType, WhyThisTrail } from '../types'
import { useAppStore } from '../state/useAppStore'
import { getDimensionsByPreset } from '../config/dimensions'
import { Badge } from '../components/ui/Badge'
import { Button } from '../components/ui/Button'
import { Card } from '../components/ui/Card'
import { DoodleSquiggle } from '../components/ui/DoodleDecorations'
import { HabitContractCard } from '../components/features/goals/HabitContractCard'
import { WhyThisPanel } from '../components/features/coach/WhyThisPanel'
import { Mascot } from '../components/features/brand/Mascot'

type FilterKey = 'all' | 'active' | 'pacing_rest' | 'completed'

const SAMPLE_GOALS_WHY_THIS: WhyThisTrail = {
  id: 'trail-goals-1',
  observedData: [
    'Dual-stream N-back accuracy steady at 74% over past 6 sessions',
    'Morning alertness window shows lowest response-time variance (sigma = 38ms)',
    '3 scheduled rest days observed with zero performance drop-off on subsequent trial blocks',
  ],
  inference:
    'Bayesian posterior trajectory indicates stable capacity stretch potential (+0.55% theta/block); current learning rate projects 80% credible interval convergence within 18–24 days.',
  recommendation:
    'Prioritize 90-second morning micro-blocks 3x weekly and respect Sunday rest to allow synaptic memory consolidation.',
  confidence: 0.86,
  counterfactual:
    'If response-time jitter exceeds 160 ms or 2 consecutive rest days are skipped, Bayesian ETA will widen by +6 to +9 days to account for neural fatigue noise.',
  sourceModule: 'quest_staircase',
}

export function GoalsPage() {
  const { dimensionPreset, showMascot } = useAppStore()
  const activeDimensions = getDimensionsByPreset(dimensionPreset)

  const [contracts, setContracts] = useState<HabitContract[]>(SAMPLE_HABIT_CONTRACTS)
  const [activeFilter, setActiveFilter] = useState<FilterKey>('all')
  const [showTableRegion, setShowTableRegion] = useState(false)

  // Interactive Goal Creator / Simulator state
  const [selectedDimId, setSelectedDimId] = useState(activeDimensions[0]?.id || 'working_memory')
  const [objectiveType, setObjectiveType] = useState<GoalObjectiveType>('capacity')
  const [targetDelta, setTargetDelta] = useState<number>(10)
  const [createdNotification, setCreatedNotification] = useState<string | null>(null)

  const tableRegionId = useId()

  const liveEtaRange = calculateBayesianEta(
    targetDelta,
    objectiveType === 'capacity' ? 0.52 : objectiveType === 'stability' ? 0.65 : 0.42,
    2.4,
  )

  const selectedDimConfig = activeDimensions.find((d) => d.id === selectedDimId) || activeDimensions[0]

  const handleToggleRest = (contractId: string) => {
    setContracts((prev) =>
      prev.map((c) => {
        if (c.id === contractId) {
          const isRest = c.status === 'pacing_rest'
          return {
            ...c,
            status: isRest ? 'active' : 'pacing_rest',
            streakDays: c.streakDays + 1, // Advance streak with zero penalty!
          }
        }
        return c
      }),
    )
  }

  const handleCompleteMilestone = (contractId: string) => {
    setContracts((prev) =>
      prev.map((c) => {
        if (c.id === contractId) {
          const nextProg = Math.min(100, c.currentProgressPct + 15)
          return {
            ...c,
            currentProgressPct: nextProg,
            currentScorePct: Math.min(99, c.currentScorePct + 2),
            status: nextProg >= 100 ? 'completed' : c.status,
          }
        }
        return c
      }),
    )
  }

  const handleCreateContract = (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedDimConfig) return

    const newContract: HabitContract = {
      id: `custom-contract-${Date.now()}`,
      dimensionId: selectedDimConfig.id,
      dimensionName: selectedDimConfig.name,
      objectiveType,
      title: `${selectedDimConfig.name} Custom Goal`,
      targetDeltaPct: targetDelta,
      currentProgressPct: 15,
      baselineScorePct: 65,
      currentScorePct: 67,
      etaDaysRange: liveEtaRange,
      confidencePct: 82,
      weeklyCommitment: '3 micro-sessions / wk',
      scheduledRestDay: 'Sunday (Rest Protected)',
      streakDays: 1,
      status: 'active',
      rationale: `Self-directed habit commitment on ${selectedDimConfig.name}. Bayesian ETA calculated at ${liveEtaRange[0]}–${liveEtaRange[1]} days.`,
    }

    setContracts((prev) => [newContract, ...prev])
    setCreatedNotification(`Habit contract committed for ${selectedDimConfig.name}!`)
    setTimeout(() => setCreatedNotification(null), 4000)
  }

  const filteredContracts = contracts.filter((c) => {
    if (activeFilter === 'active') return c.status === 'active'
    if (activeFilter === 'pacing_rest') return c.status === 'pacing_rest'
    if (activeFilter === 'completed') return c.status === 'completed'
    return true
  })

  const hasRestDayActive = contracts.some((c) => c.status === 'pacing_rest')
  const totalCompleted = contracts.filter((c) => c.status === 'completed').length

  const mascotState =
    hasRestDayActive
      ? 'rest'
      : totalCompleted > 0
        ? 'celebrate'
        : createdNotification
          ? 'celebrate'
          : 'idle'

  return (
    <div className="space-y-8 pb-16">
      {/* Page Header & Breadcrumb */}
      <section className="space-y-4" aria-labelledby="goals-page-heading">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2 text-xs font-mono text-ink-muted">
            <span>SynapseTwin</span>
            <span aria-hidden="true">/</span>
            <span>Layer C Personal Growth</span>
            <span aria-hidden="true">/</span>
            <span className="font-semibold text-brand">Goals &amp; Habit Contracts</span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Badge tone="reward" glyph="🛡️">
              Zero-Guilt Streak Protection
            </Badge>
            <Badge tone="brand" glyph="⏳">
              Bayesian Credible ETAs
            </Badge>
          </div>
        </div>

        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
          <div className="space-y-1">
            <h1
              id="goals-page-heading"
              className="font-display text-3xl sm:text-4xl font-extrabold text-ink tracking-tight"
            >
              Goals &amp; Habit Contracts Studio
            </h1>
            <DoodleSquiggle className="max-w-xs mt-1" />
            <p className="text-base text-ink-muted max-w-2xl leading-relaxed">
              Self-directed micro-commitments with Bayesian Epistemic ETA Intervals. Built on the belief that neural recovery is essential for memory consolidation—taking a rest day preserves your streak with zero penalty.
            </p>
          </div>

          {/* Preset indicator */}
          <div className="self-start lg:self-auto">
            <Badge tone="neutral">
              Preset: {dimensionPreset} Dimensions Active
            </Badge>
          </div>
        </div>
      </section>

      {/* Habit Streak Hero Banner (Zero-Guilt Rest Protection) */}
      <section
        className="rounded-md border-2 border-border-strong bg-surface p-5 shadow-xs"
        aria-label="Habit Streak and Rest Protection Overview"
      >
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2 max-w-2xl">
            <div className="flex items-center gap-2">
              <span aria-hidden="true" className="text-xl">
                🛡️
              </span>
              <h2 className="font-display text-lg font-bold text-ink">
                Continuous Habit Continuity Engine
              </h2>
              <Badge tone="success">
                Zero Penalty Active
              </Badge>
            </div>
            <p className="text-xs text-ink-muted leading-relaxed">
              Legacy apps penalize you with broken streaks when you pause. SynapseTwin models sleep and rest days as active memory consolidation periods: taking a scheduled recovery day preserves streak continuity and reduces Bayesian variance.
            </p>
          </div>

          <div className="flex items-center gap-4 bg-surface-raised p-4 rounded-md border border-border shrink-0 self-start md:self-auto">
            <div className="text-center">
              <span className="block font-display text-3xl font-black text-ink">
                18
              </span>
              <span className="block font-mono text-xs uppercase tracking-wide text-ink-muted">
                Days Protected
              </span>
            </div>
            <div className="h-10 w-px bg-border" aria-hidden="true" />
            <div className="text-center">
              <span className="block font-display text-3xl font-black text-brand">
                3
              </span>
              <span className="block font-mono text-xs uppercase tracking-wide text-ink-muted">
                Rest Days Honored
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* Main 12-Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left 7 Columns: Active Habit Contracts & Filter Tabs */}
        <div className="lg:col-span-7 space-y-6">
          {/* Filter Pills */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div
              role="group"
              aria-label="Filter Habit Contracts"
              className="flex flex-wrap items-center gap-1.5 rounded-pill border-2 border-border-strong bg-surface p-1"
            >
              <button
                type="button"
                onClick={() => setActiveFilter('all')}
                aria-pressed={activeFilter === 'all'}
                className={`focus-ring min-h-11 px-3 py-1.5 rounded-pill text-xs font-semibold cursor-pointer transition-colors ${
                  activeFilter === 'all'
                    ? 'bg-brand text-brand-ink'
                    : 'text-ink hover:bg-surface-raised'
                }`}
              >
                All Contracts ({contracts.length})
              </button>
              <button
                type="button"
                onClick={() => setActiveFilter('active')}
                aria-pressed={activeFilter === 'active'}
                className={`focus-ring min-h-11 px-3 py-1.5 rounded-pill text-xs font-semibold cursor-pointer transition-colors ${
                  activeFilter === 'active'
                    ? 'bg-brand text-brand-ink'
                    : 'text-ink hover:bg-surface-raised'
                }`}
              >
                Active Training ({contracts.filter((c) => c.status === 'active').length})
              </button>
              <button
                type="button"
                onClick={() => setActiveFilter('pacing_rest')}
                aria-pressed={activeFilter === 'pacing_rest'}
                className={`focus-ring min-h-11 px-3 py-1.5 rounded-pill text-xs font-semibold cursor-pointer transition-colors ${
                  activeFilter === 'pacing_rest'
                    ? 'bg-brand text-brand-ink'
                    : 'text-ink hover:bg-surface-raised'
                }`}
              >
                Rest / Consolidation ({contracts.filter((c) => c.status === 'pacing_rest').length})
              </button>
              <button
                type="button"
                onClick={() => setActiveFilter('completed')}
                aria-pressed={activeFilter === 'completed'}
                className={`focus-ring min-h-11 px-3 py-1.5 rounded-pill text-xs font-semibold cursor-pointer transition-colors ${
                  activeFilter === 'completed'
                    ? 'bg-brand text-brand-ink'
                    : 'text-ink hover:bg-surface-raised'
                }`}
              >
                Completed ({contracts.filter((c) => c.status === 'completed').length})
              </button>
            </div>

            <Button
              variant="secondary"
              size="sm"
              onClick={() => setShowTableRegion((prev) => !prev)}
              aria-expanded={showTableRegion}
              aria-controls={tableRegionId}
              className="text-xs"
            >
              {showTableRegion ? 'Hide Contracts Table ▲' : 'Show Contracts Table ▼'}
            </Button>
          </div>

          {/* Accessible Table Region */}
          {showTableRegion && (
            <div
              id={tableRegionId}
              tabIndex={0}
              role="region"
              aria-label="Habit Contracts and Bayesian ETAs Region"
              className="focus-ring overflow-x-auto rounded-md border-2 border-border-strong bg-surface p-4"
            >
              <table
                aria-label="Habit Contracts and Bayesian ETAs Table"
                className="w-full min-w-160 text-start text-xs border-collapse"
              >
                <thead>
                  <tr className="border-b-2 border-border-strong text-ink font-semibold">
                    <th scope="col" className="p-2 text-start">Contract Title</th>
                    <th scope="col" className="p-2 text-start">Dimension</th>
                    <th scope="col" className="p-2 text-center">Progress</th>
                    <th scope="col" className="p-2 text-center">Bayesian ETA</th>
                    <th scope="col" className="p-2 text-center">Streak</th>
                    <th scope="col" className="p-2 text-start">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {contracts.map((c) => (
                    <tr key={c.id} className="border-b border-border text-ink hover:bg-canvas">
                      <th scope="row" className="p-2 font-medium text-start">
                        {c.title}
                      </th>
                      <td className="p-2 text-start font-mono text-ink-muted">
                        {c.dimensionName}
                      </td>
                      <td className="p-2 text-center font-mono font-bold">
                        {c.currentProgressPct}%
                      </td>
                      <td className="p-2 text-center font-mono text-brand font-semibold">
                        {c.etaDaysRange[0]}–{c.etaDaysRange[1]} Days
                      </td>
                      <td className="p-2 text-center font-mono">
                        {c.streakDays} Days
                      </td>
                      <td className="p-2">
                        <Badge
                          tone={
                            c.status === 'completed'
                              ? 'success'
                              : c.status === 'pacing_rest'
                                ? 'warning'
                                : 'neutral'
                          }
                        >
                          {c.status === 'completed'
                            ? 'Achieved'
                            : c.status === 'pacing_rest'
                              ? 'Rest Protected'
                              : 'Active'}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* List of Habit Contract Cards */}
          <div className="space-y-4">
            {filteredContracts.map((contract) => (
              <HabitContractCard
                key={contract.id}
                contract={contract}
                onToggleRest={handleToggleRest}
                onCompleteMilestone={handleCompleteMilestone}
              />
            ))}

            {filteredContracts.length === 0 && (
              <Card variant="raised" className="text-center p-8 border-dashed border-border-strong">
                <p className="text-sm text-ink-muted">
                  No contracts found matching the active filter.
                </p>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setActiveFilter('all')}
                  className="mt-2 text-xs text-brand"
                >
                  Clear filter to view all contracts
                </Button>
              </Card>
            )}
          </div>

          {/* Embedded Signature #3 Explainability Panel */}
          <WhyThisPanel
            trail={SAMPLE_GOALS_WHY_THIS}
            title="Why this Bayesian ETA calculation?"
          />
        </div>

        {/* Right 5 Columns: Goal Tuner & Bayesian Model */}
        <div className="lg:col-span-5 space-y-6">
          {/* Interactive Goal Creator & ETA Tuner Card */}
          <Card
            as="section"
            variant="default"
            className="border-2 border-border-strong space-y-4"
            aria-labelledby="tuner-heading"
          >
            <div className="border-b border-border pb-3">
              <div className="flex items-center justify-between">
                <h2
                  id="tuner-heading"
                  className="font-display text-xl font-bold text-ink"
                >
                  Interactive Goal &amp; ETA Tuner
                </h2>
                <Badge tone="brand" glyph="⚙">
                  Bayesian Simulator
                </Badge>
              </div>
              <p className="text-xs text-ink-muted mt-0.5">
                Simulate target gains and observe real-time epistemic convergence intervals.
              </p>
            </div>

            {createdNotification && (
              <div
                role="status"
                aria-live="polite"
                className="rounded-sm bg-brand/10 border border-brand p-2.5 text-xs text-ink font-semibold flex items-center gap-2"
              >
                <span aria-hidden="true" className="text-brand">
                  ✓
                </span>
                <span>{createdNotification}</span>
              </div>
            )}

            <form onSubmit={handleCreateContract} className="space-y-4">
              {/* Dimension Selector */}
              <div className="space-y-1.5">
                <label
                  htmlFor="dimension-select"
                  className="block text-xs font-mono uppercase tracking-wide text-ink-muted"
                >
                  Target Dimension ({activeDimensions.length} Available):
                </label>
                <select
                  id="dimension-select"
                  value={selectedDimId}
                  onChange={(e) => setSelectedDimId(e.target.value)}
                  className="focus-ring w-full rounded-sm border-2 border-border-strong bg-surface p-2.5 text-xs font-medium text-ink cursor-pointer"
                >
                  {activeDimensions.map((dim) => (
                    <option key={dim.id} value={dim.id}>
                      {dim.name} ({dim.code})
                    </option>
                  ))}
                </select>
              </div>

              {/* Objective Type Radios */}
              <div className="space-y-1.5">
                <span className="block text-xs font-mono uppercase tracking-wide text-ink-muted">
                  Objective Type:
                </span>
                <div
                  role="radiogroup"
                  aria-label="Goal Objective Type"
                  className="grid grid-cols-3 gap-1.5"
                >
                  {(
                    [
                      { id: 'capacity', label: 'Capacity' },
                      { id: 'stability', label: 'Stability' },
                      { id: 'maintenance', label: 'Pacing' },
                    ] as const
                  ).map((obj) => {
                    const isSelected = objectiveType === obj.id
                    return (
                      <button
                        key={obj.id}
                        type="button"
                        role="radio"
                        aria-checked={isSelected}
                        onClick={() => setObjectiveType(obj.id)}
                        className={`focus-ring min-h-11 px-2.5 py-1.5 rounded-sm border text-xs font-semibold cursor-pointer transition-colors ${
                          isSelected
                            ? 'border-brand bg-brand text-brand-ink'
                            : 'border-border bg-surface text-ink hover:bg-canvas'
                        }`}
                      >
                        {obj.label}
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Target Delta Stepper */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <label htmlFor="target-delta-range" className="font-mono uppercase text-ink-muted">
                    Target Gain (Δθ):
                  </label>
                  <span className="font-mono font-bold text-brand text-sm">
                    +{targetDelta}%
                  </span>
                </div>
                <input
                  id="target-delta-range"
                  type="range"
                  min="4"
                  max="20"
                  step="2"
                  value={targetDelta}
                  onChange={(e) => setTargetDelta(Number(e.target.value))}
                  className="focus-ring w-full accent-brand cursor-pointer"
                />
                <div className="flex justify-between text-xs font-mono text-ink-muted">
                  <span>+4% (Micro)</span>
                  <span>+10% (Optimal)</span>
                  <span>+20% (Stretch)</span>
                </div>
              </div>

              {/* Computed Live Bayesian ETA Box */}
              <div className="rounded-md border border-border bg-canvas p-3.5 space-y-1.5">
                <div className="flex items-center justify-between text-xs font-mono text-ink-muted">
                  <span>Projected Bayesian ETA:</span>
                  <Badge tone="brand">80% Credible Interval</Badge>
                </div>
                <div className="font-display text-2xl font-extrabold text-ink">
                  {liveEtaRange[0]} – {liveEtaRange[1]} Days
                </div>
                <p className="text-xs text-ink-muted leading-relaxed">
                  Calculated based on target delta +{targetDelta}%, estimated learning rate 0.52%/session, and morning alertness stability.
                </p>
              </div>

              {/* Submit Button */}
              <Button
                type="submit"
                variant="primary"
                size="md"
                className="w-full justify-center text-xs font-bold"
              >
                Commit to Habit Contract →
              </Button>
            </form>
          </Card>

          {/* Mathematical Model Card */}
          <Card
            as="section"
            variant="default"
            className="border-2 border-border-strong space-y-3 bg-surface-raised"
            aria-labelledby="math-heading"
          >
            <div className="flex items-center gap-2">
              <span aria-hidden="true" className="text-base text-brand font-bold">
                📐
              </span>
              <h2
                id="math-heading"
                className="font-display text-lg font-bold text-ink"
              >
                Bayesian Epistemic ETA Model
              </h2>
            </div>

            <div className="p-3 rounded-sm bg-surface font-mono text-xs text-ink border border-border overflow-x-auto">
              <code>
                τ̂ = Δθ / (Δc · η_session)
                <br />
                CI_80 = [τ̂ - 1.28·σ_τ , τ̂ + 1.28·σ_τ]
              </code>
            </div>

            <p className="text-xs text-ink-muted leading-relaxed">
              Unlike deterministic countdowns, SynapseTwin factors measurement uncertainty and fatigue jitter (<code className="font-mono text-ink">σ_τ</code>) into honest range forecasts. Higher trial consistency automatically narrows the projected window.
            </p>
          </Card>

          {/* Companion Mascot Guide */}
          {showMascot && (
            <div className="flex justify-center pt-2">
              <Mascot
                state={mascotState}
                size="md"
                title="Synapse Companion · Habit Guide"
                message={
                  mascotState === 'rest'
                    ? 'Recovery preserves synaptic plasticity. Rest day streak protected!'
                    : mascotState === 'celebrate'
                      ? 'Milestone advance registered! Bayesian ETA adjusted forward.'
                      : 'Every micro-session contributes to your Bayesian trajectory.'
                }
              />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default GoalsPage
