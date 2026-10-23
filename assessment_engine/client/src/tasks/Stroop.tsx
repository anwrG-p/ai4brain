import { useEffect } from 'react'
import { pressProps, useTimedTrials } from '../telemetry/useTimedTrials'
import type { StroopParams } from '../telemetry/types'
import type { TaskProps } from './TaskRunner'

// Stroop: name the ink color, not the word. Buttons carry the color name (not color alone); keys 1..9.
export function Stroop({ params, recorder, onDone }: TaskProps<StroopParams>) {
  const { colors, trials, time_limit_ms } = params
  const { i, paused, respond } = useTimedTrials(recorder, trials.length, time_limit_ms, onDone)
  const t = trials[i]

  useEffect(() => {
    if (!t) return
    const onKey = (e: KeyboardEvent) => {
      if (e.repeat || e.ctrlKey || e.metaKey || e.altKey) return
      const c = colors[Number(e.key) - 1]
      if (/^[1-9]$/.test(e.key) && c !== undefined) respond(c === t.answer)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [colors, t, respond])

  if (!t) return null
  return (
    <section aria-label="Color naming">
      <p>Pick the color of the ink, not the word.</p>
      {!paused && (
        <p style={{ color: t.ink, fontSize: '3rem', fontWeight: 700 }}>{t.word}</p>
      )}
      <div>
        {colors.map((c, k) => (
          <button key={c} type="button" {...pressProps(() => respond(c === t.answer))}>
            {c} ({k + 1})
          </button>
        ))}
      </div>
    </section>
  )
}
