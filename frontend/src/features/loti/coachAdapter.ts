import { tracker } from '../assessment/telemetry/tracker'
import { getUserId } from '../assessment/tasks/taskSource'
import { scriptedBrain } from './scriptedBrain'
import type { LotiBrain, LotiContext, LotiMessage } from './types'

/* Adapter for Member 2's coach (Gemini). Handles HTTP transport to POST /v1/coach/chat.
   When the LLM path is off or fetch fails, falls back gracefully.

   Memory rule from docs/Loti interface.docx and the coach design: the coach is "only fed what the
   user read". The transcript it sends holds only the bubbles that were actually shown on screen
   and the choices the user actually clicked (lotiSession keeps exactly that). Never send bubbles
   that were skipped, dismissed before they rendered, or generated but not displayed, and never
   send raw telemetry or scores the user has not seen.

   Crisis seam: every piece of free text from the user goes through `crisisGate` BEFORE any
   transport, whether the LLM path is on or off. A hit answers with CRISIS_MESSAGE and the text
   never leaves the device. */

export type CrisisResult = { crisis: false } | { crisis: true; message: LotiMessage }
export type CrisisGate = (text: string) => CrisisResult

/** What the coach may be told: an allow-list of Loti's context. The mood guess never leaves the
    device (ADR 0002), so it is not on the list, and neither is any field added to LotiContext later
    until someone adds it here on purpose. */
export type CoachContext = Pick<LotiContext, 'now' | 'weakestPillar' | 'hasGoalsThisYear' | 'sessionsThisWeek'>

export type ShownTurnContext = { from: 'loti' | 'you'; text: string }

export type CoachTransport = (
  text: string,
  ctx: CoachContext,
  transcript?: ShownTurnContext[],
) => Promise<LotiMessage | null> | LotiMessage | null

/** Loti's context as the coach may see it: the allow-listed fields only. */
export function coachContext(ctx: LotiContext): CoachContext {
  const out: CoachContext = { now: ctx.now, hasGoalsThisYear: ctx.hasGoalsThisYear, sessionsThisWeek: ctx.sessionsThisWeek }
  if (ctx.weakestPillar) out.weakestPillar = ctx.weakestPillar
  return out
}

/** One calm, plain line: emergency help and a crisis line, named as such. No choices. */
export const CRISIS_MESSAGE: LotiMessage = {
  id: 'crisis',
  pose: 'idle',
  text: "I'm really glad you told me. Please call your local emergency number now, or a suicide and crisis line.",
  choices: [],
}

/** Fallback offline line when network transport is unavailable or fails. */
export const FALLBACK_MESSAGE: LotiMessage = {
  id: 'offline-reply',
  pose: 'talk',
  text: "I'm here to reflect on how you practice and train. What would you like to explore next?",
  choices: [],
}

/** ponytail: a placeholder keyword list, not a classifier. It errs on the side of answering. */
const CRISIS_PATTERNS: readonly RegExp[] = [
  /\bsuicid(?:e|al)\b/,
  /\bself[\s-]?harm/,
  /\b(?:kill|hurt|harm)\s+myself\b/,
  /\bend\s+(?:my\s+(?:own\s+)?life|it\s+all)\b/,
  /\bwant\s+to\s+die\b/,
  /\bcan(?:'t|t|not|\s+not)\s+go\s+on\b/,
]

export const keywordCrisisGate: CrisisGate = (text) => {
  const t = text.toLowerCase().replace(/[‘’]/g, "'")
  return CRISIS_PATTERNS.some((p) => p.test(t)) ? { crisis: true, message: CRISIS_MESSAGE } : { crisis: false }
}

/** Real HTTP transport to POST /v1/coach/chat. */
export async function httpCoachTransport(
  text: string,
  _ctx: CoachContext,
  transcript: ShownTurnContext[] = [],
  fetchFn: typeof fetch = (url, init) => fetch(url, init),
): Promise<LotiMessage | null> {
  try {
    const res = await fetchFn('/v1/coach/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        user_id: getUserId(),
        message: text,
        kind: 'typed',
        transcript: transcript.map((t) => ({ from: t.from, text: t.text })).slice(-10),
      }),
    })
    if (!res.ok) return null
    const data = (await res.json()) as { message?: { id?: string; text?: string; choices?: unknown[]; pose?: string } }
    if (data?.message && typeof data.message.text === 'string') {
      return {
        id: data.message.id || 'coach',
        pose: (data.message.pose as any) || 'talk',
        text: data.message.text,
        choices: Array.isArray(data.message.choices) ? (data.message.choices as any) : [],
      }
    }
    return null
  } catch {
    return null
  }
}

export interface CoachBrain extends LotiBrain {
  /** True only when the LLM path is switched on (VITE_LOTI_COACH=on). */
  readonly enabled: boolean
  /** Free text from the user. The crisis gate runs first; then the transport, only when enabled. */
  ask(
    text: string,
    ctx: LotiContext,
    transcript?: ShownTurnContext[],
  ): Promise<LotiMessage | null> | LotiMessage | null
}

export interface CoachBrainOptions {
  enabled: boolean
  crisisGate: CrisisGate
  transport?: CoachTransport
  fallback?: LotiBrain
  /** The user's "Let Loti use AI to reply" choice (consent purpose 2). Without it, no transport. */
  consented?: () => boolean
}

export function createCoachBrain({
  enabled,
  crisisGate,
  transport,
  fallback = scriptedBrain,
  consented = () => false,
}: CoachBrainOptions): CoachBrain {
  return {
    enabled,
    opening: (ctx) => fallback.opening(ctx),
    respond: (nodeId, choiceId, ctx) => fallback.respond(nodeId, choiceId, ctx),
    ask: (text, ctx, transcript) => {
      const gate = crisisGate(text)
      if (gate.crisis) return gate.message
      if (!enabled || !transport || !consented()) return null
      return transcript !== undefined
        ? transport(text, coachContext(ctx), transcript)
        : transport(text, coachContext(ctx))
    },
  }
}

/** Off unless the build sets VITE_LOTI_COACH=on. */
export const COACH_ENABLED = import.meta.env.VITE_LOTI_COACH === 'on'

export const coachBrain = createCoachBrain({
  enabled: COACH_ENABLED,
  crisisGate: keywordCrisisGate,
  transport: httpCoachTransport,
  consented: () => tracker.getStatus().coachConsent === 'granted',
})
