import { useCallback, useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type ReactNode } from 'react'
import { Loti } from '../../components/features/characters/Loti'
import { Button } from '../../components/ui/Button'
import { introFor, OWN_FIXATION, trialCount, type Intro } from './exercises'
import { tracker } from './telemetry/tracker'
import type { TaskPayload } from './telemetry/types'

export const FIXATION_MS = 500

type Phase = 'intro' | 'fixation' | 'trials' | 'end'

type Props = {
  task: TaskPayload
  // Continue on the end card: the user is ready to move on.
  onDone: () => void
  // The block is over (the end card appears). The host must not pause or replay it from here on.
  onBlockEnd?: () => void
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
      if (e.task_id !== taskId || seen.has(e.trial_index)) return
      seen.add(e.trial_index)
      setDone(seen.size)
    })
  }, [taskId])
  return done
}

// Small dots, n of N. They change only when a trial ends.
// ponytail: one dot per trial, wrapping; a block of 60+ trials would want a bar instead.
function ProgressDots({ done, total }: { done: number; total: number }) {
  const n = Math.min(done, total)
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
          className={`size-2 rounded-pill ${k < n ? 'bg-brand' : 'border border-border-strong'}`}
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

function Instructions({ intro, onBegin }: { intro: Intro; onBegin: () => void }) {
  // Focused Begin: native Space/Enter activate it; the window listener covers an unfocused page.
  const begin = useFocusOnMount<HTMLButtonElement>()
  // A plain div, not a region: the exercise's own region carries the same name.
  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-6 py-8 text-center">
      <div className="space-y-2">
        <h2 className="font-display text-2xl font-bold text-ink">
          {intro.name}
        </h2>
        <p className="text-ink">{intro.line}</p>
      </div>
      {intro.keys.length > 0 && (
        <ul aria-label="Keys" className="flex flex-wrap justify-center gap-x-6 gap-y-2 text-sm text-ink-muted">
          {intro.keys.map((h, k) => (
            <li key={k} className="flex items-center gap-1.5">
              {h.keys.map((key) => (
                <kbd key={key} className={KEYCAP}>
                  {key}
                </kbd>
              ))}
              <span>{h.label}</span>
            </li>
          ))}
        </ul>
      )}
      <div className="flex flex-col items-center gap-2">
        <Button ref={begin} size="lg" onClick={onBegin} onKeyDown={noRepeat}>
          Begin
        </Button>
        <p className="text-sm text-ink-muted">
          or press <kbd className={KEYCAP}>Space</kbd>
        </p>
      </div>
    </div>
  )
}

// The running block: dots and the exercise. Focus moves here (not to <body>) so the exercise's keys
// and Tab start inside it; tabIndex -1 keeps it out of the tab order.
function TrialArea({ done, total, children }: { done: number; total: number; children: ReactNode }) {
  const area = useFocusOnMount<HTMLDivElement>()
  return (
    <div ref={area} tabIndex={-1} className="flex w-full flex-col items-center gap-4 outline-none">
      <ProgressDots done={done} total={total} />
      {children}
    </div>
  )
}

function EndCard({ onContinue }: { onContinue: () => void }) {
  const cont = useFocusOnMount<HTMLButtonElement>()
  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-4 py-8 text-center">
      <Loti pose="happy" size="sm" />
      <p className="font-display text-2xl font-bold text-ink">Nice work</p>
      <Button ref={cont} size="lg" onClick={onContinue} onKeyDown={noRepeat}>
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
export function ExerciseFrame({ task, onDone, onBlockEnd, children }: Props) {
  const intro = introFor(task)
  const [phase, setPhase] = useState<Phase>('intro')
  const done = useTrialsDone(task.task_id)
  const handed = useRef(false)
  const blockEnd = useRef(onBlockEnd)
  useLayoutEffect(() => {
    blockEnd.current = onBlockEnd
  })
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

  useEffect(() => {
    if (phase !== 'fixation') return
    const id = setTimeout(() => setPhase('trials'), FIXATION_MS)
    return () => clearTimeout(id)
  }, [phase])

  useStartKeys(!intro ? null : phase === 'intro' ? begin : phase === 'end' ? finish : null)

  if (!intro) return <>{children(onDone)}</>

  switch (phase) {
    case 'intro':
      return <Instructions intro={intro} onBegin={begin} />
    case 'fixation':
      return (
        <div className="flex min-h-64 items-center justify-center">
          <span role="img" aria-label="Look at the cross" className="select-none text-5xl font-bold text-ink">
            +
          </span>
        </div>
      )
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
