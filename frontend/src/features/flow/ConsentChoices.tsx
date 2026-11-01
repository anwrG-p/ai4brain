import { useId, useState } from 'react'
import { Button } from '../../components/ui/Button'
import type { ConsentPurpose } from '../assessment/telemetry/tracker'

/** The two purposes, in the order shown; the same words on the consent step and the privacy page. */
export const PURPOSES: { id: ConsentPurpose; label: string }[] = [
  { id: 'telemetry', label: 'Save my answers to improve my training' },
  { id: 'coach', label: 'Let Loti use AI to reply' },
]

export type ConsentChoice = Record<ConsentPurpose, boolean>

/* Consent per purpose (research #6): two switches of equal weight (R3: same style, same size, same
   place), both off until the user turns one on, and one primary button that records both. Nothing
   is decided until it is pressed. */
export function ConsentChoices({
  initial = { telemetry: false, coach: false },
  submitLabel = 'Continue',
  onSubmit,
}: {
  initial?: ConsentChoice
  submitLabel?: string
  onSubmit: (choice: ConsentChoice) => void
}) {
  const [choice, setChoice] = useState<ConsentChoice>(initial)
  return (
    <div className="flex flex-col gap-5">
      <ul className="m-0 flex list-none flex-col gap-3 p-0">
        {PURPOSES.map((p) => (
          <li key={p.id}>
            <PurposeSwitch label={p.label} on={choice[p.id]} onChange={(on) => setChoice((c) => ({ ...c, [p.id]: on }))} />
          </li>
        ))}
      </ul>
      <Button size="lg" onClick={() => onSubmit(choice)}>
        {submitLabel}
      </Button>
    </div>
  )
}

function PurposeSwitch({ label, on, onChange }: { label: string; on: boolean; onChange: (on: boolean) => void }) {
  const labelId = useId()
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-labelledby={labelId}
      onClick={() => onChange(!on)}
      className="focus-ring flex min-h-14 w-full cursor-pointer items-center justify-between gap-4 rounded-2xl border border-border bg-surface px-4 py-3 text-left hover:bg-surface-raised"
    >
      <span id={labelId} className="text-base font-medium text-ink">
        {label}
      </span>
      <span
        aria-hidden="true"
        className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-pill border ${
          on ? 'border-transparent bg-brand' : 'border-border-strong bg-surface-raised'
        }`}
      >
        <span className={`inline-block size-5 rounded-pill transition-transform ${on ? 'translate-x-6 bg-brand-ink' : 'translate-x-1 bg-border-strong'}`} />
      </span>
    </button>
  )
}
