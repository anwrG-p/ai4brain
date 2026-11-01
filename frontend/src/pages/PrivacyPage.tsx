import { useEffect, useId, useRef, useState, useSyncExternalStore, type KeyboardEvent } from 'react'
import { Button } from '../components/ui/Button'
import { tracker, type Consent } from '../features/assessment/telemetry/tracker'
import { ConsentChoices, type ConsentChoice } from '../features/flow/ConsentChoices'
import { COACH_ENABLED } from '../features/loti/coachAdapter'
import { deleteMyData, downloadMyData, downloadServerData } from '../features/privacy/myData'

const CONSENT_LINE: Record<Consent, string> = {
  pending: 'Not chosen yet. Your answers stay on this device.',
  granted: 'Your answers are saved.',
  denied: 'Your answers are kept on this device only.',
}

const COACH_LINE: Record<Consent, string> = {
  pending: 'AI replies from Loti: not chosen yet.',
  // While the AI path is off (R14) no reply exists yet, so the line says when it would apply.
  granted: COACH_ENABLED ? 'Loti may use AI to reply.' : "Loti may use AI to reply when it's available.",
  denied: 'Loti uses scripted replies only.',
}

const subscribeTracker = (onChange: () => void) => tracker.subscribe(onChange)
const currentStatus = () => tracker.getStatus()

const QUIET = 'focus-ring inline-flex min-h-11 cursor-pointer items-center rounded-sm text-sm font-medium underline underline-offset-4'

/* Privacy: each purpose's status in one line (research #6: saving answers, AI replies from Loti)
   with one control that opens both switches to change them (R3, equal weight), one sentence on what
   is recorded, then two quiet links: "Export my data" (local JSON + server telemetry) and "Delete my data"
   behind a confirmation (rules 13, 14: the only primary button is inside the open choice). */
export default function PrivacyPage() {
  const { consent, coachConsent } = useSyncExternalStore(subscribeTracker, currentStatus)
  const [choosing, setChoosing] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [deleted, setDeleted] = useState(false)

  const choose = (choice: ConsentChoice) => {
    tracker.choose(choice)
    setChoosing(false)
    setDeleted(false)
  }

  return (
    <div className="mx-auto flex max-w-xl flex-col gap-6 pb-12">
      <h1 className="font-display text-3xl font-bold text-ink">Privacy</h1>

      <div className="space-y-3">
        <div>
          <p data-testid="consent-line" aria-live="polite" className="text-lg text-ink">
            {CONSENT_LINE[consent]}
          </p>
          <p data-testid="coach-line" aria-live="polite" className="text-lg text-ink">
            {COACH_LINE[coachConsent]}
          </p>
          <button type="button" aria-expanded={choosing} onClick={() => setChoosing((o) => !o)} className={`${QUIET} text-brand`}>
            {consent === 'pending' && coachConsent === 'pending' ? 'Choose' : 'Change'}
          </button>
        </div>
        {choosing && (
          // Equal weight (R3): the same two switches and words as the consent step, set to what holds now.
          <ConsentChoices
            initial={{ telemetry: consent === 'granted', coach: coachConsent === 'granted' }}
            submitLabel="Done"
            onSubmit={choose}
          />
        )}
      </div>

      <p className="text-base text-ink-muted">We record answer timing and accuracy only. No camera, no microphone.</p>

      <div>
        <div className="flex flex-wrap gap-x-6">
          <button
            type="button"
            onClick={() => {
              downloadMyData()
              void downloadServerData()
            }}
            className={`${QUIET} text-brand`}
          >
            Export my data
          </button>
          <button type="button" onClick={() => setConfirming(true)} className={`${QUIET} text-danger`}>
            Delete my data
          </button>
        </div>
        <p role="status" className="text-sm text-ink">
          {deleted ? 'Deleted from this device.' : ''}
        </p>
      </div>

      {confirming && (
        <ConfirmDelete
          onCancel={() => setConfirming(false)}
          onConfirm={() => {
            void deleteMyData()
            setConfirming(false)
            setChoosing(false)
            setDeleted(true)
          }}
        />
      )}
    </div>
  )
}

/* A small modal: Cancel has focus first (the safe choice), Escape cancels, Tab stays inside, and
   focus goes back to "Delete my data" after. */
function ConfirmDelete({ onCancel, onConfirm }: { onCancel: () => void; onConfirm: () => void }) {
  const titleId = useId()
  const bodyId = useId()
  const cancel = useRef<HTMLButtonElement>(null)
  const panel = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const opener = document.activeElement
    cancel.current?.focus()
    return () => {
      if (opener instanceof HTMLElement && opener.isConnected) opener.focus()
    }
  }, [])

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.stopPropagation()
      onCancel()
      return
    }
    if (e.key !== 'Tab' || !panel.current) return
    const items = Array.from(panel.current.querySelectorAll<HTMLElement>('button'))
    const first = items[0]
    const last = items[items.length - 1]
    if (!first || !last) return
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault()
      last.focus()
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault()
      first.focus()
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-canvas/80 sm:items-center sm:p-4">
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={bodyId}
        onKeyDown={onKeyDown}
        className="w-full max-w-md space-y-5 rounded-t-2xl border border-border bg-surface px-6 pt-6 pb-8 shadow-(--shadow-elevation) sm:rounded-2xl"
      >
        <div className="space-y-2">
          <h2 id={titleId} className="font-display text-2xl font-bold text-ink">
            Delete your data?
          </h2>
          <p id={bodyId} className="text-base text-ink">
            Your results, goals and answers on this device go away. You can't undo this.
          </p>
        </div>
        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <Button ref={cancel} variant="secondary" onClick={onCancel}>
            Cancel
          </Button>
          <Button variant="danger" onClick={onConfirm}>
            Delete
          </Button>
        </div>
      </div>
    </div>
  )
}
