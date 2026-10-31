import { useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Button } from '../components/ui/Button'
import { LoginSheet } from '../features/flow/LoginSheet'
import { LotiSays } from '../features/loti/LotiBubbles'

/* Welcome: Loti says hello, one button starts the baseline, one quiet link opens the login sheet.
   Nothing else (Landing page doc: "VERY SIMPLE UI early on"; anti-slop rules 13 and 14). */
export default function WelcomePage() {
  const navigate = useNavigate()
  const { search } = useLocation()
  const [signIn, setSignIn] = useState(false)

  return (
    <div className="mx-auto flex max-w-xl flex-col items-center gap-8 pt-6 pb-12 text-center sm:pt-12">
      <LotiSays pose="wave" size="lg">
        <h1 className="font-display text-2xl font-bold text-ink">Hi, I'm Loti.</h1>
        <p className="mt-1 text-lg text-ink">Want to see how your mind works today? It takes about 5 minutes.</p>
      </LotiSays>
      <div className="flex flex-col items-center gap-2">
        {/* The query string rides along, so the e2e hook ?fast=1 reaches /baseline. */}
        <Button size="lg" className="min-w-40" onClick={() => navigate({ pathname: '/baseline', search })}>
          Start
        </Button>
        <button
          type="button"
          onClick={() => setSignIn(true)}
          className="focus-ring inline-flex min-h-11 cursor-pointer items-center rounded-sm text-sm font-medium text-brand underline underline-offset-4"
        >
          I already have an account
        </button>
      </div>
      {signIn && <LoginSheet askConsent={false} onClose={() => setSignIn(false)} onFinish={() => navigate('/dashboard')} />}
    </div>
  )
}
