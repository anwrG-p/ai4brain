import { fireEvent, screen } from '@testing-library/react'
import { FIXATION_MS } from '../features/assessment/ExerciseFrame'

// Test helper (real timers): press Begin on the instruction screen, wait out the fixation, and
// return the running exercise's region. The exercise only mounts after these two screens.
export async function begin(name: string): Promise<HTMLElement> {
  fireEvent.click(await screen.findByRole('button', { name: 'Begin' }))
  return screen.findByRole('region', { name }, { timeout: FIXATION_MS + 1000 })
}
