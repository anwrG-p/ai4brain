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
  /** halo, showHalo, haloColor and animate are kept for API compatibility; Calm & Clean renders no halo. */
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
  statusPip,
  badge,
  badgeTone = 'tertiary',
  speechText,
  speechTitle,
  speechTimestamp,
  speechPlacement = 'right',
  className = '',
  interactive = true,
  alt,
  onClick,
}) => {
  const normalizedPose = POSE_IMAGE_MAP[pose] ? pose : 'waving'
  const imageSrc = POSE_IMAGE_MAP[normalizedPose] || '/mascot/brian-waving.png'
  const altText = alt || POSE_ALT_MAP[normalizedPose] || 'Brian the Axolotl mascot'
  const effectiveSize = scale ?? size ?? 'md'
  const pixelSize = typeof effectiveSize === 'number' ? effectiveSize : SIZE_MAP[effectiveSize] || 96
  const mascotImage = (
    <div
      className="relative flex items-center justify-center shrink-0 select-none"
      style={{ width: pixelSize, height: pixelSize }}
      onClick={onClick}
    >
      {/* Axolotl Mascot Sticker Image */}
      <img
        src={imageSrc}
        alt={altText}
        width={pixelSize}
        height={pixelSize}
        className={`w-full h-full object-contain ${interactive ? 'cursor-pointer' : ''}`}
        loading="lazy"
      />

      {/* Optional Status Pip */}
      {statusPip && (
        <span
          className="absolute bottom-1 right-1 w-3 h-3 rounded-full border border-surface bg-success z-20"
          title={`Status: ${statusPip}`}
        />
      )}

      {/* Optional Status Pip / Badge */}
      {badge && (
        <span
          className={`absolute -bottom-1 -right-1 z-20 px-2 py-0.5 rounded-pill text-xs font-mono font-semibold flex items-center gap-1 ${
            badgeTone === 'secondary'
              ? 'bg-secondary text-canvas'
              : badgeTone === 'reward'
              ? 'bg-reward text-reward-ink'
              : 'bg-success text-brand-ink'
          }`}
        >
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

      {/* Speech bubble: a plain 1 px-border surface */}
      <div className="relative flex-1 w-full bg-surface rounded-xl border border-border p-4 sm:p-5">
        {/* Speech Header */}
        {(speechTitle || speechTimestamp) && (
          <div className="flex items-center justify-between gap-2 mb-1.5">
            {speechTitle && (
              <span className="text-xs font-semibold text-brand">
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
