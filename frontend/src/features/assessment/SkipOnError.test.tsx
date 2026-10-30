import { render, screen } from '@testing-library/react'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { SkipOnError } from './SkipOnError'

function Boom(): never {
  throw new Error('bad params')
}

// React dev rethrows render errors through a window 'error' event; jsdom prints those unless cancelled.
const quiet = (e: ErrorEvent) => e.preventDefault()
let errSpy: ReturnType<typeof vi.spyOn>

beforeEach(() => {
  errSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
  window.addEventListener('error', quiet)
})

afterEach(() => {
  window.removeEventListener('error', quiet)
  errSpy.mockRestore()
})

test('renders its children when nothing throws', () => {
  const onSkip = vi.fn()
  render(
    <SkipOnError taskId="t1" onSkip={onSkip}>
      <p>exercise</p>
    </SkipOnError>,
  )
  expect(screen.getByText('exercise')).toBeInTheDocument()
  expect(onSkip).not.toHaveBeenCalled()
})

test('a child that throws while rendering is logged, skipped once, and renders nothing', () => {
  const onSkip = vi.fn()
  const { container } = render(
    <SkipOnError taskId="t1" onSkip={onSkip}>
      <Boom />
    </SkipOnError>,
  )
  expect(onSkip).toHaveBeenCalledOnce()
  expect(container).toBeEmptyDOMElement()
  const ours = errSpy.mock.calls.filter((c: unknown[]) => String(c[0]).startsWith('task t1 failed to render'))
  expect(ours).toHaveLength(1)
})
