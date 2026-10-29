import { useState, useEffect, useRef } from 'react'
import {
  Check,
  X,
  Lock,
  Unlock,
  Activity,
  Sliders,
  HeartHandshake,
} from 'lucide-react'
import { useEmilyStore } from '../../state/useEmilyStore'
import {
  startEmilyListener,
  getKinematicsSummary,
  type EmilyEmotion,
} from '../../utils/emilyEngine'
import { Badge } from '../ui/Badge'
import { Button } from '../ui/Button'

const EMOTION_META: Record<
  EmilyEmotion,
  { emoji: string; shortLabel: string; promptAction: string }
> = {
  calm_flow: {
    emoji: '🌿',
    shortLabel: 'Calm Flow',
    promptAction: 'Apply Calm Mode',
  },
  energized: {
    emoji: '✨',
    shortLabel: 'Curious Spark',
    promptAction: 'Apply Spark Mode',
  },
  frustrated: {
    emoji: '🍃',
    shortLabel: 'Gentle De-Escalation',
    promptAction: 'Apply Calm Mode',
  },
  hesitant: {
    emoji: '🧭',
    shortLabel: 'Reassuring Guidance',
    promptAction: 'Apply Guidance',
  },
  fatigued: {
    emoji: '🌙',
    shortLabel: 'Restorative Wind-Down',
    promptAction: 'Apply Rest Mode',
  },
}

export function EmilyMoodPill() {
  const {
    currentEmotion,
    proposedEmotion,
    isHumanLocked,
    autoAdapt,
    metrics,
    setManualEmotion,
    unlockHuman,
    approveProposedEmotion,
    rejectProposedEmotion,
    toggleAutoAdapt,
  } = useEmilyStore()

  const [isOpen, setIsOpen] = useState(false)
  const popoverRef = useRef<HTMLDivElement>(null)
  const pillRef = useRef<HTMLButtonElement>(null)

  // 1. Sync data-emotion attribute onto <html> whenever currentEmotion updates
  useEffect(() => {
    if (typeof document !== 'undefined') {
      document.documentElement.setAttribute('data-emotion', currentEmotion)
    }
  }, [currentEmotion])

  // 2. Initialize background passive DOM telemetry listener
  useEffect(() => {
    const cleanup = startEmilyListener((_metrics, _emotion, buffer) => {
      if (buffer && buffer.length > 0) {
        useEmilyStore.getState().updateTelemetry(buffer)
      }
    })
    return cleanup
  }, [])

  // 3. Handle outside click & escape to close popover
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape' && isOpen) {
        setIsOpen(false)
        pillRef.current?.focus()
      }
    }
    function handleClickOutside(e: MouseEvent) {
      if (
        isOpen &&
        popoverRef.current &&
        !popoverRef.current.contains(e.target as Node) &&
        pillRef.current &&
        !pillRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen])

  const meta = EMOTION_META[currentEmotion]
  const proposedMeta = proposedEmotion ? EMOTION_META[proposedEmotion] : null

  return (
    <div className="relative inline-flex items-center">
      {/* Primary Mood Pill Button */}
      <button
        ref={pillRef}
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        aria-label={`EMILY Atmosphere: ${meta.shortLabel}. Click to customize.`}
        aria-haspopup="dialog"
        aria-expanded={isOpen}
        title="EMILY Emotion Atmosphere & Micro-Interaction Rhythm"
        className="focus-ring group inline-flex items-center gap-2 px-3 py-1 rounded-pill bg-surface border-2 border-border-strong shadow-doodle-sm hover:shadow-doodle transition-all cursor-pointer text-ink font-sans text-xs font-bold"
      >
        {/* Pulsing live emotion color dot */}
        <span className="relative flex h-2.5 w-2.5 items-center justify-center">
          <span
            className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-60"
            style={{ backgroundColor: 'var(--color-emotion-accent)' }}
          />
          <span
            className="relative inline-flex rounded-full h-2 w-2"
            style={{ backgroundColor: 'var(--color-emotion-accent)' }}
          />
        </span>

        {/* Emotion Emoji + Label */}
        <span className="flex items-center gap-1">
          <span aria-hidden="true">{meta.emoji}</span>
          <span className="truncate max-w-[110px] sm:max-w-none">{meta.shortLabel}</span>
        </span>

        {/* Lock or Adaptive Indicator */}
        {isHumanLocked ? (
          <Lock
            size={11}
            aria-label="Human locked"
            className="text-ink-muted group-hover:text-ink shrink-0"
          />
        ) : (
          <Sliders
            size={11}
            aria-hidden="true"
            className="text-ink-muted group-hover:text-ink shrink-0 opacity-70"
          />
        )}
      </button>

      {/* BRIAN Non-Intrusive Proposal Bubble (when EMILY detects strained/hesitant rhythm) */}
      {proposedEmotion && !isOpen && (
        <div
          role="status"
          aria-live="polite"
          className="absolute top-full left-0 mt-2 z-50 w-72 sm:w-80 bg-surface rounded-xl border-2 border-border-strong p-3.5 shadow-hero"
        >
          {/* Decorative speech bubble beak */}
          <div
            className="absolute -top-2 left-6 w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-b-[8px] border-b-border-strong"
            aria-hidden="true"
          />

          <div className="flex items-start gap-2.5 mb-2.5">
            <span className="text-xl shrink-0" aria-hidden="true">
              {proposedMeta?.emoji || '🌿'}
            </span>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-1 mb-1">
                <span className="font-display font-bold text-xs text-ink flex items-center gap-1">
                  <span>BRIAN Companion Check-In</span>
                </span>
                <button
                  type="button"
                  onClick={rejectProposedEmotion}
                  aria-label="Dismiss suggestion"
                  className="focus-ring text-ink-muted hover:text-ink min-w-[44px] min-h-[44px] flex items-center justify-center rounded cursor-pointer"
                >
                  <X size={13} aria-hidden="true" />
                </button>
              </div>
              <p className="text-xs text-ink leading-snug m-0">
                {proposedEmotion === 'frustrated'
                  ? "Notice rapid bursts and elevated cursor tension. Switch to calm pacing?"
                  : proposedEmotion === 'hesitant'
                  ? "Notice wandering arcs and searching pauses. Switch to reassuring guidance?"
                  : "Pacing is slowing down with longer pauses. Switch to restorative wind-down?"}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 justify-end">
            <Button
              size="sm"
              variant="ghost"
              onClick={rejectProposedEmotion}
              className="text-xs py-1 px-2.5 h-auto"
            >
              Keep Current
            </Button>
            <Button
              size="sm"
              variant="primary"
              onClick={approveProposedEmotion}
              className="text-xs py-1 px-2.5 h-auto inline-flex items-center gap-1 font-bold"
            >
              <Check size={12} aria-hidden="true" />
              <span>{proposedMeta?.promptAction || 'Apply Mode'}</span>
            </Button>
          </div>
        </div>
      )}

      {/* Popover Menu: Kinematics Summary + Emotion Controls */}
      {isOpen && (
        <div
          ref={popoverRef}
          role="dialog"
          aria-label="EMILY Emotion Atmosphere & Micro-Interactions"
          className="absolute top-full left-0 sm:right-0 sm:left-auto mt-2 z-50 w-80 sm:w-96 bg-surface rounded-xl border-2 border-border-strong p-4 shadow-hero"
        >
          {/* Header */}
          <div className="flex items-center justify-between gap-2 pb-3 mb-3 border-b-2 border-border">
            <div className="flex items-center gap-2">
              <HeartHandshake
                size={18}
                className="text-brand"
                aria-hidden="true"
              />
              <h3 className="font-display font-bold text-sm text-ink m-0">
                EMILY Atmosphere
              </h3>
            </div>
            <div className="flex items-center gap-1.5">
              {isHumanLocked ? (
                <Badge tone="info" glyph="🔒">
                  Manual Lock
                </Badge>
              ) : autoAdapt ? (
                <Badge tone="success" glyph="🌊">
                  Auto-Adapting
                </Badge>
              ) : (
                <Badge tone="neutral" glyph="🌿">
                  Balanced
                </Badge>
              )}
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                aria-label="Close EMILY settings"
                className="focus-ring min-w-[44px] min-h-[44px] flex items-center justify-center rounded hover:bg-surface-raised text-ink-muted hover:text-ink cursor-pointer"
              >
                <X size={15} aria-hidden="true" />
              </button>
            </div>
          </div>

          {/* 1-Line Plain-English Kinematics Summary */}
          <div className="p-2.5 rounded-md border border-border bg-surface-raised mb-3 text-xs">
            <div className="flex items-center gap-1.5 font-bold text-ink mb-1">
              <Activity size={13} className="text-brand" aria-hidden="true" />
              <span>Live Pointer Dynamics</span>
            </div>
            <p className="text-xs text-ink-muted leading-relaxed m-0">
              {getKinematicsSummary(metrics)}
            </p>

            {/* Collapsible Technical Telemetry Inspect Drawer (ADR 0001 compliant) */}
            <details data-technical-drawer className="mt-2 pt-1 border-t border-border/60">
              <summary className="text-xs font-mono text-ink-muted cursor-pointer hover:text-ink">
                Explore Kinematic Metrics
              </summary>
              <div className="flex items-center gap-2 mt-1.5 text-xs font-mono text-ink-muted">
                <span>v: {metrics.cursorVelocity.toFixed(2)} px/ms</span>
                <span>·</span>
                <span>arc: {(metrics.pathDirectness * 100).toFixed(0)}%</span>
                <span>·</span>
                <span>jerk: {metrics.cursorJerk.toFixed(2)}</span>
              </div>
            </details>
          </div>

          {/* Emotion Selector: Manual Lock */}
          <div className="mb-3">
            <div className="flex items-center justify-between text-xs font-bold text-ink mb-1.5">
              <span>Choose Your Mood & Pacing</span>
              {isHumanLocked && (
                <button
                  type="button"
                  onClick={unlockHuman}
                  className="focus-ring text-brand hover:underline inline-flex items-center gap-1 cursor-pointer"
                >
                  <Unlock size={11} aria-hidden="true" />
                  <span>Resume Auto</span>
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 gap-1.5">
              {(
                [
                  'calm_flow',
                  'energized',
                  'frustrated',
                  'hesitant',
                  'fatigued',
                ] as EmilyEmotion[]
              ).map((emotionKey) => {
                const itemMeta = EMOTION_META[emotionKey]
                const isSelected = currentEmotion === emotionKey

                return (
                  <button
                    key={emotionKey}
                    type="button"
                    onClick={() => {
                      setManualEmotion(emotionKey)
                    }}
                    className={`focus-ring w-full flex items-center justify-between px-3 py-2 rounded-md border text-xs text-left transition-all cursor-pointer ${
                      isSelected
                        ? 'border-border-strong bg-brand-subtle font-bold shadow-doodle-sm'
                        : 'border-border bg-surface hover:bg-surface-raised'
                    }`}
                  >
                    <span className="flex items-center gap-2">
                      <span aria-hidden="true">{itemMeta.emoji}</span>
                      <span className="text-ink">{itemMeta.shortLabel}</span>
                    </span>
                    {isSelected && (
                      <span className="flex items-center gap-1 text-brand font-mono text-xs">
                        <Check size={13} aria-hidden="true" />
                        <span>Active</span>
                      </span>
                    )}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Auto-Adapt Toggle & Non-Biometric Assurance */}
          <div className="pt-2 border-t border-border flex items-center justify-between gap-2 text-xs">
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={autoAdapt}
                onChange={toggleAutoAdapt}
                className="rounded border-border-strong text-brand focus:ring-brand cursor-pointer"
              />
              <span className="text-ink font-medium">Auto-apply pacing</span>
            </label>
            <span className="text-xs text-ink-muted font-mono">Zero biometrics</span>
          </div>
        </div>
      )}
    </div>
  )
}
