import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, expect, test, vi } from 'vitest'

const fetchNextTask = vi.fn()
vi.mock('./tasks/taskSource', () => ({ fetchNextTask, getUserId: () => 'u1' }))
const { default: App } = await import('./App')

afterEach(() => {
  cleanup()
  fetchNextTask.mockReset()
})

test('a fetch error shows a message and retry loads the task', async () => {
  fetchNextTask
    .mockRejectedValueOnce(new Error('HTTP 500'))
    .mockResolvedValueOnce({ task_id: 't1', dimension: 'working_memory', schema_type: 'n_back', params: {}, surface_seed: 0 })
  render(<App />)
  await userEvent.click(await screen.findByRole('button', { name: /try again/i }))
  expect(await screen.findByText(/Unsupported task/)).toBeTruthy()
  expect(fetchNextTask).toHaveBeenCalledTimes(2)
  expect(fetchNextTask).toHaveBeenCalledWith('u1')
})
