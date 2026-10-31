import { useEffect } from 'react'
import { useEmilyStore } from '../../state/useEmilyStore'
import { startEmilyListener } from '../../utils/emilyEngine'

/* The emotion engine, headless (gap FE-03): the shell mounts this once, so Momo on the dashboard
   reads a live mood store. It also mirrors the current emotion onto <html data-emotion>, for tests
   and dev tools only: no style reads it. */
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
