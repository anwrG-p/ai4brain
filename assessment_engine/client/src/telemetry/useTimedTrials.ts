import { useCallback, useEffect, useRef, useState } from 'react'
import { tracker, type TrialRecorder } from './tracker'
import { useInputCapture } from './useInputCapture'

// Shared loop for respond-or-time-out tasks (Stroop, matrix, mental rotation): one event per trial,
// ended by the first response or by the time limit. A hidden page aborts the running trial; when
// visible again the loop moves on to the next trial (or onDone after the last).
// ponytail: no inter-trial interval or fixation; the next stimulus appears on the response frame.
export function useTimedTrials(recorder: TrialRecorder, count: number, timeLimitMs: number, onDone: () => void) {
  const [i, setI] = useState(0)
  const [paused, setPaused] = useState(false)
  const live = useRef(false) // a trial is running and accepting its first response
  const done = useRef(false)
  const pausedRef = useRef(false)

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
    live.current = true
    const id = setTimeout(() => {
      live.current = false
      tracker.push(recorder.finish({ correct: false, windowMs: timeLimitMs }))
      setI(i + 1)
    }, timeLimitMs)
    return () => clearTimeout(id)
  }, [i, paused, count, timeLimitMs, recorder, onDone])

  const respond = useCallback(
    (correct: boolean) => {
      if (!live.current) return
      live.current = false
      tracker.push(recorder.finish({ correct }))
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
