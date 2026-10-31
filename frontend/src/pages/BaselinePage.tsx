import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { X } from 'lucide-react'
import { Button } from '../components/ui/Button'
import { ExerciseHost } from '../features/assessment/ExerciseHost'
import { newId } from '../features/assessment/tasks/taskSource'
import { tracker } from '../features/assessment/telemetry/tracker'
import type { TelemetryEvent } from '../features/assessment/telemetry/types'
import { BASELINE_SCHEMAS, fastTask, isFastRun } from '../features/flow/baseline'
import { useSessionStore } from '../features/insights/sessionStore'
import { taskScores } from '../features/insights/taskScores'

const TOTAL = BASELINE_SCHEMAS.length

/* The baseline: the five exercises in a row, each in its own ExerciseFrame (instruction, fixation,
   trials, end card). Continue on an end card goes straight to the next exercise. Telemetry stays
   held on the device (consent is asked on /results). The page collects the events of its own tasks
   and, after the last one, saves the session's scores (R5) and moves on to /results.
   Exit leaves at any time; a hidden tab or Escape pauses and the exercise starts over (R3). */
export default function BaselinePage() {
  const navigate = useNavigate()
  const { search } = useLocation()
  const fast = useMemo(() => isFastRun(search), [search])
  const addSession = useSessionStore((s) => s.addSession)
  const [step, setStep] = useState(0)
  const [attempt, setAttempt] = useState(0)
  const [paused, setPaused] = useState(false)
  const blockEnded = useRef(false)
  const taskIds = useRef(new Set<string>())
  const events = useRef<TelemetryEvent[]>([])

  useEffect(
    () =>
      tracker.onEvent((e) => {
        if (taskIds.current.has(e.task_id)) events.current.push(e)
      }),
    [],
  )

  const onTask = useCallback((id: string) => {
    taskIds.current.add(id)
    blockEnded.current = false
  }, [])
  const onBlockEnd = useCallback(() => {
    blockEnded.current = true
  }, [])

  // A skipped exercise (it could not be shown) moves on like a finished one.
  const next = useCallback(() => {
    if (step + 1 < TOTAL) {
      setStep(step + 1)
      return
    }
    addSession({ id: newId(), at: new Date().toISOString(), inputs: taskScores(events.current) })
    navigate('/results', { replace: true })
  }, [step, addSession, navigate])

  // A running block is discarded on pause; one already on its end card just waits there.
  const pause = useCallback(() => {
    if (!blockEnded.current) setPaused(true)
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
    <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-4 pt-2">
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
          onBlockEnd={onBlockEnd}
          onDone={next}
          onError={next}
        />
      )}
    </div>
  )
}

// "1 of 5" with a thin bar of five segments.
function StepIndicator({ step }: { step: number }) {
  return (
    <div className="flex items-center gap-3">
      <div aria-hidden="true" className="flex gap-1">
        {BASELINE_SCHEMAS.map((s, k) => (
          <span key={s} className={`h-1 w-6 rounded-pill ${k <= step ? 'bg-brand' : 'bg-border'}`} />
        ))}
      </div>
      <p className="text-sm font-medium text-ink tabular-nums">
        <span className="sr-only">Exercise </span>
        {step + 1} of {TOTAL}
      </p>
    </div>
  )
}
