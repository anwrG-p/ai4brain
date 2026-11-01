import { useId } from 'react'

export interface SwitchProps {
  label: string
  /** Read as the switch's description (aria-describedby), shown under the label. */
  description?: string
  checked: boolean
  onChange: (checked: boolean) => void
  /** The row's own frame (padding, border, radius); the switch always fills its width. */
  className?: string
}

/* One on/off switch: the whole row is the control (a tap target of at least 44 px), named by its
   label only. Used by Settings and the consent choices, so both read and look the same. */
export function Switch({ label, description, checked, onChange, className = '' }: SwitchProps) {
  const labelId = useId()
  const descId = useId()
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-labelledby={labelId}
      aria-describedby={description ? descId : undefined}
      onClick={() => onChange(!checked)}
      className={`focus-ring flex min-h-14 w-full cursor-pointer items-center justify-between gap-4 text-left hover:bg-surface-raised ${className}`}
    >
      <span className="flex flex-col">
        <span id={labelId} className="text-base font-medium text-ink">
          {label}
        </span>
        {description && (
          <span id={descId} className="text-sm text-ink-muted">
            {description}
          </span>
        )}
      </span>
      <span
        aria-hidden="true"
        className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-pill border ${
          checked ? 'border-transparent bg-brand' : 'border-border-strong bg-surface-raised'
        }`}
      >
        <span className={`inline-block size-5 rounded-pill transition-transform ${checked ? 'translate-x-6 bg-brand-ink' : 'translate-x-1 bg-border-strong'}`} />
      </span>
    </button>
  )
}
