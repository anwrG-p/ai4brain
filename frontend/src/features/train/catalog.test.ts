import { describe, expect, it } from 'vitest'
import { EXERCISE_NAME } from '../assessment/names'
import { PILLAR_IDS, pillarScores, pillarTraining, type PillarScore, type PillarId } from '../insights/pillars'
import { TRAIN_EXERCISES, startPath, trainOrder, weakestPillar } from './catalog'

const score = (s: number | null): PillarScore => ({ score: s, uncertainty: 10, coverage: s === null ? 0 : 1, proxies: [] })
const scores = (values: Record<PillarId, number | null>) =>
  Object.fromEntries(PILLAR_IDS.map((p) => [p, score(values[p])])) as Record<PillarId, PillarScore>

describe('Train catalog', () => {
  it('lists every exercise under exactly one pillar', () => {
    const listed = PILLAR_IDS.flatMap((p) => TRAIN_EXERCISES[p])
    expect([...listed].sort()).toEqual(Object.keys(EXERCISE_NAME).sort())
  })

  it('gives every pillar an exercise, first the one the pillar math practises', () => {
    for (const p of PILLAR_IDS) {
      expect(TRAIN_EXERCISES[p][0]).toBe(pillarTraining(p)?.schema)
    }
  })

  it('links each exercise to the runner, under a dimension of the active set', () => {
    expect(startPath('stroop')).toBe('/task/inhibition_control?schema=stroop')
    expect(startPath('n_back')).toBe('/task/working_memory?schema=n_back')
    expect(startPath('mental_rotation')).toBe('/task/visuospatial_planning_gf?schema=mental_rotation')
    expect(startPath('mst', '6')).toBe('/task/episodic_pattern_separation?schema=mst')
    expect(startPath('mst', '3')).toBeNull() // the 3-dimension set has no such exercise
  })

  it('finds the weakest scored pillar; ties keep the pillar order; none without scores', () => {
    expect(weakestPillar(scores({ focus: 80, agility: 60, impulse: 70, memory: 50, visual: 35 }))).toBe('visual')
    expect(weakestPillar(scores({ focus: 40, agility: null, impulse: 40, memory: 90, visual: null }))).toBe('focus')
    expect(weakestPillar(scores({ focus: null, agility: null, impulse: null, memory: null, visual: null }))).toBeNull()
    expect(weakestPillar(pillarScores({}))).toBeNull()
  })

  it('looks for the weakest only among the pillars on the page', () => {
    const all = scores({ focus: 80, agility: 60, impulse: 70, memory: 50, visual: 35 })
    expect(weakestPillar(all, ['agility', 'impulse'])).toBe('agility')
    expect(weakestPillar(all, [])).toBeNull()
  })

  it('puts the chosen pillar first and keeps the rest in order', () => {
    expect(trainOrder('memory')).toEqual(['memory', 'focus', 'agility', 'impulse', 'visual'])
    expect(trainOrder(null)).toEqual([...PILLAR_IDS])
  })

  it('orders only the pillars on the page', () => {
    expect(trainOrder('impulse', ['agility', 'impulse'])).toEqual(['impulse', 'agility'])
    expect(trainOrder('memory', ['agility', 'impulse'])).toEqual(['agility', 'impulse'])
  })
})
