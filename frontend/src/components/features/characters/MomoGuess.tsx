import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react'
import { moodGuessActive, useDevicePrefs } from '../../../state/devicePrefs'
import { useEmilyStore } from '../../../state/useEmilyStore'
import type { EmilyEmotion } from '../../../styles/emilyTokens'
import { EMOTION_TO_MOOD, type MomoMood } from './Momo'

/* Momo's mood guess as something the user opts into and owns (ADR 0002, AI Act Art 50(3), R18).
   - MOOD_NOTICE: the plain notice, shown as the Settings "Mood guess" description, where the user
     opts in (turning the switch on counts as seeing it).
   - useMoodGuessActive: every reader of the mood checks it (opted in AND notice seen).
   - MoodCorrection: in Settings, under the switch while the guess is on: today's guess and a quiet
     "Change" that opens a radio group of Momo's moods. The pick overrides the guess for this visit
     (the store's human lock, in memory only). Home has no control for it (rule 14). */

export const MOOD_NOTICE = 'Momo guesses your mood from how you use the app, on this device only. You can change it or turn it off.'

export const useMoodGuessActive = () => useDevicePrefs(moodGuessActive)

/** The moods a user can pick. Not "focused": it maps to hesitant, which the engine treats as strain. */
const CHOICES: { mood: MomoMood; label: string; emotion: EmilyEmotion }[] = [
  { mood: 'calm', label: 'Calm', emotion: 'calm_flow' },
  { mood: 'happy', label: 'Happy', emotion: 'energized' },
  { mood: 'tired', label: 'Tired', emotion: 'fatigued' },
  { mood: 'frustrated', label: 'Frustrated', emotion: 'frustrated' },
]

/** Today's guess in words. A hesitant guess (Momo's 'focused' face) reads "Unsure": not a choice
    the user can pick, so the radio group then checks none and its first choice is the tab stop. */
const LABEL: Record<MomoMood, string> = { calm: 'Calm', happy: 'Happy', tired: 'Tired', frustrated: 'Frustrated', focused: 'Unsure' }

const STEP: Record<string, number> = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }

export function MoodCorrection() {
  const active = useMoodGuessActive()
  const emotion = useEmilyStore((s) => s.currentEmotion)
  const [open, setOpen] = useState(false)
  const change = useRef<HTMLButtonElement>(null)
  const radios = useRef<(HTMLButtonElement | null)[]>([])
  const groupId = useId()
  const lineId = useId()
  const mood = EMOTION_TO_MOOD[emotion]
  const at = CHOICES.findIndex((c) => c.mood === mood)

  // Opening puts focus on the checked mood (or the first one); only on open, not on each pick.
  const first = useRef(at)
  first.current = at
  useEffect(() => {
    if (open) radios.current[Math.max(0, first.current)]?.focus()
  }, [open])

  if (!active) return null

  const pick = (i: number) => {
    const c = CHOICES[i]
    if (c) useEmilyStore.getState().setManualEmotion(c.emotion)
  }
  // Radio group pattern: one Tab stop (the checked radio); arrow keys move, wrap and choose.
  const onKeyDown = (e: KeyboardEvent, i: number) => {
    if (e.key === 'Escape') {
      e.stopPropagation()
      setOpen(false)
      change.current?.focus()
      return
    }
    const step = STEP[e.key]
    if (!step) return
    e.preventDefault()
    const j = (i + step + CHOICES.length) % CHOICES.length
    pick(j)
    radios.current[j]?.focus()
  }

  return (
    <div className="px-4 pb-4">
      <div className="flex flex-wrap items-center gap-x-3">
        <p id={lineId} className="text-sm text-ink">
          Momo&apos;s guess today: {LABEL[mood]}
        </p>
        <button
          ref={change}
          type="button"
          aria-expanded={open}
          aria-controls={open ? groupId : undefined}
          aria-describedby={lineId}
          onClick={() => setOpen((o) => !o)}
          className="focus-ring inline-flex min-h-11 cursor-pointer items-center rounded-sm text-sm font-medium text-brand underline underline-offset-4"
        >
          Change
        </button>
      </div>
      {open && (
        <div id={groupId} role="radiogroup" aria-label="How do you feel?" className="mt-1 grid grid-cols-2 gap-1 rounded-2xl bg-surface-raised p-1 sm:grid-cols-4">
          {CHOICES.map((c, i) => {
            const on = i === at
            return (
              <button
                key={c.mood}
                ref={(el) => {
                  radios.current[i] = el
                }}
                type="button"
                role="radio"
                aria-checked={on}
                tabIndex={on || (at < 0 && i === 0) ? 0 : -1}
                onClick={() => pick(i)}
                onKeyDown={(e) => onKeyDown(e, i)}
                className={`focus-ring min-h-11 flex-1 cursor-pointer rounded-pill px-4 text-sm font-medium whitespace-nowrap ${
                  on ? 'bg-brand text-brand-ink' : 'text-ink hover:bg-surface'
                }`}
              >
                {c.label}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
