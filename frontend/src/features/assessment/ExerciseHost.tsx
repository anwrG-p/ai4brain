import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { ExerciseFrame } from './ExerciseFrame'
import { SkipOnError } from './SkipOnError'
import { TaskRunner } from './tasks/TaskRunner'
import { fetchNextTask, getUserId, newId, usingMocks } from './tasks/taskSource'
import { TrialRecorder } from './telemetry/tracker'
import type { SchemaType, TaskPayload } from './telemetry/types'

type ExerciseHostProps = {
  schemaType: SchemaType // chosen by the page (R2); real mode ignores it
  attempt: number // bump to start a fresh task (R3)
  onDone: () => void
  // The block is over and its end card shows: from here a pause must not discard it.
  onBlockEnd?: () => void
  onError: (msg: string) => void
  // Reshapes the fetched task before it runs (the baseline's ?fast=1 test hook).
  prepare?: (task: TaskPayload) => TaskPayload
  // The task that runs, with its final task_id: a page collects its own events by it.
  onTask?: (taskId: string) => void
}

// One session per page load: every task played until a reload shares it.
let sessionId: string | null = null
const getSessionId = () => (sessionId ??= newId())
// Counts fetches for the whole page load. The page's `attempt` restarts at 0 whenever the page
// remounts (exit and come back, Back/Forward), so it cannot make mock task ids unique.
let fetchCount = 0

// Fetches one task, records it with its own TrialRecorder and renders the matching exercise inside
// the jsPsych-style ExerciseFrame (instruction, fixation, progress dots, end card).
export function ExerciseHost({ schemaType, attempt, onDone, onBlockEnd, onError, prepare, onTask }: ExerciseHostProps) {
  const [run, setRun] = useState<{ task: TaskPayload; recorder: TrialRecorder } | null>(null)
  // The exercises restart their trial loop when onDone changes, so they get a stable callback.
  const cb = useRef({ onDone, onBlockEnd, onError, prepare, onTask })
  useLayoutEffect(() => {
    cb.current = { onDone, onBlockEnd, onError, prepare, onTask }
  })
  const done = useCallback(() => cb.current.onDone(), [])
  const blockEnd = useCallback(() => cb.current.onBlockEnd?.(), [])

  useEffect(() => {
    let live = true
    setRun(null)
    const userId = getUserId()
    const fetchNo = ++fetchCount
    fetchNextTask(userId, attempt, { schemaType }).then(
      (fetched) => {
        if (!live) return
        // Mock fixtures reuse one task_id per schema; a session token plus the page-load fetch
        // counter keeps task_id and item_id unique per run, across remounts and reloads (R3).
        // Fits the 48-char limit.
        const unique = usingMocks()
          ? { ...fetched, task_id: `${fetched.task_id}.${getSessionId().slice(0, 8)}.${fetchNo}` }
          : fetched
        const task = cb.current.prepare?.(unique) ?? unique
        const recorder = new TrialRecorder({
          user_id: userId,
          session_id: getSessionId(),
          task_id: task.task_id,
          dimension: task.dimension, // R1: the payload's dimension, never the UI registry's
          voice_opt_in: false, // D1: no voice
        })
        cb.current.onTask?.(task.task_id)
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
    // The motion lock ([data-timed-trial]) sits on the exercise itself, inside ExerciseFrame.
    <div className="w-full min-w-0">
      {run ? (
        <SkipOnError key={run.task.task_id} taskId={run.task.task_id} onSkip={skip}>
          <ExerciseFrame task={run.task} onDone={done} onBlockEnd={blockEnd}>
            {(end) => <TaskRunner task={run.task} recorder={run.recorder} onDone={end} />}
          </ExerciseFrame>
        </SkipOnError>
      ) : (
        <p role="status" className="text-center text-sm text-ink-muted">
          Loading exercise…
        </p>
      )}
    </div>
  )
}
