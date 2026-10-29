import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, expect, it, beforeEach } from 'vitest'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import AuthPage from '../pages/AuthPage'
import { useAppStore } from '../state/useAppStore'

function renderAuthPage(initialPath = '/auth') {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <Routes>
        <Route path="/auth" element={<AuthPage defaultMode="signin" />} />
        <Route path="/login" element={<AuthPage defaultMode="signin" />} />
        <Route path="/register" element={<AuthPage defaultMode="register" />} />
        <Route path="/dashboard" element={<div>Dashboard Mock</div>} />
        <Route path="/onboarding" element={<div>Onboarding Mock</div>} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('AuthPage (Stitch BRIAN Cognitive Twin Login & Register in Doodle Style)', () => {
  beforeEach(() => {
    useAppStore.getState().resetDemoState()
  })

  it('renders centered Sign In mode with form fields and security controls', async () => {
    renderAuthPage('/auth')

    // Verify Heading & Squiggle
    expect(
      screen.getByRole('heading', { name: /Welcome Back to Your Mind/i }),
    ).toBeInTheDocument()

    // Verify Inputs
    expect(
      screen.getByLabelText(/Twin Identifier \/ Email Encrypted Alias/i),
    ).toBeInTheDocument()
    expect(screen.getByLabelText(/Master Passphrase/i)).toBeInTheDocument()
    expect(
      screen.getByLabelText(/Remember my cognitive twin on this device/i),
    ).toBeInTheDocument()

    // Verify Action CTA
    const submitBtn = screen.getByRole('button', {
      name: /Enter Your Cognitive Space/i,
    })
    expect(submitBtn).toBeInTheDocument()

    // Verify Hardware Key / Passkey button is removed
    expect(
      screen.queryByRole('button', { name: /Resume with Hardware Key \/ Passkey/i }),
    ).not.toBeInTheDocument()

    // Verify subtitle copy is removed
    expect(
      screen.queryByText(/Pick up where your cognitive twin left off/i),
    ).not.toBeInTheDocument()

    // Verify Mascot Showcase panel is removed
    expect(
      screen.queryByLabelText(/Brian Cognitive Companion Showcase/i),
    ).not.toBeInTheDocument()
    expect(screen.queryByText(/YOUR COGNITIVE COMPANION/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/Twin Gateway Standing By/i)).not.toBeInTheDocument()
  })

  it('allows user to enter credentials and toggle remember device option', async () => {
    renderAuthPage('/auth')

    const emailInput = screen.getByLabelText(/Twin Identifier \/ Email Encrypted Alias/i)
    const passphraseInput = screen.getByLabelText(/Master Passphrase/i)
    const rememberCheckbox = screen.getByLabelText(/Remember my cognitive twin on this device/i) as HTMLInputElement

    fireEvent.change(emailInput, { target: { value: 'explorer@sanctuary.test' } })
    expect(emailInput).toHaveValue('explorer@sanctuary.test')

    fireEvent.change(passphraseInput, { target: { value: 'super-safe-phrase-123' } })
    expect(passphraseInput).toHaveValue('super-safe-phrase-123')

    expect(rememberCheckbox.checked).toBe(true)
    fireEvent.click(rememberCheckbox)
    expect(rememberCheckbox.checked).toBe(false)
  })

  it('renders Create Account mode with preferred name input and streamlined fields', async () => {
    renderAuthPage('/register')

    // Verify Heading
    expect(
      screen.getByRole('heading', { name: /Begin Your Cognitive Twin/i }),
    ).toBeInTheDocument()

    const nameInput = screen.getByLabelText(/What should Brian call you\?/i)
    expect(nameInput).toBeInTheDocument()

    // Type preferred name
    fireEvent.change(nameInput, { target: { value: 'Maya' } })
    expect(nameInput).toHaveValue('Maya')

    // Verify Initial Focus Dimension is NOT on the register page
    expect(screen.queryByText(/Initial Focus Dimension/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/Sharpen Focus/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/Daily Mental Calm/i)).not.toBeInTheDocument()

    // Verify Mascot Showcase panel is NOT rendered
    expect(
      screen.queryByLabelText(/Brian Cognitive Companion Showcase/i),
    ).not.toBeInTheDocument()
    expect(screen.queryByText(/MEET BRIAN/i)).not.toBeInTheDocument()

    // Verify Zero biometric tracking note is NOT on the register page
    expect(
      screen.queryByText(/Zero biometric tracking\. Your cognitive metrics/i),
    ).not.toBeInTheDocument()

    // Verify subtitle copy is removed
    expect(
      screen.queryByText(/No clinical labels\. No tests to fail/i),
    ).not.toBeInTheDocument()
  })

  it('displays passphrase robustness meter with clean non-classic phrases on the left (Awaiting your spark -> Easy to scatter -> Resilient shelter -> Reinforced defense -> Impenetrable vault)', async () => {
    renderAuthPage('/register')

    const passphraseInput = screen.getByLabelText(/Choose a Master Passphrase/i)

    // Initial state: Level 0 (Awaiting your spark only)
    expect(screen.getByText(/Awaiting your spark/i)).toBeInTheDocument()
    expect(screen.queryByText(/Fresh Canvas/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/Robustness:/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/Solid & Sealed/i)).not.toBeInTheDocument()

    // Level 1: Easy to scatter (short passphrase)
    fireEvent.change(passphraseInput, { target: { value: 'pass' } })
    expect(screen.getByText(/Easy to scatter/i)).toBeInTheDocument()
    expect(screen.queryByText(/Gentle Breeze/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/Robustness:/i)).not.toBeInTheDocument()

    // Level 3: Reinforced defense (longer with digits/hyphen)
    fireEvent.change(passphraseInput, { target: { value: 'secure-pass1' } })
    expect(screen.getByText(/Reinforced defense/i)).toBeInTheDocument()
    expect(screen.queryByText(/Armored Citadel/i)).not.toBeInTheDocument()

    // Level 4: Impenetrable vault (high entropy passphrase)
    fireEvent.change(passphraseInput, { target: { value: 'gentle-rhythm-sanctuary-12' } })
    expect(screen.getByText(/Impenetrable vault/i)).toBeInTheDocument()
    expect(screen.queryByText(/Cosmic Sanctuary/i)).not.toBeInTheDocument()
  })

  it('toggles passphrase visibility between password and text', async () => {
    renderAuthPage('/register')

    const passphraseInput = screen.getByLabelText(/Choose a Master Passphrase/i) as HTMLInputElement
    const toggleBtn = screen.getByRole('button', { name: /SHOW/i })

    expect(passphraseInput.type).toBe('password')

    fireEvent.click(toggleBtn)
    expect(passphraseInput.type).toBe('text')
    expect(screen.getByRole('button', { name: /HIDE/i })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /HIDE/i }))
    expect(passphraseInput.type).toBe('password')
  })

  it('opens and closes the Local Sandbox Architecture modal', async () => {
    renderAuthPage('/register')

    const modalLink = screen.getByRole('button', {
      name: /View Local Sandbox Architecture/i,
    })
    fireEvent.click(modalLink)

    // Modal dialog appears
    const modalHeading = screen.getByRole('heading', {
      name: /Local Sandbox Architecture/i,
    })
    expect(modalHeading).toBeInTheDocument()
    expect(screen.getByText(/1\. RAM-Only Decryption/i)).toBeInTheDocument()
    expect(screen.getByText(/2\. Zero Clinical Telemetry/i)).toBeInTheDocument()
    expect(screen.getByText(/3\. Hardware Enclave Binding/i)).toBeInTheDocument()

    // Close via Acknowledged & Return
    const ackBtn = screen.getByRole('button', { name: /Acknowledged & Return/i })
    fireEvent.click(ackBtn)

    expect(screen.queryByRole('heading', { name: /Local Sandbox Architecture/i })).not.toBeInTheDocument()
  })

  it('toggles seamlessly between Sign In and Create Account via tabs', async () => {
    renderAuthPage('/auth')

    // Currently in Sign In
    expect(screen.getByRole('heading', { name: /Welcome Back to Your Mind/i })).toBeInTheDocument()

    // Switch to Create Account tab
    const registerTab = screen.getByRole('tab', { name: /Create Account/i })
    fireEvent.click(registerTab)

    expect(screen.getByRole('heading', { name: /Begin Your Cognitive Twin/i })).toBeInTheDocument()

    // Switch back to Sign In tab
    const signInTab = screen.getByRole('tab', { name: /Sign In/i })
    fireEvent.click(signInTab)

    expect(screen.getByRole('heading', { name: /Welcome Back to Your Mind/i })).toBeInTheDocument()
  })

  it('handles simulated login submission and updates store state', async () => {
    renderAuthPage('/auth')

    const submitBtn = screen.getByRole('button', {
      name: /Enter Your Cognitive Space/i,
    })
    fireEvent.click(submitBtn)

    // In submitting state
    expect(screen.getByText(/Decrypting Local Vault\.\.\./i)).toBeInTheDocument()

    // Wait for success
    await waitFor(
      () => {
        expect(useAppStore.getState().isAuthenticated).toBe(true)
      },
      { timeout: 3000 },
    )
  })
})

