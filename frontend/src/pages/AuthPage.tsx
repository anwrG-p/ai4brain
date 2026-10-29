import React, { useState, useEffect } from 'react'
import { useNavigate, useSearchParams, useLocation } from 'react-router-dom'
import {
  ShieldCheck,
  Lock,
  Eye,
  EyeOff,
  ArrowRight,
  Key,
  Check,
  X,
} from 'lucide-react'
import { useAppStore } from '../state/useAppStore'
import { DoodleSquiggle, DoodleArrow } from '../components/ui/DoodleDecorations'

export type AuthMode = 'signin' | 'register'



interface AuthPageProps {
  defaultMode?: AuthMode
}

export default function AuthPage({ defaultMode }: AuthPageProps) {
  const navigate = useNavigate()
  const location = useLocation()
  const [searchParams] = useSearchParams()
  const { loginUser } = useAppStore()

  // Determine initial mode from prop, query parameter, or pathname
  const initialMode: AuthMode =
    defaultMode ||
    (searchParams.get('mode') === 'register' ||
      location.pathname === '/register' ||
      location.pathname === '/create-account'
      ? 'register'
      : 'signin')

  const [mode, setMode] = useState<AuthMode>(initialMode)

  // Update mode when path changes
  useEffect(() => {
    if (location.pathname === '/register' || location.pathname === '/create-account') {
      setMode('register')
    } else if (location.pathname === '/auth' || location.pathname === '/login' || location.pathname === '/sign-in') {
      setMode('signin')
    }
  }, [location.pathname])

  // Form State
  const [preferredName, setPreferredName] = useState('')
  const [email, setEmail] = useState('')
  const [passphrase, setPassphrase] = useState('')
  const [showPassphrase, setShowPassphrase] = useState(false)
  const [agreedToTerms, setAgreedToTerms] = useState(false)
  const [rememberDevice, setRememberDevice] = useState(true)

  // Status & Interactive Micro-Behaviors
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitSuccess, setSubmitSuccess] = useState(false)
  const [isSandboxModalOpen, setIsSandboxModalOpen] = useState(false)

  // Passphrase Robustness Evaluation with Non-Classic Natural Metaphors
  const getPassphraseRobustness = (phrase: string) => {
    const len = phrase.length
    if (len === 0) {
      return {
        level: 0,
        text: 'Awaiting your spark',
        colorClass: 'bg-transparent',
      }
    }

    let score = 0
    if (len >= 6) score += 1
    if (len >= 10) score += 1
    if (len >= 14) score += 1

    const hasMixed = /[a-z]/.test(phrase) && /[A-Z]/.test(phrase)
    const hasDigitsOrSymbols = /[\d\W]/.test(phrase)
    const hasSpacesOrHyphens = /[\s_-]/.test(phrase)

    if (hasMixed || hasDigitsOrSymbols || hasSpacesOrHyphens) {
      score += 1
    }

    const level = Math.max(1, Math.min(4, score))

    switch (level) {
      case 1:
        return {
          level: 1,
          text: 'Easy to scatter',
          colorClass: 'bg-warning',
        }
      case 2:
        return {
          level: 2,
          text: 'Resilient shelter',
          colorClass: 'bg-brand',
        }
      case 3:
        return {
          level: 3,
          text: 'Reinforced defense',
          colorClass: 'bg-brand',
        }
      case 4:
      default:
        return {
          level: 4,
          text: 'Impenetrable vault',
          colorClass: 'bg-success',
        }
    }
  }

  const passphraseRobustness = getPassphraseRobustness(passphrase)

  // Handle Preferred Name Change
  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPreferredName(e.target.value)
  }

  // Form Submit Handler
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (mode === 'register' && !agreedToTerms) {
      return
    }

    setIsSubmitting(true)

    if (mode === 'register') {
      const cleanName = preferredName.trim() || 'Fellow Explorer'
      setTimeout(() => {
        setIsSubmitting(false)
        setSubmitSuccess(true)
        loginUser({
          preferredName: cleanName,
          email: email || 'explorer@vault.local',
          focusGoal: 'balanced-360-twin',
          rememberOnDevice: rememberDevice,
        })
        setTimeout(() => {
          navigate('/onboarding')
        }, 800)
      }, 1200)
    } else {
      setTimeout(() => {
        setIsSubmitting(false)
        setSubmitSuccess(true)
        loginUser({
          preferredName: 'Arthur K.',
          email: email || 'youssef@example.com',
          focusGoal: 'Daily Mental Calm',
          rememberOnDevice: rememberDevice,
        })
        setTimeout(() => {
          navigate('/dashboard')
        }, 800)
      }, 1100)
    }
  }

  return (
    <div className="space-y-8 pb-12">


      {/* Mode Switcher Tabs with Doodle Styling */}
      <div className="flex justify-center">
        <div
          role="tablist"
          aria-label="Authentication Mode"
          className="inline-flex items-center p-1.5 rounded-pill bg-surface-raised border-2 border-border-strong shadow-doodle-sm gap-2"
        >
          <button
            type="button"
            role="tab"
            aria-selected={mode === 'signin'}
            onClick={() => setMode('signin')}
            className={`px-5 py-2 rounded-pill font-display text-sm font-bold transition-all cursor-pointer ${mode === 'signin'
              ? 'bg-brand text-brand-ink border-2 border-border-strong shadow-doodle-sm'
              : 'text-ink-muted hover:text-ink'
              }`}
          >
            Sign In
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mode === 'register'}
            onClick={() => setMode('register')}
            className={`px-5 py-2 rounded-pill font-display text-sm font-bold transition-all cursor-pointer ${mode === 'register'
              ? 'bg-brand text-brand-ink border-2 border-border-strong shadow-doodle-sm'
              : 'text-ink-muted hover:text-ink'
              }`}
          >
            Create Account
          </button>
        </div>
      </div>

      {/* =========================================================================
          CENTERED AUTH FORM (Streamlined Doodle Card)
          ========================================================================= */}
      <div className="w-full max-w-xl mx-auto">
        <section
          aria-labelledby="auth-form-title"
          className="w-full"
        >
          <div className="tactile-card bg-surface p-6 sm:p-8 rounded-2xl border-2 border-border-strong shadow-doodle-lg relative space-y-6">
            <div className="doodle-tape" />

            {/* Header Lockup */}
            <div className="space-y-2">


              <h1
                id="auth-form-title"
                className="font-display text-2xl sm:text-3xl lg:text-4xl font-extrabold text-ink tracking-tight"
              >
                {mode === 'register' ? 'Begin Your Cognitive Twin' : 'Welcome Back to Your Mind'}
              </h1>

              <div className="max-w-xs">
                <DoodleSquiggle className="text-brand" />
              </div>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-5" noValidate>
              {/* ===============================================================
                  REGISTER FIELDS
                  =============================================================== */}
              {mode === 'register' && (
                <>
                  {/* Field 1: Preferred Name */}
                  <div className="space-y-1.5">
                    <label
                      htmlFor="preferred-name-input"
                      className="block font-sans text-sm font-bold text-ink"
                    >
                      What should Brian call you?
                    </label>
                    <input
                      id="preferred-name-input"
                      type="text"
                      value={preferredName}
                      onChange={handleNameChange}
                      placeholder="e.g. Maya, Arthur, or Cap"
                      className="w-full px-4 py-3 rounded-md bg-surface text-ink font-sans text-base border-2 border-border-strong focus-ring shadow-doodle-sm placeholder:text-ink-muted/60"
                      required
                    />
                  </div>

                  {/* Field 2: Email */}
                  <div className="space-y-1.5">
                    <label
                      htmlFor="register-email-input"
                      className="block font-sans text-sm font-bold text-ink"
                    >
                      Your Account Email
                    </label>
                    <input
                      id="register-email-input"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="name@domain.com"
                      className="w-full px-4 py-3 rounded-md bg-surface text-ink font-sans text-base border-2 border-border-strong focus-ring shadow-doodle-sm placeholder:text-ink-muted/60"
                      required
                    />

                  </div>

                  {/* Field 3: Passphrase */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <label
                        htmlFor="register-passphrase-input"
                        className="font-sans text-sm font-bold text-ink"
                      >
                        Choose a Master Passphrase
                      </label>
                      <button
                        type="button"
                        onClick={() => setShowPassphrase(!showPassphrase)}
                        className="font-mono text-xs font-bold text-brand hover:underline cursor-pointer"
                      >
                        {showPassphrase ? 'HIDE' : 'SHOW'}
                      </button>
                    </div>
                    <div className="relative">
                      <input
                        id="register-passphrase-input"
                        type={showPassphrase ? 'text' : 'password'}
                        value={passphrase}
                        onChange={(e) => setPassphrase(e.target.value)}
                        placeholder="A phrase only you would remember..."
                        className="w-full px-4 py-3 rounded-md bg-surface text-ink font-sans text-base border-2 border-border-strong focus-ring shadow-doodle-sm placeholder:text-ink-muted/60 pr-10"
                        required
                      />
                    </div>

                    {/* Non-Classic Password Robustness Meter */}
                    <div
                      data-testid="passphrase-robustness-meter"
                      className="pt-1.5 space-y-1.5"
                      aria-live="polite"
                    >
                      <div className="h-2 w-full rounded-pill bg-surface-raised border border-border-strong/40 flex gap-1 p-0.5">
                        <div
                          className={`h-full flex-1 rounded-pill transition-all duration-300 ${
                            passphraseRobustness.level >= 1 ? passphraseRobustness.colorClass : 'bg-transparent'
                          }`}
                        />
                        <div
                          className={`h-full flex-1 rounded-pill transition-all duration-300 ${
                            passphraseRobustness.level >= 2 ? passphraseRobustness.colorClass : 'bg-transparent'
                          }`}
                        />
                        <div
                          className={`h-full flex-1 rounded-pill transition-all duration-300 ${
                            passphraseRobustness.level >= 3 ? passphraseRobustness.colorClass : 'bg-transparent'
                          }`}
                        />
                        <div
                          className={`h-full flex-1 rounded-pill transition-all duration-300 ${
                            passphraseRobustness.level >= 4 ? passphraseRobustness.colorClass : 'bg-transparent'
                          }`}
                        />
                      </div>
                      <div className="flex items-center justify-start font-mono text-xs text-ink-muted">
                        <span className="font-normal text-ink-muted">
                          {passphraseRobustness.text}
                        </span>
                      </div>
                    </div>
                  </div>



                  {/* Terms & Privacy Vault Contract Checkbox */}
                  <div className="pt-2">
                    <label className="flex items-start gap-3 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={agreedToTerms}
                        onChange={(e) => setAgreedToTerms(e.target.checked)}
                        className="mt-1 w-4 h-4 rounded-sm border-2 border-border-strong text-brand focus-ring"
                        required
                      />
                      <span className="text-xs text-ink leading-relaxed">
                        I agree to Brian's non-clinical companion terms and privacy vault contract. Data remains entirely on-device.{' '}
                        <button
                          type="button"
                          onClick={() => setIsSandboxModalOpen(true)}
                          className="font-mono font-bold text-brand hover:underline inline cursor-pointer"
                        >
                          View Local Sandbox Architecture
                        </button>
                      </span>
                    </label>
                  </div>
                </>
              )}

              {/* ===============================================================
                  SIGN IN FIELDS
                  =============================================================== */}
              {mode === 'signin' && (
                <>
                  {/* Field 1: Identifier / Email */}
                  <div className="space-y-1.5">
                    <label
                      htmlFor="signin-email-input"
                      className="block font-sans text-sm font-bold text-ink"
                    >
                      Twin Identifier / Email Encrypted Alias
                    </label>
                    <input
                      id="signin-email-input"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="youssef@example.com"
                      className="w-full px-4 py-3 rounded-md bg-surface text-ink font-sans text-base border-2 border-border-strong focus-ring shadow-doodle-sm placeholder:text-ink-muted/60"
                      required
                    />

                  </div>

                  {/* Field 2: Passphrase */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <label
                        htmlFor="signin-passphrase-input"
                        className="font-sans text-sm font-bold text-ink"
                      >
                        Master Passphrase
                      </label>
                      <button
                        type="button"
                        onClick={() => setShowPassphrase(!showPassphrase)}
                        className="font-mono text-xs font-bold text-brand hover:underline cursor-pointer"
                      >
                        {showPassphrase ? 'HIDE' : 'SHOW'}
                      </button>
                    </div>
                    <div className="relative">
                      <input
                        id="signin-passphrase-input"
                        type={showPassphrase ? 'text' : 'password'}
                        value={passphrase}
                        onChange={(e) => setPassphrase(e.target.value)}
                        placeholder="••••••••••••••••"
                        className="w-full px-4 py-3 rounded-md bg-surface text-ink font-sans text-base border-2 border-border-strong focus-ring shadow-doodle-sm placeholder:text-ink-muted/60 pr-10"
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassphrase(!showPassphrase)}
                        aria-label={showPassphrase ? 'Hide passphrase' : 'Show passphrase'}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-muted hover:text-ink"
                      >
                        {showPassphrase ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                    <div className="flex justify-end pt-0.5">
                      <button
                        type="button"
                        onClick={() => setIsSandboxModalOpen(true)}
                        className="font-mono text-xs text-ink-muted hover:text-brand underline cursor-pointer"
                      >
                        Forgot passphrase? Use recovery key
                      </button>
                    </div>
                  </div>

                  {/* Remember on this device */}
                  <div className="pt-1">
                    <label className="flex items-center gap-2 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={rememberDevice}
                        onChange={(e) => setRememberDevice(e.target.checked)}
                        className="w-4 h-4 rounded-sm border-2 border-border-strong text-brand focus-ring"
                      />
                      <span className="font-mono text-xs text-ink">
                        Remember my cognitive twin on this device (Hardware Key Storage)
                      </span>
                    </label>
                  </div>
                </>
              )}

              {/* ===============================================================
                  SUBMIT ACTIONS
                  =============================================================== */}
              <div className="space-y-3 pt-3">
                <div className="relative">
                  <div className="hidden sm:block absolute -left-12 top-2 pointer-events-none">
                    <DoodleArrow />
                  </div>
                  <button
                    type="submit"
                    disabled={isSubmitting || (mode === 'register' && !agreedToTerms)}
                    className={`w-full py-4 px-6 rounded-pill font-display text-lg font-bold border-2 border-border-strong shadow-doodle hover:shadow-doodle-lg active:translate-x-0.5 active:translate-y-0.5 transition-all flex items-center justify-center gap-3 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${submitSuccess
                      ? 'bg-success text-surface'
                      : 'bg-brand text-brand-ink hover:bg-brand-hover'
                      }`}
                  >
                    {isSubmitting ? (
                      <>
                        <span className="w-5 h-5 rounded-pill border-2 border-current border-t-transparent animate-spin" />
                        <span>{mode === 'register' ? 'Birthing Your Twin...' : 'Decrypting Local Vault...'}</span>
                      </>
                    ) : submitSuccess ? (
                      <>
                        <Check size={20} aria-hidden="true" />
                        <span>{mode === 'register' ? 'Twin Initialized! Entering Sanctuary...' : 'Vault Unlocked! Launching Twin...'}</span>
                      </>
                    ) : (
                      <>
                        <span>{mode === 'register' ? 'Create My Cognitive Twin' : 'Enter Your Cognitive Space'}</span>
                        <ArrowRight size={18} aria-hidden="true" />
                      </>
                    )}
                  </button>
                </div>
              </div>



              {/* Mode Switch Toggle Footer */}
              <div className="pt-2 text-center border-t border-border-strong/20">
                {mode === 'register' ? (
                  <p className="font-mono text-xs text-ink-muted">
                    Already initialized a twin?{' '}
                    <button
                      type="button"
                      onClick={() => setMode('signin')}
                      className="font-bold text-brand hover:underline cursor-pointer"
                    >
                      Sign in to your sanctuary →
                    </button>
                  </p>
                ) : (
                  <p className="font-mono text-xs text-ink-muted">
                    First time with Brian?{' '}
                    <button
                      type="button"
                      onClick={() => setMode('register')}
                      className="font-bold text-brand hover:underline cursor-pointer"
                    >
                      Create your cognitive twin account →
                    </button>
                  </p>
                )}
              </div>
            </form>
          </div>
        </section>
      </div>

      {/* =========================================================================
          LOCAL SANDBOX ARCHITECTURE MODAL (Matching Stitch Screen 1 modal)
          ========================================================================= */}
      {isSandboxModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="modal-title"
          className="fixed inset-0 z-50 bg-ink/40 backdrop-blur-xs flex items-center justify-center p-4"
        >
          <div className="bg-surface max-w-lg w-full rounded-2xl p-6 sm:p-8 border-2 border-border-strong shadow-doodle-lg space-y-6 relative">
            <div className="doodle-tape" />

            <div className="flex items-start justify-between gap-4">
              <div className="space-y-1">
                <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-pill bg-brand-subtle text-brand border border-border-strong font-mono text-xs font-bold">
                  <ShieldCheck size={12} aria-hidden="true" />
                  <span>Verified Client Architecture</span>
                </div>
                <h2 id="modal-title" className="font-display text-xl sm:text-2xl font-bold text-ink">
                  Local Sandbox Architecture
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setIsSandboxModalOpen(false)}
                aria-label="Close architecture modal"
                className="p-1.5 rounded-sm border border-border-strong bg-surface hover:bg-surface-raised shadow-doodle-sm cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            <p className="text-xs sm:text-sm text-ink-muted leading-relaxed">
              Brian operates under a zero-knowledge trust contract. Here is how your cognitive telemetry is strictly safeguarded:
            </p>

            <div className="space-y-3">
              <div className="p-3 bg-surface-raised rounded-xl border border-border-strong/60 space-y-1">
                <div className="font-mono text-xs font-bold text-ink flex items-center gap-2">
                  <Lock size={14} className="text-brand" aria-hidden="true" />
                  <span>1. RAM-Only Decryption</span>
                </div>
                <p className="text-xs text-ink-muted">
                  Your  passphrase never traverses external networks. Hashed with client-side WebAssembly before local vault decryption.
                </p>
              </div>

              <div className="p-3 bg-surface-raised rounded-xl border border-border-strong/60 space-y-1">
                <div className="font-mono text-xs font-bold text-ink flex items-center gap-2">
                  <ShieldCheck size={14} className="text-success" aria-hidden="true" />
                  <span>2. Zero Clinical Telemetry</span>
                </div>
                <p className="text-xs text-ink-muted">
                  No ad brokers, trackers, or clinical registries. Your trial telemetry stays in your browser cache.
                </p>
              </div>

              <div className="p-3 bg-surface-raised rounded-xl border border-border-strong/60 space-y-1">
                <div className="font-mono text-xs font-bold text-ink flex items-center gap-2">
                  <Key size={14} className="text-brand" aria-hidden="true" />
                  <span>3. Hardware Enclave Binding</span>
                </div>
                <p className="text-xs text-ink-muted">
                  Optional FIDO2 WebAuthn keys bind encryption directly to device hardware keys without biometric data extraction.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setIsSandboxModalOpen(false)}
                className="px-6 py-2.5 rounded-pill bg-brand text-brand-ink font-display text-sm font-bold border-2 border-border-strong shadow-doodle hover:shadow-doodle-lg active:translate-x-0.5 active:translate-y-0.5 transition-all cursor-pointer"
              >
                Acknowledged & Return
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
