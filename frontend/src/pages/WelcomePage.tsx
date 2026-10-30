import { Link, useNavigate } from 'react-router-dom'
import { ArrowRight, Brain, Gamepad2, ShieldCheck, Sprout, type LucideIcon } from 'lucide-react'
import { useAppStore } from '../state/useAppStore'
import { Button } from '../components/ui/Button'

const STEPS: { title: string; line: string; Icon: LucideIcon }[] = [
  {
    title: '2-Minute Micro-Games',
    line: 'Memory, reaction and pattern puzzles that adapt to your pace.',
    Icon: Gamepad2,
  },
  {
    title: 'Your Living Brain Twin',
    line: 'Each estimate shows its range and updates as you play.',
    Icon: Brain,
  },
  {
    title: 'Zero-Guilt Growth',
    line: 'Short sessions that fit your day. Rest days never count against you.',
    Icon: Sprout,
  },
]

export default function WelcomePage() {
  const navigate = useNavigate()
  const { setActivePersona } = useAppStore()

  const handleStartBaseline = () => {
    setActivePersona('new-user')
    navigate('/onboarding')
  }

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-12 pt-8 pb-12 text-start">
      <section aria-labelledby="welcome-hero-heading" className="flex flex-col items-start gap-6">
        <div className="flex flex-col gap-3">
          <h1
            id="welcome-hero-heading"
            className="font-display text-3xl font-semibold text-ink leading-tight"
          >
            Let's map how your mind works in 2 minutes.
          </h1>
          <p className="text-lg text-ink-muted">
            A few short games show how you focus, remember and react, with nothing to fail.
          </p>
        </div>

        <div className="flex flex-col items-start gap-2">
          <Button
            id="start-baseline-btn"
            size="lg"
            onClick={handleStartBaseline}
            rightIcon={<ArrowRight aria-hidden="true" className="h-5 w-5" />}
          >
            Start my 2-minute baseline
          </Button>
          <Link
            to="/auth"
            className="focus-ring inline-flex min-h-11 items-center rounded-sm text-sm font-medium text-brand underline underline-offset-4"
          >
            Sign in
          </Link>
        </div>
      </section>

      <section aria-labelledby="how-it-works-heading" id="how-it-works" className="flex flex-col gap-5">
        <h2 id="how-it-works-heading" className="font-display text-2xl font-semibold text-ink">
          How SynapseTwin Works
        </h2>
        <ul className="flex flex-col gap-5">
          {STEPS.map(({ title, line, Icon }) => (
            <li key={title} className="flex items-start gap-4">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand-subtle text-brand">
                <Icon aria-hidden="true" className="h-5 w-5" />
              </span>
              <div>
                <h3 className="font-display text-lg font-semibold text-ink">{title}</h3>
                <p className="text-base text-ink-muted">{line}</p>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <div className="flex flex-col gap-2 border-t border-border pt-6 sm:flex-row sm:items-center sm:justify-between">
        <p className="flex items-center gap-2 text-sm text-ink">
          <ShieldCheck aria-hidden="true" className="h-5 w-5 shrink-0 text-accent" />
          Private by design: no camera, no microphone, no biometrics.
        </p>
        <Link
          to="/methodology"
          className="focus-ring inline-flex min-h-11 items-center rounded-sm text-sm font-medium text-brand underline underline-offset-4"
        >
          Read the methodology
        </Link>
      </div>
    </div>
  )
}
