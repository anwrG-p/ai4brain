import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react'
import { Link } from 'react-router-dom'
import { Button } from '../../ui/Button'
import { useDevicePrefs } from '../../../state/devicePrefs'
import { useEmilyStore } from '../../../state/useEmilyStore'
import type { EmilyEmotion } from '../../../styles/emilyTokens'
import { EMOTION_TO_MOOD, Momo, type MomoMood } from './Momo'
import type { CharacterSize } from './shared'

/* Momo as a guess the user owns (ADR 0002, AI Act Art 50(3)).
   - MomoGuess: with the "Mood guess" setting on, Momo is a button; tapping it opens a tiny picker of
     Momo's five moods, and the pick overrides the guess for this visit (the store's human lock, in
     memory only). With the setting off, Momo is a still picture with a neutral face, not a button.
   - MomoNotice: the first-exposure notice, an inline bubble shown once per device beside Momo with
     one quiet "Got it" and one quiet link to Settings. */

const MOODS: { mood: MomoMood; label: string; emotion: EmilyEmotion }[] = [
  { mood: 'calm', label: 'Calm', emotion: 'calm_flow' },
  { mood: 'happy', label: 'Happy', emotion: 'energized' },
  { mood: 'focused', label: 'Focused', emotion: 'hesitant' },
  { mood: 'tired', label: 'Tired', emotion: 'fatigued' },
  { mood: 'frustrated', label: 'Frustrated', emotion: 'frustrated' },
]

/** Marks the Momo button, so the notice can hand focus to it when it closes. */
const TRIGGER = 'data-momo-trigger'

export function MomoGuess({ size = 'md', className = '' }: { size?: CharacterSize; className?: string }) {
  const on = useDevicePrefs((s) => s.moodGuess)
  const emotion = useEmilyStore((s) => s.currentEmotion)
  const [open, setOpen] = useState(false)
  const trigger = useRef<HTMLButtonElement>(null)
  const box = useRef<HTMLDivElement>(null)
  const groupId = useId()

  // A tap anywhere else closes the picker.
  useEffect(() => {
    if (!open) return
    const away = (e: PointerEvent) => {
      if (!box.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('pointerdown', away)
    return () => document.removeEventListener('pointerdown', away)
  }, [open])

  // Opening puts focus on the current mood.
  useEffect(() => {
    if (open) box.current?.querySelector<HTMLElement>('[aria-pressed="true"]')?.focus()
  }, [open])

  if (!on) return <Momo mood="calm" size={size} title="Momo" className={className} />

  const mood = EMOTION_TO_MOOD[emotion]
  const close = () => {
    setOpen(false)
    trigger.current?.focus()
  }
  const pick = (e: EmilyEmotion) => {
    useEmilyStore.getState().setManualEmotion(e)
    close()
  }
  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key !== 'Escape' || !open) return
    e.stopPropagation()
    close()
  }

  return (
    <div ref={box} onKeyDown={onKeyDown} className={`relative ${className}`}>
      <button
        ref={trigger}
        type="button"
        {...{ [TRIGGER]: true }}
        aria-expanded={open}
        aria-controls={open ? groupId : undefined}
        aria-label={`Momo guesses you feel ${mood}. Change it`}
        onClick={() => setOpen((o) => !o)}
        className="focus-ring block cursor-pointer rounded-2xl"
      >
        <Momo mood={mood} size={size} />
      </button>
      {open && (
        <div
          id={groupId}
          role="group"
          aria-label="How do you feel?"
          className="absolute end-0 top-full z-20 mt-2 flex w-max flex-col gap-1 rounded-2xl border border-border bg-surface p-2 shadow-(--shadow-elevation)"
        >
          <p aria-hidden="true" className="px-3 pt-1 text-sm text-ink-muted">
            How do you feel?
          </p>
          {MOODS.map((m) => {
            const here = m.mood === mood
            return (
              <button
                key={m.mood}
                type="button"
                aria-pressed={here}
                onClick={() => pick(m.emotion)}
                className={`focus-ring min-h-11 cursor-pointer rounded-pill px-4 text-left text-sm font-medium ${
                  here ? 'bg-brand text-brand-ink' : 'text-ink hover:bg-surface-raised'
                }`}
              >
                {m.label}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

/** The plain words of the first-exposure notice (Art 50(3)); tests pin them. */
export const MOOD_NOTICE = 'Momo guesses your mood from how you use the app, on this device only. You can change it or turn it off.'

/** True while the notice is due: the mood guess is on and the notice was never acknowledged here. */
export const useMoodNoticeDue = () => useDevicePrefs((s) => s.moodGuess && !s.moodNoticeSeen)

export function MomoNotice({ className = '' }: { className?: string }) {
  const acknowledge = useDevicePrefs((s) => s.acknowledgeMoodNotice)
  const textId = useId()
  const gotIt = () => {
    acknowledge()
    // The bubble goes away: focus moves to Momo, the thing the notice is about.
    document.querySelector<HTMLElement>(`[${TRIGGER}]`)?.focus()
  }
  return (
    <div role="note" aria-labelledby={textId} className={`tactile-card max-w-md px-4 py-3 ${className}`}>
      <p id={textId} className="text-base text-ink">
        {MOOD_NOTICE}
      </p>
      <div className="mt-1 flex flex-wrap items-center gap-x-4">
        <Button variant="ghost" size="sm" onClick={gotIt} className="-ms-3">
          Got it
        </Button>
        <Link
          to="/settings"
          className="focus-ring inline-flex min-h-11 items-center rounded-sm text-sm font-medium text-brand underline underline-offset-4"
        >
          Settings
        </Link>
      </div>
    </div>
  )
}
