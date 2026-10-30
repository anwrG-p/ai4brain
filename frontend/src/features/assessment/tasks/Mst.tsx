import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { Button } from '../../../components/ui/Button'
import { Card } from '../../../components/ui/Card'
import type { TrialRecorder } from '../telemetry/tracker'
import { pressProps, useTimedTrials } from '../telemetry/useTimedTrials'
import type { MstParams, Poly } from '../telemetry/types'
import { PolyView } from './svg'
import type { TaskProps } from './TaskRunner'

type Response = 'old' | 'similar' | 'new'
const EXPECTED = { old: 'old', lure: 'similar', new: 'new' } as const
const KEYS: Record<string, Response> = { '1': 'old', '2': 'similar', '3': 'new' }
// ponytail: the mst contract has no time_limit_ms, so test trials use a fixed limit; add one to the
// contract if Member 5 wants control.
const TEST_MS = 5000

// The shape surface: same size in both phases, so the layout does not jump. Strokes are currentColor,
// i.e. the Card's ink on its surface.
function Stage({ children }: { children?: ReactNode }) {
  return (
    <Card className="flex w-full items-center justify-center text-ink" style={{ minHeight: 208 }}>
      {children}
    </Card>
  )
}

// Encoding: each item for `ms`, one after another, with no responses and no events. A hidden page
// pauses the current item's timer; it resumes with the time left once visible.
function Encoding({ items, ms, onEnd }: { items: Poly[]; ms: number; onEnd: () => void }) {
  const [k, setK] = useState(0)
  const [hidden, setHidden] = useState(document.hidden)
  const left = useRef(ms)

  useEffect(() => {
    const onVis = () => setHidden(document.hidden)
    document.addEventListener('visibilitychange', onVis)
    return () => document.removeEventListener('visibilitychange', onVis)
  }, [])

  useEffect(() => {
    if (hidden) return
    if (k >= items.length) {
      onEnd()
      return
    }
    const t0 = Date.now()
    let fired = false
    const id = setTimeout(() => {
      fired = true
      left.current = ms
      setK(k + 1)
    }, left.current)
    return () => {
      clearTimeout(id)
      if (!fired) left.current = Math.max(0, left.current - (Date.now() - t0))
    }
  }, [k, hidden, ms, items.length, onEnd])

  const item = items[k]
  if (!item) return null
  return (
    <>
      <p className="text-ink">{`Study: item ${k + 1} of ${items.length}`}</p>
      <Stage>{!hidden && <PolyView poly={item} label="Study shape" />}</Stage>
    </>
  )
}

// Test: one timed trial per item; the expected answer is old → Old, lure → Similar, new → New.
function Test({ test, recorder, onDone }: { test: MstParams['test']; recorder: TrialRecorder; onDone: () => void }) {
  const { i, paused, respond } = useTimedTrials(recorder, test.length, TEST_MS, onDone, (j) => {
    const x = test[j]
    return x && { kind: x.kind, delta: x.delta, response: 'none' } // a response overrides this via respond's extra meta
  })
  const t = test[i]

  const answer = useCallback(
    (r: Response) => {
      if (t) respond(EXPECTED[t.kind] === r, { response: r })
    },
    [t, respond],
  )

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.repeat || e.ctrlKey || e.metaKey || e.altKey) return
      const r = KEYS[e.key]
      if (r) answer(r)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [answer])

  if (!t) return null
  return (
    <>
      <p className="text-ink">Have you seen this exact shape? Old (1), Similar (2) or New (3).</p>
      <Stage>{!paused && <PolyView poly={t.item} label="Test shape" />}</Stage>
      <div className="flex flex-wrap justify-center gap-3">
        <Button variant="secondary" {...pressProps(() => answer('old'))}>
          Old (1)
        </Button>
        <Button variant="secondary" {...pressProps(() => answer('similar'))}>
          Similar (2)
        </Button>
        <Button variant="secondary" {...pressProps(() => answer('new'))}>
          New (3)
        </Button>
      </div>
    </>
  )
}

// Mnemonic similarity: study the encode items, then judge each test item as old, similar (a lure) or new.
// No staircase: the tuning curve needs the generator's spread of `delta` values.
export function Mst({ params, recorder, onDone }: TaskProps<MstParams>) {
  const [testing, setTesting] = useState(false)
  const startTest = useCallback(() => setTesting(true), [])
  return (
    <section aria-label="Shape memory" className="flex flex-col items-center gap-4">
      {testing ? (
        <Test test={params.test} recorder={recorder} onDone={onDone} />
      ) : (
        <Encoding items={params.encode} ms={params.encode_ms} onEnd={startTest} />
      )}
    </section>
  )
}
