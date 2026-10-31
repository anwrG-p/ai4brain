import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
import { MessageCircle } from 'lucide-react'
import { Loti } from '../../components/features/characters'
import { Button } from '../../components/ui/Button'
import { scriptedBrain } from './scriptedBrain'
import { useLotiActions } from './useLotiActions'
import type { LotiAction, LotiBrain, LotiChoice, LotiContext, LotiMessage } from './types'

/** How long Loti's talk pose plays as a bubble enters: the mouth flap, 340 ms x 6 (tokens.css). */
export const TALK_MS = 2040

export interface LotiBubblesProps {
  context: LotiContext
  brain?: LotiBrain
  /** Overrides the default side effects (navigate, set a goal). */
  onAction?: ((action: LotiAction) => void) | undefined
  className?: string
}

/* One bubble at a time beside a small Loti. "Not now" cuts Loti off; the talk resumes from the
   same bubble. ponytail: the paused bubble lives in component state, so it resumes on this page
   only. Lift it into a store if pages need to continue a talk across routes. */
export function LotiBubbles({ context, brain = scriptedBrain, onAction, className = '' }: LotiBubblesProps) {
  const runDefault = useLotiActions()
  const run = onAction ?? runDefault
  // ponytail: the opening is read once per mount; a context change mid-talk does not restart it.
  const [message, setMessage] = useState<LotiMessage | null>(() => brain.opening(context))
  const [dismissed, setDismissed] = useState(false)
  const [turn, setTurn] = useState(0)
  const [talking, setTalking] = useState(true)
  const focusNext = useRef<'chips' | 'resume' | null>(null)
  const chipsRef = useRef<HTMLDivElement>(null)
  const resumeRef = useRef<HTMLButtonElement>(null)

  // Each bubble entry (a new turn) plays the talk pose once, then Loti settles into the bubble's pose.
  useEffect(() => {
    const t = window.setTimeout(() => setTalking(false), TALK_MS)
    return () => window.clearTimeout(t)
  }, [turn])

  useEffect(() => {
    if (focusNext.current === 'chips') chipsRef.current?.querySelector('button')?.focus()
    if (focusNext.current === 'resume') resumeRef.current?.focus()
    focusNext.current = null
  }, [turn, dismissed])

  if (!message) return null

  const enter = (next: LotiMessage | null) => {
    setMessage(next)
    setTalking(true)
    setTurn((t) => t + 1)
    focusNext.current = 'chips'
  }

  const pick = (choice: LotiChoice) => {
    const next = brain.respond(message.id, choice.id, context)
    if (choice.action && choice.action.kind !== 'reply') run(choice.action)
    enter(next)
  }

  const dismiss = () => {
    setDismissed(true)
    focusNext.current = 'resume'
  }

  const resume = () => {
    setDismissed(false)
    enter(message)
  }

  if (dismissed) {
    return (
      <div className={className}>
        <Button
          ref={resumeRef}
          variant="secondary"
          size="sm"
          onClick={resume}
          leftIcon={<MessageCircle size={16} strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" />}
        >
          Continue with Loti
        </Button>
      </div>
    )
  }

  const closing = message.choices.length === 0
  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key !== 'Escape') return
    e.stopPropagation()
    if (closing) setMessage(null)
    else dismiss()
  }

  return (
    <section aria-label="Loti" onKeyDown={onKeyDown} className={`flex items-end gap-3 ${className}`}>
      <Loti key={turn} size="sm" pose={talking ? 'talk' : (message.pose ?? 'idle')} className="shrink-0" />
      <div className="tactile-card max-w-md px-4 py-3">
        <p aria-live="polite" aria-atomic="true" className="font-sans text-base text-ink">
          {message.text}
        </p>
        <div ref={chipsRef} role="group" aria-label="Reply to Loti" className="mt-3 flex flex-wrap gap-2">
          {message.choices.map((choice) => (
            <Button key={choice.id} variant="secondary" size="sm" onClick={() => pick(choice)}>
              {choice.label}
            </Button>
          ))}
          {closing ? (
            <Button variant="secondary" size="sm" onClick={() => setMessage(null)}>
              Okay
            </Button>
          ) : (
            <Button variant="ghost" size="sm" onClick={dismiss}>
              Not now
            </Button>
          )}
        </div>
      </div>
    </section>
  )
}
