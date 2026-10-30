import { useEffect } from 'react'
import type { TrialRecorder } from '../telemetry/tracker'
import type { TaskPayload } from '../telemetry/types'

// Every task component takes these props and calls tracker.push(recorder.finish(...)) once per trial.
export type TaskProps<P> = { params: P; recorder: TrialRecorder; onDone: () => void }

// No `voice` prop: the voice probe is not ported (D1).
type Props = { task: TaskPayload; recorder: TrialRecorder; onDone: () => void }

export function TaskRunner(props: Props) {
  const { task, onDone } = props
  switch (task.schema_type) {
    // Tickets 05 and 06 add one case each, e.g.
    //   case 'n_back':
    //     return <NBack params={task.params as NBackParams} recorder={props.recorder} onDone={onDone} />
    default:
      return <Unsupported schemaType={task.schema_type} onDone={onDone} />
  }
}

// ponytail: the pause stops an unknown task from hot-looping fetch → skip → fetch against the API.
const SKIP_MS = 1500

function Unsupported({ schemaType, onDone }: { schemaType: string; onDone: () => void }) {
  useEffect(() => {
    const id = setTimeout(onDone, SKIP_MS)
    return () => clearTimeout(id)
  }, [onDone])
  return <p role="status">Unsupported task ({schemaType}). Moving on…</p>
}
