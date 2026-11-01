import { create } from 'zustand'

/* This device's preferences that F-D adds (ticket F-D), stored under one versioned key:
   - moodGuess: Momo's mood guess, OFF until the user turns it on in Settings (opt-in, ADR 0002, R18).
   - moodNoticeSeen: the Art 50(3) notice was shown where the user opted in. Turning the guess on in
     Settings happens beside the notice, so it sets this too.
   - cvdSafe: Color Clash uses the colour-blind friendly inks (blue, yellow, red, black).
   The guess runs only while BOTH moodGuess and moodNoticeSeen hold (moodGuessActive): every reader
   of the mood (the listener, Momo's face, Home's tint, Loti's context) checks it.
   "Delete my data" turns the guess back off and forgets the notice (they say something about the
   user, and a purge must never switch the guess on); cvdSafe is an accessibility setting like the
   theme and reduce motion, so it survives. Export includes all. Other tabs follow (storage event). */

export const PREFS_KEY = 'synapsetwin_prefs_v1'
const VERSION = 1

export interface StoredPrefs {
  moodGuess: boolean
  moodNoticeSeen: boolean
  cvdSafe: boolean
}

export interface DevicePrefsState extends StoredPrefs {
  /** On also records the notice as seen: the switch sits beside it. */
  setMoodGuess: (on: boolean) => void
  setCvdSafe: (on: boolean) => void
  /** The privacy purge: the guess back off, the notice unseen; cvdSafe stays. */
  clearMoodPrefs: () => void
}

export const DEFAULT_PREFS: StoredPrefs = { moodGuess: false, moodNoticeSeen: false, cvdSafe: false }

/** The mood guess may run: opted in, with the notice shown. */
export const moodGuessActive = (p: StoredPrefs): boolean => p.moodGuess && p.moodNoticeSeen

/** Reads the stored prefs; anything corrupt, foreign or from another version reads as the defaults,
    and each field falls back on its own. */
export function loadPrefs(): StoredPrefs {
  try {
    const raw: unknown = JSON.parse(localStorage.getItem(PREFS_KEY) ?? 'null')
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return DEFAULT_PREFS
    const r = raw as Record<string, unknown>
    if (r.version !== VERSION) return DEFAULT_PREFS
    const bool = (k: keyof StoredPrefs) => (typeof r[k] === 'boolean' ? (r[k] as boolean) : DEFAULT_PREFS[k])
    return { moodGuess: bool('moodGuess'), moodNoticeSeen: bool('moodNoticeSeen'), cvdSafe: bool('cvdSafe') }
  } catch {
    return DEFAULT_PREFS
  }
}

const pick = ({ moodGuess, moodNoticeSeen, cvdSafe }: StoredPrefs): StoredPrefs => ({ moodGuess, moodNoticeSeen, cvdSafe })

function save(prefs: StoredPrefs) {
  try {
    localStorage.setItem(PREFS_KEY, JSON.stringify({ version: VERSION, ...pick(prefs) }))
  } catch {
    // Storage full or blocked: the prefs still hold for this visit.
  }
}

export const useDevicePrefs = create<DevicePrefsState>((set, get) => {
  const update = (patch: Partial<StoredPrefs>) => {
    set(patch)
    save(get())
  }
  return {
    ...loadPrefs(),
    setMoodGuess: (on) => update(on ? { moodGuess: true, moodNoticeSeen: true } : { moodGuess: false }),
    setCvdSafe: (on) => update({ cvdSafe: on }),
    clearMoodPrefs: () => update({ moodGuess: DEFAULT_PREFS.moodGuess, moodNoticeSeen: DEFAULT_PREFS.moodNoticeSeen }),
  }
})

// Another tab changed the prefs (or cleared storage, key null): this tab follows at once, so a guess
// switched off or purged elsewhere stops here too.
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e) => {
    if (e.key === PREFS_KEY || e.key === null) useDevicePrefs.setState(loadPrefs())
  })
}
