import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import {
  cleanSpokenText,
  isRecognitionSupported,
  isSynthesisSupported,
  requestMicPermission,
  speakLoti,
  startListening,
  stopLotiSpeech,
  useVoiceCoach,
} from './voiceCoach'

// Mock SpeechSynthesis and SpeechRecognition interfaces
class MockSpeechSynthesisUtterance {
  text: string
  rate = 1
  pitch = 1
  volume = 1
  lang = 'en-US'
  onstart: (() => void) | null = null
  onend: (() => void) | null = null
  onerror: ((e: unknown) => void) | null = null

  constructor(text: string) {
    this.text = text
  }
}

class MockSpeechRecognition {
  continuous = false
  interimResults = true
  lang = 'en-US'
  onresult: ((event: unknown) => void) | null = null
  onerror: ((event: unknown) => void) | null = null
  onend: (() => void) | null = null

  start = vi.fn()
  stop = vi.fn(() => {
    this.onend?.()
  })
  abort = vi.fn(() => {
    this.onend?.()
  })
}

describe('voiceCoach module (seam: Web Speech API)', () => {
  let originalSpeechSynthesis: typeof window.speechSynthesis
  let originalSpeechRecognition: unknown
  let originalWebkitSpeechRecognition: unknown
  let originalMediaDevices: unknown

  let mockSpeak: ReturnType<typeof vi.fn>
  let mockCancel: ReturnType<typeof vi.fn>
  let mockGetVoices: ReturnType<typeof vi.fn>

  beforeEach(() => {
    originalSpeechSynthesis = window.speechSynthesis
    originalSpeechRecognition = (window as unknown as Record<string, unknown>).SpeechRecognition
    originalWebkitSpeechRecognition = (window as unknown as Record<string, unknown>).webkitSpeechRecognition
    originalMediaDevices = navigator.mediaDevices

    mockSpeak = vi.fn((utterance: MockSpeechSynthesisUtterance) => {
      utterance.onstart?.()
    })
    mockCancel = vi.fn()
    mockGetVoices = vi.fn(() => [])

    Object.defineProperty(window, 'speechSynthesis', {
      writable: true,
      configurable: true,
      value: {
        speak: mockSpeak,
        cancel: mockCancel,
        getVoices: mockGetVoices,
        speaking: false,
        paused: false,
        pending: false,
      },
    })
    ;(window as unknown as Record<string, unknown>).SpeechSynthesisUtterance = MockSpeechSynthesisUtterance
    ;(window as unknown as Record<string, unknown>).SpeechRecognition = MockSpeechRecognition
  })

  afterEach(() => {
    Object.defineProperty(window, 'speechSynthesis', {
      writable: true,
      configurable: true,
      value: originalSpeechSynthesis,
    })
    ;(window as unknown as Record<string, unknown>).SpeechRecognition = originalSpeechRecognition
    ;(window as unknown as Record<string, unknown>).webkitSpeechRecognition = originalWebkitSpeechRecognition
    Object.defineProperty(navigator, 'mediaDevices', {
      writable: true,
      configurable: true,
      value: originalMediaDevices,
    })
  })

  describe('cleanSpokenText', () => {
    it('strips urls, markdown symbols and collapses whitespace for clear speech', () => {
      expect(cleanSpokenText('Hello! **Great** job on https://example.com #focus.')).toBe(
        'Hello! Great job on focus.',
      )
    })
  })

  describe('isSynthesisSupported and isRecognitionSupported', () => {
    it('detects when synthesis and recognition are available', () => {
      expect(isSynthesisSupported()).toBe(true)
      expect(isRecognitionSupported()).toBe(true)
    })

    it('returns false when window lacks the APIs', () => {
      Object.defineProperty(window, 'speechSynthesis', { value: undefined, configurable: true, writable: true })
      delete (window as unknown as Record<string, unknown>).SpeechRecognition
      delete (window as unknown as Record<string, unknown>).webkitSpeechRecognition

      expect(isSynthesisSupported()).toBe(false)
      expect(isRecognitionSupported()).toBe(false)
    })
  })

  describe('requestMicPermission', () => {
    it('triggers mediaDevices.getUserMedia to prompt browser permission and stops tracks', async () => {
      const stopTrack = vi.fn()
      const mockGetUserMedia = vi.fn(async () => ({
        getTracks: () => [{ stop: stopTrack }],
      }))

      Object.defineProperty(navigator, 'mediaDevices', {
        writable: true,
        configurable: true,
        value: { getUserMedia: mockGetUserMedia },
      })

      const res = await requestMicPermission()
      expect(res.ok).toBe(true)
      expect(mockGetUserMedia).toHaveBeenCalledWith({ audio: true })
      expect(stopTrack).toHaveBeenCalled()
    })

    it('returns clear instructions when permission is denied', async () => {
      const mockGetUserMedia = vi.fn(async () => {
        const err = new Error('Permission denied')
        err.name = 'NotAllowedError'
        throw err
      })

      Object.defineProperty(navigator, 'mediaDevices', {
        writable: true,
        configurable: true,
        value: { getUserMedia: mockGetUserMedia },
      })

      const res = await requestMicPermission()
      expect(res.ok).toBe(false)
      expect(res.error).toMatch(/address bar/i)
    })
  })

  describe('speakLoti', () => {
    it('cancels existing speech and invokes synthesis with calibrated pace', () => {
      const onStart = vi.fn()
      const onEnd = vi.fn()

      const stop = speakLoti('Welcome back to your practice', {
        rate: 0.95,
        onStart,
        onEnd,
      })

      expect(mockCancel).toHaveBeenCalled()
      expect(mockSpeak).toHaveBeenCalledTimes(1)
      expect(onStart).toHaveBeenCalled()

      stop()
      expect(mockCancel).toHaveBeenCalledTimes(2)
    })

    it('stopLotiSpeech cancels speech synthesis directly', () => {
      stopLotiSpeech()
      expect(mockCancel).toHaveBeenCalled()
    })
  })

  describe('startListening', () => {
    it('starts SpeechRecognition and delivers transcribed results', () => {
      const onResult = vi.fn()
      const onEnd = vi.fn()

      const recognizer = startListening({ onResult, onEnd })
      expect(recognizer).not.toBeNull()

      // Simulate a speech result event
      const mockInstance = (recognizer as unknown as { instance: MockSpeechRecognition }).instance
      mockInstance.onresult?.({
        results: [
          [{ transcript: 'How can I improve focus?' }],
        ],
      })

      expect(onResult).toHaveBeenCalledWith('How can I improve focus?', false)

      recognizer?.stop()
      expect(mockInstance.stop).toHaveBeenCalled()
      expect(onEnd).toHaveBeenCalled()
    })

    it('notifies error callback when microphone or recognition encounters error', () => {
      const onError = vi.fn()
      const recognizer = startListening({ onResult: vi.fn(), onError })

      const mockInstance = (recognizer as unknown as { instance: MockSpeechRecognition }).instance
      mockInstance.onerror?.({ error: 'not-allowed' })

      expect(onError).toHaveBeenCalledWith('Microphone access was denied. Click the lock icon in your browser address bar to allow microphone access.')
    })
  })

  describe('useVoiceCoach hook', () => {
    it('allows toggling voice and controlling speech playback and mic input', async () => {
      const { result } = renderHook(() => useVoiceCoach())

      expect(result.current.isListening).toBe(false)
      expect(result.current.isSpeaking).toBe(false)

      act(() => {
        result.current.speak('You did great on the n-back task.')
      })

      expect(mockSpeak).toHaveBeenCalled()
      expect(result.current.isSpeaking).toBe(true)

      act(() => {
        result.current.stop()
      })
      expect(mockCancel).toHaveBeenCalled()
      expect(result.current.isSpeaking).toBe(false)

      await act(async () => {
        result.current.listen()
      })
      expect(result.current.isListening).toBe(true)
    })
  })
})
