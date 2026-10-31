import { Button } from '../../../components/ui/Button'
import { Card } from '../../../components/ui/Card'
import { pressProps, useTimedTrials } from '../telemetry/useTimedTrials'
import type { MatrixParams } from '../telemetry/types'
import type { TaskProps } from './TaskRunner'
import { GlyphView } from './svg'
import { EXERCISE_NAME } from '../names'

// Matrix reasoning: a single trial (trial_index 0). The response is the index into options.
// Glyph colours and aria-labels come from GlyphView (ticket 04).
export function Matrix({ params, recorder, onDone }: TaskProps<MatrixParams>) {
  const { cells, options, answer, time_limit_ms } = params
  const { i, respond } = useTimedTrials(recorder, 1, time_limit_ms, onDone)
  if (i > 0) return null
  return (
    <section aria-label={EXERCISE_NAME.matrix} className="flex flex-col items-center gap-4">
      <Card className="flex justify-center">
        <div role="group" aria-label="puzzle" className="grid grid-cols-3 gap-2">
          {cells.map((c, k) =>
            c ? (
              <GlyphView key={k} glyph={c} />
            ) : (
              <span
                key={k}
                className="grid place-items-center rounded-md border-2 border-dashed border-border-strong text-3xl font-bold text-ink"
                style={{ width: 80, height: 80 }}
              >
                ?
              </span>
            ),
          )}
        </div>
      </Card>
      <div className="flex flex-wrap justify-center gap-3">
        {options.map((o, k) => (
          <Button key={k} variant="secondary" size="sm" {...pressProps(() => respond(k === answer))}>
            <GlyphView glyph={o} size={64} />
          </Button>
        ))}
      </div>
    </section>
  )
}
