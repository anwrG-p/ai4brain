import { useCallback, useEffect, useId, useMemo, useState, type CSSProperties, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronDown } from 'lucide-react'
import { EMOTION_TO_MOOD, Loti, MomoFromStore } from '../components/features/characters'
import { useCharacterMotion } from '../components/features/characters/shared'
import { Button } from '../components/ui/Button'
import {
  currentPillars,
  goalLines,
  improvedPillars,
  sessionPath,
  sessionsThisWeek,
  unifiedHistory,
  weakestPillar,
  type GoalLine,
} from '../features/insights/dashboard'
import { hasGoalsForYear, useGoalsStore, weeklyGoal, weeklyGoalText, type WeeklyGoal } from '../features/insights/goals'
import { PastResults } from '../features/insights/PastResults'
import { PillarRadar, REAL_IMPROVEMENT } from '../features/insights/PillarRadar'
import { PILLAR_LABELS, type PillarId, type PillarScore } from '../features/insights/pillars'
import { ProgressCurve } from '../features/insights/ProgressCurve'
import { useSessionStore } from '../features/insights/sessionStore'
import { LotiBubbles, scriptedBrain, useLotiActions, type LotiAction, type LotiBrain } from '../features/loti'
import { useAppStore } from '../state/useAppStore'
import { moodGuessActive, useDevicePrefs } from '../state/devicePrefs'
import { useEmilyStore } from '../state/useEmilyStore'

/* Home (/dashboard; Dashboard doc). Need-to-know only (rules 13, 14): above the fold exactly three
   blocks, the hello (greeting, Momo, one clickable Loti line), one primary action and the radar.
   Below: the progress curve, then one closed "Further explore my training" that holds everything else
   (why Loti picked this, past results, goals). Score ranges live only in the radar's "View as table"
   (user decision, 2026-10-31). Data: the sessions on this device (R5).
   Mood: Momo follows the emotion store and the canvas takes a faint tint (no banner, never red).
   Motion (R8): the blocks fade up in sequence and the radar grows once; none with reduced motion. */

// Loti's goals talk, opened from "Further explore": it starts at "Which skill...?" (any month, not
// only January), then the same script as the yearly prompt.
const goalBrain: LotiBrain = {
  opening: (ctx) => scriptedBrain.respond('goals', 'start', ctx),
  respond: scriptedBrain.respond,
}

const round = (n: number) => Math.round(n)

export default function DashboardPage() {
  const navigate = useNavigate()
  const runDefault = useLotiActions()
  const motion = useCharacterMotion()
  const sessions = useSessionStore((s) => s.sessions)
  const goalYear = useGoalsStore((s) => s.year)
  const goals = useGoalsStore((s) => s.goals)
  const bases = useGoalsStore((s) => s.bases)
  const setBase = useGoalsStore((s) => s.setBase)
  const emotion = useEmilyStore((s) => s.currentEmotion)
  // Nothing reads the mood unless the guess is active (opted in, notice seen: ADR 0002).
  const guessActive = useDevicePrefs(moodGuessActive)
  const mood = guessActive ? EMOTION_TO_MOOD[emotion] : 'calm'
  const name = useAppStore((s) => s.userProfile?.preferredName)
  // ponytail: "now" is read once per visit; the page does not tick over midnight.
  const [now] = useState(() => new Date())

  const pillars = useMemo(() => currentPillars(sessions), [sessions])
  const improved = useMemo(() => improvedPillars(sessions), [sessions])
  const history = useMemo(() => unifiedHistory(sessions), [sessions])
  const weakest = weakestPillar(pillars) ?? undefined
  const goalList = useMemo(() => goalLines({ year: goalYear, goals, bases }, pillars, now), [goalYear, goals, bases, pillars, now])
  const goalLevels = Object.fromEntries(goalList.flatMap((g) => (g.goal === null ? [] : [[g.pillar, g.goal]])))
  const start = sessionPath(weakest)

  // A goal set before its pillar was measured starts from the pillar's first score.
  useEffect(() => {
    for (const g of goalList) if (g.base === null && g.current !== null) setBase(g.pillar, g.current)
  }, [goalList, setBase])

  // Loti's "let's train" goes where the primary action goes (its own pillar if it names one).
  const onLoti = useCallback(
    (action: LotiAction) => (action.kind === 'train' ? navigate(sessionPath(action.pillar ?? weakest)) : runDefault(action)),
    [navigate, runDefault, weakest],
  )
  const context = {
    now,
    weakestPillar: weakest,
    ...(guessActive ? { mood } : {}),
    hasGoalsThisYear: hasGoalsForYear({ year: goalYear, goals }, now.getFullYear()),
    sessionsThisWeek: sessionsThisWeek(sessions, now),
  }
  // Each above-the-fold block fades up in turn (anim-enter, 60 ms apart).
  const anim = motion ? 'anim-enter' : ''
  const order = (i: number) => (motion ? ({ '--i': i } as CSSProperties) : undefined)

  return (
    <div data-page="home" data-mood={mood} className={`mood-tint-${mood} mx-auto flex max-w-240 flex-col gap-10 pb-12`}>
      <div data-fold className="grid grid-cols-1 gap-6 lg:grid-cols-2 lg:grid-rows-[auto_1fr] lg:gap-x-12">
        <section aria-labelledby="home-hello" style={order(0)} className={`flex flex-col gap-4 lg:pt-10 ${anim}`}>
          <div className="flex items-center justify-between gap-4">
            <h1 id="home-hello" className="font-display text-3xl font-bold text-ink">
              Hi, {name || 'there'}
            </h1>
            {/* A picture, not a control (rule 14): the mood guess is opted into and corrected in Settings. */}
            <MomoFromStore size="md" className="shrink-0" />
          </div>
          {sessions.length ? (
            <LotiBubbles collapsed context={context} onAction={onLoti} />
          ) : (
            <div className="flex items-end gap-3">
              <Loti size="sm" className="shrink-0" />
              <p className="tactile-card max-w-md px-4 py-3 text-base text-ink">Your first session fills in your five skills.</p>
            </div>
          )}
        </section>
        <div style={order(1)} className={`lg:col-start-1 lg:self-start ${anim}`}>
          <Button size="lg" className={motion ? 'anim-press' : ''} onClick={() => navigate(start)}>
            Start today&apos;s session
          </Button>
        </div>
        <section
          aria-labelledby="home-skills"
          style={order(2)}
          className={`lg:col-start-2 lg:row-span-2 lg:row-start-1 ${anim}`}
        >
          <h2 id="home-skills" className="font-display text-xl font-bold text-ink">
            Your five skills
          </h2>
          <PillarRadar scores={pillars} improved={improved} goals={goalLevels} tableToggle grow={motion} className="mx-auto mt-2 max-w-md" />
        </section>
      </div>

      <section aria-labelledby="home-progress">
        <h2 id="home-progress" className="mb-3 font-display text-xl font-bold text-ink">
          Your progress
        </h2>
        <ProgressCurve history={history} now={now} />
      </section>

      <Explore>
        <Why weakest={weakest} pillars={pillars} improved={improved.length > 0} />
        <Goals week={weeklyGoal(sessions, now)} lines={goalList} context={context} onAction={onLoti} />
        <ExploreBlock title="Past results" className="md:col-span-2">
          <PastResults sessions={sessions} />
        </ExploreBlock>
      </Explore>
    </div>
  )
}

function Explore({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false)
  const id = useId()
  return (
    <section aria-label="More about my training" className="border-t border-border pt-4">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen((v) => !v)}
        className="focus-ring inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-sm text-base font-semibold text-brand"
      >
        Further explore my training
        <ChevronDown
          size={20}
          strokeWidth={1.75}
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
          className={`transition-transform duration-200 motion-reduce:transition-none ${open ? 'rotate-180' : ''}`}
        />
      </button>
      {open && (
        <div id={id} className="mt-4 grid grid-cols-1 gap-8 md:grid-cols-2">
          {children}
        </div>
      )}
    </section>
  )
}

function ExploreBlock({ title, children, className }: { title: string; children: ReactNode; className?: string }) {
  const id = useId()
  return (
    <section aria-labelledby={id} className={`min-w-0 ${className ?? ''}`}>
      <h3 id={id} className="mb-2 text-base font-semibold text-ink">
        {title}
      </h3>
      {children}
    </section>
  )
}

function Why({ weakest, pillars, improved }: { weakest: PillarId | undefined; pillars: Record<PillarId, PillarScore>; improved: boolean }) {
  return (
    <ExploreBlock title="Why Loti picked this">
      <div className="space-y-2 text-base text-ink">
        {weakest ? (
          <p>
            {PILLAR_LABELS[weakest]} is your lowest score right now ({round(pillars[weakest].score!)}), so Loti suggests
            working on it.
          </p>
        ) : (
          <p>Loti picks a skill once your first session is done.</p>
        )}
        {improved && <p>&ldquo;{REAL_IMPROVEMENT}&rdquo; means the change is bigger than everyday ups and downs.</p>}
      </div>
    </ExploreBlock>
  )
}

/* Each goal against its own pillar, from the score it had when the goal was set (ticket 08 review):
   "Deep Memory 52 → goal 62". Never shown as met when set; only its own pillar can meet it. Met, it
   keeps its starting point in view: "Deep Memory 52 → 64 · goal 62 reached". */
function goalText(g: GoalLine): string {
  const label = PILLAR_LABELS[g.pillar]
  if (g.goal === null) return `${label}: +${g.target} from its first score`
  if (g.reached) return `${label} ${round(g.base!)} → ${round(g.current!)} · goal ${round(g.goal)} reached`
  return `${label} ${round(g.current ?? g.base!)} → goal ${round(g.goal)}`
}

function Goals({
  week,
  lines,
  context,
  onAction,
}: {
  week: WeeklyGoal
  lines: GoalLine[]
  context: Parameters<typeof LotiBubbles>[0]['context']
  onAction: (action: LotiAction) => void
}) {
  const [talk, setTalk] = useState(false)
  return (
    <ExploreBlock title="Goals">
      {/* The weekly goal (research #10): one plain line, no streak, a new week starts quietly at 0. */}
      <p data-testid="weekly-goal" className="mb-2 text-base text-ink tabular-nums">
        {weeklyGoalText(week)}
      </p>
      {lines.length ? (
        <ul aria-label="Your goals this year" className="m-0 list-none space-y-1 p-0 text-base text-ink">
          {lines.map((g) => (
            <li key={g.pillar} className="tabular-nums">
              {goalText(g)}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-base text-ink">No goal yet this year.</p>
      )}
      {talk ? (
        <LotiBubbles brain={goalBrain} context={context} onAction={onAction} className="mt-3" />
      ) : (
        <button
          type="button"
          onClick={() => setTalk(true)}
          className="focus-ring mt-1 inline-flex min-h-11 cursor-pointer items-center rounded-sm text-sm font-medium text-brand underline underline-offset-4"
        >
          Set a goal
        </button>
      )}
    </ExploreBlock>
  )
}
