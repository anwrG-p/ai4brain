import { Badge } from '../../ui/Badge'
import { Loti, type LotiPose } from '../characters/Loti'
import type { CharacterSize } from '../characters/shared'

/* The app-wide companion wrapper. It renders Loti (components/features/characters) and keeps the
   old Mascot / NodiCompanion props API (NodiCompanion is gone), so the pages that use it did not have to change.
   ponytail: the bubble copy and badges are the pre-brand-v2 ones; tickets 03 and 09 replace them. */

export type MascotState =
  | 'idle'
  | 'hello'
  | 'curious'
  | 'thinking'
  | 'celebrate'
  | 'rest'
  | 'calm-shrug'
  | 'hidden'

export interface MascotProps {
  state?: MascotState
  size?: 'sm' | 'md' | 'lg' | 'docked' | 'hero'
  title?: string
  message?: string
  badgeLabel?: string
  calibratedCount?: number
  lowConfCount?: number
  totalDimensions?: number
  className?: string
  ariaHidden?: boolean
  showSpeechBubble?: boolean
}

/** Mascot states onto Loti's poses. */
export const STATE_TO_POSE: Record<Exclude<MascotState, 'hidden'>, LotiPose> = {
  idle: 'idle',
  hello: 'wave',
  curious: 'think',
  thinking: 'think',
  celebrate: 'happy',
  rest: 'idle',
  'calm-shrug': 'idle',
}

const SIZE_TO_LOTI: Record<NonNullable<MascotProps['size']>, CharacterSize> = {
  sm: 'sm',
  md: 'md',
  lg: 'lg',
  docked: 'lg',
  hero: 'xl',
}

interface StateSpec {
  defaultTitle: string
  defaultBadge: string
  badgeTone: 'neutral' | 'brand' | 'info' | 'reward' | 'warning'
  badgeGlyph: string
  defaultLine: string
}

const STATE_COPY: Record<Exclude<MascotState, 'hidden'>, StateSpec> = {
  idle: {
    defaultTitle: 'Loti · Your guide',
    defaultBadge: 'State: Idle',
    badgeTone: 'neutral',
    badgeGlyph: '●',
    defaultLine: 'Every 2-minute block helps your cognitive twin grow with honest calibration.',
  },
  hello: {
    defaultTitle: 'Loti · Welcome',
    defaultBadge: 'State: Hello',
    badgeTone: 'brand',
    badgeGlyph: '✦',
    defaultLine: 'Welcome back! Pick up wherever you like—zero streak pressure, just honest insights.',
  },
  curious: {
    defaultTitle: 'Loti · Calibration notice',
    defaultBadge: 'State: Curious',
    badgeTone: 'info',
    badgeGlyph: '◈',
    defaultLine: 'I need two more mini-blocks to be sure about your recall confidence band.',
  },
  thinking: {
    defaultTitle: 'Loti · Thinking',
    defaultBadge: 'State: Thinking',
    badgeTone: 'info',
    badgeGlyph: '◈',
    defaultLine: 'Putting your map together... computing ±95% confidence intervals across all dimensions.',
  },
  celebrate: {
    defaultTitle: 'Loti · Block completed',
    defaultBadge: 'State: Celebrate',
    badgeTone: 'reward',
    badgeGlyph: '★',
    defaultLine: 'Nice work! That trial counted toward narrowing your uncertainty bands.',
  },
  rest: {
    defaultTitle: 'Loti · Rest & recharge',
    defaultBadge: 'State: Rest',
    badgeTone: 'warning',
    badgeGlyph: '◐',
    defaultLine: 'Rest is an essential part of cognitive training. Take a mindful pause today.',
  },
  'calm-shrug': {
    defaultTitle: 'Loti · Saved on this device',
    defaultBadge: 'State: Offline Buffer',
    badgeTone: 'warning',
    badgeGlyph: '⚡',
    defaultLine: 'Connection dropped. Your answers are saved safely on this device and will sync automatically.',
  },
}

export function Mascot({
  state = 'idle',
  size = 'md',
  title,
  message,
  badgeLabel,
  className = '',
  ariaHidden = false,
  showSpeechBubble = true,
}: MascotProps) {
  if (state === 'hidden') {
    return <div aria-hidden="true" className="w-0 h-0 overflow-hidden pointer-events-none" />
  }

  const spec = STATE_COPY[state]
  const resolvedTitle = title ?? spec.defaultTitle
  const resolvedMessage = message ?? spec.defaultLine
  const resolvedBadge = badgeLabel ?? spec.defaultBadge
  const isHero = size === 'hero'
  const isDocked = size === 'docked'
  const bubble = showSpeechBubble && Boolean(resolvedTitle || resolvedMessage)
  // With a titled bubble, the bubble names Loti; hide the figure so screen readers say it once.
  const hideFigure = ariaHidden || (bubble && Boolean(resolvedTitle))

  return (
    <div
      className={`inline-flex ${
        isHero
          ? 'flex-col items-center text-center gap-4'
          : isDocked
            ? 'flex-row items-center gap-4'
            : message
              ? 'flex-col sm:flex-row items-center sm:items-start gap-4'
              : 'items-center justify-center'
      } ${className}`}
    >
      <span aria-hidden={hideFigure || undefined} className="inline-flex shrink-0 select-none">
        <Loti pose={STATE_TO_POSE[state]} size={SIZE_TO_LOTI[size]} />
      </span>

      {bubble && (
        <div
          role={state === 'calm-shrug' || state === 'celebrate' ? 'status' : undefined}
          className={isHero ? 'max-w-md space-y-2' : 'space-y-1 rounded-xl border border-border bg-surface p-4 min-w-0'}
        >
          <div className="flex flex-wrap items-center gap-2">
            {resolvedTitle && <span className="font-display text-sm font-semibold text-ink">{resolvedTitle}</span>}
            {resolvedBadge && (
              <Badge tone={spec.badgeTone} glyph={spec.badgeGlyph}>
                {resolvedBadge}
              </Badge>
            )}
          </div>
          {resolvedMessage && <p className="text-xs sm:text-sm text-ink leading-relaxed">{resolvedMessage}</p>}
        </div>
      )}
    </div>
  )
}
