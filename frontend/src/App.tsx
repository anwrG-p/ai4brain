import React, { Suspense } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AppShell } from './components/layout/AppShell'
import { ErrorBoundary } from './components/layout/ErrorBoundary'

const WelcomePage = React.lazy(() => import('./pages/WelcomePage'))
const OnboardingPage = React.lazy(() => import('./pages/OnboardingPage'))
const AssessmentHubPage = React.lazy(() => import('./pages/AssessmentHubPage'))
const TaskRunnerPage = React.lazy(() => import('./pages/TaskRunnerPage'))
const ProfileRevealPage = React.lazy(() => import('./pages/ProfileRevealPage'))
const DashboardPage = React.lazy(() => import('./pages/DashboardPage'))
const DimensionDetailPage = React.lazy(
  () => import('./pages/DimensionDetailPage'),
)
const PlanPage = React.lazy(() => import('./pages/PlanPage'))
const GoalsPage = React.lazy(() => import('./pages/GoalsPage'))
const BrainTwinPage = React.lazy(() => import('./pages/BrainTwinPage'))
const AiCoachPage = React.lazy(() => import('./pages/AiCoachPage'))
const CollaborationScorePage = React.lazy(
  () => import('./pages/CollaborationScorePage'),
)
const PrivacyPage = React.lazy(() => import('./pages/PrivacyPage'))
const SystemPage = React.lazy(() => import('./pages/SystemPage'))
const SettingsPage = React.lazy(() => import('./pages/SettingsPage'))
const MethodologyPage = React.lazy(() => import('./pages/MethodologyPage'))
const LayerDPage = React.lazy(() => import('./pages/LayerDPage'))
const DesignSystemPage = React.lazy(() => import('./pages/DesignSystemPage'))
const AuthPage = React.lazy(() => import('./pages/AuthPage'))

function RouteLoadingSkeleton() {
  return (
    <div
      role="status"
      aria-label="Loading page"
      className="tactile-card p-6 space-y-4"
    >
      <div className="h-8 w-64 rounded-sm bg-surface-raised" />
      <div className="h-4 w-96 rounded-sm bg-surface-raised" />
      <div className="h-64 w-full rounded-md bg-surface-raised" />
    </div>
  )
}

export function App() {
  return (
    <BrowserRouter
      future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
    >
      <AppShell>
        <ErrorBoundary>
          <Suspense fallback={<RouteLoadingSkeleton />}>
            <Routes>
              <Route path="/" element={<WelcomePage />} />
              <Route path="/auth" element={<AuthPage />} />
              <Route path="/login" element={<Navigate to="/auth" replace />} />
              <Route path="/sign-in" element={<Navigate to="/auth" replace />} />
              <Route path="/register" element={<Navigate to="/auth?mode=register" replace />} />
              <Route path="/create-account" element={<Navigate to="/auth?mode=register" replace />} />
              <Route path="/onboarding" element={<OnboardingPage />} />
              <Route path="/assessment" element={<AssessmentHubPage />} />
              <Route
                path="/task"
                element={
                  <Navigate to="/task/episodic_pattern_separation" replace />
                }
              />
              <Route path="/task/:dimId" element={<TaskRunnerPage />} />
              <Route path="/profile-reveal" element={<ProfileRevealPage />} />
              <Route path="/dashboard" element={<DashboardPage />} />
              <Route
                path="/dimensions"
                element={<Navigate to="/dimensions/working_memory" replace />}
              />
              <Route
                path="/dimensions/:dimId"
                element={<DimensionDetailPage />}
              />
              <Route path="/plan" element={<PlanPage />} />
              <Route path="/goals" element={<GoalsPage />} />
              <Route path="/collaboration" element={<CollaborationScorePage />} />
              <Route path="/privacy" element={<PrivacyPage />} />
              <Route path="/brain-twin" element={<BrainTwinPage />} />
              <Route path="/coach" element={<AiCoachPage />} />
              <Route path="/system" element={<SystemPage defaultTab="404" />} />
              <Route path="/system/:subView" element={<SystemPage />} />
              <Route path="/404" element={<SystemPage defaultTab="404" />} />
              <Route path="/offline" element={<SystemPage defaultTab="offline" />} />
              <Route path="/system-error" element={<SystemPage defaultTab="error" />} />
              <Route path="/settings" element={<SettingsPage />} />
              <Route path="/methodology" element={<MethodologyPage />} />
              <Route path="/layer-d" element={<LayerDPage />} />
              <Route path="/design-system" element={<DesignSystemPage />} />
              <Route path="*" element={<SystemPage defaultTab="404" />} />
            </Routes>
          </Suspense>
        </ErrorBoundary>
      </AppShell>
    </BrowserRouter>
  )
}

export default App
