import { afterEach, describe, expect, it, vi } from 'vitest'
import { CRISIS_MESSAGE, coachBrain, createCoachBrain, keywordCrisisGate } from './coachAdapter'
import { scriptedBrain } from './scriptedBrain'
import type { LotiContext } from './types'

afterEach(() => vi.unstubAllGlobals())

const ctx: LotiContext = { now: new Date('2026-10-28T15:00:00'), hasGoalsThisYear: true, sessionsThisWeek: 0 }

describe('coachBrain (stub)', () => {
  it('makes no network calls and answers like the scripted brain', () => {
    const fetchSpy = vi.fn()
    vi.stubGlobal('fetch', fetchSpy)

    expect(coachBrain.opening(ctx)).toEqual(scriptedBrain.opening(ctx))
    expect(coachBrain.respond('day', 'great', ctx)).toEqual(scriptedBrain.respond('day', 'great', ctx))
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('is off unless the env flag turns it on', () => {
    expect(coachBrain.enabled).toBe(false)
  })
})

describe('keywordCrisisGate (placeholder)', () => {
  it.each(['I want to hurt myself', 'thinking about SUICIDE', "I can't go on", 'i cant go on anymore', 'I want to kill myself', 'self-harm again', 'I want to end my life', 'I cannot go on', 'I want to end it all'])(
    'flags "%s"',
    (text) => {
      expect(keywordCrisisGate(text)).toEqual({ crisis: true, message: CRISIS_MESSAGE })
    },
  )

  it.each(['Great', 'I am tired today', 'this exercise is killing it', 'go on then'])('lets "%s" through', (text) => {
    expect(keywordCrisisGate(text)).toEqual({ crisis: false })
  })

  it('answers with one calm, plain line that points to emergency help and a crisis line', () => {
    expect(CRISIS_MESSAGE.choices).toEqual([])
    expect(CRISIS_MESSAGE.text).toMatch(/emergency/i)
    expect(CRISIS_MESSAGE.text).toMatch(/suicide and crisis line/i)
    expect(CRISIS_MESSAGE.text.length).toBeLessThanOrEqual(120)
  })
})

describe('createCoachBrain: the crisis gate runs before any transport', () => {
  it('a crisis hit answers with the crisis line and never reaches the transport', () => {
    const transport = vi.fn(() => null)
    const gate = vi.fn(keywordCrisisGate)
    const brain = createCoachBrain({ enabled: true, crisisGate: gate, transport })
    expect(brain.ask("I can't go on", ctx)).toEqual(CRISIS_MESSAGE)
    expect(gate).toHaveBeenCalledWith("I can't go on")
    expect(transport).not.toHaveBeenCalled()
  })

  it('the gate runs even when the LLM path is off', () => {
    const brain = createCoachBrain({ enabled: false, crisisGate: keywordCrisisGate })
    expect(brain.ask('thinking about suicide', ctx)).toEqual(CRISIS_MESSAGE)
  })

  it('other text goes to the transport only when enabled; off, Loti has no free-text answer', () => {
    const reply = { id: 'llm', text: 'Hello!', choices: [] }
    const transport = vi.fn(() => reply)
    expect(createCoachBrain({ enabled: true, crisisGate: keywordCrisisGate, transport }).ask('hi', ctx)).toBe(reply)
    expect(transport).toHaveBeenCalledWith('hi', ctx)
    transport.mockClear()
    expect(createCoachBrain({ enabled: false, crisisGate: keywordCrisisGate, transport }).ask('hi', ctx)).toBeNull()
    expect(transport).not.toHaveBeenCalled()
  })

  it('chips still come from the script, enabled or not', () => {
    const brain = createCoachBrain({ enabled: true, crisisGate: keywordCrisisGate })
    expect(brain.opening(ctx)).toEqual(scriptedBrain.opening(ctx))
    expect(brain.respond('day', 'great', ctx)).toEqual(scriptedBrain.respond('day', 'great', ctx))
  })
})
