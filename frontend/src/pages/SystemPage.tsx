import { Link } from 'react-router-dom'
import { Loti, type LotiPose } from '../components/features/characters'

export type SystemView = 'not-found' | 'offline' | 'error'

const VIEWS: Record<SystemView, { pose: LotiPose; title: string; line: string }> = {
  'not-found': { pose: 'think', title: "This page isn't here.", line: "Let's go back home." },
  offline: { pose: 'idle', title: "You're offline.", line: 'Your answers are saved on this device.' },
  error: { pose: 'idle', title: 'Something went wrong.', line: 'Your answers are safe. Try again from home.' },
}

/* The three plain states (ticket 09a): an unknown route, offline and an error. Loti, one heading,
   one line and one way home. The old diagnostics console (logs, crash bench, queue simulator) is gone. */
export default function SystemPage({ view = 'not-found' }: { view?: SystemView }) {
  const v = VIEWS[view]
  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-4 py-12 text-center">
      <Loti pose={v.pose} size="md" />
      <h1 className="font-display text-3xl font-bold text-ink">{v.title}</h1>
      <p className="text-lg text-ink">{v.line}</p>
      <Link
        to="/dashboard"
        className="tactile-btn inline-flex min-h-11 items-center justify-center border-transparent bg-brand px-6 py-3 text-lg font-semibold text-brand-ink no-underline hover:bg-brand-hover"
      >
        Go home
      </Link>
    </div>
  )
}
