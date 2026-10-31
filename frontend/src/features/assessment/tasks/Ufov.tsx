import { useCallback, useEffect, useRef, useState } from 'react'
import { Button } from '../../../components/ui/Button'
import { Card } from '../../../components/ui/Card'
import { QuestPlus } from '../adaptive/quest'
import { tracker } from '../telemetry/tracker'
import { useInputCapture } from '../telemetry/useInputCapture'
import { pressProps } from '../telemetry/useTimedTrials'
import type { TrialMeta, UfovParams } from '../telemetry/types'
import { defaultRaf, framesFor, measureFrameMs, type Raf } from './frames'
import type { TaskProps } from './TaskRunner'
import { EXERCISE_NAME } from '../exercises'

const FIXATION_MS = 500
const SIZE = 360
const C = SIZE / 2
// ponytail: the target always sits on ring 2; distractor rings 1..3. Add a target ring to the contract if needed.
const RING_PX = [0, 60, 115, 165]
const TARGET_RING = 2
const BLOB_R = 10
const CELL = 10 // mask noise cell size (px)
const DIR_KEYS = ['1', '2', '3', '4', '5', '6', '7', '8']
// Answer pad: a 240 px square of 44 px buttons (the tactile-btn minimum); directions on a 96 px ring.
const PAD = 240
const BTN = 44
const PAD_RING = 96

type Trial = UfovParams['trials'][number]
const isDir = (d: unknown): d is number => Number.isInteger(d) && (d as number) >= 0 && (d as number) <= 7
const valid = (t: Trial | undefined) => !!t && (t.central === 'A' || t.central === 'B') && isDir(t.peripheral_dir)
const nextValid = (trials: Trial[], from: number) => {
  let k = from
  while (k < trials.length && !valid(trials[k])) k++
  return k
}
const clamp01 = (x: number) => (Number.isFinite(x) ? Math.min(1, Math.max(0, x)) : 0)

// Direction 0 is straight up, then clockwise in 45° steps.
const at = (dir: number, r: number, c = C): [number, number] => {
  const a = (dir * Math.PI) / 4 - Math.PI / 2
  return [c + r * Math.cos(a), c + r * Math.sin(a)]
}

// s = 1 is the target (a disc); s = 0 a square; in between, each outline point is interpolated.
function blob(g: CanvasRenderingContext2D, x: number, y: number, s: number) {
  g.beginPath()
  for (let k = 0; k < 16; k++) {
    const a = (k * Math.PI) / 8
    const sq = BLOB_R / Math.max(Math.abs(Math.cos(a)), Math.abs(Math.sin(a)))
    const r = sq + (BLOB_R - sq) * s
    g.lineTo(x + r * Math.cos(a), y + r * Math.sin(a))
  }
  g.closePath()
  g.fill()
}

// Canvas colours come from the theme tokens (no literal colours), read once per trial before the
// fixation so the frame-locked callbacks never touch style.
type Paint = { bg: string; fg: string }
function readPaint(cv: HTMLCanvasElement | null): Paint {
  const s = cv ? getComputedStyle(cv) : null
  return {
    bg: s?.getPropertyValue('--color-surface').trim() ?? '',
    fg: s?.getPropertyValue('--color-ink').trim() ?? '',
  }
}

// jsdom (and a lost context) gives no 2-D context: drawing is skipped, timing still runs.
function paint(cv: HTMLCanvasElement | null, colors: Paint, draw: (g: CanvasRenderingContext2D) => void) {
  const g = cv?.getContext('2d')
  if (!g) return
  g.fillStyle = colors.bg
  g.fillRect(0, 0, SIZE, SIZE)
  g.fillStyle = colors.fg
  draw(g)
}

const fixation = (g: CanvasRenderingContext2D) => {
  g.fillRect(C - 8, C - 1, 16, 2)
  g.fillRect(C - 1, C - 8, 2, 16)
}

const stimulus = (t: Trial, similarity: number) => (g: CanvasRenderingContext2D) => {
  g.font = 'bold 32px sans-serif'
  g.textAlign = 'center'
  g.textBaseline = 'middle'
  g.fillText(t.central, C, C) // validated to "A" or "B"
  for (const d of t.distractors ?? []) {
    if (!isDir(d?.dir) || !Number.isInteger(d.ring) || d.ring < 1 || d.ring > 3) continue
    blob(g, ...at(d.dir, RING_PX[d.ring]!), similarity)
  }
  blob(g, ...at(t.peripheral_dir, RING_PX[TARGET_RING]!), 1)
}

// ponytail: Math.random noise, not seeded from surface_seed; seed it if masks must be reproducible.
const mask = (noise: number) => (g: CanvasRenderingContext2D) => {
  for (let y = 0; y < SIZE; y += CELL) for (let x = 0; x < SIZE; x += CELL) if (Math.random() < noise) g.fillRect(x, y, CELL, CELL)
}

// One answer button centred on (x, y) inside the answer pad.
function Choice({ label, x, y, onPress, children }: { label?: string; x: number; y: number; onPress: () => void; children: string }) {
  return (
    <Button
      variant="secondary"
      size="sm"
      aria-label={label}
      className="absolute"
      style={{ left: x - BTN / 2, top: y - BTN / 2, width: BTN, height: BTN }}
      {...pressProps(onPress)}
    >
      {children}
    </Button>
  )
}

// UFOV divided attention: fixation, then a frame-locked flash (central letter + peripheral target +
// distractors), a noise mask, then two answers (letter and target direction, either order). QUEST+
// picks the duration and is updated with the measured shown_ms. A hidden page aborts the running
// trial (no event, no QUEST update); the next trial starts when visible again.
// ponytail: no time limit in the response phase; add one if sessions stall on unanswered trials.
export function Ufov({ params, recorder, onDone, raf = defaultRaf }: TaskProps<UfovParams> & { raf?: Raf }) {
  const { trials, similarity, mask_noise } = params
  let lastValid = trials.length - 1
  while (lastValid >= 0 && !valid(trials[lastValid])) lastValid--

  const [quest] = useState(() => new QuestPlus(params.duration_grid_ms))
  const [frameMs, setFrameMs] = useState<number | null>(null)
  const [i, setI] = useState(() => nextValid(trials, 0))
  const [paused, setPaused] = useState(false)
  const [responding, setResponding] = useState(false)
  const canvas = useRef<HTMLCanvasElement>(null)
  const live = useRef(false) // response phase of the running trial, accepting answers
  const answers = useRef<{ central?: string; dir?: number }>({})
  const shown = useRef({ requested: 0, frames: 0, shownMs: 0 })
  const done = useRef(false)
  const pausedRef = useRef(false)

  useEffect(() => {
    let off = false
    void measureFrameMs(raf).then((ms) => {
      if (!off) setFrameMs(ms)
    })
    return () => {
      off = true
    }
  }, [raf])

  useEffect(() => {
    if (frameMs === null || paused) return
    if (i >= trials.length) {
      if (!done.current) {
        done.current = true
        onDone()
      }
      return
    }
    const t = trials[i]! // nextValid keeps i on a valid trial
    const requested = quest.next()
    const n = framesFor(requested, frameMs)
    const colors = readPaint(canvas.current)
    let stopped = false
    let k = 0
    let t0 = 0
    paint(canvas.current, colors, fixation)
    const tick = (ts: number) => {
      if (stopped) return
      if (k === 0) {
        paint(canvas.current, colors, stimulus(t, clamp01(similarity)))
        recorder.start(i)
        t0 = ts
      } else if (k === n) {
        paint(canvas.current, colors, mask(clamp01(mask_noise)))
        shown.current = { requested, frames: n, shownMs: ts - t0 }
        answers.current = {}
        live.current = true
        setResponding(true)
        return
      }
      k++
      raf(tick)
    }
    const id = setTimeout(() => raf(tick), FIXATION_MS)
    return () => {
      stopped = true
      clearTimeout(id)
    }
  }, [frameMs, i, paused, trials, similarity, mask_noise, quest, recorder, raf, onDone])

  const answer = (part: 'central' | 'dir', v: string | number) => {
    if (!live.current) return
    const a = answers.current
    if (a[part] !== undefined) return // first answer per part counts
    if (part === 'central') a.central = v as string
    else a.dir = v as number
    if (a.central === undefined || a.dir === undefined) return
    live.current = false
    const t = trials[i]!
    const { requested, frames, shownMs } = shown.current
    const central_ok = a.central === t.central
    const peripheral_ok = a.dir === t.peripheral_dir
    const correct = central_ok && peripheral_ok
    // QuestPlus has no NaN guard, so only a measured, positive duration updates it.
    if (Number.isFinite(shownMs) && shownMs > 0) quest.update(shownMs, correct)
    const meta: TrialMeta = {
      requested_ms: requested,
      shown_ms: shownMs,
      frames,
      similarity: clamp01(similarity),
      mask_noise: clamp01(mask_noise),
      central_ok,
      peripheral_ok,
    }
    // ponytail: if the final valid trial is aborted, no event carries the threshold; it is recomputable
    // from the logged shown_ms and correctness.
    if (i === lastValid) meta.quest_threshold_ms = Math.round(quest.thresholdMs() * 10) / 10
    tracker.push(recorder.finish({ correct, meta }))
    setResponding(false)
    setI(nextValid(trials, i + 1))
  }
  const answerRef = useRef(answer)
  useEffect(() => {
    answerRef.current = answer
  })
  const press = useCallback((part: 'central' | 'dir', v: string | number) => answerRef.current(part, v), [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.repeat || e.ctrlKey || e.metaKey || e.altKey) return
      const k = e.key.toUpperCase()
      if (k === 'A' || k === 'B') press('central', k)
      else if (DIR_KEYS.includes(e.key)) press('dir', Number(e.key) - 1)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [press])

  useEffect(() => {
    const onVis = () => {
      if (document.hidden === pausedRef.current) return
      pausedRef.current = document.hidden
      if (document.hidden) {
        live.current = false
        recorder.abort()
        setResponding(false)
        setPaused(true)
      } else {
        setPaused(false)
        setI((x) => (x >= trials.length ? x : nextValid(trials, x + 1)))
      }
    }
    // Standalone safety net: inside the UI the page unmounts the exercise on hidden first (R3).
    document.addEventListener('visibilitychange', onVis)
    return () => document.removeEventListener('visibilitychange', onVis)
  }, [recorder, trials])

  useInputCapture(recorder, !paused)

  const mid = PAD / 2
  return (
    <section aria-label={EXERCISE_NAME.ufov} className="flex flex-col items-center gap-4">
      <p className="text-ink">Look at the cross. A letter and shapes flash briefly. Then pick the letter in the middle (A or B) and the direction of the round shape (1–8).</p>
      <Card className="flex w-full justify-center">
        {/* Scales down on narrow screens; the drawing buffer stays SIZE × SIZE. */}
        <canvas ref={canvas} width={SIZE} height={SIZE} role="img" aria-label="Briefly flashed display" className="block h-auto max-w-full" />
      </Card>
      {responding && (
        <div role="group" aria-label="Your answer" className="relative" style={{ width: PAD, height: PAD }}>
          {DIR_KEYS.map((label, d) => {
            const [x, y] = at(d, PAD_RING, mid)
            return (
              <Choice key={d} label={`Direction ${label}`} x={x} y={y} onPress={() => press('dir', d)}>
                {label}
              </Choice>
            )
          })}
          <Choice x={mid - BTN / 2 - 4} y={mid} onPress={() => press('central', 'A')}>
            A
          </Choice>
          <Choice x={mid + BTN / 2 + 4} y={mid} onPress={() => press('central', 'B')}>
            B
          </Choice>
        </div>
      )}
    </section>
  )
}
