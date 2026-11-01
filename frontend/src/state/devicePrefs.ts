import { create } from 'zustand'

/* This device's preferences that F-D adds (ticket F-D), stored under one versioned key:
   - moodGuess: Momo's mood guess on or off (ADR 0002). Off stops the emotion listener and Momo
     shows a neutral face.
   - moodNoticeSeen: the first-exposure notice (AI Act Art 50(3)) was acknowledged with "Got it".
   - cvdSafe: Color Clash uses the colour-blind friendly inks (blue, yellow, red, black).
   "Delete my data" resets the two mood fields (they say something about the user); cvdSafe is an
   accessibility setting like the theme and reduce motion, so it survives. Export includes all. */

export const PREFS_KEY = 'synapsetwin_prefs_v1'
const VERSION = 1

export interface StoredPrefs {
  moodGuess: boolean
  moodNoticeSeen: boolean
  cvdSafe: boolean
}

export interface DevicePrefsState extends StoredPrefs {
  setMoodGuess: (on: boolean) => void
  acknowledgeMoodNotice: () => void
  setCvdSafe: (on: boolean) => void
  /** The privacy purge: the mood fields go back to their defaults; cvdSafe stays. */
  clearMoodPrefs: () => void
}

export const DEFAULT_PREFS: StoredPrefs = { moodGuess: true, moodNoticeSeen: false, cvdSafe: false }

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
    setMoodGuess: (on) => update({ moodGuess: on }),
    acknowledgeMoodNotice: () => update({ moodNoticeSeen: true }),
    setCvdSafe: (on) => update({ cvdSafe: on }),
    clearMoodPrefs: () => update({ moodGuess: DEFAULT_PREFS.moodGuess, moodNoticeSeen: DEFAULT_PREFS.moodNoticeSeen }),
  }
})
