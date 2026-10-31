import { act, renderHook } from '@testing-library/react'
import { createElement, type ReactNode } from 'react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it } from 'vitest'
import type { DimensionPresetKey } from '../../config/dimensions'
import { useGoalsStore } from '../insights/goals'
import { useSessionStore } from '../insights/sessionStore'
import { trainPath, useLotiActions } from './useLotiActions'

afterEach(() => {
  useGoalsStore.getState().clearGoals()
  useSessionStore.getState().clearSessions()
  localStorage.clear()
})

describe('useLotiActions setGoal', () => {
  const wrapper = ({ children }: { children: ReactNode }) =>
    createElement(MemoryRouter, { future: { v7_startTransition: true, v7_relativeSplatPath: true } }, children)

  it('stores the pillar current score as the goal base, or none when the pillar is not measured', () => {
    useSessionStore.setState({
      sessions: [{ id: 'a', at: new Date().toISOString(), inputs: { MST_LDI: { score: 52, trials: 40 } } }],
    })
    const { result } = renderHook(() => useLotiActions(), { wrapper })
    act(() => result.current({ kind: 'setGoal', pillar: 'memory', target: 10 }))
    act(() => result.current({ kind: 'setGoal', pillar: 'visual', target: 5 }))
    expect(useGoalsStore.getState().goals).toEqual({ memory: 10, visual: 5 })
    expect(useGoalsStore.getState().bases).toEqual({ memory: 52 })
  })
})

describe('trainPath', () => {
  it.each<[Parameters<typeof trainPath>[0], string]>([
    [{ kind: 'train', schemaType: 'tower' }, '/task/visuospatial_planning_gf?schema=tower'],
    [{ kind: 'train', schemaType: 'stroop', pillar: 'memory' }, '/task/inhibition_control?schema=stroop'],
    // A pillar alone opens /train on that pillar; nothing goes to the redirected /assessment.
    [{ kind: 'train', pillar: 'focus' }, '/train?pillar=focus'],
    [{ kind: 'train', pillar: 'agility' }, '/train?pillar=agility'],
    [{ kind: 'train', pillar: 'impulse' }, '/train?pillar=impulse'],
    [{ kind: 'train', pillar: 'memory' }, '/train?pillar=memory'],
    [{ kind: 'train', pillar: 'visual' }, '/train?pillar=visual'],
    [{ kind: 'train' }, '/train'],
  ])('%j -> %s on the default preset', (action, path) => {
    expect(trainPath(action)).toBe(path)
  })

  it.each<[Parameters<typeof trainPath>[0], DimensionPresetKey, string]>([
    [{ kind: 'train', pillar: 'visual' }, '6', '/train?pillar=visual'],
    [{ kind: 'train', pillar: 'visual' }, '3', '/train?pillar=visual'],
    [{ kind: 'train', schemaType: 'tower' }, '6', '/train'],
    [{ kind: 'train', schemaType: 'tower', pillar: 'impulse' }, '6', '/train?pillar=impulse'],
    [{ kind: 'train', schemaType: 'n_back' }, '3', '/task/working_memory?schema=n_back'],
  ])('%j on preset %s -> %s', (action, preset, path) => {
    expect(trainPath(action, preset)).toBe(path)
  })
})
