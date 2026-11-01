import { describe, expect, it } from 'vitest'
import { lintCopyText } from '../../utils/copyLinter'
import { PILLAR_IDS } from '../insights/pillars'
import { TRAIN_EXERCISES } from '../train/catalog'
import { EXERCISE_NAME } from './exercises'
import { howToPlay, stepParts, words } from './howToPlay'
import fixtures from './tasks/fixtures.json'
import type { NBackParams, PalParams, SchemaType, StroopParams, TaskPayload } from './telemetry/types'
import { KEYS as ROTATION_KEYS } from './tasks/MentalRotation'
import { KEYS as MST_KEYS } from './tasks/Mst'
import { KEYS as NBACK_KEYS } from './tasks/NBack'
import { KEYS as RELATIONAL_KEYS } from './tasks/Relational'
import { DIR_KEYS, LETTER_KEYS } from './tasks/Ufov'
import { ARROW_KEYS } from './tasks/useFixatedTrials'
import { boxForKey } from './tasks/PairedAssociates'

const SCHEMAS = Object.keys(EXERCISE_NAME) as SchemaType[]
const task = (s: SchemaType) => (fixtures as TaskPayload[]).find((t) => t.schema_type === s)!

describe('How to play (INT-1 item 13)', () => {
  it.each(SCHEMAS)('%s: 2-3 steps of at most 8 words, a caption of at most 6, a pillar, at most 2 "More" lines', (s) => {
    const h = howToPlay(task(s))!
    expect(h.steps.length).toBeGreaterThanOrEqual(2)
    expect(h.steps.length).toBeLessThanOrEqual(3)
    for (const step of h.steps) expect(words(step), step).toBeLessThanOrEqual(8)
    expect(words(h.caption)).toBeGreaterThan(0)
    expect(words(h.caption), h.caption).toBeLessThanOrEqual(6)
    expect(PILLAR_IDS).toContain(h.pillar)
    expect(h.more.length).toBeGreaterThanOrEqual(1)
    expect(h.more.length).toBeLessThanOrEqual(2)
    for (const line of h.more) expect(words(line), line).toBeLessThanOrEqual(12)
  })

  it.each(SCHEMAS)('%s: trains the pillar the Train page lists it under', (s) => {
    const h = howToPlay(task(s))!
    expect(TRAIN_EXERCISES[h.pillar]).toContain(s)
  })

  it('consumer wording only: lint:copy passes, no brain areas, no improvement claims', () => {
    const copy = SCHEMAS.flatMap((s) => {
      const h = howToPlay(task(s))!
      return [...h.steps, h.caption, ...h.more]
    }).join('\n')
    expect(lintCopyText(copy).violations).toEqual([])
    expect(copy).not.toMatch(/brain|cortex|hippocamp|neur|improv|boost|smarter|sharpen|train your/i)
  })

  it('names the keys the exercises actually read', () => {
    const keys = (s: SchemaType) => howToPlay(task(s))!.steps.flatMap(stepParts).flatMap((p) => (typeof p === 'string' ? [] : [p.key]))
    const caps = (m: Record<string, unknown>) => Object.keys(m).map((k) => k.toUpperCase())
    const ends = (xs: string[]) => [xs[0]!, xs[xs.length - 1]!] // a range is written [first]–[last]
    expect(keys('n_back')).toEqual(caps(NBACK_KEYS))
    const { colors } = task('stroop').params as StroopParams
    expect(keys('stroop')).toEqual(['1', String(colors.length)]) // Stroop.tsx: digit k picks colors[k - 1]
    expect(keys('relational')).toEqual(caps(RELATIONAL_KEYS))
    expect(keys('ufov')).toEqual([...LETTER_KEYS, ...ends(DIR_KEYS)])
    expect(keys('mst')).toEqual(ends(Object.keys(MST_KEYS)))
    expect(keys('mental_rotation')).toEqual(caps(ROTATION_KEYS))
    expect(keys('tower')).toEqual([])
    expect(keys('matrix')).toEqual([])
    // The arrow exercises read ArrowLeft / ArrowRight (tasks/useFixatedTrials.ts ARROW_KEYS).
    const arrows = Object.values(ARROW_KEYS).map((d) => (d === 'left' ? '←' : '→'))
    expect(keys('stop_signal')).toEqual(arrows)
    expect(keys('flanker')).toEqual(arrows)
    // Pair Finder: digit k picks box k (PairedAssociates.tsx boxForKey), 1 to the box count.
    const { boxes } = task('pal').params as PalParams
    expect(keys('pal')).toEqual(['1', String(boxes)])
    expect([boxForKey('1', boxes), boxForKey(String(boxes), boxes), boxForKey(String(boxes + 1), boxes)]).toEqual([0, boxes - 1, null])
  })

  it('N-back follows its task: n and the streams it plays', () => {
    const base = task('n_back')
    const one = { ...base, params: { ...(base.params as NBackParams), n: 3, streams: ['position'] } } as TaskPayload
    expect(howToPlay(one)!.steps).toEqual(['Place matches 3 back? Tap or press [A].', 'No match? Do nothing.'])
    expect(howToPlay(one)!.caption).toBe('Same place and symbol, 3 back')
  })

  it('N-back with both streams: only the rule shown counts (R16, as the on-screen hint says)', () => {
    expect(howToPlay(task('n_back'))!.steps).toEqual([
      'Place rule: 2 back? Tap or press [A].',
      'Symbol rule: 2 back? Tap or press [L].',
      'Anything else? Do nothing.',
    ])
  })

  it('N-back names only the rules its trials use, parity included', () => {
    const base = task('n_back')
    const p = base.params as NBackParams
    const withRules = (rules: NBackParams['trials'][number]['rule'][], streams = p.streams) =>
      howToPlay({ ...base, params: { ...p, streams, trials: rules.map((rule) => ({ ...p.trials[0]!, rule })) } } as TaskPayload)!.steps
    // One rule in a two-stream task: the other stream's matches are still lures.
    expect(withRules(['symbol'])).toEqual(['Symbol matches 2 back? Tap or press [L].', 'Anything else? Do nothing.'])
    expect(withRules(['position', 'parity'])).toEqual([
      'Place rule: 2 back? Tap or press [A].',
      'Parity rule: even number? Tap or press [L].',
      'Anything else? Do nothing.',
    ])
    expect(withRules(['parity'], ['symbol'])).toEqual(['Even number? Tap or press [L].', 'Anything else? Do nothing.'])
    // A parity rule without the symbol stream has no key to answer with: not named.
    expect(withRules(['position', 'parity'], ['position'])).toEqual(['Place matches 2 back? Tap or press [A].', 'No match? Do nothing.'])
    // All three rules: one step points at the hint, so the steps stay at 3.
    expect(withRules(['position', 'symbol', 'parity'])).toEqual([
      'Follow the rule above the grid.',
      'Its match? Tap or press [A] or [L].',
      'Anything else? Do nothing.',
    ])
    for (const rules of [['position', 'parity'], ['position', 'symbol', 'parity'], ['parity']] as const)
      for (const s of withRules([...rules])) expect(words(s), s).toBeLessThanOrEqual(8)
  })

  it('an unknown exercise has none', () => {
    expect(howToPlay({ ...task('stroop'), schema_type: 'bogus' } as unknown as TaskPayload)).toBeNull()
  })

  it('counts words without brackets or lone arrows', () => {
    expect(words('Tap the ink color, or press [1]–[4].')).toBe(7)
    expect(words('RED in blue ink → blue')).toBe(5)
    expect(stepParts('Press [A] now')).toEqual(['Press ', { key: 'A' }, ' now'])
  })
})
