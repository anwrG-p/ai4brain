import { useEffect } from 'react'
import { useEmilyStore } from '../../state/useEmilyStore'
import { startEmilyListener } from '../../utils/emilyEngine'

/* The emotion engine, headless (gap FE-03). It used to run inside the header's EmilyMoodPill; the
   pill is gone, so the shell mounts this once and Momo on the dashboard keeps reading a live store.
   It mirrors the current emotion onto <html data-emotion> as the pill did. */
export function EmotionListener() {
  const currentEmotion = useEmilyStore((s) => s.currentEmotion)

  useEffect(() => {
    document.documentElement.setAttribute('data-emotion', currentEmotion)
  }, [currentEmotion])

  useEffect(
    () =>
      startEmilyListener((_metrics, _emotion, buffer) => {
        if (buffer && buffer.length > 0) useEmilyStore.getState().updateTelemetry(buffer)
      }),
    [],
  )

  return null
}
