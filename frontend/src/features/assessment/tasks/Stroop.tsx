import { useEffect } from 'react'
import { Button } from '../../../components/ui/Button'
import { Card } from '../../../components/ui/Card'
import { pressProps, useTimedTrials } from '../telemetry/useTimedTrials'
import type { StroopParams } from '../telemetry/types'
import type { TaskProps } from './TaskRunner'
import { EXERCISE_NAME } from '../names'

// Payload ink names → theme tokens that reach >= 4.5:1 text contrast on --color-surface in light
// and dark (ratios in brand-v2 tickets 01 and 06). Red is its own pure red: --color-danger reads
// rose in dark. Not --dim-5 (4.29:1 light). Black is for the server's cvd_safe preset (blue, yellow,
// red, black; not served yet): no dark surface carries black at 4.5:1, so a block with black draws
// its stimuli on a light plate in both themes (LIGHT_PLATE).
// ponytail: only the names the fixtures and the presets use; anything else paints in ink.
export const INK: Record<string, string> = {
  red: 'var(--color-stroop-red)',
  green: 'var(--dim-3)',
  blue: 'var(--dim-1)',
  yellow: 'var(--dim-7)',
  black: 'var(--color-stroop-black)',
}

// The light tokens on the stimulus card, so every ink (black too) is the audited light pair. Set for
// the whole block from its ink list, never per trial, so the plate gives no answer away.
const LIGHT_PLATE = { 'data-theme': 'light' } as const

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
  const plate = colors.some((c) => c.toLowerCase() === 'black') ? LIGHT_PLATE : {}
  return (
    <section aria-label={EXERCISE_NAME.stroop} className="flex flex-col items-center gap-4">
      <Card {...plate} className="flex w-full items-center justify-center" style={{ minHeight: 160 }}>
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
