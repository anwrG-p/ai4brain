import type { PillarId } from '../insights/pillars'
import type { NBackParams, SchemaType, StroopParams, TaskPayload } from './telemetry/types'

/* "How to play" for each exercise's instruction screen (INT-1 item 13; user: "add some explanation to
   the games", and keep it short). All the copy lives here, so it is easy to edit.

   - steps: 2-3 numbered steps, at most 8 words each. [X] renders X as a keycap (<kbd>); a range is
     written [1]–[4]. Each step that answers names the tap and the key, and matches the exercise's
     code in tasks/*.tsx (keys, what counts as correct).
   - caption: at most 6 words, under the animated demo (ExerciseDemo.tsx); it describes that picture.
   - pillar: the skill it trains, as the Train page groups it (features/train/catalog.ts).
   - more: at most 2 short lines behind "More about this": what it measures, and what changes the
     difficulty. Consumer words only (spec U5): no brain areas, no "improves your..." claims.

   Words are counted without the brackets; a lone "→" or "–" is not a word (howToPlay.test.ts). */

export type HowToPlay = { steps: string[]; caption: string; pillar: PillarId; more: string[] }

const range = (n: number) => (n > 1 ? `[1]–[${n}]` : '[1]')

export function howToPlay(task: TaskPayload): HowToPlay | null {
  const p = task.params
  switch (task.schema_type as SchemaType) {
    case 'n_back': {
      // NBack.tsx (R16): only the stream of the rule shown above the grid counts. Its key (A = place,
      // L = symbol) is right exactly on a match n back; a match on the other stream is a lure, so
      // any other press is wrong. With one stream there is only its rule.
      const { n, streams } = p as NBackParams
      const both = streams.includes('position') && streams.includes('symbol')
      return {
        steps: both
          ? [`Place rule: same place ${n} back? Tap [A].`, `Symbol rule: same symbol ${n} back? Tap [L].`, 'Anything else? Do nothing.']
          : [
              ...(streams.includes('position') ? [`Place matches ${n} back? Tap or press [A].`] : []),
              ...(streams.includes('symbol') ? [`Symbol matches ${n} back? Tap or press [L].`] : []),
              'No match? Do nothing.',
            ],
        caption: `Same place and symbol, ${n} back`, // ExerciseDemo draws a match n back
        pillar: 'agility',
        more: ['It measures how much you hold in mind.', 'Sometimes the rule switches partway through.'],
      }
    }
    case 'stroop': {
      // Stroop.tsx: right when the picked color is the ink (answer); keys 1..N follow the buttons.
      const { colors } = p as StroopParams
      return {
        steps: ['Ignore what the word says.', `Tap the ink color, or press ${range(Math.min(colors.length, 9))}.`],
        caption: 'RED in blue ink → blue',
        pillar: 'impulse',
        more: ['It measures holding back a habit: reading.', 'Mismatched words feel slower for everyone.'],
      }
    }
    case 'relational':
      // Relational.tsx: T/F; when "Rule inverted" shows, the expected answer is flipped. A staircase
      // moves to items with more links after right answers and fewer after wrong ones.
      return {
        steps: ['Read the clues about made-up words.', 'Tap True or False, or press [T]/[F].', 'On “Rule inverted”, give the opposite answer.'],
        caption: 'Two links give the third',
        pillar: 'focus',
        more: ['It measures reasoning with new rules.', 'Right answers bring clues with more links.'],
      }
    case 'tower':
      // Tower.tsx: predict a move count first; a move is source peg then destination peg; best score
      // when the goal is reached in the fewest moves (l_min).
      return {
        steps: ['Guess how many moves you need.', 'Move the top disc: tap from, then to.', 'Match the goal in the fewest moves.'],
        caption: 'The top disc moves across',
        pillar: 'focus',
        more: ['It measures planning before you act.', 'Extra moves lower the score.'],
      }
    case 'ufov':
      // Ufov.tsx: a letter (A/B) and a target circle flash; right only when both answers are right.
      // QUEST+ shortens the flash after right answers and lengthens it after wrong ones.
      return {
        steps: ['Watch the middle: a letter and circle flash.', 'Tap or press the letter: [A] or [B].', 'Tap where the circle was, or [1]–[8].'],
        caption: 'Letter A, circle up right',
        pillar: 'visual',
        more: ['It measures how much you take in at a glance.', 'Right answers make the flash shorter.'],
      }
    case 'mst':
      // Mst.tsx: study phase, then each item: old → Old (1), lure → Similar (2), new → New (3).
      return {
        steps: ['Remember each shape as it appears.', 'Tap Old, Similar or New, or [1]–[3].', 'Similar means close, but slightly changed.'],
        caption: 'Almost the same shape → Similar',
        pillar: 'memory',
        more: ['It measures telling similar memories apart.', 'Some shapes change only a little.'],
      }
    case 'matrix':
      // Matrix.tsx: one puzzle; tap the option that fills the empty cell.
      return {
        steps: ['Look for the pattern in rows and columns.', 'Tap the piece that fills the “?”.'],
        caption: 'The last square completes it',
        pillar: 'focus',
        more: ['It measures spotting a rule in new patterns.', 'One puzzle, with a time limit.'],
      }
    case 'mental_rotation':
      // MentalRotation.tsx: F = same shape turned, J = a mirror image.
      return {
        steps: ['Compare the two shapes.', 'Just turned? Tap Turned or press [F].', 'Flipped over? Tap Mirrored or press [J].'],
        caption: 'Turned, not flipped → Turned',
        pillar: 'agility',
        more: ['It measures turning shapes in your mind.', 'Bigger turns take longer for everyone.'],
      }
    default:
      return null
  }
}

/** Word count for the limits: brackets dropped; a token without a letter or digit is not a word. */
export const words = (s: string) => s.replace(/[[\]]/g, '').split(/\s+/).filter((w) => /[\p{L}\p{N}]/u.test(w)).length

/** A step split into text and keycaps: "[A]" becomes { key: 'A' }. */
export function stepParts(step: string): (string | { key: string })[] {
  return step.split(/(\[[^\]]+\])/).filter(Boolean).map((part) => (/^\[.+\]$/.test(part) ? { key: part.slice(1, -1) } : part))
}
