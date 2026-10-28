import React from 'react'

export type BrianPose =
  | 'waving'
  | 'celebrating'
  | 'mentor'
  | 'sleepy'
  | 'explorer'
  | 'idle'
  | 'hello'
  | 'celebrate'
  | 'rest'
  | 'curious'
  | 'thinking'

export type BrianMascotScale =
  | 'hero'
  | 'telemetry'
  | 'badge'
  | 'xs'
  | 'sm'
  | 'md'
  | 'lg'
  | 'xl'
  | '2xl'
  | number

export interface BrianMascotProps {
  pose?: BrianPose
  size?: BrianMascotScale
  scale?: BrianMascotScale
  halo?: boolean
  showHalo?: boolean
  haloColor?: 'brand' | 'secondary' | 'reward' | 'accent' | 'tertiary' | 'calm'
  statusPip?: string
  badge?: string
  badgeTone?: 'brand' | 'secondary' | 'reward' | 'accent' | 'tertiary'
  speechText?: string
  speechTitle?: string
  speechTimestamp?: string
  speechPlacement?: 'top' | 'right' | 'bottom' | 'left'
  className?: string
  animate?: boolean
  interactive?: boolean
  alt?: string
  onClick?: () => void
}

const POSE_IMAGE_MAP: Record<string, string> = {
  waving: '/mascot/brian-waving.png',
  hello: '/mascot/brian-waving.png',
  idle: '/mascot/brian-waving.png',
  celebrating: '/mascot/brian-celebrating.png',
  celebrate: '/mascot/brian-celebrating.png',
  mentor: '/mascot/brian-mentor.png',
  thinking: '/mascot/brian-mentor.png',
  sleepy: '/mascot/brian-sleepy.png',
  rest: '/mascot/brian-sleepy.png',
  explorer: '/mascot/brian-explorer.png',
  curious: '/mascot/brian-explorer.png',
}

const POSE_ALT_MAP: Record<string, string> = {
  waving: 'Cute friendly pink and sky-blue axolotl mascot named Brian waving cheerfully with one fin hand',
  celebrating: 'Cute ecstatic celebratory axolotl mascot named Brian jumping for joy with floating confetti and victory celebration',
  mentor: 'Cute pink and sky-blue axolotl mentor Brian wearing small nerdy glasses, pointing with a teacher pointer stick',
  sleepy: 'Cute sleepy cozy axolotl mascot Brian curled up wearing a little nightcap with a soft crescent moon pillow',
  explorer: 'Cute pink and sky-blue axolotl mascot Brian holding an oversized explorer magnifying glass and compass examining clues',
}

const SIZE_MAP: Record<string, number> = {
  hero: 192,
  telemetry: 144,
  badge: 40,
  xs: 32,
  sm: 48,
  md: 96,
  lg: 144,
  xl: 192,
  '2xl': 240,
}

export const BrianMascot: React.FC<BrianMascotProps> = ({
  pose = 'waving',
  size,
  scale,
  halo,
  showHalo,
  haloColor = 'brand',
  statusPip,
  badge,
  badgeTone = 'tertiary',
  speechText,
  speechTitle,
  speechTimestamp,
  speechPlacement = 'right',
  className = '',
  animate = true,
  interactive = true,
  alt,
  onClick,
}) => {
  const normalizedPose = POSE_IMAGE_MAP[pose] ? pose : 'waving'
  const imageSrc = POSE_IMAGE_MAP[normalizedPose] || '/mascot/brian-waving.png'
  const altText = alt || POSE_ALT_MAP[normalizedPose] || 'Brian the Axolotl mascot'
  const effectiveSize = scale ?? size ?? 'md'
  const pixelSize = typeof effectiveSize === 'number' ? effectiveSize : SIZE_MAP[effectiveSize] || 96
  const isHaloActive = showHalo ?? halo ?? true

  const haloGlowClass =
    haloColor === 'secondary' || haloColor === 'calm'
      ? 'bg-secondary-fixed/40'
      : haloColor === 'reward'
      ? 'bg-reward/30'
      : haloColor === 'tertiary'
      ? 'bg-success/20'
      : 'bg-brand/25'

  const mascotImage = (
    <div
      className="relative flex items-center justify-center shrink-0 select-none"
      style={{ width: pixelSize, height: pixelSize }}
      onClick={onClick}
    >
      {/* Confidence Halo Glow */}
      {isHaloActive && (
        <div
          className={`absolute inset-0 rounded-pill ${haloGlowClass} blur-xl pointer-events-none transition-all duration-300 ${
            animate ? 'animate-pulse' : ''
          }`}
          style={{ transform: 'scale(1.15)' }}
          aria-hidden="true"
        />
      )}

      {/* Axolotl Mascot Sticker Image */}
      <img
        src={imageSrc}
        alt={altText}
        width={pixelSize}
        height={pixelSize}
        className={`w-full h-full object-contain relative z-10 transition-transform duration-200 ${
          interactive ? 'hover:scale-105 active:scale-95 cursor-pointer' : ''
        }`}
        loading="lazy"
      />

      {/* Optional Status Pip */}
      {statusPip && (
        <span
          className="absolute bottom-1 right-1 w-3 h-3 rounded-full border-2 border-border-strong bg-success shadow-xs z-20"
          title={`Status: ${statusPip}`}
        />
      )}

      {/* Optional Status Pip / Badge */}
      {badge && (
        <span
          className={`absolute -bottom-1 -right-1 z-20 px-2 py-0.5 rounded-pill border-2 border-border-strong text-xs font-mono font-bold shadow-doodle-sm flex items-center gap-1 ${
            badgeTone === 'secondary'
              ? 'bg-secondary text-canvas'
              : badgeTone === 'reward'
              ? 'bg-reward text-brand-ink'
              : 'bg-success text-brand-ink'
          }`}
        >
          <span className="w-1.5 h-1.5 rounded-pill bg-current animate-ping" />
          {badge}
        </span>
      )}
    </div>
  )

  if (!speechText) {
    return <div className={`inline-flex items-center justify-center ${className}`}>{mascotImage}</div>
  }

  // Combined Layout with Tactile Speech Bubble
  return (
    <div
      className={`flex ${
        speechPlacement === 'top'
          ? 'flex-col-reverse items-center gap-3'
          : speechPlacement === 'bottom'
          ? 'flex-col items-center gap-3'
          : speechPlacement === 'left'
          ? 'flex-row-reverse items-center gap-4'
          : 'flex-col sm:flex-row items-center sm:items-start gap-4'
      } ${className}`}
    >
      {mascotImage}

      {/* Tactile Hand-Drawn Speech Bubble */}
      <div className="relative flex-1 w-full bg-surface-raised rounded-2xl border-2 border-border-strong p-4 sm:p-5 shadow-doodle transition-all hover:shadow-doodle-lg">
        {/* Tactical Speech Pointer Beak for Desktop (Pointing toward Brian) */}
        {speechPlacement === 'right' && (
          <>
            <div
              className="hidden sm:block absolute top-7 -left-3 w-0 h-0 border-t-[9px] border-t-transparent border-r-[12px] border-r-border-strong border-b-[9px] border-b-transparent"
              aria-hidden="true"
            />
            <div
              className="hidden sm:block absolute top-7 -left-[9px] w-0 h-0 border-t-[7px] border-t-transparent border-r-[10px] border-r-surface-raised border-b-[7px] border-b-transparent z-10"
              aria-hidden="true"
            />
          </>
        )}

        {/* Speech Header */}
        {(speechTitle || speechTimestamp) && (
          <div className="flex items-center justify-between gap-2 mb-1.5">
            {speechTitle && (
              <span className="font-mono text-xs uppercase tracking-wider text-brand font-bold">
                {speechTitle}
              </span>
            )}
            {speechTimestamp && (
              <span className="font-mono text-xs text-ink-muted">
                {speechTimestamp}
              </span>
            )}
          </div>
        )}

        {/* Dialogue Text */}
        <p className="font-sans text-base sm:text-lg text-ink leading-snug">
          {speechText}
        </p>
      </div>
    </div>
  )
}

export default BrianMascot
