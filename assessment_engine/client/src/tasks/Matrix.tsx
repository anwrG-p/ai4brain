import { pressProps, useTimedTrials } from '../telemetry/useTimedTrials'
import type { MatrixParams } from '../telemetry/types'
import type { TaskProps } from './TaskRunner'
import { GlyphView } from './svg'

// Matrix reasoning: a single trial (trial_index 0). The response is the index into options.
export function Matrix({ params, recorder, onDone }: TaskProps<MatrixParams>) {
  const { cells, options, answer, time_limit_ms } = params
  const { i, respond } = useTimedTrials(recorder, 1, time_limit_ms, onDone)
  if (i > 0) return null
  return (
    <section aria-label="Pattern puzzle">
      <p>Which piece completes the pattern?</p>
      <div role="group" aria-label="puzzle" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 80px)', gap: 8 }}>
        {cells.map((c, k) =>
          c ? (
            <GlyphView key={k} glyph={c} />
          ) : (
            <span key={k} style={{ display: 'grid', placeItems: 'center', fontSize: '2rem' }}>
              ?
            </span>
          ),
        )}
      </div>
      <div>
        {options.map((o, k) => (
          <button key={k} type="button" {...pressProps(() => respond(k === answer))}>
            <GlyphView glyph={o} size={64} />
          </button>
        ))}
      </div>
    </section>
  )
}
