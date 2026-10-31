import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { X } from 'lucide-react'
import { Button } from '../components/ui/Button'
import { ExerciseHost } from '../features/assessment/ExerciseHost'
import { tracker } from '../features/assessment/telemetry/tracker'
import type { TelemetryEvent } from '../features/assessment/telemetry/types'
import { BASELINE_SCHEMAS, fastTask, isFastRun } from '../features/flow/baseline'
import { saveRun } from '../features/insights/sessionStore'

const TOTAL = BASELINE_SCHEMAS.length

/** What the baseline hands to /results (router state): how many exercises were finished. */
export type BaselineResult = { finished: number; total: number }

/* The baseline: the six exercises in a row, each in its own ExerciseFrame (instruction, fixation,
   trials, end card). Continue on an end card goes straight to the next exercise. Telemetry stays
   held on the device (consent is asked on /results). The page collects the events of its own tasks
   and, after the last one, saves the session's scores with the shared saveRun (R5, as the task
   runner does) and moves on to /results.
   Exit leaves at any time. A hidden tab or Escape pauses a started block (fixation or trials), and
   the exercise starts over (R3): the paused attempt's events are dropped. On the instruction
   screen and the end card there is nothing to discard, so neither pauses. */
export default function BaselinePage() {
  const navigate = useNavigate()
  const { search } = useLocation()
  const fast = useMemo(() => isFastRun(search), [search])
  const [step, setStep] = useState(0)
  const [attempt, setAttempt] = useState(0)
  const [paused, setPaused] = useState(false)
  const root = useRef<HTMLDivElement>(null)
  const current = useRef<string | null>(null)
  const taskIds = useRef(new Set<string>())
  const events = useRef<TelemetryEvent[]>([])
  const finished = useRef(0)

  useEffect(
    () =>
      tracker.onEvent((e) => {
        if (taskIds.current.has(e.task_id)) events.current.push(e)
      }),
    [],
  )

  const onTask = useCallback((id: string) => {
    taskIds.current.add(id)
    current.current = id
  }, [])

  const next = useCallback(
    (done: boolean) => {
      if (done) finished.current += 1
      if (step + 1 < TOTAL) {
        setStep(step + 1)
        return
      }
      saveRun(events.current, taskIds.current) // nothing scored (every exercise skipped): no session
      const state: BaselineResult = { finished: finished.current, total: TOTAL }
      navigate('/results', { replace: true, state })
    },
    [step, navigate],
  )
  const onDone = useCallback(() => next(true), [next])
  const onError = useCallback(() => next(false), [next]) // could not be shown: skipped, not counted

  // Only a started block pauses: ExerciseFrame marks the fixation and the trials with
  // [data-block-running], from Begin until the end card. The abandoned attempt leaves no trace:
  // its events are dropped from the scores and from the tracker's queue, so they are never sent.
  const pause = useCallback(() => {
    if (!root.current?.querySelector('[data-block-running="true"]')) return
    const id = current.current
    if (id) {
      taskIds.current.delete(id)
      events.current = events.current.filter((e) => e.task_id !== id)
      tracker.dropTask(id)
    }
    setPaused(true)
  }, [])
  useEffect(() => {
    if (paused) return
    const onVis = () => document.visibilityState === 'hidden' && pause()
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && pause()
    document.addEventListener('visibilitychange', onVis)
    window.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('visibilitychange', onVis)
      window.removeEventListener('keydown', onKey)
    }
  }, [paused, pause])

  const resume = () => {
    setAttempt((a) => a + 1)
    setPaused(false)
  }

  return (
    <div ref={root} className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-4 pt-2">
      <h1 className="sr-only">Your first check-in</h1>
      <div className="flex items-center justify-between gap-3">
        <Link
          to="/"
          className="focus-ring inline-flex min-h-11 items-center gap-1.5 rounded-md px-2 text-sm font-medium text-ink-muted no-underline hover:text-ink"
        >
          <X size={20} strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" />
          Exit
        </Link>
        <StepIndicator step={step} />
      </div>

      {paused ? (
        <div className="mx-auto flex max-w-md flex-col items-center gap-4 py-8 text-center">
          <h2 className="font-display text-2xl font-bold text-ink">Paused</h2>
          <p className="text-ink">This exercise will start again from the top.</p>
          <Button size="lg" onClick={resume} autoFocus>
            Resume
          </Button>
        </div>
      ) : (
        <ExerciseHost
          key={`${step}.${attempt}`}
          schemaType={BASELINE_SCHEMAS[step]!}
          attempt={attempt}
          prepare={fast ? fastTask : undefined}
          onTask={onTask}
          onDone={onDone}
          onError={onError}
        />
      )}
    </div>
  )
}

// "1 of 6" with a thin bar of six segments; the next one fills from the left as an exercise ends
// (a transform transition, off under reduced motion). The text is what screen readers hear.
function StepIndicator({ step }: { step: number }) {
  return (
    <div className="flex items-center gap-3">
      <div aria-hidden="true" className="flex gap-1">
        {BASELINE_SCHEMAS.map((s, k) => (
          <span key={s} data-step={k <= step ? 'on' : 'off'} className="h-1 w-6 overflow-hidden rounded-pill bg-border">
            <span
              className={`block h-full w-full origin-left bg-brand transition-transform duration-400 ease-out motion-reduce:transition-none ${k <= step ? 'scale-x-100' : 'scale-x-0'}`}
            />
          </span>
        ))}
      </div>
      <p className="text-sm font-medium text-ink tabular-nums">
        <span className="sr-only">Exercise </span>
        {step + 1} of {TOTAL}
      </p>
    </div>
  )
}
