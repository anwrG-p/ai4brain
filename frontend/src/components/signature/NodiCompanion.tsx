import { motion } from 'framer-motion'
import { useAppStore } from '../../store/useAppStore'
import { Badge } from '../ui/Badge'

export type NodiState =
  | 'idle'
  | 'hello'
  | 'curious'
  | 'thinking'
  | 'celebrate'
  | 'rest'
  | 'calm-shrug'
  | 'hidden'

export interface NodiCompanionProps {
  state?: NodiState
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

interface StateSpec {
  defaultTitle: string
  defaultBadge: string
  badgeTone: 'neutral' | 'brand' | 'info' | 'reward' | 'warning'
  badgeGlyph: string
  defaultLine: string
  ariaDescription: string
  imageSrc: string
}

const NODI_STATE_MAP: Record<NodiState, StateSpec> = {
  idle: {
    defaultTitle: 'Brian · Cognitive Guide',
    defaultBadge: 'State: Idle',
    badgeTone: 'neutral',
    badgeGlyph: '●',
    defaultLine: 'Every 2-minute block helps your cognitive twin grow with honest calibration.',
    ariaDescription: 'Nodi the friendly seedling neuron breathing calmly in idle posture',
    imageSrc: '/mascot/brian-waving.png',
  },
  hello: {
    defaultTitle: 'Brian · Welcome Guide',
    defaultBadge: 'State: Hello',
    badgeTone: 'brand',
    badgeGlyph: '✦',
    defaultLine: 'Welcome back! Pick up wherever you like—zero streak pressure, just honest insights.',
    ariaDescription: 'Nodi waving a warm hello with swaying dendrite sprout',
    imageSrc: '/mascot/brian-waving.png',
  },
  curious: {
    defaultTitle: 'Brian · Calibration Notice',
    defaultBadge: 'State: Curious',
    badgeTone: 'info',
    badgeGlyph: '◈',
    defaultLine: 'I need two more mini-blocks to be sure about your recall confidence band.',
    ariaDescription: 'Nodi tilting head curiously with pulsing embryonic dendrite bud',
    imageSrc: '/mascot/brian-explorer.png',
  },
  thinking: {
    defaultTitle: 'Brian · Synthesizing Telemetry',
    defaultBadge: 'State: Thinking',
    badgeTone: 'info',
    badgeGlyph: '◈',
    defaultLine: 'Putting your map together... computing ±95% confidence intervals across all dimensions.',
    ariaDescription: 'Nodi looking upward thoughtfully while synthesizing cognitive profile',
    imageSrc: '/mascot/brian-mentor.png',
  },
  celebrate: {
    defaultTitle: 'Brian · Block Completed',
    defaultBadge: 'State: Celebrate',
    badgeTone: 'reward',
    badgeGlyph: '★',
    defaultLine: 'Nice work! That trial counted toward narrowing your uncertainty bands.',
    ariaDescription: 'Nodi celebrating joyfully with raised arms and unfurled dendrite leaves',
    imageSrc: '/mascot/brian-celebrating.png',
  },
  rest: {
    defaultTitle: 'Brian · Rest & Recharge',
    defaultBadge: 'State: Rest',
    badgeTone: 'warning',
    badgeGlyph: '◐',
    defaultLine: 'Rest is an essential part of cognitive training. Take a mindful pause today.',
    ariaDescription: 'Nodi resting peacefully with closed eyes and crescent moon indicator',
    imageSrc: '/mascot/brian-sleepy.png',
  },
  'calm-shrug': {
    defaultTitle: 'Brian · Local Buffer Active',
    defaultBadge: 'State: Offline Buffer',
    badgeTone: 'warning',
    badgeGlyph: '⚡',
    defaultLine: 'Connection dropped. Your answers are saved safely on this device and will sync automatically.',
    ariaDescription: 'Nodi giving a gentle calm shrug with reassurance that data is preserved locally',
    imageSrc: '/mascot/brian-waving.png',
  },
  hidden: {
    defaultTitle: '',
    defaultBadge: '',
    badgeTone: 'neutral',
    badgeGlyph: '',
    defaultLine: '',
    ariaDescription: 'Nodi hidden during timed assessment block to prevent visual distraction',
    imageSrc: '',
  },
}

export function NodiCompanion({
  state = 'idle',
  size = 'md',
  title,
  message,
  badgeLabel,
  className = '',
  ariaHidden = false,
  showSpeechBubble = true,
}: NodiCompanionProps) {
  const { reducedMotion, theme } = useAppStore()
  const isDark = theme === 'dark'

  if (state === 'hidden') {
    return (
      <div
        aria-hidden="true"
        className="w-0 h-0 overflow-hidden pointer-events-none"
      />
    )
  }

  const spec = NODI_STATE_MAP[state] || NODI_STATE_MAP.idle
  const resolvedTitle = title ?? spec.defaultTitle
  const resolvedMessage = message ?? spec.defaultLine
  const resolvedBadge = badgeLabel ?? spec.defaultBadge

  const sizeClass =
    size === 'sm'
      ? 'h-12 w-12'
      : size === 'md'
        ? 'h-20 w-20'
        : size === 'lg'
          ? 'h-28 w-28'
          : size === 'docked'
            ? 'h-32 w-32'
            : 'h-48 w-48 sm:h-56 sm:w-56'

  const isHero = size === 'hero'
  const isDocked = size === 'docked'

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
      {/* Brian Axolotl Animated Layered Container */}
      <motion.div
        animate={
          reducedMotion || state === 'rest'
            ? undefined
            : {
                y: [0, -3, 0],
                rotate: state === 'curious' ? [0, 3, 0] : 0,
              }
        }
        transition={{
          duration: 3,
          repeat: Infinity,
          ease: 'easeInOut',
        }}
        className={`${sizeClass} shrink-0 select-none relative flex items-center justify-center`}
      >
        {/* Confidence Halo Glow */}
        <div
          className={`absolute inset-0 rounded-pill blur-xl pointer-events-none ${
            state === 'celebrate'
              ? 'bg-reward/35 animate-pulse'
              : state === 'rest'
              ? 'bg-secondary-fixed/40'
              : 'bg-brand/25 animate-pulse'
          }`}
          style={{ transform: 'scale(1.15)' }}
          aria-hidden="true"
        />

        <img
          src={
            isDark && (spec.imageSrc === '/mascot/brian-waving.png' || !spec.imageSrc)
              ? '/mascot/brian-waving-darkmode.png'
              : spec.imageSrc || '/mascot/brian-waving.png'
          }
          alt={spec.ariaDescription}
          role={ariaHidden ? undefined : 'img'}
          aria-label={ariaHidden ? undefined : spec.ariaDescription}
          aria-hidden={ariaHidden}
          className="w-full h-full object-contain relative z-10 transition-transform duration-200 hover:scale-105"
          loading="lazy"
        />
      </motion.div>

      {/* Tactile Speech Bubble */}
      {showSpeechBubble && (resolvedTitle || resolvedMessage) && (
        <div
          role={state === 'calm-shrug' || state === 'celebrate' ? 'status' : undefined}
          className={`${
            isHero
              ? 'max-w-md space-y-2'
              : 'space-y-1 rounded-xl border-2 border-border-strong bg-surface-raised p-4 shadow-doodle min-w-0 relative'
          }`}
        >
          {/* Subtle speech tail for desktop */}
          {!isHero && (
            <div
              className="hidden sm:block absolute top-6 -left-2.5 w-0 h-0 border-t-[8px] border-t-transparent border-r-[10px] border-r-border-strong border-b-[8px] border-b-transparent"
              aria-hidden="true"
            />
          )}

          <div className="flex flex-wrap items-center gap-2">
            {resolvedTitle && (
              <span className="font-display text-sm font-bold text-ink">
                {resolvedTitle}
              </span>
            )}
            {resolvedBadge && (
              <Badge tone={spec.badgeTone} glyph={spec.badgeGlyph}>
                {resolvedBadge}
              </Badge>
            )}
          </div>
          {resolvedMessage && (
            <p className="text-xs sm:text-sm text-ink leading-relaxed">
              {resolvedMessage}
            </p>
          )}
        </div>
      )}
    </div>
  )
}
