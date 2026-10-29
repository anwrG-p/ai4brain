import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import type { WhyThisTrail } from '../../../types'
import { Badge } from '../../ui/Badge'
import { useAppStore } from '../../../state/useAppStore'

export interface WhyThisPanelProps {
  trail: WhyThisTrail
  defaultExpanded?: boolean
  title?: string
  showSummaryUpfront?: boolean
}

export function WhyThisPanel({
  trail,
  defaultExpanded = false,
  title = 'Why this advice?',
  showSummaryUpfront = false,
}: WhyThisPanelProps) {
  const [expanded, setExpanded] = useState(defaultExpanded)
  const { reducedMotion } = useAppStore()
  const confidencePct = Math.round(trail.confidence * 100)
  const isLowConf = trail.confidence < 0.6

  return (
    <div className="editorial-card rounded-md bg-surface p-5 space-y-4 shadow-doodle">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <span
            aria-hidden="true"
            className="inline-flex h-7 w-7 items-center justify-center rounded-sm border border-border-strong bg-brand text-brand-ink text-xs font-bold shadow-xs"
          >
            ✦
          </span>
          <span className="font-display text-base font-bold text-ink">
            {title}
          </span>
          <Badge
            tone={isLowConf ? 'low-confidence' : 'brand'}
            glyph={isLowConf ? '◌' : '●'}
          >
            Confidence {confidencePct}%
          </Badge>
        </div>
        <button
          type="button"
          aria-expanded={expanded}
          onClick={() => setExpanded((prev) => !prev)}
          className="focus-ring min-h-11 px-3.5 py-1.5 rounded-sm border-2 border-border-strong bg-surface text-xs font-bold text-ink cursor-pointer hover:bg-surface-raised transition-colors shadow-doodle-sm"
        >
          {showSummaryUpfront
            ? (expanded ? 'Hide 5-Part Reasoning Trail ▲' : 'Inspect 5-Part Reasoning Trail ▼')
            : (expanded ? 'Hide reasoning trail ▲' : 'Inspect reasoning trail ▼')}
        </button>
      </div>

      {showSummaryUpfront && (
        <div className="space-y-3 pt-2">
          {/* Step 1: Observed Telemetry Data Upfront */}
          <div className="p-3.5 rounded-xl bg-canvas border border-border space-y-1">
            <span className="font-mono-tabular text-xs font-bold uppercase tracking-wider text-ink-muted block">
              1. Observed Telemetry Data
            </span>
            <ul className="list-disc ps-5 space-y-0.5 text-xs text-ink m-0">
              {trail.observedData.map((item, idx) => (
                <li key={idx}>{item}</li>
              ))}
            </ul>
          </div>

          {/* Step 3: Adaptive Advice Upfront */}
          <div className="p-3.5 rounded-xl bg-brand-subtle border border-brand/20 space-y-1">
            <span className="font-mono-tabular text-xs font-bold uppercase tracking-wider text-brand block">
              3. Adaptive Advice
            </span>
            <p className="text-sm font-semibold text-ink m-0">
              {trail.recommendation}
            </p>
          </div>

          {/* Confidence Progress Bar */}
          <div className="space-y-1">
            <div className="flex items-center justify-between text-xs">
              <span className="font-mono-tabular text-xs font-semibold text-ink-muted">
                Confidence {confidencePct}%
              </span>
              <span className="font-mono-tabular text-xs text-ink-muted">
                Source: {trail.sourceModule}
              </span>
            </div>
            <div
              className="h-2.5 w-full overflow-hidden rounded-pill border border-border bg-surface-raised"
              role="progressbar"
              aria-valuenow={confidencePct}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label="Advice confidence percentage"
            >
              <div
                className="h-full bg-brand transition-all duration-300"
                style={{ width: `${confidencePct}%` }}
              />
            </div>
          </div>
        </div>
      )}

      {/* Expanded Reasoning Trail Drawer */}
      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            initial={reducedMotion ? undefined : { height: 0, opacity: 0 }}
            animate={reducedMotion ? undefined : { height: 'auto', opacity: 1 }}
            exit={reducedMotion ? undefined : { height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: 'easeOut' }}
            className="overflow-hidden"
          >
            <dl className="mt-3 grid grid-cols-1 gap-3 border-t border-border pt-3 text-sm">
              {!showSummaryUpfront && (
                <div>
                  <dt className="font-mono-tabular text-xs font-semibold uppercase tracking-wider text-ink-muted">
                    1. Observed Telemetry Data
                  </dt>
                  <dd className="mt-1 text-ink">
                    <ul className="list-disc ps-5 space-y-1">
                      {trail.observedData.map((item, idx) => (
                        <li key={idx}>{item}</li>
                      ))}
                    </ul>
                  </dd>
                </div>
              )}

              <div>
                <dt className="font-mono-tabular text-xs font-semibold uppercase tracking-wider text-ink-muted">
                  2. Non-Clinical Inference (SAT-JEPA Δc)
                </dt>
                <dd className="mt-1 text-ink">{trail.inference}</dd>
              </div>

              {!showSummaryUpfront && (
                <div>
                  <dt className="font-mono-tabular text-xs font-semibold uppercase tracking-wider text-ink-muted">
                    3. Adaptive Advice
                  </dt>
                  <dd className="mt-1 font-medium text-ink">{trail.recommendation}</dd>
                </div>
              )}

              <div>
                <dt className="font-mono-tabular text-xs font-semibold uppercase tracking-wider text-ink-muted">
                  4. Epistemic Confidence ({confidencePct}%)
                </dt>
                <dd className="mt-1 flex items-center gap-3">
                  <div
                    className="h-3 w-full max-w-xs overflow-hidden rounded-pill border border-border bg-surface"
                    role="progressbar"
                    aria-valuenow={confidencePct}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-label="Advice confidence percentage"
                  >
                    <div
                      className="h-full bg-brand"
                      style={{ width: `${confidencePct}%` }}
                    />
                  </div>
                  <span className="font-mono-tabular text-xs text-ink-muted">
                    Source: {trail.sourceModule}
                  </span>
                </dd>
              </div>

              <div>
                <dt className="font-mono-tabular text-xs font-semibold uppercase tracking-wider text-ink-muted">
                  5. Counterfactual — What would change this?
                </dt>
                <dd className="mt-1 text-ink">{trail.counterfactual}</dd>
              </div>
            </dl>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
export default WhyThisPanel
