import { useCallback } from 'react'
import { Card } from '../../../components/ui/Card'
import type { FlankerParams } from '../telemetry/types'
import { useTimedTrials } from '../telemetry/useTimedTrials'
import type { TaskProps } from './TaskRunner'
import { EXERCISE_NAME } from '../names'
import { ArrowButtons, ArrowPath, Cross, useArrowKeys, type Dir } from './arrows'

/* The fixture's design (fixtures.json, mock-flanker-1): 96 trials, 48 congruent and 48 incongruent
   (24 per direction each), the length of one ANT block (Fan, McCandliss, Sommer, Raz & Posner 2002,
   J Cogn Neurosci 14:340-347), with its 1700 ms response window. A conflict cost is a difference
   score, whose retest reliability is modest and rises with trials (Hedge, Powell & Sumner 2018,
   Behav Res Methods 50:1166-1186), so not fewer than 48 per condition. The fixture test pins it. */
export const FLANKER_DESIGN = { trials: 96, perCondition: 48, timeLimitMs: 1700 } as const

/** Five arrows: the middle one points `dir`; the flankers the same way when congruent. */
export function FlankerRow({ dir, congruent }: { dir: Dir; congruent: boolean }) {
  const flank: Dir = congruent ? dir : dir === 'left' ? 'right' : 'left'
  return (
    <svg data-flanker-row viewBox="0 0 500 100" className="h-auto w-full max-w-xs" role="img" aria-label="Five arrows">
      {[0, 1, 2, 3, 4].map((k) => (
        <ArrowPath key={k} x={k * 100} dir={k === 2 ? dir : flank} />
      ))}
    </svg>
  )
}

// Arrow Focus: press the middle arrow's direction (← / → or the buttons); ignore the flankers.
export function Flanker({ params, recorder, onDone }: TaskProps<FlankerParams>) {
  const { trials, time_limit_ms, fixation_ms } = params
  const onFinish = useCallback(
    (k: number) => {
      const t = trials[k]
      return (
        t && {
          flanker: t.congruent ? 'congruent' : 'incongruent',
          dir: t.dir,
          response: 'none',
          ...(t.cue ? { cue: t.cue } : {}),
        }
      )
    },
    [trials],
  )
  const { i, showing, respond } = useTimedTrials(recorder, trials.length, time_limit_ms, onDone, onFinish, { fixationMs: fixation_ms })
  const t = trials[i]

  const answer = useCallback(
    (dir: Dir) => {
      if (t) respond(dir === t.dir, { response: dir, ...(t.cue ? { cue: t.cue } : {}) })
    },
    [t, respond],
  )
  useArrowKeys(answer)

  if (!t) return null
  return (
    <section aria-label={EXERCISE_NAME.flanker} className="flex w-full flex-col items-center gap-4">
      <Card className="flex w-full max-w-sm items-center justify-center px-4" style={{ minHeight: 160 }}>
        {showing ? (
          <FlankerRow dir={t.dir} congruent={t.congruent} />
        ) : (
          <div className="relative flex items-center justify-center">
            <Cross />
            {t.cue && (
              <span
                data-testid="flanker-cue"
                className={`absolute text-lg font-bold text-accent-strong select-none ${
                  t.cue === 'center' ? '-top-3' : t.dir === 'left' ? '-left-8' : '-right-8'
                }`}
              >
                *
              </span>
            )}
          </div>
        )}
      </Card>
      <ArrowButtons answer={answer} />
    </section>
  )
}
