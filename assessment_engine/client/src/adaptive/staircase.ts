// Weighted up-down staircase (Kaernbach 1991): converges where accuracy equals `target`.
export class WeightedStaircase {
  private x: number
  private readonly max: number
  private readonly down: number

  constructor(nLevels: number, target = 0.85, private readonly step = 1, start = 0) {
    this.max = nLevels - 1
    this.down = (step * target) / (1 - target)
    this.x = Math.min(Math.max(start, 0), this.max)
  }

  get level(): number {
    return Math.round(this.x)
  }

  update(correct: boolean): void {
    const x = correct ? this.x + this.step : this.x - this.down
    this.x = Math.min(Math.max(x, 0), this.max)
  }
}
