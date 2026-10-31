import { scriptedBrain } from './scriptedBrain'
import type { LotiBrain, LotiContext, LotiMessage } from './types'

/* Adapter for Member 2's coach (Gemini). There is NO transport yet: the chips always come from the
   scripted brain, and with the LLM path off (the default) nothing changes for the user.

   Memory rule from docs/Loti interface.docx and the coach design: the coach is "only fed what the
   user read". When a transport exists, the transcript it sends holds only the bubbles that were
   actually shown on screen and the choices the user actually clicked (lotiSession keeps exactly
   that). Never send bubbles that were skipped, dismissed before they rendered, or generated but not
   displayed, and never send raw telemetry or scores the user has not seen.

   Crisis seam: every piece of free text from the user goes through `crisisGate` BEFORE any
   transport, whether the LLM path is on or off. A hit answers with CRISIS_MESSAGE and the text
   never leaves the device. The full crisis design comes later (research backlog); the keyword
   gate below is only a deterministic placeholder. */

export type CrisisResult = { crisis: false } | { crisis: true; message: LotiMessage }
export type CrisisGate = (text: string) => CrisisResult
/** The future LLM call. ponytail: sync for now; a real one makes `ask` async with a timeout. */
export type CoachTransport = (text: string, ctx: LotiContext) => LotiMessage | null

/** One calm, plain line: emergency help and a crisis line, named as such. No choices. */
export const CRISIS_MESSAGE: LotiMessage = {
  id: 'crisis',
  pose: 'idle',
  text: "I'm really glad you told me. Please call your local emergency number now, or a suicide and crisis line.",
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

export interface CoachBrain extends LotiBrain {
  /** True only when the LLM path is switched on (VITE_LOTI_COACH=on). */
  readonly enabled: boolean
  /** Free text from the user. The crisis gate runs first; then the transport, only when enabled. */
  ask(text: string, ctx: LotiContext): LotiMessage | null
}

export interface CoachBrainOptions {
  enabled: boolean
  crisisGate: CrisisGate
  transport?: CoachTransport
  fallback?: LotiBrain
}

export function createCoachBrain({ enabled, crisisGate, transport, fallback = scriptedBrain }: CoachBrainOptions): CoachBrain {
  return {
    enabled,
    opening: (ctx) => fallback.opening(ctx),
    respond: (nodeId, choiceId, ctx) => fallback.respond(nodeId, choiceId, ctx),
    ask: (text, ctx) => {
      const gate = crisisGate(text)
      if (gate.crisis) return gate.message
      return enabled && transport ? transport(text, ctx) : null
    },
  }
}

/** Off unless the build sets VITE_LOTI_COACH=on. */
export const COACH_ENABLED = import.meta.env.VITE_LOTI_COACH === 'on'

export const coachBrain = createCoachBrain({ enabled: COACH_ENABLED, crisisGate: keywordCrisisGate })
