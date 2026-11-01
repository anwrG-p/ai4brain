import { useId } from 'react'
import { BRAND_CONFIG } from '../../../config/brand'

/* The Loti mark (docs/design/references/logo-mark.jpg): Loti's bust, head and shoulders with
   coral-outlined gills, inside an open circle arc. Flat line art in the character tokens; the same
   drawing, with its colours written out, is public/favicon.svg. */

const LINE = 'var(--char-line)'
const BODY = 'var(--char-body)'
const BELLY = 'var(--char-belly)'
const CORAL = 'var(--char-coral)'
const FACE = 'var(--char-face)'

const GILLS = ['M22 18 C20 13 16 9 15 4', 'M18 23 C13 19 9 16 4 15', 'M17 30 C12 30 8 31 4 33']
const round = { strokeLinecap: 'round', strokeLinejoin: 'round' } as const

export function LogoMark({ size = 40, className = '', ...rest }: { size?: number; className?: string; 'aria-hidden'?: boolean | 'true' }) {
  // A unique clip id per mark: the header renders two, one of them display:none.
  const clip = `logo-bust-${useId().replace(/[^a-zA-Z0-9]/g, '')}`
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" className={`shrink-0 ${className}`} role={rest['aria-hidden'] ? undefined : 'img'} aria-label={rest['aria-hidden'] ? undefined : BRAND_CONFIG.productName} {...rest}>
      <defs>
        <clipPath id={clip}>
          <circle cx={32} cy={35} r={26} />
        </clipPath>
      </defs>
      {/* Gills: a coral tube with a light core, three a side. */}
      {[0, 1].map((side) => (
        <g key={side} transform={side ? 'translate(64 0) scale(-1 1)' : undefined}>
          {GILLS.map((d) => (
            <g key={d}>
              <path d={d} fill="none" stroke={CORAL} strokeWidth={7.2} {...round} />
              <path d={d} fill="none" stroke={BELLY} strokeWidth={3} {...round} />
            </g>
          ))}
        </g>
      ))}
      {/* Shoulders, cut by the circle. */}
      <path d="M22 36 C21 46 15 54 10 64 L54 64 C49 54 43 46 42 36 Z" fill={BODY} stroke={LINE} strokeWidth={2.4} clipPath={`url(#${clip})`} {...round} />
      <path d="M27 50 C26 54 26 58 27 61" fill="none" stroke={LINE} strokeWidth={2} clipPath={`url(#${clip})`} {...round} />
      <ellipse cx={32} cy={27} rx={17} ry={12.5} fill={BODY} stroke={LINE} strokeWidth={2.4} />
      <ellipse cx={26.5} cy={27} rx={1.9} ry={2.2} fill={FACE} />
      <ellipse cx={37.5} cy={27} rx={1.9} ry={2.2} fill={FACE} />
      <path d="M27.5 32 Q32 35.5 36.5 32" fill="none" stroke={FACE} strokeWidth={1.8} {...round} />
      {/* The open arc: from the left, under the bust, up to the right shoulder. */}
      <path d="M7.6 43.9 A26 26 0 0 0 56.4 43.9" fill="none" stroke={LINE} strokeWidth={2.6} {...round} />
    </svg>
  )
}

/** The mark with the wordmark, in the heading font. */
export function LogoLockup({ className = '' }: { className?: string }) {
  return (
    <span aria-hidden="true" className={`inline-flex items-center gap-2 ${className}`}>
      <LogoMark size={36} aria-hidden="true" />
      <span className="font-display text-xl font-bold text-ink">{BRAND_CONFIG.productName}</span>
    </span>
  )
}
