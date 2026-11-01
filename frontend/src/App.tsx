import React, { Suspense, useState } from 'react'
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { AppShell } from './components/layout/AppShell'
import { ErrorBoundary } from './components/layout/ErrorBoundary'
import { useSessionStore } from './features/insights/sessionStore'
import { useAppStore } from './state/useAppStore'

const WelcomePage = React.lazy(() => import('./pages/WelcomePage'))
const BaselinePage = React.lazy(() => import('./pages/BaselinePage'))
const ResultsPage = React.lazy(() => import('./pages/ResultsPage'))
const DashboardPage = React.lazy(() => import('./pages/DashboardPage'))
const TrainPage = React.lazy(() => import('./pages/TrainPage'))
const TaskRunnerPage = React.lazy(() => import('./pages/TaskRunnerPage'))
const CoachPage = React.lazy(() => import('./pages/CoachPage'))
const YouPage = React.lazy(() => import('./pages/YouPage'))
const PrivacyPage = React.lazy(() => import('./pages/PrivacyPage'))
const SettingsPage = React.lazy(() => import('./pages/SettingsPage'))
const MethodologyPage = React.lazy(() => import('./pages/MethodologyPage'))
const SystemPage = React.lazy(() => import('./pages/SystemPage'))

/* Old routes (pre brand v2) and where they go now (ticket 09a). Their pages are deleted; a link or a
   bookmark lands on the new equivalent instead of a 404. */
export const REDIRECTS: Record<string, string> = {
  '/onboarding': '/',
  '/auth': '/', // sign-in lives in Welcome's and Results' login sheet
  '/login': '/',
  '/sign-in': '/',
  '/register': '/',
  '/create-account': '/',
  '/practice': '/baseline',
  '/assessment': '/train',
  '/plan': '/train',
  '/task': '/train',
  '/profile-reveal': '/results',
  '/reveal': '/results',
  '/goals': '/dashboard',
  '/brain-twin': '/dashboard',
  '/collaboration': '/dashboard',
  '/layer-d': '/dashboard',
  '/design-system': '/dashboard',
  '/dimensions': '/you',
  '/dimensions/:dimId': '/you',
}

// The query string rides along (e.g. ?judge=1, ?fast=1).
function RedirectKeepQuery({ to }: { to: string }) {
  const { search } = useLocation()
  return <Navigate to={{ pathname: to, search }} replace />
}

/* The first-visit flow (Welcome, then the baseline) is for new devices only (user, INT-1 item 14: "an
   old user doesn't need to redo the test"). A device with a saved session goes to Home instead, with
   replace so Back does not loop. Users are anonymous (R13), so "returning" means this device. The
   store is read once, synchronously, before the page renders: Welcome never flashes, and a session
   saved at the end of the baseline does not redirect it away from /results. `?again=1` on /baseline
   is the explicit retake (no button links to it; Train plays any exercise). */
function FirstVisitOnly({ children, allowAgain = false }: { children: React.ReactNode; allowAgain?: boolean }) {
  const { search } = useLocation()
  const [returning] = useState(
    () => useSessionStore.getState().sessions.length > 0 || useAppStore.getState().isAuthenticated,
  )
  const again = allowAgain && new URLSearchParams(search).get('again') === '1'
  return returning && !again ? <Navigate to="/dashboard" replace /> : <>{children}</>
}

function RouteLoadingSkeleton() {
  return (
    <div role="status" aria-label="Loading page" className="space-y-4">
      <div className="h-8 w-48 max-w-full rounded-sm bg-surface-raised" />
      <div className="h-64 w-full rounded-md bg-surface-raised" />
    </div>
  )
}

export function App() {
  return (
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <AppShell>
        <ErrorBoundary>
          <Suspense fallback={<RouteLoadingSkeleton />}>
            <Routes>
              <Route
                path="/"
                element={
                  <FirstVisitOnly>
                    <WelcomePage />
                  </FirstVisitOnly>
                }
              />
              <Route
                path="/baseline"
                element={
                  <FirstVisitOnly allowAgain>
                    <BaselinePage />
                  </FirstVisitOnly>
                }
              />
              <Route path="/results" element={<ResultsPage />} />
              <Route path="/dashboard" element={<DashboardPage />} />
              <Route path="/train" element={<TrainPage />} />
              <Route path="/task/:dimId" element={<TaskRunnerPage />} />
              <Route path="/coach" element={<CoachPage />} />
              <Route path="/you" element={<YouPage />} />
              <Route path="/privacy" element={<PrivacyPage />} />
              <Route path="/settings" element={<SettingsPage />} />
              <Route path="/methodology" element={<MethodologyPage />} />
              <Route path="/offline" element={<SystemPage view="offline" />} />
              <Route path="/system-error" element={<SystemPage view="error" />} />
              {Object.entries(REDIRECTS).map(([from, to]) => (
                <Route key={from} path={from} element={<RedirectKeepQuery to={to} />} />
              ))}
              <Route path="*" element={<SystemPage />} />
            </Routes>
          </Suspense>
        </ErrorBoundary>
      </AppShell>
    </BrowserRouter>
  )
}

export default App
