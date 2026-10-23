// ponytail: QUEST+ over duration only; similarity and mask_noise step per block (Member 5). Full 3-D stimulus space if the team needs it.

type Opts = { thresholds?: number[]; slopes?: number[]; guess?: number; lapse?: number }

// 20 log-spaced thresholds over 17–500 ms.
const logGrid = (lo: number, hi: number, n: number) =>
  Array.from({ length: n }, (_, i) => lo * (hi / lo) ** (i / (n - 1)))

const entropy = (post: number[][]) => {
  let h = 0
  for (const row of post) for (const p of row) if (p > 0) h -= p * Math.log(p)
  return h
}

export class QuestPlus {
  private readonly thresholds: number[]
  private readonly slopes: number[]
  private readonly guess: number
  private readonly lapse: number
  private post: number[][] // [θ][β], sums to 1

  constructor(private readonly durationsMs: number[], opts: Opts = {}) {
    this.thresholds = opts.thresholds ?? logGrid(17, 500, 20)
    this.slopes = opts.slopes ?? [1, 2, 3, 4]
    this.guess = opts.guess ?? 1 / 16
    this.lapse = opts.lapse ?? 0.02
    const u = 1 / (this.thresholds.length * this.slopes.length)
    this.post = this.thresholds.map(() => this.slopes.map(() => u))
  }

  private p(d: number, theta: number, beta: number): number {
    return this.guess + (1 - this.guess - this.lapse) * (1 - Math.exp(-((d / theta) ** beta)))
  }

  // Unnormalized posterior × likelihood, then normalized; returns [posterior, P(outcome)].
  private updated(d: number, correct: boolean): [number[][], number] {
    let z = 0
    const next = this.post.map((row, i) =>
      row.map((w, j) => {
        const pc = this.p(d, this.thresholds[i], this.slopes[j])
        const v = w * (correct ? pc : 1 - pc)
        z += v
        return v
      }),
    )
    return [next.map((row) => row.map((v) => v / z)), z]
  }

  next(): number {
    let best = Infinity
    let bestD = this.durationsMs[0]
    for (const d of [...this.durationsMs].sort((a, b) => a - b)) {
      let eh = 0
      for (const r of [true, false]) {
        const [post, pr] = this.updated(d, r)
        if (pr > 0) eh += pr * entropy(post)
      }
      if (eh < best) {
        best = eh
        bestD = d
      }
    }
    return bestD
  }

  update(shownMs: number, correct: boolean): void {
    this.post = this.updated(shownMs, correct)[0]
  }

  thresholdMs(): number {
    return this.post.reduce((m, row, i) => m + this.thresholds[i] * row.reduce((a, b) => a + b, 0), 0)
  }
}
