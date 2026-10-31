import { fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { EXERCISE_NAME } from '../features/assessment/names'
import type { Dimension, TelemetryEvent, TrialMeta } from '../features/assessment/telemetry/types'
import { MIN_COVERAGE, PILLAR_IDS, PILLAR_LABELS, PILLAR_WEIGHTS, type InputId } from '../features/insights/pillars'
import { DEFAULT_LAMBDA, DEFAULT_TMAX, FALLBACK_ALPHA, GRACE_DAYS, RCI_THRESHOLD, rci } from '../features/insights/projection'
import { dPrime, taskScores } from '../features/insights/taskScores'
import MethodologyPage from '../pages/MethodologyPage'
import { lintCopyText } from '../utils/copyLinter'

const TOPICS = [
  'The 5 pillars and their exercises',
  'How a pillar score is built',
  'Brain areas',
  'Your progress curve',
  'Real improvement',
]

function renderPage() {
  const { container } = render(
    <MemoryRouter>
      <MethodologyPage />
    </MemoryRouter>,
  )
  return container
}

/** The words a reader sees with every disclosure closed: everything except a closed <details>' body. */
function visibleWords(root: HTMLElement): string[] {
  const copy = root.cloneNode(true) as HTMLElement
  copy.querySelectorAll('details:not([open])').forEach((d) => {
    Array.from(d.children).forEach((c) => {
      if (c.tagName !== 'SUMMARY') c.remove()
    })
  })
  copy.querySelectorAll('[aria-hidden="true"], .sr-only').forEach((n) => n.remove())
  return (copy.textContent ?? '').split(/\s+/).filter(Boolean)
}

const open = (name: string) => {
  const summary = screen.getByRole('heading', { level: 2, name }).closest('summary')!
  fireEvent.click(summary)
  return summary.closest('details')!
}

describe('How we calculate this (/methodology)', () => {
  it('opens with the heading and a plain intro of three short lines', () => {
    renderPage()
    expect(screen.getByRole('heading', { level: 1, name: 'How we calculate this' })).toBeInTheDocument()
    const intro = screen.getAllByTestId('methodology-intro-line')
    expect(intro).toHaveLength(3)
    expect(intro[0]).toHaveTextContent(/5 pillars/)
    expect(intro[1]).toHaveTextContent(/your own past results/)
    expect(intro[2]).toHaveTextContent(/bigger than normal day-to-day noise/)
    for (const line of intro) expect((line.textContent ?? '').split(/\s+/).length).toBeLessThanOrEqual(14)
  })

  it('has one disclosure per topic, all closed by default', () => {
    const root = renderPage()
    const details = Array.from(root.querySelectorAll('details'))
    expect(details.map((d) => d.querySelector('summary h2')?.textContent)).toEqual(TOPICS)
    for (const d of details) expect(d.open).toBe(false)
  })

  it('keeps the visible copy (disclosures closed) to 60 words or fewer', () => {
    const root = renderPage()
    expect(visibleWords(root).length).toBeLessThanOrEqual(60)
  })

  it('lists every pillar with its exercises by consumer name', () => {
    renderPage()
    const section = open(TOPICS[0]!)
    for (const p of PILLAR_IDS) expect(within(section).getByText(PILLAR_LABELS[p])).toBeInTheDocument()
    const text = section.textContent ?? ''
    for (const name of ['Logic Web', 'Memory Gauntlet', 'Strategic Blueprint', 'Perceptual Radar', 'Precision Archive', 'Color Clash', 'Pattern Puzzle'])
      expect(text).toContain(name)
    expect(Object.values(EXERCISE_NAME)).toEqual(expect.arrayContaining(['Color Clash', 'Pattern Puzzle']))
  })

  it('shows the weights exactly as the code defines them', () => {
    renderPage()
    const section = open(TOPICS[1]!)
    const table = within(section).getByRole('table', { name: 'Weights per pillar' })
    const rows = Array.from(table.querySelectorAll('tr[data-input]'))
    const expected = PILLAR_IDS.flatMap((p) =>
      (Object.entries(PILLAR_WEIGHTS[p]) as [InputId, number][]).map(([id, w]) => `${p}:${id}:${w.toFixed(2)}`),
    )
    expect(rows.map((r) => `${r.getAttribute('data-pillar')}:${r.getAttribute('data-input')}:${r.querySelector('td:last-child')?.textContent}`)).toEqual(expected)
    for (const p of PILLAR_IDS) expect(within(table).getByRole('rowheader', { name: PILLAR_LABELS[p] })).toBeInTheDocument()
    expect(section).toHaveTextContent(`${Math.round(MIN_COVERAGE * 100)}%`)
  })

  it('states the scale ends the scoring code actually uses', () => {
    renderPage()
    const section = open(TOPICS[1]!)
    expect(section).toHaveTextContent('d′ 0 → 0, 4 → 100')
    expect(section).toHaveTextContent('0 ms → 100, 300 ms → 0')
    expect(section).toHaveTextContent('17 ms → 100, 500 ms → 0')

    // d' 4 -> 100: the OSPAN score is 25 x d'.
    const nback = [
      ...Array.from({ length: 10 }, (_, k) => ev({ trial_type: 'target', rule: 'p', stream: 'p' }, { ok: k < 8 })),
      ...Array.from({ length: 30 }, (_, k) => ev({ trial_type: 'standard', rule: 'p', stream: 'p' }, { ok: k >= 3 })),
    ]
    expect(taskScores(nback).OSPAN!.score).toBeCloseTo(25 * dPrime(8, 10, 3, 30), 6)
    // Stroop, perfect accuracy: a 150 ms cost is half way to 300 ms.
    const stroop = [
      ...Array.from({ length: 8 }, () => ev({ congruent: true }, { rt: 600, dim: 'executive_function' })),
      ...Array.from({ length: 8 }, () => ev({ congruent: false }, { rt: 750, dim: 'executive_function' })),
    ]
    expect(taskScores(stroop).ANT_Conflict!.score).toBeCloseTo(50, 6)
    // UFOV: 17 ms -> 100, 500 ms -> 0.
    const ufov = (t: number) => taskScores([ev({ shown_ms: 50, peripheral_ok: true, quest_threshold_ms: t }, { dim: 'processing_speed' })]).UFOV_SOA!.score
    expect(ufov(17)).toBeCloseTo(100, 6)
    expect(ufov(500)).toBeCloseTo(0, 6)
  })

  it('frames brain areas as research links, with no chemical claims', () => {
    renderPage()
    const section = open(TOPICS[2]!)
    expect(section).toHaveTextContent(/linked in research to/i)
    expect(section).toHaveTextContent(/We don’t measure your brain/)
    expect(section).toHaveTextContent(/hippocampus/i)
  })

  it('describes the projection with the code’s defaults and the dashed and dotted lines', () => {
    renderPage()
    const section = open(TOPICS[3]!)
    expect(section).toHaveTextContent(`Tmax = ${DEFAULT_TMAX}`)
    expect(section).toHaveTextContent(`λ = ${DEFAULT_LAMBDA}`)
    expect(section).toHaveTextContent(`after ${GRACE_DAYS} days`)
    expect(section).toHaveTextContent(`α = ${FALLBACK_ALPHA}`)
    expect(section).toHaveTextContent('between 0.01 and 0.3')
    expect(section).toHaveTextContent(/Dashed: If you keep training/)
    expect(section).toHaveTextContent(/Dotted: If you pause/)
  })

  it('explains RCI with the threshold and the defaults the code uses', () => {
    renderPage()
    const section = open(TOPICS[4]!)
    expect(section).toHaveTextContent(`RCI ≥ ${RCI_THRESHOLD}`)
    expect(section).toHaveTextContent('SD = 10')
    expect(section).toHaveTextContent('r = 0.8')
    // The page's SD and r are rci()'s defaults.
    expect(rci(1, 0)).toBeCloseTo(1 / (Math.SQRT2 * 10 * Math.sqrt(1 - 0.8)), 12)
    expect(section).toHaveTextContent(`about ${Math.round(RCI_THRESHOLD / rci(1, 0))} points`)
    expect(section).toHaveTextContent(/Jacobson & Truax 1991/)
  })

  it('makes no clinical, hype, transfer or chemical claims anywhere on the page', () => {
    const root = renderPage()
    const text = root.textContent ?? ''
    expect(lintCopyText(text).violations).toEqual([])
    const banned = [
      /\bproven\b/i,
      /\bboost\b/i,
      /\bsmarter\b/i,
      /\bunlock/i,
      /\bsupercharge/i,
      /\brevolutioni[sz]e/i,
      /\bAI-powered\b/i,
      /\bmagic\b/i,
      /\bseamless/i,
      /\bnext-level\b/i,
      /\belevate/i,
      /\bempower/i,
      /✨/,
      /\bchemical/i,
      /\bneurotransmitter/i,
      /\bnorepinephrine|noradrenaline|acetylcholine|dopamine|serotonin\b/i,
      /\bneuroplastic/i,
      /\bsynaptic\b/i,
      /\b85%/,
    ]
    for (const b of banned) expect(text, String(b)).not.toMatch(b)
  })
})

let seq = 0
function ev(meta: TrialMeta, o: { ok?: boolean; rt?: number; dim?: Dimension } = {}): TelemetryEvent {
  const ok = o.ok ?? true
  return {
    user_id: 'u',
    session_id: 's',
    task_id: 't1',
    trial_index: seq++,
    dimension: o.dim ?? 'working_memory',
    score_norm: ok ? 1 : 0,
    response_time_ms: o.rt ?? 800,
    error_flag: !ok,
    error_burst: ok ? 0 : 1,
    hesitation_jitter: 0,
    trial_meta: meta,
    client_ts: '2026-10-31T10:00:00Z',
  }
}
