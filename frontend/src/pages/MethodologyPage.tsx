import { ChevronDown } from 'lucide-react'
import type { ReactNode } from 'react'
import { EXERCISE_NAME } from '../features/assessment/names'
import type { SchemaType } from '../features/assessment/telemetry/types'
import {
  MIN_COVERAGE,
  PILLAR_IDS,
  PILLAR_LABELS,
  PILLAR_WEIGHTS,
  UNSOURCED_INPUTS,
  type InputId,
  type PillarId,
} from '../features/insights/pillars'
import { MAX_HORIZON_DAYS } from '../features/insights/dashboard'
import { CURVE_STROKE, DASHED, PROJECT_FROM } from '../features/insights/ProgressCurve'
import {
  ALPHA_MAX,
  ALPHA_MIN,
  DEFAULT_TMAX,
  RCI_R,
  RCI_SD,
  RCI_THRESHOLD,
  SESSIONS_PER_WEEK,
  rci,
} from '../features/insights/projection'
import {
  D_PRIME_MAX,
  PLAN_SHARE,
  PLAN_TIME_MAX_MS,
  SSRT_BEST_MS,
  SSRT_WORST_MS,
  STROOP_COST_MAX_MS,
  SWITCH_COST_MAX,
  UFOV_MAX_MS,
  UFOV_MIN_MS,
} from '../features/insights/taskScores'

/* "How we calculate this": the one page that holds the formulas, the brain-area links, the projection
   model and RCI (spec U5, ticket 09). A plain intro, then one closed disclosure per topic (rule 13).
   Weights, coverage, scale ends, projection defaults and the RCI settings are read from
   features/insights, so the page cannot drift from the code; src/tests/methodologyPage.test.tsx
   also pins the scale ends against taskScores(). */

// What each of the doc's inputs measures, in plain words, and which exercise feeds it. This MIRRORS
// features/insights/taskScores.ts by hand (it exports no input -> exercise map): change both together.
// methodologyPage.test.tsx checks the pillar lists against taskScores(). 'any' = every exercise;
// null = no exercise records it yet. `note` flags a doc measure we only approximate.
type Measure = { name: string; from: readonly SchemaType[] | 'any' | null; how: ReactNode; note?: string }
const MEASURES: Record<InputId, Measure> = {
  OSPAN: {
    name: 'Working memory',
    from: ['n_back'],
    note: 'from Memory Gauntlet',
    how: (
      <>
        d′ = z(H) − z(FA), with H = (hits + 0.5) ÷ (targets + 1) and FA = (false alarms + 0.5) ÷
        (non-targets + 1). 0 when hits don’t beat false alarms. Scale: d′ 0 → 0, {D_PRIME_MAX} → 100.
      </>
    ),
  },
  OTS_Planning: {
    name: 'Planning ahead',
    from: ['tower'],
    how: (
      <>
        {PLAN_SHARE} × share solved in the fewest moves + {+(1 - PLAN_SHARE).toFixed(2)} × planning speed on those
        (0 s → 1, {PLAN_TIME_MAX_MS / 1000} s → 0).
      </>
    ),
  },
  FluidMatrices: {
    name: 'Reasoning',
    from: ['relational', 'matrix'],
    how: <>Mean of Pattern Puzzle accuracy and Logic Web accuracy, weighted by the number of steps.</>,
  },
  ANT_Conflict: {
    name: 'Handling conflict',
    from: ['stroop'],
    how: (
      <>
        Time cost = mean time on mismatched colours − mean time on matching ones, correct answers only.
        Scale: 0 ms → 100, {STROOP_COST_MAX_MS} ms → 0. Multiplied by (accuracy − ¼) ÷ ¾, so guessing scores 0.
      </>
    ),
  },
  DCCS_SwitchCost: {
    name: 'Switching rules',
    from: ['n_back'],
    note: 'from Memory Gauntlet',
    how: (
      <>
        Accuracy on steady trials − accuracy on switch trials. Scale: 0 → 100, {SWITCH_COST_MAX} → 0. Multiplied by
        min(1, d′), so not answering scores 0.
      </>
    ),
  },
  ErrorRecovery: {
    name: 'Bouncing back after a mistake',
    from: 'any',
    how: <>Accuracy on the trial right after a mistake. Exercises played at chance are left out.</>,
  },
  SST_SSRT: {
    name: 'Stopping a habit',
    from: ['stop_signal', 'stroop'],
    note: 'estimated from Color Clash without Stop Light',
    how: (
      <>
        Stop Light: stopping time = your go time at the rank P(press | stop sign), minus the mean stop-sign delay
        (a missed go counts as your slowest). Scale: {SSRT_BEST_MS} ms → 100, {SSRT_WORST_MS} ms → 0, times (go
        accuracy − ½) ÷ ½. Not scored when you press on fewer than ¼ or more than ¾ of stop signs. Without Stop
        Light, accuracy on mismatched Color Clash trials stands in.
      </>
    ),
  },
  OTS_Execution: {
    name: 'Moving with care',
    from: ['tower'],
    how: <>Mean of (fewest possible moves ÷ your moves); an unsolved puzzle counts as 0.</>,
  },
  DDM_Caution: { name: 'Caution', from: null, how: null },
  MST_LDI: {
    name: 'Telling similar things apart',
    from: ['mst'],
    how: <>LDI = P(“similar” | lure) − P(“similar” | new), kept between 0 and 1.</>,
  },
  PAL_FirstTrialMemory: { name: 'Remembering pairs', from: null, how: null },
  UFOV_SOA: {
    name: 'Seeing speed',
    from: ['ufov'],
    how: (
      <>
        The shortest display time you still read correctly. Scale: {UFOV_MIN_MS} ms → 100, {UFOV_MAX_MS} ms → 0.
      </>
    ),
  },
  ANT_Orienting: {
    name: 'Side vision',
    from: ['ufov'],
    how: <>Accuracy on the target at the side of the screen.</>,
  },
}

// The doc's brain-area links ("Rou7 zebda", RADAR SCORES). Research links only: nothing here is measured.
const AREAS: Record<PillarId, { area: string; role: string }> = {
  focus: { area: 'the dorsolateral prefrontal cortex (dlPFC)', role: 'working memory and planning' },
  agility: { area: 'the anterior cingulate cortex (ACC)', role: 'noticing conflict and switching flexibly' },
  impulse: { area: 'the ventrolateral prefrontal cortex (vlPFC) and the striatum', role: 'holding back a response' },
  memory: { area: 'the hippocampus (dentate gyrus)', role: 'telling apart memories that look alike' },
  visual: { area: 'the parietal and occipital areas (dorsal stream)', role: 'where things are and how fast you see them' },
}

const weightsOf = (p: PillarId) => Object.entries(PILLAR_WEIGHTS[p]) as [InputId, number][]

function exercisesFor(p: PillarId): string {
  const names = new Set<string>()
  let any = false
  for (const [id] of weightsOf(p)) {
    const from = MEASURES[id].from
    if (from === 'any') any = true
    else for (const s of from ?? []) names.add(EXERCISE_NAME[s])
  }
  const list = [...names].join(', ')
  return any ? `${list}, and how you bounce back after a mistake in any exercise` : list
}

// 1 / rci(1, 0) is the standard error of a difference, in points (rci()'s defaults: RCI_SD, RCI_R).
const RCI_POINTS = Math.round(RCI_THRESHOLD / rci(1, 0))

function Topic({ title, children }: { title: string; children: ReactNode }) {
  return (
    <details className="group border-b border-border">
      <summary className="focus-ring flex min-h-11 cursor-pointer list-none items-center justify-between gap-4 rounded-md py-3 [&::-webkit-details-marker]:hidden">
        <h2 className="text-lg font-semibold text-ink">{title}</h2>
        <ChevronDown aria-hidden="true" size={20} strokeWidth={1.75} className="shrink-0 text-ink-muted group-open:rotate-180" />
      </summary>
      <div className="flex flex-col gap-4 pb-6 text-ink">{children}</div>
    </details>
  )
}

function Formula({ children }: { children: ReactNode }) {
  return <p className="font-mono-tabular rounded-md bg-surface-raised px-3 py-2 break-words text-ink">{children}</p>
}

function Sources({ children }: { children: ReactNode }) {
  return (
    <div className="text-sm text-ink-muted">
      <p className="font-semibold">Sources</p>
      <ul className="flex flex-col gap-1">{children}</ul>
    </div>
  )
}

// Drawn like ProgressCurve's own legend: the same stroke class, widths and dash.
function Swatch({ dash }: { dash?: string }) {
  return (
    <svg aria-hidden="true" width="28" height="8" className="mr-2 inline-block shrink-0 align-middle">
      <line
        x1={2}
        x2={26}
        y1={4}
        y2={4}
        strokeWidth={dash ? 2.5 : 3}
        strokeLinecap={dash ? 'butt' : 'round'}
        strokeDasharray={dash}
        className={CURVE_STROKE}
      />
    </svg>
  )
}

export default function MethodologyPage() {
  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-8 pt-4 pb-16">
      <header className="flex flex-col gap-3">
        <h1 className="font-display text-3xl font-bold text-ink">How we calculate this</h1>
        <div className="flex flex-col gap-1 text-lg text-ink">
          <p data-testid="methodology-intro-line">Your scores cover {PILLAR_IDS.length} pillars of thinking.</p>
          <p data-testid="methodology-intro-line">We compare them with your own past results, never with other people.</p>
          <p data-testid="methodology-intro-line">Real improvement means a change bigger than normal day-to-day noise.</p>
        </div>
      </header>

      <div className="border-t border-border">
        <Topic title="The 5 pillars and their exercises">
          <dl className="flex flex-col gap-3">
            {PILLAR_IDS.map((p) => (
              <div key={p}>
                <dt className="font-semibold">{PILLAR_LABELS[p]}</dt>
                <dd className="text-ink-muted">{exercisesFor(p)}</dd>
              </div>
            ))}
          </dl>
        </Topic>

        <Topic title="How a pillar score is built">
          <Formula>
            pillar score = (w<sub>1</sub>·x<sub>1</sub> + w<sub>2</sub>·x<sub>2</sub> + …) ÷ (w<sub>1</sub> + w<sub>2</sub> + …)
          </Formula>
          <ul className="flex list-disc flex-col gap-1 pl-5">
            <li>Each x is one measure on a 0–100 scale; w is its weight.</li>
            <li>Only the measures you have count, so their weights are rescaled to add up to 1.</li>
            <li>No score shows until {Math.round(MIN_COVERAGE * 100)}% of a pillar’s weight is measured.</li>
            <li>Each score has a ~95% range: 1.96 × the weighted error (50 ÷ √trials per measure), wider when measures are missing.</li>
          </ul>
          <div className="w-full">
            <table className="w-full text-left text-sm">
              <caption className="sr-only">Weights per pillar</caption>
              <thead>
                <tr className="border-b border-border-strong text-ink-muted">
                  <th scope="col" className="py-2 pr-4 font-semibold">Measure</th>
                  <th scope="col" className="py-2 text-right font-semibold">Weight</th>
                </tr>
              </thead>
              {PILLAR_IDS.map((p) => (
                <tbody key={p}>
                  <tr>
                    <th scope="rowgroup" colSpan={2} className="pt-4 pb-1 text-base font-semibold">
                      {PILLAR_LABELS[p]}
                    </th>
                  </tr>
                  {weightsOf(p).map(([id, w]) => (
                    <tr key={id} data-pillar={p} data-input={id} className="border-b border-border">
                      <td className="py-2 pr-4">
                        {MEASURES[id].name}
                        {MEASURES[id].from === null && <span className="text-ink-muted"> (not measured yet)</span>}
                        {MEASURES[id].note && <span className="text-ink-muted"> ({MEASURES[id].note})</span>}
                        <code className="block break-all text-xs text-ink-muted">{id}</code>
                      </td>
                      <td className="font-mono-tabular py-2 text-right align-top">{w.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              ))}
            </table>
          </div>
          <h3 className="pt-2 font-semibold">How each measure is scored</h3>
          <dl className="flex flex-col gap-3 text-sm">
            {(Object.keys(MEASURES) as InputId[])
              .filter((id) => MEASURES[id].how)
              .map((id) => (
                <div key={id}>
                  <dt className="font-semibold">{MEASURES[id].name}</dt>
                  <dd className="text-ink-muted">{MEASURES[id].how}</dd>
                </div>
              ))}
          </dl>
          <p className="text-sm">
            {UNSOURCED_INPUTS.map((id) => MEASURES[id].name).join(' and ')} have no exercise yet. The scale
            ends are working values we will tune as data comes in.
          </p>
          <Sources>
            <li>d′ correction: Hautus 1995, Behavior Research Methods, Instruments, &amp; Computers.</li>
            <li>LDI: Stark et al. 2023, Frontiers in Behavioral Neuroscience.</li>
            <li>Stopping time (integration method): Verbruggen et al. 2019, eLife.</li>
            <li>
              Time-cost scores are unreliable from one test to the next: Hedge, Powell &amp; Sumner 2018, Behavior
              Research Methods.
            </li>
          </Sources>
        </Topic>

        <Topic title="Brain areas">
          <p>We don’t measure your brain. We only see how you play the exercises, and this is not a medical test.</p>
          <ul className="flex flex-col gap-3">
            {PILLAR_IDS.map((p) => (
              <li key={p}>
                <span className="font-semibold">{PILLAR_LABELS[p]}</span>
                <span className="text-ink-muted">
                  {' '}
                  is linked in research to {AREAS[p].area}, for {AREAS[p].role}.
                </span>
              </li>
            ))}
          </ul>
        </Topic>

        <Topic title="Your progress curve">
          <Formula>
            T = T<sub>max</sub> − (T<sub>max</sub> − T<sub>0</sub>) · e<sup>−α·N</sup>
          </Formula>
          <ul className="flex list-disc flex-col gap-1 pl-5">
            <li>T<sub>0</sub> is your latest score and N the number of sessions from now.</li>
            <li>
              T<sub>max</sub> = {DEFAULT_TMAX}: a ceiling, so the curve levels off instead of rising in a straight line. It
              moves up to your best score if you pass it.
            </li>
            <li>
              α is how fast you have been improving, fitted to your sessions. It stays between {ALPHA_MIN} and{' '}
              {ALPHA_MAX}.
            </li>
          </ul>
          <ul className="flex flex-col gap-2">
            <li className="flex items-center">
              <Swatch />
              Solid: your sessions so far.
            </li>
            <li className="flex items-center">
              <Swatch dash={DASHED} />
              Dashed: If you keep training ({SESSIONS_PER_WEEK} sessions a week).
            </li>
          </ul>
          <p className="text-sm text-ink-muted">
            The dashed line shows once you have {PROJECT_FROM} sessions. It starts at your latest score and looks up to{' '}
            {MAX_HORIZON_DAYS} days ahead.
          </p>
          <p className="text-sm text-ink-muted">These are working values we will tune as data comes in.</p>
        </Topic>

        <Topic title="Real improvement">
          <Formula>
            RCI = (now − baseline) ÷ (√2 · SD · √(1 − r))
          </Formula>
          <ul className="flex list-disc flex-col gap-1 pl-5">
            <li>
              For now SD = {RCI_SD} points and r = {RCI_R} (how stable a score is from one test to the next).
            </li>
            <li>
              A change counts as real when RCI ≥ {RCI_THRESHOLD} (p &lt; .05): about {RCI_POINTS} points.
            </li>
            <li>Smaller changes are treated as normal day-to-day noise.</li>
          </ul>
          <Sources>
            <li>Jacobson &amp; Truax 1991, the Reliable Change Index.</li>
          </Sources>
        </Topic>
      </div>
    </div>
  )
}
