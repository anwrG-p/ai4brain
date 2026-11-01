import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { ArrowLeft, ArrowRight } from 'lucide-react'
import { Button } from '../../../components/ui/Button'
import { Card } from '../../../components/ui/Card'
import { pressProps } from '../telemetry/useTimedTrials'
import type { StopSignalParams } from '../telemetry/types'
import type { TaskProps } from './TaskRunner'
import { EXERCISE_NAME } from '../names'
import { useArrowKeys, useFixatedTrials } from './useFixatedTrials'

type Dir = StopSignalParams['trials'][number]['dir']

/* The fixture's design (fixtures.json, mock-stop-1), from the consensus guide: Verbruggen F, Aron AR,
   Band GPH, et al. (2019) "A consensus guide to capturing the ability to inhibit actions and
   impulsive behaviors in the stop-signal task", eLife 8:e46323. Its recommendations used here:
   - stop signals on 25% of trials (fewer invite waiting, more invite proactive slowing);
   - the SSD tracked by a one-up/one-down staircase in 50 ms steps, so P(respond | signal) ~ .5;
   - at least 50 stop trials for a usable individual estimate, so 200 trials at 25%;
   - a fixed go window (max RT) of 1250 ms, as in STOP-IT (Verbruggen, Logan & Stevens 2008);
     the SSD starts at STOP-IT's 250 ms.
   The fixture test (StopSignal.test.tsx) pins the fixture to these numbers. */
export const SST_DESIGN = { trials: 200, stopShare: 0.25, minStopTrials: 50, ssdStepMs: 50, timeLimitMs: 1250, ssdStartMs: 250 } as const

/** The next stop-signal delay: one step later after a successful stop (the stop was easy), one step
    earlier after a failed one, kept within [0, max]. */
export function nextSsd(ssd: number, stopped: boolean, step: number, max: number): number {
  return Math.min(max, Math.max(0, ssd + (stopped ? step : -step)))
}

// The arrow, the stimulus: ink strokes on the card's surface. The stop signal adds an octagon around
// it and the word Stop below, so it never rests on colour alone (accent-strong is >= 3:1 as a graphic).
const ARROW = 'M18 50 H78 M56 28 L80 50 L56 72'
const OCTAGON = Array.from({ length: 8 }, (_, k) => {
  const a = ((22.5 + k * 45) * Math.PI) / 180
  return `${(50 + 46 * Math.cos(a)).toFixed(2)},${(50 + 46 * Math.sin(a)).toFixed(2)}`
}).join(' ')

export function ArrowGlyph({ dir, size = 120 }: { dir: Dir; size?: number }) {
  return (
    <svg viewBox="0 0 100 100" width={size} height={size} aria-hidden="true">
      <path
        d={ARROW}
        transform={dir === 'left' ? 'translate(100 0) scale(-1 1)' : undefined}
        fill="none"
        stroke="var(--color-ink)"
        strokeWidth={10}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

// Stop Light: press the arrow's direction (← / → or the buttons) as fast as possible; when the stop
// sign appears, press nothing. Stop trials' delay follows the staircase (nextSsd); a stop trial's
// verdict is right when no key was pressed within the go window.
export function StopSignal({ params, recorder, onDone }: TaskProps<StopSignalParams>) {
  const { trials, time_limit_ms, fixation_ms, ssd_start_ms, ssd_step_ms } = params
  const maxSsd = Math.max(0, time_limit_ms - ssd_step_ms)
  const ssd = useRef(Math.min(maxSsd, Math.max(0, ssd_start_ms)))
  const [signal, setSignal] = useState(-1) // index of the trial whose stop sign is up

  // Once per finished trial: its meta, and the staircase step for a stop trial.
  const onFinish = useCallback(
    (k: number, correct: boolean) => {
      const t = trials[k]
      if (!t) return undefined
      if (!t.stop) return { stop_trial: false, dir: t.dir, response: 'none' }
      const meta = { stop_trial: true, dir: t.dir, response: 'none', ssd_ms: ssd.current }
      ssd.current = nextSsd(ssd.current, correct, ssd_step_ms, maxSsd)
      return meta
    },
    [trials, ssd_step_ms, maxSsd],
  )
  const stopped = useCallback((k: number) => trials[k]?.stop === true, [trials])
  const { i, showing, respond } = useFixatedTrials(recorder, trials.length, fixation_ms, time_limit_ms, onDone, onFinish, stopped)
  const t = trials[i]

  // The stop sign, at this trial's SSD after the arrow (read when the arrow shows).
  useEffect(() => {
    if (!showing || !t?.stop) return
    const id = setTimeout(() => setSignal(i), ssd.current)
    return () => clearTimeout(id)
  }, [showing, i, t])

  // Any press on a stop trial is a failed stop, before the sign or after it.
  const answer = useCallback(
    (dir: Dir) => {
      if (t) respond(!t.stop && dir === t.dir, { response: dir })
    },
    [t, respond],
  )
  useArrowKeys(answer)

  if (!t) return null
  const sign = showing && signal === i
  return (
    <section aria-label={EXERCISE_NAME.stop_signal} className="flex w-full flex-col items-center gap-4">
      <Card className="flex w-full max-w-sm flex-col items-center justify-center gap-1" style={{ minHeight: 208 }}>
        <div className="relative flex size-40 items-center justify-center">
          {showing ? (
            <ArrowGlyph dir={t.dir} />
          ) : (
            <span role="img" aria-label="Look at the cross" className="select-none text-5xl font-bold text-ink">
              +
            </span>
          )}
          {sign && (
            <svg data-stop-sign viewBox="0 0 100 100" className="absolute inset-0 size-full" aria-hidden="true">
              <polygon points={OCTAGON} fill="none" stroke="var(--color-accent-strong)" strokeWidth={7} strokeLinejoin="round" />
            </svg>
          )}
        </div>
        {/* The word holds its line even when hidden, so the card never jumps. */}
        <p className={`text-xl font-bold text-ink ${sign ? '' : 'invisible'}`} aria-hidden={!sign}>
          Stop
        </p>
      </Card>
      <div className="flex justify-center gap-4">
        <AnswerButton onPress={() => answer('left')} icon={<ArrowLeft size={24} strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" />}>
          Left
        </AnswerButton>
        <AnswerButton onPress={() => answer('right')} icon={<ArrowRight size={24} strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" />} iconRight>
          Right
        </AnswerButton>
      </div>
    </section>
  )
}

/** A large left/right answer button (>= 56 px tall, 128 px wide): pressProps answers on pointerdown. */
export function AnswerButton({ onPress, icon, iconRight, children }: { onPress: () => void; icon: ReactNode; iconRight?: boolean; children: ReactNode }) {
  return (
    <Button
      variant="secondary"
      size="lg"
      className="min-h-14 min-w-32"
      leftIcon={iconRight ? undefined : icon}
      rightIcon={iconRight ? icon : undefined}
      {...pressProps(onPress)}
    >
      {children}
    </Button>
  )
}
