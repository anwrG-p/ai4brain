import { afterEach, describe, expect, it } from 'vitest'
import { DEFAULT_PREFS, PREFS_KEY, loadPrefs, useDevicePrefs } from './devicePrefs'

afterEach(() => {
  useDevicePrefs.setState(DEFAULT_PREFS)
  localStorage.clear()
})

describe('device prefs (F-D)', () => {
  it('defaults: the mood guess on with its notice not yet seen, the colour-blind inks off', () => {
    expect(DEFAULT_PREFS).toEqual({ moodGuess: true, moodNoticeSeen: false, cvdSafe: false })
    expect(loadPrefs()).toEqual(DEFAULT_PREFS)
  })

  it('each change is stored under one versioned key and read back', () => {
    const s = useDevicePrefs.getState()
    s.setMoodGuess(false)
    s.acknowledgeMoodNotice()
    s.setCvdSafe(true)
    expect(JSON.parse(localStorage.getItem(PREFS_KEY)!)).toEqual({ version: 1, moodGuess: false, moodNoticeSeen: true, cvdSafe: true })
    expect(loadPrefs()).toEqual({ moodGuess: false, moodNoticeSeen: true, cvdSafe: true })
  })

  it('corrupt, foreign or other-version data reads as the defaults; a bad field falls back alone', () => {
    for (const raw of ['nope', '[]', '{"version":2,"moodGuess":false}', 'null']) {
      localStorage.setItem(PREFS_KEY, raw)
      expect(loadPrefs(), raw).toEqual(DEFAULT_PREFS)
    }
    localStorage.setItem(PREFS_KEY, '{"version":1,"moodGuess":"no","moodNoticeSeen":true,"cvdSafe":1}')
    expect(loadPrefs()).toEqual({ moodGuess: true, moodNoticeSeen: true, cvdSafe: false })
  })

  it('clearMoodPrefs (the privacy purge) resets the mood fields and keeps the colour-blind inks', () => {
    const s = useDevicePrefs.getState()
    s.setMoodGuess(false)
    s.acknowledgeMoodNotice()
    s.setCvdSafe(true)
    useDevicePrefs.getState().clearMoodPrefs()
    expect(useDevicePrefs.getState()).toMatchObject({ moodGuess: true, moodNoticeSeen: false, cvdSafe: true })
    expect(loadPrefs()).toEqual({ moodGuess: true, moodNoticeSeen: false, cvdSafe: true })
  })
})
