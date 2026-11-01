import type { ReactNode } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { BookOpen, ChevronRight, LogOut, Settings, ShieldCheck, UserRound, type LucideIcon } from 'lucide-react'
import { Button } from '../components/ui/Button'
import { useAppStore } from '../state/useAppStore'

const ICON = { size: 20, strokeWidth: 1.75, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true } as const
const ROW = 'focus-ring flex min-h-14 w-full cursor-pointer items-center gap-3 px-4 text-left text-base font-medium text-ink no-underline hover:bg-surface-raised'

/* You: who you are, then three rows (Privacy, Settings, How we calculate this) and a Log out button.
   One list in one container, no cards in cards (anti-slop rules 6, 13).
   "Delete my data" lives inside Privacy. */
export default function YouPage() {
  const navigate = useNavigate()
  const profile = useAppStore((s) => (s.isAuthenticated ? s.userProfile : null))
  const logoutUser = useAppStore((s) => s.logoutUser)
  const name = profile ? profile.preferredName || 'Friend' : 'Guest'

  const handleLogout = () => {
    logoutUser()
    navigate('/')
  }

  return (
    <div className="mx-auto flex max-w-xl flex-col gap-8 pb-12">
      <div className="flex items-center gap-4">
        <span
          aria-hidden="true"
          className="flex size-14 shrink-0 items-center justify-center rounded-pill bg-brand-subtle font-display text-2xl font-bold text-brand"
        >
          {profile ? name.charAt(0).toUpperCase() : <UserRound {...ICON} size={24} />}
        </span>
        <h1 className="min-w-0 truncate font-display text-3xl font-bold text-ink">{name}</h1>
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
        </ul>
      </nav>

      <div className="pt-2">
        <Button
          variant="secondary"
          size="lg"
          className="w-full"
          leftIcon={<LogOut size={20} strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" />}
          onClick={handleLogout}
        >
          Log out
        </Button>
      </div>
    </div>
  )
}

function Label({ icon: Icon, children }: { icon: LucideIcon; children: ReactNode }) {
  return (
    <>
      <Icon {...ICON} className="shrink-0 text-ink-muted" />
      <span className="flex-1">{children}</span>
      <ChevronRight {...ICON} className="shrink-0 text-ink-muted" />
    </>
  )
}
