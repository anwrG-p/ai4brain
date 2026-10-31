import type { CSSProperties, ReactNode } from 'react'
import type { SchemaType } from './telemetry/types'
import { INK } from './tasks/Stroop'

/* A short looping demo of each exercise's stimulus for its instruction screen (ticket 07b, spec
   R8). Pure SVG; the loops are the anim-demo-* classes in tokens.css. Decorative (aria-hidden): the
   heading and the line say what to do. With motion off it rests as a still picture of the same thing.
   Shapes use brand-vivid (a graphic, >= 3:1), text uses ink, a highlight uses accent-strong. */

const SHAPE = 'var(--color-brand-vivid)'
const INKC = 'var(--color-ink)'
const LINE = 'var(--color-border-strong)'
const MARK = 'var(--color-accent-strong)'
const SOFT = 'var(--color-surface-raised)'

// Stagger index for the anim-demo-* delays.
const at = (i: number) => ({ '--i': i }) as CSSProperties

const TEXT = { fontFamily: 'var(--font-sans)', fontWeight: 700, textAnchor: 'middle' } as const

// Color Clash: a colour word whose ink keeps changing (the word and its ink never agree).
function Stroop() {
  const words: [string, string][] = [
    ['RED', INK.blue!],
    ['BLUE', INK.green!],
    ['GREEN', INK.red!],
  ]
  return (
    <>
      {words.map(([w, ink], i) => (
        <text key={w} x={80} y={50} fontSize={26} fill={ink} {...TEXT} className={`anim-demo-cycle ${i ? 'demo-later' : ''}`} style={at(i)}>
          {w}
        </text>
      ))}
    </>
  )
}

// Memory Gauntlet: a square lights up in the grid, step by step; the third lands where the first
// did, with the same letter (a match 2 steps back).
function NBack() {
  const cell = (k: number): [number, number] => [53 + (k % 3) * 19, 3 + Math.floor(k / 3) * 25]
  const steps: [number, string][] = [
    [0, 'A'],
    [5, 'B'],
    [0, 'A'],
  ]
  return (
    <>
      {Array.from({ length: 9 }, (_, k) => {
        const [x, y] = cell(k)
        return <rect key={k} x={x} y={y} width={16} height={22} rx={3} fill="none" stroke={LINE} strokeWidth={1} />
      })}
      {steps.map(([k, l], i) => {
        const [x, y] = cell(k)
        return (
          <g key={i} className="anim-demo-seq" style={at(i * 2)}>
            <rect x={x} y={y} width={16} height={22} rx={3} fill={i === 2 ? MARK : SHAPE} />
            <text x={x + 8} y={y + 16} fontSize={12} fill="var(--color-canvas)" {...TEXT}>
              {l}
            </text>
          </g>
        )
      })}
    </>
  )
}

// Shape Turn: an L shape turns a quarter and back.
function Rotation() {
  return (
    <g className="anim-demo-turn">
      <path d="M66 14 h14 v38 h18 v14 h-32 Z" fill={SHAPE} />
    </g>
  )
}

// Perceptual Radar: a quick flash at the centre and one at the edge, together.
function Ufov() {
  return (
    <>
      <circle cx={80} cy={40} r={32} fill="none" stroke={LINE} strokeWidth={1} strokeDasharray="3 5" />
      <g className="anim-demo-flash">
        <rect x={70} y={30} width={20} height={20} rx={4} fill={SOFT} stroke={LINE} />
        <text x={80} y={46} fontSize={14} fill={INKC} {...TEXT}>
          A
        </text>
        <circle cx={103} cy={17} r={6} fill={SHAPE} />
      </g>
    </>
  )
}

// Logic Web: three ideas, and the links between them drawn one by one.
function Relational() {
  const nodes: [number, number][] = [
    [40, 58],
    [80, 20],
    [120, 58],
  ]
  return (
    <>
      <line x1={40} y1={58} x2={80} y2={20} stroke={LINE} strokeWidth={2.5} strokeLinecap="round" className="anim-demo-seq" style={at(0)} />
      <line x1={80} y1={20} x2={120} y2={58} stroke={LINE} strokeWidth={2.5} strokeLinecap="round" className="anim-demo-seq" style={at(1)} />
      <line x1={40} y1={58} x2={120} y2={58} stroke={MARK} strokeWidth={2.5} strokeLinecap="round" className="anim-demo-seq" style={at(2)} />
      {nodes.map(([x, y]) => (
        <circle key={x} cx={x} cy={y} r={9} fill={SHAPE} />
      ))}
    </>
  )
}

// Strategic Blueprint: a disc lifts off one peg and lands on the next.
function Tower() {
  return (
    <>
      <line x1={24} y1={70} x2={136} y2={70} stroke={LINE} strokeWidth={2} strokeLinecap="round" />
      {[52, 108].map((x) => (
        <line key={x} x1={x} y1={70} x2={x} y2={30} stroke={LINE} strokeWidth={3} strokeLinecap="round" />
      ))}
      <rect x={36} y={58} width={32} height={10} rx={5} fill={SHAPE} />
      <g className="anim-demo-move">
        <rect x={40} y={46} width={24} height={10} rx={5} fill={MARK} />
      </g>
    </>
  )
}

// Precision Archive: a shape, then one almost like it.
function Mst() {
  return (
    <>
      <g className="anim-demo-seq" style={at(0)}>
        <path d="M30 60 L50 18 L70 60 Z" fill={SHAPE} />
      </g>
      <g className="anim-demo-seq" style={at(3)}>
        <path d="M90 60 L112 22 L130 60 Z" fill={SHAPE} />
      </g>
    </>
  )
}

// Pattern Puzzle: a 3 x 3 pattern whose last cell fills in.
function Matrix() {
  const cells = Array.from({ length: 9 }, (_, k) => k)
  return (
    <>
      {cells.map((k) => {
        const x = 53 + (k % 3) * 19
        const y = 13 + Math.floor(k / 3) * 19
        const filled = (k % 3) + Math.floor(k / 3) >= 2 // a diagonal pattern; the last cell completes it
        return k === 8 ? (
          <g key={k}>
            <rect x={x} y={y} width={16} height={16} rx={3} fill="none" stroke={LINE} strokeDasharray="3 3" />
            <rect x={x - 1} y={y - 1} width={18} height={18} rx={4} fill={MARK} className="anim-demo-seq" style={at(1)} />
          </g>
        ) : (
          <rect key={k} x={x} y={y} width={16} height={16} rx={3} fill={filled ? SHAPE : SOFT} stroke={LINE} strokeWidth={1} />
        )
      })}
    </>
  )
}

const DEMOS: Record<SchemaType, () => ReactNode> = {
  stroop: Stroop,
  n_back: NBack,
  mental_rotation: Rotation,
  ufov: Ufov,
  relational: Relational,
  tower: Tower,
  mst: Mst,
  matrix: Matrix,
}

export function ExerciseDemo({ schema }: { schema: SchemaType }) {
  const Demo = DEMOS[schema]
  return (
    <svg aria-hidden="true" data-demo={schema} viewBox="0 0 160 80" width={160} height={80} className="mx-auto block select-none">
      <Demo />
    </svg>
  )
}
