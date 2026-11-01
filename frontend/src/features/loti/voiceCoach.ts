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
  abort: () => void
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

/**
 * Detects if the current browser is Opera or Opera GX.
 * Opera is based on Chromium and exposes window.webkitSpeechRecognition,
 * but lacks backend cloud credentials for speech recognition.
 */
export function isOperaBrowser(): boolean {
  if (typeof navigator === 'undefined') return false
  const ua = navigator.userAgent || ''
  const w = (typeof window !== 'undefined' ? window : {}) as Record<string, unknown>
  return Boolean(/OPR\//i.test(ua) || /Opera/i.test(ua) || w.opr !== undefined)
}

/** Check if Web Speech Recognition is supported by the client browser. */
export function isRecognitionSupported(): boolean {
  if (typeof window === 'undefined') return false
  // Opera and Opera GX expose webkitSpeechRecognition on window, but have no backend speech service
  if (isOperaBrowser()) return false
  const w = window as unknown as Record<string, unknown>
  return Boolean(w.SpeechRecognition || w.webkitSpeechRecognition)
}

/**
 * Returns a human-friendly explanation if speech recognition is not supported in the current browser.
 */
export function getRecognitionSupportReason(): string | null {
  if (typeof window === 'undefined') return 'Speech recognition is not supported in this environment.'
  if (isOperaBrowser()) {
    return 'Speech recognition is not supported in Opera GX. Please open this page in Google Chrome or Microsoft Edge, or press Win + H for Windows Voice Typing.'
  }
  const w = window as unknown as Record<string, unknown>
  if (!w.SpeechRecognition && !w.webkitSpeechRecognition) {
    return 'Speech recognition is supported in Chrome, Edge, and Safari. Or press Win + H for Windows Voice Typing.'
  }
  return null
}

/**
 * Checks the current microphone permission state using Permissions API when available.
 */
export async function getMicPermissionState(): Promise<'granted' | 'prompt' | 'denied' | 'unknown'> {
  if (typeof navigator === 'undefined' || !navigator.permissions?.query) {
    return 'unknown'
  }
  try {
    const status = await navigator.permissions.query({ name: 'microphone' as PermissionName })
    return status.state
  } catch {
    return 'unknown'
  }
}

/**
 * Prompts the browser for microphone access via getUserMedia if needed.
 * Releasing tracks immediately once verified.
 */
export async function requestMicPermission(): Promise<{ ok: boolean; error?: string }> {
  if (
    typeof window !== 'undefined' &&
    window.isSecureContext === false &&
    window.location.hostname !== 'localhost' &&
    window.location.hostname !== '127.0.0.1'
  ) {
    return { ok: false, error: 'Microphone requires a secure connection (HTTPS or localhost).' }
  }

  const state = await getMicPermissionState()
  if (state === 'granted') {
    return { ok: true }
  }

  if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
    return { ok: true }
  }

  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    stream.getTracks().forEach((t) => t.stop())
    return { ok: true }
  } catch (err: unknown) {
    const e = err as { name?: string; message?: string }
    if (e.name === 'NotAllowedError' || e.name === 'PermissionDeniedError') {
      return {
        ok: false,
        error: 'Microphone access was denied. Click the lock icon in your browser address bar to allow microphone access.',
      }
    }
    if (e.name === 'NotFoundError' || e.name === 'DevicesNotFoundError') {
      return { ok: false, error: 'No microphone found on your device.' }
    }
    return { ok: false, error: 'Could not access microphone.' }
  }
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
 * Starts speech recognition for continuous user dictation.
 * Streams interim and final transcripts in real-time.
 * Automatically keeps session alive across Chrome's silence timeouts until explicitly stopped.
 */
export function startListening(callbacks: SpeechListenerCallbacks): SpeechListenerController | null {
  const unsupportedReason = getRecognitionSupportReason()
  if (unsupportedReason) {
    callbacks.onError?.(unsupportedReason)
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
      onspeechstart?: (() => void) | null
      start: () => void
      stop: () => void
      abort: () => void
    }
  }

  let recognition: InstanceType<typeof SpeechRecognitionConstructor> | null = null
  let isListeningActive = true
  let committedTranscript = ''
  let latestPassTranscript = ''
  let restartTimeout: ReturnType<typeof setTimeout> | null = null

  // Determine speech recognition language
  const navLang = typeof navigator !== 'undefined' && navigator.language ? navigator.language : 'en-US'
  const recognitionLang = navLang.toLowerCase().startsWith('en') ? 'en-US' : navLang

  const createAndStart = () => {
    try {
      recognition = new SpeechRecognitionConstructor()
      recognition.continuous = true
      recognition.interimResults = true
      recognition.lang = recognitionLang

      recognition.onresult = (event: any) => {
        let currentPassText = ''
        let isFinal = false

        for (let i = 0; i < event.results.length; ++i) {
          const item = event.results[i]
          const text = item[0]?.transcript ?? ''
          currentPassText = (currentPassText + ' ' + text).trim()
          if (item.isFinal) {
            isFinal = true
          }
        }

        latestPassTranscript = currentPassText
        const fullTranscript = (committedTranscript ? committedTranscript + ' ' + currentPassText : currentPassText).trim()

        if (fullTranscript) {
          const lastResult = event.results[event.results.length - 1]
          callbacks.onResult(fullTranscript, Boolean(lastResult?.isFinal || isFinal))
        }
      }

      recognition.onerror = (event: any) => {
        const err = event?.error
        if (err === 'no-speech' || err === 'aborted') {
          // Benign silence event: onend will auto-restart if still listening
          return
        }

        // Fatal errors terminate listening
        isListeningActive = false
        if (restartTimeout) clearTimeout(restartTimeout)

        let message = 'Speech recognition error.'
        if (err === 'not-allowed') {
          message = 'Microphone access was denied. Click the lock icon in your browser address bar to allow microphone access.'
        } else if (err === 'audio-capture') {
          message = 'No microphone was detected. Please check your audio settings.'
        } else if (err === 'network') {
          message = 'Speech service network error. Speech recognition requires an active internet connection.'
        } else if (err === 'service-not-allowed') {
          message = 'Speech service is not allowed in this browser. Please use Google Chrome or Microsoft Edge.'
        }
        callbacks.onError?.(message)
      }

      recognition.onend = () => {
        if (!isListeningActive) {
          callbacks.onEnd?.()
          return
        }

        // Commit current pass transcript across silence restarts so words are not lost
        if (latestPassTranscript) {
          committedTranscript = (committedTranscript ? committedTranscript + ' ' + latestPassTranscript : latestPassTranscript).trim()
          latestPassTranscript = ''
        }

        // Auto-restart with slight backoff
        restartTimeout = setTimeout(() => {
          if (isListeningActive) {
            try {
              createAndStart()
            } catch {
              isListeningActive = false
              callbacks.onEnd?.()
            }
          }
        }, 150)
      }

      recognition.start()
    } catch {
      isListeningActive = false
      callbacks.onError?.('Could not start speech recognition.')
      callbacks.onEnd?.()
    }
  }

  createAndStart()

  const stop = () => {
    isListeningActive = false
    if (restartTimeout) clearTimeout(restartTimeout)
    try {
      recognition?.stop()
    } catch {
      // Ignore
    }
  }

  const abort = () => {
    isListeningActive = false
    if (restartTimeout) clearTimeout(restartTimeout)
    try {
      recognition?.abort()
    } catch {
      // Ignore
    }
  }

  return {
    stop,
    abort,
    instance: recognition,
  }
}

export interface VoiceCoachHookState {
  voiceEnabled: boolean
  voicePace: number
  isSpeaking: boolean
  isListening: boolean
  isPromptingMic: boolean
  transcript: string
  micError: string | null
  synthesisSupported: boolean
  recognitionSupported: boolean
  toggleVoice: () => void
  setVoicePace: (pace: number) => void
  speak: (text: string) => void
  listen: (onTranscript?: (text: string, isFinal: boolean) => void) => void
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
  const [isPromptingMic, setIsPromptingMic] = useState(false)
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
    setIsPromptingMic(false)
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
    async (onTranscript?: (text: string, isFinal: boolean) => void) => {
      if (isListening) {
        stop()
        return
      }

      setMicError(null)
      setTranscript('')

      const unsupportedReason = getRecognitionSupportReason()
      if (unsupportedReason) {
        setMicError(unsupportedReason)
        return
      }

      // Check mic permission first
      const permState = await getMicPermissionState()
      if (permState === 'prompt') {
        setIsPromptingMic(true)
        const perm = await requestMicPermission()
        setIsPromptingMic(false)
        if (!perm.ok) {
          setMicError(perm.error ?? 'Microphone permission denied.')
          return
        }
      }

      setIsListening(true)

      const ctrl = startListening({
        onResult: (text, isFinal) => {
          setTranscript(text)
          if (onTranscript) {
            onTranscript(text, isFinal)
          }
        },
        onError: async (err) => {
          setIsListening(false)
          // If error is not-allowed, prompt with getUserMedia so browser surfaces the permission bar
          if (err.includes('denied') || err.includes('not-allowed')) {
            const perm = await requestMicPermission()
            if (!perm.ok) {
              setMicError(perm.error ?? err)
            } else {
              setMicError('Microphone enabled. Click Speak to begin talking.')
            }
          } else {
            setMicError(err)
          }
        },
        onEnd: () => {
          setIsListening(false)
        },
      })

      if (!ctrl) {
        setIsListening(false)
      } else {
        listenerRef.current = ctrl
      }
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
    isPromptingMic,
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
