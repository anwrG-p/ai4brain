import { useEffect } from 'react'
import { useDevicePrefs } from '../../state/devicePrefs'
import { useEmilyStore } from '../../state/useEmilyStore'
import { startEmilyListener } from '../../utils/emilyEngine'

/* The mood guess, headless (gap FE-03): the shell mounts this once, so Momo on the dashboard reads
   a live mood store. It runs only while the "Mood guess" setting is on (ADR 0002): switched off,
   the listener stops and the store goes back to calm, so Momo shows a neutral face. It also mirrors
   the current emotion onto <html data-emotion>, for tests and dev tools only: no style reads it. */
export function EmotionListener() {
  const currentEmotion = useEmilyStore((s) => s.currentEmotion)
  const on = useDevicePrefs((s) => s.moodGuess)

  useEffect(() => {
    document.documentElement.setAttribute('data-emotion', currentEmotion)
  }, [currentEmotion])

  useEffect(() => {
    if (!on) {
      useEmilyStore.getState().reset()
      return
    }
    return startEmilyListener((_metrics, _emotion, buffer) => {
      if (buffer && buffer.length > 0) useEmilyStore.getState().updateTelemetry(buffer)
    })
  }, [on])

  return null
}
