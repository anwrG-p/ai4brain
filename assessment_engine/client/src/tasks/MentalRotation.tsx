import { useEffect } from 'react'
import { useTimedTrials } from '../telemetry/useTimedTrials'
import type { RotationParams } from '../telemetry/types'
import type { TaskProps } from './TaskRunner'
import { CellsView } from './svg'

type Answer = RotationParams['trials'][number]['answer']
const KEYS: Record<string, Answer> = { f: 'same', j: 'different' }

// Mental rotation: is the right shape the left one turned (same) or a mirror image (different)?
export function MentalRotation({ params, recorder, onDone }: TaskProps<RotationParams>) {
  const { trials, time_limit_ms } = params
  const { i, paused, respond } = useTimedTrials(recorder, trials.length, time_limit_ms, onDone)
  const t = trials[i]

  useEffect(() => {
    if (!t) return
    const onKey = (e: KeyboardEvent) => {
      const a = KEYS[e.key.toLowerCase()]
      if (!e.repeat && a) respond(a === t.answer)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [t, respond])

  if (!t) return null
  return (
    <section aria-label="Shape turning">
      <p>Same shape turned, or a mirror image?</p>
      {!paused && (
        <div style={{ display: 'flex', gap: 24 }}>
          <CellsView cells={t.cells} angle_deg={0} mirrored={false} />
          <CellsView cells={t.cells} angle_deg={t.angle_deg} mirrored={t.mirrored} />
        </div>
      )}
      <div>
        <button type="button" onPointerDown={() => respond(t.answer === 'same')}>
          Same (F)
        </button>
        <button type="button" onPointerDown={() => respond(t.answer === 'different')}>
          Different (J)
        </button>
      </div>
    </section>
  )
}
