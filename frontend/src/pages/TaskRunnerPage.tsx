import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { X, Pause } from 'lucide-react'
import { getDimensionsByPreset, DIMENSION_PRESETS } from '../config/dimensions'
import type { DimensionConfig, TaskSchemaType } from '../types'
import { useAppStore } from '../state/useAppStore'
import { ExerciseHost } from '../features/assessment/ExerciseHost'
import { EXERCISE_NAME } from '../features/assessment/names'
import { tracker } from '../features/assessment/telemetry/tracker'
import type { TelemetryEvent } from '../features/assessment/telemetry/types'
import { saveRun } from '../features/insights/sessionStore'
import { Loti } from '../components/features/characters'
import { useJudgeMode } from '../components/layout/judgeMode'
import { Button } from '../components/ui/Button'

type Stage = 'running' | 'paused-blur' | 'completed' | 'error'

const MAX_EVENTS = 50 // judge table rows kept; counts and metrics cover the whole run

const ICON = { strokeWidth: 1.75, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true } as const
const QUIET_LINK =
  'focus-ring inline-flex min-h-11 items-center rounded-sm text-sm font-medium text-brand underline underline-offset-4'

// Judge inspector (R6): the block's real tracker events, newest first.
function EventsTable({ events }: { events: readonly TelemetryEvent[] }) {
  return (
    <div role="region" aria-label="Events, scrollable" tabIndex={0} className="focus-ring w-full overflow-x-auto">
      <table aria-label="Recorded trial telemetry events table" className="w-full text-start border-collapse text-xs font-mono-tabular">
        <thead>
          <tr className="border-b-2 border-border-strong text-ink-muted">
            <th scope="col" className="py-1.5 pe-2 text-start">Trial</th>
            <th scope="col" className="py-1.5 px-2 text-start">Dimension</th>
            <th scope="col" className="py-1.5 px-2 text-start">Score</th>
            <th scope="col" className="py-1.5 px-2 text-start">RT</th>
            <th scope="col" className="py-1.5 ps-2 text-start">Error</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {events.map((ev, i) => (
            <tr key={`${ev.task_id}-${ev.trial_index}-${i}`} className="text-ink">
              <td className="py-1.5 pe-2 font-bold">#{ev.trial_index}</td>
              <td className="py-1.5 px-2">{ev.dimension}</td>
              <td className="py-1.5 px-2">{ev.score_norm.toFixed(2)}</td>
              <td className="py-1.5 px-2">{Math.round(ev.response_time_ms)} ms</td>
              <td className="py-1.5 ps-2">{ev.error_flag ? 'yes' : 'no'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

/* One exercise outside the baseline (reached from /train's Start links). The user sees the exercise,
   Pause and Exit; then one honest result line and "Back to Train". A completed run is saved as a
   session the same way the baseline saves one (R5, gap FE-02), so training reaches the dashboard.
   Everything technical (the events table, the stage, preset and dimension switchers) exists only in
   judge mode (R6). */
export default function TaskRunnerPage() {
  const { dimId } = useParams<{ dimId: string }>()
  const [searchParams, setSearchParams] = useSearchParams()
  const navigate = useNavigate()
  const judge = useJudgeMode()
  const { theme, toggleTheme, dimensionPreset, setDimensionPreset } = useAppStore()

  const activeDimensions = useMemo(() => getDimensionsByPreset(dimensionPreset), [dimensionPreset])

  const currentDim: DimensionConfig = useMemo(
    () =>
      activeDimensions.find((d) => d.id === dimId) ??
      activeDimensions.find((d) => d.id === 'episodic_pattern_separation') ??
      activeDimensions[0]!,
    [activeDimensions, dimId],
  )

  // R2: ?schema= picks the exercise when the dimension has it, else its first schema type.
  const schemaParam = searchParams.get('schema')
  const schemaType: TaskSchemaType =
    currentDim.schemaTypes.find((s) => s === schemaParam) ?? currentDim.schemaTypes[0] ?? 'n_back'
  const name = EXERCISE_NAME[schemaType]

  const [stage, setStage] = useState<Stage>('running')
  // Bumped on every (re)start, so ExerciseHost fetches a fresh task (R3).
  const [attempt, setAttempt] = useState(0)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  // The exercise reached its end card: the block is finished and only waits for Continue.
  const [blockEnded, setBlockEnded] = useState(false)
  const [showTable, setShowTable] = useState(false)
  // Every event of the current run, from the tracker (R5). A new task (a start, a resume, another
  // dimension) and a pause both start it over, so a discarded attempt is never scored or shown.
  // ponytail: copied per event; a block is tens of trials, so the O(n) append is fine.
  const [runEvents, setRunEvents] = useState<TelemetryEvent[]>([])
  const taskId = useRef<string | null>(null)
  const saved = useRef(false)
  const [savedRun, setSavedRun] = useState(false)

  useEffect(() => tracker.onEvent((e) => setRunEvents((prev) => [...prev, e])), [])

  const onTask = useCallback((id: string) => {
    taskId.current = id
    saved.current = false
    setSavedRun(false)
    setRunEvents([])
  }, [])

  const totals = useMemo(
    () =>
      runEvents.reduce(
        (t, e) => ({ n: t.n + 1, rtSum: t.rtSum + e.response_time_ms, errors: t.errors + (e.error_flag ? 1 : 0) }),
        { n: 0, rtSum: 0, errors: 0 },
      ),
    [runEvents],
  )
  const tableEvents = useMemo(() => runEvents.slice(-MAX_EVENTS).reverse(), [runEvents])

  // Any (re)start mounts a fresh task (onTask resets the run); a remount with the same attempt
  // would repeat item_ids.
  const run = useCallback(() => {
    setAttempt((a) => a + 1)
    setBlockEnded(false)
    setStage('running')
  }, [])
  // A new dimension (Back/Forward, the switcher, a link) is a new block: reset while rendering,
  // so the completed screen can never pair the old block's totals with the new dimension.
  const [blockDimId, setBlockDimId] = useState(currentDim.id)
  if (blockDimId !== currentDim.id) {
    setBlockDimId(currentDim.id)
    setRunEvents([])
    setAttempt((a) => a + 1)
    setBlockEnded(false)
    setStage('running')
  }
  const handleBlockEnd = useCallback(() => setBlockEnded(true), [])
  // The result screen. Only a run that reached its end card is saved, once, and only its own
  // task's events (like BaselinePage); a judge jump mid-run shows the summary without saving.
  const complete = useCallback(() => {
    if (blockEnded && !saved.current && taskId.current) {
      saved.current = true
      setSavedRun(saveRun(runEvents, [taskId.current]))
    }
    setStage('completed')
  }, [blockEnded, runEvents])
  // Pausing discards the running block and its events (R3); a finished one completes instead.
  const pause = useCallback(() => {
    if (blockEnded) return complete()
    setRunEvents([])
    setStage('paused-blur')
  }, [blockEnded, complete])
  const handleError = useCallback((msg: string) => {
    setErrorMsg(msg)
    setStage('error')
  }, [])

  // Tab blur pauses, and the pause unmounts the exercise (R3).
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden' && stage === 'running') pause()
    }
    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange)
  }, [stage, pause])

  // R4: the exercise owns its answer keys; the page only maps Escape to pause.
  useEffect(() => {
    if (stage !== 'running') return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        pause()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [stage, pause])

  const result =
    totals.n === 0
      ? 'No answers this time.'
      : `Accuracy ${Math.round(((totals.n - totals.errors) / totals.n) * 100)}% · ${Math.round(totals.rtSum / totals.n)} ms.`

  const backToTrain = (
    <Link to="/train" className={QUIET_LINK}>
      Back to Train
    </Link>
  )

  return (
    <div className="w-full flex-1 flex flex-col justify-between">
      {stage === 'running' && (
        <div className="flex-1 flex flex-col gap-4 w-full max-w-2xl mx-auto pt-2">
          <h1 className="sr-only">{name}</h1>
          <div className="flex items-center justify-between gap-3">
            <Link
              to="/train"
              className="focus-ring inline-flex min-h-11 items-center gap-1.5 rounded-md px-2 text-sm font-medium text-ink-muted no-underline hover:text-ink"
            >
              <X size={20} {...ICON} />
              Exit
            </Link>
            {judge && <span className="font-mono-tabular text-xs text-ink-muted">Recorded: {totals.n}</span>}
            <Button variant="ghost" size="sm" onClick={pause} aria-label="Pause trial" leftIcon={<Pause size={16} {...ICON} />}>
              Pause
            </Button>
          </div>

          <ExerciseHost
            schemaType={schemaType}
            attempt={attempt}
            onDone={complete}
            onTask={onTask}
            onBlockEnd={handleBlockEnd}
            onError={handleError}
          />
        </div>
      )}

      {/* Paused: the exercise is unmounted; Resume starts a new task (R3). */}
      {stage === 'paused-blur' && (
        <div className="mx-auto my-auto flex max-w-md flex-col items-center gap-4 py-8 text-center">
          <h1 className="font-display text-2xl font-bold text-ink">Paused</h1>
          <p className="text-ink">This exercise will start again from the top.</p>
          <Button size="lg" onClick={run} autoFocus>
            Resume
          </Button>
          {backToTrain}
        </div>
      )}

      {/* One honest line (no fixed success claim) and one button. */}
      {stage === 'completed' && (
        <div className="mx-auto my-auto flex max-w-md flex-col items-center gap-4 py-8 text-center">
          <Loti pose={totals.n > 0 ? 'happy' : 'idle'} size="md" />
          <h1 className="font-display text-3xl font-bold text-ink">{name}</h1>
          <p className="text-lg text-ink tabular-nums">
            {result}
            {savedRun && ' Added to your progress.'}
          </p>
          <Button size="lg" onClick={() => navigate('/train')} autoFocus>
            Back to Train
          </Button>
        </div>
      )}

      {/* Error: a plain line for the user; the real message only for judges. */}
      {stage === 'error' && (
        <div role="alert" className="mx-auto my-auto flex max-w-md flex-col items-center gap-4 py-8 text-center">
          <h1 className="font-display text-2xl font-bold text-ink">This exercise didn't load.</h1>
          <p className="text-ink">Check your connection and try again.</p>
          {judge && errorMsg && <p className="font-mono-tabular text-xs text-ink-muted break-words">{errorMsg}</p>}
          <Button size="lg" onClick={run}>
            Try again
          </Button>
          {backToTrain}
        </div>
      )}

      {/* R6: evaluator controls only with ?judge=1. */}
      {judge && (
        <aside aria-label="Evaluator controls" className="pt-2 mt-auto border-t border-border text-xs text-ink-muted">
          <div className="flex flex-wrap items-center gap-1.5 pt-2">
            {/* Through pause(), like a real tab switch: a finished block completes, never replays. */}
            <Button variant="secondary" size="sm" onClick={pause}>
              Simulate Tab-Blur Pause
            </Button>
            <Button variant="secondary" size="sm" onClick={complete}>
              Fast-Forward to Summary
            </Button>
            <Button variant="secondary" size="sm" aria-pressed={showTable} onClick={() => setShowTable((p) => !p)}>
              {showTable ? 'Hide Telemetry' : 'View Telemetry as Table'}
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={toggleTheme}
              aria-label={theme === 'light' ? 'Switch to Dark (Night Lab)' : 'Switch to Light (Playful Lab)'}
            >
              {theme === 'light' ? 'Dark (Night Lab)' : 'Light (Playful Lab)'}
            </Button>

            {/* R2: one button per schema type of the current dimension */}
            <div role="group" aria-label="Exercise for this dimension" className="flex flex-wrap items-center gap-1">
              {currentDim.schemaTypes.map((s) => (
                <Button
                  key={s}
                  size="sm"
                  variant={s === schemaType ? 'primary' : 'secondary'}
                  aria-pressed={s === schemaType}
                  onClick={() => {
                    setSearchParams((prev) => {
                      const next = new URLSearchParams(prev)
                      next.set('schema', s)
                      return next
                    })
                    run()
                  }}
                >
                  Exercise: {s}
                </Button>
              ))}
            </div>

            <div role="group" aria-label="Cognitive dimension preset" className="flex flex-wrap items-center gap-1">
              {DIMENSION_PRESETS.map((item) => {
                const active = dimensionPreset === item.key
                return (
                  <Button
                    key={item.key}
                    size="sm"
                    variant={active ? 'primary' : 'secondary'}
                    aria-pressed={active}
                    onClick={() => setDimensionPreset(item.key)}
                  >
                    {item.label}
                  </Button>
                )
              })}
            </div>

            <div role="group" aria-label="Task runner stage switcher" className="flex flex-wrap items-center gap-1">
              {(
                [
                  { id: 'running', label: 'Active' },
                  { id: 'paused-blur', label: 'Paused' },
                  { id: 'completed', label: 'Block Summary' },
                ] as const
              ).map((st) => (
                <Button
                  key={st.id}
                  size="sm"
                  variant={stage === st.id ? 'primary' : 'secondary'}
                  aria-pressed={stage === st.id}
                  onClick={() => (st.id === 'running' ? run() : st.id === 'paused-blur' ? pause() : complete())}
                >
                  {st.label}
                </Button>
              ))}
            </div>

            <div role="group" aria-label="Switch active task runner dimension" className="flex flex-wrap items-center gap-1">
              {activeDimensions.map((dim) => {
                const isCurrent = dim.id === currentDim.id
                return (
                  <Button
                    key={dim.id}
                    size="sm"
                    variant={isCurrent ? 'primary' : 'secondary'}
                    aria-pressed={isCurrent}
                    // Another dimension resets the block on render; the current one restarts it here.
                    onClick={() => (isCurrent ? run() : navigate(`/task/${dim.id}`))}
                  >
                    {dim.markerGlyph} {dim.code}
                  </Button>
                )
              })}
            </div>

            {showTable && (
              <div className="w-full mt-2">
                <EventsTable events={tableEvents} />
              </div>
            )}
          </div>
        </aside>
      )}
    </div>
  )
}
