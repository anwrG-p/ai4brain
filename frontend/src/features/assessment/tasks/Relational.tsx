import { useEffect, useState } from 'react'
import { Button } from '../../../components/ui/Button'
import { Card } from '../../../components/ui/Card'
import { WeightedStaircase } from '../adaptive/staircase'
import { pressProps, useTimedTrials } from '../telemetry/useTimedTrials'
import type { RelationalParams, Statement } from '../telemetry/types'
import type { TaskProps } from './TaskRunner'
import { EXERCISE_NAME } from '../names'

type Trial = RelationalParams['levels'][number][number]

export const KEYS: Record<string, boolean> = { t: true, f: false }
const ARROW = { more: '▷', less: '◁' } as const
const WORDS = { same: 'SAME as', opposite: 'OPPOSITE to', before: 'BEFORE', after: 'AFTER', contains: 'CONTAINS' } as const

// One premise or the question as plain text. more/less are drawn as arrows with a hidden text alternative.
function Sentence({ s, ask }: { s: Statement; ask?: boolean }) {
  const [pre, post] = ask ? ['Is ', '?'] : ['', '']
  if (s.rel === 'more' || s.rel === 'less')
    return (
      <p>
        <span aria-hidden="true">{`${pre}${s.a} ${ARROW[s.rel]} ${s.b}${post}`}</span>
        <span className="sr-only">{ask ? `Is ${s.a} ${s.rel} than ${s.b}?` : `${s.a} is ${s.rel} than ${s.b}`}</span>
      </p>
    )
  if (ask) return <p>{s.rel === 'contains' ? `Does ${s.a} CONTAIN ${s.b}?` : `Is ${s.a} ${WORDS[s.rel]} ${s.b}?`}</p>
  return <p>{s.rel === 'contains' ? `${s.a} CONTAINS ${s.b}` : `${s.a} is ${WORDS[s.rel]} ${s.b}`}</p>
}

// The trial shown at index i, replayed from the outcomes of earlier trials: the staircase updates on
// each finished trial (aborted ones only consume their item). An empty level falls back to the
// nearest non-empty one (lower first); null when no level has trials.
// ponytail: O(n_trials²) replay per pick; fine for tens of trials.
function pickFor(levels: Trial[][], results: Record<number, boolean>, i: number) {
  const stair = new WeightedStaircase(levels.length)
  const used = levels.map(() => 0)
  for (let j = 0; ; j++) {
    const want = stair.level
    let level = -1
    for (let d = 0; d < levels.length && level < 0; d++)
      level = [want - d, want + d].find((l) => levels[l]?.length) ?? -1
    if (level < 0) return null
    const items = levels[level]! // non-empty: found above
    const u = used[level]!
    used[level] = u + 1
    const trial = items[u % items.length]!
    if (j === i) return { trial, level }
    if (j in results) stair.update(results[j]!)
  }
}

// Relational reasoning: true/false judgments over chained premises, staircased by level (easiest first).
// Keys T/F or the buttons. A trial whose level runs out of items wraps to that level's first item.
export function Relational({ params, recorder, onDone }: TaskProps<RelationalParams>) {
  const { n_trials, time_limit_ms, levels } = params
  const [results, setResults] = useState<Record<number, boolean>>({})
  const any = levels.some((l) => l.length > 0)
  // No playable level: zero trials, so the loop calls onDone without emitting events.
  const { i, paused, respond } = useTimedTrials(recorder, any ? n_trials : 0, time_limit_ms, onDone, (j, correct) => {
    const p = pickFor(levels, results, j)
    setResults((r) => ({ ...r, [j]: correct }))
    return p ? { hops: p.trial.hops, inverted: p.trial.inverted, level: p.level } : undefined
  })
  const t = any && i < n_trials ? pickFor(levels, results, i)?.trial : undefined

  useEffect(() => {
    if (!t) return
    const onKey = (e: KeyboardEvent) => {
      if (e.repeat || e.ctrlKey || e.metaKey || e.altKey) return
      const v = KEYS[e.key.toLowerCase()]
      if (v !== undefined) respond(v === t.answer)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [t, respond])

  if (!t) return null
  // An inverted trial is flagged in words; the warning border only repeats it (not colour alone).
  return (
    <section aria-label={EXERCISE_NAME.relational} className="flex flex-col items-center gap-4">
      <Card
        className={`flex w-full flex-col gap-2 text-lg text-ink ${!paused && t.inverted ? 'border-warning' : ''}`}
        style={{ minHeight: 160 }}
      >
        {!paused && (
          <>
            {t.inverted && <p className="font-bold">Rule inverted</p>}
            {t.premises.map((p, k) => (
              <Sentence key={k} s={p} />
            ))}
            <Sentence s={t.question} ask />
          </>
        )}
      </Card>
      <div className="flex flex-wrap justify-center gap-3">
        <Button variant="secondary" {...pressProps(() => respond(t.answer))}>
          True (T)
        </Button>
        <Button variant="secondary" {...pressProps(() => respond(!t.answer))}>
          False (F)
        </Button>
      </div>
    </section>
  )
}
