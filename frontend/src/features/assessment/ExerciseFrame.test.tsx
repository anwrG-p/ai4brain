import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { EXERCISE_NAME } from './exercises'
import { ExerciseFrame, FIXATION_MS } from './ExerciseFrame'
import fixtures from './tasks/fixtures.json'
import { TaskRunner } from './tasks/TaskRunner'
import { tracker, TrialRecorder } from './telemetry/tracker'
import type { SchemaType, TaskPayload } from './telemetry/types'

const byType = (s: SchemaType) => (fixtures as TaskPayload[]).find((t) => t.schema_type === s)!

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
  tracker.clear()
})

// The real exercise inside the frame, as ExerciseHost mounts it.
function setup(schema: SchemaType = 'stroop') {
  const task = byType(schema)
  const recorder = new TrialRecorder({ ...task, user_id: 'u', session_id: 's', voice_opt_in: false })
  const start = vi.spyOn(recorder, 'start')
  const push = vi.spyOn(tracker, 'push') // calls through, so tracker.onEvent listeners still hear it
  const onDone = vi.fn()
  const view = render(
    <ExerciseFrame task={task} onDone={onDone}>
      {(end) => <TaskRunner task={task} recorder={recorder} onDone={end} />}
    </ExerciseFrame>,
  )
  return { ...view, task, start, push, onDone }
}

const space = () => act(() => void fireEvent.keyDown(window, { key: ' ' }))
const advance = (ms: number) => act(() => void vi.advanceTimersByTime(ms))
const region = () => screen.queryByRole('region', { name: 'Color Clash' })

test('the instruction screen: name, one line, how to play, the demo with its caption, the pillar, More', () => {
  const { container } = setup('stroop')
  expect(screen.getByRole('heading', { name: 'Color Clash' })).toBeInTheDocument()
  expect(screen.getByText('Pick the color of the ink, not the word.')).toBeInTheDocument()
  expect(screen.queryByText(/aloud/)).toBeNull() // the non-voice instruction (voice is not ported)
  // How to play: an ordered list of steps, keys as keycaps.
  const steps = within(screen.getByRole('list', { name: 'How to play' })).getAllByRole('listitem')
  expect(container.querySelector('ol[aria-label="How to play"]')).not.toBeNull()
  expect(steps.map((li) => li.textContent)).toEqual(['Ignore what the word says.', 'Tap the ink color, or press 1–4.'])
  const keys = [...container.querySelectorAll('kbd')].map((k) => k.textContent)
  expect(keys).toEqual(['1', '4', 'Space'])
  // The caption is visible but hidden from screen readers (the steps already say it), like the demo.
  const caption = screen.getByText('RED in blue ink → blue')
  expect(caption.closest('[aria-hidden="true"]')).not.toBeNull()
  expect(screen.getByText('Trains: Impulse Control')).toBeInTheDocument()
  // More: one quiet disclosure, closed.
  const more = container.querySelectorAll('details')
  expect(more).toHaveLength(1)
  expect(more[0]!.open).toBe(false)
  expect(more[0]!.querySelector('summary')).toHaveTextContent('More about this')
  expect(more[0]).toHaveTextContent('It measures holding back a habit: reading.')
  // One button: Begin (anti-slop rule 14); the disclosure is the one quiet control.
  expect(screen.getAllByRole('button').map((b) => b.textContent)).toEqual(['Begin'])
  expect(region()).toBeNull() // the exercise is not mounted yet
  expect(tracker.getStatus().queuedCount).toBe(0) // no telemetry on the instruction screen
})

test.each(Object.keys(EXERCISE_NAME))('%s: its instruction screen has how-to-play steps, a caption, a pillar and a closed More', (schema) => {
  const { container } = setup(schema as SchemaType)
  const items = within(screen.getByRole('list', { name: 'How to play' })).getAllByRole('listitem')
  expect(items.length).toBeGreaterThanOrEqual(2)
  expect(items.length).toBeLessThanOrEqual(3)
  expect(screen.getByText(/^Trains: /)).toBeInTheDocument()
  expect(container.querySelector('[data-demo-caption]')?.textContent).toBeTruthy()
  expect(container.querySelector('details')!.open).toBe(false)
})

test('Space starts the exercise after a 500 ms fixation cross', () => {
  setup('stroop')
  space()
  expect(screen.queryByRole('button', { name: 'Begin' })).toBeNull()
  expect(screen.getByRole('img', { name: 'Look at the cross' })).toHaveTextContent('+')
  advance(FIXATION_MS - 1)
  expect(region()).toBeNull()
  advance(1)
  expect(screen.queryByRole('img', { name: 'Look at the cross' })).toBeNull()
  expect(region()).toBeInTheDocument()
  expect(FIXATION_MS).toBe(500)
})

test('Enter starts it too; a held key does not', () => {
  setup('stroop')
  act(() => void fireEvent.keyDown(window, { key: ' ', repeat: true }))
  expect(screen.getByRole('button', { name: 'Begin' })).toBeInTheDocument()
  act(() => void fireEvent.keyDown(window, { key: 'Enter' }))
  expect(screen.getByRole('img', { name: 'Look at the cross' })).toBeInTheDocument()
})

test('the Begin button starts it', () => {
  setup('matrix')
  act(() => void fireEvent.click(screen.getByRole('button', { name: 'Begin' })))
  advance(FIXATION_MS)
  expect(screen.getByRole('region', { name: 'Pattern Puzzle' })).toBeInTheDocument()
})

test('focus: Begin on the instruction screen, then the trial area, then Continue', () => {
  const task = byType('matrix')
  render(
    <ExerciseFrame task={task} onDone={vi.fn()}>
      {(end) => (
        <section aria-label="Pattern Puzzle">
          <button type="button" onClick={end}>
            finish
          </button>
        </section>
      )}
    </ExerciseFrame>,
  )
  // Focused Begin: native Space/Enter activate it (the window listener leaves focused controls alone).
  expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Begin' }))
  space()
  advance(FIXATION_MS)
  const area = document.activeElement as HTMLElement
  expect(area).not.toBe(document.body)
  expect(area.contains(screen.getByRole('region', { name: 'Pattern Puzzle' }))).toBe(true)
  expect(area.tabIndex).toBe(-1) // focusable by script only, never a tab stop
  act(() => void fireEvent.click(screen.getByRole('button', { name: 'finish' })))
  expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Continue' }))
})

test('Space on a focused control stays with that control', () => {
  const task = byType('stroop')
  render(
    <>
      <button type="button">Pause</button>
      <ExerciseFrame task={task} onDone={vi.fn()}>
        {() => null}
      </ExerciseFrame>
    </>,
  )
  act(() => void fireEvent.keyDown(screen.getByRole('button', { name: 'Pause' }), { key: ' ' }))
  expect(screen.getByRole('button', { name: 'Begin' })).toBeInTheDocument()
})

test('no trial starts and no telemetry event is sent during the instruction or the fixation', () => {
  const { start, push } = setup('stroop')
  advance(10_000) // idle on the instruction screen: Stroop's 2.5 s limit would have fired
  space()
  advance(FIXATION_MS - 1)
  expect(start).not.toHaveBeenCalled()
  expect(push).not.toHaveBeenCalled()
  advance(1)
  expect(start).toHaveBeenCalledWith(0)
})

test('the progress dots advance as trials finish (n of N)', () => {
  const { task } = setup('stroop')
  space()
  advance(FIXATION_MS)
  const bar = screen.getByRole('progressbar', { name: 'Progress' })
  const n = (task.params as { trials: unknown[] }).trials.length
  expect(bar).toHaveAttribute('aria-valuemax', String(n))
  expect(bar).toHaveAttribute('aria-valuenow', '0')
  expect(bar.querySelectorAll('[data-dot]')).toHaveLength(n)
  expect(bar.querySelectorAll('[data-dot="done"]')).toHaveLength(0)

  act(() => void fireEvent.pointerDown(screen.getAllByRole('button')[0]!))
  expect(bar).toHaveAttribute('aria-valuenow', '1')
  expect(bar).toHaveAttribute('aria-valuetext', `1 of ${n} done`)
  expect(bar.querySelectorAll('[data-dot="done"]')).toHaveLength(1)
})

test('N-back: two events per trial (one per stream) advance the dots by one', () => {
  const { task } = setup('n_back')
  const p = task.params as { trials: unknown[]; streams: string[]; interval_ms: number }
  expect(p.streams).toHaveLength(2)
  space()
  advance(FIXATION_MS)
  const bar = screen.getByRole('progressbar', { name: 'Progress' })
  expect(bar).toHaveAttribute('aria-valuemax', String(p.trials.length))
  advance(p.interval_ms) // the first trial ends with no press: one event per stream
  expect(bar).toHaveAttribute('aria-valuenow', '1')
})

test('UFOV counts only valid trials, so the dots can complete', () => {
  const base = byType('ufov')
  const p = base.params as { trials: Record<string, unknown>[] }
  const trials = [...p.trials, { ...p.trials[0], central: 'Q' }] // invalid: skipped by the exercise
  const task = { ...base, params: { ...p, trials } }
  render(
    <ExerciseFrame task={task} onDone={vi.fn()}>
      {() => null}
    </ExerciseFrame>,
  )
  space()
  expect(screen.getByRole('progressbar', { name: 'Progress' })).toHaveAttribute('aria-valuemax', String(p.trials.length))
})

test('UFOV skips the frame fixation: it draws its own', () => {
  setup('ufov')
  space()
  expect(screen.queryByRole('img', { name: 'Look at the cross' })).toBeNull()
  expect(screen.getByRole('region', { name: 'Perceptual Radar' })).toBeInTheDocument()
})

test('MST: the instruction comes before its study phase', () => {
  setup('mst')
  expect(screen.queryByText(/Study: item/)).toBeNull()
  space()
  advance(FIXATION_MS)
  expect(screen.getByText('Study: item 1 of 3')).toBeInTheDocument()
})

test('the end card shows one line and a small Loti; Continue (or Space) hands over', () => {
  const task = byType('matrix')
  const onDone = vi.fn()
  const onBlockEnd = vi.fn()
  render(
    <ExerciseFrame task={task} onDone={onDone} onBlockEnd={onBlockEnd}>
      {(end) => (
        <button type="button" onClick={end}>
          finish
        </button>
      )}
    </ExerciseFrame>,
  )
  space()
  advance(FIXATION_MS)
  // No character and no decoration while trials run.
  expect(screen.queryByRole('img', { name: /Loti/ })).toBeNull()
  act(() => void fireEvent.click(screen.getByRole('button', { name: 'finish' })))
  expect(screen.queryByRole('button', { name: 'finish' })).toBeNull()
  expect(screen.getByText('Nice work')).toBeInTheDocument()
  expect(screen.getByRole('img', { name: /Loti/ })).toHaveAttribute('width', '48') // size sm
  expect(onDone).not.toHaveBeenCalled()
  // The host hears the block end at once, so a pause on the end card never discards the block.
  expect(onBlockEnd).toHaveBeenCalledOnce()
  act(() => void fireEvent.keyDown(window, { key: ' ' }))
  expect(onDone).toHaveBeenCalledOnce()
  act(() => void fireEvent.click(screen.getByRole('button', { name: 'Continue' })))
  expect(onDone).toHaveBeenCalledOnce() // once only
})

test.each(Object.entries(EXERCISE_NAME))('%s is introduced as %s', (schema, name) => {
  setup(schema as SchemaType)
  expect(screen.getByRole('heading', { name })).toBeInTheDocument()
})

test('the consumer names are the spec table', () => {
  expect(EXERCISE_NAME).toEqual({
    relational: 'Logic Web',
    n_back: 'Memory Gauntlet',
    tower: 'Strategic Blueprint',
    ufov: 'Perceptual Radar',
    mst: 'Precision Archive',
    stroop: 'Color Clash',
    matrix: 'Pattern Puzzle',
    mental_rotation: 'Shape Turn',
  })
})

test('an unknown exercise ends its block before handing over, so its host still saves the run', () => {
  const task = { ...byType('stroop'), schema_type: 'bogus' } as unknown as TaskPayload
  const calls: string[] = []
  render(
    <ExerciseFrame task={task} onDone={() => calls.push('done')} onBlockEnd={() => calls.push('blockEnd')}>
      {(end) => (
        <button type="button" onClick={end}>
          finish
        </button>
      )}
    </ExerciseFrame>,
  )
  act(() => void fireEvent.click(screen.getByRole('button', { name: 'finish' })))
  expect(calls).toEqual(['blockEnd', 'done'])
})

test('an unknown exercise skips the frame and runs as before', () => {
  const task = { ...byType('stroop'), schema_type: 'bogus' } as unknown as TaskPayload
  render(<ExerciseFrame task={task} onDone={vi.fn()}>{() => <p>raw task</p>}</ExerciseFrame>)
  expect(screen.getByText('raw task')).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Begin' })).toBeNull()
})

// Motion pass (ticket 07b, spec R8): motion lives on the instruction and end screens, never on the
// fixation (R9) or the stimulus. The motion lock ([data-timed-trial]) wraps the exercise only.
test.each(Object.keys(EXERCISE_NAME))('%s: the instruction screen has a small animated demo, hidden from screen readers', (schema) => {
  const { container } = setup(schema as SchemaType)
  const demo = container.querySelector(`[data-demo="${schema}"]`)
  expect(demo).not.toBeNull()
  expect(demo).toHaveAttribute('aria-hidden', 'true')
  expect(demo!.querySelector('[class*="anim-demo-"]')).not.toBeNull()
  expect(screen.getAllByRole('button')).toHaveLength(1) // still Begin only
})

test('the motion lock wraps the exercise only: not the instruction, the dots or the end card', () => {
  const task = byType('matrix')
  const { container } = render(
    <ExerciseFrame task={task} onDone={vi.fn()}>
      {(end) => (
        <section aria-label="Pattern Puzzle">
          <button type="button" onClick={end}>
            finish
          </button>
        </section>
      )}
    </ExerciseFrame>,
  )
  const locked = () => container.querySelector('[data-timed-trial="true"]')
  expect(locked()).toBeNull()
  expect(container.firstElementChild).toHaveClass('anim-slide-in') // a new exercise slides in from the right
  space()
  // R9: the fixation cross appears at once, at full contrast, for its whole 500 ms (no fade or scale).
  expect(container.querySelector('[class*="anim-"]')).toBeNull()
  advance(FIXATION_MS)
  expect(locked()).toContainElement(screen.getByRole('region', { name: 'Pattern Puzzle' }))
  expect(locked()).not.toContainElement(screen.getByRole('progressbar', { name: 'Progress' }))
  // The trial area itself never animates in: the first stimulus shows at full strength at once.
  expect(container.querySelector('[class*="anim-"]')).toBeNull()
  act(() => void fireEvent.click(screen.getByRole('button', { name: 'finish' })))
  expect(locked()).toBeNull()
})

test('a filled progress dot pops once (its class appears with the fill)', () => {
  setup('stroop')
  space()
  advance(FIXATION_MS)
  const bar = screen.getByRole('progressbar', { name: 'Progress' })
  expect(bar.querySelector('.anim-dot-pop')).toBeNull()
  act(() => void fireEvent.pointerDown(screen.getAllByRole('button')[0]!))
  expect(bar.querySelectorAll('[data-dot="done"].anim-dot-pop')).toHaveLength(1)
})

test('the end card: Loti pops in happy with one burst of 6 to 8 sparkles, hidden from screen readers', () => {
  const task = byType('matrix')
  const { container } = render(
    <ExerciseFrame task={task} onDone={vi.fn()}>
      {(end) => (
        <button type="button" onClick={end}>
          finish
        </button>
      )}
    </ExerciseFrame>,
  )
  space()
  advance(FIXATION_MS)
  act(() => void fireEvent.click(screen.getByRole('button', { name: 'finish' })))
  expect(screen.getByRole('img', { name: 'Loti is happy' }).closest('.anim-pop')).not.toBeNull()
  const burst = container.querySelector('[data-burst]')
  expect(burst).toHaveAttribute('aria-hidden', 'true')
  const n = burst!.querySelectorAll('.anim-sparkle').length
  expect(n).toBeGreaterThanOrEqual(6)
  expect(n).toBeLessThanOrEqual(8)
})

// A host pauses only a running block: from Begin (the fixation) to the end card.
test('[data-block-running] marks the fixation and the trials, not the instruction or the end card', () => {
  const task = byType('matrix')
  const { container } = render(
    <ExerciseFrame task={task} onDone={vi.fn()}>
      {(end) => (
        <button type="button" onClick={end}>
          finish
        </button>
      )}
    </ExerciseFrame>,
  )
  const running = () => container.querySelector('[data-block-running="true"]')
  expect(running()).toBeNull()
  space()
  expect(running()).toContainElement(screen.getByRole('img', { name: 'Look at the cross' }))
  advance(FIXATION_MS)
  expect(running()).toContainElement(screen.getByRole('button', { name: 'finish' }))
  act(() => void fireEvent.click(screen.getByRole('button', { name: 'finish' })))
  expect(running()).toBeNull()
})
