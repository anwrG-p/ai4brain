import { useEffect } from 'react'
import { Button } from '../../../components/ui/Button'
import { Card } from '../../../components/ui/Card'
import { pressProps, useTimedTrials } from '../telemetry/useTimedTrials'
import type { RotationParams } from '../telemetry/types'
import type { TaskProps } from './TaskRunner'
import { CellsView } from './svg'
import { EXERCISE_NAME } from '../exercises'

type Answer = RotationParams['trials'][number]['answer']
const KEYS: Record<string, Answer> = { f: 'same', j: 'different' }

// Mental rotation: is the right shape the left one turned (same) or a mirror image (different)?
export function MentalRotation({ params, recorder, onDone }: TaskProps<RotationParams>) {
  const { trials, time_limit_ms } = params
  // angle_deg and mirrored let Member 3 fit the RT-by-angle intercept and slope.
  const meta = (k: number) => {
    const x = trials[k]
    return x && { angle_deg: x.angle_deg, mirrored: x.mirrored }
  }
  const { i, paused, respond } = useTimedTrials(recorder, trials.length, time_limit_ms, onDone, meta)
  const t = trials[i]

  useEffect(() => {
    if (!t) return
    const onKey = (e: KeyboardEvent) => {
      const a = KEYS[e.key.toLowerCase()]
      if (!e.repeat && !e.ctrlKey && !e.metaKey && !e.altKey && a) respond(a === t.answer)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [t, respond])

  if (!t) return null
  return (
    <section aria-label={EXERCISE_NAME.mental_rotation} className="flex flex-col items-center gap-4">
      <p className="text-ink">Same shape turned, or a mirror image?</p>
      {/* 2 × 128 px + gap fits a 375 px screen inside the Card's padding. */}
      <Card className="flex flex-wrap justify-center gap-6 text-ink" style={{ minHeight: 176 }}>
        {!paused && (
          <>
            <CellsView cells={t.cells} angle_deg={0} mirrored={false} size={128} />
            <CellsView cells={t.cells} angle_deg={t.angle_deg} mirrored={t.mirrored} size={128} />
          </>
        )}
      </Card>
      <div className="flex flex-wrap justify-center gap-3">
        <Button variant="secondary" {...pressProps(() => respond(t.answer === 'same'))}>
          Same (F)
        </Button>
        <Button variant="secondary" {...pressProps(() => respond(t.answer === 'different'))}>
          Different (J)
        </Button>
      </div>
    </section>
  )
}
