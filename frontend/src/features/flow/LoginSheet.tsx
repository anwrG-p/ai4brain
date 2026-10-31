import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react'
import { Link } from 'react-router-dom'
import { X } from 'lucide-react'
import { Loti } from '../../components/features/characters'
import { Button } from '../../components/ui/Button'
import { useAppStore } from '../../state/useAppStore'
import { tracker } from '../assessment/telemetry/tracker'
import { GoogleButton, googleClientId, type GoogleProfile } from './GoogleSignIn'

export interface LoginSheetProps {
  /** Results: sign in, then the consent choice (R3). Welcome: sign in only. */
  askConsent: boolean
  onClose: () => void
  /** Signed in (Welcome) or the consent choice is made (Results). */
  onFinish: () => void
}

const FOCUSABLE = 'a[href], button:not([disabled]), input, select, textarea, iframe, [tabindex]:not([tabindex="-1"])'

const LINE = {
  results: 'Sign in to keep your results, or carry on as a guest.',
  welcome: 'Welcome back! Sign in to see your space.',
}

/* A modal sheet: a bottom sheet on phones, a centred card from sm up. Two steps at most, each with
   one message and one choice (rules 13, 14). The sign-in step exists only with Google sign-in
   (VITE_GOOGLE_CLIENT_ID): without it there is nothing to sign in with, so Results opens straight
   on the consent choice and Welcome offers no sign-in at all. Escape or the close button leaves it;
   focus stays inside while it is open and goes back to the opener after. */
export function LoginSheet({ askConsent, onClose, onFinish }: LoginSheetProps) {
  const hasGoogle = googleClientId() !== null
  const [step, setStep] = useState<'login' | 'consent'>(askConsent && !hasGoogle ? 'consent' : 'login')
  const loginUser = useAppStore((s) => s.loginUser)
  const panel = useRef<HTMLDivElement>(null)
  const consentHeading = useRef<HTMLHeadingElement>(null)
  const lineId = useId()
  const consentId = useId()
  const line = LINE[askConsent ? 'results' : 'welcome']

  useEffect(() => {
    const opener = document.activeElement
    panel.current?.focus()
    return () => {
      if (opener instanceof HTMLElement && opener.isConnected) opener.focus()
    }
  }, [])
  useEffect(() => {
    if (step === 'consent') consentHeading.current?.focus()
  }, [step])

  const signedIn = () => (askConsent ? setStep('consent') : onFinish())
  const google = (p: GoogleProfile) => {
    loginUser({ preferredName: p.name || 'Friend', email: p.email, focusGoal: 'balanced-360-twin' })
    signedIn()
  }
  const choose = (save: boolean) => {
    if (save) tracker.grantConsent()
    else tracker.denyConsent()
    onFinish()
  }

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.stopPropagation()
      onClose()
      return
    }
    if (e.key !== 'Tab' || !panel.current) return
    const items = Array.from(panel.current.querySelectorAll<HTMLElement>(FOCUSABLE))
    const first = items[0]
    const last = items[items.length - 1]
    if (!first || !last) return
    if (e.shiftKey && (document.activeElement === first || document.activeElement === panel.current)) {
      e.preventDefault()
      last.focus()
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault()
      first.focus()
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-canvas/80 sm:items-center sm:p-4">
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby={step === 'login' ? lineId : consentId}
        tabIndex={-1}
        onKeyDown={onKeyDown}
        className="relative w-full max-w-md rounded-t-2xl border border-border bg-surface px-6 pt-6 pb-8 shadow-(--shadow-elevation) outline-none sm:rounded-2xl"
      >
        <Button variant="ghost" size="sm" aria-label="Close" onClick={onClose} className="absolute top-2 end-2">
          <X size={20} strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" />
        </Button>
        {step === 'login' ? (
          <div className="flex flex-col items-center gap-5">
            {/* No bubble box here: the sheet is already the container (anti-slop rule 6). */}
            <Loti pose="happy" size="md" />
            <p id={lineId} className="max-w-xs text-center text-lg text-ink">
              {line}
            </p>
            {hasGoogle && <GoogleButton onProfile={google} />}
            <Button variant="ghost" size="md" onClick={signedIn}>
              Continue as guest
            </Button>
          </div>
        ) : (
          <div className="flex flex-col gap-5">
            <div className="space-y-2">
              <h2 id={consentId} ref={consentHeading} tabIndex={-1} className="font-display text-2xl font-bold text-ink outline-none">
                Save your answers?
              </h2>
              <p className="text-base text-ink">We record answer timing and accuracy only. No camera, no microphone.</p>
            </div>
            {/* Equal weight (R3): same style, same size. */}
            <div className="flex flex-col gap-3">
              <Button variant="secondary" size="lg" onClick={() => choose(true)}>
                Save my answers
              </Button>
              <Button variant="secondary" size="lg" onClick={() => choose(false)}>
                Keep them on this device only
              </Button>
            </div>
            <Link
              to="/privacy"
              className="focus-ring self-center inline-flex min-h-11 items-center rounded-sm text-sm font-medium text-brand underline underline-offset-4"
            >
              How we handle your data
            </Link>
          </div>
        )}
      </div>
    </div>
  )
}
