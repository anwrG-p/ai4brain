import { useEffect, type ReactNode } from 'react'
import { ArrowLeft, ArrowRight } from 'lucide-react'
import { Button } from '../../../components/ui/Button'
import { pressProps } from '../telemetry/useTimedTrials'

/* What the arrow exercises (Stop Light, Arrow Focus) share: the arrow stimulus, the two large answer
   buttons and the ←/→ keys. */

export type Dir = 'left' | 'right'

/** One right-pointing arrow in a 100 x 100 cell; mirror it for left (arrowTransform). */
export const ARROW = 'M18 50 H78 M56 28 L80 50 L56 72'
export const arrowTransform = (dir: Dir, x = 0) => `translate(${x} 0)${dir === 'left' ? ' translate(100 0) scale(-1 1)' : ''}`

/** The stimulus arrow: ink strokes on the card's surface. */
export function ArrowPath({ dir, x = 0 }: { dir: Dir; x?: number }) {
  return (
    <path
      d={ARROW}
      transform={arrowTransform(dir, x)}
      fill="none"
      stroke="var(--color-ink)"
      strokeWidth={10}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  )
}

export const ARROW_KEYS: Record<string, Dir> = { ArrowLeft: 'left', ArrowRight: 'right' }

/** Left/right arrow keys. A held key and modified keys are not answers; the arrows' page scroll is
    prevented. */
export function useArrowKeys(answer: (dir: Dir) => void) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return
      const dir = ARROW_KEYS[e.key]
      if (!dir) return
      e.preventDefault()
      if (!e.repeat) answer(dir)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [answer])
}

const ICON = { size: 24, strokeWidth: 1.75, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true } as const

/** A large answer button (>= 56 px tall, 128 px wide): pressProps answers on pointerdown. */
export function AnswerButton({ onPress, icon, iconRight, children }: { onPress: () => void; icon: ReactNode; iconRight?: boolean; children: ReactNode }) {
  return (
    <Button
      variant="secondary"
      size="lg"
      className="min-h-14 min-w-32"
      leftIcon={iconRight ? undefined : icon}
      rightIcon={iconRight ? icon : undefined}
      {...pressProps(onPress)}
    >
      {children}
    </Button>
  )
}

/** The Left and Right buttons, with their arrow icons (text and icon, never icon alone). */
export function ArrowButtons({ answer }: { answer: (dir: Dir) => void }) {
  return (
    <div className="flex justify-center gap-4">
      <AnswerButton onPress={() => answer('left')} icon={<ArrowLeft {...ICON} />}>
        Left
      </AnswerButton>
      <AnswerButton onPress={() => answer('right')} icon={<ArrowRight {...ICON} />} iconRight>
        Right
      </AnswerButton>
    </div>
  )
}

/** The cross shown between trials. */
export function Cross() {
  return (
    <span role="img" aria-label="Look at the cross" className="select-none text-5xl font-bold text-ink">
      +
    </span>
  )
}
