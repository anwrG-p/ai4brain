import type { CollaborationData } from '../insights/profileApi'

export interface AICollaborationCardProps {
  collaboration?: CollaborationData | null
  className?: string
}

const DIMENSION_CONFIG = [
  { key: 'clarification', name: 'Clarification', weight: '20%' },
  { key: 'critical_verification', name: 'Critical Verification', weight: '25%' },
  { key: 'iteration', name: 'Iteration', weight: '20%' },
  { key: 'autonomy', name: 'Autonomy', weight: '20%' },
  { key: 'responsible_use', name: 'Responsible Use', weight: '15%' },
] as const

export function AICollaborationCard({ collaboration, className = '' }: AICollaborationCardProps) {
  const isOk = collaboration?.status === 'ok'
  const compositeScore = collaboration?.composite_score ?? null
  const dimensionScores = collaboration?.dimension_scores ?? {}
  const recommendation = collaboration?.growth_recommendation
  const typedTurns = collaboration?.evidence?.typed_turns ?? 0

  return (
    <div className={`tactile-card flex flex-col gap-4 p-5 ${className}`} data-testid="ai-collaboration-card">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h4 className="font-display text-lg font-bold text-ink">AI Collaboration Score</h4>
          <p className="text-sm text-ink-muted">
            Measures how effectively and thoughtfully you collaborate with the AI guide.
          </p>
        </div>
        {isOk && compositeScore !== null ? (
          <div className="flex items-baseline gap-1 rounded-xl bg-brand-subtle px-3 py-1.5 text-brand">
            <span className="font-display text-2xl font-bold">{Math.round(compositeScore)}</span>
            <span className="text-xs text-ink-muted">/ 100</span>
          </div>
        ) : (
          <span className="rounded-full bg-surface-raised px-3 py-1 text-xs font-medium text-ink-muted">
            {typedTurns}/10 turns
          </span>
        )}
      </div>

      {!isOk ? (
        <div className="flex flex-col gap-2 rounded-lg bg-surface-raised p-3 text-sm text-ink-muted">
          <p className="font-medium text-ink">Building your collaboration profile</p>
          <p>
            Type {Math.max(0, 10 - typedTurns)} more messages to Loti to unlock your collaboration score and learning tip.
          </p>
        </div>
      ) : null}

      <div className="flex flex-col gap-2.5 pt-1">
        {DIMENSION_CONFIG.map(({ key, name, weight }) => {
          const score = dimensionScores[key]
          const val = typeof score === 'number' ? Math.round(score) : null
          return (
            <div key={key} className="flex flex-col gap-1">
              <div className="flex items-center justify-between text-xs">
                <span className="font-medium text-ink">{name}</span>
                <span className="font-mono-tabular text-ink-muted">
                  {val !== null ? `${val}/100` : '—'} <span className="opacity-70">({weight})</span>
                </span>
              </div>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-raised">
                <div
                  className="h-full rounded-full bg-brand transition-all duration-300"
                  style={{ width: `${val !== null ? Math.min(100, Math.max(0, val)) : 0}%` }}
                />
              </div>
            </div>
          )
        })}
      </div>

      {recommendation ? (
        <div className="mt-1 rounded-lg border border-border bg-surface p-3 text-xs text-ink">
          <p className="font-semibold text-brand">Loti&apos;s tip:</p>
          <p className="mt-0.5 text-ink-muted">{recommendation}</p>
        </div>
      ) : null}
    </div>
  )
}

