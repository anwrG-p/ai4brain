import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { tracker, type TrialRecorder } from './tracker'
import type { TrialMeta } from './types'
import { useInputCapture } from './useInputCapture'

/** The recorder calls the loop makes: a TrialRecorder, or a view of one (Pair Finder shifts the
    trial index). */
export type TrialRecording = Pick<TrialRecorder, 'start' | 'input' | 'finish' | 'abort'>

export type TimedTrialOptions = {
  /** A fixation cross for this long before every trial; `showing` is false during it. Default: none,
      the next stimulus appears on the response frame. */
  fixationMs?: number
  /** The verdict of a trial with no response (default false): a stop trial with no press is right. */
  timeoutCorrect?: (index: number) => boolean
}

// Shared loop for respond-or-time-out tasks (Stroop, matrix, mental rotation, the arrow exercises,
// Pair Finder's recall): one event per trial, ended by the first response or by the time limit. The
// recorder starts when the stimulus shows, never during a fixation cross. A hidden page aborts the
// running trial; when visible again the loop moves on to the next trial (or onDone after the last).
// A page hidden during the cross skips nothing: that trial never started, so its cross starts over.
// `onFinish(index, correct)` runs once per finished trial (response or timeout, not abort) and
// returns its trial_meta; `respond(correct, extra)` merges `extra` over it for that response.
// Voice is not ported (spec D1), so no voice fields reach the event.
// ponytail: a fixed cross length (no jitter); add one to the params if anticipation shows up.
export function useTimedTrials(
  recorder: TrialRecording,
  count: number,
  timeLimitMs: number,
  onDone: () => void,
  onFinish?: (index: number, correct: boolean) => TrialMeta | undefined,
  options: TimedTrialOptions = {},
) {
  const { fixationMs = 0 } = options
  const [i, setI] = useState(0)
  const [showing, setShowing] = useState(fixationMs <= 0) // the stimulus is up; the cross otherwise
  const [paused, setPaused] = useState(false)
  const live = useRef(false) // a trial is running and accepting its first response
  const idx = useRef(0) // index of the running trial
  const done = useRef(false)
  const pausedRef = useRef(false)
  const skipOnResume = useRef(false) // the hide aborted a running trial
  const cbs = useRef({ onFinish, timeoutCorrect: options.timeoutCorrect })
  useLayoutEffect(() => {
    cbs.current = { onFinish, timeoutCorrect: options.timeoutCorrect }
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
    if (!showing) {
      const id = setTimeout(() => setShowing(true), fixationMs)
      return () => clearTimeout(id)
    }
    recorder.start(i)
    idx.current = i
    live.current = true
    const id = setTimeout(() => {
      // An abort (hidden page) can land before this effect's cleanup clears the timer.
      if (!live.current) return
      live.current = false
      const correct = cbs.current.timeoutCorrect?.(i) ?? false
      tracker.push(recorder.finish({ correct, windowMs: timeLimitMs, meta: cbs.current.onFinish?.(i, correct) }))
      setShowing(fixationMs <= 0)
      setI(i + 1)
    }, timeLimitMs)
    return () => clearTimeout(id)
  }, [i, showing, paused, count, fixationMs, timeLimitMs, recorder, onDone])

  const respond = useCallback(
    (correct: boolean, extra?: TrialMeta) => {
      if (!live.current) return
      live.current = false
      const meta = cbs.current.onFinish?.(idx.current, correct)
      tracker.push(recorder.finish({ correct, meta: extra ? { ...meta, ...extra } : meta }))
      setShowing(fixationMs <= 0)
      setI((x) => x + 1)
    },
    [recorder, fixationMs],
  )

  useEffect(() => {
    const onVis = () => {
      if (document.hidden === pausedRef.current) return
      pausedRef.current = document.hidden
      if (document.hidden) {
        skipOnResume.current = live.current
        live.current = false
        recorder.abort()
        setPaused(true)
      } else {
        setPaused(false)
        setShowing(fixationMs <= 0)
        if (skipOnResume.current) setI((x) => x + 1)
      }
    }
    // Standalone safety net: inside the UI the page unmounts the exercise on hidden first (R3).
    document.addEventListener('visibilitychange', onVis)
    return () => document.removeEventListener('visibilitychange', onVis)
  }, [recorder, fixationMs])

  useInputCapture(recorder, !paused)

  return { i, paused, respond, showing: showing && !paused }
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
