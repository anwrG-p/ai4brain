import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { Button } from '../../../components/ui/Button'
import { Card } from '../../../components/ui/Card'
import { tracker } from '../telemetry/tracker'
import { useInputCapture } from '../telemetry/useInputCapture'
import { pressProps } from '../telemetry/useTimedTrials'
import type { NBackParams, TelemetryEvent } from '../telemetry/types'
import type { TaskProps } from './TaskRunner'
import { EXERCISE_NAME } from '../names'

type Stream = NBackParams['streams'][number]
type Rule = NBackParams['trials'][number]['rule']

const KEYS: Record<string, Stream> = { a: 'position', l: 'symbol' }
const LABEL: Record<Stream, string> = { position: 'Position match (A)', symbol: 'Symbol match (L)' }

const hint = (rule: Rule, n: number) =>
  rule === 'position'
    ? `A = same place as ${n} back`
    : rule === 'symbol'
      ? `L = same symbol as ${n} back`
      : 'L = even number'

// Grid paint: lit vs unlit cell is 4.64:1 (light) / 5.37:1 (dark); the symbol has a halo in the
// unlit colour so it stays readable on a lit centre cell.
const LIT = 'var(--dim-1)'
const UNLIT = 'var(--color-surface-raised)'

// Interference N-back: 3×3 grid position + centre symbol, one event per stream per trial.
// Correctness comes from answer[stream] only; `rule` drives the banner and key hint.
export function NBack({ params, recorder, onDone }: TaskProps<NBackParams>) {
  const [i, setI] = useState(0)
  const [stimOff, setStimOff] = useState(-1) // index of the trial whose stimulus has been hidden
  const [paused, setPaused] = useState(false)
  // First press per stream, in ms since this trial's onset.
  const presses = useRef<Partial<Record<Stream, number>>>({})
  const onset = useRef(0)
  const live = useRef(false) // a trial is running and accepting responses
  const done = useRef(false)
  const pausedRef = useRef(false)

  const trials = params.trials
  const t = trials[Math.min(i, trials.length - 1)]

  useEffect(() => {
    if (paused) return
    const tr = trials[i]
    if (!tr) {
      if (!done.current) {
        done.current = true
        onDone()
      }
      return
    }
    presses.current = {}
    onset.current = performance.now()
    live.current = true
    recorder.start(i)
    const hide = setTimeout(() => setStimOff(i), params.stimulus_ms)
    const end = setTimeout(() => {
      live.current = false
      let first: TelemetryEvent | null = null
      // TrialRecorder.finish closes the trial, so each extra stream re-opens trial i and borrows the
      // input-derived fields (keystroke latency, jitter) from the first stream's event. RT is per stream.
      for (const s of params.streams) {
        if (first) recorder.start(i)
        const rt = presses.current[s]
        const e = recorder.finish({
          correct: (rt !== undefined) === (tr.answer[s] ?? false),
          windowMs: rt ?? params.interval_ms,
          meta: { trial_type: tr.trial_type, rule: tr.rule, stream: s },
        })
        tracker.push(
          first ? { ...e, keystroke_latency_ms: first.keystroke_latency_ms, hesitation_jitter: first.hesitation_jitter } : e,
        )
        first ??= e
      }
      setI(i + 1)
    }, params.interval_ms)
    return () => {
      clearTimeout(hide)
      clearTimeout(end)
    }
  }, [i, paused, params, trials, recorder, onDone])

  const respond = useCallback(
    (s: Stream) => {
      if (!live.current || !params.streams.includes(s) || presses.current[s] !== undefined) return
      presses.current[s] = performance.now() - onset.current
    },
    [params.streams],
  )

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.repeat || e.ctrlKey || e.metaKey || e.altKey) return
      const s = KEYS[e.key.toLowerCase()]
      if (s) respond(s)
    }
    // Hidden page: drop the current trial; resume at the next one when visible again.
    const onVis = () => {
      if (document.hidden) {
        if (pausedRef.current) return
        pausedRef.current = true
        live.current = false
        recorder.abort()
        setPaused(true)
      } else {
        if (!pausedRef.current) return
        pausedRef.current = false
        setPaused(false)
        setI((x) => x + 1)
      }
    }
    window.addEventListener('keydown', onKey)
    // Standalone safety net: inside the UI the page unmounts the exercise on hidden first (R3).
    document.addEventListener('visibilitychange', onVis)
    return () => {
      window.removeEventListener('keydown', onKey)
      document.removeEventListener('visibilitychange', onVis)
    }
  }, [recorder, respond])

  // recorder.input() is a no-op between trials and after an abort, so only the pause gates it.
  useInputCapture(recorder, !paused)

  if (!t) return null // no trials: the effect has already called onDone
  const showStim = stimOff !== i && !paused && i < trials.length
  return (
    <section aria-label={EXERCISE_NAME.n_back} className="flex flex-col items-center gap-4">
      {t.trial_type === 'switch' && !paused && i < trials.length && (
        <p role="status" className="font-bold text-ink">
          New rule: {hint(t.rule, params.n)}
        </p>
      )}
      <p className="text-ink">{hint(t.rule, params.n)}</p>
      <Card className="flex justify-center">
        <svg viewBox="0 0 3 3" width={240} height={240} role="img" aria-label="grid" className="text-ink">
          {[0, 1, 2].flatMap((r) =>
            [0, 1, 2].map((c) => (
              <rect
                key={`${r}${c}`}
                x={c + 0.05}
                y={r + 0.05}
                width={0.9}
                height={0.9}
                rx={0.06}
                fill={showStim && t.pos?.[0] === r && t.pos?.[1] === c ? LIT : UNLIT}
                stroke="var(--color-border-strong)"
                strokeWidth={0.02}
              />
            )),
          )}
          {showStim && t.symbol !== null && (
            <text
              x={1.5}
              y={1.5}
              textAnchor="middle"
              dominantBaseline="central"
              fontSize={0.6}
              fill="currentColor"
              stroke={UNLIT}
              strokeWidth={0.08}
              paintOrder="stroke"
            >
              {t.symbol}
            </text>
          )}
        </svg>
      </Card>
      <div className="flex flex-wrap justify-center gap-3">
        {params.streams.map((s) => (
          <PressButton key={s} onPress={() => respond(s)}>
            {LABEL[s]}
          </PressButton>
        ))}
      </div>
    </section>
  )
}

// respond() reads refs, so it is handed over as a prop (an event handler) rather than passed to
// pressProps during NBack's render.
function PressButton({ onPress, children }: { onPress: () => void; children: ReactNode }) {
  return (
    <Button variant="secondary" {...pressProps(onPress)}>
      {children}
    </Button>
  )
}
