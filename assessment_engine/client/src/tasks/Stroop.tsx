import { useEffect } from 'react'
import { pressProps, useTimedTrials } from '../telemetry/useTimedTrials'
import type { StroopParams } from '../telemetry/types'
import type { VoiceSource } from '../voice/voiceProbe'
import type { TaskProps } from './TaskRunner'

// Stroop: name the ink color, not the word. Buttons carry the color name (not color alone); keys 1..9.
// Optional `voice`: an opt-in probe for spoken-answer latency and pacing (numbers only).
export function Stroop({ params, recorder, onDone, voice }: TaskProps<StroopParams> & { voice?: VoiceSource | null }) {
  const { colors, trials, time_limit_ms } = params
  // congruent: Member 3's interference cost = mean RT(incongruent) - mean RT(congruent).
  const congruent = (k: number) => {
    const x = trials[k]
    return x && { congruent: x.word.toLowerCase() === x.ink.toLowerCase() }
  }
  const { i, paused, respond } = useTimedTrials(recorder, trials.length, time_limit_ms, onDone, congruent, voice)
  const t = trials[i]

  useEffect(() => {
    if (!t) return
    const onKey = (e: KeyboardEvent) => {
      if (e.repeat || e.ctrlKey || e.metaKey || e.altKey) return
      const c = colors[Number(e.key) - 1]
      if (/^[1-9]$/.test(e.key) && c !== undefined) respond(c === t.answer)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [colors, t, respond])

  if (!t) return null
  return (
    <section aria-label="Color naming">
      <p>{voice ? 'Say the ink color aloud, then pick it.' : 'Pick the color of the ink, not the word.'}</p>
      {!paused && (
        <p style={{ color: t.ink, fontSize: '3rem', fontWeight: 700 }}>{t.word}</p>
      )}
      <div>
        {colors.map((c, k) => (
          <button key={c} type="button" {...pressProps(() => respond(c === t.answer))}>
            {c} ({k + 1})
          </button>
        ))}
      </div>
    </section>
  )
}
