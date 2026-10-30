import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { SkipOnError } from './SkipOnError'
import { TaskRunner } from './tasks/TaskRunner'
import { fetchNextTask, getUserId, newId, usingMocks } from './tasks/taskSource'
import { TrialRecorder } from './telemetry/tracker'
import type { SchemaType, TaskPayload } from './telemetry/types'

type ExerciseHostProps = {
  schemaType: SchemaType // chosen by the page (R2); real mode ignores it
  attempt: number // bump to start a fresh task (R3)
  onDone: () => void
  onError: (msg: string) => void
}

// One session per page load: every task played until a reload shares it.
let sessionId: string | null = null
const getSessionId = () => (sessionId ??= newId())
// Counts fetches for the whole page load. The page's `attempt` restarts at 0 whenever the page
// remounts (exit and come back, Back/Forward), so it cannot make mock task ids unique.
let fetchCount = 0

// Fetches one task, records it with its own TrialRecorder and renders the matching exercise.
export function ExerciseHost({ schemaType, attempt, onDone, onError }: ExerciseHostProps) {
  const [run, setRun] = useState<{ task: TaskPayload; recorder: TrialRecorder } | null>(null)
  // The exercises restart their trial loop when onDone changes, so they get a stable callback.
  const cb = useRef({ onDone, onError })
  useLayoutEffect(() => {
    cb.current = { onDone, onError }
  })
  const done = useCallback(() => cb.current.onDone(), [])

  useEffect(() => {
    let live = true
    setRun(null)
    const userId = getUserId()
    const run = ++fetchCount
    fetchNextTask(userId, attempt, { schemaType }).then(
      (fetched) => {
        if (!live) return
        // Mock fixtures reuse one task_id per schema; a session token plus the page-load fetch
        // counter keeps task_id and item_id unique per run, across remounts and reloads (R3).
        // Fits the 48-char limit.
        const task = usingMocks()
          ? { ...fetched, task_id: `${fetched.task_id}.${getSessionId().slice(0, 8)}.${run}` }
          : fetched
        const recorder = new TrialRecorder({
          user_id: userId,
          session_id: getSessionId(),
          task_id: task.task_id,
          dimension: task.dimension, // R1: the payload's dimension, never the UI registry's
          voice_opt_in: false, // D1: no voice
        })
        setRun({ task, recorder })
      },
      (err: unknown) => {
        if (live) cb.current.onError(err instanceof Error ? err.message : String(err))
      },
    )
    return () => {
      live = false
    }
  }, [schemaType, attempt])

  const skip = useCallback(() => cb.current.onError('This exercise could not be shown.'), [])

  return (
    <div data-timed-trial="true" className="w-full min-w-0">
      {run ? (
        <SkipOnError key={run.task.task_id} taskId={run.task.task_id} onSkip={skip}>
          <TaskRunner task={run.task} recorder={run.recorder} onDone={done} />
        </SkipOnError>
      ) : (
        <p role="status" className="text-center text-sm text-ink-muted">
          Loading exercise…
        </p>
      )}
    </div>
  )
}
