import { useEffect } from 'react'
import type { TrialRecorder } from './tracker'

const MOVE_THROTTLE_MS = 50

// Records hesitation-jitter inputs while active: keydown (not key repeat), pointerdown, and
// pointermove throttled to one per 50 ms. Capture phase on window, so the input that commits a
// response lands in the trial before the response handler finishes it.
export function useInputCapture(recorder: Pick<TrialRecorder, 'input'>, active: boolean): void {
  useEffect(() => {
    if (!active) return
    let lastMove = -Infinity
    const onKey = (e: KeyboardEvent) => {
      if (!e.repeat) recorder.input('key')
    }
    const onDown = () => recorder.input('down')
    const onMove = () => {
      const t = performance.now()
      if (t - lastMove < MOVE_THROTTLE_MS) return
      lastMove = t
      recorder.input('move')
    }
    const opts = { capture: true }
    window.addEventListener('keydown', onKey, opts)
    window.addEventListener('pointerdown', onDown, opts)
    window.addEventListener('pointermove', onMove, opts)
    return () => {
      window.removeEventListener('keydown', onKey, opts)
      window.removeEventListener('pointerdown', onDown, opts)
      window.removeEventListener('pointermove', onMove, opts)
    }
  }, [recorder, active])
}
