import { PILLAR_IDS, PILLAR_LABELS, isPillarId } from '../insights/pillars'
import type { LotiAction, LotiBrain, LotiContext, LotiMessage } from './types'

/* Loti's scripted brain: the five examples from docs/Loti interface.docx, deterministic.
   Voice: warm, short, specific. No hype words, no brain regions, no chemical claims (U5). */

export const MAX_MESSAGE_CHARS = 120
/** Rule 4: about 12 words per line of UI text; the script tests hold every bubble to 14. */
export const MAX_MESSAGE_WORDS = 14

/** Four sessions a week is the "optimal" plan in the pillar model (ticket 04). */
export const WEEKLY_TARGET = 4

const GOAL_SIZES = [
  { id: '5', label: 'A little (+5)' },
  { id: '10', label: 'Steady (+10)' },
  { id: '15', label: 'A lot (+15)' },
] as const

const train = (ctx: LotiContext): LotiAction =>
  ctx.weakestPillar ? { kind: 'train', pillar: ctx.weakestPillar } : { kind: 'train' }

const reply = (nodeId: string): LotiAction => ({ kind: 'reply', nodeId })

/** Builds the bubble for a node id. Parametrised ids: goal-size:<pillar>, goal-set:<pillar>:<n>. */
function node(id: string, ctx: LotiContext): LotiMessage | null {
  const [head, arg, arg2] = id.split(':')
  switch (head) {
    case 'goals':
      return {
        id,
        pose: 'happy',
        text: "New year, fresh page! Let's talk about our goals for this year.",
        choices: [{ id: 'start', label: "Let's do it", action: reply('goal-pick') }],
      }
    case 'goal-pick':
      return {
        id,
        text: 'Which skill would you like to grow this year?',
        choices: PILLAR_IDS.map((p) => ({ id: p, label: PILLAR_LABELS[p], action: reply(`goal-size:${p}`) })),
      }
    case 'goal-size': {
      if (!isPillarId(arg)) return null
      return {
        id,
        pose: 'think',
        text: `How much do you want to grow ${PILLAR_LABELS[arg]} this year?`,
        choices: GOAL_SIZES.map((s) => ({
          id: s.id,
          label: s.label,
          action: { kind: 'setGoal', pillar: arg, target: Number(s.id) },
        })),
      }
    }
    case 'goal-set': {
      if (!isPillarId(arg) || !arg2) return null
      return {
        id,
        pose: 'happy',
        text: `Goal saved: ${PILLAR_LABELS[arg]}, up ${arg2} points this year. Another one?`,
        choices: [
          { id: 'another', label: 'Add another', action: reply('goal-pick') },
          { id: 'done', label: "That's all" },
        ],
      }
    }
    case 'weakest': {
      if (!ctx.weakestPillar) return null
      return {
        id,
        pose: 'think',
        text: `It seems ${PILLAR_LABELS[ctx.weakestPillar]} could use some care. Want to improve it?`,
        choices: [{ id: 'yes', label: "Yes, let's train", action: train(ctx) }],
      }
    }
    case 'day':
      return {
        id,
        text: 'How was your day?',
        choices: [
          { id: 'great', label: 'Great', action: reply('day-great') },
          { id: 'okay', label: 'Okay', action: reply('day-okay') },
          { id: 'tough', label: 'Tough', action: reply('day-tough') },
        ],
      }
    case 'day-great':
      return {
        id,
        pose: 'happy',
        text: 'Good to hear! Want to put some time into training?',
        choices: [{ id: 'yes', label: "Yes, let's train", action: train(ctx) }],
      }
    case 'day-okay':
      return {
        id,
        text: 'Thanks for telling me. A short session can help. Try one?',
        choices: [{ id: 'yes', label: "Yes, let's try one", action: train(ctx) }],
      }
    case 'day-tough':
      return { id, text: "Sorry it was tough. Rest counts too. I'm here when you're ready.", choices: [] }
    case 'weekend':
      return {
        id,
        pose: 'wave',
        text: 'Weekend night! How about we work on our goals?',
        choices: [{ id: 'yes', label: "Yes, let's go", action: train(ctx) }],
      }
    case 'sunshine':
      return {
        id,
        pose: 'happy',
        text: 'Good morning, sunshine! Time for a quick session?',
        choices: [{ id: 'yes', label: 'Sure', action: train(ctx) }],
      }
    default:
      return null
  }
}

function openingId(ctx: LotiContext): string {
  const month = ctx.now.getMonth()
  const day = ctx.now.getDay()
  const hour = ctx.now.getHours()
  // "Start of every year": the goals talk opens in January until a goal is set.
  if (month === 0 && !ctx.hasGoalsThisYear) return 'goals'
  // Emotion aware: a tired or frustrated user is asked about the day, never pushed to train.
  if (ctx.mood === 'tired' || ctx.mood === 'frustrated') return 'day'
  // Friday or Saturday from 18:00, and only while the week's plan still has room.
  if ((day === 5 || day === 6) && hour >= 18 && ctx.sessionsThisWeek < WEEKLY_TARGET) return 'weekend'
  if (ctx.weakestPillar) return 'weakest'
  if (hour >= 5 && hour < 12) return 'sunshine'
  return 'day'
}

export const scriptedBrain: LotiBrain = {
  opening: (ctx) => node(openingId(ctx), ctx),
  respond: (nodeId, choiceId, ctx) => {
    const action = node(nodeId, ctx)?.choices.find((c) => c.id === choiceId)?.action
    if (action?.kind === 'reply') return node(action.nodeId, ctx)
    if (action?.kind === 'setGoal') return node(`goal-set:${action.pillar}:${action.target}`, ctx)
    // Train and navigate leave the chat; a choice with no action closes it.
    return null
  },
}
