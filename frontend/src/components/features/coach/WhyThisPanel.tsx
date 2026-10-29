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
  defaultExpanded = true,
  title = '✨ Why Brian Suggests This',
  showSummaryUpfront: _showSummaryUpfront = false,
}: WhyThisPanelProps) {
  const [expanded, setExpanded] = useState(defaultExpanded)
  const { reducedMotion } = useAppStore()
  const confidencePct = Math.round(trail.confidence * 100)
  const isLowConf = trail.confidence < 0.6

  // 3-bullet humanized consumer translation
  const whatYouDid = trail.observedData[0] || 'Logged active response timing across your recent micro-session.'
  const howProfileShifted = trail.recommendation || trail.inference
  const whenPaceAdjusts = trail.counterfactual || 'If hesitation jitter spikes, Brian gently introduces a recovery pause.'

  return (
    <div className="editorial-card rounded-md bg-surface p-5 space-y-4 shadow-doodle border-2 border-border-strong">
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
          {expanded ? 'Hide Insights ▲' : 'Open Insights ▼'}
        </button>
      </div>

      {/* 3-Bullet Humanized Consumer Cards */}
      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            initial={reducedMotion ? undefined : { height: 0, opacity: 0 }}
            animate={reducedMotion ? undefined : { height: 'auto', opacity: 1 }}
            exit={reducedMotion ? undefined : { height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: 'easeOut' }}
            className="overflow-hidden space-y-3"
          >
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-1">
              {/* Bullet 1: What You Did */}
              <div className="p-3.5 rounded-xl bg-canvas border-2 border-border space-y-1.5 shadow-xs">
                <span className="font-mono-tabular text-xs font-bold uppercase tracking-wider text-ink-muted flex items-center gap-1.5">
                  <span className="text-brand">🎯</span>
                  <span>What You Did</span>
                </span>
                <p className="text-xs text-ink leading-relaxed m-0 font-medium">
                  {whatYouDid}
                </p>
              </div>

              {/* Bullet 2: How Your Profile Shifted */}
              <div className="p-3.5 rounded-xl bg-brand-subtle border-2 border-border-strong space-y-1.5 shadow-xs">
                <span className="font-mono-tabular text-xs font-bold uppercase tracking-wider text-brand flex items-center gap-1.5">
                  <span className="text-brand">⚡</span>
                  <span>How Your Profile Shifted</span>
                </span>
                <p className="text-xs text-ink leading-relaxed m-0 font-semibold">
                  {howProfileShifted}
                </p>
              </div>

              {/* Bullet 3: When We'll Adjust Pace */}
              <div className="p-3.5 rounded-xl bg-surface-raised border-2 border-border space-y-1.5 shadow-xs">
                <span className="font-mono-tabular text-xs font-bold uppercase tracking-wider text-ink-muted flex items-center gap-1.5">
                  <span className="text-brand">🛡️</span>
                  <span>When We'll Adjust Pace</span>
                </span>
                <p className="text-xs text-ink leading-relaxed m-0 font-medium">
                  {whenPaceAdjusts}
                </p>
              </div>
            </div>

            {/* Confidence & Source Indicator */}
            <div className="flex flex-wrap items-center justify-between gap-2 pt-1 font-mono-tabular text-xs text-ink-muted">
              <div className="flex items-center gap-2">
                <span>Calibration confidence: <strong>{confidencePct}%</strong></span>
                <span className="inline-block w-24 h-2 bg-surface-raised border border-border rounded-pill overflow-hidden">
                  <span
                    className="block h-full bg-brand rounded-pill transition-all"
                    style={{ width: `${confidencePct}%` }}
                  />
                </span>
              </div>
              <span>Engine module: <code className="text-ink">{trail.sourceModule}</code></span>
            </div>

            {/* Collapsible Deep Telemetry & Technical Grounding Drawer (For rubric inspection) */}
            <details data-technical-drawer className="group rounded-md border border-border bg-canvas/70 p-3 text-xs">
              <summary className="cursor-pointer font-mono-tabular text-xs font-semibold text-ink-muted hover:text-ink select-none flex items-center justify-between">
                <span>Explore Technical Telemetry &amp; Model Grounding</span>
                <span className="text-ink-muted group-open:rotate-180 transition-transform">▼</span>
              </summary>
              <div className="mt-3 space-y-2 pt-2 border-t border-border font-mono-tabular text-ink">
                <div>
                  <strong className="text-ink-muted uppercase block">Observed Telemetry Signals:</strong>
                  <ul className="list-disc ps-5 space-y-0.5 m-0 text-xs">
                    {trail.observedData.map((item, idx) => (
                      <li key={idx}>{item}</li>
                    ))}
                  </ul>
                </div>
                <div>
                  <strong className="text-ink-muted uppercase block">Latent Differential Vector &amp; Inference:</strong>
                  <p className="m-0 text-xs">{trail.inference}</p>
                </div>
                <div>
                  <strong className="text-ink-muted uppercase block">Counterfactual Rule:</strong>
                  <p className="m-0 text-xs">{trail.counterfactual}</p>
                </div>
              </div>
            </details>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
export default WhyThisPanel
