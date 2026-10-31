import { describe, expect, it } from 'vitest'
import { trainPath } from './useLotiActions'

describe('trainPath', () => {
  it.each<[Parameters<typeof trainPath>[0], string]>([
    [{ kind: 'train', schemaType: 'tower' }, '/task/visuospatial_planning_gf?schema=tower'],
    [{ kind: 'train', schemaType: 'stroop', pillar: 'memory' }, '/task/inhibition_control?schema=stroop'],
    [{ kind: 'train', pillar: 'focus' }, '/task/visuospatial_planning_gf?schema=tower'],
    [{ kind: 'train', pillar: 'agility' }, '/task/working_memory?schema=n_back'],
    [{ kind: 'train', pillar: 'impulse' }, '/task/inhibition_control?schema=stroop'],
    [{ kind: 'train', pillar: 'memory' }, '/task/episodic_pattern_separation?schema=mst'],
    [{ kind: 'train', pillar: 'visual' }, '/task/attention_networks?schema=ufov'],
    [{ kind: 'train' }, '/assessment'],
  ])('%j -> %s', (action, path) => {
    expect(trainPath(action)).toBe(path)
  })
})
