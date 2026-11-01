import { useId, useRef, type KeyboardEvent } from 'react'
import { MOOD_NOTICE, MoodCorrection } from '../components/features/characters'
import { Switch } from '../components/ui/Switch'
import { useDevicePrefs, type DifficultyLevel } from '../state/devicePrefs'
import { useAppStore, type ThemeMode } from '../state/useAppStore'

const THEMES: { id: ThemeMode; label: string }[] = [
  { id: 'light', label: 'Light (Playful Lab)' },
  { id: 'dark', label: 'Dark (Night Lab)' },
]

const DIFFICULTIES: { id: DifficultyLevel; label: string; desc: string }[] = [
  { id: 'gentle', label: 'Gentle', desc: 'Relaxed pacing and approachable starting levels' },
  { id: 'balanced', label: 'Balanced', desc: 'Standard adaptive challenge' },
  { id: 'challenge', label: 'Challenge', desc: 'Faster timers and complex problems' },
]

const NEXT: Record<string, number> = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }

const ROW = 'p-4'

/* Settings: only what the app really applies. The theme (data-theme), reduce motion
   (data-reduced-motion, which turns every anim-* and character idle off), training pace
   (gentle / balanced / challenge), the mood guess and the colour-blind friendly Color Clash inks
   (devicePrefs).
   Mood guess (ADR 0002, R18): off by default. Its description is the Art 50(3) notice itself, so the
   user reads it where they opt in, and turning it on records it as seen. While on, the row shows
   today's guess with a quiet "Change" (MoodCorrection); off, the listener stops and Momo is a still
   picture. Text size, sounds, glyphs, study windows and rest days were never wired to anything, so
   they are gone; the dimension preset is a judge tool (R6), not a consumer setting. */
export default function SettingsPage() {
  const theme = useAppStore((s) => s.theme)
  const setTheme = useAppStore((s) => s.setTheme)
  const reducedMotion = useAppStore((s) => s.reducedMotion)
  const setReducedMotion = useAppStore((s) => s.setReducedMotion)
  const difficulty = useDevicePrefs((s) => s.difficulty)
  const setDifficulty = useDevicePrefs((s) => s.setDifficulty)
  const moodGuess = useDevicePrefs((s) => s.moodGuess)
  const setMoodGuess = useDevicePrefs((s) => s.setMoodGuess)
  const cvdSafe = useDevicePrefs((s) => s.cvdSafe)
  const setCvdSafe = useDevicePrefs((s) => s.setCvdSafe)
  const themeId = useId()
  const diffId = useId()
  const radios = useRef<(HTMLButtonElement | null)[]>([])
  const diffRadios = useRef<(HTMLButtonElement | null)[]>([])

  // Radio group pattern: one Tab stop (the checked radio); arrow keys move, wrap and choose.
  const onKeyDown = (e: KeyboardEvent, i: number) => {
    const step = NEXT[e.key]
    if (!step) return
    e.preventDefault()
    const j = (i + step + THEMES.length) % THEMES.length
    const next = THEMES[j]
    if (!next) return
    setTheme(next.id)
    radios.current[j]?.focus()
  }

  const onDiffKeyDown = (e: KeyboardEvent, i: number) => {
    const step = NEXT[e.key]
    if (!step) return
    e.preventDefault()
    const j = (i + step + DIFFICULTIES.length) % DIFFICULTIES.length
    const next = DIFFICULTIES[j]
    if (!next) return
    setDifficulty(next.id)
    diffRadios.current[j]?.focus()
  }

  return (
    <div className="mx-auto flex max-w-xl flex-col gap-6 pb-12">
      <h1 className="font-display text-3xl font-bold text-ink">Settings</h1>

      <ul className="divide-y divide-border rounded-2xl border border-border bg-surface">
        <li className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
          <span id={themeId} className="text-base font-medium text-ink">
            Theme
          </span>
          <div role="radiogroup" aria-labelledby={themeId} className="flex gap-1 rounded-pill bg-surface-raised p-1">
            {THEMES.map((t, i) => {
              const on = theme === t.id
              return (
                <button
                  key={t.id}
                  ref={(el) => {
                    radios.current[i] = el
                  }}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  tabIndex={on ? 0 : -1}
                  onClick={() => setTheme(t.id)}
                  onKeyDown={(e) => onKeyDown(e, i)}
                  className={`focus-ring min-h-11 flex-1 cursor-pointer rounded-pill px-4 text-sm font-medium whitespace-nowrap ${
                    on ? 'bg-brand text-brand-ink' : 'text-ink hover:bg-surface'
                  }`}
                >
                  {t.label}
                </button>
              )
            })}
          </div>
        </li>

        <li className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-col">
            <span id={diffId} className="text-base font-medium text-ink">
              Training pace
            </span>
            <span className="text-sm text-ink-muted">
              {DIFFICULTIES.find((d) => d.id === difficulty)?.desc}
            </span>
          </div>
          <div role="radiogroup" aria-labelledby={diffId} className="flex gap-1 rounded-pill bg-surface-raised p-1">
            {DIFFICULTIES.map((d, i) => {
              const on = difficulty === d.id
              return (
                <button
                  key={d.id}
                  ref={(el) => {
                    diffRadios.current[i] = el
                  }}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  tabIndex={on ? 0 : -1}
                  onClick={() => setDifficulty(d.id)}
                  onKeyDown={(e) => onDiffKeyDown(e, i)}
                  className={`focus-ring min-h-11 flex-1 cursor-pointer rounded-pill px-3 text-sm font-medium whitespace-nowrap ${
                    on ? 'bg-brand text-brand-ink' : 'text-ink hover:bg-surface'
                  }`}
                >
                  {d.label}
                </button>
              )
            })}
          </div>
        </li>

        <li>
          <Switch label="Reduce motion" checked={reducedMotion} onChange={setReducedMotion} className={ROW} />
        </li>
        <li>
          <Switch label="Mood guess" description={MOOD_NOTICE} checked={moodGuess} onChange={setMoodGuess} className={ROW} />
          <MoodCorrection />
        </li>
        <li>
          <Switch
            label="Colour-blind friendly colours"
            description="Color Clash uses blue, yellow, red and black."
            checked={cvdSafe}
            onChange={setCvdSafe}
            className={`${ROW} rounded-b-2xl`}
          />
        </li>
      </ul>
    </div>
  )
}
