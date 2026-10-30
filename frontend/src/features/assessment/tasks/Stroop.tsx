import { useEffect } from 'react'
import { Button } from '../../../components/ui/Button'
import { Card } from '../../../components/ui/Card'
import { pressProps, useTimedTrials } from '../telemetry/useTimedTrials'
import type { StroopParams } from '../telemetry/types'
import type { TaskProps } from './TaskRunner'

// Payload ink names → theme tokens that reach >= 4.5:1 text contrast on --color-surface in light
// and dark (ratios in ticket 05's Comments). Not --color-success (3.30:1 light) or --dim-5
// (4.29:1 light). ponytail: only the names the fixtures use; anything else paints in ink.
export const INK: Record<string, string> = {
  red: 'var(--color-danger)',
  green: 'var(--dim-3)',
  blue: 'var(--dim-1)',
  yellow: 'var(--dim-7)',
}

const inkOf = (name: string) => (Object.hasOwn(INK, name.toLowerCase()) ? INK[name.toLowerCase()]! : 'var(--color-ink)')

// Stroop: name the ink color, not the word. Buttons carry the color name (not color alone); keys 1..9.
// No voice probe (spec D1).
export function Stroop({ params, recorder, onDone }: TaskProps<StroopParams>) {
  const { colors, trials, time_limit_ms } = params
  // congruent: Member 3's interference cost = mean RT(incongruent) - mean RT(congruent).
  const congruent = (k: number) => {
    const x = trials[k]
    return x && { congruent: x.word.toLowerCase() === x.ink.toLowerCase() }
  }
  const { i, paused, respond } = useTimedTrials(recorder, trials.length, time_limit_ms, onDone, congruent)
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
    <section aria-label="Color naming" className="flex flex-col items-center gap-4">
      <p className="text-ink">Pick the color of the ink, not the word.</p>
      <Card className="flex w-full items-center justify-center" style={{ minHeight: 160 }}>
        {!paused && (
          <p className="text-5xl font-bold" style={{ color: inkOf(t.ink) }}>
            {t.word}
          </p>
        )}
      </Card>
      <div className="flex flex-wrap justify-center gap-3">
        {colors.map((c, k) => (
          <Button key={c} variant="secondary" {...pressProps(() => respond(c === t.answer))}>
            {c} ({k + 1})
          </Button>
        ))}
      </div>
    </section>
  )
}
