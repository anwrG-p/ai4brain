import {
  CHARACTER_PX,
  CharacterSvg,
  ClayGradient,
  ContactShadow,
  Eye,
  FACE,
  GLINT,
  SheenGradient,
  line,
  ramp,
  url,
  useCharIds,
  useCharacterMotion,
  type CharacterSize,
} from './shared'

/* Loti, the guide. A sky clay "mochi" orb: a little wider at the base than the top, so it sits
   like a soft stone rather than a perfect ball. Its signature is the one curl of light on top and
   the warm coral core showing through a clear window low in its body. It floats: the contact
   shadow sits a gap below it. viewBox 160 x 160, light from the top-left. */

export type LotiPose = 'idle' | 'talk' | 'think' | 'happy' | 'wave'

export interface LotiProps {
  pose?: LotiPose
  size?: CharacterSize
  /** Accessible name; defaults to a description of the pose. */
  title?: string
  className?: string
}

const LABEL: Record<LotiPose, string> = {
  idle: 'Loti, your guide',
  talk: 'Loti is talking',
  think: 'Loti is thinking',
  happy: 'Loti is happy',
  wave: 'Loti is waving hello',
}

const BODY = 'M80 30 C112 30 136 56 136 90 C136 118 112 136 80 136 C48 136 24 118 24 90 C24 56 48 30 80 30 Z'

type Arm = { cx: number; cy: number; deg: number }
const ARM_DOWN_L: Arm = { cx: 27, cy: 104, deg: 22 }
const ARM_DOWN_R: Arm = { cx: 133, cy: 104, deg: -22 }
const ARMS: Record<LotiPose, [Arm, Arm]> = {
  idle: [ARM_DOWN_L, ARM_DOWN_R],
  talk: [ARM_DOWN_L, { cx: 135, cy: 98, deg: -40 }],
  think: [ARM_DOWN_L, ARM_DOWN_R],
  happy: [
    { cx: 23, cy: 80, deg: -38 },
    { cx: 137, cy: 80, deg: 38 },
  ],
  wave: [ARM_DOWN_L, { cx: 140, cy: 66, deg: 28 }],
}

export function Loti({ pose = 'idle', size = 'md', title, className }: LotiProps) {
  const id = useCharIds('loti')
  const animate = useCharacterMotion()
  const anim = (name: string) => (animate ? `char-anim-${name}` : undefined)
  const sky = ramp('sky')
  const coral = ramp('coral')
  const [armL, armR] = ARMS[pose]
  const look: [number, number] = pose === 'think' ? [2.5, -3] : [0, 0]

  return (
    <CharacterSvg label={title ?? LABEL[pose]} width={CHARACTER_PX[size]} viewBox="0 0 160 160" aspect={1} className={className}>
      <defs>
        <ClayGradient id={id('body')} tone={sky} />
        <ClayGradient id={id('core')} tone={coral} cx={0.35} cy={0.3} r={0.85} />
        <SheenGradient id={id('sheen')} opacity={0.5} />
        <radialGradient id={id('window')}>
          <stop offset="0" stopColor={sky.hi} stopOpacity={0.75} />
          <stop offset="1" stopColor={sky.hi} stopOpacity={0} />
        </radialGradient>
        <radialGradient id={id('cheek')}>
          <stop offset="0" stopColor={coral.hi} />
          <stop offset="0.55" stopColor="var(--char-peach)" stopOpacity={0.9} />
          <stop offset="1" stopColor="var(--char-peach)" stopOpacity={0} />
        </radialGradient>
        <radialGradient id={id('glow')}>
          <stop offset="0" stopColor={coral.mid} stopOpacity={0.6} />
          <stop offset="0.45" stopColor={coral.hi} stopOpacity={0.35} />
          <stop offset="1" stopColor={coral.mid} stopOpacity={0} />
        </radialGradient>
        <clipPath id={id('clip')}>
          <path d={BODY} />
        </clipPath>
      </defs>

      <ContactShadow id={id('shadow')} cx={84} cy={151} rx={36} ry={5} />

      {/* Arms sit behind the body so only the rounded tips show. */}
      {[armL, armR].map((a, i) => (
        <g key={i} className={i === 1 && pose === 'wave' ? anim('wave') : undefined} style={{ transformOrigin: '126px 90px' }}>
          <ellipse cx={a.cx} cy={a.cy} rx={8.5} ry={13} transform={`rotate(${a.deg} ${a.cx} ${a.cy})`} fill={url(id('body'))} />
        </g>
      ))}

      {/* The curl of light: Loti's silhouette mark. */}
      <path d="M79 34 C74 22 80 11 91 11 C100 11 102 21 94 24" {...line(7)} stroke={sky.mid} />
      <path d="M80 26 C79 19 83 14 89 13" {...line(2)} stroke={GLINT} opacity={0.6} />

      <path d={BODY} fill={url(id('body'))} />

      <g clipPath={url(id('clip'))}>
        {/* Matte key-light sheen, broad and soft. */}
        <ellipse cx={58} cy={54} rx={28} ry={17} transform="rotate(-32 58 54)" fill={url(id('sheen'))} />

        {/* The coral core, glowing through the translucent clay. */}
        <g className={pose === 'happy' ? anim('pulse') : undefined}>
          <circle cx={80} cy={118} r={20} fill={url(id('window'))} />
          <circle cx={80} cy={118} r={pose === 'happy' ? 26 : 19} fill={url(id('glow'))} />
          <circle cx={80} cy={118} r={8.5} fill={url(id('core'))} />
          <circle cx={77.3} cy={115.3} r={2.1} fill={GLINT} opacity={0.8} />
        </g>
      </g>

      {/* Cheeks */}
      <ellipse cx={49} cy={94} rx={8} ry={5} fill={url(id('cheek'))} />
      <ellipse cx={111} cy={94} rx={8} ry={5} fill={url(id('cheek'))} />

      <LotiFace pose={pose} look={look} talkClass={anim('talk')} />

      {pose === 'think' && (
        <g className={anim('think')}>
          <circle cx={123} cy={36} r={3} fill={url(id('body'))} />
          <circle cx={134} cy={23} r={4.5} fill={url(id('body'))} />
          <circle cx={148} cy={10} r={6.5} fill={url(id('body'))} />
        </g>
      )}
    </CharacterSvg>
  )
}

function LotiFace({ pose, look, talkClass }: { pose: LotiPose; look: [number, number]; talkClass?: string }) {
  if (pose === 'happy') {
    return (
      <g>
        <path d="M56 82 Q63 73 70 82" {...line(4)} />
        <path d="M90 82 Q97 73 104 82" {...line(4)} />
        <OpenMouth d="M69 92 Q80 94 91 92 Q89 107 80 107 Q71 107 69 92 Z" />
      </g>
    )
  }
  return (
    <g>
      <Eye cx={63} cy={80} rx={6} ry={8} look={look} />
      <Eye cx={97} cy={80} rx={6} ry={8} look={look} />
      {pose === 'idle' && <path d="M72 95 Q80 101 88 95" {...line(3.5)} />}
      {pose === 'think' && <path d="M75 98 Q80 96 87 96" {...line(3.5)} />}
      {pose === 'wave' && <OpenMouth d="M72 93 Q80 95 88 93 Q86 103 80 103 Q74 103 72 93 Z" />}
      {pose === 'talk' && (
        <g className={talkClass} style={{ transformOrigin: '80px 93px' }}>
          <OpenMouth d="M73 93 Q80 91 87 93 Q86 104 80 104 Q74 104 73 93 Z" />
        </g>
      )}
    </g>
  )
}

/** An open mouth: navy, with a coral tongue clipped inside. */
function OpenMouth({ d }: { d: string }) {
  const id = useCharIds('mouth')
  return (
    <g>
      <defs>
        <clipPath id={id('m')}>
          <path d={d} />
        </clipPath>
      </defs>
      <path d={d} fill={FACE} stroke={FACE} strokeWidth={1.5} strokeLinejoin="round" />
      <ellipse cx={80} cy={108} rx={8} ry={5.5} fill="var(--char-coral)" clipPath={url(id('m'))} />
    </g>
  )
}
