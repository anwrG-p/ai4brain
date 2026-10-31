import { useEmilyStore } from '../../../state/useEmilyStore'
import type { EmilyEmotion } from '../../../styles/emilyTokens'
import {
  CHARACTER_PX,
  CharacterSvg,
  ClayGradient,
  ContactShadow,
  Eye,
  FACE,
  SheenGradient,
  line,
  ramp,
  url,
  useCharIds,
  useCharacterMotion,
  type CharacterSize,
} from './shared'

/* Momo, the small mood companion. A wide clay pebble with two round ears and two feet: it sits
   on the floor (its shadow touches it), where Loti floats. Mood shows three ways, so colour is
   never the only signal: the face, the ears and the clay tint. Frustrated is warm amber, never red
   (Anti-Red rule). viewBox 120 x 110, light from the top-left. */

export type MomoMood = 'calm' | 'happy' | 'tired' | 'frustrated' | 'focused'

export interface MomoProps {
  mood?: MomoMood
  size?: CharacterSize
  title?: string
  className?: string
}

/** How the emotion store (useEmilyStore / EmilyMoodPill) maps onto Momo's moods.
    hesitant -> focused: the learner is slowing down to think, so Momo shows careful attention,
    not worry. */
export const EMOTION_TO_MOOD: Record<EmilyEmotion, MomoMood> = {
  calm_flow: 'calm',
  energized: 'happy',
  frustrated: 'frustrated',
  hesitant: 'focused',
  fatigued: 'tired',
}

const TINT: Record<MomoMood, string> = {
  calm: 'pale',
  happy: 'peach',
  tired: 'mist',
  frustrated: 'amber',
  focused: 'sky',
}

/** Ear tilt in degrees, outward from upright: perked, droopy or pinned back. */
const EAR_TILT: Record<MomoMood, number> = { calm: 18, happy: 8, tired: 62, frustrated: 40, focused: 12 }

const BODY = 'M60 32 C88 32 104 49 104 69 C104 89 86 100 60 100 C34 100 16 89 16 69 C16 49 32 32 60 32 Z'

export function Momo({ mood = 'calm', size = 'md', title, className }: MomoProps) {
  const id = useCharIds('momo')
  const animate = useCharacterMotion()
  const tone = ramp(TINT[mood])
  const tilt = EAR_TILT[mood]
  const earY = mood === 'tired' ? 44 : 38

  return (
    <CharacterSvg label={title ?? `Momo looks ${mood}`} width={CHARACTER_PX[size]} viewBox="0 0 120 110" aspect={110 / 120} className={className}>
      <defs>
        <ClayGradient id={id('body')} tone={tone} />
        <SheenGradient id={id('sheen')} opacity={0.55} />
        <radialGradient id={id('cheek')}>
          <stop offset="0" stopColor="var(--char-coral)" stopOpacity={mood === 'happy' ? 0.85 : 0.65} />
          <stop offset="0.5" stopColor="var(--char-coral)" stopOpacity={mood === 'happy' ? 0.6 : 0.4} />
          <stop offset="1" stopColor="var(--char-coral)" stopOpacity={0} />
        </radialGradient>
      </defs>

      <ContactShadow id={id('shadow')} cx={62} cy={102} rx={42} ry={5} />

      {/* Keyed by mood, so a mood change replays one soft squash. */}
      <g key={mood} className={animate ? 'char-anim-mood' : undefined}>
        <g transform={mood === 'tired' ? 'translate(0 3) scale(1 0.97)' : undefined}>
          {[-1, 1].map((side) => {
            const cx = 60 + side * 25
            return (
              <g key={side} transform={`rotate(${side * tilt} ${cx} ${earY + 10})`}>
                <ellipse cx={cx} cy={earY} rx={9} ry={11} fill={url(id('body'))} />
                <ellipse cx={cx} cy={earY + 1} rx={4.5} ry={6} fill="var(--char-coral-hi)" opacity={0.9} />
              </g>
            )
          })}
          <path d={BODY} fill={url(id('body'))} />
          <ellipse cx={42} cy={48} rx={20} ry={11} transform="rotate(-24 42 48)" fill={url(id('sheen'))} />
          <ellipse cx={45} cy={99} rx={9} ry={4.5} fill={tone.lo} />
          <ellipse cx={75} cy={99} rx={9} ry={4.5} fill={tone.lo} />

          <ellipse cx={36} cy={76} rx={mood === 'frustrated' ? 7.5 : 6.5} ry={4} fill={url(id('cheek'))} />
          <ellipse cx={84} cy={76} rx={mood === 'frustrated' ? 7.5 : 6.5} ry={4} fill={url(id('cheek'))} />
          <MomoFace mood={mood} />
        </g>
      </g>
    </CharacterSvg>
  )
}

function MomoFace({ mood }: { mood: MomoMood }) {
  switch (mood) {
    case 'happy':
      return (
        <g>
          <path d="M42 67 Q47 60 52 67" {...line(3)} />
          <path d="M68 67 Q73 60 78 67" {...line(3)} />
          <path d="M53 75 Q60 77 67 75 Q66 84 60 84 Q54 84 53 75 Z" fill={FACE} stroke={FACE} strokeWidth={1.5} strokeLinejoin="round" />
        </g>
      )
    case 'tired':
      return (
        <g>
          <path d="M42 66 Q47 70 52 66" {...line(3)} />
          <path d="M68 66 Q73 70 78 66" {...line(3)} />
          <ellipse cx={60} cy={79} rx={3} ry={3.5} fill={FACE} />
        </g>
      )
    case 'frustrated':
      return (
        <g>
          <path d="M42 57 Q47 57.4 51 59.4" {...line(2.2)} />
          <path d="M78 57 Q73 57.4 69 59.4" {...line(2.2)} />
          <Eye cx={47} cy={66} rx={3.6} ry={4.6} />
          <Eye cx={73} cy={66} rx={3.6} ry={4.6} />
          <path d="M52 79 Q56 75.5 60 79 Q64 82.5 68 79" {...line(2.5)} />
        </g>
      )
    case 'focused':
      return (
        <g>
          <path d="M43 56 Q47 55 51 56" {...line(2)} />
          <path d="M69 56 Q73 55 77 56" {...line(2)} />
          <Eye cx={47} cy={65} rx={4.2} ry={3.8} look={[1, 0.8]} />
          <Eye cx={73} cy={65} rx={4.2} ry={3.8} look={[1, 0.8]} />
          <path d="M55.5 77.5 Q60 79 64.5 77.5" {...line(2.5)} />
        </g>
      )
    default:
      return (
        <g>
          <Eye cx={47} cy={65} rx={4} ry={5} />
          <Eye cx={73} cy={65} rx={4} ry={5} />
          <path d="M55 76 Q60 80 65 76" {...line(2.5)} />
        </g>
      )
  }
}

/** Momo following the shared emotion store (see EMOTION_TO_MOOD). */
export function MomoFromStore(props: Omit<MomoProps, 'mood'>) {
  const emotion = useEmilyStore((s) => s.currentEmotion)
  return <Momo {...props} mood={EMOTION_TO_MOOD[emotion]} />
}
