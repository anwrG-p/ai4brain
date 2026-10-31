import type { LotiPose, MomoMood } from '../../components/features/characters'
import type { TaskSchemaType } from '../../types'
import type { PillarId } from '../insights/pillars'

export type { LotiPose }
export type Mood = MomoMood

export type LotiAction =
  | { kind: 'train'; pillar?: PillarId; schemaType?: TaskSchemaType }
  | { kind: 'navigate'; to: string }
  | { kind: 'setGoal'; pillar: PillarId; target: number }
  | { kind: 'reply'; nodeId: string }

export type LotiChoice = { id: string; label: string; action?: LotiAction }

/** One bubble. No choices means a closing line: the UI offers "Okay" to end the talk. */
export type LotiMessage = { id: string; text: string; choices: LotiChoice[]; pose?: LotiPose }

export type LotiContext = {
  now: Date
  weakestPillar?: PillarId
  mood?: Mood
  hasGoalsThisYear: boolean
  sessionsThisWeek: number
}

export interface LotiBrain {
  /** The first bubble for this context, or null when Loti has nothing to say. */
  opening(ctx: LotiContext): LotiMessage | null
  /** The bubble after the user picks `choiceId` on bubble `nodeId`; null ends the talk. */
  respond(nodeId: string, choiceId: string, ctx: LotiContext): LotiMessage | null
}
