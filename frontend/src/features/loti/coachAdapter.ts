import { scriptedBrain } from './scriptedBrain'
import type { LotiBrain } from './types'

/* Adapter stub for Member 2's coach (Gemini). It makes NO network calls yet: every answer comes
   from the scripted brain, so swapping it in changes nothing the user sees.

   Memory rule from docs/Loti interface.docx and the coach design: the coach is "only fed what the
   user read". When this adapter talks to the coach, the transcript it sends holds only the bubbles
   that were actually shown on screen and the choices the user actually clicked. Never send
   bubbles that were skipped, dismissed before they rendered, or generated but not displayed, and
   never send raw telemetry or scores the user has not seen.

   ponytail: pure delegation. The ceiling is a real transport here (async opening/respond with a
   timeout that falls back to scriptedBrain); LotiBrain would then need to become async. */
export function createCoachBrain(fallback: LotiBrain = scriptedBrain): LotiBrain {
  return {
    opening: (ctx) => fallback.opening(ctx),
    respond: (nodeId, choiceId, ctx) => fallback.respond(nodeId, choiceId, ctx),
  }
}

export const coachBrain = createCoachBrain()
