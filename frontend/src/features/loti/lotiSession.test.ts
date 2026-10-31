import { afterEach, describe, expect, it } from 'vitest'
import { LOTI_SESSION_KEY, MAX_TURNS, loadLotiSession, useLotiSession } from './lotiSession'
import type { LotiMessage } from './types'

const day: LotiMessage = {
  id: 'day',
  text: 'How was your day?',
  choices: [
    { id: 'great', label: 'Great', action: { kind: 'reply', nodeId: 'day-great' } },
    { id: 'tough', label: 'Tough', action: { kind: 'reply', nodeId: 'day-tough' } },
  ],
}
const great: LotiMessage = {
  id: 'day-great',
  pose: 'happy',
  text: 'Good to hear! Want to put some time into training?',
  choices: [{ id: 'yes', label: "Yes, let's train", action: { kind: 'train' } }],
}
const tough: LotiMessage = { id: 'day-tough', text: "Sorry it was tough. Rest counts too. I'm here when you're ready.", choices: [] }

const state = () => useLotiSession.getState()

afterEach(() => {
  state().clear()
  sessionStorage.clear()
})

describe('lotiSession', () => {
  it('starts empty', () => {
    expect(state().turns).toEqual([])
    expect(state().current).toBeNull()
  })

  it('records a pick: the bubble, the reply, then the next bubble becomes the open question', () => {
    state().record(day, day.choices[0]!, great)
    expect(state().turns).toEqual([
      { from: 'loti', text: 'How was your day?' },
      { from: 'you', text: 'Great' },
    ])
    expect(state().current).toEqual(great)
  })

  it('a closing line goes into the history and leaves no open question', () => {
    state().record(day, day.choices[1]!, tough)
    expect(state().turns.at(-1)).toEqual({ from: 'loti', text: tough.text })
    expect(state().current).toBeNull()
  })

  it('a pick that ends the talk leaves no open question', () => {
    state().begin(great)
    state().record(great, great.choices[0]!, null)
    expect(state().turns).toEqual([
      { from: 'loti', text: great.text },
      { from: 'you', text: "Yes, let's train" },
    ])
    expect(state().current).toBeNull()
  })

  it('an open question answered elsewhere with another bubble stays in the history, since it was read', () => {
    state().begin(great)
    state().record(day, day.choices[0]!, great)
    expect(state().turns.map((t) => t.text)).toEqual([great.text, day.text, 'Great'])
  })

  it('persists to sessionStorage, versioned, and loads it back', () => {
    state().record(day, day.choices[0]!, great)
    const raw = JSON.parse(sessionStorage.getItem(LOTI_SESSION_KEY) ?? 'null')
    expect(raw.version).toBe(1)
    expect(loadLotiSession()).toEqual({ turns: state().turns, current: great })
  })

  it('reads corrupt, foreign or other-version data as empty', () => {
    const empty = { turns: [], current: null }
    sessionStorage.setItem(LOTI_SESSION_KEY, '{nope')
    expect(loadLotiSession()).toEqual(empty)
    sessionStorage.setItem(LOTI_SESSION_KEY, JSON.stringify({ version: 2, turns: [], current: null }))
    expect(loadLotiSession()).toEqual(empty)
    sessionStorage.setItem(
      LOTI_SESSION_KEY,
      JSON.stringify({ version: 1, turns: [{ from: 'bot', text: 'x' }, { from: 'you', text: 'Okay' }], current: { id: 3 } }),
    )
    expect(loadLotiSession()).toEqual({ turns: [{ from: 'you', text: 'Okay' }], current: null })
  })

  it('keeps at most MAX_TURNS, dropping the oldest', () => {
    for (let i = 0; i < MAX_TURNS; i++) state().record(day, day.choices[0]!, great)
    expect(state().turns).toHaveLength(MAX_TURNS)
  })

  it('clear empties the store and the storage', () => {
    state().record(day, day.choices[0]!, great)
    state().clear()
    expect(state().turns).toEqual([])
    expect(state().current).toBeNull()
    expect(sessionStorage.getItem(LOTI_SESSION_KEY)).toBeNull()
  })
})
