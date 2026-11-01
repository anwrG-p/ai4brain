import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { tracker, type TrialRecorder } from '../telemetry/tracker'
import type { TrialMeta } from '../telemetry/types'
import { useInputCapture } from '../telemetry/useInputCapture'

/* useTimedTrials (telemetry/useTimedTrials.ts) with a fixation cross before every trial, for the
   arrow exercises (Stop Light, Arrow Focus). Their stimuli repeat (four arrow displays), so with no
   gap a trial that looks like the last one would start unseen; the cross marks each new trial.
   Everything else mirrors useTimedTrials: one event per trial, ended by the first response or by
   the time limit; the recorder starts when the stimulus shows, never during the cross. A hidden page
   aborts the running trial and moves on to the next one when visible again (inside the UI the page
   unmounts the exercise on hidden first, R3: this is the standalone safety net).
   - `onFinish(index, correct)` runs once per finished trial and returns its trial_meta; `respond`'s
     `extra` is merged over it.
   - `timeoutCorrect(index)`: the verdict of a trial with no response (default false). A stop trial
     with no press is a successful stop.
   ponytail: a fixed cross length (no jitter); add one to the params if anticipation shows up. */
export function useFixatedTrials(
  recorder: TrialRecorder,
  count: number,
  fixationMs: number,
  timeLimitMs: number,
  onDone: () => void,
  onFinish?: (index: number, correct: boolean) => TrialMeta | undefined,
  timeoutCorrect?: (index: number) => boolean,
) {
  const [i, setI] = useState(0)
  const [showing, setShowing] = useState(false) // the stimulus is up; the cross shows otherwise
  const [paused, setPaused] = useState(false)
  const live = useRef(false) // a trial is running and accepting its first response
  const idx = useRef(0)
  const done = useRef(false)
  const pausedRef = useRef(false)
  const cbs = useRef({ onFinish, timeoutCorrect })
  useLayoutEffect(() => {
    cbs.current = { onFinish, timeoutCorrect }
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
      if (!live.current) return // an abort can land before this effect's cleanup clears the timer
      live.current = false
      const correct = cbs.current.timeoutCorrect?.(i) ?? false
      tracker.push(recorder.finish({ correct, windowMs: timeLimitMs, meta: cbs.current.onFinish?.(i, correct) }))
      setShowing(false)
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
      setShowing(false)
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
        setShowing(false)
        setI((x) => x + 1)
      }
    }
    document.addEventListener('visibilitychange', onVis)
    return () => document.removeEventListener('visibilitychange', onVis)
  }, [recorder])

  useInputCapture(recorder, !paused)

  return { i, showing: showing && !paused, paused, respond }
}

/** Left/right arrow keys, for the arrow exercises. A held key and modified keys are not answers; the
    arrows' page scroll is prevented. */
export function useArrowKeys(answer: (dir: 'left' | 'right') => void) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return
      const dir = ARROW_KEYS[e.key]
      if (!dir) return
      e.preventDefault()
      if (!e.repeat) answer(dir)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [answer])
}

export const ARROW_KEYS: Record<string, 'left' | 'right'> = { ArrowLeft: 'left', ArrowRight: 'right' }
