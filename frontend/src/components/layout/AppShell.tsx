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
import conceptALockup from '../../assets/branding/concept-a-lockup.svg'
import { useAppStore } from '../../state/useAppStore'
import { telemetryQueue } from '../../services/telemetry/telemetryQueue'
import { Badge } from '../ui/Badge'
import { EmilyMoodPill } from '../common/EmilyMoodPill'
import { HumanReviewGate } from '../dev/HumanReviewGate'

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
  const [queueStatus, setQueueStatus] = useState(() => telemetryQueue.getStatus())

  useEffect(() => {
    return telemetryQueue.subscribe(() => {
      setQueueStatus(telemetryQueue.getStatus())
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
      return {
        label: 'Nearly Done',
        badgeClass: 'bg-success-subtle text-ink border-border-strong',
        dotClass: 'bg-success',
      }
    }
    if (pathname === '/' || pathname === '/dashboard') {
      return {
        label: 'In Progress',
        badgeClass: 'bg-warning-subtle text-ink border-border-strong',
        dotClass: 'bg-warning animate-pulse',
      }
    }
    return {
      label: 'Pending',
      badgeClass: 'bg-surface-raised text-ink-muted border-border-strong',
      dotClass: 'bg-ink-muted/50',
    }
  }

  const pageProgress = getPageProgress(location.pathname)

  const isRealOffline = !queueStatus.isOnline
  const showOfflineBanner = simulateOffline || isRealOffline

  return (
    <div className={`min-h-screen flex flex-col bg-canvas text-ink ${location.pathname === '/' ? 'pb-0' : 'pb-16 md:pb-0'}`}>
      {/* Skip link for keyboard users (Tab stop 1) */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:start-2 focus:z-50 focus:px-4 focus:py-2 focus:rounded-sm focus:border-2 focus:border-border-strong focus:bg-brand focus:text-brand-ink focus:font-bold focus:shadow-doodle"
      >
        Skip to main content
      </a>

      {/* Global Robustness Banner (Truth in claims: Real queue status) - suppressed during distraction-free calibration */}
      {!isBaselineMode && showOfflineBanner && (
        <div
          role="status"
          aria-live="polite"
          className="bg-warning-subtle border-b-2 border-border-strong px-4 py-2 text-xs md:text-sm font-bold text-ink flex flex-wrap items-center justify-between gap-2"
        >
          <span className="flex items-center gap-1.5">
            <WifiOff size={16} aria-hidden="true" className="text-warning" />
            {isRealOffline ? (
              <span>
                <strong>Connection dropped:</strong> Your answers are saved locally on this device ({queueStatus.queuedCount} in buffer).
              </span>
            ) : (
              <span>
                <strong>Offline Mode Active:</strong> Trial telemetry is buffered locally (up to 500 events) and will sync automatically when your connection returns ({queueStatus.queuedCount} queued).
              </span>
            )}
          </span>
          <Badge tone="warning" glyph="⚡">
            Queue Ready ({queueStatus.queuedCount} / {queueStatus.maxCapacity})
          </Badge>
        </div>
      )}

      {!isBaselineMode && simulateLlmDown && (
        <div
          role="status"
          aria-live="polite"
          className="bg-info-subtle border-b-2 border-border-strong px-4 py-2 text-xs md:text-sm font-bold text-ink flex flex-wrap items-center justify-between gap-2"
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

      {/* Global Hand-Ink Wobble and Diagonal Hatch Filter Definitions */}
      <svg aria-hidden="true" className="absolute w-0 h-0 pointer-events-none">
        <defs>
          <filter id="hand-ink" x="-2%" y="-2%" width="104%" height="104%">
            <feTurbulence type="fractalNoise" baseFrequency="0.04" numOctaves="3" result="noise" />
            <feDisplacementMap in="SourceGraphic" in2="noise" scale="1.4" xChannelSelector="R" yChannelSelector="G" />
          </filter>
          <pattern id="diagonalHatch" width="8" height="8" patternUnits="userSpaceOnUse">
            <path d="M-1,1 l2,-2 M0,8 l8,-8 M7,9 l2,-2" stroke="var(--color-secondary)" strokeWidth="1.2" strokeOpacity="0.35" />
          </pattern>
        </defs>
      </svg>

      {/* Top Consumer Navigation Header with Doodle Sketch Border */}
      {!isTaskRoute && (
        <header
          role="banner"
          className="sticky top-0 z-50 w-full h-18 sm:h-20 bg-surface/95 backdrop-blur-md border-b-2 border-border-strong px-4 transition-colors flex items-center"
        >
          <div className="max-w-6xl w-full mx-auto flex items-center justify-between gap-4">
            {/* Product Brand Mark */}
            <Link
              to="/"
              title={`${BRAND_CONFIG.productName} Home`}
              aria-label={`${BRAND_CONFIG.productName} Home`}
              className="focus-ring rounded-md flex items-center text-ink no-underline group py-1 shrink-0"
            >
              <img
                src={conceptALockup}
                alt={BRAND_CONFIG.productName}
                className={`h-11 sm:h-13 md:h-14 w-auto object-contain transition-transform group-hover:scale-105 ${
                  theme === 'dark' ? 'brightness-0 invert' : ''
                }`}
              />
            </Link>

            {/* 5 Primary Consumer Destinations Navbar (Desktop) or Skip intro on Welcome first run */}
            {location.pathname === '/' ? (
              <div className="flex-1 flex justify-end items-center mr-2">
                <Link
                  to="/dashboard"
                  className="focus-ring px-3.5 py-1.5 rounded-sm text-xs sm:text-sm font-bold text-ink hover:bg-brand-subtle transition-colors no-underline inline-flex items-center gap-1.5 border-2 border-border-strong shadow-doodle-sm"
                >
                  <span>Skip intro</span>
                  <span aria-hidden="true">→</span>
                </Link>
              </div>
            ) : (
              <nav
                aria-label="Primary product navigation"
                className="hidden md:flex items-center gap-1 p-1 rounded-pill bg-surface-raised border-2 border-border-strong shadow-doodle-sm"
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
                      className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-pill text-xs font-bold no-underline transition-all ${
                        isActive
                          ? 'bg-brand text-brand-ink border border-border-strong shadow-doodle-sm'
                          : 'text-ink-muted hover:text-ink hover:bg-canvas'
                      }`}
                    >
                      <Icon size={14} aria-hidden="true" />
                      <span>{item.label}</span>
                    </Link>
                  )
                })}
              </nav>
            )}

            {/* EMILY Emotion Atmosphere & Micro-Interaction Rhythm */}
            <EmilyMoodPill />

            {/* Protected Streak Pill matching Stitch */}
            <div className="hidden sm:flex items-center gap-1.5 px-3 py-1 bg-surface-raised border-2 border-border-strong rounded-pill shadow-doodle-sm">
              <span className="text-danger text-xs" aria-hidden="true">🔥</span>
              <span className="font-mono text-xs text-ink font-semibold">12d · Wed Rest</span>
            </div>

            {/* Utility Controls & Floating Judge Drawer Toggle */}
            <div className="flex items-center gap-2">
              {!isAuthRoute && (
                <Link
                  to="/auth"
                  title={isAuthenticated ? `Signed in as ${userProfile?.preferredName || 'Explorer'}` : 'Sign In to Your Sanctuary'}
                  aria-label={isAuthenticated ? `Profile: ${userProfile?.preferredName || 'Explorer'}` : 'Sign In'}
                  className="focus-ring px-3 py-1.5 rounded-sm border border-border-strong bg-surface text-ink hover:bg-surface-raised shadow-doodle-sm transition-colors no-underline inline-flex items-center gap-1.5 font-mono text-xs font-bold"
                >
                  <User size={14} aria-hidden="true" className={isAuthenticated ? 'text-success' : 'text-brand'} />
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
                className="focus-ring p-2 rounded-sm border border-border-strong bg-surface text-ink hover:bg-surface-raised shadow-doodle-sm transition-colors cursor-pointer"
              >
                {theme === 'light' ? <Moon size={16} aria-hidden="true" /> : <Sun size={16} aria-hidden="true" />}
              </button>

              <Link
                to="/privacy"
                title="Privacy Center & Non-Biometric Lock"
                aria-label="Privacy Center"
                className="focus-ring p-2 rounded-sm border border-border-strong bg-surface text-ink hover:bg-surface-raised shadow-doodle-sm transition-colors no-underline hidden sm:inline-flex items-center justify-center"
              >
                <ShieldCheck size={16} aria-hidden="true" />
              </Link>

              <Link
                to="/settings"
                title="Settings & Accessibility Controls"
                aria-label="Settings"
                className="focus-ring p-2 rounded-sm border border-border-strong bg-surface text-ink hover:bg-surface-raised shadow-doodle-sm transition-colors no-underline hidden sm:inline-flex items-center justify-center"
              >
                <Settings size={16} aria-hidden="true" />
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
        {/* Team Sprint Progress Badge - positioned in the top-right empty padding area */}
        <aside
          aria-label="Sprint progress status"
          className="absolute top-2 right-4 sm:top-3 sm:right-6 lg:right-8 z-30 pointer-events-none"
        >
          <div
            data-testid="page-progress-badge"
            title={`Sprint Progress: ${pageProgress.label}`}
            aria-label={`Page progress: ${pageProgress.label}`}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-pill font-mono text-xs font-bold border-2 shadow-doodle-sm select-none pointer-events-auto ${pageProgress.badgeClass}`}
          >
            <span className={`w-2 h-2 rounded-full shrink-0 ${pageProgress.dotClass}`} aria-hidden="true" />
            <span className="hidden sm:inline text-ink-muted font-normal">Progress: </span>
            <span>{pageProgress.label}</span>
          </div>
        </aside>

        {children}
      </main>

      {/* Product Footer with Centered Non-Clinical Disclaimer & Evaluator Controls */}
      {!isTaskRoute && (
        <footer
          role="contentinfo"
          className="border-t-2 border-border-strong bg-surface px-4 py-4 text-xs text-ink-muted"
        >
          <div className="max-w-6xl mx-auto flex flex-col items-center justify-center text-center gap-2">
            <p className="m-0">{BRAND_CONFIG.nonClinicalNotice}</p>
            <HumanReviewGate />
          </div>
        </footer>
      )}

      {/* Mobile Bottom Tab Bar */}
      {location.pathname !== '/' && !isTaskRoute && !isAuthRoute && (
        <nav
          aria-label="Mobile bottom navigation"
          className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-surface/95 backdrop-blur-md border-t-2 border-border-strong flex items-center justify-around py-1.5 px-2"
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
                className={`flex flex-col items-center gap-0.5 px-2 py-1 rounded-sm text-xs no-underline transition-all ${
                  isActive
                    ? 'text-brand font-bold'
                    : 'text-ink-muted hover:text-ink'
                }`}
              >
                <Icon size={18} aria-hidden="true" />
                <span className="text-xs">{item.label}</span>
              </Link>
            )
          })}
        </nav>
      )}
    </div>
  )
}

export default AppShell
