import { useId } from 'react'
import { useAppStore, type ThemeMode } from '../state/useAppStore'

const THEMES: { id: ThemeMode; label: string }[] = [
  { id: 'light', label: 'Light (Playful Lab)' },
  { id: 'dark', label: 'Dark (Night Lab)' },
]

/* Settings: only what the app really applies. The theme (data-theme) and reduce motion
   (data-reduced-motion, which turns every anim-* and character idle off). Text size, sounds,
   glyphs, study windows and rest days were never wired to anything, so they are gone; the
   dimension preset is a judge tool (R6), not a consumer setting. */
export default function SettingsPage() {
  const theme = useAppStore((s) => s.theme)
  const setTheme = useAppStore((s) => s.setTheme)
  const reducedMotion = useAppStore((s) => s.reducedMotion)
  const setReducedMotion = useAppStore((s) => s.setReducedMotion)
  const themeId = useId()
  const motionId = useId()

  return (
    <div className="mx-auto flex max-w-xl flex-col gap-6 pb-12">
      <h1 className="font-display text-3xl font-bold text-ink">Settings</h1>

      <ul className="divide-y divide-border rounded-2xl border border-border bg-surface">
        <li className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
          <span id={themeId} className="text-base font-medium text-ink">
            Theme
          </span>
          <div role="radiogroup" aria-labelledby={themeId} className="flex gap-1 rounded-pill bg-surface-raised p-1">
            {THEMES.map((t) => {
              const on = theme === t.id
              return (
                <button
                  key={t.id}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  onClick={() => setTheme(t.id)}
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
        <li className="flex items-center justify-between gap-4 p-4">
          <span id={motionId} className="text-base font-medium text-ink">
            Reduce motion
          </span>
          <button
            type="button"
            role="switch"
            aria-checked={reducedMotion}
            aria-labelledby={motionId}
            onClick={() => setReducedMotion(!reducedMotion)}
            className={`focus-ring relative inline-flex h-7 w-12 shrink-0 cursor-pointer items-center rounded-pill border ${
              reducedMotion ? 'border-transparent bg-brand' : 'border-border-strong bg-surface-raised'
            }`}
          >
            <span
              aria-hidden="true"
              className={`inline-block size-5 rounded-pill transition-transform ${
                reducedMotion ? 'translate-x-6 bg-brand-ink' : 'translate-x-1 bg-border-strong'
              }`}
            />
          </button>
        </li>
      </ul>
    </div>
  )
}
