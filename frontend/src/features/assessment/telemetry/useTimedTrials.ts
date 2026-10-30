import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { tracker, type TrialRecorder } from './tracker'
import type { TrialMeta } from './types'
import { useInputCapture } from './useInputCapture'

// Shared loop for respond-or-time-out tasks (Stroop, matrix, mental rotation): one event per trial,
// ended by the first response or by the time limit. A hidden page aborts the running trial; when
// visible again the loop moves on to the next trial (or onDone after the last).
// `onFinish(index, correct)` runs once per finished trial (response or timeout, not abort) and
// returns its trial_meta; `respond(correct, extra)` merges `extra` over it for that response.
// Voice is not ported (spec D1), so no voice fields reach the event.
// ponytail: no inter-trial interval or fixation; the next stimulus appears on the response frame.
export function useTimedTrials(
  recorder: TrialRecorder,
  count: number,
  timeLimitMs: number,
  onDone: () => void,
  onFinish?: (index: number, correct: boolean) => TrialMeta | undefined,
) {
  const [i, setI] = useState(0)
  const [paused, setPaused] = useState(false)
  const live = useRef(false) // a trial is running and accepting its first response
  const idx = useRef(0) // index of the running trial
  const done = useRef(false)
  const pausedRef = useRef(false)
  const onFinishRef = useRef(onFinish)
  useLayoutEffect(() => {
    onFinishRef.current = onFinish
  })

  useEffect(() => {
    if (paused) return
    if (i >= count) {
      if (!done.current) {
        done.current = true
        onDone()
      }
      return
    }
    recorder.start(i)
    idx.current = i
    live.current = true
    const id = setTimeout(() => {
      // An abort (hidden page) can land before this effect's cleanup clears the timer.
      if (!live.current) return
      live.current = false
      tracker.push(
        recorder.finish({
          correct: false,
          windowMs: timeLimitMs,
          meta: onFinishRef.current?.(i, false),
        }),
      )
      setI(i + 1)
    }, timeLimitMs)
    return () => clearTimeout(id)
  }, [i, paused, count, timeLimitMs, recorder, onDone])

  const respond = useCallback(
    (correct: boolean, extra?: TrialMeta) => {
      if (!live.current) return
      live.current = false
      const meta = onFinishRef.current?.(idx.current, correct)
      tracker.push(recorder.finish({ correct, meta: extra ? { ...meta, ...extra } : meta }))
      setI((x) => x + 1)
    },
    [recorder],
  )

  useEffect(() => {
    const onVis = () => {
      if (document.hidden === pausedRef.current) return
      pausedRef.current = document.hidden
      if (document.hidden) {
        live.current = false
        recorder.abort()
        setPaused(true)
      } else {
        setPaused(false)
        setI((x) => x + 1)
      }
    }
    document.addEventListener('visibilitychange', onVis)
    return () => document.removeEventListener('visibilitychange', onVis)
  }, [recorder])

  useInputCapture(recorder, !paused)

  return { i, paused, respond }
}

// Response button handlers: pointer presses answer on pointerdown (RT at the press); a keyboard
// activation (Enter/Space) arrives as a click with detail 0. Pointer clicks (detail >= 1) are
// skipped so a press is not counted twice. A held Enter clicks again on every auto-repeat keydown,
// so the click that follows a repeating Enter keydown is ignored. The flag clears on every click, so a
// click without a keydown (screen reader, virtual activation) always answers.
// ponytail: one module-level flag, since there is one keyboard and focus stays on the held button.
let keyRepeating = false
export const pressProps = (respond: () => void) => ({
  onPointerDown: respond,
  onKeyDown: (e: { repeat: boolean; key: string }) => {
    keyRepeating = e.repeat && e.key === 'Enter'
  },
  onClick: (e: { detail: number }) => {
    const skip = keyRepeating
    keyRepeating = false
    if (e.detail === 0 && !skip) respond()
  },
})
