import React from 'react'

export type ButtonVariant = 'primary' | 'secondary' | 'reward' | 'danger' | 'ghost'
export type ButtonSize = 'sm' | 'md' | 'lg'

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: ButtonSize
  isLoading?: boolean
  leftIcon?: React.ReactNode
  rightIcon?: React.ReactNode
}

// .tactile-btn draws a 1 px border-strong boundary; solid fills hide it with border-transparent.
const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  primary: 'tactile-btn border-transparent bg-brand text-brand-ink hover:bg-brand-hover',
  secondary: 'tactile-btn bg-surface text-ink hover:bg-surface-raised',
  reward: 'tactile-btn border-transparent bg-reward text-reward-ink hover:opacity-90',
  danger: 'tactile-btn border-transparent bg-danger text-surface hover:opacity-90',
  ghost:
    'focus-ring min-w-11 rounded-md border border-transparent bg-transparent text-ink hover:bg-surface-raised transition-colors duration-150',
}

// Every size is at least 44 px tall (min-h-11); sm only shrinks the text and padding.
const SIZE_CLASSES: Record<ButtonSize, string> = {
  sm: 'px-3 py-1.5 text-sm gap-1.5',
  md: 'px-4 py-2 text-base gap-2',
  lg: 'px-6 py-3 text-lg gap-2',
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = 'primary',
      size = 'md',
      isLoading = false,
      disabled,
      leftIcon,
      rightIcon,
      children,
      className = '',
      type = 'button',
      ...rest
    },
    ref,
  ) => {
    const isDisabled = Boolean(disabled || isLoading)

    return (
      <button
        ref={ref}
        type={type}
        disabled={isDisabled}
        aria-busy={isLoading || undefined}
        className={`inline-flex min-h-11 items-center justify-center font-sans font-semibold select-none cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${VARIANT_CLASSES[variant]} ${SIZE_CLASSES[size]} ${className}`}
        {...rest}
      >
        {isLoading ? (
          <span
            aria-hidden="true"
            className="inline-block w-4 h-4 rounded-pill border-2 border-current border-t-transparent animate-spin"
          />
        ) : (
          leftIcon
        )}
        <span>{children}</span>
        {!isLoading && rightIcon}
      </button>
    )
  },
)

Button.displayName = 'Button'
