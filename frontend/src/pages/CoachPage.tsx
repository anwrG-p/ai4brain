import { tracker } from '../features/assessment/telemetry/tracker'
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
import type { LotiChoice, LotiMessage } from '../features/loti/types'

/* /coach: the whole talk with Loti in one column. Loti's bubbles on the left, the user's picks on the
   right, the open question's chips at the bottom, and a chat input to ask Loti anything.
   The talk lives in the session (lotiSession), so a talk started on another page's Loti bubble
   continues here, and leaving and coming back resumes it.
   The brain goes through the coach adapter; when connected, it forwards typed messages to the AI coach.
   Escape does nothing here: the only control that clears anything is "Start over". */
export default function CoachPage({ brain = coachBrain }: { brain?: CoachBrain }) {
  const context = useLotiContext()
  const run = useLotiActions()
  const motion = useCharacterMotion()
  const { turns, current, begin, record, clear } = useLotiSession()
  const [talking, setTalking] = useState(true)
  const [coachConsent, setCoachConsent] = useState(() => tracker.getStatus().coachConsent === 'granted')
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)

  const grantConsent = () => {
    tracker.setCoachConsent(true)
    setCoachConsent(true)
  }
  const focusNext = useRef<'chips' | 'log' | 'input' | null>(null)
  const chipsRef = useRef<HTMLDivElement>(null)
  const logRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
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
    if (focusNext.current === 'input') inputRef.current?.focus()
    focusNext.current = null
  }, [turns, current])

  const pick = (choice: LotiChoice) => {
    if (!current) return
    const next = brain.respond(current.id, choice.id, context)
    record(current, choice, next)
    focusNext.current = next && next.choices.length > 0 ? 'chips' : 'log'
    if (choice.action && choice.action.kind !== 'reply') run(choice.action)
  }

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault()
    const trimmed = input.trim()
    if (!trimmed || sending) return

    if (!coachConsent) {
      grantConsent()
    }

    setInput('')
    setSending(true)
    setTalking(true)

    const activeQuestion = current ?? { id: `q-${Date.now()}`, text: '', choices: [] }
    const userChoice: LotiChoice = { id: `typed-${Date.now()}`, label: trimmed }

    try {
      const shownTranscript = turns.map((t) => ({ from: t.from, text: t.text }))
      const reply = await brain.ask(trimmed, context, shownTranscript)
      const nextMessage: LotiMessage = reply ?? {
        id: 'reply',
        pose: 'talk',
        text: "I'm reflecting on your practice. What would you like to explore next?",
        choices: [
          { id: 'focus', label: 'Practice Focus', action: { kind: 'train', pillar: 'focus' } },
          { id: 'strategy', label: 'More exercises', action: { kind: 'navigate', to: '/train' } },
        ],
      }
      record(activeQuestion, userChoice, nextMessage)
    } catch {
      record(activeQuestion, userChoice, {
        id: 'offline-reply',
        pose: 'idle',
        text: "I'm here with you. What would you like to explore next?",
        choices: [],
      })
    } finally {
      setSending(false)
      setTalking(false)
      focusNext.current = 'log'
    }
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
      {brain.enabled && !coachConsent && (
        <div data-testid="coach-consent-banner" className="flex items-center justify-between gap-4 rounded-xl border border-border bg-surface px-4 py-3">
          <p className="text-sm text-ink">Let Loti use AI to reply to your questions.</p>
          <Button size="sm" variant="secondary" onClick={grantConsent}>
            Enable AI replies
          </Button>
        </div>
      )}

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

      {/* Free-text chat input form */}
      <form onSubmit={handleSend} className="flex items-center gap-2 pt-2">
        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask Loti a question..."
          className="focus-ring flex-1 rounded-xl border border-border bg-surface px-4 py-2 text-base text-ink placeholder:text-ink-muted"
          aria-label="Message to Loti"
          disabled={sending}
        />
        <Button type="submit" size="sm" disabled={!input.trim() || sending}>
          {sending ? '...' : 'Send'}
        </Button>
      </form>

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
