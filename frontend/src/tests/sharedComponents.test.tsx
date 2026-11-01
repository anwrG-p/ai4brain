import { cleanup, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it } from 'vitest'
import { AppShell } from '../components/layout/AppShell'
import { Badge, type BadgeTone } from '../components/ui/Badge'
import { Button, type ButtonSize, type ButtonVariant } from '../components/ui/Button'
import { BRAND_CONFIG } from '../config/brand'

// Same flags as App.tsx, so the router prints no v7 warnings.
const future = { v7_startTransition: true, v7_relativeSplatPath: true }

afterEach(cleanup)

const VARIANTS: ButtonVariant[] = ['primary', 'secondary', 'reward', 'danger', 'ghost']
const SIZES: ButtonSize[] = ['sm', 'md', 'lg']
const TONES: BadgeTone[] = [
  'brand',
  'reward',
  'neutral',
  'success',
  'warning',
  'danger',
  'info',
  'low-confidence',
]

describe('Button (Calm & Clean)', () => {
  it.each(VARIANTS.flatMap((v) => SIZES.map((s) => [v, s] as const)))(
    '%s/%s has no translate and is at least 44 px tall',
    (variant, size) => {
      render(
        <Button variant={variant} size={size}>
          Go
        </Button>,
      )
      const cls = screen.getByRole('button', { name: 'Go' }).className
      expect(cls).not.toMatch(/translate/)
      // .tactile-btn carries min-height: 44px in tokens.css; ghost needs the utility.
      expect(cls).toMatch(/\bmin-h-11\b/)
    },
  )

  it('forwards extra props (pressProps rely on it)', () => {
    render(
      <Button data-testid="fwd" onPointerDown={() => undefined}>
        Go
      </Button>,
    )
    expect(screen.getByTestId('fwd')).toBeInTheDocument()
  })
})

describe('Badge (Calm & Clean)', () => {
  it.each(TONES)('%s has no border-2', (tone) => {
    render(<Badge tone={tone}>Label</Badge>)
    const badge = screen.getByText('Label').parentElement!
    expect(badge.className).not.toMatch(/\bborder-2\b/)
  })
})

describe('AppShell (Calm & Clean)', () => {
  it('shows no fake streak pill', () => {
    const { container } = render(
      <MemoryRouter future={future} initialEntries={['/dashboard']}>
        <AppShell>
          <p>page</p>
        </AppShell>
      </MemoryRouter>,
    )
    expect(container.textContent).not.toMatch(/🔥|12d/)
  })

  it('keeps a 64 px header and the logo link name', () => {
    render(
      <MemoryRouter future={future} initialEntries={['/dashboard']}>
        <AppShell>
          <p>page</p>
        </AppShell>
      </MemoryRouter>,
    )
    expect(screen.getByRole('banner').className).toMatch(/\bh-16\b/)
    expect(screen.getByRole('link', { name: `${BRAND_CONFIG.productName} Home` })).toBeInTheDocument()
  })
})
