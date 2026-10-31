import React from 'react'
import { Loti, type LotiPose } from '../characters/Loti'
import type { CharacterSize } from '../characters/shared'

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

/* ponytail: compatibility shim. The axolotl PNGs are retired; every BrianMascot now draws Loti.
   Pages still calling it are rebuilt in tickets 08/09, which delete this file. */
const POSE_TO_LOTI: Record<BrianPose, LotiPose> = {
  waving: 'wave',
  hello: 'wave',
  idle: 'idle',
  celebrating: 'happy',
  celebrate: 'happy',
  mentor: 'think',
  thinking: 'think',
  sleepy: 'idle',
  rest: 'idle',
  explorer: 'think',
  curious: 'think',
}

const NAMED_SIZE: Record<string, CharacterSize> = {
  hero: 'xl',
  telemetry: 'lg',
  badge: 'sm',
  xs: 'sm',
  sm: 'sm',
  md: 'md',
  lg: 'lg',
  xl: 'xl',
  '2xl': 'xl',
}

function toLotiSize(size: BrianMascotScale): CharacterSize {
  if (typeof size !== 'number') return NAMED_SIZE[size] ?? 'md'
  return size <= 64 ? 'sm' : size <= 112 ? 'md' : size <= 160 ? 'lg' : 'xl'
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
  const mascotImage = (
    <div
      className={`relative flex items-center justify-center shrink-0 select-none ${interactive && onClick ? 'cursor-pointer' : ''}`}
      onClick={onClick}
    >
      <Loti pose={POSE_TO_LOTI[pose] ?? 'idle'} size={toLotiSize(scale ?? size ?? 'md')} title={alt} />

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
