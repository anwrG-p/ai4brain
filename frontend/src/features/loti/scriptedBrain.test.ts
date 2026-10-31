import { describe, expect, it } from 'vitest'
import { PILLAR_IDS, PILLAR_LABELS } from '../insights/pillars'
import { scriptedBrain, MAX_MESSAGE_CHARS } from './scriptedBrain'
import type { LotiContext, LotiMessage } from './types'

// 2026-10-28 is a Wednesday. Hours are local time.
const at = (iso: string) => new Date(iso)
const base: LotiContext = {
  now: at('2026-10-28T15:00:00'),
  hasGoalsThisYear: true,
  sessionsThisWeek: 1,
}

describe('scriptedBrain.opening', () => {
  it.each<[string, Partial<LotiContext>, string]>([
    ['January without goals opens the goals talk', { now: at('2026-01-05T15:00:00'), hasGoalsThisYear: false }, 'goals'],
    ['January with goals moves on', { now: at('2026-01-05T15:00:00'), weakestPillar: 'memory' }, 'weakest'],
    ['goals missing outside January does not open the goals talk', { hasGoalsThisYear: false }, 'day'],
    ['a tired mood is asked, not pushed', { mood: 'tired', weakestPillar: 'focus' }, 'day'],
    ['a frustrated mood is asked, not pushed', { mood: 'frustrated', now: at('2026-10-30T21:00:00') }, 'day'],
    ['Friday night nudges toward goals', { now: at('2026-10-30T21:00:00') }, 'weekend'],
    ['Saturday night nudges toward goals', { now: at('2026-10-31T19:00:00'), weakestPillar: 'visual' }, 'weekend'],
    ['weekend night skips the nudge once the week is full', { now: at('2026-10-31T19:00:00'), sessionsThisWeek: 4 }, 'day'],
    ['a weakest pillar is offered', { weakestPillar: 'impulse' }, 'weakest'],
    ['a morning gets the sunshine nudge', { now: at('2026-10-28T08:00:00') }, 'sunshine'],
    ['any other time asks about the day', {}, 'day'],
  ])('%s', (_name, patch, expected) => {
    expect(scriptedBrain.opening({ ...base, ...patch })?.id).toBe(expected)
  })

  it('names the weakest pillar in plain words', () => {
    const msg = scriptedBrain.opening({ ...base, weakestPillar: 'agility' })
    expect(msg?.text).toContain('Mental Agility')
    expect(msg?.choices[0]?.action).toEqual({ kind: 'train', pillar: 'agility' })
  })
})

describe('scriptedBrain.respond', () => {
  const ctx: LotiContext = { ...base, weakestPillar: 'memory' }

  it.each<[string, string, string | null]>([
    ['goals', 'start', 'goal-pick'],
    ['day', 'great', 'day-great'],
    ['day', 'okay', 'day-okay'],
    ['day', 'tough', 'day-tough'],
    ['day-great', 'yes', null],
    ['day-okay', 'yes', null],
    ['weakest', 'yes', null],
    ['weekend', 'yes', null],
    ['sunshine', 'yes', null],
    ['goal-pick', 'visual', 'goal-size:visual'],
    ['goal-size:visual', '10', 'goal-set:visual:10'],
    ['goal-set:visual:10', 'another', 'goal-pick'],
    ['goal-set:visual:10', 'done', null],
    ['day', 'no-such-choice', null],
    ['no-such-node', 'yes', null],
  ])('%s / %s -> %s', (nodeId, choiceId, expected) => {
    expect(scriptedBrain.respond(nodeId, choiceId, ctx)?.id ?? null).toBe(expected)
  })

  it('training choices carry the weakest pillar, or none when it is unknown', () => {
    const train = (c: LotiContext) => scriptedBrain.respond('day', 'great', c)?.choices[0]?.action
    expect(train(ctx)).toEqual({ kind: 'train', pillar: 'memory' })
    expect(train(base)).toEqual({ kind: 'train' })
  })

  it('goal sizes set a goal for the picked pillar', () => {
    const size = scriptedBrain.respond('goal-pick', 'focus', ctx)
    expect(size?.text).toContain('Focus & Strategy')
    expect(size?.choices.map((c) => c.action)).toEqual([
      { kind: 'setGoal', pillar: 'focus', target: 5 },
      { kind: 'setGoal', pillar: 'focus', target: 10 },
      { kind: 'setGoal', pillar: 'focus', target: 15 },
    ])
    expect(scriptedBrain.respond('goal-size:focus', '15', ctx)?.text).toContain('15')
  })

  it('offers every pillar when picking a goal', () => {
    const pick = scriptedBrain.respond('goals', 'start', ctx)
    expect(pick?.choices.map((c) => c.label)).toEqual(PILLAR_IDS.map((p) => PILLAR_LABELS[p]))
  })

  it('ends a tough day kindly, with no push to train', () => {
    expect(scriptedBrain.respond('day', 'great', ctx)?.text).toBe('Good to hear! Want to put some time into training?')
    const tough = scriptedBrain.respond('day', 'tough', ctx)
    expect(tough?.choices).toEqual([])
  })
})

/** Every message reachable from every opening context, walking every choice. */
function allMessages(): LotiMessage[] {
  const contexts: LotiContext[] = [
    { ...base, now: at('2026-01-05T15:00:00'), hasGoalsThisYear: false },
    { ...base, now: at('2026-10-30T21:00:00') },
    { ...base, now: at('2026-10-28T08:00:00') },
    { ...base, mood: 'tired' },
    ...PILLAR_IDS.map((weakestPillar) => ({ ...base, weakestPillar })),
  ]
  const seen = new Map<string, LotiMessage>()
  for (const ctx of contexts) {
    const queue: LotiMessage[] = []
    const first = scriptedBrain.opening(ctx)
    if (first) queue.push(first)
    while (queue.length) {
      const msg = queue.shift()!
      const key = `${msg.id}|${msg.text}`
      if (seen.has(key)) continue
      seen.set(key, msg)
      for (const choice of msg.choices) {
        const next = scriptedBrain.respond(msg.id, choice.id, ctx)
        if (next) queue.push(next)
      }
    }
  }
  return [...seen.values()]
}

// The lint:copy clinical and guilt terms, the anti-slop hype list, brain regions and chemical claims.
const BANNED: RegExp[] = [
  /\b(adhd|dementia|autism|diagnos\w*|disorders?|deficits?|impair\w*|patholog\w*|symptoms?|patients?|iq)\b/i,
  /\b(anxiety|depression|dyslexia|alzheimer|abnormal|below average|lazy|weak|behind|failed|streak)\b/i,
  /\b(unlock|supercharge|revolutioni[sz]e|ai-powered|magic|seamless|next-level|elevate|empower)\w*/i,
  /✨/u,
  /\b(cortex|cortical|prefrontal|hippocamp\w*|amygdala|cerebell\w*|lobe|striatum|thalamus|neurons?)\b/i,
  /\b(dopamine|serotonin|cortisol|oxytocin|endorphins?|adrenaline|neurotransmitters?|neuroplastic\w*)\b/i,
]

describe('script copy', () => {
  const messages = allMessages()

  it('walks a real conversation graph', () => {
    expect(messages.length).toBeGreaterThan(15)
  })

  it.each(messages.map((m) => [m.id, m] as const))('%s fits in one bubble', (_id, msg) => {
    expect(msg.text.length).toBeLessThanOrEqual(MAX_MESSAGE_CHARS)
    expect(MAX_MESSAGE_CHARS).toBe(120)
  })

  it.each(messages.map((m) => [m.id, m.text] as const))('%s stays short: at most 14 words (rule 4)', (_id, text) => {
    expect(text.split(/\s+/).filter(Boolean).length).toBeLessThanOrEqual(14)
  })

  it('makes no claim about where a goal shows up (rule 12)', () => {
    for (const m of messages) expect(m.text).not.toMatch(/dashboard/i)
  })

  it('has no banned, hype, brain-region or chemical words', () => {
    const text = messages.flatMap((m) => [m.text, ...m.choices.map((c) => c.label)])
    for (const t of text) for (const re of BANNED) expect(t, t).not.toMatch(re)
  })
})
