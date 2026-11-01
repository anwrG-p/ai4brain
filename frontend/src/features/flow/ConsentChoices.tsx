import { useState } from 'react'
import { Button } from '../../components/ui/Button'
import { Switch } from '../../components/ui/Switch'
import type { ConsentPurpose } from '../assessment/telemetry/tracker'
import { COACH_ENABLED } from '../loti/coachAdapter'

/** The two purposes, in the order shown; the same words on the consent step and the privacy page.
    While the AI path is off (R14), purpose 2 says so: no claim of a reply that does not exist. */
export const PURPOSES: { id: ConsentPurpose; label: string }[] = [
  { id: 'telemetry', label: 'Save my answers to improve my training' },
  { id: 'coach', label: COACH_ENABLED ? 'Let Loti use AI to reply' : "Let Loti use AI to reply when it's available" },
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
            <Switch
              label={p.label}
              checked={choice[p.id]}
              onChange={(on) => setChoice((c) => ({ ...c, [p.id]: on }))}
              className="rounded-2xl border border-border bg-surface px-4 py-3"
            />
          </li>
        ))}
      </ul>
      <Button size="lg" onClick={() => onSubmit(choice)}>
        {submitLabel}
      </Button>
    </div>
  )
}
