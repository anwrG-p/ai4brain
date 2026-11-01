import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Card } from '../../../components/ui/Card'
import type { TrialRecorder } from '../telemetry/tracker'
import type { PalParams } from '../telemetry/types'
import { pressProps, useTimedTrials } from '../telemetry/useTimedTrials'
import type { TaskProps } from './TaskRunner'
import { EXERCISE_NAME } from '../names'

type Stage = PalParams['stages'][number]

/* The fixture's design (fixtures.json, mock-pal-1), simplified from CANTAB Paired Associates Learning
   (Sahakian et al. 1988, Brain 111:695-718; the 8-box "PAL 2-8" stages of 2, 4, 6 and 8 patterns,
   20 in all, whose first-attempt memory score is out of 20: Barnett et al. 2016, J Int Neuropsychol
   Soc 22:5). CANTAB allows up to 10 attempts per stage; 3 here keep a failing run short.
   Simplified: only the boxes with a pattern open while studying, each for study_ms (2 s). */
export const PAL_DESIGN = { stages: [2, 4, 6, 8], boxes: 8, maxAttempts: 3, studyMs: 2000 } as const

// Eight patterns told apart by shape alone (never by colour): circle, square, triangle, diamond,
// star, plus, ring, hexagon. A graphic in brand-vivid (>= 3:1 on the surface).
const FILL = 'var(--color-brand-vivid)'
const PATTERNS: ReactNode[] = [
  <circle cx={20} cy={20} r={13} fill={FILL} />,
  <rect x={8} y={8} width={24} height={24} rx={3} fill={FILL} />,
  <path d="M20 6 L34 32 H6 Z" fill={FILL} strokeLinejoin="round" />,
  <path d="M20 4 L35 20 L20 36 L5 20 Z" fill={FILL} />,
  <path d="M20 4 L24.7 14.5 L36 15.5 L27.5 23 L30 34.5 L20 28.5 L10 34.5 L12.5 23 L4 15.5 L15.3 14.5 Z" fill={FILL} />,
  <path d="M15 5 H25 V15 H35 V25 H25 V35 H15 V25 H5 V15 H15 Z" fill={FILL} />,
  <circle cx={20} cy={20} r={11} fill="none" stroke={FILL} strokeWidth={6} />,
  <path d="M12 6 H28 L36 20 L28 34 H12 L4 20 Z" fill={FILL} />,
]

export function Pattern({ id, size = 40 }: { id: number; size?: number }) {
  return (
    <svg data-pattern={id} viewBox="0 0 40 40" width={size} height={size} aria-hidden="true">
      {PATTERNS[id % PATTERNS.length]}
    </svg>
  )
}

// Number keys 1..boxes pick a box, as the numbers on the boxes show.
export const boxForKey = (key: string, boxes: number): number | null => {
  const n = Number(key)
  return /^[1-9]$/.test(key) && n <= boxes ? n - 1 : null
}

const BOX = 'relative flex size-16 items-center justify-center rounded-lg border-2 border-border-strong'

function Grid({ boxes, children }: { boxes: number; children: (box: number) => ReactNode }) {
  return <div className="grid grid-cols-4 gap-3">{Array.from({ length: boxes }, (_, b) => children(b))}</div>
}

const BoxNumber = ({ box }: { box: number }) => (
  <span aria-hidden="true" className="absolute top-0.5 left-1.5 text-xs text-ink-muted">
    {box + 1}
  </span>
)

// Study: each pattern opens in its box for `ms`, one after another; no answers, no events. A hidden
// page pauses the current box's timer; it resumes with the time left once visible (like Mst).
function Study({ stage, boxes, ms, again, onEnd }: { stage: Stage; boxes: number; ms: number; again: boolean; onEnd: () => void }) {
  const [k, setK] = useState(0)
  const [hidden, setHidden] = useState(document.hidden)
  const left = useRef(ms)

  useEffect(() => {
    const onVis = () => setHidden(document.hidden)
    // Standalone safety net: inside the UI the page unmounts the exercise on hidden first (R3).
    document.addEventListener('visibilitychange', onVis)
    return () => document.removeEventListener('visibilitychange', onVis)
  }, [])

  useEffect(() => {
    if (hidden) return
    if (k >= stage.items.length) {
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
  }, [k, hidden, ms, stage.items.length, onEnd])

  const open = hidden ? undefined : stage.items[k]
  return (
    <>
      <p className="text-ink">{again ? 'Once more: watch the boxes' : 'Watch the boxes'}</p>
      <Card className="flex w-full max-w-sm items-center justify-center" style={{ minHeight: 72 }}>
        <span className="text-sm text-ink-muted">{`Shape ${Math.min(k + 1, stage.items.length)} of ${stage.items.length}`}</span>
      </Card>
      <Grid boxes={boxes}>
        {(b) => (
          <div key={b} data-box={b} data-open={open?.box === b || undefined} className={`${BOX} ${open?.box === b ? 'bg-surface-raised' : 'bg-surface'}`}>
            <BoxNumber box={b} />
            {open?.box === b && <Pattern id={open.pattern} />}
          </div>
        )}
      </Grid>
    </>
  )
}

/* Each recorder call shifted by `offset`: useTimedTrials counts from 0 in every recall, while the
   task's trial_index (and so item_id) must stay unique across stages and attempts. Every call is
   forwarded, so the error burst and the open trial stay the real recorder's. */
function shifted(recorder: TrialRecorder, offset: number): TrialRecorder {
  const view: Pick<TrialRecorder, 'start' | 'input' | 'finish' | 'abort'> = {
    start: (k) => recorder.start(offset + k),
    input: (kind) => recorder.input(kind),
    finish: (r) => recorder.finish(r),
    abort: () => recorder.abort(),
  }
  return view as unknown as TrialRecorder // ponytail: a structural view; the class has private fields
}

// Recall: one timed trial per pattern in `recall` order; right when the chosen box is its box.
function Recall({
  stage,
  params,
  attempt,
  total,
  recorder,
  onEnd,
}: {
  stage: Stage
  params: PalParams
  attempt: number
  total: number
  recorder: TrialRecorder
  onEnd: (allRight: boolean) => void
}) {
  const wrong = useRef(0)
  const order = stage.recall
  const onFinish = useCallback(
    (j: number, correct: boolean) => {
      const item = stage.items[order[j] ?? -1]
      if (!item) return undefined
      if (!correct) wrong.current++
      return {
        pal_level: stage.items.length,
        attempt,
        pattern: item.pattern,
        box: item.box,
        chosen: -1, // a choice overrides this through respond's extra meta
        pal_total: total,
        boxes: params.boxes,
      }
    },
    [stage, order, attempt, total, params.boxes],
  )
  // A stable onDone: useTimedTrials restarts its trial when it changes.
  const onEndRef = useRef(onEnd)
  useLayoutEffect(() => {
    onEndRef.current = onEnd
  })
  const done = useCallback(() => onEndRef.current(wrong.current === 0), [])
  const { i, paused, respond } = useTimedTrials(recorder, order.length, params.time_limit_ms, done, onFinish)
  const item = stage.items[order[i] ?? -1]

  const choose = useCallback(
    (box: number) => {
      if (item) respond(box === item.box, { chosen: box })
    },
    [item, respond],
  )

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.repeat || e.ctrlKey || e.metaKey || e.altKey) return
      const box = boxForKey(e.key, params.boxes)
      if (box !== null) choose(box)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [choose, params.boxes])

  if (!item) return null
  return (
    <>
      <p className="text-ink">Which box held this shape?</p>
      <Card className="flex w-full max-w-sm items-center justify-center" style={{ minHeight: 72 }}>
        {!paused && <Pattern id={item.pattern} size={48} />}
      </Card>
      <Grid boxes={params.boxes}>
        {(b) => (
          <BoxButton key={b} box={b} onPress={() => choose(b)} />
        )}
      </Grid>
    </>
  )
}

// choose() reads the current item, so it is handed over as a prop (an event handler), as in NBack.
function BoxButton({ box, onPress }: { box: number; onPress: () => void }) {
  return (
    <button type="button" aria-label={`Box ${box + 1}`} data-box={box} className={`${BOX} tactile-btn focus-ring bg-surface`} {...pressProps(onPress)}>
      <BoxNumber box={box} />
    </button>
  )
}

// Pair Finder: study where each shape is, then find its box. Stages grow (2, 4, 6, 8 shapes); a stage
// with a wrong box is studied again, up to max_attempts; failing the last attempt ends the task.
export function PairedAssociates({ params, recorder, onDone }: TaskProps<PalParams>) {
  const [at, setAt] = useState({ stage: 0, attempt: 1, recall: false, offset: 0 })
  const total = useMemo(() => params.stages.reduce((n, s) => n + s.items.length, 0), [params.stages])
  const stage = params.stages[at.stage]
  const view = useMemo(() => shifted(recorder, at.offset), [recorder, at.offset])
  const ended = useRef(false)

  const end = useCallback(() => {
    if (ended.current) return
    ended.current = true
    onDone()
  }, [onDone])

  useEffect(() => {
    if (!stage) end() // no stages: nothing to play
  }, [stage, end])

  const toRecall = useCallback(() => setAt((a) => ({ ...a, recall: true })), [])
  const afterRecall = useCallback(
    (allRight: boolean) => {
      const s = params.stages[at.stage]
      const offset = at.offset + (s?.recall.length ?? 0)
      if (allRight) {
        if (at.stage + 1 >= params.stages.length) return end()
        setAt({ stage: at.stage + 1, attempt: 1, recall: false, offset })
      } else if (at.attempt < params.max_attempts) setAt({ ...at, attempt: at.attempt + 1, recall: false, offset })
      else end()
    },
    [params, at, end],
  )

  if (!stage) return null
  const key = `${at.stage}.${at.attempt}`
  return (
    <section aria-label={EXERCISE_NAME.pal} className="flex w-full flex-col items-center gap-4">
      {at.recall ? (
        <Recall key={key} stage={stage} params={params} attempt={at.attempt} total={total} recorder={view} onEnd={afterRecall} />
      ) : (
        <Study key={key} stage={stage} boxes={params.boxes} ms={params.study_ms} again={at.attempt > 1} onEnd={toRecall} />
      )}
    </section>
  )
}
