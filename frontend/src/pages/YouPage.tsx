import { useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { BookOpen, ChevronRight, LogIn, LogOut, Settings, ShieldCheck, UserRound, type LucideIcon } from 'lucide-react'
import { LoginSheet } from '../features/flow/LoginSheet'
import { useAppStore } from '../state/useAppStore'

const ICON = { size: 20, strokeWidth: 1.75, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true } as const
const ROW = 'focus-ring flex min-h-14 w-full cursor-pointer items-center gap-3 px-4 text-left text-base font-medium text-ink no-underline hover:bg-surface-raised'

/* You: who you are, then four rows (Privacy, Settings, How we calculate this, Sign in or out).
   One list in one container, no cards in cards (anti-slop rules 6, 13). The profile is the name
   line: there is no separate profile page to fold in. "Delete my data" lives inside Privacy. */
export default function YouPage() {
  const isAuthenticated = useAppStore((s) => s.isAuthenticated)
  const profile = useAppStore((s) => s.userProfile)
  const logoutUser = useAppStore((s) => s.logoutUser)
  const [signIn, setSignIn] = useState(false)
  const name = isAuthenticated ? profile?.preferredName || 'Friend' : 'Guest'

  return (
    <div className="mx-auto flex max-w-xl flex-col gap-8 pb-12">
      <div className="flex items-center gap-4">
        <span
          aria-hidden="true"
          className="flex size-14 shrink-0 items-center justify-center rounded-pill bg-brand-subtle font-display text-2xl font-bold text-brand"
        >
          {isAuthenticated ? name.charAt(0).toUpperCase() : <UserRound {...ICON} size={24} />}
        </span>
        <div className="min-w-0">
          <h1 className="truncate font-display text-3xl font-bold text-ink">{name}</h1>
          <p className="truncate text-sm text-ink-muted">{isAuthenticated ? profile?.email || 'Signed in' : 'Not signed in'}</p>
        </div>
      </div>

      <nav aria-label="You">
        <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-surface">
          <li>
            <Link to="/privacy" className={ROW}>
              <Label icon={ShieldCheck}>Privacy</Label>
            </Link>
          </li>
          <li>
            <Link to="/settings" className={ROW}>
              <Label icon={Settings}>Settings</Label>
            </Link>
          </li>
          <li>
            <Link to="/methodology" className={ROW}>
              <Label icon={BookOpen}>How we calculate this</Label>
            </Link>
          </li>
          <li>
            <button type="button" className={ROW} onClick={isAuthenticated ? logoutUser : () => setSignIn(true)}>
              <Label icon={isAuthenticated ? LogOut : LogIn} chevron={false}>
                {isAuthenticated ? 'Sign out' : 'Sign in'}
              </Label>
            </button>
          </li>
        </ul>
      </nav>

      {signIn && <LoginSheet askConsent={false} onClose={() => setSignIn(false)} onFinish={() => setSignIn(false)} />}
    </div>
  )
}

function Label({ icon: Icon, chevron = true, children }: { icon: LucideIcon; chevron?: boolean; children: ReactNode }) {
  return (
    <>
      <Icon {...ICON} className="shrink-0 text-ink-muted" />
      <span className="flex-1">{children}</span>
      {chevron && <ChevronRight {...ICON} className="shrink-0 text-ink-muted" />}
    </>
  )
}
