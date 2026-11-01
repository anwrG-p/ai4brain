import { moodGuessActive, useDevicePrefs } from '../../../state/devicePrefs'
import { useEmilyStore } from '../../../state/useEmilyStore'
import type { EmilyEmotion } from '../../../styles/emilyTokens'
import {
  BELLY,
  BODY,
  CHARACTER_PX,
  CORAL,
  CharacterSvg,
  Eye,
  STROKE,
  line,
  outlined,
  useCharacterMotion,
  type CharacterSize,
} from './shared'

/* Momo, the dolphin (docs/design/references/momo-dolphin.jpg): mood companion and celebrations.
   Flat line art: a sky body curled like a leap, a lighter belly, coral accents on the fins and tail.
   Mood shows three ways, so colour is never the only signal: the face, the fin pose and the
   posture (tilt). Frustrated takes warm amber accents, never red (Anti-Red rule); tired a greyer
   body. `celebrate` is the leap with splash marks (Results and other good-job moments).
   viewBox 130 x 140, facing right. */

export type MomoMood = 'calm' | 'happy' | 'tired' | 'frustrated' | 'focused'

export interface MomoProps {
  mood?: MomoMood
  /** The leap with splash marks: one entrance, then still. Shows the happy face. */
  celebrate?: boolean
  size?: CharacterSize
  title?: string
  className?: string
}

/** How the emotion store (useEmilyStore) maps onto Momo's moods.
    hesitant -> focused: the learner is slowing down to think, so Momo shows careful attention,
    not worry. */
export const EMOTION_TO_MOOD: Record<EmilyEmotion, MomoMood> = {
  calm_flow: 'calm',
  energized: 'happy',
  frustrated: 'frustrated',
  hesitant: 'focused',
  fatigued: 'tired',
}

type Face = MomoMood | 'celebrate'

/** Posture: the whole body's tilt (degrees) and drop (viewBox units). */
const POSTURE: Record<Face, { tilt: number; drop: number }> = {
  calm: { tilt: 0, drop: 0 },
  happy: { tilt: -5, drop: -2 },
  tired: { tilt: 9, drop: 5 },
  frustrated: { tilt: 3, drop: 2 },
  focused: { tilt: -2, drop: 0 },
  celebrate: { tilt: -10, drop: -3 },
}

/** The front (pectoral) fin's turn about its root: raised when glad, drooping when tired. */
const FIN_TURN: Record<Face, number> = { calm: 0, happy: -12, tired: 24, frustrated: 10, focused: -6, celebrate: 0 }

const BODY_PATH =
  'M124 50 C122 55 116 57 108 57 C90 59 76 67 71 80 C67 92 70 106 79 116 L72 124 C54 117 34 106 28 86 C22 66 28 36 46 20 C58 9 74 6 86 10 C98 14 104 26 105 38 C110 40 118 43 122 46 C124 47 125 49 124 50 Z'
const BELLY_PATH = 'M108 57 C90 59 76 67 71 80 C67 92 70 106 79 116 C64 110 56 97 57 83 C58 68 78 57 104 55 Z'
const DORSAL = 'M50 17 C40 7 28 3 15 6 C22 11 29 20 32 31 Z'
/** Fins in front of the body: a closed fill, and an open outline that leaves the root seamless. */
const FIN = 'M44 66 C32 70 18 79 9 91 C7 94 10 96 14 95 C26 92 38 86 47 78 Z'
const FIN_EDGE = 'M40 67 C30 71 18 79 9 91 C7 94 10 96 14 95 C26 92 37 86 45 80'
const FLIPPER = 'M74 82 C84 85 90 91 92 99 C85 98 78 94 72 90 Z'
const FLIPPER_EDGE = 'M76 83 C84 86 90 91 92 99 C85 98 79 95 74 91'
const FLUKE_DOWN = 'M70 120 C63 127 62 134 66 140 C72 135 77 129 79 124 Z'
const FLUKE_UP = 'M74 120 C82 113 93 111 102 113 C97 120 88 126 78 126 Z'

const SPLASH = [
  'M8 30 C9 25 12 22 16 21',
  'M5 42 L6 43',
  'M114 76 C118 74 121 70 122 66',
  'M118 86 L119 87',
  'M34 124 C36 129 39 132 44 134',
  'M26 118 L27 119',
]

export function Momo({ mood = 'calm', celebrate = false, size = 'md', title, className }: MomoProps) {
  const animate = useCharacterMotion()
  const face: Face = celebrate ? 'celebrate' : mood
  const { tilt, drop } = POSTURE[face]
  const accent = face === 'frustrated' ? 'var(--char-amber)' : CORAL
  const body = face === 'tired' ? 'var(--char-mist)' : BODY
  const label = title ?? (celebrate ? 'Momo leaps to say good job' : `Momo looks ${mood}`)
  const motion = animate ? (celebrate ? 'char-anim-leap' : 'char-anim-mood') : undefined

  return (
    <CharacterSvg label={label} width={CHARACTER_PX[size]} viewBox="0 0 130 140" aspect={140 / 130} className={className}>
      {celebrate && (
        <g className={animate ? 'char-anim-splash' : undefined}>
          {SPLASH.map((d) => (
            <path key={d} d={d} {...line(STROKE, CORAL)} />
          ))}
        </g>
      )}
      {/* Keyed by face, so a mood change replays one soft squash (or the leap). */}
      <g key={face} className={motion}>
        <g transform={`translate(0 ${drop}) rotate(${tilt} 65 72)`}>
          <path d={DORSAL} {...outlined(body)} />
          <path d="M22 8 C29 8 36 11 42 14" {...line(3.2, accent)} />
          <path d={FLUKE_DOWN} {...outlined(body)} />
          <path d={FLUKE_UP} {...outlined(body)} />
          <path d="M82 119 C88 116 94 115 98 115" {...line(3.2, accent)} />

          <path d={BODY_PATH} {...outlined(body)} />
          <path d={BELLY_PATH} fill={BELLY} />
          <path d={BODY_PATH} {...outlined('none')} />
          {/* A coral mark on the back, as in the reference. */}
          <path d="M36 44 C33 50 32 56 32 62" {...line(3.2, accent)} />

          <g transform={`rotate(${FIN_TURN[face]} 43 71)`}>
            <path d={FIN} fill={body} />
            <path d={FIN_EDGE} {...outlined('none')} />
            <path d="M15 90 C26 86 36 81 43 77" {...line(3.2, accent)} />
          </g>
          <path d={FLIPPER} fill={body} />
          <path d={FLIPPER_EDGE} {...outlined('none')} />
          <path d="M80 87 C84 90 87 93 88 96" {...line(2.6, accent)} />

          <MomoFace face={face} />
        </g>
      </g>
    </CharacterSvg>
  )
}

function MomoFace({ face }: { face: Face }) {
  switch (face) {
    case 'happy':
    case 'celebrate':
      return (
        <g>
          <path d="M80 36 Q86 29 92 36" {...line(3)} />
          <path d="M94 47 Q104 56 116 51" {...line(3)} />
        </g>
      )
    case 'tired':
      return (
        <g>
          {/* Heavy lids: a flat line over a half-open eye. */}
          <path d="M80 34 L92 35" {...line(3)} />
          <path d="M82 36 Q86 39 90 36" {...line(2.4)} />
          <path d="M100 52 Q106 53 112 52" {...line(3)} />
        </g>
      )
    case 'frustrated':
      return (
        <g>
          {/* Worried, not cross: the inner end of the brow lifts (a supportive, zero-guilt face). */}
          <path d="M80 27 Q85 27 91 23" {...line(2.4)} />
          <Eye cx={86} cy={35} rx={3.4} ry={4.2} />
          <path d="M98 53 Q102 50 106 53 Q110 56 114 52" {...line(2.6)} />
        </g>
      )
    case 'focused':
      return (
        <g>
          <path d="M80 26 Q86 25 92 26" {...line(2.4)} />
          <Eye cx={86} cy={35} rx={3.4} ry={4.2} look={[1, 0.5]} />
          <path d="M100 51 Q106 53 112 51" {...line(2.6)} />
        </g>
      )
    default:
      return (
        <g>
          <Eye cx={86} cy={35} rx={3.4} ry={4.2} />
          <path d="M96 48 Q104 55 114 51" {...line(3)} />
        </g>
      )
  }
}

/** Momo following the shared emotion store (see EMOTION_TO_MOOD) while the mood guess is active
    (opted in, notice seen: ADR 0002). Otherwise a still picture with a neutral face that reads
    nothing from the store. The correction lives in Settings (MoodCorrection). */
export function MomoFromStore(props: Omit<MomoProps, 'mood' | 'celebrate'>) {
  const active = useDevicePrefs(moodGuessActive)
  const emotion = useEmilyStore((s) => s.currentEmotion)
  return active ? <Momo {...props} mood={EMOTION_TO_MOOD[emotion]} /> : <Momo {...props} mood="calm" title="Momo" />
}
