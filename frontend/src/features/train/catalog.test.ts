import { describe, expect, it } from 'vitest'
import { EXERCISE_NAME } from '../assessment/names'
import { PILLAR_IDS } from '../insights/pillars'
import { TRAIN_EXERCISES, startPath, trainOrder } from './catalog'

describe('Train catalog', () => {
  it('lists every exercise under exactly one pillar', () => {
    const listed = PILLAR_IDS.flatMap((p) => TRAIN_EXERCISES[p])
    expect([...listed].sort()).toEqual(Object.keys(EXERCISE_NAME).sort())
  })

  it('gives every pillar an exercise, first the one that practises it', () => {
    expect(PILLAR_IDS.map((p) => TRAIN_EXERCISES[p][0])).toEqual(['tower', 'n_back', 'stroop', 'mst', 'ufov'])
  })

  it('links each exercise to the runner, under a dimension of the active set', () => {
    expect(startPath('stroop')).toBe('/task/inhibition_control?schema=stroop')
    expect(startPath('n_back')).toBe('/task/working_memory?schema=n_back')
    expect(startPath('mental_rotation')).toBe('/task/visuospatial_planning_gf?schema=mental_rotation')
    expect(startPath('mst', '6')).toBe('/task/episodic_pattern_separation?schema=mst')
    expect(startPath('mst', '3')).toBeNull() // the 3-dimension set has no such exercise
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
