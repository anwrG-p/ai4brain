import { act, cleanup, fireEvent, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import type { TrialRecorder } from './tracker'
import { useInputCapture } from './useInputCapture'

let input: ReturnType<typeof vi.fn>
let recorder: TrialRecorder

beforeEach(() => {
  vi.useFakeTimers()
  input = vi.fn()
  recorder = { input } as unknown as TrialRecorder
})

afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

test('keydown and pointerdown record inputs; key repeat is ignored', () => {
  renderHook(() => useInputCapture(recorder, true))
  fireEvent.keyDown(window, { key: 'a' })
  fireEvent.keyDown(window, { key: 'a', repeat: true })
  fireEvent.keyDown(window, { key: 'a', repeat: true })
  fireEvent.pointerDown(window)
  expect(input).toHaveBeenCalledTimes(2)
})

test('pointermove is throttled to one input per 50 ms', () => {
  renderHook(() => useInputCapture(recorder, true))
  for (let k = 0; k < 5; k++) {
    fireEvent.pointerMove(window)
    act(() => void vi.advanceTimersByTime(9))
  }
  expect(input).toHaveBeenCalledTimes(1)
  act(() => void vi.advanceTimersByTime(5)) // 50 ms after the first move
  fireEvent.pointerMove(window)
  expect(input).toHaveBeenCalledTimes(2)
})

test('records the input before bubble-phase handlers see the event', () => {
  renderHook(() => useInputCapture(recorder, true))
  const order: string[] = []
  input.mockImplementation(() => void order.push('input'))
  const onKey = () => void order.push('handler')
  window.addEventListener('keydown', onKey)
  fireEvent.keyDown(document.body, { key: 'f' })
  window.removeEventListener('keydown', onKey)
  expect(order).toEqual(['input', 'handler'])
})

test('no listeners while inactive or after unmount', () => {
  const { rerender, unmount } = renderHook(({ active }) => useInputCapture(recorder, active), {
    initialProps: { active: false },
  })
  fireEvent.keyDown(window, { key: 'a' })
  fireEvent.pointerDown(window)
  fireEvent.pointerMove(window)
  expect(input).not.toHaveBeenCalled()
  rerender({ active: true })
  fireEvent.keyDown(window, { key: 'a' })
  expect(input).toHaveBeenCalledTimes(1)
  rerender({ active: false })
  fireEvent.keyDown(window, { key: 'a' })
  rerender({ active: true })
  unmount()
  fireEvent.keyDown(window, { key: 'a' })
  fireEvent.pointerDown(window)
  expect(input).toHaveBeenCalledTimes(1)
})
