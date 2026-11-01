import { useEffect, useState } from 'react'

export interface WaveformVisualizerProps {
  /** True when audio is actively being synthesized or voice is being captured. */
  active: boolean
  /** Kind of activity: 'speaking' (Loti speaking) or 'listening' (user speaking). */
  mode?: 'speaking' | 'listening' | 'idle'
  barCount?: number
  className?: string
}

/**
 * Accessible audio waveform indicator.
 * Displays calm, rhythmic bars vibrating softly during speech activity.
 */
export function WaveformVisualizer({
  active,
  mode = 'idle',
  barCount = 18,
  className = '',
}: WaveformVisualizerProps) {
  const [ticks, setTicks] = useState(0)

  useEffect(() => {
    if (!active) return
    const id = window.setInterval(() => {
      setTicks((t) => (t + 1) % 1000)
    }, 120)
    return () => window.clearInterval(id)
  }, [active])

  const heights = Array.from({ length: barCount }, (_, i) => {
    if (!active) return 4
    // Smooth deterministic wave with phase shift
    const wave = Math.sin((ticks * 0.4) + (i * 0.5))
    const base = mode === 'listening' ? 14 : 18
    return Math.max(4, Math.round(Math.abs(wave) * base + 4))
  })

  return (
    <div
      aria-hidden="true"
      className={`inline-flex items-center gap-0.5 h-6 px-2 select-none ${className}`}
    >
      {heights.map((h, i) => (
        <span
          key={i}
          className={`w-0.5 rounded-full transition-all duration-150 ${
            active
              ? mode === 'listening'
                ? 'bg-ink'
                : 'bg-brand'
              : 'bg-ink-muted/30'
          }`}
          style={{ height: `${h}px` }}
        />
      ))}
    </div>
  )
}
