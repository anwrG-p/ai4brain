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

/* The Dolphin: the celebration character who swims out to say "good job". Short and chubby,
   with a high round melon, a short rounded beak, a swept-back dorsal fin and a coral belly.
   It faces right, toward the content it celebrates. viewBox 200 x 150, light from the top-left. */

export type DolphinPose = 'swim-in' | 'cheer'

export interface DolphinProps {
  pose?: DolphinPose
  size?: CharacterSize
  title?: string
  className?: string
}

const LABEL: Record<DolphinPose, string> = {
  'swim-in': 'Dolphin swimming in to say good job',
  cheer: 'Dolphin cheering for you',
}

const BODY =
  'M34 100 C44 80 70 56 108 48 C138 42 164 54 170 72 C172 77 176 79 182 80 C190 82 194 89 189 94 C184 98 174 98 166 100 C150 114 120 122 92 120 C66 118 46 112 34 100 Z'
/** Cheer drops the jaw: a fuller chin, so the open mouth sits inside the head, not on the background. */
const BODY_CHEER =
  'M34 100 C44 80 70 56 108 48 C138 42 164 54 170 72 C172 77 176 79 182 80 C190 82 194 89 190 94 C189 103 181 109 170 109 C150 116 120 122 92 120 C66 118 46 112 34 100 Z'
const FLUKES = 'M42 101 C34 93 24 83 13 82 C7 84 10 94 24 102 C12 108 8 118 14 122 C24 122 34 112 44 106 Z'
const DORSAL = 'M92 54 C96 43 94 33 86 26 C102 28 114 38 120 48 Z'

export function Dolphin({ pose = 'swim-in', size = 'lg', title, className }: DolphinProps) {
  const id = useCharIds('dolphin')
  const animate = useCharacterMotion()
  const anim = (name: string) => (animate ? `char-anim-${name}` : undefined)
  const sky = ramp('sky')
  const coral = ramp('coral')
  const cheer = pose === 'cheer'
  const body = cheer ? BODY_CHEER : BODY

  return (
    <CharacterSvg label={title ?? LABEL[pose]} width={CHARACTER_PX[size]} viewBox="0 0 200 150" aspect={0.75} className={className}>
      <defs>
        <ClayGradient id={id('body')} tone={sky} cx={0.38} cy={0.2} r={0.75} />
        <ClayGradient id={id('belly')} tone={coral} cx={0.4} cy={0.1} r={0.9} />
        <SheenGradient id={id('sheen')} />
        <radialGradient id={id('cheek')}>
          <stop offset="0" stopColor={coral.hi} />
          <stop offset="0.55" stopColor="var(--char-peach)" stopOpacity={0.9} />
          <stop offset="1" stopColor="var(--char-peach)" stopOpacity={0} />
        </radialGradient>
        <clipPath id={id('clip')}>
          <path d={body} />
        </clipPath>
      </defs>

      <ContactShadow
        id={id('shadow')}
        cx={110}
        cy={142}
        rx={64}
        ry={5}
        className={anim(cheer ? 'hop-shadow' : 'fade-in')}
      />

      <g className={anim(cheer ? 'hop' : 'swim-in')}>
        {/* Cheer lifts the nose; the static tilt sits inside the animated group. */}
        <g transform={cheer ? 'rotate(-9 104 92)' : undefined}>
          <path d={FLUKES} fill={url(id('body'))} />
          <path d={DORSAL} fill={url(id('body'))} />
          <path d={body} fill={url(id('body'))} />

          <g clipPath={url(id('clip'))}>
            <ellipse cx={122} cy={132} rx={82} ry={27} fill={url(id('belly'))} />
            <ellipse cx={104} cy={62} rx={40} ry={12} transform="rotate(-12 104 62)" fill={url(id('sheen'))} />
          </g>

          {/* Pectoral fin: sky, over the coral belly. Cheer waves it up. */}
          <path
            d={cheer ? 'M118 104 C124 92 134 84 146 82 C142 92 134 102 124 110 Z' : 'M124 106 C122 118 114 127 101 131 C108 121 111 112 113 106 Z'}
            fill={url(id('body'))}
          />

          <ellipse cx={154} cy={91} rx={8} ry={4.8} fill={url(id('cheek'))} />
          {cheer ? (
            <>
              <path d="M143 75 Q150 66 157 75" {...line(3.5)} />
              <OpenMouth />
            </>
          ) : (
            <>
              <Eye cx={150} cy={73} rx={6.5} ry={8} />
              <path d="M187 93 C180 97 172 97 165 92" {...line(3)} />
            </>
          )}
        </g>
      </g>
    </CharacterSvg>
  )
}

/** Cheer's open smile under the beak, with a peach tongue. */
function OpenMouth() {
  const id = useCharIds('dolphin-mouth')
  const d = 'M186 92 Q176 97 162 93 Q165 105 175 105 Q184 103 186 92 Z'
  return (
    <g>
      <defs>
        <clipPath id={id('m')}>
          <path d={d} />
        </clipPath>
      </defs>
      <path d={d} fill={FACE} stroke={FACE} strokeWidth={1.5} strokeLinejoin="round" />
      <ellipse cx={174} cy={107} rx={10} ry={6} fill="var(--char-peach)" clipPath={url(id('m'))} />
    </g>
  )
}
