import { useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode } from 'react'
import { MessageCircle } from 'lucide-react'
import { Loti, type CharacterSize, type LotiPose } from '../../components/features/characters'
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

/** dismissed: "Not now", the same bubble resumes. ended: the talk closed in place, it starts over. */
type Paused = 'dismissed' | 'ended' | null

/* One bubble at a time beside a small Loti. "Not now" cuts Loti off; the talk resumes from the
   same bubble. When a talk ends without leaving the page, a quiet "Talk to Loti" button keeps
   focus off <body> and starts a new talk. ponytail: the paused bubble lives in component state,
   so it resumes on this page only. Lift it into a store if pages need to continue across routes. */
export function LotiBubbles({ context, brain = scriptedBrain, onAction, className = '' }: LotiBubblesProps) {
  const runDefault = useLotiActions()
  const run = onAction ?? runDefault
  // ponytail: the opening is read once per mount; a context change mid-talk does not restart it.
  const [message, setMessage] = useState<LotiMessage | null>(() => brain.opening(context))
  const [paused, setPaused] = useState<Paused>(null)
  const [turn, setTurn] = useState(0)
  const [talking, setTalking] = useState(true)
  const focusNext = useRef<'chips' | 'resume' | null>(null)
  const chipsRef = useRef<HTMLDivElement>(null)
  const resumeRef = useRef<HTMLButtonElement>(null)
  const textId = useId()

  // Each bubble entry (a new turn) plays the talk pose once, then Loti settles into the bubble's pose.
  useEffect(() => {
    const t = window.setTimeout(() => setTalking(false), TALK_MS)
    return () => window.clearTimeout(t)
  }, [turn])

  useEffect(() => {
    if (focusNext.current === 'chips') chipsRef.current?.querySelector('button')?.focus()
    if (focusNext.current === 'resume') resumeRef.current?.focus()
    focusNext.current = null
  }, [turn, paused])

  const enter = (next: LotiMessage | null) => {
    if (!next) {
      end()
      return
    }
    setMessage(next)
    setPaused(null)
    setTalking(true)
    setTurn((t) => t + 1)
    focusNext.current = 'chips'
  }

  function end() {
    setMessage(null)
    setPaused('ended')
    focusNext.current = 'resume'
  }

  if (paused) {
    const resume = () => enter(paused === 'dismissed' ? message : brain.opening(context))
    return (
      <div className={className}>
        <Button
          ref={resumeRef}
          variant="ghost"
          size="sm"
          onClick={resume}
          leftIcon={<MessageCircle size={16} strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" />}
        >
          {paused === 'dismissed' ? 'Continue with Loti' : 'Talk to Loti'}
        </Button>
      </div>
    )
  }

  if (!message) return null

  const pick = (choice: LotiChoice) => {
    const next = brain.respond(message.id, choice.id, context)
    if (choice.action && choice.action.kind !== 'reply') run(choice.action)
    enter(next)
  }

  const dismiss = () => {
    setPaused('dismissed')
    focusNext.current = 'resume'
  }

  const closing = message.choices.length === 0
  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key !== 'Escape') return
    e.stopPropagation()
    if (closing) end()
    else dismiss()
  }

  // Every reply button is described by the bubble text, so a focused chip reads the question even
  // when the polite announcement is dropped (focus moves) or the bubble remounts on resume.
  return (
    <section aria-label="Loti" onKeyDown={onKeyDown} className={`flex items-end gap-3 ${className}`}>
      <Loti key={turn} size="sm" pose={talking ? 'talk' : (message.pose ?? 'idle')} className="shrink-0" />
      <div className="tactile-card max-w-md px-4 py-3">
        <p id={textId} aria-live="polite" aria-atomic="true" className="font-sans text-base text-ink">
          {message.text}
        </p>
        <div ref={chipsRef} role="group" aria-label="Reply to Loti" className="mt-3 flex flex-wrap gap-2">
          {message.choices.map((choice) => (
            <Button key={choice.id} variant="secondary" size="sm" aria-describedby={textId} onClick={() => pick(choice)}>
              {choice.label}
            </Button>
          ))}
          {closing ? (
            <Button variant="secondary" size="sm" aria-describedby={textId} onClick={end}>
              Okay
            </Button>
          ) : (
            <Button variant="ghost" size="sm" aria-describedby={textId} onClick={dismiss}>
              Not now
            </Button>
          )}
        </div>
      </div>
    </section>
  )
}

export interface LotiSaysProps {
  children: ReactNode
  pose?: LotiPose
  size?: CharacterSize
  className?: string
}

/** One static line from Loti: the character above a bubble, no chips and no controls. For screens
    whose only action is the page's own button (Welcome, the login sheet). */
export function LotiSays({ children, pose = 'idle', size = 'sm', className = '' }: LotiSaysProps) {
  return (
    <div className={`flex flex-col items-center gap-3 text-center ${className}`}>
      <Loti pose={pose} size={size} />
      <div className="tactile-card max-w-md px-5 py-4">{children}</div>
    </div>
  )
}
