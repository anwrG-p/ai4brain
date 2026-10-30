export type Raf = (cb: FrameRequestCallback) => unknown
export const defaultRaf: Raf = (cb) => requestAnimationFrame(cb)

// Median interval over n rAF frames (n + 1 timestamps).
export function measureFrameMs(raf: Raf = defaultRaf, n = 30): Promise<number> {
  return new Promise((resolve) => {
    const ts: number[] = []
    const tick = (t: number) => {
      ts.push(t)
      if (ts.length <= n) return void raf(tick)
      const d = ts.slice(1).map((x, k) => x - (ts[k] ?? x)).sort((a, b) => a - b)
      resolve(d[Math.floor(d.length / 2)] ?? 0)
    }
    raf(tick)
  })
}

// Whole frames for a requested duration, at least one (a non-finite ratio also shows one frame).
export function framesFor(requestedMs: number, frameMs: number): number {
  const n = Math.round(requestedMs / frameMs)
  return Number.isFinite(n) ? Math.max(1, n) : 1
}
