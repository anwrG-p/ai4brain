import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { AICollaborationCard } from './AICollaborationCard'

describe('AICollaborationCard', () => {
  it('renders building profile state when status is not_enough_data', () => {
    render(<AICollaborationCard collaboration={{ status: 'not_enough_data', evidence: { typed_turns: 3, marked_turns: {} } }} />)
    expect(screen.getByText('AI Collaboration Score')).toBeInTheDocument()
    expect(screen.getByText('Building your collaboration profile')).toBeInTheDocument()
    expect(screen.getByText('3/10 turns')).toBeInTheDocument()
    expect(screen.getByText('Clarification')).toBeInTheDocument()
    expect(screen.getByText('Critical Verification')).toBeInTheDocument()
  })

  it('renders composite score and breakdown when status is ok', () => {
    const data = {
      status: 'ok' as const,
      composite_score: 82.5,
      dimension_scores: {
        clarification: 85,
        critical_verification: 75,
        iteration: 90,
        autonomy: 80,
        responsible_use: 100,
      },
      growth_recommendation: 'Challenge AI suggestions with counterexamples.',
      evidence: { typed_turns: 12, marked_turns: {} },
    }
    render(<AICollaborationCard collaboration={data} />)
    expect(screen.getByText('83')).toBeInTheDocument()
    expect(screen.getByText('85/100')).toBeInTheDocument()
    expect(screen.getByText('Challenge AI suggestions with counterexamples.')).toBeInTheDocument()
  })
})

