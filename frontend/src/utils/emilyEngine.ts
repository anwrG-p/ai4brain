/**
 * EMILY (Emotion & Micro-Interaction Listener for You)
 * 
 * 100% Client-Side Behavioral Emotion Engine grounded in James Russell's
 * Circumplex Model of Affect (Valence x Arousal).
 * 
 * Complies with EU AI Act Article 5(1)(f) zero-biometric rules by analyzing
 * passive DOM pointer kinematics and interaction rhythm without webcams or mics.
 */

import {
  EMILY_EMOTION_CONFIGS,
  type EmilyEmotion,
  type EmilyEmotionConfig,
} from '../styles/emilyTokens'

export {
  EMILY_EMOTION_CONFIGS,
  type EmilyEmotion,
  type EmilyEmotionConfig,
}

export type EmilyInteractionType =
  | 'pointermove'
  | 'mousedown'
  | 'mouseup'
  | 'click'
  | 'keydown'
  | 'wheel'

export interface EmilyInteractionEvent {
  type: EmilyInteractionType
  x: number
  y: number
  timestamp: number
  targetTag?: string
  isInteractive?: boolean
}

export interface EmilyMetrics {
  cursorVelocity: number // px/ms
  cursorJerk: number // acceleration derivative / tremor proxy
  pathDirectness: number // R_path = Euclidean / Actual length in (0, 1]
  curvature: number // kappa = 1 / R_path
  clickDwellMs: number // mouseup - mousedown duration
  isRapidTap: boolean // < 35ms
  isHeavyPress: boolean // > 450ms
  clickBurstCount: number // >= 3 clicks in <400ms inside 30px
  rageClicksCount: number
  hoverHesitationCount: number
  idleHoverMs: number
  directionFlips: number // sign inversions in dx, dy
  maxIdleGapMs: number // maximum gap between events
  idleFatigueRatio: number // ratio of idle time
  sampleCount: number
  bufferDurationMs: number
}

export const INITIAL_EMILY_METRICS: EmilyMetrics = {
  cursorVelocity: 0.35,
  cursorJerk: 0.05,
  pathDirectness: 0.85,
  curvature: 1.18,
  clickDwellMs: 95,
  isRapidTap: false,
  isHeavyPress: false,
  clickBurstCount: 0,
  rageClicksCount: 0,
  hoverHesitationCount: 0,
  idleHoverMs: 0,
  directionFlips: 0,
  maxIdleGapMs: 0,
  idleFatigueRatio: 0,
  sampleCount: 0,
  bufferDurationMs: 0,
}

/**
 * Computes 7 Kinematic & Interaction Metrics over rolling buffer events.
 */
export function computeEmilyMetrics(
  events: readonly EmilyInteractionEvent[],
  maxBufferAgeMs = 15000,
): EmilyMetrics {
  if (!events || events.length === 0) {
    return { ...INITIAL_EMILY_METRICS }
  }

  const latestTime = events[events.length - 1]?.timestamp ?? Date.now()
  const cutoffTime = latestTime - maxBufferAgeMs
  const buffer = events.filter((e) => e.timestamp >= cutoffTime)

  if (buffer.length === 0) {
    return { ...INITIAL_EMILY_METRICS }
  }

  const firstEvent = buffer[0]!
  const lastEvent = buffer[buffer.length - 1]!
  const bufferDurationMs = Math.max(lastEvent.timestamp - firstEvent.timestamp, 1)

  // 1. Cursor Kinematics (pointermove)
  const pointerEvents = buffer.filter((e) => e.type === 'pointermove')
  let totalDistance = 0
  let totalMoveTime = 0
  let directionFlips = 0
  let lastDx = 0
  let lastDy = 0

  const velocities: number[] = []
  const accelerations: number[] = []
  const jerks: number[] = []

  for (let i = 1; i < pointerEvents.length; i++) {
    const pPrev = pointerEvents[i - 1]!
    const pCurr = pointerEvents[i]!
    const dx = pCurr.x - pPrev.x
    const dy = pCurr.y - pPrev.y
    const dt = Math.max(pCurr.timestamp - pPrev.timestamp, 1)

    const dist = Math.hypot(dx, dy)
    totalDistance += dist
    totalMoveTime += dt

    const v = dist / dt // px/ms
    velocities.push(v)

    if (velocities.length > 1) {
      const vPrev = velocities[velocities.length - 2]!
      const a = (v - vPrev) / dt
      accelerations.push(a)

      if (accelerations.length > 1) {
        const aPrev = accelerations[accelerations.length - 2]!
        const j = Math.abs((a - aPrev) / dt)
        jerks.push(j)
      }
    }

    // Direction flip tracking
    if (Math.abs(dx) > 4 && Math.abs(lastDx) > 4 && Math.sign(dx) !== Math.sign(lastDx)) {
      directionFlips++
    }
    if (Math.abs(dy) > 4 && Math.abs(lastDy) > 4 && Math.sign(dy) !== Math.sign(lastDy)) {
      directionFlips++
    }
    if (Math.abs(dx) > 4) lastDx = dx
    if (Math.abs(dy) > 4) lastDy = dy
  }

  const cursorVelocity =
    totalMoveTime > 0 ? totalDistance / totalMoveTime : 0

  // Path Directness R_path = Euclidean / Actual length
  let pathDirectness = 1.0
  if (pointerEvents.length >= 2 && totalDistance > 0) {
    const firstP = pointerEvents[0]!
    const lastP = pointerEvents[pointerEvents.length - 1]!
    const euclideanDist = Math.hypot(lastP.x - firstP.x, lastP.y - firstP.y)
    pathDirectness = Math.min(1.0, Math.max(0.01, euclideanDist / totalDistance))
  }
  const curvature = 1 / Math.max(pathDirectness, 0.01)

  // Normalized Jerk Spikes
  const avgJerk =
    jerks.length > 0
      ? jerks.reduce((acc, val) => acc + val, 0) / jerks.length
      : 0
  const cursorJerk = Math.min(1.5, Math.max(0, avgJerk * 100))

  // 2. Click Dwell & Rage Clicks
  const mousedownEvents = buffer.filter((e) => e.type === 'mousedown')
  const mouseupEvents = buffer.filter((e) => e.type === 'mouseup')
  let totalDwell = 0
  let dwellPairs = 0

  for (const down of mousedownEvents) {
    const matchingUp = mouseupEvents.find(
      (up) => up.timestamp >= down.timestamp && up.timestamp - down.timestamp < 3000,
    )
    if (matchingUp) {
      totalDwell += matchingUp.timestamp - down.timestamp
      dwellPairs++
    }
  }

  const clickDwellMs = dwellPairs > 0 ? Math.round(totalDwell / dwellPairs) : 95
  const isRapidTap = clickDwellMs < 35
  const isHeavyPress = clickDwellMs > 450

  // Rage Clicks (>= 3 clicks within <400ms inside 30px radius)
  const clickEvents = buffer.filter((e) => e.type === 'click')
  let rageBurstCount = 0

  for (let i = 0; i < clickEvents.length; i++) {
    const c1 = clickEvents[i]!
    let clusterCount = 1
    for (let j = i + 1; j < clickEvents.length; j++) {
      const c2 = clickEvents[j]!
      const timeDiff = c2.timestamp - c1.timestamp
      if (timeDiff >= 400) break
      const dist = Math.hypot(c2.x - c1.x, c2.y - c1.y)
      if (dist <= 30) {
        clusterCount++
      }
    }
    if (clusterCount >= 3) {
      rageBurstCount++
      break // Count unique bursts
    }
  }

  // 3. Idle gaps & Fatigue
  let maxIdleGapMs = 0
  let totalIdleMs = 0

  for (let i = 1; i < buffer.length; i++) {
    const gap = buffer[i]!.timestamp - buffer[i - 1]!.timestamp
    if (gap > maxIdleGapMs) {
      maxIdleGapMs = gap
    }
    if (gap > 2000) {
      totalIdleMs += gap
    }
  }

  // Account for active trailing pause since last event
  const trailingIdleMs = latestTime - lastEvent.timestamp
  if (trailingIdleMs > maxIdleGapMs) {
    maxIdleGapMs = trailingIdleMs
  }
  if (trailingIdleMs > 2000) {
    totalIdleMs += trailingIdleMs
  }

  const idleFatigueRatio = Math.min(1.0, totalIdleMs / bufferDurationMs)

  // 4. Hover Hesitation
  let idleHoverMs = 0
  let hoverHesitationCount = 0
  if (pointerEvents.length >= 2) {
    for (let i = 1; i < pointerEvents.length; i++) {
      const pPrev = pointerEvents[i - 1]!
      const pCurr = pointerEvents[i]!
      const gap = pCurr.timestamp - pPrev.timestamp
      const dist = Math.hypot(pCurr.x - pPrev.x, pCurr.y - pPrev.y)
      if (dist < 10 && gap > 1500) {
        idleHoverMs += gap
        if (gap > 2000) {
          hoverHesitationCount++
        }
      }
    }
  }

  return {
    cursorVelocity: Math.round(cursorVelocity * 1000) / 1000,
    cursorJerk: Math.round(cursorJerk * 100) / 100,
    pathDirectness: Math.round(pathDirectness * 100) / 100,
    curvature: Math.round(curvature * 100) / 100,
    clickDwellMs,
    isRapidTap,
    isHeavyPress,
    clickBurstCount: rageBurstCount,
    rageClicksCount: rageBurstCount,
    hoverHesitationCount,
    idleHoverMs,
    directionFlips,
    maxIdleGapMs,
    idleFatigueRatio: Math.round(idleFatigueRatio * 100) / 100,
    sampleCount: buffer.length,
    bufferDurationMs,
  }
}

/**
 * Classifies computed kinematic & interaction metrics into one of 5 canonical states.
 */
export function classifyEmilyEmotion(
  metrics: EmilyMetrics,
  options?: { consecutiveErrors?: number },
): EmilyEmotion {
  // 1. Frustrated (Gentle De-Escalation)
  if (
    metrics.clickBurstCount >= 1 ||
    metrics.cursorJerk > 0.8 ||
    metrics.isHeavyPress ||
    (options?.consecutiveErrors !== undefined && options.consecutiveErrors >= 2)
  ) {
    return 'frustrated'
  }

  // 2. Fatigued (Restorative Wind-Down)
  if (
    (metrics.cursorVelocity < 0.15 && metrics.maxIdleGapMs >= 6000) ||
    metrics.idleFatigueRatio > 0.65
  ) {
    return 'fatigued'
  }

  // 3. Hesitant (Reassuring Guidance / Confused)
  if (
    metrics.pathDirectness < 0.48 ||
    metrics.curvature > 2.1 ||
    metrics.directionFlips >= 3 ||
    metrics.idleHoverMs > 2200
  ) {
    return 'hesitant'
  }

  // 4. Energized (Curious / Confident Spark)
  if (metrics.pathDirectness >= 0.82 && metrics.cursorVelocity > 0.6) {
    return 'energized'
  }

  // 5. Default: Calm Flow
  return 'calm_flow'
}

/**
 * Returns a human-friendly plain-English description of current pointer rhythm.
 */
export function getKinematicsSummary(metrics: {
  cursorVelocity: number
  cursorJerk: number
  pathDirectness: number
  curvature: number
  clickBurstCount: number
}): string {
  if (metrics.clickBurstCount > 0 || metrics.cursorJerk > 0.8) {
    return 'Pointer Rhythm: Elevated acceleration spikes and rapid click clusters.'
  }
  if (metrics.pathDirectness < 0.48 || metrics.curvature > 2.0) {
    return `Pointer Rhythm: Wandering arcs (directness ${(metrics.pathDirectness * 100).toFixed(0)}%) with searching pauses.`
  }
  if (metrics.cursorVelocity > 0.6 && metrics.pathDirectness >= 0.8) {
    return `Pointer Rhythm: Brisk velocity (${metrics.cursorVelocity.toFixed(2)} px/ms) with direct decisive paths.`
  }
  if (metrics.cursorVelocity < 0.15) {
    return `Pointer Rhythm: Gentle velocity (${metrics.cursorVelocity.toFixed(2)} px/ms) with extended rest intervals.`
  }
  return `Pointer Rhythm: Smooth arcs, steady velocity (${metrics.cursorVelocity.toFixed(2)} px/ms).`
}

/**
 * Options for passive listener initialization
 */
export interface EmilyListenerOptions {
  sampleIntervalMs?: number // Throttling interval (~50ms)
  evalIntervalMs?: number // Evaluation interval (default 3000ms)
  maxBufferAgeMs?: number // Rolling window (default 15000ms)
}

/**
 * Starts a passive DOM telemetry listener throttled with requestAnimationFrame.
 * Returns an unbind cleanup function.
 */
export function startEmilyListener(
  onEvaluation: (metrics: EmilyMetrics, emotion: EmilyEmotion, buffer?: readonly EmilyInteractionEvent[]) => void,
  options: EmilyListenerOptions = {},
): () => void {
  if (typeof window === 'undefined') {
    return () => {}
  }

  const {
    sampleIntervalMs = 50,
    evalIntervalMs = 3000,
    maxBufferAgeMs = 15000,
  } = options

  const buffer: EmilyInteractionEvent[] = []
  let lastSampleTime = 0
  let animationFrameId: number | null = null

  const recordEvent = (type: EmilyInteractionType, e: MouseEvent | PointerEvent | KeyboardEvent | WheelEvent) => {
    const now = Date.now()
    const x = 'clientX' in e ? e.clientX : 0
    const y = 'clientY' in e ? e.clientY : 0

    buffer.push({
      type,
      x,
      y,
      timestamp: now,
      targetTag: (e.target as HTMLElement)?.tagName?.toLowerCase(),
      isInteractive: (e.target as HTMLElement)?.closest('button, a, input, [role="button"]') !== null,
    })

    // Prune events older than rolling buffer
    const cutoff = now - maxBufferAgeMs
    while (buffer.length > 0 && buffer[0]!.timestamp < cutoff) {
      buffer.shift()
    }
  }

  // Throttled pointermove
  const handlePointerMove = (e: PointerEvent) => {
    const now = Date.now()
    if (now - lastSampleTime < sampleIntervalMs) return
    lastSampleTime = now

    if (animationFrameId !== null) {
      cancelAnimationFrame(animationFrameId)
    }

    animationFrameId = requestAnimationFrame(() => {
      recordEvent('pointermove', e)
      animationFrameId = null
    })
  }

  const handleMouseDown = (e: MouseEvent) => recordEvent('mousedown', e)
  const handleMouseUp = (e: MouseEvent) => recordEvent('mouseup', e)
  const handleClick = (e: MouseEvent) => recordEvent('click', e)
  const handleKeyDown = (e: KeyboardEvent) => recordEvent('keydown', e)
  const handleWheel = (e: WheelEvent) => recordEvent('wheel', e)

  window.addEventListener('pointermove', handlePointerMove, { passive: true })
  window.addEventListener('mousedown', handleMouseDown, { passive: true })
  window.addEventListener('mouseup', handleMouseUp, { passive: true })
  window.addEventListener('click', handleClick, { passive: true })
  window.addEventListener('keydown', handleKeyDown, { passive: true })
  window.addEventListener('wheel', handleWheel, { passive: true })

  // Periodic Affective Evaluation
  const evalTimer = setInterval(() => {
    if (buffer.length === 0) return
    const metrics = computeEmilyMetrics(buffer, maxBufferAgeMs)
    const emotion = classifyEmilyEmotion(metrics)
    onEvaluation(metrics, emotion, [...buffer])
  }, evalIntervalMs)

  return () => {
    window.removeEventListener('pointermove', handlePointerMove)
    window.removeEventListener('mousedown', handleMouseDown)
    window.removeEventListener('mouseup', handleMouseUp)
    window.removeEventListener('click', handleClick)
    window.removeEventListener('keydown', handleKeyDown)
    window.removeEventListener('wheel', handleWheel)
    if (animationFrameId !== null) {
      cancelAnimationFrame(animationFrameId)
    }
    clearInterval(evalTimer)
  }
}
