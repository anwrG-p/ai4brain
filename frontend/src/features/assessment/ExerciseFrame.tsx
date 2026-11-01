import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
} from 'react'
import { ChevronDown } from 'lucide-react'
import { Loti } from '../../components/features/characters/Loti'
import { useCharacterMotion } from '../../components/features/characters/shared'
import { Button } from '../../components/ui/Button'
import { PILLAR_LABELS } from '../insights/pillars'
import { ExerciseDemo } from './ExerciseDemo'
import { stepParts } from './howToPlay'
import { countsAsProgress, introFor, OWN_FIXATION, trialCount, type Intro } from './exercises'
import { StimulusCard, usesLightPlate } from './tasks/Stroop'
import { tracker } from './telemetry/tracker'
import type { NBackParams, SchemaType, StroopParams, TaskPayload } from './telemetry/types'

export const FIXATION_MS = 500

type Phase = 'intro' | 'fixation' | 'trials' | 'end'

type Props = {
  task: TaskPayload
  // Continue on the end card: the user is ready to move on.
  onDone: () => void
  // The block is over (the end card appears). The host must not pause or replay it from here on.
  onBlockEnd?: () => void
  // The block has started (Begin, or at once for a bare exercise): a host shows Pause from here on.
  onBlockStart?: () => void
  // Renders the exercise, which calls `end` once its block is over. `end` keeps its identity, so a
  // frame re-render never restarts the exercise's trial loop (it restarts when onDone changes).
  children: (end: () => void) => ReactNode
}

const KEYCAP =
  'inline-flex min-w-7 justify-center rounded-sm border border-border-strong bg-surface px-1.5 py-0.5 font-sans text-sm font-semibold text-ink'

// A key on a focused control belongs to that control (Exit, Pause, the Begin button itself).
const CONTROL = 'a[href], button, input, select, textarea, summary, [role="button"], [contenteditable="true"]'

// Space or Enter runs `act` (a held key does not). Null while the screen takes no key.
function useStartKeys(act: (() => void) | null) {
  useEffect(() => {
    if (!act) return
    const onKey = (e: KeyboardEvent) => {
      if (e.repeat || e.ctrlKey || e.metaKey || e.altKey || (e.key !== ' ' && e.key !== 'Enter')) return
      if (e.target instanceof Element && e.target.closest(CONTROL)) return
      e.preventDefault() // no page scroll on Space
      act()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [act])
}

// Trials finished in this task, from the tracker's own event stream (an N-back trial emits one event
// per stream, so trials are counted by index). Read-only: the frame never touches the recorder.
function useTrialsDone(taskId: string) {
  const [done, setDone] = useState(0)
  useEffect(() => {
    const seen = new Set<number>()
    return tracker.onEvent((e) => {
      if (e.task_id !== taskId || seen.has(e.trial_index) || !countsAsProgress(e)) return
      seen.add(e.trial_index)
      setDone(seen.size)
    })
  }, [taskId])
  return done
}

// Small dots, n of N. They change only when a trial ends; a dot pops once as it fills (the only
// motion near a running trial, spec R8). A block longer than MAX_DOTS (Stop Light's 200 trials) shows
// one thin bar instead, so the dots never push the stimulus down; it steps without motion.
export const MAX_DOTS = 40
function ProgressDots({ done, total }: { done: number; total: number }) {
  const n = Math.min(done, total)
  if (total > MAX_DOTS)
    return (
      <div
        role="progressbar"
        aria-label="Progress"
        aria-valuemin={0}
        aria-valuemax={total}
        aria-valuenow={n}
        aria-valuetext={`${n} of ${total} done`}
        className="h-2 w-full max-w-xs overflow-hidden rounded-pill border border-border-strong"
      >
        <div data-bar-fill className="h-full bg-brand" style={{ width: `${(100 * n) / total}%` }} />
      </div>
    )
  return (
    <div
      role="progressbar"
      aria-label="Progress"
      aria-valuemin={0}
      aria-valuemax={total}
      aria-valuenow={n}
      aria-valuetext={`${n} of ${total} done`}
      className="flex max-w-xs flex-wrap justify-center gap-1.5"
    >
      {Array.from({ length: total }, (_, k) => (
        <span
          key={k}
          data-dot={k < n ? 'done' : 'todo'}
          className={`size-2 rounded-pill ${k < n ? 'anim-dot-pop bg-brand' : 'border border-border-strong'}`}
        />
      ))}
    </div>
  )
}

// Moves focus to the element once it mounts, so keyboard and screen-reader users land on each screen.
function useFocusOnMount<T extends HTMLElement>() {
  const ref = useRef<T>(null)
  useEffect(() => ref.current?.focus(), [])
  return ref
}

// A held Enter clicks a focused button again on every repeat; it must not skip the end card.
const noRepeat = (e: ReactKeyboardEvent<HTMLButtonElement>) => e.repeat && e.preventDefault()

// A step's text with its keys as keycaps ("press [A]"). When the step ends on a keycap, its last word,
// the keycap(s) and the closing punctuation stay on one line, so a keycap never wraps alone at 375 px.
function Step({ text }: { text: string }) {
  const cut = text.search(/\S+\s+\S*\[[^\]]+\]\S*$/)
  if (cut < 0) return <Keycaps text={text} />
  return (
    <>
      <Keycaps text={text.slice(0, cut)} />
      <span data-nowrap className="whitespace-nowrap">
        <Keycaps text={text.slice(cut)} />
      </span>
    </>
  )
}

function Keycaps({ text }: { text: string }) {
  return stepParts(text).map((part, k) =>
    typeof part === 'string' ? (
      part
    ) : (
      <kbd key={k} className={KEYCAP}>
        {part.key}
      </kbd>
    ),
  )
}

// The instruction screen (INT-1 item 13: "add some explanation to the games", kept short): the name
// and its line; how to play in 2-3 numbered steps; the demo with a caption; the pillar it trains; one
// closed "More about this". The copy is in howToPlay.ts. Begin is the only button.
function Instructions({ schema, intro, n, onBegin }: { schema: SchemaType; intro: Intro; n?: number; onBegin: () => void }) {
  // Focused Begin: native Space/Enter activate it; the window listener covers an unfocused page.
  const begin = useFocusOnMount<HTMLButtonElement>()
  // A plain div, not a region: the exercise's own region carries the same name. Each exercise opens
  // here, so its slide-in from the right is also the move from one exercise to the next.
  return (
    <div className="anim-slide-in mx-auto flex max-w-md flex-col items-center gap-3 py-2 text-center">
      <div className="space-y-1">
        <h2 className="font-display text-2xl font-bold text-ink">{intro.name}</h2>
        <p className="text-ink">{intro.line}</p>
      </div>
      <ol aria-label="How to play" className="m-0 flex list-decimal flex-col gap-1 pl-6 text-left text-ink marker:text-ink-muted">
        {intro.steps.map((step) => (
          <li key={step}>
            <Step text={step} />
          </li>
        ))}
      </ol>
      {/* The example: decorative, as the steps already say it. */}
      <div aria-hidden="true" className="flex flex-col items-center gap-1">
        <ExerciseDemo schema={schema} n={n} />
        <p data-demo-caption className="text-sm text-ink-muted">
          {intro.caption}
        </p>
      </div>
      <p className="rounded-pill border border-border px-2.5 py-0.5 text-xs text-ink-muted">Trains: {PILLAR_LABELS[intro.pillar]}</p>
      <details className="group w-full text-sm text-ink-muted">
        <summary className="focus-ring mx-auto flex min-h-11 w-fit cursor-pointer list-none items-center gap-1 rounded-md px-2 [&::-webkit-details-marker]:hidden">
          More about this
          <ChevronDown aria-hidden="true" size={16} strokeWidth={1.75} className="group-open:rotate-180" />
        </summary>
        {intro.more.map((line) => (
          <p key={line}>{line}</p>
        ))}
      </details>
      <div className="flex flex-col items-center gap-2">
        <Button ref={begin} size="lg" className="anim-press" onClick={onBegin} onKeyDown={noRepeat}>
          Begin
        </Button>
        <p className="text-sm text-ink-muted">
          or press <kbd className={KEYCAP}>Space</kbd>
        </p>
      </div>
    </div>
  )
}

// The exercise under the motion lock: tokens.css stops every animation and transition inside
// [data-timed-trial] (only an answer button's press survives). It wraps the exercise alone, so the
// frame's own screens and the dots can move. Nothing here animates in: the first stimulus shows at once.
function Locked({ children }: { children: ReactNode }) {
  return (
    <div data-timed-trial="true" className="flex w-full min-w-0 flex-col items-center">
      {children}
    </div>
  )
}

// The running block: dots and the exercise. Focus moves here (not to <body>) so the exercise's keys
// and Tab start inside it; tabIndex -1 keeps it out of the tab order.
// [data-block-running] (here and on the fixation) tells a host the block has started: from Begin
// until the end card, a pause must discard it (BaselinePage).
function TrialArea({ done, total, children }: { done: number; total: number; children: ReactNode }) {
  const area = useFocusOnMount<HTMLDivElement>()
  return (
    <div ref={area} tabIndex={-1} data-block-running="true" className="flex w-full flex-col items-center gap-4 outline-none">
      <ProgressDots done={done} total={total} />
      <Locked>{children}</Locked>
    </div>
  )
}

// One burst of sparkles around Loti, played once (they rest hidden). Character colours, decorative.
const SPARKLES: [number, number, string][] = [
  [-30, -20, 'var(--char-sky)'],
  [0, -34, 'var(--char-coral)'],
  [30, -20, 'var(--char-amber)'],
  [36, 8, 'var(--char-sky)'],
  [22, 30, 'var(--char-coral)'],
  [-22, 30, 'var(--char-amber)'],
  [-36, 8, 'var(--char-coral)'],
]

function Burst() {
  return (
    <svg data-burst aria-hidden="true" viewBox="-48 -48 96 96" width={96} height={96} className="pointer-events-none absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 overflow-visible">
      {SPARKLES.map(([x, y, fill], k) => (
        <circle key={k} cx={0} cy={0} r={3} fill={fill} className="anim-sparkle" style={{ '--sx': `${x}px`, '--sy': `${y}px` } as CSSProperties} />
      ))}
    </svg>
  )
}

function EndCard({ onContinue }: { onContinue: () => void }) {
  const cont = useFocusOnMount<HTMLButtonElement>()
  const motion = useCharacterMotion()
  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-4 py-8 text-center">
      <div className="anim-pop relative">
        <Loti pose="happy" size="sm" />
        {motion && <Burst />}
      </div>
      <p className="font-display text-2xl font-bold text-ink">Nice work</p>
      <Button ref={cont} size="lg" className="anim-press" onClick={onContinue} onKeyDown={noRepeat}>
        Continue
      </Button>
    </div>
  )
}

// jsPsych-style screens around one exercise block: instruction → fixation (500 ms) → trials with
// progress dots → end card. The exercise mounts only when the trials start, so no trial starts and
// no event is recorded on the instruction or fixation screens; its timing and telemetry are its own.
// UFOV skips the fixation here (it draws one before every trial). An unknown schema runs bare.
// The block ends on the end card: onBlockEnd fires then, onDone only on Continue.
export function ExerciseFrame({ task, onDone, onBlockEnd, onBlockStart, children }: Props) {
  const intro = introFor(task)
  const [phase, setPhase] = useState<Phase>('intro')
  const done = useTrialsDone(task.task_id)
  const handed = useRef(false)
  const blockEnd = useRef(onBlockEnd)
  const blockStart = useRef(onBlockStart)
  useLayoutEffect(() => {
    blockEnd.current = onBlockEnd
    blockStart.current = onBlockStart
  })
  const started = !intro || phase !== 'intro'
  useEffect(() => {
    if (started) blockStart.current?.()
  }, [started])
  const ownFixation = OWN_FIXATION.has(task.schema_type)

  const begin = useCallback(
    () => setPhase((p) => (p === 'intro' ? (ownFixation ? 'trials' : 'fixation') : p)),
    [ownFixation],
  )
  const end = useCallback(() => {
    setPhase('end')
    blockEnd.current?.()
  }, [])
  const finish = useCallback(() => {
    if (handed.current) return
    handed.current = true
    onDone()
  }, [onDone])
  // Bare (no intro, so no end card): the block ends and hands over at once, onBlockEnd first, so a
  // host that saves on block end (TaskRunnerPage) still saves the run. Once only, like finish.
  const endBare = useCallback(() => {
    if (handed.current) return
    blockEnd.current?.()
    finish()
  }, [finish])

  useEffect(() => {
    if (phase !== 'fixation') return
    const id = setTimeout(() => setPhase('trials'), FIXATION_MS)
    return () => clearTimeout(id)
  }, [phase])

  useStartKeys(!intro ? null : phase === 'intro' ? begin : phase === 'end' ? finish : null)

  if (!intro)
    return (
      <div data-block-running="true" className="contents">
        <Locked>{children(endBare)}</Locked>
      </div>
    )

  switch (phase) {
    case 'intro':
      return (
        <Instructions
          schema={task.schema_type}
          intro={intro}
          n={task.schema_type === 'n_back' ? (task.params as NBackParams).n : undefined}
          onBegin={begin}
        />
      )
    case 'fixation': {
      // R9: the cross appears at once, at full contrast for all of its 500 ms (jsPsych convention).
      const cross = (
        <span role="img" aria-label="Look at the cross" className="select-none text-5xl font-bold text-ink">
          +
        </span>
      )
      // A Color Clash block on the light plate shows its cross on that plate too (no luminance jump).
      if (task.schema_type === 'stroop' && usesLightPlate((task.params as StroopParams).colors))
        return (
          <div data-block-running="true" className="flex min-h-64 w-full items-center justify-center">
            <StimulusCard plate>{cross}</StimulusCard>
          </div>
        )
      return (
        <div data-block-running="true" className="flex min-h-64 items-center justify-center">
          {cross}
        </div>
      )
    }
    case 'trials':
      // No character and no decoration here: only the dots and the stimulus.
      return (
        <TrialArea done={done} total={trialCount(task)}>
          {children(end)}
        </TrialArea>
      )
    case 'end':
      return <EndCard onContinue={finish} />
  }
}
