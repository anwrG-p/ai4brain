import {
  BELLY,
  BLUSH,
  BODY,
  CHARACTER_PX,
  CORAL,
  CORAL_LINE,
  CharacterSvg,
  Eye,
  FACE,
  LINE,
  STROKE,
  line,
  outlined,
  useCharacterMotion,
  type CharacterSize,
} from './shared'

/* Loti, the guide: a little axolotl in flat line art (docs/design/references/loti-moods.jpg).
   A wide head with three coral gills a side, a pear body with a lighter belly, small arms and a
   tail with a coral fin. Three looks:
   - balanced (idle, talk, think): wavy gills, calm face;
   - thriving (happy, wave): leafy gills, rosy cheeks, sparkle dots;
   - low: wilted gills, closed sad eyes (system pages: offline, error, not found).
   viewBox 160 x 160, drawn front-on. */

export type LotiPose = 'idle' | 'talk' | 'think' | 'happy' | 'wave' | 'low'

export interface LotiProps {
  pose?: LotiPose
  size?: CharacterSize
  /** Accessible name; defaults to a description of the pose. */
  title?: string
  className?: string
  /** The nearly imperceptible idle (spec R8): an occasional blink. Off by default. The slow breath is
      not here: animating the SVG repaints it each frame, so LotiSays breathes an HTML wrapper. */
  alive?: boolean
  /** Where the eyes look, in viewBox units (about ±3). Overrides the pose's own gaze. */
  look?: [number, number]
}

const LABEL: Record<LotiPose, string> = {
  idle: 'Loti, your guide',
  talk: 'Loti is talking',
  think: 'Loti is thinking',
  happy: 'Loti is happy',
  wave: 'Loti is waving hello',
  low: 'Loti feels a little low',
}

type Look = 'balanced' | 'thriving' | 'low'
const LOOK: Record<LotiPose, Look> = { idle: 'balanced', talk: 'balanced', think: 'balanced', happy: 'thriving', wave: 'thriving', low: 'low' }

const HEAD = 'M80 22 C105 22 120 36 120 52 C120 69 103 80 80 80 C57 80 40 69 40 52 C40 36 55 22 80 22 Z'
const BODY_PATH =
  'M63 74 C57 90 52 108 53 127 C54 141 60 151 71 151 C76 151 78 148 80 145 C82 148 84 151 89 151 C100 151 106 141 107 127 C108 108 103 90 97 74 Z'
const TAIL = 'M60 126 C46 120 30 108 15 98 C10 95 7 100 10 104 C22 122 38 140 62 146 Z'
const TAIL_FIN = 'M58 142 C40 136 24 122 12 105 C26 116 42 126 60 131 Z'

/** Balanced gills, left side (the right side is mirrored): wavy strands. */
const GILLS_WAVY = [
  'M50 34 C44 28 42 20 35 15 C31 12 27 12 24 8',
  'M44 47 C36 45 30 41 22 41 C16 41 12 37 7 35',
  'M45 61 C37 63 31 67 23 67 C17 67 13 71 8 73',
]
/** Low gills: the strands hang down and kink. */
const GILLS_WILTED = [
  'M49 34 C41 32 37 38 34 45 C31 52 28 55 25 58',
  'M44 47 C37 49 35 57 32 63 C29 69 26 70 24 75',
  'M46 60 C40 64 40 72 37 78 C35 83 32 85 30 90',
]
/** Thriving gills: fern fronds, [base x, base y, angle in degrees, length]. */
const FRONDS: [number, number, number, number][] = [
  [49, 34, 232, 28],
  [43, 48, 192, 30],
  [45, 62, 152, 26],
]

export function Loti({ pose = 'idle', size = 'md', title, className, alive = false, look: gaze }: LotiProps) {
  const animate = useCharacterMotion()
  const anim = (name: string) => (animate ? `char-anim-${name}` : undefined)
  const kind = LOOK[pose]
  const look: [number, number] = gaze ?? (pose === 'think' ? [2, -2] : [0, 0])
  const sag = kind === 'low' ? 3 : 0

  return (
    <CharacterSvg label={title ?? LABEL[pose]} width={CHARACTER_PX[size]} viewBox="0 0 160 160" aspect={1} className={className}>
      {kind === 'thriving' && (
        <g className={pose === 'happy' ? anim('pulse') : undefined} fill={CORAL}>
          {[
            [16, 28, 2.4],
            [26, 12, 1.8],
            [8, 54, 1.6],
            [144, 28, 2.4],
            [134, 12, 1.8],
            [152, 54, 1.6],
          ].map(([cx, cy, r]) => (
            <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r={r} />
          ))}
        </g>
      )}

      {/* Tail behind the body, its coral fin on the underside. */}
      <path d={TAIL} {...outlined(BODY)} />
      <path d={TAIL_FIN} fill={CORAL} />
      <path d={TAIL} {...outlined('none')} />

      <path d={BODY_PATH} {...outlined(BODY)} />
      <ellipse cx={80} cy={122} rx={16} ry={20} fill={BELLY} />
      <path d="M80 136 L80 145" {...line(3, LINE)} />

      <Arms pose={pose} waveClass={pose === 'wave' ? anim('wave') : undefined} />

      <g transform={sag ? `translate(0 ${sag})` : undefined}>
        <Gills kind={kind} />
        <path d={HEAD} {...outlined(BODY)} />
        {kind === 'thriving' && (
          <>
            <ellipse cx={60} cy={62} rx={5.5} ry={3.2} fill={BLUSH} />
            <ellipse cx={100} cy={62} rx={5.5} ry={3.2} fill={BLUSH} />
          </>
        )}
        <LotiFace pose={pose} kind={kind} look={look} talkClass={anim('talk')} blinkClass={alive ? anim('blink') : undefined} />
      </g>

      {pose === 'think' && (
        <g className={anim('think')}>
          <circle cx={124} cy={26} r={3} {...outlined(BODY, undefined, 2.5)} />
          <circle cx={134} cy={15} r={4.5} {...outlined(BODY, undefined, 2.5)} />
          <circle cx={147} cy={5} r={5} {...outlined(BODY, undefined, 2.5)} />
        </g>
      )}
    </CharacterSvg>
  )
}

/** Six gills, the right side mirrored from the left. */
function Gills({ kind }: { kind: Look }) {
  const side =
    kind === 'thriving' ? (
      <Fronds />
    ) : (
      (kind === 'low' ? GILLS_WILTED : GILLS_WAVY).map((d) => (
        <g key={d}>
          <path d={d} {...line(10, CORAL_LINE)} />
          <path d={d} {...line(5.5, CORAL)} />
        </g>
      ))
    )
  return (
    <g>
      <g>{side}</g>
      <g transform="translate(160 0) scale(-1 1)">{side}</g>
    </g>
  )
}

/** Leafy gills: each frond is a row of overlapping lobes. Every outline is drawn first and every fill
    on top, so the lobes read as one leaf with one outer edge, and a pale vein runs down the middle. */
function Fronds() {
  const lobes: { cx: number; cy: number; rx: number; ry: number; deg: number }[] = []
  const veins: string[] = []
  for (const [bx, by, deg, len] of FRONDS) {
    const rad = (deg * Math.PI) / 180
    const ux = Math.cos(rad)
    const uy = Math.sin(rad)
    const at = (d: number, side = 0) => [bx + ux * d - uy * side, by + uy * d + ux * side] as const
    for (const [d, side, rx, ry, turn] of [
      [len * 0.35, 0, 8, 5.5, 0],
      [len * 0.62, 0, 7, 5, 0],
      [len * 0.86, 0, 5, 4, 0],
      [len * 0.42, 5, 5, 3.4, 38],
      [len * 0.42, -5, 5, 3.4, -38],
      [len * 0.68, 4.2, 4, 2.8, 38],
      [len * 0.68, -4.2, 4, 2.8, -38],
    ] as const) {
      const [cx, cy] = at(d, side)
      lobes.push({ cx: round(cx), cy: round(cy), rx, ry, deg: round(deg + turn) })
    }
    const [x1, y1] = at(len * 0.15)
    const [x2, y2] = at(len * 0.9)
    veins.push(`M${round(x1)} ${round(y1)} L${round(x2)} ${round(y2)}`)
  }
  const lobe = (l: (typeof lobes)[number], props: object) => (
    <ellipse key={`${l.cx}-${l.cy}`} cx={l.cx} cy={l.cy} rx={l.rx} ry={l.ry} transform={`rotate(${l.deg} ${l.cx} ${l.cy})`} {...props} />
  )
  return (
    <g>
      <g fill={CORAL_LINE} stroke={CORAL_LINE} strokeWidth={STROKE * 0.9} strokeLinejoin="round">
        {lobes.map((l) => lobe(l, {}))}
      </g>
      <g fill={CORAL}>{lobes.map((l) => lobe(l, {}))}</g>
      {veins.map((d) => (
        <path key={d} d={d} {...line(1.6, BELLY)} />
      ))}
    </g>
  )
}

const round = (n: number) => Math.round(n * 10) / 10

type ArmShape = { d: string; className?: string; origin?: string }
const ARM_L = 'M66 88 C60 97 58 107 61 114 C63 118 68 117 68 113 C67 106 69 99 72 93'
const ARM_R = 'M94 88 C100 97 102 107 99 114 C97 118 92 117 92 113 C93 106 91 99 88 93'
const ARM_R_TALK = 'M94 88 C102 94 108 100 112 104 C115 107 112 112 108 110 C102 106 96 102 90 97'
const ARM_R_WAVE = 'M95 90 C104 86 110 78 113 70 C114 65 120 65 120 70 C119 82 111 94 99 100'
const ARM_L_LOW = 'M66 90 C61 100 60 112 62 120 C63 124 68 124 68 120 C67 112 68 103 71 96'
const ARM_R_LOW = 'M94 90 C99 100 100 112 98 120 C97 124 92 124 92 120 C93 112 92 103 89 96'

function Arms({ pose, waveClass }: { pose: LotiPose; waveClass?: string }) {
  const arms: ArmShape[] =
    pose === 'low'
      ? [{ d: ARM_L_LOW }, { d: ARM_R_LOW }]
      : pose === 'talk'
        ? [{ d: ARM_L }, { d: ARM_R_TALK }]
        : pose === 'wave'
          ? [{ d: ARM_L }, { d: ARM_R_WAVE, className: waveClass, origin: '97px 96px' }]
          : [{ d: ARM_L }, { d: ARM_R }]
  return (
    <>
      {arms.map((a) => (
        <g key={a.d} className={a.className} style={a.origin ? { transformOrigin: a.origin } : undefined}>
          <path d={a.d} {...outlined(BODY)} />
        </g>
      ))}
    </>
  )
}

function LotiFace({ pose, kind, look, talkClass, blinkClass }: { pose: LotiPose; kind: Look; look: [number, number]; talkClass?: string; blinkClass?: string }) {
  if (kind === 'low') {
    return (
      <g>
        {/* Closed, sad eyes with a tired line under each, and a small frown. */}
        <path d="M59 50 Q65 55 71 51" {...line(3)} />
        <path d="M89 51 Q95 55 101 50" {...line(3)} />
        <path d="M61 58 Q65 60 69 58" {...line(1.6, LINE)} />
        <path d="M91 58 Q95 60 99 58" {...line(1.6, LINE)} />
        <path d="M73 69 Q80 64 87 69" {...line(3)} />
      </g>
    )
  }
  const big = kind === 'thriving'
  return (
    <g>
      <g className={blinkClass}>
        <Eye cx={66} cy={50} rx={big ? 4.6 : 3.6} ry={big ? 5.2 : 4} look={look} />
        <Eye cx={94} cy={50} rx={big ? 4.6 : 3.6} ry={big ? 5.2 : 4} look={look} />
      </g>
      {pose === 'think' && <path d="M74 64 Q80 62 86 63" {...line(3)} />}
      {(pose === 'idle' || pose === 'happy') && <path d="M71 61 Q80 69 89 61" {...line(3)} />}
      {pose === 'wave' && <OpenMouth />}
      {pose === 'talk' && (
        <g className={talkClass} style={{ transformOrigin: '80px 61px' }}>
          <OpenMouth />
        </g>
      )}
    </g>
  )
}

/** An open smile: navy, with a blush tongue. */
function OpenMouth() {
  return (
    <g>
      <path d="M72 60 Q80 63 88 60 Q86 71 80 71 Q74 71 72 60 Z" fill={FACE} stroke={FACE} strokeWidth={2} strokeLinejoin="round" />
      <ellipse cx={80} cy={68.4} rx={4} ry={2} fill={BLUSH} />
    </g>
  )
}
