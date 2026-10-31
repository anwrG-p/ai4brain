import React from 'react'

export type CardVariant = 'default' | 'raised' | 'low-confidence' | 'danger' | 'editorial' | 'hero'

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: CardVariant
  as?: 'div' | 'section' | 'article'
}

const CARD_VARIANTS: Record<CardVariant, string> = {
  default: 'tactile-card bg-surface text-ink',
  raised: 'tactile-card bg-surface-raised text-ink',
  editorial: 'editorial-card text-ink',
  hero: 'hero-card text-ink',
  'low-confidence': 'rounded-xl border border-dashed border-border-strong bg-surface text-ink',
  danger: 'rounded-xl border border-danger bg-danger-subtle text-ink',
}

// A caller's own p-N wins; otherwise md:p-6 would override it from md up.
const HAS_PADDING = /(^|\s)p-\d/

export function Card({
  variant = 'default',
  as: Component = 'div',
  className = '',
  children,
  ...rest
}: CardProps) {
  const padding = HAS_PADDING.test(className) ? '' : 'p-5 md:p-6'
  return (
    <Component className={`${padding} ${CARD_VARIANTS[variant]} ${className}`} {...rest}>
      {children}
    </Component>
  )
}
export default Card
