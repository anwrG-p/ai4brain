import type { HabitContract } from '../../../types'
import { Badge } from '../../ui/Badge'
import { Card } from '../../ui/Card'

export interface HabitContractCardProps {
  contract: HabitContract
  onToggleRest?: (contractId: string) => void
  onCompleteMilestone?: (contractId: string) => void
  className?: string
}

export function HabitContractCard({
  contract,
  onToggleRest,
  onCompleteMilestone,
  className = '',
}: HabitContractCardProps) {
  const isPacingRest = contract.status === 'pacing_rest'
  const isCompleted = contract.status === 'completed'

  return (
    <Card
      as="article"
      variant={isPacingRest ? 'raised' : 'default'}
      className={`border-2 border-border-strong space-y-4 relative shadow-doodle ${className}`}
      aria-labelledby={`contract-title-${contract.id}`}
    >
      <div className="doodle-tape" />
      {/* Card Header */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 border-b-2 border-border-strong pb-3 pt-1">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-mono font-bold uppercase tracking-wider text-brand">
              {contract.dimensionName}
            </span>
            <Badge
              tone={
                contract.objectiveType === 'capacity'
                  ? 'brand'
                  : contract.objectiveType === 'stability'
                    ? 'info'
                    : 'reward'
              }
            >
              {contract.objectiveType === 'capacity'
                ? 'Capacity Stretch'
                : contract.objectiveType === 'stability'
                  ? 'Stability & Variance'
                  : 'Memory Consolidation'}
            </Badge>

            {isPacingRest ? (
              <Badge tone="warning" glyph="☾">
                Rest Day Active · Streak Safe
              </Badge>
            ) : isCompleted ? (
              <Badge tone="success" glyph="✓">
                Target Achieved
              </Badge>
            ) : (
              <Badge tone="neutral" glyph="●">
                Active Commitment
              </Badge>
            )}
          </div>

          <h3
            id={`contract-title-${contract.id}`}
            className="font-display text-xl font-bold text-ink"
          >
            {contract.title}
          </h3>
        </div>

        {/* Streak Counter Pill */}
        <div className="flex items-center gap-2 self-start sm:self-auto rounded-sm border-2 border-border-strong bg-canvas px-3 py-1.5 shrink-0 shadow-doodle-sm">
          <span aria-hidden="true" className="text-base text-brand">
            🛡️
          </span>
          <div className="text-xs">
            <span className="font-bold text-ink font-mono">{contract.streakDays}</span>
            <span className="text-ink-muted ml-1">Days Protected</span>
          </div>
        </div>
      </div>

      {/* Progress & Milestone Metrics */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs font-medium">
          <span className="text-ink-muted">
            Baseline: <strong className="font-mono text-ink">{contract.baselineScorePct}%</strong>
            <span className="mx-1.5 text-ink-faint">→</span>
            Current: <strong className="font-mono text-ink">{contract.currentScorePct}%</strong>
            <span className="mx-1.5 text-ink-faint">→</span>
            Target: <strong className="font-mono text-brand font-bold">+{contract.targetDeltaPct}%</strong>
          </span>
          <span className="font-mono font-bold text-ink">
            {contract.currentProgressPct}% Complete
          </span>
        </div>

        {/* Progress Bar */}
        <div
          className="h-3 w-full rounded-pill bg-canvas border border-border overflow-hidden"
          role="progressbar"
          aria-valuenow={contract.currentProgressPct}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={`${contract.title} Progress`}
        >
          <div
            className={`h-full rounded-pill transition-all duration-300 ${
              isPacingRest
                ? 'bg-warning'
                : isCompleted
                  ? 'bg-success'
                  : 'bg-brand'
            }`}
            style={{ width: `${Math.min(100, contract.currentProgressPct)}%` }}
          />
        </div>
      </div>

      {/* Bayesian Epistemic ETA Interval Box */}
      <div className="rounded-md border border-border bg-surface-raised p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span aria-hidden="true" className="text-xl shrink-0">
            ⏳
          </span>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono font-semibold text-ink-muted uppercase">
                Bayesian Epistemic ETA:
              </span>
              <Badge tone="brand">
                {contract.confidencePct}% Credible Interval
              </Badge>
            </div>
            <div className="font-display text-base font-bold text-ink mt-0.5">
              {contract.etaDaysRange[0]} – {contract.etaDaysRange[1]} Days to Convergence
            </div>
          </div>
        </div>

        <div className="text-xs text-ink-muted sm:text-end">
          <span className="block font-medium text-ink">Cadence:</span>
          <span>{contract.weeklyCommitment}</span>
        </div>
      </div>

      {/* Rationale & Proactive Rest Clause */}
      <div className="space-y-2 text-xs">
        <p className="text-ink-muted leading-relaxed">
          <strong className="text-ink font-semibold">Posterior Modeling: </strong>
          {contract.rationale}
        </p>

        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-border">
          <div className="flex items-center gap-2 text-ink-muted">
            <span aria-hidden="true" className="text-brand">
              ✓
            </span>
            <span>
              Rest Day Policy: <strong className="text-ink">{contract.scheduledRestDay}</strong> (Streak Preserved)
            </span>
          </div>

          <div className="flex items-center gap-2">
            {onToggleRest && (
              <button
                type="button"
                onClick={() => onToggleRest(contract.id)}
                className="focus-ring min-h-11 px-3 py-1.5 rounded-sm border border-border text-xs font-semibold text-ink bg-surface hover:bg-canvas cursor-pointer"
              >
                {isPacingRest ? 'Resume Active Training' : 'Schedule Rest Day (Zero Penalty)'}
              </button>
            )}

            {onCompleteMilestone && !isCompleted && (
              <button
                type="button"
                onClick={() => onCompleteMilestone(contract.id)}
                className="focus-ring min-h-11 px-3 py-1.5 rounded-sm border border-brand bg-brand text-brand-ink text-xs font-semibold hover:bg-brand-hover cursor-pointer"
              >
                Simulate Milestone (+15%)
              </button>
            )}
          </div>
        </div>
      </div>
    </Card>
  )
}
