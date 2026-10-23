import { useCallback, useEffect, useState } from 'react'
import { TrialRecorder } from './telemetry/tracker'
import type { TaskPayload } from './telemetry/types'
import { TaskRunner } from './tasks/TaskRunner'
import { fetchNextTask, getUserId } from './tasks/taskSource'

const userId = getUserId()
const sessionId = crypto.randomUUID() // one per page load

type State =
  | { kind: 'loading' }
  | { kind: 'error'; message: string }
  | { kind: 'running'; task: TaskPayload; recorder: TrialRecorder; n: number }

// Session loop: fetch the next task, run it, repeat.
export default function App() {
  const [state, setState] = useState<State>({ kind: 'loading' })
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let cancelled = false
    fetchNextTask(userId).then(
      (task) => {
        if (cancelled) return
        const recorder = new TrialRecorder({
          user_id: userId,
          session_id: sessionId,
          task_id: task.task_id,
          dimension: task.dimension,
          voice_opt_in: false, // Task 12 wires the toggle
        })
        setState({ kind: 'running', task, recorder, n: attempt })
      },
      (err: unknown) => {
        if (!cancelled) setState({ kind: 'error', message: String(err instanceof Error ? err.message : err) })
      },
    )
    return () => {
      cancelled = true
    }
  }, [attempt])

  const next = useCallback(() => {
    setState({ kind: 'loading' })
    setAttempt((a) => a + 1)
  }, [])

  if (state.kind === 'loading') return <main aria-busy="true">Loading the next exercise…</main>
  if (state.kind === 'error')
    return (
      <main>
        <p role="alert">Could not load the next exercise ({state.message}).</p>
        <button type="button" onClick={next}>
          Try again
        </button>
      </main>
    )
  return (
    <main>
      <TaskRunner key={state.n} task={state.task} recorder={state.recorder} onDone={next} />
    </main>
  )
}
