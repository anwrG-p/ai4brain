import { useEffect, useMemo, useRef, type CSSProperties, type ReactNode, type Ref } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { ChevronRight } from 'lucide-react'
import { Loti } from '../components/features/characters'
import { useCharacterMotion } from '../components/features/characters/shared'
import { EXERCISE_NAME } from '../features/assessment/names'
import { currentPillars, weakestPillar } from '../features/insights/dashboard'
import { isPillarId, PILLAR_IDS, PILLAR_LABELS, type PillarId } from '../features/insights/pillars'
import { useSessionStore } from '../features/insights/sessionStore'
import { PILLAR_LINE, startPath, TRAIN_EXERCISES, trainOrder } from '../features/train/catalog'
import { useAppStore } from '../state/useAppStore'
import type { TaskSchemaType } from '../types'

const PRIMARY = 'tactile-btn my-2 inline-flex min-h-11 items-center gap-1 border-transparent bg-brand px-5 text-base font-semibold text-brand-ink hover:bg-brand-hover'
const ROW = 'focus-ring -mx-2 flex min-h-12 items-center justify-between gap-4 rounded-md px-2 text-base text-ink hover:text-brand'

/* Train: one line from Loti, then the pillars, each with its exercises. Each row is itself the link
   (the name and a chevron; its accessible name is "Start <name>"), so "Start" is not repeated down
   the page (rule 14). The pillar asked for in ?pillar= (the dashboard's "Start today's session"),
   else the weakest scored one, comes first and is highlighted; its first exercise is the page's one
   filled button, "Start <name>". ?pillar= also moves focus to it. A pillar with no exercise in the
   active set of dimensions (judge-mode sets only) is left out, and never leads.
   Scores are each pillar as last measured and the weakest is the dashboard's, so Train, Home and
   Loti always agree. */
export default function TrainPage() {
  const [params] = useSearchParams()
  const asked = params.get('pillar')
  const sessions = useSessionStore((s) => s.sessions)
  const preset = useAppStore((s) => s.dimensionPreset)
  const motion = useCharacterMotion()
  const scores = useMemo(() => currentPillars(sessions), [sessions])
  const rows = useMemo(() => {
    const out = {} as Record<PillarId, Row[]>
    for (const pillar of PILLAR_IDS) {
      out[pillar] = TRAIN_EXERCISES[pillar].flatMap((schema) => {
        const to = startPath(schema, preset)
        return to ? [{ schema, name: EXERCISE_NAME[schema], to }] : []
      })
    }
    return out
  }, [preset])
  const shown = PILLAR_IDS.filter((p) => rows[p].length > 0)
  const chosen = isPillarId(asked) && shown.includes(asked) ? asked : null
  const weakest = weakestPillar(scores, shown)
  const first = chosen ?? weakest
  const order = trainOrder(first, shown)
  const primary = order[0] === undefined ? undefined : rows[order[0]][0]?.schema
  const focusRef = useRef<HTMLElement>(null)

  useEffect(() => {
    if (chosen) focusRef.current?.focus()
  }, [chosen])

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
        {order.map((pillar, k) => (
          <PillarSection
            key={pillar}
            pillar={pillar}
            score={scores[pillar].score}
            current={pillar === first}
            sectionRef={pillar === chosen ? focusRef : undefined}
            className={enter('anim-cta')}
            style={stagger(k)}
          >
            {rows[pillar].map((row) => (
              <li key={row.schema}>
                {row.schema === primary ? (
                  <Link to={row.to} aria-label={`Start ${row.name}`} className={`${PRIMARY} ${enter('anim-press')}`}>
                    Start <span>{row.name}</span>
                  </Link>
                ) : (
                  <Link to={row.to} aria-label={`Start ${row.name}`} className={ROW}>
                    <span>{row.name}</span>
                    <ChevronRight size={20} strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="shrink-0 text-ink-muted" />
                  </Link>
                )}
              </li>
            ))}
          </PillarSection>
        ))}
      </div>
    </div>
  )
}

type Row = { schema: TaskSchemaType; name: string; to: string }

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
      className={`focus-ring rounded-xl px-4 py-3 ${current ? 'bg-surface-raised' : ''} ${className}`}
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
