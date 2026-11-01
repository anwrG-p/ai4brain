import { useCallback, useEffect, useRef, useState } from 'react'
import { useDevicePrefs } from '../../state/devicePrefs'

export interface VoiceCoachConfig {
  rate?: number
  pitch?: number
  volume?: number
  onStart?: () => void
  onEnd?: () => void
  onError?: (err: unknown) => void
}

export interface SpeechListenerCallbacks {
  onResult: (transcript: string, isFinal: boolean) => void
  onError?: (errorMessage: string) => void
  onEnd?: () => void
}

export interface SpeechListenerController {
  stop: () => void
  instance: unknown
}

/** Cleans markdown tokens, URLs and multiple spaces so the utterance sounds natural. */
export function cleanSpokenText(text: string): string {
  return text
    .replace(/https?:\/\/\S+/gi, '')
    .replace(/[*_#`~[\]()]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/** Check if Web Speech Synthesis is supported by the client browser. */
export function isSynthesisSupported(): boolean {
  return Boolean(
    typeof window !== 'undefined' &&
      window.speechSynthesis &&
      typeof (window as unknown as Record<string, unknown>).SpeechSynthesisUtterance !== 'undefined',
  )
}

/** Check if Web Speech Recognition is supported by the client browser. */
export function isRecognitionSupported(): boolean {
  if (typeof window === 'undefined') return false
  const w = window as unknown as Record<string, unknown>
  return Boolean(w.SpeechRecognition || w.webkitSpeechRecognition)
}

/** Best-effort selection of a calm, natural English voice for Loti. */
export function getLotiVoice(): SpeechSynthesisVoice | null {
  if (!isSynthesisSupported()) return null
  const voices = window.speechSynthesis?.getVoices()
  if (!voices || voices.length === 0) return null

  // Prefer high quality natural or female English voices for Loti
  const preferred = voices.find(
    (v) =>
      v.lang.startsWith('en') &&
      (v.name.includes('Natural') ||
        v.name.includes('Samantha') ||
        v.name.includes('Victoria') ||
        v.name.includes('Google US English') ||
        v.name.includes('Zira')),
  )

  return preferred ?? voices.find((v) => v.lang.startsWith('en')) ?? voices[0] ?? null
}

/**
 * Speaks text using Web Speech API synthesis in Loti's voice.
 * Returns a cancel function.
 */
export function speakLoti(text: string, options: VoiceCoachConfig = {}): () => void {
  if (!isSynthesisSupported()) {
    options.onEnd?.()
    return () => {}
  }

  const cleaned = cleanSpokenText(text)
  if (!cleaned) {
    options.onEnd?.()
    return () => {}
  }

  stopLotiSpeech()

  const utterance = new window.SpeechSynthesisUtterance(cleaned)
  utterance.rate = options.rate ?? 1.0
  utterance.pitch = options.pitch ?? 1.0
  utterance.volume = options.volume ?? 1.0

  const voice = getLotiVoice()
  if (voice) utterance.voice = voice

  utterance.onstart = () => {
    options.onStart?.()
  }

  utterance.onend = () => {
    options.onEnd?.()
  }

  utterance.onerror = (e) => {
    options.onError?.(e)
    options.onEnd?.()
  }

  window.speechSynthesis.speak(utterance)

  return () => {
    stopLotiSpeech()
    options.onEnd?.()
  }
}

/** Immediately cancels any active speech synthesis. */
export function stopLotiSpeech(): void {
  if (typeof window !== 'undefined' && window.speechSynthesis?.cancel) {
    window.speechSynthesis.cancel()
  }
}

/**
 * Starts speech recognition for user dictation.
 * Returns a controller with stop() method, or null if unsupported.
 */
export function startListening(callbacks: SpeechListenerCallbacks): SpeechListenerController | null {
  if (!isRecognitionSupported()) {
    callbacks.onError?.('Speech recognition is not supported in this browser.')
    callbacks.onEnd?.()
    return null
  }

  const w = window as unknown as Record<string, unknown>
  const SpeechRecognitionConstructor = (w.SpeechRecognition || w.webkitSpeechRecognition) as {
    new (): {
      continuous: boolean
      interimResults: boolean
      lang: string
      onresult: ((e: any) => void) | null
      onerror: ((e: any) => void) | null
      onend: (() => void) | null
      start: () => void
      stop: () => void
      abort: () => void
    }
  }

  try {
    const recognition = new SpeechRecognitionConstructor()
    recognition.continuous = false
    recognition.interimResults = true
    recognition.lang = 'en-US'

    recognition.onresult = (event: any) => {
      let finalTranscript = ''
      let interimTranscript = ''

      for (let i = 0; i < event.results.length; ++i) {
        const item = event.results[i]
        const text = item[0]?.transcript ?? ''
        if (item.isFinal) {
          finalTranscript += text
        } else {
          interimTranscript += text
        }
      }

      const result = finalTranscript || interimTranscript
      if (result) {
        callbacks.onResult(result, Boolean(finalTranscript))
      }
    }

    recognition.onerror = (event: any) => {
      const err = event?.error
      let message = 'Speech recognition error.'
      if (err === 'not-allowed') {
        message = 'Microphone access was not allowed.'
      } else if (err === 'no-speech') {
        message = 'No speech was detected.'
      }
      callbacks.onError?.(message)
    }

    recognition.onend = () => {
      callbacks.onEnd?.()
    }

    recognition.start()

    return {
      stop: () => {
        try {
          recognition.stop()
        } catch {
          // Ignore if already stopped
        }
      },
      instance: recognition,
    }
  } catch {
    callbacks.onError?.('Could not start speech recognition.')
    callbacks.onEnd?.()
    return null
  }
}

export interface VoiceCoachHookState {
  voiceEnabled: boolean
  voicePace: number
  isSpeaking: boolean
  isListening: boolean
  transcript: string
  micError: string | null
  synthesisSupported: boolean
  recognitionSupported: boolean
  toggleVoice: () => void
  setVoicePace: (pace: number) => void
  speak: (text: string) => void
  listen: (onFinalTranscript?: (text: string) => void) => void
  stop: () => void
}

/**
 * React hook managing Loti's voice coaching interaction.
 */
export function useVoiceCoach(): VoiceCoachHookState {
  const voiceEnabled = useDevicePrefs((s) => s.voiceCoach)
  const setVoiceEnabled = useDevicePrefs((s) => s.setVoiceCoach)
  const voicePace = useDevicePrefs((s) => s.voicePace)
  const setVoicePacePref = useDevicePrefs((s) => s.setVoicePace)

  const [isSpeaking, setIsSpeaking] = useState(false)
  const [isListening, setIsListening] = useState(false)
  const [transcript, setTranscript] = useState('')
  const [micError, setMicError] = useState<string | null>(null)

  const listenerRef = useRef<SpeechListenerController | null>(null)

  const synthesisSupported = isSynthesisSupported()
  const recognitionSupported = isRecognitionSupported()

  // Clean up any ongoing speech or recognition on unmount
  useEffect(() => {
    return () => {
      stopLotiSpeech()
      listenerRef.current?.stop()
    }
  }, [])

  const stop = useCallback(() => {
    stopLotiSpeech()
    setIsSpeaking(false)
    if (listenerRef.current) {
      listenerRef.current.stop()
      listenerRef.current = null
    }
    setIsListening(false)
  }, [])

  const speak = useCallback(
    (text: string) => {
      if (!isSynthesisSupported()) return
      speakLoti(text, {
        rate: voicePace,
        onStart: () => setIsSpeaking(true),
        onEnd: () => setIsSpeaking(false),
        onError: () => setIsSpeaking(false),
      })
    },
    [voicePace],
  )

  const listen = useCallback(
    (onFinalTranscript?: (text: string) => void) => {
      if (isListening) {
        stop()
        return
      }

      setMicError(null)
      setTranscript('')
      setIsListening(true)

      const ctrl = startListening({
        onResult: (text, isFinal) => {
          setTranscript(text)
          if (isFinal && onFinalTranscript) {
            onFinalTranscript(text)
          }
        },
        onError: (err) => {
          setMicError(err)
          setIsListening(false)
        },
        onEnd: () => {
          setIsListening(false)
        },
      })

      listenerRef.current = ctrl
    },
    [isListening, stop],
  )

  const toggleVoice = useCallback(() => {
    const next = !voiceEnabled
    setVoiceEnabled(next)
    if (!next) {
      stop()
    }
  }, [voiceEnabled, setVoiceEnabled, stop])

  return {
    voiceEnabled,
    voicePace,
    isSpeaking,
    isListening,
    transcript,
    micError,
    synthesisSupported,
    recognitionSupported,
    toggleVoice,
    setVoicePace: setVoicePacePref,
    speak,
    listen,
    stop,
  }
}
