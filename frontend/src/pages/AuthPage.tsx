import React, { useState, useEffect } from 'react'
import { useNavigate, useSearchParams, useLocation } from 'react-router-dom'
import {
  ShieldCheck,
  Lock,
  Eye,
  EyeOff,
  Sparkles,
  ArrowRight,
  Key,
  Check,
  X,
  Flame,
} from 'lucide-react'
import { useAppStore } from '../state/useAppStore'
import { DoodleSquiggle, DoodleArrow } from '../components/ui/DoodleDecorations'
import brianLoginImg from '../assets/mascot/brian-login.webp'
import brianRegisterImg from '../assets/mascot/brian-register.webp'

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
  const [avatarBounce, setAvatarBounce] = useState(false)
  const [activeFinPose, setActiveFinPose] = useState<'normal' | 'wave' | 'cover'>('normal')

  // Dynamic Brian Speech Bubble Content
  const [brianSpeech, setBrianSpeech] = useState<string>('')

  // Passphrase Strength Calculation (Humane, non-anxious)
  const getPassphraseStrength = (phrase: string) => {
    const len = phrase.length
    if (len === 0) {
      return {
        level: 0,
        bars: [false, false, false],
        label: 'Encryption Robustness: Ready to Form',
        metric: '256-bit safe cipher',
      }
    }
    if (len < 6) {
      return {
        level: 1,
        bars: [true, false, false],
        label: 'Encryption Robustness: Gently Forming',
        metric: 'Keep going',
      }
    }
    if (len < 12) {
      return {
        level: 2,
        bars: [true, true, false],
        label: 'Encryption Robustness: Solid & Sealed',
        metric: 'Standard vault',
      }
    }
    return {
      level: 3,
      bars: [true, true, true],
      label: 'Encryption Robustness: Impenetrable Sanctuary',
      metric: 'High-entropy cipher',
    }
  }

  const passphraseStrength = getPassphraseStrength(passphrase)

  // Set initial speech bubble based on mode
  useEffect(() => {
    if (mode === 'register') {
      if (!preferredName.trim()) {
        setBrianSpeech(
          "I can't wait to meet you! Tell me what to call you so we can begin your zero-guilt cognitive baseline together.",
        )
      } else {
        setBrianSpeech(
          `Oh, hello ${preferredName.trim()}! That feels wonderfully grounding. I've already labeled page 1 of our logbook just for us.`,
        )
      }
    } else {
      setBrianSpeech(
        "Welcome back! Ready for your 2-minute morning calibration? No pressure if you're taking a rest day—your streak is already safe.",
      )
    }
  }, [mode, preferredName])

  // Handle Preferred Name Change with bounce
  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value
    setPreferredName(val)
    if (val.trim()) {
      setAvatarBounce(true)
      setTimeout(() => setAvatarBounce(false), 220)
    }
  }

  // Handle Input Focus in Sign In mode
  const handleSignInFocus = (field: 'email' | 'password') => {
    if (field === 'email') {
      setActiveFinPose('wave')
      setBrianSpeech(
        "I see you! Let's pull up your encrypted twin memory profile...",
      )
    } else if (field === 'password') {
      setActiveFinPose('cover')
      setBrianSpeech(
        "Don't worry, I'm peeking politely away. Your master key decrypts strictly in your RAM.",
      )
    }
  }

  const handleSignInBlur = () => {
    setActiveFinPose('normal')
    setBrianSpeech(
      "Welcome back! Ready for your 2-minute morning calibration? No pressure if you're taking a rest day—your streak is already safe.",
    )
  }

  // Handle Passkey Simulation
  const handlePasskeyClick = () => {
    setBrianSpeech(
      'Hardware FIDO2 challenge requested. Tap your local security key or touch sensor.',
    )
    setIsSubmitting(true)
    setTimeout(() => {
      setIsSubmitting(false)
      setSubmitSuccess(true)
      loginUser({
        preferredName: 'Arthur (Passkey)',
        email: 'passkey-sealed@device.local',
        focusGoal: 'Daily Mental Calm',
        rememberOnDevice: true,
      })
      setTimeout(() => {
        navigate('/dashboard')
      }, 700)
    }, 1100)
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
      setBrianSpeech(
        `We are officially paired, ${cleanName}! Opening your gentle baseline console now.`,
      )
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
          STAGE: 2-COLUMN SPLIT (Matches Stitch Screen 1 & Screen 2)
          ========================================================================= */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-start">
        {/* =======================================================================
            LEFT COLUMN: Brian Cognitive Companion Character Showcase
            ======================================================================= */}
        <aside
          aria-label="Brian Cognitive Companion Showcase"
          className="lg:col-span-5 flex flex-col gap-6 order-2 lg:order-1"
        >
          {/* Main Companion Production Showcase Card with Tactile Border & Soft Background */}
          <div className="tactile-card bg-surface-raised p-6 relative rounded-2xl border-2 border-border-strong shadow-doodle-lg space-y-5">
            <div className="doodle-tape" />

            {/* Production Companion Header */}
            <div className="flex items-center justify-between pb-3 border-b-2 border-dashed border-border-strong/30">
              <div className="inline-flex items-center gap-2 bg-surface px-3 py-1 rounded-pill border border-border-strong shadow-doodle-sm">
                <Sparkles size={14} className="text-brand" aria-hidden="true" />
                <span className="font-mono text-xs font-bold text-ink uppercase tracking-wider">
                  {mode === 'register' ? 'MEET BRIAN' : 'YOUR COGNITIVE COMPANION'}
                </span>
              </div>
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-pill bg-surface text-ink text-xs font-mono font-semibold border border-border-strong">
                <span className="w-2 h-2 rounded-pill bg-success animate-pulse" aria-hidden="true" />
                <span>{mode === 'register' ? 'Calibrating' : 'Ready'}</span>
              </div>
            </div>

            {/* Brian's Interactive Speech Bubble (Positioned cleanly ABOVE the character stage with pointer aimed at Brian) */}
            <div
              role="status"
              aria-live="polite"
              className="relative bg-surface p-4 rounded-xl border-2 border-border-strong shadow-doodle-sm space-y-1.5 transition-all"
            >
              <div className="flex items-center gap-1.5 text-brand font-mono text-xs font-bold uppercase tracking-wider">
                <span>💬</span>
                <span>Brian says:</span>
              </div>
              <p className="font-sans text-sm sm:text-base text-ink font-semibold leading-snug">
                "{brianSpeech}"
              </p>
              {/* Tactical Speech Pointer pointing directly down at Brian */}
              <div
                className="absolute -bottom-2.5 left-1/2 -translate-x-1/2 w-0 h-0 border-x-8 border-x-transparent border-t-8 border-t-border-strong"
                aria-hidden="true"
              />
              <div
                className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-0 h-0 border-x-7 border-x-transparent border-t-7 border-t-surface"
                aria-hidden="true"
              />
            </div>

            {/* Hero Character Stage (220px-260px, warm backdrop, floating idle animation) */}
            <div className="relative min-h-60 sm:min-h-64 rounded-2xl bg-surface/70 border-2 border-border-strong/40 p-4 flex flex-col items-center justify-center mb-3">
              {/* Ambient Glow */}
              <div
                className="absolute inset-4 rounded-full bg-brand/10 blur-xl pointer-events-none"
                aria-hidden="true"
              />

              {/* Full-Body Axolotl Character with Gentle Floating Animation */}
              <div
                className={`relative z-10 flex items-center justify-center animate-brian-float transition-transform duration-200 ${avatarBounce ? 'scale-105' : 'scale-100'
                  }`}
              >
                <img
                  src={mode === 'register' ? brianRegisterImg : brianLoginImg}
                  alt={mode === 'register' ? 'Brian the Axolotl with explorer hat and sketchbook' : 'Brian the Axolotl waving warmly'}
                  className={`h-52 sm:h-56 w-auto max-w-full object-contain select-none drop-shadow-md transition-transform duration-300 ${activeFinPose === 'cover'
                      ? 'rotate-6'
                      : activeFinPose === 'wave'
                        ? '-rotate-6'
                        : ''
                    }`}
                />
              </div>

              {/* Dynamic Companion State Badge: Floating pill overlapping the bottom base of the character stage */}
              <div className="absolute -bottom-3 left-1/2 -translate-x-1/2 z-20 whitespace-nowrap">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-pill bg-surface text-ink font-mono text-xs font-bold border-2 border-border-strong shadow-doodle-sm">
                  <span className="text-brand">★</span>
                  <span>
                    {mode === 'register'
                      ? preferredName.trim()
                        ? `Sparking Joy with ${preferredName.trim()}`
                        : 'Enthusiastic Inception'
                      : activeFinPose === 'cover'
                        ? 'Politely Looking Away'
                        : 'Twin Gateway Standing By'}
                  </span>
                </span>
              </div>
            </div>

            {/* Companion Metadata & Guarantees */}
            {mode === 'register' ? (
              <div className="space-y-3 pt-2 border-t-2 border-dashed border-border-strong/30">
                <div className="p-3 bg-surface rounded-xl border border-border-strong/60 space-y-1">
                  <div className="flex items-center gap-1.5 font-mono text-xs font-bold text-ink">
                    <span className="text-brand">⚡</span>
                    <span>Current Vibe: Curious Spark · Unbiased Warmth</span>
                  </div>
                  <p className="text-xs text-ink-muted leading-relaxed">
                    Brian does not report to employers, advertisers, or clinical registries. This is your personal cognitive mirror.
                  </p>
                </div>

                <div className="p-3 bg-surface rounded-xl border border-border-strong/60">
                  <p className="italic text-xs text-ink leading-relaxed">
                    "Traditional brain training made me feel pressured about failure. Brian made me curious about how my mind works."
                  </p>
                  <span className="block mt-1 font-mono text-xs text-ink-muted font-bold text-right">
                    — Arthur K., Beta Explorer
                  </span>
                </div>
              </div>
            ) : (
              <div className="space-y-3 pt-2 border-t-2 border-dashed border-border-strong/30">
                <div className="p-3 bg-reward/25 rounded-xl border-2 border-warning shadow-doodle-sm space-y-1">
                  <div className="flex items-center gap-2 font-mono text-xs font-bold text-ink">
                    <Flame size={14} className="text-danger" aria-hidden="true" />
                    <span>12-Day Streak · Protected by Humane Pacing</span>
                  </div>
                  <p className="text-xs text-ink-muted leading-relaxed">
                    Rest day scheduled? Your streak freezes automatically. You never lose progress for resting.
                  </p>
                </div>

                <div className="p-3 bg-surface rounded-xl border border-border-strong/60 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <ShieldCheck size={16} className="text-success" aria-hidden="true" />
                    <span className="font-mono text-xs font-bold text-ink">RAM-Only Cipher</span>
                  </div>
                  <span className="font-mono text-xs text-ink-muted">Zero Biometrics</span>
                </div>
              </div>
            )}
          </div>
        </aside>

        {/* =======================================================================
            RIGHT COLUMN: Form Section (Create Account OR Sign In)
            ======================================================================= */}
        <section
          aria-labelledby="auth-form-title"
          className="lg:col-span-7 flex flex-col order-1 lg:order-2"
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

              <p className="text-sm sm:text-base text-ink-muted leading-relaxed pt-1">
                {mode === 'register'
                  ? 'No clinical labels. No tests to fail. Just 2 minutes a day calibrated to your natural rhythm.'
                  : 'Pick up where your cognitive twin left off. Non-clinical & hardware-sealed.'}
              </p>
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
                    <p className="font-mono text-xs text-ink-muted">
                      Brian will address you by this name across all daily morning check-ins and reflection logs.
                    </p>
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

                    {/* Non-Anxious Robustness Meter */}
                    <div className="pt-1 space-y-1">
                      <div className="h-2 w-full rounded-pill bg-surface-raised border border-border-strong/40 flex gap-1 p-0.5">
                        <div
                          className={`h-full flex-1 rounded-pill transition-colors ${passphraseStrength.bars[0] ? 'bg-brand' : 'bg-transparent'
                            }`}
                        />
                        <div
                          className={`h-full flex-1 rounded-pill transition-colors ${passphraseStrength.bars[1] ? 'bg-brand' : 'bg-transparent'
                            }`}
                        />
                        <div
                          className={`h-full flex-1 rounded-pill transition-colors ${passphraseStrength.bars[2] ? 'bg-success' : 'bg-transparent'
                            }`}
                        />
                      </div>
                      <div className="flex items-center justify-between font-mono text-xs text-ink-muted">
                        <span>{passphraseStrength.label}</span>
                        <span className="font-bold text-ink">{passphraseStrength.metric}</span>
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
                      onFocus={() => handleSignInFocus('email')}
                      onBlur={handleSignInBlur}
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
                        onFocus={() => handleSignInFocus('password')}
                        onBlur={handleSignInBlur}
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

                {/* Alternate Hardware Key Button (Sign In mode) */}
                {mode === 'signin' && (
                  <button
                    type="button"
                    onClick={handlePasskeyClick}
                    disabled={isSubmitting}
                    className="w-full py-3 px-4 rounded-pill font-mono text-xs font-bold bg-surface text-ink hover:bg-surface-raised border-2 border-border-strong shadow-doodle-sm flex items-center justify-center gap-2 cursor-pointer transition-colors"
                  >
                    <Key size={14} aria-hidden="true" className="text-brand" />
                    <span>Resume with Hardware Key / Passkey</span>
                  </button>
                )}
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
