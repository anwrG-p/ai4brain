import { useEffect, useId, useState } from 'react'
import { useAppStore } from '../../../state/useAppStore'

/* Shared drawing kit for Loti, the Dolphin and Momo.
   One light: a key light from the top-left, so every highlight sits up-left and every shade
   and contact shadow falls down-right. All colours are --char-* tokens from tokens.css, so the
   markup carries no raw colour values and dark mode retunes the clay in one place. */

export type CharacterSize = 'sm' | 'md' | 'lg' | 'xl'

/** Rendered width in px for each size; height follows each character's viewBox. */
export const CHARACTER_PX: Record<CharacterSize, number> = { sm: 48, md: 96, lg: 144, xl: 192 }

/** A three-stop clay ramp: lit top-left, mid tone, shaded bottom-right. */
export interface ClayRamp {
  hi: string
  mid: string
  lo: string
}

export const ramp = (name: string): ClayRamp => ({
  hi: `var(--char-${name}-hi)`,
  mid: `var(--char-${name})`,
  lo: `var(--char-${name}-lo)`,
})

export const FACE = 'var(--char-face)'
export const GLINT = 'var(--char-glint)'

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

/** Unique, url()-safe ids for the gradients of one rendered character. */
export function useCharIds(name: string) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '')
  return (part: string) => `char-${name}-${uid}-${part}`
}

export const url = (id: string) => `url(#${id})`

/** Body clay: a radial ramp whose centre sits up-left, toward the light. */
export function ClayGradient({ id, tone, cx = 0.36, cy = 0.3, r = 0.78 }: { id: string; tone: ClayRamp; cx?: number; cy?: number; r?: number }) {
  return (
    <radialGradient id={id} cx={cx} cy={cy} r={r} fx={cx} fy={cy}>
      <stop offset="0" stopColor={tone.hi} />
      <stop offset="0.5" stopColor={tone.mid} />
      <stop offset="1" stopColor={tone.lo} />
    </radialGradient>
  )
}

/** Soft matte sheen: the glint colour fading to nothing. Low, so the clay stays matte, not vinyl. */
export function SheenGradient({ id, opacity = 0.3 }: { id: string; opacity?: number }) {
  return (
    <radialGradient id={id}>
      <stop offset="0" stopColor={GLINT} stopOpacity={opacity} />
      <stop offset="1" stopColor={GLINT} stopOpacity={0} />
    </radialGradient>
  )
}

/** Contact shadow on the floor: a feathered ellipse, slightly right of centre (light from top-left). */
export function ContactShadow({ id, cx, cy, rx, ry, className, style }: { id: string; cx: number; cy: number; rx: number; ry: number; className?: string; style?: React.CSSProperties }) {
  return (
    <g className={className} style={style}>
      <defs>
        <radialGradient id={id}>
          <stop offset="0" stopColor="var(--char-shadow)" stopOpacity="var(--char-shadow-alpha)" />
          <stop offset="1" stopColor="var(--char-shadow)" stopOpacity={0} />
        </radialGradient>
      </defs>
      <ellipse cx={cx} cy={cy} rx={rx} ry={ry} fill={url(id)} />
    </g>
  )
}

/** An eye: a tall navy oval with two glints, upper-left (the key light) and a small lower one. */
export function Eye({ cx, cy, rx, ry, look = [0, 0] }: { cx: number; cy: number; rx: number; ry: number; look?: [number, number] }) {
  const [dx, dy] = look
  return (
    <g>
      <ellipse cx={cx + dx} cy={cy + dy} rx={rx} ry={ry} fill={FACE} />
      <circle cx={cx + dx - rx * 0.3} cy={cy + dy - ry * 0.36} r={rx * 0.32} fill={GLINT} />
      <circle cx={cx + dx + rx * 0.35} cy={cy + dy + ry * 0.35} r={rx * 0.14} fill={GLINT} opacity={0.7} />
    </g>
  )
}

/** Shared stroke for mouths, closed eyes and brows: navy with round caps and joins. */
export const line = (width: number) =>
  ({ fill: 'none', stroke: FACE, strokeWidth: width, strokeLinecap: 'round', strokeLinejoin: 'round' }) as const

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
