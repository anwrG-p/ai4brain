import { afterEach, describe, expect, it } from 'vitest'
import { DEFAULT_PREFS, PREFS_KEY, loadPrefs, moodGuessActive, useDevicePrefs } from './devicePrefs'

afterEach(() => {
  useDevicePrefs.setState(DEFAULT_PREFS)
  localStorage.clear()
})

describe('device prefs (F-D)', () => {
  it('defaults: the mood guess OFF (opt-in, ADR 0002), its notice unseen, the colour-blind inks off, difficulty gentle, voiceCoach off, voicePace 1.0', () => {
    expect(DEFAULT_PREFS).toEqual({
      moodGuess: false,
      moodNoticeSeen: false,
      cvdSafe: false,
      difficulty: 'gentle',
      voiceCoach: false,
      voicePace: 1.0,
    })
    expect(loadPrefs()).toEqual(DEFAULT_PREFS)
    expect(moodGuessActive(useDevicePrefs.getState())).toBe(false)
  })

  it('turning the guess on records the notice as seen (the switch sits beside it); off keeps it seen', () => {
    useDevicePrefs.getState().setMoodGuess(true)
    expect(useDevicePrefs.getState()).toMatchObject({ moodGuess: true, moodNoticeSeen: true })
    expect(moodGuessActive(useDevicePrefs.getState())).toBe(true)
    useDevicePrefs.getState().setMoodGuess(false)
    expect(useDevicePrefs.getState()).toMatchObject({ moodGuess: false, moodNoticeSeen: true })
    expect(moodGuessActive(useDevicePrefs.getState())).toBe(false)
  })

  it('the guess is active only with both flags: a stored moodGuess without the notice stays inactive', () => {
    expect(moodGuessActive({ moodGuess: true, moodNoticeSeen: false, cvdSafe: false, difficulty: 'gentle', voiceCoach: false, voicePace: 1.0 })).toBe(false)
    expect(moodGuessActive({ moodGuess: false, moodNoticeSeen: true, cvdSafe: false, difficulty: 'gentle', voiceCoach: false, voicePace: 1.0 })).toBe(false)
    expect(moodGuessActive({ moodGuess: true, moodNoticeSeen: true, cvdSafe: false, difficulty: 'gentle', voiceCoach: false, voicePace: 1.0 })).toBe(true)
  })

  it('each change is stored under one versioned key and read back', () => {
    useDevicePrefs.getState().setMoodGuess(true)
    useDevicePrefs.getState().setCvdSafe(true)
    useDevicePrefs.getState().setDifficulty('balanced')
    useDevicePrefs.getState().setVoiceCoach(true)
    useDevicePrefs.getState().setVoicePace(0.9)
    expect(JSON.parse(localStorage.getItem(PREFS_KEY)!)).toEqual({
      version: 1,
      moodGuess: true,
      moodNoticeSeen: true,
      cvdSafe: true,
      difficulty: 'balanced',
      voiceCoach: true,
      voicePace: 0.9,
    })
    expect(loadPrefs()).toEqual({
      moodGuess: true,
      moodNoticeSeen: true,
      cvdSafe: true,
      difficulty: 'balanced',
      voiceCoach: true,
      voicePace: 0.9,
    })
  })

  it('corrupt, foreign or other-version data reads as the defaults; a bad field falls back alone', () => {
    for (const raw of ['nope', '[]', '{"version":2,"moodGuess":true}', 'null']) {
      localStorage.setItem(PREFS_KEY, raw)
      expect(loadPrefs(), raw).toEqual(DEFAULT_PREFS)
    }
    localStorage.setItem(PREFS_KEY, '{"version":1,"moodGuess":"yes","moodNoticeSeen":true,"cvdSafe":1,"difficulty":"invalid","voiceCoach":"yes","voicePace":"fast"}')
    expect(loadPrefs()).toEqual({
      moodGuess: false,
      moodNoticeSeen: true,
      cvdSafe: false,
      difficulty: 'gentle',
      voiceCoach: false,
      voicePace: 1.0,
    })
  })

  it('clearMoodPrefs (the privacy purge) turns the guess OFF and forgets the notice; the colour-blind inks, difficulty and voice stay', () => {
    useDevicePrefs.getState().setMoodGuess(true)
    useDevicePrefs.getState().setCvdSafe(true)
    useDevicePrefs.getState().setDifficulty('challenge')
    useDevicePrefs.getState().setVoiceCoach(true)
    useDevicePrefs.getState().clearMoodPrefs()
    expect(useDevicePrefs.getState()).toMatchObject({
      moodGuess: false,
      moodNoticeSeen: false,
      cvdSafe: true,
      difficulty: 'challenge',
      voiceCoach: true,
    })
    expect(loadPrefs()).toEqual({
      moodGuess: false,
      moodNoticeSeen: false,
      cvdSafe: true,
      difficulty: 'challenge',
      voiceCoach: true,
      voicePace: 1.0,
    })
  })

  it('follows another tab: a change to the key (or cleared storage) is read back at once', () => {
    useDevicePrefs.getState().setMoodGuess(true)
    localStorage.setItem(PREFS_KEY, JSON.stringify({ version: 1, moodGuess: false, moodNoticeSeen: true, cvdSafe: true, difficulty: 'gentle', voiceCoach: true, voicePace: 1.0 }))
    window.dispatchEvent(new StorageEvent('storage', { key: PREFS_KEY }))
    expect(useDevicePrefs.getState()).toMatchObject({ moodGuess: false, moodNoticeSeen: true, cvdSafe: true, difficulty: 'gentle', voiceCoach: true, voicePace: 1.0 })
    localStorage.clear()
    window.dispatchEvent(new StorageEvent('storage', { key: null }))
    expect(useDevicePrefs.getState()).toMatchObject(DEFAULT_PREFS)
    window.dispatchEvent(new StorageEvent('storage', { key: 'other' }))
    expect(useDevicePrefs.getState()).toMatchObject(DEFAULT_PREFS)
  })
})
