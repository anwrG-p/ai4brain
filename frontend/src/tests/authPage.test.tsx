import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, expect, it, beforeEach } from 'vitest'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import AuthPage from '../pages/AuthPage'
import { useAppStore } from '../store/useAppStore'

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

  it('renders Sign In mode with welcoming Axolotl companion and form fields', async () => {
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

    // Verify Hardware Key / Passkey button
    expect(
      screen.getByRole('button', { name: /Resume with Hardware Key \/ Passkey/i }),
    ).toBeInTheDocument()

    // Verify Speech Bubble default
    expect(screen.getByText(/Ready for your 2-minute morning calibration/i)).toBeInTheDocument()

    // Verify Production Showcase Header & Status Pill
    expect(screen.getByText(/YOUR COGNITIVE COMPANION/i)).toBeInTheDocument()
    expect(screen.getByText(/^Ready$/)).toBeInTheDocument()
    expect(screen.queryByText(/BRIAN STAGING SLOT/i)).not.toBeInTheDocument()

    // Verify Character Stage Status Badge & Reassurance Cards
    expect(screen.getByText(/Twin Gateway Standing By/i)).toBeInTheDocument()
    expect(screen.getByText(/12-Day Streak · Protected by Humane Pacing/i)).toBeInTheDocument()
    expect(screen.getByText(/RAM-Only Cipher/i)).toBeInTheDocument()
    expect(screen.getByText(/Zero Biometrics/i)).toBeInTheDocument()
  })

  it('interactively updates Brian speech bubble on field focus in Sign In mode', async () => {
    renderAuthPage('/auth')

    const emailInput = screen.getByLabelText(/Twin Identifier \/ Email Encrypted Alias/i)
    const passphraseInput = screen.getByLabelText(/Master Passphrase/i)

    // Focus Email -> Brian perks up
    fireEvent.focus(emailInput)
    expect(screen.getByText(/Let's pull up your encrypted twin memory profile/i)).toBeInTheDocument()

    // Focus Passphrase -> Brian politely looks away
    fireEvent.focus(passphraseInput)
    expect(screen.getByText(/peeking politely away/i)).toBeInTheDocument()

    // Blur -> Brian returns to welcoming greeting
    fireEvent.blur(passphraseInput)
    expect(screen.getByText(/Ready for your 2-minute morning calibration/i)).toBeInTheDocument()
  })

  it('renders Create Account mode with preferred name reactivity and streamlined fields', async () => {
    renderAuthPage('/register')

    // Verify Heading
    expect(
      screen.getByRole('heading', { name: /Begin Your Cognitive Twin/i }),
    ).toBeInTheDocument()

    const nameInput = screen.getByLabelText(/What should Brian call you\?/i)
    expect(nameInput).toBeInTheDocument()

    // Initial greeting before typing name
    expect(screen.getByText(/Tell me what to call you/i)).toBeInTheDocument()

    // Type preferred name
    fireEvent.change(nameInput, { target: { value: 'Maya' } })

    // Speech bubble updates with user's name
    expect(screen.getByText(/Oh, hello Maya! That feels wonderfully grounding/i)).toBeInTheDocument()

    // Companion status badge reflects joy
    expect(screen.getByText(/Sparking Joy with Maya/i)).toBeInTheDocument()

    // Verify Initial Focus Dimension is NOT on the register page
    expect(screen.queryByText(/Initial Focus Dimension/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/Sharpen Focus/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/Daily Mental Calm/i)).not.toBeInTheDocument()

    // Verify Production Showcase Header & Status Pill
    expect(screen.getByText(/MEET BRIAN/i)).toBeInTheDocument()
    expect(screen.getByText(/Calibrating/i)).toBeInTheDocument()
    expect(screen.queryByText(/BRIAN STAGING SLOT/i)).not.toBeInTheDocument()

    // Verify Reassurance Cards & Beta Quote
    expect(screen.getByText(/Current Vibe: Curious Spark/i)).toBeInTheDocument()
    expect(screen.getByText(/Arthur K\., Beta Explorer/i)).toBeInTheDocument()

    // Verify Zero biometric tracking note is NOT on the register page
    expect(
      screen.queryByText(/Zero biometric tracking\. Your cognitive metrics/i),
    ).not.toBeInTheDocument()
  })

  it('updates passphrase robustness indicator without punitive anxiety messaging', async () => {
    renderAuthPage('/register')

    const passphraseInput = screen.getByLabelText(/Choose a Master Passphrase/i)

    // Initially ready to form
    expect(screen.getByText(/Encryption Robustness: Ready to Form/i)).toBeInTheDocument()

    // Typing short passphrase
    fireEvent.change(passphraseInput, { target: { value: 'pass' } })
    expect(screen.getByText(/Encryption Robustness: Gently Forming/i)).toBeInTheDocument()

    // Typing standard passphrase
    fireEvent.change(passphraseInput, { target: { value: 'gentle-rhythm-12' } })
    expect(screen.getByText(/Encryption Robustness: Impenetrable Sanctuary/i)).toBeInTheDocument()
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

