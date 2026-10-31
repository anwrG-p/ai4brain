import { Fragment, useEffect, useRef, useState, type CSSProperties } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import type { LotiPose } from '../components/features/characters'
import { useCharacterMotion } from '../components/features/characters/shared'
import { Button } from '../components/ui/Button'
import { googleClientId } from '../features/flow/GoogleSignIn'
import { LoginSheet } from '../features/flow/LoginSheet'
import { LotiSays } from '../features/loti/LotiBubbles'

// Motion timeline (tokens.css, "Motion pass"): Loti rises (400 ms) and waves 3 times once landed,
// then settles; the bubble follows and its words reveal; Start fades up at 900 ms.
const SETTLE_MS = 2400
// On Start the page leaves in 80 ms + 220 ms (anim-page-exit), then the baseline opens.
const EXIT_MS = 300

// The baseline's code (a lazy route chunk; the same module App loads). Fetched early, and awaited
// before the exit plays, so the page never fades out onto a blank screen while it downloads. One
// request at a time; a failed one is forgotten so Start can try again.
let baseline: Promise<unknown> | null = null
const loadBaseline = () =>
  (baseline ??= import('./BaselinePage').catch((e: unknown) => {
    baseline = null
    throw e
  }))

/* How long the full baseline takes (the six default tasks in tasks/fixtures.json, at full length,
   no ?fast). Timed parts use each exercise's fixed timing or its time limit, so this is a ceiling:
     Logic Web            6 trials x 15 s limit                          =  90 s
     Memory Gauntlet      10 trials x (500 ms stimulus + 2000 ms gap)    =  25 s
     Color Clash          4 trials x 3 s limit                           =  12 s
     Strategic Blueprint  60 s limit + ~10 s for the move prediction     =  70 s
     Perceptual Radar     4 trials x (500 ms fixation + ~0.5 s flash
                          and mask + ~5 s for the two answers)           =  24 s
     Precision Archive    3 x 2 s study + 5 tests x 5 s limit            =  31 s
   plus each exercise's own screens, ~13 s x 6 (reading the instruction, the 500 ms fixation, the
   end card)                                                             =  78 s
   Total 330 s = 5.5 min, rounded up: about 6 minutes. Recount when the baseline or its tasks change. */
const MINUTES = 6

/* Welcome: Loti says hello, one button starts the baseline, and, only with Google sign-in set up,
   one quiet link opens the login sheet. Nothing else (Landing page doc: "VERY SIMPLE UI early on";
   anti-slop rules 13 and 14). Motion (spec R8, "Loti welcomes you into the app"): an entrance, a
   breathing idle, eyes that follow a mouse, a cheer on Start. With reduced motion every piece is
   off and Start goes at once. Once Start is pressed the page is inert: no second key or click. */
export default function WelcomePage() {
  const navigate = useNavigate()
  const { search } = useLocation()
  const [signIn, setSignIn] = useState(false)
  const motion = useCharacterMotion()
  const [pose, setPose] = useState<LotiPose>('wave')
  const [leaving, setLeaving] = useState(false)
  const [exiting, setExiting] = useState(false)
  const root = useRef<HTMLDivElement>(null)
  const live = useRef(true)
  const [lotiRef, look] = useLookAt(motion && !leaving)
  const a = (cls: string) => (motion ? cls : '')
  // The query string rides along, so the e2e hook ?fast=1 reaches /baseline.
  const go = () => navigate({ pathname: '/baseline', search })

  useEffect(() => {
    live.current = true
    void loadBaseline().catch(() => {}) // a failure surfaces on Start, where it is retried
    return () => {
      live.current = false
    }
  }, [])

  useEffect(() => {
    if (!motion) return
    const t = window.setTimeout(() => setPose((p) => (p === 'wave' ? 'idle' : p)), SETTLE_MS)
    return () => window.clearTimeout(t)
  }, [motion])

  // React 18 has no `inert` prop: set the attribute directly.
  useEffect(() => {
    root.current?.toggleAttribute('inert', leaving)
  }, [leaving])

  useEffect(() => {
    if (!exiting) return
    const t = window.setTimeout(() => navigate({ pathname: '/baseline', search }), EXIT_MS)
    return () => window.clearTimeout(t)
  }, [exiting, navigate, search])

  const start = () => {
    if (leaving) return
    setLeaving(true)
    // Reduced motion: no exit to wait for; the router keeps this page up until the baseline renders.
    if (!motion) return go()
    setPose('happy')
    loadBaseline().then(
      () => live.current && setExiting(true),
      () => live.current && go(), // the route shows its own error
    )
  }

  return (
    <div
      ref={root}
      className={`mx-auto flex max-w-xl flex-col items-center gap-8 pt-6 pb-12 text-center sm:pt-12 ${exiting ? 'anim-page-exit' : ''}`}
    >
      <LotiSays
        pose={pose}
        size="lg"
        alive={motion}
        look={look}
        lotiRef={lotiRef}
        lotiClassName={a('anim-rise')}
        bubbleClassName={a('anim-bubble')}
      >
        <h1 className="font-display text-2xl font-bold text-ink">
          <Reveal text="Hi, I'm Loti." from={0} motion={motion} />
        </h1>
        <p className="mt-1 text-lg text-ink">
          <Reveal text={`Want to see how your mind works today? It takes about ${MINUTES} minutes.`} from={3} motion={motion} />
        </p>
      </LotiSays>
      <div className={`flex flex-col items-center gap-2 ${a('anim-cta')}`}>
        <Button size="lg" className={`min-w-40 ${a('anim-press')}`} onClick={start}>
          Start
        </Button>
        {/* Without Google sign-in there is nothing to sign in with (rule 14: fewer controls). */}
        {googleClientId() !== null && (
          <button
            type="button"
            onClick={() => setSignIn(true)}
            className="focus-ring inline-flex min-h-11 cursor-pointer items-center rounded-sm text-sm font-medium text-brand underline underline-offset-4"
          >
            I already have an account
          </button>
        )}
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
