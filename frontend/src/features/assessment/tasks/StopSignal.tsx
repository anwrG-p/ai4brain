import { useCallback, useEffect, useRef } from 'react'
import { Card } from '../../../components/ui/Card'
import { useTimedTrials } from '../telemetry/useTimedTrials'
import type { StopSignalParams } from '../telemetry/types'
import type { TaskProps } from './TaskRunner'
import { EXERCISE_NAME } from '../names'
import { ArrowButtons, ArrowPath, Cross, useArrowKeys, type Dir } from './arrows'

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

// The stop sign: an octagon around the arrow and the word Stop below, so it never rests on colour
// alone (accent-strong is >= 3:1 as a graphic).
const OCTAGON = Array.from({ length: 8 }, (_, k) => {
  const a = ((22.5 + k * 45) * Math.PI) / 180
  return `${(50 + 46 * Math.cos(a)).toFixed(2)},${(50 + 46 * Math.sin(a)).toFixed(2)}`
}).join(' ')

// Stop Light: press the arrow's direction (← / → or the buttons) as fast as possible; when the stop
// sign appears, press nothing. Stop trials' delay follows the staircase (nextSsd); a stop trial's
// verdict is right when no key was pressed within the go window.
// The sign stays mounted and its timer flips it visible straight in the DOM (no React render in
// between), and ssd_ms logs the measured flip time from the arrow's onset, the delay the user got
// (like UFOV's shown_ms); the staircase steps the requested delay. A press before the sign logs the
// requested delay, the one the race model counts.
// ponytail: the flip is measured, not frame-aligned; it paints on the next frame (<= 1 refresh).
export function StopSignal({ params, recorder, onDone }: TaskProps<StopSignalParams>) {
  const { trials, time_limit_ms, fixation_ms, ssd_start_ms, ssd_step_ms } = params
  const maxSsd = Math.max(0, time_limit_ms - ssd_step_ms)
  const ssd = useRef(Math.min(maxSsd, Math.max(0, ssd_start_ms))) // the requested delay
  const shownSsd = useRef<number | null>(null) // this trial's measured sign onset, once shown
  const sign = useRef<HTMLDivElement>(null)

  // Once per finished trial: its meta, and the staircase step for a stop trial.
  const onFinish = useCallback(
    (k: number, correct: boolean) => {
      const t = trials[k]
      if (!t) return undefined
      if (!t.stop) return { stop_trial: false, dir: t.dir, response: 'none' }
      const meta = { stop_trial: true, dir: t.dir, response: 'none', ssd_ms: shownSsd.current ?? ssd.current }
      ssd.current = nextSsd(ssd.current, correct, ssd_step_ms, maxSsd)
      return meta
    },
    [trials, ssd_step_ms, maxSsd],
  )
  const stopped = useCallback((k: number) => trials[k]?.stop === true, [trials])
  const { i, showing, respond } = useTimedTrials(recorder, trials.length, time_limit_ms, onDone, onFinish, {
    fixationMs: fixation_ms,
    timeoutCorrect: stopped,
  })
  const t = trials[i]

  // Each arrow: the sign hidden; on a stop trial, shown at the SSD, timed from this onset.
  useEffect(() => {
    const el = sign.current
    shownSsd.current = null
    if (el) el.style.visibility = 'hidden'
    if (!showing || !t?.stop) return
    const onset = performance.now()
    const id = setTimeout(() => {
      shownSsd.current = Math.round(performance.now() - onset)
      if (sign.current) sign.current.style.visibility = 'visible'
    }, ssd.current)
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
  return (
    <section aria-label={EXERCISE_NAME.stop_signal} className="flex w-full flex-col items-center gap-4">
      <Card className="flex w-full max-w-sm items-center justify-center" style={{ minHeight: 208 }}>
        {/* One grid cell holds both the stimulus and the sign (octagon round the arrow, Stop below).
            The sign holds its place while hidden, so the card never jumps. */}
        <div className="grid place-items-center">
          <div className="col-start-1 row-start-1 flex size-40 items-center justify-center self-start">
            {showing ? (
              <svg viewBox="0 0 100 100" width={120} height={120} aria-hidden="true">
                <ArrowPath dir={t.dir} />
              </svg>
            ) : (
              <Cross />
            )}
          </div>
          <div ref={sign} data-stop-sign className="col-start-1 row-start-1 flex flex-col items-center gap-1 self-start" style={{ visibility: 'hidden' }}>
            <svg viewBox="0 0 100 100" className="size-40" aria-hidden="true">
              <polygon points={OCTAGON} fill="none" stroke="var(--color-accent-strong)" strokeWidth={7} strokeLinejoin="round" />
            </svg>
            <p className="text-xl font-bold text-ink">Stop</p>
          </div>
        </div>
      </Card>
      <ArrowButtons answer={answer} />
    </section>
  )
}
