import { Fragment, useEffect, useRef, useState, type CSSProperties } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Loti, type LotiPose } from '../components/features/characters'
import { useCharacterMotion } from '../components/features/characters/shared'
import { Button } from '../components/ui/Button'
import { LoginSheet } from '../features/flow/LoginSheet'

// Motion timeline (tokens.css, "Motion pass"): Loti rises (400 ms) and waves 3 times from 300 ms,
// then settles; the bubble follows and its words reveal; Start fades up at 900 ms.
const SETTLE_MS = 2400
// On Start the page leaves in 80 ms + 220 ms (anim-page-exit), then the baseline opens.
const EXIT_MS = 300

/* Welcome: Loti says hello, one button starts the baseline, one quiet link opens the login sheet.
   Nothing else (Landing page doc: "VERY SIMPLE UI early on"; anti-slop rules 13 and 14).
   Motion (spec R8, "Loti welcomes you into the app"): an entrance, a breathing idle, eyes that follow
   a mouse, a cheer on Start. With reduced motion every piece is off and Start goes at once. */
export default function WelcomePage() {
  const navigate = useNavigate()
  const { search } = useLocation()
  const [signIn, setSignIn] = useState(false)
  const motion = useCharacterMotion()
  const [pose, setPose] = useState<LotiPose>('wave')
  const [leaving, setLeaving] = useState(false)
  const [lotiRef, look] = useLookAt(motion && !leaving)
  const a = (cls: string) => (motion ? cls : '')
  // The query string rides along, so the e2e hook ?fast=1 reaches /baseline.
  const go = () => navigate({ pathname: '/baseline', search })

  useEffect(() => {
    if (!motion) return
    const t = window.setTimeout(() => setPose((p) => (p === 'wave' ? 'idle' : p)), SETTLE_MS)
    return () => window.clearTimeout(t)
  }, [motion])

  useEffect(() => {
    if (!leaving) return
    const t = window.setTimeout(() => navigate({ pathname: '/baseline', search }), EXIT_MS)
    return () => window.clearTimeout(t)
  }, [leaving, navigate, search])

  const start = () => {
    if (leaving) return
    if (!motion) return go()
    setPose('happy')
    setLeaving(true)
  }

  return (
    <div className={`mx-auto flex max-w-xl flex-col items-center gap-8 pt-6 pb-12 text-center sm:pt-12 ${leaving ? 'anim-page-exit' : ''}`}>
      <div className="flex flex-col items-center gap-3">
        <div ref={lotiRef} className={a('anim-rise')}>
          <Loti pose={pose} size="lg" alive={motion} look={look} />
        </div>
        <div className={`tactile-card max-w-md px-5 py-4 ${a('anim-bubble')}`}>
          <h1 className="font-display text-2xl font-bold text-ink">
            <Reveal text="Hi, I'm Loti." from={0} motion={motion} />
          </h1>
          <p className="mt-1 text-lg text-ink">
            <Reveal text="Want to see how your mind works today? It takes about 5 minutes." from={3} motion={motion} />
          </p>
        </div>
      </div>
      <div className={`flex flex-col items-center gap-2 ${a('anim-cta')}`}>
        <Button size="lg" className={`min-w-40 ${a('anim-press')}`} onClick={start}>
          Start
        </Button>
        <button
          type="button"
          onClick={() => setSignIn(true)}
          className="focus-ring inline-flex min-h-11 cursor-pointer items-center rounded-sm text-sm font-medium text-brand underline underline-offset-4"
        >
          I already have an account
        </button>
      </div>
      {signIn && <LoginSheet askConsent={false} onClose={() => setSignIn(false)} onFinish={() => navigate('/dashboard')} />}
    </div>
  )
}

/* The words reveal one by one on screen (an aria-hidden copy), while the full text sits in the DOM
   from the start for screen readers (sr-only), so what they read never changes. `from` continues the
   stagger from an earlier line. */
function Reveal({ text, from, motion }: { text: string; from: number; motion: boolean }) {
  return (
    <>
      <span className="sr-only">{text}</span>
      <span aria-hidden="true">
        {text.split(' ').map((w, k) => (
          <Fragment key={k}>
            {k > 0 && ' '}
            <span className={motion ? 'anim-word' : undefined} style={motion ? ({ '--i': from + k } as CSSProperties) : undefined}>
              {w}
            </span>
          </Fragment>
        ))}
      </span>
    </>
  )
}

/* Loti's eyes follow a mouse, at most 3 viewBox units off centre. Only with a hovering fine
   pointer (not touch) and with motion on; otherwise the pose's own gaze stays. */
function useLookAt(enabled: boolean) {
  const ref = useRef<HTMLDivElement>(null)
  const [look, setLook] = useState<[number, number]>([0, 0])
  useEffect(() => {
    const fine = typeof window.matchMedia === 'function' && window.matchMedia('(hover: hover) and (pointer: fine)').matches
    if (!enabled || !fine) return
    const onMove = (e: MouseEvent) => {
      const r = ref.current?.getBoundingClientRect()
      if (!r) return
      const dx = e.clientX - (r.left + r.width / 2)
      const dy = e.clientY - (r.top + r.height / 2)
      const len = Math.hypot(dx, dy) || 1
      const k = (3 * Math.min(len, 240)) / 240 / len // full reach at 240 px from Loti
      const q = (v: number) => Math.round(v * k * 4) / 4 // quarter units: fewer re-renders
      const next: [number, number] = [q(dx), q(dy)]
      setLook((p) => (p[0] === next[0] && p[1] === next[1] ? p : next))
    }
    window.addEventListener('mousemove', onMove)
    return () => window.removeEventListener('mousemove', onMove)
  }, [enabled])
  return [ref, enabled ? look : undefined] as const
}
