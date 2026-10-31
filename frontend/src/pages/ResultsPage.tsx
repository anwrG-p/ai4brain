import { useMemo, useState, useSyncExternalStore } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { Dolphin } from '../components/features/characters'
import { Button } from '../components/ui/Button'
import { tracker } from '../features/assessment/telemetry/tracker'
import { LoginSheet } from '../features/flow/LoginSheet'
import { PillarRadar } from '../features/insights/PillarRadar'
import { pillarScores } from '../features/insights/pillars'
import { useSessionStore } from '../features/insights/sessionStore'

const subscribe = (fn: () => void) => tracker.subscribe(fn)
const consentNow = () => tracker.getStatus().consent

/* Results, in order: the radar blurred ("Your results are ready") and the Dolphin's "Good job!";
   one button opens the login sheet (Loti, Google per R4 or guest, then the equal consent choice,
   R3); the choice un-blurs the radar; one button goes to the dashboard. Someone who already chose
   sees the clear radar at once. Each step: one message, one action (rules 13, 14). */
export default function ResultsPage() {
  const navigate = useNavigate()
  const latest = useSessionStore((s) => s.sessions.at(-1))
  const consent = useSyncExternalStore(subscribe, consentNow)
  const [sheet, setSheet] = useState(false)
  const [chose, setChose] = useState(false) // chose on this visit: focus moves to the next step
  const scores = useMemo(() => (latest ? pillarScores(latest.inputs) : null), [latest])

  if (!scores) return <Navigate to="/" replace />
  const blurred = consent === 'pending'

  return (
    <div className="mx-auto flex max-w-xl flex-col items-center gap-6 pt-4 pb-12 text-center">
      <h1 className="font-display text-3xl font-bold text-ink">{blurred ? 'Your results are ready' : 'Your results'}</h1>
      <PillarRadar scores={scores} blurred={blurred} className="max-w-lg" />
      {blurred ? (
        <>
          <div className="flex flex-col items-center gap-2">
            <Dolphin pose="swim-in" size="md" />
            <p className="text-lg text-ink">Good job! You finished all five.</p>
          </div>
          <Button size="lg" onClick={() => setSheet(true)}>
            See my results
          </Button>
          {sheet && (
            <LoginSheet
              askConsent
              onClose={() => setSheet(false)}
              onFinish={() => {
                setSheet(false)
                setChose(true)
              }}
            />
          )}
        </>
      ) : (
        <Button size="lg" autoFocus={chose} onClick={() => navigate('/dashboard')}>
          Go to my space
        </Button>
      )}
    </div>
  )
}
