import type { Glyph, Poly } from '../telemetry/types'

// Shared renderers: pure SVG built from payload numbers and strings (no innerHTML).
// Colours are currentColor or theme tokens only, so light and dark both follow tokens.css.

// Payload colour names (CSS names, kept for the aria-label) → theme tokens with a matching hue.
// ponytail: only the names the fixtures use; anything else paints in ink rather than a raw name.
const GLYPH_COLORS: Record<string, string> = {
  blue: 'var(--dim-1)',
  red: 'var(--color-danger)',
  green: 'var(--color-success)',
  yellow: 'var(--dim-5)', // not --color-reward: 1.55:1 on the light surface, below 3:1
}

const glyphFill = (name: string) =>
  Object.hasOwn(GLYPH_COLORS, name) ? GLYPH_COLORS[name]! : 'var(--color-ink)'

function Shape({ shape, cx, cy, r, color }: { shape: Glyph['shape']; cx: number; cy: number; r: number; color: string }) {
  if (shape === 'circle') return <circle cx={cx} cy={cy} r={r} fill={color} />
  if (shape === 'square') return <rect x={cx - r} y={cy - r} width={2 * r} height={2 * r} fill={color} />
  const pts =
    shape === 'triangle'
      ? [[cx, cy - r], [cx + r, cy + r], [cx - r, cy + r]]
      : [[cx, cy - r], [cx + r, cy], [cx, cy + r], [cx - r, cy]]
  return <polygon points={pts.map((p) => p.join(',')).join(' ')} fill={color} />
}

export function GlyphView({ glyph, size = 80 }: { glyph: Glyph; size?: number }) {
  const { shape, count, color, rotation_deg } = glyph
  const label = `${count} ${color} ${shape}${count > 1 ? 's' : ''}`
  const fill = glyphFill(color)
  // Shapes sit side by side in a 100x100 box, each rotated about its own centre.
  const r = count === 1 ? 22 : count === 2 ? 18 : 13
  const step = 100 / count
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" role="img" aria-label={label}>
      {Array.from({ length: count }, (_, i) => {
        const cx = step * (i + 0.5)
        return (
          <g key={i} transform={`rotate(${rotation_deg} ${cx} 50)`}>
            <Shape shape={shape} cx={cx} cy={50} r={r} color={fill} />
          </g>
        )
      })}
    </svg>
  )
}

export function PolyView({ poly, size = 160, label = 'figure' }: { poly: Poly; size?: number; label?: string }) {
  const { points } = poly
  // Guards for bad payloads: no points frames a unit box at the origin; edges to missing points are dropped.
  const xs = points.length ? points.map((p) => p[0]) : [0]
  const ys = points.length ? points.map((p) => p[1]) : [0]
  const minX = Math.min(...xs)
  const minY = Math.min(...ys)
  const span = Math.max(Math.max(...xs) - minX, Math.max(...ys) - minY) || 1
  const pad = span * 0.1
  const stroke = span * 0.02
  const edges = poly.edges.flatMap(([i, j]) => {
    const a = points[i]
    const b = points[j]
    return a && b ? [[a, b] as const] : []
  })
  return (
    <svg
      width={size}
      height={size}
      viewBox={`${minX - pad} ${minY - pad} ${span + 2 * pad} ${span + 2 * pad}`}
      role="img"
      aria-label={label}
    >
      {edges.map(([a, b], k) => (
        <line key={k} x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]} stroke="currentColor" strokeWidth={stroke} />
      ))}
      {points.map(([x, y], k) => (
        <circle key={k} cx={x} cy={y} r={stroke * 2} fill="currentColor" />
      ))}
    </svg>
  )
}

export function CellsView({
  cells,
  angle_deg,
  mirrored,
  size = 160,
}: {
  cells: [number, number][]
  angle_deg: number
  mirrored: boolean
  size?: number
}) {
  // Unit squares; rotate (and mirror) about the shape's centroid, framed so any angle fits.
  const cx = cells.reduce((s, c) => s + c[0] + 0.5, 0) / cells.length
  const cy = cells.reduce((s, c) => s + c[1] + 0.5, 0) / cells.length
  const radius = Math.max(...cells.map(([x, y]) => Math.hypot(x + 0.5 - cx, y + 0.5 - cy))) + 1
  const transform = `rotate(${angle_deg} ${cx} ${cy})${mirrored ? ` translate(${2 * cx} 0) scale(-1 1)` : ''}`
  return (
    <svg
      width={size}
      height={size}
      viewBox={`${cx - radius} ${cy - radius} ${2 * radius} ${2 * radius}`}
      role="img"
      aria-label="block shape"
    >
      <g transform={transform}>
        {cells.map(([x, y], k) => (
          <rect
            key={k}
            x={x}
            y={y}
            width={1}
            height={1}
            fill="currentColor"
            stroke="var(--color-surface)"
            strokeWidth={0.05}
          />
        ))}
      </g>
    </svg>
  )
}
