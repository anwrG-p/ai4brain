import React, { useState, useEffect } from 'react'
import { Link, useLocation } from 'react-router-dom'
import {
  Compass,
  Target,
  Bot,
  TrendingUp,
  User,
  ShieldCheck,
  Settings,
  Moon,
  Sun,
  WifiOff,
  Cpu,
} from 'lucide-react'
import { BRAND_CONFIG } from '../../config/brand'
import { useAppStore } from '../../state/useAppStore'
import { tracker } from '../../features/assessment/telemetry/tracker'
import { Badge } from '../ui/Badge'
import { BrianLogo } from '../features/brand/BrianLogo'
import { EmilyMoodPill } from '../common/EmilyMoodPill'
import { HumanReviewGate } from '../dev/HumanReviewGate'

// Icon-sized header controls: 44 px targets, colour change only.
const UTILITY_CONTROL =
  'focus-ring inline-flex min-h-11 min-w-11 items-center justify-center rounded-md text-ink-muted hover:text-ink hover:bg-surface-raised transition-colors'

export function AppShell({ children }: { children: React.ReactNode }) {
  const location = useLocation()
  const searchParams = new URLSearchParams(location.search)
  const isBaselineMode = searchParams.get('mode') === 'baseline'
  const isTaskRoute =
    location.pathname.startsWith('/task') ||
    location.pathname.startsWith('/practice') ||
    isBaselineMode
  const isAuthRoute =
    location.pathname === '/login' ||
    location.pathname === '/sign-in' ||
    location.pathname === '/register' ||
    location.pathname === '/create-account' ||
    location.pathname === '/auth'
  const {
    theme,
    toggleTheme,
    simulateOffline,
    simulateLlmDown,
    userProfile,
    isAuthenticated,
  } = useAppStore()

  // Real offline queue status
  const [queueStatus, setQueueStatus] = useState(() => tracker.getStatus())

  useEffect(() => {
    return tracker.subscribe(() => {
      setQueueStatus(tracker.getStatus())
    })
  }, [])

  // 5 Primary Consumer Destinations
  const consumerNavItems = [
    { path: '/dashboard', label: 'Today', icon: Compass },
    { path: '/assessment', label: 'Practice', icon: Target },
    { path: '/coach', label: 'Coach', icon: Bot },
    { path: '/brain-twin', label: 'Progress', icon: TrendingUp },
    { path: '/settings', label: 'You', icon: User },
  ]

  // Team Development Progress Status per page
  const getPageProgress = (pathname: string) => {
    if (
      pathname === '/auth' ||
      pathname === '/login' ||
      pathname === '/register' ||
      pathname === '/sign-in' ||
      pathname === '/create-account'
    ) {
      return 'Nearly Done'
    }
    if (pathname === '/' || pathname === '/dashboard') {
      return 'In Progress'
    }
    return 'Pending'
  }

  const pageProgress = getPageProgress(location.pathname)

  const isRealOffline = !queueStatus.isOnline
  // R3: after a decline nothing is kept to send, so being offline changes nothing for the user.
  const showOfflineBanner = queueStatus.consent !== 'denied' && (simulateOffline || isRealOffline)

  return (
    <div className={`min-h-screen flex flex-col bg-canvas text-ink ${location.pathname === '/' ? 'pb-0' : 'pb-16 lg:pb-0'}`}>
      {/* Skip link for keyboard users (Tab stop 1) */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:start-2 focus:z-50 focus:px-4 focus:py-2 focus:rounded-md focus:bg-brand focus:text-brand-ink focus:font-semibold"
      >
        Skip to main content
      </a>

      {/* Global Robustness Banner (Truth in claims: Real queue status) - suppressed during distraction-free calibration */}
      {!isBaselineMode && showOfflineBanner && (
        <div
          role="status"
          aria-live="polite"
          className="bg-warning-subtle border-b border-border px-4 py-2 text-xs md:text-sm text-ink flex flex-wrap items-center justify-between gap-2"
        >
          <span className="flex items-center gap-1.5">
            <WifiOff size={16} aria-hidden="true" className="text-warning" />
            {isRealOffline ? (
              <span>
                <strong>Connection dropped:</strong> Your answers are saved locally on this device ({queueStatus.queuedCount} in buffer).
              </span>
            ) : (
              <span>
                <strong>Offline Mode Active:</strong> Trial telemetry is buffered locally (up to {queueStatus.maxCapacity} events){' '}
                {/* Pending consent: nothing is sent, so no sync is promised. */}
                {queueStatus.consent === 'granted'
                  ? 'and will sync automatically when your connection returns'
                  : 'and stays on this device'}{' '}
                ({queueStatus.queuedCount} queued).
              </span>
            )}
          </span>
          {/* Pending: nothing is ready to go out, it is only kept here. */}
          <Badge tone="warning" glyph="⚡">
            {queueStatus.consent === 'granted'
              ? `Queue Ready (${queueStatus.queuedCount} / ${queueStatus.maxCapacity})`
              : `Saved on this device (${queueStatus.queuedCount})`}
          </Badge>
        </div>
      )}

      {!isBaselineMode && simulateLlmDown && (
        <div
          role="status"
          aria-live="polite"
          className="bg-info-subtle border-b border-border px-4 py-2 text-xs md:text-sm text-ink flex flex-wrap items-center justify-between gap-2"
        >
          <span className="flex items-center gap-1.5">
            <Cpu size={16} aria-hidden="true" className="text-brand" />
            <span>
              <strong>Deterministic Fallback:</strong> Cognitive assessment and coaching operating via verified rule templates.
            </span>
          </span>
          <Badge tone="info" glyph="◈">
            Deterministic Engine
          </Badge>
        </div>
      )}

      {/* Top Consumer Navigation Header (64 px, DEC-008) */}
      {!isTaskRoute && (
        <header
          role="banner"
          className="sticky top-0 z-50 w-full h-16 bg-surface border-b border-border px-4 flex items-center"
        >
          <div className="max-w-6xl w-full mx-auto flex items-center justify-between gap-2 sm:gap-3">
            {/* Product Brand Mark: fill is currentColor, so it follows --color-ink in both themes */}
            <Link
              to="/"
              title={`${BRAND_CONFIG.productName} Home`}
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

            {/* 5 Primary Consumer Destinations Navbar (lg and up; below that the bottom tabs) or Skip intro on Welcome first run */}
            {location.pathname === '/' ? (
              <div className="flex-1 flex justify-end items-center">
                <Link
                  to="/dashboard"
                  className="focus-ring inline-flex min-h-11 items-center gap-1.5 rounded-md border border-border-strong px-3.5 text-sm font-semibold text-ink no-underline hover:bg-surface-raised transition-colors"
                >
                  <span>Skip intro</span>
                  <span aria-hidden="true">→</span>
                </Link>
              </div>
            ) : (
              <nav aria-label="Primary product navigation" className="hidden lg:flex items-center gap-1">
                {consumerNavItems.map((item) => {
                  const isActive =
                    item.path === '/dashboard'
                      ? location.pathname === '/dashboard'
                      : location.pathname.startsWith(item.path)

                  return (
                    <Link
                      key={item.path}
                      to={item.path}
                      aria-current={isActive ? 'page' : undefined}
                      className={`focus-ring rounded-sm px-3 py-2 border-b-2 text-sm font-medium no-underline transition-colors ${
                        isActive
                          ? 'border-brand text-brand'
                          : 'border-transparent text-ink-muted hover:text-ink'
                      }`}
                    >
                      {item.label}
                    </Link>
                  )
                })}
              </nav>
            )}

            {/* EMILY Emotion Atmosphere & Micro-Interaction Rhythm */}
            <EmilyMoodPill />

            {/* Utility Controls */}
            <div className="flex items-center gap-1">
              {!isAuthRoute && (
                <Link
                  to="/auth"
                  title={isAuthenticated ? `Signed in as ${userProfile?.preferredName || 'Explorer'}` : 'Sign In to Your Sanctuary'}
                  aria-label={isAuthenticated ? `Profile: ${userProfile?.preferredName || 'Explorer'}` : 'Sign In'}
                  className={`${UTILITY_CONTROL} gap-1.5 px-2.5 text-sm font-medium no-underline`}
                >
                  <User size={18} aria-hidden="true" className={isAuthenticated ? 'text-success' : 'text-brand'} />
                  <span className="hidden sm:inline">
                    {isAuthenticated ? (userProfile?.preferredName || 'Explorer') : 'Sign In'}
                  </span>
                </Link>
              )}
              <button
                type="button"
                aria-label={theme === 'light' ? 'Switch to Dark (Night Lab)' : 'Switch to Light (Playful Lab)'}
                title={theme === 'light' ? 'Switch to Dark (Night Lab)' : 'Switch to Light (Playful Lab)'}
                onClick={toggleTheme}
                className={`${UTILITY_CONTROL} cursor-pointer`}
              >
                {theme === 'light' ? <Moon size={18} aria-hidden="true" /> : <Sun size={18} aria-hidden="true" />}
              </button>

              <Link
                to="/privacy"
                title="Privacy Center & Non-Biometric Lock"
                aria-label="Privacy Center"
                className={`${UTILITY_CONTROL} no-underline max-sm:hidden`}
              >
                <ShieldCheck size={18} aria-hidden="true" />
              </Link>

              <Link
                to="/settings"
                title="Settings & Accessibility Controls"
                aria-label="Settings"
                className={`${UTILITY_CONTROL} no-underline max-sm:hidden`}
              >
                <Settings size={18} aria-hidden="true" />
              </Link>
            </div>
          </div>
        </header>
      )}

      {/* Main Content Column */}
      <main
        id="main-content"
        className={`relative flex-1 w-full min-w-0 mx-auto px-4 ${
          isTaskRoute
            ? 'max-w-4xl py-2 sm:py-4 flex flex-col justify-between'
            : 'max-w-6xl py-8'
        }`}
      >
        {/* Team Sprint Progress Badge - small and muted, in the top-right padding area */}
        <aside
          aria-label="Sprint progress status"
          className="absolute top-2 right-4 sm:right-6 lg:right-8 z-30 pointer-events-none"
        >
          <Badge
            tone="neutral"
            data-testid="page-progress-badge"
            title={`Sprint Progress: ${pageProgress}`}
            aria-label={`Page progress: ${pageProgress}`}
            className="select-none pointer-events-auto font-medium"
          >
            <span className="hidden sm:inline">Progress: </span>
            {pageProgress}
          </Badge>
        </aside>

        {children}
      </main>

      {/* Product Footer: one muted non-clinical line plus the evaluator controls */}
      {!isTaskRoute && (
        <footer
          role="contentinfo"
          className="border-t border-border bg-surface px-4 py-4 text-xs text-ink-muted"
        >
          <div className="max-w-6xl mx-auto flex flex-col items-center justify-center text-center gap-2">
            <p className="m-0">{BRAND_CONFIG.nonClinicalNotice}</p>
            <HumanReviewGate />
          </div>
        </footer>
      )}

      {/* Mobile Bottom Tab Bar: Lucide icons with labels */}
      {location.pathname !== '/' && !isTaskRoute && !isAuthRoute && (
        <nav
          aria-label="Mobile bottom navigation"
          className="lg:hidden fixed bottom-0 inset-x-0 z-40 bg-surface border-t border-border flex items-center justify-around px-2"
        >
          {consumerNavItems.map((item) => {
            const Icon = item.icon
            const isActive =
              item.path === '/dashboard'
                ? location.pathname === '/dashboard'
                : location.pathname.startsWith(item.path)

            return (
              <Link
                key={item.path}
                to={item.path}
                aria-current={isActive ? 'page' : undefined}
                className={`focus-ring flex min-h-11 min-w-11 flex-col items-center justify-center gap-0.5 px-2 py-1 rounded-sm text-xs no-underline transition-colors ${
                  isActive ? 'text-brand font-semibold' : 'text-ink-muted hover:text-ink'
                }`}
              >
                <Icon size={20} aria-hidden="true" />
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
