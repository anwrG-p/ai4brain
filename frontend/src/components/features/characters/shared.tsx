import { useEffect, useState } from 'react'
import { useAppStore } from '../../../state/useAppStore'

/* Shared drawing kit for Loti and Momo: flat line art (docs/design/references). Flat fills, one
   darker-blue outline of one width with round caps and joins, coral accents. No gradients, sheen
   or shadows. Every colour is a --char-* token from tokens.css, so the markup carries no raw
   colour values. */

export type CharacterSize = 'sm' | 'md' | 'lg' | 'xl'

/** Rendered width in px for each size; height follows each character's viewBox. */
export const CHARACTER_PX: Record<CharacterSize, number> = { sm: 48, md: 96, lg: 144, xl: 192 }

export const BODY = 'var(--char-body)'
export const BELLY = 'var(--char-belly)'
export const LINE = 'var(--char-line)'
export const CORAL = 'var(--char-coral)'
export const CORAL_LINE = 'var(--char-coral-line)'
export const BLUSH = 'var(--char-blush)'
export const FACE = 'var(--char-face)'
export const GLINT = 'var(--char-glint)'

/** The one outline width (viewBox units) every character uses. */
export const STROKE = 4

/** A filled shape with the shared outline. */
export const outlined = (fill: string, stroke: string = LINE, width: number = STROKE) =>
  ({ fill, stroke, strokeWidth: width, strokeLinecap: 'round', strokeLinejoin: 'round' }) as const

/** A stroke-only line (mouths, closed eyes, brows, arm creases): round caps and joins. */
export const line = (width: number = STROKE, stroke: string = FACE) =>
  ({ fill: 'none', stroke, strokeWidth: width, strokeLinecap: 'round', strokeLinejoin: 'round' }) as const

function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && typeof window.matchMedia === 'function'
    ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
    : false
}

/** False under the app's reduced-motion setting or the OS preference. tokens.css also locks the
    char-anim-* classes for both and for [data-timed-trial="true"], so this is belt and braces. */
export function useCharacterMotion(): boolean {
  const appReduced = useAppStore((s) => s.reducedMotion)
  const [osReduced, setOsReduced] = useState(prefersReducedMotion)
  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return
    const query = window.matchMedia('(prefers-reduced-motion: reduce)')
    const onChange = () => setOsReduced(query.matches)
    query.addEventListener?.('change', onChange)
    return () => query.removeEventListener?.('change', onChange)
  }, [])
  return !appReduced && !osReduced
}

/** An open eye: a navy oval with one glint, upper-left. */
export function Eye({ cx, cy, rx, ry, look = [0, 0] }: { cx: number; cy: number; rx: number; ry: number; look?: [number, number] }) {
  const [dx, dy] = look
  return (
    <g>
      <ellipse cx={cx + dx} cy={cy + dy} rx={rx} ry={ry} fill={FACE} />
      <circle cx={cx + dx - rx * 0.32} cy={cy + dy - ry * 0.34} r={rx * 0.38} fill={GLINT} />
    </g>
  )
}

/** Accessible SVG root shared by every character. */
export function CharacterSvg({
  label,
  width,
  viewBox,
  aspect,
  className = '',
  children,
}: {
  label: string
  width: number
  viewBox: string
  aspect: number
  className?: string
  children: React.ReactNode
}) {
  return (
    <svg
      role="img"
      aria-label={label}
      width={width}
      height={Math.round(width * aspect)}
      viewBox={viewBox}
      className={`char-figure shrink-0 ${className}`}
    >
      {/* aria-label only: a <title> would pop a native tooltip on hover. */}
      {children}
    </svg>
  )
}
