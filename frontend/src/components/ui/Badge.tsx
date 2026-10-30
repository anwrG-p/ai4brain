import React from 'react'

export type BadgeTone =
  | 'brand'
  | 'reward'
  | 'neutral'
  | 'success'
  | 'warning'
  | 'danger'
  | 'info'
  | 'low-confidence'

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  tone?: BadgeTone
  glyph?: string
}

// Subtle tinted fill with toned text, no border: >= 4.5:1 in both themes (see ticket 02 Comments).
const TONE_CLASSES: Record<BadgeTone, string> = {
  brand: 'bg-brand-subtle text-brand',
  reward: 'bg-reward/20 text-ink',
  neutral: 'bg-surface-raised text-ink-muted',
  success: 'bg-success-subtle text-success',
  warning: 'bg-warning-subtle text-warning',
  danger: 'bg-danger-subtle text-danger',
  info: 'bg-info-subtle text-info',
  'low-confidence': 'border border-dashed border-border-strong bg-surface text-ink-muted',
}

export function Badge({
  tone = 'neutral',
  glyph,
  children,
  className = '',
  ...rest
}: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-sm text-xs font-semibold max-w-full whitespace-normal sm:whitespace-nowrap text-start leading-snug sm:leading-none ${TONE_CLASSES[tone]} ${className}`}
      {...rest}
    >
      {glyph && <span aria-hidden="true" className="shrink-0">{glyph}</span>}
      <span className="min-w-0 break-words">{children}</span>
    </span>
  )
}
