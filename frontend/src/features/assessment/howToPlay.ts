import type { PillarId } from '../insights/pillars'
import { NBACK_RULE_STREAM } from './telemetry/types'
import type { NBackParams, PalParams, SchemaType, StroopParams, TaskPayload } from './telemetry/types'

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
      // NBack.tsx (R16): only the rule shown above the grid counts, on the key its hint names
      // (NBACK_RULE_STREAM: A = place, L = symbol, L = even for parity). A match on the other stream is
      // a lure, so any other press is wrong. One step per rule the trials use (if its key is shown);
      // with all three rules there is no room, so one step points at the hint instead.
      const { n, streams, trials } = p as NBackParams
      const RULES = ['position', 'symbol', 'parity'] as const
      const used = RULES.filter((r) => streams.includes(NBACK_RULE_STREAM[r]) && trials.some((t) => t.rule === r))
      const rules = used.length ? used : RULES.filter((r) => r !== 'parity' && streams.includes(r))
      const only = rules.length === 1
      const step = {
        position: only ? `Place matches ${n} back? Tap or press [A].` : `Place rule: ${n} back? Tap or press [A].`,
        symbol: only ? `Symbol matches ${n} back? Tap or press [L].` : `Symbol rule: ${n} back? Tap or press [L].`,
        parity: only ? 'Even number? Tap or press [L].' : 'Parity rule: even number? Tap or press [L].',
      }
      const ruleSteps =
        rules.length > 2 ? ['Follow the rule above the grid.', 'Its match? Tap or press [A] or [L].'] : rules.map((r) => step[r])
      const plain = streams.length === 1 && only && rules[0] !== 'parity'
      return {
        steps: [...ruleSteps, plain ? 'No match? Do nothing.' : 'Anything else? Do nothing.'],
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
    case 'stop_signal':
      // StopSignal.tsx: ← / → or Left / Right on a go trial; on a stop trial any press is wrong. The
      // consensus guide asks to say "do not wait for the stop sign" (Verbruggen et al. 2019).
      return {
        steps: ['Tap the way the arrow points, or [←]/[→].', 'Be quick: never wait for a stop.', 'Stop sign? Press nothing at all.'],
        caption: 'An arrow, then the stop sign',
        pillar: 'impulse',
        more: ['It measures stopping an action you already started.', 'Each stop you make brings the next sign later.'],
      }
    case 'pal': {
      // PairedAssociates.tsx: study, then pick the box (tap, or digit k for box k); a stage with a
      // wrong box is studied again, up to max_attempts.
      const { boxes } = p as PalParams
      return {
        steps: ['Watch which shape opens in each box.', `Then tap its box, or press ${range(Math.min(boxes, 9))}.`, 'A miss shows the boxes once more.'],
        caption: 'The shape was in this box',
        pillar: 'memory',
        more: ['It measures remembering where things were.', 'Each round adds more shapes, up to eight.'],
      }
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
