import { useEffect } from 'react'
import type { TrialRecorder } from '../telemetry/tracker'
import type {
  MatrixParams,
  MstParams,
  NBackParams,
  PalParams,
  RelationalParams,
  RotationParams,
  StopSignalParams,
  StroopParams,
  TaskPayload,
  TowerParams,
  UfovParams,
} from '../telemetry/types'
import { Matrix } from './Matrix'
import { MentalRotation } from './MentalRotation'
import { Mst } from './Mst'
import { NBack } from './NBack'
import { PairedAssociates } from './PairedAssociates'
import { Relational } from './Relational'
import { StopSignal } from './StopSignal'
import { Stroop } from './Stroop'
import { Tower } from './Tower'
import { Ufov } from './Ufov'

// Every task component takes these props and calls tracker.push(recorder.finish(...)) once per trial.
export type TaskProps<P> = { params: P; recorder: TrialRecorder; onDone: () => void }

// No `voice` prop: the voice probe is not ported (D1).
type Props = { task: TaskPayload; recorder: TrialRecorder; onDone: () => void }

export function TaskRunner(props: Props) {
  const { task, recorder, onDone } = props
  switch (task.schema_type) {
    case 'n_back':
      return <NBack params={task.params as NBackParams} recorder={recorder} onDone={onDone} />
    case 'stroop':
      return <Stroop params={task.params as StroopParams} recorder={recorder} onDone={onDone} />
    case 'matrix':
      return <Matrix params={task.params as MatrixParams} recorder={recorder} onDone={onDone} />
    case 'mental_rotation':
      return <MentalRotation params={task.params as RotationParams} recorder={recorder} onDone={onDone} />
    case 'relational':
      return <Relational params={task.params as RelationalParams} recorder={recorder} onDone={onDone} />
    case 'tower':
      return <Tower params={task.params as TowerParams} recorder={recorder} onDone={onDone} />
    case 'ufov':
      return <Ufov params={task.params as UfovParams} recorder={recorder} onDone={onDone} />
    case 'mst':
      return <Mst params={task.params as MstParams} recorder={recorder} onDone={onDone} />
    case 'stop_signal':
      return <StopSignal params={task.params as StopSignalParams} recorder={recorder} onDone={onDone} />
    case 'pal':
      return <PairedAssociates params={task.params as PalParams} recorder={recorder} onDone={onDone} />
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
