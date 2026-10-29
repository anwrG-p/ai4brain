import { useMemo, useState } from 'react'
import type { FatigueHeatmapCell } from '../../../types'
import { buildFatigueHeatmap } from '../../../services/mocks/fixtures'
import type { PersonaId } from '../../../state/useAppStore'
import { Badge } from '../../ui/Badge'
import { Button } from '../../ui/Button'
import { Card } from '../../ui/Card'

export interface FatigueHeatmapProps {
  persona: PersonaId
}

const DAYS: readonly FatigueHeatmapCell['dayKey'][] = [
  'Mon',
  'Tue',
  'Wed',
  'Thu',
  'Fri',
  'Sat',
  'Sun',
]

const WINDOWS: readonly {
  id: FatigueHeatmapCell['windowId']
  label: string
  shortLabel: string
}[] = [
  { id: 'morning', label: 'Morning (08:00–12:00)', shortLabel: 'Morning' },
  { id: 'afternoon', label: 'Afternoon (13:00–17:00)', shortLabel: 'Afternoon' },
  { id: 'evening', label: 'Evening (18:00–22:00)', shortLabel: 'Evening' },
]

export function FatigueHeatmap({ persona }: FatigueHeatmapProps) {
  const [showTable, setShowTable] = useState(false)
  const cells = useMemo(() => buildFatigueHeatmap(persona), [persona])

  const getCell = (
    windowId: FatigueHeatmapCell['windowId'],
    dayKey: FatigueHeatmapCell['dayKey'],
  ) =>
    cells.find((c) => c.windowId === windowId && c.dayKey === dayKey) ?? null

  return (
    <Card className="p-5 space-y-4 shadow-doodle">
      <div className="flex flex-wrap items-start justify-between gap-2 border-b-2 border-border-strong pb-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-display text-lg font-bold text-ink">
              Session Fatigue &amp; Time-of-Day Alertness Heatmap
            </h3>
            <Badge tone="brand" glyph="●">
              Peak: Morning (-48 ms RT)
            </Badge>
          </div>
          <p className="text-xs text-ink-muted">
            Combines reaction-time stability and error-burst recovery across
            windows. Every cell prints both its numeric readiness and non-color
            status symbol.
          </p>
        </div>

        <Button
          variant="secondary"
          size="sm"
          aria-pressed={showTable}
          onClick={() => setShowTable((prev) => !prev)}
        >
          {showTable ? 'View Visual Grid' : 'View Heatmap as Table'}
        </Button>
      </div>

      {/* Legend Bar (Non-color symbols + numeric thresholds) */}
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <Badge tone="success" glyph="●">
          80–100% Optimal Alertness
        </Badge>
        <Badge tone="info" glyph="◐">
          65–79% Moderate Pacing
        </Badge>
        <Badge tone="warning" glyph="▲">
          &lt;65% High Fatigue (Rest Recommended)
        </Badge>
        <Badge tone="neutral" glyph="—">
          Unlogged Window
        </Badge>
      </div>

      {showTable ? (
        <div className="overflow-x-auto">
          <table
            aria-label="Session Fatigue and Alertness by Time of Day and Day of Week"
            className="w-full text-start border-collapse text-xs"
          >
            <caption className="sr-only">
              Alertness percentage and mean reaction time across Morning,
              Afternoon, and Evening windows
            </caption>
            <thead>
              <tr className="border-b-2 border-border-strong bg-surface-raised">
                <th scope="col" className="p-2 text-start font-bold">
                  Window
                </th>
                {DAYS.map((day) => (
                  <th key={day} scope="col" className="p-2 text-start font-bold">
                    {day}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {WINDOWS.map((win) => (
                <tr key={win.id} className="border-b border-border">
                  <th
                    scope="row"
                    className="p-2 font-display font-bold text-ink text-start"
                  >
                    {win.label}
                  </th>
                  {DAYS.map((day) => {
                    const cell = getCell(win.id, day)
                    return (
                      <td key={day} className="p-2 font-mono-tabular text-ink">
                        {cell && cell.readinessPct !== null
                          ? `${cell.glyph} ${cell.readinessPct}% (${cell.meanRtMs}ms)`
                          : '— Unlogged'}
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div
          role="region"
          aria-label="Time-of-day alertness matrix"
          className="space-y-2.5"
        >
          {WINDOWS.map((win) => (
            <div
              key={win.id}
              className="grid grid-cols-1 sm:grid-cols-8 gap-2 items-center"
            >
              <div className="sm:col-span-1">
                <span className="font-display text-xs font-bold text-ink block">
                  {win.shortLabel}
                </span>
                <span className="font-mono-tabular text-xs text-ink-muted block">
                  {win.id === 'morning'
                    ? '08–12h'
                    : win.id === 'afternoon'
                      ? '13–17h'
                      : '18–22h'}
                </span>
              </div>

              <div className="sm:col-span-7 grid grid-cols-2 sm:grid-cols-7 gap-2">
                {DAYS.map((day) => {
                  const cell = getCell(win.id, day)
                  if (!cell || cell.readinessPct === null) {
                    return (
                      <div
                        key={day}
                        className="rounded-sm border border-dashed border-border bg-surface-raised p-2 text-center"
                      >
                        <span className="text-xs font-bold text-ink-muted block">
                          {day}
                        </span>
                        <span className="font-mono-tabular text-xs text-ink-muted block">
                          — Rest
                        </span>
                      </div>
                    )
                  }

                  const toneClasses =
                    cell.status === 'optimal'
                      ? 'bg-success-subtle border-border-strong text-ink'
                      : cell.status === 'moderate'
                        ? 'bg-info-subtle border-border text-ink'
                        : 'bg-warning-subtle border-border-strong text-ink'

                  return (
                    <div
                      key={day}
                      className={`rounded-sm border-2 p-2 text-center ${toneClasses}`}
                    >
                      <span className="text-xs font-bold block">{day}</span>
                      <span className="font-mono-tabular text-xs font-bold block">
                        {cell.glyph} {cell.readinessPct}%
                      </span>
                      <span className="font-mono-tabular text-xs text-ink-muted block">
                        {cell.meanRtMs}ms
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  )
}
