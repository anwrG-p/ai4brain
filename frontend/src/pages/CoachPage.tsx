import { useEffect, useId, useRef, useState } from 'react'
import { RotateCcw } from 'lucide-react'
import { Loti } from '../components/features/characters'
import { useCharacterMotion } from '../components/features/characters/shared'
import { Button } from '../components/ui/Button'
import { TALK_MS } from '../features/loti/LotiBubbles'
import { coachBrain, type CoachBrain } from '../features/loti/coachAdapter'
import { useLotiContext } from '../features/loti/lotiContext'
import { nextTurnId, useLotiSession } from '../features/loti/lotiSession'
import { useLotiActions } from '../features/loti/useLotiActions'
import type { LotiChoice } from '../features/loti/types'

/* /coach: the whole talk with Loti in one column. Loti's bubbles on the left, the user's picks on the
   right, the open question's chips at the bottom. The talk lives in the session (lotiSession), so a
   talk started on another page's Loti bubble continues here, and leaving and coming back resumes it.
   The brain goes through the coach adapter, which today answers from the script (no network); the
   one-line disclosure shows only when its LLM path is on.
   Escape does nothing here: the only control that clears anything is "Start over". */
export default function CoachPage({ brain = coachBrain }: { brain?: CoachBrain }) {
  const context = useLotiContext()
  const run = useLotiActions()
  const motion = useCharacterMotion()
  const { turns, current, begin, record, clear } = useLotiSession()
  const [talking, setTalking] = useState(true)
  const focusNext = useRef<'chips' | 'log' | null>(null)
  const chipsRef = useRef<HTMLDivElement>(null)
  const logRef = useRef<HTMLDivElement>(null)
  const questionId = useId()
  // The id the next turn gets: it only grows, so it marks each new bubble even once the history is trimmed.
  const beat = nextTurnId(turns)

  // No open question (first visit, or the last talk ended): Loti opens a new one below the history.
  useEffect(() => {
    if (useLotiSession.getState().current) return
    const opening = brain.opening(context)
    if (opening) begin(opening)
  }, [brain, context, begin])

  // Loti's talk pose plays as each new bubble enters, then settles into the bubble's pose.
  useEffect(() => {
    setTalking(true)
    const t = window.setTimeout(() => setTalking(false), TALK_MS)
    return () => window.clearTimeout(t)
  }, [beat])

  useEffect(() => {
    if (focusNext.current === 'chips') chipsRef.current?.querySelector('button')?.focus()
    if (focusNext.current === 'log') logRef.current?.focus()
    focusNext.current = null
  }, [turns, current])

  const pick = (choice: LotiChoice) => {
    if (!current) return
    const next = brain.respond(current.id, choice.id, context)
    record(current, choice, next)
    focusNext.current = next && next.choices.length > 0 ? 'chips' : 'log'
    if (choice.action && choice.action.kind !== 'reply') run(choice.action)
  }

  const startOver = () => {
    clear()
    const opening = brain.opening(context)
    if (opening) begin(opening)
    focusNext.current = 'chips'
  }

  const enter = motion ? 'anim-bubble' : ''

  return (
    <div className="mx-auto flex max-w-xl flex-col gap-6 pt-4 pb-12">
      <div className="flex items-center gap-4">
        <Loti key={beat} size="md" pose={talking ? 'talk' : (current?.pose ?? 'idle')} alive={motion} className="shrink-0" />
        <div>
          <h1 className="font-display text-2xl font-bold text-ink sm:text-3xl">Talk with Loti</h1>
          {brain.enabled && <p className="mt-1 text-sm text-ink-muted">Loti is an AI guide, not a doctor.</p>}
        </div>
      </div>

      <div
        ref={logRef}
        role="log"
        aria-live="polite"
        aria-label="Your talk with Loti"
        tabIndex={-1}
        className="focus-ring flex flex-col gap-3 rounded-md"
      >
        {/* One keyed list: the open bubble has the key and markup it keeps once answered (the next turn id),
            so React keeps the node and the log does not announce the question again. */}
        {[
          ...turns.map((turn) =>
            turn.from === 'loti' ? (
              <LotiLine key={turn.n} text={turn.text} />
            ) : (
              <div key={turn.n} data-from="you" className="flex justify-end">
                <p className="max-w-md rounded-xl rounded-tr-sm bg-brand-subtle px-4 py-2 text-base text-ink">
                  <span className="sr-only">You: </span>
                  <span>{turn.text}</span>
                </p>
              </div>
            ),
          ),
          ...(current ? [<LotiLine key={beat} text={current.text} textId={questionId} className={enter} />] : []),
        ]}
      </div>

      {current && current.choices.length > 0 && (
        <div
          key={`chips-${beat}`}
          ref={chipsRef}
          role="group"
          aria-label="Reply to Loti"
          className="flex flex-wrap justify-end gap-2"
        >
          {current.choices.map((choice) => (
            <Button key={choice.id} variant="secondary" size="sm" aria-describedby={questionId} onClick={() => pick(choice)}>
              {choice.label}
            </Button>
          ))}
        </div>
      )}

      {turns.length > 0 && (
        <div className="flex justify-center">
          <Button
            variant="ghost"
            size="sm"
            onClick={startOver}
            className="text-ink-muted hover:text-ink"
            leftIcon={<RotateCcw size={16} strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" />}
          >
            Start over
          </Button>
        </div>
      )}
    </div>
  )
}

/** One of Loti's bubbles, open or answered. */
function LotiLine({ text, textId, className = '' }: { text: string; textId?: string; className?: string }) {
  return (
    <div data-from="loti" className={`flex justify-start ${className}`}>
      <p className="max-w-md rounded-xl rounded-tl-sm border border-border bg-surface px-4 py-3 text-base text-ink">
        <span className="sr-only">Loti: </span>
        <span id={textId}>{text}</span>
      </p>
    </div>
  )
}
