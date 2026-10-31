import { useEffect, useMemo, useRef, type CSSProperties, type ReactNode, type Ref } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Loti } from '../components/features/characters'
import { useCharacterMotion } from '../components/features/characters/shared'
import { EXERCISE_NAME } from '../features/assessment/names'
import { isPillarId, PILLAR_LABELS, pillarScores, type PillarId } from '../features/insights/pillars'
import { useSessionStore } from '../features/insights/sessionStore'
import { PILLAR_LINE, startPath, TRAIN_EXERCISES, trainOrder, weakestPillar } from '../features/train/catalog'
import { useAppStore } from '../state/useAppStore'

const PRIMARY = 'tactile-btn inline-flex min-h-11 items-center border-transparent bg-brand px-5 text-sm font-semibold text-brand-ink hover:bg-brand-hover'
const QUIET = 'focus-ring inline-flex min-h-11 items-center rounded-sm px-3 text-sm font-medium text-brand underline-offset-4 hover:underline'

/* Train: one line from Loti, then the five pillars, each with its exercises and one Start per row.
   The pillar asked for in ?pillar= (the dashboard's "Start today's session"), else the weakest
   scored one, comes first and is highlighted; its first exercise is the page's one primary button
   (rule 14), so there is no second, duplicate CTA at the top. ?pillar= also moves focus to it.
   Scores are the latest session's, like Results. ponytail: latest session only, no trend. */
export default function TrainPage() {
  const [params] = useSearchParams()
  const asked = params.get('pillar')
  const chosen = isPillarId(asked) ? asked : null
  const latest = useSessionStore((s) => s.sessions.at(-1))
  const preset = useAppStore((s) => s.dimensionPreset)
  const motion = useCharacterMotion()
  const scores = useMemo(() => pillarScores(latest?.inputs ?? {}), [latest])
  const weakest = weakestPillar(scores)
  const first = chosen ?? weakest
  const focusRef = useRef<HTMLElement>(null)

  useEffect(() => {
    if (chosen) focusRef.current?.focus()
  }, [chosen])

  const sections = trainOrder(first).map((pillar) => ({
    pillar,
    rows: TRAIN_EXERCISES[pillar].flatMap((schema) => {
      const to = startPath(schema, preset)
      return to ? [{ schema, name: EXERCISE_NAME[schema], to }] : []
    }),
  }))
  const primary = sections.find((s) => s.rows.length > 0)?.rows[0]?.schema

  const line = chosen
    ? `Let's train ${PILLAR_LABELS[chosen]} today.`
    : weakest
      ? `${PILLAR_LABELS[weakest]} could use some care today.`
      : 'Pick any exercise to start.'

  const enter = (cls: string) => (motion ? cls : '')
  // A short stagger down the list; the keyframes are tokens.css's fade-up (anim-cta) with its own delay.
  const stagger = (k: number): CSSProperties | undefined => (motion ? { animationDelay: `${150 + k * 60}ms` } : undefined)

  return (
    <div data-testid="train-page" className="mx-auto flex max-w-2xl flex-col gap-6 pt-4 pb-12">
      <div className="flex flex-col gap-4">
        <h1 className="font-display text-3xl font-bold text-ink">Train</h1>
        <div className="flex items-end gap-3">
          <div className={`shrink-0 ${enter('anim-rise')}`}>
            <Loti size="sm" alive={motion} />
          </div>
          <p className={`tactile-card max-w-md px-4 py-3 text-base text-ink ${enter('anim-bubble')}`}>{line}</p>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        {sections.map(({ pillar, rows }, k) => (
          <PillarSection
            key={pillar}
            pillar={pillar}
            score={scores[pillar].score}
            current={pillar === first}
            sectionRef={pillar === chosen ? focusRef : undefined}
            className={enter('anim-cta')}
            style={stagger(k)}
          >
            {rows.map((row) => (
              <li key={row.schema} className="flex min-h-12 items-center justify-between gap-4 py-1">
                <span className="text-base text-ink">{row.name}</span>
                <Link to={row.to} aria-label={`Start ${row.name}`} className={row.schema === primary ? `${PRIMARY} ${enter('anim-press')}` : QUIET}>
                  Start
                </Link>
              </li>
            ))}
          </PillarSection>
        ))}
      </div>
    </div>
  )
}

interface PillarSectionProps {
  pillar: PillarId
  score: number | null
  current: boolean
  sectionRef?: Ref<HTMLElement> | undefined
  className: string
  style: CSSProperties | undefined
  children: ReactNode
}

function PillarSection({ pillar, score, current, sectionRef, className, style, children }: PillarSectionProps) {
  const id = `train-${pillar}`
  return (
    <section
      ref={sectionRef}
      aria-labelledby={id}
      tabIndex={current ? -1 : undefined}
      data-current={current || undefined}
      style={style}
      className={`rounded-xl px-4 py-3 outline-none ${current ? 'bg-surface-raised' : ''} ${className}`}
    >
      <div className="flex items-baseline justify-between gap-4">
        <h2 id={id} className="flex items-center gap-2 font-display text-xl font-bold text-ink">
          <span aria-hidden="true" className="size-2.5 shrink-0 rounded-pill" style={{ backgroundColor: `var(--pillar-${pillar})` }} />
          {PILLAR_LABELS[pillar]}
        </h2>
        <p className="text-sm text-ink-muted tabular-nums">
          {score === null ? (
            <>
              <span className="sr-only">No score yet</span>
              <span aria-hidden="true">—</span>
            </>
          ) : (
            <>
              <span className="sr-only">Score </span>
              <span>{Math.round(score)}</span>
            </>
          )}
        </p>
      </div>
      <p className="text-sm text-ink-muted">{PILLAR_LINE[pillar]}</p>
      <ul className="mt-1 divide-y divide-border">{children}</ul>
    </section>
  )
}
