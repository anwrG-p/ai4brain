import { useId, useRef, type KeyboardEvent } from 'react'
import { useDevicePrefs } from '../state/devicePrefs'
import { useAppStore, type ThemeMode } from '../state/useAppStore'

const THEMES: { id: ThemeMode; label: string }[] = [
  { id: 'light', label: 'Light (Playful Lab)' },
  { id: 'dark', label: 'Dark (Night Lab)' },
]

const NEXT: Record<string, number> = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }

/* Settings: only what the app really applies. The theme (data-theme), reduce motion
   (data-reduced-motion, which turns every anim-* and character idle off), the mood guess (off stops
   the emotion listener; Momo shows a neutral face, ADR 0002) and the colour-blind friendly Color
   Clash inks (devicePrefs). Text size, sounds,
   glyphs, study windows and rest days were never wired to anything, so they are gone; the
   dimension preset is a judge tool (R6), not a consumer setting. */
export default function SettingsPage() {
  const theme = useAppStore((s) => s.theme)
  const setTheme = useAppStore((s) => s.setTheme)
  const reducedMotion = useAppStore((s) => s.reducedMotion)
  const setReducedMotion = useAppStore((s) => s.setReducedMotion)
  const moodGuess = useDevicePrefs((s) => s.moodGuess)
  const setMoodGuess = useDevicePrefs((s) => s.setMoodGuess)
  const cvdSafe = useDevicePrefs((s) => s.cvdSafe)
  const setCvdSafe = useDevicePrefs((s) => s.setCvdSafe)
  const themeId = useId()
  const radios = useRef<(HTMLButtonElement | null)[]>([])

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
        <SwitchRow label="Reduce motion" on={reducedMotion} onChange={setReducedMotion} />
        <SwitchRow label="Mood guess" hint="Momo guesses your mood on this device." on={moodGuess} onChange={setMoodGuess} />
        <SwitchRow
          label="Colour-blind friendly colours"
          hint="Color Clash uses blue, yellow, red and black."
          on={cvdSafe}
          onChange={setCvdSafe}
          last
        />
      </ul>
    </div>
  )
}

/* One on/off setting. The whole row is the switch, so the tap target is the full row (≥ 44 px).
   Named by its label only; the hint is its description. */
function SwitchRow({
  label,
  hint,
  on,
  onChange,
  last = false,
}: {
  label: string
  hint?: string
  on: boolean
  onChange: (on: boolean) => void
  last?: boolean
}) {
  const labelId = useId()
  const hintId = useId()
  return (
    <li>
      <button
        type="button"
        role="switch"
        aria-checked={on}
        aria-labelledby={labelId}
        aria-describedby={hint ? hintId : undefined}
        onClick={() => onChange(!on)}
        className={`focus-ring flex min-h-14 w-full cursor-pointer items-center justify-between gap-4 p-4 text-left hover:bg-surface-raised ${last ? 'rounded-b-2xl' : ''}`}
      >
        <span className="flex flex-col">
          <span id={labelId} className="text-base font-medium text-ink">
            {label}
          </span>
          {hint && (
            <span id={hintId} className="text-sm text-ink-muted">
              {hint}
            </span>
          )}
        </span>
        <span
          aria-hidden="true"
          className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-pill border ${
            on ? 'border-transparent bg-brand' : 'border-border-strong bg-surface-raised'
          }`}
        >
          <span className={`inline-block size-5 rounded-pill transition-transform ${on ? 'translate-x-6 bg-brand-ink' : 'translate-x-1 bg-border-strong'}`} />
        </span>
      </button>
    </li>
  )
}
