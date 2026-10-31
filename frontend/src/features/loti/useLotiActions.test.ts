import { describe, expect, it } from 'vitest'
import type { DimensionPresetKey } from '../../config/dimensions'
import { trainPath } from './useLotiActions'

describe('trainPath', () => {
  it.each<[Parameters<typeof trainPath>[0], string]>([
    [{ kind: 'train', schemaType: 'tower' }, '/task/visuospatial_planning_gf?schema=tower'],
    [{ kind: 'train', schemaType: 'stroop', pillar: 'memory' }, '/task/inhibition_control?schema=stroop'],
    [{ kind: 'train', pillar: 'focus' }, '/task/visuospatial_planning_gf?schema=tower'],
    [{ kind: 'train', pillar: 'agility' }, '/task/cognitive_flexibility?schema=n_back'],
    [{ kind: 'train', pillar: 'impulse' }, '/task/inhibition_control?schema=stroop'],
    [{ kind: 'train', pillar: 'memory' }, '/task/episodic_pattern_separation?schema=mst'],
    [{ kind: 'train', pillar: 'visual' }, '/task/attention_networks?schema=ufov'],
    [{ kind: 'train' }, '/assessment'],
  ])('%j -> %s on the default preset', (action, path) => {
    expect(trainPath(action)).toBe(path)
  })

  it.each<[Parameters<typeof trainPath>[0], DimensionPresetKey, string]>([
    [{ kind: 'train', pillar: 'visual' }, '6', '/task/attention?schema=ufov'],
    [{ kind: 'train', pillar: 'focus' }, '6', '/task/working_memory?schema=n_back'],
    [{ kind: 'train', pillar: 'visual' }, '3', '/assessment'],
    [{ kind: 'train', schemaType: 'tower' }, '6', '/assessment'],
    [{ kind: 'train', schemaType: 'tower', pillar: 'impulse' }, '6', '/task/inhibitory_control?schema=stroop'],
    [{ kind: 'train', schemaType: 'n_back' }, '3', '/task/working_memory?schema=n_back'],
  ])('%j on preset %s -> %s', (action, preset, path) => {
    expect(trainPath(action, preset)).toBe(path)
  })
})
