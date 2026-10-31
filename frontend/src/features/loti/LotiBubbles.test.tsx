import { act, fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useGoalsStore } from '../insights/goals'
import { LotiBubbles, TALK_MS } from './LotiBubbles'
import { useLotiSession } from './lotiSession'
import type { LotiContext } from './types'

const future = { v7_startTransition: true, v7_relativeSplatPath: true }

// Wednesday afternoon, no weakest pillar: Loti opens with "How was your day?".
const dayCtx: LotiContext = { now: new Date('2026-10-28T15:00:00'), hasGoalsThisYear: true, sessionsThisWeek: 0 }

function Where() {
  const loc = useLocation()
  return <p data-testid="where">{loc.pathname + loc.search}</p>
}

function renderBubbles(context: LotiContext = dayCtx, onAction?: Parameters<typeof LotiBubbles>[0]['onAction']) {
  return render(
    <MemoryRouter initialEntries={['/home']} future={future}>
      <Routes>
        <Route path="*" element={<><LotiBubbles context={context} onAction={onAction} /><Where /></>} />
      </Routes>
    </MemoryRouter>,
  )
}

afterEach(() => {
  vi.useRealTimers()
  useGoalsStore.getState().clearGoals()
  useLotiSession.getState().clear()
  localStorage.clear()
  sessionStorage.clear()
})

describe('LotiBubbles', () => {
  it('shows a small Loti and one bubble, announced politely', () => {
    renderBubbles()
    expect(screen.getAllByRole('img', { name: /loti/i })).toHaveLength(1)
    const text = screen.getByText('How was your day?')
    expect(text.closest('[aria-live="polite"]')).not.toBeNull()
    expect(screen.getAllByRole('group', { name: /reply to loti/i })).toHaveLength(1)
    for (const name of ['Great', 'Okay', 'Tough', 'Not now']) {
      expect(screen.getByRole('button', { name })).toHaveClass('min-h-11')
    }
  })

  it('every reply button is described by the bubble text, so a focused chip reads the question', async () => {
    const user = userEvent.setup()
    renderBubbles()
    for (const name of ['Great', 'Okay', 'Tough', 'Not now']) {
      expect(screen.getByRole('button', { name })).toHaveAccessibleDescription('How was your day?')
    }
    await user.click(screen.getByRole('button', { name: 'Great' }))
    await user.click(screen.getByRole('button', { name: 'Not now' }))
    await user.click(screen.getByRole('button', { name: /continue with loti/i }))
    expect(screen.getByRole('button', { name: /yes, let's train/i })).toHaveFocus()
    expect(screen.getByRole('button', { name: /yes, let's train/i })).toHaveAccessibleDescription(/good to hear/i)
  })

  it('advances the conversation when a chip is clicked', async () => {
    const user = userEvent.setup()
    renderBubbles()
    await user.click(screen.getByRole('button', { name: 'Great' }))
    expect(screen.getByText(/good to hear/i)).toBeInTheDocument()
    expect(screen.queryByText('How was your day?')).toBeNull()
  })

  it('"Not now" dismisses the bubble and the talk can resume where it left off', async () => {
    const user = userEvent.setup()
    renderBubbles()
    await user.click(screen.getByRole('button', { name: 'Great' }))
    await user.click(screen.getByRole('button', { name: 'Not now' }))
    expect(screen.queryByText(/good to hear/i)).toBeNull()
    await user.click(screen.getByRole('button', { name: /continue with loti/i }))
    expect(screen.getByText(/good to hear/i)).toBeInTheDocument()
  })

  it('works from the keyboard: Tab and Enter pick a chip, focus follows, Escape dismisses', async () => {
    const user = userEvent.setup()
    renderBubbles()
    await user.tab()
    expect(screen.getByRole('button', { name: 'Great' })).toHaveFocus()
    await user.tab()
    await user.keyboard('{Enter}')
    expect(screen.getByText(/thanks for telling me/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /let's try one/i })).toHaveFocus()
    await user.keyboard('{Escape}')
    expect(screen.queryByText(/thanks for telling me/i)).toBeNull()
    expect(screen.getByRole('button', { name: /continue with loti/i })).toHaveFocus()
  })

  it('a closing message ends the talk with "Okay", leaving a focused "Talk to Loti" that starts over', async () => {
    const user = userEvent.setup()
    renderBubbles()
    await user.click(screen.getByRole('button', { name: 'Tough' }))
    expect(screen.queryByRole('button', { name: 'Not now' })).toBeNull()
    await user.click(screen.getByRole('button', { name: 'Okay' }))
    expect(screen.queryByRole('group', { name: /reply to loti/i })).toBeNull()
    expect(screen.queryByRole('button', { name: /continue with loti/i })).toBeNull()
    expect(screen.getByRole('button', { name: /talk to loti/i })).toHaveFocus()
    await user.click(screen.getByRole('button', { name: /talk to loti/i }))
    expect(screen.getByText('How was your day?')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Great' })).toHaveFocus()
  })

  it('Escape on a closing line ends the talk without dropping focus to the page', async () => {
    const user = userEvent.setup()
    renderBubbles()
    await user.click(screen.getByRole('button', { name: 'Tough' }))
    await user.keyboard('{Escape}')
    expect(screen.getByRole('button', { name: /talk to loti/i })).toHaveFocus()
    expect(document.body).not.toHaveFocus()
  })

  it('a choice that ends the talk in place leaves "Talk to Loti" focused', async () => {
    const user = userEvent.setup()
    renderBubbles({ ...dayCtx, now: new Date('2026-01-05T15:00:00'), hasGoalsThisYear: false })
    await user.click(screen.getByRole('button', { name: /let's do it/i }))
    await user.click(screen.getByRole('button', { name: 'Visual Radar' }))
    await user.click(screen.getByRole('button', { name: /a little/i }))
    await user.click(screen.getByRole('button', { name: /that's all/i }))
    expect(screen.getByRole('button', { name: /talk to loti/i })).toHaveFocus()
  })

  it('a train choice runs the action and navigates to the exercise', async () => {
    const user = userEvent.setup()
    renderBubbles({ ...dayCtx, weakestPillar: 'memory' })
    await user.click(screen.getByRole('button', { name: /yes/i }))
    expect(screen.getByTestId('where')).toHaveTextContent('/task/episodic_pattern_separation?schema=mst')
  })

  it('hands actions to onAction when given', async () => {
    const user = userEvent.setup()
    const onAction = vi.fn()
    renderBubbles({ ...dayCtx, weakestPillar: 'visual' }, onAction)
    await user.click(screen.getByRole('button', { name: /yes/i }))
    expect(onAction).toHaveBeenCalledWith({ kind: 'train', pillar: 'visual' })
    expect(screen.getByTestId('where')).toHaveTextContent('/home')
  })

  it('a goal choice sets the goal in the goals store', async () => {
    const user = userEvent.setup()
    renderBubbles({ ...dayCtx, now: new Date('2026-01-05T15:00:00'), hasGoalsThisYear: false })
    await user.click(screen.getByRole('button', { name: /let's do it/i }))
    await user.click(screen.getByRole('button', { name: 'Deep Memory' }))
    await user.click(screen.getByRole('button', { name: /steady/i }))
    expect(useGoalsStore.getState().goals).toEqual({ memory: 10 })
    expect(screen.getByText(/goal saved: deep memory, up 10 points/i)).toBeInTheDocument()
  })

  it('Loti talks while each new bubble enters, then settles', () => {
    vi.useFakeTimers()
    renderBubbles()
    expect(screen.getByRole('img', { name: /talking/i })).toBeInTheDocument()
    act(() => vi.advanceTimersByTime(TALK_MS))
    expect(screen.queryByRole('img', { name: /talking/i })).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: 'Great' }))
    expect(screen.getByRole('img', { name: /talking/i })).toBeInTheDocument()
    act(() => vi.advanceTimersByTime(TALK_MS))
    expect(screen.getByRole('img', { name: /happy/i })).toBeInTheDocument()
  })

  it('renders nothing when the brain has nothing to say', () => {
    const { container } = render(
      <MemoryRouter future={future}>
        <LotiBubbles context={dayCtx} brain={{ opening: () => null, respond: () => null }} />
      </MemoryRouter>,
    )
    expect(container).toBeEmptyDOMElement()
  })

  it('records each pick into the session talk, so /coach can continue it', async () => {
    const user = userEvent.setup()
    renderBubbles()
    await user.click(screen.getByRole('button', { name: 'Great' }))
    expect(useLotiSession.getState().turns).toEqual([
      { n: 0, from: 'loti', text: 'How was your day?' },
      { n: 1, from: 'you', text: 'Great' },
    ])
    expect(useLotiSession.getState().current?.id).toBe('day-great')
  })

  it('"Not now" records nothing', async () => {
    const user = userEvent.setup()
    renderBubbles()
    await user.click(screen.getByRole('button', { name: 'Not now' }))
    expect(useLotiSession.getState().turns).toEqual([])
  })

  it('opens fresh by default, and with resume picks up the open question of the session talk', () => {
    useLotiSession.getState().begin({ id: 'day-okay', text: 'Thanks for telling me. A short session can help. Try one?', choices: [{ id: 'yes', label: "Yes, let's try one" }] })
    const first = renderBubbles()
    expect(screen.getByText('How was your day?')).toBeInTheDocument()
    first.unmount()
    render(
      <MemoryRouter future={future}>
        <LotiBubbles context={dayCtx} resume />
      </MemoryRouter>,
    )
    expect(screen.getByText(/thanks for telling me/i)).toBeInTheDocument()
  })
})

describe('LotiBubbles, collapsed (Home: one clickable line)', () => {
  function renderCollapsed() {
    return render(
      <MemoryRouter initialEntries={['/home']} future={future}>
        <LotiBubbles context={dayCtx} collapsed />
      </MemoryRouter>,
    )
  }

  it('shows Loti and only the line, as one button; no chips until it is clicked', () => {
    renderCollapsed()
    expect(screen.getAllByRole('img', { name: /loti/i })).toHaveLength(1)
    expect(screen.getAllByRole('button')).toHaveLength(1)
    expect(screen.getByRole('button', { name: 'How was your day?' })).toBeInTheDocument()
    expect(screen.queryByRole('group', { name: /reply to loti/i })).toBeNull()
  })

  it('clicking the line opens the talk on the same bubble, focus on its first chip', async () => {
    const user = userEvent.setup()
    renderCollapsed()
    await user.click(screen.getByRole('button', { name: 'How was your day?' }))
    expect(screen.getByText('How was your day?').closest('[aria-live="polite"]')).not.toBeNull()
    expect(screen.getByRole('button', { name: 'Great' })).toHaveFocus()
    expect(screen.getByRole('button', { name: 'Not now' })).toBeInTheDocument()
  })
})
