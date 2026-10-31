import React, { useSyncExternalStore } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { Dumbbell, House, MessageCircle, Moon, Sun, User, WifiOff, type LucideIcon } from 'lucide-react'
import { BRAND_CONFIG } from '../../config/brand'
import { useAppStore } from '../../state/useAppStore'
import { tracker } from '../../features/assessment/telemetry/tracker'
import { BrianLogo } from '../features/brand/BrianLogo'
import { HumanReviewGate } from '../dev/HumanReviewGate'
import { Button } from '../ui/Button'
import { EmotionListener } from './EmotionListener'
import { useJudgeMode } from './judgeMode'

// Icon-sized header controls: 44 px targets, colour change only.
const UTILITY_CONTROL =
  'focus-ring inline-flex min-h-11 min-w-11 items-center justify-center rounded-md text-ink-muted hover:text-ink hover:bg-surface-raised transition-colors'

// The 4 destinations (spec IA). Privacy, Settings and "How we calculate this" live under You.
const NAV: readonly { path: string; label: string; icon: LucideIcon }[] = [
  { path: '/dashboard', label: 'Home', icon: House },
  { path: '/train', label: 'Train', icon: Dumbbell },
  { path: '/coach', label: 'Loti', icon: MessageCircle },
  { path: '/you', label: 'You', icon: User },
]
// Pages reached from You keep You active in the nav.
const UNDER_YOU = ['/you', '/privacy', '/settings', '/methodology']
const isActive = (path: string, pathname: string) =>
  path === '/you' ? UNDER_YOU.some((p) => pathname.startsWith(p)) : pathname.startsWith(path)

const ICON = { strokeWidth: 1.75, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true } as const

const subscribeTracker = (onChange: () => void) => tracker.subscribe(onChange)
const trackerStatus = () => tracker.getStatus()

export function AppShell({ children }: { children: React.ReactNode }) {
  const { pathname } = useLocation()
  const judge = useJudgeMode()
  // The new-user flow (ticket 07): Welcome and Results keep only the logo and the theme toggle;
  // the baseline and the exercises run distraction-free, without the header.
  const isFlowRoute = pathname === '/' || pathname === '/results'
  const isTaskRoute = pathname === '/baseline' || pathname.startsWith('/task')
  const withNav = !isFlowRoute && !isTaskRoute
  const { theme, toggleTheme, simulateOffline, setSimulateOffline } = useAppStore()
  const status = useSyncExternalStore(subscribeTracker, trackerStatus)

  // R3: after a decline nothing is kept to send, so being offline changes nothing for the user.
  const offline = status.consent !== 'denied' && (simulateOffline || !status.isOnline)
  const themeLabel = theme === 'light' ? 'Switch to Dark (Night Lab)' : 'Switch to Light (Playful Lab)'

  return (
    <div className={`min-h-screen flex flex-col bg-canvas text-ink ${withNav ? 'pb-16 lg:pb-0' : ''}`}>
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:start-2 focus:z-50 focus:px-4 focus:py-2 focus:rounded-md focus:bg-brand focus:text-brand-ink focus:font-semibold"
      >
        Skip to main content
      </a>
      <EmotionListener />

      {offline && (
        <p
          role="status"
          className="m-0 bg-warning-subtle border-b border-border px-4 py-2 text-sm text-ink flex items-center justify-center gap-2"
        >
          <WifiOff size={16} {...ICON} className="shrink-0 text-warning" />
          You're offline. Your answers are saved on this device.
        </p>
      )}

      {!isTaskRoute && (
        <header className="sticky top-0 z-50 w-full h-16 bg-surface border-b border-border px-4 flex items-center">
          <div className="max-w-6xl w-full mx-auto flex items-center justify-between gap-3">
            <Link
              to={isFlowRoute ? '/' : '/dashboard'}
              aria-label={`${BRAND_CONFIG.productName} Home`}
              className="focus-ring rounded-md flex items-center text-ink no-underline shrink-0"
            >
              {/* Symbol only on phones so the header fits 375 px; viewBox cropped to the lockup's ink */}
              <BrianLogo variant="symbol" size={40} aria-hidden="true" className="sm:hidden" />
              <BrianLogo
                variant="lockup"
                viewBox="112 24 552 208"
                width={106}
                height={40}
                aria-hidden="true"
                className="max-sm:hidden"
              />
            </Link>

            {withNav && (
              <nav aria-label="Main" className="hidden lg:flex items-center gap-1">
                {NAV.map((item) => {
                  const active = isActive(item.path, pathname)
                  return (
                    <Link
                      key={item.path}
                      to={item.path}
                      aria-current={active ? 'page' : undefined}
                      className={`focus-ring rounded-sm px-3 py-2 border-b-2 text-sm font-medium no-underline transition-colors ${
                        active ? 'border-brand text-brand' : 'border-transparent text-ink-muted hover:text-ink'
                      }`}
                    >
                      {item.label}
                    </Link>
                  )
                })}
              </nav>
            )}

            <button
              type="button"
              aria-label={themeLabel}
              title={themeLabel}
              onClick={toggleTheme}
              className={`${UTILITY_CONTROL} cursor-pointer`}
            >
              {theme === 'light' ? <Moon size={20} {...ICON} /> : <Sun size={20} {...ICON} />}
            </button>
          </div>
        </header>
      )}

      <main
        id="main-content"
        className={`relative flex-1 w-full min-w-0 mx-auto px-4 ${
          isTaskRoute ? 'max-w-4xl py-2 sm:py-4 flex flex-col justify-between' : 'max-w-6xl py-8'
        }`}
      >
        {children}
      </main>

      {/* R6: the evaluator tools exist only in judge mode. The task runner carries its own. */}
      {judge && !isTaskRoute && (
        <section
          aria-label="Judge tools"
          className="border-t border-border bg-surface px-4 py-3 flex flex-wrap items-center justify-center gap-2"
        >
          <Button
            variant="secondary"
            size="sm"
            aria-pressed={simulateOffline}
            onClick={() => setSimulateOffline(!simulateOffline)}
          >
            Simulate offline
          </Button>
          <HumanReviewGate />
        </section>
      )}

      {withNav && (
        <footer className="border-t border-border bg-surface px-4 py-4 text-xs text-ink-muted">
          <p className="m-0 max-w-6xl mx-auto text-center">{BRAND_CONFIG.nonClinicalNotice}</p>
        </footer>
      )}

      {/* Mobile bottom tabs: the same 4 items, Lucide icons with labels */}
      {withNav && (
        <nav
          aria-label="Tabs"
          className="lg:hidden fixed bottom-0 inset-x-0 z-40 bg-surface border-t border-border flex items-center justify-around px-2"
        >
          {NAV.map((item) => {
            const Icon = item.icon
            const active = isActive(item.path, pathname)
            return (
              <Link
                key={item.path}
                to={item.path}
                aria-current={active ? 'page' : undefined}
                className={`focus-ring flex min-h-11 min-w-16 flex-col items-center justify-center gap-0.5 px-2 py-1 rounded-sm text-xs no-underline transition-colors ${
                  active ? 'text-brand font-semibold' : 'text-ink-muted hover:text-ink'
                }`}
              >
                <Icon size={20} {...ICON} />
                <span>{item.label}</span>
              </Link>
            )
          })}
        </nav>
      )}
    </div>
  )
}

export default AppShell
